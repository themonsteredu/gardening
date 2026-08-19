import type { Point2D } from "@/domain/models";

export const SAMPLE_SCHOOL_WIDTH_METERS = 30;
export const SAMPLE_SCHOOL_DEPTH_METERS = 22;
export const SAMPLE_SCHOOL_SCENE_VERSION = "sample-middle-school-v1" as const;
const SAMPLE_SCHOOL_EDGE_PADDING_METERS = 0.65;

export interface SampleSchoolWorldPoint {
  x: number;
  z: number;
}

interface RestrictedZone extends SampleSchoolWorldPoint {
  width: number;
  depth: number;
}

export const SAMPLE_SCHOOL_BUILDING_ZONES: readonly RestrictedZone[] = [
  { x: 0, z: -7.2, width: 18.2, depth: 3.4 },
  { x: -8, z: -2.25, width: 3.2, depth: 7.4 },
  { x: 8, z: -1.8, width: 5.4, depth: 4.4 },
];

export function normalizedToSampleSchool(point: Point2D): SampleSchoolWorldPoint {
  return {
    x: (point.x - 0.5) * SAMPLE_SCHOOL_WIDTH_METERS,
    z: (point.y - 0.5) * SAMPLE_SCHOOL_DEPTH_METERS,
  };
}

export function sampleSchoolToNormalized(point: SampleSchoolWorldPoint): Point2D {
  return {
    x: point.x / SAMPLE_SCHOOL_WIDTH_METERS + 0.5,
    y: point.z / SAMPLE_SCHOOL_DEPTH_METERS + 0.5,
  };
}

export function isSampleSchoolSurfacePointOpen(
  point: SampleSchoolWorldPoint,
  clearanceMeters = 0,
): boolean {
  const clearance = Math.max(0, clearanceMeters);
  if (
    Math.abs(point.x) >= SAMPLE_SCHOOL_WIDTH_METERS / 2 - clearance
    || Math.abs(point.z) >= SAMPLE_SCHOOL_DEPTH_METERS / 2 - clearance
  ) return false;

  return SAMPLE_SCHOOL_BUILDING_ZONES.every((zone) => (
    Math.abs(point.x - zone.x) > zone.width / 2 + clearance
    || Math.abs(point.z - zone.z) > zone.depth / 2 + clearance
  ));
}

export function getSampleSchoolPlacementClearance(materialId: string, footprintRadiusMeters: number): number {
  const footprintRadius = Math.max(0, footprintRadiusMeters);
  return materialId === "lawn" ? Math.min(0.08, footprintRadius) : footprintRadius;
}

export function isSampleSchoolPlacementAllowed(point: Point2D, radiusMeters = 0.45): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  const world = normalizedToSampleSchool(point);
  const edgePadding = SAMPLE_SCHOOL_EDGE_PADDING_METERS + radiusMeters;
  if (
    Math.abs(world.x) > SAMPLE_SCHOOL_WIDTH_METERS / 2 - edgePadding
    || Math.abs(world.z) > SAMPLE_SCHOOL_DEPTH_METERS / 2 - edgePadding
  ) return false;

  return SAMPLE_SCHOOL_BUILDING_ZONES.every((zone) => (
    Math.abs(world.x - zone.x) > zone.width / 2 + radiusMeters
    || Math.abs(world.z - zone.z) > zone.depth / 2 + radiusMeters
  ));
}
