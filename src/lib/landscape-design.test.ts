import { describe, expect, it } from "vitest";
import { LANDSCAPE_MATERIALS } from "@/data/landscape-materials";
import type { SitePlanFeature } from "@/domain/models";
import {
  createLandscapeObject,
  getMaterialFootprintRadius,
  isFootprintInsideEditableZones,
  isPointInsideEditableZones,
  isPointInsidePolygon,
} from "./landscape-design";

const square = [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }];

describe("student landscape placement", () => {
  it("accepts points inside a polygon and rejects outside points", () => {
    expect(isPointInsidePolygon({ x: 0.5, y: 0.5 }, square)).toBe(true);
    expect(isPointInsidePolygon({ x: 0.1, y: 0.5 }, square)).toBe(false);
  });

  it("checks only editable-zone features", () => {
    const zones = [
      { id: "building", kind: "building", label: "본관", points: square, layer: "existing" },
      { id: "zone", kind: "editable_zone", label: "정원", points: square, layer: "existing" },
    ] satisfies SitePlanFeature[];
    expect(isPointInsideEditableZones({ x: 0.5, y: 0.5 }, zones)).toBe(true);
    expect(isPointInsideEditableZones({ x: 0.05, y: 0.05 }, zones)).toBe(false);
    expect(isPointInsideEditableZones({ x: 0.5, y: 0.5 }, zones.slice(0, 1))).toBe(false);
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

  it("keeps the whole material footprint inside one editable zone", () => {
    const zones = [{ id: "zone", kind: "editable_zone", label: "정원", points: square, layer: "existing" }] satisfies SitePlanFeature[];
    expect(isFootprintInsideEditableZones({ x: 0.5, y: 0.5 }, 0.1, zones)).toBe(true);
    expect(isFootprintInsideEditableZones({ x: 0.22, y: 0.5 }, 0.05, zones)).toBe(false);
    expect(getMaterialFootprintRadius(LANDSCAPE_MATERIALS[0])).toBeGreaterThan(0);
  });
});
