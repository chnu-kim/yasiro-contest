import { findSessionChannel, readSessionId } from "../session.ts";
import type { Actor, GamesDb, SessionState } from "./types.ts";

/** 야시로 치지직 채널 ID. 공개 정보(CLAUDE.md). 다른 관리자 ID는 Worker secret ADMIN_CHANNEL_IDS로만 둔다 */
export const YASIRO_CHANNEL_ID = "d6e680f5b17eba0b078f978dd722c0f3";

const CHANNEL_ID = /^[0-9a-f]{32}$/;

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

/** 세션 쿠키로 요청자를 판정한다. sessions.channel_name은 조회하지 않는다 */
export async function getSessionActor(
  db: GamesDb,
  cookieHeader: string | null,
  now: number,
  adminIds: ReadonlySet<string>,
): Promise<SessionState> {
  const found = await findSessionChannel(db, readSessionId(cookieHeader), now);
  if (found.state === "anonymous") return { kind: "anonymous" };
  if (found.state === "expired") return { kind: "expired" };
  const { channelId } = found.session;
  if (!isAdminChannel(channelId, adminIds)) return { kind: "user" };
  const actor: Actor = { channelId, name: actorNameFor(channelId) };
  return { kind: "admin", actor };
}
