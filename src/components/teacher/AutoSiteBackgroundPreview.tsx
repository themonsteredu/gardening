"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { AutoSiteBackground } from "@/domain/models";
import { getSiteImageFile } from "@/lib/site-image-store";

export function AutoSiteBackgroundPreview({ background, compact = false }: { background: AutoSiteBackground; compact?: boolean }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    getSiteImageFile(background.storageKey).then((blob) => {
      if (!active || !blob) { if (active) setFailed(true); return; }
      objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [background.storageKey]);

  return (
    <div className={`auto-background-preview ${compact ? "auto-background-preview--compact" : ""}`}>
      {!previewUrl && !failed ? <span>설계도 불러오는 중</span> : null}
      {failed ? <span>미리보기를 불러오지 못했습니다.</span> : null}
      {previewUrl && background.mimeType === "application/pdf" ? <object data={previewUrl} type="application/pdf" title="자동 설계 배경 PDF" /> : null}
      {previewUrl && background.mimeType !== "application/pdf" ? <Image src={previewUrl} alt="자동 생성된 학교 설계도" fill sizes={compact ? "(max-width: 900px) 100vw, 700px" : "(max-width: 900px) 100vw, 900px"} unoptimized /> : null}
      <b>설계도</b>
    </div>
  );
}
