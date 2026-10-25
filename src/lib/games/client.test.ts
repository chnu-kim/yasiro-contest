import { describe, expect, it } from "vitest";
import {
  addedMessage,
  classifyFailure,
  errorMessage,
  eulReul,
  fixLabel,
  issueLinkLabel,
  hiddenMessage,
  loginHref,
  savedMessage,
  unhiddenMessage,
} from "./client.ts";
import { gameToForm } from "./patch.ts";
import type { GameRecord } from "./types.ts";

const latest: GameRecord = {
  id: "a",
  name: "가",
  firstPlayed: null,
  status: "unknown",
  vods: [],
  hidden: false,
  version: 3,
  createdAt: 1_792_900_000,
  updatedAt: 1_792_900_000,
  updatedByName: "관리자",
};

describe("eulReul", () => {
  it("받침 유무에 따라 을/를", () => {
    expect(eulReul("스텔라 블레이드")).toBe("를");
    expect(eulReul("고독방송")).toBe("을");
    expect(eulReul("  파멸의 오타쿠 ")).toBe("를");
  });
  it("숫자로 끝나면 읽는 소리의 받침으로(0·1·3·6·7·8은 을)", () => {
    expect(eulReul("Portal 2")).toBe("를");
    expect(eulReul("Spelunky 1")).toBe("을");
    expect(["0", "1", "3", "6", "7", "8"].map((d) => eulReul(`a${d}`))).toEqual(Array(6).fill("을"));
    expect(["2", "4", "5", "9"].map((d) => eulReul(`a${d}`))).toEqual(Array(4).fill("를"));
  });
  it("한글·숫자가 아니거나 비면 null(조사를 붙이지 않는다)", () => {
    expect(eulReul("Portal")).toBeNull();
    expect(eulReul("파멸의 오타쿠X")).toBeNull();
    expect(eulReul("")).toBeNull();
    expect(eulReul("힣힣\uD7A4")).toBeNull();
  });
});

describe("문구", () => {
  it("저장·추가·숨김·다시 보이기", () => {
    expect(savedMessage("스텔라 블레이드")).toBe("스텔라 블레이드를 저장했어요.");
    expect(addedMessage("고독방송")).toBe("고독방송을 목록에 추가했어요.");
    expect(hiddenMessage("고독방송")).toBe("고독방송을 목록에서 숨겼어요.");
    expect(unhiddenMessage("Portal 2")).toBe("Portal 2를 다시 보이게 했어요.");
  });
  it("조사를 정할 수 없는 이름은 따옴표로 묶고 조사 없이", () => {
    const all = [savedMessage, addedMessage, hiddenMessage, unhiddenMessage].map((f) => f("파멸의 오타쿠X"));
    expect(all).toEqual([
      "‘파멸의 오타쿠X’ 저장했어요.",
      "‘파멸의 오타쿠X’ 목록에 추가했어요.",
      "‘파멸의 오타쿠X’ 목록에서 숨겼어요.",
      "‘파멸의 오타쿠X’ 다시 보이게 했어요.",
    ]);
    expect(all.join("")).not.toContain("을(를)");
  });
  it("loginHref는 안쪽 ?를 인코딩한다", () => {
    expect(loginHref("a")).toBe("/auth/login?next=%2Fgames%3Fgame%3Da");
    expect(loginHref(null)).toBe("/auth/login?next=%2Fgames");
  });
});

describe("errorMessage", () => {
  it("error.message 또는 fallback", () => {
    expect(errorMessage({ error: { code: "x", message: "m" } }, "f")).toBe("m");
    expect(errorMessage({ error: { message: "" } }, "f")).toBe("f");
    expect(errorMessage({ error: 1 }, "f")).toBe("f");
    expect(errorMessage(null, "f")).toBe("f");
    expect(errorMessage([], "f")).toBe("f");
  });
});

describe("classifyFailure", () => {
  const form = gameToForm(null);
  it("401 만료 / 로그인 필요", () => {
    expect(classifyFailure(401, { error: { code: "session_expired", message: "x" } }, form).kind).toBe("expired");
    expect(classifyFailure(401, { error: { code: "login_required", message: "x" } }, form).kind).toBe("login");
    expect(classifyFailure(401, null, form).kind).toBe("login");
  });
  it("403·404", () => {
    expect(classifyFailure(403, null, form).kind).toBe("forbidden");
    expect(classifyFailure(404, null, form).kind).toBe("missing");
  });
  it("409 충돌은 별칭 문구와 latest", () => {
    const f = classifyFailure(409, { error: { code: "conflict", message: "m" }, latest }, form);
    expect(f.kind).toBe("conflict");
    if (f.kind === "conflict") {
      expect(f.message).toMatch(/^관리자가 방금\(\d\d:\d\d\) 이 게임을 먼저 고쳤어요/);
      expect(f.latest.version).toBe(3);
    }
  });
  it("409인데 latest가 없으면 other", () => {
    expect(classifyFailure(409, { error: { message: "m" } }, form).kind).toBe("other");
    expect(classifyFailure(409, { latest: { id: 1 } }, form).kind).toBe("other");
  });
  it("422는 폼 이슈로 바꾼다", () => {
    const f = classifyFailure(422, { error: { code: "invalid", message: "m" }, issues: [{ path: "name", message: "x" }, { nope: 1 }] }, form);
    expect(f.kind).toBe("invalid");
    if (f.kind === "invalid") expect(f.issues).toEqual([{ field: "name", label: "이름", message: "이름을 1~100자로 넣어 주세요." }]);
    const g = classifyFailure(422, { issues: [{ path: "name", message: "x" }] }, null);
    expect(g.kind).toBe("invalid");
  });
  it("status 0은 네트워크 오류", () => {
    expect(classifyFailure(0, null, form)).toEqual({ kind: "other", message: "네트워크에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." });
  });
  it("그 밖은 other + 서버 문구", () => {
    expect(classifyFailure(500, { error: { code: "unavailable", message: "잠시" } }, form)).toEqual({ kind: "other", message: "잠시" });
    expect(classifyFailure(422, { error: { message: "m" } }, form)).toEqual({ kind: "other", message: "m" });
  });
});

describe("fixLabel / issueLinkLabel", () => {
  it("끝 숫자에 따라 으로/로", () => {
    expect(fixLabel("2025-07-20")).toBe("첫 플레이를 2025.07.20으로");
    expect(fixLabel("2025-07-23")).toBe("첫 플레이를 2025.07.23으로");
    expect(fixLabel("2025-07-21")).toBe("첫 플레이를 2025.07.21로");
    expect(fixLabel("2025-07-26")).toBe("첫 플레이를 2025.07.26로");
  });
  it("다시보기 이슈는 번째를 덧붙인다", () => {
    expect(issueLinkLabel({ field: "vods.2.date", label: "다시보기 날짜", message: "x" })).toBe("다시보기 날짜 (3번째)");
    expect(issueLinkLabel({ field: "name", label: "이름", message: "x" })).toBe("이름");
    expect(issueLinkLabel({ field: "vods", label: "다시보기", message: "x" })).toBe("다시보기");
  });
});
