import { describe, expect, it } from 'vitest';
import { SEEN_STATS_KEY, serializeSeenStats } from './seen-stats';

describe('seen-stats', () => {
  it('layout 스크립트가 읽는 형태(total·clear 정수)로만 저장한다', () => {
    expect(SEEN_STATS_KEY).toBe('yasiro-seen-stats');
    expect(JSON.parse(serializeSeenStats({ total: 369, clear: 240 }))).toEqual({ total: 369, clear: 240 });
    expect(serializeSeenStats({ total: 1, clear: 0, extra: 1 } as never)).toBe('{"total":1,"clear":0}');
  });
});
