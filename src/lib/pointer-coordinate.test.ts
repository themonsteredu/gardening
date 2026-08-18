import { describe, expect, it } from "vitest";
import { normalizePointerPoint } from "./pointer-coordinate";

describe("photo placement coordinates", () => {
  it("normalizes and clamps pointer coordinates", () => {
    const rect = { left: 100, top: 50, width: 400, height: 200 };
    expect(normalizePointerPoint(300, 100, rect)).toEqual({ x: 0.5, y: 0.25 });
    expect(normalizePointerPoint(0, 500, rect)).toEqual({ x: 0, y: 1 });
  });
});
