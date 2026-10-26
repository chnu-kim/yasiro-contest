// test-d1 대역 자체가 D1처럼 동작하는지 확인한다(다른 모듈 테스트의 전제).
import { describe, expect, it } from "vitest";
import { hashSessionId } from "../session.ts";
import { applyMigrations, createGamesTestDb, createTestD1, FAKE_ADMIN_ID, findStringAnywhere, insertSession } from "./test-d1.ts";

const insertGame = "INSERT INTO games (id, name) VALUES (?, ?)";

describe("test-d1", () => {
  it("applies 0001 + 0007 + 0009 and exposes the games and session tables", () => {
    const d = createGamesTestDb();
    const names = d.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(["game_changes", "game_vods", "games", "auth_sessions", "sessions"]));
  });
  it("first/all/run behave like D1 and return plain objects", async () => {
    const d = createGamesTestDb();
    const r = await d.db.prepare(insertGame).bind("a", "가").run();
    expect(r.meta.changes).toBe(1);
    const one = await d.db.prepare("SELECT id, name, version, hidden, updated_by_name FROM games WHERE id = ?").bind("a").first();
    expect(one).toEqual({ id: "a", name: "가", version: 1, hidden: 0, updated_by_name: "시스템" });
    expect(Object.getPrototypeOf(one)).toBe(Object.prototype);
    expect(await d.db.prepare("SELECT id FROM games WHERE id = ?").bind("zz").first()).toBeNull();
    expect((await d.db.prepare("SELECT id FROM games").all()).results).toEqual([{ id: "a" }]);
  });
  it("UPDATE matching 0 rows is not an error and reports changes 0", async () => {
    const d = createGamesTestDb();
    const r = await d.db.prepare("UPDATE games SET name = ? WHERE id = ?").bind("x", "none").run();
    expect(r.meta.changes).toBe(0);
  });
  it("rejects undefined and boolean binds", () => {
    const d = createGamesTestDb();
    expect(() => d.db.prepare(insertGame).bind("a", undefined)).toThrow(/undefined/);
    expect(() => d.db.prepare(insertGame).bind("a", true)).toThrow(/boolean/);
    expect(() => d.db.prepare(insertGame).bind("a", {})).toThrow(/object/);
  });
  it("batch is atomic: a failing statement rolls back earlier ones", async () => {
    const d = createGamesTestDb();
    await expect(
      d.db.batch([d.db.prepare(insertGame).bind("a", "가"), d.db.prepare(insertGame).bind("a", "중복")]),
    ).rejects.toThrow(/UNIQUE|PRIMARY/);
    expect(d.sqlite.prepare("SELECT count(*) n FROM games").get()).toEqual({ n: 0 });
    expect(d.batchCalls()).toBe(1);
    const ok = await d.db.batch([d.db.prepare(insertGame).bind("b", "나"), d.db.prepare("SELECT id FROM games")]);
    expect(ok[1].results).toEqual([{ id: "b" }]);
  });
  it("enforces CHECK constraints (anonymity alias, status, hidden)", async () => {
    const d = createGamesTestDb();
    await expect(d.db.prepare("INSERT INTO games (id, name, updated_by_name) VALUES ('a', '가', '실명채널')").run()).rejects.toThrow(/CHECK/);
    await expect(d.db.prepare("INSERT INTO games (id, name, status) VALUES ('a', '가', 'won')").run()).rejects.toThrow(/CHECK/);
    await expect(d.db.prepare("INSERT INTO games (id, name, hidden) VALUES ('a', '가', 2)").run()).rejects.toThrow(/CHECK/);
    await d.db.prepare(insertGame).bind("a", "가").run();
    await expect(
      d.db.prepare("INSERT INTO game_changes (id, game_id, actor_name, action, summary, after_json) VALUES ('c', 'a', '실명채널', 'update', 's', '{}')").run(),
    ).rejects.toThrow(/CHECK/);
  });
  it("enforces foreign keys and unique category_id (multiple NULL allowed)", async () => {
    const d = createGamesTestDb();
    await expect(
      d.db.prepare("INSERT INTO game_vods (game_id, video_id, url, title, date, position) VALUES ('none', 'abcdefghijk', 'https://youtu.be/abcdefghijk', 't', '2026-01-01', 0)").run(),
    ).rejects.toThrow(/FOREIGN KEY/);
    await d.db.prepare(insertGame).bind("a", "가").run();
    await d.db.prepare(insertGame).bind("b", "나").run();
    await d.db.prepare("UPDATE games SET category_id = 'C' WHERE id = 'a'").run();
    await expect(d.db.prepare("UPDATE games SET category_id = 'C' WHERE id = 'b'").run()).rejects.toThrow(/UNIQUE/);
  });
  it("RETURNING statements yield rows inside batch", async () => {
    const d = createGamesTestDb();
    const [r] = await d.db.batch([d.db.prepare("INSERT INTO games (id, name) VALUES ('a', '가') RETURNING version")]);
    expect(r.results).toEqual([{ version: 1 }]);
  });
  it("sessions helper (same hash as session.ts) and findStringAnywhere", async () => {
    const d = createGamesTestDb();
    insertSession(d, { id: "s1", channelId: FAKE_ADMIN_ID, channelName: "실명채널", expiresAt: 999 });
    expect(d.sqlite.prepare("SELECT id_hash, channel_name FROM auth_sessions").get()).toEqual({
      id_hash: await hashSessionId("s1"),
      channel_name: "실명채널",
    });
    d.sqlite.exec("INSERT INTO games (id, name) VALUES ('a', '실명채널 게임')");
    expect(findStringAnywhere(d, "실명채널")).toEqual(["games.name"]);
  });
  it("createTestD1 + applyMigrations with explicit list", () => {
    const d = createTestD1();
    applyMigrations(d, ["0001_sessions.sql"]);
    expect(d.sqlite.prepare("SELECT count(*) n FROM sqlite_master WHERE name = 'games'").get()).toEqual({ n: 0 });
    d.close();
  });
});

describe("바인딩 한도", () => {
  it("문장당 100개를 넘으면 D1처럼 던진다", () => {
    const d1 = createTestD1();
    const s = d1.db.prepare("SELECT 1");
    expect(() => s.bind(...Array.from({ length: 100 }, () => 1))).not.toThrow();
    expect(() => s.bind(...Array.from({ length: 101 }, () => 1))).toThrow(/too many SQL variables/);
    d1.close();
  });
});
