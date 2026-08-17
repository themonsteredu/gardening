import type { LandscapeMaterial, LandscapeMaterialCategory } from "@/domain/models";

export interface PlanLandscapeMaterial extends LandscapeMaterial {
  shortLabel: string;
  color: string;
  shape: "circle" | "conifer" | "cluster" | "line" | "rect" | "organic";
}

export const LANDSCAPE_CATEGORY_LABELS: Record<LandscapeMaterialCategory, string> = {
  planting: "식재",
  paving: "바닥·포장",
  facility: "시설물",
  scenery: "경관요소",
};

export const LANDSCAPE_MATERIALS: PlanLandscapeMaterial[] = [
  { id: "tree-canopy", name: "교목", shortLabel: "교목", category: "planting", realWidthMeters: 5, realHeightMeters: 5, planAssetUrl: null, modelAssetUrl: null, color: "#397b4a", shape: "circle" },
  { id: "pine", name: "소나무류", shortLabel: "소나무", category: "planting", realWidthMeters: 4, realHeightMeters: 4, planAssetUrl: null, modelAssetUrl: null, color: "#246342", shape: "conifer" },
  { id: "maple", name: "단풍나무류", shortLabel: "단풍", category: "planting", realWidthMeters: 4.5, realHeightMeters: 4.5, planAssetUrl: null, modelAssetUrl: null, color: "#a55f3d", shape: "circle" },
  { id: "shrub", name: "관목", shortLabel: "관목", category: "planting", realWidthMeters: 1.2, realHeightMeters: 1.2, planAssetUrl: null, modelAssetUrl: null, color: "#6a963f", shape: "cluster" },
  { id: "flower", name: "초화", shortLabel: "초화", category: "planting", realWidthMeters: 0.6, realHeightMeters: 0.6, planAssetUrl: null, modelAssetUrl: null, color: "#b36b82", shape: "cluster" },
  { id: "lawn", name: "잔디", shortLabel: "잔디", category: "planting", realWidthMeters: 3, realHeightMeters: 3, planAssetUrl: null, modelAssetUrl: null, color: "#85ae57", shape: "organic" },
  { id: "groundcover", name: "지피식물", shortLabel: "지피", category: "planting", realWidthMeters: 1.5, realHeightMeters: 1.5, planAssetUrl: null, modelAssetUrl: null, color: "#8ca94d", shape: "organic" },
  { id: "gravel", name: "자갈", shortLabel: "자갈", category: "paving", realWidthMeters: 2, realHeightMeters: 2, planAssetUrl: null, modelAssetUrl: null, color: "#9b9a8e", shape: "organic" },
  { id: "stepping-stone", name: "디딤석", shortLabel: "디딤석", category: "paving", realWidthMeters: 0.6, realHeightMeters: 0.4, planAssetUrl: null, modelAssetUrl: null, color: "#777a72", shape: "line" },
  { id: "block", name: "보도블록", shortLabel: "블록", category: "paving", realWidthMeters: 2, realHeightMeters: 1.5, planAssetUrl: null, modelAssetUrl: null, color: "#b17c61", shape: "rect" },
  { id: "deck", name: "목재 데크", shortLabel: "데크", category: "paving", realWidthMeters: 3, realHeightMeters: 2, planAssetUrl: null, modelAssetUrl: null, color: "#8b674b", shape: "rect" },
  { id: "dirt-path", name: "흙길", shortLabel: "흙길", category: "paving", realWidthMeters: 3, realHeightMeters: 1.5, planAssetUrl: null, modelAssetUrl: null, color: "#a7875e", shape: "line" },
  { id: "bench", name: "벤치", shortLabel: "벤치", category: "facility", realWidthMeters: 1.8, realHeightMeters: 0.6, planAssetUrl: null, modelAssetUrl: null, color: "#73513b", shape: "rect" },
  { id: "table", name: "테이블", shortLabel: "테이블", category: "facility", realWidthMeters: 1.2, realHeightMeters: 1.2, planAssetUrl: null, modelAssetUrl: null, color: "#735b48", shape: "circle" },
  { id: "pergola", name: "파고라", shortLabel: "파고라", category: "facility", realWidthMeters: 3, realHeightMeters: 3, planAssetUrl: null, modelAssetUrl: null, color: "#5d6670", shape: "rect" },
  { id: "light", name: "조명", shortLabel: "조명", category: "facility", realWidthMeters: 0.3, realHeightMeters: 0.3, planAssetUrl: null, modelAssetUrl: null, color: "#d7b843", shape: "circle" },
  { id: "fence", name: "울타리", shortLabel: "울타리", category: "facility", realWidthMeters: 2, realHeightMeters: 0.2, planAssetUrl: null, modelAssetUrl: null, color: "#4d5a59", shape: "line" },
  { id: "planter", name: "화분", shortLabel: "화분", category: "facility", realWidthMeters: 0.8, realHeightMeters: 0.8, planAssetUrl: null, modelAssetUrl: null, color: "#9c694b", shape: "rect" },
  { id: "rock", name: "자연석", shortLabel: "자연석", category: "scenery", realWidthMeters: 1, realHeightMeters: 0.8, planAssetUrl: null, modelAssetUrl: null, color: "#777b76", shape: "organic" },
  { id: "pond", name: "작은 연못", shortLabel: "연못", category: "scenery", realWidthMeters: 3, realHeightMeters: 2, planAssetUrl: null, modelAssetUrl: null, color: "#4d91a0", shape: "organic" },
  { id: "flower-bed", name: "화단", shortLabel: "화단", category: "scenery", realWidthMeters: 2, realHeightMeters: 1.2, planAssetUrl: null, modelAssetUrl: null, color: "#9a704e", shape: "organic" },
  { id: "sculpture", name: "작은 조형물", shortLabel: "조형물", category: "scenery", realWidthMeters: 1, realHeightMeters: 1, planAssetUrl: null, modelAssetUrl: null, color: "#7f6b94", shape: "cluster" },
];

export function findLandscapeMaterial(id: string): PlanLandscapeMaterial | undefined {
  return LANDSCAPE_MATERIALS.find((material) => material.id === id);
}
