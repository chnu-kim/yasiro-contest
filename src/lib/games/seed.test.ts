import { describe, expect, it } from "vitest";
import { GAME_COLUMNS, VOD_COLUMNS } from "./rows.ts";
import { buildSeedSql, exportGames, SEED_SUMMARY, sqlString, sqlValue } from "./seed.ts";
import { GamesValidationError, serializeGames } from "./schema.ts";
import { createGamesTestDb, FAKE_ADMIN_ID } from "./test-d1.ts";
import type { Game, GameRow, VodRow } from "./types.ts";

describe("sqlString", () => {
  it("quotes and doubles single quotes", () => {
    expect(sqlString("abc")).toBe("'abc'");
    expect(sqlString("it's")).toBe("'it''s'");
    expect(sqlString("''")).toBe("''''''");
    expect(sqlString("")).toBe("''");
  });
  it("leaves semicolons, comments, backslashes, emoji and Korean untouched inside the quotes", () => {
    expect(sqlString("a; DROP TABLE games; --")).toBe("'a; DROP TABLE games; --'");
    expect(sqlString("-- x /* y */")).toBe("'-- x /* y */'");
    expect(sqlString("C:\\n\\'")).toBe("'C:\\n\\'''");
    expect(sqlString("😀 한글")).toBe("'😀 한글'");
    expect(sqlString("a\nb")).toBe("'a\nb'");
  });
  it("rejects NUL", () => {
    expect(() => sqlString("a\u0000b")).toThrow(RangeError);
  });
});

describe("sqlValue", () => {
  it("renders null, safe integers and strings", () => {
    expect(sqlValue(null)).toBe("NULL");
    expect(sqlValue(0)).toBe("0");
    expect(sqlValue(-3)).toBe("-3");
    expect(sqlValue(Number.MAX_SAFE_INTEGER)).toBe("9007199254740991");
    expect(sqlValue("x'y")).toBe("'x''y'");
  });
  it("rejects non-safe or non-integer numbers", () => {
    for (const n of [1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => sqlValue(n)).toThrow(RangeError);
    }
  });
});

const POSTER = "https://nng-phinf.pstatic.net/a/b.png";
const tricky: Game[] = [
  {
    id: "alpha",
    name: "알파 'quote'",
    originalTitle: "Alpha; DROP TABLE games; --",
    categoryId: "Alpha_Cat",
    posterUrl: POSTER,
    firstPlayed: "2026-05-02",
    status: "clear",
    vods: [
      { title: "둘째 'x'; -- [ 2026. 05. 03 ]", url: "https://www.youtube.com/watch?v=BBBBBBBBBBB", date: "2026-05-03" },
      { title: "같은 날 A", url: "https://youtu.be/CCCCCCCCCCC?t=1", date: "2026-05-02" },
      { title: "같은 날 B 😀", url: "https://www.youtube.com/watch?v=AAAAAAAAAAA", date: "2026-05-02" },
    ],
  },
  { id: "beta", name: "베타", firstPlayed: null, status: "endless", vods: [] },
  { id: "gamma", name: "감마", categoryId: "Gamma", firstPlayed: "2026-05-02", status: "fail", vods: [] },
];

function exec(sql: string) {
  const d = createGamesTestDb();
  d.sqlite.exec(sql);
  return d;
}
function readRows(d: ReturnType<typeof createGamesTestDb>) {
  return {
    games: d.sqlite.prepare(`SELECT ${GAME_COLUMNS} FROM games`).all() as unknown as GameRow[],
    vods: d.sqlite.prepare(`SELECT ${VOD_COLUMNS} FROM game_vods`).all() as unknown as VodRow[],
  };
}

describe("buildSeedSql", () => {
  it("has a header, one statement per line, and ends with a newline", () => {
    const sql = buildSeedSql(tricky);
    const lines = sql.split("\n");
    expect(lines[0]).toBe("-- 생성: pnpm games:seed <input.json>. 직접 고치지 않는다. 원격 적용 후에는 다시 생성하지 않는다.");
    expect(sql.endsWith(";\n")).toBe(true);
    expect(lines.at(-1)).toBe("");
    const body = lines.slice(1, -1).filter((l) => l !== "");
    expect(body.every((l) => l.startsWith("INSERT OR IGNORE INTO ") && l.endsWith(");"))).toBe(true);
    // 3 games + 3 vods + 3 changes
    expect(body.filter((l) => l.startsWith("INSERT OR IGNORE INTO games ")).length).toBe(3);
    expect(body.filter((l) => l.startsWith("INSERT OR IGNORE INTO game_vods ")).length).toBe(3);
    expect(body.filter((l) => l.startsWith("INSERT OR IGNORE INTO game_changes ")).length).toBe(3);
  });
  it("is deterministic and independent of input order", () => {
    expect(buildSeedSql(tricky)).toBe(buildSeedSql(tricky));
    expect(buildSeedSql([...tricky].reverse())).toBe(buildSeedSql(tricky));
  });
  it("does not set timestamps", () => {
    expect(buildSeedSql(tricky)).not.toMatch(/created_at|updated_at/);
  });
  it("does not mutate its input", () => {
    const input = structuredClone(tricky);
    const copy = structuredClone(tricky);
    buildSeedSql(input);
    expect(input).toEqual(copy);
  });
  it("propagates validation failures", () => {
    expect(() => buildSeedSql("nope")).toThrow(GamesValidationError);
    expect(() => buildSeedSql([{ id: "x" }])).toThrow(GamesValidationError);
    expect(() => buildSeedSql([tricky[1], tricky[1]])).toThrow(GamesValidationError);
  });
  it("round-trips through D1 into exportGames === serializeGames(fixture)", () => {
    const d = exec(buildSeedSql(tricky));
    const { games, vods } = readRows(d);
    expect(games).toHaveLength(3);
    expect(exportGames(games, vods)).toBe(serializeGames(tricky));
    d.close();
  });
  it("stores the system actor, version 1, visible, and no channel ids", () => {
    const d = exec(buildSeedSql(tricky));
    const { games } = readRows(d);
    for (const g of games) {
      expect(g).toMatchObject({ hidden: 0, version: 1, updated_by_name: "시스템" });
    }
    const channels = d.sqlite.prepare("SELECT channel_id FROM game_changes").all() as Array<{ channel_id: string | null }>;
    expect(channels.every((c) => c.channel_id === null)).toBe(true);
    expect(d.sqlite.prepare("SELECT count(*) AS n FROM games WHERE updated_by_channel_id IS NOT NULL OR write_token IS NOT NULL").get()).toEqual({ n: 0 });
    d.close();
  });
  it("writes exactly one import change per game with a snapshot", () => {
    const d = exec(buildSeedSql(tricky));
    const rows = d.sqlite.prepare("SELECT id, game_id, actor_name, action, summary, before_json, after_json FROM game_changes ORDER BY game_id").all() as Array<Record<string, string | null>>;
    expect(rows.map((r) => r.game_id)).toEqual(["alpha", "beta", "gamma"]);
    for (const r of rows) {
      expect(r).toMatchObject({ id: `import-${r.game_id}`, actor_name: "시스템", action: "import", summary: SEED_SUMMARY, before_json: null });
    }
    const alpha = JSON.parse(rows[0].after_json as string);
    const [b, c, a] = tricky[0].vods;
    expect(alpha).toEqual({ ...tricky[0], hidden: false, vods: [c, a, b] });
    expect(Object.keys(alpha)).not.toContain("version");
    d.close();
  });
  it("keeps same-date vods in input order via position", () => {
    const d = exec(buildSeedSql(tricky));
    const rows = d.sqlite.prepare("SELECT video_id, date, position FROM game_vods WHERE game_id = 'alpha' ORDER BY position").all();
    expect(rows).toEqual([
      { video_id: "CCCCCCCCCCC", date: "2026-05-02", position: 0 },
      { video_id: "AAAAAAAAAAA", date: "2026-05-02", position: 1 },
      { video_id: "BBBBBBBBBBB", date: "2026-05-03", position: 2 },
    ]);
    d.close();
  });
  it("empty list yields header only and still applies", () => {
    const sql = buildSeedSql([]);
    expect(sql.split("\n").filter((l) => l.startsWith("INSERT"))).toEqual([]);
    exec(sql).close();
  });
  it("can be applied twice: no UNIQUE error, no duplicates, and later edits are not overwritten", () => {
    const sql = buildSeedSql(tricky);
    const d = exec(sql);
    // 적용 뒤 관리자가 이름을 고치고 다시보기 하나를 지웠다
    d.sqlite.exec("UPDATE games SET name = '고친 이름' WHERE id = 'alpha'; DELETE FROM game_vods WHERE game_id = 'alpha' AND video_id = 'AAAAAAAAAAA'");
    const before = readRows(d);
    d.sqlite.exec(sql);
    expect(readRows(d)).toEqual(before);
    expect(d.sqlite.prepare("SELECT count(*) AS n FROM game_changes").get()).toEqual({ n: 3 });
    d.close();
  });
  it("a retry after a partial apply fills in the rest", () => {
    const sql = buildSeedSql(tricky);
    const lines = sql.split("\n");
    const d = exec(lines.slice(0, 4).join("\n")); // 헤더 + 첫 게임의 앞부분만 적용된 상태
    d.sqlite.exec(sql);
    const full = exec(sql);
    expect(readRows(d)).toEqual(readRows(full));
    d.close();
    full.close();
  });
  it("never writes an admin channel id", () => {
    expect(buildSeedSql(tricky)).not.toContain(FAKE_ADMIN_ID);
  });
});

describe("exportGames", () => {
  const base = (id: string, name: string, hidden: 0 | 1): GameRow => ({
    id, name, original_title: null, category_id: null, poster_url: null, first_played: "2026-01-01",
    status: "unknown", hidden, version: 7, created_at: 1, updated_at: 2, updated_by_name: "관리자",
  });
  const vod = (game_id: string, video_id: string, date: string, position: number): VodRow => ({
    game_id, video_id, url: `https://www.youtube.com/watch?v=${video_id}`, title: `t-${video_id}`, date, position,
  });
  const games = [base("a", "에이", 0), base("b", "비", 1)];
  const vods = [vod("a", "AAAAAAAAAAA", "2026-01-02", 1), vod("a", "BBBBBBBBBBB", "2026-01-02", 0), vod("b", "CCCCCCCCCCC", "2026-01-01", 0)];

  it("exports visible games by default, sorted vods by date then position", () => {
    const out = JSON.parse(exportGames(games, vods)) as Game[];
    expect(out.map((g) => g.id)).toEqual(["a"]);
    expect(out[0].vods.map((v) => v.url.slice(-11))).toEqual(["BBBBBBBBBBB", "AAAAAAAAAAA"]);
  });
  it("exports hidden games with hidden: true", () => {
    expect((JSON.parse(exportGames(games, vods, { hidden: true })) as Game[]).map((g) => g.id)).toEqual(["b"]);
    expect((JSON.parse(exportGames(games, vods, {})) as Game[]).map((g) => g.id)).toEqual(["a"]);
    expect((JSON.parse(exportGames(games, vods, { hidden: false })) as Game[]).map((g) => g.id)).toEqual(["a"]);
  });
  it("contains no admin metadata", () => {
    const text = exportGames(games, vods) + exportGames(games, vods, { hidden: true });
    for (const k of ["updatedBy", "updated_by", "version", "hidden", "channel", "관리자", "write_token", "createdAt"]) {
      expect(text).not.toContain(k);
    }
  });
  it("does not mutate its inputs", () => {
    const g = structuredClone(games);
    const v = structuredClone(vods);
    exportGames(g, v);
    expect(g).toEqual(games);
    expect(v).toEqual(vods);
  });
  it("empty inputs give an empty list", () => {
    expect(exportGames([], [])).toBe(serializeGames([]));
  });
  it("throws if rows violate the schema", () => {
    expect(() => exportGames([base("", "x", 0)], [])).toThrow(GamesValidationError);
  });
});
