import { describe, expect, it } from "vitest";
import { CliArgsError, parseAddArgs, parseVodArg, USAGE } from "./cli-args.ts";

const YT = "https://youtu.be/abcdefghijk";
const YT2 = "https://www.youtube.com/watch?v=ZYXWVUTSRQP";

describe("parseVodArg", () => {
  it("title|url|date 를 분리한다", () => {
    expect(parseVodArg(`1화|${YT}|2026-10-21`)).toEqual({ title: "1화", url: YT, date: "2026-10-21" });
  });
  it("각 조각을 trim 한다", () => {
    expect(parseVodArg(`  1화  |  ${YT} | 2026-10-21  `)).toEqual({ title: "1화", url: YT, date: "2026-10-21" });
  });
  it("제목에 | 가 있어도 오른쪽부터 두 번만 자른다", () => {
    expect(parseVodArg(`a|b|c|${YT}|2026-10-21`).title).toBe("a|b|c");
  });
  it("조각이 3개 미만이면 실패", () => {
    expect(() => parseVodArg("제목")).toThrow(CliArgsError);
    expect(() => parseVodArg(`제목|${YT}`)).toThrow(CliArgsError);
    expect(() => parseVodArg("")).toThrow(CliArgsError);
  });
  it("제목이 비어 있으면 실패", () => {
    expect(() => parseVodArg(`  |${YT}|2026-10-21`)).toThrow(/제목/);
  });
  it("치지직·비유튜브 URL 은 거부", () => {
    expect(() => parseVodArg("t|https://chzzk.naver.com/video/123|2026-10-21")).toThrow(/유튜브/);
    expect(() => parseVodArg("t|http://youtu.be/abcdefghijk|2026-10-21")).toThrow(CliArgsError);
    expect(() => parseVodArg("t||2026-10-21")).toThrow(CliArgsError);
  });
  it("존재하지 않는 날짜는 거부", () => {
    expect(() => parseVodArg(`t|${YT}|2025-02-30`)).toThrow(/날짜/);
    expect(() => parseVodArg(`t|${YT}|`)).toThrow(CliArgsError);
    expect(() => parseVodArg(`t|${YT}|2026/10/21`)).toThrow(CliArgsError);
  });
});

describe("parseAddArgs", () => {
  it("검색어만 주면 기본값을 채운다", () => {
    expect(parseAddArgs(["스텔라"])).toEqual({ query: "스텔라", pick: undefined, categoryId: undefined, size: 20, dryRun: false, input: {} });
  });
  it("옵션 미지정 시 input 에 키가 없다", () => {
    const { input } = parseAddArgs(["x"]);
    expect(Object.keys(input)).toEqual([]);
    expect("pick" in parseAddArgs(["x"])).toBe(true);
    expect("categoryId" in parseAddArgs(["x"])).toBe(true);
  });
  it("검색어를 trim 한다", () => {
    expect(parseAddArgs(["  스텔라  "]).query).toBe("스텔라");
  });
  it("모든 옵션 조합", () => {
    const r = parseAddArgs([
      "스텔라", "--pick", "2", "--size", "5", "--date", "2026-10-21", "--status", "clear",
      "--orig", " Stellar Blade ", "--id", "sb", "--vod", `1|${YT}|2026-10-21`, "--dry-run",
    ]);
    expect(r).toEqual({
      query: "스텔라", pick: 2, categoryId: undefined, size: 5, dryRun: true,
      input: {
        firstPlayed: "2026-10-21", status: "clear", originalTitle: "Stellar Blade", id: "sb",
        vods: [{ title: "1", url: YT, date: "2026-10-21" }],
      },
    });
  });
  it("--category-id 는 trim 해서 그대로 담는다 (파일을 쓰는 실행의 기준)", () => {
    expect(parseAddArgs(["x", "--category-id", " Stellar_Blade "]).categoryId).toBe("Stellar_Blade");
    expect(parseAddArgs(["x", "--category-id", "2048", "--pick", "3"])).toMatchObject({ categoryId: "2048", pick: 3, dryRun: false });
  });
  it("--pick 만으로는 --dry-run 일 때만 허용한다 (실행 사이 검색 결과가 바뀌어도 엉뚱한 게임을 쓰지 않도록)", () => {
    expect(() => parseAddArgs(["x", "--pick", "1"])).toThrow(/category-id/);
    expect(parseAddArgs(["x", "--pick", "1", "--dry-run"]).pick).toBe(1);
  });
  it("--vod 반복 순서를 보존한다", () => {
    const r = parseAddArgs(["x", "--vod", `b|${YT2}|2026-01-02`, "--vod", `a|${YT}|2026-01-01`]);
    expect(r.input.vods?.map((v) => v.title)).toEqual(["b", "a"]);
  });
  it("--date none 은 null", () => {
    expect(parseAddArgs(["x", "--date", "none"]).input.firstPlayed).toBeNull();
  });
  it.each(["unknown", "fail", "clear", "endless"])("status %s 허용", (s) => {
    expect(parseAddArgs(["x", "--status", s]).input.status).toBe(s);
  });
  it.each([
    [["x", "--pick", "0"], /pick/],
    [["x", "--pick", "abc"], /pick/],
    [["x", "--pick", "1.5"], /pick/],
    [["x", "--pick", "-1"], /pick|option/],
    [["x", "--size", "51"], /size/],
    [["x", "--size", "0"], /size/],
    [["x", "--size", "2.5"], /size/],
    [["x", "--size", "abc"], /size/],
    [["x", "--status", "done"], /status/],
    [["x", "--date", "2025-02-30"], /date/],
    [["x", "--date", "tomorrow"], /date/],
    [["x", "--date", "2025-01-011"], /date/],
    [["x", "--date", "2025-01-01x"], /date/],
    [["x", "--date", "2025-01-01T00:00"], /date/],
    [["x", "--date", " 2025-01-01"], /date/],
    [["x", "--date", "2025-01-01\n"], /date/],
    [["x", "--vod", "t|https://youtu.be/abcdefghij|2026-10-21"], /유튜브/],
    [["x", "--vod", "t|https://youtu.be/abcdefghijkl|2026-10-21"], /유튜브/],
    [["x", "--vod", "t|https://youtu.be/!abcdefghij|2026-10-21"], /유튜브/],
    [["x", "--vod", "t|https://www.youtube.com/watch?v=abcdefghij|2026-10-21"], /유튜브/],
    [["x", "--vod", "t|https://www.youtube.com/watch?v=abcdefghijkl|2026-10-21"], /유튜브/],
    [["x", "--vod", "t|https://www.youtube.com/watch?v=!abcdefghij|2026-10-21"], /유튜브/],
    [["x", "--vod", "t|https://www.youtube.com/watch?v=|2026-10-21"], /유튜브/],
    [["x", "--vod", "t|https://youtu.be/abcdefghijk|2026-01-011"], /날짜/],
    [["x", "--genre", "rpg"], /genre/],
    [[], /검색어/],
    [["a", "b"], /검색어/],
    [["   "], /검색어/],
    [["x", "--id", "Bad Id"], /id/],
    [["x", "--orig", "   "], /orig/],
    [["x", "--pick"], /pick/],
    [["x", "--category-id"], /category-id/],
    [["x", "--category-id", "   "], /category-id/],
    [["x", "--vod", "only"], /vod/],
    [["x", "--vod", `t|https://chzzk.naver.com/v/1|2026-10-21`], /vod|유튜브/],
  ])("잘못된 입력 %j 은 CliArgsError", (argv, re) => {
    let err: unknown;
    try { parseAddArgs(argv as string[]); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(CliArgsError);
    expect((err as Error).message).toMatch(re);
  });
  it("에러 이름", () => {
    expect(new CliArgsError("x").name).toBe("CliArgsError");
  });
  it("입력 배열을 변경하지 않는다", () => {
    const argv = Object.freeze(["x", "--pick", "1", "--dry-run"]);
    expect(() => parseAddArgs(argv)).not.toThrow();
  });
  it("USAGE 는 주요 옵션을 안내한다", () => {
    for (const k of ["--pick", "--category-id", "--size", "--date", "--status", "--orig", "--id", "--vod", "--dry-run"]) {
      expect(USAGE).toContain(k);
    }
  });
});
