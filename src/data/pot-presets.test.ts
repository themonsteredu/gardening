import { describe, expect, it } from "vitest";
import { estimatePotVolumeLiters, isValidPotDimension, POT_PRESETS } from "./pot-presets";

describe("mini garden pot presets", () => {
  it("provides all five classroom pot shapes", () => {
    expect(new Set(POT_PRESETS.map((preset) => preset.shape)).size).toBe(5);
  });

  it("validates practical classroom dimensions", () => {
    expect(isValidPotDimension(18)).toBe(true);
    expect(isValidPotDimension(4)).toBe(false);
    expect(isValidPotDimension(61)).toBe(false);
  });

  it("estimates a smaller volume for a cylinder with the same bounding dimensions", () => {
    const rectangle = estimatePotVolumeLiters({ shape: "square", widthCm: 10, depthCm: 10, heightCm: 10 });
    const cylinder = estimatePotVolumeLiters({ shape: "round", widthCm: 10, depthCm: 10, heightCm: 10 });
    expect(rectangle).toBe(1);
    expect(cylinder).toBe(0.8);
  });
});
