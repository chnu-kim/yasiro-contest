import { readCookie } from "./http.ts";

// 서버 세션 저장소(auth_sessions, 0009). 원본 세션 ID는 쿠키에만 있고 DB에는 SHA-256 해시만 둔다.
// 세션 ID 형식·쿠키 이름·쿠키 속성·수명은 이 파일 한 곳에서만 정한다.

/** __Host- 접두사: Secure + Path=/ + Domain 없음을 브라우저가 강제한다 */
export const SESSION_COOKIE = "__Host-session";

/** 0009 이전 쿠키 이름. 더 이상 읽지 않고, 로그인·로그아웃 때 지우기만 한다 */
export const LEGACY_SESSION_COOKIE = "session_id";

/** 세션 절대 수명(초, 7일). 쿠키 Max-Age와 DB expires_at이 같은 값을 쓴다. 치지직 토큰 TTL과 무관하다 */
export const SESSION_TTL_SECONDS = 604800;

/** OAuth 왕복(oauth_state·oauth_next) 쿠키 수명(초) */
const OAUTH_COOKIE_MAX_AGE = 600;

/** 세션 쿠키·OAuth 쿠키 공통 속성. 지우는 쿠키도 같은 속성이어야 한다(__Host-는 Secure 없이 보낸 Set-Cookie를 버린다) */
const COOKIE_ATTRS = "Path=/; Secure; HttpOnly; SameSite=Lax";

/** 세션 ID 바이트 수(32바이트 = 소문자 hex 64자) */
const SESSION_ID_BYTES = 32;
const SESSION_ID = /^[0-9a-f]{64}$/;

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

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 새 세션 ID(CSPRNG 32바이트 → hex 64자). OAuth state(generateState)와 따로 둔다 */
export function newSessionId(): string {
  const arr = new Uint8Array(SESSION_ID_BYTES);
  crypto.getRandomValues(arr);
  return toHex(arr);
}

/** DB 키. Web Crypto라 Workers와 Node에서 같게 동작한다 */
export async function hashSessionId(sessionId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionId));
  return toHex(new Uint8Array(digest));
}

/** 쿠키 값이 세션 ID 형식이면 그대로, 아니면 null(레거시 32자 ID도 null) */
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
    .prepare("SELECT channel_id, channel_name FROM auth_sessions WHERE id_hash = ? AND expires_at > ?")
    .bind(await hashSessionId(sessionId), now)
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
    .prepare("SELECT channel_id FROM auth_sessions WHERE id_hash = ? AND expires_at > ?")
    .bind(await hashSessionId(sessionId), now)
    .first<{ channel_id: string }>();
  if (row === null) return { state: "expired" };
  return { state: "active", session: { channelId: row.channel_id } };
}

/** 새 세션 행(해시만)을 넣고 쿠키에 담을 원본 ID를 돌려준다. expires_at = now + SESSION_TTL_SECONDS */
export async function createSession(db: SessionDb, user: SessionUser, now: number): Promise<string> {
  const sessionId = newSessionId();
  await db
    .prepare("INSERT INTO auth_sessions (id_hash, channel_id, channel_name, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await hashSessionId(sessionId), user.channelId, user.channelName, now + SESSION_TTL_SECONDS)
    .run();
  return sessionId;
}

export async function deleteSession(db: SessionDb, sessionId: string): Promise<void> {
  await db.prepare("DELETE FROM auth_sessions WHERE id_hash = ?").bind(await hashSessionId(sessionId)).run();
}

/** 만료 행 정리. 로그인 때 기회적으로 부른다 */
export async function deleteExpiredSessions(db: SessionDb, now: number): Promise<void> {
  await db.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").bind(now).run();
}

/** 로그인 완료 Set-Cookie 값 */
export function sessionCookie(sessionId: string): string {
  return `${SESSION_COOKIE}=${sessionId}; ${COOKIE_ATTRS}; Max-Age=${SESSION_TTL_SECONDS}`;
}

/** 로그아웃 Set-Cookie 값 */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; ${COOKIE_ATTRS}; Max-Age=0`;
}

/** 레거시 session_id 쿠키를 지우는 Set-Cookie 값 */
export function clearLegacySessionCookie(): string {
  return `${LEGACY_SESSION_COOKIE}=; ${COOKIE_ATTRS}; Max-Age=0`;
}

export type OauthCookieName = "oauth_state" | "oauth_next";

/** OAuth 왕복 쿠키. 치지직에서 돌아오는 요청은 사이트 간 top-level GET이라 SameSite=Lax여야 쿠키가 실린다 */
export function oauthCookie(name: OauthCookieName, value: string): string {
  return `${name}=${encodeURIComponent(value)}; ${COOKIE_ATTRS}; Max-Age=${OAUTH_COOKIE_MAX_AGE}`;
}

/** callback이 성공·실패 어느 쪽으로 끝나든 붙이는 OAuth 쿠키 삭제값 */
export function clearOauthCookies(): string[] {
  return [`oauth_state=; ${COOKIE_ATTRS}; Max-Age=0`, `oauth_next=; ${COOKIE_ATTRS}; Max-Age=0`];
}
