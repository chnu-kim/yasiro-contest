import { cookies } from 'next/headers';
import { getCloudflareContext } from '@opennextjs/cloudflare';
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
    const sessionId = cookieStore.get('session_id')?.value;

    const [notesResult, session] = await Promise.all([
      env.DB
        .prepare('SELECT id, message, channel_name, created_at FROM guestbook ORDER BY created_at DESC LIMIT 200')
        .all<GuestbookRow>(),
      sessionId
        ? env.DB
            .prepare('SELECT channel_name FROM sessions WHERE id = ? AND expires_at > unixepoch()')
            .bind(sessionId)
            .first<{ channel_name: string }>()
        : Promise.resolve(null),
    ]);

    return {
      notes: notesResult.results,
      user: session ? { channelName: session.channel_name } : null,
    };
  } catch {
    return { notes: [], user: null };
  }
}

export default async function GuestbookPage() {
  const { notes, user } = await getInitialData();
  return <GuestbookBoard initialNotes={notes} user={user} />;
}
