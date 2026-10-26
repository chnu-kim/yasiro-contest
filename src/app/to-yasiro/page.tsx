import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { cookies } from 'next/headers';

export const metadata: Metadata = pageMetadata({
  path: '/to-yasiro',
  title: '야시로에게',
  description: '야시로 팬들이 남긴 한마디 방명록. 치지직 로그인 후 메모를 남겨보세요.',
});
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { SESSION_COOKIE, findSession, parseSessionId } from '@/lib/session';
import GuestbookBoard from './GuestbookBoard';

interface GuestbookRow {
  id: string;
  message: string;
  channel_name: string;
  created_at: number;
}

async function getInitialData() {
  try {
    const { env } = await getCloudflareContext({ async: true });

    const cookieStore = await cookies();
    const sessionId = parseSessionId(cookieStore.get(SESSION_COOKIE)?.value);

    const [notesResult, found] = await Promise.all([
      env.DB
        .prepare('SELECT id, message, channel_name, created_at FROM guestbook ORDER BY created_at DESC LIMIT 200')
        .all<GuestbookRow>(),
      findSession(env.DB, sessionId, Math.floor(Date.now() / 1000)),
    ]);

    return {
      notes: notesResult.results,
      user: found.state === 'active' ? { channelName: found.session.channelName } : null,
    };
  } catch {
    return { notes: [], user: null };
  }
}

export default async function GuestbookPage() {
  const { notes, user } = await getInitialData();
  return <GuestbookBoard initialNotes={notes} user={user} />;
}
