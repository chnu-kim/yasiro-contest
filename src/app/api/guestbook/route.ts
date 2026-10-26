import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleGuestbookPost } from "@/lib/guestbook";

interface GuestbookRow {
  id: string;
  message: string;
  channel_name: string;
  created_at: number;
}

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  const rows = await env.DB
    .prepare("SELECT id, message, channel_name, created_at FROM guestbook ORDER BY created_at DESC LIMIT 200")
    .all<GuestbookRow>();

  return Response.json(rows.results);
}

export async function POST(req: Request) {
  const { env } = await getCloudflareContext({ async: true });
  return handleGuestbookPost(req, {
    db: env.DB,
    now: () => Math.floor(Date.now() / 1000),
    newId: () => crypto.randomUUID(),
  });
}
