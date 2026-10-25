import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import Nav from '@/components/Nav';
import SkipLink from '@/components/SkipLink';
import { siteDefaults } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = siteDefaults();

async function getSessionUser() {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext({ async: true });
    const db = env.DB;

    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;
    if (!sessionId) return null;

    const row = await db
      .prepare('SELECT channel_id, channel_name FROM sessions WHERE id = ? AND expires_at > unixepoch()')
      .bind(sessionId)
      .first<{ channel_id: string; channel_name: string }>();

    if (!row) return null;
    return { channelId: row.channel_id, channelName: row.channel_name };
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
            __html: `try{var t=localStorage.getItem('yasiro-theme')||localStorage.getItem('yashiro-theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
      </head>
      <body>
        <SkipLink />
        <Nav initialUser={user} />
        {/* 스킵 링크 대상. tabIndex -1이어야 Safari에서도 포커스가 실제로 옮겨 온다 */}
        <main id="main-content" tabIndex={-1} style={{ outline: 'none' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
