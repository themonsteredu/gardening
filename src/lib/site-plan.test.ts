import { describe, expect, it } from "vitest";
import type { SitePlanFeature } from "@/domain/models";
import {
  getEditableZoneFeatures,
  getExistingSiteFeatures,
  isUsablePolygon,
  normalizePointerPoint,
  polygonArea,
  pointsToSvg,
} from "./site-plan";

describe("site plan geometry", () => {
  it("normalizes and clamps pointer coordinates", () => {
    const rect = { left: 100, top: 50, width: 400, height: 200 };
    expect(normalizePointerPoint(300, 100, rect)).toEqual({ x: 0.5, y: 0.25 });
    expect(normalizePointerPoint(0, 500, rect)).toEqual({ x: 0, y: 1 });
  });

  it("calculates polygon area and rejects tiny shapes", () => {
    expect(polygonArea([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }])).toBe(0.5);
    expect(isUsablePolygon([{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0, y: 0.5 }])).toBe(true);
    expect(isUsablePolygon([{ x: 0, y: 0 }, { x: 0.001, y: 0 }, { x: 0, y: 0.001 }])).toBe(false);
  });

  it("serializes normalized points into the editor viewBox", () => {
    expect(pointsToSvg([{ x: 0.1, y: 0.2 }, { x: 1, y: 0 }])).toBe("100,200 1000,0");
  });

  it("keeps facilities and editable zones in separate editing collections", () => {
    const features = [
      { id: "building", kind: "building", label: "본관", points: [], layer: "existing" },
      { id: "zone", kind: "editable_zone", label: "중앙 정원", points: [], layer: "existing" },
    ] satisfies SitePlanFeature[];
    expect(getExistingSiteFeatures(features).map((feature) => feature.id)).toEqual(["building"]);
    expect(getEditableZoneFeatures(features).map((feature) => feature.id)).toEqual(["zone"]);
  });
});
