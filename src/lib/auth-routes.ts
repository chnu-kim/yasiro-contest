import { checkSameOrigin } from "./http.ts";
import { clearSessionCookie, deleteSession, readSessionId } from "./session.ts";
import type { SessionDb } from "./session.ts";

export interface LogoutDeps {
  db: SessionDb;
}

/** POST /auth/logout. 같은 출처가 아니면 403(남이 로그아웃시키는 CSRF 방지). 세션 행을 지우고 쿠키를 만료시킨 뒤 홈으로 보낸다 */
export async function handleLogout(req: Request, deps: LogoutDeps): Promise<Response> {
  if (!checkSameOrigin(req)) {
    return new Response("다른 사이트에서 보낸 요청은 받을 수 없습니다.", { status: 403 });
  }
  const sessionId = readSessionId(req.headers.get("cookie"));
  if (sessionId !== null) await deleteSession(deps.db, sessionId);

  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL(req.url).origin + "/",
      "Set-Cookie": clearSessionCookie(),
    },
  });
}
