import { describe, it, expect } from 'vitest';
import { validateClickDelta } from './clicker';

describe('validateClickDelta', () => {
  it('delta 1은 유효', () => {
    expect(validateClickDelta(1)).toEqual({ ok: true, value: 1 });
  });

  it('delta 20은 유효', () => {
    expect(validateClickDelta(20)).toEqual({ ok: true, value: 20 });
  });

  it('최대치(500)는 유효', () => {
    expect(validateClickDelta(500)).toEqual({ ok: true, value: 500 });
  });

  it('0은 거부', () => {
    const r = validateClickDelta(0);
    expect(r.ok).toBe(false);
  });

  it('음수는 거부', () => {
    const r = validateClickDelta(-1);
    expect(r.ok).toBe(false);
  });

  it('소수는 거부', () => {
    const r = validateClickDelta(1.5);
    expect(r.ok).toBe(false);
  });

  it('501은 최대치 초과로 거부', () => {
    const r = validateClickDelta(501);
    expect(r.ok).toBe(false);
  });

  it('문자열은 거부', () => {
    const r = validateClickDelta('10' as unknown as number);
    expect(r.ok).toBe(false);
  });
});
