import { describe, it, expect } from "vitest";
import { buildAuthorizationURL, generateState } from "./chzzk-auth";

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
