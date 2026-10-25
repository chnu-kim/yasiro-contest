import type { Actor, GamesDb, SessionState } from "./types.ts";

/** 야시로 치지직 채널 ID. 공개 정보(CLAUDE.md). 다른 관리자 ID는 Worker secret ADMIN_CHANNEL_IDS로만 둔다 */
export const YASIRO_CHANNEL_ID = "d6e680f5b17eba0b078f978dd722c0f3";

const CHANNEL_ID = /^[0-9a-f]{32}$/;
const NEXT_PATH_MAX = 512;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** 쉼표·공백·줄바꿈으로 구분된 채널 ID 목록. 형식이 틀린 값은 조용히 버리고, 야시로는 항상 포함한다 */
export function parseAdminIds(raw: string | undefined): ReadonlySet<string> {
  const ids = new Set<string>([YASIRO_CHANNEL_ID]);
  for (const part of (raw ?? "").split(/[\s,]+/)) {
    const id = part.toLowerCase();
    if (CHANNEL_ID.test(id)) ids.add(id);
  }
  return ids;
}

export function isAdminChannel(channelId: string, adminIds: ReadonlySet<string>): boolean {
  return adminIds.has(channelId);
}

/** 표시 이름은 채널 ID → 고정 별칭으로만 정한다. 채널 이름은 받지 않는다(관리자 익명) */
export function actorNameFor(channelId: string): "야시로" | "관리자" {
  return channelId === YASIRO_CHANNEL_ID ? "야시로" : "관리자";
}

export function readCookie(header: string | null, name: string): string | null {
  if (header === null) return null;
  for (const part of header.split(";")) {
    const piece = part.trim();
    const eq = piece.indexOf("=");
    if (eq === -1 || piece.slice(0, eq) !== name) continue;
    const value = piece.slice(eq + 1);
    if (value === "") return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

/** 세션 쿠키로 요청자를 판정한다. sessions.channel_name은 조회하지 않는다 */
export async function getSessionActor(
  db: GamesDb,
  cookieHeader: string | null,
  now: number,
  adminIds: ReadonlySet<string>,
): Promise<SessionState> {
  const sessionId = readCookie(cookieHeader, "session_id");
  if (sessionId === null) return { kind: "anonymous" };
  const row = await db
    .prepare("SELECT channel_id FROM sessions WHERE id = ? AND expires_at > ?")
    .bind(sessionId, now)
    .first<{ channel_id: string }>();
  if (row === null) return { kind: "expired" };
  if (!isAdminChannel(row.channel_id, adminIds)) return { kind: "user" };
  const actor: Actor = { channelId: row.channel_id, name: actorNameFor(row.channel_id) };
  return { kind: "admin", actor };
}

/** 쓰기 요청이 같은 출처에서 왔는가(CSRF 방어). Origin이 없으면 Sec-Fetch-Site: same-origin일 때만 허용 */
export function checkSameOrigin(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) return true;
  const origin = request.headers.get("origin");
  if (origin === null) return request.headers.get("sec-fetch-site") === "same-origin";
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  return host === new URL(request.url).host || host === request.headers.get("host");
}

/** 재로그인 후 돌아갈 경로. 같은 사이트의 절대 경로만 허용하고 아니면 "/" */
export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length > NEXT_PATH_MAX) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(raw)) return "/";
  return raw;
}
