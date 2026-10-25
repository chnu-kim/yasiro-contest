import type { GameRecord, IndexedGame } from '@/lib/games/types';

/** 보드가 다루는 게임. 방문자는 hidden이 항상 false */
export type BoardGame = IndexedGame & { hidden: boolean };
/** 관리자에게만 오는 관리 메타(version 등)가 붙은 게임 */
export type AdminGame = BoardGame & GameRecord;
