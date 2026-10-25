import { describe, expect, it, vi } from "vitest";
import { CHZZK_VOD_MESSAGE, TITLE_MAX } from "./schema.ts";
import type { FetchLike } from "./types.ts";
import { dateFromTitle, fetchYoutubeMeta, normalizeYoutubeUrl, OEMBED_ENDPOINT, YoutubeMetaError } from "./youtube-meta.ts";

describe("YoutubeMetaError", () => {
  it("keeps code, name and message", () => {
    const e = new YoutubeMetaError("not_found", "없어요");
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("not_found");
    expect(e.name).toBe("YoutubeMetaError");
    expect(e.message).toBe("없어요");
  });
});

describe("normalizeYoutubeUrl", () => {
  const ID = "yZc0TxcVEok";
  const WANT = { videoId: ID, url: `https://www.youtube.com/watch?v=${ID}` };
  it("normalizes watch, mobile, youtu.be and extra params", () => {
    for (const raw of [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com/watch?v=${ID}&t=30s&list=x`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://youtu.be/${ID}?si=abc`,
      `  https://youtu.be/${ID}\n`,
    ]) {
      expect(normalizeYoutubeUrl(raw)).toEqual(WANT);
    }
  });
  it("returns null for non-youtube, malformed or empty input", () => {
    for (const raw of ["", "   ", "not a url", "http://youtu.be/yZc0TxcVEok", "https://www.youtube.com/watch?v=short", "https://example.com/watch?v=yZc0TxcVEok", "https://www.youtube.com/shorts/yZc0TxcVEok"]) {
      expect(normalizeYoutubeUrl(raw)).toBeNull();
    }
  });
  it("exposes endpoint constant", () => {
    expect(OEMBED_ENDPOINT).toBe("https://www.youtube.com/oembed");
    expect(CHZZK_VOD_MESSAGE).toContain("유튜브");
  });
});

describe("dateFromTitle", () => {
  it("reads real-world title formats", () => {
    expect(dateFromTitle("파멸의 오타쿠 했어요 [ 2026. 10. 23 ]")).toBe("2026-10-23");
    expect(dateFromTitle("제목 [ 2026. 06 . 24 ]")).toBe("2026-06-24");
    expect(dateFromTitle("제목 [ 20261001 ]")).toBe("2026-10-01");
    expect(dateFromTitle("제목 [ 2026. 05 23 ]")).toBe("2026-05-23");
    expect(dateFromTitle("제목 [2026.1.5]")).toBe("2026-01-05");
    expect(dateFromTitle("제목 [ 2026. 10. 23. ]")).toBe("2026-10-23");
  });
  it("returns null when absent or impossible", () => {
    expect(dateFromTitle("제목 [ 20026. 07. 21 ]")).toBeNull();
    expect(dateFromTitle("대괄호 없음 2026. 10. 23")).toBeNull();
    expect(dateFromTitle("제목 [ 2026. 02. 30 ]")).toBeNull();
    expect(dateFromTitle("제목 [ 2026. 13. 01 ]")).toBeNull();
    expect(dateFromTitle("")).toBeNull();
    expect(dateFromTitle("[공지] 제목")).toBeNull();
  });
  it("uses the last bracket group", () => {
    expect(dateFromTitle("[ 2025. 01. 01 ] 제목 [ 2026. 10. 23 ]")).toBe("2026-10-23");
    expect(dateFromTitle("[ 2026. 10. 23 ] 제목 [끝]")).toBeNull();
    expect(dateFromTitle("[ 2026. 10. 23 ] 제목 [ 2026. 02. 30 ]")).toBeNull();
  });
});

const ID = "yZc0TxcVEok";
const URL_OK = `https://youtu.be/${ID}?si=zz`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
function fetchOf(res: Response | (() => Promise<Response>)): FetchLike & ReturnType<typeof vi.fn> {
  return vi.fn(typeof res === "function" ? res : async () => res) as never;
}
async function codeOf(p: Promise<unknown>): Promise<{ code: string; message: string }> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(YoutubeMetaError);
    return { code: (e as YoutubeMetaError).code, message: (e as YoutubeMetaError).message };
  }
  throw new Error("did not throw");
}

describe("fetchYoutubeMeta", () => {
  it("requests oEmbed with the normalized url and returns meta with date", async () => {
    const f = fetchOf(json({ title: "  파멸의 오타쿠 했어요 [ 2026. 10. 23 ]  ", author_name: "x" }));
    const meta = await fetchYoutubeMeta(f, `  ${URL_OK} `);
    expect(meta).toEqual({
      videoId: ID,
      url: `https://www.youtube.com/watch?v=${ID}`,
      title: "파멸의 오타쿠 했어요 [ 2026. 10. 23 ]",
      date: "2026-10-23",
    });
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe(`${OEMBED_ENDPOINT}?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${ID}`)}&format=json`);
  });
  it("date is null when the title has none", async () => {
    expect((await fetchYoutubeMeta(fetchOf(json({ title: "날짜 없음" })), URL_OK)).date).toBeNull();
  });
  it("rejects chzzk links before fetching", async () => {
    const f = fetchOf(json({ title: "x" }));
    const e = await codeOf(fetchYoutubeMeta(f, "https://chzzk.naver.com/video/123"));
    expect(e).toEqual({ code: "chzzk_vod", message: CHZZK_VOD_MESSAGE });
    expect(f).not.toHaveBeenCalled();
  });
  it("rejects non-youtube links before fetching", async () => {
    const f = fetchOf(json({ title: "x" }));
    expect((await codeOf(fetchYoutubeMeta(f, "https://example.com/a"))).code).toBe("invalid_url");
    expect((await codeOf(fetchYoutubeMeta(f, "  "))).code).toBe("invalid_url");
    expect(f).not.toHaveBeenCalled();
  });
  it("maps network errors to upstream without leaking the cause", async () => {
    const e = await codeOf(fetchYoutubeMeta(fetchOf(async () => { throw new TypeError("secret-host down"); }), URL_OK));
    expect(e.code).toBe("upstream");
    expect(e.message).not.toContain("secret-host");
  });
  it("maps 400/401/403/404 to not_found", async () => {
    for (const status of [400, 401, 403, 404]) {
      expect((await codeOf(fetchYoutubeMeta(fetchOf(new Response("Not Found", { status })), URL_OK))).code).toBe("not_found");
    }
  });
  it("maps other failures to upstream and keeps the body out of the message", async () => {
    for (const status of [429, 500, 502, 301]) {
      const e = await codeOf(fetchYoutubeMeta(fetchOf(new Response("BODY-LEAK", { status })), URL_OK));
      expect(e.code).toBe("upstream");
      expect(e.message).not.toContain("BODY-LEAK");
    }
  });
  it("maps non-JSON and bad title payloads to upstream", async () => {
    const bad: Array<Response> = [
      new Response("<html>BODY-LEAK</html>", { status: 200 }),
      json(null),
      json([]),
      json({}),
      json({ title: 5 }),
      json({ title: "" }),
      json({ title: "   " }),
    ];
    for (const res of bad) {
      const e = await codeOf(fetchYoutubeMeta(fetchOf(res), URL_OK));
      expect(e.code).toBe("upstream");
      expect(e.message).not.toContain("BODY-LEAK");
    }
  });
  it("truncates to TITLE_MAX UTF-16 units and trims the end", async () => {
    const long = "가".repeat(TITLE_MAX + 50);
    expect((await fetchYoutubeMeta(fetchOf(json({ title: long })), URL_OK)).title).toBe("가".repeat(TITLE_MAX));
    const spaced = `${"a".repeat(TITLE_MAX - 1)} b`;
    expect((await fetchYoutubeMeta(fetchOf(json({ title: spaced })), URL_OK)).title).toBe("a".repeat(TITLE_MAX - 1));
    const exact = "b".repeat(TITLE_MAX);
    expect((await fetchYoutubeMeta(fetchOf(json({ title: exact })), URL_OK)).title).toBe(exact);
  });
  it("drops a surrogate pair cut in half", async () => {
    const t = `${"a".repeat(TITLE_MAX - 1)}😀`;
    const out = (await fetchYoutubeMeta(fetchOf(json({ title: t })), URL_OK)).title;
    expect(out).toBe("a".repeat(TITLE_MAX - 1));
    const whole = `${"a".repeat(TITLE_MAX - 2)}😀`;
    expect((await fetchYoutubeMeta(fetchOf(json({ title: whole })), URL_OK)).title).toBe(whole);
  });
  it("reads the date from the original title even when it gets cut", async () => {
    const t = `[ 2026. 10. 23 ] ${"x".repeat(TITLE_MAX)}`;
    const meta = await fetchYoutubeMeta(fetchOf(json({ title: t })), URL_OK);
    expect(meta.title.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(meta.date).toBe("2026-10-23");
  });
});
