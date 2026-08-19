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
    expect(isSampleSchoolPlacementAllowed({ x: 0.5, y: 0.28 })).toBe(false);
    expect(isSampleSchoolPlacementAllowed({ x: 0.01, y: 0.5 })).toBe(false);
  });

  it("clips planted surfaces at building walls and campus edges", () => {
    expect(isSampleSchoolSurfacePointOpen({ x: 0, z: -3.31 })).toBe(false);
    expect(isSampleSchoolSurfacePointOpen({ x: 0, z: -3.15 })).toBe(true);
    expect(isSampleSchoolSurfacePointOpen({ x: 15, z: 0 })).toBe(false);
  });

  it("lets planted surfaces reach walls and keeps the rear grounds usable", () => {
    const nearBuildingWall = sampleSchoolToNormalized({ x: 0, z: -3.18 });
    const rearGround = sampleSchoolToNormalized({ x: 0, z: -8.5 });
    const treeClearance = getSampleSchoolPlacementClearance("tree-canopy", 2.1);
    const lawnClearance = getSampleSchoolPlacementClearance("lawn", 1.26);

    expect(treeClearance).toBe(0.5);
    expect(isSampleSchoolPlacementAllowed(rearGround, treeClearance)).toBe(true);
    expect(isSampleSchoolPlacementAllowed(nearBuildingWall, lawnClearance)).toBe(true);
  });
});
