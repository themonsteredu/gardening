export const LANDSCAPE_STAGES = [
  "joined",
  "site_review",
  "site_design",
  "submitted",
  "gallery",
  "mini_model",
  "making",
  "complete",
] as const;

export type LandscapeStage = (typeof LANDSCAPE_STAGES)[number];

export const LANDSCAPE_STAGE_LABELS: Record<LandscapeStage, string> = {
  joined: "입장 완료",
  site_review: "학교 공간 확인",
  site_design: "조경 설계 중",
  submitted: "설계 제출",
  gallery: "작품 비교",
  mini_model: "미니조경 모델링",
  making: "실제 작품 제작",
  complete: "프로젝트 완료",
};

export type ProjectStatus = "draft" | "ready" | "open" | "closed";
export type PlanLayerKind = "source" | "existing" | "student";
export type SiteFeatureKind =
  | "building"
  | "playground"
  | "walkway"
  | "green"
  | "tree"
  | "entrance"
  | "parking"
  | "facility"
  | "editable_zone";

export interface Point2D {
  x: number;
  y: number;
}

export interface SchoolProject {
  id: string;
  schoolName: string;
  className: string;
  title: string;
  mission: string;
  classCode: string;
  status: ProjectStatus;
  createdAt: string;
  siteImageId: string | null;
  sitePlanId: string | null;
  miniGardenKitId: string | null;
}

export interface SiteImage {
  id: string;
  schoolProjectId: string;
  name: string;
  url: string | null;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  storageKey: string;
  uploadedAt: string;
}

export interface ScaleReference {
  start: Point2D;
  end: Point2D;
  actualLengthMeters: number;
  pixelsPerMeter: number;
}

export interface SitePlanFeature {
  id: string;
  kind: SiteFeatureKind;
  label: string;
  points: Point2D[];
  layer: PlanLayerKind;
}

export interface SitePlan {
  id: string;
  siteImageId: string;
  features: SitePlanFeature[];
  scaleReference: ScaleReference | null;
}

export interface EditableZone {
  id: string;
  sitePlanId: string;
  label: string;
  points: Point2D[];
}

export type LandscapeMaterialCategory =
  | "planting"
  | "paving"
  | "facility"
  | "scenery";

export interface LandscapeMaterial {
  id: string;
  name: string;
  category: LandscapeMaterialCategory;
  realWidthMeters: number;
  realHeightMeters: number;
  planAssetUrl: string | null;
  modelAssetUrl: string | null;
}

export interface LandscapeObject {
  id: string;
  materialId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  width: number;
  height: number;
  category: LandscapeMaterialCategory;
  zIndex: number;
}

export interface StudentLandscapeDesign {
  id: string;
  studentSessionId: string;
  schoolProjectId: string;
  objects: LandscapeObject[];
  intentionKeyword: string | null;
  intentionReason: string | null;
  thumbnailUrl: string | null;
  submittedAt: string | null;
}

export interface LandscapeGalleryEntry {
  id: string;
  studentSessionId: string;
  schoolProjectId: string;
  nickname: string;
  objects: LandscapeObject[];
  intentionKeyword: string;
  intentionReason: string;
  submittedAt: string;
}

export type PotShape =
  | "round"
  | "square"
  | "rectangle"
  | "low_wide"
  | "tall_cylinder";

export interface PotPreset {
  id: string;
  name: string;
  shape: PotShape;
  widthCm: number;
  depthCm: number;
  heightCm: number;
}

export type MiniMaterialType =
  | "layer"
  | "scatter"
  | "object"
  | "plant"
  | "structure";

export interface MiniGardenMaterial {
  id: string;
  name: string;
  type: MiniMaterialType;
  photoUrl: string | null;
  photoStorageKey: string | null;
  photoMimeType: string | null;
  photoName: string | null;
  modelAssetUrl: string | null;
  color: string | null;
  availableQuantity: number | null;
  actualSizeCm: number | null;
}

export interface MiniGardenKit {
  id: string;
  name: string;
  potPreset: PotPreset;
  materials: MiniGardenMaterial[];
}

export interface MiniGardenLayer {
  id: string;
  materialId: string;
  heightCm: number;
  order: number;
}

export interface MiniGardenObject {
  id: string;
  materialId: string;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotationY: number;
}

export interface StudentMiniGardenDesign {
  id: string;
  studentSessionId: string;
  miniGardenKitId: string;
  layers: MiniGardenLayer[];
  objects: MiniGardenObject[];
  makingSteps: string[];
  completedMakingStepIds: string[];
  renderedImageUrl: string | null;
  finalPhotoUrl: string | null;
  finalPhotoStorageKey: string | null;
  finalPhotoName: string | null;
  finalPhotoMimeType: string | null;
  finalPhotoUploadedAt: string | null;
  finalComparisonChecklistIds: string[];
  finalComparisonReflection: string;
  completedAt: string | null;
}

export interface Classroom {
  id: string;
  schoolProjectId: string;
  teacherName: string;
  expectedStudentCount: number | null;
  openedAt: string | null;
  closedAt: string | null;
}

export interface StudentSession {
  id: string;
  classroomId: string;
  nickname: string;
  stage: LandscapeStage;
  joinedAt: string;
  updatedAt: string;
}

export interface StudentProgressSummary {
  total: number;
  joined: number;
  designing: number;
  submitted: number;
  miniGarden: number;
  complete: number;
}
