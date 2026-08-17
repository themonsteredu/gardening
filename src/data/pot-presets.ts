import type { PotPreset, PotShape } from "@/domain/models";

export const POT_SHAPE_LABELS: Record<PotShape, string> = {
  round: "원형",
  square: "사각형",
  rectangle: "직사각형",
  low_wide: "넓고 낮은 화분",
  tall_cylinder: "높은 원통형",
};

export const POT_PRESETS: PotPreset[] = [
  { id: "pot-round-18", name: "원형 기본", shape: "round", widthCm: 18, depthCm: 18, heightCm: 16 },
  { id: "pot-square-18", name: "사각형 기본", shape: "square", widthCm: 18, depthCm: 18, heightCm: 16 },
  { id: "pot-rectangle-24", name: "직사각형 기본", shape: "rectangle", widthCm: 24, depthCm: 14, heightCm: 15 },
  { id: "pot-low-wide-26", name: "넓고 낮은 화분", shape: "low_wide", widthCm: 26, depthCm: 20, heightCm: 10 },
  { id: "pot-tall-cylinder-14", name: "높은 원통형", shape: "tall_cylinder", widthCm: 14, depthCm: 14, heightCm: 24 },
];

export function isValidPotDimension(value: number): boolean {
  return Number.isFinite(value) && value >= 5 && value <= 60;
}

export function estimatePotVolumeLiters(pot: Pick<PotPreset, "shape" | "widthCm" | "depthCm" | "heightCm">): number {
  const rectangularVolume = pot.widthCm * pot.depthCm * pot.heightCm;
  const shapeFactor = pot.shape === "round" || pot.shape === "tall_cylinder" ? Math.PI / 4 : 1;
  return Math.round((rectangularVolume * shapeFactor) / 100) / 10;
}
