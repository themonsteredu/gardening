"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { SchoolProject } from "@/domain/models";
import { parseStoredSiteImage, SITE_IMAGE_META_STORAGE_KEY } from "@/lib/project-store";
import { getSiteImageFile } from "@/lib/site-image-store";
import { useBrowserStorageValue } from "@/lib/use-browser-storage";

export function SchoolPhotoStart({
  project,
  nickname,
  onStart,
}: {
  project: SchoolProject;
  nickname: string;
  onStart: () => void;
}) {
  const imageValue = useBrowserStorageValue("local", SITE_IMAGE_META_STORAGE_KEY);
  const siteImage = useMemo(() => parseStoredSiteImage(imageValue), [imageValue]);
  const activeImage = siteImage?.id === project.siteImageId ? siteImage : null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!activeImage) return;
    let alive = true;
    let objectUrl: string | null = null;
    getSiteImageFile(activeImage.storageKey)
      .then((blob) => {
        if (!alive || !blob) {
          if (alive) setLoadError(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => { if (alive) setLoadError(true); });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activeImage]);

  const aspectRatio = activeImage?.width && activeImage.height
    ? `${activeImage.width} / ${activeImage.height}`
    : "16 / 10";

  return (
    <main className="school-photo-start">
      <header className="school-photo-start__heading">
        <div>
          <span>{nickname}</span>
          <h1>우리 학교를 새롭게 꾸며보세요</h1>
        </div>
        <button type="button" aria-label="조경전문가 도움말" aria-expanded={showHelp} onClick={() => setShowHelp((current) => !current)}>?</button>
        {showHelp ? <div className="school-photo-help" role="status"><strong>조경전문가</strong><p>자연과 사람이 함께 쓰는 공간을 꾸미는 사람이에요.</p></div> : null}
      </header>

      <section className="school-photo-start__stage" style={{ aspectRatio }} aria-label={`${project.schoolName} 조경 시작 화면`}>
        {!activeImage ? <div className="school-photo-empty"><strong>학교 사진 준비 중</strong><span>선생님이 사진을 넣으면 여기에 보여요.</span></div> : null}
        {activeImage && !previewUrl && !loadError ? <div className="school-photo-empty"><strong>사진 불러오는 중</strong></div> : null}
        {loadError ? <div className="school-photo-empty"><strong>사진을 다시 넣어주세요</strong><span>선생님 화면에서 학교 사진을 확인해 주세요.</span></div> : null}
        {previewUrl && activeImage?.mimeType === "application/pdf" ? <object data={previewUrl} type="application/pdf" title={`${project.schoolName} 학교 배치도`} /> : null}
        {previewUrl && activeImage?.mimeType !== "application/pdf" ? <Image src={previewUrl} alt={`${project.schoolName} 학교 공간`} fill sizes="100vw" unoptimized preload draggable={false} /> : null}
        {previewUrl ? <div className="school-photo-start__mission"><small>오늘의 의뢰</small><strong>{project.mission}</strong></div> : null}
        <button className="school-photo-start__button" type="button" disabled={!previewUrl} onClick={onStart}>꾸미기</button>
      </section>
    </main>
  );
}
