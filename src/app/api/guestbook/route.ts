import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { validateMessage } from "@/lib/guestbook";

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

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;
  if (!sessionId) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const session = await env.DB
    .prepare("SELECT channel_id, channel_name FROM sessions WHERE id = ? AND expires_at > unixepoch()")
    .bind(sessionId)
    .first<{ channel_id: string; channel_name: string }>();

  if (!session) {
    return Response.json({ error: "세션이 만료되었습니다. 다시 로그인해주세요." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const message = typeof (body as { message?: unknown }).message === "string"
    ? (body as { message: string }).message
    : "";

  const validated = validateMessage(message);
  if (!validated.ok) {
    return Response.json({ error: validated.error }, { status: 400 });
  }

  const id = crypto.randomUUID();
  await env.DB
    .prepare("INSERT INTO guestbook (id, message, channel_id, channel_name) VALUES (?, ?, ?, ?)")
    .bind(id, validated.value, session.channel_id, session.channel_name)
    .run();

  return Response.json({ id }, { status: 201 });
}
