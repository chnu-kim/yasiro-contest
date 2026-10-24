// 채널용 범용 글리프(상표 로고 흉내 금지). props: kind, size(기본 24), style. currentColor, aria-hidden.
// kind: 'broadcast'(치지직 라이브) · 'play'(유튜브) · 'journal'(시로의 탐험일지) · 'post'(X) · 'community'(팬카페).
// 링크 텍스트(채널 이름)는 따로 둔다 — 아이콘만으로 채널을 구분하게 하지 않는다.
import type { CSSProperties } from 'react';

export type ChannelKind = 'broadcast' | 'play' | 'journal' | 'post' | 'community';

const PATHS: Record<ChannelKind, React.ReactNode> = {
  broadcast: (
    <>
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <path d="M8.5 15.5a5 5 0 0 1 0-7" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M5.6 18.4a9 9 0 0 1 0-12.8" />
      <path d="M18.4 5.6a9 9 0 0 1 0 12.8" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5 15.5 12 10 15.5Z" fill="currentColor" />
    </>
  ),
  journal: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="M12 8h4" />
      <path d="M12 12h4" />
    </>
  ),
  post: (
    <>
      <path d="M21 3 3 10.5l7 3 3.5 7.5Z" />
      <path d="M10 13.5 21 3" />
    </>
  ),
  community: (
    <>
      <path d="M4 4h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-3 3v-3H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-3-3h-3a2 2 0 0 1-2-2" />
    </>
  ),
};

export default function ChannelGlyph({
  kind,
  size = 24,
  style,
}: {
  kind: ChannelKind;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, ...style }}
    >
      {PATHS[kind]}
    </svg>
  );
}
