import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';
import PostIt from '@/components/PostIt';
import Button from '@/components/Button';
import StitchRule from '@/components/StitchRule';
import TapeStrip from '@/components/TapeStrip';
import PawMark from '@/components/PawMark';
import { ArrowIcon } from '@/components/icons';
import RotatingPhrase from './_components/RotatingPhrase';
import KkulCrop from './_components/KkulCrop';
import { HOME_DESCRIPTION, HOME_TITLE, jsonLdString, pageMetadata, siteJsonLd } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({ path: '/', title: { absolute: HOME_TITLE }, description: HOME_DESCRIPTION });

// 히어로 배지에서 돌아가며 보이는 문구
const BADGE_PHRASES = ['치지직 버츄얼 스트리머', '호기심 많은 탐험가', '테라포레 소속 벌꿀오소리', '종합게임 스트리머', '인정사정이 없어요'] as const;

interface GuestbookRow {
  id: string;
  message: string;
  channel_name: string;
}

const CHZZK_LIVE = 'https://chzzk.naver.com/live/d6e680f5b17eba0b078f978dd722c0f3';

// 새 출품작은 여기 한 줄만 더하면 waypoint가 하나 늘고 점선이 이어진다.
// navLabel은 Nav·푸터와 같은 이름
const ENTRIES: { href: string; kicker: string; title: string; navLabel: string; desc: string }[] = [
  { href: '/about', kicker: 'ABOUT', title: '야시로 소개', navLabel: '소개', desc: '프로필 · 채널' },
  { href: '/games', kicker: 'GAMES', title: '플레이한 게임', navLabel: '게임', desc: '탐험한 게임 · 다시보기' },
  { href: '/to-yasiro', kicker: 'TO YASIRO', title: '야시로에게', navLabel: '야시로에게', desc: '팬들이 남긴 한마디' },
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
    <div style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(siteJsonLd()) }} />
      {/* ══ HERO ══ */}
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroInner}>
          <div className={styles.heroLeft}>
            <div className={styles.badge}>
              <span className={styles.badgeDot} />
              <RotatingPhrase phrases={BADGE_PHRASES} className={styles.badgeText} />
            </div>

            <h1 id="hero-title" className={styles.title}>야시로</h1>

            <StitchRule width={120} style={{ margin: 'var(--space-5) 0' }} />

            <p className={styles.lead}>호기심 많은 탐험가, 벌꿀오소리 야시로</p>

            <div className={styles.actions}>
              <Button
                href={CHZZK_LIVE}
                external
                size="lg"
                iconEnd={<ArrowIcon direction="up-right" size={18} />}
              >
                방송 입장하기
              </Button>
              <Button href="#waypoints" variant="ghost" size="lg" iconEnd={<ArrowIcon direction="down" size={16} />}>
                다음 목적지
              </Button>
            </div>
          </div>

          <dl className={styles.facts}>
            <div>
              <dt>소속</dt>
              <dd>TERRAFORET</dd>
            </div>
            <div>
              <dt>종족</dt>
              <dd>벌꿀오소리</dd>
            </div>
            <div>
              <dt>주요 콘텐츠</dt>
              <dd>종합게임</dd>
            </div>
          </dl>

          <div className={styles.heroRight}>
            <div className={styles.panel}>
              <Image
                src="/yasiro1.png"
                alt="고글을 이마에 올리고 탐험 장비를 갖춘 야시로 캐릭터 전신 일러스트"
                fill
                sizes="(max-width: 860px) 100vw, 560px"
                priority
                className={styles.char}
              />
            </div>
            <TapeStrip rotate={-5} width={88} style={{ position: 'absolute', top: -10, left: 28 }} />
            <KkulCrop
              kind="front"
              size={104}
              alt="꿀붕이"
              className={styles.kkulHero}
            />
          </div>
        </div>
      </section>

      {/* ══ 다음 목적지 (사이트에서 유일한 지도 모티프: 출품작을 잇는 점선 한 줄) ══ */}
      <section id="waypoints" className={styles.waypoints} aria-labelledby="wp-title">
        <div className={styles.container}>
          <h2 id="wp-title" className={styles.h2}>다음 목적지</h2>
          <p className={styles.sectionLead}>어디부터 둘러볼까요?</p>

          <div className={styles.route} style={{ ['--stops' as string]: ENTRIES.length }}>
            <div className={styles.start} aria-hidden="true">
              <KkulCrop kind="front" size={72} alt="" className={styles.kkulRoute} />
              <span className={styles.kicker}>START</span>
            </div>
            <ol className={styles.stops}>
              {ENTRIES.map((entry, i) => (
                <li key={entry.href} className={styles.stop}>
                  <span className={styles.pin} aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <Link href={entry.href} className={styles.entryCard}>
                    <span className={styles.kicker}>{entry.kicker}</span>
                    <span className={styles.entryTitle}>{entry.title}</span>
                    <span className={styles.entryDesc}>{entry.desc}</span>
                    <span className={styles.entryArrow} aria-hidden="true">
                      <ArrowIcon direction="right" size={20} />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ══ 최근 한마디 ══ */}
      {notes.length > 0 && (
        <section className={styles.notesSection} aria-labelledby="notes-title">
          <div className={styles.container}>
            <div className={styles.notesHeader}>
              <h2 id="notes-title" className={styles.h2}>야시로에게 남긴 한마디</h2>
              <Button href="/to-yasiro" variant="secondary" iconEnd={<ArrowIcon direction="right" size={16} />}>
                더 보기
              </Button>
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
          </div>
        </section>
      )}

      {/* ══ FOOTER ══ */}
      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <div className={styles.footerBrand}>
            <KkulCrop kind="pot" size={44} className={styles.kkulFooter} />
            <span className={styles.footerWord}>
              <PawMark size={14} style={{ color: 'var(--brass)' }} />
              YASIRO
            </span>
          </div>
          <nav aria-label="푸터 바로가기">
            <ul className={styles.footerLinks}>
              {ENTRIES.map((e) => (
                <li key={e.href}>
                  <Link href={e.href}>{e.navLabel}</Link>
                </li>
              ))}
              <li>
                <a href={CHZZK_LIVE} target="_blank" rel="noreferrer" aria-label="치지직 (새 탭에서 열림)">
                  치지직
                </a>
              </li>
            </ul>
          </nav>
          <span className={styles.copy}>© 2026 야시로 · 비공식 팬 사이트</span>
        </div>
      </footer>
    </div>
  );
}
