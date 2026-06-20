import { NextResponse } from "next/server";
import { buildAuthorizationURL, generateState } from "@/lib/chzzk-auth";

export const runtime = "edge";

export function GET() {
  const state = generateState();

  const authUrl = buildAuthorizationURL(
    {
      clientId: process.env.CHZZK_CLIENT_ID!,
      redirectUri: process.env.CHZZK_REDIRECT_URI!,
    },
    state,
  );

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
