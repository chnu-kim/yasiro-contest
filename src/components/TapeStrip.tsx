// 마스킹테이프 조각(CSS만, 양 끝 지그재그). props: width(기본 72), height(기본 22), rotate(deg, 기본 -4), style(position/top/left 등).
// 용도: 사진·카드 모서리 고정, "다시보기" 같은 짧은 라벨(children, 12px 이상). 화면당 4개 이하. 본문 위에 올리지 않는다.
import type { CSSProperties, ReactNode } from 'react';

const ZIGZAG =
  'polygon(0 0, 100% 0, 97% 20%, 100% 40%, 97% 60%, 100% 80%, 97% 100%, 0 100%, 3% 80%, 0 60%, 3% 40%, 0 20%)';

export default function TapeStrip({
  width = 72,
  height = 22,
  rotate = -4,
  children,
  style,
}: {
  width?: number | string;
  height?: number;
  rotate?: number;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden={children ? undefined : true}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width,
        height,
        padding: children ? '0 12px' : undefined,
        background:
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0 4px, transparent 4px 8px), var(--tape)',
        clipPath: ZIGZAG,
        transform: `rotate(${rotate}deg)`,
        filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.12))',
        fontFamily: "'Fredoka', 'Noto Sans KR', sans-serif",
        fontSize: 'var(--fs-xs)',
        fontWeight: 600,
        letterSpacing: '0.06em',
        color: 'var(--text)',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
