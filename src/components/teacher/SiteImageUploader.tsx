"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AutoSiteBackgroundPreview } from "@/components/teacher/AutoSiteBackgroundPreview";
import type { AutoSiteBackground, SiteImage } from "@/domain/models";
import { createAutoSiteBackground } from "@/lib/auto-site-background";
import {
  AUTO_SITE_BACKGROUND_META_STORAGE_KEY,
  parseStoredAutoSiteBackground,
  parseStoredProject,
  parseStoredSiteImage,
  PROJECT_STORAGE_KEY,
  SITE_IMAGE_META_STORAGE_KEY,
} from "@/lib/project-store";
import { resolveSiteImageMimeType, SITE_IMAGE_ACCEPT, validateSiteImageCandidate } from "@/lib/site-image";
import { deleteSiteImageFile, saveSiteImageFile } from "@/lib/site-image-store";
import { removeBrowserStorage, useBrowserStorageValue, writeBrowserStorage } from "@/lib/use-browser-storage";

type ProcessState = "idle" | "processing" | "ready";

export function SiteImageUploader() {
  const [state, setState] = useState<ProcessState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const projectValue = useBrowserStorageValue("local", PROJECT_STORAGE_KEY);
  const imageValue = useBrowserStorageValue("local", SITE_IMAGE_META_STORAGE_KEY);
  const backgroundValue = useBrowserStorageValue("local", AUTO_SITE_BACKGROUND_META_STORAGE_KEY);
  const project = useMemo(() => parseStoredProject(projectValue), [projectValue]);
  const siteImage = useMemo(() => parseStoredSiteImage(imageValue), [imageValue]);
  const background = useMemo(() => parseStoredAutoSiteBackground(backgroundValue), [backgroundValue]);
  const activeImage = siteImage?.id === project.siteImageId ? siteImage : null;
  const activeBackground = background?.siteImageId === activeImage?.id ? background : null;
  const ready = Boolean(activeImage && activeBackground) || state === "ready";

  async function buildBackground(file: Blob, siteImageId: string, mimeType: string, adjustment = 0): Promise<AutoSiteBackground> {
    const id = `site-background-${crypto.randomUUID()}`;
    if (!mimeType.startsWith("image/")) {
      return { id, siteImageId, storageKey: siteImageId, mimeType, width: 0, height: 0, generatedAt: new Date().toISOString(), method: "source-filter-fallback", adjustment, ignoredTopRatio: 0, ignoredBottomRatio: 0 };
    }
    try {
      const result = await createAutoSiteBackground(file, adjustment);
      await saveSiteImageFile(id, result.blob);
      return { id, siteImageId, storageKey: id, mimeType: result.blob.type || "image/webp", width: result.width, height: result.height, generatedAt: new Date().toISOString(), method: "visual-simplification-v1", adjustment, ignoredTopRatio: result.ignoredTopRatio, ignoredBottomRatio: result.ignoredBottomRatio };
    } catch {
      return { id, siteImageId, storageKey: siteImageId, mimeType, width: 0, height: 0, generatedAt: new Date().toISOString(), method: "source-filter-fallback", adjustment, ignoredTopRatio: 0, ignoredBottomRatio: 0 };
    }
  }

  async function processFile(file: File) {
    setError(null);
    const validationError = validateSiteImageCandidate(file);
    if (validationError) { setError(validationError); return; }
    const mimeType = resolveSiteImageMimeType(file);
    if (!mimeType) return;
    setState("processing");
    const id = `site-image-${crypto.randomUUID()}`;
    let width = 0;
    let height = 0;
    try {
      if (mimeType.startsWith("image/")) {
        const bitmap = await createImageBitmap(file);
        width = bitmap.width;
        height = bitmap.height;
        bitmap.close();
      }
      await saveSiteImageFile(id, file);
      const nextBackground = await buildBackground(file, id, mimeType);
      const metadata: SiteImage = { id, schoolProjectId: project.id, name: file.name, url: null, mimeType, width, height, sizeBytes: file.size, storageKey: id, uploadedAt: new Date().toISOString() };
      writeBrowserStorage("local", SITE_IMAGE_META_STORAGE_KEY, JSON.stringify(metadata));
      writeBrowserStorage("local", AUTO_SITE_BACKGROUND_META_STORAGE_KEY, JSON.stringify(nextBackground));
      writeBrowserStorage("local", PROJECT_STORAGE_KEY, JSON.stringify({ ...project, siteImageId: id, status: "ready" }));
      removeBrowserStorage("local", "gardening.site-plan.v1");
      if (activeImage?.storageKey && activeImage.storageKey !== id) await deleteSiteImageFile(activeImage.storageKey).catch(() => undefined);
      if (activeBackground?.storageKey && activeBackground.storageKey !== activeImage?.storageKey && activeBackground.storageKey !== nextBackground.storageKey) await deleteSiteImageFile(activeBackground.storageKey).catch(() => undefined);
      setState("ready");
    } catch {
      setState("idle");
      setError("사진을 준비하지 못했습니다. 다른 이미지로 다시 시도해 주세요.");
    }
  }

  function startClass() {
    writeBrowserStorage("local", PROJECT_STORAGE_KEY, JSON.stringify({ ...project, status: "open" }));
  }

  return (
    <div className="site-upload-page site-auto-page">
      <AppHeader compact current="teacher" />
      <main className="site-auto-main">
        <Link className="text-back" href="/teacher">← 수업 설계실</Link>
        <section className="site-auto-card">
          {!ready && state !== "processing" ? (
            <>
              <header><p className="eyebrow">학교 공간 준비</p><h1>학교 사진 올리기</h1></header>
              <label htmlFor="site-photo-input" className={`site-auto-dropzone ${dragActive ? "is-dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => { event.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={(event) => { event.preventDefault(); setDragActive(false); const file = event.dataTransfer.files[0]; if (file) void processFile(file); }}>
                <span aria-hidden="true">＋</span><strong>학교 사진 선택</strong><small>항공사진 · 지도 캡처 · 배치도</small>
              </label>
            </>
          ) : null}
          {state === "processing" ? <div className="site-auto-processing" role="status"><span aria-hidden="true" /><h1>학교 공간을 준비하고 있어요</h1></div> : null}
          {ready && state !== "processing" && activeBackground && activeImage ? (
            <>
              <header className="site-auto-ready-heading"><p className="eyebrow">준비 완료</p><h1>학교 공간 준비 완료</h1></header>
              <AutoSiteBackgroundPreview image={activeImage} />
              <div className="site-auto-actions">
                <label className="button button--quiet" htmlFor="site-photo-input">사진 바꾸기</label>
                <Link className="button button--primary" href="/teacher" onClick={startClass}>수업 시작</Link>
              </div>
            </>
          ) : null}
          <input id="site-photo-input" className="visually-hidden" type="file" accept={SITE_IMAGE_ACCEPT} aria-label="학교 사진 선택" onChange={(event) => { const file = event.target.files?.[0]; if (file) void processFile(file); event.target.value = ""; }} />
          {error ? <p className="form-error site-auto-error" role="alert">{error}</p> : null}
        </section>
      </main>
    </div>
  );
}
