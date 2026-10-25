import { describe, expect, it } from "vitest";
import {
  compareCanonical,
  compareName,
  isPosterUrl,
  GamesValidationError,
  isValidIsoDate,
  isYoutubeUrl,
  parseGames,
  serializeGames,
  validateGames,
  youtubeVideoId,
} from "./schema.ts";
import type { Game, ValidationResult } from "./types.ts";

const TRAILING_BAD_DATES = ["2025-01-011", "2025-01-01x", "2025-01-01T00:00", " 2025-01-01", "2025-01-01\n", "x2025-01-01"];

describe("isValidIsoDate", () => {
  it("accepts real dates including leap days", () => {
    expect(isValidIsoDate("2024-02-29")).toBe(true);
    expect(isValidIsoDate("2000-02-29")).toBe(true);
    expect(isValidIsoDate("2025-12-31")).toBe(true);
  });
  it("rejects non-existent dates", () => {
    expect(isValidIsoDate("2025-02-29")).toBe(false);
    expect(isValidIsoDate("2025-02-30")).toBe(false);
    expect(isValidIsoDate("2100-02-29")).toBe(false);
    expect(isValidIsoDate("2025-04-31")).toBe(false);
  });
  it("rejects out-of-range months and days", () => {
    expect(isValidIsoDate("2025-13-01")).toBe(false);
    expect(isValidIsoDate("2025-00-10")).toBe(false);
    expect(isValidIsoDate("2025-01-00")).toBe(false);
  });
  it("rejects malformed strings", () => {
    for (const s of ["2025-1-01", "20250101", " 2025-01-01", "2025-01-01T00:00", "2025.01.01", ""]) {
      expect(isValidIsoDate(s), s).toBe(false);
    }
  });
  it("rejects non-strings", () => {
    expect(isValidIsoDate(20250101)).toBe(false);
    expect(isValidIsoDate(null)).toBe(false);
    expect(isValidIsoDate(undefined)).toBe(false);
  });
  it("rejects trailing or leading garbage (both anchors)", () => {
    for (const s of TRAILING_BAD_DATES) {
      expect(isValidIsoDate(s), JSON.stringify(s)).toBe(false);
    }
  });
  it("applies the century leap rule (1900 no, 2000 yes)", () => {
    expect(isValidIsoDate("1900-02-29")).toBe(false);
    expect(isValidIsoDate("2000-02-29")).toBe(true);
  });
  it("handles year boundaries 0000 and 9999", () => {
    expect(isValidIsoDate("0000-01-01")).toBe(true);
    expect(isValidIsoDate("9999-12-31")).toBe(true);
  });
});

const ID = "dQw4w9WgXcQ";

describe("youtubeVideoId / isYoutubeUrl", () => {
  it("extracts id from accepted forms", () => {
    expect(youtubeVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(youtubeVideoId(`https://youtu.be/${ID}?si=abc`)).toBe(ID);
    expect(youtubeVideoId(`https://youtube.com/watch?v=${ID}&t=30s`)).toBe(ID);
    expect(youtubeVideoId(`https://m.youtube.com/watch?list=PL1&v=${ID}`)).toBe(ID);
    expect(youtubeVideoId(`https://www.youtube.com/watch?v=${ID}#t=1`)).toBe(ID);
  });
  it("rejects everything else", () => {
    const bad = [
      "https://chzzk.naver.com/video/12345",
      `http://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com.evil.com/watch?v=${ID}`,
      `https://notyoutube.com/watch?v=${ID}`,
      `https://youtube.com/shorts/${ID}`,
      `https://youtube.com/live/${ID}`,
      `https://youtube.com/embed/${ID}`,
      "javascript:alert(1)",
      "not a url",
      "",
      "https://youtu.be/short",
      `https://youtu.be/${ID}/extra`,
      "https://youtube.com/watch?v=dQw4w9WgXc!",
      `https://user:pw@youtube.com/watch?v=${ID}`,
      `https://user@youtu.be/${ID}`,
      "https://youtube.com/watch",
      `https://youtube.com/watch/x?v=${ID}`,
    ];
    for (const u of bad) {
      expect(youtubeVideoId(u), u).toBeNull();
      expect(isYoutubeUrl(u), u).toBe(false);
    }
  });
  it("requires exactly 11 id chars with nothing before them, on both url forms", () => {
    const badIds = ["abcdefghij", "abcdefghijkl", "!abcdefghij", "!abcdefghijk", ""];
    for (const vid of badIds) {
      for (const u of [`https://www.youtube.com/watch?v=${vid}`, `https://youtu.be/${vid}`]) {
        expect(youtubeVideoId(u), u).toBeNull();
        expect(isYoutubeUrl(u), u).toBe(false);
      }
    }
    expect(youtubeVideoId("https://youtu.be/abcdefghijk")).toBe("abcdefghijk");
    expect(youtubeVideoId("https://youtube.com/watch?v=abcdefghijk")).toBe("abcdefghijk");
  });
  it("isYoutubeUrl is true for valid and false for non-strings", () => {
    expect(isYoutubeUrl(`https://youtu.be/${ID}`)).toBe(true);
    expect(isYoutubeUrl(42)).toBe(false);
    expect(isYoutubeUrl(null)).toBe(false);
  });
});

const base = () => ({
  id: "cuphead",
  name: "컵헤드",
  firstPlayed: "2025-08-01",
  status: "unknown",
  vods: [] as unknown[],
});

function issues(input: unknown) {
  const r: ValidationResult = validateGames(input);
  if (r.ok) throw new Error("expected failure");
  return r.issues;
}
function paths(input: unknown) {
  return issues(input).map((i) => i.path);
}

describe("validateGames: valid input", () => {
  it("accepts empty list", () => {
    expect(validateGames([])).toEqual({ ok: true, games: [] });
  });
  it("accepts required fields only and returns deep-equal", () => {
    const r = validateGames([base()]);
    expect(r).toEqual({ ok: true, games: [base()] });
  });
  it("accepts all fields", () => {
    const g = {
      ...base(),
      originalTitle: "Cuphead",
      categoryId: "Cuphead",
      posterUrl: "https://nng-phinf.pstatic.net/x.jpg?type=w640",
      vods: [
        { title: "1화", url: "https://youtu.be/dQw4w9WgXcQ", date: "2025-08-01" },
        { title: "2화", url: "https://www.youtube.com/watch?v=aaaaaaaaaaa", date: "2025-08-02" },
      ],
    };
    expect(validateGames([g])).toEqual({ ok: true, games: [g] });
  });
  it("accepts null firstPlayed with any vod date", () => {
    const g = { ...base(), firstPlayed: null, vods: [{ title: "t", url: "https://youtu.be/dQw4w9WgXcQ", date: "1999-01-01" }] };
    expect(validateGames([g]).ok).toBe(true);
  });
  it("accepts all four statuses", () => {
    for (const status of ["clear", "fail", "endless", "unknown"]) {
      expect(validateGames([{ ...base(), status }]).ok, status).toBe(true);
    }
  });
  it("accepts hangul and numeric ids", () => {
    expect(validateGames([{ ...base(), id: "링-피트-어드벤처" }, { ...base(), id: "60-parsecs" }]).ok).toBe(true);
  });
  it("trims strings", () => {
    const r = validateGames([{ ...base(), name: "  컵헤드  ", originalTitle: " Cup ", categoryId: " c ", vods: [{ title: " t ", url: " https://youtu.be/dQw4w9WgXcQ ", date: "2025-08-01" }] }]);
    expect(r.ok && r.games[0]).toMatchObject({ name: "컵헤드", originalTitle: "Cup", categoryId: "c" });
    expect(r.ok && r.games[0].vods[0]).toEqual({ title: "t", url: "https://youtu.be/dQw4w9WgXcQ", date: "2025-08-01" });
  });
  it("accepts vod date equal to firstPlayed", () => {
    expect(validateGames([{ ...base(), vods: [{ title: "t", url: "https://youtu.be/dQw4w9WgXcQ", date: "2025-08-01" }] }]).ok).toBe(true);
  });
  it("accepts boundary lengths (name 100, vod title 200)", () => {
    expect(validateGames([{ ...base(), name: "가".repeat(100), vods: [{ title: "a".repeat(200), url: "https://youtu.be/dQw4w9WgXcQ", date: "2025-08-01" }] }]).ok).toBe(true);
  });
  it("accepts two games without categoryId and same vod video in different games", () => {
    const v = [{ title: "t", url: "https://youtu.be/dQw4w9WgXcQ", date: "2025-09-01" }];
    expect(validateGames([{ ...base(), vods: v }, { ...base(), id: "other", name: "다른", vods: v }]).ok).toBe(true);
  });
  it("does not mutate input", () => {
    const input = [{ ...base(), name: " x ", vods: [{ title: " t ", url: "https://youtu.be/dQw4w9WgXcQ", date: "2025-09-01" }] }];
    const copy = structuredClone(input);
    validateGames(input);
    expect(input).toEqual(copy);
  });
  it("preserves input order", () => {
    const r = validateGames([{ ...base(), id: "b" }, { ...base(), id: "a" }]);
    expect(r.ok && r.games.map((g) => g.id)).toEqual(["b", "a"]);
  });
});

describe("validateGames: top-level and element shape", () => {
  it("rejects non-arrays with a single root issue", () => {
    for (const v of [{}, null, "[]", 1, undefined]) {
      const i = issues(v);
      expect(i).toHaveLength(1);
      expect(i[0].path).toBe("");
    }
  });
  it("rejects non-object elements", () => {
    expect(paths([null, 42, [], "x"])).toEqual(["[0]", "[1]", "[2]", "[3]"]);
  });
  it("rejects bad ids", () => {
    for (const id of ["Cuphead", "cup head", "-cup", "cup--head", "cup-", " cup", "cup ", "", 3, undefined, null]) {
      const input = [{ ...base(), id }];
      expect(paths(input), String(id)).toContain("[0].id");
    }
  });
  it("rejects bad names", () => {
    for (const name of [undefined, "", "   ", 7, null, "가".repeat(101)]) {
      expect(paths([{ ...base(), name }]), String(name)).toContain("[0].name");
    }
  });
  it("rejects unknown keys", () => {
    expect(paths([{ ...base(), orig: "x", genre: "y" }])).toEqual(["[0].orig", "[0].genre"]);
  });
  it("requires firstPlayed key; rejects invalid dates", () => {
    const noKey: Record<string, unknown> = base();
    delete noKey.firstPlayed;
    expect(paths([noKey])).toEqual(["[0].firstPlayed"]);
    expect(paths([{ ...base(), firstPlayed: undefined }])).toEqual(["[0].firstPlayed"]);
    expect(paths([{ ...base(), firstPlayed: "2025-02-30" }])).toEqual(["[0].firstPlayed"]);
    expect(paths([{ ...base(), firstPlayed: 20250101 }])).toEqual(["[0].firstPlayed"]);
  });
  it("rejects bad status", () => {
    for (const status of ["cleared", null, "", undefined, 1, "Endless", "endless "]) {
      expect(paths([{ ...base(), status }]), String(status)).toEqual(["[0].status"]);
    }
  });
  it("rejects missing or non-array vods", () => {
    const noVods: Record<string, unknown> = base();
    delete noVods.vods;
    expect(paths([noVods])).toEqual(["[0].vods"]);
    expect(paths([{ ...base(), vods: {} }])).toEqual(["[0].vods"]);
    expect(paths([{ ...base(), vods: null }])).toEqual(["[0].vods"]);
  });
  it("rejects bad originalTitle", () => {
    expect(paths([{ ...base(), originalTitle: "컵헤드" }])).toEqual(["[0].originalTitle"]);
    expect(paths([{ ...base(), name: "PLACE", originalTitle: "PLACE" }])).toEqual(["[0].originalTitle"]);
    expect(paths([{ ...base(), name: "PLACE", originalTitle: " PLACE " }])).toEqual(["[0].originalTitle"]);
    expect(paths([{ ...base(), originalTitle: "   " }])).toEqual(["[0].originalTitle"]);
    expect(paths([{ ...base(), originalTitle: null }])).toEqual(["[0].originalTitle"]);
    expect(paths([{ ...base(), originalTitle: 5 }])).toEqual(["[0].originalTitle"]);
    expect(paths([{ ...base(), originalTitle: "a".repeat(201) }])).toEqual(["[0].originalTitle"]);
    expect(validateGames([{ ...base(), originalTitle: "a".repeat(200) }]).ok).toBe(true);
  });
  it("rejects bad categoryId", () => {
    for (const categoryId of [null, "", "  ", 3]) {
      expect(paths([{ ...base(), categoryId }]), String(categoryId)).toEqual(["[0].categoryId"]);
    }
  });
  it("rejects bad posterUrl", () => {
    for (const posterUrl of [
      "http://a.com/x.jpg",
      "//cdn/x.jpg",
      "",
      null,
      3,
      "javascript:alert(1)",
      "https://a.com/x.jpg",
      "https://pstatic.net.evil.com/x.jpg",
      "https://evilpstatic.net/x.jpg",
      "https://user:pw@nng-phinf.pstatic.net/x.jpg",
      "https://user@nng-phinf.pstatic.net/x.jpg",
    ]) {
      expect(paths([{ ...base(), posterUrl }]), String(posterUrl)).toEqual(["[0].posterUrl"]);
    }
  });
});

const vod = (o: Record<string, unknown> = {}) => ({ title: "t", url: "https://youtu.be/dQw4w9WgXcQ", date: "2025-09-01", ...o });

describe("validateGames: vods", () => {
  it("rejects non-youtube / malformed urls", () => {
    const bad = [
      "https://chzzk.naver.com/video/12345",
      "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
      "javascript:alert(1)",
      "not a url",
      "",
      42,
      null,
      undefined,
    ];
    for (const url of bad) {
      expect(paths([{ ...base(), vods: [vod({ url })] }]), String(url)).toEqual(["[0].vods[0].url"]);
    }
  });
  it("rejects firstPlayed and vod dates with leading/trailing garbage", () => {
    for (const d of TRAILING_BAD_DATES) {
      expect(paths([{ ...base(), firstPlayed: d }]), JSON.stringify(d)).toEqual(["[0].firstPlayed"]);
      expect(paths([{ ...base(), vods: [vod({ date: d })] }]), JSON.stringify(d)).toEqual(["[0].vods[0].date"]);
    }
  });
  it("rejects vod urls whose id is not exactly 11 chars", () => {
    for (const vid of ["abcdefghij", "abcdefghijkl", "!abcdefghij", ""]) {
      for (const url of [`https://www.youtube.com/watch?v=${vid}`, `https://youtu.be/${vid}`]) {
        expect(paths([{ ...base(), vods: [vod({ url })] }]), url).toEqual(["[0].vods[0].url"]);
      }
    }
  });
  it("rejects bad vod dates", () => {
    for (const date of ["2025.09.23", "2025-02-30", "", undefined, 20250923]) {
      expect(paths([{ ...base(), vods: [vod({ date })] }]), String(date)).toEqual(["[0].vods[0].date"]);
    }
  });
  it("rejects bad vod titles and enforces 200/201 boundary", () => {
    for (const title of ["", "   ", undefined, 3, "a".repeat(201)]) {
      expect(paths([{ ...base(), vods: [vod({ title })] }]), String(title)).toEqual(["[0].vods[0].title"]);
    }
  });
  it("rejects unknown vod keys", () => {
    expect(paths([{ ...base(), vods: [vod({ platform: "yt" })] }])).toEqual(["[0].vods[0].platform"]);
  });
  it("rejects non-object vod elements", () => {
    expect(paths([{ ...base(), vods: [null, 3] }])).toEqual(["[0].vods[0]", "[0].vods[1]"]);
  });
  it("rejects vod dated before firstPlayed (but not when firstPlayed is null)", () => {
    const g = { ...base(), firstPlayed: "2025-09-23", vods: [vod({ date: "2025-09-22" })] };
    expect(paths([g])).toEqual(["[0].vods[0].date"]);
    expect(validateGames([{ ...g, firstPlayed: null }]).ok).toBe(true);
  });
  it("does not double-report a malformed vod date against firstPlayed", () => {
    const g = { ...base(), vods: [vod({ date: "bad" })] };
    expect(paths([g])).toEqual(["[0].vods[0].date"]);
  });
  it("rejects duplicate video within one game, even across url forms", () => {
    const g = { ...base(), vods: [vod(), vod({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" })] };
    expect(paths([g])).toEqual(["[0].vods[1].url"]);
  });
  it("does not report duplicates for invalid urls twice", () => {
    const g = { ...base(), vods: [vod({ url: "x" }), vod({ url: "x" })] };
    expect(paths([g])).toEqual(["[0].vods[0].url", "[0].vods[1].url"]);
  });
});

describe("validateGames: cross-element rules", () => {
  it("flags duplicate id on the later element only", () => {
    const i = issues([base(), base()]);
    expect(i.map((x) => x.path)).toEqual(["[1].id"]);
    expect(i[0].message).toContain("[0]");
  });
  it("flags duplicate categoryId on the later element only", () => {
    const a = { ...base(), categoryId: "X" };
    const b = { ...base(), id: "other", categoryId: "X" };
    expect(paths([a, b])).toEqual(["[1].categoryId"]);
  });
  it("trims before comparing categoryId", () => {
    expect(paths([{ ...base(), categoryId: "X" }, { ...base(), id: "o", categoryId: " X " }])).toEqual(["[1].categoryId"]);
  });
  it("collects issues from many places in element order", () => {
    const r = paths([
      { ...base(), name: "" },
      { ...base(), id: "ok", status: "bad" },
      { ...base(), id: "ok2", firstPlayed: "nope" },
    ]);
    expect(r).toEqual(["[0].name", "[1].status", "[2].firstPlayed"]);
  });
  it("still reports duplicate ids when other fields of the element are invalid", () => {
    expect(paths([base(), { ...base(), name: "" }])).toEqual(["[1].name", "[1].id"]);
  });
});

const G = (o: Partial<Game> & { id: string }): Game => ({ name: o.id, firstPlayed: null, status: "unknown", vods: [], ...o });

describe("parseGames / GamesValidationError", () => {
  it("returns normalized games and leaves input untouched", () => {
    const input = [{ ...base(), name: " 컵헤드 " }];
    const copy = structuredClone(input);
    expect(parseGames(input)).toEqual([{ ...base(), name: "컵헤드" }]);
    expect(input).toEqual(copy);
  });
  it("throws GamesValidationError carrying every issue", () => {
    const input = [{ ...base(), id: "Bad" }, { ...base(), name: "" }];
    let err: unknown;
    try {
      parseGames(input);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(GamesValidationError);
    expect(err).toBeInstanceOf(Error);
    const e = err as GamesValidationError;
    expect(e.name).toBe("GamesValidationError");
    expect(e.issues).toHaveLength(issues(input).length);
    expect(e.message).toContain("[0].id");
    expect(e.message).toContain("[1].name");
    expect(e.message.split("\n")).toHaveLength(e.issues.length);
  });
});

describe("compareCanonical", () => {
  it("orders newer dates first and null last", () => {
    const a = G({ id: "a", firstPlayed: "2026-10-23" });
    const b = G({ id: "b", firstPlayed: "2025-10-08" });
    const n = G({ id: "n" });
    expect(compareCanonical(a, b)).toBeLessThan(0);
    expect(compareCanonical(b, a)).toBeGreaterThan(0);
    expect(compareCanonical(b, n)).toBeLessThan(0);
    expect(compareCanonical(n, b)).toBeGreaterThan(0);
  });
  it("breaks date ties by name using ko numeric collation", () => {
    const d = "2025-01-01";
    expect(compareCanonical(G({ id: "x", name: "게임 2", firstPlayed: d }), G({ id: "y", name: "게임 10", firstPlayed: d }))).toBeLessThan(0);
    const names = ["Apple", "파멸", "가", "ㄱ", "60 Parsecs!", "10", "2", "zebra"];
    const sorted = names.map((name, i) => G({ id: `g${i}`, name })).sort(compareCanonical).map((g) => g.name);
    expect(sorted).toEqual(["2", "10", "60 Parsecs!", "ㄱ", "가", "파멸", "Apple", "zebra"]);
  });
  it("orders null-dated games among themselves by name", () => {
    expect(compareCanonical(G({ id: "a", name: "나" }), G({ id: "b", name: "가" }))).toBeGreaterThan(0);
  });
  it("breaks name ties by id and returns 0 for identical", () => {
    expect(compareCanonical(G({ id: "a", name: "같음" }), G({ id: "b", name: "같음" }))).toBeLessThan(0);
    expect(compareCanonical(G({ id: "b", name: "같음" }), G({ id: "a", name: "같음" }))).toBeGreaterThan(0);
    expect(compareCanonical(G({ id: "a" }), G({ id: "a" }))).toBe(0);
  });
});

describe("serializeGames", () => {
  it("outputs [] newline for empty list", () => {
    expect(serializeGames([])).toBe("[]\n");
  });
  it("sorts canonically: newest first, then undated", () => {
    const out = JSON.parse(serializeGames([G({ id: "n" }), G({ id: "old", firstPlayed: "2025-01-01" }), G({ id: "new", firstPlayed: "2026-01-01" })]));
    expect(out.map((g: Game) => g.id)).toEqual(["new", "old", "n"]);
  });
  it("uses 2-space indent and trailing newline", () => {
    const text = serializeGames([G({ id: "a" })]);
    expect(text.startsWith('[\n  {\n    "id":')).toBe(true);
    expect(text.endsWith("]\n")).toBe(true);
  });
  it("fixes key order and omits absent optional keys", () => {
    const messy = {
      vods: [{ date: "2025-09-01", url: "https://youtu.be/dQw4w9WgXcQ", title: "t" }],
      status: "clear",
      posterUrl: "https://nng-phinf.pstatic.net/p.jpg",
      firstPlayed: "2025-08-01",
      categoryId: "C",
      originalTitle: "Orig",
      name: "이름",
      id: "x",
    };
    const parsed = JSON.parse(serializeGames([messy as unknown as Game]));
    expect(Object.keys(parsed[0])).toEqual(["id", "name", "originalTitle", "categoryId", "posterUrl", "firstPlayed", "status", "vods"]);
    expect(Object.keys(parsed[0].vods[0])).toEqual(["title", "url", "date"]);
    const min = JSON.parse(serializeGames([G({ id: "m" })]));
    expect(Object.keys(min[0])).toEqual(["id", "name", "firstPlayed", "status", "vods"]);
  });
  it("sorts vods by date ascending, stable for equal dates", () => {
    const v = (title: string, id: string, date: string) => ({ title, url: `https://youtu.be/${id.padEnd(11, "x")}`, date });
    const g = G({ id: "a", vods: [v("c", "c", "2025-03-01"), v("a1", "a", "2025-01-01"), v("b", "b", "2025-02-01"), v("a2", "d", "2025-01-01")] });
    const out = JSON.parse(serializeGames([g]));
    expect(out[0].vods.map((x: { title: string }) => x.title)).toEqual(["a1", "a2", "b", "c"]);
  });
  it("is idempotent", () => {
    const games = [G({ id: "n" }), G({ id: "a", firstPlayed: "2025-01-01", name: "가" })];
    const once = serializeGames(games);
    expect(serializeGames(JSON.parse(once))).toBe(once);
  });
  it("throws on invalid data and does not mutate input", () => {
    expect(() => serializeGames([G({ id: "Bad Id" })])).toThrow(GamesValidationError);
    const input = [G({ id: "b", firstPlayed: "2025-01-01" }), G({ id: "a", firstPlayed: "2026-01-01" })];
    const copy = structuredClone(input);
    serializeGames(input);
    expect(input).toEqual(copy);
  });
});

describe("compareName", () => {
  const n = (id: string, name: string): Game => ({ id, name, firstPlayed: null, status: "unknown", vods: [] });
  it("ko numeric collation on name first", () => {
    expect(compareName(n("z", "게임 2"), n("a", "게임 10"))).toBeLessThan(0);
    expect(compareName(n("a", "게임 10"), n("z", "게임 2"))).toBeGreaterThan(0);
  });
  it("breaks name ties by id code point (not UTF-16)", () => {
    expect(compareName(n("\uFFB1", "같음"), n("\u{20000}", "같음"))).toBeLessThan(0);
    expect(compareName(n("\u{20000}", "같음"), n("\uFFB1", "같음"))).toBeGreaterThan(0);
    expect(compareName(n("ab", "같음"), n("abc", "같음"))).toBeLessThan(0);
  });
  it("returns 0 only when name and id are equal", () => {
    expect(compareName(n("a", "같음"), n("a", "같음"))).toBe(0);
  });
});

describe("isPosterUrl", () => {
  it("accepts https on pstatic.net or its subdomains, with query", () => {
    for (const u of ["https://nng-phinf.pstatic.net/x.png", "https://pstatic.net/x.png", "https://a.b.pstatic.net/x.png?type=f&w=1"]) {
      expect(isPosterUrl(u), u).toBe(true);
    }
  });
  it("rejects other hosts, credentials, non-https and non-strings", () => {
    for (const u of [
      "https://example.com/x.png",
      "https://pstatic.net.evil.com/x.png",
      "https://xpstatic.net/x.png",
      "https://u:p@nng-phinf.pstatic.net/x.png",
      "https://u@nng-phinf.pstatic.net/x.png",
      "http://nng-phinf.pstatic.net/x.png",
      "not a url",
      undefined,
      42,
    ]) {
      expect(isPosterUrl(u), String(u)).toBe(false);
    }
  });
});

// ---------- D1 전환: validateCandidate / isChzzkUrl ----------
import { CHZZK_VOD_MESSAGE, isChzzkUrl, validateCandidate } from "./schema.ts";

describe("validateCandidate", () => {
  const base = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: `이름 ${id}`, firstPlayed: null, status: "unknown", vods: [], ...extra });
  const others = [base("a", { categoryId: "CatA" }), base("b")] as never[];

  it("returns [] for a valid candidate", () => {
    expect(validateCandidate(others, base("c"))).toEqual([]);
  });
  it("returns [] with no others", () => {
    expect(validateCandidate([], base("c"))).toEqual([]);
  });
  it("strips the index prefix from field paths", () => {
    expect(validateCandidate(others, base("c", { name: " " }))).toEqual([{ path: "name", message: expect.any(String) }]);
  });
  it("reports nested vod paths without prefix", () => {
    const issues = validateCandidate(others, base("c", { vods: [{ title: "t", url: "https://chzzk.naver.com/video/1", date: "2026-01-01" }] }));
    expect(issues.map((i) => i.path)).toEqual(["vods[0].url"]);
  });
  it("reports duplicate categoryId on the candidate (others first)", () => {
    expect(validateCandidate(others, base("c", { categoryId: "CatA" }))).toEqual([{ path: "categoryId", message: expect.stringContaining("중복") }]);
  });
  it("reports duplicate id on the candidate", () => {
    expect(validateCandidate(others, base("a")).map((i) => i.path)).toEqual(["id"]);
  });
  it("ignores issues that belong to other games", () => {
    const broken = [base("x", { name: "" })] as never[];
    expect(validateCandidate(broken, base("c"))).toEqual([]);
  });
  it("does not confuse [1] with [10]", () => {
    const many = Array.from({ length: 10 }, (_, i) => base(`g${i}`)) as never[];
    const bad = [base("bad", { name: "" }), ...many.slice(1)] as never[];
    expect(validateCandidate(bad.slice(0, 1), base("ok"))).toEqual([]);
  });
  it("maps a non-object candidate to path ''", () => {
    expect(validateCandidate(others, 5)).toEqual([{ path: "", message: "객체여야 합니다" }]);
  });
  it("keeps vod date earlier than first play", () => {
    const c = base("c", { firstPlayed: "2026-02-01", vods: [{ title: "t", url: "https://youtu.be/abcdefghijk", date: "2026-01-01" }] });
    expect(validateCandidate(others, c)).toEqual([{ path: "vods[0].date", message: expect.stringContaining("2026-02-01") }]);
  });
});

describe("isChzzkUrl", () => {
  it.each([
    ["https://chzzk.naver.com/video/123", true],
    ["  https://chzzk.naver.com/live/abc  ", true],
    ["https://m.chzzk.naver.com/video/1", true],
    ["chzzk.naver.com/video/1", true],
    ["http://chzzk.naver.com/", true],
    ["https://youtu.be/abcdefghijk", false],
    ["https://notchzzk.naver.com/video/1", false],
    ["https://chzzk.naver.com.evil.example/", false],
    ["https://naver.com/chzzk.naver.com", false],
    ["", false],
    ["http://[", false],
  ])("%s → %s", (url, want) => {
    expect(isChzzkUrl(url)).toBe(want);
  });
  it("non-string → false", () => {
    expect(isChzzkUrl(undefined)).toBe(false);
  });
  it("message is the fixed copy", () => {
    expect(CHZZK_VOD_MESSAGE).toBe("치지직 다시보기는 한 달 뒤 사라져요. 유튜브 링크만 넣을 수 있어요.");
  });
});
