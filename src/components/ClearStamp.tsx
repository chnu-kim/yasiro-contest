// 게임 정복 도장(원형 탐험 도장). RoundStamp(/about 1개)와 같은 계열의 /games 전용 예외.
// 굵은+가는 이중 링, 위 호 "EXPEDITION CLEAR", 가운데 "정복", 아래 호 "★ NO.{no} ★".
// 실제 고무도장처럼 보이게 SVG 필터로 가장자리를 살짝 흔들고(feDisplacementMap) 인주가 빠진 점을 낸다(feTurbulence 마스크).
// 바탕은 옅은 종이 워시(--paper-hi 90%)라 바쁜 포스터 위에서도 읽힌다.
// props: no(게임 번호), size(px, 기본 88 — width/height 속성값이라 CSS가 덮어쓸 수 있다), rotate(deg, 기본 -12), className, style.
// 색 --stamp. aria-hidden — 정복 여부는 카드·상세의 텍스트로 따로 전달한다.
import { useId, type CSSProperties } from 'react';

export default function ClearStamp({
  no,
  size = 88,
  rotate = -12,
  className,
  style,
}: {
  no: string;
  size?: number;
  rotate?: number;
  className?: string;
  style?: CSSProperties;
}) {
  // 한 페이지에 도장이 여럿이라 필터·경로 id를 도장마다 따로 둔다. 무늬(seed)는 번호로 바꿔 도장마다 조금씩 다르게 찍힌다
  const uid = useId().replace(/:/g, '');
  const seed = (Number.parseInt(no, 10) || 0) % 97;
  const ink = `ink-${uid}`;
  const top = `top-${uid}`;
  const bottom = `bottom-${uid}`;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ color: 'var(--stamp)', transform: `rotate(${rotate}deg)`, flexShrink: 0, overflow: 'visible', ...style }}
    >
      <defs>
        <filter id={ink} x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves={2} seed={seed} result="wobble" />
          <feDisplacementMap in="SourceGraphic" in2="wobble" scale="1.4" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves={2} seed={seed + 11} result="grain" />
          {/* 잡음이 아주 밝은 곳만 투명하게: 인주가 군데군데 빠진 자국 */}
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -4.5 0 0 0 3.75" result="holes" />
          <feComposite in="rough" in2="holes" operator="in" />
        </filter>
        <path id={top} d="M 18 50 A 32 32 0 0 1 82 50" />
        <path id={bottom} d="M 16 50 A 34 34 0 0 0 84 50" />
      </defs>
      <circle cx="50" cy="50" r="47" fill="var(--paper-hi)" opacity="0.9" />
      <g filter={`url(#${ink})`} fill="currentColor" stroke="currentColor">
        <circle cx="50" cy="50" r="45.5" fill="none" strokeWidth="4" />
        <circle cx="50" cy="50" r="39.5" fill="none" strokeWidth="1.2" />
        <text stroke="none" style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 8.6, letterSpacing: 1.4 }}>
          <textPath href={`#${top}`} startOffset="50%" textAnchor="middle">EXPEDITION CLEAR</textPath>
        </text>
        <text stroke="none" dominantBaseline="hanging" style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 8.6, letterSpacing: 1.2 }}>
          <textPath href={`#${bottom}`} startOffset="50%" textAnchor="middle">★ NO.{no} ★</textPath>
        </text>
        <line x1="22" y1="40" x2="78" y2="40" strokeWidth="1" />
        <line x1="22" y1="62" x2="78" y2="62" strokeWidth="1" />
        <text x="50" y="58.5" textAnchor="middle" stroke="none" style={{ fontFamily: "'Noto Serif KR', serif", fontWeight: 700, fontSize: 21 }}>
          정복
        </text>
      </g>
    </svg>
  );
}
