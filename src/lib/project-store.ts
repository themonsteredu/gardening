import { DEMO_PROJECT } from "@/data/demo-project";
import type { AutoSiteBackground, EstimatedBuildingFootprint, LandscapeGalleryEntry, MiniGardenKit, SchoolProject, SiteImage, StudentLandscapeDesign, StudentMiniGardenDesign } from "@/domain/models";

export const PROJECT_STORAGE_KEY = "gardening.teacher.project.v1";
export const SITE_IMAGE_META_STORAGE_KEY = "gardening.site-image.meta.v1";
export const AUTO_SITE_BACKGROUND_META_STORAGE_KEY = "gardening.site-background.meta.v1";
export const STUDENT_SESSION_STORAGE_PREFIX = "gardening.student.session.";
export const STUDENT_LANDSCAPE_DESIGN_STORAGE_PREFIX = "gardening.student.landscape-design.v1.";
export const CLASS_LANDSCAPE_GALLERY_STORAGE_PREFIX = "gardening.class.landscape-gallery.v1.";
export const MINI_GARDEN_KITS_STORAGE_KEY = "gardening.teacher.mini-garden-kits.v1";
export const STUDENT_MINI_GARDEN_DESIGN_STORAGE_PREFIX = "gardening.student.mini-garden-design.v1.";

export function getStudentSessionStorageKey(sessionId: string): string {
  return `${STUDENT_SESSION_STORAGE_PREFIX}${sessionId}`;
}

export function getStudentLandscapeDesignStorageKey(sessionId: string): string {
  return `${STUDENT_LANDSCAPE_DESIGN_STORAGE_PREFIX}${sessionId}`;
}

export function getClassLandscapeGalleryStorageKey(projectId: string): string {
  return `${CLASS_LANDSCAPE_GALLERY_STORAGE_PREFIX}${projectId}`;
}

export function getStudentMiniGardenDesignStorageKey(sessionId: string): string {
  return `${STUDENT_MINI_GARDEN_DESIGN_STORAGE_PREFIX}${sessionId}`;
}

export function parseStoredProject(value: string | null): SchoolProject {
  if (!value) return DEMO_PROJECT;
  try {
    return JSON.parse(value) as SchoolProject;
  } catch {
    return DEMO_PROJECT;
  }
}

export function parseStoredSiteImage(value: string | null): SiteImage | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as SiteImage;
  } catch {
    return null;
  }
}

export function parseStoredAutoSiteBackground(value: string | null): AutoSiteBackground | null {
  if (!value) return null;
  try {
    const background = JSON.parse(value) as AutoSiteBackground;
    const buildingFootprints = Array.isArray(background.buildingFootprints)
      ? background.buildingFootprints.filter(isEstimatedBuildingFootprint)
      : [];
    return typeof background?.siteImageId === "string"
      && typeof background.storageKey === "string"
      && typeof background.method === "string"
      ? { ...background, buildingFootprints }
      : null;
  } catch {
    return null;
  }
}

function isEstimatedBuildingFootprint(value: unknown): value is EstimatedBuildingFootprint {
  if (!value || typeof value !== "object") return false;
  const building = value as Partial<EstimatedBuildingFootprint>;
  return typeof building.id === "string"
    && typeof building.x === "number"
    && typeof building.y === "number"
    && typeof building.width === "number"
    && typeof building.depth === "number"
    && typeof building.rotation === "number"
    && typeof building.estimatedFloors === "number"
    && typeof building.roofColor === "string"
    && typeof building.confidence === "number";
}

export function parseStoredLandscapeDesign(value: string | null): StudentLandscapeDesign | null {
  if (!value) return null;
  try {
    const design = JSON.parse(value) as StudentLandscapeDesign;
    return Array.isArray(design.objects) ? design : null;
  } catch {
    return null;
  }
}

export function parseStoredLandscapeGallery(value: string | null): LandscapeGalleryEntry[] {
  if (!value) return [];
  try {
    const entries = JSON.parse(value) as LandscapeGalleryEntry[];
    if (!Array.isArray(entries)) return [];
    return entries.filter((entry) =>
      typeof entry?.studentSessionId === "string"
      && typeof entry.nickname === "string"
      && typeof entry.intentionKeyword === "string"
      && typeof entry.intentionReason === "string"
      && Array.isArray(entry.objects),
    );
  } catch {
    return [];
  }
}

export function upsertLandscapeGalleryEntry(
  entries: LandscapeGalleryEntry[],
  nextEntry: LandscapeGalleryEntry,
): LandscapeGalleryEntry[] {
  return [
    nextEntry,
    ...entries.filter((entry) => entry.studentSessionId !== nextEntry.studentSessionId),
  ];
}

export function parseStoredMiniGardenKits(value: string | null): MiniGardenKit[] {
  if (!value) return [];
  try {
    const kits = JSON.parse(value) as MiniGardenKit[];
    if (!Array.isArray(kits)) return [];
    return kits.filter((kit) =>
      typeof kit?.id === "string"
      && typeof kit.name === "string"
      && typeof kit.potPreset?.id === "string"
      && typeof kit.potPreset.widthCm === "number"
      && typeof kit.potPreset.depthCm === "number"
      && typeof kit.potPreset.heightCm === "number"
      && Array.isArray(kit.materials),
    );
  } catch {
    return [];
  }
}

export function parseStoredMiniGardenDesign(value: string | null): StudentMiniGardenDesign | null {
  if (!value) return null;
  try {
    const design = JSON.parse(value) as StudentMiniGardenDesign;
    if (
      typeof design?.id !== "string"
      || typeof design.studentSessionId !== "string"
      || typeof design.miniGardenKitId !== "string"
      || !Array.isArray(design.layers)
      || !Array.isArray(design.objects)
      || !Array.isArray(design.makingSteps)
    ) return null;
    const validLayers = design.layers.every((layer) =>
      typeof layer?.id === "string"
      && typeof layer.materialId === "string"
      && typeof layer.heightCm === "number"
      && Number.isFinite(layer.heightCm)
      && layer.heightCm > 0
      && typeof layer.order === "number",
    );
    return validLayers ? {
      ...design,
      completedMakingStepIds: Array.isArray(design.completedMakingStepIds)
        ? design.completedMakingStepIds.filter((id) => typeof id === "string")
        : [],
      finalPhotoStorageKey: typeof design.finalPhotoStorageKey === "string" ? design.finalPhotoStorageKey : null,
      finalPhotoName: typeof design.finalPhotoName === "string" ? design.finalPhotoName : null,
      finalPhotoMimeType: typeof design.finalPhotoMimeType === "string" ? design.finalPhotoMimeType : null,
      finalPhotoUploadedAt: typeof design.finalPhotoUploadedAt === "string" ? design.finalPhotoUploadedAt : null,
      finalComparisonChecklistIds: Array.isArray(design.finalComparisonChecklistIds)
        ? design.finalComparisonChecklistIds.filter((id) => typeof id === "string")
        : [],
      finalComparisonReflection: typeof design.finalComparisonReflection === "string"
        ? design.finalComparisonReflection
        : "",
      completedAt: typeof design.completedAt === "string" ? design.completedAt : null,
    } : null;
  } catch {
    return null;
  }
}

export function upsertMiniGardenKit(kits: MiniGardenKit[], nextKit: MiniGardenKit): MiniGardenKit[] {
  return [nextKit, ...kits.filter((kit) => kit.id !== nextKit.id)];
}
