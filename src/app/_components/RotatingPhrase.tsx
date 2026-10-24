'use client';
// 히어로 배지 문구를 일정 간격으로 돌려 보여 준다. 첫 렌더는 항상 phrases[0]이라 hydration이 어긋나지 않는다.
// prefers-reduced-motion이면 돌리지 않고 첫 문구에 머문다.
import { useEffect, useState } from 'react';

export default function RotatingPhrase({
  phrases,
  interval = 3200,
  className,
}: {
  phrases: readonly string[];
  interval?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (phrases.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % phrases.length), interval);
    return () => window.clearInterval(id);
  }, [phrases.length, interval]);

  // key로 문구마다 새로 마운트해 className의 진입 애니메이션을 다시 재생한다
  return (
    <span key={index} className={className}>
      {phrases[index]}
    </span>
  );
}
