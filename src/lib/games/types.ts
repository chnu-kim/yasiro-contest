// /games "플레이한 게임" 공유 타입. 로직 없음.
// 이 파일은 scripts/*.ts(Node type stripping)에서도 import되므로
// 런타임 구문(enum, namespace, 생성자 parameter property)을 쓰지 않는다.

/** 정복 여부. clear=정복(원형 도장), fail=정복 못함(점선 칩), endless=끝없는 탐험(정복 개념이 없는 온라인 게임, 칩),
 *  unknown=모름(카드 표시 없음, 상세 "기록 없음") */
export type GameStatus = "clear" | "fail" | "endless" | "unknown";

/** 유튜브 다시보기 한 편. 치지직 다시보기 URL은 금지(한 달 뒤 삭제) */
export interface Vod {
  /** 영상 제목. trim 후 1~200자 */
  title: string;
  /** https://(www.|m.)youtube.com/watch?v=<11자 ID>[&...] 또는 https://youtu.be/<11자 ID>[?...] */
  url: string;
  /** 업로드/방송 날짜 YYYY-MM-DD (실재하는 날짜) */
  date: string;
}

/** 게임 한 개의 기록 필드. 정본은 D1 games + game_vods 테이블(0007). games.json 형식(serializeGames)도 이 모양이다. */
export interface Game {
  /** 고유 slug. ^[\p{Ll}\p{Lo}\p{Nd}]+(-[\p{Ll}\p{Lo}\p{Nd}]+)*$ (u). 한글 slug 허용 */
  id: string;
  /** 치지직 표기 이름(대개 한글). trim 후 1~100자 */
  name: string;
  /** 원제. 있으면 trim 후 1~200자, name과 같으면 안 됨(생략해야 함) */
  originalTitle?: string;
  /** 치지직 categoryId. 있으면 목록 안에서 고유 */
  categoryId?: string;
  /** 치지직 포스터 스냅샷. https + pstatic.net(하위 도메인 포함) + 자격 증명 없음 (isPosterUrl) */
  posterUrl?: string;
  /** 첫 플레이 날짜 YYYY-MM-DD. null = 날짜 기록 없음 */
  firstPlayed: string | null;
  status: GameStatus;
  /** 날짜 오름차순(serializeGames가 정렬). 빈 배열 가능 */
  vods: Vod[];
}

// ---------- 목록 조회(query.ts) ----------

export type StatusFilter = "all" | GameStatus;
/** "all" | "YYYY" | "none"(날짜 기록 없음) */
export type YearFilter = "all" | "none" | `${number}`;
export type SortKey = "recent" | "old" | "name";

/** URL 쿼리(q, status, year, sort, page)와 1:1 대응하는 목록 상태 */
export interface GamesQueryState {
  q: string;
  status: StatusFilter;
  year: YearFilter;
  sort: SortKey;
  /** 1부터. 상한은 paginate가 pageCount로 clamp */
  page: number;
}

/** parseQueryState 입력. Next 16 page의 await searchParams 결과 또는 URLSearchParams */
export type QueryInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

/** 전체 목록의 고정 순서(canonical)로 부여한 탐험 번호가 붙은 게임 */
export interface IndexedGame extends Game {
  /** 1..N. canonical 순서의 마지막(가장 오래된/날짜 없음 끝)이 1, 맨 앞이 N */
  ordinal: number;
  /** ordinal을 3자리 0 패딩한 문자열 ("031"). 1000 이상은 패딩 없이 그대로 */
  no: string;
}

export interface Page<T> {
  items: T[];
  /** clamp된 현재 페이지(1..pageCount) */
  page: number;
  /** 최소 1 (결과 0개여도 1) */
  pageCount: number;
  /** 필터 후 전체 개수 */
  total: number;
  /** items[0]의 0-based 위치. total=0이면 0 */
  start: number;
  /** 마지막 항목 다음 위치(exclusive). total=0이면 0 */
  end: number;
}

export interface GameStats {
  total: number;
  clear: number;
  fail: number;
  endless: number;
  unknown: number;
  /** firstPlayed === null 개수 */
  undated: number;
}

export interface YearOptions {
  /** 실재하는 연도(문자열) 내림차순, 중복 없음 */
  years: `${number}`[];
  /** firstPlayed === null 게임이 하나라도 있는가 ("none" 옵션 노출 여부) */
  hasUndated: boolean;
}

// ---------- 검증(schema.ts) ----------

export interface ValidationIssue {
  /** "[3].vods[0].url" 형태. 목록 자체 문제는 "" */
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; games: Game[] }
  | { ok: false; issues: ValidationIssue[] };

// ---------- 치지직 카테고리(chzzk-category.ts) ----------

export interface ChzzkCategoryConfig {
  clientId: string;
  clientSecret: string;
  /** 기본 "https://openapi.chzzk.naver.com". 끝 슬래시 허용 */
  baseUrl?: string;
}

/** searchCategories 결과 한 건. GAME 타입만 남긴다 */
export interface ChzzkCategory {
  categoryType: "GAME";
  categoryId: string;
  categoryValue: string;
  /** isPosterUrl(https, pstatic.net, 자격 증명 없음)을 통과하지 못하면 null */
  posterImageUrl: string | null;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

// ====================================================================================
// D1 전환 + 관리자 수정 (contract: scratchpad/games-admin-contract.md)
// ====================================================================================

// ---------- D1 최소 인터페이스 ----------
// lib/games는 전역 D1Database 대신 이 인터페이스에만 의존한다. 실제 env.DB와 test-d1.ts 대역이 둘 다 만족한다.

export interface GamesDbResult<T = unknown> {
  results: T[];
  success: boolean;
  /** changes = 영향받은 행 수(쓰기 문장) */
  meta: { changes?: number; last_row_id?: number; [key: string]: unknown };
}

export interface GamesDbStatement {
  /** undefined는 바인딩할 수 없다(D1도 던진다). boolean 대신 0/1을 넘긴다 */
  bind(...values: unknown[]): GamesDbStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<GamesDbResult<T>>;
  run(): Promise<GamesDbResult>;
}

export interface GamesDb {
  prepare(query: string): GamesDbStatement;
  /** 한 트랜잭션. 한 문장이라도 에러면 전부 롤백. 0행에 적용된 UPDATE는 에러가 아니다 */
  batch(statements: GamesDbStatement[]): Promise<GamesDbResult[]>;
}

// ---------- D1 행(snake_case, SELECT 결과 그대로) ----------

export interface GameRow {
  id: string;
  name: string;
  original_title: string | null;
  category_id: string | null;
  poster_url: string | null;
  first_played: string | null;
  status: GameStatus;
  hidden: 0 | 1;
  version: number;
  created_at: number;
  updated_at: number;
  updated_by_name: ActorName;
  // write_token, updated_by_channel_id는 SELECT하지 않는다(응답으로 새지 않게)
}

export interface VodRow {
  game_id: string;
  video_id: string;
  url: string;
  title: string;
  date: string;
  /** 게임 안 순서(0부터). 조회는 ORDER BY date, position */
  position: number;
}

export type ChangeAction = "import" | "create" | "update" | "hide" | "unhide";

export interface ChangeRow {
  id: string;
  game_id: string;
  actor_name: ActorName;
  action: ChangeAction;
  summary: string;
  created_at: number;
  // channel_id, before_json, after_json은 목록 조회에서 SELECT하지 않는다
}

// ---------- 도메인 레코드 ----------

/** 수정자 표시 이름. 채널 ID → 고정 별칭(admin.ts actorNameFor)으로만 정한다. 세션 channel_name은 절대 쓰지 않는다 */
export type ActorName = "야시로" | "관리자" | "시스템";

/** 관리자에게 보내는 게임 한 개. 방문자에게는 Game(이 메타 없이)만 보낸다 */
export interface GameRecord extends Game {
  hidden: boolean;
  version: number;
  /** unix seconds */
  createdAt: number;
  /** unix seconds */
  updatedAt: number;
  updatedByName: ActorName;
}

/** game_changes.before_json / after_json에 들어가는 스냅샷. 수정자 정보는 넣지 않는다 */
export interface GameSnapshot extends Game {
  hidden: boolean;
}

/** 변경 기록 한 줄(API 응답·UI). channel_id는 절대 포함하지 않는다 */
export interface ChangeEntry {
  id: string;
  action: ChangeAction;
  /** "정복 여부 모름 → 정복" 같은 사람용 요약 (diff.ts changeSummary) */
  summary: string;
  actorName: ActorName;
  /** unix seconds */
  createdAt: number;
}

/** 쓰기 주체. channelId는 감사 컬럼에만 저장하고 응답·로그로 내보내지 않는다 */
export interface Actor {
  channelId: string;
  name: Exclude<ActorName, "시스템">;
}

/** repo 쓰기 함수에 주입하는 문맥. 테스트에서 시각·ID를 고정할 수 있게 한다 */
export interface WriteContext {
  actor: Actor;
  /** unix seconds */
  now: number;
  /** game_changes.id, write_token 생성용 (운영: crypto.randomUUID) */
  uuid: () => string;
}

/** 게임 추가 입력(POST /api/games). id는 서버가 allocateGameId로 만든다 */
export interface GameInput {
  name: string;
  originalTitle?: string;
  categoryId?: string;
  posterUrl?: string;
  firstPlayed: string | null;
  status: GameStatus;
  vods: Vod[];
}

/** 치지직 카테고리 연결. posterUrl null = 카테고리는 있으나 포스터 없음(표본 라벨) */
export interface CategoryLink {
  categoryId: string;
  posterUrl: string | null;
}

/** 수정 입력(PATCH /api/games/[id]). 키 없음 = 그대로, null = 비우기. id는 바꿀 수 없다 */
export interface GamePatch {
  name?: string;
  originalTitle?: string | null;
  /** null = 연결 해제(categoryId·posterUrl 둘 다 제거 → 표본 라벨) */
  category?: CategoryLink | null;
  firstPlayed?: string | null;
  status?: GameStatus;
  /** 전체 교체. 순서는 서버가 날짜 오름차순으로 정렬 */
  vods?: Vod[];
}

/** diff·요약·"바뀐 항목" 라벨의 단위 */
export type GameField = "name" | "originalTitle" | "category" | "firstPlayed" | "status" | "vods";

// ---------- repo.ts 결과 ----------

export type WriteResult =
  | { ok: true; game: GameRecord; changed: boolean }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid"; issues: ValidationIssue[] }
  /** expectedVersion 불일치. latest = 지금 DB의 게임(최종 수정자 별칭 포함) */
  | { ok: false; reason: "conflict"; latest: GameRecord };

export interface ChangeList {
  changes: ChangeEntry[];
  /** 이 게임의 전체 기록 수(limit과 무관) */
  total: number;
}

// ---------- admin.ts ----------

export type SessionState =
  | { kind: "anonymous" }
  /** 세션 쿠키(__Host-session)는 있으나 유효한 세션 행이 없음(만료·로그아웃) */
  | { kind: "expired" }
  /** 로그인했지만 관리자가 아님 */
  | { kind: "user" }
  | { kind: "admin"; actor: Actor };

// ---------- 폼(patch.ts) ----------

/** 수정 모드 폼 상태. 문자열 입력은 trim 전 원문 */
export interface GameForm {
  name: string;
  /** "" = 원제 없음 */
  originalTitle: string;
  /** null = 치지직 카테고리 연결 없음(표본 라벨) */
  category: CategoryLink | null;
  /** YYYY-MM-DD 또는 "" (input[type=date] 값) */
  firstPlayed: string;
  /** "날짜 기록 없음" 체크. true면 firstPlayed는 무시하고 null로 저장 */
  undated: boolean;
  status: GameStatus;
  vods: Vod[];
}

/** 폼 필드 키. 다시보기는 index 포함 (DOM id: fieldDomId) */
export type FormFieldKey =
  | "name"
  | "originalTitle"
  | "category"
  | "firstPlayed"
  | "status"
  | "vods"
  | `vods.${number}.title`
  | `vods.${number}.url`
  | `vods.${number}.date`;

export type FormFix = { kind: "setFirstPlayed"; date: string };

export interface FormIssue {
  field: FormFieldKey;
  /** 요약 링크 문구: "이름", "다시보기 링크", "다시보기 날짜" */
  label: string;
  /** 사용자용 한국어 메시지 */
  message: string;
  /** "첫 플레이를 2025.07.20으로" 같은 원클릭 수정 */
  fix?: FormFix;
}

/** localStorage['yasiro-games-draft:<gameId|new>'] 값 */
export interface GameDraftStore {
  form: GameForm;
  /** 편집을 시작한 시점의 version. 새 게임이면 null */
  baseVersion: number | null;
  /** unix ms */
  savedAt: number;
}

// ---------- youtube-meta.ts ----------

export interface YoutubeMeta {
  videoId: string;
  /** 정규화: https://www.youtube.com/watch?v=<id> */
  url: string;
  /** oEmbed title, trim, TITLE_MAX로 자름 */
  title: string;
  /** 제목의 [ YYYY. MM. DD ]에서 읽은 날짜. 못 읽으면 null */
  date: string | null;
}

// ---------- API (api.ts) ----------

export type ApiErrorCode =
  | "bad_request"
  | "bad_json"
  | "payload_too_large"
  | "login_required"
  | "session_expired"
  | "forbidden"
  | "cross_origin"
  | "not_found"
  | "conflict"
  | "invalid"
  | "chzzk_vod"
  | "upstream"
  | "unavailable";

export interface ApiError {
  error: { code: ApiErrorCode; message: string };
}

/** 422 */
export interface ApiInvalid extends ApiError {
  issues: ValidationIssue[];
}

/** 409. message 예: "관리자가 방금(14:02) 이 게임을 먼저 고쳤어요." */
export interface ApiConflict extends ApiError {
  latest: GameRecord;
}

/** GET /api/games */
export interface ListGamesResponse {
  /** 방문자·비관리자: Game[] (숨김 제외). 관리자 + ?includeHidden=1: GameRecord[] */
  games: Game[] | GameRecord[];
}

/** POST /api/games 본문 */
export interface CreateGameRequest {
  input: GameInput;
}

/** PATCH /api/games/[id] 본문 */
export interface UpdateGameRequest {
  expectedVersion: number;
  patch: GamePatch;
}

/** POST /api/games/[id]/hidden 본문 */
export interface SetHiddenRequest {
  hidden: boolean;
}

/** POST(201)·PATCH(200)·hidden(200) 응답 */
export interface GameWriteResponse {
  game: GameRecord;
  /** false = 바뀐 것이 없어 쓰지 않음(version 그대로) */
  changed: boolean;
}

/** GET /api/games/[id]/changes */
export type ChangesResponse = ChangeList;

/** GET /api/games/categories?q= 결과 한 건 */
export interface CategorySearchItem {
  categoryId: string;
  /** 치지직 categoryValue */
  name: string;
  posterUrl: string | null;
  /** 이미 목록에 있으면 그 게임(숨김 포함). UI는 비활성 + "이미 목록에 있어요" */
  taken: { id: string; name: string; hidden: boolean } | null;
}

export interface CategorySearchResponse {
  results: CategorySearchItem[];
}

/** GET /api/games/youtube?url= */
export type YoutubeMetaResponse = YoutubeMeta;

/** /games 서버 컴포넌트 → 클라이언트 */
export type GamesPageData =
  | { ok: true; admin: null; games: Game[] }
  | { ok: true; admin: { name: Actor["name"] }; games: GameRecord[] }
  /** D1 없음(pnpm dev)·D1 오류. UI는 "기록을 불러오지 못했어요" */
  | { ok: false };
