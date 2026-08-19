import { describe, expect, it } from "vitest";
import { LANDSCAPE_MATERIALS } from "@/data/landscape-materials";
import {
  createLandscapeObject,
  getMaterialFootprintRadius,
  isFootprintInsideCanvas,
} from "./landscape-design";

describe("student landscape placement", () => {
  it("offers several real-image tree and flower choices", () => {
    const trees = LANDSCAPE_MATERIALS.filter((material) => material.pickerGroup === "trees");
    const flowers = LANDSCAPE_MATERIALS.filter((material) => material.pickerGroup === "flowers");

    expect(trees).toHaveLength(5);
    expect(flowers).toHaveLength(5);
    expect([...trees, ...flowers].every((material) => Boolean(material.planAssetUrl))).toBe(true);
    expect(trees.every((material) => material.photoRender === "tree" && Boolean(material.sideAssetUrl))).toBe(true);
  });

  it("uses real image assets for the student material palette", () => {
    const primaryIds = ["tree-canopy", "pine", "flower", "lawn", "bench", "rock", "dirt-path", "flower-bed"];
    const primaryMaterials = LANDSCAPE_MATERIALS.filter((material) => primaryIds.includes(material.id));

    expect(primaryMaterials).toHaveLength(primaryIds.length);
    expect(primaryMaterials.every((material) => material.planAssetUrl?.endsWith(".webp"))).toBe(true);
  });

  it("creates structured plan objects from material dimensions", () => {
    const bench = LANDSCAPE_MATERIALS.find((material) => material.id === "bench")!;
    expect(createLandscapeObject(bench, { x: 0.4, y: 0.6 }, 3, "object-1")).toMatchObject({
      materialId: "bench",
      x: 0.4,
      y: 0.6,
      width: 1.8,
      category: "facility",
      zIndex: 3,
    });
  });

  it("calculates a material footprint", () => {
    expect(getMaterialFootprintRadius(LANDSCAPE_MATERIALS[0])).toBeGreaterThan(0);
  });

  it("keeps placements inside the full photo canvas without requiring a drawn zone", () => {
    expect(isFootprintInsideCanvas({ x: 0.5, y: 0.5 }, 0.1)).toBe(true);
    expect(isFootprintInsideCanvas({ x: 0.02, y: 0.5 }, 0.05)).toBe(false);
  });
});
