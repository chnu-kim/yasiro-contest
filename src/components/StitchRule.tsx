// 수첩 재봉선 같은 점선 구분선. props: width(기본 '100%'), color(기본 --border-strong), style.
// 용도: 섹션·카드 안 구분선, 히어로 부제 아래 짧은 선(width 120). 장식이라 role 없음(aria-hidden).
import type { CSSProperties } from 'react';

export default function StitchRule({
  width = '100%',
  color = 'var(--border-strong)',
  style,
}: {
  width?: number | string;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'block',
        width,
        height: 1,
        background: `repeating-linear-gradient(90deg, ${color} 0 6px, transparent 6px 10px)`,
        ...style,
      }}
    />
  );
}
