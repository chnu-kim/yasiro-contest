import { describe, expect, it } from "vitest";
import {
  fieldPhoto,
  firstYoutubeVod,
  namedYoutubeVod,
  normalizeForMatch,
  titleNamesGame,
  titleNamesOnlyGame,
  youtubeThumbnailUrl,
} from "./media.ts";
import type { Game, Vod } from "./types.ts";

const vod = (id: string, date: string, title = `이름 했어요 [ ${date} ]`): Vod => ({
  title,
  url: `https://www.youtube.com/watch?v=${id}`,
  date,
});
const bad: Vod = { title: "이름 했어요", url: "https://example.com/x", date: "2026-11-01" };

function g(vods: Vod[], extra: Partial<Game> = {}): Game {
  return { id: "a", name: "이름", firstPlayed: "2026-11-01", status: "clear", vods, ...extra };
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

  it("유튜브가 아닌 주소는 건너뛰고 첫 유튜브 영상과 ID를 돌려준다(제목은 보지 않는다)", () => {
    const v = vod("bbbbbbbbbbb", "2026-11-02", "다른 게임 했어요");
    expect(firstYoutubeVod(g([bad, v, vod("ccccccccccc", "2026-11-03")]))).toEqual({ vod: v, videoId: "bbbbbbbbbbb" });
  });

  it("유튜브 주소가 하나도 없으면 null", () => {
    expect(firstYoutubeVod(g([bad]))).toBeNull();
  });
});

describe("normalizeForMatch", () => {
  it("NFKC·소문자로 바꾸고 공백·문장부호·기호를 지운다(모든 문자 체계의 글자·숫자는 남긴다)", () => {
    expect(normalizeForMatch("Pikabuu: Home 했어요 [ 2026. 11. 08 ]")).toBe("pikabuuhome했어요20261108");
    expect(normalizeForMatch("ＡＢＣ　ペンギン・ウォーズ ■■")).toBe("abcペンギンウォーズ");
    expect(normalizeForMatch("I’m going to die!")).toBe("imgoingtodie");
  });
});

describe("titleNamesGame", () => {
  const named = (title: string, name: string, originalTitle?: string) =>
    titleNamesGame(title, originalTitle === undefined ? { name } : { name, originalTitle });

  it("정규화한 제목이 정규화한 이름을 포함하면 참 (공백·문장부호 차이 무시)", () => {
    expect(named("Pikabuu: Home 했어요 [ 2026. 11. 08 ]", "Pikabuu: Home")).toBe(true);
    expect(named("Unemployment Simulator 2018 했어요", "Unemployment  Simulator2018")).toBe(true);
    expect(named("집 놀이 했어요", "집놀이")).toBe(true);
    expect(named("7월 3주차 금주 신상 식음료 보고 낙서군 했어요", "낙서군")).toBe(true);
  });

  it("다른 게임 이름만 있는 방송 제목은 거짓 (휴먼 벤치마크 → 리그 오브 레전드 방송)", () => {
    expect(
      named("9월 4주차 금주 신상 식음료 보고 리그 오브 레전드 했어요 [ 2026. 09. 28 ]", "휴먼 벤치마크", "Human Benchmark"),
    ).toBe(false);
  });

  it("이름이 없으면 원제로도 찾는다", () => {
    expect(named("Wild Animal Sports Day 했어요", "야생 동물 스포츠의 날", "Wild Animal Sports Day")).toBe(true);
  });

  it("기호뿐이라 정규화하면 빈 이름은 맞지 않는다", () => {
    expect(named("■■ 했어요", "■■")).toBe(false);
  });

  describe("정규화해서 2자 이하인 짧은 이름은 제목 맨 앞에 단어로 있을 때만", () => {
    it("뒤에 문장부호·공백이 오면 참", () => {
      expect(named("삼복(Sanfu) 했어요", "삼복")).toBe(true);
      expect(named("오목 했어요", "오목")).toBe(true);
      expect(named("6.0 했어요", "6.0")).toBe(true);
    });

    it("제목 전체가 이름이면 참", () => {
      expect(named("  오목", "오목")).toBe(true);
    });

    it("바로 뒤에 글자가 이어지면 거짓 (몰 → 몰래카메라)", () => {
      expect(named("몰래카메라 했어요", "몰")).toBe(false);
    });

    it('제목 중간에 있으면 거짓 (번호 접두 "(1) "도 맨 앞이 아니다)', () => {
      expect(named("PANICORE 하고 오목 했어요", "오목")).toBe(false);
      expect(named("(1) 오목 했어요", "오목")).toBe(false);
    });

    it("알려진 한계: 제목 중간이나 조사가 붙은 짧은 이름은 놓친다 (광화·사생, 원제를 넣으면 맞는다)", () => {
      expect(named("9월 3주차 금주 신상 식음료 보고 광화 (狂花) 했어요", "광화")).toBe(false);
      expect(named("9월 3주차 금주 신상 식음료 보고 광화 (狂花) 했어요", "광화", "狂花 (Kyouka)")).toBe(false);
      expect(named("사생이랑 Unknown Tapes 했어요", "사생")).toBe(false);
    });

    it("이름은 짧아도 원제가 3자 이상이면 원제는 포함만으로 맞는다", () => {
      expect(named("PANICORE 하고 Sanfu 했어요", "삼복", "Sanfu")).toBe(true);
    });
  });
});

describe("titleNamesOnlyGame", () => {
  const only = (title: string, name: string, originalTitle?: string) =>
    titleNamesOnlyGame(title, originalTitle === undefined ? { name } : { name, originalTitle });

  it("이름이 없으면 거짓", () => {
    expect(only("리그 오브 레전드 했어요", "휴먼 벤치마크", "Human Benchmark")).toBe(false);
  });

  it("게임이 하나인 제목은 참 (금주 신상 식음료 접두·번호·원제 괄호는 다른 게임이 아니다)", () => {
    expect(only("Pikabuu: Home 했어요 [ 2026. 11. 08 ]", "피카부 홈", "Pikabuu: Home")).toBe(true);
    expect(only("7월 3주차 금주 신상 식음료 보고 낙서군 했어요 [ 2026. 07. 20 ]", "낙서군")).toBe(true);
    expect(only("(1) 소원의 별 했어요", "소원의 별")).toBe(true);
    expect(only("펭귄워즈(ペンギンウォーズ) 했어요", "펭귄워즈", "ペンギンウォーズ")).toBe(true);
    expect(only("삼복(Sanfu) 했어요", "삼복")).toBe(true);
  });

  it("이름 안의 쉼표·'랑'은 구분자가 아니다", () => {
    expect(
      only(
        "6월 4주차 금주 신상 식음료 보고 If On A Winter's Night, Four Travelers 했어요 [ 2026. 06. 22 ]",
        "If On A Winter's Night, Four Travelers",
      ),
    ).toBe(true);
    expect(only("너의 가짜를 사랑한다 했어요", "너의 가짜를 사랑한다")).toBe(true);
  });

  it("공중전화: 확인된 오탐. 이름은 있지만 다른 게임과 함께 한 방송이라 거짓 (썸네일은 음식 사진)", () => {
    const title = "1월 4주차 금주 신상 식음료 보고 공중전화 하고 Spelunky 2 했어요 [ 2025. 01. 26 ]";
    expect(titleNamesGame(title, { name: "공중전화" })).toBe(true);
    expect(only(title, "공중전화")).toBe(false);
  });

  it("여러 게임 제목은 썸네일이 어느 게임인지 몰라 모두 거짓 (츠바사 헤븐처럼 실제로 맞는 썸네일도 잃는다)", () => {
    expect(only("2월 2주차 금주 신상 식음료 보고 츠바사 헤븐 하고 Spelunky 2 했어요", "츠바사 헤븐")).toBe(false);
    expect(only("너의 가짜를 사랑한다 하고 Spelunky 2 했어요", "너의 가짜를 사랑한다")).toBe(false);
    expect(only("PANICORE 하고 후열로 Pummel Party 했어요", "Pummel Party")).toBe(false);
    expect(only("Potato Survival + 리그 오브 레전드 했어요", "포테이토 서바이벌", "Potato Survival")).toBe(false);
    expect(only("메이플 & 리그 오브 레전드 했어요", "메이플")).toBe(false);
  });

  it("이름 바로 뒤나 앞 게임에 붙은 '랑'·'이랑'도 구분자다", () => {
    expect(only("똥겜, 하지 마라랑 수박(의 머리가 깨진)게임 했어요 [ 2025. 11. 04 ]", "똥겜, 하지 마라")).toBe(false);
    expect(only("사생이랑 Unknown Tapes 했어요", "Unknown Tapes")).toBe(false);
  });

  it("BMP 밖 글자(서로게이트 쌍)가 있어도 이름 구간을 제자리에서 지운다", () => {
    expect(only("𠀋𠀋𠀋 했어요", "𠀋𠀋𠀋")).toBe(true);
    expect(only("𠀋𠀋𠀋 하고 오목 했어요", "𠀋𠀋𠀋")).toBe(false);
  });
});

describe("namedYoutubeVod", () => {
  it("이름을 담은 가장 이른 유튜브 영상을 고른다(유튜브가 아닌 주소·다른 게임 제목은 건너뛴다)", () => {
    const named = vod("ccccccccccc", "2026-11-03", "이름 2일차");
    const game = g([
      bad,
      vod("bbbbbbbbbbb", "2026-11-02", "다른 게임 했어요"),
      named,
      vod("ddddddddddd", "2026-11-04", "이름 3일차"),
    ]);
    expect(namedYoutubeVod(game)).toEqual({ vod: named, videoId: "ccccccccccc" });
  });

  it("포스터 유무는 보지 않는다(홈 썸네일은 포스터 있는 게임에도 쓴다)", () => {
    const game = g([vod("eeeeeeeeeee", "2026-11-01")], { posterUrl: "https://nng-phinf.pstatic.net/a.png" });
    expect(namedYoutubeVod(game)?.videoId).toBe("eeeeeeeeeee");
  });

  it("앞 영상이 여러 게임 방송이면 이름만 담은 뒤 영상으로 넘어간다", () => {
    const solo = vod("jjjjjjjjjjj", "2026-11-05", "이름 2일차");
    const game = g([vod("iiiiiiiiiii", "2026-11-01", "이름 하고 리그 오브 레전드 했어요"), solo]);
    expect(namedYoutubeVod(game)).toEqual({ vod: solo, videoId: "jjjjjjjjjjj" });
  });

  it("이름을 담은 영상이 없으면 null", () => {
    expect(namedYoutubeVod(g([vod("fffffffffff", "2026-11-01", "리그 오브 레전드 했어요")]))).toBeNull();
  });
});

describe("fieldPhoto", () => {
  it("포스터가 있으면 현장 사진을 쓰지 않는다", () => {
    expect(fieldPhoto(g([vod("ddddddddddd", "2026-11-01")], { posterUrl: "https://nng-phinf.pstatic.net/a.png" }))).toBeNull();
  });

  it("포스터가 없으면 이름을 담은 가장 이른 다시보기 썸네일과 그 날짜", () => {
    const game = g([
      vod("ggggggggggg", "2026-10-30", "할로윈 기념 방송"),
      vod("eeeeeeeeeee", "2026-11-01"),
      vod("fffffffffff", "2026-11-05"),
    ]);
    expect(fieldPhoto(game)).toEqual({ thumbnailUrl: "https://i.ytimg.com/vi/eeeeeeeeeee/hqdefault.jpg", date: "2026-11-01" });
  });

  it("다시보기 제목이 모두 다른 게임이면 null (표본 라벨로 둔다)", () => {
    expect(fieldPhoto(g([vod("hhhhhhhhhhh", "2026-09-28", "리그 오브 레전드 했어요")]))).toBeNull();
  });

  it("이름을 담았어도 여러 게임 방송뿐이면 null (공중전화)", () => {
    const game = g([vod("rBUIQn1fxEE", "2025-01-26", "1월 4주차 금주 신상 식음료 보고 공중전화 하고 Spelunky 2 했어요 [ 2025. 01. 26 ]")], {
      name: "공중전화",
    });
    expect(fieldPhoto(game)).toBeNull();
  });

  it("포스터도 다시보기도 없으면 null", () => {
    expect(fieldPhoto(g([]))).toBeNull();
  });
});
