// 꿀붕이 마크(사이트 로고 심볼, 파비콘 src/app/icon.svg와 같은 그림). props: className, size(기본 26), style.
// public/꿀붕이.png를 32px 격자로 옮긴 컬러 그림이라 currentColor를 쓰지 않는다. 장식이므로 aria-hidden.
import type { CSSProperties } from 'react';

const BODY = 'M16 5.2C24.6 5.2 30.4 10.8 30.4 18.2C30.4 25 25.6 30 16 30C6.4 30 1.6 25 1.6 18.2C1.6 10.8 7.4 5.2 16 5.2Z';

export default function KkulMark({
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
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M14.2 5.8C14.3 3.6 15.6 1.6 18.2 0.9C16.9 2.6 17 4.3 18.6 5.9Z" fill="#766456" stroke="#1E1611" strokeWidth="1.1" strokeLinejoin="round" />
      <path d={BODY} fill="#766456" />
      <path d="M28.63 24.53C26.45 27.89 22.24 30 16 30C9.76 30 5.55 27.89 3.37 24.53Q16 25.9 28.63 24.53Z" fill="#F0DFCD" />
      <ellipse cx="6.9" cy="20.3" rx="2.7" ry="2.3" fill="#F0DFCD" />
      <ellipse cx="25.1" cy="20.3" rx="2.7" ry="2.3" fill="#F0DFCD" />
      <circle cx="9.7" cy="17.4" r="1.45" fill="#1E1611" />
      <circle cx="22.3" cy="17.4" r="1.45" fill="#1E1611" />
      <ellipse cx="16" cy="18.9" rx="1.15" ry="0.75" fill="#FF9DA8" />
      <path d={BODY} fill="none" stroke="#1E1611" strokeWidth="1.1" />
    </svg>
  );
}
