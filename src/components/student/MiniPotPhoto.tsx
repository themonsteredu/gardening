"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { PotPreset } from "@/domain/models";
import { getMiniMaterialImage } from "@/lib/mini-material-image-store";

export function MiniPotPhoto({
  pot,
  className,
  sizes,
  priority = false,
  previewUrl,
}: {
  pot: PotPreset;
  className?: string;
  sizes: string;
  priority?: boolean;
  previewUrl?: string | null;
}) {
  const [storedPhoto, setStoredPhoto] = useState<{ storageKey: string; url: string } | null>(null);

  useEffect(() => {
    if (!pot.photoStorageKey) return;
    const storageKey = pot.photoStorageKey;
    let active = true;
    let objectUrl: string | null = null;
    getMiniMaterialImage(storageKey).then((blob) => {
      if (!active || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setStoredPhoto({ storageKey, url: objectUrl });
    }).catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pot.photoStorageKey]);

  const fallback = pot.shape === "tall_cylinder"
    ? "/assets/photoreal/tall-clear-glass-vase-v2.png"
    : "/assets/photoreal/clear-glass-vase.png";
  const storedUrl = storedPhoto && storedPhoto.storageKey === pot.photoStorageKey ? storedPhoto.url : null;
  const source = previewUrl || storedUrl || pot.photoUrl || fallback;
  return <Image className={className} src={source} alt={`${pot.name} 실제 컵`} fill sizes={sizes} unoptimized priority={priority} />;
}
