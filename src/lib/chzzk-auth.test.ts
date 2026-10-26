import { describe, it, expect } from "vitest";
import {
  ChzzkApiError,
  buildAuthorizationURL,
  exchangeCode,
  fetchUser,
  generateState,
  readChzzkConfig,
  revokeToken,
} from "./chzzk-auth.ts";

const config = {
  clientId: "test-client-id",
  redirectUri: "https://example.com/auth/callback",
};

describe("buildAuthorizationURL", () => {
  it("필수 파라미터를 포함한 URL을 생성한다", () => {
    const url = buildAuthorizationURL(config, "my-state");
    expect(url).toContain("chzzk.naver.com/account-interlock");
    expect(url).toContain("clientId=test-client-id");
    expect(url).toContain("state=my-state");
    expect(url).toContain("redirectUri=");
  });

  it("state가 URL에 정확히 포함된다", () => {
    const state = "abc123";
    const url = buildAuthorizationURL(config, state);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("state")).toBe(state);
  });
});

describe("generateState", () => {
  it("32자리 16진수 문자열을 반환한다", () => {
    const state = generateState();
    expect(state).toHaveLength(32);
    expect(state).toMatch(/^[0-9a-f]+$/);
  });

  it("호출할 때마다 다른 값을 반환한다", () => {
    const s1 = generateState();
    const s2 = generateState();
    expect(s1).not.toBe(s2);
  });
});

type FetchCall = { url: string; init: RequestInit | undefined };

/** 고정 응답을 돌려주고 호출을 기록하는 fetch 대역 */
function fakeFetch(respond: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return respond(url, init);
  }) as typeof fetch;
  return { fn, calls };
}

const fullConfig = { ...config, clientSecret: "test-secret" };

describe("exchangeCode", () => {
  it("POSTs the authorization_code grant and returns the token content", async () => {
    const content = { accessToken: "AT", refreshToken: "RT", tokenType: "Bearer", expiresIn: 86400 };
    const f = fakeFetch(() => Response.json({ code: 200, message: null, content }));
    expect(await exchangeCode(fullConfig, "the-code", "the-state", f.fn)).toEqual(content);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toBe("https://openapi.chzzk.naver.com/auth/v1/token");
    expect(f.calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(f.calls[0].init?.body))).toEqual({
      grantType: "authorization_code",
      clientId: "test-client-id",
      clientSecret: "test-secret",
      code: "the-code",
      state: "the-state",
    });
  });
  it("throws ChzzkApiError with the API code on failure", async () => {
    const f = fakeFetch(() => Response.json({ code: 401, message: "INVALID_CLIENT", content: null }, { status: 401 }));
    const err = await exchangeCode(fullConfig, "c", "s", f.fn).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ChzzkApiError);
    expect((err as ChzzkApiError).code).toBe(401);
    expect((err as Error).message).toMatch(/Token exchange failed 401/);
  });
});

describe("fetchUser", () => {
  it("sends the bearer token and returns the user", async () => {
    const f = fakeFetch(() => Response.json({ code: 200, message: null, content: { channelId: "c1", channelName: "이름" } }));
    expect(await fetchUser("AT", f.fn)).toEqual({ channelId: "c1", channelName: "이름" });
    expect(f.calls[0].url).toBe("https://openapi.chzzk.naver.com/open/v1/users/me");
    expect(new Headers(f.calls[0].init?.headers).get("authorization")).toBe("Bearer AT");
  });
  it("throws ChzzkApiError on failure", async () => {
    const f = fakeFetch(() => Response.json({ code: 403, message: "FORBIDDEN", content: null }));
    const err = await fetchUser("AT", f.fn).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ChzzkApiError);
    expect((err as ChzzkApiError).code).toBe(403);
  });
});

describe("revokeToken", () => {
  it("POSTs clientId, clientSecret, token and tokenTypeHint and returns the HTTP status", async () => {
    const f = fakeFetch(() => Response.json({ code: 200, message: null, content: null }));
    expect(await revokeToken(fullConfig, "RT", "refresh_token", f.fn)).toBe(200);
    expect(f.calls[0].url).toBe("https://openapi.chzzk.naver.com/auth/v1/token/revoke");
    expect(f.calls[0].init?.method).toBe("POST");
    expect(new Headers(f.calls[0].init?.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(String(f.calls[0].init?.body))).toEqual({
      clientId: "test-client-id",
      clientSecret: "test-secret",
      token: "RT",
      tokenTypeHint: "refresh_token",
    });
    expect(f.calls[0].init?.signal).toBeInstanceOf(AbortSignal);
  });
  it("returns non-2xx statuses instead of throwing", async () => {
    const f = fakeFetch(() => new Response("nope", { status: 500 }));
    expect(await revokeToken(fullConfig, "AT", "access_token", f.fn)).toBe(500);
  });
  it("aborts after the timeout", async () => {
    const f = fakeFetch((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));
    const err = await revokeToken(fullConfig, "AT", "access_token", f.fn, 5).catch((e: unknown) => e);
    expect((err as Error).name).toBe("TimeoutError");
  });
});

describe("readChzzkConfig", () => {
  const env = { CHZZK_CLIENT_ID: "id", CHZZK_CLIENT_SECRET: "secret", CHZZK_REDIRECT_URI: "https://yasiro.stream/auth/callback" };
  it("returns the config when all three are set", () => {
    expect(readChzzkConfig(env)).toEqual({ clientId: "id", clientSecret: "secret", redirectUri: "https://yasiro.stream/auth/callback" });
  });
  it("returns null when any is missing or empty", () => {
    for (const key of Object.keys(env)) {
      expect(readChzzkConfig({ ...env, [key]: undefined })).toBeNull();
      expect(readChzzkConfig({ ...env, [key]: "" })).toBeNull();
    }
  });
});
