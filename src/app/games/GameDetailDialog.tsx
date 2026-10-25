'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import SectionLabel from '@/components/SectionLabel';
import { formatDate } from '@/lib/games/query';
import { STATUS_TEXT, vodAriaLabel } from '@/lib/games/labels';
import type { IndexedGame } from '@/lib/games/types';
import Poster from './Poster';
import styles from './GameDetailDialog.module.css';

// 네이티브 <dialog>. showModal이 Esc, 포커스 가둠(나머지 inert), ::backdrop을 맡는다.
// 배경 스크롤 잠금은 열려 있는 동안만 body에 건다. 닫은 뒤 포커스 복귀는 호출한 쪽(onClose)이 한다.
export default function GameDetailDialog({ game, onClose }: { game: IndexedGame; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const { style } = document.body;
    const prev = { overflow: style.overflow, paddingRight: style.paddingRight };
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    style.overflow = 'hidden';
    if (scrollbar > 0) style.paddingRight = `${scrollbar}px`;
    return () => {
      style.overflow = prev.overflow;
      style.paddingRight = prev.paddingRight;
    };
  }, []);

  const titleId = `game-detail-${game.id}`;

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      // ::backdrop 클릭은 dialog 자신이 target이다(내용은 .sheet가 감싼다)
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <div className={styles.sheet}>
        <button type="button" className={styles.close} aria-label="닫기" onClick={() => ref.current?.close()}>
          <X size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>

        <div className={styles.poster}>
          <Poster eager nameWideOnly game={game} stampSize={108} stampStyle={{ right: -22, bottom: -24 }} />
        </div>

        <div className={styles.head}>
          <SectionLabel style={{ marginBottom: 0 }}>EXPEDITION NO.{game.no}</SectionLabel>
          <h2 id={titleId} className={styles.title}>{game.name}</h2>
          {game.originalTitle && (
            <p lang="en" className={styles.orig}>{game.originalTitle}</p>
          )}
        </div>

        <dl className={styles.facts}>
          <div className={styles.fact}>
            <dt>첫 플레이</dt>
            <dd className={styles.factDate}>{formatDate(game.firstPlayed)}</dd>
          </div>
          <div className={`${styles.fact} ${styles.factRight}`}>
            <dt>정복 여부</dt>
            <dd className={game.status === 'clear' ? `${styles.factStatus} ${styles.isClear}` : styles.factStatus}>
              {STATUS_TEXT[game.status]}
            </dd>
          </div>
        </dl>

        <div className={styles.vods}>
          <h3 className={styles.vodsTitle}>
            다시보기 <span className={styles.num}>{game.vods.length}</span>편
          </h3>
          {game.vods.length > 0 ? (
            <ul className={styles.vodList}>
              {game.vods.map((v) => (
                <li key={v.url}>
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.vod}
                    aria-label={vodAriaLabel(v)}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" className={styles.vodIcon}>
                      <circle cx="12" cy="12" r="9" />
                      <path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor" stroke="none" />
                    </svg>
                    <span className={styles.vodText}>
                      <span className={styles.vodName}>{v.title}</span>
                      <span className={styles.vodMeta}>
                        YouTube · <span className={styles.num}>{formatDate(v.date)}</span>
                      </span>
                    </span>
                    <span aria-hidden="true" className={styles.vodArrow}>↗</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.noVods}>연결된 다시보기가 아직 없어요.</p>
          )}
        </div>
      </div>
    </dialog>
  );
}
