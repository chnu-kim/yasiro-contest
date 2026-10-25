// 게임 정복 도장(원형 "CLEAR / 정복"). RoundStamp(사이트 전체 1개)와 별개인 /games 전용 예외.
// props: size(px, 기본 88), rotate(deg, 기본 -12), style(position 등). 색 --stamp, 바탕 --paper-hi. aria-hidden —
// 정복 여부는 카드·상세의 텍스트로 따로 전달한다.
import type { CSSProperties } from 'react';

export default function ClearStamp({
  size = 88,
  rotate = -12,
  style,
}: {
  size?: number;
  rotate?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      style={{ color: 'var(--stamp)', transform: `rotate(${rotate}deg)`, flexShrink: 0, ...style }}
    >
      <circle cx="50" cy="50" r="46" fill="var(--paper-hi)" stroke="currentColor" strokeWidth="3" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="1" />
      <text
        x="50"
        y="38"
        textAnchor="middle"
        fill="currentColor"
        style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 10, letterSpacing: 1.6 }}
      >
        CLEAR
      </text>
      <text
        x="50"
        y="66"
        textAnchor="middle"
        fill="currentColor"
        style={{ fontFamily: "'Noto Serif KR', serif", fontWeight: 700, fontSize: 24 }}
      >
        정복
      </text>
    </svg>
  );
}
