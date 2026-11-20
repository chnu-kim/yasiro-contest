// 게임 기록에서 화면에 쓸 그림을 고른다: 유튜브 다시보기 썸네일, 포스터가 없을 때의 "현장 사진".
import { youtubeVideoId } from "./schema.ts";
import type { Game, Vod } from "./types.ts";

/** 480×360(위아래 검은 띠). 16:9 틀에 object-fit: cover로 띠를 잘라 쓴다 */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** 날짜 오름차순 vods에서 첫 유튜브 영상(= 첫 플레이 방송). 유튜브 주소가 없으면 null */
export function firstYoutubeVod(game: Pick<Game, "vods">): { vod: Vod; videoId: string } | null {
  for (const vod of game.vods) {
    const videoId = youtubeVideoId(vod.url);
    if (videoId !== null) return { vod, videoId };
  }
  return null;
}

/**
 * 포스터가 없을 때 표본 카드에 붙이는 "현장 사진": 첫 플레이 방송 다시보기의 썸네일.
 * 한 방송에서 여러 게임을 했으면 썸네일이 다른 게임 장면일 수 있어, 화면에는 "그날 방송"으로 표기한다.
 */
export function fieldPhoto(game: Pick<Game, "vods" | "posterUrl">): { thumbnailUrl: string; date: string } | null {
  if (game.posterUrl !== undefined) return null;
  const first = firstYoutubeVod(game);
  return first === null ? null : { thumbnailUrl: youtubeThumbnailUrl(first.videoId), date: first.vod.date };
}
