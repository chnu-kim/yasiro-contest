// 관리자 UI가 쓰는 응답 해석·문구. 순수 함수(fetch 자체는 컴포넌트 쪽 얇은 래퍼가 한다).
import { issuesToFormIssues } from "./patch.ts";
import { conflictMessage } from "./diff.ts";
import { formatDate } from "./query.ts";
import type { FormIssue, GameForm, GameRecord, ValidationIssue } from "./types.ts";

/** 받침이 있다고 읽는 숫자(영·일·삼·육·칠·팔) */
const DIGIT_WITH_FINAL = new Set(["0", "1", "3", "6", "7", "8"]);

/** 마지막 글자(한글 또는 숫자)의 받침에 맞는 을/를. 정할 수 없으면 null(영문 등) */
export function eulReul(name: string): "을" | "를" | null {
  const t = name.trim();
  const ch = t.at(-1);
  if (ch === undefined) return null;
  if (/[0-9]/.test(ch)) return DIGIT_WITH_FINAL.has(ch) ? "을" : "를";
  const code = ch.codePointAt(0) as number;
  if (code < 0xac00 || code > 0xd7a3) return null;
  return (code - 0xac00) % 28 === 0 ? "를" : "을";
}

/** "이름을 …" 문구. 조사를 정할 수 없으면 "‘이름’ …"(을(를) 같은 자리표시를 쓰지 않는다) */
function withObject(name: string, rest: string): string {
  const p = eulReul(name);
  return p === null ? `‘${name}’ ${rest}` : `${name}${p} ${rest}`;
}

export function savedMessage(name: string): string {
  return withObject(name, "저장했어요.");
}

export function addedMessage(name: string): string {
  return withObject(name, "목록에 추가했어요.");
}

export function hiddenMessage(name: string): string {
  return withObject(name, "목록에서 숨겼어요.");
}

export function unhiddenMessage(name: string): string {
  return withObject(name, "다시 보이게 했어요.");
}

/** "첫 플레이를 2025.07.20으로" 버튼 문구. 날짜 끝 숫자의 받침에 따라 으로/로(0·3만 받침이 있다) */
export function fixLabel(isoDate: string): string {
  const last = isoDate.at(-1);
  return `첫 플레이를 ${formatDate(isoDate)}${last === "0" || last === "3" ? "으로" : "로"}`;
}

/** 이슈 요약 링크 문구. 다시보기 항목은 몇 번째인지 덧붙인다 */
export function issueLinkLabel(issue: FormIssue): string {
  const m = /^vods\.(\d+)\./.exec(issue.field);
  return m === null ? issue.label : `${issue.label} (${Number(m[1]) + 1}번째)`;
}

/** 다시 로그인한 뒤 돌아올 주소. 안쪽 ?가 파싱을 깨지 않게 인코딩한다 */
export function loginHref(gameId: string | null): string {
  const next = gameId === null ? "/games" : `/games?game=${gameId}`;
  return `/auth/login?next=${encodeURIComponent(next)}`;
}

export type WriteFailure =
  | { kind: "login"; message: string }
  | { kind: "expired"; message: string }
  | { kind: "forbidden"; message: string }
  | { kind: "conflict"; message: string; latest: GameRecord }
  | { kind: "invalid"; message: string; issues: FormIssue[] }
  | { kind: "missing"; message: string }
  | { kind: "other"; message: string };

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 오류 응답 본문의 error.message. 없으면 fallback */
export function errorMessage(body: unknown, fallback: string): string {
  if (isObj(body) && isObj(body.error) && typeof body.error.message === "string" && body.error.message !== "") return body.error.message;
  return fallback;
}

function errorCode(body: unknown): string | null {
  return isObj(body) && isObj(body.error) && typeof body.error.code === "string" ? body.error.code : null;
}

function isRecord(v: unknown): v is GameRecord {
  return isObj(v) && typeof v.id === "string" && typeof v.version === "number" && typeof v.updatedAt === "number" && typeof v.updatedByName === "string";
}

function isIssue(v: unknown): v is ValidationIssue {
  return isObj(v) && typeof v.path === "string" && typeof v.message === "string";
}

/** 쓰기(POST/PATCH) 실패 응답 → UI가 보여 줄 상태. form이 있으면 422 이슈를 폼 이슈로 바꾼다 */
export function classifyFailure(status: number, body: unknown, form: GameForm | null): WriteFailure {
  const code = errorCode(body);
  const message = errorMessage(body, "잠시 후 다시 시도해 주세요.");
  if (status === 0) return { kind: "other", message: "네트워크에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." };
  if (status === 401) {
    return code === "session_expired"
      ? { kind: "expired", message: "로그인이 만료됐어요. 다시 로그인해도 입력한 내용은 이 기기에 남아 있어요." }
      : { kind: "login", message: "관리자 로그인이 필요해요." };
  }
  if (status === 403) return { kind: "forbidden", message: "수정 권한이 없어요." };
  if (status === 404) return { kind: "missing", message: "이 게임을 찾지 못했어요. 목록에서 사라졌을 수 있어요." };
  if (status === 409 && isObj(body) && isRecord(body.latest)) {
    return { kind: "conflict", message: conflictMessage(body.latest), latest: body.latest };
  }
  if (status === 422 && isObj(body) && Array.isArray(body.issues)) {
    const issues = body.issues.filter(isIssue);
    return { kind: "invalid", message, issues: issuesToFormIssues(issues, form ?? emptyForm()) };
  }
  return { kind: "other", message };
}

function emptyForm(): GameForm {
  return { name: "", originalTitle: "", category: null, firstPlayed: "", undated: false, status: "unknown", vods: [] };
}
