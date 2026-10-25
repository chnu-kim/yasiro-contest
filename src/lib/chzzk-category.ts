import { ID_PATTERN, isPosterUrl, youtubeVideoId } from "./games/schema.ts";
import type {
  ChzzkCategory,
  ChzzkCategoryConfig,
  FetchLike,
  GameDraft,
  Game,
  GameDraftInput,
  UpsertResult,
  Vod,
} from "./games/types.ts";

export const CHZZK_OPEN_API = "https://openapi.chzzk.naver.com";
export const DEFAULT_SEARCH_SIZE = 20;

export class ChzzkCategoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChzzkCategoryError";
  }
}

export class ChzzkAuthError extends ChzzkCategoryError {
  constructor(message: string) {
    super(message);
    this.name = "ChzzkAuthError";
  }
}

export class ChzzkResponseError extends ChzzkCategoryError {
  constructor(message: string) {
    super(message);
    this.name = "ChzzkResponseError";
  }
}

export class GameDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameDraftError";
  }
}

export class GameConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameConflictError";
  }
}

export class CandidateSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CandidateSelectionError";
  }
}

export class ChzzkHttpError extends ChzzkCategoryError {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ChzzkHttpError";
    this.status = status;
  }
}

/** cause에는 원본 에러 객체가 아니라 redact된 사본(이름·메시지만)이 들어간다. 원본의 다른 필드·스택에 secret이 남을 수 있어서다. */
export class ChzzkNetworkError extends ChzzkCategoryError {
  readonly cause: unknown;
  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "ChzzkNetworkError";
    this.cause = cause;
  }
}

const BODY_MAX = 200;

function redact(text: string, config: ChzzkCategoryConfig): string {
  // 자격 증명은 searchCategories 앞단에서 비어 있지 않음이 검증된 뒤에만 쓰인다.
  let out = text;
  for (const secret of [config.clientSecret, config.clientId]) {
    out = out.split(secret.trim()).join("***");
  }
  return out;
}

async function describeBody(res: Response, config: ChzzkCategoryConfig): Promise<string> {
  try {
    return redact(await res.text(), config).slice(0, BODY_MAX);
  } catch {
    return "";
  }
}

export async function searchCategories(
  fetchImpl: FetchLike,
  config: ChzzkCategoryConfig,
  query: string,
  size: number = DEFAULT_SEARCH_SIZE,
): Promise<ChzzkCategory[]> {
  const q = query.trim();
  if (q === "") throw new RangeError("검색어가 비어 있습니다");
  if (!Number.isInteger(size) || size < 1 || size > 50) {
    throw new RangeError("size는 1~50의 정수여야 합니다");
  }
  if (config.clientId.trim() === "" || config.clientSecret.trim() === "") {
    throw new ChzzkAuthError("치지직 Client-Id/Client-Secret이 없습니다 (.dev.vars)");
  }
  const base = (config.baseUrl ?? CHZZK_OPEN_API).replace(/\/+$/, "");
  const params = new URLSearchParams({ query: q, size: String(size) });
  const url = `${base}/open/v1/categories/search?${params}`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "GET",
      headers: { "Client-Id": config.clientId, "Client-Secret": config.clientSecret },
    });
  } catch (original) {
    const reason = redact(original instanceof Error ? original.message : String(original), config);
    let cause: unknown = reason;
    if (original instanceof Error) {
      const copy = new Error(reason);
      copy.name = original.name;
      copy.stack = `${copy.name}: ${reason}`;
      cause = copy;
    }
    throw new ChzzkNetworkError(`치지직 API 요청 실패: ${reason}`, cause);
  }
  if (!res.ok) {
    const detail = await describeBody(res, config);
    if (res.status === 401 || res.status === 403) {
      throw new ChzzkAuthError(`치지직 인증 실패 (HTTP ${res.status}) ${detail}`.trim());
    }
    throw new ChzzkHttpError(`치지직 API 오류 (HTTP ${res.status}) ${detail}`.trim(), res.status);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ChzzkResponseError("치지직 응답이 JSON이 아닙니다");
  }
  if (!isRecord(body)) throw new ChzzkResponseError("치지직 응답 형식이 올바르지 않습니다");
  if (body.code !== 200) {
    const message = typeof body.message === "string" ? redact(body.message, config) : "";
    const text = `치지직 응답 code ${String(body.code)}: ${message}`;
    if (body.code === 401 || body.code === 403) throw new ChzzkAuthError(text);
    throw new ChzzkResponseError(text);
  }
  const data = isRecord(body.content) ? body.content.data : undefined;
  if (!Array.isArray(data)) throw new ChzzkResponseError("치지직 응답에 content.data 배열이 없습니다");

  const games: ChzzkCategory[] = [];
  data.forEach((item: unknown, index: number) => {
    const invalid = () => new ChzzkResponseError(`치지직 응답 항목 [${index}] 형식이 올바르지 않습니다`);
    if (!isRecord(item) || !isFilled(item.categoryType)) throw invalid();
    // 쓰지 않는 타입(ETC, SPORTS 등)의 형식 문제가 게임 추가를 막지 않도록 GAME만 필드를 검사한다
    if (item.categoryType !== "GAME") return;
    if (!isFilled(item.categoryId) || !isFilled(item.categoryValue)) throw invalid();
    games.push({
      categoryType: "GAME",
      categoryId: item.categoryId as string,
      categoryValue: item.categoryValue as string,
      posterImageUrl: isPosterUrl(item.posterImageUrl) ? item.posterImageUrl : null,
    });
  });
  return games;
}

/** 검색 후보에서 하나를 고른다. categoryId가 기준이고, pick(1-based)은 미리보기용이며 둘 다 주면 일치해야 한다. */
export function selectCandidate(
  candidates: readonly ChzzkCategory[],
  selection: { pick?: number; categoryId?: string },
): ChzzkCategory {
  const { pick, categoryId } = selection;
  let byPick: ChzzkCategory | undefined;
  if (pick !== undefined) {
    byPick = candidates[pick - 1];
    if (byPick === undefined) throw new CandidateSelectionError(`--pick ${pick} 은 후보 수(${candidates.length})를 넘습니다`);
  }
  if (categoryId === undefined) {
    if (byPick === undefined) throw new CandidateSelectionError("--category-id 또는 --pick 이 필요합니다");
    return byPick;
  }
  const byId = candidates.find((c) => c.categoryId === categoryId);
  if (byId === undefined) {
    const ids = candidates.map((c) => c.categoryId).join(", ");
    throw new CandidateSelectionError(`categoryId "${categoryId}" 가 후보에 없습니다 (후보: ${ids})`);
  }
  if (byPick !== undefined && byPick !== byId) {
    throw new CandidateSelectionError(`--pick ${pick} 은 ${byPick.categoryId} 인데 --category-id 는 ${categoryId} 입니다`);
  }
  return byId;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFilled(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

function trimDashes(s: string): string {
  return s.replace(/^-+|-+$/g, "");
}

/** 임의 문자열을 ID_PATTERN을 만족하는 slug로 바꾼다. 만들 수 없으면 "" */
export function slugify(s: string): string {
  const base = trimDashes(s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-"));
  if (ID_PATTERN.test(base)) return base;
  // \p{Lm}, \p{Nl}, \p{No} 등 ID_PATTERN이 허용하지 않는 문자는 제거한다.
  return trimDashes(base.replace(/[^\p{Ll}\p{Lo}\p{Nd}-]/gu, "").replace(/-{2,}/g, "-"));
}

/** 검색 결과 한 건과 사람이 입력한 값으로 GameDraft를 만든다. 형식 검증은 parseGames가 한다. */
export function toGameDraft(category: ChzzkCategory, input: GameDraftInput = {}): GameDraft {
  const name = category.categoryValue.trim();
  const given = input.originalTitle?.trim();
  const originalTitle = given === undefined || given === "" || given === name ? undefined : given;

  let id: string;
  if (input.id !== undefined) {
    if (!ID_PATTERN.test(input.id)) {
      throw new GameDraftError(`id "${input.id}"는 소문자/숫자/한글과 '-'만 쓸 수 있습니다`);
    }
    id = input.id;
  } else {
    const candidates = [originalTitle ?? "", category.categoryId, name];
    id = candidates.map(slugify).find((slug) => slug !== "") ?? "";
    if (id === "") throw new GameDraftError("id를 만들 수 없습니다 (--id 필요)");
  }

  return {
    id,
    name,
    categoryId: category.categoryId,
    posterUrl: category.posterImageUrl ?? undefined,
    originalTitle,
    firstPlayed: input.firstPlayed,
    status: input.status,
    vods: input.vods ?? [],
  };
}

/** videoId가 있으면 그것으로, 없으면 URL 문자열로 영상을 식별한다. */
function vodKey(vod: Vod): string {
  const videoId = youtubeVideoId(vod.url);
  return videoId === null ? `url:${vod.url}` : `yt:${videoId}`;
}

/** 게임 목록에 draft를 추가하거나 기존 게임에 병합한 새 목록을 반환한다. 입력은 변경하지 않는다. */
export function upsertGame(games: readonly Game[], draft: GameDraft): UpsertResult {
  const byCategory =
    draft.categoryId === undefined ? -1 : games.findIndex((g) => g.categoryId === draft.categoryId);
  const byId = games.findIndex((g) => g.id === draft.id);

  if (byCategory !== -1 && byId !== -1 && byCategory !== byId) {
    throw new GameConflictError(`id "${draft.id}"는 다른 게임이 이미 사용 중입니다`);
  }
  if (
    byCategory === -1 &&
    byId !== -1 &&
    draft.categoryId !== undefined &&
    games[byId].categoryId !== undefined &&
    games[byId].categoryId !== draft.categoryId
  ) {
    throw new GameConflictError(
      `id "${draft.id}"는 다른 categoryId(${games[byId].categoryId})의 게임입니다`,
    );
  }

  const target = byCategory !== -1 ? byCategory : byId;

  if (target === -1) {
    const game: Game = {
      id: draft.id,
      name: draft.name,
      ...(draft.originalTitle !== undefined && { originalTitle: draft.originalTitle }),
      ...(draft.categoryId !== undefined && { categoryId: draft.categoryId }),
      ...(draft.posterUrl !== undefined && { posterUrl: draft.posterUrl }),
      firstPlayed: draft.firstPlayed ?? null,
      status: draft.status ?? "unknown",
      vods: [...draft.vods],
    };
    return { games: [...games, game], action: "added", game };
  }

  const old = games[target];
  const seen = new Set(old.vods.map(vodKey));
  const vods = [...old.vods];
  for (const vod of draft.vods) {
    const key = vodKey(vod);
    if (seen.has(key)) continue;
    seen.add(key);
    vods.push(vod);
  }
  const originalTitle = draft.originalTitle ?? old.originalTitle;
  const categoryId = draft.categoryId ?? old.categoryId;
  const posterUrl = draft.posterUrl ?? old.posterUrl;
  const game: Game = {
    id: old.id,
    name: draft.name,
    ...(originalTitle !== undefined && { originalTitle }),
    ...(categoryId !== undefined && { categoryId }),
    ...(posterUrl !== undefined && { posterUrl }),
    firstPlayed: draft.firstPlayed === undefined ? old.firstPlayed : draft.firstPlayed,
    status: draft.status ?? old.status,
    vods,
  };
  const next = [...games];
  next[target] = game;
  return { games: next, action: "updated", game };
}
