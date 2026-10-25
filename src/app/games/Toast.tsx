'use client';

import { useId, type Ref } from 'react';
import { Check } from 'lucide-react';
import styles from './Toast.module.css';

export interface ToastState {
  /** 같은 문구가 연달아 와도 다시 읽히고 타이머가 새로 시작하도록 하는 번호 */
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

// 알림 영역(role="status")은 항상 렌더링해 두고 안의 내용만 바꾼다. 새로 끼워 넣은 live region은 읽히지 않을 때가 많다.
// onHold: 마우스가 올라가 있거나 포커스가 안에 있는 동안 true. 그동안은 자동으로 사라지지 않는다(되돌리기를 누를 시간).
export default function Toast({
  toast,
  onDismiss,
  onHold,
  actionRef,
}: {
  toast: ToastState | null;
  onDismiss: () => void;
  onHold?: (held: boolean) => void;
  actionRef?: Ref<HTMLButtonElement>;
}) {
  const msgId = useId();
  return (
    <div className={styles.wrap}>
      <div role="status" className={styles.live}>
        {toast && (
          <div
            key={toast.id}
            className={toast.action ? `${styles.toast} ${styles.withAction}` : styles.toast}
            onMouseEnter={() => onHold?.(true)}
            onMouseLeave={() => onHold?.(false)}
            onFocus={() => onHold?.(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onHold?.(false);
            }}
          >
            {!toast.action && <Check size={20} strokeWidth={2} aria-hidden="true" className={styles.icon} />}
            <span id={msgId} className={styles.msg}>{toast.message}</span>
            {toast.action && (
              <button
                ref={actionRef}
                type="button"
                // 포커스가 이 버튼으로 옮겨질 때 무엇을 되돌리는지 같이 읽힌다
                aria-describedby={msgId}
                className={styles.action}
                onClick={() => {
                  onHold?.(false);
                  toast.action?.run();
                  onDismiss();
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
