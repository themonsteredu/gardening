export interface AutoBackgroundResult {
  blob: Blob;
  width: number;
  height: number;
  ignoredTopRatio: number;
  ignoredBottomRatio: number;
}

interface UiBands {
  top: number;
  bottom: number;
}

const MAX_OUTPUT_EDGE = 1920;

function rowLooksLikeInterface(data: Uint8ClampedArray, width: number, y: number): boolean {
  let neutral = 0;
  let brightOrDark = 0;
  let sampled = 0;
  const step = Math.max(1, Math.floor(width / 320));
  for (let x = 0; x < width; x += step) {
    const index = (y * width + x) * 4;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const high = Math.max(r, g, b);
    const low = Math.min(r, g, b);
    if (high - low < 30) neutral += 1;
    if (high > 205 || high < 56) brightOrDark += 1;
    sampled += 1;
  }
  return sampled > 0 && neutral / sampled > 0.68 && brightOrDark / sampled > 0.56;
}

export function detectIgnoredUiBands(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): UiBands {
  const limit = Math.floor(height * 0.14);
  const minimum = Math.max(4, Math.floor(height * 0.018));

  function scan(fromTop: boolean): number {
    let matches = 0;
    let misses = 0;
    for (let offset = 0; offset < limit; offset += 1) {
      const y = fromTop ? offset : height - 1 - offset;
      if (rowLooksLikeInterface(data, width, y)) {
        matches = offset + 1;
        misses = 0;
      } else {
        misses += 1;
        if (misses > 2) break;
      }
    }
    return matches >= minimum ? matches : 0;
  }

  return { top: scan(true), bottom: scan(false) };
}

export function simplifyImagePixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  adjustment = 0,
): UiBands {
  const luminance = new Float32Array(width * height);
  for (let index = 0; index < luminance.length; index += 1) {
    const pixel = index * 4;
    luminance[index] = pixels[pixel] * 0.2126 + pixels[pixel + 1] * 0.7152 + pixels[pixel + 2] * 0.0722;
  }
  const bands = detectIgnoredUiBands(pixels, width, height);
  const brightnessOffset = Math.max(-18, Math.min(18, adjustment));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const pixel = index * 4;
      const lum = luminance[index];
      const inUiBand = y < bands.top || y >= height - bands.bottom;
      const photoMix = inUiBand ? 0.42 : 0.64;
      const lightTone = Math.max(0, Math.min(255, 214 + (lum - 128) * 0.5 + brightnessOffset));
      pixels[pixel] = lightTone * (1 - photoMix) + pixels[pixel] * photoMix;
      pixels[pixel + 1] = lightTone * (1 - photoMix) + pixels[pixel + 1] * photoMix;
      pixels[pixel + 2] = lightTone * (1 - photoMix) + pixels[pixel + 2] * photoMix;
    }
  }
  return bands;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("자동 설계도 이미지를 만들지 못했습니다."));
    }, "image/webp", 0.9);
  });
}

export async function createAutoSiteBackground(
  source: Blob,
  adjustment = 0,
): Promise<AutoBackgroundResult> {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("이 브라우저에서는 이미지 자동 처리를 사용할 수 없습니다.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const bands = simplifyImagePixels(pixels, width, height, adjustment);

  context.putImageData(imageData, 0, 0);
  return {
    blob: await canvasToBlob(canvas),
    width,
    height,
    ignoredTopRatio: bands.top / height,
    ignoredBottomRatio: bands.bottom / height,
  };
}
