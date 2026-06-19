import Image from 'next/image';
import Nav from '@/components/Nav';
import styles from './page.module.css';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Nav />

      {/* ══ HERO ══ */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          minHeight: 'calc(100vh - 60px)',
          overflow: 'hidden',
        }}
      >
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
              버라이어티 스트리머
            </span>
          </div>

          <h1
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 100,
              fontWeight: 900,
              lineHeight: 0.95,
              color: 'var(--text)',
              marginBottom: 20,
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
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
            스팀펑크 고글과 따뜻한 웃음으로 매일 찾아오는
            <br />
            야시로의 방송 세계에 오신 것을 환영합니다.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a
              href="https://chzzk.naver.com"
              target="_blank"
              rel="noreferrer"
              className={styles.heroBtnPrimary}
            >
              방송 입장하기
            </a>
          </div>
        </div>

        {/* Right: Character Panel */}
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: '#EAE0D0',
            backgroundImage:
              'linear-gradient(rgba(130,100,70,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(130,100,70,0.09) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        >
          <Image
            src="/yashiro1.png"
            alt="야시로"
            fill
            sizes="50vw"
            priority
            style={{
              objectFit: 'contain',
              objectPosition: 'bottom center',
              mixBlendMode: 'multiply',
            }}
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
              width={72}
              height={72}
              style={{ objectFit: 'contain', mixBlendMode: 'multiply' }}
            />
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: `24px var(--gutter)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '0.14em',
            }}
          >
            YASHIRO
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
