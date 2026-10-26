import { ChzzkApiError, buildAuthorizationURL, exchangeCode, fetchUser, revokeToken } from "./chzzk-auth.ts";
import type { ChzzkConfig, ChzzkUser, TokenResponse } from "./chzzk-auth.ts";
import { checkSameOrigin, readCookie, safeNextPath } from "./http.ts";
import {
  clearLegacySessionCookie,
  clearOauthCookies,
  clearSessionCookie,
  createSession,
  deleteExpiredSessions,
  deleteSession,
  oauthCookie,
  readSessionId,
  sessionCookie,
} from "./session.ts";
import type { SessionDb } from "./session.ts";

// 치지직 OAuth 로그인·로그아웃 Route Handler 로직. Route Handler는 env·ctx를 주입만 한다.
// 로그에는 상태 코드·에러 이름만 남긴다(토큰·채널 정보·응답 본문 금지).

const CONFIG_MISSING = "로그인 설정이 없습니다. 관리자에게 알려 주세요.";

export interface LoginDeps {
  /** readChzzkConfig 결과. null이면 500 */
  config: ChzzkConfig | null;
  newState: () => string;
}

/** GET /auth/login. state와 복귀 경로(next)를 쿠키에 담고 치지직 인가 화면으로 보낸다 */
export function handleLogin(req: Request, deps: LoginDeps): Response {
  if (deps.config === null) return new Response(CONFIG_MISSING, { status: 500 });
  const state = deps.newState();
  // 로그인 뒤 돌아올 같은 사이트 경로(예: /games?game=<id>). safeNextPath가 걸러낸 값만 쓴다.
  const next = safeNextPath(new URL(req.url).searchParams.get("next"));

  const headers = new Headers({ Location: buildAuthorizationURL(deps.config, state) });
  headers.append("Set-Cookie", oauthCookie("oauth_state", state));
  headers.append("Set-Cookie", oauthCookie("oauth_next", next));
  return new Response(null, { status: 302, headers });
}

export interface CallbackDeps {
  db: SessionDb;
  config: ChzzkConfig | null;
  /** Workers에서는 (i, init) => fetch(i, init)처럼 감싸서 넘긴다(deps.fetch()로 부르면 Illegal invocation) */
  fetch: typeof fetch;
  /** unix seconds */
  now: () => number;
  /** 응답 뒤에도 이어서 돌 작업(토큰 폐기). Workers ctx.waitUntil을 감싸서 넘긴다 */
  waitUntil: (p: Promise<unknown>) => void;
}

function errorLabel(e: unknown): string {
  if (e instanceof ChzzkApiError) return `${e.name} ${e.code}`;
  return e instanceof Error ? e.name : typeof e;
}

/** access·refresh 토큰 폐기. 실패해도 던지지 않고(waitUntil에서 unhandled rejection 방지) 실패한 경우만 상태를 로그로 남긴다 */
async function revokeTokens(config: ChzzkConfig, tokens: TokenResponse, fetchFn: typeof fetch): Promise<void> {
  const hints = ["access_token", "refresh_token"] as const;
  const results = await Promise.allSettled([
    revokeToken(config, tokens.accessToken, hints[0], fetchFn),
    revokeToken(config, tokens.refreshToken, hints[1], fetchFn),
  ]);
  const ok = results.every((r) => r.status === "fulfilled" && r.value >= 200 && r.value < 300);
  if (ok) return;
  const parts = results.map((r, i) => `${hints[i]}=${r.status === "fulfilled" ? r.value : errorLabel(r.reason)}`);
  console.error(`chzzk token revoke failed: ${parts.join(" ")}`);
}

/**
 * GET /auth/callback. state 확인 → 토큰 교환 → 사용자 조회 → 토큰 폐기(백그라운드) →
 * 요청에 붙어 온 기존 세션 삭제 → 만료 행 정리 → 새 세션(해시만 저장) → next로 302.
 * 어느 경로로 끝나든 oauth_state·oauth_next 쿠키는 지운다. 치지직 토큰은 어디에도 저장하지 않는다.
 */
export async function handleCallback(req: Request, deps: CallbackDeps): Promise<Response> {
  const fail = (status: number, message: string) => {
    const headers = new Headers();
    for (const c of clearOauthCookies()) headers.append("Set-Cookie", c);
    return new Response(message, { status, headers });
  };

  const config = deps.config;
  if (config === null) return fail(500, CONFIG_MISSING);

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) return fail(400, "code 또는 state 파라미터가 없습니다.");

  const cookieHeader = req.headers.get("cookie");
  const savedState = readCookie(cookieHeader, "oauth_state");
  if (!savedState || savedState !== state) return fail(403, "유효하지 않은 state입니다. 다시 로그인하세요.");

  let tokens: TokenResponse;
  try {
    tokens = await exchangeCode(config, code, state, deps.fetch);
  } catch (e) {
    console.error(`chzzk auth error (token): ${errorLabel(e)}`);
    return fail(502, "인증 처리 중 오류가 발생했습니다.");
  }

  let user: ChzzkUser;
  try {
    user = await fetchUser(tokens.accessToken, deps.fetch);
  } catch (e) {
    console.error(`chzzk auth error (user): ${errorLabel(e)}`);
    return fail(502, "인증 처리 중 오류가 발생했습니다.");
  } finally {
    // 사용자 정보만 필요하므로 성공·실패와 무관하게 토큰을 바로 폐기한다
    deps.waitUntil(revokeTokens(config, tokens, deps.fetch));
  }

  const now = deps.now();
  let sessionId: string;
  try {
    const previous = readSessionId(cookieHeader);
    if (previous !== null) await deleteSession(deps.db, previous);
    await deleteExpiredSessions(deps.db, now);
    sessionId = await createSession(deps.db, user, now);
  } catch (e) {
    console.error(`session store error: ${errorLabel(e)}`);
    return fail(500, "로그인을 마치지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  }

  // 로그인 시작 때 저장한 복귀 경로(없거나 이상하면 "/")
  const next = safeNextPath(readCookie(cookieHeader, "oauth_next"));
  const headers = new Headers({ Location: new URL(req.url).origin + next });
  for (const c of clearOauthCookies()) headers.append("Set-Cookie", c);
  headers.append("Set-Cookie", clearLegacySessionCookie());
  headers.append("Set-Cookie", sessionCookie(sessionId));
  return new Response(null, { status: 302, headers });
}

export interface LogoutDeps {
  db: SessionDb;
}

/** POST /auth/logout. 같은 출처가 아니면 403(남이 로그아웃시키는 CSRF 방지). 세션 행을 지우고 새·레거시 쿠키를 모두 만료시킨 뒤 홈으로 보낸다 */
export async function handleLogout(req: Request, deps: LogoutDeps): Promise<Response> {
  if (!checkSameOrigin(req)) {
    return new Response("다른 사이트에서 보낸 요청은 받을 수 없습니다.", { status: 403 });
  }
  const sessionId = readSessionId(req.headers.get("cookie"));
  if (sessionId !== null) {
    try {
      await deleteSession(deps.db, sessionId);
    } catch (e) {
      // 행을 못 지워도 쿠키는 지운다(공용 PC에서 로그아웃했다고 믿고 떠나는 경우). 행은 만료 시 정리된다
      console.error(`session store error: ${errorLabel(e)}`);
    }
  }

  const headers = new Headers({ Location: new URL(req.url).origin + "/" });
  headers.append("Set-Cookie", clearSessionCookie());
  headers.append("Set-Cookie", clearLegacySessionCookie());
  return new Response(null, { status: 302, headers });
}
