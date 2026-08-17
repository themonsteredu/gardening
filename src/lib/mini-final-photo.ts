export const MINI_FINAL_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
export const MINI_FINAL_PHOTO_MAX_BYTES = 12 * 1024 * 1024;
export const MINI_FINAL_REFLECTION_MIN_LENGTH = 10;

export const MINI_FINAL_COMPARISON_CHECKS = [
  { id: "layer-order", label: "모래 층의 순서와 높이를 설계와 비교했어요." },
  { id: "material-amount", label: "준비된 실제 재료의 수량 안에서 만들었어요." },
  { id: "object-placement", label: "식물·돌·장식의 위치를 모델과 비교했어요." },
  { id: "finish-safety", label: "작품이 안정적인지 확인하고 작업대를 정리했어요." },
] as const;

interface PhotoCandidate {
  name: string;
  type: string;
  size: number;
}

const VALID_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VALID_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

export function validateMiniFinalPhoto(file: PhotoCandidate): string | null {
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (!VALID_MIME_TYPES.has(file.type.toLowerCase()) && !VALID_EXTENSIONS.has(extension)) {
    return "JPG, PNG, WebP 사진만 올릴 수 있습니다.";
  }
  if (file.size <= 0) return "내용이 없는 사진은 올릴 수 없습니다.";
  if (file.size > MINI_FINAL_PHOTO_MAX_BYTES) return "사진 크기는 12MB 이하여야 합니다.";
  return null;
}

export function isMiniFinalComparisonReady(
  hasPhoto: boolean,
  completedChecklistIds: string[],
  reflection: string,
): boolean {
  const completed = new Set(completedChecklistIds);
  return hasPhoto
    && MINI_FINAL_COMPARISON_CHECKS.every((item) => completed.has(item.id))
    && reflection.trim().length >= MINI_FINAL_REFLECTION_MIN_LENGTH;
}
