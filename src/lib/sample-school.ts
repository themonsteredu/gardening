import type { Point2D, SchoolSurfaceMaterialId, StudentLandscapeDesign } from "@/domain/models";

export const SAMPLE_SCHOOL_WIDTH_METERS = 30;
export const SAMPLE_SCHOOL_DEPTH_METERS = 22;
export const SAMPLE_SCHOOL_SCENE_VERSION = "sample-middle-school-v2" as const;
export const BONGSUN_SCENE_VERSION = "bongsun-facade-v1" as const;
export const BONGSUN_FRONT_GARDEN = { width: 24, depth: 10, centerZ: 3 } as const;

export function isBongsunSchool(schoolName: string): boolean {
  const name = schoolName.normalize("NFKC").replace(/\s/g, "");
  return /^(?:(?:전라남도)?광주(?:광역시)?|전남광주(?:통합특별시)?)?(?:남구)?봉선중(?:학교)?$/.test(name);
}

export function getSchoolSceneVersion(schoolName: string, saved: StudentLandscapeDesign | null) {
  if (saved?.sceneVersion === BONGSUN_SCENE_VERSION) return BONGSUN_SCENE_VERSION;
  if (saved && (saved.objects.length > 0 || saved.surfaceStrokes?.length || saved.submittedAt)) {
    return saved.sceneVersion ?? SAMPLE_SCHOOL_SCENE_VERSION;
  }
  return isBongsunSchool(schoolName) ? BONGSUN_SCENE_VERSION : SAMPLE_SCHOOL_SCENE_VERSION;
}

const SAMPLE_SCHOOL_EDGE_PADDING_METERS = 0.4;

export interface SampleSchoolSurfaceMaterial {
  id: SchoolSurfaceMaterialId;
  name: string;
  instruction: string;
  textureUrl: string;
  widthMeters: number;
}

export const SAMPLE_SCHOOL_SURFACE_MATERIALS: readonly SampleSchoolSurfaceMaterial[] = [
  { id: "bare-soil", name: "흙바닥", instruction: "빈 땅으로 되돌리기", textureUrl: "/assets/photoreal/bare-soil-texture.png", widthMeters: 3.4 },
  { id: "lawn-surface", name: "잔디", instruction: "잔디밭 칠하기", textureUrl: "/assets/photoreal/lawn-texture.jpg", widthMeters: 3.2 },
  { id: "walking-path", name: "산책로", instruction: "길게 이어 그리기", textureUrl: "/assets/photoreal/gravel-texture.jpg", widthMeters: 1.45 },
  { id: "paving", name: "보도블록", instruction: "포장 공간 칠하기", textureUrl: "/assets/photoreal/paving-texture.jpg", widthMeters: 2.4 },
  { id: "gravel-surface", name: "자갈", instruction: "자갈 바닥 칠하기", textureUrl: "/assets/photoreal/gravel-texture.jpg", widthMeters: 2.2 },
  { id: "sand-surface", name: "모래", instruction: "모래 바닥 칠하기", textureUrl: "/assets/photoreal/sand-texture.jpg", widthMeters: 2.8 },
] as const;

export function findSampleSchoolSurfaceMaterial(id: string): SampleSchoolSurfaceMaterial | undefined {
  return SAMPLE_SCHOOL_SURFACE_MATERIALS.find((material) => material.id === id);
}

export interface SampleSchoolWorldPoint {
  x: number;
  z: number;
}

interface RestrictedZone extends SampleSchoolWorldPoint {
  width: number;
  depth: number;
}

export const SAMPLE_SCHOOL_BUILDING_ZONES: readonly RestrictedZone[] = [
  { x: 0, z: -5, width: 18.2, depth: 3.4 },
  { x: -8, z: -0.05, width: 3.2, depth: 7.4 },
  { x: 8, z: 0.4, width: 5.4, depth: 4.4 },
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
  bongsun = false,
): boolean {
  const clearance = Math.max(0, clearanceMeters);
  if (bongsun) {
    const garden = BONGSUN_FRONT_GARDEN;
    return Math.abs(point.x) < garden.width / 2 - clearance
      && Math.abs(point.z - garden.centerZ) < garden.depth / 2 - clearance;
  }
  if (
    Math.abs(point.x) >= SAMPLE_SCHOOL_WIDTH_METERS / 2 - clearance
    || Math.abs(point.z) >= SAMPLE_SCHOOL_DEPTH_METERS / 2 - clearance
  ) return false;

  return SAMPLE_SCHOOL_BUILDING_ZONES.every((zone) => (
    Math.abs(point.x - zone.x) > zone.width / 2 + clearance
    || Math.abs(point.z - zone.z) > zone.depth / 2 + clearance
  ));
}

export function isSampleSchoolSurfacePlacementAllowed(
  point: Point2D,
  widthMeters: number,
  bongsun = false,
): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(widthMeters)) return false;
  return isSampleSchoolSurfacePointOpen(
    normalizedToSampleSchool(point),
    Math.max(0, widthMeters) / 2,
    bongsun,
  );
}

export function getSampleSchoolPlacementClearance(materialId: string, footprintRadiusMeters: number): number {
  const footprintRadius = Math.max(0, footprintRadiusMeters);
  if (["lawn", "straight-path", "curved-path", "school-paver", "dirt-path", "stepping-stone"].includes(materialId)) {
    return Math.min(0.08, footprintRadius);
  }
  if (["tree-canopy", "pine", "maple"].includes(materialId)) {
    return Math.min(0.5, footprintRadius);
  }
  if (["shrub", "flower", "flower-pink", "flower-yellow", "lavender", "ornamental-grass", "groundcover"].includes(materialId)) {
    return Math.min(0.28, footprintRadius);
  }
  return footprintRadius;
}

export function isSampleSchoolPlacementAllowed(point: Point2D, radiusMeters = 0.45, bongsun = false): boolean {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  const world = normalizedToSampleSchool(point);
  if (bongsun) return isSampleSchoolSurfacePointOpen(world, radiusMeters, true);
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
