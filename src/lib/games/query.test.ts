import { describe, expect, it } from "vitest";
import {
  applyFilterChange,
  availableYears,
  countStats,
  detailQuery,
  DEFAULT_QUERY_STATE,
  filterGames,
  formatDate,
  indexGames,
  indexWithHidden,
  selectPage,
  sortGames,
  paginate,
  pageWindow,
  parseDetailId,
  parseQueryState,
  serializeQueryState,
  matchesQuery,
  normalize,
  normalizeQ,
  parseSortKey,
  parseYearFilter,
  Q_MAX,
  SORT_KEYS,
  STATUS_FILTERS,
  toInitials,
  yearFilterOptions,
} from "./query.ts";
import type { Game, GamesQueryState, GameStatus } from "./types.ts";

function g(
  id: string,
  name: string,
  firstPlayed: string | null,
  status: GameStatus,
  originalTitle?: string,
): Game {
  return {
    id,
    name,
    ...(originalTitle ? { originalTitle } : {}),
    firstPlayed,
    status,
    vods: [],
  };
}

// 디자인 데이터 일부 (입력 순서는 의도적으로 섞음)
const fixture: Game[] = [
  g("sb", "스텔라 블레이드", "2026-10-21", "unknown", "Stellar Blade"),
  g("ring", "링 피트 어드벤처", null, "unknown"),
  g("pp", "패들 패들 패들", "2025-10-08", "fail", "paddle paddle paddle"),
  g("po", "파멸의 오타쿠", "2026-10-23", "unknown"),
  g("bear", "곰아저씨 레스토랑", "2025-10-02", "clear", "Bear's Restaurant"),
  g("sixty", "60 Parsecs!", null, "unknown"),
  g("gal", "걸☆건 2", "2025-09-27", "clear", "Gal*Gun 2"),
  g("sh", "사일런트 힐 f", "2025-09-23", "clear", "SILENT HILL f"),
  g("ting", "There Is No Game: Wrong Dimension", "2025-07-31", "clear"),
];
const ids = (xs: readonly Game[]) => xs.map((x) => x.id);


const stellar = { name: "스텔라 블레이드", originalTitle: "Stellar Blade" };
const bear = { name: "곰아저씨 레스토랑", originalTitle: "Bear's Restaurant" };
const galgun = { name: "걸☆건 2", originalTitle: "Gal*Gun 2" };

describe("normalize", () => {
  it("기호·공백을 제거하고 소문자로 만든다", () => {
    expect(normalize("Gal*Gun 2")).toBe("galgun2");
    expect(normalize("걸☆건 2")).toBe("걸건2");
    expect(normalize("No, I'm not a Human")).toBe("noimnotahuman");
  });
});

describe("toInitials", () => {
  it("음절을 초성으로 바꾸고 나머지는 유지한다", () => {
    expect(toInitials("스텔라블레이드")).toBe("ㅅㅌㄹㅂㄹㅇㄷ");
    expect(toInitials("ab가")).toBe("abㄱ");
  });
  it("음절 범위 경계: U+AC00(가)·U+D7A3(힣)은 변환, 바로 바깥 U+ABFF·U+D7A4는 그대로", () => {
    expect(toInitials("\uAC00")).toBe("ㄱ");
    expect(toInitials("\uD7A3")).toBe("ㅎ");
    expect(toInitials("\uABFF")).toBe("\uABFF");
    expect(toInitials("\uD7A4")).toBe("\uD7A4");
    expect(toInitials("\uABFF가\uD7A4힣")).toBe("\uABFFㄱ\uD7A4ㅎ");
  });
  it("각 초성 블록의 첫·끝 음절이 같은 초성으로 간다 (588자 단위)", () => {
    expect(toInitials(String.fromCodePoint(0xac00 + 587))).toBe("ㄱ");
    expect(toInitials(String.fromCodePoint(0xac00 + 588))).toBe("ㄲ");
    expect(toInitials(String.fromCodePoint(0xd7a3 - 587))).toBe("ㅎ");
    expect(toInitials(String.fromCodePoint(0xd7a3 - 588))).toBe("ㅍ");
  });
});

describe("normalize 엣지", () => {
  it("NFD 입력을 NFC로 합친다", () => {
    expect(normalize("스텔라".normalize("NFD"))).toBe("스텔라");
  });
  it("이모지와 공백은 제거하고 가나·악센트는 남긴다", () => {
    expect(normalize("🎮 스텔라")).toBe("스텔라");
    expect(normalize("ゼルダの伝説")).toBe("ゼルダの伝説");
    expect(normalize("Pokémon")).toBe("pokémon");
  });
  it("호환 자모는 NFKC 변환 없이 유지된다", () => {
    expect(normalize("ㄱ")).toBe("ㄱ");
  });
  it("기호뿐이면 빈 문자열", () => {
    expect(normalize("☆*!")).toBe("");
  });
});

describe("matchesQuery", () => {
  it("이름 전체·부분 문자열로 찾는다", () => {
    expect(matchesQuery(stellar, "스텔라")).toBe(true);
    expect(matchesQuery(stellar, "블레")).toBe(true);
  });
  it("원제로 찾고 대소문자를 무시한다", () => {
    expect(matchesQuery(stellar, "stellar")).toBe(true);
    expect(matchesQuery(stellar, "STELLAR BLADE")).toBe(true);
  });
  it("초성으로 찾는다", () => {
    expect(matchesQuery(stellar, "ㅅㅌㄹ")).toBe(true);
    expect(matchesQuery(bear, "ㄱㅇㅈㅆ")).toBe(true);
  });
  it("공백·기호를 무시한다", () => {
    for (const q of ["걸건", "걸 건", "gal gun", "galgun2"]) {
      expect(matchesQuery(galgun, q)).toBe(true);
    }
    expect(matchesQuery(bear, "bears")).toBe(true);
  });
  it("정규화 후 빈 질의는 항상 일치", () => {
    for (const q of ["", "   ", "☆*!"]) {
      expect(matchesQuery(stellar, q)).toBe(true);
    }
  });
  it("원제가 없으면 이름만 비교한다", () => {
    expect(matchesQuery({ name: "컵헤드" }, "cuphead")).toBe(false);
    expect(matchesQuery({ name: "컵헤드" }, "컵헤드")).toBe(true);
  });
  it("정규화 후 빈 대상은 불일치로 본다", () => {
    expect(matchesQuery({ name: "☆☆" }, "a")).toBe(false);
    expect(matchesQuery({ name: "☆☆", originalTitle: "!!" }, "ㄱ")).toBe(false);
  });
  it("NFD 질의도 일치한다", () => {
    expect(matchesQuery(stellar, "스텔라".normalize("NFD"))).toBe(true);
  });
  it("호환 자모 ㄱ(U+3131) 질의가 초성 매칭된다 (NFKC 회귀)", () => {
    expect(matchesQuery({ name: "가나" }, "\u3131")).toBe(true);
  });
  it("가나·악센트 원제", () => {
    expect(matchesQuery({ name: "젤다", originalTitle: "ゼルダの伝説" }, "ゼルダ")).toBe(true);
    expect(matchesQuery({ name: "포켓몬", originalTitle: "Pokémon" }, "pokémon")).toBe(true);
    expect(matchesQuery({ name: "포켓몬", originalTitle: "Pokémon" }, "POKÉMON")).toBe(true);
  });
  it("이모지 섞인 질의", () => {
    expect(matchesQuery(stellar, "🎮 스텔라")).toBe(true);
  });
  it("초성과 완성자 혼합 질의는 지원하지 않는다", () => {
    expect(matchesQuery(stellar, "스ㅌ")).toBe(false);
  });
  it("정규식 메타문자도 예외 없이 처리한다", () => {
    for (const q of [".*", "(", "["]) {
      expect(() => matchesQuery(stellar, q)).not.toThrow();
    }
    // 정규식으로 해석되지 않는다: "a.*b"는 "ab"로 정규화되어 "axb"와 불일치
    expect(matchesQuery({ name: "axb" }, "a.*b")).toBe(false);
  });
  it("매우 긴 질의는 false", () => {
    expect(matchesQuery(stellar, "가".repeat(10000))).toBe(false);
  });
});

describe("filterGames", () => {
  const all = { q: "", status: "all", year: "all" } as const;
  it("조건이 없으면 입력 순서 그대로", () => {
    expect(ids(filterGames(fixture, all))).toEqual(ids(fixture));
  });
  it("status clear는 4건이고 입력 순서를 유지한다", () => {
    expect(ids(filterGames(fixture, { ...all, status: "clear" }))).toEqual(["bear", "gal", "sh", "ting"]);
  });
  it("year 2026은 2건, none은 날짜 없는 2건", () => {
    expect(ids(filterGames(fixture, { ...all, year: "2026" }))).toEqual(["sb", "po"]);
    expect(ids(filterGames(fixture, { ...all, year: "none" }))).toEqual(["ring", "sixty"]);
  });
  it("status·year·q를 AND로 결합한다", () => {
    expect(ids(filterGames(fixture, { q: "ㅅㅇㄹㅌ", status: "clear", year: "2025" }))).toEqual(["sh"]);
  });
  it("데이터에 없는 연도는 빈 배열", () => {
    expect(filterGames(fixture, { ...all, year: "2024" })).toEqual([]);
    expect(filterGames(fixture, { q: "", status: "clear", year: "1999" })).toEqual([]);
  });
  it("검색은 날짜 없는 게임도 포함한다", () => {
    expect(ids(filterGames(fixture, { ...all, q: "parsecs" }))).toEqual(["sixty"]);
  });
  it("입력 배열을 변경하지 않는다", () => {
    const copy = [...fixture];
    filterGames(fixture, { ...all, status: "clear" });
    expect(fixture).toEqual(copy);
    fixture.forEach((x, i) => expect(x).toBe(copy[i]));
  });
});

describe("paginate", () => {
  const nums = (n: number) => Array.from({ length: n }, (_, i) => i);
  it("50개 중 2페이지", () => {
    const p = paginate(nums(50), 2);
    expect(p.items).toHaveLength(24);
    expect(p).toMatchObject({ page: 2, start: 24, end: 48, pageCount: 3, total: 50 });
    expect(p.items[0]).toBe(24);
  });
  it("마지막 페이지는 나머지 2개", () => {
    const p = paginate(nums(50), 3);
    expect(p.items).toEqual([48, 49]);
    expect(p).toMatchObject({ start: 48, end: 50 });
  });
  it("빈 배열은 1페이지, 0..0", () => {
    expect(paginate([], 1)).toEqual({ items: [], page: 1, pageCount: 1, total: 0, start: 0, end: 0 });
  });
  it("경계: 24개는 1페이지, 25개는 2페이지에 1건", () => {
    expect(paginate(nums(24), 1).pageCount).toBe(1);
    const p = paginate(nums(25), 2);
    expect(p.pageCount).toBe(2);
    expect(p.items).toEqual([24]);
  });
  it("범위를 넘는 페이지는 마지막으로 clamp", () => {
    expect(paginate(nums(10), 99).page).toBe(1);
    expect(paginate(nums(50), 99).page).toBe(3);
  });
  it("0, 음수, NaN, 소수는 1페이지", () => {
    for (const bad of [0, -3, NaN, 1.5, Infinity]) {
      expect(paginate(nums(50), bad).page).toBe(1);
    }
  });
  it("pageSize를 지정할 수 있다", () => {
    expect(paginate(nums(5), 2, 2).items).toEqual([2, 3]);
  });
  it("잘못된 pageSize는 RangeError", () => {
    for (const bad of [0, -1, 1.5, NaN]) {
      expect(() => paginate(nums(3), 1, bad)).toThrow(RangeError);
    }
  });
});

describe("parseQueryState", () => {
  it("URLSearchParams를 그대로 읽는다", () => {
    expect(
      parseQueryState(new URLSearchParams("q=스텔라&status=clear&year=2025&sort=old&page=2")),
    ).toEqual({ q: "스텔라", status: "clear", year: "2025", sort: "old", page: 2 });
  });
  it("Record 입력은 빠진 값을 기본값으로 채운다", () => {
    expect(parseQueryState({ q: "a", status: "fail" })).toEqual({
      q: "a", status: "fail", year: "all", sort: "recent", page: 1,
    });
  });
  it("빈 입력은 기본값", () => {
    expect(parseQueryState({})).toEqual(DEFAULT_QUERY_STATE);
    expect(parseQueryState(new URLSearchParams())).toEqual(DEFAULT_QUERY_STATE);
    expect(parseQueryState({ q: undefined, page: undefined })).toEqual(DEFAULT_QUERY_STATE);
  });
  it("배열 값은 첫 원소, 빈 배열은 기본값", () => {
    expect(parseQueryState({ status: ["fail", "clear"] }).status).toBe("fail");
    expect(parseQueryState({ status: [] }).status).toBe("all");
    expect(parseQueryState({ q: ["", "x"] }).q).toBe("");
  });
  it("잘못된 status는 all (대소문자 구분)", () => {
    for (const v of ["CLEAR", "cleared", ""]) expect(parseQueryState({ status: v }).status).toBe("all");
  });
  it("year는 all|none|YYYY만 허용, 없는 연도도 유지", () => {
    for (const v of ["25", "20255", "abcd", "None", ""]) expect(parseQueryState({ year: v }).year).toBe("all");
    expect(parseQueryState({ year: "none" }).year).toBe("none");
    expect(parseQueryState({ year: "2024" }).year).toBe("2024");
  });
  it("잘못된 sort는 recent", () => {
    for (const v of ["newest", "RECENT", ""]) expect(parseQueryState({ sort: v }).sort).toBe("recent");
    expect(parseQueryState({ sort: "name" }).sort).toBe("name");
  });
  it("잘못된 page는 1", () => {
    for (const v of ["0", "-1", "1.5", "01", "1e3", "abc", "", "9999999"]) {
      expect(parseQueryState({ page: v }).page).toBe(1);
    }
    expect(parseQueryState({ page: "999999" }).page).toBe(999999);
  });
  it("q는 trim하고 100자로 자른다", () => {
    expect(parseQueryState({ q: "  스텔라  " }).q).toBe("스텔라");
    expect(parseQueryState({ q: "a".repeat(101) }).q).toHaveLength(100);
  });
  it("알 수 없는 키는 무시한다", () => {
    expect(parseQueryState({ foo: "bar", game: "x" })).toEqual(DEFAULT_QUERY_STATE);
  });
});

describe("serializeQueryState", () => {
  it("기본 상태는 빈 문자열", () => {
    expect(serializeQueryState(DEFAULT_QUERY_STATE)).toBe("");
  });
  it("기본값과 다른 키만, 정해진 순서로", () => {
    expect(serializeQueryState({ ...DEFAULT_QUERY_STATE, page: 2, status: "clear" })).toBe("status=clear&page=2");
    expect(serializeQueryState({ ...DEFAULT_QUERY_STATE, status: "fail" })).toBe("status=fail");
    expect(serializeQueryState({ q: "a", status: "clear", year: "none", sort: "name", page: 3 })).toBe(
      "q=a&status=clear&year=none&sort=name&page=3",
    );
  });
  it("공백뿐인 q는 생략", () => {
    expect(serializeQueryState({ ...DEFAULT_QUERY_STATE, q: "  " })).toBe("");
  });
  it("한글은 퍼센트 인코딩된다", () => {
    expect(serializeQueryState({ ...DEFAULT_QUERY_STATE, q: "스텔라" })).toBe("q=%EC%8A%A4%ED%85%94%EB%9D%BC");
  });
  it("왕복: parse(serialize(s)) === s", () => {
    const states: GamesQueryState[] = [
      DEFAULT_QUERY_STATE,
      { q: "스텔라 블레이드", status: "clear", year: "2025", sort: "old", page: 2 },
      { q: "a&b=c?", status: "fail", year: "none", sort: "name", page: 10 },
      { q: "", status: "unknown", year: "2024", sort: "recent", page: 1 },
    ];
    for (const s of states) {
      expect(parseQueryState(new URLSearchParams(serializeQueryState(s)))).toEqual(s);
    }
  });
});

describe("applyFilterChange", () => {
  const s: GamesQueryState = { ...DEFAULT_QUERY_STATE, page: 3 };
  it("필터·정렬·검색을 바꾸면 1페이지로 돌아간다", () => {
    expect(applyFilterChange(s, { status: "fail" }).page).toBe(1);
    expect(applyFilterChange(s, { sort: "name" }).page).toBe(1);
    expect(applyFilterChange(s, { q: "x" })).toMatchObject({ q: "x", page: 1 });
    expect(applyFilterChange(s, { year: "none" }).page).toBe(1);
  });
  it("page만 넘기면 그 페이지로 이동한다", () => {
    expect(applyFilterChange(s, { page: 5 }).page).toBe(5);
    expect(applyFilterChange(DEFAULT_QUERY_STATE, { page: 3 }).page).toBe(3);
  });
  it("입력 상태를 변경하지 않는다", () => {
    const before = { ...s };
    applyFilterChange(s, { status: "clear" });
    expect(s).toEqual(before);
  });
});

describe("countStats", () => {
  it("endless를 따로 센다", () => {
    const gs: Game[] = [
      { id: "lol", name: "리그 오브 레전드", firstPlayed: null, status: "endless", vods: [] },
      { id: "tft", name: "전략적 팀 전투", firstPlayed: "2024-01-01", status: "endless", vods: [] },
      { id: "a", name: "a", firstPlayed: "2024-01-01", status: "clear", vods: [] },
    ];
    expect(countStats(gs)).toEqual({ total: 3, clear: 1, fail: 0, endless: 2, unknown: 0, undated: 1 });
  });

  it("집계한다", () => {
    expect(countStats(fixture)).toEqual({ total: 9, clear: 4, fail: 1, endless: 0, unknown: 4, undated: 2 });
  });
  it("빈 목록은 전부 0", () => {
    expect(countStats([])).toEqual({ total: 0, clear: 0, fail: 0, endless: 0, unknown: 0, undated: 0 });
  });
});

describe("availableYears", () => {
  it("검증을 거치지 않은 비정상 firstPlayed의 연도는 옵션에 넣지 않는다", () => {
    expect(availableYears([g("x", "가", "20xx-01-01", "clear"), g("y", "나", "2024-01-01", "clear")])).toEqual({ years: ["2024"], hasUndated: false });
  });
  it("연도를 중복 없이 내림차순으로", () => {
    expect(availableYears(fixture)).toEqual({ years: ["2026", "2025"], hasUndated: true });
  });
  it("전부 null이면 연도 없음, 빈 목록이면 hasUndated도 false", () => {
    expect(availableYears([g("a", "가", null, "clear")])).toEqual({ years: [], hasUndated: true });
    expect(availableYears([])).toEqual({ years: [], hasUndated: false });
  });
  it("날짜가 모두 있으면 hasUndated false", () => {
    expect(availableYears([g("a", "가", "2024-01-01", "clear")])).toEqual({ years: ["2024"], hasUndated: false });
  });
});

describe("formatDate", () => {
  it("점 표기로 바꾼다", () => {
    expect(formatDate("2025-09-23")).toBe("2025.09.23");
  });
  it("null은 날짜 기록 없음", () => {
    expect(formatDate(null)).toBe("날짜 기록 없음");
  });
});

describe("sortGames", () => {
  it("recent: 최신순, 날짜 없음은 맨 뒤(이름순)", () => {
    expect(ids(sortGames(fixture, "recent"))).toEqual([
      "po", "sb", "pp", "bear", "gal", "sh", "ting", "sixty", "ring",
    ]);
  });
  it("old: 오래된 순이고 날짜 없음은 여전히 맨 뒤", () => {
    expect(ids(sortGames(fixture, "old"))).toEqual([
      "ting", "sh", "gal", "bear", "pp", "sb", "po", "sixty", "ring",
    ]);
  });
  it("name: ko collator 순서(숫자, 한글, 라틴)", () => {
    const sorted = sortGames(fixture, "name");
    expect(ids(sorted)).toEqual(["sixty", "gal", "bear", "ring", "sh", "sb", "po", "pp", "ting"]);
    const collator = new Intl.Collator("ko", { numeric: true });
    const names = fixture.map((x) => x.name).sort(collator.compare);
    expect(sorted.map((x) => x.name)).toEqual(names);
  });
  it("같은 날짜면 numeric 이름순: 게임 2가 게임 10보다 앞", () => {
    const tie = [g("a", "게임 10", "2025-01-01", "clear"), g("b", "게임 2", "2025-01-01", "clear")];
    expect(ids(sortGames(tie, "recent"))).toEqual(["b", "a"]);
    expect(ids(sortGames(tie, "old"))).toEqual(["b", "a"]);
    expect(ids(sortGames(tie, "name"))).toEqual(["b", "a"]);
  });
  it("날짜와 이름이 같으면 id 순", () => {
    const tie = ["m", "z", "a", "q"].map((id) => g(id, "같음", "2025-01-01", "clear"));
    for (const key of ["recent", "old", "name"] as const) {
      expect(ids(sortGames(tie, key))).toEqual(["a", "m", "q", "z"]);
      expect(ids(sortGames([...tie].reverse(), key))).toEqual(["a", "m", "q", "z"]);
    }
  });
  it("id 동률 해소는 UTF-16이 아니라 코드포인트 순 (모든 정렬 키에서 같다)", () => {
    // U+FFB1(BMP) < U+20000(astral)이 코드포인트 순. UTF-16 비교라면 서로게이트 0xD840이 0xFFB1보다 작아 뒤집힌다.
    const tie = [g("\u{20000}", "같음", "2025-01-01", "clear"), g("\uFFB1", "같음", "2025-01-01", "clear")];
    for (const key of ["recent", "old", "name"] as const) {
      expect(ids(sortGames(tie, key)), key).toEqual(["\uFFB1", "\u{20000}"]);
    }
  });
  it("name·old: 이름·id가 모두 같으면 입력 순서를 유지한다(stable)", () => {
    const dup = [
      { ...g("same", "같음", "2025-01-01", "clear"), vods: [{ title: "첫째", url: "u1", date: "2025-01-02" }] },
      { ...g("same", "같음", "2025-01-01", "clear"), vods: [{ title: "둘째", url: "u2", date: "2025-01-03" }] },
    ];
    for (const key of ["old", "name"] as const) {
      expect(sortGames(dup, key).map((x) => x.vods[0].title)).toEqual(["첫째", "둘째"]);
    }
  });
  it("old에서 날짜 없는 게임끼리도 이름순", () => {
    const undated = [g("b", "나", null, "clear"), g("a", "가", null, "clear")];
    expect(ids(sortGames(undated, "old"))).toEqual(["a", "b"]);
  });
  it("name 정렬은 날짜와 무관", () => {
    const mixed = [g("n", "나", null, "clear"), g("d", "다", "2026-01-01", "clear"), g("g", "가", "2020-01-01", "clear")];
    expect(ids(sortGames(mixed, "name"))).toEqual(["g", "n", "d"]);
  });
  it("사본을 반환하고 입력을 변경하지 않는다", () => {
    const copy = [...fixture];
    const out = sortGames(fixture, "name");
    expect(out).not.toBe(fixture);
    fixture.forEach((x, i) => expect(x).toBe(copy[i]));
  });
  it("빈 배열", () => {
    expect(sortGames([], "old")).toEqual([]);
  });
});

describe("indexGames", () => {
  it("canonical 순서로 번호를 부여한다(최신이 가장 큼, 날짜 없음이 가장 작음)", () => {
    const out = indexGames(fixture);
    expect(ids(out)).toEqual(["po", "sb", "pp", "bear", "gal", "sh", "ting", "sixty", "ring"]);
    expect(out[0]).toMatchObject({ ordinal: 9, no: "009" });
    expect(out[8]).toMatchObject({ ordinal: 1, no: "001" });
  });
  it("원본 필드를 보존한다", () => {
    expect(indexGames([fixture[0]])[0]).toMatchObject(fixture[0]);
  });
  it("빈 배열", () => {
    expect(indexGames([])).toEqual([]);
  });
  it("1000건이면 패딩 없이 1000", () => {
    const many = Array.from({ length: 1000 }, (_, i) =>
      g(`g${String(i).padStart(4, "0")}`, `게임${i}`, null, "unknown"),
    );
    const out = indexGames(many);
    expect(out[0].no).toBe("1000");
    expect(out[999].no).toBe("001");
  });
  it("입력 배열을 변경하지 않는다", () => {
    const copy = [...fixture];
    indexGames(fixture);
    fixture.forEach((x, i) => expect(x).toBe(copy[i]));
  });
  it("필터·정렬과 무관하게 번호가 고정된다", () => {
    const indexed = indexGames(fixture);
    const sb = indexed.find((x) => x.id === "sb")!;
    const filtered = filterGames(indexed, { q: "", status: "unknown", year: "2026" });
    expect(filtered.find((x) => x.id === "sb")!.no).toBe(sb.no);
  });
});

describe("selectPage", () => {
  const many = indexGames(
    Array.from({ length: 30 }, (_, i) => g(`g${i}`, `게임${i}`, `2025-01-${String(i + 1).padStart(2, "0")}`, "clear")),
  );
  it("필터 → 정렬 → 페이지 순으로 적용한다", () => {
    const p = selectPage(many, { ...DEFAULT_QUERY_STATE, sort: "old", page: 2 });
    expect(p.total).toBe(30);
    expect(p.items.map((x) => x.id)).toEqual(["g24", "g25", "g26", "g27", "g28", "g29"]);
  });
  it("범위를 넘는 page는 마지막으로 clamp되고 반환 page로 확인된다", () => {
    const p = selectPage(many, { ...DEFAULT_QUERY_STATE, page: 99 });
    expect(p.page).toBe(2);
    expect(p.items).toHaveLength(6);
  });
  it("pageSize를 지정할 수 있다", () => {
    expect(selectPage(many, DEFAULT_QUERY_STATE, 10).pageCount).toBe(3);
  });
  it("결과 0건", () => {
    const p = selectPage(many, { ...DEFAULT_QUERY_STATE, q: "없는게임" });
    expect(p).toMatchObject({ total: 0, page: 1, pageCount: 1, start: 0, end: 0 });
  });
});

describe("pageWindow", () => {
  it("7쪽 이하면 모두 나열한다", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it("앞쪽에서는 뒤를 생략한다", () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, "gap", 20]);
    expect(pageWindow(4, 20)).toEqual([1, 2, 3, 4, 5, "gap", 20]);
  });
  it("뒤쪽에서는 앞을 생략한다", () => {
    expect(pageWindow(20, 20)).toEqual([1, "gap", 16, 17, 18, 19, 20]);
    expect(pageWindow(17, 20)).toEqual([1, "gap", 16, 17, 18, 19, 20]);
  });
  it("가운데에서는 양쪽을 생략한다", () => {
    expect(pageWindow(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
  });
  it("경계: 8쪽", () => {
    expect(pageWindow(4, 8)).toEqual([1, 2, 3, 4, 5, "gap", 8]);
    expect(pageWindow(5, 8)).toEqual([1, "gap", 4, 5, 6, 7, 8]);
  });
  it("범위 밖 current는 clamp, 비정상 count는 [1]", () => {
    expect(pageWindow(99, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(-5, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(NaN, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 0)).toEqual([1]);
    expect(pageWindow(1, -3)).toEqual([1]);
    expect(pageWindow(1, NaN)).toEqual([1]);
  });
});

describe("normalizeQ", () => {
  it("trim하고 Q_MAX(100)자로 자른다", () => {
    expect(Q_MAX).toBe(100);
    expect(normalizeQ("  스텔라  ")).toBe("스텔라");
    expect(normalizeQ("a".repeat(101))).toBe("a".repeat(100));
    expect(normalizeQ("")).toBe("");
    expect(normalizeQ("   ")).toBe("");
  });
  it("자른 끝에 남은 공백도 지운다 (멱등)", () => {
    const raw = "a".repeat(99) + " b";
    expect(normalizeQ(raw)).toBe("a".repeat(99));
    expect(normalizeQ(normalizeQ(raw))).toBe(normalizeQ(raw));
  });
  it("서로게이트 쌍 중간에서 자르지 않는다", () => {
    const raw = "a".repeat(99) + "😀";
    expect(normalizeQ(raw)).toBe("a".repeat(99));
    expect(normalizeQ("a".repeat(98) + "😀")).toBe("a".repeat(98) + "😀");
  });
  it("parseQueryState의 q와 같은 규칙", () => {
    for (const raw of ["  x ", "a".repeat(99) + " b", "a".repeat(99) + "😀", "가".repeat(150)]) {
      expect(parseQueryState({ q: raw }).q, raw).toBe(normalizeQ(raw));
    }
  });
});

describe("STATUS_FILTERS / SORT_KEYS", () => {
  it("UI 노출 순서 그대로", () => {
    expect(STATUS_FILTERS).toEqual(["all", "clear", "fail", "endless", "unknown"]);
    expect(SORT_KEYS).toEqual(["recent", "old", "name"]);
  });
});

describe("parseYearFilter / parseSortKey", () => {
  it("year: all|none|YYYY, 나머지는 all", () => {
    expect(parseYearFilter("none")).toBe("none");
    expect(parseYearFilter("all")).toBe("all");
    expect(parseYearFilter("2024")).toBe("2024");
    for (const v of [undefined, "", "25", "20255", "None", " 2024", "2024 "]) expect(parseYearFilter(v), String(v)).toBe("all");
  });
  it("sort: recent|old|name, 나머지는 recent", () => {
    expect(parseSortKey("old")).toBe("old");
    expect(parseSortKey("name")).toBe("name");
    for (const v of [undefined, "", "RECENT", "newest"]) expect(parseSortKey(v), String(v)).toBe("recent");
  });
});

describe("yearFilterOptions", () => {
  it("all, 연도(내림차순), none(날짜 없는 게임이 있을 때)", () => {
    expect(yearFilterOptions({ years: ["2026", "2025"], hasUndated: true }, "all")).toEqual(["all", "2026", "2025", "none"]);
    expect(yearFilterOptions({ years: ["2026"], hasUndated: false }, "2026")).toEqual(["all", "2026"]);
    expect(yearFilterOptions({ years: [], hasUndated: false }, "all")).toEqual(["all"]);
  });
  it("URL로 들어온, 데이터에 없는 연도는 내림차순 자리에 끼운다", () => {
    expect(yearFilterOptions({ years: ["2026", "2024"], hasUndated: true }, "2025")).toEqual(["all", "2026", "2025", "2024", "none"]);
    expect(yearFilterOptions({ years: ["2026"], hasUndated: false }, "2030")).toEqual(["all", "2030", "2026"]);
    expect(yearFilterOptions({ years: ["2026"], hasUndated: false }, "1999")).toEqual(["all", "2026", "1999"]);
  });
  it("날짜 없는 게임이 없어도 현재 값이 none이면 끝에 남긴다", () => {
    expect(yearFilterOptions({ years: ["2026"], hasUndated: false }, "none")).toEqual(["all", "2026", "none"]);
  });
  it("입력을 변경하지 않는다", () => {
    const years = { years: ["2026"] as `${number}`[], hasUndated: false };
    yearFilterOptions(years, "2025");
    expect(years).toEqual({ years: ["2026"], hasUndated: false });
  });
});

describe("parseDetailId", () => {
  it("유효한 game 파라미터를 돌려준다", () => {
    expect(parseDetailId(new URLSearchParams("game=silent-hill-f"))).toBe("silent-hill-f");
    expect(parseDetailId({ game: "스텔라-블레이드" })).toBe("스텔라-블레이드");
  });
  it("배열이면 첫 값을 쓴다", () => {
    expect(parseDetailId({ game: ["cuphead", "x"] })).toBe("cuphead");
  });
  it("없거나 빈 값이면 null", () => {
    expect(parseDetailId(new URLSearchParams(""))).toBeNull();
    expect(parseDetailId({ game: "" })).toBeNull();
    expect(parseDetailId({ game: undefined })).toBeNull();
    expect(parseDetailId({ game: [] })).toBeNull();
  });
  it("ID 형식이 아니면 null (대문자·공백·앞뒤 하이픈·연속 하이픈·특수문자)", () => {
    for (const bad of ["Cuphead", "cup head", "-cuphead", "cuphead-", "cup--head", "cup/head", "<script>"]) {
      expect(parseDetailId({ game: bad })).toBeNull();
    }
  });
});

describe("detailQuery", () => {
  it("목록 상태를 유지하고 game을 붙인다", () => {
    const state = { ...DEFAULT_QUERY_STATE, q: "힐", status: "clear" as const, page: 2 };
    const qs = new URLSearchParams(detailQuery(state, "silent-hill-f"));
    expect(qs.get("game")).toBe("silent-hill-f");
    expect(parseQueryState(qs)).toEqual(state);
  });
  it("기본 상태면 game만 남는다", () => {
    expect(detailQuery(DEFAULT_QUERY_STATE, "cuphead")).toBe("game=cuphead");
  });
  it("null이면 game 없이 목록 상태만 직렬화한다", () => {
    const state = { ...DEFAULT_QUERY_STATE, sort: "name" as const };
    expect(detailQuery(state, null)).toBe(serializeQueryState(state));
    expect(detailQuery(DEFAULT_QUERY_STATE, null)).toBe("");
  });
  it("한글 ID는 인코딩되고 왕복된다", () => {
    const qs = detailQuery(DEFAULT_QUERY_STATE, "스텔라-블레이드");
    expect(qs).not.toContain("스");
    expect(parseDetailId(new URLSearchParams(qs))).toBe("스텔라-블레이드");
  });
  it("입력 상태를 변경하지 않는다", () => {
    const state = Object.freeze({ ...DEFAULT_QUERY_STATE, q: "a" });
    detailQuery(state, "cuphead");
    expect(state.q).toBe("a");
  });
  it("serializeQueryState는 game을 넣지 않는다(필터·페이지 변경 시 상세가 닫힌다)", () => {
    expect(serializeQueryState(parseQueryState(new URLSearchParams("game=cuphead&page=2")))).toBe("page=2");
  });
});

describe("endless 상태 필터", () => {
  it("status=endless를 파싱·직렬화하고 그 게임만 거른다", () => {
    const st = parseQueryState(new URLSearchParams("status=endless"));
    expect(st.status).toBe("endless");
    expect(serializeQueryState(st)).toBe("status=endless");
    const gs = indexGames([
      { id: "lol", name: "리그 오브 레전드", firstPlayed: null, status: "endless", vods: [] },
      { id: "a", name: "a", firstPlayed: null, status: "fail", vods: [] },
    ]);
    expect(filterGames(gs, st).map((g) => g.id)).toEqual(["lol"]);
  });
});

describe("indexWithHidden", () => {
  const withHidden = (hiddenIds: string[]) => fixture.map((x) => ({ ...x, hidden: hiddenIds.includes(x.id) }));
  it("숨김이 없으면 indexGames와 같은 번호", () => {
    const all = indexWithHidden(withHidden([]));
    const expected = new Map(indexGames(fixture).map((x) => [x.id, x]));
    for (const x of all) {
      expect(x.ordinal).toBe(expected.get(x.id)?.ordinal);
      expect(x.no).toBe(expected.get(x.id)?.no);
    }
  });
  it("숨긴 게임은 0과 —", () => {
    const sb = indexWithHidden(withHidden(["sb"])).find((x) => x.id === "sb");
    expect(sb).toMatchObject({ ordinal: 0, no: "—", hidden: true });
  });
  it("보이는 게임 번호는 숨김 때문에 밀리지 않는다", () => {
    const hiddenOne = indexWithHidden(withHidden(["po"]));
    const visibleOnly = new Map(indexGames(fixture.filter((x) => x.id !== "po")).map((x) => [x.id, x.ordinal]));
    for (const x of hiddenOne.filter((y) => !y.hidden)) expect(x.ordinal).toBe(visibleOnly.get(x.id));
    expect(Math.max(...hiddenOne.map((x) => x.ordinal))).toBe(fixture.length - 1);
  });
  it("입력 순서를 유지한다", () => {
    expect(indexWithHidden(withHidden(["sb"])).map((x) => x.id)).toEqual(fixture.map((x) => x.id));
  });
});
