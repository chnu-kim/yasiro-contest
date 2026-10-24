import Image from 'next/image';
import styles from './page.module.css';
import PostIt from '@/components/PostIt';

interface GuestbookRow {
  id: string;
  message: string;
  channel_name: string;
}

const PROFILE: { label: string; value: string }[] = [
  { label: '나이', value: '20살 (지구 기준)' },
  { label: '생일', value: '3월 21일' },
  { label: '키', value: '149.8cm' },
  { label: 'MBTI', value: 'ISFJ' },
  { label: '종족', value: '벌꿀오소리' },
  { label: '직업', value: '호기심 많은 탐험가' },
  { label: '소속', value: '테라포레 (TERRAFORET)' },
];

const CHANNELS: { name: string; desc: string; href: string }[] = [
  { name: '치지직', desc: '라이브 방송', href: 'https://chzzk.naver.com/d6e680f5b17eba0b078f978dd722c0f3' },
  { name: '유튜브', desc: '@yasiro0321', href: 'https://www.youtube.com/@yasiro0321' },
  { name: '시로의 탐험일지', desc: '다시보기 유튜브', href: 'https://www.youtube.com/@시로의탐험일지' },
  { name: 'X', desc: '@yasiro__', href: 'https://x.com/yasiro__' },
  { name: '팬카페', desc: '방송 일정 공지', href: 'https://cafe.naver.com/terafore' },
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

          {/* 키 표시 */}
          <div
            style={{
              position: 'absolute',
              top: '5%',
              left: 0,
              right: 0,
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            <div style={{ flex: 1, height: 1, background: 'var(--accent)', opacity: 0.7 }} />
            <span
              style={{
                fontSize: 15,
                fontFamily: "'Fredoka', sans-serif",
                fontWeight: 600,
                color: 'var(--accent)',
                letterSpacing: '0.08em',
                padding: '0 10px',
                whiteSpace: 'nowrap',
              }}
            >
              149.8 cm
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--accent)', opacity: 0.7 }} />
          </div>

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

      {/* ══ 프로필 ══ */}
      <section className={styles.infoSection} aria-labelledby="profile-title">
        <div>
          <SectionLabel>PROFILE</SectionLabel>
          <h2 id="profile-title" style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 28, fontWeight: 700, marginBottom: 24 }}>
            탐험가 프로필
          </h2>
          <dl className={styles.profileList}>
            {PROFILE.map((item) => (
              <div key={item.label} style={{ display: 'contents' }}>
                <dt style={{ fontSize: 13, color: 'var(--text-dim)' }}>{item.label}</dt>
                <dd style={{ fontSize: 15, wordBreak: 'keep-all' }}>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <SectionLabel>CONTENTS</SectionLabel>
          <h2 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 28, fontWeight: 700, marginBottom: 24 }}>
            주요 콘텐츠
          </h2>
          <p
            style={{
              fontFamily: "'Gaegu', cursive",
              fontSize: 40,
              fontWeight: 700,
              color: 'var(--accent)',
              lineHeight: 1.2,
              marginBottom: 8,
            }}
          >
            종합게임
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.8, wordBreak: 'keep-all' }}>
            방송 일정은{' '}
            <a
              href="https://cafe.naver.com/terafore"
              target="_blank"
              rel="noreferrer"
              className={styles.inlineLink}
              aria-label="팬카페 (새 탭에서 열림)"
            >
              팬카페
            </a>
            에 공지됩니다.
          </p>
        </div>
      </section>

      {/* ══ 채널 ══ */}
      <section className={styles.channelSection} aria-labelledby="channel-title">
        <SectionLabel>CHANNELS</SectionLabel>
        <h2 id="channel-title" style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 28, fontWeight: 700, marginBottom: 24 }}>
          야시로 찾아가기
        </h2>
        <ul className={styles.channelList}>
          {CHANNELS.map((ch) => (
            <li key={ch.href}>
              <a
                href={ch.href}
                target="_blank"
                rel="noreferrer"
                className={styles.channelCard}
                aria-label={`${ch.name} ${ch.desc} (새 탭에서 열림)`}
              >
                <span style={{ fontSize: 16, fontWeight: 500 }}>{ch.name}</span>
                <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{ch.desc}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

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

function SectionLabel({ children }: { children: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ width: 7, height: 7, background: 'var(--accent)', borderRadius: 1 }} />
      <span
        style={{
          fontFamily: "'Fredoka', sans-serif",
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--accent)',
          letterSpacing: '0.12em',
        }}
      >
        {children}
      </span>
    </div>
  );
}
