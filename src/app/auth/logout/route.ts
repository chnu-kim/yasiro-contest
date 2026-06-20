import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get("session_id")?.value;

  if (sessionId) {
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  }

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("session_id", "", { maxAge: 0, path: "/" });
  return res;
}
