// 원형 고무 스탬프(사이트 전체 1개 — /about 기록 카드). props: text(원주 문구, 기본 'TERRAFORET · EXPLORER · '),
// size(기본 120. 글자는 size와 무관하게 12px로 보정된다, 최소 104 권장), rotate(deg, 기본 -12), style(position 등). 색 --stamp. aria-hidden.
import { useId, type CSSProperties } from 'react';
import PawMark from './PawMark';

export default function RoundStamp({
  text = 'TERRAFORET · EXPLORER · ',
  size = 120,
  rotate = -12,
  style,
}: {
  text?: string;
  size?: number;
  rotate?: number;
  style?: CSSProperties;
}) {
  const pathId = `stamp-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const r = 45; // 글자 기준선 반지름
  const circumference = 2 * Math.PI * r;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      style={{ color: 'var(--stamp)', opacity: 0.88, transform: `rotate(${rotate}deg)`, flexShrink: 0, ...style }}
    >
      <defs>
        <path id={pathId} d={`M ${60 - r} 60 a ${r} ${r} 0 1 1 ${2 * r} 0 a ${r} ${r} 0 1 1 ${-2 * r} 0`} />
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="40" fill="none" stroke="currentColor" strokeWidth="1" />
      <text
        fill="currentColor"
        style={{ fontFamily: "'Fredoka', sans-serif", fontSize: (12 * 120) / size, fontWeight: 600, letterSpacing: 0 }}
      >
        <textPath href={`#${pathId}`} textLength={circumference - 2} lengthAdjust="spacing">
          {text}
        </textPath>
      </text>
      <path
        d="M60 36 80.8 48v24L60 84 39.2 72V48Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <g transform="translate(46 46)">
        <PawMark size={28} />
      </g>
    </svg>
  );
}
