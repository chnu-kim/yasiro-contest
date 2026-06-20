export type ValidateResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function validateMessage(raw: string): ValidateResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "메시지를 입력해주세요." };
  if (trimmed.length > 200) return { ok: false, error: "메시지는 200자 이내로 입력해주세요." };
  return { ok: true, value: trimmed };
}

const POST_IT_COLORS = 5;
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
