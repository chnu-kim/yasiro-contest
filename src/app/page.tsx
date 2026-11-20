import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';
import Button from '@/components/Button';
import KkulMark from '@/components/KkulMark';
import { ArrowIcon } from '@/components/icons';
import KkulCrop from './_components/KkulCrop';
import { HOME_DESCRIPTION, HOME_TITLE, jsonLdString, pageMetadata, siteJsonLd } from '@/lib/seo';
import { buildHomeData, type Expedition, type HomeData } from '@/lib/games/home';
import { listGames } from '@/lib/games/repo';
import { STATUS_TEXT } from '@/lib/games/labels';

export const metadata: Metadata = pageMetadata({ path: '/', title: { absolute: HOME_TITLE }, description: HOME_DESCRIPTION });

const CHZZK_LIVE = 'https://chzzk.naver.com/live/d6e680f5b17eba0b078f978dd722c0f3';

// 홈 "최근 탐험": 가장 최근 1편은 썸네일, 나머지는 글자 기록 줄
const EXPEDITION_COUNT = 4;

// 주소는 /about "야시로 찾아가기"와 같다. 홈에서는 푸터에 둔다
const CHANNELS = [
  { href: 'https://chzzk.naver.com/d6e680f5b17eba0b078f978dd722c0f3', label: '치지직' },
  { href: 'https://www.youtube.com/@yasiro0321', label: '유튜브' },
  { href: 'https://www.youtube.com/@시로의탐험일지', label: '시로의 탐험일지' },
  { href: 'https://x.com/yasiro__', label: 'X' },
  { href: 'https://cafe.naver.com/terafore', label: '팬카페' },
] as const;

const FACTS = [
  { term: '소속', value: '테라포레' },
  { term: '종족', value: '벌꿀오소리' },
  { term: '콘텐츠', value: '종합게임' },
] as const;

// D1이 없거나(pnpm dev) 조회가 실패하면 null → 기록 섹션을 숨기고 카드 숫자를 뺀다
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

function Status({ status }: { status: Expedition['status'] }) {
  if (status === 'unknown') return <span className={styles.status} />;
  return (
    <span className={status === 'clear' ? `${styles.status} ${styles.statusClear}` : styles.status}>
      {STATUS_TEXT[status]}
    </span>
  );
}

export default async function Home() {
  const home = await getHomeData();
  const expeditions = home?.expeditions ?? [];
  const [featured, ...rest] = expeditions;

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(siteJsonLd()) }} />

      {/* ══ HERO: 그림은 상자 없이 오른쪽 칸에 크게. 가슴 아래는 바탕에 묻힌다 ══ */}
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroGrid}>
          <div className={styles.heroHead}>
            <p className={styles.eyebrow}>치지직 버츄얼 스트리머</p>
            <h1 id="hero-title" className={styles.title}>야시로</h1>
          </div>
          <div className={styles.heroBody}>
            <p className={styles.lead}>호기심 많은 탐험가. 처음 보는 게임을 하나씩 정복해 나가요.</p>
            <div className={styles.actions}>
              <Button href={CHZZK_LIVE} external size="lg" iconEnd={<ArrowIcon direction="up-right" size={18} />}>
                방송 입장하기
              </Button>
            </div>
          </div>

          <dl className={styles.facts}>
            {FACTS.map((f) => (
              <div key={f.term} className={styles.fact}>
                <dt>{f.term}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>

          <div className={styles.figure}>
            <Image
              src="/yasiro1.png"
              alt="고글을 이마에 올리고 탐험 장비를 갖춘 야시로 캐릭터 일러스트"
              width={1600}
              height={2277}
              sizes="(max-width: 860px) 700px, 1100px"
              priority
              className={styles.char}
            />
          </div>
        </div>
      </section>

      {/* ══ 최근 탐험 (정본은 D1 games·game_vods). 데이터가 없으면 숨긴다 ══ */}
      {featured && (
        <section id="expeditions" className={styles.log} aria-labelledby="log-title">
          <div className={styles.container}>
            <div className={styles.sectionHead}>
              <div>
                <span className={styles.label}>FIELD LOG</span>
                <h2 id="log-title" className={styles.h2}>최근 탐험</h2>
              </div>
              <Link href="/games" className={styles.headLink}>
                전체 기록 보기
                <ArrowIcon direction="right" size={16} />
              </Link>
            </div>

            <div className={rest.length > 0 ? styles.logGrid : `${styles.logGrid} ${styles.logGridSingle}`}>
              <a href={featured.vodUrl} target="_blank" rel="noreferrer" className={styles.featured}>
                <span className={styles.thumb}>
                  {/* 유튜브 썸네일은 next/image 최적화 없이 그대로(/games 포스터와 같은 규칙) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={featured.thumbnailUrl} alt="" width={480} height={360} />
                </span>
                <span className={styles.featuredBody}>
                  <span className={styles.meta}>
                    NO.{featured.no} · <time dateTime={featured.firstPlayed}>{shortDate(featured.firstPlayed)}</time>
                  </span>
                  <span className={styles.featuredName}>{featured.name}</span>
                  <Status status={featured.status} />
                  <span className={styles.watch}>
                    다시보기
                    <ArrowIcon direction="up-right" size={14} />
                  </span>
                </span>
                <span className={styles.srOnly}>(유튜브 다시보기, 새 탭에서 열림)</span>
              </a>

              {rest.length > 0 && (
                <ol className={styles.rows}>
                  {rest.map((e) => (
                    <li key={e.id}>
                      <a href={e.vodUrl} target="_blank" rel="noreferrer" className={styles.row}>
                        <span className={styles.rowNo}>NO.{e.no}</span>
                        <span className={styles.rowName}>{e.name}</span>
                        <Status status={e.status} />
                        <time dateTime={e.firstPlayed} className={styles.rowDate}>{shortDate(e.firstPlayed)}</time>
                        <span className={styles.srOnly}>(유튜브 다시보기, 새 탭에서 열림)</span>
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ══ 더 둘러보기: 두 카드는 같은 틀 ══ */}
      <section className={styles.more} aria-labelledby="more-title">
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.label}>ARCHIVE</span>
              <h2 id="more-title" className={styles.h2}>더 둘러보기</h2>
            </div>
          </div>
          <div className={styles.cards}>
            <Link href="/about" className={styles.card}>
              <span className={styles.cardIcon} aria-hidden="true">
                <KkulCrop kind="front" size={56} style={{ position: 'relative' }} />
              </span>
              <span className={styles.cardBody}>
                <span className={styles.cardTitle}>야시로 소개</span>
                <span className={styles.cardDesc}>프로필과 찾아가는 길</span>
              </span>
              <span className={styles.cardEnd}>
                <ArrowIcon direction="right" size={20} />
              </span>
            </Link>
            <Link href="/games" className={styles.card}>
              <span className={styles.cardIcon} aria-hidden="true">
                <KkulCrop kind="pot" size={56} style={{ position: 'relative' }} />
              </span>
              <span className={styles.cardBody}>
                <span className={styles.cardTitle}>플레이한 게임</span>
                <span className={styles.cardDesc}>
                  {home ? `탐험한 게임 ${home.total}개와 다시보기` : '탐험한 게임과 다시보기'}
                </span>
              </span>
              <span className={styles.cardEnd}>
                <ArrowIcon direction="right" size={20} />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerTop}>
            <span className={styles.footerBrand}>
              <KkulMark size={24} />
              야시로
            </span>
            <span className={styles.copy}>© 2026 비공식 팬사이트</span>
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
      </footer>
    </div>
  );
}
