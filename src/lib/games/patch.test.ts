import { describe, expect, it } from "vitest";
import {
  applyFix,
  changedFields,
  changedLabels,
  draftKey,
  DRAFT_KEY_PREFIX,
  fieldDomId,
  formToInput,
  formToPatch,
  formToRaw,
  gameToForm,
  issuesHeadline,
  issuesToFormIssues,
  parseDraft,
  serializeDraft,
  suggestFirstPlayed,
  validateForm,
} from "./patch.ts";
import { CHZZK_VOD_MESSAGE } from "./schema.ts";
import type { Game, GameForm } from "./types.ts";

const POSTER = "https://ssl.pstatic.net/static/nng/glive/category/a.png";
const V1 = { title: "첫 번째", url: "https://www.youtube.com/watch?v=aaaaaaaaaaa", date: "2026-10-10" };
const V2 = { title: "두 번째", url: "https://youtu.be/bbbbbbbbbbb", date: "2026-10-15" };

const base: Game = {
  id: "stellar-blade",
  name: "스텔라 블레이드",
  originalTitle: "Stellar Blade",
  categoryId: "Stellar_Blade",
  posterUrl: POSTER,
  firstPlayed: "2026-10-10",
  status: "unknown",
  vods: [V1, V2],
};

const other: Game = { id: "other", name: "다른 게임", categoryId: "Other_Cat", firstPlayed: null, status: "clear", vods: [] };

function form(over: Partial<GameForm> = {}): GameForm {
  return { ...gameToForm(base), ...over };
}

describe("gameToForm", () => {
  it("null은 빈 폼", () => {
    expect(gameToForm(null)).toEqual({ name: "", originalTitle: "", category: null, firstPlayed: "", undated: false, status: "unknown", vods: [] });
  });
  it("전체 필드", () => {
    expect(gameToForm(base)).toEqual({
      name: "스텔라 블레이드",
      originalTitle: "Stellar Blade",
      category: { categoryId: "Stellar_Blade", posterUrl: POSTER },
      firstPlayed: "2026-10-10",
      undated: false,
      status: "unknown",
      vods: [V1, V2],
    });
  });
  it("카테고리만 있고 포스터 없음 / 날짜 없음", () => {
    const f = gameToForm({ id: "x", name: "x", categoryId: "C", firstPlayed: null, status: "fail", vods: [] });
    expect(f.category).toEqual({ categoryId: "C", posterUrl: null });
    expect(f.undated).toBe(true);
    expect(f.firstPlayed).toBe("");
    expect(gameToForm({ id: "x", name: "x", firstPlayed: null, status: "fail", vods: [] }).category).toBeNull();
    expect(gameToForm(other).category).toEqual({ categoryId: "Other_Cat", posterUrl: null });
  });
  it("vods는 복사본", () => {
    const f = gameToForm(base);
    expect(f.vods[0]).not.toBe(base.vods[0]);
  });
});

describe("formToRaw / formToInput", () => {
  it("trim, 원제 공백만이면 생략, undated는 null", () => {
    const raw = formToRaw("x", form({ name: "  이름  ", originalTitle: "   ", undated: true, category: null, vods: [{ ...V1, title: " t ", url: " " + V1.url }] }));
    expect(raw).toEqual({ id: "x", name: "이름", firstPlayed: null, status: "unknown", vods: [{ title: "t", url: V1.url, date: "2026-10-10" }] });
    expect("originalTitle" in raw).toBe(false);
    expect("categoryId" in raw).toBe(false);
  });
  it("포스터 없는 카테고리는 categoryId만", () => {
    const raw = formToRaw("x", form({ category: { categoryId: "C", posterUrl: null } }));
    expect(raw.categoryId).toBe("C");
    expect("posterUrl" in raw).toBe(false);
  });
  it("빈 firstPlayed는 그대로(검증이 잡는다)", () => {
    expect(formToRaw("x", form({ firstPlayed: "" })).firstPlayed).toBe("");
  });
  it("formToInput은 id가 없다", () => {
    const input = formToInput(form());
    expect("id" in input).toBe(false);
    expect(input.name).toBe("스텔라 블레이드");
    expect(input.categoryId).toBe("Stellar_Blade");
  });
});

describe("formToPatch", () => {
  it("변화 없음은 {}", () => {
    expect(formToPatch(base, gameToForm(base))).toEqual({});
  });
  it("필드별 변경", () => {
    const patch = formToPatch(
      base,
      form({ name: "새 이름", originalTitle: "", firstPlayed: "2026-10-01", status: "clear", vods: [V2] }),
    );
    expect(patch).toEqual({ name: "새 이름", originalTitle: null, firstPlayed: "2026-10-01", status: "clear", vods: [V2] });
  });
  it("날짜 기록 없음", () => {
    expect(formToPatch(base, form({ undated: true }))).toEqual({ firstPlayed: null });
  });
  it("카테고리 해제는 category: null, 교체는 링크", () => {
    expect(formToPatch(base, form({ category: null }))).toEqual({ category: null });
    expect(formToPatch(base, form({ category: { categoryId: "N", posterUrl: null } }))).toEqual({
      category: { categoryId: "N", posterUrl: null },
    });
  });
  it("포스터만 바뀌어도 category", () => {
    expect(formToPatch(base, form({ category: { categoryId: "Stellar_Blade", posterUrl: null } }))).toEqual({
      category: { categoryId: "Stellar_Blade", posterUrl: null },
    });
  });
});

describe("changedFields / changedLabels", () => {
  it("수정 모드는 diff", () => {
    expect(changedFields(base, gameToForm(base))).toEqual([]);
    expect(changedFields(base, form({ status: "clear", vods: [V1] }))).toEqual(["status", "vods"]);
  });
  it("추가 모드는 비어 있지 않은 필드", () => {
    expect(changedFields(null, gameToForm(null))).toEqual([]);
    expect(changedFields(null, gameToForm(base))).toEqual(["name", "originalTitle", "category", "firstPlayed", "vods"]);
    expect(changedFields(null, { ...gameToForm(null), undated: true, status: "fail" })).toEqual(["firstPlayed", "status"]);
  });
  it("라벨", () => {
    expect(changedLabels(["status", "vods"])).toEqual(["정복 여부", "다시보기"]);
  });
});

describe("validateForm", () => {
  it("정상은 0개", () => {
    expect(validateForm(gameToForm(base), [other], base.id)).toEqual([]);
    expect(validateForm(gameToForm(base), [other, base], base.id)).toEqual([]);
  });
  it("이름 빈칸", () => {
    const issues = validateForm(form({ name: "  " }), [], base.id);
    expect(issues).toEqual([{ field: "name", label: "이름", message: "이름을 1~100자로 넣어 주세요." }]);
  });
  it("새 게임은 id 이슈를 버린다", () => {
    expect(validateForm({ ...gameToForm(null), name: "새 게임", undated: true }, [], null)).toEqual([]);
  });
  it("원제가 이름과 같거나 너무 길면", () => {
    expect(validateForm(form({ originalTitle: "스텔라 블레이드" }), [], base.id)[0].message).toBe("원제가 이름과 같으면 비워 두세요.");
    expect(validateForm(form({ originalTitle: "a".repeat(201) }), [], base.id)[0].message).toBe("원제는 200자까지 넣을 수 있어요.");
  });
  it("치지직 링크는 정확한 문구", () => {
    const issues = validateForm(form({ vods: [{ ...V1, url: "https://chzzk.naver.com/video/123" }] }), [], base.id);
    expect(issues).toEqual([{ field: "vods.0.url", label: "다시보기 링크", message: CHZZK_VOD_MESSAGE }]);
  });
  it("유튜브가 아닌 링크 / 중복 영상", () => {
    const bad = validateForm(form({ vods: [{ ...V1, url: "https://example.com/x" }] }), [], base.id);
    expect(bad[0].message).toBe("유튜브 영상 링크(youtube.com/watch?v=… 또는 youtu.be/…)를 넣어 주세요.");
    const dup = validateForm(form({ vods: [V1, { ...V2, url: V1.url }] }), [], base.id);
    expect(dup).toEqual([{ field: "vods.1.url", label: "다시보기 링크", message: "같은 영상이 이미 있어요." }]);
  });
  it("다시보기 제목", () => {
    expect(validateForm(form({ vods: [{ ...V1, title: " " }] }), [], base.id)).toEqual([
      { field: "vods.0.title", label: "다시보기 제목", message: "제목을 1~200자로 넣어 주세요." },
    ]);
  });
  it("날짜가 첫 플레이보다 빠르면 fix", () => {
    const issues = validateForm(form({ firstPlayed: "2026-10-12", vods: [V1, V2] }), [], base.id);
    expect(issues).toEqual([
      {
        field: "vods.0.date",
        label: "다시보기 날짜",
        message: "첫 플레이(2026.10.12)보다 빨라요.",
        fix: { kind: "setFirstPlayed", date: "2026-10-10" },
      },
    ]);
  });
  it("날짜 형식 오류", () => {
    expect(validateForm(form({ vods: [{ ...V1, date: "" }] }), [], base.id)[0]).toEqual({
      field: "vods.0.date",
      label: "다시보기 날짜",
      message: "날짜를 2026.10.25 형식으로 넣어 주세요.",
    });
  });
  it("다른 게임의 categoryId와 겹치면(숨긴 게임 포함) 중복, 자기 자신은 아님", () => {
    const dup = validateForm(form({ category: { categoryId: "Other_Cat", posterUrl: null } }), [other, base], base.id);
    expect(dup).toEqual([{ field: "category", label: "치지직 카테고리", message: "이미 목록에 있는 카테고리예요." }]);
  });
  it("첫 플레이·정복 여부·여러 이슈는 FIELD_ORDER 순", () => {
    const issues = validateForm(
      form({ name: "", firstPlayed: "", status: "nope" as never, vods: [{ ...V2, url: "x" }, { ...V1, title: "" }] }),
      [],
      base.id,
    );
    expect(issues.map((i) => i.field)).toEqual(["name", "firstPlayed", "status", "vods.0.url", "vods.1.title"]);
    expect(issuesHeadline(issues)).toBe("고칠 곳이 5개 있어요");
  });
});

describe("issuesToFormIssues 나머지 경로", () => {
  const f = form();
  const map = (path: string, message = "x") => issuesToFormIssues([{ path, message }], f)[0];
  it("카테고리·포스터·vods", () => {
    expect(map("categoryId", "비어 있지 않은 문자열이어야 합니다").message).toBe("카테고리를 다시 골라 주세요.");
    expect(map("posterUrl").message).toBe("포스터 주소가 올바르지 않아요. 카테고리를 다시 골라 주세요.");
    expect(map("firstPlayed")).toMatchObject({ field: "firstPlayed" });
    expect(map("vods")).toMatchObject({ field: "vods", message: "다시보기 목록이 올바르지 않아요." });
  });
  it("id·알 수 없는 경로는 name/기록 + 원본 메시지", () => {
    expect(map("id", "원본")).toEqual({ field: "name", label: "기록", message: "원본" });
    expect(map("vods[0]", "객체여야 합니다")).toEqual({ field: "name", label: "기록", message: "객체여야 합니다" });
    expect(map("")).toMatchObject({ label: "기록" });
  });
  it("같은 순위는 들어온 순서를 유지한다", () => {
    const out = issuesToFormIssues([{ path: "id", message: "a" }, { path: "name", message: "b" }], f);
    expect(out.map((i) => i.message)).toEqual(["a", "이름을 1~100자로 넣어 주세요."]);
  });
  it("범위를 벗어난 다시보기 index의 링크 이슈도 안전", () => {
    expect(map("vods[9].url")).toMatchObject({ field: "vods.9.url" });
  });
  it("날짜 이슈인데 제안할 날짜가 없으면 fix 없음", () => {
    const g = form({ undated: true });
    const issue = issuesToFormIssues([{ path: "vods[0].date", message: "첫 플레이 날짜(2026-10-12)보다 이릅니다" }], g)[0];
    expect(issue.fix).toBeUndefined();
  });
});

describe("suggestFirstPlayed / applyFix", () => {
  it("undated나 잘못된 날짜는 null", () => {
    expect(suggestFirstPlayed(form({ undated: true }))).toBeNull();
    expect(suggestFirstPlayed(form({ firstPlayed: "" }))).toBeNull();
  });
  it("이른 다시보기가 없으면 null", () => {
    expect(suggestFirstPlayed(form())).toBeNull();
  });
  it("가장 이른 날짜", () => {
    const f = form({ firstPlayed: "2026-12-01", vods: [V2, V1, { ...V1, date: "bad" }] });
    expect(suggestFirstPlayed(f)).toBe("2026-10-10");
  });
  it("applyFix는 날짜를 넣고 undated를 푼다", () => {
    expect(applyFix(form({ undated: true }), { kind: "setFirstPlayed", date: "2026-01-01" })).toMatchObject({ firstPlayed: "2026-01-01", undated: false });
  });
});

describe("fieldDomId", () => {
  it("점을 하이픈으로", () => {
    expect(fieldDomId("name")).toBe("game-edit-name");
    expect(fieldDomId("vods.0.url")).toBe("game-edit-vods-0-url");
  });
});

describe("draft", () => {
  const store = { form: gameToForm(base), baseVersion: 3, savedAt: 1_792_900_000_000 };
  it("키", () => {
    expect(draftKey("a")).toBe(`${DRAFT_KEY_PREFIX}a`);
    expect(draftKey(null)).toBe(`${DRAFT_KEY_PREFIX}new`);
  });
  it("왕복 (baseVersion null 포함)", () => {
    expect(parseDraft(serializeDraft(store))).toEqual(store);
    const n = { ...store, baseVersion: null, form: gameToForm(null) };
    expect(parseDraft(serializeDraft(n))).toEqual(n);
    const c = { ...store, form: { ...store.form, category: null } };
    expect(parseDraft(serializeDraft(c))).toEqual(c);
  });
  it("깨진 값은 null", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("{")).toBeNull();
    expect(parseDraft("[]")).toBeNull();
    expect(parseDraft('{"form":null}')).toBeNull();
    const bad = (mut: (s: Record<string, unknown>, f: Record<string, unknown>) => void) => {
      const s = JSON.parse(serializeDraft(store));
      mut(s, s.form);
      return parseDraft(JSON.stringify(s));
    };
    expect(bad((_s, f) => delete f.name)).toBeNull();
    expect(bad((_s, f) => (f.status = "x"))).toBeNull();
    expect(bad((_s, f) => (f.undated = "no"))).toBeNull();
    expect(bad((_s, f) => (f.category = { categoryId: 1 }))).toBeNull();
    expect(bad((_s, f) => (f.category = "x"))).toBeNull();
    expect(bad((_s, f) => (f.vods = "x"))).toBeNull();
    expect(bad((_s, f) => (f.vods = [{ title: 1 }]))).toBeNull();
    expect(bad((_s, f) => (f.vods = [1]))).toBeNull();
    expect(bad((s) => (s.baseVersion = "3"))).toBeNull();
    expect(bad((s) => (s.baseVersion = 1.5))).toBeNull();
    expect(bad((s) => (s.savedAt = "x"))).toBeNull();
  });
});
