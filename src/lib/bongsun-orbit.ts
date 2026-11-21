import type { SchoolGardenSide } from "@/domain/models";

export const BONGSUN_ORBIT_STEP = 5;
// Wall volumes in campus coordinates, shared by live and baked views for occlusion.
export const BONGSUN_BUILDING_BOUNDS = [
  { min: [-11.84, 0, -9.18], max: [11.84, 3.85, -6.22] },
  { min: [-4.92, 0, -11.63], max: [6.1, 4.82, -8.95] },
] as const;
const SCHOOL_CENTER_Z = -7.7;
const HALF_FIELD_OF_VIEW = 21 * Math.PI / 180;

type GroundPoint = { x: number; z: number };

export function normalizeOrbitAngle(degrees: number) {
  return ((degrees % 360) + 360) % 360;
}

export function getOrbitFrameAngle(degrees: number) {
  return normalizeOrbitAngle(Math.round(degrees / BONGSUN_ORBIT_STEP) * BONGSUN_ORBIT_STEP);
}

export function getOrbitFrameUrl(degrees: number) {
  const frame = String(getOrbitFrameAngle(degrees)).padStart(3, "0");
  return `/previews/bongsun/orbit/${frame}.webp`;
}

export function getOrbitGardenSide(degrees: number): SchoolGardenSide {
  const angle = normalizeOrbitAngle(degrees);
  return angle > 90 && angle < 270 ? "rear" : "front";
}

export function getOrbitViewLabel(degrees: number) {
  const labels = ["본관 앞", "오른쪽 옆면", "수업용 뒤뜰", "왼쪽 옆면"] as const;
  return labels[Math.round(normalizeOrbitAngle(degrees) / 90) % labels.length];
}

export function getOrbitViewAngle(view: string, initialSide: SchoolGardenSide = "front") {
  if (view === "rear") return 180;
  const center = initialSide === "rear" ? 180 : 0;
  if (view === "front-left") return center - 22.5;
  if (view === "front-right") return center + 22.5;
  return center;
}

export function orbitDragAngle(initialDegrees: number, horizontalDeltaCssPx: number, viewportWidth: number) {
  if (viewportWidth <= 0) return normalizeOrbitAngle(initialDegrees);
  return normalizeOrbitAngle(initialDegrees - 360 * horizontalDeltaCssPx / viewportWidth);
}

export function getOrbitCameraPose(degrees: number, aspect: number) {
  const angle = normalizeOrbitAngle(degrees) * Math.PI / 180;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const frontDistance = Math.max(14, 13.2 / (Math.tan(HALF_FIELD_OF_VIEW) * (aspect > 0 ? aspect : 1)));
  // Keep the lens clear of the long side walls as it orbits the school.
  const distance = frontDistance + 7 * sin * sin;
  const target = { x: 0, y: 1.35, z: SCHOOL_CENTER_Z + 4 * cos };
  const position = {
    x: sin * distance,
    y: target.y + distance * 0.105,
    z: target.z + cos * distance,
  };
  return { position, target };
}

export function localToCampusPoint(point: GroundPoint, side: SchoolGardenSide): GroundPoint {
  if (side === "front") return point;
  return { x: -point.x, z: 2 * SCHOOL_CENTER_Z - point.z };
}

// Turning 180° about the same school center is its own inverse.
export const campusToLocalPoint = localToCampusPoint;
