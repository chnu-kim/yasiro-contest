// 실제 admin/repo/diff/youtube-meta + 테스트 D1로 API 전 과정을 돌린다.
// 핵심 확인: 관리자 세션의 channel_name이 실명이어도 DB·응답·로그 어디에도 남지 않고, 표시 이름은 별칭으로 고정된다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleCreateGame,
  handleListChanges,
  handleListGames,
  handleSetHidden,
  handleUpdateGame,
  handleYoutubeMeta,
  loadGamesPageData,
  type ApiDeps,
} from "./api.ts";
import { YASIRO_CHANNEL_ID } from "./admin.ts";
import { CHZZK_VOD_MESSAGE } from "./schema.ts";
import { createGamesTestDb, findStringAnywhere, FAKE_ADMIN_ID, FAKE_USER_ID, insertSession, type TestD1 } from "./test-d1.ts";

const NOW = 1_792_900_000;
const ORIGIN = "https://yasiro.stream";
const REAL_NAME = "실명채널";
const VIDEO = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

let d1: TestD1;
let logs: string[];
let texts: string[];
let counter: number;

function deps(extra: Partial<ApiDeps> = {}): ApiDeps {
  return {
    db: d1.db,
    env: { ADMIN_CHANNEL_IDS: FAKE_ADMIN_ID },
    now: () => NOW,
    fetch: async (url) =>
      url.startsWith("https://www.youtube.com/oembed")
        ? Response.json({ title: "[ 2026. 10. 23 ] 엘든 링 1화" })
        : new Response("no", { status: 404 }),
    uuid: () => `u${++counter}`,
    log: (m) => logs.push(m),
    ...extra,
  };
}

function req(method: string, path: string, session: string | null, body?: unknown, headers: Record<string, string> = {}): Request {
  const h: Record<string, string> = { origin: ORIGIN, ...headers };
  if (session !== null) h.cookie = `session_id=${session}`;
  if (body !== undefined) h["content-type"] = "application/json";
  return new Request(`${ORIGIN}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
}

/** 응답 본문을 한 번 읽어 익명 검사용으로 모아 둔다 */
async function read(res: Response): Promise<{ status: number; body: any }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const text = await res.text();
  texts.push(text);
  return { status: res.status, body: JSON.parse(text) };
}

const INPUT = {
  name: "엘든 링",
  originalTitle: "ELDEN RING",
  firstPlayed: "2026-10-01",
  status: "unknown",
  vods: [{ title: "[ 2026. 10. 23 ] 엘든 링 1화", url: VIDEO, date: "2026-10-23" }],
};

beforeEach(() => {
  d1 = createGamesTestDb();
  logs = [];
  texts = [];
  counter = 0;
  insertSession(d1, { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", channelId: FAKE_ADMIN_ID, channelName: REAL_NAME, expiresAt: NOW + 1000 });
  insertSession(d1, { id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", channelId: YASIRO_CHANNEL_ID, channelName: "야시로 본채널", expiresAt: NOW + 1000 });
  insertSession(d1, { id: "cccccccccccccccccccccccccccccccc", channelId: FAKE_USER_ID, channelName: "일반시청자", expiresAt: NOW + 1000 });
  insertSession(d1, { id: "dddddddddddddddddddddddddddddddd", channelId: FAKE_ADMIN_ID, channelName: REAL_NAME, expiresAt: NOW });
});

afterEach(() => d1.close());

describe("API 전 과정과 익명 규칙", () => {
  it("관리자(실명 채널) 세션으로 추가 → 수정 → 충돌 → 숨김 → 기록 → 목록, 실명·ID가 어디에도 없다", async () => {
    const created = await read(await handleCreateGame(req("POST", "/api/games", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", { input: INPUT }), deps()));
    expect(created.status).toBe(201);
    expect(created.body.changed).toBe(true);
    expect(created.body.game).toMatchObject({ name: "엘든 링", version: 1, hidden: false, updatedByName: "관리자" });
    const id: string = created.body.game.id;

    const updated = await read(
      await handleUpdateGame(req("PATCH", `/api/games/${id}`, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", { expectedVersion: 1, patch: { status: "clear" } }), deps(), id),
    );
    expect(updated.status).toBe(200);
    expect(updated.body.game).toMatchObject({ version: 2, status: "clear", updatedByName: "관리자" });

    const stale = await read(
      await handleUpdateGame(req("PATCH", `/api/games/${id}`, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", { expectedVersion: 1, patch: { status: "fail" } }), deps(), id),
    );
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("conflict");
    expect(stale.body.error.message.startsWith("관리자가 방금(")).toBe(true);
    expect(stale.body.latest).toMatchObject({ version: 2, status: "clear", updatedByName: "관리자" });

    const hidden = await read(await handleSetHidden(req("POST", `/api/games/${id}/hidden`, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", { hidden: true }), deps(), id));
    expect(hidden.status).toBe(200);
    expect(hidden.body.game).toMatchObject({ hidden: true, version: 3 });

    const changes = await read(await handleListChanges(req("GET", `/api/games/${id}/changes`, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), deps(), id));
    expect(changes.status).toBe(200);
    expect(changes.body.total).toBe(3);
    expect(changes.body.changes.map((c: { action: string }) => c.action)).toEqual(["hide", "update", "create"]);
    expect(changes.body.changes.every((c: { actorName: string }) => c.actorName === "관리자")).toBe(true);
    expect(changes.body.changes[1].summary).toBe("정복 여부 모름 → 정복");

    const adminList = await read(await handleListGames(req("GET", "/api/games?includeHidden=1", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), deps()));
    expect(adminList.body.games.map((g: { id: string }) => g.id)).toEqual([id]);
    const visitorList = await read(await handleListGames(req("GET", "/api/games?includeHidden=1", null), deps()));
    expect(visitorList.body).toEqual({ games: [] });

    const meta = await read(await handleYoutubeMeta(req("GET", `/api/games/youtube?url=${encodeURIComponent(VIDEO)}`, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), deps()));
    expect(meta.status).toBe(200);
    expect(meta.body).toMatchObject({ videoId: "dQw4w9WgXcQ", date: "2026-10-23" });

    // 익명 검증
    expect(findStringAnywhere(d1, REAL_NAME)).toEqual([]);
    for (const t of texts) {
      expect(t).not.toContain(REAL_NAME);
      expect(t).not.toContain(FAKE_ADMIN_ID);
      expect(t).not.toContain("channel");
      expect(t).not.toContain("write_token");
    }
    expect(logs.join("\n")).not.toContain(FAKE_ADMIN_ID);
    const row = d1.sqlite.prepare("SELECT updated_by_name AS n, updated_by_channel_id AS c FROM games WHERE id = ?").get(id);
    expect(row).toMatchObject({ n: "관리자", c: FAKE_ADMIN_ID }); // 감사용 ID는 DB에만
    // 채널 ID는 감사용 두 컬럼에만 있다(스냅샷·요약·다른 컬럼에 섞이지 않는다)
    expect([...new Set(findStringAnywhere(d1, FAKE_ADMIN_ID))].sort()).toEqual(["game_changes.channel_id", "games.updated_by_channel_id"]);
    const snaps = d1.sqlite.prepare("SELECT before_json, after_json, summary FROM game_changes").all();
    for (const s of snaps) expect(JSON.stringify(s)).not.toMatch(new RegExp(`${FAKE_ADMIN_ID}|${REAL_NAME}`));
  });

  it("직접 API 호출의 공백·비정규 유튜브 URL은 500이 아니라 다듬어 저장된다", async () => {
    const padded = { ...INPUT, name: "  엘든 링  ", vods: [{ title: " 1화 ", url: ` https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ&x="a#frag `, date: "2026-10-23" }] };
    const res = await read(await handleCreateGame(req("POST", "/api/games", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", { input: padded }), deps()));
    expect(res.status).toBe(201);
    expect(res.body.game).toMatchObject({ name: "엘든 링", vods: [{ title: "1화", url: VIDEO }] });
    expect(d1.sqlite.prepare("SELECT url FROM game_vods").get()).toEqual({ url: VIDEO });
  });

  it("야시로 채널 세션은 '야시로'로 기록된다", async () => {
    const res = await read(await handleCreateGame(req("POST", "/api/games", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", { input: INPUT }), deps()));
    expect(res.status).toBe(201);
    expect(res.body.game.updatedByName).toBe("야시로");
    expect(findStringAnywhere(d1, "야시로 본채널")).toEqual([]);
    const id = res.body.game.id;
    const stale = await read(
      await handleUpdateGame(req("PATCH", `/api/games/${id}`, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", { expectedVersion: 9, patch: { status: "fail" } }), deps(), id),
    );
    expect(stale.body.error.message.startsWith("야시로가 방금(")).toBe(true);
  });

  it("검증 오류는 422, 경로 접두 없이 치지직 링크 문구를 준다", async () => {
    const bad = { ...INPUT, vods: [{ title: "t", url: "https://chzzk.naver.com/video/1", date: "2026-10-23" }] };
    const res = await read(await handleCreateGame(req("POST", "/api/games", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", { input: bad }), deps()));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("invalid");
    expect(res.body.issues.map((i: { path: string }) => i.path)).toContain("vods[0].url");
    expect(JSON.stringify(res.body.issues)).toContain("유튜브");
    expect(CHZZK_VOD_MESSAGE).toContain("유튜브");
    expect(d1.sqlite.prepare("SELECT count(*) AS n FROM games").get()).toEqual({ n: 0 });
  });

  it("없는 게임은 404, 이름 규칙 위반 id도 404", async () => {
    const none = await read(await handleSetHidden(req("POST", "/api/games/none/hidden", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", { hidden: true }), deps(), "none"));
    expect(none.status).toBe(404);
    const noChanges = await read(await handleListChanges(req("GET", "/api/games/none/changes", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), deps(), "none"));
    expect(noChanges.status).toBe(404);
  });

  it("권한이 없는 요청은 DB를 바꾸지 못한다", async () => {
    const cases: Array<[string | null, number, string, Record<string, string>?]> = [
      [null, 401, "login_required"],
      ["dddddddddddddddddddddddddddddddd", 401, "session_expired"],
      ["0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f", 401, "session_expired"],
      ["ghost", 401, "login_required"],
      ["cccccccccccccccccccccccccccccccc", 403, "forbidden"],
      ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 403, "cross_origin", { origin: "https://evil.example" }],
    ];
    for (const [sid, status, code, headers] of cases) {
      const res = await read(await handleCreateGame(req("POST", "/api/games", sid, { input: INPUT }, headers), deps()));
      expect([res.status, res.body.error.code]).toEqual([status, code]);
    }
    expect(d1.sqlite.prepare("SELECT count(*) AS n FROM games").get()).toEqual({ n: 0 });
  });

  it("loadGamesPageData: 관리자 / 방문자 / D1 오류", async () => {
    await read(await handleCreateGame(req("POST", "/api/games", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", { input: INPUT }), deps()));
    const id = (d1.sqlite.prepare("SELECT id FROM games").get() as { id: string }).id;
    await read(await handleSetHidden(req("POST", `/api/games/${id}/hidden`, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", { hidden: true }), deps(), id));

    const admin = await loadGamesPageData(deps(), "session_id=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(admin).toMatchObject({ ok: true, admin: { name: "관리자" } });
    expect(admin.ok && admin.games).toHaveLength(1);
    const visitor = await loadGamesPageData(deps(), null);
    expect(visitor).toEqual({ ok: true, admin: null, games: [] });
    const text = JSON.stringify([admin, visitor]);
    expect(text).not.toContain(FAKE_ADMIN_ID);
    expect(text).not.toContain(REAL_NAME);

    const broken = vi.fn(() => {
      throw new Error("no such table");
    });
    expect(await loadGamesPageData(deps({ db: { prepare: broken, batch: broken } as unknown as ApiDeps["db"] }), null)).toEqual({ ok: false });
    expect(logs.at(-1)).toBe("games-api unavailable Error");
  });
});
