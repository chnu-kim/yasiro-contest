import KkulMark from '@/components/KkulMark';
import { ArrowIcon } from '@/components/icons';
import { CHANNELS } from '@/lib/channels';
import styles from './SiteFooter.module.css';

// 모든 라우트 공용 푸터. layout.tsx에서 한 번만 렌더한다
export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.top}>
        <span className={styles.brand}>
          <KkulMark size={24} />
          야시로
        </span>
        <span className={styles.copy}>© 2026 비공식 팬사이트</span>
      </div>
      <ul className={styles.channels} aria-label="야시로 채널">
        {CHANNELS.map((c) => (
          <li key={c.id}>
            <a href={c.href} target="_blank" rel="noopener noreferrer" className={styles.channel}>
              {c.label}
              <ArrowIcon direction="up-right" size={14} />
              <span className={styles.srOnly}>(새 탭에서 열림)</span>
            </a>
          </li>
        ))}
      </ul>
    </footer>
  );
}
