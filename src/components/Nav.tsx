'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import styles from './Nav.module.css';

interface NavUser {
  channelId: string;
  channelName: string;
}

interface NavProps {
  initialUser: NavUser | null;
}

export default function Nav({ initialUser }: NavProps) {
  const [user, setUser] = useState<NavUser | null>(initialUser);
  const router = useRouter();

  const toggle = () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('yashiro-theme', next);
  };

  const logout = async () => {
    await fetch('/auth/logout', { method: 'POST' });
    setUser(null);
    router.refresh();
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
        <a href="https://chzzk.naver.com/d6e680f5b17eba0b078f978dd722c0f3" target="_blank" rel="noreferrer" className={styles.link}>치지직</a>
      </div>

      <div className={styles.actions}>
        <button onClick={toggle} className={styles.themeBtn} title="테마 전환">
          <span className={styles.iconLight}><Moon size={16} strokeWidth={1.8} /></span>
          <span className={styles.iconDark}><Sun size={16} strokeWidth={1.8} /></span>
        </button>

        {user ? (
          <div className={styles.userMenu}>
            <span className={styles.userName}>{user.channelName}</span>
            <button onClick={logout} className={styles.logoutBtn}>로그아웃</button>
          </div>
        ) : (
          <a href="/auth/login" className={styles.loginBtn}>
            치지직 로그인
          </a>
        )}

        <a
          href="https://chzzk.naver.com/live/d6e680f5b17eba0b078f978dd722c0f3"
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
