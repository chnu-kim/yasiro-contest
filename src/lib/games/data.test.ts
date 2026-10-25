import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseGames, serializeGames } from "./schema.ts";

const PATH = new URL("../../data/games.json", import.meta.url);
const text = readFileSync(PATH, "utf8");

// 게임이 아닌 방송 카테고리 키워드. 정규화 후 부분 포함으로 본다("저스트 채팅 방송"도 걸린다).
// 맨 "chat"·"같이"·"룰렛"은 넣지 않는다 — "Chateau", "같이 하는 ○○", "벅샷 룰렛" 같은 실제 게임 이름까지 걸린다.
const NOT_GAME_KEYWORDS = ["저챗", "저스트채팅", "justchatting", "채팅", "종겜", "점심룰렛", "갈틱폰", "garticphone", "같이보기", "watchparty"];
const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
function nonGameHits(names: readonly string[]): string[] {
  return names.filter((n) => NOT_GAME_KEYWORDS.some((k) => norm(n).includes(k)));
}

describe("src/data/games.json", () => {
  it("is valid JSON", () => {
    expect(() => JSON.parse(text)).not.toThrow();
  });
  it("passes schema validation (empty array allowed)", () => {
    expect(() => parseGames(JSON.parse(text))).not.toThrow();
  });
  it("is byte-identical to its canonical serialization", () => {
    expect(text).toBe(serializeGames(parseGames(JSON.parse(text))));
  });
  it("has unique ids and categoryIds", () => {
    const games = parseGames(JSON.parse(text));
    expect(new Set(games.map((g) => g.id)).size).toBe(games.length);
    const cats = games.flatMap((g) => (g.categoryId ? [g.categoryId] : []));
    expect(new Set(cats).size).toBe(cats.length);
  });
  it("non-game keyword check catches variants and spares real game names", () => {
    expect(nonGameHits(["저스트 채팅 방송", "Just Chatting", "종겜 룰렛", "갈틱폰", "Gartic Phone", "같이 보기", "Watch Party", "저챗", "점심 룰렛", "종겜룰렛데이"])).toHaveLength(10);
    expect(nonGameHits(["Chateau", "같이 하는 요리", "스텔라 블레이드", "Spelunky 2", "벅샷 룰렛", "Buckshot_Roulette"])).toEqual([]);
  });
  it("contains no non-game entries (name, originalTitle, categoryId)", () => {
    const names = parseGames(JSON.parse(text)).flatMap((g) => [g.name, g.originalTitle ?? "", g.categoryId ?? ""]);
    expect(nonGameHits(names)).toEqual([]);
  });
  it("has no chzzk links anywhere", () => {
    expect(text).not.toMatch(/chzzk\.naver\.com/i);
  });
});
