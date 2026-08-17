"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { MiniGardenMaterial } from "@/domain/models";
import { getMiniMaterialImage } from "@/lib/mini-material-image-store";

export function MiniMaterialThumbnail({ material }: { material: MiniGardenMaterial }) {
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

  return (
    <span className={`student-object-thumbnail student-object-thumbnail--${material.type}`}>
      {objectUrl ? <Image src={objectUrl} alt={`${material.name} 실제 사진`} fill sizes="54px" unoptimized /> : <i style={material.color ? { background: material.color } : undefined}>{material.name.slice(0, 1)}</i>}
    </span>
  );
}
