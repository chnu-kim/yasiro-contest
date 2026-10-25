import { describe, expect, it, vi } from "vitest";
import {
  CandidateSelectionError,
  selectCandidate,
  ChzzkAuthError,
  ChzzkCategoryError,
  ChzzkHttpError,
  ChzzkNetworkError,
  ChzzkResponseError,
  GameConflictError,
  GameDraftError,
  searchCategories,
  slugify,
  toGameDraft,
  upsertGame,
} from "./chzzk-category.ts";
import { ID_PATTERN } from "./games/schema.ts";
import type { ChzzkCategory, ChzzkCategoryConfig, FetchLike, Game, GameDraft, Vod } from "./games/types.ts";

const config: ChzzkCategoryConfig = { clientId: "cid", clientSecret: "SECRET-XYZ" };

function stub(body: unknown, status = 200) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const fn = vi.fn<FetchLike>(async () => new Response(text, { status }));
  return fn;
}
function ok(data: unknown[]) {
  return { code: 200, message: null, content: { data } };
}
const SB = {
  categoryType: "GAME",
  categoryId: "Stellar_Blade",
  categoryValue: "스텔라 블레이드",
  posterImageUrl: "https://nng-phinf.pstatic.net/sb.jpg",
};
const SH = {
  categoryType: "GAME",
  categoryId: "SILENT_HILL_f",
  categoryValue: "사일런트 힐 f",
  posterImageUrl: "https://nng-phinf.pstatic.net/sh.jpg",
};

describe("searchCategories 정상", () => {
  it("GAME 2건을 반환한다", async () => {
    const f = stub(ok([SB, SH]));
    expect(await searchCategories(f, config, "스텔라")).toEqual([SB, SH]);
  });

  it("URL: origin/pathname/query/size 기본 20", async () => {
    const f = stub(ok([]));
    await searchCategories(f, config, "스텔라");
    const u = new URL(f.mock.calls[0][0]);
    expect(u.origin).toBe("https://openapi.chzzk.naver.com");
    expect(u.pathname).toBe("/open/v1/categories/search");
    expect(u.searchParams.get("query")).toBe("스텔라");
    expect(u.searchParams.get("size")).toBe("20");
  });

  it("헤더와 GET 메서드", async () => {
    const f = stub(ok([]));
    await searchCategories(f, config, "x");
    const init = f.mock.calls[0][1]!;
    expect(init.method).toBe("GET");
    expect(init.headers).toEqual({ "Client-Id": "cid", "Client-Secret": "SECRET-XYZ" });
  });

  it.each([1, 50])("size=%i 가 URL에 반영된다", async (size) => {
    const f = stub(ok([]));
    await searchCategories(f, config, "x", size);
    expect(new URL(f.mock.calls[0][0]).searchParams.get("size")).toBe(String(size));
  });

  it("baseUrl 끝 슬래시를 정리하고 해당 주소로 호출한다", async () => {
    const f = stub(ok([]));
    await searchCategories(f, { ...config, baseUrl: "http://localhost:9999/" }, "x");
    const u = new URL(f.mock.calls[0][0]);
    expect(u.origin).toBe("http://localhost:9999");
    expect(u.pathname).toBe("/open/v1/categories/search");
  });

  it("query를 trim해서 보낸다", async () => {
    const f = stub(ok([]));
    await searchCategories(f, config, "  스텔라 ");
    expect(new URL(f.mock.calls[0][0]).searchParams.get("query")).toBe("스텔라");
  });

  it("특수 문자 질의가 인코딩되어 원문 그대로 복원된다", async () => {
    const f = stub(ok([]));
    await searchCategories(f, config, "A&B=C?");
    expect(new URL(f.mock.calls[0][0]).searchParams.get("query")).toBe("A&B=C?");
  });
});

describe("searchCategories 입력 검증 (fetch 호출 전)", () => {
  it.each(["", "   "])("빈 query %j 는 RangeError, fetch 0회", async (q) => {
    const f = stub(ok([]));
    await expect(searchCategories(f, config, q)).rejects.toBeInstanceOf(RangeError);
    expect(f).not.toHaveBeenCalled();
  });

  it.each([0, 51, 1.5, NaN, -1, Infinity])("size=%s 는 RangeError, fetch 0회", async (size) => {
    const f = stub(ok([]));
    await expect(searchCategories(f, config, "x", size)).rejects.toBeInstanceOf(RangeError);
    expect(f).not.toHaveBeenCalled();
  });

  it("clientId가 비면 ChzzkAuthError, fetch 0회", async () => {
    const f = stub(ok([]));
    await expect(searchCategories(f, { ...config, clientId: "" }, "x")).rejects.toBeInstanceOf(ChzzkAuthError);
    expect(f).not.toHaveBeenCalled();
  });

  it("clientSecret이 공백뿐이면 ChzzkAuthError, fetch 0회, 메시지에 secret 없음", async () => {
    const f = stub(ok([]));
    const err = await searchCategories(f, { ...config, clientSecret: "  " }, "x").catch((e) => e);
    expect(err).toBeInstanceOf(ChzzkAuthError);
    expect(err.message).toContain(".dev.vars");
    expect(f).not.toHaveBeenCalled();
  });
});

describe("searchCategories 전송 실패", () => {
  it("fetch reject는 ChzzkNetworkError로 감싸고 cause에 원래 에러의 이름·메시지를 담는다", async () => {
    const original = new TypeError("fetch failed");
    const f = vi.fn<FetchLike>(async () => {
      throw original;
    });
    const err = await searchCategories(f, config, "x").catch((e) => e);
    expect(err).toBeInstanceOf(ChzzkNetworkError);
    expect(err.cause).toBeInstanceOf(Error);
    expect(err.cause.name).toBe("TypeError");
    expect(err.cause.message).toBe("fetch failed");
    expect(err.message).toContain("fetch failed");
  });

  it("cause에 원본 객체를 보관하지 않아 secret이 남지 않는다", async () => {
    const original = Object.assign(new Error("bad header SECRET-XYZ / cid"), { headers: { "Client-Secret": "SECRET-XYZ" } });
    const f = vi.fn<FetchLike>(async () => {
      throw original;
    });
    const err = await searchCategories(f, config, "x").catch((e) => e);
    expect(err.cause).not.toBe(original);
    expect(err.cause.message).not.toContain("SECRET-XYZ");
    expect(JSON.stringify(err.cause, Object.getOwnPropertyNames(err.cause))).not.toContain("SECRET-XYZ");
    expect(err.cause.stack ?? "").not.toContain("SECRET-XYZ");
    expect(err.message).not.toContain("SECRET-XYZ");
  });

  it("reject 값이 Error가 아니어도 감싸고, 문자열 cause도 가린다", async () => {
    const f = vi.fn<FetchLike>(async () => {
      throw "boom SECRET-XYZ";
    });
    const err = await searchCategories(f, config, "x").catch((e) => e);
    expect(err).toBeInstanceOf(ChzzkNetworkError);
    expect(err.cause).toBe("boom ***");
    expect(err.message).toContain("boom");
    expect(err.message).not.toContain("SECRET-XYZ");
  });

  it.each([401, 403])("HTTP %i 는 ChzzkAuthError", async (status) => {
    await expect(searchCategories(stub({}, status), config, "x")).rejects.toBeInstanceOf(ChzzkAuthError);
  });

  it.each([500, 429])("HTTP %i 는 ChzzkHttpError(status)", async (status) => {
    const err = await searchCategories(stub("oops", status), config, "x").catch((e) => e);
    expect(err).toBeInstanceOf(ChzzkHttpError);
    expect(err.status).toBe(status);
    expect(err.message).toContain(String(status));
  });

  it("HTTP 오류 본문은 200자까지만 메시지에 넣는다", async () => {
    const err = await searchCategories(stub("a".repeat(500), 500), config, "x").catch((e) => e);
    expect(err.message).toContain("a".repeat(200));
    expect(err.message).not.toContain("a".repeat(201));
  });

  it("본문을 읽을 수 없어도 HTTP 오류는 ChzzkHttpError", async () => {
    const res = new Response("x", { status: 502 });
    vi.spyOn(res, "text").mockRejectedValue(new Error("stream"));
    const f = vi.fn<FetchLike>(async () => res);
    const err = await searchCategories(f, config, "x").catch((e) => e);
    expect(err).toBeInstanceOf(ChzzkHttpError);
    expect(err.status).toBe(502);
  });

  it("오류 본문에 secret이 메아리쳐도 ***로 가린다", async () => {
    const err = await searchCategories(stub("bad SECRET-XYZ here", 500), config, "x").catch((e) => e);
    expect(err.message).not.toContain("SECRET-XYZ");
    expect(err.message).toContain("***");
    expect(String(err)).not.toContain("SECRET-XYZ");
  });

  it("401 본문의 secret도 가린다", async () => {
    const err = await searchCategories(stub("SECRET-XYZ", 401), config, "x").catch((e) => e);
    expect(err).toBeInstanceOf(ChzzkAuthError);
    expect(err.message).not.toContain("SECRET-XYZ");
  });

  it("clientId도 메시지에 나오지 않는다", async () => {
    const err = await searchCategories(stub("cid", 500), config, "x").catch((e) => e);
    expect(err.message).not.toContain("cid");
  });

  it("에러 이름이 클래스 이름과 같고 모두 ChzzkCategoryError", () => {
    expect(new ChzzkAuthError("m").name).toBe("ChzzkAuthError");
    expect(new ChzzkHttpError("m", 500).name).toBe("ChzzkHttpError");
    expect(new ChzzkNetworkError("m", 1).name).toBe("ChzzkNetworkError");
    expect(new ChzzkCategoryError("m").name).toBe("ChzzkCategoryError");
    expect(new ChzzkHttpError("m", 500)).toBeInstanceOf(ChzzkCategoryError);
    expect(new ChzzkNetworkError("m", 1)).toBeInstanceOf(ChzzkCategoryError);
  });
});

describe("searchCategories 응답 해석", () => {
  it("GAME만 남기고 API 순서를 유지한다", async () => {
    const etc = { ...SB, categoryType: "ETC", categoryId: "talk", categoryValue: "talk" };
    const sports = { ...SB, categoryType: "SPORTS", categoryId: "soccer", categoryValue: "축구" };
    const f = stub(ok([SH, etc, SB, sports]));
    expect(await searchCategories(f, config, "x")).toEqual([SH, SB]);
  });

  it("GAME이 없으면 []", async () => {
    const etc = { ...SB, categoryType: "ETC" };
    expect(await searchCategories(stub(ok([etc])), config, "x")).toEqual([]);
  });

  it("data가 빈 배열이면 []", async () => {
    expect(await searchCategories(stub(ok([])), config, "x")).toEqual([]);
  });

  it("posterImageUrl이 null이거나 키가 없으면 null", async () => {
    const noKey: Record<string, unknown> = { ...SB };
    delete noKey.posterImageUrl;
    const r = await searchCategories(stub(ok([{ ...SH, posterImageUrl: null }, noKey])), config, "x");
    expect(r.map((c) => c.posterImageUrl)).toEqual([null, null]);
  });

  it.each([
    "http://x.com/a.jpg",
    "",
    "not url",
    "javascript:alert(1)",
    123,
    "https://evil.example.com/a.jpg",
    "https://pstatic.net.evil.com/a.jpg",
    "https://user:pw@nng-phinf.pstatic.net/a.jpg",
  ])(
    "허용되지 않는 posterImageUrl %j 는 null (https + pstatic.net 호스트만)",
    async (poster) => {
      const r = await searchCategories(stub(ok([{ ...SB, posterImageUrl: poster }])), config, "x");
      expect(r[0].posterImageUrl).toBeNull();
    },
  );

  it("https posterImageUrl은 그대로 유지한다", async () => {
    const r = await searchCategories(stub(ok([SB])), config, "x");
    expect(r[0].posterImageUrl).toBe("https://nng-phinf.pstatic.net/sb.jpg");
  });

  it("응답 항목에서 알 수 없는 필드는 버린다", async () => {
    const r = await searchCategories(stub(ok([{ ...SB, extra: 1 }])), config, "x");
    expect(r[0]).toEqual(SB);
  });
});

describe("searchCategories 응답 오류", () => {
  it("JSON이 아니면 ChzzkResponseError", async () => {
    const err = await searchCategories(stub("<html>"), config, "x").catch((e) => e);
    expect(err).toBeInstanceOf(ChzzkResponseError);
    expect(err.message).toContain("JSON");
  });

  it("200 응답의 body.code 401은 ChzzkAuthError", async () => {
    const err = await searchCategories(stub({ code: 401, message: "INVALID_CLIENT" }), config, "x").catch((e) => e);
    expect(err).toBeInstanceOf(ChzzkAuthError);
    expect(err.message).toContain("INVALID_CLIENT");
  });

  it("body.code 403도 ChzzkAuthError", async () => {
    await expect(searchCategories(stub({ code: 403, message: "m" }), config, "x")).rejects.toBeInstanceOf(
      ChzzkAuthError,
    );
  });

  it("body.code 500은 ChzzkResponseError이고 code와 message가 들어간다", async () => {
    const err = await searchCategories(stub({ code: 500, message: "boom" }), config, "x").catch((e) => e);
    expect(err).toBeInstanceOf(ChzzkResponseError);
    expect(err.message).toContain("500");
    expect(err.message).toContain("boom");
  });

  it("message가 없는 비정상 code도 처리한다", async () => {
    const err = await searchCategories(stub({ code: 500 }), config, "x").catch((e) => e);
    expect(err).toBeInstanceOf(ChzzkResponseError);
  });

  it("code 메시지에 secret이 섞여도 가린다", async () => {
    const err = await searchCategories(stub({ code: 500, message: "SECRET-XYZ" }), config, "x").catch((e) => e);
    expect(err.message).not.toContain("SECRET-XYZ");
  });

  it.each([["null", null], ["array", []], ["string", "str"], ["number", 42]])(
    "body가 %s 이면 ChzzkResponseError",
    async (_n, body) => {
      await expect(searchCategories(stub(body), config, "x")).rejects.toBeInstanceOf(ChzzkResponseError);
    },
  );

  it.each([
    ["content 누락", { code: 200 }],
    ["content null", { code: 200, content: null }],
    ["data 누락", { code: 200, content: {} }],
    ["data {}", { code: 200, content: { data: {} } }],
    ["data null", { code: 200, content: { data: null } }],
  ])("%s 이면 ChzzkResponseError", async (_n, body) => {
    await expect(searchCategories(stub(body), config, "x")).rejects.toBeInstanceOf(ChzzkResponseError);
  });

  it.each([
    ["categoryId 누락", { ...SB, categoryId: undefined }],
    ["categoryId 빈 문자열", { ...SB, categoryId: "  " }],
    ["categoryValue 숫자", { ...SB, categoryValue: 7 }],
    ["categoryType null", { ...SB, categoryType: null }],
    ["항목이 null", null],
    ["항목이 문자열", "x"],
  ])("항목 %s 이면 index가 들어간 ChzzkResponseError", async (_n, bad) => {
    const err = await searchCategories(stub(ok([SH, bad])), config, "x").catch((e) => e);
    expect(err).toBeInstanceOf(ChzzkResponseError);
    expect(err.message).toContain("[1]");
  });

  it("GAME이 아닌 항목은 categoryId·categoryValue가 깨져 있어도 무시한다", async () => {
    const etcNoFields = { categoryType: "ETC" };
    const sportsBad = { categoryType: "SPORTS", categoryId: 3, categoryValue: null };
    expect(await searchCategories(stub(ok([etcNoFields, SH, sportsBad])), config, "x")).toEqual([SH]);
  });

  it("GAME 항목의 필수 필드 누락은 여전히 거부한다", async () => {
    const err = await searchCategories(stub(ok([{ categoryType: "ETC" }, { categoryType: "GAME", categoryId: "x" }])), config, "x").catch((e) => e);
    expect(err).toBeInstanceOf(ChzzkResponseError);
    expect(err.message).toContain("[1]");
  });

  it("모든 에러 인스턴스는 ChzzkCategoryError이고 secret을 노출하지 않는다", async () => {
    const cases: Array<Promise<unknown>> = [
      searchCategories(stub("<html>SECRET-XYZ"), config, "x"),
      searchCategories(stub({ code: 401, message: "SECRET-XYZ" }), config, "x"),
      searchCategories(stub("SECRET-XYZ", 500), config, "x"),
      searchCategories(stub("SECRET-XYZ", 403), config, "x"),
      searchCategories(stub(ok([{ SECRET: "SECRET-XYZ" }])), config, "x"),
    ];
    for (const c of cases) {
      const err = (await c.catch((e) => e)) as Error;
      expect(err).toBeInstanceOf(ChzzkCategoryError);
      expect(err.message).not.toContain("SECRET-XYZ");
      expect(String(err)).not.toContain("SECRET-XYZ");
    }
  });
});

describe("slugify", () => {
  it.each([
    ["Stellar Blade", "stellar-blade"],
    ["SILENT HILL f", "silent-hill-f"],
    ["Gal*Gun 2", "gal-gun-2"],
    ["There Is No Game: Wrong Dimension", "there-is-no-game-wrong-dimension"],
    ["링 피트 어드벤처", "링-피트-어드벤처"],
    ["  --Hello__World--  ", "hello-world"],
    ["Pokémon", "pokémon"],
    ["60 Parsecs!", "60-parsecs"],
    ["Stellar_Blade", "stellar-blade"],
    ["걸☆건 2", "걸-건-2"],
    ["ゼルダの伝説", "ゼルダの伝説"],
  ])("%j -> %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it.each(["☆*!", "", "   ", "---", "🎮"])("남는 문자가 없으면 빈 문자열 (%j)", (input) => {
    expect(slugify(input)).toBe("");
  });

  it("NFD 입력은 NFC로 합쳐 같은 결과를 낸다", () => {
    expect(slugify("스텔라 블레이드".normalize("NFD"))).toBe("스텔라-블레이드");
    expect(slugify("Pokémon".normalize("NFD"))).toBe("pokémon");
  });

  it("ID_PATTERN을 만족하지 못하는 문자(기호성 숫자, 수정 문자)는 제거한다", () => {
    expect(slugify("a②b")).toBe("ab");
    expect(slugify("x²")).toBe("x");
    expect(slugify("ʰello")).toBe("ello");
    expect(slugify("②")).toBe("");
  });

  it.each(["Stellar Blade", "a  b", "x--y", "Ⅷ Final", "ǅ test", "A²-B", "-a-", "한글 Mix 3D"])(
    "비어 있지 않은 결과는 항상 ID_PATTERN을 통과한다 (%j)",
    (input) => {
      const out = slugify(input);
      if (out !== "") expect(out).toMatch(ID_PATTERN);
    },
  );
});

const STELLAR: ChzzkCategory = {
  categoryType: "GAME",
  categoryId: "Stellar_Blade",
  categoryValue: "스텔라 블레이드",
  posterImageUrl: "https://nng-phinf.pstatic.net/sb.jpg",
};

describe("toGameDraft", () => {
  it("입력으로 draft를 만든다", () => {
    expect(
      toGameDraft(STELLAR, { originalTitle: "Stellar Blade", status: "clear", firstPlayed: "2026-10-21" }),
    ).toEqual({
      id: "stellar-blade",
      name: "스텔라 블레이드",
      categoryId: "Stellar_Blade",
      posterUrl: "https://nng-phinf.pstatic.net/sb.jpg",
      originalTitle: "Stellar Blade",
      status: "clear",
      firstPlayed: "2026-10-21",
      vods: [],
    });
  });

  it("originalTitle이 없으면 id는 categoryId slug", () => {
    const d = toGameDraft(STELLAR);
    expect(d.id).toBe("stellar-blade");
    expect(d.originalTitle).toBeUndefined();
    expect(d.status).toBeUndefined();
    expect(d.firstPlayed).toBeUndefined();
    expect(d.vods).toEqual([]);
  });

  it("input.id가 있으면 그대로 쓴다", () => {
    expect(toGameDraft(STELLAR, { id: "sb", originalTitle: "Stellar Blade" }).id).toBe("sb");
  });

  it("originalTitle이 name과 같으면 생략하고 categoryId slug로 id를 정한다", () => {
    const d = toGameDraft(STELLAR, { originalTitle: "스텔라 블레이드" });
    expect(d.originalTitle).toBeUndefined();
    expect(d.id).toBe("stellar-blade");
  });

  it("name 앞뒤 공백을 trim한 값과도 같으면 생략한다", () => {
    const c = { ...STELLAR, categoryValue: "  스텔라 블레이드 " };
    const d = toGameDraft(c, { originalTitle: " 스텔라 블레이드" });
    expect(d.name).toBe("스텔라 블레이드");
    expect(d.originalTitle).toBeUndefined();
  });

  it("공백뿐인 originalTitle은 생략하고 id는 categoryId로 넘어간다", () => {
    const d = toGameDraft(STELLAR, { originalTitle: "  " });
    expect(d.originalTitle).toBeUndefined();
    expect(d.id).toBe("stellar-blade");
  });

  it("originalTitle을 trim해서 저장한다", () => {
    expect(toGameDraft(STELLAR, { originalTitle: "  Stellar Blade " }).originalTitle).toBe("Stellar Blade");
  });

  it("originalTitle slug가 비면 categoryId slug로 넘어간다", () => {
    const d = toGameDraft(STELLAR, { originalTitle: "☆☆" });
    expect(d.originalTitle).toBe("☆☆");
    expect(d.id).toBe("stellar-blade");
  });

  it("categoryId slug도 비면 name slug(한글)를 쓴다", () => {
    const c = { ...STELLAR, categoryId: "☆", categoryValue: "링 피트 어드벤처" };
    expect(toGameDraft(c).id).toBe("링-피트-어드벤처");
  });

  it("posterImageUrl이 null이면 posterUrl은 undefined", () => {
    expect(toGameDraft({ ...STELLAR, posterImageUrl: null }).posterUrl).toBeUndefined();
  });

  it("firstPlayed null은 undefined와 구분되어 그대로 전달된다", () => {
    expect(toGameDraft(STELLAR, { firstPlayed: null }).firstPlayed).toBeNull();
  });

  it("vods를 그대로 전달한다", () => {
    const vods: Vod[] = [{ title: "t", url: "https://youtu.be/dQw4w9WgXcQ", date: "2026-10-21" }];
    expect(toGameDraft(STELLAR, { vods }).vods).toEqual(vods);
  });

  it("입력 객체를 변경하지 않는다", () => {
    const cat = structuredClone(STELLAR);
    const input = { originalTitle: " X ", vods: [] as Vod[] };
    const copy = structuredClone(input);
    toGameDraft(cat, input);
    expect(cat).toEqual(STELLAR);
    expect(input).toEqual(copy);
  });

  it.each(["Bad Id", "UPPER", "-a", "", "a--b"])("잘못된 input.id %j 는 GameDraftError", (id) => {
    const err = (() => {
      try {
        toGameDraft(STELLAR, { id });
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(GameDraftError);
    expect((err as Error).name).toBe("GameDraftError");
  });

  it("모든 slug가 비면 GameDraftError(--id 필요)", () => {
    const c = { ...STELLAR, categoryId: "☆", categoryValue: "☆" };
    expect(() => toGameDraft(c, { originalTitle: "★" })).toThrow(GameDraftError);
    expect(() => toGameDraft(c)).toThrow(/--id/);
  });
});

const V1: Vod = { title: "1화", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", date: "2026-10-21" };
const V1_SHORT: Vod = { title: "1화(단축)", url: "https://youtu.be/dQw4w9WgXcQ", date: "2026-10-21" };
const V2: Vod = { title: "2화", url: "https://youtu.be/abcdefghijk", date: "2026-10-22" };

function game(over: Partial<Game> = {}): Game {
  return {
    id: "stellar-blade",
    name: "스텔라 블레이드",
    categoryId: "Stellar_Blade",
    posterUrl: "https://nng-phinf.pstatic.net/old.jpg",
    originalTitle: "Stellar Blade",
    firstPlayed: "2026-10-21",
    status: "unknown",
    vods: [V1],
    ...over,
  };
}
function draft(over: Partial<GameDraft> = {}): GameDraft {
  return { id: "stellar-blade", name: "스텔라 블레이드", categoryId: "Stellar_Blade", vods: [], ...over };
}

describe("upsertGame 추가", () => {
  it("빈 목록에 추가하면 기본값 status unknown, firstPlayed null", () => {
    const r = upsertGame([], draft());
    expect(r.action).toBe("added");
    expect(r.games).toHaveLength(1);
    expect(r.game).toBe(r.games[0]);
    expect(r.game).toEqual({
      id: "stellar-blade",
      name: "스텔라 블레이드",
      categoryId: "Stellar_Blade",
      firstPlayed: null,
      status: "unknown",
      vods: [],
    });
  });

  it("undefined인 선택 키는 객체에 들어가지 않는다", () => {
    const g = upsertGame([], draft()).game;
    expect("originalTitle" in g).toBe(false);
    expect("posterUrl" in g).toBe(false);
  });

  it("categoryId가 없는 draft도 선택 키 없이 추가된다", () => {
    const g = upsertGame([], { id: "x", name: "엑스", vods: [] }).game;
    expect("categoryId" in g).toBe(false);
  });

  it("값이 있는 선택 키와 날짜, 상태, vods를 반영한다", () => {
    const r = upsertGame(
      [],
      draft({
        originalTitle: "Stellar Blade",
        posterUrl: "https://x/p.jpg",
        firstPlayed: "2026-10-21",
        status: "clear",
        vods: [V1],
      }),
    );
    expect(r.game).toMatchObject({
      originalTitle: "Stellar Blade",
      posterUrl: "https://x/p.jpg",
      firstPlayed: "2026-10-21",
      status: "clear",
      vods: [V1],
    });
  });

  it("firstPlayed null을 명시하면 null로 추가된다", () => {
    expect(upsertGame([], draft({ firstPlayed: null })).game.firstPlayed).toBeNull();
  });

  it("추가는 배열 끝이며 정렬하지 않는다", () => {
    const a = game({ id: "a", categoryId: "A", firstPlayed: "2020-01-01" });
    const b = game({ id: "b", categoryId: "B", firstPlayed: "2030-01-01" });
    const r = upsertGame([a, b], draft({ id: "c", categoryId: "C" }));
    expect(r.games.map((g) => g.id)).toEqual(["a", "b", "c"]);
    expect(r.games[0]).toBe(a);
  });

  it("추가된 vods는 draft 배열과 분리된 사본이다", () => {
    const d = draft({ vods: [V1] });
    const r = upsertGame([], d);
    expect(r.game.vods).not.toBe(d.vods);
  });

  it("id와 categoryId가 모두 다른 기존 게임이 있어도 추가된다", () => {
    const other = game({ id: "other", categoryId: "Other" });
    expect(upsertGame([other], draft()).action).toBe("added");
  });

  it("categoryId가 없는 기존 게임과 categoryId 없는 draft(id 다름)는 충돌하지 않는다", () => {
    const old = game({ id: "old" });
    delete old.categoryId;
    expect(upsertGame([old], { id: "new", name: "n", vods: [] }).action).toBe("added");
  });
});

describe("upsertGame 갱신", () => {
  it("같은 categoryId면 갱신하고 기존 status/firstPlayed를 유지하며 새 vod를 덧붙인다", () => {
    const old = game({ status: "fail" });
    const r = upsertGame([old], draft({ vods: [V2] }));
    expect(r.action).toBe("updated");
    expect(r.game).toMatchObject({ status: "fail", firstPlayed: "2026-10-21", vods: [V1, V2] });
    expect(r.games[0]).toBe(r.game);
  });

  it("draft.status가 있으면 덮어쓴다", () => {
    expect(upsertGame([game()], draft({ status: "clear" })).game.status).toBe("clear");
  });

  it("draft.firstPlayed가 null이면 기존 날짜를 지운다", () => {
    expect(upsertGame([game()], draft({ firstPlayed: null })).game.firstPlayed).toBeNull();
  });

  it("draft.firstPlayed가 날짜면 갱신한다", () => {
    expect(upsertGame([game()], draft({ firstPlayed: "2026-01-01" })).game.firstPlayed).toBe("2026-01-01");
  });

  it("기존 id를 유지한다 (draft.id가 달라도)", () => {
    const r = upsertGame([game()], draft({ id: "stellar-blade-2" }));
    expect(r.game.id).toBe("stellar-blade");
    expect(r.action).toBe("updated");
  });

  it("name은 draft 값으로 갱신한다", () => {
    expect(upsertGame([game()], draft({ name: "새 이름" })).game.name).toBe("새 이름");
  });

  it("posterUrl/originalTitle은 undefined면 유지하고 값이 있으면 갱신한다", () => {
    const keep = upsertGame([game()], draft()).game;
    expect(keep.posterUrl).toBe("https://nng-phinf.pstatic.net/old.jpg");
    expect(keep.originalTitle).toBe("Stellar Blade");
    const next = upsertGame([game()], draft({ posterUrl: "https://x/new.jpg", originalTitle: "SB" })).game;
    expect(next.posterUrl).toBe("https://x/new.jpg");
    expect(next.originalTitle).toBe("SB");
  });

  it("기존에 선택 키가 없고 draft에도 없으면 키를 만들지 않는다", () => {
    const old = game();
    delete old.posterUrl;
    delete old.originalTitle;
    const g = upsertGame([old], draft()).game;
    expect("posterUrl" in g).toBe(false);
    expect("originalTitle" in g).toBe(false);
  });

  it("categoryId 없는 기존 게임은 id가 같으면 같은 게임으로 보고 categoryId를 연결한다", () => {
    const old = game();
    delete old.categoryId;
    const r = upsertGame([old], draft());
    expect(r.action).toBe("updated");
    expect(r.game.categoryId).toBe("Stellar_Blade");
  });

  it("categoryId 없는 draft가 id만 같은 게임을 갱신하면 기존 categoryId를 유지한다", () => {
    const r = upsertGame([game()], { id: "stellar-blade", name: "n", vods: [] });
    expect(r.action).toBe("updated");
    expect(r.game.categoryId).toBe("Stellar_Blade");
  });

  it("id만 같고 categoryId가 같은 값이면 같은 게임이다", () => {
    expect(upsertGame([game()], draft()).action).toBe("updated");
  });

  it("youtu.be/X 는 기존 watch?v=X 와 같은 영상이라 추가하지 않는다", () => {
    expect(upsertGame([game()], draft({ vods: [V1_SHORT] })).game.vods).toEqual([V1]);
  });

  it("draft.vods 안의 중복 영상은 한 번만 추가한다", () => {
    const dup: Vod = { ...V2, title: "중복", url: "https://www.youtube.com/watch?v=abcdefghijk" };
    expect(upsertGame([game()], draft({ vods: [V2, dup] })).game.vods).toEqual([V1, V2]);
  });

  it("videoId를 얻을 수 없는 URL은 문자열 비교로 중복을 거른다", () => {
    const bad: Vod = { title: "x", url: "https://chzzk.naver.com/video/1", date: "2026-10-22" };
    const once = upsertGame([game()], draft({ vods: [bad] }));
    expect(once.game.vods).toEqual([V1, bad]);
    const twice = upsertGame(once.games, draft({ vods: [bad, bad] }));
    expect(twice.game.vods).toEqual([V1, bad]);
  });

  it("갱신 시 결과 배열의 다른 원소는 같은 참조이고 위치가 유지된다", () => {
    const a = game({ id: "a", categoryId: "A" });
    const b = game();
    const c = game({ id: "c", categoryId: "C" });
    const r = upsertGame([a, b, c], draft({ status: "clear" }));
    expect(r.games[0]).toBe(a);
    expect(r.games[2]).toBe(c);
    expect(r.games[1]).not.toBe(b);
  });

  it("입력 games와 원소, draft를 변경하지 않는다", () => {
    const games = [game(), game({ id: "o", categoryId: "O" })];
    const d = draft({ status: "clear", vods: [V2] });
    const gamesCopy = structuredClone(games);
    const dCopy = structuredClone(d);
    const r = upsertGame(games, d);
    expect(games).toEqual(gamesCopy);
    expect(d).toEqual(dCopy);
    expect(r.games).not.toBe(games);
    expect(games[0].vods).not.toBe(r.game.vods);
  });
});

describe("upsertGame 충돌", () => {
  it("categoryId는 X, id는 Y와 일치하면 GameConflictError", () => {
    const x = game({ id: "x", categoryId: "Stellar_Blade" });
    const y = game({ id: "stellar-blade", categoryId: "Other" });
    const err = (() => {
      try {
        upsertGame([x, y], draft());
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(GameConflictError);
    expect((err as Error).name).toBe("GameConflictError");
  });

  it("id가 같지만 categoryId가 다르면 GameConflictError", () => {
    const old = game({ categoryId: "A" });
    expect(() => upsertGame([old], draft({ categoryId: "B" }))).toThrow(GameConflictError);
  });

  it("충돌 시 입력을 변경하지 않는다", () => {
    const old = [game({ categoryId: "A" })];
    const copy = structuredClone(old);
    expect(() => upsertGame(old, draft({ categoryId: "B" }))).toThrow(GameConflictError);
    expect(old).toEqual(copy);
  });
});

describe("selectCandidate", () => {
  const A: ChzzkCategory = { categoryType: "GAME", categoryId: "A_game", categoryValue: "가", posterImageUrl: null };
  const B: ChzzkCategory = { categoryType: "GAME", categoryId: "2048", categoryValue: "나", posterImageUrl: null };
  const list = [A, B];

  it("categoryId로 고른다 (순서와 무관)", () => {
    expect(selectCandidate(list, { categoryId: "2048" })).toBe(B);
    expect(selectCandidate([B, A], { categoryId: "A_game" })).toBe(A);
  });
  it("pick(1-based)으로 고른다", () => {
    expect(selectCandidate(list, { pick: 1 })).toBe(A);
    expect(selectCandidate(list, { pick: 2 })).toBe(B);
  });
  it("둘 다 주면 서로 일치해야 한다", () => {
    expect(selectCandidate(list, { pick: 2, categoryId: "2048" })).toBe(B);
    expect(() => selectCandidate(list, { pick: 1, categoryId: "2048" })).toThrow(/A_game.*2048|2048.*A_game/);
  });
  it("후보에 없는 categoryId는 실패하고 후보 id를 알려 준다", () => {
    let err: unknown;
    try { selectCandidate(list, { categoryId: "nope" }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(CandidateSelectionError);
    expect((err as Error).message).toContain("nope");
    expect((err as Error).message).toContain("A_game");
    expect((err as Error).name).toBe("CandidateSelectionError");
  });
  it("후보 수를 넘는 pick은 실패", () => {
    expect(() => selectCandidate(list, { pick: 3 })).toThrow(CandidateSelectionError);
    expect(() => selectCandidate(list, { pick: 3 })).toThrow(/2/);
  });
  it("아무것도 지정하지 않으면 실패", () => {
    expect(() => selectCandidate(list, {})).toThrow(CandidateSelectionError);
  });
  it("입력 목록을 변경하지 않는다", () => {
    const copy = [...list];
    selectCandidate(list, { categoryId: "2048" });
    expect(list).toEqual(copy);
  });
});
