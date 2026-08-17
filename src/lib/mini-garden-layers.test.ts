import { describe, expect, it } from "vitest";
import type { MiniGardenLayer } from "@/domain/models";
import {
  canAddMiniGardenLayer,
  createMiniGardenLayerSegments,
  getMiniGardenLayerTotalHeight,
  moveMiniGardenLayer,
  updateMiniGardenLayerHeight,
} from "./mini-garden-layers";

const layers: MiniGardenLayer[] = [
  { id: "mint", materialId: "material-mint", heightCm: 2, order: 0 },
  { id: "white", materialId: "material-white", heightCm: 3, order: 1 },
  { id: "brown", materialId: "material-brown", heightCm: 1.5, order: 2 },
];

describe("mini garden sand layers", () => {
  it("calculates total height and pot capacity", () => {
    expect(getMiniGardenLayerTotalHeight(layers)).toBe(6.5);
    expect(canAddMiniGardenLayer(7, layers)).toBe(true);
    expect(canAddMiniGardenLayer(6.5, layers)).toBe(false);
  });

  it("clamps layer height to the remaining pot height in 0.5cm units", () => {
    const updated = updateMiniGardenLayerHeight(layers, "white", 20, 8);
    expect(updated.find((layer) => layer.id === "white")?.heightCm).toBe(4.5);
    expect(getMiniGardenLayerTotalHeight(updated)).toBe(8);
  });

  it("moves a layer one level while preserving consecutive order", () => {
    const moved = moveMiniGardenLayer(layers, "mint", "up");
    expect(moved.map((layer) => layer.id)).toEqual(["white", "mint", "brown"]);
    expect(moved.map((layer) => layer.order)).toEqual([0, 1, 2]);
  });

  it("creates bottom-to-top ratios for the transparent pot", () => {
    const segments = createMiniGardenLayerSegments(layers, 10);
    expect(segments[0]).toMatchObject({ id: "mint", bottomRatio: 0, heightRatio: 0.2, topRatio: 0.2 });
    expect(segments[1]).toMatchObject({ id: "white", bottomRatio: 0.2, heightRatio: 0.3, topRatio: 0.5 });
    expect(segments[2].topRatio).toBe(0.65);
  });
});
