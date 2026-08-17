export const SITE_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

export const SITE_IMAGE_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
].join(",");

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

const SUPPORTED_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION));

export interface SiteImageCandidate {
  name: string;
  size: number;
  type: string;
}

export function resolveSiteImageMimeType(candidate: SiteImageCandidate): string | null {
  if (SUPPORTED_MIME_TYPES.has(candidate.type)) return candidate.type;
  const extension = candidate.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? null;
}

export function validateSiteImageCandidate(
  candidate: SiteImageCandidate,
): string | null {
  if (!resolveSiteImageMimeType(candidate)) {
    return "JPG, PNG, WebP 또는 PDF 파일만 등록할 수 있습니다.";
  }
  if (candidate.size <= 0) return "내용이 없는 파일은 등록할 수 없습니다.";
  if (candidate.size > SITE_IMAGE_MAX_BYTES) {
    return "파일 크기는 20MB 이하로 준비해 주세요.";
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
