import { Suspense } from 'react';
import type { Metadata } from 'next';
import gamesJson from '@/data/games.json';
import { parseGames } from '@/lib/games/schema';
import GamesBoard from './GamesBoard';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: '플레이한 게임',
  description: '야시로가 방송에서 탐험한 게임 행성들의 기록. 첫 플레이 날짜, 정복 여부, 다시보기를 모았어요.',
};

// src/data/games.json이 정본이다. 빌드·요청 시 검증하고, 형식이 깨져 있으면 여기서 던져 배포 전에 드러낸다.
const games = parseGames(gamesJson);

export default function GamesPage() {
  return (
    <div className={styles.page}>
      {/* useSearchParams를 쓰는 보드는 Suspense 경계 안에 둔다 */}
      <Suspense fallback={null}>
        <GamesBoard games={games} />
      </Suspense>
    </div>
  );
}
