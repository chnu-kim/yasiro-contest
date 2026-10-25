// D1 리포지토리. 쓰기는 모두 한 번의 db.batch(원자적)이며, 낙관적 잠금은 version + write_token으로 건다.
// 익명 규칙: 수정자 이름은 ctx.actor.name(별칭)만 저장한다. channel_name은 읽지도 않는다.
// 조회는 rows.ts의 GAME_COLUMNS를 쓰므로 write_token·updated_by_channel_id가 밖으로 나가지 않는다.
import { slugify } from "../chzzk-category.ts";
import { changeSummary, diffGames } from "./diff.ts";
import { GAME_COLUMNS, rowsToRecords, sortVods, toGame, toSnapshot, VOD_COLUMNS, VOD_ORDER } from "./rows.ts";
import { compareCanonical, ID_PATTERN, parseGames, validateCandidate, youtubeVideoId } from "./schema.ts";
import { normalizeYoutubeUrl } from "./youtube-meta.ts";
import type {
  ChangeAction,
  ChangeEntry,
  ChangeList,
  ChangeRow,
  Game,
  GameInput,
  GamePatch,
  GameRecord,
  GameRow,
  GamesDb,
  GamesDbStatement,
  ValidationIssue,
  Vod,
  VodRow,
  WriteContext,
  WriteResult,
} from "./types.ts";

export const RESERVED_IDS: ReadonlySet<string> = new Set(["categories", "youtube", "new"]);

/** 여러 행 INSERT 한 문장당 다시보기 수. 바인딩 6×16(+가드 2) = 98 ≤ D1 문장당 100 */
const VOD_CHUNK = 16;
const CHANGES_DEFAULT = 20;
const CHANGES_MAX = 50;

export function allocateGameId(
  input: Pick<GameInput, "name" | "originalTitle" | "categoryId">,
  taken: ReadonlySet<string>,
): string {
  const candidates = [input.originalTitle ?? "", input.categoryId ?? "", input.name];
  const base = candidates.map(slugify).find((s) => s !== "") ?? "game";
  let id = base;
  for (let n = 2; taken.has(id) || RESERVED_IDS.has(id); n += 1) id = `${base}-${n}`;
  return id;
}

/** UNIQUE 위반 판별은 메시지 부분 문자열로만 한다(D1은 접두를 붙이고 node:sqlite는 붙이지 않는다) */
export function uniqueViolation(e: unknown): "id" | "category_id" | null {
  const message = e instanceof Error ? e.message : String(e);
  if (message.includes("UNIQUE constraint failed: games.category_id")) return "category_id";
  if (message.includes("UNIQUE constraint failed: games.id")) return "id";
  return null;
}

export function applyPatch(game: Game, patch: GamePatch): unknown {
  const out: Record<string, unknown> = { ...toGame(game) };
  if (patch.name !== undefined) out.name = patch.name;
  if (patch.originalTitle === null) delete out.originalTitle;
  else if (patch.originalTitle !== undefined) out.originalTitle = patch.originalTitle;
  if (patch.category === null) {
    delete out.categoryId;
    delete out.posterUrl;
  } else if (patch.category !== undefined) {
    out.categoryId = patch.category.categoryId;
    if (patch.category.posterUrl === null) delete out.posterUrl;
    else out.posterUrl = patch.category.posterUrl;
  }
  if (patch.firstPlayed !== undefined) out.firstPlayed = patch.firstPlayed;
  if (patch.status !== undefined) out.status = patch.status;
  if (patch.vods !== undefined) out.vods = sortVods(patch.vods);
  return out;
}

/** others 기준으로 검증하고, 통과하면 검증기가 본 값(trim) + 다시보기 URL을 https://www.youtube.com/watch?v=ID로
 *  맞춘 게임을 돌려준다. 저장·비교는 항상 이 값으로 한다(입력 원문을 저장하지 않는다) */
function normalizedCandidate(others: readonly Game[], raw: unknown): { ok: true; game: Game } | { ok: false; issues: ValidationIssue[] } {
  const issues = validateCandidate(others, raw);
  if (issues.length > 0) return { ok: false, issues };
  const [game] = parseGames([raw]);
  // parseGames를 통과한 URL은 유튜브 영상 링크이므로 normalizeYoutubeUrl이 null이 아니다
  const vods = game.vods.map((v) => ({ ...v, url: (normalizeYoutubeUrl(v.url) as { url: string }).url }));
  return { ok: true, game: { ...game, vods: sortVods(vods) } };
}

// ---------- 조회 ----------

export async function listGames(db: GamesDb, opts: { includeHidden: boolean }): Promise<GameRecord[]> {
  const where = opts.includeHidden ? "" : " WHERE hidden = 0";
  const vodWhere = opts.includeHidden ? "" : " WHERE game_id IN (SELECT id FROM games WHERE hidden = 0)";
  const [games, vods] = await db.batch([
    db.prepare(`SELECT ${GAME_COLUMNS} FROM games${where}`),
    db.prepare(`SELECT ${VOD_COLUMNS} FROM game_vods${vodWhere} ${VOD_ORDER}`),
  ]);
  return rowsToRecords(games.results as GameRow[], vods.results as VodRow[]).sort(compareCanonical);
}

export async function getGame(db: GamesDb, id: string, opts: { includeHidden: boolean }): Promise<GameRecord | null> {
  const [games, vods] = await db.batch([
    db.prepare(`SELECT ${GAME_COLUMNS} FROM games WHERE id = ?`).bind(id),
    db.prepare(`SELECT ${VOD_COLUMNS} FROM game_vods WHERE game_id = ? ORDER BY date, position`).bind(id),
  ]);
  const [record] = rowsToRecords(games.results as GameRow[], vods.results as VodRow[]);
  if (record === undefined || (record.hidden && !opts.includeHidden)) return null;
  return record;
}

// ---------- 쓰기 보조 ----------

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function vodBinds(gameId: string, vods: readonly Vod[]): unknown[] {
  return vods.flatMap((v, i) => [gameId, youtubeVideoId(v.url) as string, v.url, v.title, v.date, i]);
}

const VOD_INSERT = "INSERT INTO game_vods (game_id, video_id, url, title, date, position)";
const ROW = "(?, ?, ?, ?, ?, ?)";

/** 다시보기를 16개씩 묶은 INSERT 문장들. guard가 있으면 그 write_token이 DB에 있을 때만 들어간다 */
function vodInserts(db: GamesDb, gameId: string, vods: readonly Vod[], guardToken: string | null): GamesDbStatement[] {
  const binds = vodBinds(gameId, vods);
  return chunks(vods, VOD_CHUNK).map((group, c) => {
    const values = group.map(() => ROW).join(", ");
    const rows = binds.slice(c * VOD_CHUNK * 6, c * VOD_CHUNK * 6 + group.length * 6);
    if (guardToken === null) return db.prepare(`${VOD_INSERT} VALUES ${values}`).bind(...rows);
    return db
      .prepare(
        `${VOD_INSERT} SELECT column1, column2, column3, column4, column5, column6 FROM (VALUES ${values}) WHERE EXISTS (SELECT 1 FROM games WHERE id = ? AND write_token = ?)`,
      )
      .bind(...rows, gameId, guardToken);
  });
}

const CHANGE_COLUMNS = "id, game_id, channel_id, actor_name, action, summary, before_json, after_json, created_at";

function changeBinds(
  gameId: string,
  action: ChangeAction,
  summary: string,
  before: Game | null,
  after: Game,
  afterHidden: boolean,
  beforeHidden: boolean,
  ctx: WriteContext,
  changeId: string,
): unknown[] {
  return [
    changeId,
    gameId,
    ctx.actor.channelId,
    ctx.actor.name,
    action,
    summary,
    before === null ? null : JSON.stringify(toSnapshot(before, beforeHidden)),
    JSON.stringify(toSnapshot(after, afterHidden)),
    ctx.now,
  ];
}

function guardedChange(db: GamesDb, binds: unknown[], gameId: string, token: string): GamesDbStatement {
  return db
    .prepare(`INSERT INTO game_changes (${CHANGE_COLUMNS}) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM games WHERE id = ? AND write_token = ?)`)
    .bind(...binds, gameId, token);
}

// ---------- 추가 ----------

function candidateOf(id: string, input: GameInput): Game {
  const g: Record<string, unknown> = { id, name: input.name };
  if (input.originalTitle !== undefined) g.originalTitle = input.originalTitle;
  if (input.categoryId !== undefined) g.categoryId = input.categoryId;
  if (input.posterUrl !== undefined) g.posterUrl = input.posterUrl;
  g.firstPlayed = input.firstPlayed;
  g.status = input.status;
  g.vods = sortVods(input.vods);
  return g as unknown as Game;
}

export async function createGame(db: GamesDb, input: GameInput, ctx: WriteContext): Promise<WriteResult> {
  for (let attempt = 0; ; attempt += 1) {
    const all = await listGames(db, { includeHidden: true });
    const id = allocateGameId(input, new Set(all.map((g) => g.id)));
    const checked = normalizedCandidate(all, candidateOf(id, input));
    if (!checked.ok) return { ok: false, reason: "invalid", issues: checked.issues };
    const candidate = checked.game;
    const statements: GamesDbStatement[] = [
      db
        .prepare(
          "INSERT INTO games (id, name, original_title, category_id, poster_url, first_played, status, hidden, version, created_at, updated_at, updated_by_channel_id, updated_by_name) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?)",
        )
        .bind(
          id,
          candidate.name,
          candidate.originalTitle ?? null,
          candidate.categoryId ?? null,
          candidate.posterUrl ?? null,
          candidate.firstPlayed,
          candidate.status,
          ctx.now,
          ctx.now,
          ctx.actor.channelId,
          ctx.actor.name,
        ),
      ...vodInserts(db, id, candidate.vods, null),
      db
        .prepare(`INSERT INTO game_changes (${CHANGE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(...changeBinds(id, "create", changeSummary("create", null, candidate), null, candidate, false, false, ctx, ctx.uuid())),
    ];
    try {
      await db.batch(statements);
    } catch (e) {
      if (uniqueViolation(e) !== null && attempt === 0) continue;
      throw e;
    }
    return { ok: true, game: (await getGame(db, id, { includeHidden: true })) as GameRecord, changed: true };
  }
}

// ---------- 수정 ----------

export async function updateGame(
  db: GamesDb,
  id: string,
  patch: GamePatch,
  expectedVersion: number,
  ctx: WriteContext,
): Promise<WriteResult> {
  const current = await getGame(db, id, { includeHidden: true });
  if (current === null) return { ok: false, reason: "not_found" };
  if (current.version !== expectedVersion) return { ok: false, reason: "conflict", latest: current };
  const others = (await listGames(db, { includeHidden: true })).filter((g) => g.id !== id);
  const checked = normalizedCandidate(others, applyPatch(current, patch));
  if (!checked.ok) return { ok: false, reason: "invalid", issues: checked.issues };
  const candidate = checked.game;
  // 다듬은 값으로 비교한다. 공백만 다른 수정은 변화 없음(version·기록 그대로)
  const fields = diffGames(current, candidate);
  if (fields.length === 0) return { ok: true, game: current, changed: false };

  const token = ctx.uuid();
  const changeId = ctx.uuid();
  const statements: GamesDbStatement[] = [
    db
      .prepare(
        "UPDATE games SET name = ?, original_title = ?, category_id = ?, poster_url = ?, first_played = ?, status = ?, version = version + 1, write_token = ?, updated_at = ?, updated_by_channel_id = ?, updated_by_name = ? WHERE id = ? AND version = ?",
      )
      .bind(
        candidate.name,
        candidate.originalTitle ?? null,
        candidate.categoryId ?? null,
        candidate.posterUrl ?? null,
        candidate.firstPlayed,
        candidate.status,
        token,
        ctx.now,
        ctx.actor.channelId,
        ctx.actor.name,
        id,
        expectedVersion,
      ),
  ];
  if (fields.includes("vods")) {
    statements.push(
      db
        .prepare("DELETE FROM game_vods WHERE game_id = ? AND EXISTS (SELECT 1 FROM games WHERE id = ? AND write_token = ?)")
        .bind(id, id, token),
      ...vodInserts(db, id, candidate.vods, token),
    );
  }
  statements.push(
    guardedChange(
      db,
      changeBinds(id, "update", changeSummary("update", current, candidate), current, candidate, current.hidden, current.hidden, ctx, changeId),
      id,
      token,
    ),
  );

  let results;
  try {
    results = await db.batch(statements);
  } catch (e) {
    if (uniqueViolation(e) === "category_id") {
      return { ok: false, reason: "invalid", issues: [{ path: "categoryId", message: "categoryId 중복" }] };
    }
    throw e;
  }
  if (results[0].meta.changes === 0) {
    const latest = await getGame(db, id, { includeHidden: true });
    return latest === null ? { ok: false, reason: "not_found" } : { ok: false, reason: "conflict", latest };
  }
  return { ok: true, game: (await getGame(db, id, { includeHidden: true })) as GameRecord, changed: true };
}

// ---------- 숨김 ----------

export async function setHidden(db: GamesDb, id: string, hidden: boolean, ctx: WriteContext): Promise<WriteResult> {
  const current = await getGame(db, id, { includeHidden: true });
  if (current === null) return { ok: false, reason: "not_found" };
  if (current.hidden === hidden) return { ok: true, game: current, changed: false };
  const token = ctx.uuid();
  const action: ChangeAction = hidden ? "hide" : "unhide";
  const results = await db.batch([
    db
      .prepare(
        "UPDATE games SET hidden = ?, version = version + 1, write_token = ?, updated_at = ?, updated_by_channel_id = ?, updated_by_name = ? WHERE id = ? AND hidden = ?",
      )
      .bind(hidden ? 1 : 0, token, ctx.now, ctx.actor.channelId, ctx.actor.name, id, hidden ? 0 : 1),
    guardedChange(db, changeBinds(id, action, changeSummary(action, current, current), current, current, hidden, current.hidden, ctx, ctx.uuid()), id, token),
  ]);
  const latest = (await getGame(db, id, { includeHidden: true })) as GameRecord;
  return { ok: true, game: latest, changed: results[0].meta.changes !== 0 };
}

// ---------- 변경 기록 ----------

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isInteger(limit)) return CHANGES_DEFAULT;
  return Math.min(CHANGES_MAX, Math.max(1, limit));
}

export async function listChanges(db: GamesDb, id: string, limit?: number): Promise<ChangeList> {
  const [rows, count] = await db.batch([
    db
      .prepare("SELECT id, game_id, actor_name, action, summary, created_at FROM game_changes WHERE game_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?")
      .bind(id, clampLimit(limit)),
    db.prepare("SELECT count(*) AS total FROM game_changes WHERE game_id = ?").bind(id),
  ]);
  const changes: ChangeEntry[] = (rows.results as ChangeRow[]).map((r) => ({
    id: r.id,
    action: r.action,
    summary: r.summary,
    actorName: r.actor_name,
    createdAt: r.created_at,
  }));
  return { changes, total: Number((count.results[0] as { total: number }).total) };
}

export { ID_PATTERN };
