// 관리자 API 호출 래퍼(클라이언트). 던지지 않고 {status, body}를 돌려준다(status 0 = 네트워크 오류).
// 응답 해석·문구는 src/lib/games/client.ts(순수 함수)가 맡는다.
import type { CreateGameRequest, GameInput, GamePatch, SetHiddenRequest, UpdateGameRequest } from '@/lib/games/types';

export interface ApiResult {
  status: number;
  body: unknown;
}

async function call(method: string, url: string, payload?: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      credentials: 'same-origin',
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } catch {
    return { status: 0, body: null };
  }
}

const gameUrl = (id: string) => `/api/games/${encodeURIComponent(id)}`;

export const adminApi = {
  create: (input: GameInput) => call('POST', '/api/games', { input } satisfies CreateGameRequest),
  update: (id: string, expectedVersion: number, patch: GamePatch) =>
    call('PATCH', gameUrl(id), { expectedVersion, patch } satisfies UpdateGameRequest),
  setHidden: (id: string, hidden: boolean) => call('POST', `${gameUrl(id)}/hidden`, { hidden } satisfies SetHiddenRequest),
  changes: (id: string, limit: number) => call('GET', `${gameUrl(id)}/changes?limit=${limit}`),
  categories: (q: string) => call('GET', `/api/games/categories?q=${encodeURIComponent(q)}`),
  youtube: (url: string) => call('GET', `/api/games/youtube?url=${encodeURIComponent(url)}`),
};
