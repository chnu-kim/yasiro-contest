// 수정 모드 폼 로직(클라이언트). 서버(repo.ts)와 같은 validateCandidate·diffGames를 쓴다. 순수 함수.
import { diffGames, FIELD_LABEL, FIELD_ORDER } from "./diff.ts";
import { formatDate } from "./query.ts";
import { CHZZK_VOD_MESSAGE, GAME_STATUSES, isChzzkUrl, isValidIsoDate, validateCandidate } from "./schema.ts";
import type {
  CategoryLink,
  Game,
  GameDraftStore,
  GameField,
  GameForm,
  GameInput,
  GamePatch,
  FormFieldKey,
  FormFix,
  FormIssue,
  ValidationIssue,
  Vod,
} from "./types.ts";

/** 새 게임을 검증할 때 쓰는 자리표시 id. 서버가 실제 id를 할당하므로 id 이슈는 버린다 */
const NEW_ID = "new-game";

export function gameToForm(game: Game | null): GameForm {
  if (game === null) {
    return { name: "", originalTitle: "", category: null, firstPlayed: "", undated: false, status: "unknown", vods: [] };
  }
  return {
    name: game.name,
    originalTitle: game.originalTitle ?? "",
    category: game.categoryId === undefined ? null : { categoryId: game.categoryId, posterUrl: game.posterUrl ?? null },
    firstPlayed: game.firstPlayed ?? "",
    undated: game.firstPlayed === null,
    status: game.status,
    vods: game.vods.map((v) => ({ title: v.title, url: v.url, date: v.date })),
  };
}

export function formToRaw(id: string, form: GameForm): Record<string, unknown> {
  const raw: Record<string, unknown> = { id, name: form.name.trim() };
  const originalTitle = form.originalTitle.trim();
  if (originalTitle !== "") raw.originalTitle = originalTitle;
  if (form.category !== null) {
    raw.categoryId = form.category.categoryId;
    if (form.category.posterUrl !== null) raw.posterUrl = form.category.posterUrl;
  }
  raw.firstPlayed = form.undated ? null : form.firstPlayed;
  raw.status = form.status;
  raw.vods = form.vods.map((v) => ({ title: v.title.trim(), url: v.url.trim(), date: v.date }));
  return raw;
}

/** 검증을 통과한 폼 → 게임 추가 입력 */
export function formToInput(form: GameForm): GameInput {
  const raw = formToRaw(NEW_ID, form);
  const { id: _id, ...input } = raw;
  void _id;
  return input as unknown as GameInput;
}

/** base와 달라진 필드만 담은 PATCH 본문 */
export function formToPatch(base: Game, form: GameForm): GamePatch {
  const raw = formToRaw(base.id, form) as unknown as Game;
  const patch: GamePatch = {};
  for (const field of diffGames(base, raw)) {
    switch (field) {
      case "name":
        patch.name = raw.name;
        break;
      case "originalTitle":
        patch.originalTitle = raw.originalTitle ?? null;
        break;
      case "category":
        patch.category = form.category === null ? null : { categoryId: form.category.categoryId, posterUrl: form.category.posterUrl };
        break;
      case "firstPlayed":
        patch.firstPlayed = raw.firstPlayed;
        break;
      case "status":
        patch.status = raw.status;
        break;
      case "vods":
        patch.vods = raw.vods;
        break;
    }
  }
  return patch;
}

/** 바뀐 필드. base가 null(추가)이면 비어 있지 않은 필드 */
export function changedFields(base: Game | null, form: GameForm): GameField[] {
  if (base !== null) return diffGames(base, formToRaw(base.id, form) as unknown as Game);
  const filled: Record<GameField, boolean> = {
    name: form.name.trim() !== "",
    originalTitle: form.originalTitle.trim() !== "",
    category: form.category !== null,
    firstPlayed: form.undated || form.firstPlayed !== "",
    status: form.status !== "unknown",
    vods: form.vods.length > 0,
  };
  return FIELD_ORDER.filter((f) => filled[f]);
}

export function changedLabels(fields: readonly GameField[]): string[] {
  return fields.map((f) => FIELD_LABEL[f]);
}

/** 첫 플레이보다 이른 다시보기가 있으면 그중 가장 이른 날짜(원클릭 수정 제안) */
export function suggestFirstPlayed(form: GameForm): string | null {
  if (form.undated || !isValidIsoDate(form.firstPlayed)) return null;
  let earliest: string | null = null;
  for (const v of form.vods) {
    if (isValidIsoDate(v.date) && v.date < form.firstPlayed && (earliest === null || v.date < earliest)) earliest = v.date;
  }
  return earliest;
}

export function applyFix(form: GameForm, fix: FormFix): GameForm {
  return { ...form, firstPlayed: fix.date, undated: false };
}

export function fieldDomId(key: FormFieldKey): string {
  return `game-edit-${key.replaceAll(".", "-")}`;
}

export function issuesHeadline(issues: readonly FormIssue[]): string {
  return `고칠 곳이 ${issues.length}개 있어요`;
}

const VOD_PATH = /^vods\[(\d+)\]\.(title|url|date)$/;
const VOD_PART_RANK = { title: 0, url: 1, date: 2 } as const;

function fieldRank(field: FormFieldKey): number {
  const m = /^vods\.(\d+)\.(title|url|date)$/.exec(field);
  if (m !== null) return FIELD_ORDER.indexOf("vods") * 1000 + 1 + Number(m[1]) * 3 + VOD_PART_RANK[m[2] as keyof typeof VOD_PART_RANK];
  return FIELD_ORDER.indexOf(field as GameField) * 1000;
}

function toFormIssue(issue: ValidationIssue, form: GameForm): FormIssue {
  const { path, message } = issue;
  switch (path) {
    case "name":
      return { field: "name", label: "이름", message: "이름을 1~100자로 넣어 주세요." };
    case "originalTitle":
      return {
        field: "originalTitle",
        label: "원제",
        message: message.includes("name과 같으면") ? "원제가 이름과 같으면 비워 두세요." : "원제는 200자까지 넣을 수 있어요.",
      };
    case "categoryId":
      return {
        field: "category",
        label: "치지직 카테고리",
        message: message.includes("중복") ? "이미 목록에 있는 카테고리예요." : "카테고리를 다시 골라 주세요.",
      };
    case "posterUrl":
      return { field: "category", label: "치지직 카테고리", message: "포스터 주소가 올바르지 않아요. 카테고리를 다시 골라 주세요." };
    case "firstPlayed":
      return { field: "firstPlayed", label: "첫 플레이", message: "날짜를 넣거나 '날짜 기록 없음'을 골라 주세요." };
    case "status":
      return { field: "status", label: "정복 여부", message: "정복 여부를 골라 주세요." };
    case "vods":
      return { field: "vods", label: "다시보기", message: "다시보기 목록이 올바르지 않아요." };
  }
  const m = VOD_PATH.exec(path);
  if (m === null) return { field: "name", label: "기록", message };
  const i = Number(m[1]);
  const part = m[2] as "title" | "url" | "date";
  const field = `vods.${i}.${part}` as FormFieldKey;
  if (part === "title") return { field, label: "다시보기 제목", message: "제목을 1~200자로 넣어 주세요." };
  if (part === "url") {
    const text = isChzzkUrl(form.vods[i]?.url)
      ? CHZZK_VOD_MESSAGE
      : message.includes("중복")
        ? "같은 영상이 이미 있어요."
        : "유튜브 영상 링크(youtube.com/watch?v=… 또는 youtu.be/…)를 넣어 주세요.";
    return { field, label: "다시보기 링크", message: text };
  }
  if (message.includes("보다 이릅니다")) {
    const date = suggestFirstPlayed(form);
    const base = { field, label: "다시보기 날짜", message: `첫 플레이(${formatDate(form.firstPlayed)})보다 빨라요.` };
    return date === null ? base : { ...base, fix: { kind: "setFirstPlayed", date } };
  }
  return { field, label: "다시보기 날짜", message: "날짜를 2026.10.25 형식으로 넣어 주세요." };
}

/** 검증 이슈(서버·클라이언트 공통) → 폼 이슈. FIELD_ORDER 순, 다시보기는 index 순 */
export function issuesToFormIssues(issues: readonly ValidationIssue[], form: GameForm): FormIssue[] {
  return issues
    .map((i) => toFormIssue(i, form))
    .map((issue, order) => ({ issue, order }))
    .sort((a, b) => fieldRank(a.issue.field) - fieldRank(b.issue.field) || a.order - b.order)
    .map(({ issue }) => issue);
}

/** others = 목록 전체(숨김 포함). selfId 게임은 비교에서 뺀다 */
export function validateForm(form: GameForm, others: readonly Game[], selfId: string | null): FormIssue[] {
  const rest = selfId === null ? others : others.filter((g) => g.id !== selfId);
  const issues = validateCandidate(rest, formToRaw(selfId ?? NEW_ID, form)).filter((i) => i.path !== "id");
  return issuesToFormIssues(issues, form);
}

// ---------- 임시 저장(localStorage) ----------

export const DRAFT_KEY_PREFIX = "yasiro-games-draft:";

export function draftKey(gameId: string | null): string {
  return `${DRAFT_KEY_PREFIX}${gameId ?? "new"}`;
}

export function serializeDraft(d: GameDraftStore): string {
  return JSON.stringify(d);
}

function isStr(v: unknown): v is string {
  return typeof v === "string";
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseCategory(v: unknown): CategoryLink | null | undefined {
  if (v === null) return null;
  if (!isObj(v) || !isStr(v.categoryId) || !(v.posterUrl === null || isStr(v.posterUrl))) return undefined;
  return { categoryId: v.categoryId, posterUrl: v.posterUrl };
}

function parseVods(v: unknown): Vod[] | null {
  if (!Array.isArray(v)) return null;
  const out: Vod[] = [];
  for (const x of v) {
    if (!isObj(x) || !isStr(x.title) || !isStr(x.url) || !isStr(x.date)) return null;
    out.push({ title: x.title, url: x.url, date: x.date });
  }
  return out;
}

export function parseDraft(raw: string | null): GameDraftStore | null {
  if (raw === null) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(v) || !isObj(v.form)) return null;
  const f = v.form;
  const category = parseCategory(f.category);
  const vods = parseVods(f.vods);
  const status = GAME_STATUSES.find((s) => s === f.status);
  const baseVersion = v.baseVersion;
  if (
    !isStr(f.name) ||
    !isStr(f.originalTitle) ||
    !isStr(f.firstPlayed) ||
    typeof f.undated !== "boolean" ||
    category === undefined ||
    vods === null ||
    status === undefined ||
    !(baseVersion === null || (typeof baseVersion === "number" && Number.isInteger(baseVersion))) ||
    typeof v.savedAt !== "number"
  ) {
    return null;
  }
  return {
    form: { name: f.name, originalTitle: f.originalTitle, category, firstPlayed: f.firstPlayed, undated: f.undated, status, vods },
    baseVersion,
    savedAt: v.savedAt,
  };
}
