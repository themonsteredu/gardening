import { findLandscapeMaterial, LANDSCAPE_MATERIALS } from "@/data/landscape-materials";
import type { LandscapeMaterialCategory, LandscapeObject } from "@/domain/models";

export interface LandscapePlanScheduleItem {
  code: string;
  materialId: string;
  label: string;
  category: LandscapeMaterialCategory;
  quantity: number;
}

const PLAN_CODE_BY_MATERIAL_ID: Record<string, string> = {
  "tree-canopy": "T1",
  pine: "T2",
  maple: "T3",
  shrub: "S1",
  flower: "F1",
  lawn: "G1",
  groundcover: "G2",
  gravel: "P1",
  "stepping-stone": "P2",
  block: "P3",
  deck: "P4",
  "dirt-path": "P5",
  bench: "B1",
  table: "B2",
  pergola: "B3",
  light: "B4",
  fence: "B5",
  planter: "B6",
  rock: "R1",
  pond: "W1",
  "flower-bed": "F2",
  sculpture: "A1",
};

export function getLandscapePlanCode(materialId: string): string | null {
  return PLAN_CODE_BY_MATERIAL_ID[materialId] ?? null;
}

export function buildLandscapePlanSchedule(objects: LandscapeObject[]): LandscapePlanScheduleItem[] {
  const counts = new Map<string, number>();
  for (const object of objects) {
    if (!findLandscapeMaterial(object.materialId)) continue;
    counts.set(object.materialId, (counts.get(object.materialId) ?? 0) + 1);
  }

  return LANDSCAPE_MATERIALS.flatMap((material) => {
    const quantity = counts.get(material.id);
    const code = getLandscapePlanCode(material.id);
    if (!quantity || !code) return [];
    return [{
      code,
      materialId: material.id,
      label: material.shortLabel,
      category: material.category,
      quantity,
    }];
  });
}
