import { safeNextPath } from "@/lib/http";
import { buildAuthorizationURL, generateState } from "@/lib/chzzk-auth";

export function GET(req: Request) {
  const state = generateState();

  const authUrl = buildAuthorizationURL(
    {
      clientId: process.env.CHZZK_CLIENT_ID!,
      redirectUri: process.env.CHZZK_REDIRECT_URI!,
    },
    state,
  );

  // 로그인 뒤 돌아올 같은 사이트 경로(예: /games?game=<id>). safeNextPath가 걸러낸 값만 쓴다.
  const next = safeNextPath(new URL(req.url).searchParams.get("next"));

  const headers = new Headers({ Location: authUrl });
  headers.append("Set-Cookie", `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
  headers.append("Set-Cookie", `oauth_next=${encodeURIComponent(next)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
  return new Response(null, { status: 302, headers });
}
