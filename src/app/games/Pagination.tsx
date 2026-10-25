
import { pageWindow } from '@/lib/games/query';
import styles from './Pagination.module.css';

export default function Pagination({
  page,
  pageCount,
  rangeText,
  onGo,
}: {
  page: number;
  pageCount: number;
  rangeText: string;
  onGo: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <>
      <nav aria-label="페이지" className={styles.pagination}>
        <button type="button" className={`${styles.pageBtn} ${styles.pageStep}`} disabled={page <= 1} onClick={() => onGo(page - 1)}>
          ← 이전
        </button>
        <div className={styles.pageNumbers}>
          {pageWindow(page, pageCount).map((item, i) =>
            item === 'gap' ? (
              <span key={`gap-${i}`} className={styles.pageGap} aria-hidden="true">…</span>
            ) : (
              <button
                key={item}
                type="button"
                className={`${styles.pageBtn} ${styles.pageNum}`}
                aria-current={item === page ? 'page' : undefined}
                aria-label={`${item}쪽`}
                onClick={() => onGo(item)}
              >
                {item}
              </button>
            ),
          )}
        </div>
        <span className={styles.pageCompact} aria-hidden="true">
          <span>{page}</span> <span className={styles.pageTotal}>/ {pageCount}</span>
        </span>
        <button type="button" className={`${styles.pageBtn} ${styles.pageStep}`} disabled={page >= pageCount} onClick={() => onGo(page + 1)}>
          다음 →
        </button>
      </nav>
      <p className={styles.rangeText}>{rangeText}</p>
    </>
  );
}
