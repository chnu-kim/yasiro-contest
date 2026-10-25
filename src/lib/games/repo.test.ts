import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGamesTestDb, FAKE_ADMIN_ID, findStringAnywhere, type TestD1 } from "./test-d1.ts";
import { allocateGameId, applyPatch, createGame, getGame, listChanges, listGames, RESERVED_IDS, setHidden, uniqueViolation, updateGame } from "./repo.ts";
import type { Game, GameInput, GamesDb, WriteContext } from "./types.ts";

const POSTER = "https://ssl.pstatic.net/static/a.png";
const POSTER2 = "https://ssl.pstatic.net/static/b.png";
const vod = (n: number, date = "2026-10-01") => ({
  title: `${n}화`,
  url: `https://www.youtube.com/watch?v=${String(n).padStart(11, "x")}`,
  date,
});

/** 쓰기 batch인가(조회 batch와 구분) */
const isWrite = (s: readonly unknown[]): boolean => /^(INSERT|UPDATE|DELETE)/.test((s[0] as { sql: string }).sql);

let d1: TestD1;
let n: number;
let now: number;
const ctx = (name: "관리자" | "야시로" = "관리자"): WriteContext => ({
  actor: { channelId: FAKE_ADMIN_ID, name },
  now,
  uuid: () => `u${++n}`,
});
const input = (over: Partial<GameInput> = {}): GameInput => ({ name: "엘든 링", firstPlayed: "2026-10-01", status: "unknown", vods: [], ...over });

beforeEach(() => {
  d1 = createGamesTestDb();
  n = 0;
  now = 1_792_900_000;
});
afterEach(() => d1.close());

describe("allocateGameId / uniqueViolation / applyPatch", () => {
  it("원제 → categoryId → 이름 순, 다 비면 game", () => {
    expect(allocateGameId({ name: "엘든 링", originalTitle: "ELDEN RING" }, new Set())).toBe("elden-ring");
    expect(allocateGameId({ name: "엘든 링", categoryId: "Cat_1" }, new Set())).toBe("cat-1");
    expect(allocateGameId({ name: "엘든 링" }, new Set())).toBe("엘든-링");
    expect(allocateGameId({ name: "!!!" }, new Set())).toBe("game");
  });
  it("중복·예약어는 -2, -3", () => {
    expect([...RESERVED_IDS].sort()).toEqual(["categories", "new", "youtube"]);
    expect(allocateGameId({ name: "new" }, new Set())).toBe("new-2");
    expect(allocateGameId({ name: "a" }, new Set(["a", "a-2"]))).toBe("a-3");
  });
  it("uniqueViolation은 부분 문자열", () => {
    expect(uniqueViolation(new Error("UNIQUE constraint failed: games.category_id"))).toBe("category_id");
    expect(uniqueViolation(new Error("D1_ERROR: UNIQUE constraint failed: games.id: SQLITE_CONSTRAINT"))).toBe("id");
    expect(uniqueViolation("UNIQUE constraint failed: games.id")).toBe("id");
    expect(uniqueViolation(new Error("other"))).toBeNull();
  });
  it("applyPatch: 유지·제거·교체", () => {
    const g: Game = { id: "g", name: "a", originalTitle: "A", categoryId: "c", posterUrl: POSTER, firstPlayed: null, status: "clear", vods: [vod(1)] };
    expect(applyPatch(g, {})).toEqual(g);
    expect(applyPatch(g, { name: "b", originalTitle: null, firstPlayed: "2026-01-01", status: "fail" })).toEqual({
      id: "g", name: "b", categoryId: "c", posterUrl: POSTER, firstPlayed: "2026-01-01", status: "fail", vods: [vod(1)],
    });
    expect(applyPatch(g, { originalTitle: "B" })).toMatchObject({ originalTitle: "B" });
    expect(applyPatch(g, { category: null })).not.toHaveProperty("categoryId");
    expect(applyPatch(g, { category: null })).not.toHaveProperty("posterUrl");
    expect(applyPatch(g, { category: { categoryId: "d", posterUrl: null } })).toMatchObject({ categoryId: "d" });
    expect(applyPatch(g, { category: { categoryId: "d", posterUrl: null } })).not.toHaveProperty("posterUrl");
    expect(applyPatch(g, { category: { categoryId: "d", posterUrl: POSTER2 } })).toMatchObject({ posterUrl: POSTER2 });
    expect((applyPatch(g, { vods: [vod(2, "2026-10-05"), vod(3, "2026-10-02")] }) as Game).vods.map((v) => v.title)).toEqual(["3화", "2화"]);
  });
});

describe("createGame", () => {
  it("추가: 게임·다시보기·기록이 한 번의 batch로 들어간다", async () => {
    const before = d1.batchCalls();
    const r = await createGame(d1.db, input({ originalTitle: "ELDEN RING", categoryId: "c1", posterUrl: POSTER, vods: [vod(2, "2026-10-03"), vod(1)] }), ctx());
    expect(r).toMatchObject({ ok: true, changed: true, game: { id: "elden-ring", version: 1, hidden: false, updatedByName: "관리자", createdAt: now } });
    expect(d1.batchCalls() - before).toBe(3); // 목록 읽기 + 쓰기 + 다시 읽기
    const g = await getGame(d1.db, "elden-ring", { includeHidden: false });
    expect(g?.vods.map((v) => v.title)).toEqual(["1화", "2화"]);
    const log = await listChanges(d1.db, "elden-ring");
    expect(log).toEqual({ total: 1, changes: [{ id: "u1", action: "create", summary: "게임 추가", actorName: "관리자", createdAt: now }] });
  });
  it("다시보기 17편은 두 문장으로 나뉜다", async () => {
    const vods = Array.from({ length: 17 }, (_, i) => vod(i + 1, `2026-10-${String(i + 1).padStart(2, "0")}`));
    const r = await createGame(d1.db, input({ vods }), ctx());
    expect(r.ok && r.game.vods).toHaveLength(17);
  });
  it("검증 실패는 invalid + 아무것도 쓰지 않음", async () => {
    const r = await createGame(d1.db, input({ name: " " }), ctx());
    expect(r).toMatchObject({ ok: false, reason: "invalid" });
    expect(await listGames(d1.db, { includeHidden: true })).toEqual([]);
  });
  it("categoryId 중복은 invalid(숨긴 게임 포함)", async () => {
    await createGame(d1.db, input({ categoryId: "c1" }), ctx());
    await setHidden(d1.db, "엘든-링", true, ctx());
    const r = await createGame(d1.db, input({ name: "다른", categoryId: "c1" }), ctx());
    expect(r).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("경쟁으로 UNIQUE 위반이면 한 번 다시 시도해 새 id를 받는다", async () => {
    let raced = false;
    const racing: GamesDb = {
      prepare: (q) => d1.db.prepare(q),
      batch: async (s) => {
        if (!raced && isWrite(s)) {
          raced = true;
          d1.sqlite.prepare("INSERT INTO games (id, name, first_played, status) VALUES ('엘든-링', 'x', NULL, 'unknown')").run();
        }
        return d1.db.batch(s);
      },
    };
    const r = await createGame(racing, input(), ctx());
    expect(r).toMatchObject({ ok: true, game: { id: "엘든-링-2" } });
  });
  it("두 번째도 UNIQUE면 던진다", async () => {
    const always: GamesDb = {
      prepare: (q) => d1.db.prepare(q),
      batch: async (s) => {
        if (isWrite(s)) throw new Error("UNIQUE constraint failed: games.id");
        return d1.db.batch(s);
      },
    };
    await expect(createGame(always, input(), ctx())).rejects.toThrow("UNIQUE");
  });
  it("UNIQUE가 아닌 오류는 바로 던진다", async () => {
    const broken: GamesDb = {
      prepare: (q) => d1.db.prepare(q),
      batch: async (s) => {
        if (isWrite(s)) throw new Error("boom");
        return d1.db.batch(s);
      },
    };
    await expect(createGame(broken, input(), ctx())).rejects.toThrow("boom");
  });
});

describe("조회", () => {
  it("방문자 목록은 숨김 제외, getGame은 숨김이면 null", async () => {
    await createGame(d1.db, input({ name: "가" }), ctx());
    await createGame(d1.db, input({ name: "나", firstPlayed: null }), ctx());
    await setHidden(d1.db, "나", true, ctx());
    expect((await listGames(d1.db, { includeHidden: false })).map((g) => g.id)).toEqual(["가"]);
    expect((await listGames(d1.db, { includeHidden: true })).map((g) => g.id)).toEqual(["가", "나"]);
    expect(await getGame(d1.db, "나", { includeHidden: false })).toBeNull();
    expect(await getGame(d1.db, "나", { includeHidden: true })).toMatchObject({ hidden: true });
    expect(await getGame(d1.db, "없음", { includeHidden: true })).toBeNull();
  });
});

describe("updateGame", () => {
  beforeEach(async () => {
    await createGame(d1.db, input({ originalTitle: "ELDEN RING", categoryId: "c1", posterUrl: POSTER, vods: [vod(1), vod(2, "2026-10-02")] }), ctx());
    now += 60;
  });
  it("없는 게임", async () => {
    expect(await updateGame(d1.db, "x", {}, 1, ctx())).toEqual({ ok: false, reason: "not_found" });
  });
  it("version 불일치는 conflict + latest", async () => {
    const r = await updateGame(d1.db, "elden-ring", { name: "b" }, 5, ctx());
    expect(r).toMatchObject({ ok: false, reason: "conflict", latest: { version: 1, updatedByName: "관리자" } });
  });
  it("변화 없으면 쓰지 않는다", async () => {
    const r = await updateGame(d1.db, "elden-ring", { name: "엘든 링" }, 1, ctx());
    expect(r).toMatchObject({ ok: true, changed: false, game: { version: 1 } });
    expect((await listChanges(d1.db, "elden-ring")).total).toBe(1);
  });
  it("검증 실패는 invalid", async () => {
    const r = await updateGame(d1.db, "elden-ring", { vods: [{ ...vod(1), url: "https://chzzk.naver.com/video/1" }] }, 1, ctx());
    expect(r).toMatchObject({ ok: false, reason: "invalid" });
  });
  it("수정: version +1, 수정자 별칭, 기록 한 줄, 다시보기 교체", async () => {
    const r = await updateGame(d1.db, "elden-ring", { status: "clear", vods: [vod(3, "2026-10-04")] }, 1, ctx("야시로"));
    expect(r).toMatchObject({ ok: true, changed: true, game: { version: 2, status: "clear", updatedByName: "야시로", updatedAt: now } });
    expect(r.ok && r.game.vods.map((v) => v.title)).toEqual(["3화"]);
    const log = await listChanges(d1.db, "elden-ring");
    expect(log.total).toBe(2);
    expect(log.changes[0]).toMatchObject({ action: "update", actorName: "야시로", summary: "정복 여부 모름 → 정복, 다시보기 1편 추가·2편 삭제" });
  });
  it("다시보기를 건드리지 않으면 다시보기 문장이 없다", async () => {
    const r = await updateGame(d1.db, "elden-ring", { name: "엘든 링 2" }, 1, ctx());
    expect(r.ok && r.game.vods).toHaveLength(2);
  });
  it("카테고리 해제·원제 제거", async () => {
    const r = await updateGame(d1.db, "elden-ring", { category: null, originalTitle: null }, 1, ctx());
    expect(r.ok && r.game).not.toHaveProperty("categoryId");
  });
  it("다른 게임의 categoryId로 바꾸는 경쟁은 invalid(UNIQUE)", async () => {
    await createGame(d1.db, input({ name: "다크 소울" }), ctx());
    // 검증 시점엔 비어 있다가 batch 직전에 다른 요청이 차지한 상황
    let raced = false;
    const racing: GamesDb = {
      prepare: (q) => d1.db.prepare(q),
      batch: async (s) => {
        if (!raced && isWrite(s)) {
          raced = true;
          d1.sqlite.prepare("UPDATE games SET category_id = 'c9' WHERE id = '다크-소울'").run();
        }
        return d1.db.batch(s);
      },
    };
    const r = await updateGame(racing, "elden-ring", { category: { categoryId: "c9", posterUrl: null } }, 1, ctx());
    expect(r).toMatchObject({ ok: false, reason: "invalid", issues: [{ path: "categoryId" }] });
  });
  it("UNIQUE가 아닌 오류는 던진다", async () => {
    const broken: GamesDb = { prepare: (q) => d1.db.prepare(q), batch: async (s) => (isWrite(s) ? Promise.reject(new Error("boom")) : d1.db.batch(s)) };
    await expect(updateGame(broken, "elden-ring", { name: "z" }, 1, ctx())).rejects.toThrow("boom");
  });
  it("읽기와 쓰기 사이에 고쳐졌으면 conflict, 2·3번 문장은 효과 없음", async () => {
    let raced = false;
    const racing: GamesDb = {
      prepare: (q) => d1.db.prepare(q),
      batch: async (s) => {
        if (!raced && isWrite(s)) {
          raced = true;
          d1.sqlite.prepare("UPDATE games SET version = 2, name = '남이 고침', updated_by_name = '야시로' WHERE id = 'elden-ring'").run();
        }
        return d1.db.batch(s);
      },
    };
    const r = await updateGame(racing, "elden-ring", { vods: [vod(3, "2026-10-04")], name: "내 수정" }, 1, ctx());
    expect(r).toMatchObject({ ok: false, reason: "conflict", latest: { version: 2, name: "남이 고침", updatedByName: "야시로" } });
    expect((await getGame(d1.db, "elden-ring", { includeHidden: true }))?.vods).toHaveLength(2);
    expect((await listChanges(d1.db, "elden-ring")).total).toBe(1);
  });
  it("그 사이 사라졌으면 not_found", async () => {
    const racing: GamesDb = {
      prepare: (q) => d1.db.prepare(q),
      batch: async (s) => {
        if (isWrite(s)) d1.sqlite.prepare("DELETE FROM games WHERE id = 'elden-ring'").run();
        return d1.db.batch(s);
      },
    };
    expect(await updateGame(racing, "elden-ring", { name: "z" }, 1, ctx())).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("setHidden", () => {
  beforeEach(async () => {
    await createGame(d1.db, input(), ctx());
  });
  it("없는 게임", async () => {
    expect(await setHidden(d1.db, "x", true, ctx())).toEqual({ ok: false, reason: "not_found" });
  });
  it("이미 그 상태면 쓰지 않음", async () => {
    expect(await setHidden(d1.db, "엘든-링", false, ctx())).toMatchObject({ ok: true, changed: false });
    expect((await listChanges(d1.db, "엘든-링")).total).toBe(1);
  });
  it("숨김·되돌리기는 version을 올리고 기록한다", async () => {
    const hide = await setHidden(d1.db, "엘든-링", true, ctx());
    expect(hide).toMatchObject({ ok: true, changed: true, game: { hidden: true, version: 2 } });
    const unhide = await setHidden(d1.db, "엘든-링", false, ctx());
    expect(unhide).toMatchObject({ ok: true, changed: true, game: { hidden: false, version: 3 } });
    const log = await listChanges(d1.db, "엘든-링");
    expect(log.changes.map((c) => c.summary)).toEqual(["다시 보이기", "목록에서 숨김", "게임 추가"]);
  });
  it("경쟁으로 이미 숨겨졌으면 changed false, 기록 중복 없음", async () => {
    const racing: GamesDb = {
      prepare: (q) => d1.db.prepare(q),
      batch: async (s) => {
        if (isWrite(s)) d1.sqlite.prepare("UPDATE games SET hidden = 1, version = 2 WHERE id = '엘든-링'").run();
        return d1.db.batch(s);
      },
    };
    const r = await setHidden(racing, "엘든-링", true, ctx());
    expect(r).toMatchObject({ ok: true, changed: false, game: { hidden: true } });
    expect((await listChanges(d1.db, "엘든-링")).total).toBe(1);
  });
});

describe("listChanges", () => {
  it("limit 기본 20, 범위 clamp, 비정수는 기본값", async () => {
    await createGame(d1.db, input(), ctx());
    for (let i = 0; i < 25; i += 1) await updateGame(d1.db, "엘든-링", { name: `n${i}` }, i + 1, ctx());
    expect((await listChanges(d1.db, "엘든-링")).changes).toHaveLength(20);
    expect((await listChanges(d1.db, "엘든-링", 1.5)).changes).toHaveLength(20);
    expect((await listChanges(d1.db, "엘든-링", 0)).changes).toHaveLength(1);
    const big = await listChanges(d1.db, "엘든-링", 999);
    expect(big.changes).toHaveLength(26);
    expect(big.total).toBe(26);
    expect((await listChanges(d1.db, "엘든-링", 3)).changes.map((c) => c.summary)[0]).toBe("이름 n23 → n24");
  });
  it("없는 게임은 빈 목록", async () => {
    expect(await listChanges(d1.db, "없음")).toEqual({ changes: [], total: 0 });
  });
});

describe("익명", () => {
  it("저장값은 별칭뿐, 채널 이름 문자열 없음", async () => {
    await createGame(d1.db, input(), ctx());
    await updateGame(d1.db, "엘든-링", { status: "clear" }, 1, ctx());
    expect(findStringAnywhere(d1, "실명채널")).toEqual([]);
  });
});

describe("정규화: 검증한 값(trim·정규 URL)을 저장한다", () => {
  const ID = "dQw4w9WgXcQ";
  const CANON = `https://www.youtube.com/watch?v=${ID}`;
  it("추가: 이름·원제·categoryId·다시보기 제목의 앞뒤 공백을 떼고 저장", async () => {
    const r = await createGame(
      d1.db,
      input({ name: "  공백 게임  ", originalTitle: " Space Game ", categoryId: " c1 ", vods: [{ title: " 1화 ", url: CANON, date: "2026-10-01" }] }),
      ctx(),
    );
    expect(r).toMatchObject({ ok: true, game: { name: "공백 게임", originalTitle: "Space Game", categoryId: "c1", vods: [{ title: "1화" }] } });
    const row = d1.sqlite.prepare("SELECT name, original_title, category_id FROM games").get();
    expect(row).toEqual({ name: "공백 게임", original_title: "Space Game", category_id: "c1" });
    expect(d1.sqlite.prepare("SELECT title FROM game_vods").get()).toEqual({ title: "1화" });
  });
  it("추가: 다시보기 URL은 https://www.youtube.com/watch?v=ID로 정규화(앞뒤 공백·youtu.be·포트·쿼리·프래그먼트·대문자 스킴)", async () => {
    const urls = [
      ` ${CANON} `,
      `https://youtu.be/${ID.replace("Q", "A")}`,
      `https://www.youtube.com:8443/watch?v=${ID.replace("Q", "B")}&x="onmouseover=1#frag`,
      `HTTPS://m.youtube.com/watch?v=${ID.replace("Q", "C")}`,
    ];
    const vods = urls.map((url, i) => ({ title: `${i}화`, url, date: "2026-10-01" }));
    const r = await createGame(d1.db, input({ vods }), ctx());
    expect(r.ok).toBe(true);
    const stored = d1.sqlite.prepare("SELECT url FROM game_vods ORDER BY position").all().map((x) => x.url);
    expect(stored).toEqual([CANON, ...["A", "B", "C"].map((c) => `https://www.youtube.com/watch?v=${ID.replace("Q", c)}`)]);
  });
  it("수정: 공백만 다른 이름은 변화 없음(version·기록 그대로)", async () => {
    await createGame(d1.db, input(), ctx());
    const r = await updateGame(d1.db, "엘든-링", { name: "  엘든 링  " }, 1, ctx());
    expect(r).toMatchObject({ ok: true, changed: false, game: { version: 1 } });
    expect((await listChanges(d1.db, "엘든-링")).total).toBe(1);
  });
  it("수정: 공백 붙은 값·URL은 다듬어 저장", async () => {
    await createGame(d1.db, input(), ctx());
    const r = await updateGame(
      d1.db,
      "엘든-링",
      { name: " 엘든 링 DLC ", originalTitle: " ELDEN ", category: { categoryId: " c2 ", posterUrl: null }, vods: [{ title: " 1화 ", url: ` https://youtu.be/${ID} `, date: "2026-10-01" }] },
      1,
      ctx(),
    );
    expect(r).toMatchObject({ ok: true, changed: true, game: { name: "엘든 링 DLC", originalTitle: "ELDEN", categoryId: "c2", vods: [{ title: "1화", url: CANON }] } });
    expect(d1.sqlite.prepare("SELECT url, title FROM game_vods").get()).toEqual({ url: CANON, title: "1화" });
  });
  it("수정: 저장된 것과 같은 영상을 다른 꼴의 URL로 보내도 다시보기 변화 없음", async () => {
    await createGame(d1.db, input({ vods: [{ title: "1화", url: CANON, date: "2026-10-01" }] }), ctx());
    const r = await updateGame(d1.db, "엘든-링", { vods: [{ title: "1화", url: `https://youtu.be/${ID}`, date: "2026-10-01" }] }, 1, ctx());
    expect(r).toMatchObject({ ok: true, changed: false });
  });
});

describe("D1 바인딩 한도(문장당 100)", () => {
  const many = (k: number) => Array.from({ length: k }, (_, i) => vod(i + 1, `2026-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`));
  it("다시보기 45편 추가·수정이 한도 안에서 나뉜다", async () => {
    const created = await createGame(d1.db, input({ firstPlayed: "2026-01-01", vods: many(45) }), ctx());
    expect(created.ok && created.game.vods).toHaveLength(45);
    const updated = await updateGame(d1.db, "엘든-링", { vods: many(44) }, 1, ctx());
    expect(updated.ok && updated.game.vods).toHaveLength(44);
  });
});

describe("숨긴 게임도 중복 검사·id 할당에 들어간다", () => {
  it("숨긴 게임과 같은 slug면 -2", async () => {
    await createGame(d1.db, input(), ctx());
    await setHidden(d1.db, "엘든-링", true, ctx());
    const r = await createGame(d1.db, input({ firstPlayed: "2026-10-02" }), ctx());
    expect(r).toMatchObject({ ok: true, game: { id: "엘든-링-2" } });
  });
  it("숨긴 게임의 categoryId로 바꾸면 invalid(categoryId)", async () => {
    await createGame(d1.db, input({ categoryId: "c1" }), ctx());
    await setHidden(d1.db, "엘든-링", true, ctx());
    await createGame(d1.db, input({ name: "다크 소울" }), ctx());
    const r = await updateGame(d1.db, "다크-소울", { category: { categoryId: "c1", posterUrl: null } }, 1, ctx());
    expect(r).toMatchObject({ ok: false, reason: "invalid", issues: [{ path: "categoryId" }] });
  });
});

describe("변경 기록 스냅샷의 hidden 값", () => {
  const snaps = () =>
    (d1.sqlite.prepare("SELECT action, before_json, after_json FROM game_changes ORDER BY rowid").all() as { action: string; before_json: string | null; after_json: string }[]).map(
      (r) => [r.action, r.before_json === null ? null : JSON.parse(r.before_json).hidden, JSON.parse(r.after_json).hidden],
    );
  it("숨김 → 숨긴 채 수정 → 되돌리기", async () => {
    await createGame(d1.db, input(), ctx());
    await setHidden(d1.db, "엘든-링", true, ctx());
    await updateGame(d1.db, "엘든-링", { status: "clear" }, 2, ctx());
    await setHidden(d1.db, "엘든-링", false, ctx());
    expect(snaps()).toEqual([
      ["create", null, false],
      ["hide", false, true],
      ["update", true, true],
      ["unhide", true, false],
    ]);
  });
});

describe("listChanges 상한", () => {
  it("limit 999도 50개까지", async () => {
    await createGame(d1.db, input(), ctx());
    for (let i = 0; i < 60; i += 1) await updateGame(d1.db, "엘든-링", { name: `n${i}` }, i + 1, ctx());
    const big = await listChanges(d1.db, "엘든-링", 999);
    expect(big.changes).toHaveLength(50);
    expect(big.total).toBe(61);
  });
});

describe("변화 없는 쓰기는 batch를 쓰지 않는다", () => {
  it("같은 값 수정·이미 숨긴 게임 다시 숨기기", async () => {
    await createGame(d1.db, input(), ctx());
    await setHidden(d1.db, "엘든-링", true, ctx());
    const writes: string[] = [];
    const spy: GamesDb = {
      prepare: (q) => d1.db.prepare(q),
      batch: async (s) => {
        if (isWrite(s)) writes.push((s[0] as unknown as { sql: string }).sql);
        return d1.db.batch(s);
      },
    };
    expect(await updateGame(spy, "엘든-링", { name: "엘든 링" }, 2, ctx())).toMatchObject({ ok: true, changed: false });
    expect(await setHidden(spy, "엘든-링", true, ctx())).toMatchObject({ ok: true, changed: false });
    expect(writes).toEqual([]);
    expect((await listChanges(d1.db, "엘든-링")).total).toBe(2);
  });
});
