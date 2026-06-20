import { getCloudflareContext } from '@opennextjs/cloudflare';
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
