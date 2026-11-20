// 홈(/) "최근 탐험" 띠와 보조 카드에 쓰는 요약. /games와 같은 번호(indexGames)를 쓴다.
import { countStats, indexGames } from "./query.ts";
import { youtubeVideoId } from "./schema.ts";
import type { Game, GameStatus } from "./types.ts";

export interface Expedition {
  id: string;
  name: string;
  /** /games 카드와 같은 탐험 번호 ("368") */
  no: string;
  firstPlayed: string;
  status: GameStatus;
  videoId: string;
  vodUrl: string;
  vodTitle: string;
  thumbnailUrl: string;
}

export interface HomeData {
  total: number;
  clear: number;
  /** 날짜가 있는 가장 최근 게임. 다시보기 유무와 상관없다 */
  latest: { id: string; name: string; firstPlayed: string } | null;
  expeditions: Expedition[];
}

/** 480×360(위아래 검은 띠). 16:9 틀에 object-fit: cover로 띠를 잘라 쓴다 */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * 첫 플레이 최신순으로 다시보기가 있는 게임을 limit개 고른다.
 * 날짜 없는 게임은 빼고, 다시보기는 가장 이른(첫 플레이) 유튜브 영상을 쓴다.
 * 한 방송에서 여러 게임을 했으면 영상이 같으므로 목록 앞의 게임 하나만 남긴다.
 */
export function buildHomeData(games: readonly Game[], limit: number): HomeData {
  const stats = countStats(games);
  const dated = indexGames(games).filter((game) => game.firstPlayed !== null);
  const first = dated[0];
  const latest = first ? { id: first.id, name: first.name, firstPlayed: first.firstPlayed as string } : null;

  const seen = new Set<string>();
  const expeditions: Expedition[] = [];
  for (const game of dated) {
    if (expeditions.length >= limit) break;
    const vod = game.vods.find((v) => youtubeVideoId(v.url) !== null);
    if (!vod) continue;
    const videoId = youtubeVideoId(vod.url) as string;
    if (seen.has(videoId)) continue;
    seen.add(videoId);
    expeditions.push({
      id: game.id,
      name: game.name,
      no: game.no,
      firstPlayed: game.firstPlayed as string,
      status: game.status,
      videoId,
      vodUrl: vod.url,
      vodTitle: vod.title,
      thumbnailUrl: youtubeThumbnailUrl(videoId),
    });
  }
  return { total: stats.total, clear: stats.clear, latest, expeditions };
}
