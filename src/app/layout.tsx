import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import Nav from '@/components/Nav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '야시로',
  description: '스팀펑크 고글과 따뜻한 웃음으로 매일 찾아오는 야시로의 방송 세계',
};

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
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Noto+Sans+KR:wght@300;400;500;700&family=Noto+Serif+KR:wght@700;900&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('yashiro-theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
      </head>
      <body>
        <Nav initialUser={user} />
        {children}
      </body>
    </html>
  );
}
