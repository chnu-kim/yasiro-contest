import { describe, expect, it } from "vitest";
import {
  describeConditions,
  hasActiveFilter,
  hasFilterSelection,
  resultSummary,
  SORT_LABEL,
  STATUS_FILTER_LABEL,
  STATUS_TEXT,
  vodAriaLabel,
  yearLabel,
} from "./labels.ts";
import { DEFAULT_QUERY_STATE } from "./query.ts";
import type { GamesQueryState, Page } from "./types.ts";

const state = (patch: Partial<GamesQueryState> = {}): GamesQueryState => ({
  ...DEFAULT_QUERY_STATE,
  ...patch,
});

describe("라벨 상수", () => {
  it("정복 여부 필터 라벨", () => {
    expect(STATUS_FILTER_LABEL).toEqual({
      all: "전체",
      clear: "정복",
      fail: "정복 못함",
      unknown: "모름",
    });
  });
  it("상세의 정복 여부 문구: unknown은 기록 없음", () => {
    expect(STATUS_TEXT).toEqual({ clear: "정복", fail: "정복 못함", unknown: "기록 없음" });
  });
  it("정렬 라벨", () => {
    expect(SORT_LABEL).toEqual({
      recent: "첫 플레이 최신순",
      old: "첫 플레이 오래된순",
      name: "이름순",
    });
  });
});

describe("yearLabel", () => {
  it("all / none / 연도", () => {
    expect(yearLabel("all")).toBe("전체");
    expect(yearLabel("none")).toBe("날짜 기록 없음");
    expect(yearLabel("2025")).toBe("2025");
  });
});

describe("hasActiveFilter / hasFilterSelection", () => {
  it("기본 상태는 둘 다 false", () => {
    expect(hasActiveFilter(state())).toBe(false);
    expect(hasFilterSelection(state())).toBe(false);
  });
  it("검색어만 있으면 active, 필터 선택은 아님", () => {
    expect(hasActiveFilter(state({ q: "컵" }))).toBe(true);
    expect(hasFilterSelection(state({ q: "컵" }))).toBe(false);
  });
  it("status 또는 year가 기본이 아니면 둘 다 true", () => {
    expect(hasActiveFilter(state({ status: "fail" }))).toBe(true);
    expect(hasFilterSelection(state({ status: "fail" }))).toBe(true);
    expect(hasActiveFilter(state({ year: "none" }))).toBe(true);
    expect(hasFilterSelection(state({ year: "2025" }))).toBe(true);
  });
  it("정렬과 페이지는 영향 없음", () => {
    expect(hasActiveFilter(state({ sort: "name", page: 3 }))).toBe(false);
    expect(hasFilterSelection(state({ sort: "name", page: 3 }))).toBe(false);
  });
});

describe("describeConditions", () => {
  it("조건이 없으면 빈 문자열", () => {
    expect(describeConditions(state())).toBe("");
  });
  it("모든 조건을 순서대로 나열한다", () => {
    expect(describeConditions(state({ q: "컵", status: "fail", year: "2025" }))).toBe(
      '적용된 조건: 검색어 "컵", 정복 여부 정복 못함, 연도 2025',
    );
  });
  it("year none은 날짜 기록 없음", () => {
    expect(describeConditions(state({ year: "none" }))).toBe("적용된 조건: 연도 날짜 기록 없음");
  });
  it("status만", () => {
    expect(describeConditions(state({ status: "unknown" }))).toBe("적용된 조건: 정복 여부 모름");
  });
});

describe("resultSummary", () => {
  const page = (total: number, start: number, end: number): Page<unknown> => ({
    items: [],
    page: 1,
    pageCount: 1,
    total,
    start,
    end,
  });
  it("범위 문구", () => {
    expect(resultSummary(page(30, 0, 24))).toBe("30개 중 1–24번째");
    expect(resultSummary(page(30, 24, 30))).toBe("30개 중 25–30번째");
    expect(resultSummary(page(1, 0, 1))).toBe("1개 중 1–1번째");
  });
  it("0건", () => {
    expect(resultSummary(page(0, 0, 0))).toBe("일치하는 게임 0개");
  });
});

describe("vodAriaLabel", () => {
  it("제목, 날짜, 새 탭 안내", () => {
    expect(vodAriaLabel({ title: "컵헤드 했어요", url: "x", date: "2025-08-01" })).toBe(
      "컵헤드 했어요, YouTube 2025.08.01 (새 탭에서 열림)",
    );
  });
});
