import { describe, expect, it } from "vitest";
import type { LandscapeObject } from "@/domain/models";
import { buildLandscapePlanSchedule, getLandscapePlanCode } from "./landscape-plan";

function object(materialId: string, id: string): LandscapeObject {
  return {
    id,
    materialId,
    x: 0.5,
    y: 0.5,
    scale: 1,
    rotation: 0,
    width: 1,
    height: 1,
    category: materialId === "bench" ? "facility" : "planting",
    zIndex: 1,
  };
}

describe("approximate landscape plan", () => {
  it("uses stable professional-style reference codes", () => {
    expect(getLandscapePlanCode("tree-canopy")).toBe("T1");
    expect(getLandscapePlanCode("flower")).toBe("F1");
    expect(getLandscapePlanCode("bench")).toBe("B1");
    expect(getLandscapePlanCode("missing")).toBeNull();
  });

  it("counts placed materials without inventing dimensions", () => {
    expect(buildLandscapePlanSchedule([
      object("tree-canopy", "tree-1"),
      object("tree-canopy", "tree-2"),
      object("bench", "bench-1"),
    ])).toEqual([
      expect.objectContaining({ code: "T1", label: "큰 나무", quantity: 2 }),
      expect.objectContaining({ code: "B1", label: "벤치", quantity: 1 }),
    ]);
  });

  it("ignores unknown legacy material ids", () => {
    expect(buildLandscapePlanSchedule([object("missing", "unknown")])).toEqual([]);
  });
});
