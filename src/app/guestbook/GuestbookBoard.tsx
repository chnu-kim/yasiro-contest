'use client';

import { useState, useTransition } from 'react';
import styles from './page.module.css';
import { getPostItStyle } from '@/lib/guestbook';

interface Note {
  id: string;
  message: string;
  channel_name: string;
  created_at: number;
}

const POST_IT_COLORS = [
  { bg: '#FFF176', shadow: 'rgba(251,192,45,0.35)' },   // 노랑
  { bg: '#F8BBD0', shadow: 'rgba(233,30,99,0.25)' },    // 핑크
  { bg: '#B3E5FC', shadow: 'rgba(3,169,244,0.25)' },    // 파랑
  { bg: '#C8E6C9', shadow: 'rgba(76,175,80,0.25)' },    // 초록
  { bg: '#E1BEE7', shadow: 'rgba(156,39,176,0.25)' },   // 보라
];

function PostIt({ note }: { note: Note }) {
  const { colorIndex, rotation } = getPostItStyle(note.id);
  const color = POST_IT_COLORS[colorIndex];

  return (
    <div
      className={styles.postit}
      style={{
        background: color.bg,
        transform: `rotate(${rotation}deg)`,
        boxShadow: `3px 4px 12px ${color.shadow}`,
      }}
    >
      <p className={styles.postitMessage}>{note.message}</p>
      <p className={styles.postitAuthor}>— {note.channel_name}</p>
    </div>
  );
}

interface Props {
  initialNotes: Note[];
  user: { channelName: string } | null;
}

export default function GuestbookBoard({ initialNotes, user }: Props) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const remaining = 200 - message.length;

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
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500, letterSpacing: '0.07em', fontFamily: "'Cinzel', serif" }}>GUESTBOOK</span>
        </div>
        <h1 className={styles.title}>야시로에게 한마디</h1>
        <p className={styles.subtitle}>포스트잇에 담아 보드에 붙여두세요</p>
      </header>

      {user ? (
        <div className={styles.formWrap}>
          <div className={styles.formPostit}>
            <textarea
              className={styles.textarea}
              placeholder="야시로에게 하고 싶은 말을 적어주세요..."
              value={message}
              onChange={(e) => {
                if (e.target.value.length <= 200) setMessage(e.target.value);
              }}
              rows={5}
              disabled={isPending}
            />
            <div className={styles.formFooter}>
              {error && <span className={styles.errorMsg}>{error}</span>}
              <span className={styles.counter} style={{ color: remaining < 20 ? '#e53935' : undefined }}>
                {remaining}자 남음
              </span>
              <span className={styles.formAuthor}>— {user.channelName}</span>
              <button
                className={styles.submitBtn}
                onClick={submit}
                disabled={isPending || !message.trim()}
              >
                {isPending ? '붙이는 중...' : '보드에 붙이기'}
              </button>
            </div>
          </div>
        </div>
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

      <div className={styles.divider}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, background: 'var(--accent)', borderRadius: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.07em' }}>{notes.length}개의 메모</span>
        </div>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      {notes.length === 0 ? (
        <p className={styles.empty}>아직 남겨진 메모가 없어요. 첫 번째로 한마디 남겨보세요!</p>
      ) : (
        <div className={styles.board}>
          {notes.map((note) => (
            <PostIt key={note.id} note={note} />
          ))}
        </div>
      )}
    </main>
  );
}
