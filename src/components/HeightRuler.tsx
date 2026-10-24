// 세로 키 눈금자(cm). props: topCm(기본 149.8 — 마커 값), headTop/feetBottom(부모 높이 대비 %, 머리끝·발끝 위치),
// side('right'면 그림 오른쪽에 놓여 눈금이 오른쪽으로 뻗음, 'left'는 반대), style. 부모는 position: relative + 그림과 같은 높이여야 한다.
// 10cm 짧은 틱, 50cm마다 긴 틱과 숫자. 마커 ▶ --eye + "149.8 cm" 라벨. 장식이라 aria-hidden — 키 값은 본문에도 쓴다.
import type { CSSProperties } from 'react';

const label: CSSProperties = {
  fontFamily: "'Fredoka', sans-serif",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.04em',
  lineHeight: 1,
  whiteSpace: 'nowrap',
};

export default function HeightRuler({
  topCm = 149.8,
  headTop = 0,
  feetBottom = 0,
  side = 'right',
  style,
}: {
  topCm?: number;
  headTop?: number;
  feetBottom?: number;
  side?: 'left' | 'right';
  style?: CSSProperties;
}) {
  const out = side === 'right' ? 'left' : 'right'; // 눈금 시작 가장자리(그림 쪽)
  const marks = [];
  for (let cm = 0; cm < topCm; cm += 10) marks.push(cm);
  const pos = (cm: number) => `${(cm / topCm) * 100}%`;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: `${headTop}%`,
        bottom: `${feetBottom}%`,
        width: 64,
        color: 'var(--text-dim)',
        ...style,
      }}
    >
      {/* 기둥 */}
      <span style={{ position: 'absolute', top: 0, bottom: 0, [out]: 0, width: 1, background: 'currentColor' }} />
      {marks.map((cm) => {
        const long = cm % 50 === 0;
        return (
          <span key={cm} style={{ position: 'absolute', bottom: pos(cm), [out]: 0, display: 'flex', alignItems: 'center', flexDirection: side === 'right' ? 'row' : 'row-reverse', gap: 6, transform: 'translateY(50%)' }}>
            <span style={{ width: long ? 12 : 6, height: 1, background: 'currentColor', opacity: long ? 1 : 0.55 }} />
            {cm % 50 === 0 && <span style={label}>{cm}</span>}
          </span>
        );
      })}
      {/* 머리끝 마커 */}
      <span
        style={{
          position: 'absolute',
          top: 0,
          [out]: -2,
          display: 'flex',
          alignItems: 'center',
          flexDirection: side === 'right' ? 'row' : 'row-reverse',
          gap: 6,
          transform: 'translateY(-50%)',
        }}
      >
        <svg width="10" height="12" viewBox="0 0 10 12" style={{ transform: side === 'right' ? 'none' : 'scaleX(-1)' }}>
          <path d="M0 0 10 6 0 12Z" fill="var(--eye)" stroke="var(--brass)" strokeWidth="1" />
        </svg>
        <span style={{ ...label, fontSize: 14, color: 'var(--text)' }}>{topCm} cm</span>
      </span>
      {/* 머리끝 가로 기준선(그림 쪽으로 짧게) */}
      <span style={{ position: 'absolute', top: 0, [out]: 0, width: 20, height: 0, borderTop: '1px dashed var(--brass)', transform: side === 'right' ? 'translateX(-100%)' : 'translateX(100%)' }} />
    </div>
  );
}
