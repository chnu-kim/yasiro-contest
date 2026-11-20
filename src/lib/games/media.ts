// 게임 기록에서 화면에 쓸 그림을 고른다: 유튜브 다시보기 썸네일, 포스터가 없을 때의 "현장 사진".
import { youtubeVideoId } from "./schema.ts";
import type { Game, Vod } from "./types.ts";

/** 480×360(위아래 검은 띠). 16:9 틀에 object-fit: cover로 띠를 잘라 쓴다 */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** 날짜 오름차순 vods에서 첫 유튜브 영상(= 첫 플레이 방송). 제목은 보지 않는다. 유튜브 주소가 없으면 null */
export function firstYoutubeVod(game: Pick<Game, "vods">): { vod: Vod; videoId: string } | null {
  for (const vod of game.vods) {
    const videoId = youtubeVideoId(vod.url);
    if (videoId !== null) return { vod, videoId };
  }
  return null;
}

const WORD_CHAR = /[\p{L}\p{N}]/u;
const STARTS_WITH_WORD = /^[\p{L}\p{N}]/u;

/** 이름 대조용: NFKC → 소문자 → 글자(\p{L})·숫자(\p{N})만 남긴다. 공백·문장부호·기호(■ 등)는 지운다 */
export function normalizeForMatch(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** 대조에 쓰는 제목 형태: NFKC·소문자. 이름이 걸친 구간([start, end))은 이 문자열 기준이다 */
function lowerTitle(title: string): string {
  return title.normalize("NFKC").toLowerCase();
}

/** 정규화해서 이 길이 미만인 이름은 포함 대조 대신 "제목 맨 앞의 단어"로만 맞춘다 */
const SHORT_NAME_LENGTH = 3;

/** lowerTitle(title)에서 candidate가 걸친 구간. 없으면 null */
function nameSpan(low: string, candidate: string): [number, number] | null {
  const key = normalizeForMatch(candidate);
  if (key === "") return null;
  if (key.length < SHORT_NAME_LENGTH) {
    // "몰"·"오목" 같은 짧은 이름은 아무 제목에나 우연히 들어 있을 수 있다.
    // 제목이 그 이름으로 시작하고 바로 뒤가 글자·숫자가 아닐 때만 맞는다("오목 했어요"는 참, "몰래카메라"·"(1) 오목"은 거짓).
    // 그래서 "… 보고 광화 (狂花) 했어요"·"사생이랑 …"처럼 제목 중간이나 조사가 붙은 짧은 이름은 놓친다(원제를 넣으면 맞는다)
    const start = low.length - low.trimStart().length;
    const head = lowerTitle(candidate).trim();
    if (!low.startsWith(head, start)) return null;
    const end = start + head.length;
    return STARTS_WITH_WORD.test(low.slice(end)) ? null : [start, end];
  }
  // 글자·숫자만 이어 붙인 문자열에서 찾고, 각 UTF-16 단위의 원래 위치로 구간을 되돌린다
  const at: number[] = [];
  let joined = "";
  let pos = 0;
  for (const ch of low) {
    if (WORD_CHAR.test(ch)) {
      for (let k = 0; k < ch.length; k++) at.push(pos + k);
      joined += ch;
    }
    pos += ch.length;
  }
  const idx = joined.indexOf(key);
  return idx === -1 ? null : [at[idx], at[idx + key.length - 1] + 1];
}

/** 이름 또는 원제가 걸친 구간들(겹쳐도 그대로) */
function gameSpans(low: string, game: Pick<Game, "name" | "originalTitle">): [number, number][] {
  const spans: [number, number][] = [];
  for (const candidate of [game.name, game.originalTitle]) {
    const span = candidate === undefined ? null : nameSpan(low, candidate);
    if (span !== null) spans.push(span);
  }
  return spans;
}

/**
 * 다시보기 제목이 이 게임을 가리키는가: 이름 또는 원제 중 하나가 제목에 들어 있다(normalizeForMatch로 비교).
 * 한 방송에서 여러 게임을 했어도 참이다. 그림을 고를 때는 titleNamesOnlyGame을 쓴다.
 */
export function titleNamesGame(title: string, game: Pick<Game, "name" | "originalTitle">): boolean {
  return gameSpans(lowerTitle(title), game).length > 0;
}

/** 이 게임 이름을 지운 제목에 남은 "다른 게임과 함께 했다" 표지: " 하고 ", " 후열로 ", " + ", " & ", "(이)랑 " */
const OTHER_SEGMENT = /(?:^|[\s\0])(?:하고|후열로|\+|&)(?=[\s\0]|$)|[^\s](?:이)?랑\s/u;

/**
 * 제목이 이 게임 "하나만" 가리키는가: titleNamesGame이면서, 이름·원제를 지운 나머지에 다른 게임 구간이 없다.
 * "A 하고 B 했어요"·"A랑 B 했어요"·"A + B 했어요"는 A·B 모두 거짓이다. 썸네일은 그중 한 장면이라 어느 게임인지
 * 제목으로는 알 수 없다(공중전화: "금주 신상 식음료 보고 공중전화 하고 Spelunky 2" 썸네일은 음식 사진).
 * "N월 N주차 금주 신상 식음료 보고 X 했어요"는 게임이 하나라 참이다(썸네일은 대개 X 장면).
 * 쉼표는 구분자로 보지 않는다("If On A Winter's Night, Four Travelers", "똥겜, 하지 마라"처럼 이름 안에 있다).
 */
export function titleNamesOnlyGame(title: string, game: Pick<Game, "name" | "originalTitle">): boolean {
  const low = lowerTitle(title);
  const spans = gameSpans(low, game);
  if (spans.length === 0) return false;
  // 구간은 UTF-16 위치라 split("")로 다룬다. 이름 자리는 \0으로 지워 "이름 바로 뒤 랑" 같은 경계를 남긴다
  const units = low.split("");
  for (const [start, end] of spans) for (let i = start; i < end; i++) units[i] = "\0";
  return !OTHER_SEGMENT.test(units.join(""));
}

/**
 * 제목이 이 게임 하나만 가리키는(titleNamesOnlyGame) 가장 이른 유튜브 다시보기. 포스터 유무는 보지 않는다. 없으면 null.
 * 앞 영상이 여러 게임 방송이면 뒤의 단독 방송으로 넘어간다
 */
export function namedYoutubeVod(
  game: Pick<Game, "vods" | "name" | "originalTitle">,
): { vod: Vod; videoId: string } | null {
  for (const vod of game.vods) {
    const videoId = youtubeVideoId(vod.url);
    if (videoId !== null && titleNamesOnlyGame(vod.title, game)) return { vod, videoId };
  }
  return null;
}

/**
 * 포스터가 없을 때 표본 카드에 붙이는 "현장 사진": namedYoutubeVod의 썸네일. 그런 영상이 없으면 null(표본 라벨만).
 */
export function fieldPhoto(
  game: Pick<Game, "vods" | "posterUrl" | "name" | "originalTitle">,
): { thumbnailUrl: string; date: string } | null {
  if (game.posterUrl !== undefined) return null;
  const named = namedYoutubeVod(game);
  return named === null ? null : { thumbnailUrl: youtubeThumbnailUrl(named.videoId), date: named.vod.date };
}
