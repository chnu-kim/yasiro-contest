import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { validateScore } from "@/lib/whack";

interface ScoreRow {
  channel_name: string;
  score: number;
  played_at: number;
}

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  const rows = await env.DB
    .prepare("SELECT channel_name, score, played_at FROM whack_scores ORDER BY score DESC LIMIT 20")
    .all<ScoreRow>();

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
    return Response.json({ error: "세션이 만료되었습니다." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const rawScore = (body as { score?: unknown }).score;
  const validated = validateScore(rawScore);
  if (!validated.ok) {
    return Response.json({ error: validated.error }, { status: 400 });
  }

  await env.DB
    .prepare(`
      INSERT INTO whack_scores (channel_id, channel_name, score, played_at)
      VALUES (?, ?, ?, unixepoch())
      ON CONFLICT(channel_id) DO UPDATE SET
        channel_name = excluded.channel_name,
        score = MAX(score, excluded.score),
        played_at = CASE WHEN excluded.score > score THEN excluded.played_at ELSE played_at END
    `)
    .bind(session.channel_id, session.channel_name, validated.value)
    .run();

  return Response.json({ ok: true }, { status: 200 });
}
