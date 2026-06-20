import { getCloudflareContext } from "@opennextjs/cloudflare";
import { validateClickDelta } from "@/lib/clicker";

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  const row = await env.DB
    .prepare("SELECT count FROM clicks WHERE id = 'global'")
    .first<{ count: number }>();

  return Response.json({ count: row?.count ?? 0 });
}

export async function POST(req: Request) {
  const { env } = await getCloudflareContext({ async: true });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const raw = typeof (body as { delta?: unknown }).delta === 'number'
    ? (body as { delta: number }).delta
    : NaN;

  const validated = validateClickDelta(raw);
  if (!validated.ok) {
    return Response.json({ error: validated.error }, { status: 400 });
  }

  const updated = await env.DB
    .prepare("UPDATE clicks SET count = count + ? WHERE id = 'global' RETURNING count")
    .bind(validated.value)
    .first<{ count: number }>();

  return Response.json({ count: updated?.count ?? 0 });
}
