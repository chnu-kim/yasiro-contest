import { describe, expect, it, vi } from "vitest";
import {
  ChzzkAuthError,
  ChzzkCategoryError,
  ChzzkHttpError,
  ChzzkNetworkError,
  ChzzkResponseError,
  searchCategories,
  slugify,
} from "./chzzk-category.ts";
import { ID_PATTERN } from "./games/schema.ts";
import type { ChzzkCategoryConfig, FetchLike } from "./games/types.ts";

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
