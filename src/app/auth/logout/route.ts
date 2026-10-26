import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleLogout } from "@/lib/auth-routes";

export async function POST(req: Request) {
  const { env } = await getCloudflareContext({ async: true });
  return handleLogout(req, { db: env.DB });
}
