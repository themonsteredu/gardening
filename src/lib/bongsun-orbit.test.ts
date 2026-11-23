import { describe, expect, it } from "vitest";
import {
  campusToLocalPoint, getOrbitCameraPose, getOrbitFrameAngle, getOrbitFrameUrl, getOrbitGardenSide,
  getOrbitViewAngle, localToCampusPoint, normalizeOrbitAngle, orbitDragAngle,
} from "./bongsun-orbit";

describe("Bongseon school orbit", () => {
  it("reaches the rear in one half-width drag and wraps in both directions", () => {
    expect(orbitDragAngle(0, -400, 800)).toBe(180);
    expect(orbitDragAngle(0, 400, 800)).toBe(180);
    expect(orbitDragAngle(350, -100, 360)).toBe(90);
    expect(orbitDragAngle(180, 800, 800)).toBe(180);
    expect(normalizeOrbitAngle(-720)).toBe(0);
  });

  it("rounds to existing frame names across the seam", () => {
    expect(getOrbitFrameAngle(-6)).toBe(355);
    expect(getOrbitFrameUrl(-1)).toBe("/previews/bongsun/orbit/000.webp");
    expect(getOrbitFrameUrl(367)).toBe("/previews/bongsun/orbit/005.webp");
    expect(getOrbitFrameUrl(-182)).toBe("/previews/bongsun/orbit/180.webp");
  });

  it("preserves the active garden across a full turn and supports existing view shortcuts", () => {
    expect(getOrbitGardenSide(90)).toBe("front");
    expect(getOrbitGardenSide(95)).toBe("rear");
    expect(getOrbitGardenSide(-95)).toBe("rear");
    expect(getOrbitGardenSide(270)).toBe("front");
    expect(getOrbitViewAngle("front-left")).toBe(-22.5);
    expect(getOrbitViewAngle("front", "rear")).toBe(180);
    expect(getOrbitViewAngle("rear", "rear")).toBe(180);
  });

  it("uses one campus pivot for both saved gardens and the through-going camera", () => {
    const point = { x: 3, z: 4 };
    expect(localToCampusPoint(point, "front")).toEqual(point);
    const rear = localToCampusPoint(point, "rear");
    expect(rear.x).toBe(-3);
    expect(rear.z).toBeCloseTo(-19.4);
    expect(campusToLocalPoint(rear, "rear").z).toBeCloseTo(point.z);
    const frontCamera = getOrbitCameraPose(0, 1100 / 520);
    const backCamera = getOrbitCameraPose(180, 1100 / 520);
    expect(backCamera.target.z).toBeCloseTo(localToCampusPoint(frontCamera.target, "rear").z);
    expect(backCamera.position.z).toBeCloseTo(localToCampusPoint(frontCamera.position, "rear").z);
    expect(getOrbitCameraPose(360, 1100 / 520)).toEqual(frontCamera);
    const sideCamera = getOrbitCameraPose(90, 1100 / 520);
    expect(sideCamera.position.x).toBeCloseTo(frontCamera.position.z - frontCamera.target.z + 7);
  });
});
