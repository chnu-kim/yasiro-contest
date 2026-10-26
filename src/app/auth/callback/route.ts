import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleCallback } from "@/lib/auth-routes";
import { readChzzkConfig } from "@/lib/chzzk-auth";

export async function GET(req: Request) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  return handleCallback(req, {
    db: env.DB,
    config: readChzzkConfig(process.env),
    // 네이티브 함수를 deps의 메서드로 부르면 Workers에서 Illegal invocation이 나므로 감싼다
    fetch: (input, init) => fetch(input, init),
    now: () => Math.floor(Date.now() / 1000),
    waitUntil: (p) => ctx.waitUntil(p),
  });
}
