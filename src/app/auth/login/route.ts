import { buildAuthorizationURL, generateState } from "@/lib/chzzk-auth";

export function GET() {
  const state = generateState();

  const authUrl = buildAuthorizationURL(
    {
      clientId: process.env.CHZZK_CLIENT_ID!,
      redirectUri: process.env.CHZZK_REDIRECT_URI!,
    },
    state,
  );

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl,
      "Set-Cookie": `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
    },
  });
}
