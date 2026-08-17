import type { MiniGardenLayer } from "@/domain/models";

export const MINI_GARDEN_LAYER_STEP_CM = 0.5;

export interface MiniGardenLayerSegment {
  id: string;
  bottomRatio: number;
  heightRatio: number;
  topRatio: number;
}

function roundToStep(value: number): number {
  return Math.round(value / MINI_GARDEN_LAYER_STEP_CM) * MINI_GARDEN_LAYER_STEP_CM;
}

export function sortMiniGardenLayers(layers: MiniGardenLayer[]): MiniGardenLayer[] {
  return [...layers].sort((a, b) => a.order - b.order);
}

export function normalizeMiniGardenLayerOrder(layers: MiniGardenLayer[]): MiniGardenLayer[] {
  return sortMiniGardenLayers(layers).map((layer, order) => ({ ...layer, order }));
}

export function getMiniGardenLayerTotalHeight(layers: MiniGardenLayer[]): number {
  return roundToStep(layers.reduce((total, layer) => total + layer.heightCm, 0));
}

export function getMiniGardenLayerMaxHeight(
  potHeightCm: number,
  layers: MiniGardenLayer[],
  layerId: string,
): number {
  const otherHeight = layers.reduce(
    (total, layer) => total + (layer.id === layerId ? 0 : layer.heightCm),
    0,
  );
  return Math.max(MINI_GARDEN_LAYER_STEP_CM, roundToStep(potHeightCm - otherHeight));
}

export function canAddMiniGardenLayer(potHeightCm: number, layers: MiniGardenLayer[]): boolean {
  return getMiniGardenLayerTotalHeight(layers) + MINI_GARDEN_LAYER_STEP_CM <= potHeightCm;
}

export function updateMiniGardenLayerHeight(
  layers: MiniGardenLayer[],
  layerId: string,
  requestedHeightCm: number,
  potHeightCm: number,
): MiniGardenLayer[] {
  const maxHeight = getMiniGardenLayerMaxHeight(potHeightCm, layers, layerId);
  const nextHeight = Math.max(
    MINI_GARDEN_LAYER_STEP_CM,
    Math.min(maxHeight, roundToStep(requestedHeightCm)),
  );
  return layers.map((layer) =>
    layer.id === layerId ? { ...layer, heightCm: nextHeight } : layer,
  );
}

export function moveMiniGardenLayer(
  layers: MiniGardenLayer[],
  layerId: string,
  direction: "up" | "down",
): MiniGardenLayer[] {
  const ordered = normalizeMiniGardenLayerOrder(layers);
  const index = ordered.findIndex((layer) => layer.id === layerId);
  const targetIndex = direction === "up" ? index + 1 : index - 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return ordered;
  [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];
  return ordered.map((layer, order) => ({ ...layer, order }));
}

export function createMiniGardenLayerSegments(
  layers: MiniGardenLayer[],
  potHeightCm: number,
): MiniGardenLayerSegment[] {
  const safePotHeight = Math.max(potHeightCm, MINI_GARDEN_LAYER_STEP_CM);
  let currentBottom = 0;
  return normalizeMiniGardenLayerOrder(layers).map((layer) => {
    const height = Math.min(layer.heightCm, Math.max(0, safePotHeight - currentBottom));
    const segment = {
      id: layer.id,
      bottomRatio: currentBottom / safePotHeight,
      heightRatio: height / safePotHeight,
      topRatio: (currentBottom + height) / safePotHeight,
    };
    currentBottom += height;
    return segment;
  });
}
