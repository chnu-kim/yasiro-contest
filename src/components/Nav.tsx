'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Moon, Sun, Menu, X } from 'lucide-react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

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
    <nav className={styles.nav} ref={navRef}>
      <a href="/" className={styles.logo} aria-label="야시로 홈">
        <span className={styles.logoText}>야시로</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" fillRule="evenodd" className={styles.logoIcon} aria-hidden="true">
          <path d="M 0 -46 C 23 -40 37 -16 37 5 C 37 31 21 50 0 50 C -21 50 -37 31 -37 5 C -37 -16 -23 -40 0 -46 Z" transform="translate(152 220) rotate(-25) scale(0.92)"/>
          <path d="M 0 -46 C 23 -40 37 -16 37 5 C 37 31 21 50 0 50 C -21 50 -37 31 -37 5 C -37 -16 -23 -40 0 -46 Z" transform="translate(216 168) rotate(-7) scale(1.0)"/>
          <path d="M 0 -46 C 23 -40 37 -16 37 5 C 37 31 21 50 0 50 C -21 50 -37 31 -37 5 C -37 -16 -23 -40 0 -46 Z" transform="translate(296 168) rotate(7) scale(1.0)"/>
          <path d="M 0 -46 C 23 -40 37 -16 37 5 C 37 31 21 50 0 50 C -21 50 -37 31 -37 5 C -37 -16 -23 -40 0 -46 Z" transform="translate(360 220) rotate(25) scale(0.92)"/>
          <path d="M 148 300 C 154 264 198 251 224 255 C 240 258 247 265 256 265 C 265 265 272 258 288 255 C 314 251 358 264 364 300 C 374 332 356 372 320 396 C 300 409 276 416 256 416 C 236 416 212 409 192 396 C 156 372 138 332 148 300 Z"/>
        </svg>
      </a>

      <div className={styles.links}>
        <a href="/to-yasiro" className={styles.link}>야시로에게</a>
        <a href="/whack" className={styles.link}>
          <span className={styles.textFull}>꿀붕이 잡기</span>
          <span className={styles.textShort}>꿀붕이</span>
        </a>
      </div>

      <div className={styles.actions}>
        <button onClick={toggle} className={styles.themeBtn} aria-label="테마 전환 (라이트/다크 모드)">
          <span className={styles.iconLight} aria-hidden="true"><Moon size={16} strokeWidth={1.8} /></span>
          <span className={styles.iconDark} aria-hidden="true"><Sun size={16} strokeWidth={1.8} /></span>
        </button>

        {user ? (
          <div className={styles.userMenu}>
            <span className={styles.userName}>{user.channelName}</span>
            <button onClick={logout} className={styles.logoutBtn}>로그아웃</button>
          </div>
        ) : (
          <a href="/auth/login" className={styles.loginBtn}>
            <span className={styles.textFull}>치지직 로그인</span>
            <span className={styles.textShort}>로그인</span>
          </a>
        )}

        <a
          href="https://chzzk.naver.com/live/d6e680f5b17eba0b078f978dd722c0f3"
          target="_blank"
          rel="noreferrer"
          className={styles.liveBtn}
          aria-label="야시로 라이브 방송 입장 (새 탭에서 열림)"
        >
          <span className={styles.liveDot} aria-hidden="true" />
          LIVE
        </a>

        {/* 모바일 전용: 햄버거 버튼 */}
        <button
          className={styles.hamburgerBtn}
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={20} strokeWidth={1.8} /> : <Menu size={20} strokeWidth={1.8} />}
        </button>
      </div>

      {/* 모바일 전용: 드롭다운 (페이지 링크만) */}
      {menuOpen && (
        <div className={styles.mobileMenu} role="menu">
          <a href="/to-yasiro" className={styles.mobileMenuItem} role="menuitem" onClick={() => setMenuOpen(false)}>야시로에게</a>
          <a href="/whack" className={styles.mobileMenuItem} role="menuitem" onClick={() => setMenuOpen(false)}>꿀붕이 잡기</a>
        </div>
      )}

      {/* 모바일 전용: Floating LIVE FAB */}
      <a
        href="https://chzzk.naver.com/live/d6e680f5b17eba0b078f978dd722c0f3"
        target="_blank"
        rel="noreferrer"
        className={styles.liveFab}
        aria-label="야시로 라이브 방송 입장 (새 탭에서 열림)"
      >
        <span className={styles.liveDot} aria-hidden="true" />
        LIVE
      </a>
    </nav>
  );
}
