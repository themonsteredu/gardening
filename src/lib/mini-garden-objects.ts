import type { MiniGardenObject } from "@/domain/models";

export const MINI_GARDEN_OBJECT_MIN_POSITION = 6;
export const MINI_GARDEN_OBJECT_MAX_POSITION = 94;
export const MINI_GARDEN_OBJECT_MIN_SCALE = 0.5;
export const MINI_GARDEN_OBJECT_MAX_SCALE = 1.8;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function normalizeMiniGardenObject(object: MiniGardenObject): MiniGardenObject {
  return {
    ...object,
    x: roundToTenth(clamp(object.x, MINI_GARDEN_OBJECT_MIN_POSITION, MINI_GARDEN_OBJECT_MAX_POSITION)),
    y: roundToTenth(clamp(object.y, MINI_GARDEN_OBJECT_MIN_POSITION, MINI_GARDEN_OBJECT_MAX_POSITION)),
    z: Math.max(0, roundToTenth(object.z)),
    scale: roundToTenth(clamp(object.scale, MINI_GARDEN_OBJECT_MIN_SCALE, MINI_GARDEN_OBJECT_MAX_SCALE)),
    rotationY: ((Math.round(object.rotationY) % 360) + 360) % 360,
  };
}

export function updateMiniGardenObject(
  objects: MiniGardenObject[],
  objectId: string,
  changes: Partial<Pick<MiniGardenObject, "x" | "y" | "z" | "scale" | "rotationY">>,
): MiniGardenObject[] {
  return objects.map((object) =>
    object.id === objectId ? normalizeMiniGardenObject({ ...object, ...changes }) : object,
  );
}

export function countMiniGardenMaterialUsage(objects: MiniGardenObject[], materialId: string): number {
  return objects.reduce((count, object) => count + (object.materialId === materialId ? 1 : 0), 0);
}

export function canPlaceMiniGardenMaterial(
  objects: MiniGardenObject[],
  materialId: string,
  availableQuantity: number | null,
): boolean {
  return availableQuantity === null || countMiniGardenMaterialUsage(objects, materialId) < availableQuantity;
}

export function getNextMiniGardenObjectPosition(objectCount: number): { x: number; y: number } {
  const positions = [
    { x: 50, y: 50 },
    { x: 32, y: 36 },
    { x: 68, y: 38 },
    { x: 35, y: 68 },
    { x: 67, y: 67 },
    { x: 50, y: 25 },
    { x: 50, y: 78 },
  ];
  const base = positions[objectCount % positions.length];
  const cycleOffset = Math.floor(objectCount / positions.length) * 3;
  return {
    x: clamp(base.x + cycleOffset, MINI_GARDEN_OBJECT_MIN_POSITION, MINI_GARDEN_OBJECT_MAX_POSITION),
    y: clamp(base.y - cycleOffset, MINI_GARDEN_OBJECT_MIN_POSITION, MINI_GARDEN_OBJECT_MAX_POSITION),
  };
}

export function duplicateMiniGardenObject(
  objects: MiniGardenObject[],
  source: MiniGardenObject,
  id: string,
): MiniGardenObject[] {
  return [
    ...objects,
    normalizeMiniGardenObject({
      ...source,
      id,
      x: source.x + 7,
      y: source.y + 7,
      rotationY: source.rotationY + 15,
    }),
  ];
}
