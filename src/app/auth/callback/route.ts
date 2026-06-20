import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, fetchUser, generateState } from "@/lib/chzzk-auth";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return new NextResponse("code 또는 state 파라미터가 없습니다.", { status: 400 });
  }

  const savedState = req.cookies.get("oauth_state")?.value;
  if (!savedState || savedState !== state) {
    return new NextResponse("유효하지 않은 state입니다. 다시 로그인하세요.", { status: 403 });
  }

  const config = {
    clientId: process.env.CHZZK_CLIENT_ID!,
    clientSecret: process.env.CHZZK_CLIENT_SECRET!,
    redirectUri: process.env.CHZZK_REDIRECT_URI!,
  };

  let tokens, user;
  try {
    tokens = await exchangeCode(config, code, state);
    user = await fetchUser(tokens.accessToken);
  } catch (e) {
    console.error("Chzzk auth error:", e);
    return new NextResponse("인증 처리 중 오류가 발생했습니다.", { status: 502 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;

  const sessionId = generateState();
  const expiresAt = Math.floor(Date.now() / 1000) + tokens.expiresIn;

  await db
    .prepare(
      `INSERT OR REPLACE INTO sessions (id, channel_id, channel_name, access_token, refresh_token, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(sessionId, user.channelId, user.channelName, tokens.accessToken, tokens.refreshToken, expiresAt)
    .run();

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("oauth_state", "", { maxAge: 0, path: "/" });
  res.cookies.set("session_id", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 2592000,
    path: "/",
  });
  return res;
}
