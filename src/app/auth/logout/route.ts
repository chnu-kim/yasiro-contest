import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const sessionId = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("session_id="))
    ?.split("=")[1];

  if (sessionId) {
    const { env } = await getCloudflareContext({ async: true });
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  }

  const origin = new URL(req.url).origin;
  return new Response(null, {
    status: 302,
    headers: {
      Location: origin + "/",
      "Set-Cookie": "session_id=; Path=/; HttpOnly; Max-Age=0",
    },
  });
}
