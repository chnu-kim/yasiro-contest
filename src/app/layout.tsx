import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import Nav from '@/components/Nav';
import SiteFooter from '@/components/SiteFooter';
import SkipLink from '@/components/SkipLink';
import { siteDefaults } from '@/lib/seo';
import { SEEN_STATS_KEY } from '@/lib/games/seen-stats';
import { SESSION_COOKIE, findSession, parseSessionId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = siteDefaults();

async function getSessionUser() {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;

    const cookieStore = await cookies();
    const sessionId = parseSessionId(cookieStore.get(SESSION_COOKIE)?.value);
    const found = await findSession(db, sessionId, Math.floor(Date.now() / 1000));
    if (found.state !== 'active') return null;
    return found.session;
  } catch {
    return null;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Gaegu:wght@300;400;700&family=Fredoka:wght@500;600;700&family=Noto+Sans+KR:wght@300;400;500;600;700&family=Noto+Serif+KR:wght@600;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            // 테마 + /games 기록 숫자가 지난번에 본 값(--seen-total/--seen-clear). 그린 직후부터 쓰여야 깜빡이지 않아서 여기서 읽는다
            __html: `try{var d=document.documentElement,t=localStorage.getItem('yasiro-theme')||localStorage.getItem('yashiro-theme')||'light';d.setAttribute('data-theme',t);var s=JSON.parse(localStorage.getItem('${SEEN_STATS_KEY}')||'null');if(s&&Number.isInteger(s.total)&&Number.isInteger(s.clear)){d.style.setProperty('--seen-total',s.total);d.style.setProperty('--seen-clear',s.clear);}}catch(e){}`,
          }}
        />
      </head>
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <SkipLink />
        <Nav initialUser={user} />
        {/* 스킵 링크 대상. tabIndex -1이어야 Safari에서도 포커스가 실제로 옮겨 온다 */}
        <main id="main-content" tabIndex={-1} style={{ outline: 'none', flex: '1 0 auto' }}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
