import type { Metadata } from 'next';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const metadata: Metadata = {
  title: '꿀붕이 클리커 - 야시로',
  description: '꿀붕이를 마구 눌러보세요! 야시로 팬 클리커 미니게임',
};
import ClickerGame from './ClickerGame';

async function getInitialCount(): Promise<number> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const row = await env.DB
      .prepare("SELECT count FROM clicks WHERE id = 'global'")
      .first<{ count: number }>();
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

export default async function ClickerPage() {
  const initialCount = await getInitialCount();
  return <ClickerGame initialCount={initialCount} />;
}
