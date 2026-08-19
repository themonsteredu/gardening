import { describe, expect, it } from "vitest";
import {
  getSampleSchoolPlacementClearance,
  isSampleSchoolPlacementAllowed,
  isSampleSchoolSurfacePointOpen,
  normalizedToSampleSchool,
  sampleSchoolToNormalized,
} from "@/lib/sample-school";

describe("sample school coordinates", () => {
  it("converts normalized design points to the campus and back", () => {
    const normalized = { x: 0.24, y: 0.72 };
    const world = normalizedToSampleSchool(normalized);
    expect(sampleSchoolToNormalized(world).x).toBeCloseTo(normalized.x);
    expect(sampleSchoolToNormalized(world).y).toBeCloseTo(normalized.y);
  });

  it("allows open grounds and blocks school buildings", () => {
    expect(isSampleSchoolPlacementAllowed({ x: 0.5, y: 0.55 })).toBe(true);
    expect(isSampleSchoolPlacementAllowed({ x: 0.5, y: 0.17 })).toBe(false);
    expect(isSampleSchoolPlacementAllowed({ x: 0.01, y: 0.5 })).toBe(false);
  });

  it("clips planted surfaces at building walls and campus edges", () => {
    expect(isSampleSchoolSurfacePointOpen({ x: 0, z: -5.51 })).toBe(false);
    expect(isSampleSchoolSurfacePointOpen({ x: 0, z: -5.35 })).toBe(true);
    expect(isSampleSchoolSurfacePointOpen({ x: 15, z: 0 })).toBe(false);
  });

  it("lets lawn reach a wall while keeping tree clearance", () => {
    const nearBuildingWall = sampleSchoolToNormalized({ x: 0, z: -5.38 });
    const treeClearance = getSampleSchoolPlacementClearance("tree-canopy", 2.1);
    const lawnClearance = getSampleSchoolPlacementClearance("lawn", 1.26);

    expect(isSampleSchoolPlacementAllowed(nearBuildingWall, treeClearance)).toBe(false);
    expect(isSampleSchoolPlacementAllowed(nearBuildingWall, lawnClearance)).toBe(true);
  });
});
