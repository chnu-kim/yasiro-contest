'use client';

import { useState, useTransition, useEffect, useRef, type CSSProperties } from 'react';
import styles from './page.module.css';
import PostIt from '@/components/PostIt';
import Button from '@/components/Button';
import TapeStrip from '@/components/TapeStrip';
import { PenIcon } from '@/components/icons';

interface Note {
  id: string;
  message: string;
  channel_name: string;
  created_at: number;
}

interface Props {
  initialNotes: Note[];
  user: { channelName: string } | null;
}

export default function GuestbookBoard({ initialNotes, user }: Props) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const remaining = 200 - message.length;

  // 네이티브 <dialog>.showModal(): 포커스 가두기, 배경 inert, Esc 닫기, 닫힌 뒤 트리거로 포커스 복귀를 브라우저가 맡는다
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      textareaRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const submit = () => {
    if (!message.trim()) return;
    setError('');

    startTransition(async () => {
      const res = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json() as { id?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? '오류가 발생했습니다.');
        return;
      }

      const newNote: Note = {
        id: data.id!,
        message: message.trim(),
        channel_name: user!.channelName,
        created_at: Math.floor(Date.now() / 1000),
      };
      setNotes((prev) => [newNote, ...prev]);
      setMessage('');
      setOpen(false);
    });
  };

  // 비로그인이면 작성 모달 대신 바로 로그인으로 보낸다
  const writeCta = (style?: CSSProperties) =>
    user ? (
      <Button size="lg" icon={<PenIcon size={18} />} onClick={() => setOpen(true)} style={style}>
        한마디 남기기
      </Button>
    ) : (
      <Button size="lg" href="/auth/login" icon={<PenIcon size={18} />} style={style}>
        치지직으로 로그인하고 남기기
      </Button>
    );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>야시로에게</h1>
        <p className={styles.subtitle}>팬들이 야시로에게 남긴 한마디</p>
      </header>

      {notes.length === 0 ? (
        <section className={styles.empty} aria-labelledby="empty-title">
          <TapeStrip rotate={-3} style={{ position: 'absolute', top: -11, left: '50%', marginLeft: -36 }} />
          <div className={styles.mascot} aria-hidden="true" />
          <div className={styles.emptyBody}>
            <h2 id="empty-title" className={styles.emptyTitle}>첫 한마디를 기다리고 있어요</h2>
            <p className={styles.emptyText}>
              {user
                ? '야시로에게 하고 싶은 말을 남겨 보세요.'
                : '치지직으로 로그인하면 한마디를 남길 수 있어요.'}
            </p>
            {writeCta()}
          </div>
        </section>
      ) : (
        <section className={styles.board} aria-label="팬 한마디 목록">
          {notes.map((note) => (
            <PostIt
              key={note.id}
              id={note.id}
              message={note.message}
              channelName={note.channel_name}
            />
          ))}
        </section>
      )}

      {/* ─── 고정 버튼: 페이지당 하나. 빈 상태에서는 인라인 CTA가 대신한다 ─── */}
      {notes.length > 0 &&
        writeCta({
          position: 'fixed',
          right: 'var(--gutter)',
          bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          zIndex: 'var(--z-fab)',
        })}

      {/* ─── 작성 모달(로그인한 경우만) ─── */}
      {user && (
        <dialog
          ref={dialogRef}
          className={styles.modal}
          aria-labelledby="write-title"
          onClose={() => setOpen(false)}
          // 바깥(::backdrop) 클릭: 안쪽 .modalInner가 dialog를 꽉 채우므로 target이 dialog 자체면 바깥이다
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className={styles.modalInner}>
            <div className={styles.modalPin} aria-hidden="true" />
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setOpen(false)}
              aria-label="닫기"
            >
              <span aria-hidden="true">×</span>
            </button>
            <h2 id="write-title" className={styles.modalTitle}>야시로에게 한마디</h2>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              aria-label="한마디 내용"
              aria-describedby="write-counter"
              placeholder="야시로에게 하고 싶은 말을 적어주세요..."
              value={message}
              onChange={(e) => { if (e.target.value.length <= 200) setMessage(e.target.value); }}
              rows={5}
              disabled={isPending}
            />
            <div className={styles.modalFooter}>
              {error && <span className={styles.errorMsg} role="alert">{error}</span>}
              <span
                id="write-counter"
                className={`${styles.counter} ${remaining < 20 ? styles.counterWarn : ''}`}
              >
                {remaining}자 남음
              </span>
              <span className={styles.formAuthor}>— {user.channelName}</span>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setOpen(false)}>취소</button>
                <button
                  type="button"
                  className={styles.submitBtn}
                  onClick={submit}
                  disabled={isPending || !message.trim()}
                >
                  {isPending ? '붙이는 중...' : '보드에 붙이기'}
                </button>
              </div>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
