'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { errorMessage } from '@/lib/games/client';
import type { CategorySearchItem, CategorySearchResponse } from '@/lib/games/types';
import { adminApi } from './adminApi';
import styles from './CategoryPicker.module.css';

type Phase = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'done'; searched: string; results: CategorySearchItem[] };

function isResponse(v: unknown): v is CategorySearchResponse {
  return typeof v === 'object' && v !== null && Array.isArray((v as CategorySearchResponse).results);
}

// 치지직 카테고리 검색 + 라디오 카드 선택. 게임 추가 1단계와 수정 모드의 "다른 카테고리 찾기"가 같이 쓴다.
// selfId: 수정 중인 게임 id. 이 게임이 이미 가진 카테고리는 "이미 목록에 있어요"로 막지 않는다.
export default function CategoryPicker({
  query,
  onQueryChange,
  selfId,
  selected,
  onSelect,
  inputId,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  selfId: string | null;
  selected: CategorySearchItem | null;
  onSelect: (item: CategorySearchItem) => void;
  inputId: string;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const seq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const search = async () => {
    const q = query.trim();
    if (q === '') {
      setPhase({ kind: 'error', message: '게임 이름을 입력해 주세요.' });
      inputRef.current?.focus();
      return;
    }
    const mine = ++seq.current;
    setPhase({ kind: 'loading' });
    const res = await adminApi.categories(q);
    if (mine !== seq.current) return;
    if (res.status === 200 && isResponse(res.body)) setPhase({ kind: 'done', searched: q, results: res.body.results });
    else if (res.status === 401) setPhase({ kind: 'error', message: '로그인이 만료됐어요. 새로 고친 뒤 다시 로그인해 주세요.' });
    else setPhase({ kind: 'error', message: errorMessage(res.body, '치지직 검색이 잠시 안 돼요.') });
  };

  const results = phase.kind === 'done' ? phase.results : [];

  return (
    <div className={styles.picker}>
      <form
        className={styles.searchBlock}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label htmlFor={inputId} className={styles.label}>게임 이름</label>
        <div className={styles.searchRow}>
          <div className={styles.search}>
            <Search size={18} strokeWidth={1.8} aria-hidden="true" />
            <input
              ref={inputRef}
              id={inputId}
              type="search"
              className={styles.searchInput}
              value={query}
              maxLength={50}
              aria-describedby={`${inputId}-hint`}
              onChange={(e) => onQueryChange(e.target.value)}
            />
          </div>
          <button type="submit" className={styles.searchBtn} disabled={phase.kind === 'loading'}>검색</button>
        </div>
        <p id={`${inputId}-hint`} className={styles.hint}>치지직은 한글 이름으로 검색돼요. 영문 원제로는 잘 안 나와요.</p>
      </form>

      <p role="status" className={styles.statusLine}>
        {phase.kind === 'loading' && '찾는 중…'}
        {phase.kind === 'done' && (results.length === 0 ? `“${phase.searched}” 결과가 없어요. 다른 이름으로 찾아 보세요.` : `검색 결과 ${results.length}개`)}
      </p>
      {phase.kind === 'error' && <p role="alert" className={styles.error}>{phase.message}</p>}

      {results.length > 0 && (
        <fieldset className={styles.results}>
          <legend className={styles.srOnly}>검색 결과</legend>
          <div className={styles.grid}>
            {results.map((r) => {
              const taken = r.taken !== null && r.taken.id !== selfId;
              const checked = selected?.categoryId === r.categoryId;
              return (
                <label key={r.categoryId} className={`${styles.card} ${checked ? styles.cardOn : ''} ${taken ? styles.cardTaken : ''}`}>
                  <input
                    type="radio"
                    name={`${inputId}-cat`}
                    className={styles.radio}
                    checked={checked}
                    disabled={taken}
                    onChange={() => onSelect(r)}
                  />
                  <span className={styles.cover} aria-hidden="true">
                    {r.posterUrl !== null && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.posterUrl} alt="" width={300} height={400} loading="lazy" referrerPolicy="no-referrer" className={styles.img} />
                    )}
                  </span>
                  <span className={styles.value}>{r.name}</span>
                  <span className={styles.cid}>{r.categoryId}</span>
                  {taken && <span className={styles.takenNote}>이미 목록에 있어요{r.taken?.hidden ? ' (숨김)' : ''}</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}
