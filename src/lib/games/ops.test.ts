import { afterEach, describe, expect, it } from "vitest";
import { createGame, getGame, listChanges } from "./repo.ts";
import { FAKE_ADMIN_ID, createGamesTestDb, type TestD1 } from "./test-d1.ts";
import { YASIRO_CHANNEL_ID } from "./admin.ts";
import { changeIdsOf, opsActor, parseOps, recordingDb, runOps, sqlLiteral } from "./ops.ts";
import type { GameInput, WriteContext } from "./types.ts";

let d1: TestD1;
afterEach(() => {
  d1?.close();
  d1 = undefined as never;
});

const vod = (id: string, date: string, title = `영상 ${id}`) => ({ title, url: `https://www.youtube.com/watch?v=${id}`, date });

function ctx(): WriteContext {
  let n = 0;
  return { actor: { channelId: FAKE_ADMIN_ID, name: "관리자" }, now: 1_800_000_000, uuid: () => `u-${++n}` };
}

async function seed(input: GameInput) {
  const r = await createGame(d1.db, input, { ...ctx(), actor: { channelId: FAKE_ADMIN_ID, name: "관리자" }, uuid: () => `seed-${input.name}` });
  if (!r.ok) throw new Error("seed failed");
  return r.game;
}

describe("sqlLiteral", () => {
  it("? 자리에 값을 리터럴로 넣는다", () => {
    expect(sqlLiteral("UPDATE t SET a = ?, b = ? WHERE c = ?", ["it's", 3, null])).toBe("UPDATE t SET a = 'it''s', b = 3 WHERE c = NULL");
  });
  it("바인딩 수가 ?와 다르면 던진다", () => {
    expect(() => sqlLiteral("SELECT ?", [])).toThrow(RangeError);
    expect(() => sqlLiteral("SELECT 1", [1])).toThrow(RangeError);
  });
  it("문자열·정수·null 외의 값은 던진다", () => {
    expect(() => sqlLiteral("SELECT ?", [true])).toThrow(TypeError);
    expect(() => sqlLiteral("SELECT ?", [1.5])).toThrow();
  });
});

describe("recordingDb", () => {
  it("batch의 쓰기 문장만 리터럴 SQL로 기록하고, 읽기는 기록하지 않는다", async () => {
    d1 = createGamesTestDb();
    const rec = recordingDb(d1.db);
    await rec.db.batch([
      rec.db.prepare("INSERT INTO games (id, name) VALUES (?, ?)").bind("a", "에이"),
      rec.db.prepare("SELECT id FROM games WHERE id = ?").bind("a"),
    ]);
    const row = await rec.db.prepare("SELECT name FROM games WHERE id = ?").bind("a").first<{ name: string }>();
    expect(row?.name).toBe("에이");
    expect((await rec.db.prepare("SELECT count(*) n FROM games").all()).results).toEqual([{ n: 1 }]);
    expect(rec.writes()).toEqual(["INSERT INTO games (id, name) VALUES ('a', '에이');"]);
  });
  it("앞에 주석·공백이 있는 WITH 읽기도 기록하지 않는다", async () => {
    d1 = createGamesTestDb();
    const rec = recordingDb(d1.db);
    await rec.db.batch([rec.db.prepare("  WITH x AS (SELECT 1) SELECT * FROM x")]);
    expect(rec.writes()).toEqual([]);
  });
  it("batch 밖의 run()은 막는다(원격에 재현되지 않는 쓰기 방지)", async () => {
    d1 = createGamesTestDb();
    const rec = recordingDb(d1.db);
    await expect(rec.db.prepare("DELETE FROM games").run()).rejects.toThrow(/batch/);
  });
  it("batch가 롤백되면 기록도 남기지 않는다", async () => {
    d1 = createGamesTestDb();
    const rec = recordingDb(d1.db);
    await expect(
      rec.db.batch([
        rec.db.prepare("INSERT INTO games (id, name) VALUES (?, ?)").bind("a", "에이"),
        rec.db.prepare("INSERT INTO games (id, name) VALUES (?, ?)").bind("a", "중복"),
      ]),
    ).rejects.toThrow();
    expect(rec.writes()).toEqual([]);
  });
});

describe("opsActor", () => {
  it("야시로가 아닌 첫 관리자 ID로 '관리자'를 만든다", () => {
    expect(opsActor(`${YASIRO_CHANNEL_ID},${FAKE_ADMIN_ID}`)).toEqual({ channelId: FAKE_ADMIN_ID, name: "관리자" });
  });
  it("관리자 ID가 없으면 던진다", () => {
    expect(() => opsActor(undefined)).toThrow(/ADMIN_CHANNEL_IDS/);
    expect(() => opsActor(YASIRO_CHANNEL_ID)).toThrow(/ADMIN_CHANNEL_IDS/);
  });
});

describe("parseOps", () => {
  it("배열이 아니면 거부한다", () => {
    expect(parseOps({ op: "hide", id: "a" })).toEqual({ ok: false, error: "작업 목록은 배열이어야 해요." });
    expect(parseOps([])).toEqual({ ok: false, error: "작업이 하나도 없어요." });
  });
  it("알려진 작업만 받는다", () => {
    const ops = [
      { op: "add", input: { name: "새 게임", firstPlayed: null, status: "unknown", vods: [] } },
      { op: "update", id: "a", patch: { status: "clear" } },
      { op: "move-vods", from: "a", to: "b" },
      { op: "move-vods", from: "a", to: "b", dates: ["2026-01-01"], hideFrom: true },
      { op: "move-vods", from: "a", to: "b", urls: ["https://youtu.be/abcdefghijk"] },
      { op: "hide", id: "a" },
      { op: "unhide", id: "a" },
    ];
    expect(parseOps(ops)).toEqual({ ok: true, ops });
  });
  it.each([
    [[null], "1번 작업: 객체가 아니에요."],
    [[{ op: "drop", id: "a" }], "1번 작업: 알 수 없는 op 'drop'"],
    [[{ op: "hide" }], "1번 작업: id가 필요해요."],
    [[{ op: "update", id: "a" }], "1번 작업: patch가 필요해요."],
    [[{ op: "update", id: "a", patch: [] }], "1번 작업: patch가 필요해요."],
    [[{ op: "add" }], "1번 작업: input이 필요해요."],
    [[{ op: "move-vods", from: "a" }], "1번 작업: from·to가 필요해요."],
    [[{ op: "move-vods", from: "a", to: "a" }], "1번 작업: from과 to가 같아요."],
    [[{ op: "move-vods", from: "a", to: "b", dates: "2026-01-01" }], "1번 작업: dates는 문자열 배열이어야 해요."],
    [[{ op: "move-vods", from: "a", to: "b", urls: [1] }], "1번 작업: urls는 문자열 배열이어야 해요."],
    [[{ op: "move-vods", from: "a", to: "b", dates: [], urls: [] }], "1번 작업: dates와 urls는 함께 쓸 수 없어요."],
    [[{ op: "move-vods", from: "a", to: "b", hideFrom: "yes" }], "1번 작업: hideFrom은 true/false예요."],
    [[{ op: "hide", id: "a" }, { op: "hide", id: "" }], "2번 작업: id가 필요해요."],
  ])("잘못된 작업 %j → %s", (raw, error) => {
    expect(parseOps(raw)).toEqual({ ok: false, error });
  });
});

describe("runOps", () => {
  it("add·update·hide·unhide를 순서대로 적용하고 요약을 돌려준다", async () => {
    d1 = createGamesTestDb();
    const rec = recordingDb(d1.db);
    const out = await runOps(
      rec.db,
      [
        { op: "add", input: { name: "새 게임", firstPlayed: "2026-01-02", status: "unknown", vods: [] } },
        { op: "update", id: "새-게임", patch: { status: "clear" } },
        { op: "hide", id: "새-게임" },
        { op: "unhide", id: "새-게임" },
      ],
      ctx(),
    );
    expect(out).toEqual({
      ok: true,
      lines: ["추가 새-게임 · 게임 추가", "수정 새-게임 · 정복 여부 모름 → 정복", "숨김 새-게임 · 목록에서 숨김", "보이기 새-게임 · 다시 보이기"],
    });
    const g = await getGame(d1.db, "새-게임", { includeHidden: true });
    expect(g).toMatchObject({ status: "clear", hidden: false, version: 4, updatedByName: "관리자" });
    expect(rec.writes().every((s) => !s.startsWith("SELECT"))).toBe(true);
    expect(rec.writes().join("\n")).not.toContain("실명");
  });

  it("바뀐 게 없는 수정·숨김은 '변화 없음'으로 알린다", async () => {
    d1 = createGamesTestDb();
    await seed({ name: "에이", firstPlayed: null, status: "clear", vods: [] });
    const out = await runOps(d1.db, [{ op: "update", id: "에이", patch: { status: "clear" } }, { op: "unhide", id: "에이" }], ctx());
    expect(out).toEqual({ ok: true, lines: ["수정 에이 · 변화 없음", "보이기 에이 · 변화 없음"] });
  });

  it("move-vods: 선택한 날짜의 다시보기만 옮기고 원래 게임에서 뺀다", async () => {
    d1 = createGamesTestDb();
    await seed({ name: "윷놀이", firstPlayed: "2025-10-07", status: "unknown", vods: [vod("aaaaaaaaaaa", "2025-10-07"), vod("bbbbbbbbbbb", "2026-02-16")] });
    await seed({ name: "넷마블 윷놀이", firstPlayed: "2024-02-09", status: "unknown", vods: [] });
    const out = await runOps(d1.db, [{ op: "move-vods", from: "윷놀이", to: "넷마블-윷놀이", dates: ["2025-10-07"] }], ctx());
    expect(out).toEqual({ ok: true, lines: ["다시보기 1편 윷놀이 → 넷마블-윷놀이", "  넷마블-윷놀이 · 다시보기 1편 추가", "  윷놀이 · 다시보기 1편 삭제"] });
    expect((await getGame(d1.db, "넷마블-윷놀이", { includeHidden: false }))?.vods.map((v) => v.date)).toEqual(["2025-10-07"]);
    expect((await getGame(d1.db, "윷놀이", { includeHidden: false }))?.vods.map((v) => v.date)).toEqual(["2026-02-16"]);
  });

  it("move-vods: 지정이 없으면 전부 옮기고, hideFrom이면 원래 게임을 숨긴다", async () => {
    d1 = createGamesTestDb();
    await seed({ name: "증바람", firstPlayed: "2026-07-04", status: "unknown", vods: [vod("ccccccccccc", "2026-07-04")] });
    await seed({ name: "롤", firstPlayed: "2025-01-01", status: "endless", vods: [vod("ddddddddddd", "2025-01-01")] });
    const out = await runOps(d1.db, [{ op: "move-vods", from: "증바람", to: "롤", hideFrom: true }], ctx());
    expect(out.ok).toBe(true);
    expect(out.lines).toEqual(["다시보기 1편 증바람 → 롤", "  롤 · 다시보기 1편 추가", "  증바람 · 다시보기 1편 삭제", "  증바람 · 목록에서 숨김"]);
    expect((await getGame(d1.db, "롤", { includeHidden: false }))?.vods).toHaveLength(2);
    expect(await getGame(d1.db, "증바람", { includeHidden: false })).toBeNull();
    expect((await listChanges(d1.db, "증바람")).changes[0].summary).toBe("목록에서 숨김");
  });

  it("move-vods: URL로 고를 수 있고(형식이 달라도 같은 영상), 대상에 이미 있는 영상은 중복으로 넣지 않는다", async () => {
    d1 = createGamesTestDb();
    await seed({ name: "에이", firstPlayed: null, status: "unknown", vods: [vod("eeeeeeeeeee", "2026-01-01"), vod("fffffffffff", "2026-01-02")] });
    await seed({ name: "비", firstPlayed: null, status: "unknown", vods: [vod("eeeeeeeeeee", "2026-01-01")] });
    const out = await runOps(
      d1.db,
      [{ op: "move-vods", from: "에이", to: "비", urls: ["https://youtu.be/eeeeeeeeeee", "https://youtu.be/fffffffffff?t=3"] }],
      ctx(),
    );
    expect(out.lines).toEqual(["다시보기 2편 에이 → 비", "  비 · 다시보기 1편 추가", "  에이 · 다시보기 2편 삭제"]);
    expect((await getGame(d1.db, "비", { includeHidden: false }))?.vods).toHaveLength(2);
  });

  it.each([
    [[{ op: "update", id: "없음", patch: { status: "clear" } }], "1번 작업(수정 없음): 게임이 없어요."],
    [[{ op: "hide", id: "없음" }], "1번 작업(숨김 없음): 게임이 없어요."],
    [[{ op: "move-vods", from: "없음", to: "에이" }], "1번 작업(다시보기 옮기기 없음 → 에이): 게임이 없어요."],
    [[{ op: "move-vods", from: "에이", to: "없음" }], "1번 작업(다시보기 옮기기 에이 → 없음): 게임이 없어요."],
    [[{ op: "move-vods", from: "에이", to: "비", dates: ["2020-01-01"] }], "1번 작업(다시보기 옮기기 에이 → 비): 고른 다시보기가 없어요."],
    [[{ op: "update", id: "에이", patch: { name: "" } }], "1번 작업(수정 에이): 검증 실패 · name"],
    [[{ op: "add", input: { name: "", firstPlayed: null, status: "unknown", vods: [] } }], "1번 작업(추가 ): 검증 실패 · name"],
    [[{ op: "add", input: { name: "에이", firstPlayed: null, status: "unknown", vods: [] } }, { op: "update", id: "에이", patch: { firstPlayed: "x" } }], "2번 작업(수정 에이): 검증 실패 · firstPlayed"],
  ])("실패하면 그 자리에서 멈춘다: %j", async (ops, error) => {
    d1 = createGamesTestDb();
    await seed({ name: "에이", firstPlayed: null, status: "unknown", vods: [vod("ggggggggggg", "2026-01-01")] });
    await seed({ name: "비", firstPlayed: null, status: "unknown", vods: [] });
    const out = await runOps(d1.db, ops as never, ctx());
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe(error);
  });

  it("작업 실패가 아닌 예외(DB 오류 등)는 그대로 던진다", async () => {
    d1 = createGamesTestDb();
    const broken = { prepare: d1.db.prepare, batch: async () => Promise.reject(new Error("D1 down")) };
    await expect(runOps(broken, [{ op: "hide", id: "에이" }], ctx())).rejects.toThrow("D1 down");
  });

  it("move-vods 대상 게임 저장이 실패하면 원래 게임은 건드리지 않는다", async () => {
    d1 = createGamesTestDb();
    await seed({ name: "에이", firstPlayed: null, status: "unknown", vods: [vod("hhhhhhhhhhh", "2026-01-01")] });
    await seed({ name: "비", firstPlayed: null, status: "unknown", vods: [] });
    d1.sqlite.exec("PRAGMA ignore_check_constraints = ON");
    d1.sqlite.exec("UPDATE games SET name = '' WHERE id = '비'");
    const out = await runOps(d1.db, [{ op: "move-vods", from: "에이", to: "비" }], ctx());
    expect(out.ok).toBe(false);
    expect((await getGame(d1.db, "에이", { includeHidden: false }))?.vods).toHaveLength(1);
  });
});

describe("changeIdsOf", () => {
  it("기록된 쓰기에서 game_changes id를 뽑는다(원격 적용 확인용)", async () => {
    d1 = createGamesTestDb();
    const rec = recordingDb(d1.db);
    await runOps(rec.db, [{ op: "add", input: { name: "에이", firstPlayed: null, status: "unknown", vods: [] } }, { op: "hide", id: "에이" }], ctx());
    const ids = changeIdsOf(rec.writes());
    expect(ids).toHaveLength(2);
    const rows = d1.sqlite.prepare(`SELECT id FROM game_changes WHERE id IN (${ids.map(() => "?").join(",")})`).all(...ids);
    expect(rows).toHaveLength(2);
  });
  it("game_changes가 아닌 문장은 무시한다", () => {
    expect(changeIdsOf(["UPDATE games SET hidden = 1;", "INSERT INTO game_vods (game_id) VALUES ('a');"])).toEqual([]);
  });
});
