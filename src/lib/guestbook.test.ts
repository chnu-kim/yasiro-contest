import { describe, it, expect } from "vitest";
import { validateMessage, getPostItStyle } from "./guestbook";

describe("validateMessage", () => {
  it("정상 메시지는 trim된 값을 반환한다", () => {
    const result = validateMessage("  안녕하세요!  ");
    expect(result).toEqual({ ok: true, value: "안녕하세요!" });
  });

  it("빈 메시지는 거부한다", () => {
    expect(validateMessage("")).toEqual({ ok: false, error: "메시지를 입력해주세요." });
    expect(validateMessage("   ")).toEqual({ ok: false, error: "메시지를 입력해주세요." });
  });

  it("200자 초과 메시지는 거부한다", () => {
    const long = "가".repeat(201);
    expect(validateMessage(long)).toEqual({ ok: false, error: "메시지는 200자 이내로 입력해주세요." });
  });

  it("정확히 200자는 허용한다", () => {
    const exactly = "가".repeat(200);
    const result = validateMessage(exactly);
    expect(result).toEqual({ ok: true, value: exactly });
  });
});

describe("getPostItStyle", () => {
  it("같은 id는 항상 같은 색상 인덱스를 반환한다", () => {
    const a = getPostItStyle("abc123");
    const b = getPostItStyle("abc123");
    expect(a.colorIndex).toBe(b.colorIndex);
    expect(a.rotation).toBe(b.rotation);
  });

  it("colorIndex는 0~4 범위 내에 있다", () => {
    ["a", "z", "0", "zzz", "hello"].forEach((id) => {
      const { colorIndex } = getPostItStyle(id);
      expect(colorIndex).toBeGreaterThanOrEqual(0);
      expect(colorIndex).toBeLessThan(5);
    });
  });

  it("rotation은 -6 ~ 6 도 범위 내에 있다", () => {
    for (let i = 0; i < 20; i++) {
      const { rotation } = getPostItStyle(String(i));
      expect(rotation).toBeGreaterThanOrEqual(-6);
      expect(rotation).toBeLessThanOrEqual(6);
    }
  });
});
