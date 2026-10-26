import { describe, it, expect } from "vitest";
import { validateMessage, getPostItStyle, handleGuestbookPost } from "./guestbook";
import { FAKE_ADMIN_ID, applyMigrations, createTestD1, insertSession } from "./games/test-d1";

describe("validateMessage", () => {
  it("정상 메시지는 trim된 값을 반환한다", () => {
    const result = validateMessage("  안녕하세요!  ");
    expect(result).toEqual({ ok: true, value: "안녕하세요!" });
  });

  it("빈 메시지는 거부한다", () => {
    expect(validateMessage("")).toEqual({ ok: false, error: "메시지를 입력해주세요." });
    expect(validateMessage("   ")).toEqual({ ok: false, error: "메시지를 입력해주세요." });
  });

  it("200자 초과 메시지는 거부한다", () => {
    const long = "가".repeat(201);
    expect(validateMessage(long)).toEqual({ ok: false, error: "메시지는 200자 이내로 입력해주세요." });
  });

  it("정확히 200자는 허용한다", () => {
    const exactly = "가".repeat(200);
    const result = validateMessage(exactly);
    expect(result).toEqual({ ok: true, value: exactly });
  });
});

describe("getPostItStyle", () => {
  it("같은 id는 항상 같은 색상 인덱스를 반환한다", () => {
    const a = getPostItStyle("abc123");
    const b = getPostItStyle("abc123");
    expect(a.colorIndex).toBe(b.colorIndex);
    expect(a.rotation).toBe(b.rotation);
  });

  it("colorIndex는 0~6 범위 내에 있다", () => {
    ["a", "z", "0", "zzz", "hello"].forEach((id) => {
      const { colorIndex } = getPostItStyle(id);
      expect(colorIndex).toBeGreaterThanOrEqual(0);
      expect(colorIndex).toBeLessThan(7);
    });
  });

  it("rotation은 -6 ~ 6 도 범위 내에 있다", () => {
    for (let i = 0; i < 20; i++) {
      const { rotation } = getPostItStyle(String(i));
      expect(rotation).toBeGreaterThanOrEqual(-6);
      expect(rotation).toBeLessThanOrEqual(6);
    }
  });
});

describe("handleGuestbookPost", () => {
  const NOW = 1_792_900_000;
  const ID = "0123456789abcdef".repeat(4);
  const ORIGIN = "https://yasiro.stream";

  function setup() {
    const d = createTestD1();
    applyMigrations(d, ["0002_guestbook.sql", "0009_auth_sessions.sql"]);
    insertSession(d, { id: ID, channelId: FAKE_ADMIN_ID, channelName: "표시이름", expiresAt: NOW + 100 });
    insertSession(d, { id: "f".repeat(64), channelId: FAKE_ADMIN_ID, channelName: "표시이름", expiresAt: NOW });
    return d;
  }
  const post = (body: string, headers: Record<string, string> = {}) =>
    new Request(`${ORIGIN}/api/guestbook`, {
      method: "POST",
      headers: { origin: ORIGIN, cookie: `__Host-session=${ID}`, "content-type": "application/json", ...headers },
      body,
    });
  const run = (d: ReturnType<typeof setup>, req: Request) =>
    handleGuestbookPost(req, { db: d.db, now: () => NOW, newId: () => "note-1" });
  const rows = (d: ReturnType<typeof setup>) => d.sqlite.prepare("SELECT * FROM guestbook").all();

  it("stores the note with the session's channel and returns 201", async () => {
    const d = setup();
    const res = await run(d, post(JSON.stringify({ message: "  안녕  " })));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "note-1" });
    expect(rows(d)).toMatchObject([
      { id: "note-1", message: "안녕", channel_id: FAKE_ADMIN_ID, channel_name: "표시이름" },
    ]);
  });
  it("403 for cross-origin before anything else", async () => {
    const d = setup();
    const res = await run(d, post(JSON.stringify({ message: "x" }), { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(typeof ((await res.json()) as { error: unknown }).error).toBe("string");
    expect(rows(d)).toHaveLength(0);
  });
  it("401 without a cookie or with a malformed one", async () => {
    const d = setup();
    for (const cookie of ["", "__Host-session=nope"]) {
      const res = await run(d, post(JSON.stringify({ message: "x" }), { cookie }));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "로그인이 필요합니다." });
    }
  });
  it("401 expired for unknown and expired sessions", async () => {
    const d = setup();
    for (const id of ["a".repeat(64), "f".repeat(64)]) {
      const res = await run(d, post(JSON.stringify({ message: "x" }), { cookie: `__Host-session=${id}` }));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "세션이 만료되었습니다. 다시 로그인해주세요." });
    }
  });
  it("400 for bad JSON, missing/non-string message and failed validation", async () => {
    const d = setup();
    const bad = await run(d, post("{"));
    expect([bad.status, await bad.json()]).toEqual([400, { error: "잘못된 요청 형식입니다." }]);
    for (const body of ["null", "{}", JSON.stringify({ message: 1 })]) {
      const res = await run(d, post(body));
      expect([res.status, await res.json()]).toEqual([400, { error: "메시지를 입력해주세요." }]);
    }
    const long = await run(d, post(JSON.stringify({ message: "가".repeat(201) })));
    expect(long.status).toBe(400);
    expect(rows(d)).toHaveLength(0);
  });
});
