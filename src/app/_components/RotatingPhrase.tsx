'use client';
// 히어로 배지 문구를 일정 간격으로 돌려 보여 준다. 첫 렌더는 항상 phrases[0]이라 hydration이 어긋나지 않는다.
// 바뀔 때는 이전 문구가 위로 빠지고(out) 다음 문구가 아래에서 올라온다(in).
// prefers-reduced-motion이면 돌리지 않고 첫 문구에 머문다.
import { useEffect, useState } from 'react';
import styles from './RotatingPhrase.module.css';

const OUT_MS = 350;

export default function RotatingPhrase({
  phrases,
  interval = 10000,
  className,
}: {
  phrases: readonly string[];
  interval?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (phrases.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let swap: number | undefined;
    const id = window.setInterval(() => {
      setLeaving(true);
      swap = window.setTimeout(() => {
        setIndex((i) => (i + 1) % phrases.length);
        setLeaving(false);
      }, OUT_MS);
    }, interval);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(swap);
    };
  }, [phrases.length, interval]);

  return (
    <span className={styles.window}>
      {/* key로 문구마다 새로 마운트해 진입 애니메이션을 다시 재생한다 */}
      <span key={index} className={`${className ?? ''} ${leaving ? styles.out : styles.in}`}>
        {phrases[index]}
      </span>
    </span>
  );
}
