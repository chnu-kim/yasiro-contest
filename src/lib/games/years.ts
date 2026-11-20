// /games 목록의 연도 구분선. 날짜로 정렬할 때(recent·old)만 현재 페이지 카드를 첫 플레이 연도별로 묶는다.
import { filterGames } from "./query.ts";
import type { Game, GamesQueryState } from "./types.ts";

export interface YearGroup<T> {
  /** React key. "2025" 또는 "none"(날짜 기록 없음) */
  key: string;
  /** year는 Fredoka 숫자, none은 한글 문구(Fredoka에 한글 글리프가 없다) */
  kind: "year" | "none";
  /** 보이는 제목. "2025" 또는 "날짜 기록 없음" */
  heading: string;
  /** 필터 결과 전체에서 이 연도의 게임 수(현재 페이지만이 아님) */
  count: number;
  /** 그중 정복 수 */
  clear: number;
  /** "24개 · 정복 18". 상태 필터가 걸려 있으면 정복 수는 뜻이 없어 "24개"만 */
  countText: string;
  /** 현재 페이지에서 이 연도에 속한 카드(입력 순서 유지) */
  items: T[];
}

const yearKey = (game: Game): string => game.firstPlayed?.slice(0, 4) ?? "none";

/**
 * 현재 페이지(pageItems)를 연도별로 묶는다. 이름순이면 null(구분선 없음).
 * 개수는 source에 state 필터를 적용한 결과 전체로 센다. source는 보드가 페이지를 나누는 목록 그대로를 넘긴다:
 * 방문자는 숨긴 게임이 빠진 목록, 관리자가 "숨긴 게임 보기"를 켰을 때는 숨긴 게임이 포함된 목록이라
 * 그때는 숨긴 게임도 그 연도 개수에 들어간다(카드로 보이는 것과 개수가 맞는다).
 * recent·old 모두 날짜 없는 게임이 맨 뒤라, 연속 구간으로 묶으면 연도당 한 묶음이 된다.
 */
export function yearGroups<T extends Game>(
  source: readonly Game[],
  state: GamesQueryState,
  pageItems: readonly T[],
): YearGroup<T>[] | null {
  if (state.sort === "name") return null;

  const totals = new Map<string, { count: number; clear: number }>();
  for (const game of filterGames(source, state)) {
    const key = yearKey(game);
    const t = totals.get(key) ?? { count: 0, clear: 0 };
    t.count += 1;
    if (game.status === "clear") t.clear += 1;
    totals.set(key, t);
  }

  const groups: YearGroup<T>[] = [];
  for (const item of pageItems) {
    const key = yearKey(item);
    const last = groups.at(-1);
    if (last?.key === key) {
      last.items.push(item);
      continue;
    }
    // pageItems는 같은 필터 결과의 한 페이지라 totals에 항상 있다
    const { count, clear } = totals.get(key) as { count: number; clear: number };
    groups.push({
      key,
      kind: key === "none" ? "none" : "year",
      heading: key === "none" ? "날짜 기록 없음" : key,
      count,
      clear,
      countText: state.status === "all" ? `${count}개 · 정복 ${clear}` : `${count}개`,
      items: [item],
    });
  }
  return groups;
}
