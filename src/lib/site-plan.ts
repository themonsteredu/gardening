import type { Point2D, SiteFeatureKind, SitePlanFeature } from "@/domain/models";

export const SITE_FEATURE_OPTIONS: ReadonlyArray<{
  kind: Exclude<SiteFeatureKind, "editable_zone">;
  label: string;
  color: string;
}> = [
  { kind: "building", label: "학교 건물", color: "#d05b45" },
  { kind: "playground", label: "운동장", color: "#d59b42" },
  { kind: "walkway", label: "보행로", color: "#7d6cc8" },
  { kind: "green", label: "기존 녹지", color: "#3d9a68" },
  { kind: "tree", label: "기존 수목", color: "#277a50" },
  { kind: "entrance", label: "출입구", color: "#288da0" },
  { kind: "parking", label: "주차 공간", color: "#66758b" },
  { kind: "facility", label: "기타 시설", color: "#9a6c4f" },
];

export function getFeatureOption(kind: SiteFeatureKind) {
  return SITE_FEATURE_OPTIONS.find((option) => option.kind === kind);
}

export function normalizePointerPoint(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
): Point2D {
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  return {
    x: clamp((clientX - rect.left) / rect.width),
    y: clamp((clientY - rect.top) / rect.height),
  };
}

export function polygonArea(points: Point2D[]): number {
  if (points.length < 3) return 0;
  return Math.abs(
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );
}

export function isUsablePolygon(points: Point2D[]): boolean {
  return points.length >= 3 && polygonArea(points) >= 0.0005;
}

export function pointsToSvg(points: Point2D[]): string {
  return points.map((point) => `${point.x * 1000},${point.y * 1000}`).join(" ");
}

export function getExistingSiteFeatures(features: SitePlanFeature[]): SitePlanFeature[] {
  return features.filter((feature) => feature.kind !== "editable_zone");
}

export function getEditableZoneFeatures(features: SitePlanFeature[]): SitePlanFeature[] {
  return features.filter((feature) => feature.kind === "editable_zone");
}
