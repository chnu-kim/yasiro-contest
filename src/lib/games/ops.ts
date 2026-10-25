// 운영 D1을 터미널에서 고치는 작업(pnpm games:edit). 원격 사본을 로컬에 올려 repo.ts의 저장 로직을 그대로 돌리고,
// 실제로 실행된 쓰기 문장만 리터럴 SQL로 받아 원격에 그대로 적용한다. 그래서 낙관적 잠금(version·write_token)과
// 변경 기록(game_changes, 수정자 '관리자')이 사이트에서 저장한 것과 같게 남는다.
import { YASIRO_CHANNEL_ID, actorNameFor, parseAdminIds } from "./admin.ts";
import { createGame, getGame, listChanges, setHidden, updateGame } from "./repo.ts";
import { youtubeVideoId } from "./schema.ts";
import { sqlValue } from "./seed.ts";
import type { Actor, GameInput, GamePatch, GamesDb, GamesDbStatement, Vod, WriteContext, WriteResult } from "./types.ts";

export type GameOp =
  | { op: "add"; input: GameInput }
  | { op: "update"; id: string; patch: GamePatch }
  /** from의 다시보기를 to로 옮긴다. dates·urls가 없으면 전부. hideFrom이면 옮긴 뒤 from을 숨긴다 */
  | { op: "move-vods"; from: string; to: string; dates?: string[]; urls?: string[]; hideFrom?: boolean }
  | { op: "hide"; id: string }
  | { op: "unhide"; id: string };

export type OpsResult = { ok: true; lines: string[] } | { ok: false; lines: string[]; error: string };

/** ?를 바인딩 값의 SQL 리터럴로 바꾼다. 쿼리 본문에 리터럴 ?가 없는 repo.ts 문장 전용 */
export function sqlLiteral(sql: string, params: readonly unknown[]): string {
  const holes = sql.split("?").length - 1;
  if (holes !== params.length) throw new RangeError(`바인딩 ${params.length}개, ? ${holes}개`);
  let i = 0;
  return sql.replace(/\?/g, () => {
    const v = params[i++];
    if (v !== null && typeof v !== "string" && typeof v !== "number") throw new TypeError(`SQL 리터럴로 쓸 수 없는 값: ${typeof v}`);
    return sqlValue(v);
  });
}

function isRead(sql: string): boolean {
  return /^(SELECT|WITH)\b/i.test(sql.trimStart());
}

class RecordingStatement implements GamesDbStatement {
  readonly inner: GamesDbStatement;
  readonly sql: string;
  readonly params: readonly unknown[];

  constructor(inner: GamesDbStatement, sql: string, params: readonly unknown[]) {
    this.inner = inner;
    this.sql = sql;
    this.params = params;
  }

  bind(...values: unknown[]): GamesDbStatement {
    return new RecordingStatement(this.inner.bind(...values), this.sql, values);
  }

  first<T>(): Promise<T | null> {
    return this.inner.first<T>();
  }

  all<T>() {
    return this.inner.all<T>();
  }

  async run(): Promise<never> {
    throw new Error("recordingDb: 쓰기는 batch로만 한다(원격에 같은 문장을 적용하기 위해)");
  }
}

/** batch에서 실행된 쓰기 문장을 리터럴 SQL로 모은다. 롤백된 batch는 남기지 않는다 */
export function recordingDb(inner: GamesDb): { db: GamesDb; writes: () => string[] } {
  const writes: string[] = [];
  const db: GamesDb = {
    prepare: (query) => new RecordingStatement(inner.prepare(query), query, []),
    async batch(statements) {
      const recs = statements as RecordingStatement[];
      const results = await inner.batch(recs.map((s) => s.inner));
      for (const s of recs) if (!isRead(s.sql)) writes.push(`${sqlLiteral(s.sql, s.params)};`);
      return results;
    },
  };
  return { db, writes: () => [...writes] };
}

/** .dev.vars의 ADMIN_CHANNEL_IDS에서 야시로가 아닌 첫 관리자. 표시 이름은 별칭('관리자')뿐이다 */
export function opsActor(raw: string | undefined): Actor {
  const id = [...parseAdminIds(raw)].find((c) => c !== YASIRO_CHANNEL_ID);
  if (id === undefined) throw new Error("ADMIN_CHANNEL_IDS(.dev.vars)에 관리자 채널 ID가 없어요.");
  return { channelId: id, name: actorNameFor(id) };
}

const OPS = new Set(["add", "update", "move-vods", "hide", "unhide"]);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function nonEmpty(v: unknown): v is string {
  return typeof v === "string" && v !== "";
}

function isStringArray(v: unknown): boolean {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function opError(o: unknown): string | null {
  if (!isObject(o)) return "객체가 아니에요.";
  if (!OPS.has(o.op as string)) return `알 수 없는 op '${String(o.op)}'`;
  if (o.op === "add") return isObject(o.input) ? null : "input이 필요해요.";
  if (o.op === "move-vods") {
    if (!nonEmpty(o.from) || !nonEmpty(o.to)) return "from·to가 필요해요.";
    if (o.from === o.to) return "from과 to가 같아요.";
    if (o.dates !== undefined && !isStringArray(o.dates)) return "dates는 문자열 배열이어야 해요.";
    if (o.urls !== undefined && !isStringArray(o.urls)) return "urls는 문자열 배열이어야 해요.";
    if (o.dates !== undefined && o.urls !== undefined) return "dates와 urls는 함께 쓸 수 없어요.";
    if (o.hideFrom !== undefined && typeof o.hideFrom !== "boolean") return "hideFrom은 true/false예요.";
    return null;
  }
  if (!nonEmpty(o.id)) return "id가 필요해요.";
  if (o.op === "update" && !isObject(o.patch)) return "patch가 필요해요.";
  return null;
}

/** JSON 작업 목록의 모양만 본다. 값 검증은 repo.ts(validateCandidate)가 한다 */
export function parseOps(raw: unknown): { ok: true; ops: GameOp[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "작업 목록은 배열이어야 해요." };
  if (raw.length === 0) return { ok: false, error: "작업이 하나도 없어요." };
  for (const [i, o] of raw.entries()) {
    const error = opError(o);
    if (error !== null) return { ok: false, error: `${i + 1}번 작업: ${error}` };
  }
  return { ok: true, ops: raw as GameOp[] };
}

const REASON: Record<"not_found" | "conflict", string> = {
  not_found: "게임이 없어요.",
  conflict: "그사이 다른 곳에서 먼저 고쳤어요. 다시 실행해 주세요.",
};

class OpFailure extends Error {}

function failure(r: Exclude<WriteResult, { ok: true }>): OpFailure {
  return new OpFailure(r.reason === "invalid" ? `검증 실패 · ${r.issues.map((i) => i.path).join(", ")}` : REASON[r.reason]);
}

function strip(v: Vod): Vod {
  return { title: v.title, url: v.url, date: v.date };
}

async function summaryOf(db: GamesDb, r: WriteResult): Promise<string> {
  if (!r.ok) throw failure(r);
  if (!r.changed) return "변화 없음";
  return (await listChanges(db, r.game.id, 1)).changes[0].summary;
}

async function mustGet(db: GamesDb, id: string) {
  const g = await getGame(db, id, { includeHidden: true });
  if (g === null) throw failure({ ok: false, reason: "not_found" });
  return g;
}

async function moveVods(db: GamesDb, op: Extract<GameOp, { op: "move-vods" }>, ctx: WriteContext, lines: string[]) {
  const src = await mustGet(db, op.from);
  const dst = await mustGet(db, op.to);
  const urlIds = new Set((op.urls ?? []).map(youtubeVideoId));
  const picked = src.vods.filter((v) =>
    op.dates !== undefined ? op.dates.includes(v.date) : op.urls !== undefined ? urlIds.has(youtubeVideoId(v.url)) : true,
  );
  if (picked.length === 0) throw new OpFailure("고른 다시보기가 없어요.");
  const pickedIds = new Set(picked.map((v) => youtubeVideoId(v.url)));
  const dstIds = new Set(dst.vods.map((v) => youtubeVideoId(v.url)));
  lines.push(`다시보기 ${picked.length}편 ${src.id} → ${dst.id}`);
  const added = await updateGame(db, dst.id, { vods: [...dst.vods, ...picked.filter((v) => !dstIds.has(youtubeVideoId(v.url)))].map(strip) }, dst.version, ctx);
  lines.push(`  ${dst.id} · ${await summaryOf(db, added)}`);
  const removed = await updateGame(db, src.id, { vods: src.vods.filter((v) => !pickedIds.has(youtubeVideoId(v.url))).map(strip) }, src.version, ctx);
  lines.push(`  ${src.id} · ${await summaryOf(db, removed)}`);
  if (op.hideFrom === true) lines.push(`  ${src.id} · ${await summaryOf(db, await setHidden(db, src.id, true, ctx))}`);
}

function labelOf(op: GameOp): string {
  switch (op.op) {
    case "add":
      return `추가 ${op.input.name}`;
    case "update":
      return `수정 ${op.id}`;
    case "move-vods":
      return `다시보기 옮기기 ${op.from} → ${op.to}`;
    case "hide":
      return `숨김 ${op.id}`;
    case "unhide":
      return `보이기 ${op.id}`;
  }
}

async function runOne(db: GamesDb, op: GameOp, ctx: WriteContext, lines: string[]): Promise<void> {
  switch (op.op) {
    case "add": {
      const r = await createGame(db, op.input, ctx);
      const summary = await summaryOf(db, r);
      lines.push(`추가 ${(r as Extract<WriteResult, { ok: true }>).game.id} · ${summary}`);
      return;
    }
    case "update": {
      const current = await mustGet(db, op.id);
      lines.push(`수정 ${op.id} · ${await summaryOf(db, await updateGame(db, op.id, op.patch, current.version, ctx))}`);
      return;
    }
    case "move-vods":
      return moveVods(db, op, ctx, lines);
    case "hide":
    case "unhide":
      lines.push(`${labelOf(op)} · ${await summaryOf(db, await setHidden(db, op.id, op.op === "hide", ctx))}`);
      return;
  }
}

/** 작업을 순서대로 적용한다. 하나라도 실패하면 거기서 멈추고 실패를 돌려준다(호출자는 원격에 적용하지 않는다) */
export async function runOps(db: GamesDb, ops: readonly GameOp[], ctx: WriteContext): Promise<OpsResult> {
  const lines: string[] = [];
  for (const [i, op] of ops.entries()) {
    try {
      await runOne(db, op, ctx, lines);
    } catch (e) {
      if (!(e instanceof OpFailure)) throw e;
      return { ok: false, lines, error: `${i + 1}번 작업(${labelOf(op)}): ${e.message}` };
    }
  }
  return { ok: true, lines };
}

const CHANGE_INSERT = /^INSERT INTO game_changes \([^)]*\) (?:SELECT |VALUES \()'([^']+)'/;

/** 기록된 쓰기의 game_changes id들. 원격 적용 뒤 이 id가 모두 있어야 낙관적 잠금에 걸리지 않고 적용된 것이다 */
export function changeIdsOf(writes: readonly string[]): string[] {
  return writes.flatMap((w) => {
    const m = CHANGE_INSERT.exec(w);
    return m === null ? [] : [m[1]];
  });
}
