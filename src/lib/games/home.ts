// 홈(/) "최근 탐험": 썸네일 대표 칸 1개 + 글자 기록 줄. /games와 같은 번호(indexGames)를 쓴다.
// 썸네일은 제목이 그 게임 하나만 가리키는 다시보기에서만 가져온다(media.ts namedYoutubeVod).
import { countStats, indexGames } from "./query.ts";
import { firstYoutubeVod, namedYoutubeVod, youtubeThumbnailUrl } from "./media.ts";
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
}

/** 대표 칸. 영상(videoId·vodUrl·vodTitle)은 썸네일과 같은, 이 게임 하나만 가리키는 다시보기 */
export interface FeaturedExpedition extends Expedition {
  thumbnailUrl: string;
}

export interface HomeData {
  total: number;
  clear: number;
  /** 날짜가 있는 가장 최근 게임. 다시보기 유무와 상관없다 */
  latest: { id: string; name: string; firstPlayed: string } | null;
  /** 후보 중 namedYoutubeVod가 있는 가장 최근 게임. 없으면 null(홈은 섹션을 숨긴다) */
  featured: FeaturedExpedition | null;
  /** 대표 칸을 뺀 후보를 최신순으로. 대표 칸과 합쳐 limit개 */
  rows: Expedition[];
}

/**
 * 후보: 첫 플레이 최신순으로 날짜와 유튜브 다시보기가 있는 게임. 한 방송에서 여러 게임을 했으면 첫 영상이 같으므로
 * 목록 앞의 게임 하나만 남긴다(첫 유튜브 영상 기준). 글자 줄은 그 첫 영상으로 잇는다.
 * 대표 칸은 후보 중 namedYoutubeVod(이 게임 하나만 가리키는 영상)가 있는 가장 최근 게임이라, 그보다 최근 게임이 글자 줄로 먼저 올 수 있다.
 */
export function buildHomeData(games: readonly Game[], limit: number): HomeData {
  const stats = countStats(games);
  const dated = indexGames(games).filter((game) => game.firstPlayed !== null);
  const first = dated[0];
  const latest = first ? { id: first.id, name: first.name, firstPlayed: first.firstPlayed as string } : null;

  const seen = new Set<string>();
  let featured: FeaturedExpedition | null = null;
  const rows: Expedition[] = [];
  for (const game of dated) {
    // 대표 칸을 찾을 때까지는 limit을 넘어서도 더 오래된 게임을 본다
    if (featured !== null && rows.length >= limit - 1) break;
    const first = firstYoutubeVod(game);
    if (first === null || seen.has(first.videoId)) continue;
    seen.add(first.videoId);
    const base = { id: game.id, name: game.name, no: game.no, firstPlayed: game.firstPlayed as string, status: game.status };
    const named: ReturnType<typeof namedYoutubeVod> = featured === null ? namedYoutubeVod(game) : null;
    if (named !== null) {
      featured = {
        ...base,
        videoId: named.videoId,
        vodUrl: named.vod.url,
        vodTitle: named.vod.title,
        thumbnailUrl: youtubeThumbnailUrl(named.videoId),
      };
    } else {
      rows.push({ ...base, videoId: first.videoId, vodUrl: first.vod.url, vodTitle: first.vod.title });
    }
  }
  // 대표 칸이 끝내 없으면 글자 줄만 limit개, 있으면 최근 줄부터 limit-1개
  return { total: stats.total, clear: stats.clear, latest, featured, rows: rows.slice(0, featured === null ? limit : limit - 1) };
}
