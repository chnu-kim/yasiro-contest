// 실제 마이그레이션(0007 + 0008)을 D1 대역에 올려 시드 데이터를 검증한다. data.test.ts를 대체하는 영구 테스트.
import { createHash } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { GAME_COLUMNS, VOD_COLUMNS } from "./rows.ts";
import { exportGames, SEED_SUMMARY } from "./seed.ts";
import { parseGames, serializeGames } from "./schema.ts";
import { createGamesTestDb } from "./test-d1.ts";
import type { GameRow, VodRow } from "./types.ts";

const d = createGamesTestDb(["0008_games_seed.sql"]);
afterAll(() => d.close());

const gameRows = d.sqlite.prepare(`SELECT ${GAME_COLUMNS} FROM games`).all() as unknown as GameRow[];
const vodRows = d.sqlite.prepare(`SELECT ${VOD_COLUMNS} FROM game_vods`).all() as unknown as VodRow[];
const text = exportGames(gameRows, vodRows);

// 게임이 아닌 방송 카테고리 키워드. 정규화 후 부분 포함으로 본다("저스트 채팅 방송"도 걸린다).
// 맨 "chat"·"같이"·"룰렛"은 넣지 않는다 — "Chateau", "같이 하는 ○○", "벅샷 룰렛" 같은 실제 게임 이름까지 걸린다.
const NOT_GAME_KEYWORDS = ["저챗", "저스트채팅", "justchatting", "채팅", "종겜", "점심룰렛", "갈틱폰", "garticphone", "같이보기", "watchparty"];
const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
function nonGameHits(names: readonly string[]): string[] {
  return names.filter((n) => NOT_GAME_KEYWORDS.some((k) => norm(n).includes(k)));
}

// 이전 정본 src/data/games.json(15cf614)의 sha256. export 결과가 그 파일과 바이트 단위로 같아야 한다.
// 0008은 INSERT OR IGNORE라 CHECK 위반 행도 조용히 빠지므로, 개수만이 아니라 내용 전체를 고정한다.
const GAMES_JSON_SHA256 = "f3562c598752f09e94feafedd0c6be5e115774d30b8ee7f16ecce69c9a28434a";

describe("migrations 0007 + 0008", () => {
  it("seeds 338 games and 306 vods", () => {
    expect(gameRows).toHaveLength(338);
    expect(vodRows).toHaveLength(306);
  });
  it("exports byte-for-byte the former src/data/games.json", () => {
    expect(createHash("sha256").update(text).digest("hex")).toBe(GAMES_JSON_SHA256);
  });
  it("exports a valid, canonical list", () => {
    const games = parseGames(JSON.parse(text));
    expect(games).toHaveLength(338);
    expect(text).toBe(serializeGames(games));
  });
  it("has unique ids and categoryIds", () => {
    const games = parseGames(JSON.parse(text));
    expect(new Set(games.map((g) => g.id)).size).toBe(games.length);
    const cats = games.flatMap((g) => (g.categoryId ? [g.categoryId] : []));
    expect(new Set(cats).size).toBe(cats.length);
  });
  it("has every game visible, version 1, written by the system", () => {
    expect(gameRows.every((g) => g.hidden === 0 && g.version === 1 && g.updated_by_name === "시스템")).toBe(true);
    expect(d.sqlite.prepare("SELECT count(*) AS n FROM games WHERE updated_by_channel_id IS NOT NULL OR write_token IS NOT NULL").get()).toEqual({ n: 0 });
  });
  it("has exactly one import record per game, anonymous", () => {
    const rows = d.sqlite.prepare("SELECT game_id, channel_id, actor_name, action, summary, before_json FROM game_changes").all() as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(338);
    expect(new Set(rows.map((r) => r.game_id)).size).toBe(338);
    expect(rows.every((r) => r.channel_id === null && r.actor_name === "시스템" && r.action === "import" && r.summary === SEED_SUMMARY && r.before_json === null)).toBe(true);
  });
  it("every vod is a youtube link whose video_id matches", () => {
    expect(vodRows.length).toBeGreaterThan(0);
    for (const v of vodRows) expect(v.url).toContain(v.video_id);
  });
  it("has no chzzk links anywhere in the database", () => {
    for (const t of ["games", "game_vods", "game_changes"]) {
      const rows = JSON.stringify(d.sqlite.prepare(`SELECT * FROM ${t}`).all());
      expect(rows).not.toMatch(/chzzk\.naver\.com/i);
    }
  });
  it("non-game keyword check catches variants and spares real game names", () => {
    expect(nonGameHits(["저스트 채팅 방송", "Just Chatting", "종겜 룰렛", "갈틱폰", "Gartic Phone", "같이 보기", "Watch Party", "저챗", "점심 룰렛", "종겜룰렛데이"])).toHaveLength(10);
    expect(nonGameHits(["Chateau", "같이 하는 요리", "스텔라 블레이드", "Spelunky 2", "벅샷 룰렛", "Buckshot_Roulette"])).toEqual([]);
  });
  it("contains no non-game entries (name, originalTitle, categoryId)", () => {
    const names = parseGames(JSON.parse(text)).flatMap((g) => [g.name, g.originalTitle ?? "", g.categoryId ?? ""]);
    expect(nonGameHits(names)).toEqual([]);
  });
});
