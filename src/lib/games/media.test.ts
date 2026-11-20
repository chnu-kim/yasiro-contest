import { describe, expect, it } from "vitest";
import { fieldPhoto, firstYoutubeVod, youtubeThumbnailUrl } from "./media.ts";
import type { Game, Vod } from "./types.ts";

const vod = (id: string, date: string): Vod => ({ title: `영상 ${id}`, url: `https://www.youtube.com/watch?v=${id}`, date });
const bad: Vod = { title: "잘못된", url: "https://example.com/x", date: "2026-11-01" };

function g(vods: Vod[], posterUrl?: string): Game {
  return { id: "a", name: "이름", firstPlayed: "2026-11-01", status: "clear", vods, ...(posterUrl ? { posterUrl } : {}) };
}

describe("youtubeThumbnailUrl", () => {
  it("hqdefault 썸네일 주소를 만든다", () => {
    expect(youtubeThumbnailUrl("WAB1r0yczck")).toBe("https://i.ytimg.com/vi/WAB1r0yczck/hqdefault.jpg");
  });
});

describe("firstYoutubeVod", () => {
  it("다시보기가 없으면 null", () => {
    expect(firstYoutubeVod(g([]))).toBeNull();
  });

  it("유튜브가 아닌 주소는 건너뛰고 첫 유튜브 영상과 ID를 돌려준다", () => {
    const v = vod("bbbbbbbbbbb", "2026-11-02");
    expect(firstYoutubeVod(g([bad, v, vod("ccccccccccc", "2026-11-03")]))).toEqual({ vod: v, videoId: "bbbbbbbbbbb" });
  });

  it("유튜브 주소가 하나도 없으면 null", () => {
    expect(firstYoutubeVod(g([bad]))).toBeNull();
  });
});

describe("fieldPhoto", () => {
  it("포스터가 있으면 현장 사진을 쓰지 않는다", () => {
    expect(fieldPhoto(g([vod("ddddddddddd", "2026-11-01")], "https://nng-phinf.pstatic.net/a.png"))).toBeNull();
  });

  it("포스터가 없으면 첫 다시보기 썸네일과 날짜", () => {
    expect(fieldPhoto(g([vod("eeeeeeeeeee", "2026-11-01"), vod("fffffffffff", "2026-11-05")]))).toEqual({
      thumbnailUrl: "https://i.ytimg.com/vi/eeeeeeeeeee/hqdefault.jpg",
      date: "2026-11-01",
    });
  });

  it("포스터도 다시보기도 없으면 null", () => {
    expect(fieldPhoto(g([]))).toBeNull();
  });
});
