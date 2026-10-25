// 시드 SQL 생성(games.json → migrations/0008_games_seed.sql)과 D1 행 → games.json 형식 export. 순수 함수.
import { rowsToRecords, sortVods, toGame, toSnapshot } from "./rows.ts";
import { compareCanonical, parseGames, serializeGames, youtubeVideoId } from "./schema.ts";
import type { Game, GameRow, VodRow } from "./types.ts";

export const SEED_SUMMARY = "games.json에서 가져옴";

const HEADER = "-- 생성: pnpm games:seed <input.json>. 직접 고치지 않는다. 원격 적용 후에는 다시 생성하지 않는다.";

/** SQL 문자열 리터럴. 작은따옴표만 이스케이프한다(SQLite는 백슬래시를 특별 취급하지 않는다). NUL은 거부 */
export function sqlString(s: string): string {
  if (s.includes("\u0000")) throw new RangeError("SQL 문자열에 NUL을 넣을 수 없어요");
  return `'${s.replaceAll("'", "''")}'`;
}

/** null → NULL, 안전한 정수 → 숫자 리터럴, 문자열 → sqlString */
export function sqlValue(v: string | number | null): string {
  if (v === null) return "NULL";
  if (typeof v === "number") {
    if (!Number.isSafeInteger(v)) throw new RangeError("SQL 숫자는 안전한 정수여야 해요");
    return String(v);
  }
  return sqlString(v);
}

const values = (vs: ReadonlyArray<string | number | null>) => vs.map(sqlValue).join(", ");

// 다시 실행해도 안전하게(재시도·중복 적용) 모든 문장은 INSERT OR IGNORE다. 이미 있는 행은 덮어쓰지 않는다.
// 다시보기는 그 게임의 import 기록이 아직 없을 때만 넣는다(적용이 끝난 뒤 관리자가 지운 다시보기가 되살아나지 않게).
// OR IGNORE는 CHECK 위반도 조용히 건너뛰므로, 개수·내용은 seed-data.test.ts가 고정한다.
function gameStatements(raw: Game): string[] {
  const g: Game = { ...raw, vods: sortVods(raw.vods) }; // 스냅샷·다시보기 모두 date 오름차순(안정)
  const importId = `import-${g.id}`;
  const out = [
    `INSERT OR IGNORE INTO games (id, name, original_title, category_id, poster_url, first_played, status, hidden, version, updated_by_name) VALUES (${values([
      g.id,
      g.name,
      g.originalTitle ?? null,
      g.categoryId ?? null,
      g.posterUrl ?? null,
      g.firstPlayed,
      g.status,
      0,
      1,
      "시스템",
    ])});`,
  ];
  g.vods.forEach((v, i) => {
    out.push(
      `INSERT OR IGNORE INTO game_vods (game_id, video_id, url, title, date, position) SELECT ${values([
        g.id,
        youtubeVideoId(v.url) as string, // parseGames가 유튜브 URL임을 보장
        v.url,
        v.title,
        v.date,
        i,
      ])} WHERE NOT EXISTS (SELECT 1 FROM game_changes WHERE id = ${sqlString(importId)});`,
    );
  });
  out.push(
    `INSERT OR IGNORE INTO game_changes (id, game_id, channel_id, actor_name, action, summary, before_json, after_json) VALUES (${values([
      importId,
      g.id,
      null,
      "시스템",
      "import",
      SEED_SUMMARY,
      null,
      JSON.stringify(toSnapshot(g, false)),
    ])});`,
  );
  return out;
}

/** games.json 형식 입력으로 시드 SQL을 만든다. 검증 실패는 GamesValidationError 그대로. created_at/updated_at은
 *  적용 시각 기본값에 맡겨 출력이 결정적이다 */
export function buildSeedSql(input: unknown): string {
  const games = parseGames(input).sort(compareCanonical);
  return [HEADER, ...games.flatMap(gameStatements)].join("\n") + "\n";
}

/** D1 행을 games.json 형식 문자열로. hidden이 opts.hidden(기본 false)과 같은 게임만, 수정자·버전 등 관리 메타 없이 */
export function exportGames(games: readonly GameRow[], vods: readonly VodRow[], opts?: { hidden?: boolean }): string {
  const wanted = opts?.hidden ?? false;
  return serializeGames(
    rowsToRecords(games, vods)
      .filter((g) => g.hidden === wanted)
      .map(toGame),
  );
}
