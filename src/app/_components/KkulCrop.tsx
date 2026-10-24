// kkul.png(꿀붕이 2마리가 한 장에 있는 시트)에서 한 마리만 잘라 보여 준다.
// front: 정면 꿀붕이 / pot: 꿀단지를 멘 뒷모습. 시트 비율은 1600x1043, 한 마리 영역은 폭 33% x 높이 51%.
import Image from 'next/image';
import type { CSSProperties } from 'react';

const CROP = {
  front: { x: 14, y: 27 },
  pot: { x: 52, y: 27 },
} as const;

export default function KkulCrop({
  kind,
  size,
  alt = '',
  className,
  style,
}: {
  kind: keyof typeof CROP;
  size: number;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const { x, y } = CROP[kind];
  const scale = 100 / 33; // 시트 폭 / 한 마리 폭 (상자 폭 대비 이미지 폭)
  const boxRatio = (0.51 * 1043) / (0.33 * 1600); // 상자 높이 / 상자 폭
  const imgH = scale * (1043 / 1600); // 상자 폭 대비 이미지 높이
  return (
    <span
      className={className}
      style={{
        display: 'block',
        width: size,
        height: size * boxRatio,
        overflow: 'hidden',
        flexShrink: 0,
        ...style,
      }}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <Image
        src="/kkul.png"
        alt=""
        width={1600}
        height={1043}
        sizes={`${Math.round(size * scale)}px`}
        style={{
          position: 'absolute',
          width: `${scale * 100}%`,
          height: 'auto',
          maxWidth: 'none',
          left: `${-(x / 100) * scale * 100}%`,
          top: `${((-(y / 100) * imgH) / boxRatio) * 100}%`,
        }}
      />
    </span>
  );
}
