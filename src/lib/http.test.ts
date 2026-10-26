import { describe, expect, it } from "vitest";
import { checkSameOrigin, readCookie, safeNextPath } from "./http.ts";

describe("readCookie", () => {
  it("returns null without header or cookie", () => {
    expect(readCookie(null, "a")).toBeNull();
    expect(readCookie("b=1", "a")).toBeNull();
  });
  it("finds among several cookies", () => {
    expect(readCookie("x=1; session_id=abc; y=2", "session_id")).toBe("abc");
  });
  it("keeps = inside values", () => {
    expect(readCookie("t=a=b==", "t")).toBe("a=b==");
  });
  it("does not match by name suffix or prefix", () => {
    expect(readCookie("xsession_id=1", "session_id")).toBeNull();
    expect(readCookie("session_idx=1", "session_id")).toBeNull();
  });
  it("ignores parts without =", () => {
    expect(readCookie("flag; a=1", "a")).toBe("1");
    expect(readCookie("a", "a")).toBeNull();
  });
  it("returns null for empty values", () => {
    expect(readCookie("a=", "a")).toBeNull();
  });
  it("decodes percent encoding and falls back on bad encoding", () => {
    expect(readCookie("a=%EC%95%BC", "a")).toBe("야");
    expect(readCookie("a=%E0%A4%A", "a")).toBe("%E0%A4%A");
  });
});

describe("checkSameOrigin", () => {
  const req = (method: string, headers: Record<string, string> = {}, url = "https://yasiro.stream/api/games") =>
    new Request(url, { method, headers });
  it("allows safe methods", () => {
    for (const m of ["GET", "HEAD", "OPTIONS"]) expect(checkSameOrigin(req(m))).toBe(true);
  });
  it("allows same Origin", () => {
    expect(checkSameOrigin(req("POST", { origin: "https://yasiro.stream" }))).toBe(true);
  });
  it("rejects other, null and malformed Origin", () => {
    expect(checkSameOrigin(req("POST", { origin: "https://evil.example" }))).toBe(false);
    expect(checkSameOrigin(req("POST", { origin: "null" }))).toBe(false);
    expect(checkSameOrigin(req("POST", { origin: "not a url" }))).toBe(false);
  });
  it("rejects different port", () => {
    expect(checkSameOrigin(req("POST", { origin: "https://yasiro.stream:8443" }))).toBe(false);
  });
  it("uses Sec-Fetch-Site without Origin", () => {
    expect(checkSameOrigin(req("PATCH", { "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(checkSameOrigin(req("PATCH", { "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(checkSameOrigin(req("DELETE"))).toBe(false);
  });
  it("accepts a Host header match", () => {
    const r = new Request("http://internal:3000/x", { method: "POST", headers: { origin: "https://yasiro.stream", host: "yasiro.stream" } });
    expect(checkSameOrigin(r)).toBe(true);
  });
});

describe("safeNextPath", () => {
  it("keeps normal paths", () => {
    expect(safeNextPath("/games?game=a")).toBe("/games?game=a");
    expect(safeNextPath("/")).toBe("/");
  });
  it("falls back to / for unsafe values", () => {
    for (const bad of [null, undefined, "", "//evil", "/\\evil", "https://evil", "games", "/a\nb", "/a\u0000b", "/a\u007fb", `/${"a".repeat(512)}`])
      expect(safeNextPath(bad)).toBe("/");
  });
  it("accepts exactly 512 chars", () => {
    const p = `/${"a".repeat(511)}`;
    expect(safeNextPath(p)).toBe(p);
  });
  it("keeps percent-encoded slashes as a plain path", () => {
    expect(safeNextPath("/%2f%2fevil")).toBe("/%2f%2fevil");
  });
});
