export type ValidateResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

const MAX_DELTA = 500;

export function validateClickDelta(n: unknown): ValidateResult {
  if (typeof n !== 'number' || !Number.isInteger(n)) {
    return { ok: false, error: '유효하지 않은 클릭 수입니다.' };
  }
  if (n <= 0) {
    return { ok: false, error: '클릭 수는 1 이상이어야 합니다.' };
  }
  if (n > MAX_DELTA) {
    return { ok: false, error: `한 번에 최대 ${MAX_DELTA}클릭만 가능합니다.` };
  }
  return { ok: true, value: n };
}
