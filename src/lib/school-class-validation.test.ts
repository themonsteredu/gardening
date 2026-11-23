import { describe, expect, it } from "vitest";
import type { CampusModel } from "./campus-model";
import { parseClassCreation, parseWorkSubmission } from "./school-class-validation";

const campus: CampusModel = {
  id: "school-1", kind: "generated", schoolName: "  새봄중학교 ", region: "",
  floors: 3, bays: 10, wallColor: "#AA9977", roofColor: "#65796e",
};
const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const editKey = "ab".repeat(32);
const entry = {
  id: "gallery-design-1", studentSessionId: "student-1", schoolProjectId: "class-1",
  nickname: "정원사", intentionKeyword: "휴식", intentionReason: "친구들이 쉴 수 있는 뒤뜰이 필요해요.",
  sceneVersion: "generated-campus-v1", submittedAt: "2026-11-21T10:00:00.000Z",
  objects: [],
  surfaceStrokes: [{
    id: "stroke-1", gardenSide: "rear", materialId: "walking-path",
    points: [{ x: 0.5, y: 0.6 }], widthMeters: 1.45, zIndex: 1,
  }],
};

describe("shared school class requests", () => {
  it("accepts a teacher's campus, including a manual school or uploaded raster photo", () => {
    const value = parseClassCreation({ campus: { ...campus, frontPhoto: photo }, className: " 2학년 3반 " });
    expect(value.campus.schoolName).toBe("새봄중학교");
    expect(value.campus.region).toBe("");
    expect(value.campus.frontPhoto).toBe(photo);
    expect(value.className).toBe("2학년 3반");
    expect(parseClassCreation({ campus, className: "1반" }).campus.frontPhoto).toBeUndefined();
  });
  it.each([
    { frontPhoto: "https://example.org/sample.jpg" },
    { logo: "data:image/svg+xml;base64,PHN2Zy8+" },
    { logo: "data:image/png;base64,PHN2Zy8+" },
    { frontPhoto: "data:image/png;base64," + "a".repeat(230_001) },
    { sourceUrl: "javascript:alert(1)" },
    { sourceUrl: "https://u:p@example.org" },
    { floors: 1.5 }, { bays: 500 }, { wallColor: "url(malicious)" },
  ])("rejects invalid school appearance or image data", patch => {
    expect(() => parseClassCreation({ campus: { ...campus, ...patch }, className: "1반" })).toThrow();
  });
  it("keeps front/rear markings and accepts floor-only work", () => {
    const parsed = parseWorkSubmission({ entry, editKey });
    expect(parsed.entry.objects).toEqual([]);
    expect(parsed.entry.surfaceStrokes?.[0].gardenSide).toBe("rear");
    expect(parsed.editKey).toBe(editKey);
  });
  it("rejects malformed work, unsupported material IDs, external content and short edit keys", () => {
    const item = {
      id: "plant-1", gardenSide: "rear", materialId: "hydrangea", x: 0.4, y: 0.6, scale: 1,
      rotation: 0, width: 1, height: 1, zIndex: 1, category: "planting",
    };
    expect(parseWorkSubmission({ entry: { ...entry, objects: [item] }, editKey }).entry.objects[0].materialId).toBe("hydrangea");
    for (const broken of [{ ...item, materialId: "external" }, { ...item, x: NaN }, { ...item, y: 2 },
      { ...item, gardenSide: "side" }, { ...item, modelAssetUrl: "https://example.org/model" }]) {
      expect(() => parseWorkSubmission({ entry: { ...entry, objects: [broken] }, editKey })).toThrow();
    }
    expect(() => parseWorkSubmission({ entry: { ...entry, submittedAt: "now" }, editKey })).toThrow();
    expect(() => parseWorkSubmission({ entry: { ...entry, surfaceStrokes: [] }, editKey })).toThrow();
    expect(() => parseWorkSubmission({ entry, editKey: "short" })).toThrow();
  });
});
