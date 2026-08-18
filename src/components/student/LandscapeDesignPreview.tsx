import Image from "next/image";
import type { CSSProperties } from "react";
import { findLandscapeMaterial } from "@/data/landscape-materials";
import type { LandscapeObject } from "@/domain/models";

export function LandscapeDesignPreview({
  objects,
  variant,
  label,
}: {
  objects: LandscapeObject[];
  variant: "plan" | "spatial";
  label: string;
}) {
  return (
    <div className={`gallery-design-preview gallery-design-preview--${variant}`} aria-label={label}>
      <div className="gallery-preview-world">
        <div className="gallery-preview-base">
          <span className="gallery-preview-building">학교 건물</span>
          <span className="gallery-preview-field">기존 공간</span>
          <span className="gallery-preview-zone">설계 가능 영역</span>
        </div>
        {objects.slice(0, 18).map((object) => {
          const material = findLandscapeMaterial(object.materialId);
          if (!material?.planAssetUrl) return null;
          const width = Math.max(22, Math.min(58, (material.planWidth ?? 76) * 0.46 * object.scale));
          const height = Math.max(18, Math.min(58, (material.planHeight ?? 76) * 0.46 * object.scale));
          return (
            <span
              key={object.id}
              className={`gallery-preview-object gallery-preview-object--${object.category} gallery-preview-object--${material.id}`}
              title={material.name}
              style={{
                left: `${object.x * 100}%`,
                top: `${object.y * 100}%`,
                width,
                height,
                zIndex: object.zIndex + 2,
                transform: `translate(-50%, -50%) rotate(${object.rotation}deg)`,
              } as CSSProperties}
            ><Image src={material.planAssetUrl} alt="" fill sizes="60px" unoptimized /></span>
          );
        })}
      </div>
      <span className="gallery-preview-label">{variant === "plan" ? "배치" : "입체 보기"}</span>
    </div>
  );
}
