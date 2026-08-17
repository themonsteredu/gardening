import { describe, expect, it } from "vitest";
import {
  resolveMiniMaterialImageMimeType,
  validateMiniMaterialImage,
  validateMiniMaterialQuantity,
  validateMiniMaterialSize,
} from "./mini-garden-material";

describe("mini garden material registration", () => {
  it("resolves supported image extensions when MIME is missing", () => {
    expect(resolveMiniMaterialImageMimeType({ name: "민트모래.WEBP", size: 200, type: "" })).toBe("image/webp");
  });

  it("rejects unsupported and oversized photos", () => {
    expect(validateMiniMaterialImage({ name: "material.svg", size: 100, type: "image/svg+xml" })).toContain("JPG");
    expect(validateMiniMaterialImage({ name: "material.png", size: 9 * 1024 * 1024, type: "image/png" })).toContain("8MB");
  });

  it("validates optional quantity and real size", () => {
    expect(validateMiniMaterialQuantity(null)).toBe(true);
    expect(validateMiniMaterialQuantity(5)).toBe(true);
    expect(validateMiniMaterialQuantity(0)).toBe(false);
    expect(validateMiniMaterialSize(null)).toBe(true);
    expect(validateMiniMaterialSize(2.5)).toBe(true);
    expect(validateMiniMaterialSize(101)).toBe(false);
  });
});
