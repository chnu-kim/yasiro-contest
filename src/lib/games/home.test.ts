import { describe, expect, it } from "vitest";
import { buildHomeData } from "./home.ts";
import type { Game, GameStatus, Vod } from "./types.ts";

// 기본 제목은 그 게임 이름을 담는다(g의 이름은 `이름-${id}`)
const vod = (id: string, date: string, title?: string): Vod => ({
  title: title ?? `${id} 했어요`,
  url: `https://www.youtube.com/watch?v=${id}`,
  date,
});

function g(id: string, firstPlayed: string | null, vods: Vod[], status: GameStatus = "clear"): Game {
  return { id, name: `이름-${id}`, firstPlayed, status, vods };
}
/** 제목이 게임 이름을 담은 다시보기 */
const own = (gameId: string, videoId: string, date: string): Vod => vod(videoId, date, `이름-${gameId} 했어요`);

describe("buildHomeData", () => {
  it("빈 목록이면 숫자 0, 최근 없음, 탐험 없음", () => {
    expect(buildHomeData([], 4)).toEqual({ total: 0, clear: 0, latest: null, featured: null, rows: [] });
  });

  it("개수·정복 수와 가장 최근 게임을 /games와 같은 번호로 돌려준다", () => {
    const games = [
      g("old", "2025-01-01", [own("old", "aaaaaaaaaaa", "2025-01-01")], "fail"),
      g("new", "2026-11-17", [own("new", "bbbbbbbbbbb", "2026-11-17")]),
      g("nodate", null, [own("nodate", "ccccccccccc", "2024-01-01")]),
    ];
    const data = buildHomeData(games, 4);
    expect(data.total).toBe(3);
    expect(data.clear).toBe(2);
    expect(data.latest).toEqual({ id: "new", name: "이름-new", firstPlayed: "2026-11-17" });
    expect([data.featured?.id, data.featured?.no]).toEqual(["new", "003"]);
    expect(data.rows.map((e) => [e.id, e.no])).toEqual([["old", "002"]]);
  });

  it("날짜 없는 게임과 다시보기 없는 게임은 탐험 띠에서 뺀다", () => {
    const games = [
      g("novod", "2026-11-20", []),
      g("withvod", "2026-11-10", [own("withvod", "ddddddddddd", "2026-11-10")]),
      g("nodate", null, [own("nodate", "eeeeeeeeeee", "2024-01-01")]),
    ];
    const data = buildHomeData(games, 4);
    expect(data.latest?.id).toBe("novod");
    expect(data.featured?.id).toBe("withvod");
    expect(data.rows).toEqual([]);
  });

  it("대표 칸은 이름을 담은 가장 이른 다시보기의 썸네일·주소·제목을 쓴다", () => {
    const games = [
      g("a", "2026-11-01", [
        vod("fffffffffff", "2026-11-01", "리그 오브 레전드 했어요"),
        own("a", "ggggggggggg", "2026-11-02"),
        own("a", "kkkkkkkkkkk", "2026-11-03"),
      ]),
    ];
    expect(buildHomeData(games, 4).featured).toEqual({
      id: "a",
      name: "이름-a",
      no: "001",
      firstPlayed: "2026-11-01",
      status: "clear",
      videoId: "ggggggggggg",
      vodUrl: "https://www.youtube.com/watch?v=ggggggggggg",
      vodTitle: "이름-a 했어요",
      thumbnailUrl: "https://i.ytimg.com/vi/ggggggggggg/hqdefault.jpg",
    });
  });

  it("대표 칸은 이름 담은 썸네일이 있는 가장 최근 게임, 그보다 최근인 게임은 글자 줄로 (휴먼 벤치마크)", () => {
    const lol = vod("lllllllllll", "2026-09-28", "9월 4주차 금주 신상 식음료 보고 리그 오브 레전드 했어요");
    const games = [
      g("bench", "2026-09-28", [lol], "unknown"),
      g("lily", "2026-10-05", [own("lily", "mmmmmmmmmmm", "2026-10-05")]),
      g("aaa", "2026-10-19", [vod("nnnnnnnnnnn", "2026-10-19", "리그 오브 레전드 했어요")], "fail"),
    ];
    const data = buildHomeData(games, 4);
    expect(data.featured?.id).toBe("lily");
    // 글자 줄은 기존 순서(최신순)와 첫 다시보기 주소를 그대로 쓴다
    expect(data.rows.map((e) => [e.id, e.vodUrl])).toEqual([
      ["aaa", "https://www.youtube.com/watch?v=nnnnnnnnnnn"],
      ["bench", "https://www.youtube.com/watch?v=lllllllllll"],
    ]);
  });

  it("대표 칸은 limit보다 오래된 게임에서도 찾고, 글자 줄은 최근 것부터 limit-1개", () => {
    const games = [
      g("a", "2026-11-01", [own("a", "aaaaaaaaaaa", "2026-11-01")]),
      g("b", "2026-11-02", [vod("bbbbbbbbbbb", "2026-11-02", "저챗")]),
      g("c", "2026-11-03", [vod("ccccccccccc", "2026-11-03", "저챗")]),
      g("d", "2026-11-04", [vod("ddddddddddd", "2026-11-04", "저챗")]),
    ];
    const data = buildHomeData(games, 2);
    expect(data.featured?.id).toBe("a");
    expect(data.rows.map((e) => e.id)).toEqual(["d"]);
  });

  it("이름 담은 썸네일이 하나도 없으면 대표 칸 없이 글자 줄만 limit개", () => {
    const games = ["a", "b"].map((id, i) => g(id, `2026-11-0${i + 1}`, [vod(id.repeat(11), `2026-11-0${i + 1}`, "저챗")]));
    const data = buildHomeData(games, 4);
    expect(data.featured).toBeNull();
    expect(data.rows.map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("유튜브가 아닌 주소는 건너뛰고 다음 다시보기를 쓴다", () => {
    const bad: Vod = { title: "이름-a 했어요", url: "https://example.com/x", date: "2026-11-01" };
    const games = [g("a", "2026-11-01", [bad, own("a", "hhhhhhhhhhh", "2026-11-02")])];
    expect(buildHomeData(games, 4).featured?.videoId).toBe("hhhhhhhhhhh");
  });

  it("같은 첫 영상을 쓰는 게임은 더 최근(목록 앞) 것 하나만 남긴다. 여러 게임 방송은 대표 칸이 되지 못한다", () => {
    const shared = vod("iiiiiiiiiii", "2026-10-30", "이름-plant랑 이름-bonk 했어요");
    const games = [
      g("plant", "2026-10-30", [shared]),
      g("bonk", "2026-10-30", [shared], "fail"),
      g("mole", "2026-10-29", [own("mole", "jjjjjjjjjjj", "2026-10-29")]),
    ];
    const data = buildHomeData(games, 4);
    // plant는 bonk와 첫 영상이 같아 빠지고, 그 영상은 두 게임 방송이라 bonk는 글자 줄로 간다
    expect(data.featured?.id).toBe("mole");
    expect(data.rows.map((e) => e.id)).toEqual(["bonk"]);
  });

  it("대표 칸 포함 limit개까지만 돌려준다", () => {
    const games = ["a", "b", "c"].map((id, i) => g(id, `2026-11-0${i + 1}`, [own(id, id.repeat(11), `2026-11-0${i + 1}`)]));
    const data = buildHomeData(games, 2);
    expect([data.featured?.id, ...data.rows.map((e) => e.id)]).toEqual(["c", "b"]);
  });
});
