import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { ApiDeps } from "@/lib/games/api";

export async function getGamesDeps(): Promise<ApiDeps> {
  const { env } = await getCloudflareContext({ async: true });
  return {
    db: env.DB,
    env: {
      // 관리자 채널 ID는 Worker secret(공개 저장소에 두지 않는다). 로컬은 .dev.vars
      ADMIN_CHANNEL_IDS: env.ADMIN_CHANNEL_IDS ?? process.env.ADMIN_CHANNEL_IDS,
      CHZZK_CLIENT_ID: process.env.CHZZK_CLIENT_ID,
      CHZZK_CLIENT_SECRET: process.env.CHZZK_CLIENT_SECRET,
    },
    now: () => Math.floor(Date.now() / 1000),
    fetch: (url, init) => fetch(url, init),
    uuid: () => crypto.randomUUID(),
    log: (message) => console.error(message),
  };
}
