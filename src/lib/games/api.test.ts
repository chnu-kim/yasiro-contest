import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BODY_MAX_BYTES,
  handleCreateGame,
  handleListChanges,
  handleListGames,
  handleSearchCategories,
  handleSetHidden,
  handleUpdateGame,
  handleYoutubeMeta,
  loadGamesPageData,
  parseGameInput,
  parseGamePatch,
  type ApiDeps,
} from "./api.ts";
import type { Actor, Game, GameRecord, GamesDb, SessionState, ValidationIssue, WriteResult } from "./types.ts";

// repo/admin/diff/youtube-meta/chzzk-category는 별도 모듈에서 100% 검증한다. 여기서는 대역으로 바꿔 api.ts의
// 권한·상태코드 분기만 본다. 실제 모듈과 D1을 함께 쓰는 익명 E2E는 api.e2e.test.ts.
const m = vi.hoisted(() => {
  class YoutubeMetaError extends Error {
    readonly code: string;
    constructor(code: string) {
      super(code);
      this.name = "YoutubeMetaError";
      this.code = code;
    }
  }
  class ChzzkCategoryError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ChzzkCategoryError";
    }
  }
  return {
    YoutubeMetaError,
    ChzzkCategoryError,
    getSessionActor: vi.fn(),
    checkSameOrigin: vi.fn(),
    parseAdminIds: vi.fn(),
    listGames: vi.fn(),
    getGame: vi.fn(),
    createGame: vi.fn(),
    updateGame: vi.fn(),
    setHidden: vi.fn(),
    listChanges: vi.fn(),
    conflictMessage: vi.fn(),
    fetchYoutubeMeta: vi.fn(),
    searchCategories: vi.fn(),
  };
});

vi.mock("./admin.ts", () => ({
  getSessionActor: m.getSessionActor,
  checkSameOrigin: m.checkSameOrigin,
  parseAdminIds: m.parseAdminIds,
}));
vi.mock("./repo.ts", () => ({
  listGames: m.listGames,
  getGame: m.getGame,
  createGame: m.createGame,
  updateGame: m.updateGame,
  setHidden: m.setHidden,
  listChanges: m.listChanges,
}));
vi.mock("./diff.ts", () => ({ conflictMessage: m.conflictMessage }));
vi.mock("./youtube-meta.ts", () => ({ fetchYoutubeMeta: m.fetchYoutubeMeta, YoutubeMetaError: m.YoutubeMetaError }));
vi.mock("../chzzk-category.ts", () => ({ searchCategories: m.searchCategories, ChzzkCategoryError: m.ChzzkCategoryError }));

const NOW = 1_792_900_000;
const SECRET_ID = "0123456789abcdef0123456789abcdef";
const ADMIN_IDS = new Set([SECRET_ID]);
const ACTOR: Actor = { channelId: SECRET_ID, name: "관리자" };
const DB = { __db: true } as unknown as GamesDb;
const ORIGIN = "https://yasiro.stream";

function game(id: string, extra: Partial<Game> = {}): Game {
  return { id, name: `게임 ${id}`, firstPlayed: "2026-10-01", status: "clear", vods: [], ...extra };
}

function record(id: string, extra: Partial<GameRecord> = {}): GameRecord {
  return {
    ...game(id),
    hidden: false,
    version: 1,
    createdAt: NOW - 100,
    updatedAt: NOW - 50,
    updatedByName: "관리자",
    ...extra,
  };
}

function session(state: SessionState): void {
  m.getSessionActor.mockResolvedValue(state);
}
const asAdmin = () => session({ kind: "admin", actor: ACTOR });

let uuidCounter = 0;
function makeDeps(extra: Partial<ApiDeps> = {}): ApiDeps {
  return {
    db: DB,
    env: { ADMIN_CHANNEL_IDS: SECRET_ID, CHZZK_CLIENT_ID: "cid", CHZZK_CLIENT_SECRET: "csec" },
    now: () => NOW,
    fetch: vi.fn() as unknown as ApiDeps["fetch"],
    uuid: () => `u${++uuidCounter}`,
    log: vi.fn(),
    ...extra,
  };
}

function req(method: string, path: string, opts: { body?: unknown; raw?: BodyInit; headers?: Record<string, string> } = {}): Request {
  const headers: Record<string, string> = { origin: ORIGIN, cookie: "session_id=abc", ...opts.headers };
  let body: BodyInit | undefined = opts.raw;
  if (body === undefined && opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers["content-type"] = "application/json";
  }
  return new Request(`${ORIGIN}${path}`, { method, headers, body });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(res: Response): Promise<any> {
  return res.json();
}

beforeEach(() => {
  vi.resetAllMocks();
  uuidCounter = 0;
  m.checkSameOrigin.mockReturnValue(true);
  m.parseAdminIds.mockReturnValue(ADMIN_IDS);
  m.conflictMessage.mockImplementation((latest: GameRecord) => `충돌:${latest.updatedByName}`);
  session({ kind: "anonymous" });
});

// ---------------------------------------------------------------------------------------------
describe("parseGameInput", () => {
  const valid = {
    name: "엘든 링",
    originalTitle: "ELDEN RING",
    categoryId: "ELDEN_RING",
    posterUrl: "https://nng-phinf.pstatic.net/x.png",
    firstPlayed: "2026-10-01",
    status: "clear",
    vods: [{ title: "1화", url: "https://youtu.be/aaaaaaaaaaa", date: "2026-10-01" }],
  };

  it("전체 필드를 가진 입력을 사본으로 돌려준다", () => {
    const out = parseGameInput(valid);
    expect(out).toEqual(valid);
    expect(out).not.toBe(valid);
    expect(out?.vods[0]).not.toBe(valid.vods[0]);
  });

  it("선택 필드가 없으면 키 자체를 만들지 않는다", () => {
    const out = parseGameInput({ name: "a", firstPlayed: null, status: "unknown", vods: [] });
    expect(out).toEqual({ name: "a", firstPlayed: null, status: "unknown", vods: [] });
    expect(Object.keys(out as object)).toEqual(["name", "firstPlayed", "status", "vods"]);
  });

  it("입력을 바꾸지 않는다", () => {
    const frozen = structuredClone(valid);
    Object.freeze(frozen);
    Object.freeze(frozen.vods);
    Object.freeze(frozen.vods[0]);
    expect(() => parseGameInput(frozen)).not.toThrow();
    expect(frozen).toEqual(valid);
  });

  it.each([
    ["null", null],
    ["배열", []],
    ["문자열", "x"],
    ["숫자", 1],
    ["모르는 키", { ...valid, id: "x" }],
    ["__proto__ 키", JSON.parse('{"name":"a","firstPlayed":null,"status":"clear","vods":[],"__proto__":{}}')],
    ["name 없음", { firstPlayed: null, status: "clear", vods: [] }],
    ["name 숫자", { ...valid, name: 1 }],
    ["firstPlayed 없음", { name: "a", status: "clear", vods: [] }],
    ["firstPlayed 숫자", { ...valid, firstPlayed: 20261001 }],
    ["status 없음", { name: "a", firstPlayed: null, vods: [] }],
    ["status 숫자", { ...valid, status: 1 }],
    ["vods 없음", { name: "a", firstPlayed: null, status: "clear" }],
    ["vods 배열 아님", { ...valid, vods: {} }],
    ["vod null", { ...valid, vods: [null] }],
    ["vod 배열", { ...valid, vods: [[]] }],
    ["vod 키 부족", { ...valid, vods: [{ title: "a", url: "b" }] }],
    ["vod 키 초과", { ...valid, vods: [{ title: "a", url: "b", date: "c", id: "d" }] }],
    ["vod 타입 틀림", { ...valid, vods: [{ title: 1, url: "b", date: "c" }] }],
    ["originalTitle 숫자", { ...valid, originalTitle: 1 }],
    ["originalTitle null", { ...valid, originalTitle: null }],
    ["categoryId 숫자", { ...valid, categoryId: 1 }],
    ["posterUrl null", { ...valid, posterUrl: null }],
  ])("거부: %s", (_label, body) => {
    expect(parseGameInput(body)).toBeNull();
  });
});

describe("parseGamePatch", () => {
  it("빈 patch를 허용한다", () => {
    expect(parseGamePatch({})).toEqual({});
  });

  it("모든 필드를 사본으로 돌려준다", () => {
    const body = {
      name: "새 이름",
      originalTitle: null,
      category: { categoryId: "C", posterUrl: null },
      firstPlayed: null,
      status: "fail",
      vods: [{ title: "t", url: "u", date: "d" }],
    };
    const out = parseGamePatch(body);
    expect(out).toEqual(body);
    expect(out?.vods?.[0]).not.toBe(body.vods[0]);
    expect(out?.category).not.toBe(body.category);
  });

  it("category null, originalTitle 문자열, posterUrl 문자열을 받는다", () => {
    expect(parseGamePatch({ category: null })).toEqual({ category: null });
    expect(parseGamePatch({ originalTitle: "x" })).toEqual({ originalTitle: "x" });
    expect(parseGamePatch({ category: { categoryId: "C", posterUrl: "https://a.pstatic.net/p.png" } })).toEqual({
      category: { categoryId: "C", posterUrl: "https://a.pstatic.net/p.png" },
    });
  });

  it("입력을 바꾸지 않는다", () => {
    const body = Object.freeze({ category: Object.freeze({ categoryId: "C", posterUrl: null }), vods: Object.freeze([]) });
    expect(() => parseGamePatch(body)).not.toThrow();
  });

  it.each([
    ["null", null],
    ["배열", []],
    ["숫자", 3],
    ["모르는 키", { id: "x" }],
    ["hidden 키", { hidden: true }],
    ["name null", { name: null }],
    ["name 숫자", { name: 1 }],
    ["originalTitle 숫자", { originalTitle: 1 }],
    ["category 문자열", { category: "C" }],
    ["category 배열", { category: [] }],
    ["category categoryId 없음", { category: { posterUrl: null } }],
    ["category categoryId 숫자", { category: { categoryId: 1, posterUrl: null } }],
    ["category posterUrl 없음", { category: { categoryId: "C" } }],
    ["category posterUrl 숫자", { category: { categoryId: "C", posterUrl: 1 } }],
    ["category 키 초과", { category: { categoryId: "C", posterUrl: null, x: 1 } }],
    ["firstPlayed 숫자", { firstPlayed: 1 }],
    ["status 숫자", { status: 1 }],
    ["status null", { status: null }],
    ["vods 객체", { vods: {} }],
    ["vods 원소 틀림", { vods: [{ title: "a" }] }],
  ])("거부: %s", (_label, body) => {
    expect(parseGamePatch(body)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
describe("handleListGames", () => {
  const records = [record("a"), record("b", { hidden: true, version: 3 })];

  it("방문자는 Game[]만 받고(관리 메타 없음) 숨김 목록을 요청하지 않는다", async () => {
    m.listGames.mockResolvedValue([records[0]]);
    const res = await handleListGames(req("GET", "/api/games"), makeDeps());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await json(res)).toEqual({ games: [game("a")] });
    expect(m.listGames).toHaveBeenCalledWith(DB, { includeHidden: false });
  });

  it.each<SessionState>([{ kind: "anonymous" }, { kind: "expired" }, { kind: "user" }])(
    "$kind 세션은 방문자와 같다(401을 내지 않고 includeHidden=1도 무시)",
    async (state) => {
      session(state);
      m.listGames.mockResolvedValue([records[0]]);
      const res = await handleListGames(req("GET", "/api/games?includeHidden=1"), makeDeps());
      expect(res.status).toBe(200);
      expect(await json(res)).toEqual({ games: [game("a")] });
      expect(m.listGames).toHaveBeenCalledWith(DB, { includeHidden: false });
    },
  );

  it("관리자는 GameRecord[]를 받는다(숨김 제외)", async () => {
    asAdmin();
    m.listGames.mockResolvedValue([records[0]]);
    const res = await handleListGames(req("GET", "/api/games"), makeDeps());
    expect(await json(res)).toEqual({ games: [records[0]] });
    expect(m.listGames).toHaveBeenCalledWith(DB, { includeHidden: false });
  });

  it("관리자 + includeHidden=1 일 때만 숨김을 포함한다", async () => {
    asAdmin();
    m.listGames.mockResolvedValue(records);
    const res = await handleListGames(req("GET", "/api/games?includeHidden=1"), makeDeps());
    expect(await json(res)).toEqual({ games: records });
    expect(m.listGames).toHaveBeenCalledWith(DB, { includeHidden: true });
  });

  it("includeHidden=true 같은 값은 1이 아니므로 숨김을 넣지 않는다", async () => {
    asAdmin();
    m.listGames.mockResolvedValue([]);
    await handleListGames(req("GET", "/api/games?includeHidden=true"), makeDeps());
    expect(m.listGames).toHaveBeenCalledWith(DB, { includeHidden: false });
  });

  it("쿠키·현재 시각·허용 목록으로 세션을 확인하고 same-origin 검사는 하지 않는다", async () => {
    m.listGames.mockResolvedValue([]);
    await handleListGames(req("GET", "/api/games", { headers: { cookie: "session_id=zzz" } }), makeDeps());
    expect(m.parseAdminIds).toHaveBeenCalledWith(SECRET_ID);
    expect(m.getSessionActor).toHaveBeenCalledWith(DB, "session_id=zzz", NOW, ADMIN_IDS);
    expect(m.checkSameOrigin).not.toHaveBeenCalled();
  });

  it("쿠키가 없으면 null을 넘긴다", async () => {
    m.listGames.mockResolvedValue([]);
    await handleListGames(new Request(`${ORIGIN}/api/games`), makeDeps());
    expect(m.getSessionActor).toHaveBeenCalledWith(DB, null, NOW, ADMIN_IDS);
  });

  it("예상 못 한 예외는 500 unavailable, 로그에는 이름만 남는다", async () => {
    m.listGames.mockRejectedValue(new TypeError(`D1 broke for ${SECRET_ID}`));
    const deps = makeDeps();
    const res = await handleListGames(req("GET", "/api/games"), deps);
    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: { code: "unavailable", message: "잠시 후 다시 시도해 주세요." } });
    expect(text).not.toContain(SECRET_ID);
    expect(deps.log).toHaveBeenCalledTimes(1);
    expect(deps.log).toHaveBeenCalledWith("games-api unavailable TypeError");
  });

  it("log가 없어도 500을 안전하게 돌려준다", async () => {
    m.listGames.mockRejectedValue("boom");
    const res = await handleListGames(req("GET", "/api/games"), makeDeps({ log: undefined }));
    expect(res.status).toBe(500);
  });

  it("Error가 아닌 값은 이름을 unknown으로 로그한다", async () => {
    m.listGames.mockRejectedValue({ name: SECRET_ID });
    const deps = makeDeps();
    await handleListGames(req("GET", "/api/games"), deps);
    expect(deps.log).toHaveBeenCalledWith("games-api unavailable unknown");
  });
});

describe("loadGamesPageData", () => {
  it("관리자: 숨김 포함 레코드와 별칭만 돌려준다", async () => {
    asAdmin();
    const all = [record("a"), record("b", { hidden: true })];
    m.listGames.mockResolvedValue(all);
    const data = await loadGamesPageData(makeDeps(), "session_id=abc");
    expect(data).toEqual({ ok: true, admin: { name: "관리자" }, games: all });
    expect(m.listGames).toHaveBeenCalledWith(DB, { includeHidden: true });
    expect(m.getSessionActor).toHaveBeenCalledWith(DB, "session_id=abc", NOW, ADMIN_IDS);
    expect(JSON.stringify(data)).not.toContain(SECRET_ID);
  });

  it.each<SessionState>([{ kind: "anonymous" }, { kind: "expired" }, { kind: "user" }])(
    "$kind: 방문자용 Game[] (숨김 제외, 관리 메타 없음)",
    async (state) => {
      session(state);
      m.listGames.mockResolvedValue([record("a")]);
      const data = await loadGamesPageData(makeDeps(), null);
      expect(data).toEqual({ ok: true, admin: null, games: [game("a")] });
      expect(m.listGames).toHaveBeenCalledWith(DB, { includeHidden: false });
    },
  );

  it("세션 조회가 던지면 { ok: false }이고 이름만 로그한다", async () => {
    m.getSessionActor.mockRejectedValue(new RangeError(`no DB ${SECRET_ID}`));
    const deps = makeDeps();
    expect(await loadGamesPageData(deps, null)).toEqual({ ok: false });
    expect(deps.log).toHaveBeenCalledWith("games-api unavailable RangeError");
  });

  it("목록 조회가 던져도 { ok: false }, log 없이도 안전하다", async () => {
    m.listGames.mockRejectedValue(new Error("x"));
    expect(await loadGamesPageData(makeDeps({ log: undefined }), null)).toEqual({ ok: false });
  });
});

// ---------------------------------------------------------------------------------------------
const VALID_INPUT = { name: "새 게임", firstPlayed: "2026-10-01", status: "clear", vods: [] };

interface WriteCase {
  label: string;
  call: (r: Request, deps: ApiDeps) => Promise<Response>;
  request: (extra?: { raw?: BodyInit; headers?: Record<string, string> }) => Request;
  repo: ReturnType<typeof vi.fn>;
  okStatus: number;
}

const WRITE_CASES: WriteCase[] = [
  {
    label: "POST /api/games",
    call: (r, d) => handleCreateGame(r, d),
    request: (e = {}) => req("POST", "/api/games", { body: e.raw === undefined ? { input: VALID_INPUT } : undefined, ...e }),
    repo: m.createGame,
    okStatus: 201,
  },
  {
    label: "PATCH /api/games/[id]",
    call: (r, d) => handleUpdateGame(r, d, "elden-ring"),
    request: (e = {}) =>
      req("PATCH", "/api/games/elden-ring", { body: e.raw === undefined ? { expectedVersion: 2, patch: { name: "x" } } : undefined, ...e }),
    repo: m.updateGame,
    okStatus: 200,
  },
  {
    label: "POST /api/games/[id]/hidden",
    call: (r, d) => handleSetHidden(r, d, "elden-ring"),
    request: (e = {}) =>
      req("POST", "/api/games/elden-ring/hidden", { body: e.raw === undefined ? { hidden: true } : undefined, ...e }),
    repo: m.setHidden,
    okStatus: 200,
  },
];

describe.each(WRITE_CASES)("쓰기 공통 게이트: $label", (c) => {
  beforeEach(() => {
    asAdmin();
  });

  it("다른 출처면 403 cross_origin, 세션도 보지 않는다", async () => {
    m.checkSameOrigin.mockReturnValue(false);
    const res = await c.call(c.request(), makeDeps());
    expect(res.status).toBe(403);
    expect((await json(res)).error.code).toBe("cross_origin");
    expect(m.getSessionActor).not.toHaveBeenCalled();
    expect(c.repo).not.toHaveBeenCalled();
  });

  it("쿠키 없음 → 401 login_required", async () => {
    session({ kind: "anonymous" });
    const res = await c.call(c.request(), makeDeps());
    expect(res.status).toBe(401);
    expect((await json(res)).error.code).toBe("login_required");
    expect(c.repo).not.toHaveBeenCalled();
  });

  it("세션 만료 → 401 session_expired + 안내 문구", async () => {
    session({ kind: "expired" });
    const res = await c.call(c.request(), makeDeps());
    expect(res.status).toBe(401);
    expect(await json(res)).toEqual({ error: { code: "session_expired", message: "로그인이 만료됐어요. 다시 로그인해 주세요." } });
    expect(c.repo).not.toHaveBeenCalled();
  });

  it("관리자가 아니면 403 forbidden", async () => {
    session({ kind: "user" });
    const res = await c.call(c.request(), makeDeps());
    expect(res.status).toBe(403);
    expect((await json(res)).error.code).toBe("forbidden");
    expect(c.repo).not.toHaveBeenCalled();
  });

  it("Content-Length가 64KB를 넘으면 413", async () => {
    const res = await c.call(c.request({ headers: { "content-length": String(BODY_MAX_BYTES + 1) }, raw: "{}" }), makeDeps());
    expect(res.status).toBe(413);
    expect((await json(res)).error.code).toBe("payload_too_large");
    expect(c.repo).not.toHaveBeenCalled();
  });

  it("실제 본문이 64KB를 넘으면 413(바이트 기준: 한글 3바이트)", async () => {
    const raw = JSON.stringify({ pad: "가".repeat(Math.ceil(BODY_MAX_BYTES / 3) + 1) });
    expect(raw.length).toBeLessThan(BODY_MAX_BYTES);
    const res = await c.call(c.request({ raw }), makeDeps());
    expect(res.status).toBe(413);
  });

  it("정확히 64KB인 본문은 크기 검사를 통과한다(그 뒤 모양 검사에서 400)", async () => {
    const head = '{"pad":"';
    const raw = head + "a".repeat(BODY_MAX_BYTES - head.length - 2) + '"}';
    expect(new TextEncoder().encode(raw).length).toBe(BODY_MAX_BYTES);
    const res = await c.call(c.request({ raw }), makeDeps());
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("bad_request");
  });

  it("64KB + 1바이트 본문은 Content-Length가 없어도 413", async () => {
    const head = '{"pad":"';
    const raw = new TextEncoder().encode(head + "a".repeat(BODY_MAX_BYTES - head.length - 1) + '"}');
    expect(raw.byteLength).toBe(BODY_MAX_BYTES + 1);
    const r = c.request({ raw });
    expect(r.headers.get("content-length")).toBeNull();
    const res = await c.call(r, makeDeps());
    expect(res.status).toBe(413);
    expect(c.repo).not.toHaveBeenCalled();
  });

  it("길이를 알리지 않는 스트림 본문은 64KB를 넘는 순간 읽기를 멈추고 413", async () => {
    let pulled = 0;
    const chunk = new Uint8Array(16 * 1024).fill(0x61);
    const stream = new ReadableStream<Uint8Array>({
      pull(ctrl) {
        pulled += 1;
        if (pulled > 1000) ctrl.close(); // 끝까지 읽는 구현이면 16MB를 다 받는다
        else ctrl.enqueue(chunk);
      },
    });
    const base = c.request({ raw: "{}" });
    const r = new Request(base.url, { method: base.method, headers: base.headers, body: stream, duplex: "half" } as RequestInit);
    const res = await c.call(r, makeDeps());
    expect(res.status).toBe(413);
    expect(pulled).toBeLessThan(10);
    expect(c.repo).not.toHaveBeenCalled();
  });

  it("본문이 아예 없으면(body null) 400 bad_json", async () => {
    const base = c.request({ raw: "{}" });
    const r = new Request(base.url, { method: base.method, headers: base.headers });
    expect(r.body).toBeNull();
    const res = await c.call(r, makeDeps());
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("bad_json");
  });

  it("문자열 안의 잘못된 UTF-8 바이트도 대체 문자로 넘기지 않고 400 bad_json", async () => {
    const enc = new TextEncoder();
    const res = await c.call(c.request({ raw: new Uint8Array([...enc.encode('{"a":"'), 0xff, 0xfe, ...enc.encode('"}')]) }), makeDeps());
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("bad_json");
  });

  it("Content-Length가 숫자가 아니면 무시하고 실제 본문으로 판단한다", async () => {
    const res = await c.call(c.request({ headers: { "content-length": "abc" }, raw: "not json" }), makeDeps());
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("bad_json");
  });

  it.each([
    ["깨진 JSON", "{"],
    ["빈 본문", ""],
  ])("%s → 400 bad_json", async (_l, raw) => {
    const res = await c.call(c.request({ raw }), makeDeps());
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("bad_json");
    expect(c.repo).not.toHaveBeenCalled();
  });

  it("UTF-8이 아닌 본문 → 400 bad_json", async () => {
    const res = await c.call(c.request({ raw: new Uint8Array([0x7b, 0xff, 0x7d]) }), makeDeps());
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("bad_json");
  });

  it.each([
    ["JSON null", "null"],
    ["JSON 배열", "[]"],
    ["빈 객체", "{}"],
    ["모르는 최상위 키", JSON.stringify({ input: VALID_INPUT, expectedVersion: 1, patch: {}, hidden: true, extra: 1 })],
  ])("모양이 틀리면(%s) 400 bad_request", async (_l, raw) => {
    const res = await c.call(c.request({ raw }), makeDeps());
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("bad_request");
    expect(c.repo).not.toHaveBeenCalled();
  });

  it("예상 못 한 예외는 500, 로그에 ID가 없다", async () => {
    c.repo.mockRejectedValue(new Error(`row ${SECRET_ID}`));
    const deps = makeDeps();
    const res = await c.call(c.request(), deps);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain(SECRET_ID);
    expect(deps.log).toHaveBeenCalledWith("games-api unavailable Error");
  });

  it("repo가 not_found면 404", async () => {
    c.repo.mockResolvedValue({ ok: false, reason: "not_found" } satisfies WriteResult);
    const res = await c.call(c.request(), makeDeps());
    expect(res.status).toBe(404);
    expect((await json(res)).error.code).toBe("not_found");
  });

  it("repo가 invalid면 422 + issues(경로 접두 없음)", async () => {
    const issues: ValidationIssue[] = [{ path: "vods[0].url", message: "x" }];
    c.repo.mockResolvedValue({ ok: false, reason: "invalid", issues } satisfies WriteResult);
    const res = await c.call(c.request(), makeDeps());
    expect(res.status).toBe(422);
    const body = await json(res);
    expect(body.error.code).toBe("invalid");
    expect(typeof body.error.message).toBe("string");
    expect(body.issues).toEqual(issues);
  });

  it("repo가 conflict면 409 + conflictMessage + latest", async () => {
    const latest = record("elden-ring", { version: 5, updatedByName: "야시로" });
    c.repo.mockResolvedValue({ ok: false, reason: "conflict", latest } satisfies WriteResult);
    const res = await c.call(c.request(), makeDeps());
    expect(res.status).toBe(409);
    expect(await json(res)).toEqual({ error: { code: "conflict", message: "충돌:야시로" }, latest });
    expect(m.conflictMessage).toHaveBeenCalledWith(latest);
  });

  it.each([true, false])("성공(changed=%s)이면 상태 코드와 { game, changed }, no-store", async (changed) => {
    const g = record("elden-ring", { version: 3 });
    c.repo.mockResolvedValue({ ok: true, game: g, changed } satisfies WriteResult);
    const res = await c.call(c.request(), makeDeps());
    expect(res.status).toBe(c.okStatus);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await json(res)).toEqual({ game: g, changed });
  });

  it("repo에 넘기는 문맥에 별칭·시각·uuid가 들어간다(응답에는 채널 ID 없음)", async () => {
    c.repo.mockResolvedValue({ ok: true, game: record("elden-ring"), changed: true } satisfies WriteResult);
    const deps = makeDeps();
    const res = await c.call(c.request(), deps);
    expect(await res.text()).not.toContain(SECRET_ID);
    const ctx = c.repo.mock.calls[0].at(-1);
    expect(ctx.actor).toEqual(ACTOR);
    expect(ctx.now).toBe(NOW);
    expect(ctx.uuid()).toBe("u1");
  });
});

describe("handleCreateGame", () => {
  it("파싱한 입력을 repo.createGame에 넘기고 201", async () => {
    asAdmin();
    m.createGame.mockResolvedValue({ ok: true, game: record("new-game"), changed: true } satisfies WriteResult);
    const res = await handleCreateGame(req("POST", "/api/games", { body: { input: VALID_INPUT } }), makeDeps());
    expect(res.status).toBe(201);
    expect(m.createGame).toHaveBeenCalledWith(DB, VALID_INPUT, expect.objectContaining({ actor: ACTOR, now: NOW }));
    expect(m.checkSameOrigin).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["input 없음", {}],
    ["input 모양 틀림", { input: { name: 1 } }],
    ["input에 id", { input: { ...VALID_INPUT, id: "x" } }],
  ])("%s → 400 bad_request", async (_l, body) => {
    asAdmin();
    const res = await handleCreateGame(req("POST", "/api/games", { body }), makeDeps());
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("bad_request");
  });
});

describe("handleUpdateGame", () => {
  const body = (extra: object = {}) => ({ expectedVersion: 2, patch: { name: "바뀐 이름" }, ...extra });

  beforeEach(() => {
    asAdmin();
  });

  it("id·patch·expectedVersion을 repo.updateGame에 넘긴다", async () => {
    m.updateGame.mockResolvedValue({ ok: true, game: record("elden-ring"), changed: true } satisfies WriteResult);
    const res = await handleUpdateGame(req("PATCH", "/api/games/elden-ring", { body: body() }), makeDeps(), "elden-ring");
    expect(res.status).toBe(200);
    expect(m.updateGame).toHaveBeenCalledWith(DB, "elden-ring", { name: "바뀐 이름" }, 2, expect.objectContaining({ now: NOW }));
  });

  it("빈 patch도 repo로 간다", async () => {
    m.updateGame.mockResolvedValue({ ok: true, game: record("a"), changed: false } satisfies WriteResult);
    const res = await handleUpdateGame(req("PATCH", "/api/games/a", { body: body({ patch: {} }) }), makeDeps(), "a");
    expect(res.status).toBe(200);
    expect(m.updateGame).toHaveBeenCalledWith(DB, "a", {}, 2, expect.anything());
  });

  it.each([
    ["expectedVersion 없음", { patch: {} }],
    ["expectedVersion 0", { expectedVersion: 0, patch: {} }],
    ["expectedVersion 음수", { expectedVersion: -1, patch: {} }],
    ["expectedVersion 소수", { expectedVersion: 1.5, patch: {} }],
    ["expectedVersion 문자열", { expectedVersion: "1", patch: {} }],
    ["expectedVersion 안전 정수 밖", { expectedVersion: 2 ** 53, patch: {} }],
    ["patch 없음", { expectedVersion: 1 }],
    ["patch 모양 틀림", { expectedVersion: 1, patch: { id: "x" } }],
    ["patch가 배열", { expectedVersion: 1, patch: [] }],
  ])("%s → 400 bad_request", async (_l, b) => {
    const res = await handleUpdateGame(req("PATCH", "/api/games/a", { body: b }), makeDeps(), "a");
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("bad_request");
    expect(m.updateGame).not.toHaveBeenCalled();
  });

  it.each([
    ["퍼센트 인코딩이 깨진 id", "%E0"],
    ["대문자", "Elden"],
    ["공백", "a b"],
    ["빈 문자열", ""],
    ["슬래시", "a/b"],
    ["선행 하이픈", "-a"],
    ["연속 하이픈", "a--b"],
  ])("%s → 404 not_found (repo 호출 없음)", async (_l, id) => {
    const res = await handleUpdateGame(req("PATCH", "/api/games/x", { body: body() }), makeDeps(), id);
    expect(res.status).toBe(404);
    expect((await json(res)).error.code).toBe("not_found");
    expect(m.updateGame).not.toHaveBeenCalled();
  });

  it("퍼센트 인코딩된 한글 id는 디코드해서 쓴다", async () => {
    m.updateGame.mockResolvedValue({ ok: true, game: record("엘든-링"), changed: true } satisfies WriteResult);
    await handleUpdateGame(req("PATCH", "/api/games/x", { body: body() }), makeDeps(), encodeURIComponent("엘든-링"));
    expect(m.updateGame.mock.calls[0][1]).toBe("엘든-링");
  });

  it("예약어(categories) id도 형식은 통과하고 repo가 없다고 답하면 404", async () => {
    m.updateGame.mockResolvedValue({ ok: false, reason: "not_found" } satisfies WriteResult);
    const res = await handleUpdateGame(req("PATCH", "/api/games/categories", { body: body() }), makeDeps(), "categories");
    expect(res.status).toBe(404);
  });
});

describe("handleSetHidden", () => {
  beforeEach(() => {
    asAdmin();
  });

  it.each([true, false])("hidden=%s 를 repo.setHidden에 넘긴다", async (hidden) => {
    m.setHidden.mockResolvedValue({ ok: true, game: record("a", { hidden }), changed: true } satisfies WriteResult);
    const res = await handleSetHidden(req("POST", "/api/games/a/hidden", { body: { hidden } }), makeDeps(), "a");
    expect(res.status).toBe(200);
    expect(m.setHidden).toHaveBeenCalledWith(DB, "a", hidden, expect.objectContaining({ actor: ACTOR }));
  });

  it.each([
    ["hidden 문자열", { hidden: "true" }],
    ["hidden 숫자", { hidden: 1 }],
    ["hidden null", { hidden: null }],
    ["hidden 없음", {}],
    ["키 초과", { hidden: true, x: 1 }],
  ])("%s → 400 bad_request", async (_l, b) => {
    const res = await handleSetHidden(req("POST", "/api/games/a/hidden", { body: b }), makeDeps(), "a");
    expect(res.status).toBe(400);
    expect(m.setHidden).not.toHaveBeenCalled();
  });

  it("깨진 id → 404", async () => {
    const res = await handleSetHidden(req("POST", "/api/games/x/hidden", { body: { hidden: true } }), makeDeps(), "%E0");
    expect(res.status).toBe(404);
    expect(m.setHidden).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------------------------
interface ReadCase {
  label: string;
  call: (r: Request, deps: ApiDeps) => Promise<Response>;
  request: () => Request;
}

const READ_CASES: ReadCase[] = [
  { label: "GET changes", call: (r, d) => handleListChanges(r, d, "a"), request: () => req("GET", "/api/games/a/changes") },
  { label: "GET categories", call: (r, d) => handleSearchCategories(r, d), request: () => req("GET", "/api/games/categories?q=elden") },
  {
    label: "GET youtube",
    call: (r, d) => handleYoutubeMeta(r, d),
    request: () => req("GET", `/api/games/youtube?url=${encodeURIComponent("https://youtu.be/aaaaaaaaaaa")}`),
  },
];

describe.each(READ_CASES)("관리자 읽기 게이트: $label", (c) => {
  it("쿠키 없음 → 401 login_required", async () => {
    session({ kind: "anonymous" });
    const res = await c.call(c.request(), makeDeps());
    expect(res.status).toBe(401);
    expect((await json(res)).error.code).toBe("login_required");
  });

  it("세션 만료 → 401 session_expired", async () => {
    session({ kind: "expired" });
    const res = await c.call(c.request(), makeDeps());
    expect(res.status).toBe(401);
    expect((await json(res)).error.code).toBe("session_expired");
  });

  it("관리자가 아니면 403 forbidden", async () => {
    session({ kind: "user" });
    const res = await c.call(c.request(), makeDeps());
    expect(res.status).toBe(403);
    expect((await json(res)).error.code).toBe("forbidden");
  });

  it("same-origin 검사는 하지 않는다(GET)", async () => {
    session({ kind: "user" });
    await c.call(c.request(), makeDeps());
    expect(m.checkSameOrigin).not.toHaveBeenCalled();
  });

  it("거절된 요청은 외부·저장소를 건드리지 않는다", async () => {
    session({ kind: "anonymous" });
    await c.call(c.request(), makeDeps());
    expect(m.getGame).not.toHaveBeenCalled();
    expect(m.listChanges).not.toHaveBeenCalled();
    expect(m.searchCategories).not.toHaveBeenCalled();
    expect(m.fetchYoutubeMeta).not.toHaveBeenCalled();
  });
});

describe("handleListChanges", () => {
  const list = { changes: [{ id: "c1", action: "update", summary: "정복 여부 모름 → 정복", actorName: "관리자", createdAt: NOW }], total: 1 };

  beforeEach(() => {
    asAdmin();
  });

  it("limit 없이 부르면 repo 기본값을 쓰도록 undefined를 넘긴다", async () => {
    m.getGame.mockResolvedValue(record("a", { hidden: true }));
    m.listChanges.mockResolvedValue(list);
    const res = await handleListChanges(req("GET", "/api/games/a/changes"), makeDeps(), "a");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await json(res)).toEqual(list);
    expect(m.getGame).toHaveBeenCalledWith(DB, "a", { includeHidden: true });
    expect(m.listChanges).toHaveBeenCalledWith(DB, "a", undefined);
  });

  it.each([
    ["1", 1],
    ["50", 50],
    ["20", 20],
  ])("limit=%s 는 정수 %i 로 넘긴다", async (raw, n) => {
    m.getGame.mockResolvedValue(record("a"));
    m.listChanges.mockResolvedValue(list);
    await handleListChanges(req("GET", `/api/games/a/changes?limit=${raw}`), makeDeps(), "a");
    expect(m.listChanges).toHaveBeenCalledWith(DB, "a", n);
  });

  it.each(["abc", "0", "51", "1.5", "-1", "", " 5", "5x", "1e1"])("limit=%j → 400 bad_request", async (raw) => {
    const res = await handleListChanges(req("GET", `/api/games/a/changes?limit=${encodeURIComponent(raw)}`), makeDeps(), "a");
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("bad_request");
    expect(m.listChanges).not.toHaveBeenCalled();
  });

  it("게임이 없으면 404", async () => {
    m.getGame.mockResolvedValue(null);
    const res = await handleListChanges(req("GET", "/api/games/zzz/changes"), makeDeps(), "zzz");
    expect(res.status).toBe(404);
    expect((await json(res)).error.code).toBe("not_found");
    expect(m.listChanges).not.toHaveBeenCalled();
  });

  it("깨진 id → 404 (저장소 조회 없음)", async () => {
    const res = await handleListChanges(req("GET", "/api/games/x/changes"), makeDeps(), "%E0");
    expect(res.status).toBe(404);
    expect(m.getGame).not.toHaveBeenCalled();
  });

  it("예상 못 한 예외 → 500", async () => {
    m.getGame.mockRejectedValue(new Error("x"));
    const deps = makeDeps();
    const res = await handleListChanges(req("GET", "/api/games/a/changes"), deps, "a");
    expect(res.status).toBe(500);
    expect(deps.log).toHaveBeenCalledWith("games-api unavailable Error");
  });
});

describe("handleSearchCategories", () => {
  beforeEach(() => {
    asAdmin();
  });

  const found = [
    { categoryType: "GAME", categoryId: "ELDEN_RING", categoryValue: "엘든 링", posterImageUrl: "https://a.pstatic.net/p.png" },
    { categoryType: "GAME", categoryId: "NEW_ONE", categoryValue: "새 게임", posterImageUrl: null },
    { categoryType: "GAME", categoryId: "HIDDEN_ONE", categoryValue: "숨긴 게임", posterImageUrl: null },
  ];

  it("검색 결과에 목록 상태(taken, 숨긴 게임 포함)를 붙인다", async () => {
    m.searchCategories.mockResolvedValue(found);
    m.listGames.mockResolvedValue([
      record("elden-ring", { categoryId: "ELDEN_RING", name: "엘든 링" }),
      record("hid", { categoryId: "HIDDEN_ONE", name: "숨긴 게임", hidden: true }),
      record("none"),
    ]);
    const deps = makeDeps();
    const res = await handleSearchCategories(req("GET", `/api/games/categories?q=${encodeURIComponent("  엘든 ")}`), deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await json(res)).toEqual({
      results: [
        { categoryId: "ELDEN_RING", name: "엘든 링", posterUrl: "https://a.pstatic.net/p.png", taken: { id: "elden-ring", name: "엘든 링", hidden: false } },
        { categoryId: "NEW_ONE", name: "새 게임", posterUrl: null, taken: null },
        { categoryId: "HIDDEN_ONE", name: "숨긴 게임", posterUrl: null, taken: { id: "hid", name: "숨긴 게임", hidden: true } },
      ],
    });
    expect(m.searchCategories).toHaveBeenCalledWith(deps.fetch, { clientId: "cid", clientSecret: "csec" }, "엘든");
    expect(m.listGames).toHaveBeenCalledWith(DB, { includeHidden: true });
  });

  it("결과가 없으면 빈 목록", async () => {
    m.searchCategories.mockResolvedValue([]);
    m.listGames.mockResolvedValue([record("a")]);
    const res = await handleSearchCategories(req("GET", "/api/games/categories?q=x"), makeDeps());
    expect(await json(res)).toEqual({ results: [] });
  });

  it("q가 정확히 50자면 허용", async () => {
    m.searchCategories.mockResolvedValue([]);
    m.listGames.mockResolvedValue([]);
    const res = await handleSearchCategories(req("GET", `/api/games/categories?q=${"가".repeat(50)}`), makeDeps());
    expect(res.status).toBe(200);
  });

  it.each([
    ["q 없음", ""],
    ["빈 q", "?q="],
    ["공백만", "?q=%20%20"],
    ["51자", `?q=${"a".repeat(51)}`],
  ])("%s → 400 bad_request", async (_l, query) => {
    const res = await handleSearchCategories(req("GET", `/api/games/categories${query}`), makeDeps());
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("bad_request");
    expect(m.searchCategories).not.toHaveBeenCalled();
  });

  it("치지직 자격 증명이 없으면 빈 문자열을 넘기고, 라이브러리 오류는 502 upstream", async () => {
    m.searchCategories.mockRejectedValue(new m.ChzzkCategoryError("치지직 Client-Id/Client-Secret이 없습니다"));
    const deps = makeDeps({ env: {} });
    const res = await handleSearchCategories(req("GET", "/api/games/categories?q=a"), deps);
    expect(res.status).toBe(502);
    expect(await json(res)).toEqual({ error: { code: "upstream", message: "치지직 검색이 잠시 안 돼요." } });
    expect(m.searchCategories).toHaveBeenCalledWith(deps.fetch, { clientId: "", clientSecret: "" }, "a");
    expect(deps.log).toHaveBeenCalledWith("games-api upstream ChzzkCategoryError");
  });

  it("log가 없어도 502", async () => {
    m.searchCategories.mockRejectedValue(new m.ChzzkCategoryError("x"));
    const res = await handleSearchCategories(req("GET", "/api/games/categories?q=a"), makeDeps({ log: undefined }));
    expect(res.status).toBe(502);
  });

  it("그 밖의 예외는 500", async () => {
    m.searchCategories.mockRejectedValue(new RangeError("size"));
    const res = await handleSearchCategories(req("GET", "/api/games/categories?q=a"), makeDeps());
    expect(res.status).toBe(500);
  });

  it("목록 조회 실패도 500", async () => {
    m.searchCategories.mockResolvedValue(found);
    m.listGames.mockRejectedValue(new Error("d1"));
    const res = await handleSearchCategories(req("GET", "/api/games/categories?q=a"), makeDeps());
    expect(res.status).toBe(500);
  });
});

describe("handleYoutubeMeta", () => {
  const URL_OK = "https://youtu.be/aaaaaaaaaaa";
  const call = (url: string | null, deps = makeDeps()) =>
    handleYoutubeMeta(req("GET", `/api/games/youtube${url === null ? "" : `?url=${encodeURIComponent(url)}`}`), deps);

  beforeEach(() => {
    asAdmin();
  });

  it("성공하면 메타를 그대로 돌려준다", async () => {
    const meta = { videoId: "aaaaaaaaaaa", url: "https://www.youtube.com/watch?v=aaaaaaaaaaa", title: "[ 2026. 10. 23 ] 1화", date: "2026-10-23" };
    m.fetchYoutubeMeta.mockResolvedValue(meta);
    const deps = makeDeps();
    const res = await call(URL_OK, deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await json(res)).toEqual(meta);
    expect(m.fetchYoutubeMeta).toHaveBeenCalledWith(deps.fetch, URL_OK);
  });

  it("url이 정확히 500자면 허용", async () => {
    m.fetchYoutubeMeta.mockResolvedValue({ videoId: "a", url: "u", title: "t", date: null });
    expect((await call("https://youtu.be/" + "a".repeat(500 - 17))).status).toBe(200);
  });

  it.each([
    ["url 없음", null],
    ["빈 url", ""],
    ["501자", "a".repeat(501)],
  ])("%s → 400 bad_request", async (_l, url) => {
    const res = await call(url);
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("bad_request");
    expect(m.fetchYoutubeMeta).not.toHaveBeenCalled();
  });

  it("치지직 링크 → 422 chzzk_vod + 안내 문구", async () => {
    m.fetchYoutubeMeta.mockRejectedValue(new m.YoutubeMetaError("chzzk_vod"));
    const res = await call("https://chzzk.naver.com/video/1");
    expect(res.status).toBe(422);
    expect(await json(res)).toEqual({
      error: { code: "chzzk_vod", message: "치지직 다시보기는 한 달 뒤 사라져요. 유튜브 링크만 넣을 수 있어요." },
    });
  });

  it("유튜브 링크가 아니면 → 422 invalid, issues []", async () => {
    m.fetchYoutubeMeta.mockRejectedValue(new m.YoutubeMetaError("invalid_url"));
    const res = await call("https://example.com");
    expect(res.status).toBe(422);
    expect(await json(res)).toEqual({ error: { code: "invalid", message: "유튜브 영상 링크를 넣어 주세요." }, issues: [] });
  });

  it("비공개·삭제 영상 → 404 not_found", async () => {
    m.fetchYoutubeMeta.mockRejectedValue(new m.YoutubeMetaError("not_found"));
    const res = await call(URL_OK);
    expect(res.status).toBe(404);
    expect(await json(res)).toEqual({ error: { code: "not_found", message: "비공개이거나 삭제된 영상이에요." } });
  });

  it("유튜브 쪽 장애 → 502 upstream, 이름만 로그", async () => {
    m.fetchYoutubeMeta.mockRejectedValue(new m.YoutubeMetaError("upstream"));
    const deps = makeDeps();
    const res = await call(URL_OK, deps);
    expect(res.status).toBe(502);
    expect((await json(res)).error.code).toBe("upstream");
    expect(deps.log).toHaveBeenCalledWith("games-api upstream YoutubeMetaError");
  });

  it("log가 없어도 502", async () => {
    m.fetchYoutubeMeta.mockRejectedValue(new m.YoutubeMetaError("upstream"));
    expect((await call(URL_OK, makeDeps({ log: undefined }))).status).toBe(502);
  });

  it("그 밖의 예외 → 500", async () => {
    m.fetchYoutubeMeta.mockRejectedValue(new TypeError("x"));
    expect((await call(URL_OK)).status).toBe(500);
  });
});
