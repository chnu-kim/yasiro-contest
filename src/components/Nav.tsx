'use client';

import Image from 'next/image';
import styles from './Nav.module.css';

export default function Nav() {
  const toggle = () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('yashiro-theme', next);
  };

  return (
    <nav className={styles.nav}>
      <a href="#" className={styles.logo}>
        <span className={styles.logoText}>야시로</span>
        <Image
          src="/kkul.png"
          alt=""
          width={28}
          height={28}
          className={styles.logoImg}
        />
      </a>

      <div className={styles.links}>
        <a href="https://chzzk.naver.com" target="_blank" rel="noreferrer" className={styles.link}>스트리밍</a>
      </div>

      <div className={styles.actions}>
        <button onClick={toggle} className={styles.themeBtn} title="테마 전환">
          <span className={styles.iconLight}>🌙</span>
          <span className={styles.iconDark}>☀️</span>
        </button>
        <a
          href="https://chzzk.naver.com"
          target="_blank"
          rel="noreferrer"
          className={styles.liveBtn}
        >
          <span className={styles.liveDot} />
          LIVE
        </a>
      </div>
    </nav>
  );
}
