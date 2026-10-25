import type { Game, GameStatus, ValidationIssue, ValidationResult, Vod } from "./types.ts";

export const ID_PATTERN = /^[\p{Ll}\p{Lo}\p{Nd}]+(?:-[\p{Ll}\p{Lo}\p{Nd}]+)*$/u;
export const NAME_MAX = 100;
export const TITLE_MAX = 200;

export function isValidIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d); // Date.UTC would map years 0-99 to 1900s
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);

export function youtubeVideoId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password) return null;
  let id: string | null = null;
  if (YT_HOSTS.has(u.hostname)) {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
  } else if (u.hostname === "youtu.be") {
    id = u.pathname.slice(1);
  }
  return id !== null && VIDEO_ID.test(id) ? id : null;
}

export function isYoutubeUrl(url: unknown): url is string {
  return typeof url === "string" && youtubeVideoId(url) !== null;
}

/** 치지직 다시보기를 넣으려 할 때의 안내. 수정 폼(patch.ts)과 API(youtube 프록시)가 같은 문구를 쓴다 */
export const CHZZK_VOD_MESSAGE = "치지직 다시보기는 한 달 뒤 사라져요. 유튜브 링크만 넣을 수 있어요.";

/** chzzk.naver.com 또는 그 하위 도메인 링크인가. 스킴이 없어도("chzzk.naver.com/video/1") 본다 */
export function isChzzkUrl(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const t = raw.trim();
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z\d+.-]*:/i.test(t) ? t : `https://${t}`);
  } catch {
    return false;
  }
  return u.hostname === "chzzk.naver.com" || u.hostname.endsWith(".chzzk.naver.com");
}

const GAME_KEYS = new Set(["id", "name", "originalTitle", "categoryId", "posterUrl", "firstPlayed", "status", "vods"]);
const VOD_KEYS = new Set(["title", "url", "date"]);
/** 정복 여부 값. 이 순서가 필터 탭 순서다 */
export const GAME_STATUSES: readonly GameStatus[] = ["clear", "fail", "endless", "unknown"];
const STATUSES: readonly string[] = GAME_STATUSES;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** trim한 값이 1~max자면 그 값, 아니면 null. max를 생략하면 비어 있지 않기만 하면 된다 */
function trimmedString(v: unknown, max: number = Number.POSITIVE_INFINITY): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= 1 && t.length <= max ? t : null;
}

/** 포스터 스냅샷 URL: https, 자격 증명 없음, 치지직 이미지 CDN(pstatic.net 또는 그 하위 도메인)만.
 *  검증(schema)과 CLI 스냅샷(chzzk-category)이 같은 규칙을 쓴다. */
export function isPosterUrl(v: unknown): v is string {
  if (typeof v !== "string") return false;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return false;
  }
  const host = u.hostname;
  return (
    u.protocol === "https:" &&
    u.username === "" &&
    u.password === "" &&
    (host === "pstatic.net" || host.endsWith(".pstatic.net"))
  );
}

function validateGame(raw: unknown, i: number, issues: ValidationIssue[]): Game | null {
  const at = `[${i}]`;
  if (!isPlainObject(raw)) {
    issues.push({ path: at, message: "객체여야 합니다" });
    return null;
  }
  const before = issues.length;
  const add = (field: string, message: string) => issues.push({ path: `${at}.${field}`, message });

  for (const k of Object.keys(raw)) {
    if (!GAME_KEYS.has(k)) add(k, "알 수 없는 키");
  }

  const id = raw.id;
  if (typeof id !== "string" || id !== id.trim() || !ID_PATTERN.test(id)) add("id", "소문자/숫자/한글과 하이픈으로 된 slug여야 합니다");

  const name = trimmedString(raw.name, NAME_MAX);
  if (name === null) add("name", `1~${NAME_MAX}자 문자열이어야 합니다`);

  let originalTitle: string | undefined;
  if ("originalTitle" in raw) {
    const t = trimmedString(raw.originalTitle, TITLE_MAX);
    if (t === null) add("originalTitle", `1~${TITLE_MAX}자 문자열이어야 합니다 (없으면 키를 생략)`);
    else if (t === name) add("originalTitle", "name과 같으면 생략해야 합니다");
    else originalTitle = t;
  }

  let categoryId: string | undefined;
  if ("categoryId" in raw) {
    const t = trimmedString(raw.categoryId);
    if (t === null) add("categoryId", "비어 있지 않은 문자열이어야 합니다 (없으면 키를 생략)");
    else categoryId = t;
  }

  let posterUrl: string | undefined;
  if ("posterUrl" in raw) {
    if (isPosterUrl(raw.posterUrl)) posterUrl = raw.posterUrl;
    else add("posterUrl", "치지직 이미지 CDN(pstatic.net)의 https URL이어야 합니다 (없으면 키를 생략)");
  }

  const firstPlayed = raw.firstPlayed;
  if (firstPlayed !== null && !isValidIsoDate(firstPlayed)) add("firstPlayed", "YYYY-MM-DD 또는 null이어야 합니다");

  if (typeof raw.status !== "string" || !STATUSES.includes(raw.status)) add("status", `${GAME_STATUSES.join(" | ")} 중 하나여야 합니다`);

  const vods: Vod[] = [];
  if (!Array.isArray(raw.vods)) add("vods", "배열이어야 합니다");
  else {
    const seenVideos = new Map<string, number>();
    raw.vods.forEach((rv: unknown, j: number) => {
      const vat = `vods[${j}]`;
      if (!isPlainObject(rv)) {
        add(vat, "객체여야 합니다");
        return;
      }
      for (const k of Object.keys(rv)) {
        if (!VOD_KEYS.has(k)) add(`${vat}.${k}`, "알 수 없는 키");
      }
      const title = trimmedString(rv.title, TITLE_MAX);
      if (title === null) add(`${vat}.title`, `1~${TITLE_MAX}자 문자열이어야 합니다`);
      const url = typeof rv.url === "string" ? rv.url.trim() : "";
      const vid = youtubeVideoId(url);
      if (vid === null) add(`${vat}.url`, "유튜브 영상 URL(https://youtu.be/ID 또는 youtube.com/watch?v=ID)이어야 합니다");
      else {
        const first = seenVideos.get(vid);
        if (first !== undefined) add(`${vat}.url`, `같은 영상이 중복됩니다 (vods[${first}]와 같음)`);
        else seenVideos.set(vid, j);
      }
      const date = rv.date;
      if (!isValidIsoDate(date)) add(`${vat}.date`, "YYYY-MM-DD 형식의 실제 날짜여야 합니다");
      else if (isValidIsoDate(firstPlayed) && date < firstPlayed) add(`${vat}.date`, `첫 플레이 날짜(${firstPlayed})보다 이릅니다`);
      if (title !== null && vid !== null && isValidIsoDate(date)) vods.push({ title, url, date });
    });
  }

  if (issues.length > before) return null;
  const game: Game = { id: id as string, name: name as string, firstPlayed: firstPlayed as string | null, status: raw.status as GameStatus, vods };
  if (originalTitle !== undefined) game.originalTitle = originalTitle;
  if (categoryId !== undefined) game.categoryId = categoryId;
  if (posterUrl !== undefined) game.posterUrl = posterUrl;
  return game;
}

export function validateGames(input: unknown): ValidationResult {
  if (!Array.isArray(input)) return { ok: false, issues: [{ path: "", message: "최상위 값은 배열이어야 합니다" }] };
  const issues: ValidationIssue[] = [];
  const games: Game[] = [];
  const seenIds = new Map<string, number>();
  const seenCategories = new Map<string, number>();
  input.forEach((raw: unknown, i: number) => {
    const g = validateGame(raw, i, issues);
    if (g) games.push(g);
    if (!isPlainObject(raw)) return;
    const dup = (seen: Map<string, number>, key: unknown, field: string) => {
      if (typeof key !== "string" || key === "") return;
      const first = seen.get(key);
      if (first === undefined) seen.set(key, i);
      else issues.push({ path: `[${i}].${field}`, message: `${JSON.stringify(key)} 중복 ([${first}]과 같음)` });
    };
    dup(seenIds, raw.id, "id");
    dup(seenCategories, typeof raw.categoryId === "string" ? raw.categoryId.trim() : undefined, "categoryId");
  });
  return issues.length ? { ok: false, issues } : { ok: true, games };
}

/** others(자기 자신 제외 전체 목록, 숨김 포함) + candidate를 validateGames로 검사해 candidate에 관한 이슈만 돌려준다.
 *  candidate를 맨 끝에 둔다(id·categoryId 중복은 뒤에 나온 쪽에 보고된다). 경로의 "[n]" 접두를 떼서
 *  "name", "vods[0].url" 꼴로 돌려주고, 객체가 아니면 경로 "". 다른 게임의 이슈는 버린다.
 *  서버(repo.ts)와 클라이언트(patch.ts)가 같은 규칙으로 검증하기 위한 단일 입구. */
export function validateCandidate(others: readonly Game[], candidate: unknown): ValidationIssue[] {
  const r = validateGames([...others, candidate]);
  if (r.ok) return [];
  const prefix = `[${others.length}]`;
  return r.issues
    .filter((i) => i.path === prefix || i.path.startsWith(`${prefix}.`))
    .map((i) => ({ path: i.path.slice(prefix.length + 1), message: i.message }));
}

export class GamesValidationError extends Error {
  readonly issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    super(issues.map((i) => `${i.path}: ${i.message}`).join("\n"));
    this.name = "GamesValidationError";
    this.issues = issues;
  }
}

export function parseGames(input: unknown): Game[] {
  const r = validateGames(input);
  if (!r.ok) throw new GamesValidationError(r.issues);
  return r.games;
}

const collator = new Intl.Collator("ko", { numeric: true });

function compareCodePoints(a: string, b: string): number {
  const ca = Array.from(a, (c) => c.codePointAt(0) as number);
  const cb = Array.from(b, (c) => c.codePointAt(0) as number);
  const n = Math.min(ca.length, cb.length);
  for (let i = 0; i < n; i++) if (ca[i] !== cb[i]) return ca[i] - cb[i];
  return ca.length - cb.length;
}

/** 이름(ko numeric collation) → id 코드포인트. 모든 정렬(canonical·이름순·오래된순)의 동률 해소 기준 */
export function compareName(a: Game, b: Game): number {
  return collator.compare(a.name, b.name) || compareCodePoints(a.id, b.id);
}

export function compareCanonical(a: Game, b: Game): number {
  if (a.firstPlayed !== b.firstPlayed) {
    if (a.firstPlayed === null) return 1;
    if (b.firstPlayed === null) return -1;
    return a.firstPlayed < b.firstPlayed ? 1 : -1;
  }
  return compareName(a, b);
}

export function serializeGames(games: readonly Game[]): string {
  const valid = parseGames(games);
  const out = [...valid].sort(compareCanonical).map((g) => {
    const o: Record<string, unknown> = { id: g.id, name: g.name };
    if (g.originalTitle !== undefined) o.originalTitle = g.originalTitle;
    if (g.categoryId !== undefined) o.categoryId = g.categoryId;
    if (g.posterUrl !== undefined) o.posterUrl = g.posterUrl;
    o.firstPlayed = g.firstPlayed;
    o.status = g.status;
    o.vods = [...g.vods]
      .sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))
      .map((v) => ({ title: v.title, url: v.url, date: v.date }));
    return o;
  });
  return JSON.stringify(out, null, 2) + "\n";
}
