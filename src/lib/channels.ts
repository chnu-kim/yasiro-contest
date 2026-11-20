// 야시로 채널 주소의 정본. 푸터·Nav·홈·/about이 모두 여기서 가져온다.
export const CHZZK_CHANNEL_URL = 'https://chzzk.naver.com/d6e680f5b17eba0b078f978dd722c0f3';
export const CHZZK_LIVE_URL = 'https://chzzk.naver.com/live/d6e680f5b17eba0b078f978dd722c0f3';

export type ChannelId = 'chzzk' | 'youtube' | 'journal' | 'x' | 'cafe';

export type ChannelInfo = { id: ChannelId; label: string; desc: string; href: string };

// 순서 고정: 치지직 → 유튜브 → 시로의 탐험일지 → X → 팬카페
export const CHANNELS: readonly ChannelInfo[] = [
  { id: 'chzzk', label: '치지직', desc: '라이브 방송', href: CHZZK_CHANNEL_URL },
  { id: 'youtube', label: '유튜브', desc: '유튜브 · @yasiro0321', href: 'https://www.youtube.com/@yasiro0321' },
  { id: 'journal', label: '시로의 탐험일지', desc: '유튜브 · 다시보기', href: 'https://www.youtube.com/@시로의탐험일지' },
  { id: 'x', label: 'X', desc: '@yasiro__', href: 'https://x.com/yasiro__' },
  { id: 'cafe', label: '팬카페', desc: '방송 일정 공지', href: 'https://cafe.naver.com/terafore' },
];
