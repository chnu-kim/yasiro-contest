'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import SectionLabel from '@/components/SectionLabel';
import {
  applyFilterChange,
  availableYears,
  countStats,
  indexGames,
  normalizeQ,
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
import type { Game, GamesQueryState, IndexedGame } from '@/lib/games/types';
import GameCard from './GameCard';
import GameDetailDialog from './GameDetailDialog';
import Pagination from './Pagination';
import styles from './page.module.css';

// 목록 상태(q, status, year, sort, page)의 정본은 URL이다. useSearchParams로 읽고
// history.pushState/replaceState로 쓴다(Next가 둘을 라우터와 동기화한다).
// 검색 입력은 타이핑마다 replaceState(히스토리 오염 방지), 필터·정렬·페이지는 pushState.
export default function GamesBoard({ games }: { games: Game[] }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const state = useMemo(() => parseQueryState(searchParams), [searchParams]);
  const indexed = useMemo(() => indexGames(games), [games]);
  const stats = useMemo(() => countStats(games), [games]);
  const years = useMemo(() => availableYears(games), [games]);
  const page = useMemo(() => selectPage(indexed, state), [indexed, state]);

  // 입력 중인 값(공백 포함)은 로컬로 들고, URL이 바깥에서 바뀌면(뒤로가기·초기화) 따라간다.
  const [typed, setTyped] = useState(state.q);
  const [syncedQ, setSyncedQ] = useState(state.q);
  if (state.q !== syncedQ) {
    setSyncedQ(state.q);
    if (normalizeQ(typed) !== state.q) setTyped(state.q);
  }

  // 상세는 연 시점의 URL에 묶인다. 뒤로가기·앞으로가기로 URL이 바뀌면 닫는다(렌더 중 동기화).
  const qs = searchParams.toString();
  const [open, setOpen] = useState<{ id: string; qs: string } | null>(null);
  if (open !== null && open.qs !== qs) setOpen(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const openGame: IndexedGame | undefined = open === null ? undefined : indexed.find((g) => g.id === open.id);

  // 닫힌 뒤(닫기 버튼·Esc·배경 클릭·URL 변경 모두) 포커스를 연 카드로 돌린다.
  // 카드가 목록에서 사라졌으면 결과 요약 줄로 보낸다.
  useEffect(() => {
    if (open !== null) return;
    const trigger = triggerRef.current;
    if (trigger === null) return;
    triggerRef.current = null;
    if (trigger.isConnected) trigger.focus();
    else topRef.current?.focus({ preventScroll: true });
  }, [open]);

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

  const onOpen = (game: IndexedGame, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setOpen({ id: game.id, qs });
  };

  const onClose = () => setOpen(null);

  const yearOptions = yearFilterOptions(years, state.year);

  const active = hasActiveFilter(state);

  return (
    <>
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
              <GameCard key={game.id} game={game} onOpen={onOpen} />
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

      {openGame && <GameDetailDialog key={openGame.id} game={openGame} onClose={onClose} />}
    </>
  );
}
