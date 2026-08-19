import "client-only";

const MAX_IMAGE_EDGE = 1400;
const BACKGROUND_DISTANCE = 82;
const TRANSPARENT_DISTANCE = 34;

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

function colorDistance(red: number, green: number, blue: number, color: RgbColor): number {
  return Math.sqrt(
    (red - color.red) ** 2
    + (green - color.green) ** 2
    + (blue - color.blue) ** 2,
  );
}

function estimateCornerColor(data: Uint8ClampedArray, width: number, height: number): RgbColor {
  const sampleSize = Math.max(2, Math.min(14, Math.floor(Math.min(width, height) * 0.05)));
  const corners = [
    [0, 0],
    [Math.max(0, width - sampleSize), 0],
    [0, Math.max(0, height - sampleSize)],
    [Math.max(0, width - sampleSize), Math.max(0, height - sampleSize)],
  ];
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (const [startX, startY] of corners) {
    for (let y = startY; y < Math.min(height, startY + sampleSize); y += 1) {
      for (let x = startX; x < Math.min(width, startX + sampleSize); x += 1) {
        const offset = (y * width + x) * 4;
        if (data[offset + 3] < 32) continue;
        red += data[offset];
        green += data[offset + 1];
        blue += data[offset + 2];
        count += 1;
      }
    }
  }
  if (count === 0) return { red: 255, green: 255, blue: 255 };
  return { red: red / count, green: green / count, blue: blue / count };
}

function loadPhoto(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("사진을 읽지 못했습니다."));
    };
    image.src = objectUrl;
  });
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("투명 PNG를 만들지 못했습니다."));
    }, "image/png", 0.94);
  });
}

export async function removeMiniImageBackground(blob: Blob): Promise<Blob> {
  const image = await loadPhoto(blob);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("사진 배경을 처리할 수 없습니다.");
  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;
  const background = estimateCornerColor(data, width, height);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const enqueue = (index: number) => {
    if (visited[index]) return;
    visited[index] = 1;
    queue[tail] = index;
    tail += 1;
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const offset = index * 4;
    const distance = colorDistance(data[offset], data[offset + 1], data[offset + 2], background);
    if (data[offset + 3] > 24 && distance > BACKGROUND_DISTANCE) continue;
    data[offset + 3] = distance <= TRANSPARENT_DISTANCE
      ? 0
      : Math.min(data[offset + 3], Math.round(((distance - TRANSPARENT_DISTANCE) / (BACKGROUND_DISTANCE - TRANSPARENT_DISTANCE)) * 255));
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x < width - 1) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y < height - 1) enqueue(index + width);
  }

  context.putImageData(imageData, 0, 0);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= 12) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return canvasToPng(canvas);
  const padding = Math.max(6, Math.round(Math.max(maxX - minX, maxY - minY) * 0.04));
  const sourceX = Math.max(0, minX - padding);
  const sourceY = Math.max(0, minY - padding);
  const sourceWidth = Math.min(width - sourceX, maxX - sourceX + padding + 1);
  const sourceHeight = Math.min(height - sourceY, maxY - sourceY + padding + 1);
  const trimmed = document.createElement("canvas");
  trimmed.width = sourceWidth;
  trimmed.height = sourceHeight;
  trimmed.getContext("2d")?.drawImage(canvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
  return canvasToPng(trimmed);
}
