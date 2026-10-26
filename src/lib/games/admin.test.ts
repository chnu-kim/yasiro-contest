import { describe, expect, it } from "vitest";
import {
  YASIRO_CHANNEL_ID,
  actorNameFor,
  getSessionActor,
  isAdminChannel,
  parseAdminIds,
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

describe("getSessionActor", () => {
  const ids = parseAdminIds(FAKE_ADMIN_ID);
  const setup = () => {
    const d = createGamesTestDb();
    insertSession(d, { id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", channelId: FAKE_ADMIN_ID, channelName: "실명채널", expiresAt: NOW + 100 });
    insertSession(d, { id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", channelId: YASIRO_CHANNEL_ID, channelName: "야시로본명", expiresAt: NOW + 100 });
    insertSession(d, { id: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc", channelId: FAKE_USER_ID, channelName: "일반", expiresAt: NOW + 100 });
    insertSession(d, { id: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", channelId: FAKE_ADMIN_ID, channelName: "실명채널", expiresAt: NOW - 1 });
    insertSession(d, { id: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", channelId: FAKE_ADMIN_ID, channelName: "실명채널", expiresAt: NOW });
    return d;
  };
  const run = (cookie: string | null) => getSessionActor(setup().db, cookie, NOW, ids);

  it("anonymous without cookie", async () => {
    expect(await run(null)).toEqual({ kind: "anonymous" });
    expect(await run("other=1")).toEqual({ kind: "anonymous" });
  });
  it("expired for expired, boundary and unknown sessions", async () => {
    expect(await run("__Host-session=dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd")).toEqual({ kind: "expired" });
    expect(await run("__Host-session=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")).toEqual({ kind: "expired" });
    expect(await run("__Host-session=0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f")).toEqual({ kind: "expired" });
  });
  it("anonymous for a malformed session id (no DB lookup)", async () => {
    expect(await run("__Host-session=nope")).toEqual({ kind: "anonymous" });
  });
  it("user for non-admin", async () => {
    expect(await run("__Host-session=cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc")).toEqual({ kind: "user" });
  });
  it("admin gets alias, never the channel name", async () => {
    const r = await run("a=1; __Host-session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(r).toEqual({ kind: "admin", actor: { channelId: FAKE_ADMIN_ID, name: "관리자" } });
    expect(JSON.stringify(r)).not.toContain("실명채널");
  });
  it("yasiro gets its alias", async () => {
    expect(await run("__Host-session=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")).toEqual({
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
    await getSessionActor(spy, "__Host-session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", NOW, ids);
    expect(queries).toHaveLength(1);
    expect(queries[0]).not.toMatch(/channel_name/);
  });
});
