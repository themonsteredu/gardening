import type { LandscapeObject, Point2D, SitePlanFeature } from "@/domain/models";
import type { PlanLandscapeMaterial } from "@/data/landscape-materials";

export function isPointInsidePolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const a = polygon[current];
    const b = polygon[previous];
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function isPointInsideEditableZones(point: Point2D, zones: SitePlanFeature[]): boolean {
  return zones.some((zone) => zone.kind === "editable_zone" && isPointInsidePolygon(point, zone.points));
}

export function getMaterialFootprintRadius(material: PlanLandscapeMaterial, scale = 1): number {
  const size = Math.sqrt(material.realWidthMeters * material.realHeightMeters) * 0.012 * scale;
  return Math.max(0.018, Math.min(0.065, size));
}

export function isFootprintInsideEditableZones(
  center: Point2D,
  radius: number,
  zones: SitePlanFeature[],
): boolean {
  const samplePoints = [
    center,
    { x: center.x - radius, y: center.y - radius },
    { x: center.x + radius, y: center.y - radius },
    { x: center.x + radius, y: center.y + radius },
    { x: center.x - radius, y: center.y + radius },
  ];
  return zones.some((zone) =>
    zone.kind === "editable_zone"
    && samplePoints.every((point) => isPointInsidePolygon(point, zone.points)),
  );
}

export function createLandscapeObject(
  material: PlanLandscapeMaterial,
  point: Point2D,
  zIndex: number,
  id: string,
): LandscapeObject {
  return {
    id,
    materialId: material.id,
    x: point.x,
    y: point.y,
    scale: 1,
    rotation: 0,
    width: material.realWidthMeters,
    height: material.realHeightMeters,
    category: material.category,
    zIndex,
  };
}
