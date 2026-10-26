import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleCallback, handleLogin, handleLogout, type CallbackDeps } from "./auth-routes.ts";
import { FAKE_ADMIN_ID, FAKE_USER_ID, createGamesTestDb, findStringAnywhere, insertSession, type TestD1 } from "./games/test-d1.ts";
import { SESSION_TTL_SECONDS, findSession } from "./session.ts";

const NOW = 1_792_900_000;
const ID = "0123456789abcdef".repeat(4);
const ORIGIN = "https://yasiro.stream";
const ATTRS = "Path=/; Secure; HttpOnly; SameSite=Lax";
const CLEAR_NEW = `__Host-session=; ${ATTRS}; Max-Age=0`;
const CLEAR_LEGACY = `session_id=; ${ATTRS}; Max-Age=0`;
const CLEAR_OAUTH = [`oauth_state=; ${ATTRS}; Max-Age=0`, `oauth_next=; ${ATTRS}; Max-Age=0`];
const CONFIG = { clientId: "cid", clientSecret: "csecret", redirectUri: `${ORIGIN}/auth/callback` };
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function setup() {
  const d = createGamesTestDb();
  insertSession(d, { id: ID, channelId: FAKE_ADMIN_ID, channelName: "표시이름", expiresAt: NOW + 1000 });
  return d;
}
const count = (d: TestD1) =>
  (d.sqlite.prepare("SELECT count(*) AS n FROM auth_sessions").get() as { n: number }).n;
const cookies = (res: Response) => res.headers.getSetCookie();

describe("handleLogout", () => {
  const post = (headers: Record<string, string>) =>
    new Request(`${ORIGIN}/auth/logout`, { method: "POST", headers });

  it("deletes the session by hash, clears both cookies and redirects home", async () => {
    const d = setup();
    const res = await handleLogout(post({ origin: ORIGIN, cookie: `__Host-session=${ID}` }), { db: d.db });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/`);
    expect(cookies(res)).toEqual([CLEAR_NEW, CLEAR_LEGACY]);
    expect(count(d)).toBe(0);
  });
  it("rejects cross-origin requests with 403 and keeps the session", async () => {
    const d = setup();
    const res = await handleLogout(post({ origin: "https://evil.example", cookie: `__Host-session=${ID}` }), { db: d.db });
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(count(d)).toBe(1);
  });
  it("rejects a POST with neither Origin nor Sec-Fetch-Site", async () => {
    const d = setup();
    expect((await handleLogout(post({ cookie: `__Host-session=${ID}` }), { db: d.db })).status).toBe(403);
    expect(count(d)).toBe(1);
  });
  it("still clears both cookies without, with a malformed or with only a legacy cookie", async () => {
    const d = setup();
    for (const cookie of [undefined, "__Host-session=nope", `session_id=${ID.slice(32)}`]) {
      const res = await handleLogout(post({ origin: ORIGIN, ...(cookie ? { cookie } : {}) }), { db: d.db });
      expect(res.status).toBe(302);
      expect(cookies(res)).toEqual([CLEAR_NEW, CLEAR_LEGACY]);
    }
    expect(count(d)).toBe(1);
  });
});

describe("handleLogin", () => {
  const get = (path: string) => new Request(`${ORIGIN}${path}`);

  it("redirects to chzzk with a fresh state and sets Secure oauth cookies", async () => {
    const res = handleLogin(get("/auth/login?next=%2Fgames%3Fgame%3Dabc"), { config: CONFIG, newState: () => "s".repeat(32) });
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.origin + loc.pathname).toBe("https://chzzk.naver.com/account-interlock");
    expect(loc.searchParams.get("clientId")).toBe("cid");
    expect(loc.searchParams.get("redirectUri")).toBe(CONFIG.redirectUri);
    expect(loc.searchParams.get("state")).toBe("s".repeat(32));
    expect(loc.searchParams.has("clientSecret")).toBe(false);
    expect(cookies(res)).toEqual([
      `oauth_state=${"s".repeat(32)}; ${ATTRS}; Max-Age=600`,
      `oauth_next=%2Fgames%3Fgame%3Dabc; ${ATTRS}; Max-Age=600`,
    ]);
  });
  it("falls back to / for an unsafe next", () => {
    const res = handleLogin(get("/auth/login?next=https://evil.example"), { config: CONFIG, newState: () => "s" });
    expect(cookies(res)[1]).toBe(`oauth_next=%2F; ${ATTRS}; Max-Age=600`);
  });
  it("500 without config, never requests chzzk with 'undefined'", () => {
    const res = handleLogin(get("/auth/login"), { config: null, newState: () => "s" });
    expect(res.status).toBe(500);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("handleCallback", () => {
  const STATE = "5".repeat(32);
  const TOKENS = { accessToken: "ACCESS-TOKEN-VALUE", refreshToken: "REFRESH-TOKEN-VALUE", tokenType: "Bearer", expiresIn: 86400 };
  const USER = { channelId: FAKE_USER_ID, channelName: "새로그인채널" };
  const consoleLines: string[] = [];

  beforeEach(() => {
    consoleLines.length = 0;
    for (const m of ["log", "info", "warn", "error"] as const)
      vi.spyOn(console, m).mockImplementation((...args: unknown[]) => { consoleLines.push(args.map(String).join(" ")); });
  });
  afterEach(() => vi.restoreAllMocks());

  interface Options {
    token?: () => Response;
    user?: () => Response;
    revoke?: (body: { token: string; tokenTypeHint: string }) => Response | Promise<Response>;
  }

  function makeDeps(d: TestD1, opts: Options = {}) {
    const calls: { url: string; body: unknown }[] = [];
    const pending: Promise<unknown>[] = [];
    const deps: CallbackDeps = {
      db: d.db,
      config: CONFIG,
      now: () => NOW,
      waitUntil: (p) => { pending.push(p); },
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        calls.push({ url, body });
        if (url.endsWith("/auth/v1/token")) return opts.token?.() ?? Response.json({ code: 200, message: null, content: TOKENS });
        if (url.endsWith("/open/v1/users/me")) return opts.user?.() ?? Response.json({ code: 200, message: null, content: USER });
        if (url.endsWith("/auth/v1/token/revoke")) return opts.revoke?.(body) ?? Response.json({ code: 200, message: null, content: null });
        throw new Error(`unexpected ${url}`);
      }) as typeof fetch,
    };
    const revokes = () => calls.filter((c) => c.url.endsWith("/revoke")).map((c) => c.body);
    return { deps, calls, pending, revokes };
  }

  const callback = (query: string, cookie?: string) =>
    new Request(`${ORIGIN}/auth/callback${query}`, { headers: cookie ? { cookie } : {} });
  const ok = (extraCookie = "") =>
    callback(`?code=CODE&state=${STATE}`, `oauth_state=${STATE}; oauth_next=%2Fgames%3Fgame%3Dabc${extraCookie}`);

  it("logs in: stores only the hash, sets the session cookie, clears oauth and legacy cookies, redirects to next", async () => {
    const d = createGamesTestDb();
    const { deps, pending } = makeDeps(d);
    const res = await handleCallback(ok(), deps);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/games?game=abc`);

    const set = cookies(res);
    expect(set.slice(0, 3)).toEqual([...CLEAR_OAUTH, CLEAR_LEGACY]);
    const m = /^__Host-session=([0-9a-f]{64}); Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=604800$/.exec(set[3]);
    expect(m).not.toBeNull();
    const sessionId = m![1];

    const rows = d.sqlite.prepare("SELECT id_hash, channel_id, channel_name, expires_at FROM auth_sessions").all();
    expect(rows).toEqual([{ id_hash: sha256(sessionId), channel_id: FAKE_USER_ID, channel_name: "새로그인채널", expires_at: NOW + SESSION_TTL_SECONDS }]);
    expect(await findSession(d.db, sessionId, NOW)).toEqual({ state: "active", session: { channelId: FAKE_USER_ID, channelName: "새로그인채널" } });
    await Promise.all(pending);
    for (const needle of [sessionId, TOKENS.accessToken, TOKENS.refreshToken])
      expect(findStringAnywhere(d, needle, ["auth_sessions", "sessions", "games", "game_changes"])).toEqual([]);
  });

  it("revokes both chzzk tokens in the background with the spec'd body", async () => {
    const d = createGamesTestDb();
    const { deps, pending, revokes } = makeDeps(d);
    await handleCallback(ok(), deps);
    expect(pending).toHaveLength(1);
    await Promise.all(pending);
    expect(revokes()).toEqual([
      { clientId: "cid", clientSecret: "csecret", token: TOKENS.accessToken, tokenTypeHint: "access_token" },
      { clientId: "cid", clientSecret: "csecret", token: TOKENS.refreshToken, tokenTypeHint: "refresh_token" },
    ]);
    expect(consoleLines).toEqual([]);
  });

  it("still logs in when revoke fails or throws; the background promise never rejects and logs only statuses", async () => {
    const d = createGamesTestDb();
    const { deps, pending } = makeDeps(d, {
      revoke: (b) => {
        if (b.tokenTypeHint === "access_token") return new Response("server error with ACCESS-TOKEN-VALUE", { status: 500 });
        throw Object.assign(new Error(`boom ${b.token}`), { name: "TypeError" });
      },
    });
    const res = await handleCallback(ok(), deps);
    expect(res.status).toBe(302);
    await expect(Promise.all(pending)).resolves.toBeDefined();
    expect(consoleLines).toHaveLength(1);
    expect(consoleLines[0]).toContain("access_token=500");
    expect(consoleLines[0]).toContain("refresh_token=TypeError");
  });

  it("logs the type of a non-Error rejection without its value", async () => {
    const d = createGamesTestDb();
    const { deps, pending } = makeDeps(d, { revoke: (b) => { throw b.token; } });
    await handleCallback(ok(), deps);
    await Promise.all(pending);
    expect(consoleLines).toEqual(["chzzk token revoke failed: access_token=string refresh_token=string"]);
  });

  it("replaces the session the request already carried and prunes expired rows", async () => {
    const d = setup();
    const stale = "e".repeat(64);
    insertSession(d, { id: stale, channelId: FAKE_ADMIN_ID, channelName: "표시이름", expiresAt: NOW });
    const keep = "c".repeat(64);
    insertSession(d, { id: keep, channelId: FAKE_ADMIN_ID, channelName: "표시이름", expiresAt: NOW + 1 });
    const { deps } = makeDeps(d);
    const res = await handleCallback(ok(`; __Host-session=${ID}; session_id=${"1".repeat(32)}`), deps);
    expect(res.status).toBe(302);
    const left = d.sqlite.prepare("SELECT id_hash FROM auth_sessions").all().map((r) => r.id_hash);
    expect(left).toHaveLength(2);
    expect(left).toContain(sha256(keep));
    expect(left).not.toContain(sha256(ID));
    expect(left).not.toContain(sha256(stale));
  });

  it("does not touch the legacy sessions table", async () => {
    const d = createGamesTestDb();
    d.sqlite.exec("INSERT INTO sessions (id, channel_id, channel_name, access_token, refresh_token, expires_at) VALUES ('old', 'c', 'n', 'at', 'rt', 1)");
    const { deps } = makeDeps(d);
    await handleCallback(ok(`; session_id=old`), deps);
    expect(d.sqlite.prepare("SELECT count(*) n FROM sessions").get()).toEqual({ n: 1 });
  });

  it("defaults next to / without an oauth_next cookie", async () => {
    const { deps } = makeDeps(createGamesTestDb());
    const res = await handleCallback(callback(`?code=CODE&state=${STATE}`, `oauth_state=${STATE}`), deps);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/`);
  });

  describe("failure paths clear oauth cookies and create no session", () => {
    async function expectFail(res: Response, status: number, d: TestD1) {
      expect(res.status).toBe(status);
      expect(cookies(res)).toEqual(CLEAR_OAUTH);
      expect(res.headers.get("location")).toBeNull();
      expect(count(d)).toBe(0);
    }

    it("500 without config, before any request", async () => {
      const d = createGamesTestDb();
      const { deps, calls } = makeDeps(d);
      await expectFail(await handleCallback(ok(), { ...deps, config: null }), 500, d);
      expect(calls).toEqual([]);
    });
    it("400 without code or state", async () => {
      const d = createGamesTestDb();
      const { deps, calls } = makeDeps(d);
      for (const q of ["", "?code=CODE", `?state=${STATE}`])
        await expectFail(await handleCallback(callback(q, `oauth_state=${STATE}`), deps), 400, d);
      expect(calls).toEqual([]);
    });
    it("403 when the state cookie is missing or differs", async () => {
      const d = createGamesTestDb();
      const { deps, calls } = makeDeps(d);
      await expectFail(await handleCallback(callback(`?code=CODE&state=${STATE}`), deps), 403, d);
      await expectFail(await handleCallback(callback(`?code=CODE&state=${STATE}`, "oauth_state=other"), deps), 403, d);
      expect(calls).toEqual([]);
    });
    it("502 when the token exchange fails (nothing to revoke), logging only the API code", async () => {
      const d = createGamesTestDb();
      const { deps, pending } = makeDeps(d, { token: () => Response.json({ code: 401, message: "secret detail", content: null }) });
      await expectFail(await handleCallback(ok(), deps), 502, d);
      expect(pending).toEqual([]);
      expect(consoleLines).toHaveLength(1);
      expect(consoleLines[0]).toContain("401");
      expect(consoleLines[0]).not.toContain("secret detail");
    });
    it("502 when the token response is not JSON, logging only the error name", async () => {
      const d = createGamesTestDb();
      const { deps } = makeDeps(d, { token: () => new Response("<html>ACCESS-TOKEN-VALUE") });
      await expectFail(await handleCallback(ok(), deps), 502, d);
      expect(consoleLines.join("\n")).not.toContain("ACCESS-TOKEN-VALUE");
      expect(consoleLines[0]).toContain("SyntaxError");
    });
    it("502 when fetching the user fails, and the tokens are still revoked", async () => {
      const d = createGamesTestDb();
      const { deps, pending, revokes } = makeDeps(d, { user: () => Response.json({ code: 403, message: null, content: null }) });
      await expectFail(await handleCallback(ok(), deps), 502, d);
      await Promise.all(pending);
      expect(revokes()).toHaveLength(2);
    });
    it("500 when the session store fails, after starting revoke", async () => {
      const d = createGamesTestDb();
      d.sqlite.exec("DROP TABLE auth_sessions");
      const { deps, pending } = makeDeps(d);
      const res = await handleCallback(ok(), deps);
      expect(res.status).toBe(500);
      expect(cookies(res)).toEqual(CLEAR_OAUTH);
      expect(pending).toHaveLength(1);
    });
  });

  it("never logs tokens, channel id or channel name", async () => {
    const d = createGamesTestDb();
    const { deps, pending } = makeDeps(d, { revoke: () => new Response(null, { status: 503 }) });
    await handleCallback(ok(), deps);
    await Promise.all(pending);
    const out = consoleLines.join("\n");
    expect(out).not.toBe("");
    for (const needle of [TOKENS.accessToken, TOKENS.refreshToken, USER.channelId, USER.channelName, "csecret"])
      expect(out).not.toContain(needle);
  });
});
