'use client';

import { useCallback, useState } from 'react';
import ClearStamp from '@/components/ClearStamp';
import PawMark from '@/components/PawMark';
import type { IndexedGame } from '@/lib/games/types';
import { fieldPhoto } from '@/lib/games/media';
import styles from './Poster.module.css';

// 치지직 posterImageUrl 스냅샷. next/image는 쓰지 않는다(next.config가 unoptimized라 이점이 없고
// 원격 호스트 등록만 늘어난다). 포스터가 없거나 로드에 실패하면 "표본 라벨" 카드로 대체한다:
// 제목이 이 게임을 가리키는 다시보기가 있으면 그 썸네일을 "현장 사진"으로 붙이고(fieldPhoto), 없으면 꿀붕이 발자국 워터마크.
// 아래쪽 종이 라벨(번호·이름·꼬리말)은 둘 다 같다. 표본 카드는 정복 도장을 오른쪽 위로 옮겨 라벨을 가리지 않는다(stampTopWhenEmpty). 도장은 항상 포스터 안쪽 모서리에 찍고, 크기는 포스터 폭의 36%(표본 카드 위쪽은 32%), 여백은 부모의 --stamp-inset로 정한다.
export default function Poster({
  game,
  showNo = true,
  eager = false,
  nameWideOnly = false,
  stampTopWhenEmpty = false,
  stampAnimate = false,
}: {
  game: IndexedGame;
  showNo?: boolean;
  /** 모달처럼 즉시 보여야 하는 곳. 기본은 lazy */
  eager?: boolean;
  /** "포스터 없음" 카드의 이름을 좁은 화면(≤640px)에서 숨긴다. 제목이 바로 옆에 있는 상세용 */
  nameWideOnly?: boolean;
  /** 표본 카드(이미지 없음)에서 도장을 오른쪽 위(발자국 자리)로 옮겨 아래 라벨을 가리지 않게 한다 */
  stampTopWhenEmpty?: boolean;
  /** 정복 도장을 붙을 때 한 번 '쿵' 찍는다. 상세처럼 한 화면에 도장이 하나뿐인 곳에서만 쓴다 */
  stampAnimate?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = game.posterUrl;
  const showImage = url !== undefined && url !== failedUrl;
  const photo = fieldPhoto(game);
  const showPhoto = !showImage && photo !== null && photo.thumbnailUrl !== failedUrl;

  // hydration 전에 이미 실패한 이미지는 onError가 오지 않으므로 붙을 때 한 번 확인한다.
  // url이 같으면 같은 함수라 렌더마다 다시 불리지 않는다. 아직 요청을 시작하지 않은 lazy 이미지는
  // currentSrc가 비어 있으므로 실패로 보지 않는다.
  const checkAlreadyFailed = useCallback(
    (img: HTMLImageElement | null) => {
      if (img !== null && img.complete && img.currentSrc !== '' && img.naturalWidth === 0) setFailedUrl(url ?? null);
    },
    [url],
  );
  const checkPhotoFailed = useCallback(
    (img: HTMLImageElement | null) => {
      if (img !== null && img.complete && img.currentSrc !== '' && img.naturalWidth === 0) setFailedUrl(photo?.thumbnailUrl ?? null);
    },
    [photo?.thumbnailUrl],
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
        <div className={showPhoto ? `${styles.empty} ${styles.field}` : styles.empty}>
          {showPhoto ? (
            <span className={styles.photo}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbnailUrl}
                alt=""
                width={480}
                height={360}
                loading={eager ? 'eager' : 'lazy'}
                decoding="async"
                referrerPolicy="no-referrer"
                ref={checkPhotoFailed}
                onError={() => setFailedUrl(photo.thumbnailUrl)}
              />
            </span>
          ) : (
            <PawMark size={132} className={styles.paw} />
          )}
          <span className={nameWideOnly ? `${styles.label} ${styles.nameWideOnly}` : styles.label}>
            <span className={styles.labelNo}>
              <span className={styles.labelDot} aria-hidden="true" />
              <span className={styles.labelKind}>SPECIMEN </span>NO.{game.no}
            </span>
            <span className={styles.labelName}>{game.name}</span>
            <span className={styles.labelFoot}>{showPhoto ? `그날 방송 장면 · ${photo.date.slice(5).replace('-', '.')}` : '포스터 미확보'}</span>
          </span>
        </div>
      )}
      {game.status === 'clear' && (
        <ClearStamp
          no={game.no}
          className={[styles.stamp, !showImage && stampTopWhenEmpty && styles.stampTop, stampAnimate && styles.stampIn].filter(Boolean).join(' ')}
        />
      )}
    </div>
  );
}
