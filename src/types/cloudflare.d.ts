interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1ExecResult>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName: string): Promise<T | null>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(): Promise<T[]>;
}

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  error?: string;
  /** D1이 실제로 채우는 값 중 lib/games가 쓰는 것만 명시. changes = 영향받은 행 수 */
  meta: { changes?: number; last_row_id?: number; duration?: number; [key: string]: unknown };
}

interface D1ExecResult {
  count: number;
  duration: number;
}

interface CloudflareEnv {
  DB: D1Database;
  /** /games 관리자 채널 ID 허용 목록(쉼표 구분). Worker secret — 저장소(공개)에 값을 커밋하지 않는다.
   *  없으면 야시로 채널만 관리자. 로컬은 .dev.vars(1Password 마운트)에 사람이 추가한다 */
  ADMIN_CHANNEL_IDS?: string;
}
