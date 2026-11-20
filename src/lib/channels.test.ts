import { describe, expect, it } from 'vitest';
import { CHANNELS, CHZZK_CHANNEL_URL, CHZZK_LIVE_URL } from './channels';

describe('channels', () => {
  it('푸터·/about 순서는 치지직 → 유튜브 → 시로의 탐험일지 → X → 팬카페', () => {
    expect(CHANNELS.map((c) => c.id)).toEqual(['chzzk', 'youtube', 'journal', 'x', 'cafe']);
  });

  it('모든 주소는 https 절대 주소이고 id는 겹치지 않는다', () => {
    for (const c of CHANNELS) expect(new URL(c.href).protocol).toBe('https:');
    expect(new Set(CHANNELS.map((c) => c.id)).size).toBe(CHANNELS.length);
  });

  it('치지직 채널·라이브 주소는 같은 채널을 가리킨다', () => {
    expect(CHANNELS[0].href).toBe(CHZZK_CHANNEL_URL);
    expect(CHZZK_LIVE_URL).toBe(CHZZK_CHANNEL_URL.replace('chzzk.naver.com/', 'chzzk.naver.com/live/'));
  });
});
