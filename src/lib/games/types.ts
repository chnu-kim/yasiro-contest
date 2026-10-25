// /games "플레이한 게임" 공유 타입. 로직 없음.
// 이 파일은 scripts/games-add.ts(Node type stripping)에서도 import되므로
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

/** src/data/games.json의 원소 하나. 이 JSON이 정본이다. */
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

/** 사람이 입력하는 부분(CLI 옵션). undefined = "지정 안 함" */
export interface GameDraftInput {
  /** 명시 id. 없으면 slugify(originalTitle) → slugify(categoryId) → slugify(name) */
  id?: string;
  originalTitle?: string;
  /** null = 날짜 기록 없음으로 명시 */
  firstPlayed?: string | null;
  status?: GameStatus;
  vods?: Vod[];
}

/** upsertGame 입력. undefined 필드 = 기존 값 유지(신규면 기본값) */
export interface GameDraft {
  id: string;
  name: string;
  categoryId?: string;
  posterUrl?: string;
  originalTitle?: string;
  firstPlayed?: string | null;
  status?: GameStatus;
  vods: Vod[];
}

export interface UpsertResult {
  games: Game[];
  action: "added" | "updated";
  game: Game;
}

// ---------- CLI 인자(cli-args.ts) ----------

export interface AddArgs {
  query: string;
  /** 1-based 후보 번호. pick·categoryId 둘 다 undefined면 후보만 출력하고 종료.
   *  검색 결과는 실행마다 바뀔 수 있으므로 pick 단독은 dryRun일 때만 허용한다 */
  pick?: number;
  /** 후보의 categoryId. 파일을 쓰는 실행의 기준. pick과 함께 주면 서로 일치해야 한다 */
  categoryId?: string;
  /** 1..50, 기본 20 */
  size: number;
  /** 파일 쓰지 않고 결과 JSON만 출력 */
  dryRun: boolean;
  input: GameDraftInput;
}
