import { describe, it, expect } from 'vitest';
import {
  pickRandomHole,
  clickHole,
  calcTimeLeft,
} from './whack';

describe('pickRandomHole', () => {
  it('exclude가 비어있으면 0~(total-1) 범위의 인덱스를 반환', () => {
    const result = pickRandomHole(9, new Set());
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(9);
  });

  it('exclude에 없는 인덱스를 반환', () => {
    // 8개 제외 → 반드시 마지막 하나
    const exclude = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(pickRandomHole(9, exclude)).toBe(8);
  });

  it('모든 구멍이 exclude이면 null 반환', () => {
    const exclude = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(pickRandomHole(9, exclude)).toBeNull();
  });

  it('total이 0이면 null 반환', () => {
    expect(pickRandomHole(0, new Set())).toBeNull();
  });
});

describe('clickHole', () => {
  it('up 상태 클릭 → scored: true, nextState: hit', () => {
    expect(clickHole('up')).toEqual({ scored: true, nextState: 'hit' });
  });

  it('empty 상태 클릭 → scored: false, nextState: empty', () => {
    expect(clickHole('empty')).toEqual({ scored: false, nextState: 'empty' });
  });

  it('falling 상태 클릭 → scored: false, nextState: falling', () => {
    expect(clickHole('falling')).toEqual({ scored: false, nextState: 'falling' });
  });

  it('hit 상태 클릭 → scored: false, nextState: hit (중복 클릭 무시)', () => {
    expect(clickHole('hit')).toEqual({ scored: false, nextState: 'hit' });
  });
});

describe('calcTimeLeft', () => {
  it('게임 시작 직후 → 전체 duration 반환', () => {
    expect(calcTimeLeft(1000, 30000, 1000)).toBe(30000);
  });

  it('절반 경과 → 절반 반환', () => {
    expect(calcTimeLeft(1000, 30000, 16000)).toBe(15000);
  });

  it('시간 초과 → 0 반환 (음수 없음)', () => {
    expect(calcTimeLeft(1000, 30000, 40000)).toBe(0);
  });

  it('정확히 종료 시점 → 0 반환', () => {
    expect(calcTimeLeft(1000, 30000, 31000)).toBe(0);
  });
});
