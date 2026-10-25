// 꿀붕이 발자국 마크. props: className, size(기본 26), style. 색은 currentColor.
// 용도: 허브 목록 점, 표본 라벨 워터마크, 도장 속 표식 같은 장식. 사이트 로고는 KkulMark. 장식이므로 aria-hidden.
import type { CSSProperties } from 'react';

const TOE = 'M 0 -46 C 23 -40 37 -16 37 5 C 37 31 21 50 0 50 C -21 50 -37 31 -37 5 C -37 -16 -23 -40 0 -46 Z';

export default function PawMark({
  className,
  size = 26,
  style,
}: {
  className?: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <path d={TOE} transform="translate(152 220) rotate(-25) scale(0.92)" />
      <path d={TOE} transform="translate(216 168) rotate(-7)" />
      <path d={TOE} transform="translate(296 168) rotate(7)" />
      <path d={TOE} transform="translate(360 220) rotate(25) scale(0.92)" />
      <path d="M 148 300 C 154 264 198 251 224 255 C 240 258 247 265 256 265 C 265 265 272 258 288 255 C 314 251 358 264 364 300 C 374 332 356 372 320 396 C 300 409 276 416 256 416 C 236 416 212 409 192 396 C 156 372 138 332 148 300 Z" />
    </svg>
  );
}
