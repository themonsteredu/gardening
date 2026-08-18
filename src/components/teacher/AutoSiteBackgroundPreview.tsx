"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { AutoSiteBackground } from "@/domain/models";
import { getSiteImageFile } from "@/lib/site-image-store";

type PreviewImage = Pick<AutoSiteBackground, "storageKey" | "mimeType">;

export function AutoSiteBackgroundPreview({ image, compact = false }: { image: PreviewImage; compact?: boolean }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    getSiteImageFile(image.storageKey).then((blob) => {
      if (!active || !blob) { if (active) setFailed(true); return; }
      objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [image.storageKey]);

  return (
    <div className={`auto-background-preview ${compact ? "auto-background-preview--compact" : ""}`}>
      {!previewUrl && !failed ? <span>학교 사진 불러오는 중</span> : null}
      {failed ? <span>미리보기를 불러오지 못했습니다.</span> : null}
      {previewUrl && image.mimeType === "application/pdf" ? <object data={previewUrl} type="application/pdf" title="학교 공간 PDF" /> : null}
      {previewUrl && image.mimeType !== "application/pdf" ? <Image src={previewUrl} alt="학생이 꾸밀 학교 사진" fill sizes={compact ? "(max-width: 900px) 100vw, 700px" : "(max-width: 900px) 100vw, 900px"} unoptimized /> : null}
      <b>학교 사진</b>
    </div>
  );
}
