// 섹션 키커 라벨: 놋쇠 사각 도트 + Fredoka 대문자(12px, --accent-text). props: children, as(기본 'p'), style(여백 조정).
// 용도: 섹션 제목 위 "PROFILE", "EXPLORER FILE" 같은 영문 UI 라벨. 한글은 Fredoka 글리프가 없으니 넣지 않는다.
import type { CSSProperties, ElementType, ReactNode } from 'react';

export default function SectionLabel({
  children,
  as: Tag = 'p',
  style,
}: {
  children: ReactNode;
  as?: ElementType;
  style?: CSSProperties;
}) {
  return (
    <Tag
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 'var(--space-3)',
        fontFamily: "'Fredoka', sans-serif",
        fontSize: 'var(--fs-xs)',
        fontWeight: 600,
        letterSpacing: 'var(--tracking-label)',
        textTransform: 'uppercase',
        lineHeight: 1,
        color: 'var(--accent-text)',
        ...style,
      }}
    >
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 1, background: 'var(--brass)', flexShrink: 0 }} />
      {children}
    </Tag>
  );
}
