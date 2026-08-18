import type { EstimatedBuildingFootprint } from "@/domain/models";

export interface AutoBackgroundResult {
  blob: Blob;
  width: number;
  height: number;
  ignoredTopRatio: number;
  ignoredBottomRatio: number;
  buildingFootprints: EstimatedBuildingFootprint[];
  buildingDetection: "image-heuristic" | "layout-fallback";
}

interface UiBands {
  top: number;
  bottom: number;
}

const MAX_OUTPUT_EDGE = 1920;
const MAX_ANALYSIS_EDGE = 180;

interface SampledPixel {
  r: number;
  g: number;
  b: number;
  kind: number;
}

interface BuildingCandidate extends EstimatedBuildingFootprint {
  score: number;
}

function roofKind(r: number, g: number, b: number): number {
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  const chroma = high - low;
  const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const looksGreen = g > r * 1.06 && g > b * 1.06 && g - Math.min(r, b) > 12;
  if (looksGreen || luminance < 48 || luminance > 238) return 0;
  if (r > g * 1.12 && r > b * 1.08 && r > 72) return 1;
  if (b > r * 1.12 && b > g * 1.02 && b > 72) return 2;
  if (chroma < 38 && luminance > 68 && luminance < 218) return 3;
  if (r >= g && g >= b && r - b > 13 && r < 230) return 4;
  return 0;
}

function colorDistance(a: SampledPixel, b: SampledPixel): number {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

function toHex(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

function overlapRatio(a: EstimatedBuildingFootprint, b: EstimatedBuildingFootprint): number {
  const left = Math.max(a.x - a.width / 2, b.x - b.width / 2);
  const right = Math.min(a.x + a.width / 2, b.x + b.width / 2);
  const top = Math.max(a.y - a.depth / 2, b.y - b.depth / 2);
  const bottom = Math.min(a.y + a.depth / 2, b.y + b.depth / 2);
  if (right <= left || bottom <= top) return 0;
  const intersection = (right - left) * (bottom - top);
  return intersection / Math.min(a.width * a.depth, b.width * b.depth);
}

function createLayoutFallback(samples: SampledPixel[], gridWidth: number, gridHeight: number): EstimatedBuildingFootprint[] {
  const ranked = samples
    .map((sample, index) => ({
      sample,
      x: (index % gridWidth + 0.5) / gridWidth,
      y: (Math.floor(index / gridWidth) + 0.5) / gridHeight,
      score: sample.kind === 1 || sample.kind === 2 ? 4 : sample.kind === 4 ? 2.5 : sample.kind === 3 ? 1.5 : 0,
    }))
    .filter((item) => item.score > 0 && item.x > 0.08 && item.x < 0.92 && item.y > 0.08 && item.y < 0.92)
    .toSorted((a, b) => b.score - a.score);

  const selected: typeof ranked = [];
  for (const item of ranked) {
    if (selected.some((current) => Math.hypot(current.x - item.x, current.y - item.y) < 0.2)) continue;
    selected.push(item);
    if (selected.length === 3) break;
  }

  return selected.map((item, index) => ({
    id: `estimated-building-fallback-${index + 1}`,
    x: item.x,
    y: item.y,
    width: 0.15,
    depth: 0.052,
    rotation: index % 2 === 0 ? 0 : 90,
    estimatedFloors: 3,
    roofColor: `#${toHex(item.sample.r)}${toHex(item.sample.g)}${toHex(item.sample.b)}`,
    confidence: 0.22,
  }));
}

export function detectEstimatedBuildings(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  ignoredBands: UiBands = { top: 0, bottom: 0 },
): EstimatedBuildingFootprint[] {
  if (width < 8 || height < 8) return [];
  const step = Math.max(1, Math.ceil(Math.max(width, height) / MAX_ANALYSIS_EDGE));
  const gridWidth = Math.max(1, Math.floor(width / step));
  const gridHeight = Math.max(1, Math.floor(height / step));
  const samples: SampledPixel[] = new Array(gridWidth * gridHeight);

  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const sourceX = Math.min(width - 1, x * step + Math.floor(step / 2));
      const sourceY = Math.min(height - 1, y * step + Math.floor(step / 2));
      const pixel = (sourceY * width + sourceX) * 4;
      const inIgnoredBand = sourceY < ignoredBands.top || sourceY >= height - ignoredBands.bottom;
      const r = data[pixel];
      const g = data[pixel + 1];
      const b = data[pixel + 2];
      samples[y * gridWidth + x] = { r, g, b, kind: inIgnoredBand ? 0 : roofKind(r, g, b) };
    }
  }

  const visited = new Uint8Array(samples.length);
  const candidates: BuildingCandidate[] = [];
  const minimumPixels = Math.max(5, Math.floor(samples.length * 0.0003));

  for (let start = 0; start < samples.length; start += 1) {
    if (visited[start] || samples[start].kind === 0) continue;
    const queue = [start];
    const component: number[] = [];
    visited[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      component.push(current);
      const x = current % gridWidth;
      const y = Math.floor(current / gridWidth);
      const neighbors = [current - 1, current + 1, current - gridWidth, current + gridWidth];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= samples.length || visited[neighbor]) continue;
        const nextX = neighbor % gridWidth;
        const nextY = Math.floor(neighbor / gridWidth);
        if (Math.abs(nextX - x) + Math.abs(nextY - y) !== 1) continue;
        const currentSample = samples[current];
        const neighborSample = samples[neighbor];
        if (currentSample.kind !== neighborSample.kind || colorDistance(currentSample, neighborSample) > 112) continue;
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }

    if (component.length < minimumPixels) continue;
    let meanX = 0;
    let meanY = 0;
    let red = 0;
    let green = 0;
    let blue = 0;
    for (const index of component) {
      meanX += index % gridWidth;
      meanY += Math.floor(index / gridWidth);
      red += samples[index].r;
      green += samples[index].g;
      blue += samples[index].b;
    }
    meanX /= component.length;
    meanY /= component.length;
    let xx = 0;
    let yy = 0;
    let xy = 0;
    for (const index of component) {
      const dx = index % gridWidth - meanX;
      const dy = Math.floor(index / gridWidth) - meanY;
      xx += dx * dx;
      yy += dy * dy;
      xy += dx * dy;
    }
    const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let minLong = Number.POSITIVE_INFINITY;
    let maxLong = Number.NEGATIVE_INFINITY;
    let minShort = Number.POSITIVE_INFINITY;
    let maxShort = Number.NEGATIVE_INFINITY;
    for (const index of component) {
      const dx = index % gridWidth - meanX;
      const dy = Math.floor(index / gridWidth) - meanY;
      const along = dx * cos + dy * sin;
      const across = -dx * sin + dy * cos;
      minLong = Math.min(minLong, along);
      maxLong = Math.max(maxLong, along);
      minShort = Math.min(minShort, across);
      maxShort = Math.max(maxShort, across);
    }
    const longSide = maxLong - minLong + 1;
    const shortSide = maxShort - minShort + 1;
    const aspect = longSide / Math.max(1, shortSide);
    const footprintArea = longSide * shortSide;
    const areaRatio = footprintArea / samples.length;
    const fillRatio = component.length / footprintArea;
    if (longSide < 3 || shortSide < 1.5 || aspect < 1.12 || aspect > 14 || areaRatio < 0.00045 || areaRatio > 0.085 || fillRatio < 0.25) continue;

    const kind = samples[component[0]].kind;
    const widthRatio = Math.max(0.025, Math.min(0.36, (longSide + 1) / gridWidth));
    const depthRatio = Math.max(0.018, Math.min(0.18, (shortSide + 1) / gridHeight));
    const floors = Math.max(2, Math.min(5, Math.round(2 + widthRatio * 11)));
    candidates.push({
      id: `estimated-building-${candidates.length + 1}`,
      x: (meanX + 0.5) / gridWidth,
      y: (meanY + 0.5) / gridHeight,
      width: widthRatio,
      depth: depthRatio,
      rotation: angle * 180 / Math.PI,
      estimatedFloors: floors,
      roofColor: `#${toHex(red / component.length)}${toHex(green / component.length)}${toHex(blue / component.length)}`,
      confidence: Math.max(0.36, Math.min(0.9, 0.35 + fillRatio * 0.35 + Math.min(3, aspect) * 0.07 + (kind <= 2 ? 0.08 : 0))),
      score: component.length * fillRatio * Math.min(4, aspect) * (kind <= 2 ? 1.3 : 1),
    });
  }

  const selected: EstimatedBuildingFootprint[] = [];
  for (const candidate of candidates.toSorted((a, b) => b.score - a.score)) {
    if (selected.some((current) => overlapRatio(current, candidate) > 0.55)) continue;
    selected.push({
      id: candidate.id,
      x: candidate.x,
      y: candidate.y,
      width: candidate.width,
      depth: candidate.depth,
      rotation: candidate.rotation,
      estimatedFloors: candidate.estimatedFloors,
      roofColor: candidate.roofColor,
      confidence: candidate.confidence,
    });
    if (selected.length === 8) break;
  }
  return selected.length > 0 ? selected : createLayoutFallback(samples, gridWidth, gridHeight);
}

export async function detectEstimatedBuildingsFromBlob(source: Blob): Promise<EstimatedBuildingFootprint[]> {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, 720 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    return [];
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const imageData = context.getImageData(0, 0, width, height);
  const bands = detectIgnoredUiBands(imageData.data, width, height);
  return detectEstimatedBuildings(imageData.data, width, height, bands);
}

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
  const rawBands = detectIgnoredUiBands(pixels, width, height);
  const buildingFootprints = detectEstimatedBuildings(pixels, width, height, rawBands);
  const bands = simplifyImagePixels(pixels, width, height, adjustment);

  context.putImageData(imageData, 0, 0);
  return {
    blob: await canvasToBlob(canvas),
    width,
    height,
    ignoredTopRatio: bands.top / height,
    ignoredBottomRatio: bands.bottom / height,
    buildingFootprints,
    buildingDetection: buildingFootprints.some((building) => building.confidence >= 0.35)
      ? "image-heuristic"
      : "layout-fallback",
  };
}
