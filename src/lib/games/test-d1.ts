// 테스트 전용 D1 대역. node:sqlite(DatabaseSync, Node 22.5+)로 GamesDb 인터페이스를 흉내 낸다.
// 앱·Worker 코드에서 import하지 않는다(커버리지 제외: vitest.config.ts).
//
// D1과 맞춘 동작:
// - bind(undefined)는 던진다. boolean도 던진다(lib 코드가 0/1을 명시적으로 넘기게 강제).
// - first()는 첫 행 또는 null, all()은 { results, success, meta }, run()은 meta.changes·last_row_id.
// - batch()는 한 트랜잭션. 하나라도 던지면 전부 롤백하고 그 에러를 다시 던진다.
// - 문장당 바인딩은 100개까지(D1 한도). 넘으면 던진다.
// - 외래 키 강제(PRAGMA foreign_keys = ON). 결과 행은 일반 객체(null prototype 아님).
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { GamesDb, GamesDbResult, GamesDbStatement } from "./types.ts";

const MIGRATIONS_DIR = new URL("../../../migrations/", import.meta.url);

/** D1의 문장당 바인딩 파라미터 한도 */
export const D1_MAX_BINDINGS = 100;

type SqlValue = null | number | bigint | string | Uint8Array;

function toSqlValue(v: unknown, index: number): SqlValue {
  if (v === undefined) throw new TypeError(`D1_TYPE_ERROR: Type 'undefined' not supported for value at ?${index + 1}`);
  if (typeof v === "boolean") throw new TypeError(`test-d1: boolean at ?${index + 1} — bind 0/1 explicitly`);
  if (v === null || typeof v === "number" || typeof v === "bigint" || typeof v === "string" || v instanceof Uint8Array) return v;
  throw new TypeError(`D1_TYPE_ERROR: Type '${typeof v}' not supported for value at ?${index + 1}`);
}

function plain(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row };
}

/** SELECT/WITH/VALUES/PRAGMA 또는 RETURNING이 있으면 행을 돌려주는 문장으로 본다 */
function returnsRows(sql: string): boolean {
  const head = sql.replace(/^(\s|--[^\n]*\n)+/, "").slice(0, 8).toUpperCase();
  return /^(SELECT|WITH|VALUES|PRAGMA)/.test(head) || /\bRETURNING\b/i.test(sql);
}

class TestStatement implements GamesDbStatement {
  // erasableSyntaxOnly: 생성자 parameter property를 쓰지 않는다
  private readonly sqlite: DatabaseSync;
  readonly sql: string;
  private readonly params: SqlValue[];

  constructor(sqlite: DatabaseSync, sql: string, params: SqlValue[] = []) {
    this.sqlite = sqlite;
    this.sql = sql;
    this.params = params;
  }

  bind(...values: unknown[]): GamesDbStatement {
    if (values.length > D1_MAX_BINDINGS) throw new RangeError(`D1_ERROR: too many SQL variables (${values.length} > ${D1_MAX_BINDINGS})`);
    return new TestStatement(this.sqlite, this.sql, values.map(toSqlValue));
  }

  /** batch용 동기 실행 */
  execute(): GamesDbResult<Record<string, unknown>> {
    const stmt = this.sqlite.prepare(this.sql);
    if (returnsRows(this.sql)) {
      const results = stmt.all(...this.params).map(plain);
      return { results, success: true, meta: { changes: 0 } };
    }
    const r = stmt.run(...this.params);
    return { results: [], success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const row = this.sqlite.prepare(this.sql).get(...this.params);
    return row === undefined ? null : (plain(row) as T);
  }

  async all<T = Record<string, unknown>>(): Promise<GamesDbResult<T>> {
    return this.execute() as GamesDbResult<T>;
  }

  async run(): Promise<GamesDbResult> {
    return this.execute();
  }
}

export interface TestD1 {
  db: GamesDb;
  /** 직접 검사용(테스트 assert). lib 코드에 넘기지 않는다 */
  sqlite: DatabaseSync;
  /** 지금까지 batch()가 호출된 횟수(원자성 테스트용) */
  batchCalls: () => number;
  close: () => void;
}

/** 빈 메모리 DB. 스키마는 applyMigrations로 올린다 */
export function createTestD1(): TestD1 {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  let batches = 0;
  const db: GamesDb = {
    prepare: (query) => new TestStatement(sqlite, query),
    async batch(statements) {
      batches += 1;
      sqlite.exec("BEGIN");
      try {
        const out = statements.map((s) => {
          if (!(s instanceof TestStatement)) throw new TypeError("test-d1: foreign statement in batch");
          return s.execute();
        });
        sqlite.exec("COMMIT");
        return out;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { db, sqlite, batchCalls: () => batches, close: () => sqlite.close() };
}

/** migrations/ 의 파일을 이름 순서대로 적용한다. 기본: sessions(0001) + games(0007). 시드는 명시해서 넣는다 */
export function applyMigrations(
  d1: TestD1,
  files: readonly string[] = ["0001_sessions.sql", "0007_games.sql"],
): void {
  for (const f of files) d1.sqlite.exec(readFileSync(new URL(f, MIGRATIONS_DIR), "utf8"));
}

/** 0001 + 0007이 적용된 새 DB */
export function createGamesTestDb(extra: readonly string[] = []): TestD1 {
  const d1 = createTestD1();
  applyMigrations(d1, ["0001_sessions.sql", "0007_games.sql", ...extra]);
  return d1;
}

export interface TestSession {
  id: string;
  channelId: string;
  /** 실명 대역. 관리자 익명 테스트에서 이 문자열이 저장·응답에 나오지 않음을 확인한다 */
  channelName: string;
  /** unix seconds */
  expiresAt: number;
}

export function insertSession(d1: TestD1, s: TestSession): void {
  d1.sqlite
    .prepare(
      "INSERT INTO sessions (id, channel_id, channel_name, access_token, refresh_token, expires_at) VALUES (?, ?, ?, 'at', 'rt', ?)",
    )
    .run(s.id, s.channelId, s.channelName, s.expiresAt);
}

/** DB 전체(모든 테이블·모든 TEXT 컬럼)에서 needle이 들어간 값을 찾는다. 익명 테스트용 */
export function findStringAnywhere(d1: TestD1, needle: string, tables: readonly string[] = ["games", "game_vods", "game_changes"]): string[] {
  const hits: string[] = [];
  for (const t of tables) {
    for (const row of d1.sqlite.prepare(`SELECT * FROM ${t}`).all()) {
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === "string" && v.includes(needle)) hits.push(`${t}.${k}`);
      }
    }
  }
  return hits;
}

/** 테스트용 가짜 채널 ID(32 hex). 실제 관리자 ID를 테스트·픽스처에 쓰지 않는다 */
export const FAKE_ADMIN_ID = "0123456789abcdef0123456789abcdef";
export const FAKE_USER_ID = "fedcba9876543210fedcba9876543210";
