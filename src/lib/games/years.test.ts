import { describe, expect, it } from "vitest";
import { DEFAULT_QUERY_STATE, indexWithHidden, selectPage } from "./query.ts";
import { yearGroups } from "./years.ts";
import type { Game, GamesQueryState, GameStatus } from "./types.ts";

function g(id: string, firstPlayed: string | null, status: GameStatus): Game {
  return { id, name: id, firstPlayed, status, vods: [] };
}

const games: Game[] = [
  g("a26", "2026-10-21", "clear"),
  g("b26", "2026-03-02", "fail"),
  g("c25", "2025-12-30", "clear"),
  g("d25", "2025-08-01", "clear"),
  g("e25", "2025-02-11", "unknown"),
  g("f24", "2024-06-06", "endless"),
  g("n1", null, "clear"),
  g("n2", null, "unknown"),
];

const st = (patch: Partial<GamesQueryState>): GamesQueryState => ({ ...DEFAULT_QUERY_STATE, ...patch });

function run(state: GamesQueryState, pageSize?: number, source: readonly Game[] = games) {
  const page = selectPage(source.map((x, i) => ({ ...x, ordinal: i + 1, no: String(i + 1) })), state, pageSize);
  return yearGroups(source, state, page.items);
}

describe("yearGroups", () => {
  it("이름순이면 나누지 않는다", () => {
    expect(run(st({ sort: "name" }))).toBeNull();
  });

  it("최신순: 연도 내림차순, 날짜 없는 게임은 맨 뒤 한 묶음", () => {
    const groups = run(st({}))!;
    expect(groups.map((x) => x.key)).toEqual(["2026", "2025", "2024", "none"]);
    expect(groups.map((x) => x.items.map((i) => i.id))).toEqual([
      ["a26", "b26"],
      ["c25", "d25", "e25"],
      ["f24"],
      ["n1", "n2"],
    ]);
    expect(groups[0]).toMatchObject({ kind: "year", heading: "2026", count: 2, clear: 1, countText: "2개 · 정복 1" });
    expect(groups[3]).toMatchObject({ kind: "none", heading: "날짜 기록 없음", count: 2, clear: 1 });
  });

  it("오래된순: 연도 오름차순, 날짜 없는 게임은 여전히 맨 뒤", () => {
    const groups = run(st({ sort: "old" }))!;
    expect(groups.map((x) => x.key)).toEqual(["2024", "2025", "2026", "none"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["e25", "d25", "c25"]);
  });

  it("정복 0인 연도도 0으로 적는다", () => {
    const groups = run(st({}))!;
    expect(groups[2].countText).toBe("1개 · 정복 0");
  });

  it("개수는 현재 페이지가 아니라 필터 결과 전체로 센다(2페이지도 연도로 시작)", () => {
    // pageSize 3: 1쪽 a26 b26 c25, 2쪽 d25 e25 f24
    const p1 = run(st({}), 3)!;
    expect(p1.map((x) => [x.key, x.items.length, x.count])).toEqual([
      ["2026", 2, 2],
      ["2025", 1, 3],
    ]);
    const p2 = run(st({ page: 2 }), 3)!;
    expect(p2.map((x) => [x.key, x.items.length, x.count])).toEqual([
      ["2025", 2, 3],
      ["2024", 1, 1],
    ]);
    expect(p2[0].countText).toBe("3개 · 정복 2");
  });

  it("검색·연도 필터를 반영해 센다", () => {
    const groups = run(st({ year: "2025" }))!;
    expect(groups.map((x) => [x.key, x.count])).toEqual([["2025", 3]]);
    expect(run(st({ q: "n" }))!.map((x) => [x.key, x.count])).toEqual([["none", 2]]);
  });

  it("상태 필터가 걸리면 정복 수를 적지 않는다(전부 정복이거나 0이라 뜻이 없다)", () => {
    const clear = run(st({ status: "clear" }))!;
    expect(clear.map((x) => [x.key, x.countText])).toEqual([
      ["2026", "1개"],
      ["2025", "2개"],
      ["none", "1개"],
    ]);
    expect(run(st({ status: "fail" }))![0].countText).toBe("1개");
  });

  it("결과가 없으면 빈 배열", () => {
    expect(run(st({ q: "없는게임" }))).toEqual([]);
  });

  it("관리자 숨김 보기: 숨긴 게임도 넘겨받은 목록 그대로 그 연도에 센다", () => {
    const withHidden = indexWithHidden([
      ...games.map((x) => ({ ...x, hidden: false })),
      { ...g("h25", "2025-05-05", "clear"), hidden: true },
    ]);
    const page = selectPage(withHidden, st({}));
    const groups = yearGroups(withHidden, st({}), page.items)!;
    const y25 = groups.find((x) => x.key === "2025")!;
    expect(y25.count).toBe(4);
    expect(y25.clear).toBe(3);
    expect(y25.items.map((i) => i.id)).toContain("h25");
    expect(y25.items.find((i) => i.id === "h25")!.no).toBe("—");
  });
});
