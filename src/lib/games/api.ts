// /api/games Route Handler의 로직. Route Handler는 이 함수들에 위임만 한다.
// 익명 규칙: 응답·로그에 채널 ID, write_token, 관리자 실명이 나가지 않는다. 로그에는 코드와 error.name만 쓴다.
import { checkSameOrigin, getSessionActor, parseAdminIds } from "./admin.ts";
import { searchCategories, ChzzkCategoryError } from "../chzzk-category.ts";
import { conflictMessage } from "./diff.ts";
import { createGame, getGame, listChanges, listGames, setHidden, updateGame } from "./repo.ts";
import { toGame } from "./rows.ts";
import { CHZZK_VOD_MESSAGE, ID_PATTERN } from "./schema.ts";
import { fetchYoutubeMeta, YoutubeMetaError } from "./youtube-meta.ts";
import type {
  Actor,
  ApiErrorCode,
  CategorySearchItem,
  FetchLike,
  GameInput,
  GamePatch,
  GamesDb,
  GamesPageData,
  SessionState,
  Vod,
  WriteContext,
  WriteResult,
} from "./types.ts";

export interface ApiDeps {
  db: GamesDb;
  env: { ADMIN_CHANNEL_IDS?: string; CHZZK_CLIENT_ID?: string; CHZZK_CLIENT_SECRET?: string };
  /** unix seconds */
  now: () => number;
  fetch: FetchLike;
  uuid: () => string;
  /** 운영: console.error. 코드와 error.name만 넘긴다 */
  log?: (message: string) => void;
}

export const BODY_MAX_BYTES = 64 * 1024;

// ---------- 응답 ----------

function respond(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function fail(status: number, code: ApiErrorCode, message: string): Response {
  return respond(status, { error: { code, message } });
}

/** 예상 못 한 예외를 500으로 바꾼다. 스택·메시지·ID는 응답에도 로그에도 넣지 않는다 */
function unexpected(deps: ApiDeps, error: unknown): Response {
  deps.log?.(`games-api unavailable ${error instanceof Error ? error.name : "unknown"}`);
  return fail(500, "unavailable", "잠시 후 다시 시도해 주세요.");
}

/** 바깥 서비스 장애(502). 이름만 로그한다 */
function upstream(deps: ApiDeps, error: Error, message: string): Response {
  deps.log?.(`games-api upstream ${error.name}`);
  return fail(502, "upstream", message);
}

async function guarded(deps: ApiDeps, run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    return unexpected(deps, error);
  }
}

// ---------- 모양 검사(parseGameInput / parseGamePatch) ----------

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function onlyKeys(o: Obj, allowed: readonly string[]): boolean {
  return Object.keys(o).every((k) => allowed.includes(k));
}

function parseVods(v: unknown): Vod[] | null {
  if (!Array.isArray(v)) return null;
  const out: Vod[] = [];
  for (const item of v) {
    if (!isObj(item) || Object.keys(item).length !== 3) return null;
    const { title, url, date } = item;
    if (typeof title !== "string" || typeof url !== "string" || typeof date !== "string") return null;
    out.push({ title, url, date });
  }
  return out;
}

const INPUT_KEYS = ["name", "originalTitle", "categoryId", "posterUrl", "firstPlayed", "status", "vods"];

/** 모양(키 집합·타입)만 본다. 값의 의미는 repo의 validateCandidate가 검사한다 */
export function parseGameInput(body: unknown): GameInput | null {
  if (!isObj(body) || !onlyKeys(body, INPUT_KEYS)) return null;
  const { name, originalTitle, categoryId, posterUrl, firstPlayed, status } = body;
  if (typeof name !== "string" || typeof status !== "string") return null;
  if (firstPlayed !== null && typeof firstPlayed !== "string") return null;
  const vods = parseVods(body.vods);
  if (vods === null) return null;
  const out: GameInput = { name, firstPlayed, status: status as GameInput["status"], vods };
  for (const [key, value] of [
    ["originalTitle", originalTitle],
    ["categoryId", categoryId],
    ["posterUrl", posterUrl],
  ] as const) {
    if (value === undefined) continue;
    if (typeof value !== "string") return null;
    out[key] = value;
  }
  return out;
}

const PATCH_KEYS = ["name", "originalTitle", "category", "firstPlayed", "status", "vods"];

export function parseGamePatch(body: unknown): GamePatch | null {
  if (!isObj(body) || !onlyKeys(body, PATCH_KEYS)) return null;
  const out: GamePatch = {};
  if ("name" in body) {
    if (typeof body.name !== "string") return null;
    out.name = body.name;
  }
  if ("originalTitle" in body) {
    if (body.originalTitle !== null && typeof body.originalTitle !== "string") return null;
    out.originalTitle = body.originalTitle;
  }
  if ("category" in body) {
    const c = body.category;
    if (c === null) {
      out.category = null;
    } else {
      if (!isObj(c) || !onlyKeys(c, ["categoryId", "posterUrl"])) return null;
      if (typeof c.categoryId !== "string") return null;
      if (c.posterUrl !== null && typeof c.posterUrl !== "string") return null;
      out.category = { categoryId: c.categoryId, posterUrl: c.posterUrl };
    }
  }
  if ("firstPlayed" in body) {
    if (body.firstPlayed !== null && typeof body.firstPlayed !== "string") return null;
    out.firstPlayed = body.firstPlayed;
  }
  if ("status" in body) {
    if (typeof body.status !== "string") return null;
    out.status = body.status as GamePatch["status"];
  }
  if ("vods" in body) {
    const vods = parseVods(body.vods);
    if (vods === null) return null;
    out.vods = vods;
  }
  return out;
}

// ---------- 세션 ----------

function sessionOf(req: Request, deps: ApiDeps): Promise<SessionState> {
  return getSessionActor(deps.db, req.headers.get("cookie"), deps.now(), parseAdminIds(deps.env.ADMIN_CHANNEL_IDS));
}

/** 쓰기 요청의 앞단: 출처 → 세션/권한. 통과하면 Actor, 아니면 그대로 돌려줄 Response */
async function requireAdmin(req: Request, deps: ApiDeps): Promise<Actor | Response> {
  const state = await sessionOf(req, deps);
  switch (state.kind) {
    case "anonymous":
      return fail(401, "login_required", "치지직으로 로그인해 주세요.");
    case "expired":
      return fail(401, "session_expired", "로그인이 만료됐어요. 다시 로그인해 주세요.");
    case "user":
      return fail(403, "forbidden", "수정 권한이 없어요.");
    case "admin":
      return state.actor;
  }
}

async function requireWriter(req: Request, deps: ApiDeps): Promise<Actor | Response> {
  if (!checkSameOrigin(req)) return fail(403, "cross_origin", "다른 사이트에서 보낸 요청은 받을 수 없어요.");
  return requireAdmin(req, deps);
}

type Body = { ok: true; value: unknown } | { ok: false; response: Response };

/** 스트림을 max바이트까지만 읽는다. 넘으면 그 자리에서 읽기를 취소하고 null */
async function readCapped(body: ReadableStream<Uint8Array> | null, max: number): Promise<Uint8Array | null> {
  if (body === null) return new Uint8Array(0);
  const reader = body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

/** 본문을 64KB까지만 받아 JSON으로 읽는다. Content-Length가 없거나 거짓이어도 스트림을 64KB에서 끊는다 */
async function readJsonBody(req: Request): Promise<Body> {
  const declared = Number(req.headers.get("content-length"));
  const tooLarge = fail(413, "payload_too_large", "요청이 너무 커요.");
  if (declared > BODY_MAX_BYTES) return { ok: false, response: tooLarge };
  const bytes = await readCapped(req.body, BODY_MAX_BYTES);
  if (bytes === null) return { ok: false, response: tooLarge };
  try {
    return { ok: true, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch {
    return { ok: false, response: fail(400, "bad_json", "요청 본문을 읽을 수 없어요.") };
  }
}

const badRequest = () => fail(400, "bad_request", "요청 모양이 올바르지 않아요.");
const notFound = () => fail(404, "not_found", "찾을 수 없는 게임이에요.");

/** 경로의 id를 디코드하고 ID_PATTERN으로 거른다. 통과 못 하면 null(404) */
function decodeId(raw: string): string | null {
  let id: string;
  try {
    id = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return ID_PATTERN.test(id) ? id : null;
}

function writeContext(actor: Actor, deps: ApiDeps): WriteContext {
  return { actor, now: deps.now(), uuid: deps.uuid };
}

function writeResponse(result: WriteResult, okStatus: number): Response {
  if (result.ok) return respond(okStatus, { game: result.game, changed: result.changed });
  switch (result.reason) {
    case "not_found":
      return notFound();
    case "invalid":
      return respond(422, { error: { code: "invalid", message: "입력을 확인해 주세요." }, issues: result.issues });
    case "conflict":
      return respond(409, { error: { code: "conflict", message: conflictMessage(result.latest) }, latest: result.latest });
  }
}

/** 쓰기 핸들러 공통 뼈대: 출처 → 권한 → 본문 크기/JSON → (모양 검사는 run 안) */
function writeHandler(
  req: Request,
  deps: ApiDeps,
  run: (actor: Actor, body: unknown) => Promise<Response>,
): Promise<Response> {
  return guarded(deps, async () => {
    const actor = await requireWriter(req, deps);
    if (actor instanceof Response) return actor;
    const body = await readJsonBody(req);
    if (!body.ok) return body.response;
    return run(actor, body.value);
  });
}

// ---------- 핸들러 ----------

/** GET /api/games[?includeHidden=1] — 401을 내지 않는다. 관리자만 GameRecord[](+숨김) */
export function handleListGames(req: Request, deps: ApiDeps): Promise<Response> {
  return guarded(deps, async () => {
    const state = await sessionOf(req, deps);
    if (state.kind === "admin") {
      const includeHidden = new URL(req.url).searchParams.get("includeHidden") === "1";
      return respond(200, { games: await listGames(deps.db, { includeHidden }) });
    }
    return respond(200, { games: (await listGames(deps.db, { includeHidden: false })).map(toGame) });
  });
}

export async function loadGamesPageData(deps: ApiDeps, cookieHeader: string | null): Promise<GamesPageData> {
  try {
    const state = await getSessionActor(deps.db, cookieHeader, deps.now(), parseAdminIds(deps.env.ADMIN_CHANNEL_IDS));
    if (state.kind === "admin") {
      return { ok: true, admin: { name: state.actor.name }, games: await listGames(deps.db, { includeHidden: true }) };
    }
    return { ok: true, admin: null, games: (await listGames(deps.db, { includeHidden: false })).map(toGame) };
  } catch (error) {
    unexpected(deps, error);
    return { ok: false };
  }
}

/** POST /api/games  { input } */
export function handleCreateGame(req: Request, deps: ApiDeps): Promise<Response> {
  return writeHandler(req, deps, async (actor, body) => {
    if (!isObj(body) || !onlyKeys(body, ["input"])) return badRequest();
    const input = parseGameInput(body.input);
    if (input === null) return badRequest();
    return writeResponse(await createGame(deps.db, input, writeContext(actor, deps)), 201);
  });
}

/** PATCH /api/games/[id]  { expectedVersion, patch } */
export function handleUpdateGame(req: Request, deps: ApiDeps, rawId: string): Promise<Response> {
  return writeHandler(req, deps, async (actor, body) => {
    if (!isObj(body) || !onlyKeys(body, ["expectedVersion", "patch"])) return badRequest();
    const { expectedVersion } = body;
    const patch = parseGamePatch(body.patch);
    if (!Number.isSafeInteger(expectedVersion) || (expectedVersion as number) < 1 || patch === null) return badRequest();
    const id = decodeId(rawId);
    if (id === null) return notFound();
    return writeResponse(await updateGame(deps.db, id, patch, expectedVersion as number, writeContext(actor, deps)), 200);
  });
}

/** POST /api/games/[id]/hidden  { hidden } */
export function handleSetHidden(req: Request, deps: ApiDeps, rawId: string): Promise<Response> {
  return writeHandler(req, deps, async (actor, body) => {
    if (!isObj(body) || !onlyKeys(body, ["hidden"]) || typeof body.hidden !== "boolean") return badRequest();
    const id = decodeId(rawId);
    if (id === null) return notFound();
    return writeResponse(await setHidden(deps.db, id, body.hidden, writeContext(actor, deps)), 200);
  });
}

// ---------- 관리자 읽기 ----------

const LIMIT_PATTERN = /^\d{1,2}$/;

/** GET /api/games/[id]/changes?limit= */
export function handleListChanges(req: Request, deps: ApiDeps, rawId: string): Promise<Response> {
  return guarded(deps, async () => {
    const gate = await requireAdmin(req, deps);
    if (gate instanceof Response) return gate;
    const rawLimit = new URL(req.url).searchParams.get("limit");
    let limit: number | undefined;
    if (rawLimit !== null) {
      limit = LIMIT_PATTERN.test(rawLimit) ? Number(rawLimit) : 0;
      if (limit < 1 || limit > 50) return badRequest();
    }
    const id = decodeId(rawId);
    if (id === null || (await getGame(deps.db, id, { includeHidden: true })) === null) return notFound();
    return respond(200, await listChanges(deps.db, id, limit));
  });
}

const Q_MAX = 50;

/** GET /api/games/categories?q= — 치지직 카테고리 검색 + 이미 목록에 있는지(taken) */
export function handleSearchCategories(req: Request, deps: ApiDeps): Promise<Response> {
  return guarded(deps, async () => {
    const gate = await requireAdmin(req, deps);
    if (gate instanceof Response) return gate;
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    if (q === "" || q.length > Q_MAX) return badRequest();
    let found;
    try {
      found = await searchCategories(
        deps.fetch,
        { clientId: deps.env.CHZZK_CLIENT_ID ?? "", clientSecret: deps.env.CHZZK_CLIENT_SECRET ?? "" },
        q,
      );
    } catch (error) {
      if (error instanceof ChzzkCategoryError) return upstream(deps, error, "치지직 검색이 잠시 안 돼요.");
      throw error;
    }
    const taken = new Map<string, CategorySearchItem["taken"]>();
    for (const g of await listGames(deps.db, { includeHidden: true })) {
      if (g.categoryId !== undefined) taken.set(g.categoryId, { id: g.id, name: g.name, hidden: g.hidden });
    }
    const results: CategorySearchItem[] = found.map((c) => ({
      categoryId: c.categoryId,
      name: c.categoryValue,
      posterUrl: c.posterImageUrl,
      taken: taken.get(c.categoryId) ?? null,
    }));
    return respond(200, { results });
  });
}

const URL_MAX = 500;

/** GET /api/games/youtube?url= — oEmbed 제목·날짜 프록시 */
export function handleYoutubeMeta(req: Request, deps: ApiDeps): Promise<Response> {
  return guarded(deps, async () => {
    const gate = await requireAdmin(req, deps);
    if (gate instanceof Response) return gate;
    const url = new URL(req.url).searchParams.get("url") ?? "";
    if (url === "" || url.length > URL_MAX) return badRequest();
    try {
      return respond(200, await fetchYoutubeMeta(deps.fetch, url));
    } catch (error) {
      if (!(error instanceof YoutubeMetaError)) throw error;
      switch (error.code) {
        case "chzzk_vod":
          return fail(422, "chzzk_vod", CHZZK_VOD_MESSAGE);
        case "invalid_url":
          return respond(422, { error: { code: "invalid", message: "유튜브 영상 링크를 넣어 주세요." }, issues: [] });
        case "not_found":
          return fail(404, "not_found", "비공개이거나 삭제된 영상이에요.");
        case "upstream":
          return upstream(deps, error, "유튜브에서 제목을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    }
  });
}
