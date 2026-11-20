// 작은 UI 아이콘(인라인 SVG, currentColor, aria-hidden). props: size(기본 20), strokeWidth(기본 1.75), style.
// ArrowIcon: direction 'right'|'down'|'up-right'(외부 링크 ↗).
import type { CSSProperties, ReactNode } from 'react';

type IconProps = { size?: number; strokeWidth?: number; style?: CSSProperties };

function Svg({ size = 20, strokeWidth = 1.75, style, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, ...style }}
    >
      {children}
    </svg>
  );
}

const ARROWS = {
  right: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  down: <><path d="M12 5v14" /><path d="m6 13 6 6 6-6" /></>,
  'up-right': <><path d="M7 17 17 7" /><path d="M8.5 7H17v8.5" /></>,
} as const;

export function ArrowIcon({ direction = 'right', ...props }: IconProps & { direction?: keyof typeof ARROWS }) {
  return <Svg {...props}>{ARROWS[direction]}</Svg>;
}
