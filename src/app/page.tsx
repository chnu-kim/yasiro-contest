import Image from 'next/image';
import styles from './page.module.css';
import PostIt from '@/components/PostIt';

interface GuestbookRow {
  id: string;
  message: string;
  channel_name: string;
}

const ENTRIES: { href: string; kicker: string; title: string; desc: string }[] = [
  { href: '/about', kicker: 'ABOUT', title: '야시로 소개', desc: '프로필 · 주요 콘텐츠 · 채널' },
  { href: '/to-yasiro', kicker: 'TO YASHIRO', title: '야시로에게', desc: '팬들이 남긴 한마디' },
];

async function getRecentNotes(): Promise<GuestbookRow[]> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext({ async: true });
    const result = await env.DB
      .prepare('SELECT id, message, channel_name FROM guestbook ORDER BY created_at DESC LIMIT 8')
      .all<GuestbookRow>();
    return result.results;
  } catch {
    return [];
  }
}

export default async function Home() {
  const notes = await getRecentNotes();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>

      {/* ══ HERO ══ */}
      <section className={styles.heroSection} aria-labelledby="hero-title">
        {/* Left */}
        <div className={styles.heroLeft}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid var(--accent)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 24,
              background: 'var(--accent-bg)',
              width: 'fit-content',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                background: 'var(--accent)',
                display: 'inline-block',
                borderRadius: 1,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 12,
                color: 'var(--accent)',
                fontWeight: 500,
                letterSpacing: '0.07em',
              }}
            >
              고등어 통조림 애호가
            </span>
          </div>

          <h1
            id="hero-title"
            style={{
              fontFamily: "'Jua', sans-serif",
              fontSize: 'clamp(52px, 14vw, 100px)',
              fontWeight: 400,
              lineHeight: 0.95,
              color: 'var(--text)',
              marginBottom: 20,
              letterSpacing: '0em',
            }}
          >
            야시로
          </h1>

          <div
            style={{
              width: 48,
              height: 3,
              background: 'var(--accent)',
              borderRadius: 2,
              marginBottom: 24,
            }}
          />

          <p
            style={{
              fontSize: 15,
              color: 'var(--text-dim)',
              lineHeight: 2,
              marginBottom: 40,
              maxWidth: 360,
              fontWeight: 300,
              wordBreak: 'keep-all',
            }}
          >
            호기심 많은 탐험가, 벌꿀오소리 야시로
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a
              href="https://chzzk.naver.com/live/d6e680f5b17eba0b078f978dd722c0f3"
              target="_blank"
              rel="noreferrer"
              className={styles.heroBtnPrimary}
              aria-label="야시로 방송 입장하기 (새 탭에서 열림)"
            >
              방송 입장하기
            </a>
          </div>
        </div>

        {/* Right: Character Panel */}
        <div className={styles.heroCharPanel}>
          <Image
            src="/yashiro1.png"
            alt="스팀펑크 고글을 쓴 야시로 캐릭터 전신 일러스트"
            fill
            sizes="50vw"
            priority
            style={{ objectFit: 'contain', objectPosition: 'bottom center' }}
          />

          {/* 꿀붕이 */}
          <div
            style={{
              position: 'absolute',
              bottom: 24,
              right: 28,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              animation: 'float 3.5s ease-in-out infinite',
              animationDelay: '0.5s',
              zIndex: 1,
            }}
          >
            <Image
              src="/kkul.png"
              alt="꿀붕이"
              width={104}
              height={104}
              style={{ objectFit: 'contain' }}
            />
          </div>
        </div>
      </section>

      {/* ══ 바로가기 ══ */}
      <nav className={styles.cardsSection} aria-label="출품작 바로가기">
        <ul className={styles.cardList}>
          {ENTRIES.map((entry) => (
            <li key={entry.href}>
              <a href={entry.href} className={styles.entryCard}>
                <span
                  style={{
                    fontFamily: "'Fredoka', sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--accent)',
                    letterSpacing: '0.12em',
                  }}
                >
                  {entry.kicker}
                </span>
                <span style={{ fontFamily: "'Jua', sans-serif", fontSize: 30, lineHeight: 1.2 }}>
                  {entry.title}
                </span>
                <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>{entry.desc}</span>
                <span className={styles.entryArrow} aria-hidden="true">→</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ══ 한마디 보드 ══ */}
      {notes.length > 0 && (
        <section className={styles.notesSection} aria-label="야시로에게 남긴 한마디 보드">
          <div className={styles.notesSectionHeader}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 7, height: 7, background: 'var(--accent)', borderRadius: 1 }} />
              <span style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.07em', fontFamily: "'Noto Sans KR', sans-serif" }}>야시로에게</span>
            </div>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <div className={styles.notesBoard}>
            {notes.map((note) => (
              <PostIt
                key={note.id}
                id={note.id}
                message={note.message}
                channelName={note.channel_name}
                size="sm"
              />
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <a href="/to-yasiro" className={styles.moreBtn}>
              더 보기 →
            </a>
          </div>
        </section>
      )}

      {/* ══ FOOTER ══ */}
      <footer
        className={styles.footer}
        style={{
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              fontFamily: "'Comfortaa', sans-serif",
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '0.08em',
            }}
          >
            YASIRO
          </span>
          <Image
            src="/kkul.png"
            alt="꿀붕이"
            width={30}
            height={30}
            className={styles.footerLogoImg}
            style={{ objectFit: 'contain' }}
          />
        </div>
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-dim)',
            fontWeight: 300,
            letterSpacing: '0.03em',
          }}
        >
          © 2026 야시로 · All rights reserved
        </span>
      </footer>
    </div>
  );
}

