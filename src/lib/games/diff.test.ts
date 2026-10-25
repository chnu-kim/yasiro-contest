import { describe, expect, it } from "vitest";
import { changeSummary, conflictMessage, diffGames, FIELD_LABEL, FIELD_ORDER, formatChangeTime } from "./diff.ts";
import type { Game } from "./types.ts";

const V1 = { title: "1화", url: "https://www.youtube.com/watch?v=aaaaaaaaaaa", date: "2026-10-01" };
const V2 = { title: "2화", url: "https://www.youtube.com/watch?v=bbbbbbbbbbb", date: "2026-10-02" };
const V3 = { title: "3화", url: "https://youtu.be/ccccccccccc", date: "2026-10-03" };

function game(over: Partial<Game> = {}): Game {
  return { id: "g", name: "엘든 링", firstPlayed: "2026-10-01", status: "unknown", vods: [], ...over };
}

describe("FIELD_ORDER / FIELD_LABEL", () => {
  it("순서와 라벨", () => {
    expect(FIELD_ORDER).toEqual(["name", "originalTitle", "category", "firstPlayed", "status", "vods"]);
    expect(FIELD_LABEL.status).toBe("정복 여부");
    expect(FIELD_LABEL.category).toBe("치지직 카테고리");
    expect(FIELD_LABEL.vods).toBe("다시보기");
  });
});

describe("diffGames", () => {
  it("같으면 빈 배열", () => expect(diffGames(game(), game())).toEqual([]));
  it("name", () => expect(diffGames(game(), game({ name: "다크 소울" }))).toEqual(["name"]));
  it("originalTitle", () => expect(diffGames(game(), game({ originalTitle: "ELDEN" }))).toEqual(["originalTitle"]));
  it("categoryId", () => expect(diffGames(game(), game({ categoryId: "c1" }))).toEqual(["category"]));
  it("포스터만 다름", () =>
    expect(diffGames(game({ categoryId: "c", posterUrl: "https://a.pstatic.net/1" }), game({ categoryId: "c", posterUrl: "https://a.pstatic.net/2" }))).toEqual(["category"]));
  it("firstPlayed", () => expect(diffGames(game(), game({ firstPlayed: null }))).toEqual(["firstPlayed"]));
  it("status", () => expect(diffGames(game(), game({ status: "clear" }))).toEqual(["status"]));
  it("vods", () => expect(diffGames(game(), game({ vods: [V1] }))).toEqual(["vods"]));
  it("vods 제목·날짜·url 차이", () => {
    expect(diffGames(game({ vods: [V1] }), game({ vods: [{ ...V1, title: "x" }] }))).toEqual(["vods"]);
    expect(diffGames(game({ vods: [V1] }), game({ vods: [{ ...V1, date: "2026-10-05" }] }))).toEqual(["vods"]);
    expect(diffGames(game({ vods: [V1] }), game({ vods: [{ ...V1, url: V2.url }] }))).toEqual(["vods"]);
  });
  it("다시보기 순서만 다름(정렬 후 같음)", () =>
    expect(diffGames(game({ vods: [V1, V2] }), game({ vods: [V2, V1] }))).toEqual([]));
  it("여러 개는 FIELD_ORDER 순", () =>
    expect(diffGames(game(), game({ vods: [V1], status: "clear", name: "x" }))).toEqual(["name", "status", "vods"]));
});

describe("changeSummary", () => {
  it("고정 문구 4종", () => {
    expect(changeSummary("import", null, game())).toBe("games.json에서 가져옴");
    expect(changeSummary("create", null, game())).toBe("게임 추가");
    expect(changeSummary("hide", game(), game())).toBe("목록에서 숨김");
    expect(changeSummary("unhide", game(), game())).toBe("다시 보이기");
  });
  it("update 변경 없음", () => {
    expect(changeSummary("update", game(), game())).toBe("변경 없음");
    expect(changeSummary("update", null, game())).toBe("변경 없음");
  });
  it("이름·원제", () => {
    expect(changeSummary("update", game(), game({ name: "B" }))).toBe("이름 엘든 링 → B");
    expect(changeSummary("update", game(), game({ originalTitle: "E" }))).toBe("원제 없음 → E");
    expect(changeSummary("update", game({ originalTitle: "E" }), game())).toBe("원제 E → 없음");
  });
  it("카테고리", () => {
    expect(changeSummary("update", game(), game({ categoryId: "c2" }))).toBe("치지직 카테고리 없음 → c2");
    expect(changeSummary("update", game({ categoryId: "c1" }), game())).toBe("치지직 카테고리 c1 → 없음");
    expect(
      changeSummary("update", game({ categoryId: "c", posterUrl: "https://a.pstatic.net/1" }), game({ categoryId: "c", posterUrl: "https://a.pstatic.net/2" })),
    ).toBe("포스터 바뀜");
  });
  it("첫 플레이·정복 여부", () => {
    expect(changeSummary("update", game({ firstPlayed: "2026-10-10" }), game({ firstPlayed: null }))).toBe("첫 플레이 2026.10.10 → 날짜 기록 없음");
    expect(changeSummary("update", game(), game({ status: "clear" }))).toBe("정복 여부 모름 → 정복");
  });
  it("다시보기 추가·삭제·둘 다·정보 수정", () => {
    expect(changeSummary("update", game(), game({ vods: [V1] }))).toBe("다시보기 1편 추가");
    expect(changeSummary("update", game({ vods: [V1, V2] }), game())).toBe("다시보기 2편 삭제");
    expect(changeSummary("update", game({ vods: [V1, V2] }), game({ vods: [V2, V3] }))).toBe("다시보기 1편 추가·1편 삭제");
    expect(changeSummary("update", game({ vods: [V1] }), game({ vods: [{ ...V1, title: "새" }] }))).toBe("다시보기 정보 수정");
  });
  it("영상 id를 못 읽는 url도 url로 비교", () => {
    const odd = { ...V1, url: "not-a-url" };
    expect(changeSummary("update", game(), game({ vods: [odd] }))).toBe("다시보기 1편 추가");
  });
  it("여러 필드는 ', '로 잇는다", () => {
    expect(changeSummary("update", game(), game({ name: "B", status: "clear" }))).toBe("이름 엘든 링 → B, 정복 여부 모름 → 정복");
  });
  it("300자 초과는 코드포인트 299자 + …", () => {
    const long = "😀".repeat(400);
    const s = changeSummary("update", game(), game({ name: long }));
    expect(Array.from(s)).toHaveLength(300);
    expect(s.endsWith("…")).toBe(true);
    expect(s).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);
  });
  it("300자 이하는 그대로", () => {
    const s = changeSummary("update", game(), game({ name: "가".repeat(100) }));
    expect(s.endsWith("…")).toBe(false);
  });
});

describe("formatChangeTime", () => {
  it("KST 고정", () => {
    expect(formatChangeTime(Date.UTC(2026, 9, 25, 5, 2) / 1000)).toBe("2026.10.25 14:02");
  });
  it("UTC 15:00은 다음날 00:00", () => {
    expect(formatChangeTime(Date.UTC(2026, 9, 24, 15, 0) / 1000)).toBe("2026.10.25 00:00");
  });
});

describe("conflictMessage", () => {
  const at = Date.UTC(2026, 9, 25, 5, 2) / 1000;
  it("조사 3종", () => {
    expect(conflictMessage({ updatedByName: "관리자", updatedAt: at })).toBe("관리자가 방금(14:02) 이 게임을 먼저 고쳤어요. 저장하면 그 변경을 덮어써요.");
    expect(conflictMessage({ updatedByName: "야시로", updatedAt: at })).toContain("야시로가 방금");
    expect(conflictMessage({ updatedByName: "시스템", updatedAt: at })).toContain("시스템이 방금");
  });
});
