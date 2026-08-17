import { describe, expect, it } from "vitest";
import type { LandscapeObject } from "@/domain/models";
import { buildLandscapeScene, convertLandscapeObjectToScene } from "./landscape-scene";

const tree: LandscapeObject = {
  id: "tree-1",
  materialId: "tree-canopy",
  x: 0.4,
  y: 0.65,
  scale: 1.2,
  rotation: 30,
  width: 5,
  height: 5,
  category: "planting",
  zIndex: 4,
};

describe("landscape 3D scene conversion", () => {
  it("preserves plan position, rotation and visual order", () => {
    expect(convertLandscapeObjectToScene(tree)).toMatchObject({
      id: "tree-1",
      xPercent: 40,
      yPercent: 65,
      rotationDegrees: 30,
      zIndex: 4,
      category: "planting",
    });
  });

  it("gives planting objects more height than flat paving", () => {
    const paving = { ...tree, id: "paving", materialId: "deck", category: "paving", height: 2 } satisfies LandscapeObject;
    expect(convertLandscapeObjectToScene(tree)!.heightPixels).toBeGreaterThan(convertLandscapeObjectToScene(paving)!.heightPixels);
  });

  it("drops unknown materials and sorts scene objects by z-index", () => {
    const unknown = { ...tree, id: "unknown", materialId: "missing", zIndex: 1 };
    const bench = { ...tree, id: "bench", materialId: "bench", category: "facility", zIndex: 2 } satisfies LandscapeObject;
    expect(buildLandscapeScene([tree, unknown, bench]).map((object) => object.id)).toEqual(["bench", "tree-1"]);
  });
});
