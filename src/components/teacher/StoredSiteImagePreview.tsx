"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { SiteImage } from "@/domain/models";
import { formatFileSize } from "@/lib/site-image";
import { getSiteImageFile } from "@/lib/site-image-store";

interface StoredSiteImagePreviewProps {
  siteImage: SiteImage;
  compact?: boolean;
  showDetails?: boolean;
}

export function StoredSiteImagePreview({
  siteImage,
  compact = false,
  showDetails = true,
}: StoredSiteImagePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    getSiteImageFile(siteImage.storageKey)
      .then((blob) => {
        if (!active || !blob) {
          if (active) setLoadError(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [siteImage.storageKey]);

  return (
    <div className={`stored-site-preview ${compact ? "stored-site-preview--compact" : ""}`}>
      <div className="stored-site-preview__media">
        {!previewUrl && !loadError ? <div className="preview-loading">파일 불러오는 중</div> : null}
        {loadError ? (
          <div className="preview-error">
            <strong>미리보기를 불러오지 못했습니다.</strong>
            <span>등록된 파일을 다시 선택해 주세요.</span>
          </div>
        ) : null}
        {previewUrl && siteImage.mimeType === "application/pdf" ? (
          <object data={previewUrl} type="application/pdf" title={`${siteImage.name} PDF 미리보기`}>
            <div className="pdf-fallback"><span>PDF</span><strong>{siteImage.name}</strong></div>
          </object>
        ) : null}
        {previewUrl && siteImage.mimeType !== "application/pdf" ? (
          <Image
            src={previewUrl}
            alt={`${siteImage.name} 학교 공간 이미지`}
            fill
            sizes={compact ? "(max-width: 1100px) 50vw, 360px" : "(max-width: 900px) 100vw, 70vw"}
            unoptimized
          />
        ) : null}
        <span className="source-layer-badge">LAYER 1 · 원본 이미지</span>
      </div>
      {showDetails ? (
        <div className="stored-site-preview__details">
          <div>
            <strong>{siteImage.name}</strong>
            <span>{formatFileSize(siteImage.sizeBytes)} · {siteImage.mimeType === "application/pdf" ? "PDF 배치도" : "이미지"}</span>
          </div>
          <span className="file-ready-badge">등록 완료</span>
        </div>
      ) : null}
    </div>
  );
}
