import "client-only";

export const SCHOOL_LOGO_ACCEPT = "image/png,image/jpeg,image/webp";
const SCHOOL_LOGO_MAX_BYTES = 5 * 1024 * 1024;
const SCHOOL_LOGO_EDGE = 256;
const SUPPORTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("학교 로고를 읽지 못했습니다."));
    };
    image.src = objectUrl;
  });
}

export function validateSchoolLogo(file: File): string | null {
  if (!SUPPORTED_TYPES.has(file.type)) return "PNG, JPG 또는 WebP 로고만 등록할 수 있습니다.";
  if (file.size <= 0) return "내용이 없는 로고 파일은 등록할 수 없습니다.";
  if (file.size > SCHOOL_LOGO_MAX_BYTES) return "학교 로고는 5MB 이하로 준비해 주세요.";
  return null;
}

export async function createSchoolLogoDataUrl(file: File): Promise<string> {
  const error = validateSchoolLogo(file);
  if (error) throw new Error(error);
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = SCHOOL_LOGO_EDGE;
  canvas.height = SCHOOL_LOGO_EDGE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("학교 로고를 처리하지 못했습니다.");
  const scale = Math.min(SCHOOL_LOGO_EDGE / image.naturalWidth, SCHOOL_LOGO_EDGE / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.clearRect(0, 0, SCHOOL_LOGO_EDGE, SCHOOL_LOGO_EDGE);
  context.drawImage(image, (SCHOOL_LOGO_EDGE - width) / 2, (SCHOOL_LOGO_EDGE - height) / 2, width, height);
  return canvas.toDataURL("image/png");
}
