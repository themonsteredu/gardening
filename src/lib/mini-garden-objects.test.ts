import { describe, expect, it } from "vitest";
import type { MiniGardenObject } from "@/domain/models";
import {
  canPlaceMiniGardenMaterial,
  countMiniGardenMaterialUsage,
  duplicateMiniGardenObject,
  getNextMiniGardenObjectPosition,
  normalizeMiniGardenObject,
  updateMiniGardenObject,
} from "./mini-garden-objects";

const object: MiniGardenObject = {
  id: "object-1",
  materialId: "plant-1",
  x: 50,
  y: 45,
  z: 6,
  scale: 1,
  rotationY: 0,
};

describe("mini garden object placement", () => {
  it("keeps position, scale and rotation inside editable ranges", () => {
    expect(normalizeMiniGardenObject({ ...object, x: -20, y: 120, z: -3, scale: 3, rotationY: -15 })).toMatchObject({
      x: 6,
      y: 94,
      z: 0,
      scale: 1.8,
      rotationY: 345,
    });
  });

  it("updates only the selected object", () => {
    const another = { ...object, id: "object-2", x: 20 };
    const updated = updateMiniGardenObject([object, another], "object-1", { x: 72, scale: 1.2 });
    expect(updated[0]).toMatchObject({ x: 72, scale: 1.2 });
    expect(updated[1]).toEqual(another);
  });

  it("enforces the teacher's available quantity", () => {
    const objects = [object, { ...object, id: "object-2" }];
    expect(countMiniGardenMaterialUsage(objects, "plant-1")).toBe(2);
    expect(canPlaceMiniGardenMaterial(objects, "plant-1", 2)).toBe(false);
    expect(canPlaceMiniGardenMaterial(objects, "plant-1", null)).toBe(true);
  });

  it("duplicates with a visible offset and normalized rotation", () => {
    const duplicated = duplicateMiniGardenObject([], { ...object, x: 92, y: 91, rotationY: 350 }, "copy-1");
    expect(duplicated[0]).toMatchObject({ id: "copy-1", x: 94, y: 94, rotationY: 5 });
    expect(getNextMiniGardenObjectPosition(0)).toEqual({ x: 50, y: 50 });
    expect(getNextMiniGardenObjectPosition(3)).toEqual({ x: 35, y: 68 });
  });
});
