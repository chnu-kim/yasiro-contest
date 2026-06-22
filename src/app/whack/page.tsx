import type { Metadata } from 'next';
import WhackGame from './WhackGame';

export const metadata: Metadata = {
  title: '꿀붕이 잡기 - 야시로',
  description: '구멍에서 튀어나오는 꿀붕이를 잡아라! 야시로 팬 미니게임 · 실시간 리더보드',
};

export default function WhackPage() {
  return <WhackGame />;
}
