import { describe, expect, it } from "vitest";
import {
  generateClassCode,
  isClassCodeValid,
  normalizeClassCode,
} from "@/lib/class-code";

describe("class code", () => {
  it("입력 코드의 공백과 기호를 제거하고 대문자로 바꾼다", () => {
    expect(normalizeClassCode(" garden-24 ")).toBe("GARDEN24");
  });

  it("6~10자리 영문·숫자 코드만 허용한다", () => {
    expect(isClassCodeValid("GARDEN24")).toBe(true);
    expect(isClassCodeValid("123")).toBe(false);
  });

  it("혼동하기 쉬운 문자를 제외한 8자리 코드를 만든다", () => {
    expect(generateClassCode(() => 0)).toBe("AAAAAAAA");
    expect(generateClassCode(() => 0.999)).toHaveLength(8);
  });
});
