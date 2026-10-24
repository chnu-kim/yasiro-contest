import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Button from '@/components/Button';
import ChannelGlyph, { type ChannelKind } from '@/components/ChannelGlyph';
import HeightRuler from '@/components/HeightRuler';
import RoundStamp from '@/components/RoundStamp';
import SectionLabel from '@/components/SectionLabel';
import StitchRule from '@/components/StitchRule';
import TapeStrip from '@/components/TapeStrip';
import { ArrowIcon, PenIcon } from '@/components/icons';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: '야시로 소개',
  description: '호기심 많은 탐험가, 벌꿀오소리 야시로의 프로필과 채널.',
};

const KEY_FACTS: { label: string; value: string }[] = [
  { label: '종족', value: '벌꿀오소리' },
  { label: '키', value: '149.8cm' },
  { label: '직업', value: '호기심 많은 탐험가' },
];

const PROFILE: { label: string; value: string }[] = [
  { label: '나이', value: '20살 (지구 기준)' },
  { label: '생일', value: '3월 21일' },
  { label: 'MBTI', value: 'ISFJ' },
  { label: '주요 콘텐츠', value: '종합게임' },
  { label: '소속', value: '테라포레 (TERRAFORET)' },
];

type Channel = { name: string; desc: string; href: string; kind: ChannelKind };

const PRIMARY_CHANNELS: Channel[] = [
  { name: '치지직', desc: '라이브 방송', href: 'https://chzzk.naver.com/d6e680f5b17eba0b078f978dd722c0f3', kind: 'broadcast' },
  { name: '시로의 탐험일지', desc: '유튜브 · 다시보기', href: 'https://www.youtube.com/@시로의탐험일지', kind: 'journal' },
];

const SECONDARY_CHANNELS: Channel[] = [
  { name: '유튜브', desc: '유튜브 · @yasiro0321', href: 'https://www.youtube.com/@yasiro0321', kind: 'play' },
  { name: 'X', desc: '@yasiro__', href: 'https://x.com/yasiro__', kind: 'post' },
  { name: '팬카페', desc: '방송 일정 공지', href: 'https://cafe.naver.com/terafore', kind: 'community' },
];

// 위치는 yashiro4.png(1600×2277)에서 직접 잰 값. x·y는 그림 상자 대비 %.
// 원화를 잘라 확인해서 장비가 분명히 보이는 4가지만 단다(두루마리는 왼쪽 허리 가죽 홀더에 꽂힌 종이 말이).
const CALLOUTS: { label: string; x: number; y: number; side: 'left' | 'right' }[] = [
  { label: '고글', x: 54.5, y: 13, side: 'right' },
  { label: '두루마리', x: 41.6, y: 41.7, side: 'left' },
  { label: '쌍안경', x: 58, y: 47.8, side: 'right' },
  { label: '파우치', x: 59.3, y: 62.3, side: 'right' },
];
const EDGE = 22; // 지시선이 끝나는 좌우 위치(%)

const h2Style: CSSProperties = {
  fontFamily: "'Noto Serif KR', serif",
  fontSize: 'var(--fs-2xl)',
  fontWeight: 700,
  lineHeight: 'var(--lh-tight)',
  marginBottom: 'var(--space-5)',
  wordBreak: 'keep-all',
};

export default function About() {
  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* ══ 탐험가 기록 카드 ══ */}
      <section className={styles.hero} aria-labelledby="about-title">
        <div className={styles.stage}>
          <div className={styles.figure}>
            <Image
              src="/yashiro4.png"
              alt="스팀펑크 고글을 머리에 얹고 정면을 보는 야시로 전신 일러스트"
              fill
              sizes="(max-width: 860px) 340px, 420px"
              priority
              style={{ objectFit: 'contain' }}
            />
            <div className={styles.rulerWrap}>
              <HeightRuler headTop={10} feetBottom={4.5} side="left" style={{ right: '100%', marginRight: 6 }} />
            </div>
            <ul className={styles.callouts} aria-label="야시로의 장비">
              {CALLOUTS.map((c) => (
                <li key={c.label}>
                  <Callout {...c} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.card}>
          <TapeStrip rotate={-3} style={{ position: 'absolute', top: -11, left: 28 }} />
          <RoundStamp size={112} rotate={-12} style={{ position: 'absolute', top: -34, right: 16 }} />
          <SectionLabel>EXPLORER FILE</SectionLabel>
          <h1
            id="about-title"
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 'clamp(52px, 8vw, 80px)',
              fontWeight: 700,
              lineHeight: 1,
              marginBottom: 'var(--space-3)',
            }}
          >
            야시로
          </h1>
          <p style={{ fontSize: 'var(--fs-base)', color: 'var(--text-dim)', wordBreak: 'keep-all', marginBottom: 'var(--space-6)' }}>
            호기심 많은 탐험가, 벌꿀오소리 야시로
          </p>
          <dl className={styles.keyFacts}>
            {KEY_FACTS.map((item) => (
              <div key={item.label} className={styles.keyFact}>
                <dt style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-dim)' }}>{item.label}</dt>
                <dd
                  style={{
                    fontFamily: "'Noto Serif KR', serif",
                    fontSize: 'var(--fs-lg)',
                    fontWeight: 700,
                    lineHeight: 1.3,
                    wordBreak: 'keep-all',
                  }}
                >
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
          <StitchRule style={{ margin: 'var(--space-5) 0' }} />
          <dl className={styles.profileList}>
            {PROFILE.map((item) => (
              <div key={item.label}>
                <dt style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-dim)', marginBottom: 2 }}>{item.label}</dt>
                <dd style={{ fontSize: 'var(--fs-base)', wordBreak: 'keep-all' }}>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ══ 채널 ══ */}
      <section className={styles.section} aria-labelledby="channel-title">
        <SectionLabel>CHANNELS</SectionLabel>
        <h2 id="channel-title" style={h2Style}>
          야시로 찾아가기
        </h2>
        <ul className={styles.primaryList}>
          {PRIMARY_CHANNELS.map((ch) => (
            <li key={ch.href} style={{ position: 'relative' }}>
              <ChannelCard ch={ch} large />
            </li>
          ))}
        </ul>
        <ul className={styles.secondaryList}>
          {SECONDARY_CHANNELS.map((ch) => (
            <li key={ch.href}>
              <ChannelCard ch={ch} />
            </li>
          ))}
        </ul>
      </section>

      {/* ══ 다음 페이지 ══ */}
      <section className={styles.outro} aria-labelledby="outro-title">
        <StitchRule style={{ marginBottom: 'var(--space-6)' }} />
        <div className={styles.outroRow}>
          <h2
            id="outro-title"
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 'var(--fs-xl)',
              fontWeight: 700,
              lineHeight: 'var(--lh-tight)',
              wordBreak: 'keep-all',
              textWrap: 'balance',
            }}
          >
            야시로에게 한마디 남겨 주세요
          </h2>
          <Button href="/to-yasiro" size="lg" icon={<PenIcon size={18} />} iconEnd={<ArrowIcon direction="right" size={16} />}>
            한마디 남기러 가기
          </Button>
        </div>
      </section>
    </div>
  );
}

function Callout({ label, x, y, side }: { label: string; x: number; y: number; side: 'left' | 'right' }) {
  const isRight = side === 'right';
  const line: CSSProperties = isRight
    ? { left: `${x}%`, width: `${100 - EDGE - x}%` }
    : { right: `${100 - x}%`, width: `${x - EDGE}%` };
  const text: CSSProperties = isRight ? { left: `calc(${100 - EDGE}% + 6px)` } : { right: `calc(${100 - EDGE}% + 6px)` };
  return (
    <>
      <span aria-hidden="true" className={styles.calloutLine} style={{ top: `${y}%`, ...line }} />
      <span aria-hidden="true" className={styles.calloutDot} style={{ top: `${y}%`, left: `${x}%` }} />
      <span className={styles.calloutText} style={{ top: `${y}%`, ...text }}>
        {label}
      </span>
    </>
  );
}

function ChannelCard({ ch, large = false }: { ch: Channel; large?: boolean }) {
  return (
    <a
      href={ch.href}
      target="_blank"
      rel="noreferrer"
      className={`${styles.channelCard} ${large ? styles.channelLarge : ''}`}
      aria-label={`${ch.name} ${ch.desc} (새 탭에서 열림)`}
    >
      <span className={styles.channelIcon} style={{ color: 'var(--accent-text)' }}>
        <ChannelGlyph kind={ch.kind} size={large ? 32 : 24} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
        <span
          style={
            large
              ? { fontFamily: "'Noto Serif KR', serif", fontSize: 'var(--fs-xl)', fontWeight: 700, lineHeight: 'var(--lh-tight)' }
              : { fontSize: 'var(--fs-base)', fontWeight: 600 }
          }
        >
          {ch.name}
        </span>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-dim)' }}>{ch.desc}</span>
      </span>
      <span className={styles.channelArrow} aria-hidden="true">
        <ArrowIcon direction="up-right" size={large ? 20 : 16} />
      </span>
    </a>
  );
}
