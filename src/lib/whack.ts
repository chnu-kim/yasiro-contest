export type HoleState = 'empty' | 'rising' | 'up' | 'hit' | 'falling';

export function pickRandomHole(total: number, exclude: Set<number>): number | null {
  const candidates: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!exclude.has(i)) candidates.push(i);
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function clickHole(state: HoleState): { scored: boolean; nextState: HoleState } {
  if (state === 'up') return { scored: true, nextState: 'hit' };
  return { scored: false, nextState: state };
}

export function calcTimeLeft(startMs: number, durationMs: number, nowMs: number): number {
  return Math.max(0, durationMs - (nowMs - startMs));
}

const MAX_SCORE = 999;

export function validateScore(score: unknown): { ok: true; value: number } | { ok: false; error: string } {
  if (typeof score !== 'number' || !Number.isInteger(score)) {
    return { ok: false, error: '점수는 정수여야 합니다.' };
  }
  if (score < 0) return { ok: false, error: '점수는 0 이상이어야 합니다.' };
  if (score > MAX_SCORE) return { ok: false, error: `점수는 ${MAX_SCORE} 이하여야 합니다.` };
  return { ok: true, value: score };
}
