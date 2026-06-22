'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import styles from './page.module.css';
import { pickRandomHole, clickHole, calcTimeLeft, HoleState } from '@/lib/whack';

const TOTAL_HOLES = 9;
const GAME_DURATION_MS = 30_000;
const POP_INTERVAL_MS = 900;
const POP_VISIBLE_MS = 1_400;
const FALL_ANIM_MS = 300;
const HIT_ANIM_MS = 350;

interface FloatingPoint {
  id: number;
  holeIdx: number;
}

interface ScoreRow {
  channel_name: string;
  score: number;
}

function LeaderboardPanel({ rows, myScore, phase }: { rows: ScoreRow[]; myScore: number; phase: string }) {
  return (
    <div className={styles.leaderboardPanel}>
      <h2 style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 12, textAlign: 'center', fontWeight: 600 }}>
        TOP 10
      </h2>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', padding: '16px 0' }}>
          아직 기록이 없습니다
        </div>
      ) : (
        <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {rows.map((row, i) => {
            const isMine = phase === 'result' && row.score === myScore && i === rows.findIndex(r => r.score === myScore);
            return (
              <li key={i} className={`${styles.rankRow} ${isMine ? styles.mine : ''}`}>
                <span style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 12,
                  fontWeight: 700,
                  color: i < 3 ? 'var(--accent)' : 'var(--text-dim)',
                  width: 20,
                  flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.channel_name}
                </span>
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: 13, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                  {row.score}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default function WhackGame() {
  const [phase, setPhase] = useState<'idle' | 'playing' | 'result'>('idle');
  const [score, setScore] = useState(0);
  const [holes, setHoles] = useState<HoleState[]>(Array(TOTAL_HOLES).fill('empty'));
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_MS);
  const [floatingPoints, setFloatingPoints] = useState<FloatingPoint[]>([]);
  const [leaderboard, setLeaderboard] = useState<ScoreRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const startedAt = useRef<number>(0);
  const popTimer = useRef<ReturnType<typeof setInterval>>(undefined);
  const tickTimer = useRef<ReturnType<typeof setInterval>>(undefined);
  const holeTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const fpCounter = useRef(0);
  const holesRef = useRef<HoleState[]>(Array(TOTAL_HOLES).fill('empty'));
  const finalScoreRef = useRef(0);

  const syncHoles = useCallback((next: HoleState[]) => {
    holesRef.current = next;
    setHoles(next);
  }, []);

  const scheduleHoleFall = useCallback((idx: number, delay: number) => {
    const timer = setTimeout(() => {
      const current = holesRef.current[idx];
      if (current !== 'up') return;
      const next = [...holesRef.current];
      next[idx] = 'falling';
      syncHoles(next);

      const fallTimer = setTimeout(() => {
        const n2 = [...holesRef.current];
        n2[idx] = 'empty';
        syncHoles(n2);
        holeTimers.current.delete(idx);
      }, FALL_ANIM_MS);
      holeTimers.current.set(idx, fallTimer);
    }, delay);
    holeTimers.current.set(idx, timer);
  }, [syncHoles]);

  const clearAllTimers = useCallback(() => {
    clearInterval(popTimer.current);
    clearInterval(tickTimer.current);
    holeTimers.current.forEach(t => clearTimeout(t));
    holeTimers.current.clear();
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/whack');
      if (res.ok) setLeaderboard(await res.json() as ScoreRow[]);
    } catch { /* 네트워크 오류 무시 */ }
  }, []);

  // 마운트 시 리더보드 초기 로드
  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  const saveScore = useCallback(async (finalScore: number) => {
    setIsSaving(true);
    try {
      await fetch('/api/whack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: finalScore }),
      });
    } catch { /* 저장 실패 무시 */ } finally {
      setIsSaving(false);
      await fetchLeaderboard();
    }
  }, [fetchLeaderboard]);

  const endGame = useCallback(() => {
    clearAllTimers();
    syncHoles(Array(TOTAL_HOLES).fill('empty'));
    setTimeLeft(0);
    setPhase('result');
    saveScore(finalScoreRef.current);
  }, [clearAllTimers, syncHoles, saveScore]);

  const startGame = useCallback(() => {
    clearAllTimers();
    syncHoles(Array(TOTAL_HOLES).fill('empty'));
    setScore(0);
    finalScoreRef.current = 0;
    setFloatingPoints([]);
    setPhase('playing');

    startedAt.current = Date.now();
    setTimeLeft(GAME_DURATION_MS);

    popTimer.current = setInterval(() => {
      const active = new Set(
        holesRef.current.map((s, i) => s !== 'empty' ? i : -1).filter(i => i >= 0)
      );
      const idx = pickRandomHole(TOTAL_HOLES, active);
      if (idx === null) return;

      const next = [...holesRef.current];
      next[idx] = 'rising';
      syncHoles(next);

      const riseTimer = setTimeout(() => {
        const n2 = [...holesRef.current];
        if (n2[idx] === 'rising') {
          n2[idx] = 'up';
          syncHoles(n2);
        }
      }, 250);
      holeTimers.current.set(idx * 1000, riseTimer);

      scheduleHoleFall(idx, POP_VISIBLE_MS);
    }, POP_INTERVAL_MS);

    tickTimer.current = setInterval(() => {
      const left = calcTimeLeft(startedAt.current, GAME_DURATION_MS, Date.now());
      setTimeLeft(left);
      if (left <= 0) endGame();
    }, 100);
  }, [clearAllTimers, syncHoles, scheduleHoleFall, endGame]);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  const handleHoleClick = useCallback((idx: number) => {
    if (phase !== 'playing') return;
    const current = holesRef.current[idx];
    const { scored, nextState } = clickHole(current);
    if (!scored) return;

    const next = [...holesRef.current];
    next[idx] = nextState;
    syncHoles(next);

    const existing = holeTimers.current.get(idx);
    if (existing) clearTimeout(existing);

    const hitTimer = setTimeout(() => {
      const n2 = [...holesRef.current];
      n2[idx] = 'empty';
      syncHoles(n2);
      holeTimers.current.delete(idx);
    }, HIT_ANIM_MS);
    holeTimers.current.set(idx, hitTimer);

    setScore(s => {
      const next = s + 1;
      finalScoreRef.current = next;
      return next;
    });

    const fpId = ++fpCounter.current;
    setFloatingPoints(pts => [...pts, { id: fpId, holeIdx: idx }]);
    setTimeout(() => setFloatingPoints(pts => pts.filter(p => p.id !== fpId)), 600);
  }, [phase, syncHoles]);

  const timerPercent = (timeLeft / GAME_DURATION_MS) * 100;
  const isWarning = timeLeft < 8000;
  const top10 = leaderboard.slice(0, 10);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 24px',
      }}>

        {/* 배지 */}
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
          꿀붕이 잡기
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 40, fontWeight: 300 }}>
          구멍에서 튀어나오는 꿀붕이를 잡으세요!
        </p>

        {/* 게임 + 리더보드 레이아웃 */}
        <div className={styles.gameLayout}>

          {/* 리더보드 패널 (항상 표시) */}
          <LeaderboardPanel rows={top10} myScore={score} phase={phase} />

          {/* 게임 영역 */}
          <div className={styles.gameArea}>

            {/* 점수 + 타이머 (게임 중) */}
            {phase === 'playing' && (
              <div style={{ width: 408, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span
                    aria-live="off"
                    aria-label={`현재 점수: ${score}점`}
                    style={{ fontFamily: "'Cinzel', serif", fontSize: 36, fontWeight: 700, color: 'var(--accent)' }}
                  >
                    {score}
                  </span>
                  <span
                    aria-live="off"
                    aria-label={`남은 시간: ${Math.ceil(timeLeft / 1000)}초`}
                    style={{ fontFamily: "'Cinzel', serif", fontSize: 22, fontWeight: 600, color: isWarning ? '#E04040' : 'var(--text)', transition: 'color 0.3s' }}
                  >
                    {Math.ceil(timeLeft / 1000)}s
                  </span>
                </div>
                <div className={styles.timerBar}>
                  <div
                    className={`${styles.timerFill} ${isWarning ? styles.warning : ''}`}
                    style={{ width: `${timerPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* 게임 보드 */}
            <div style={{ background: '#EAE0D0', borderRadius: 16, padding: 24, marginBottom: 28 }}>
              <div className={styles.grid}>
                {holes.map((state, idx) => {
                  const isUp = state === 'up' || state === 'rising';
                  const src = (state === 'hit' || state === 'falling') ? '/kkul-back.png' : '/kkul-front.png';
                  const holeFloating = floatingPoints.filter(p => p.holeIdx === idx);

                  return (
                    <button
                      key={idx}
                      type="button"
                      className={styles.hole}
                      onClick={() => handleHoleClick(idx)}
                      tabIndex={phase === 'playing' ? 0 : -1}
                      aria-label={`구멍 ${idx + 1}${holes[idx] !== 'empty' ? ' — 꿀붕이 출현!' : ''}`}
                    >
                      {state !== 'empty' && (
                        <Image
                          src={src}
                          alt="꿀붕이"
                          width={100}
                          height={163}
                          className={`${styles.kkul} ${styles[state]}`}
                          draggable={false}
                          priority={isUp}
                        />
                      )}
                      {holeFloating.map(fp => (
                        <span key={fp.id} className={styles.floatingPoint} style={{ left: '50%', top: '30%' }}>
                          +1
                        </span>
                      ))}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 시작 화면 */}
            {phase === 'idle' && (
              <button className={styles.startBtn} onClick={startGame}>
                게임 시작
              </button>
            )}

            {/* 종료 화면 */}
            {phase === 'result' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', letterSpacing: '0.05em', marginBottom: 4 }}>최종 점수</div>
                  <div
                    aria-label={`최종 점수: ${score}점`}
                    style={{ fontFamily: "'Cinzel', serif", fontSize: 56, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}
                  >
                    {score}
                  </div>
                  {isSaving && (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>점수 저장 중…</div>
                  )}
                </div>
                <button className={styles.startBtn} onClick={startGame}>
                  다시 하기
                </button>
              </div>
            )}

          </div>
        </div>

      </main>

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
