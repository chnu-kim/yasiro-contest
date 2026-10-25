import { Suspense } from 'react';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { loadGamesPageData } from '@/lib/games/api';
import type { GamesPageData } from '@/lib/games/types';
import { getGamesDeps } from '../api/games/_deps';
import GamesBoard from './GamesBoard';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: '플레이한 게임',
  description: '야시로가 방송에서 탐험한 게임 행성들의 기록. 첫 플레이 날짜, 정복 여부, 다시보기를 모았어요.',
};

// 정본은 D1(games, game_vods)이다. D1이 없거나(pnpm dev) 조회가 실패하면 ok:false로 보드 자리에 안내를 띄운다.
export default async function GamesPage() {
  let data: GamesPageData;
  try {
    const deps = await getGamesDeps();
    data = await loadGamesPageData(deps, (await headers()).get('cookie'));
  } catch {
    data = { ok: false };
  }

  return (
    <div className={styles.page}>
      {/* useSearchParams를 쓰는 보드는 Suspense 경계 안에 둔다 */}
      <Suspense fallback={null}>
        <GamesBoard data={data} />
      </Suspense>
    </div>
  );
}
