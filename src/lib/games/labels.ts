import { formatDate } from "./query.ts";
import type {
  GamesQueryState,
  GameStatus,
  Page,
  SortKey,
  StatusFilter,
  Vod,
  YearFilter,
} from "./types.ts";

export const STATUS_FILTER_LABEL: Readonly<Record<StatusFilter, string>> = {
  all: "전체",
  clear: "정복",
  fail: "정복 못함",
  unknown: "모름",
};

/** 상세 모달의 정복 여부 문구. unknown은 "모름"이 아니라 "기록 없음" */
export const STATUS_TEXT: Readonly<Record<GameStatus, string>> = {
  clear: "정복",
  fail: "정복 못함",
  unknown: "기록 없음",
};

export const SORT_LABEL: Readonly<Record<SortKey, string>> = {
  recent: "첫 플레이 최신순",
  old: "첫 플레이 오래된순",
  name: "이름순",
};

export function yearLabel(year: YearFilter): string {
  if (year === "all") return "전체";
  if (year === "none") return "날짜 기록 없음";
  return year;
}

/** 검색어·정복 여부·연도 중 하나라도 걸려 있는가 ("검색·필터 초기화" 노출 기준) */
export function hasActiveFilter(state: GamesQueryState): boolean {
  return state.q !== "" || hasFilterSelection(state);
}

/** 정복 여부·연도 선택이 걸려 있는가 ("필터 해제" 노출 기준) */
export function hasFilterSelection(state: GamesQueryState): boolean {
  return state.status !== "all" || state.year !== "all";
}

export function describeConditions(state: GamesQueryState): string {
  const parts: string[] = [];
  if (state.q !== "") parts.push(`검색어 "${state.q}"`);
  if (state.status !== "all") parts.push(`정복 여부 ${STATUS_FILTER_LABEL[state.status]}`);
  if (state.year !== "all") parts.push(`연도 ${yearLabel(state.year)}`);
  return parts.length === 0 ? "" : `적용된 조건: ${parts.join(", ")}`;
}

export function resultSummary(page: Page<unknown>): string {
  if (page.total === 0) return "일치하는 게임 0개";
  return `${page.total}개 중 ${page.start + 1}–${page.end}번째`;
}

export function vodAriaLabel(vod: Vod): string {
  return `${vod.title}, YouTube ${formatDate(vod.date)} (새 탭에서 열림)`;
}
