import type { PotPreset } from "@/domain/models";

export interface MiniPotSceneDimensions {
  widthPixels: number;
  depthPixels: number;
  heightPixels: number;
  widthRatio: number;
  depthRatio: number;
  heightRatio: number;
}

export function createMiniPotSceneDimensions(pot: PotPreset): MiniPotSceneDimensions {
  const largestHorizontal = Math.max(pot.widthCm, pot.depthCm, 1);
  const widthRatio = pot.widthCm / largestHorizontal;
  const depthRatio = pot.depthCm / largestHorizontal;
  const heightRatio = pot.heightCm / largestHorizontal;
  return {
    widthPixels: Math.round(260 * widthRatio),
    depthPixels: Math.round(260 * depthRatio),
    heightPixels: Math.round(Math.max(110, Math.min(310, 260 * heightRatio))),
    widthRatio,
    depthRatio,
    heightRatio,
  };
}

export function clampMiniPotCamera(tilt: number, zoom: number): { tilt: number; zoom: number } {
  return {
    tilt: Math.max(4, Math.min(82, tilt)),
    zoom: Math.max(0.65, Math.min(1.35, zoom)),
  };
}
