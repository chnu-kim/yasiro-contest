import { checkSameOrigin } from "./http.ts";
import { findSession, readSessionId } from "./session.ts";
import type { SessionDb } from "./session.ts";

export type ValidateResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function validateMessage(raw: string): ValidateResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "메시지를 입력해주세요." };
  if (trimmed.length > 200) return { ok: false, error: "메시지는 200자 이내로 입력해주세요." };
  return { ok: true, value: trimmed };
}

const POST_IT_COLORS = 7;
const ROTATION_RANGE = 13; // -6 ~ +6 → 13가지 (0.5도 단위)

export function getPostItStyle(id: string): { colorIndex: number; rotation: number } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const colorIndex = hash % POST_IT_COLORS;
  const rawRot = (hash >> 8) % ROTATION_RANGE; // 0~12
  const rotation = rawRot - 6; // -6 ~ +6
  return { colorIndex, rotation };
}

export interface GuestbookPostDeps {
  db: SessionDb;
  /** unix seconds */
  now: () => number;
  newId: () => string;
}

/** POST /api/guestbook. 같은 출처 → 로그인 → 본문 → 검증 순서. 에러 응답은 { error: string } */
export async function handleGuestbookPost(req: Request, deps: GuestbookPostDeps): Promise<Response> {
  if (!checkSameOrigin(req)) {
    return Response.json({ error: "다른 사이트에서 보낸 요청은 받을 수 없습니다." }, { status: 403 });
  }

  const found = await findSession(deps.db, readSessionId(req.headers.get("cookie")), deps.now());
  if (found.state === "anonymous") {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (found.state === "expired") {
    return Response.json({ error: "세션이 만료되었습니다. 다시 로그인해주세요." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const message = typeof (body as { message?: unknown } | null)?.message === "string"
    ? (body as { message: string }).message
    : "";

  const validated = validateMessage(message);
  if (!validated.ok) {
    return Response.json({ error: validated.error }, { status: 400 });
  }

  const id = deps.newId();
  await deps.db
    .prepare("INSERT INTO guestbook (id, message, channel_id, channel_name) VALUES (?, ?, ?, ?)")
    .bind(id, validated.value, found.session.channelId, found.session.channelName)
    .run();

  return Response.json({ id }, { status: 201 });
}
