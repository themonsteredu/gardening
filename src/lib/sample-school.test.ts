import { describe, expect, it } from "vitest";
import {
  isSampleSchoolPlacementAllowed,
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
});
