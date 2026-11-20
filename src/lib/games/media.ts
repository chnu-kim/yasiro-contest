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

/** 이름 대조용: NFKC → 소문자 → 글자(\p{L})·숫자(\p{N})만 남긴다. 공백·문장부호·기호(■ 등)는 지운다 */
export function normalizeForMatch(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** 정규화해서 이 길이 미만인 이름은 포함 대조 대신 "제목 맨 앞의 단어"로만 맞춘다 */
const SHORT_NAME_LENGTH = 3;
const WORD_CHAR = /[\p{L}\p{N}]/u;

function titleNames(title: string, candidate: string): boolean {
  const key = normalizeForMatch(candidate);
  if (key === "") return false;
  if (key.length >= SHORT_NAME_LENGTH) return normalizeForMatch(title).includes(key);
  // "몰"·"오목" 같은 짧은 이름은 아무 제목에나 우연히 들어 있을 수 있다.
  // 제목이 그 이름으로 시작하고 바로 뒤가 글자·숫자가 아닐 때만 맞는다("오목 했어요"는 참, "몰래카메라"·"(1) 오목"은 거짓)
  const raw = title.normalize("NFKC").toLowerCase().trimStart();
  const head = candidate.normalize("NFKC").toLowerCase().trim();
  if (!raw.startsWith(head)) return false;
  const next = raw.charAt(head.length);
  return next === "" || !WORD_CHAR.test(next);
}

/**
 * 다시보기 제목이 이 게임을 가리키는가: 이름 또는 원제 중 하나가 제목에 들어 있다(normalizeForMatch로 비교).
 * 한 방송에서 여러 게임을 했어도 제목에 이름이 있으면 참이다. 이름이 없는 제목("리그 오브 레전드 했어요",
 * "종겜룰렛데이 했어요")은 썸네일이 다른 게임일 가능성이 커서 그림으로 쓰지 않는다.
 */
export function titleNamesGame(title: string, game: Pick<Game, "name" | "originalTitle">): boolean {
  if (titleNames(title, game.name)) return true;
  return game.originalTitle !== undefined && titleNames(title, game.originalTitle);
}

/** 제목이 이 게임을 가리키는 가장 이른 유튜브 다시보기. 포스터 유무는 보지 않는다. 없으면 null */
export function namedYoutubeVod(
  game: Pick<Game, "vods" | "name" | "originalTitle">,
): { vod: Vod; videoId: string } | null {
  for (const vod of game.vods) {
    const videoId = youtubeVideoId(vod.url);
    if (videoId !== null && titleNamesGame(vod.title, game)) return { vod, videoId };
  }
  return null;
}

/**
 * 포스터가 없을 때 표본 카드에 붙이는 "현장 사진": 제목이 이 게임을 가리키는 가장 이른 다시보기의 썸네일(namedYoutubeVod).
 * 그런 영상이 없으면 null(표본 라벨만). 제목에 다른 게임도 함께 있으면 썸네일이 그 게임 장면일 수 있어, 화면에는 "그날 방송"으로 표기한다.
 */
export function fieldPhoto(
  game: Pick<Game, "vods" | "posterUrl" | "name" | "originalTitle">,
): { thumbnailUrl: string; date: string } | null {
  if (game.posterUrl !== undefined) return null;
  const named = namedYoutubeVod(game);
  return named === null ? null : { thumbnailUrl: youtubeThumbnailUrl(named.videoId), date: named.vod.date };
}
