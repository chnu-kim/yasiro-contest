// /games 기록 숫자를 "지난번에 본 값"부터 올리기 위한 브라우저 저장값. 읽기는 layout의 head 스크립트가,
// 쓰기는 GamesBoard가 한다. 새 기록이 없으면(지난 값 = 지금 값) 숫자는 움직이지 않는다.
export const SEEN_STATS_KEY = 'yasiro-seen-stats';

export type SeenStats = { total: number; clear: number };

export function serializeSeenStats(stats: SeenStats): string {
  return JSON.stringify({ total: stats.total, clear: stats.clear });
}
