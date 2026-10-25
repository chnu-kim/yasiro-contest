import { compareCanonical, compareName, GAME_STATUSES, ID_PATTERN } from "./schema.ts";
import type {
  IndexedGame,
  Game,
  GamesQueryState,
  GameStats,
  QueryInput,
  SortKey,
  StatusFilter,
  YearFilter,
  YearOptions,
  Page,
} from "./types.ts";

export const PAGE_SIZE = 24;
export const Q_MAX = 100;
export const DEFAULT_QUERY_STATE: Readonly<GamesQueryState> = Object.freeze({
  q: "",
  status: "all",
  year: "all",
  sort: "recent",
  page: 1,
});

export function normalize(s: string): string {
  return s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

const CHOSEONG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

export function toInitials(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code >= 0xac00 && code <= 0xd7a3) {
      out += CHOSEONG[Math.floor((code - 0xac00) / 588)];
    } else {
      out += ch;
    }
  }
  return out;
}

export function matchesQuery(
  game: Pick<Game, "name" | "originalTitle">,
  query: string,
): boolean {
  const nq = normalize(query);
  if (nq === "") return true;
  for (const target of [game.name, game.originalTitle]) {
    if (target === undefined) continue;
    const h = normalize(target);
    if (h === "") continue;
    if (h.includes(nq) || toInitials(h).includes(nq)) return true;
  }
  return false;
}

export function filterGames<T extends Game>(
  games: readonly T[],
  state: Pick<GamesQueryState, "q" | "status" | "year">,
): T[] {
  return games.filter((game) => {
    if (state.status !== "all" && game.status !== state.status) return false;
    if (state.year === "none") {
      if (game.firstPlayed !== null) return false;
    } else if (state.year !== "all") {
      if (game.firstPlayed?.slice(0, 4) !== state.year) return false;
    }
    return matchesQuery(game, state.q);
  });
}

export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize: number = PAGE_SIZE,
): Page<T> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError(`pageSize must be a positive integer: ${pageSize}`);
  }
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  let current = Number.isInteger(page) && page >= 1 ? page : 1;
  if (current > pageCount) current = pageCount;
  const start = total === 0 ? 0 : (current - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  return { items: items.slice(start, end), page: current, pageCount, total, start, end };
}

/** 번호 페이지네이션에 그릴 항목. 7쪽 이하면 전부, 넘으면 항상 7칸(양끝 + 현재 주변 + "gap") */
export function pageWindow(current: number, pageCount: number): Array<number | "gap"> {
  const count = Number.isInteger(pageCount) && pageCount >= 1 ? pageCount : 1;
  const cur = Number.isInteger(current) ? Math.min(Math.max(current, 1), count) : 1;
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  if (cur <= 4) return [1, 2, 3, 4, 5, "gap", count];
  if (cur >= count - 3) return [1, "gap", count - 4, count - 3, count - 2, count - 1, count];
  return [1, "gap", cur - 1, cur, cur + 1, "gap", count];
}

/** UI 노출 순서 그대로 */
export const STATUS_FILTERS: readonly StatusFilter[] = ["all", ...GAME_STATUSES];
export const SORT_KEYS: readonly SortKey[] = ["recent", "old", "name"];

type Year = `${number}`;
const isYear = (s: string): s is Year => /^\d{4}$/.test(s);

function pick(input: QueryInput, key: string): string | undefined {
  if (input instanceof URLSearchParams) return input.get(key) ?? undefined;
  const v = input[key];
  return Array.isArray(v) ? v[0] : v;
}

/** 검색어 정규화: trim → Q_MAX(UTF-16 단위, input maxLength와 같은 기준)로 자름 → 끊긴 서로게이트·끝 공백 제거. 멱등 */
export function normalizeQ(raw: string): string {
  let t = raw.trim().slice(0, Q_MAX);
  if (/[\uD800-\uDBFF]$/.test(t)) t = t.slice(0, -1);
  return t.trimEnd();
}

/** "all" | "none" | "YYYY". 나머지는 "all" */
export function parseYearFilter(v: string | undefined): YearFilter {
  if (v === "none") return "none";
  return v !== undefined && isYear(v) ? v : "all";
}

/** "recent" | "old" | "name". 나머지는 "recent" */
export function parseSortKey(v: string | undefined): SortKey {
  return SORT_KEYS.find((k) => k === v) ?? "recent";
}

export function parseQueryState(input: QueryInput): GamesQueryState {
  const status = pick(input, "status");
  const page = pick(input, "page");
  return {
    q: normalizeQ(pick(input, "q") ?? ""),
    status: STATUS_FILTERS.find((v) => v === status) ?? "all",
    year: parseYearFilter(pick(input, "year")),
    sort: parseSortKey(pick(input, "sort")),
    page: page !== undefined && /^[1-9]\d{0,5}$/.test(page) ? Number(page) : 1,
  };
}

/** 연도 select 옵션: all, 연도 내림차순, none(날짜 없는 게임이 있을 때).
 *  URL로 들어온, 데이터에 없는 현재 값도 select가 보여 줄 수 있게 제자리에 끼운다. */
export function yearFilterOptions(options: YearOptions, current: YearFilter): YearFilter[] {
  const years: Year[] = [...options.years];
  if (current !== "all" && current !== "none" && !years.includes(current)) {
    years.push(current);
    years.sort().reverse();
  }
  const out: YearFilter[] = ["all", ...years];
  if (options.hasUndated || current === "none") out.push("none");
  return out;
}

export function serializeQueryState(state: GamesQueryState): string {
  const params = new URLSearchParams();
  const q = state.q.trim();
  if (q !== "") params.set("q", q);
  if (state.status !== DEFAULT_QUERY_STATE.status) params.set("status", state.status);
  if (state.year !== DEFAULT_QUERY_STATE.year) params.set("year", state.year);
  if (state.sort !== DEFAULT_QUERY_STATE.sort) params.set("sort", state.sort);
  if (state.page !== DEFAULT_QUERY_STATE.page) params.set("page", String(state.page));
  return params.toString();
}

/** 상세로 열린 게임 ID(`game` 파라미터). 형식이 틀리면 null */
export function parseDetailId(input: QueryInput): string | null {
  const id = pick(input, "game");
  return id !== undefined && ID_PATTERN.test(id) ? id : null;
}

/** 목록 상태 + 상세 게임 ID의 쿼리 문자열. id가 null이면 목록 상태만 */
export function detailQuery(state: GamesQueryState, id: string | null): string {
  const params = new URLSearchParams(serializeQueryState(state));
  if (id !== null) params.set("game", id);
  return params.toString();
}

export function applyFilterChange(
  state: GamesQueryState,
  patch: Partial<GamesQueryState>,
): GamesQueryState {
  return { ...state, page: 1, ...patch };
}

export function countStats(games: readonly Game[]): GameStats {
  const stats: GameStats = { total: games.length, clear: 0, fail: 0, endless: 0, unknown: 0, undated: 0 };
  for (const game of games) {
    stats[game.status] += 1;
    if (game.firstPlayed === null) stats.undated += 1;
  }
  return stats;
}

export function availableYears(games: readonly Game[]): YearOptions {
  const years = new Set<Year>();
  let hasUndated = false;
  for (const game of games) {
    if (game.firstPlayed === null) hasUndated = true;
    else {
      const y = game.firstPlayed.slice(0, 4);
      if (isYear(y)) years.add(y);
    }
  }
  return { years: [...years].sort().reverse(), hasUndated };
}

export function formatDate(iso: string | null): string {
  return iso === null ? "날짜 기록 없음" : iso.replaceAll("-", ".");
}

function compareOld(a: Game, b: Game): number {
  if (a.firstPlayed === b.firstPlayed) return compareName(a, b);
  if (a.firstPlayed === null) return 1;
  if (b.firstPlayed === null) return -1;
  return a.firstPlayed < b.firstPlayed ? -1 : 1;
}

export function sortGames<T extends Game>(games: readonly T[], sort: SortKey): T[] {
  const compare =
    sort === "recent" ? compareCanonical : sort === "old" ? compareOld : compareName;
  return [...games].sort(compare);
}

export function indexGames(games: readonly Game[]): IndexedGame[] {
  const sorted = sortGames(games, "recent");
  return sorted.map((game, i) => {
    const ordinal = sorted.length - i;
    return { ...game, ordinal, no: String(ordinal).padStart(3, "0") };
  });
}

export function selectPage<T extends IndexedGame>(
  indexed: readonly T[],
  state: GamesQueryState,
  pageSize?: number,
): Page<T> {
  return paginate(sortGames(filterGames(indexed, state), state.sort), state.page, pageSize);
}

/** 숨기지 않은 게임만 indexGames 규칙으로 번호를 매기고, 숨긴 게임은 ordinal 0·no "—"로 붙인다. 입력 순서는 상관없음 */
export function indexWithHidden<T extends Game & { hidden: boolean }>(games: readonly T[]): Array<T & IndexedGame> {
  const numbered = new Map<string, IndexedGame>(indexGames(games.filter((g) => !g.hidden)).map((g) => [g.id, g]));
  return games.map((g) => {
    const n = numbered.get(g.id);
    return { ...g, ordinal: n?.ordinal ?? 0, no: n?.no ?? "—" };
  });
}
