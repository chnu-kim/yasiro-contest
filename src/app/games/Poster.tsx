'use client';

import { useCallback, useState, type CSSProperties } from 'react';
import ClearStamp from '@/components/ClearStamp';
import type { IndexedGame } from '@/lib/games/types';
import styles from './Poster.module.css';

// 치지직 posterImageUrl 스냅샷. next/image는 쓰지 않는다(next.config가 unoptimized라 이점이 없고
// 원격 호스트 등록만 늘어난다). 로드 실패하면 "포스터 없음" 카드로 대체한다.
export default function Poster({
  game,
  stampSize,
  stampStyle,
  showNo = true,
  eager = false,
  nameWideOnly = false,
}: {
  game: IndexedGame;
  stampSize: number;
  stampStyle?: CSSProperties;
  showNo?: boolean;
  /** 모달처럼 즉시 보여야 하는 곳. 기본은 lazy */
  eager?: boolean;
  /** "포스터 없음" 카드의 이름을 좁은 화면(≤640px)에서 숨긴다. 제목이 바로 옆에 있는 상세용 */
  nameWideOnly?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = game.posterUrl;
  const showImage = url !== undefined && url !== failedUrl;

  // hydration 전에 이미 실패한 이미지는 onError가 오지 않으므로 붙을 때 한 번 확인한다.
  // url이 같으면 같은 함수라 렌더마다 다시 불리지 않는다. 아직 요청을 시작하지 않은 lazy 이미지는
  // currentSrc가 비어 있으므로 실패로 보지 않는다.
  const checkAlreadyFailed = useCallback(
    (img: HTMLImageElement | null) => {
      if (img !== null && img.complete && img.currentSrc !== '' && img.naturalWidth === 0) setFailedUrl(url ?? null);
    },
    [url],
  );
  const tone = styles[`t${game.ordinal % 5}`];

  return (
    <div className={`${styles.cover} ${tone}`}>
      {showImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            width={300}
            height={400}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            referrerPolicy="no-referrer"
            className={styles.img}
            ref={checkAlreadyFailed}
            onError={() => setFailedUrl(url ?? null)}
          />
          {showNo && <span className={styles.no}>NO.{game.no}</span>}
        </>
      ) : (
        <div className={styles.empty}>
          <span className={styles.emptyNo}>NO.{game.no}</span>
          <span className={nameWideOnly ? `${styles.emptyName} ${styles.nameWideOnly}` : styles.emptyName}>{game.name}</span>
          <span className={styles.emptyRule} aria-hidden="true" />
        </div>
      )}
      {game.status === 'clear' && <ClearStamp size={stampSize} style={{ position: 'absolute', ...stampStyle }} />}
    </div>
  );
}
