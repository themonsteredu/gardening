import { describe, expect, it } from "vitest";
import { DEMO_MINI_GARDEN_KIT } from "@/data/demo-mini-garden";
import {
  getClassLandscapeGalleryStorageKey,
  getStudentLandscapeDesignStorageKey,
  getStudentMiniGardenDesignStorageKey,
  getStudentSessionStorageKey,
  parseStoredLandscapeGallery,
  parseStoredLandscapeDesign,
  parseStoredAutoSiteBackground,
  parseStoredMiniGardenKits,
  parseStoredMiniGardenDesign,
  upsertLandscapeGalleryEntry,
  upsertMiniGardenKit,
} from "./project-store";

describe("student browser storage", () => {
  it("parses an automatically generated school background", () => {
    const background = {
      id: "background-1",
      siteImageId: "image-1",
      storageKey: "background-1",
      mimeType: "image/webp",
      width: 1200,
      height: 800,
      generatedAt: "2026-08-18T00:00:00.000Z",
      method: "visual-simplification-v1",
      adjustment: 0,
      ignoredTopRatio: 0.06,
      ignoredBottomRatio: 0.04,
    };
    expect(parseStoredAutoSiteBackground(JSON.stringify(background))).toEqual({ ...background, buildingFootprints: [] });
    expect(parseStoredAutoSiteBackground('{"siteImageId":1}')).toBeNull();
  });

  it("namespaces session and design data by student session", () => {
    expect(getStudentSessionStorageKey("student-1")).toBe("gardening.student.session.student-1");
    expect(getStudentLandscapeDesignStorageKey("student-1")).toBe("gardening.student.landscape-design.v1.student-1");
    expect(getClassLandscapeGalleryStorageKey("project-1")).toBe("gardening.class.landscape-gallery.v1.project-1");
    expect(getStudentMiniGardenDesignStorageKey("student-1")).toBe("gardening.student.mini-garden-design.v1.student-1");
  });

  it("parses structured landscape design data", () => {
    const design = {
      id: "design-1",
      studentSessionId: "student-1",
      schoolProjectId: "project-1",
      objects: [],
      intentionKeyword: null,
      intentionReason: null,
      thumbnailUrl: null,
      submittedAt: null,
    };
    expect(parseStoredLandscapeDesign(JSON.stringify(design))).toEqual(design);
    expect(parseStoredLandscapeDesign('{"objects":"invalid"}')).toBeNull();
    expect(parseStoredLandscapeDesign("invalid-json")).toBeNull();
  });

  it("parses and replaces a student's submitted gallery entry", () => {
    const first = {
      id: "entry-1",
      studentSessionId: "student-1",
      schoolProjectId: "project-1",
      nickname: "민지",
      objects: [],
      intentionKeyword: "휴식",
      intentionReason: "그늘 아래에서 쉬도록 배치했습니다.",
      submittedAt: "2026-08-17T01:00:00.000Z",
    };
    const next = { ...first, intentionKeyword: "녹지" };
    expect(parseStoredLandscapeGallery(JSON.stringify([first]))).toEqual([first]);
    expect(parseStoredLandscapeGallery('{"invalid":true}')).toEqual([]);
    expect(upsertLandscapeGalleryEntry([first], next)).toEqual([next]);
  });

  it("parses and updates saved mini garden kits", () => {
    const kit = {
      id: "kit-1",
      name: "조경키트 A",
      potPreset: { id: "pot-1", name: "사각형", shape: "square" as const, widthCm: 18, depthCm: 18, heightCm: 16 },
      materials: [],
    };
    expect(parseStoredMiniGardenKits(JSON.stringify([kit]))).toEqual([kit, DEMO_MINI_GARDEN_KIT]);
    expect(parseStoredMiniGardenKits('{"invalid":true}')).toEqual([]);
    expect(upsertMiniGardenKit([kit], { ...kit, name: "조경키트 B" })[0].name).toBe("조경키트 B");
  });

  it("parses a student mini garden design with layer data", () => {
    const design = {
      id: "mini-design-1",
      studentSessionId: "student-1",
      miniGardenKitId: "kit-1",
      layers: [{ id: "layer-1", materialId: "sand-1", heightCm: 2, order: 0 }],
      objects: [],
      makingSteps: [],
      completedMakingStepIds: [],
      renderedImageUrl: null,
      finalPhotoUrl: null,
      finalPhotoStorageKey: null,
      finalPhotoName: null,
      finalPhotoMimeType: null,
      finalPhotoUploadedAt: null,
      finalComparisonChecklistIds: [],
      finalComparisonReflection: "",
      completedAt: null,
    };
    expect(parseStoredMiniGardenDesign(JSON.stringify(design))).toEqual(design);
    expect(parseStoredMiniGardenDesign('{"layers":"invalid"}')).toBeNull();
  });

  it("migrates an older mini garden design without production progress", () => {
    const oldDesign = {
      id: "mini-design-old",
      studentSessionId: "student-1",
      miniGardenKitId: "kit-1",
      layers: [],
      objects: [],
      makingSteps: [],
      renderedImageUrl: null,
      finalPhotoUrl: null,
    };
    expect(parseStoredMiniGardenDesign(JSON.stringify(oldDesign))).toMatchObject({
      completedMakingStepIds: [],
      finalPhotoStorageKey: null,
      finalComparisonChecklistIds: [],
      finalComparisonReflection: "",
      completedAt: null,
    });
  });
});
