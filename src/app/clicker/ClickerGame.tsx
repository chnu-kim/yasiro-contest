'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import styles from './page.module.css';

const FLUSH_THRESHOLD = 20;
const FLUSH_INTERVAL_MS = 2000;

interface FloatingPoint {
  id: number;
  x: number;
  y: number;
}

export default function ClickerGame({ initialCount }: { initialCount: number }) {
  const [sessionCount, setSessionCount] = useState(0);
  const [globalCount, setGlobalCount] = useState(initialCount);
  const [floatingPoints, setFloatingPoints] = useState<FloatingPoint[]>([]);
  const [isPopping, setIsPopping] = useState(false);

  const pendingDelta = useRef(0);
  const flushTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pointIdCounter = useRef(0);

  const flush = useCallback(async () => {
    if (pendingDelta.current <= 0) return;
    const delta = pendingDelta.current;
    pendingDelta.current = 0;

    try {
      const res = await fetch('/api/clicker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      });
      if (res.ok) {
        const data = await res.json() as { count: number };
        setGlobalCount(data.count);
      }
    } catch {
      // 네트워크 오류 시 무시
    }
  }, []);

  const flushWithBeacon = useCallback(() => {
    if (pendingDelta.current <= 0) return;
    const delta = pendingDelta.current;
    pendingDelta.current = 0;
    navigator.sendBeacon(
      '/api/clicker',
      new Blob([JSON.stringify({ delta })], { type: 'application/json' })
    );
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(flushTimer.current);
        flushWithBeacon();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimeout(flushTimer.current);
    };
  }, [flushWithBeacon]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setSessionCount(c => c + 1);

    setIsPopping(true);
    setTimeout(() => setIsPopping(false), 120);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = ++pointIdCounter.current;
    setFloatingPoints(pts => [...pts, { id, x, y }]);
    setTimeout(() => setFloatingPoints(pts => pts.filter(p => p.id !== id)), 700);

    pendingDelta.current += 1;

    if (pendingDelta.current >= FLUSH_THRESHOLD) {
      clearTimeout(flushTimer.current);
      flush();
    } else {
      clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(flush, FLUSH_INTERVAL_MS);
    }
  }, [flush]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>

      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        gap: 0,
      }}>

        {/* 상단 배지 */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          border: '1px solid var(--accent)', padding: '6px 14px',
          borderRadius: 'var(--radius-sm)', background: 'var(--accent-bg)',
          marginBottom: 24,
        }}>
          <span style={{ width: 7, height: 7, background: 'var(--accent)', display: 'inline-block', borderRadius: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500, letterSpacing: '0.07em' }}>MINI GAME</span>
        </div>

        {/* 타이틀 */}
        <h1 style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: 32,
          fontWeight: 900,
          color: 'var(--text)',
          marginBottom: 8,
          letterSpacing: '-0.01em',
        }}>
          꿀붕이 클리커
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 48, fontWeight: 300 }}>
          꿀붕이를 마구 찌르세요!
        </p>

        {/* 세션 카운터 */}
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <div style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 72,
            fontWeight: 700,
            color: 'var(--accent)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}>
            {sessionCount.toLocaleString()}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6, letterSpacing: '0.05em' }}>
            내가 찌른 횟수
          </div>
        </div>

        {/* 클릭 버튼 (꿀붕이) */}
        <button
          onClick={handleClick}
          className={styles.kkulBtn}
          aria-label="꿀붕이 클릭"
        >
          <div className={`${styles.kkulWrap} ${isPopping ? styles.popping : ''}`}>
            <Image
              src="/kkul.png"
              alt="꿀붕이"
              width={180}
              height={180}
              style={{ objectFit: 'contain', mixBlendMode: 'multiply', display: 'block' }}
              draggable={false}
            />
          </div>
          {floatingPoints.map(p => (
            <span
              key={p.id}
              className={styles.floatingPoint}
              style={{ left: p.x, top: p.y }}
            >
              +1
            </span>
          ))}
        </button>

        {/* 구분선 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', maxWidth: 320, margin: '40px 0 32px' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ width: 7, height: 7, background: 'var(--accent)', borderRadius: 1, flexShrink: 0, display: 'inline-block' }} />
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* 전체 카운터 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 28,
            fontWeight: 600,
            color: 'var(--text)',
            letterSpacing: '-0.01em',
          }}>
            {globalCount.toLocaleString()}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4, letterSpacing: '0.05em' }}>
            모두가 찌른 총 횟수
          </div>
        </div>

      </main>

      {/* 푸터 */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '20px var(--gutter)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 300, letterSpacing: '0.03em' }}>
          © 2026 야시로 · All rights reserved
        </span>
      </footer>
    </div>
  );
}
