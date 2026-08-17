import { describe, expect, it } from "vitest";
import type { MiniGardenKit, StudentMiniGardenDesign } from "@/domain/models";
import { createMiniGardenMakingPlan, estimateMiniGardenMakingMinutes, getMakingPlanProgress } from "./mini-garden-making-plan";

const kit: MiniGardenKit = {
  id: "kit-1",
  name: "조경키트",
  potPreset: { id: "pot-1", name: "직사각형", shape: "rectangle", widthCm: 30, depthCm: 16, heightCm: 12 },
  materials: [
    { id: "mint", name: "민트 모래", type: "layer", photoUrl: null, photoStorageKey: null, photoMimeType: null, photoName: null, modelAssetUrl: null, color: "#70c8b8", availableQuantity: null, actualSizeCm: null },
    { id: "white", name: "흰 모래", type: "layer", photoUrl: null, photoStorageKey: null, photoMimeType: null, photoName: null, modelAssetUrl: null, color: "#eee", availableQuantity: null, actualSizeCm: null },
    { id: "plant", name: "다육식물", type: "plant", photoUrl: null, photoStorageKey: null, photoMimeType: null, photoName: null, modelAssetUrl: "plant-basic-01", color: null, availableQuantity: 2, actualSizeCm: 6 },
    { id: "stone", name: "자연석", type: "object", photoUrl: null, photoStorageKey: null, photoMimeType: null, photoName: null, modelAssetUrl: null, color: null, availableQuantity: 2, actualSizeCm: 4 },
    { id: "gravel", name: "장식자갈", type: "scatter", photoUrl: null, photoStorageKey: null, photoMimeType: null, photoName: null, modelAssetUrl: null, color: "#bbb", availableQuantity: null, actualSizeCm: null },
  ],
};

const design: StudentMiniGardenDesign = {
  id: "design-1",
  studentSessionId: "student-1",
  miniGardenKitId: "kit-1",
  layers: [
    { id: "white-layer", materialId: "white", heightCm: 1, order: 1 },
    { id: "mint-layer", materialId: "mint", heightCm: 2, order: 0 },
  ],
  objects: [
    { id: "gravel-1", materialId: "gravel", x: 50, y: 50, z: 3, scale: 1, rotationY: 0 },
    { id: "plant-1", materialId: "plant", x: 30, y: 30, z: 3, scale: 1, rotationY: 0 },
    { id: "stone-1", materialId: "stone", x: 60, y: 60, z: 3, scale: 1, rotationY: 0 },
  ],
  makingSteps: [],
  completedMakingStepIds: [],
  renderedImageUrl: null,
  finalPhotoUrl: null,
  finalPhotoStorageKey: null,
  finalPhotoName: null,
  finalPhotoMimeType: null,
  finalPhotoUploadedAt: null,
  finalComparisonChecklistIds: [],
  finalComparisonReflection: "",
  completedAt: null,
};

describe("mini garden making plan", () => {
  it("creates bottom-to-top layers before plants, objects and surface finish", () => {
    const plan = createMiniGardenMakingPlan(design, kit);
    expect(plan.map((step) => step.id)).toEqual([
      "prepare-pot-and-materials",
      "layer-mint-layer",
      "layer-white-layer",
      "objects-plant",
      "objects-stone",
      "objects-gravel",
      "finish-compare-model",
    ]);
    expect(plan[1].instruction).toContain("2cm");
    expect(plan[3].amountLabel).toBe("1개");
    expect(plan[5].instruction).toContain("장식자갈을");
  });

  it("always includes preparation and final comparison", () => {
    const plan = createMiniGardenMakingPlan({ ...design, layers: [], objects: [] }, kit);
    expect(plan.map((step) => step.id)).toEqual(["prepare-pot-and-materials", "finish-compare-model"]);
    expect(estimateMiniGardenMakingMinutes(plan)).toBeGreaterThanOrEqual(5);
  });

  it("calculates progress from valid stable step ids", () => {
    const plan = createMiniGardenMakingPlan(design, kit);
    expect(getMakingPlanProgress([plan[0].id, plan[1].id, "removed-step"], plan)).toEqual({ completed: 2, total: 7, percent: 29 });
  });
});
