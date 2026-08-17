import { describe, expect, it } from "vitest";
import {
  isMiniFinalComparisonReady,
  MINI_FINAL_COMPARISON_CHECKS,
  MINI_FINAL_PHOTO_MAX_BYTES,
  validateMiniFinalPhoto,
} from "./mini-final-photo";

describe("mini garden final photo", () => {
  it("accepts supported photos by MIME type or extension", () => {
    expect(validateMiniFinalPhoto({ name: "완성작.jpg", type: "image/jpeg", size: 1024 })).toBeNull();
    expect(validateMiniFinalPhoto({ name: "완성작.WEBP", type: "", size: 1024 })).toBeNull();
  });

  it("rejects unsupported, empty, and oversized files", () => {
    expect(validateMiniFinalPhoto({ name: "작품.gif", type: "image/gif", size: 1024 })).toContain("JPG");
    expect(validateMiniFinalPhoto({ name: "작품.png", type: "image/png", size: 0 })).toContain("내용");
    expect(validateMiniFinalPhoto({ name: "작품.png", type: "image/png", size: MINI_FINAL_PHOTO_MAX_BYTES + 1 })).toContain("12MB");
  });

  it("requires a photo, every comparison check, and a meaningful reflection", () => {
    const allIds = MINI_FINAL_COMPARISON_CHECKS.map((item) => item.id);
    expect(isMiniFinalComparisonReady(true, allIds, "모델보다 식물을 조금 더 가운데 배치했습니다.")).toBe(true);
    expect(isMiniFinalComparisonReady(false, allIds, "모델보다 식물을 조금 더 가운데 배치했습니다.")).toBe(false);
    expect(isMiniFinalComparisonReady(true, allIds.slice(1), "모델보다 식물을 조금 더 가운데 배치했습니다.")).toBe(false);
    expect(isMiniFinalComparisonReady(true, allIds, "짧아요")).toBe(false);
  });
});
