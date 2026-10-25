'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { EyeOff, Eye, Pencil } from 'lucide-react';
import SectionLabel from '@/components/SectionLabel';
import { formatChangeTime } from '@/lib/games/diff';
import { formatDate } from '@/lib/games/query';
import { STATUS_TEXT, vodAriaLabel } from '@/lib/games/labels';
import { gameToForm } from '@/lib/games/patch';
import type { ChangesResponse, Game, GameRecord } from '@/lib/games/types';
import { adminApi } from './adminApi';
import DialogFrame from './DialogFrame';
import GameEditForm, { type LeaveTo } from './GameEditForm';
import type { AdminGame, BoardGame } from './boardTypes';
import Poster from './Poster';
import styles from './GameDetailDialog.module.css';

export interface AdminDetailContext {
  /** 목록 전체(숨긴 게임 포함). 수정 폼의 중복 검증용 */
  all: readonly Game[];
  startInEdit: boolean;
  onRecord: (record: GameRecord) => void;
  onSaved: (record: GameRecord, created: boolean) => void;
  /** 숨김/다시 보이기. 실패하면 사용자에게 보일 문구, 성공하면 null */
  onToggleHidden: (game: AdminGame, hidden: boolean) => Promise<string | null>;
  toast: ReactNode;
}

function isChanges(v: unknown): v is ChangesResponse {
  return typeof v === 'object' && v !== null && Array.isArray((v as ChangesResponse).changes);
}

export default function GameDetailDialog({
  game,
  admin,
  onClose,
}: {
  game: BoardGame;
  admin: AdminDetailContext | null;
  onClose: () => void;
}) {
  const titleId = `game-detail-${game.id}`;
  const [mode, setMode] = useState<'view' | 'edit'>(admin?.startInEdit ? 'edit' : 'view');
  const leaveRef = useRef<((to: LeaveTo) => void) | null>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const rec = admin === null ? null : (game as AdminGame);

  useEffect(() => {
    if (mode === 'view' && returnFocus.current) {
      returnFocus.current = false;
      editBtnRef.current?.focus();
    }
  }, [mode]);

  const leave = (to: LeaveTo) => {
    if (to === 'close') {
      onClose();
      return;
    }
    returnFocus.current = true;
    setMode('view');
  };

  return (
    <DialogFrame
      labelledBy={titleId}
      onClose={onClose}
      intercept={() => {
        if (mode !== 'edit' || leaveRef.current === null) return false;
        leaveRef.current('close');
        return true;
      }}
      toast={admin?.toast}
    >
      {admin !== null && rec !== null && mode === 'edit' ? (
        <GameEditForm
          base={rec}
          seed={gameToForm(null)}
          all={admin.all}
          titleId={titleId}
          leaveRef={leaveRef}
          onRecord={admin.onRecord}
          onSaved={(r, created) => {
            admin.onSaved(r, created);
            returnFocus.current = true;
            setMode('view');
          }}
          onLeave={leave}
        />
      ) : (
        <>
          <div className={styles.sheet}>
            <div className={styles.poster}>
              <Poster eager nameWideOnly game={game} stampSize={108} stampStyle={{ right: -22, bottom: -24 }} />
            </div>

            <div className={styles.head}>
              <SectionLabel style={{ marginBottom: 0 }}>EXPEDITION NO.{game.no}</SectionLabel>
              <h2 id={titleId} className={styles.title}>{game.name}</h2>
              {game.originalTitle && (
                <p lang="en" className={styles.orig}>{game.originalTitle}</p>
              )}
              {game.hidden && <p className={styles.hiddenNote}>숨김 · 방문자에게는 보이지 않아요</p>}
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

          {admin !== null && rec !== null && (
            <AdminSection
              game={rec}
              editBtnRef={editBtnRef}
              onEdit={() => setMode('edit')}
              onToggleHidden={(hidden) => admin.onToggleHidden(rec, hidden)}
            />
          )}
        </>
      )}
    </DialogFrame>
  );
}

// 상세 하단 ADMIN 영역. 시안: AdminDetail
function AdminSection({
  game,
  editBtnRef,
  onEdit,
  onToggleHidden,
}: {
  game: AdminGame;
  editBtnRef: RefObject<HTMLButtonElement | null>;
  onEdit: () => void;
  onToggleHidden: (hidden: boolean) => Promise<string | null>;
}) {
  const [changes, setChanges] = useState<ChangesResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void adminApi.changes(game.id, 5).then((res) => {
      if (cancelled) return;
      if (res.status === 200 && isChanges(res.body)) {
        setChanges(res.body);
        setFailed(false);
      } else {
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [game.id, game.version]);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    const message = await onToggleHidden(!game.hidden);
    setBusy(false);
    if (message !== null) setError(message);
  };

  return (
    <section className={styles.admin} aria-label="관리자 도구">
      <div className={styles.adminRow}>
        <p className={styles.adminLabel}>
          <span className={styles.adminDot} aria-hidden="true" />
          ADMIN
        </p>
        <div className={styles.adminBtns}>
          <button type="button" className={styles.adminGhost} disabled={busy} onClick={() => void toggle()}>
            {game.hidden ? <Eye size={18} strokeWidth={1.8} aria-hidden="true" /> : <EyeOff size={18} strokeWidth={1.8} aria-hidden="true" />}
            {game.hidden ? '다시 보이게' : '목록에서 숨기기'}
          </button>
          <button type="button" ref={editBtnRef} className={styles.adminPrimary} onClick={onEdit}>
            <Pencil size={18} strokeWidth={1.8} aria-hidden="true" />
            수정
          </button>
        </div>
      </div>
      {error !== null && <p role="alert" className={styles.adminError}>{error}</p>}
      <details className={styles.changes} open>
        <summary>
          변경 기록 <span className={styles.num}>{changes === null ? '' : changes.total}</span>
        </summary>
        {failed && <p className={styles.noVods}>변경 기록을 불러오지 못했어요.</p>}
        {!failed && changes === null && <p className={styles.noVods}>불러오는 중…</p>}
        {changes !== null && (
          <ol className={styles.changeList}>
            {changes.changes.map((c) => (
              <li key={c.id}>
                <span className={styles.changeTime}>{formatChangeTime(c.createdAt)}</span>
                <span>
                  <strong>{c.actorName}</strong> · {c.summary}
                </span>
              </li>
            ))}
            {changes.total > changes.changes.length && (
              <li className={styles.changeMore}>… 이전 기록 {changes.total - changes.changes.length}개</li>
            )}
          </ol>
        )}
      </details>
    </section>
  );
}
