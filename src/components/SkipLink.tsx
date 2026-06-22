import styles from './SkipLink.module.css';

export default function SkipLink() {
  return (
    <a href="#main-content" className={styles.skipLink}>
      본문으로 바로 가기
    </a>
  );
}
