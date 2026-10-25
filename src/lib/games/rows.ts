// D1 행 ↔ 도메인 레코드 변환. repo.ts(조회)와 seed.ts(export·시드)가 같이 쓴다. 로직은 매핑만.
import type { Game, GameRecord, GameRow, GameSnapshot, Vod, VodRow } from "./types.ts";

/** games SELECT 열. write_token·updated_by_channel_id는 넣지 않는다(응답으로 새지 않게) */
export const GAME_COLUMNS =
  "id, name, original_title, category_id, poster_url, first_played, status, hidden, version, created_at, updated_at, updated_by_name";

export const VOD_COLUMNS = "game_id, video_id, url, title, date, position";

/** 다시보기 조회 순서. serializeGames의 안정 정렬(date 오름차순)과 같은 결과가 나오게 position으로 동률을 푼다 */
export const VOD_ORDER = "ORDER BY game_id, date, position";

/** 다시보기를 serializeGames와 같은 순서(date 오름차순, 같은 날짜는 원래 순서)로 정렬한 사본 */
export function sortVods(vods: readonly Vod[]): Vod[] {
  return vods
    .map((v, i) => ({ v, i }))
    .sort((a, b) => (a.v.date < b.v.date ? -1 : a.v.date > b.v.date ? 1 : a.i - b.i))
    .map(({ v }) => ({ title: v.title, url: v.url, date: v.date }));
}

/** game_vods 행들을 game_id별로 묶는다. 같은 게임 안에서는 date, position 순 */
function groupVods(vods: readonly VodRow[]): Map<string, VodRow[]> {
  const byGame = new Map<string, VodRow[]>();
  for (const v of vods) {
    const list = byGame.get(v.game_id);
    if (list === undefined) byGame.set(v.game_id, [v]);
    else list.push(v);
  }
  for (const list of byGame.values()) {
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.position - b.position));
  }
  return byGame;
}

export function rowToRecord(row: GameRow, vods: readonly VodRow[]): GameRecord {
  const record: GameRecord = {
    id: row.id,
    name: row.name,
    firstPlayed: row.first_played,
    status: row.status,
    vods: vods.map((v) => ({ title: v.title, url: v.url, date: v.date })),
    hidden: row.hidden === 1,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedByName: row.updated_by_name,
  };
  if (row.original_title !== null) record.originalTitle = row.original_title;
  if (row.category_id !== null) record.categoryId = row.category_id;
  if (row.poster_url !== null) record.posterUrl = row.poster_url;
  return record;
}

/** games 행 순서를 유지한 채 각 게임에 다시보기를 붙인다 */
export function rowsToRecords(games: readonly GameRow[], vods: readonly VodRow[]): GameRecord[] {
  const byGame = groupVods(vods);
  return games.map((g) => rowToRecord(g, byGame.get(g.id) ?? []));
}

/** 방문자용: 관리 메타(hidden·version·수정자 등)를 뺀 Game 사본. JSON 키 순서가 필요하면 serializeGames를 쓴다 */
export function toGame(g: Game): Game {
  const out: Game = { id: g.id, name: g.name, firstPlayed: g.firstPlayed, status: g.status, vods: g.vods.map((v) => ({ ...v })) };
  if (g.originalTitle !== undefined) out.originalTitle = g.originalTitle;
  if (g.categoryId !== undefined) out.categoryId = g.categoryId;
  if (g.posterUrl !== undefined) out.posterUrl = g.posterUrl;
  return out;
}

/** game_changes.before_json/after_json 스냅샷. 수정자 정보는 넣지 않는다 */
export function toSnapshot(g: Game, hidden: boolean): GameSnapshot {
  return { ...toGame(g), hidden };
}
