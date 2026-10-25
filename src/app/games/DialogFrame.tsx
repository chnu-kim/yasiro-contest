'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from './DialogFrame.module.css';

// 네이티브 <dialog>. showModal이 Esc, 포커스 가둠(나머지 inert), ::backdrop을 맡는다.
// 배경 스크롤 잠금은 열려 있는 동안만 body에 건다. 닫은 뒤 포커스 복귀는 호출한 쪽(onClose)이 한다.
// showModal은 layout effect에서 부른다. 자식의 useEffect(첫 입력칸 focus 등)는 부모 layout effect 뒤에 돌므로,
// 그때는 이미 열려 있어 focus가 먹힌다(useEffect면 닫힌 dialog에 focus → 무시 → showModal이 '닫기'로 보낸다).
// intercept: Esc·배경 클릭·닫기 버튼으로 닫으려 할 때 먼저 불린다. true를 돌려주면 닫지 않는다
// (수정 중인 내용이 사라지지 않게 확인을 거치는 용도).
export default function DialogFrame({
  labelledBy,
  onClose,
  intercept,
  wide = false,
  toast,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  intercept?: () => boolean;
  wide?: boolean;
  /** 모달 위에 떠야 하는 알림(top layer 아래로 가려지지 않게 dialog 안에 둔다) */
  toast?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
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

  const requestClose = () => {
    if (intercept?.()) return;
    ref.current?.close();
  };

  return (
    <dialog
      ref={ref}
      className={wide ? `${styles.dialog} ${styles.wide}` : styles.dialog}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onCancel={(e) => {
        if (intercept?.()) e.preventDefault();
      }}
      // ::backdrop 클릭은 dialog 자신이 target이다(내용은 안쪽 요소가 감싼다)
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      {/* 닫기는 스크롤 영역 밖에 두어 내용이 길어도 항상 보인다 */}
      <button type="button" className={styles.close} aria-label="닫기" onClick={requestClose}>
        <X size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {children}
      {toast}
    </dialog>
  );
}
