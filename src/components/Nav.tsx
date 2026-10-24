'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Moon, Sun, Menu, X } from 'lucide-react';
import PawMark from './PawMark';
import styles from './Nav.module.css';

interface NavUser {
  channelId: string;
  channelName: string;
}

interface NavProps {
  initialUser: NavUser | null;
}

// 새 출품작을 추가하면 여기 한 줄 — 데스크톱 링크와 모바일 메뉴가 같은 목록을 쓴다
const LINKS = [
  { href: '/about', label: '소개' },
  { href: '/to-yasiro', label: '야시로에게' },
] as const;

const LIVE_URL = 'https://chzzk.naver.com/live/d6e680f5b17eba0b078f978dd722c0f3';

const isCurrent = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export default function Nav({ initialUser }: NavProps) {
  const [user, setUser] = useState<NavUser | null>(initialUser);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname() ?? '/';

  // ESC로 메뉴 닫기. 바깥 탭 닫기는 backdrop onClick이 맡는다(document click 리스너 금지, #26)
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const toggleTheme = () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('yashiro-theme', next);
    } catch {}
  };

  const closeMenu = () => setMenuOpen(false);

  const logout = async () => {
    await fetch('/auth/logout', { method: 'POST' });
    setUser(null);
    closeMenu();
    router.refresh();
  };

  return (
    <header className={styles.nav}>
      <Link
        href="/"
        className={styles.logo}
        aria-label="야시로 홈"
        aria-current={pathname === '/' ? 'page' : undefined}
        onClick={closeMenu}
      >
        <PawMark className={styles.logoIcon} />
        <span className={styles.logoText} aria-hidden="true">야시로</span>
      </Link>

      <nav aria-label="주 메뉴" className={styles.links}>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={styles.link}
            aria-current={isCurrent(pathname, l.href) ? 'page' : undefined}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className={styles.actions}>
        <button onClick={toggleTheme} className={styles.iconBtn} aria-label="테마 전환 (라이트/다크 모드)">
          <span className={styles.iconLight} aria-hidden="true"><Moon size={17} strokeWidth={1.8} /></span>
          <span className={styles.iconDark} aria-hidden="true"><Sun size={17} strokeWidth={1.8} /></span>
        </button>

        <div className={styles.account}>
          {user ? (
            <>
              <span className={styles.userName} title={user.channelName}>{user.channelName}</span>
              <button onClick={logout} className={styles.textBtn}>로그아웃</button>
            </>
          ) : (
            <a href="/auth/login" className={styles.loginBtn}>치지직 로그인</a>
          )}
        </div>

        <a
          href={LIVE_URL}
          target="_blank"
          rel="noreferrer"
          className={styles.live}
          aria-label="야시로 치지직 라이브 (새 탭에서 열림)"
        >
          <span className={styles.livePill}>
            <span className={styles.liveDot} aria-hidden="true" />
            LIVE
          </span>
        </a>

        <button
          className={`${styles.iconBtn} ${styles.hamburgerBtn}`}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
        >
          {menuOpen ? <X size={20} strokeWidth={1.8} /> : <Menu size={20} strokeWidth={1.8} />}
        </button>
      </div>

      {/* 모바일 전용: 열렸을 때만 backdrop(메뉴보다 z-index 한 단계 아래) + 메뉴 */}
      {menuOpen && (
        <>
          <div className={styles.backdrop} onClick={closeMenu} aria-hidden="true" />
          <nav id="mobile-menu" aria-label="모바일 메뉴" className={styles.mobileMenu}>
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={styles.mobileItem}
                aria-current={isCurrent(pathname, l.href) ? 'page' : undefined}
                onClick={closeMenu}
              >
                {l.label}
              </Link>
            ))}
            <div className={styles.mobileAccount}>
              {user ? (
                <>
                  <span className={styles.mobileUser}>{user.channelName}</span>
                  <button onClick={logout} className={styles.textBtn}>로그아웃</button>
                </>
              ) : (
                <a href="/auth/login" className={styles.mobileLogin} onClick={closeMenu}>치지직 로그인</a>
              )}
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
