import { describe, expect, it } from "vitest";
import {
  YASIRO_CHANNEL_ID,
  actorNameFor,
  checkSameOrigin,
  getSessionActor,
  isAdminChannel,
  parseAdminIds,
  readCookie,
  safeNextPath,
} from "./admin.ts";
import { FAKE_ADMIN_ID, FAKE_USER_ID, createGamesTestDb, insertSession } from "./test-d1.ts";

const NOW = 1_792_900_000;

describe("parseAdminIds", () => {
  it("returns only yasiro for undefined and empty", () => {
    expect([...parseAdminIds(undefined)]).toEqual([YASIRO_CHANNEL_ID]);
    expect([...parseAdminIds("")]).toEqual([YASIRO_CHANNEL_ID]);
  });
  it("accepts one id", () => {
    expect(parseAdminIds(FAKE_ADMIN_ID)).toEqual(new Set([YASIRO_CHANNEL_ID, FAKE_ADMIN_ID]));
  });
  it("splits on commas, spaces and newlines", () => {
    const set = parseAdminIds(` ${FAKE_ADMIN_ID},\n${FAKE_USER_ID} \r\n`);
    expect(set).toEqual(new Set([YASIRO_CHANNEL_ID, FAKE_ADMIN_ID, FAKE_USER_ID]));
  });
  it("lowercases", () => {
    expect(parseAdminIds(FAKE_ADMIN_ID.toUpperCase()).has(FAKE_ADMIN_ID)).toBe(true);
  });
  it("silently drops malformed values", () => {
    const set = parseAdminIds(`abc, ${FAKE_ADMIN_ID}0, zz${FAKE_ADMIN_ID.slice(2)}`);
    expect([...set]).toEqual([YASIRO_CHANNEL_ID]);
  });
  it("dedupes", () => {
    expect(parseAdminIds(`${FAKE_ADMIN_ID},${FAKE_ADMIN_ID},${YASIRO_CHANNEL_ID}`).size).toBe(2);
  });
});

describe("isAdminChannel", () => {
  const ids = parseAdminIds(FAKE_ADMIN_ID);
  it("matches members only", () => {
    expect(isAdminChannel(FAKE_ADMIN_ID, ids)).toBe(true);
    expect(isAdminChannel(YASIRO_CHANNEL_ID, ids)).toBe(true);
    expect(isAdminChannel(FAKE_USER_ID, ids)).toBe(false);
    expect(isAdminChannel("", ids)).toBe(false);
  });
});

describe("actorNameFor", () => {
  it("aliases by channel id only", () => {
    expect(actorNameFor(YASIRO_CHANNEL_ID)).toBe("야시로");
    expect(actorNameFor(FAKE_ADMIN_ID)).toBe("관리자");
    expect(actorNameFor("anything")).toBe("관리자");
  });
});

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

describe("getSessionActor", () => {
  const ids = parseAdminIds(FAKE_ADMIN_ID);
  const setup = () => {
    const d = createGamesTestDb();
    insertSession(d, { id: "s-admin", channelId: FAKE_ADMIN_ID, channelName: "실명채널", expiresAt: NOW + 100 });
    insertSession(d, { id: "s-yasiro", channelId: YASIRO_CHANNEL_ID, channelName: "야시로본명", expiresAt: NOW + 100 });
    insertSession(d, { id: "s-user", channelId: FAKE_USER_ID, channelName: "일반", expiresAt: NOW + 100 });
    insertSession(d, { id: "s-old", channelId: FAKE_ADMIN_ID, channelName: "실명채널", expiresAt: NOW - 1 });
    insertSession(d, { id: "s-edge", channelId: FAKE_ADMIN_ID, channelName: "실명채널", expiresAt: NOW });
    return d;
  };
  const run = (cookie: string | null) => getSessionActor(setup().db, cookie, NOW, ids);

  it("anonymous without cookie", async () => {
    expect(await run(null)).toEqual({ kind: "anonymous" });
    expect(await run("other=1")).toEqual({ kind: "anonymous" });
  });
  it("expired for expired, boundary and unknown sessions", async () => {
    expect(await run("session_id=s-old")).toEqual({ kind: "expired" });
    expect(await run("session_id=s-edge")).toEqual({ kind: "expired" });
    expect(await run("session_id=nope")).toEqual({ kind: "expired" });
  });
  it("user for non-admin", async () => {
    expect(await run("session_id=s-user")).toEqual({ kind: "user" });
  });
  it("admin gets alias, never the channel name", async () => {
    const r = await run("a=1; session_id=s-admin");
    expect(r).toEqual({ kind: "admin", actor: { channelId: FAKE_ADMIN_ID, name: "관리자" } });
    expect(JSON.stringify(r)).not.toContain("실명채널");
  });
  it("yasiro gets its alias", async () => {
    expect(await run("session_id=s-yasiro")).toEqual({
      kind: "admin",
      actor: { channelId: YASIRO_CHANNEL_ID, name: "야시로" },
    });
  });
  it("never selects channel_name", async () => {
    const queries: string[] = [];
    const d = setup();
    const spy = {
      prepare: (q: string) => {
        queries.push(q);
        return d.db.prepare(q);
      },
      batch: d.db.batch.bind(d.db),
    };
    await getSessionActor(spy, "session_id=s-admin", NOW, ids);
    expect(queries).toHaveLength(1);
    expect(queries[0]).not.toMatch(/channel_name/);
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
