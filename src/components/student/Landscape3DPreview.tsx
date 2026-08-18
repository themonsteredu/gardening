"use client";

import { useEffect, useMemo, useState } from "react";
import { LandscapeWebGLScene, type WebGLCameraState } from "@/components/student/LandscapeWebGLScene";
import { LANDSCAPE_CATEGORY_LABELS } from "@/data/landscape-materials";
import type { EstimatedBuildingFootprint, LandscapeMaterialCategory, SchoolProject } from "@/domain/models";
import { detectEstimatedBuildingsFromBlob } from "@/lib/auto-site-background";
import { buildLandscapeScene } from "@/lib/landscape-scene";
import {
  AUTO_SITE_BACKGROUND_META_STORAGE_KEY,
  getStudentLandscapeDesignStorageKey,
  parseStoredAutoSiteBackground,
  parseStoredLandscapeDesign,
  parseStoredSiteImage,
  SITE_IMAGE_META_STORAGE_KEY,
} from "@/lib/project-store";
import { getSiteImageFile } from "@/lib/site-image-store";
import { useBrowserStorageValue } from "@/lib/use-browser-storage";

interface CameraState extends WebGLCameraState { label: string }

const INITIAL_CAMERA: CameraState = { view: "perspective", rotation: -30, zoom: 0.86, label: "입체 보기" };

export function Landscape3DPreview({
  project,
  nickname,
  sessionId,
  onBack,
  onContinue,
}: {
  project: SchoolProject;
  nickname: string;
  sessionId: string;
  onBack: () => void;
  onContinue: () => void;
}) {
  const imageValue = useBrowserStorageValue("local", SITE_IMAGE_META_STORAGE_KEY);
  const backgroundValue = useBrowserStorageValue("local", AUTO_SITE_BACKGROUND_META_STORAGE_KEY);
  const designValue = useBrowserStorageValue("local", getStudentLandscapeDesignStorageKey(sessionId));
  const siteImage = useMemo(() => parseStoredSiteImage(imageValue), [imageValue]);
  const autoBackground = useMemo(() => parseStoredAutoSiteBackground(backgroundValue), [backgroundValue]);
  const design = useMemo(() => parseStoredLandscapeDesign(designValue), [designValue]);
  const sceneObjects = useMemo(() => buildLandscapeScene(design?.objects ?? []), [design]);
  const [camera, setCamera] = useState<CameraState>(INITIAL_CAMERA);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [buildings, setBuildings] = useState<EstimatedBuildingFootprint[]>([]);
  const [loadError, setLoadError] = useState(false);

  const activeImage = siteImage?.id === project.siteImageId ? siteImage : null;
  const activeBackground = autoBackground?.siteImageId === activeImage?.id ? autoBackground : null;
  const categoryCounts = sceneObjects.reduce<Record<LandscapeMaterialCategory, number>>(
    (counts, object) => ({ ...counts, [object.category]: counts[object.category] + 1 }),
    { planting: 0, paving: 0, facility: 0, scenery: 0 },
  );

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
        const storedBuildings = activeBackground?.buildingFootprints ?? [];
        if (storedBuildings.length > 0) {
          setBuildings(storedBuildings);
        } else if (activeImage.mimeType.startsWith("image/")) {
          void detectEstimatedBuildingsFromBlob(blob).then((detected) => {
            if (alive) setBuildings(detected);
          }).catch(() => undefined);
        }
      })
      .catch(() => { if (alive) setLoadError(true); });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activeBackground, activeImage]);

  function setView(next: CameraState) {
    setCamera(next);
  }

  if (!activeImage || !design || sceneObjects.length === 0) {
    return (
      <main className="student-design-empty">
        <p className="eyebrow">360° 예상전경</p>
        <h1>먼저 평면 설계를 저장해 주세요.</h1>
        <p>배치한 재료가 하나 이상 있으면 같은 좌표를 사용해 예상 모형을 만들 수 있습니다.</p>
        <button className="button button--primary" type="button" onClick={onBack}>평면 설계로 돌아가기</button>
      </main>
    );
  }

  return (
    <main className="landscape-3d-page">
      <header className="landscape-3d-heading">
        <div>
          <button type="button" onClick={onBack}>← 배치 수정</button>
          <p className="eyebrow">항공사진 기반 예상 보기</p>
          <h1>우리 학교 360° 예상전경</h1>
          <p>평면에서 정한 위치를 그대로 옮긴 간략 예상 모형입니다.</p>
        </div>
        <div className="scene-project-meta"><span>{nickname} 설계자</span><strong>{project.title}</strong><small>건물 {buildings.length}동 · 재료 {sceneObjects.length}개</small></div>
      </header>

      <div className="landscape-3d-layout">
        <aside className="scene-summary-panel">
          <div className="scene-panel-title"><span>01</span><div><strong>설계 구성</strong><small>평면 설계에서 불러옴</small></div></div>
          <div className="scene-count-total"><strong>{buildings.length}</strong><span>자동 입체화 건물</span></div>
          <dl className="scene-category-counts">
            {(Object.keys(LANDSCAPE_CATEGORY_LABELS) as LandscapeMaterialCategory[]).map((category) => (
              <div key={category}><dt><i className={`scene-dot scene-dot--${category}`} />{LANDSCAPE_CATEGORY_LABELS[category]}</dt><dd>{categoryCounts[category]}</dd></div>
            ))}
          </dl>
          <div className="scene-reading-note"><strong>예상 보기</strong><p>항공사진 한 장만 사용하므로 건물 옆면과 실제 높이는 정확하지 않습니다. 재료의 위치와 공간 구성을 비교해 보세요.</p></div>
        </aside>

        <section className="scene-viewport-panel">
          <div className="scene-toolbar">
            <div><span>VIEW</span><strong>{camera.label}</strong></div>
            <div className="scene-view-buttons">
              <button type="button" className={camera.label === "위에서 보기" ? "is-active" : ""} onClick={() => setView({ view: "top", rotation: 0, zoom: 0.86, label: "위에서 보기" })}>위에서</button>
              <button type="button" className={camera.label === "낮게 보기" ? "is-active" : ""} onClick={() => setView({ view: "low", rotation: 0, zoom: 0.82, label: "낮게 보기" })}>낮게</button>
              <button type="button" className={camera.label === "입체 보기" ? "is-active" : ""} onClick={() => setView(INITIAL_CAMERA)}>입체</button>
            </div>
          </div>

          <div
            className="scene-viewport"
            aria-label="회전 가능한 항공사진 기반 학교 조경 예상 모형"
          >
            <div className="scene-estimate-badge"><strong>건물 자동 입체화</strong><span>{buildings.length > 0 ? `${buildings.length}동 · 높이는 추정값` : "건물 후보 분석 중"}</span></div>
            {!previewUrl && !loadError ? <span className="scene-loading">학교 3D 모형 준비 중</span> : null}
            {loadError ? <span className="scene-loading">원본 이미지를 표시하지 못했습니다.</span> : null}
            {previewUrl && activeImage.mimeType !== "application/pdf" ? (
              <LandscapeWebGLScene
                photoUrl={previewUrl}
                imageWidth={activeImage.width}
                imageHeight={activeImage.height}
                buildings={buildings}
                objects={sceneObjects}
                cameraState={camera}
              />
            ) : null}
            {previewUrl && activeImage.mimeType === "application/pdf" ? <span className="scene-pdf-base">PDF는 건물 입체화를 지원하지 않습니다.</span> : null}
            <div className="scene-compass"><span>N</span><i style={{ transform: `rotate(${camera.rotation}deg)` }} /></div>
            <p className="scene-drag-help">드래그해 360° 돌려보세요.</p>
          </div>
        </section>

        <aside className="scene-control-panel">
          <div className="scene-panel-title"><span>02</span><div><strong>카메라 조작</strong><small>설계는 변경되지 않음</small></div></div>
          <div className="scene-control-group">
            <span>수평 회전 <strong>{Math.round(camera.rotation)}°</strong></span>
            <div><button type="button" aria-label="왼쪽으로 15도 회전" onClick={() => setCamera((current) => ({ ...current, view: "perspective", rotation: current.rotation - 15, label: "직접 회전" }))}>−15°</button><button type="button" aria-label="오른쪽으로 15도 회전" onClick={() => setCamera((current) => ({ ...current, view: "perspective", rotation: current.rotation + 15, label: "직접 회전" }))}>+15°</button></div>
          </div>
          <label className="scene-zoom-control"><span>확대·축소 <strong>{Math.round(camera.zoom * 100)}%</strong></span><input type="range" min="0.6" max="1.35" step="0.05" value={camera.zoom} onChange={(event) => setCamera((current) => ({ ...current, zoom: Number(event.target.value), label: "사용자 시점" }))} /></label>
          <div className="scene-zoom-buttons"><button type="button" aria-label="축소" onClick={() => setCamera((current) => ({ ...current, zoom: Math.max(0.6, current.zoom - 0.1), label: "사용자 시점" }))}>−</button><button type="button" aria-label="확대" onClick={() => setCamera((current) => ({ ...current, zoom: Math.min(1.35, current.zoom + 0.1), label: "사용자 시점" }))}>+</button></div>
          <button className="scene-reset-button" type="button" onClick={() => setView(INITIAL_CAMERA)}>처음 시점으로</button>
          <div className="scene-layer-key"><strong>높이 표현</strong><div><i className="scene-dot scene-dot--facility" /><span>건물 · 추정 2~5층</span></div><div><i className="scene-dot scene-dot--planting" /><span>식재 · 입체 수관</span></div><div><i className="scene-dot scene-dot--paving" /><span>포장 · 바닥면</span></div></div>
          <button className="button button--primary button--wide" type="button" onClick={onBack}>배치 수정</button>
          <button className="button button--quiet button--wide scene-continue-button" type="button" onClick={onContinue}>설계 의도 작성</button>
        </aside>
      </div>
    </main>
  );
}
