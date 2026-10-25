'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import SectionLabel from '@/components/SectionLabel';
import {
  applyFilterChange,
  availableYears,
  countStats,
  detailQuery,
  indexGames,
  indexWithHidden,
  normalizeQ,
  parseDetailId,
  parseQueryState,
  parseSortKey,
  parseYearFilter,
  Q_MAX,
  selectPage,
  serializeQueryState,
  SORT_KEYS,
  STATUS_FILTERS,
  yearFilterOptions,
} from '@/lib/games/query';
import {
  describeConditions,
  hasActiveFilter,
  hasFilterSelection,
  resultSummary,
  SORT_LABEL,
  STATUS_FILTER_LABEL,
  yearLabel,
} from '@/lib/games/labels';
import { addedMessage, errorMessage, hiddenMessage, savedMessage, unhiddenMessage } from '@/lib/games/client';
import type { GamesPageData, GamesQueryState, GameRecord } from '@/lib/games/types';
import { adminApi } from './adminApi';
import AddGameFlow from './AddGameFlow';
import AdminBar from './AdminBar';
import type { AdminGame, BoardGame } from './boardTypes';
import GameCard from './GameCard';
import GameDetailDialog, { type AdminDetailContext } from './GameDetailDialog';
import Pagination from './Pagination';
import Toast, { type ToastState } from './Toast';
import styles from './page.module.css';

// 목록 상태(q, status, year, sort, page)의 정본은 URL이다. useSearchParams로 읽고
// history.pushState/replaceState로 쓴다(Next가 둘을 라우터와 동기화한다).
// 검색 입력은 타이핑마다 replaceState(히스토리 오염 방지), 필터·정렬·페이지는 pushState.
// 상세를 열며 쌓은 history 항목 표식. Next는 pushState data의 사용자 키를 보존한다.
const DETAIL_ENTRY = 'yasiroGameDetail';

const TOAST_MS = 6000;

function isWrite(v: unknown): v is { game: GameRecord } {
  const g = (v as { game?: GameRecord } | null)?.game;
  return typeof g === 'object' && g !== null && typeof g.id === 'string' && typeof g.version === 'number';
}

// D1이 없거나(pnpm dev) 조회가 실패한 경우. 빈 목록 "0개"로 보이지 않게 따로 안내한다.
export default function GamesBoard({ data }: { data: GamesPageData }) {
  if (!data.ok) {
    return (
      <section className={styles.header} aria-labelledby="games-title">
        <div className={styles.headerText}>
          <SectionLabel style={{ marginBottom: 0 }}>EXPEDITION LOG</SectionLabel>
          <h1 id="games-title" className={styles.title}>플레이한 게임</h1>
          <p role="alert" className={styles.lead}>기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
        </div>
      </section>
    );
  }
  return <Board data={data} />;
}

function Board({ data }: { data: Extract<GamesPageData, { ok: true }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isAdmin = data.admin !== null;

  // 관리자는 저장·숨김 직후 목록이 바로 바뀌도록 레코드를 상태로 들고, 서버가 새 props를 주면 따라간다.
  const [records, setRecords] = useState<GameRecord[]>(data.admin === null ? [] : data.games);
  const [syncedData, setSyncedData] = useState(data);
  if (data !== syncedData) {
    setSyncedData(data);
    setRecords(data.admin === null ? [] : data.games);
  }
  const [showHidden, setShowHidden] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editFor, setEditFor] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  // 마우스·포커스가 알림 위에 있는 동안은 자동으로 닫지 않는다
  const [toastHeld, setToastHeld] = useState(false);
  const toastSeq = useRef(0);
  const toastActionRef = useRef<HTMLButtonElement>(null);
  // 상세에서 숨긴 직후 닫히면 포커스를 카드 대신 알림의 "되돌리기"로 보낸다
  const focusUndoRef = useRef(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const wasAdding = useRef(false);

  const state = useMemo(() => parseQueryState(searchParams), [searchParams]);
  // 숨기지 않은 게임만 번호를 매긴다. 숨긴 게임(관리자)은 "—"
  const list = useMemo<BoardGame[]>(
    () => (data.admin === null ? indexGames(data.games).map((g) => ({ ...g, hidden: false })) : indexWithHidden(records)),
    [data, records],
  );
  const visible = useMemo(() => list.filter((g) => !g.hidden), [list]);
  const hiddenCount = list.length - visible.length;
  const source = isAdmin && showHidden ? list : visible;
  const stats = useMemo(() => countStats(visible), [visible]);
  const years = useMemo(() => availableYears(visible), [visible]);
  const page = useMemo(() => selectPage(source, state), [source, state]);

  useEffect(() => {
    if (toast === null || toastHeld) return;
    const t = setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast, toastHeld]);
  const showToast = (message: string, action?: ToastState['action']) => {
    setToastHeld(false);
    setToast({ id: ++toastSeq.current, message, action });
  };
  const dismissToast = () => {
    setToastHeld(false);
    setToast(null);
  };

  // 입력 중인 값(공백 포함)은 로컬로 들고, URL이 바깥에서 바뀌면(뒤로가기·초기화) 따라간다.
  const [typed, setTyped] = useState(state.q);
  const [syncedQ, setSyncedQ] = useState(state.q);
  if (state.q !== syncedQ) {
    setSyncedQ(state.q);
    if (normalizeQ(typed) !== state.q) setTyped(state.q);
  }

  // 상세도 URL(`game` 파라미터)이 정본이다. 열 때 pushState로 기록을 하나 쌓아서
  // 뒤로가기(모바일 제스처 포함)가 페이지를 떠나지 않고 시트만 닫게 한다.
  const openId = parseDetailId(searchParams);
  const openGame: BoardGame | undefined = openId === null ? undefined : list.find((g) => g.id === openId);
  const open = openGame === undefined ? null : openGame.id;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // 닫힌 뒤(닫기 버튼·Esc·배경 클릭·URL 변경 모두) 포커스를 연 카드로 돌린다.
  // 카드가 목록에서 사라졌으면 결과 요약 줄로 보낸다.
  useEffect(() => {
    if (open !== null) return;
    const trigger = triggerRef.current;
    triggerRef.current = null;
    // 숨김으로 닫힌 경우는 카드(이제 목록에 없음)보다 알림의 되돌리기가 먼저다. 링크로 바로 연 상세도 마찬가지
    if (focusUndoRef.current) {
      focusUndoRef.current = false;
      const undo = toastActionRef.current;
      if (undo !== null && undo.isConnected) {
        undo.focus();
        return;
      }
    }
    if (trigger === null) return;
    if (trigger.isConnected) trigger.focus();
    else topRef.current?.focus({ preventScroll: true });
  }, [open]);

  // 게임 추가 흐름이 닫히면(취소·버리기·추가 완료) "게임 추가" 버튼으로 포커스를 돌린다. 1·2단계가 서로 다른
  // dialog라 네이티브 복귀는 사라진 요소를 가리키고, 열린 modal 안에서 부르면 바깥 버튼이 inert라 무시된다.
  // 그래서 dialog가 DOM에서 빠진 뒤(effect)에 한다.
  useEffect(() => {
    if (adding) wasAdding.current = true;
    else if (wasAdding.current) {
      wasAdding.current = false;
      addBtnRef.current?.focus();
    }
  }, [adding]);

  const writeUrl = useCallback(
    (next: GamesQueryState, mode: 'push' | 'replace') => {
      const qs = serializeQueryState(next);
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (mode === 'push') window.history.pushState(null, '', url);
      else window.history.replaceState(null, '', url);
    },
    [pathname],
  );

  const change = (patch: Partial<GamesQueryState>) => writeUrl(applyFilterChange(state, patch), 'push');

  // 페이지를 바꾸면 목록 위 결과 요약 줄로 스크롤·포커스를 옮긴다. 누른 버튼이 disabled가 되거나
  // 목록 아래에 포커스가 남아 키보드·스크린리더 사용자가 처음부터 다시 탭하지 않도록.
  const goPage = (n: number) => {
    writeUrl({ ...state, page: n }, 'push');
    topRef.current?.scrollIntoView({ block: 'start' });
    topRef.current?.focus({ preventScroll: true });
  };

  const detailUrl = (id: string | null) => {
    const qs = detailQuery(state, id);
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const onOpen = (game: BoardGame, trigger: HTMLButtonElement, edit = false) => {
    triggerRef.current = trigger;
    setEditFor(edit ? game.id : null);
    window.history.pushState({ [DETAIL_ENTRY]: true }, '', detailUrl(game.id));
  };

  // ---- 관리자 동작 ----
  const applyRecord = (rec: GameRecord) =>
    setRecords((prev) => (prev.some((r) => r.id === rec.id) ? prev.map((r) => (r.id === rec.id ? rec : r)) : [...prev, rec]));

  const onSaved = (rec: GameRecord, created: boolean) => {
    applyRecord(rec);
    if (created) setAdding(false);
    showToast(created ? addedMessage(rec.name) : savedMessage(rec.name));
    router.refresh();
  };

  // 숨김/다시 보이기. 실패하면 사용자에게 보일 문구를 돌려준다.
  const toggleHidden = async (game: AdminGame | BoardGame, hidden: boolean): Promise<string | null> => {
    const res = await adminApi.setHidden(game.id, hidden);
    if (res.status !== 200 || !isWrite(res.body)) {
      return res.status === 401
        ? '로그인이 만료됐어요. 새로 고친 뒤 다시 로그인해 주세요.'
        : errorMessage(res.body, '잠시 후 다시 시도해 주세요.');
    }
    applyRecord(res.body.game);
    router.refresh();
    if (hidden) {
      showToast(hiddenMessage(game.name), {
        label: '되돌리기',
        run: () => {
          // 누른 버튼은 곧 사라진다. 포커스를 결과 요약 줄(다시 나타날 카드 바로 위)로 옮겨 둔다
          topRef.current?.focus({ preventScroll: true });
          void toggleHidden(game, false).then((m) => m !== null && showToast(m));
        },
      });
    } else {
      showToast(unhiddenMessage(game.name));
    }
    return null;
  };

  const adminDetail: AdminDetailContext | null = isAdmin
    ? {
        all: records,
        startInEdit: openGame !== undefined && editFor === openGame.id,
        onRecord: applyRecord,
        onSaved,
        onToggleHidden: async (game, hidden) => {
          const message = await toggleHidden(game, hidden);
          if (message === null && hidden) {
            focusUndoRef.current = true;
            onClose();
          }
          return message;
        },
        toast: <Toast toast={toast} onDismiss={dismissToast} onHold={setToastHeld} />,
      }
    : null;

  const dialogOpen = openGame !== undefined || adding;

  const onClose = () => {
    // 이 페이지에서 쌓은 기록(앞으로가기로 돌아온 경우 포함)이면 back, 링크로 바로 들어왔으면 replace.
    if (window.history.state?.[DETAIL_ENTRY] === true) window.history.back();
    else window.history.replaceState(null, '', detailUrl(null));
  };

  const yearOptions = yearFilterOptions(years, state.year);

  const active = hasActiveFilter(state);

  return (
    <>
      {isAdmin && (
        <div className={styles.adminSlot}>
          <AdminBar
            showHidden={showHidden}
            hiddenCount={hiddenCount}
            onShowHidden={setShowHidden}
            onAdd={() => setAdding(true)}
            addRef={addBtnRef}
          />
        </div>
      )}

      <section className={styles.header} aria-labelledby="games-title">
        <div className={styles.headerText}>
          <SectionLabel style={{ marginBottom: 0 }}>EXPEDITION LOG</SectionLabel>
          <h1 id="games-title" className={styles.title}>플레이한 게임</h1>
          <p className={styles.lead}>야시로가 방송에서 탐험한 게임 행성들의 기록이에요.</p>
        </div>
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>기록된 게임</dt>
            <dd>{stats.total}</dd>
          </div>
          <div className={styles.stat}>
            <dt>정복</dt>
            <dd className={styles.statClear}>{stats.clear}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.controls} aria-label="검색과 필터">
        <div className={`${styles.field} ${styles.fieldSearch}`}>
          <label htmlFor="game-q" className={`${styles.label} ${styles.labelHideMobile}`}>게임 검색</label>
          <div className={styles.search}>
            <Search size={18} strokeWidth={1.8} aria-hidden="true" />
            <input
              id="game-q"
              type="search"
              className={styles.searchInput}
              value={typed}
              maxLength={Q_MAX}
              placeholder="한글·원제·초성"
              onChange={(e) => {
                setTyped(e.target.value);
                writeUrl(applyFilterChange(state, { q: normalizeQ(e.target.value) }), 'replace');
              }}
            />
          </div>
        </div>

        <div className={styles.field}>
          <span id="status-label" className={styles.label}>정복 여부</span>
          <div role="group" aria-labelledby="status-label" className={styles.segment}>
            {STATUS_FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                className={styles.segBtn}
                aria-pressed={state.status === key}
                onClick={() => change({ status: key })}
              >
                {STATUS_FILTER_LABEL[key]}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.selects}>
          <div className={styles.field}>
            <label htmlFor="game-year" className={styles.label}>첫 플레이 연도</label>
            <select
              id="game-year"
              className={`${styles.select} ${styles.selectYear}`}
              value={state.year}
              onChange={(e) => change({ year: parseYearFilter(e.target.value) })}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{yearLabel(y)}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="game-sort" className={styles.label}>정렬</label>
            <select
              id="game-sort"
              className={`${styles.select} ${styles.selectSort}`}
              value={state.sort}
              onChange={(e) => change({ sort: parseSortKey(e.target.value) })}
            >
              {SORT_KEYS.map((key) => (
                <option key={key} value={key}>{SORT_LABEL[key]}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div ref={topRef} tabIndex={-1} className={styles.statusRow}>
        <p role="status" className={styles.status}>
          {resultSummary(page)} · 정복 도장은 확인된 게임에만 찍어요.
        </p>
        {active && (
          <button type="button" className={styles.linkBtn} onClick={() => change({ q: '', status: 'all', year: 'all' })}>
            검색·필터 초기화
          </button>
        )}
      </div>

      {page.total > 0 ? (
        <>
          <ul className={styles.grid}>
            {page.items.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onOpen={onOpen}
                admin={
                  isAdmin
                    ? {
                        onEdit: (g, trigger) => onOpen(g, trigger, true),
                        onUnhide: (g) =>
                          void toggleHidden(g, false).then((m) => m !== null && showToast(m)),
                      }
                    : undefined
                }
              />
            ))}
          </ul>
          <Pagination
            page={page.page}
            pageCount={page.pageCount}
            rangeText={`${page.page} / ${page.pageCount} 페이지`}
            onGo={goPage}
          />
        </>
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>현재 조건에 맞는 게임이 없어요</p>
          <p className={styles.emptyDesc}>{describeConditions(state)}</p>
          <div className={styles.emptyActions}>
            {state.q !== '' && (
              <button type="button" className={styles.solidBtn} onClick={() => change({ q: '' })}>
                검색어 지우기
              </button>
            )}
            {hasFilterSelection(state) && (
              <button type="button" className={state.q !== '' ? styles.ghostBtn : styles.solidBtn} onClick={() => change({ status: 'all', year: 'all' })}>
                필터 해제
              </button>
            )}
          </div>
        </div>
      )}

      <p className={styles.footnote}>
        게임 이름과 포스터는 치지직 카테고리 정보를 따릅니다. 비공식 팬 사이트의 기록이라 빠진 게임이 있을 수 있어요.
      </p>

      {openGame && <GameDetailDialog key={openGame.id} game={openGame} admin={adminDetail} onClose={onClose} />}
      {isAdmin && adding && (
        <AddGameFlow
          all={records}
          toast={<Toast toast={toast} onDismiss={dismissToast} onHold={setToastHeld} />}
          onRecord={applyRecord}
          onSaved={onSaved}
          onClose={() => setAdding(false)}
        />
      )}
      {isAdmin && (
        <Toast toast={dialogOpen ? null : toast} onDismiss={dismissToast} onHold={setToastHeld} actionRef={toastActionRef} />
      )}
    </>
  );
}
