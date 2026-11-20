import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';
import Button from '@/components/Button';
import StitchRule from '@/components/StitchRule';
import TapeStrip from '@/components/TapeStrip';
import PawMark from '@/components/PawMark';
import { ArrowIcon } from '@/components/icons';
import RotatingPhrase from './_components/RotatingPhrase';
import KkulCrop from './_components/KkulCrop';
import { HOME_DESCRIPTION, HOME_TITLE, jsonLdString, pageMetadata, siteJsonLd } from '@/lib/seo';
import { buildHomeData, type HomeData } from '@/lib/games/home';
import { listGames } from '@/lib/games/repo';
import { formatDate } from '@/lib/games/query';
import { STATUS_TEXT } from '@/lib/games/labels';

export const metadata: Metadata = pageMetadata({ path: '/', title: { absolute: HOME_TITLE }, description: HOME_DESCRIPTION });

// 히어로 배지에서 돌아가며 보이는 문구
const BADGE_PHRASES = ['치지직 버츄얼 스트리머', '호기심 많은 탐험가', '테라포레 소속 벌꿀오소리', '종합게임 스트리머', '인정사정이 없어요'] as const;

const CHZZK_LIVE = 'https://chzzk.naver.com/live/d6e680f5b17eba0b078f978dd722c0f3';

// 홈 "최근 탐험" 띠에 보이는 다시보기 수. 같은 크기로 한 줄(모바일 2×2)
const EXPEDITION_COUNT = 4;

// 주소는 /about "야시로 찾아가기"와 같다
const CHANNELS = [
  { href: 'https://chzzk.naver.com/d6e680f5b17eba0b078f978dd722c0f3', label: '치지직' },
  { href: 'https://www.youtube.com/@yasiro0321', label: '유튜브' },
  { href: 'https://www.youtube.com/@시로의탐험일지', label: '시로의 탐험일지' },
  { href: 'https://x.com/yasiro__', label: 'X' },
  { href: 'https://cafe.naver.com/terafore', label: '팬카페' },
] as const;

// 푸터 바로가기. Nav와 같은 이름
const PAGES = [
  { href: '/about', label: '소개' },
  { href: '/games', label: '게임' },
] as const;

// D1이 없거나(pnpm dev) 조회가 실패하면 null → 띠를 숨기고 카드 숫자를 뺀다
async function getHomeData(): Promise<HomeData | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext({ async: true });
    const games = await listGames(env.DB, { includeHidden: false });
    return buildHomeData(games, EXPEDITION_COUNT);
  } catch {
    return null;
  }
}

const shortDate = (iso: string) => iso.slice(5).replace('-', '.');

export default async function Home() {
  const home = await getHomeData();
  const expeditions = home?.expeditions ?? [];

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
              {expeditions.length > 0 ? (
                <Button href="#expeditions" variant="ghost" size="lg" iconEnd={<ArrowIcon direction="down" size={16} />}>
                  최근 탐험 보기
                </Button>
              ) : (
                <Button href="/games" variant="ghost" size="lg" iconEnd={<ArrowIcon direction="right" size={16} />}>
                  탐험 기록 보기
                </Button>
              )}
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

          {/* 상반신 크롭: 액자(panel)는 배경만, 그림은 액자 위로 머리가 나오고 아래는 잘린다. 전신은 /about 키 측정판 */}
          <div className={styles.heroRight}>
            <div className={styles.panel} aria-hidden="true" />
            <div className={styles.charClip}>
              <Image
                src="/yasiro1.png"
                alt="고글을 이마에 올리고 탐험 장비를 갖춘 야시로 캐릭터 일러스트"
                width={1600}
                height={2277}
                sizes="(max-width: 860px) 160vw, 1000px"
                priority
                className={styles.char}
              />
            </div>
            <TapeStrip rotate={-5} width={88} style={{ position: 'absolute', top: 'calc(var(--panel-top) - 12px)', left: '12%', zIndex: 2 }} />
            <KkulCrop kind="front" size={104} alt="꿀붕이" className={styles.kkulHero} />
          </div>
        </div>
      </section>

      {/* ══ 최근 탐험 (홈에서 유일하게 바뀌는 영역. 정본은 D1 games·game_vods) ══ */}
      {expeditions.length > 0 && (
        <section id="expeditions" className={styles.band} aria-labelledby="exp-title">
          <div className={styles.container}>
            <div className={styles.bandHead}>
              <div>
                <span className={styles.bandKicker}>LATEST EXPEDITION</span>
                <h2 id="exp-title" className={styles.bandTitle}>최근 탐험</h2>
              </div>
              <Link href="/games" className={styles.bandMore}>
                탐험 기록 {home?.total}개 전체 보기
                <ArrowIcon direction="right" size={16} />
              </Link>
            </div>
            <ol className={styles.vods}>
              {expeditions.map((e, i) => (
                <li key={e.id} className={styles.vod}>
                  <a href={e.vodUrl} target="_blank" rel="noreferrer" className={styles.vodLink}>
                    <span className={styles.thumb}>
                      {/* 유튜브 썸네일은 next/image 최적화 없이 그대로(/games 포스터와 같은 규칙) */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.thumbnailUrl} alt="" width={480} height={360} loading={i === 0 ? 'eager' : 'lazy'} />
                      <span className={styles.thumbNo}>NO.{e.no}</span>
                      <span className={styles.thumbPlay} aria-hidden="true">▶ 다시보기</span>
                    </span>
                    <span className={styles.vodName}>{e.name}</span>
                    <span className={styles.vodMeta}>
                      <time dateTime={e.firstPlayed}>{shortDate(e.firstPlayed)}</time>
                      {e.status !== 'unknown' && (
                        <span className={e.status === 'clear' ? `${styles.vodChip} ${styles.vodChipClear}` : styles.vodChip}>
                          {STATUS_TEXT[e.status]}
                        </span>
                      )}
                    </span>
                    <span className={styles.srOnly}>(유튜브 다시보기, 새 탭에서 열림)</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* ══ 더 둘러보기 ══ */}
      <section className={styles.more} aria-labelledby="more-title">
        <div className={styles.container}>
          <h2 id="more-title" className={styles.kicker}>MORE</h2>
          <div className={styles.moreCards}>
            <Link href="/about" className={styles.miniCard}>
              <span className={styles.miniIcon} aria-hidden="true">
                <Image src="/yasiro1.png" alt="" width={1600} height={2277} sizes="64px" className={styles.miniChar} />
              </span>
              <span className={styles.miniBody}>
                <span className={styles.miniTitle}>야시로 소개</span>
                <span className={styles.miniDesc}>프로필 · 키 149.8cm · 채널</span>
              </span>
              <span className={styles.miniArrow} aria-hidden="true"><ArrowIcon direction="right" size={20} /></span>
            </Link>
            <Link href="/games" className={styles.miniCard}>
              <span className={styles.miniIcon} aria-hidden="true">
                {expeditions[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={expeditions[0].thumbnailUrl} alt="" width={480} height={360} loading="lazy" className={styles.miniThumb} />
                ) : (
                  <PawMark size={28} style={{ color: 'var(--brass)' }} />
                )}
              </span>
              <span className={styles.miniBody}>
                <span className={styles.miniTitle}>플레이한 게임</span>
                <span className={styles.miniDesc}>
                  {home ? `정복 ${home.clear}` : '탐험한 게임 · 다시보기'}
                  {home?.latest && ` · 최근 ${formatDate(home.latest.firstPlayed).slice(5)}`}
                </span>
              </span>
              {home ? (
                <span className={styles.miniCount}>
                  {home.total}
                  <small>기록</small>
                </span>
              ) : (
                <span className={styles.miniArrow} aria-hidden="true"><ArrowIcon direction="right" size={20} /></span>
              )}
            </Link>
          </div>
          <ul className={styles.channels} aria-label="야시로 채널">
            {CHANNELS.map((c) => (
              <li key={c.href}>
                <a href={c.href} target="_blank" rel="noreferrer" className={styles.channel}>
                  {c.label}
                  <ArrowIcon direction="up-right" size={14} />
                  <span className={styles.srOnly}>(새 탭에서 열림)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

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
              {PAGES.map((p) => (
                <li key={p.href}>
                  <Link href={p.href}>{p.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <span className={styles.copy}>© 2026 야시로 · 비공식 팬사이트</span>
        </div>
      </footer>
    </div>
  );
}
