'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import styles from './page.module.css';
import PostIt from '@/components/PostIt';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const remaining = 200 - message.length;

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          border: '1px solid var(--accent)', padding: '6px 14px',
          borderRadius: 1, background: 'var(--accent-bg)', marginBottom: 16,
        }}>
          <span style={{ width: 7, height: 7, background: 'var(--accent)', display: 'inline-block', borderRadius: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500, letterSpacing: '0.07em', fontFamily: "'Cinzel', serif" }}>TO YASHIRO</span>
        </div>
        <h1 className={styles.title}>야시로에게</h1>
        <p className={styles.subtitle}>팬들이 야시로에게 남긴 한마디</p>
      </header>

      {notes.length === 0 ? (
        <p className={styles.empty}>아직 남겨진 메모가 없어요. 첫 번째로 한마디 남겨보세요!</p>
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

      {/* ─── 플로팅 버튼 ─── */}
      <button
        className={styles.fab}
        onClick={() => setOpen(true)}
        title="한마디 남기기"
        aria-label="한마디 남기기"
      >
        ✏️
        <span className={styles.fabLabel}>한마디 남기기</span>
      </button>

      {/* ─── 작성 모달 ─── */}
      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div
              className={styles.modal}
              role="dialog"
              aria-modal="true"
              aria-label={user ? '야시로에게 한마디 작성' : '로그인 필요'}
              onClick={(e) => e.stopPropagation()}
            >
            {user ? (
              <>
                <div className={styles.modalPin} aria-hidden="true" />
                <button
                  className={styles.modalClose}
                  onClick={() => setOpen(false)}
                  aria-label="모달 닫기"
                >
                  ×
                </button>
                <p className={styles.modalTitle} aria-hidden="true">야시로에게 한마디</p>
                <textarea
                  ref={textareaRef}
                  className={styles.textarea}
                  placeholder="야시로에게 하고 싶은 말을 적어주세요..."
                  value={message}
                  onChange={(e) => { if (e.target.value.length <= 200) setMessage(e.target.value); }}
                  rows={5}
                  disabled={isPending}
                />
                <div className={styles.modalFooter}>
                  {error && <span className={styles.errorMsg}>{error}</span>}
                  <span
                    className={styles.counter}
                    style={{ color: remaining < 20 ? '#e53935' : undefined }}
                  >
                    {remaining}자 남음
                  </span>
                  <span className={styles.formAuthor}>— {user.channelName}</span>
                  <div className={styles.modalActions}>
                    <button className={styles.cancelBtn} onClick={() => setOpen(false)}>취소</button>
                    <button
                      className={styles.submitBtn}
                      onClick={submit}
                      disabled={isPending || !message.trim()}
                    >
                      {isPending ? '붙이는 중...' : '보드에 붙이기'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.loginPrompt}>
                <p style={{ fontFamily: "'Gaegu', cursive", fontSize: 20, color: 'var(--text-dim)', marginBottom: 16 }}>
                  치지직 닉네임으로 한마디 남겨보세요 ✏️
                </p>
                <a href="/auth/login" className={styles.loginBtn}>
                  치지직으로 로그인
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
