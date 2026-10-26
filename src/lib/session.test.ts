import { describe, expect, it } from "vitest";
import { generateState } from "./chzzk-auth.ts";
import { FAKE_ADMIN_ID, createGamesTestDb, insertSession } from "./games/test-d1.ts";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  deleteSession,
  findSession,
  findSessionChannel,
  parseSessionId,
  readSessionId,
  sessionCookie,
} from "./session.ts";

const NOW = 1_792_900_000;
const ID = "0123456789abcdef0123456789abcdef";
const OTHER = "fedcba9876543210fedcba9876543210";

function setup() {
  const d = createGamesTestDb();
  insertSession(d, { id: ID, channelId: FAKE_ADMIN_ID, channelName: "표시이름", expiresAt: NOW + 100 });
  insertSession(d, { id: OTHER, channelId: FAKE_ADMIN_ID, channelName: "표시이름", expiresAt: NOW });
  return d;
}

describe("parseSessionId", () => {
  it("accepts generateState output", () => {
    const id = generateState();
    expect(parseSessionId(id)).toBe(id);
  });
  it("rejects wrong length, case, charset and non-strings", () => {
    for (const bad of [null, undefined, "", "abc", ID.toUpperCase(), `${ID}0`, ID.slice(1), `${ID.slice(1)}g`, `${ID.slice(1)}\n`])
      expect(parseSessionId(bad)).toBeNull();
  });
});

describe("readSessionId", () => {
  it("reads and validates the cookie", () => {
    expect(readSessionId(`a=1; ${SESSION_COOKIE}=${ID}`)).toBe(ID);
    expect(readSessionId(null)).toBeNull();
    expect(readSessionId("other=1")).toBeNull();
    expect(readSessionId(`${SESSION_COOKIE}=nope`)).toBeNull();
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
  it("expired for the boundary (expires_at = now) and unknown ids", async () => {
    const d = setup();
    expect(await findSession(d.db, OTHER, NOW)).toEqual({ state: "expired" });
    expect(await findSession(d.db, "a".repeat(32), NOW)).toEqual({ state: "expired" });
  });
  it("judges expiry by the injected now", async () => {
    const d = setup();
    expect((await findSession(d.db, ID, NOW + 100)).state).toBe("expired");
    expect((await findSession(d.db, ID, NOW + 99)).state).toBe("active");
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

describe("deleteSession", () => {
  it("removes only that row", async () => {
    const d = setup();
    await deleteSession(d.db, ID);
    expect(d.sqlite.prepare("SELECT id FROM sessions").all()).toEqual([{ id: OTHER }]);
  });
});

describe("cookie strings", () => {
  it("sessionCookie keeps the login attributes", () => {
    expect(sessionCookie(ID)).toBe(`session_id=${ID}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
  });
  it("clearSessionCookie expires it", () => {
    expect(clearSessionCookie()).toBe("session_id=; Path=/; HttpOnly; Max-Age=0");
  });
});
