import { describe, expect, it } from "vitest";
import type { StudentLandscapeDesign } from "@/domain/models";
import {
  BONGSUN_SCENE_VERSION,
  getSchoolSceneVersion,
  isBongsunSchool,
  SAMPLE_SCHOOL_SCENE_VERSION,
  getSampleSchoolPlacementClearance,
  isSampleSchoolPlacementAllowed,
  isSampleSchoolSurfacePlacementAllowed,
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

  it("keeps the full width of painted grass inside the campus floor", () => {
    const lawnWidthMeters = 3.2;
    const safePoint = sampleSchoolToNormalized({ x: -12.8, z: 6.7 });
    const overflowingPoint = sampleSchoolToNormalized({ x: -14.2, z: 6.7 });

    expect(isSampleSchoolSurfacePlacementAllowed(safePoint, lawnWidthMeters)).toBe(true);
    expect(isSampleSchoolSurfacePlacementAllowed(overflowingPoint, lawnWidthMeters)).toBe(false);
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

describe("Bongseon main building frontage", () => {
  it("matches only the requested middle school, including the short or regional name", () => {
    for (const name of ["봉선중", "봉선중학교", "광주광역시 남구 봉선중학교", "광주 봉선중"]) {
      expect(isBongsunSchool(name)).toBe(true);
    }
    for (const name of ["봉선초등학교", "광주봉선여자중학교", "다른봉선중학교"]) {
      expect(isBongsunSchool(name)).toBe(false);
    }
  });

  it("keeps an existing design in its original setting when the teacher selects the school", () => {
    const saved: StudentLandscapeDesign = {
      id: "design", studentSessionId: "session", schoolProjectId: "school",
      sceneVersion: SAMPLE_SCHOOL_SCENE_VERSION, objects: [], intentionKeyword: null,
      intentionReason: null, thumbnailUrl: null, submittedAt: null,
    };
    expect(getSchoolSceneVersion("봉선중학교", saved)).toBe(BONGSUN_SCENE_VERSION);
    const stroke = { id: "grass", materialId: "lawn-surface" as const, widthMeters: 3, points: [{ x: 0.5, y: 0.1 }], zIndex: 1 };
    expect(getSchoolSceneVersion("봉선중학교", { ...saved, surfaceStrokes: [stroke] })).toBe(SAMPLE_SCHOOL_SCENE_VERSION);
    expect(getSchoolSceneVersion("봉선중학교", {
      ...saved, sceneVersion: "sample-middle-school-v1", surfaceStrokes: [stroke],
    })).toBe("sample-middle-school-v1");
    expect(getSchoolSceneVersion("다른 학교", { ...saved, sceneVersion: BONGSUN_SCENE_VERSION })).toBe(BONGSUN_SCENE_VERSION);
    expect(getSchoolSceneVersion("다른 학교", null)).toBe(SAMPLE_SCHOOL_SCENE_VERSION);
  });

  it("permits the whole width of a stroke only where the editable bed is visible", () => {
    const front = sampleSchoolToNormalized({ x: 7.9, z: 0.5 });
    expect(isSampleSchoolPlacementAllowed(front, 0.4, true)).toBe(true);
    expect(isSampleSchoolSurfacePlacementAllowed(front, 1.8, true)).toBe(true);
    // The same location is under a side building of the original generic school.
    expect(isSampleSchoolSurfacePlacementAllowed(front, 1.8)).toBe(false);
    for (const point of [{ x: 0, z: -2.3 }, { x: 12.2, z: 3 }, { x: 0, z: 8.2 }]) {
      expect(isSampleSchoolSurfacePointOpen(point, 0, true)).toBe(false);
      expect(isSampleSchoolPlacementAllowed(sampleSchoolToNormalized(point), 0.2, true)).toBe(false);
    }
    expect(isSampleSchoolSurfacePlacementAllowed(sampleSchoolToNormalized({ x: 0, z: -1.9 }), 1.8, true)).toBe(false);
  });
});
