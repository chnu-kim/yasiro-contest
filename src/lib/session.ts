import { readCookie } from "./http.ts";

export const SESSION_COOKIE = "session_id";

/** 세션 수명(초). 로그인 때 쿠키 Max-Age로 쓴다 */
export const SESSION_COOKIE_MAX_AGE = 2592000;

/** 세션 ID 형식: generateState 출력(32자 소문자 hex). 형식이 이 한 곳에만 있다 */
const SESSION_ID = /^[0-9a-f]{32}$/;

/** D1에서 세션 조회·삭제에 필요한 만큼만. D1Database와 GamesDb가 구조적으로 만족한다 */
export interface SessionDb {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

/** 표시용 세션 정보. 관리자 익명 규칙이 필요한 곳(games)은 이 타입을 쓰지 않는다 */
export interface SessionUser {
  channelId: string;
  channelName: string;
}

/** anonymous = 쿠키 없음·형식 오류(DB 조회 안 함), expired = 형식은 맞으나 유효한 행 없음 */
export type SessionLookup<T> =
  | { state: "anonymous" }
  | { state: "expired" }
  | { state: "active"; session: T };

/** 쿠키 값이 세션 ID 형식이면 그대로, 아니면 null */
export function parseSessionId(raw: string | null | undefined): string | null {
  return typeof raw === "string" && SESSION_ID.test(raw) ? raw : null;
}

export function readSessionId(cookieHeader: string | null): string | null {
  return parseSessionId(readCookie(cookieHeader, SESSION_COOKIE));
}

/** 만료 판정은 항상 주입된 now(unix seconds)로 한다. expires_at <= now면 만료 */
export async function findSession(
  db: SessionDb,
  sessionId: string | null,
  now: number,
): Promise<SessionLookup<SessionUser>> {
  if (sessionId === null) return { state: "anonymous" };
  const row = await db
    .prepare("SELECT channel_id, channel_name FROM sessions WHERE id = ? AND expires_at > ?")
    .bind(sessionId, now)
    .first<{ channel_id: string; channel_name: string }>();
  if (row === null) return { state: "expired" };
  return { state: "active", session: { channelId: row.channel_id, channelName: row.channel_name } };
}

/** channel_id만 읽는다. channel_name을 SELECT하지 않아야 하는 games 익명 규칙용 */
export async function findSessionChannel(
  db: SessionDb,
  sessionId: string | null,
  now: number,
): Promise<SessionLookup<{ channelId: string }>> {
  if (sessionId === null) return { state: "anonymous" };
  const row = await db
    .prepare("SELECT channel_id FROM sessions WHERE id = ? AND expires_at > ?")
    .bind(sessionId, now)
    .first<{ channel_id: string }>();
  if (row === null) return { state: "expired" };
  return { state: "active", session: { channelId: row.channel_id } };
}

export async function deleteSession(db: SessionDb, sessionId: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

/** 로그인 완료 Set-Cookie 값. 쿠키 속성은 여기서만 정한다 */
export function sessionCookie(sessionId: string): string {
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_COOKIE_MAX_AGE}`;
}

/** 로그아웃 Set-Cookie 값 */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0`;
}
