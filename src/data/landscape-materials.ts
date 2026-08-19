import type { LandscapeMaterial, LandscapeMaterialCategory } from "@/domain/models";

export interface PlanLandscapeMaterial extends LandscapeMaterial {
  shortLabel: string;
  color: string;
  shape: "circle" | "conifer" | "cluster" | "line" | "rect" | "organic";
  planWidth?: number;
  planHeight?: number;
  sideAssetUrl?: string;
  pickerGroup?: "trees" | "flowers" | "facilities";
  photoRender?: "tree" | "plant";
  photoDepthMeters?: number;
}

export const LANDSCAPE_CATEGORY_LABELS: Record<LandscapeMaterialCategory, string> = {
  planting: "식재",
  paving: "바닥·포장",
  facility: "시설물",
  scenery: "경관요소",
};

export const LANDSCAPE_MATERIALS: PlanLandscapeMaterial[] = [
  { id: "tree-canopy", name: "느티나무", shortLabel: "느티나무", category: "planting", pickerGroup: "trees", photoRender: "tree", realWidthMeters: 5, realHeightMeters: 5.4, photoDepthMeters: 5, planAssetUrl: "/materials/landscape/large-tree.webp", modelAssetUrl: null, sideAssetUrl: "/assets/photoreal/large-tree-side.webp", color: "#397b4a", shape: "circle", planWidth: 104, planHeight: 104 },
  { id: "cherry-tree", name: "벚나무", shortLabel: "벚나무", category: "planting", pickerGroup: "trees", photoRender: "tree", realWidthMeters: 4, realHeightMeters: 4.4, photoDepthMeters: 4, planAssetUrl: "/assets/photoreal/cherry-tree-top.webp", modelAssetUrl: null, sideAssetUrl: "/assets/photoreal/small-flowering-tree-side.webp", color: "#d58aa2", shape: "circle", planWidth: 92, planHeight: 92 },
  { id: "ginkgo-tree", name: "은행나무", shortLabel: "은행나무", category: "planting", pickerGroup: "trees", photoRender: "tree", realWidthMeters: 4.1, realHeightMeters: 5.2, photoDepthMeters: 4.1, planAssetUrl: "/materials/landscape/small-tree.webp", modelAssetUrl: null, sideAssetUrl: "/assets/photoreal/ginkgo-tree-side.webp", color: "#6f953e", shape: "circle", planWidth: 92, planHeight: 92 },
  { id: "maple", name: "단풍나무", shortLabel: "단풍나무", category: "planting", pickerGroup: "trees", photoRender: "tree", realWidthMeters: 4.2, realHeightMeters: 4.2, photoDepthMeters: 4.2, planAssetUrl: "/assets/photoreal/maple-tree-top.webp", modelAssetUrl: null, sideAssetUrl: "/assets/photoreal/maple-tree-side.webp", color: "#a44237", shape: "circle", planWidth: 94, planHeight: 94 },
  { id: "pine", name: "소나무", shortLabel: "소나무", category: "planting", pickerGroup: "trees", photoRender: "tree", realWidthMeters: 4.5, realHeightMeters: 5, photoDepthMeters: 4.2, planAssetUrl: "/assets/photoreal/korean-pine-top.webp", modelAssetUrl: null, sideAssetUrl: "/assets/photoreal/korean-pine-side.webp", color: "#315b3c", shape: "conifer", planWidth: 98, planHeight: 98 },
  { id: "shrub", name: "둥근 관목", shortLabel: "관목", category: "planting", pickerGroup: "flowers", realWidthMeters: 1.2, realHeightMeters: 1.2, planAssetUrl: "/assets/photoreal/shrub_01-thumb.png", modelAssetUrl: "/models/landscape/shrub_01/shrub_01_1k.gltf", color: "#6a963f", shape: "cluster" },
  { id: "flower", name: "혼합 꽃", shortLabel: "혼합꽃", category: "planting", pickerGroup: "flowers", realWidthMeters: 0.8, realHeightMeters: 0.65, planAssetUrl: "/materials/landscape/flowers.webp", modelAssetUrl: "/models/landscape/flower_gazania/flower_gazania_1k.gltf", color: "#b36b82", shape: "cluster", planWidth: 72, planHeight: 72 },
  { id: "hydrangea", name: "파란 수국", shortLabel: "수국", category: "planting", pickerGroup: "flowers", photoRender: "plant", realWidthMeters: 1.8, realHeightMeters: 1.15, photoDepthMeters: 1.55, planAssetUrl: "/assets/photoreal/hydrangea-top.webp", modelAssetUrl: null, sideAssetUrl: "/assets/photoreal/hydrangea-cluster.webp", color: "#6687c1", shape: "cluster", planWidth: 94, planHeight: 82 },
  { id: "marigold", name: "노란 메리골드", shortLabel: "메리골드", category: "planting", pickerGroup: "flowers", photoRender: "plant", realWidthMeters: 1.6, realHeightMeters: 0.62, photoDepthMeters: 1.15, planAssetUrl: "/assets/photoreal/marigold-top.webp", modelAssetUrl: null, sideAssetUrl: "/assets/photoreal/marigold-cluster.webp", color: "#e39a25", shape: "cluster", planWidth: 96, planHeight: 68 },
  { id: "lavender", name: "보라 라벤더", shortLabel: "라벤더", category: "planting", pickerGroup: "flowers", photoRender: "plant", realWidthMeters: 1.9, realHeightMeters: 0.72, photoDepthMeters: 1, planAssetUrl: "/assets/photoreal/lavender-top.webp", modelAssetUrl: null, sideAssetUrl: "/assets/photoreal/lavender-cluster.webp", color: "#7259a6", shape: "cluster", planWidth: 104, planHeight: 62 },
  { id: "flower-pink", name: "분홍꽃", shortLabel: "분홍꽃", category: "planting", realWidthMeters: 0.9, realHeightMeters: 0.9, planAssetUrl: "/materials/landscape/flowers.webp", modelAssetUrl: null, color: "#d66f9a", shape: "cluster", planWidth: 72, planHeight: 72 },
  { id: "flower-yellow", name: "노란꽃", shortLabel: "노란꽃", category: "planting", realWidthMeters: 0.9, realHeightMeters: 0.9, planAssetUrl: "/materials/landscape/flowers.webp", modelAssetUrl: null, color: "#e4b53f", shape: "cluster", planWidth: 72, planHeight: 72 },
  { id: "ornamental-grass", name: "억새류", shortLabel: "억새류", category: "planting", realWidthMeters: 1.2, realHeightMeters: 1.2, planAssetUrl: null, modelAssetUrl: null, color: "#a7ad67", shape: "cluster" },
  { id: "lawn", name: "잔디", shortLabel: "잔디", category: "planting", realWidthMeters: 3, realHeightMeters: 3, planAssetUrl: "/materials/landscape/lawn.webp", modelAssetUrl: null, color: "#85ae57", shape: "organic", planWidth: 116, planHeight: 86 },
  { id: "groundcover", name: "지피식물", shortLabel: "지피", category: "planting", realWidthMeters: 1.5, realHeightMeters: 1.5, planAssetUrl: null, modelAssetUrl: null, color: "#8ca94d", shape: "organic" },
  { id: "gravel", name: "자갈", shortLabel: "자갈", category: "paving", realWidthMeters: 2, realHeightMeters: 2, planAssetUrl: null, modelAssetUrl: null, color: "#9b9a8e", shape: "organic" },
  { id: "stepping-stone", name: "디딤석", shortLabel: "디딤석", category: "paving", realWidthMeters: 0.6, realHeightMeters: 0.4, planAssetUrl: null, modelAssetUrl: null, color: "#777a72", shape: "line" },
  { id: "block", name: "보도블록", shortLabel: "블록", category: "paving", realWidthMeters: 2, realHeightMeters: 1.5, planAssetUrl: null, modelAssetUrl: null, color: "#b17c61", shape: "rect" },
  { id: "deck", name: "목재 데크", shortLabel: "데크", category: "paving", realWidthMeters: 3, realHeightMeters: 2, planAssetUrl: null, modelAssetUrl: null, color: "#8b674b", shape: "rect" },
  { id: "straight-path", name: "직선길", shortLabel: "직선길", category: "paving", realWidthMeters: 3.2, realHeightMeters: 1.15, planAssetUrl: null, modelAssetUrl: null, color: "#ad9270", shape: "line" },
  { id: "curved-path", name: "곡선길", shortLabel: "곡선길", category: "paving", realWidthMeters: 3.2, realHeightMeters: 3.2, planAssetUrl: "/materials/landscape/walking-path.webp", modelAssetUrl: null, color: "#ad9270", shape: "organic", planWidth: 72, planHeight: 138 },
  { id: "school-paver", name: "학교 바닥타일", shortLabel: "바닥타일", category: "paving", realWidthMeters: 2.4, realHeightMeters: 2.4, planAssetUrl: null, modelAssetUrl: null, color: "#aeb1aa", shape: "rect" },
  { id: "dirt-path", name: "기존 산책로", shortLabel: "기존 산책로", category: "paving", realWidthMeters: 3, realHeightMeters: 3, planAssetUrl: "/materials/landscape/walking-path.webp", modelAssetUrl: null, color: "#a7875e", shape: "line", planWidth: 72, planHeight: 138 },
  { id: "bench", name: "벤치", shortLabel: "벤치", category: "facility", pickerGroup: "facilities", realWidthMeters: 1.8, realHeightMeters: 0.6, planAssetUrl: "/materials/landscape/bench.webp", modelAssetUrl: "/models/landscape/painted_wooden_bench/painted_wooden_bench_1k.gltf", color: "#73513b", shape: "rect", planWidth: 112, planHeight: 54 },
  { id: "table", name: "테이블", shortLabel: "테이블", category: "facility", realWidthMeters: 1.2, realHeightMeters: 1.2, planAssetUrl: null, modelAssetUrl: null, color: "#735b48", shape: "circle" },
  { id: "pergola", name: "파고라", shortLabel: "파고라", category: "facility", realWidthMeters: 3, realHeightMeters: 3, planAssetUrl: null, modelAssetUrl: null, color: "#5d6670", shape: "rect" },
  { id: "light", name: "조명", shortLabel: "조명", category: "facility", realWidthMeters: 0.3, realHeightMeters: 0.3, planAssetUrl: null, modelAssetUrl: null, color: "#d7b843", shape: "circle" },
  { id: "fence", name: "울타리", shortLabel: "울타리", category: "facility", realWidthMeters: 2, realHeightMeters: 0.2, planAssetUrl: null, modelAssetUrl: null, color: "#4d5a59", shape: "line" },
  { id: "planter", name: "화분", shortLabel: "화분", category: "facility", realWidthMeters: 0.8, realHeightMeters: 0.8, planAssetUrl: null, modelAssetUrl: null, color: "#9c694b", shape: "rect" },
  { id: "rock", name: "자연석", shortLabel: "자연석", category: "scenery", pickerGroup: "facilities", realWidthMeters: 1, realHeightMeters: 0.8, planAssetUrl: "/materials/landscape/rocks.webp", modelAssetUrl: "/models/landscape/rock_moss_set_01/rock_moss_set_01_1k.gltf", color: "#777b76", shape: "organic", planWidth: 70, planHeight: 58 },
  { id: "pond", name: "작은 연못", shortLabel: "연못", category: "scenery", realWidthMeters: 3, realHeightMeters: 2, planAssetUrl: null, modelAssetUrl: null, color: "#4d91a0", shape: "organic" },
  { id: "flower-bed", name: "실사 꽃화단", shortLabel: "꽃화단", category: "scenery", pickerGroup: "facilities", photoRender: "plant", realWidthMeters: 2.4, realHeightMeters: 1.25, photoDepthMeters: 1.5, planAssetUrl: "/materials/landscape/flower-bed.webp", modelAssetUrl: null, sideAssetUrl: "/assets/photoreal/raised-flower-bed-side.png", color: "#9a704e", shape: "organic", planWidth: 128, planHeight: 82 },
  { id: "sculpture", name: "작은 조형물", shortLabel: "조형물", category: "scenery", realWidthMeters: 1, realHeightMeters: 1, planAssetUrl: null, modelAssetUrl: null, color: "#7f6b94", shape: "cluster" },
];

export function findLandscapeMaterial(id: string): PlanLandscapeMaterial | undefined {
  return LANDSCAPE_MATERIALS.find((material) => material.id === id);
}
