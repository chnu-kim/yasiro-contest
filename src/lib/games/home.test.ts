import { describe, expect, it } from "vitest";
import { buildHomeData, youtubeThumbnailUrl } from "./home.ts";
import type { Game, GameStatus, Vod } from "./types.ts";

const vod = (id: string, date: string, title = `영상 ${id}`): Vod => ({
  title,
  url: `https://www.youtube.com/watch?v=${id}`,
  date,
});

function g(id: string, firstPlayed: string | null, vods: Vod[], status: GameStatus = "clear"): Game {
  return { id, name: `이름-${id}`, firstPlayed, status, vods };
}

describe("youtubeThumbnailUrl", () => {
  it("hqdefault 썸네일 주소를 만든다", () => {
    expect(youtubeThumbnailUrl("WAB1r0yczck")).toBe("https://i.ytimg.com/vi/WAB1r0yczck/hqdefault.jpg");
  });
});

describe("buildHomeData", () => {
  it("빈 목록이면 숫자 0, 최근 없음, 탐험 없음", () => {
    expect(buildHomeData([], 5)).toEqual({ total: 0, clear: 0, latest: null, expeditions: [] });
  });

  it("개수·정복 수와 가장 최근 게임을 /games와 같은 번호로 돌려준다", () => {
    const games = [
      g("old", "2025-01-01", [vod("aaaaaaaaaaa", "2025-01-01")], "fail"),
      g("new", "2026-11-17", [vod("bbbbbbbbbbb", "2026-11-17")]),
      g("nodate", null, [vod("ccccccccccc", "2024-01-01")]),
    ];
    const data = buildHomeData(games, 5);
    expect(data.total).toBe(3);
    expect(data.clear).toBe(2);
    expect(data.latest).toEqual({ id: "new", name: "이름-new", firstPlayed: "2026-11-17" });
    expect(data.expeditions.map((e) => [e.id, e.no])).toEqual([
      ["new", "003"],
      ["old", "002"],
    ]);
  });

  it("날짜 없는 게임과 다시보기 없는 게임은 탐험 띠에서 뺀다", () => {
    const games = [
      g("novod", "2026-11-20", []),
      g("withvod", "2026-11-10", [vod("ddddddddddd", "2026-11-10")]),
      g("nodate", null, [vod("eeeeeeeeeee", "2024-01-01")]),
    ];
    const data = buildHomeData(games, 5);
    expect(data.latest?.id).toBe("novod");
    expect(data.expeditions.map((e) => e.id)).toEqual(["withvod"]);
  });

  it("가장 이른 다시보기를 쓰고, 영상 ID·제목·썸네일을 담는다", () => {
    const games = [g("a", "2026-11-01", [vod("fffffffffff", "2026-11-01", "첫 방송"), vod("ggggggggggg", "2026-11-02")])];
    expect(buildHomeData(games, 5).expeditions[0]).toEqual({
      id: "a",
      name: "이름-a",
      no: "001",
      firstPlayed: "2026-11-01",
      status: "clear",
      videoId: "fffffffffff",
      vodUrl: "https://www.youtube.com/watch?v=fffffffffff",
      vodTitle: "첫 방송",
      thumbnailUrl: "https://i.ytimg.com/vi/fffffffffff/hqdefault.jpg",
    });
  });

  it("유튜브가 아닌 주소는 건너뛰고 다음 다시보기를 쓴다", () => {
    const bad: Vod = { title: "잘못된", url: "https://example.com/x", date: "2026-11-01" };
    const games = [g("a", "2026-11-01", [bad, vod("hhhhhhhhhhh", "2026-11-02")])];
    expect(buildHomeData(games, 5).expeditions[0].videoId).toBe("hhhhhhhhhhh");
  });

  it("같은 영상을 쓰는 게임은 더 최근(목록 앞) 것 하나만 남긴다", () => {
    const shared = "iiiiiiiiiii";
    const games = [
      g("plant", "2026-10-30", [vod(shared, "2026-10-30")]),
      g("bonk", "2026-10-30", [vod(shared, "2026-10-30")], "fail"),
      g("mole", "2026-10-29", [vod("jjjjjjjjjjj", "2026-10-29")]),
    ];
    expect(buildHomeData(games, 5).expeditions.map((e) => e.id)).toEqual(["bonk", "mole"]);
  });

  it("limit개까지만 돌려준다", () => {
    const games = ["a", "b", "c"].map((id, i) => g(id, `2026-11-0${i + 1}`, [vod(id.repeat(11), `2026-11-0${i + 1}`)]));
    expect(buildHomeData(games, 2).expeditions.map((e) => e.id)).toEqual(["c", "b"]);
  });
});
