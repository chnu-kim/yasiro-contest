'use client';

import type { Ref } from 'react';
import { Pencil, Plus } from 'lucide-react';
import styles from './AdminBar.module.css';

// 목록 위 "관리자 모드" 띠. 시안: Main
export default function AdminBar({
  showHidden,
  hiddenCount,
  onShowHidden,
  onAdd,
  addRef,
}: {
  showHidden: boolean;
  hiddenCount: number;
  onShowHidden: (on: boolean) => void;
  onAdd: () => void;
  addRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <section className={styles.bar} aria-label="관리자 도구">
      <p className={styles.note}>
        <Pencil size={18} strokeWidth={1.8} aria-hidden="true" className={styles.noteIcon} />
        <span>
          <strong>관리자 모드</strong>
          <span className={styles.hoverHint}> · 카드에 마우스를 올리면 수정 버튼이 나와요.</span>
          <span className={styles.touchHint}> · 카드를 열어 아래쪽에서 수정해요.</span>
        </span>
      </p>
      <div className={styles.actions}>
        <label className={styles.check}>
          <input type="checkbox" checked={showHidden} onChange={(e) => onShowHidden(e.target.checked)} />
          <span>
            숨긴 게임 보기 <span className={styles.count}>{hiddenCount}</span>
          </span>
        </label>
        <button ref={addRef} type="button" className={styles.add} onClick={onAdd}>
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
          게임 추가
        </button>
      </div>
    </section>
  );
}
