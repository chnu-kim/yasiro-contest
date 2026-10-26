import { describe, expect, it } from "vitest";
import { handleLogout } from "./auth-routes.ts";
import { FAKE_ADMIN_ID, createGamesTestDb, insertSession } from "./games/test-d1.ts";

const NOW = 1_792_900_000;
const ID = "0123456789abcdef0123456789abcdef";
const ORIGIN = "https://yasiro.stream";

function setup() {
  const d = createGamesTestDb();
  insertSession(d, { id: ID, channelId: FAKE_ADMIN_ID, channelName: "표시이름", expiresAt: NOW + 1000 });
  return d;
}
const post = (headers: Record<string, string>) =>
  new Request(`${ORIGIN}/auth/logout`, { method: "POST", headers });
const count = (d: ReturnType<typeof setup>) =>
  (d.sqlite.prepare("SELECT count(*) AS n FROM sessions").get() as { n: number }).n;

describe("handleLogout", () => {
  it("deletes the session, clears the cookie and redirects home", async () => {
    const d = setup();
    const res = await handleLogout(post({ origin: ORIGIN, cookie: `session_id=${ID}` }), { db: d.db });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/`);
    expect(res.headers.get("set-cookie")).toBe("session_id=; Path=/; HttpOnly; Max-Age=0");
    expect(count(d)).toBe(0);
  });
  it("rejects cross-origin requests with 403 and keeps the session", async () => {
    const d = setup();
    const res = await handleLogout(post({ origin: "https://evil.example", cookie: `session_id=${ID}` }), { db: d.db });
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(count(d)).toBe(1);
  });
  it("rejects a POST with neither Origin nor Sec-Fetch-Site", async () => {
    const d = setup();
    expect((await handleLogout(post({ cookie: `session_id=${ID}` }), { db: d.db })).status).toBe(403);
    expect(count(d)).toBe(1);
  });
  it("still clears the cookie without or with a malformed session cookie", async () => {
    const d = setup();
    for (const cookie of [undefined, "session_id=nope"]) {
      const res = await handleLogout(post({ origin: ORIGIN, ...(cookie ? { cookie } : {}) }), { db: d.db });
      expect(res.status).toBe(302);
      expect(res.headers.get("set-cookie")).toBe("session_id=; Path=/; HttpOnly; Max-Age=0");
    }
    expect(count(d)).toBe(1);
  });
});
