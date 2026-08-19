"use client";

import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import type { MiniGardenMaterial } from "@/domain/models";
import { getMiniMaterialImage } from "@/lib/mini-material-image-store";

function useMiniMaterialPhoto(material: MiniGardenMaterial) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!material.photoStorageKey) return;
    let alive = true;
    let nextUrl: string | null = null;
    getMiniMaterialImage(material.photoStorageKey).then((blob) => {
      if (!alive || !blob) return;
      nextUrl = URL.createObjectURL(blob);
      setObjectUrl(nextUrl);
    }).catch(() => undefined);
    return () => {
      alive = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [material.photoStorageKey]);

  return material.photoStorageKey ? objectUrl ?? material.photoUrl : material.photoUrl;
}

export function MiniMaterialThumbnail({ material }: { material: MiniGardenMaterial }) {
  const imageUrl = useMiniMaterialPhoto(material);

  return (
    <span className={`student-object-thumbnail student-object-thumbnail--${material.type}`}>
      {imageUrl ? <Image src={imageUrl} alt={`${material.name} 실제 사진`} fill sizes="96px" unoptimized /> : <i style={material.color ? { background: material.color } : undefined}>{material.name.slice(0, 1)}</i>}
    </span>
  );
}

export function MiniMaterialTexture({
  material,
  className,
  style,
}: {
  material: MiniGardenMaterial;
  className: string;
  style?: CSSProperties;
}) {
  const imageUrl = useMiniMaterialPhoto(material);

  return (
    <span className={className} style={{ ...style, backgroundColor: material.color ?? "#c8b38b" }} title={material.name}>
      {imageUrl
        ? <Image src={imageUrl} alt="" fill sizes="420px" unoptimized />
        : <i aria-hidden="true" style={{ background: material.color ?? "#c8b38b" }} />}
    </span>
  );
}
