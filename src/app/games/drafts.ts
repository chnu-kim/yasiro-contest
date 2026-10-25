// 수정 중 입력의 localStorage 초안. 저장소가 막혀 있어도(시크릿 창 등) 화면은 그대로 동작해야 하므로 전부 try/catch.
import { draftKey, parseDraft, serializeDraft } from '@/lib/games/patch';
import type { GameDraftStore, GameForm } from '@/lib/games/types';

export function readDraft(gameId: string | null): GameDraftStore | null {
  try {
    return parseDraft(window.localStorage.getItem(draftKey(gameId)));
  } catch {
    return null;
  }
}

export function writeDraft(gameId: string | null, form: GameForm, baseVersion: number | null): void {
  const draft: GameDraftStore = { form, baseVersion, savedAt: Date.now() };
  try {
    window.localStorage.setItem(draftKey(gameId), serializeDraft(draft));
  } catch {
    // 저장소를 못 쓰면 초안은 포기한다
  }
}

export function removeDraft(gameId: string | null): void {
  try {
    window.localStorage.removeItem(draftKey(gameId));
  } catch {
    // 무시
  }
}
