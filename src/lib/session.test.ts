import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateState } from "./chzzk-auth.ts";
import { FAKE_ADMIN_ID, FAKE_USER_ID, createGamesTestDb, findStringAnywhere, insertSession } from "./games/test-d1.ts";
import {
  LEGACY_SESSION_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  clearLegacySessionCookie,
  clearOauthCookies,
  clearSessionCookie,
  createSession,
  deleteExpiredSessions,
  deleteSession,
  findSession,
  findSessionChannel,
  hashSessionId,
  newSessionId,
  oauthCookie,
  parseSessionId,
  readSessionId,
  sessionCookie,
} from "./session.ts";

const NOW = 1_792_900_000;
const ID = "0123456789abcdef".repeat(4);
const OTHER = "fedcba9876543210".repeat(4);

function setup() {
  const d = createGamesTestDb();
  insertSession(d, { id: ID, channelId: FAKE_ADMIN_ID, channelName: "표시이름", expiresAt: NOW + 100 });
  insertSession(d, { id: OTHER, channelId: FAKE_ADMIN_ID, channelName: "표시이름", expiresAt: NOW });
  return d;
}
const hashes = (d: ReturnType<typeof setup>) =>
  d.sqlite.prepare("SELECT id_hash FROM auth_sessions ORDER BY id_hash").all().map((r) => r.id_hash);
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

describe("constants", () => {
  it("TTL is an absolute 7 days and the cookie uses the __Host- prefix", () => {
    expect(SESSION_TTL_SECONDS).toBe(604800);
    expect(SESSION_COOKIE).toBe("__Host-session");
    expect(LEGACY_SESSION_COOKIE).toBe("session_id");
  });
});

describe("newSessionId", () => {
  it("returns 64 lowercase hex chars that parseSessionId accepts", () => {
    const id = newSessionId();
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(parseSessionId(id)).toBe(id);
  });
  it("differs every call", () => {
    expect(newSessionId()).not.toBe(newSessionId());
  });
});

describe("hashSessionId", () => {
  it("is SHA-256 lowercase hex (same as node:crypto and the test helper)", async () => {
    expect(await hashSessionId(ID)).toBe(sha256(ID));
    expect(await hashSessionId("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("parseSessionId", () => {
  it("accepts newSessionId output only", () => {
    expect(parseSessionId(ID)).toBe(ID);
  });
  it("rejects legacy 32-hex ids, wrong length, case, charset and non-strings", () => {
    for (const bad of [null, undefined, "", "abc", generateState(), ID.toUpperCase(), `${ID}0`, ID.slice(1), `${ID.slice(1)}g`, `${ID.slice(1)}\n`])
      expect(parseSessionId(bad)).toBeNull();
  });
});

describe("readSessionId", () => {
  it("reads and validates the new cookie only", () => {
    expect(readSessionId(`a=1; ${SESSION_COOKIE}=${ID}`)).toBe(ID);
    expect(readSessionId(null)).toBeNull();
    expect(readSessionId("other=1")).toBeNull();
    expect(readSessionId(`${SESSION_COOKIE}=nope`)).toBeNull();
    expect(readSessionId(`session_id=${ID}`)).toBeNull();
  });
});

describe("findSession", () => {
  it("anonymous without an id and never queries", async () => {
    let queried = false;
    const db = { prepare: () => { queried = true; throw new Error("no"); } };
    expect(await findSession(db, null, NOW)).toEqual({ state: "anonymous" });
    expect(queried).toBe(false);
  });
  it("active returns channel id and name", async () => {
    expect(await findSession(setup().db, ID, NOW)).toEqual({
      state: "active",
      session: { channelId: FAKE_ADMIN_ID, channelName: "표시이름" },
    });
  });
  it("looks up by hash; the raw id never reaches the query", async () => {
    const d = setup();
    const bound: unknown[] = [];
    const spy = {
      prepare: (q: string) => {
        const s = d.db.prepare(q);
        return { bind: (...v: unknown[]) => { bound.push(...v); return s.bind(...v); } };
      },
    };
    await findSession(spy, ID, NOW);
    expect(bound).toContain(sha256(ID));
    expect(bound).not.toContain(ID);
  });
  it("expired for the boundary (expires_at = now) and unknown ids", async () => {
    const d = setup();
    expect(await findSession(d.db, OTHER, NOW)).toEqual({ state: "expired" });
    expect(await findSession(d.db, "a".repeat(64), NOW)).toEqual({ state: "expired" });
  });
  it("judges expiry by the injected now", async () => {
    const d = setup();
    expect((await findSession(d.db, ID, NOW + 100)).state).toBe("expired");
    expect((await findSession(d.db, ID, NOW + 99)).state).toBe("active");
  });
  it("ignores the legacy sessions table", async () => {
    const d = createGamesTestDb();
    d.sqlite
      .prepare("INSERT INTO sessions (id, channel_id, channel_name, access_token, refresh_token, expires_at) VALUES (?, ?, '옛', 'at', 'rt', ?)")
      .run(ID, FAKE_ADMIN_ID, NOW + 100);
    expect(await findSession(d.db, ID, NOW)).toEqual({ state: "expired" });
  });
});

describe("findSessionChannel", () => {
  it("anonymous, expired, active", async () => {
    const d = setup();
    expect(await findSessionChannel(d.db, null, NOW)).toEqual({ state: "anonymous" });
    expect(await findSessionChannel(d.db, OTHER, NOW)).toEqual({ state: "expired" });
    expect(await findSessionChannel(d.db, ID, NOW)).toEqual({ state: "active", session: { channelId: FAKE_ADMIN_ID } });
  });
  it("never selects channel_name", async () => {
    const queries: string[] = [];
    const d = setup();
    const spy = {
      prepare: (q: string) => {
        queries.push(q);
        return d.db.prepare(q);
      },
    };
    const r = await findSessionChannel(spy, ID, NOW);
    expect(queries).toHaveLength(1);
    expect(queries[0]).not.toMatch(/channel_name/);
    expect(JSON.stringify(r)).not.toContain("표시이름");
  });
});

describe("createSession", () => {
  it("stores only the hash with expires_at = now + TTL and returns the raw id", async () => {
    const d = createGamesTestDb();
    const id = await createSession(d.db, { channelId: FAKE_USER_ID, channelName: "새이름" }, NOW);
    expect(parseSessionId(id)).toBe(id);
    const row = d.sqlite.prepare("SELECT * FROM auth_sessions").get();
    expect(row).toMatchObject({ id_hash: sha256(id), channel_id: FAKE_USER_ID, channel_name: "새이름", expires_at: NOW + SESSION_TTL_SECONDS });
    expect(findStringAnywhere(d, id, ["auth_sessions", "sessions"])).toEqual([]);
    expect(await findSession(d.db, id, NOW)).toEqual({ state: "active", session: { channelId: FAKE_USER_ID, channelName: "새이름" } });
  });
});

describe("deleteSession", () => {
  it("removes only that row (by hash)", async () => {
    const d = setup();
    await deleteSession(d.db, ID);
    expect(hashes(d)).toEqual([sha256(OTHER)]);
  });
});

describe("deleteExpiredSessions", () => {
  it("removes rows with expires_at <= now and keeps the rest", async () => {
    const d = setup();
    await deleteExpiredSessions(d.db, NOW);
    expect(hashes(d)).toEqual([sha256(ID)]);
  });
});

describe("cookie strings", () => {
  const ATTRS = "Path=/; Secure; HttpOnly; SameSite=Lax";
  it("sessionCookie: __Host- prefix, Secure, Max-Age = TTL", () => {
    expect(sessionCookie(ID)).toBe(`__Host-session=${ID}; ${ATTRS}; Max-Age=604800`);
  });
  it("clear cookies keep the same attributes (a __Host- clear without Secure is ignored)", () => {
    expect(clearSessionCookie()).toBe(`__Host-session=; ${ATTRS}; Max-Age=0`);
    expect(clearLegacySessionCookie()).toBe(`session_id=; ${ATTRS}; Max-Age=0`);
  });
  it("oauth cookies are Secure and short-lived; clears cover both", () => {
    expect(oauthCookie("oauth_state", "abc")).toBe(`oauth_state=abc; ${ATTRS}; Max-Age=600`);
    expect(oauthCookie("oauth_next", "/games?game=1")).toBe(`oauth_next=%2Fgames%3Fgame%3D1; ${ATTRS}; Max-Age=600`);
    expect(clearOauthCookies()).toEqual([`oauth_state=; ${ATTRS}; Max-Age=0`, `oauth_next=; ${ATTRS}; Max-Age=0`]);
  });
});
