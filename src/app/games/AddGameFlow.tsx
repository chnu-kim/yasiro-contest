'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { gameToForm } from '@/lib/games/patch';
import type { CategorySearchItem, Game, GameForm, GameRecord } from '@/lib/games/types';
import CategoryPicker from './CategoryPicker';
import DialogFrame from './DialogFrame';
import GameEditForm, { type LeaveTo } from './GameEditForm';
import styles from './AddGameFlow.module.css';

// 게임 추가 2단계: 1단계(치지직 카테고리 찾기) → 2단계(빈 상세 모달의 수정 모드). id는 서버가 정한다. 시안: AddGame
export default function AddGameFlow({
  all,
  toast,
  onRecord,
  onSaved,
  onClose,
}: {
  all: readonly Game[];
  toast: ReactNode;
  onRecord: (record: GameRecord) => void;
  onSaved: (record: GameRecord, created: boolean) => void;
  onClose: () => void;
}) {
  const [seed, setSeed] = useState<GameForm | null>(null);
  return seed === null ? (
    <StepOne
      onNext={(s) => setSeed(s)}
      onClose={onClose}
      toast={toast}
    />
  ) : (
    <StepTwo seed={seed} all={all} toast={toast} onRecord={onRecord} onSaved={onSaved} onClose={onClose} />
  );
}

function StepOne({ onNext, onClose, toast }: { onNext: (seed: GameForm) => void; onClose: () => void; toast: ReactNode }) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CategorySearchItem | null>(null);

  const next = (item: CategorySearchItem | null) =>
    onNext({
      ...gameToForm(null),
      name: item?.name ?? query.trim(),
      category: item === null ? null : { categoryId: item.categoryId, posterUrl: item.posterUrl },
    });

  return (
    <DialogFrame labelledBy={titleId} onClose={onClose} wide toast={toast}>
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>게임 추가</h2>
        <ol aria-label="단계" className={styles.steps}>
          <li aria-current="step" className={styles.stepOn}>
            <span className={`${styles.stepNo} ${styles.stepNoOn}`}>1</span>치지직 카테고리 찾기
          </li>
          <li className={styles.stepOff}>
            <span className={styles.stepNo}>2</span>기록 입력
          </li>
        </ol>
      </div>
      <div className={styles.body}>
        <CategoryPicker inputId={`${uid}-q`} query={query} onQueryChange={setQuery} selfId={null} selected={selected} onSelect={setSelected} />
      </div>
      <div className={styles.foot}>
        <button type="button" className={styles.textBtn} onClick={() => next(null)}>
          치지직에 없어요 · 포스터 없이 추가
        </button>
        <div className={styles.footBtns}>
          <button type="button" className={styles.outline} onClick={onClose}>취소</button>
          <button type="button" className={styles.solid} disabled={selected === null} onClick={() => next(selected)}>
            다음 · 기록 입력
          </button>
        </div>
      </div>
    </DialogFrame>
  );
}

function StepTwo({
  seed,
  all,
  toast,
  onRecord,
  onSaved,
  onClose,
}: {
  seed: GameForm;
  all: readonly Game[];
  toast: ReactNode;
  onRecord: (record: GameRecord) => void;
  onSaved: (record: GameRecord, created: boolean) => void;
  onClose: () => void;
}) {
  const titleId = `${useId()}-title`;
  const leaveRef = useRef<((to: LeaveTo) => void) | null>(null);
  return (
    <DialogFrame
      labelledBy={titleId}
      onClose={onClose}
      toast={toast}
      intercept={() => {
        if (leaveRef.current === null) return false;
        leaveRef.current('close');
        return true;
      }}
    >
      <GameEditForm
        base={null}
        seed={seed}
        all={all}
        titleId={titleId}
        leaveRef={leaveRef}
        onRecord={onRecord}
        onSaved={onSaved}
        onLeave={() => onClose()}
      />
    </DialogFrame>
  );
}
