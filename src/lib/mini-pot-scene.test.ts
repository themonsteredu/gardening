import { describe, expect, it } from "vitest";
import { POT_PRESETS } from "@/data/pot-presets";
import { clampMiniPotCamera, createMiniPotSceneDimensions } from "./mini-pot-scene";

describe("transparent mini pot 3D scene", () => {
  it("preserves rectangular pot width and depth proportions", () => {
    const rectangle = POT_PRESETS.find((preset) => preset.shape === "rectangle")!;
    const scene = createMiniPotSceneDimensions(rectangle);
    expect(scene.widthPixels).toBe(260);
    expect(scene.depthPixels).toBeLessThan(scene.widthPixels);
    expect(scene.widthRatio).toBe(1);
  });

  it("renders a tall cylinder taller than a low wide pot", () => {
    const tall = createMiniPotSceneDimensions(POT_PRESETS.find((preset) => preset.shape === "tall_cylinder")!);
    const low = createMiniPotSceneDimensions(POT_PRESETS.find((preset) => preset.shape === "low_wide")!);
    expect(tall.heightPixels).toBeGreaterThan(low.heightPixels);
  });

  it("clamps camera tilt and zoom to usable classroom controls", () => {
    expect(clampMiniPotCamera(-20, 2)).toEqual({ tilt: 4, zoom: 1.35 });
    expect(clampMiniPotCamera(95, 0.2)).toEqual({ tilt: 82, zoom: 0.65 });
  });
});
