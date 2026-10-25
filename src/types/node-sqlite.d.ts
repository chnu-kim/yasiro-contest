// @types/node ^20에는 node:sqlite 선언이 없다. 테스트 전용 D1 대역(src/lib/games/test-d1.ts)이 쓰는 부분만 선언한다.
// Node 22.5+ 내장 모듈. 앱·Worker 코드에서는 import하지 않는다.
declare module "node:sqlite" {
  type SQLInputValue = null | number | bigint | string | Uint8Array;
  interface StatementResultingChanges {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }
  class StatementSync {
    run(...params: SQLInputValue[]): StatementResultingChanges;
    get(...params: SQLInputValue[]): Record<string, unknown> | undefined;
    all(...params: SQLInputValue[]): Record<string, unknown>[];
  }
  class DatabaseSync {
    constructor(path: string, options?: { open?: boolean; enableForeignKeyConstraints?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
    readonly isTransaction: boolean;
  }
}
