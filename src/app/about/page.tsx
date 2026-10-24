import type { Metadata } from 'next';
import Image from 'next/image';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: '야시로 소개',
  description: '호기심 많은 탐험가, 벌꿀오소리 야시로의 프로필과 채널.',
};

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

const h2Style = { fontFamily: "'Noto Serif KR', serif", fontSize: 28, fontWeight: 700, marginBottom: 24 } as const;

export default function About() {
  return (
    <main style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* ══ 프로필 ══ */}
      <section className={styles.profileSection} aria-labelledby="about-title">
        <div className={styles.profileText}>
          <SectionLabel>PROFILE</SectionLabel>
          <h1
            id="about-title"
            style={{
              fontFamily: "'Jua', sans-serif",
              fontSize: 'clamp(44px, 10vw, 72px)',
              fontWeight: 400,
              lineHeight: 1,
              marginBottom: 12,
            }}
          >
            야시로
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-dim)', marginBottom: 36, wordBreak: 'keep-all' }}>
            호기심 많은 탐험가, 벌꿀오소리 야시로
          </p>
          <dl className={styles.profileList}>
            {PROFILE.map((item) => (
              <div key={item.label} style={{ display: 'contents' }}>
                <dt style={{ fontSize: 13, color: 'var(--text-dim)' }}>{item.label}</dt>
                <dd style={{ fontSize: 16, wordBreak: 'keep-all' }}>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={styles.charPanel}>
          {/* 그림과 같은 비율의 상자 — 키 표시를 머리 위치(그림 높이의 9.5%)에 고정한다 */}
          <div className={styles.figure}>
            <Image
              src="/yashiro4.png"
              alt="스팀펑크 고글을 머리에 얹고 정면을 보는 야시로 전신 일러스트"
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              priority
              style={{ objectFit: 'contain' }}
            />
            <div
              style={{
                position: 'absolute',
                top: '9.5%',
                left: '-12%',
                right: '-12%',
                height: 1,
                background: 'var(--accent)',
                opacity: 0.7,
              }}
            />
            <span
              style={{
                position: 'absolute',
                top: '9.5%',
                left: 0,
                right: 0,
                transform: 'translateY(-100%)',
                paddingBottom: 6,
                textAlign: 'center',
                fontSize: 15,
                fontFamily: "'Fredoka', sans-serif",
                fontWeight: 600,
                color: 'var(--accent)',
                letterSpacing: '0.08em',
              }}
            >
              149.8 cm
            </span>
          </div>
        </div>
      </section>

      {/* ══ 주요 콘텐츠 ══ */}
      <section className={styles.contentsSection} aria-labelledby="contents-title">
        <SectionLabel>CONTENTS</SectionLabel>
        <h2 id="contents-title" style={h2Style}>
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
      </section>

      {/* ══ 채널 ══ */}
      <section className={styles.channelSection} aria-labelledby="channel-title">
        <SectionLabel>CHANNELS</SectionLabel>
        <h2 id="channel-title" style={h2Style}>
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
    </main>
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
