import type { MiniMaterialType } from "@/domain/models";

export const MINI_MATERIAL_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const MINI_MATERIAL_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

export const MINI_MATERIAL_TYPE_LABELS: Record<MiniMaterialType, string> = {
  layer: "층으로 쌓기",
  scatter: "표면에 뿌리기",
  object: "개별 물체로 배치",
  plant: "식물",
  structure: "구조물",
};

export const MINI_MATERIAL_TYPE_DESCRIPTIONS: Record<MiniMaterialType, string> = {
  layer: "색모래·흙처럼 높이와 순서를 정합니다.",
  scatter: "자갈·장식칩처럼 표면 영역에 펼칩니다.",
  object: "돌·조개·피규어처럼 하나씩 배치합니다.",
  plant: "기본 식물 모델과 연결해 배치합니다.",
  structure: "벤치·울타리·팻말처럼 공간에 놓습니다.",
};

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const SUPPORTED_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION));

export interface MiniMaterialImageCandidate {
  name: string;
  size: number;
  type: string;
}

export function resolveMiniMaterialImageMimeType(candidate: MiniMaterialImageCandidate): string | null {
  if (SUPPORTED_MIME_TYPES.has(candidate.type)) return candidate.type;
  const extension = candidate.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? null;
}

export function validateMiniMaterialImage(candidate: MiniMaterialImageCandidate): string | null {
  if (!resolveMiniMaterialImageMimeType(candidate)) return "JPG, PNG 또는 WebP 사진만 등록할 수 있습니다.";
  if (candidate.size <= 0) return "내용이 없는 사진은 등록할 수 없습니다.";
  if (candidate.size > MINI_MATERIAL_IMAGE_MAX_BYTES) return "재료 사진은 8MB 이하로 준비해 주세요.";
  return null;
}

export function validateMiniMaterialQuantity(value: number | null): boolean {
  return value === null || (Number.isInteger(value) && value >= 1 && value <= 99);
}

export function validateMiniMaterialSize(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value > 0 && value <= 100);
}
