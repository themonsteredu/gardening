"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { StoredSiteImagePreview } from "@/components/teacher/StoredSiteImagePreview";
import type { SiteImage } from "@/domain/models";
import {
  parseStoredProject,
  parseStoredSiteImage,
  PROJECT_STORAGE_KEY,
  SITE_IMAGE_META_STORAGE_KEY,
} from "@/lib/project-store";
import {
  formatFileSize,
  resolveSiteImageMimeType,
  SITE_IMAGE_ACCEPT,
  validateSiteImageCandidate,
} from "@/lib/site-image";
import {
  deleteSiteImageFile,
  saveSiteImageFile,
} from "@/lib/site-image-store";
import {
  useBrowserStorageValue,
  writeBrowserStorage,
} from "@/lib/use-browser-storage";

interface SelectedSiteFile {
  file: File;
  mimeType: string;
  previewUrl: string;
  width: number;
  height: number;
}

type SaveState = "idle" | "saving" | "saved";

export function SiteImageUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const candidateUrlRef = useRef<string | null>(null);
  const [candidate, setCandidate] = useState<SelectedSiteFile | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const storedProjectValue = useBrowserStorageValue("local", PROJECT_STORAGE_KEY);
  const storedSiteImageValue = useBrowserStorageValue("local", SITE_IMAGE_META_STORAGE_KEY);
  const project = useMemo(() => parseStoredProject(storedProjectValue), [storedProjectValue]);
  const savedSiteImage = useMemo(
    () => parseStoredSiteImage(storedSiteImageValue),
    [storedSiteImageValue],
  );
  const activeSavedImage = savedSiteImage?.id === project.siteImageId ? savedSiteImage : null;

  useEffect(() => {
    return () => {
      if (candidateUrlRef.current) URL.revokeObjectURL(candidateUrlRef.current);
    };
  }, []);

  async function selectFile(file: File) {
    setError(null);
    setSaveState("idle");
    const validationError = validateSiteImageCandidate(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    const mimeType = resolveSiteImageMimeType(file);
    if (!mimeType) return;
    let width = 0;
    let height = 0;
    if (mimeType.startsWith("image/")) {
      try {
        const bitmap = await createImageBitmap(file);
        width = bitmap.width;
        height = bitmap.height;
        bitmap.close();
      } catch {
        // Some managed school browsers cannot decode dimensions up front.
        // The image can still be previewed and used as the base layer.
      }
    }

    if (candidateUrlRef.current) URL.revokeObjectURL(candidateUrlRef.current);
    const previewUrl = URL.createObjectURL(file);
    candidateUrlRef.current = previewUrl;
    setCandidate({ file, mimeType, previewUrl, width, height });
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  async function saveSelectedFile() {
    if (!candidate || saveState === "saving") return;
    setSaveState("saving");
    setError(null);

    const id = `site-image-${crypto.randomUUID()}`;
    const metadata: SiteImage = {
      id,
      schoolProjectId: project.id,
      name: candidate.file.name,
      url: null,
      mimeType: candidate.mimeType,
      width: candidate.width,
      height: candidate.height,
      sizeBytes: candidate.file.size,
      storageKey: id,
      uploadedAt: new Date().toISOString(),
    };

    try {
      await saveSiteImageFile(id, candidate.file);
      writeBrowserStorage("local", SITE_IMAGE_META_STORAGE_KEY, JSON.stringify(metadata));
      writeBrowserStorage(
        "local",
        PROJECT_STORAGE_KEY,
        JSON.stringify({ ...project, siteImageId: id }),
      );
      if (activeSavedImage && activeSavedImage.storageKey !== id) {
        await deleteSiteImageFile(activeSavedImage.storageKey).catch(() => undefined);
      }
      if (candidateUrlRef.current) URL.revokeObjectURL(candidateUrlRef.current);
      candidateUrlRef.current = null;
      setCandidate(null);
      setSaveState("saved");
    } catch {
      setSaveState("idle");
      setError("파일을 브라우저에 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.");
    }
  }

  return (
    <div className="site-upload-page">
      <AppHeader compact current="teacher" />
      <main className="site-upload-main">
        <header className="site-upload-heading">
          <div>
            <Link className="text-back" href="/teacher">← 수업 설계실</Link>
            <p className="eyebrow">학교 사진</p>
            <h1>학교 사진 넣기</h1>
            <p>항공사진이나 학교 배치 이미지를 그대로 사용합니다.</p>
          </div>
        </header>

        <div className="site-upload-layout">
          <aside className="upload-guide-panel">
            <section>
              <span className="guide-index">01</span>
              <h2>공간이 잘 보이는 자료</h2>
              <p>건물, 운동장, 기존 수목과 빈 공간이 한 화면에서 구분되는 자료가 좋습니다.</p>
            </section>
            <section>
              <span className="guide-index">02</span>
              <h2>지원하는 파일</h2>
              <ul>
                <li>학교 항공사진 또는 위성사진 캡처</li>
                <li>학교 배치도·교내 안내도</li>
                <li>JPG, PNG, WebP, PDF</li>
                <li>파일당 최대 20MB</li>
              </ul>
            </section>
            <div className="privacy-note">
              <strong>등록 전 확인</strong>
              <p>학생 얼굴, 차량 번호 등 개인을 식별할 수 있는 정보가 선명하게 보이지 않는 자료를 사용하세요.</p>
            </div>
          </aside>

          <section className="upload-workspace" aria-labelledby="upload-workspace-title">
            <div className="upload-workspace__heading">
              <div><span>PROJECT</span><strong>{project.schoolName} · {project.className}</strong></div>
              <p id="upload-workspace-title">학생 화면에 보일 학교 사진</p>
            </div>

            {!candidate && !activeSavedImage ? (
              <button
                type="button"
                className={`file-dropzone ${dragActive ? "is-dragging" : ""}`}
                onClick={openFilePicker}
                onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
                onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  const file = event.dataTransfer.files[0];
                  if (file) void selectFile(file);
                }}
              >
                <span className="upload-mark" aria-hidden="true"><i /><i /></span>
                <strong>학교 이미지 또는 PDF를 놓아주세요.</strong>
                <p>파일을 여기로 드래그하거나 눌러서 선택하세요.</p>
                <span className="dropzone-formats">JPG · PNG · WEBP · PDF / 최대 20MB</span>
              </button>
            ) : null}

            {candidate ? (
              <div className="candidate-preview">
                <div className="candidate-preview__media">
                  {candidate.mimeType === "application/pdf" ? (
                    <object data={candidate.previewUrl} type="application/pdf" title={`${candidate.file.name} PDF 미리보기`}>
                      <div className="pdf-fallback"><span>PDF</span><strong>{candidate.file.name}</strong></div>
                    </object>
                  ) : (
                    <Image src={candidate.previewUrl} alt="선택한 학교 공간 이미지 미리보기" fill sizes="(max-width: 900px) 100vw, 70vw" unoptimized />
                  )}
                  <span className="source-layer-badge">학교 사진</span>
                </div>
                <div className="candidate-preview__info">
                  <div><span>{candidate.mimeType === "application/pdf" ? "PDF" : "IMAGE"}</span><strong>{candidate.file.name}</strong></div>
                  <p>{formatFileSize(candidate.file.size)}{candidate.width > 0 ? ` · ${candidate.width} × ${candidate.height}px` : ""}</p>
                </div>
              </div>
            ) : null}

            {!candidate && activeSavedImage ? (
              <StoredSiteImagePreview siteImage={activeSavedImage} />
            ) : null}

            <input
              ref={inputRef}
              className="visually-hidden"
              type="file"
              accept={SITE_IMAGE_ACCEPT}
              aria-label="학교 이미지 파일 선택"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void selectFile(file);
                event.target.value = "";
              }}
            />

            {error ? <p className="form-error upload-error" role="alert">{error}</p> : null}
            {saveState === "saved" ? (
              <div className="upload-success" role="status"><span>✓</span><div><strong>학교 사진이 등록되었습니다.</strong><p>이제 조경할 공간만 표시하면 됩니다.</p></div></div>
            ) : null}

            <div className="upload-actions">
              {(candidate || activeSavedImage) ? (
                <button className="button button--quiet" type="button" onClick={openFilePicker}>
                  {activeSavedImage && !candidate ? "파일 교체" : "다른 파일 선택"}
                </button>
              ) : <span />}
              <div>
                <Link className="button button--quiet" href="/teacher">나중에 하기</Link>
                {candidate ? (
                  <button className="button button--primary" type="button" onClick={saveSelectedFile} disabled={saveState === "saving"}>
                    {saveState === "saving" ? "저장하는 중" : "이 이미지 등록"}
                  </button>
                ) : (
                  <Link className="button button--primary" href="/teacher/editable-zone">조경영역 표시</Link>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
