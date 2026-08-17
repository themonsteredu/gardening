import { findLandscapeMaterial, type PlanLandscapeMaterial } from "@/data/landscape-materials";
import type { LandscapeObject, LandscapeMaterialCategory } from "@/domain/models";

export interface LandscapeSceneObject {
  id: string;
  materialId: string;
  label: string;
  category: LandscapeMaterialCategory;
  shape: PlanLandscapeMaterial["shape"];
  color: string;
  xPercent: number;
  yPercent: number;
  sizePixels: number;
  heightPixels: number;
  rotationDegrees: number;
  zIndex: number;
}

function getSceneHeight(object: LandscapeObject): number {
  if (object.category === "planting") return Math.max(18, Math.min(52, object.width * 7 * object.scale));
  if (object.category === "facility") return Math.max(7, Math.min(22, object.height * 8 * object.scale));
  if (object.category === "scenery") return object.materialId === "pond" ? 3 : Math.max(5, object.height * 7 * object.scale);
  return 2;
}

export function convertLandscapeObjectToScene(object: LandscapeObject): LandscapeSceneObject | null {
  const material = findLandscapeMaterial(object.materialId);
  if (!material) return null;
  const size = Math.sqrt(object.width * object.height) * 15 * object.scale;
  return {
    id: object.id,
    materialId: object.materialId,
    label: material.shortLabel,
    category: object.category,
    shape: material.shape,
    color: material.color,
    xPercent: object.x * 100,
    yPercent: object.y * 100,
    sizePixels: Math.max(18, Math.min(76, size)),
    heightPixels: getSceneHeight(object),
    rotationDegrees: object.rotation,
    zIndex: object.zIndex,
  };
}

export function buildLandscapeScene(objects: LandscapeObject[]): LandscapeSceneObject[] {
  return objects
    .map(convertLandscapeObjectToScene)
    .filter((object): object is LandscapeSceneObject => object !== null)
    .toSorted((a, b) => a.zIndex - b.zIndex);
}
