import type { LandscapeObject, Point2D } from "@/domain/models";
import type { PlanLandscapeMaterial } from "@/data/landscape-materials";

export function getMaterialFootprintRadius(material: PlanLandscapeMaterial, scale = 1): number {
  const size = Math.sqrt(material.realWidthMeters * material.realHeightMeters) * 0.012 * scale;
  return Math.max(0.018, Math.min(0.065, size));
}

export function isFootprintInsideCanvas(center: Point2D, radius: number): boolean {
  return center.x - radius >= 0
    && center.x + radius <= 1
    && center.y - radius >= 0
    && center.y + radius <= 1;
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
