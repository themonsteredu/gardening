"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { LANDSCAPE_CATEGORY_LABELS } from "@/data/landscape-materials";
import type { LandscapeMaterialCategory, SchoolProject } from "@/domain/models";
import { buildLandscapeScene } from "@/lib/landscape-scene";
import {
  getStudentLandscapeDesignStorageKey,
  parseStoredLandscapeDesign,
  parseStoredSiteImage,
  parseStoredSitePlan,
  SITE_IMAGE_META_STORAGE_KEY,
  SITE_PLAN_STORAGE_KEY,
} from "@/lib/project-store";
import { getSiteImageFile } from "@/lib/site-image-store";
import { getEditableZoneFeatures, getExistingSiteFeatures, getFeatureOption, pointsToSvg } from "@/lib/site-plan";
import { useBrowserStorageValue } from "@/lib/use-browser-storage";

interface CameraState {
  tilt: number;
  rotation: number;
  zoom: number;
  label: string;
}

const INITIAL_CAMERA: CameraState = { tilt: 55, rotation: -30, zoom: 0.86, label: "입체 보기" };

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
  const planValue = useBrowserStorageValue("local", SITE_PLAN_STORAGE_KEY);
  const designValue = useBrowserStorageValue("local", getStudentLandscapeDesignStorageKey(sessionId));
  const siteImage = useMemo(() => parseStoredSiteImage(imageValue), [imageValue]);
  const sitePlan = useMemo(() => parseStoredSitePlan(planValue), [planValue]);
  const design = useMemo(() => parseStoredLandscapeDesign(designValue), [designValue]);
  const sceneObjects = useMemo(() => buildLandscapeScene(design?.objects ?? []), [design]);
  const [camera, setCamera] = useState<CameraState>(INITIAL_CAMERA);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; tilt: number; rotation: number } | null>(null);

  const activeImage = siteImage?.id === project.siteImageId ? siteImage : null;
  const activePlan = sitePlan?.id === project.sitePlanId ? sitePlan : null;
  const facilities = activePlan ? getExistingSiteFeatures(activePlan.features) : [];
  const zones = activePlan ? getEditableZoneFeatures(activePlan.features) : [];
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
      })
      .catch(() => { if (alive) setLoadError(true); });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activeImage]);

  function setView(next: CameraState) {
    setCamera(next);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    setCamera((current) => ({
      ...current,
      rotation: drag.rotation + dx * 0.35,
      tilt: Math.max(0, Math.min(72, drag.tilt - dy * 0.25)),
      label: "직접 회전",
    }));
  }

  if (!activeImage || !activePlan || !design || sceneObjects.length === 0) {
    return (
      <main className="student-design-empty">
        <p className="eyebrow">3D SITE REVIEW</p>
        <h1>먼저 평면 설계를 저장해 주세요.</h1>
        <p>배치한 재료가 하나 이상 있으면 같은 좌표를 사용해 3D 공간을 만들 수 있습니다.</p>
        <button className="button button--primary" type="button" onClick={onBack}>평면 설계로 돌아가기</button>
      </main>
    );
  }

  const aspectRatio = activeImage.width > 0 && activeImage.height > 0
    ? `${activeImage.width} / ${activeImage.height}`
    : "4 / 3";

  return (
    <main className="landscape-3d-page">
      <header className="landscape-3d-heading">
        <div>
          <button type="button" onClick={onBack}>← 배치 수정</button>
          <p className="eyebrow">STEP 07 · 3D SITE REVIEW</p>
          <h1>나의 조경 설계 3D 확인</h1>
          <p>평면에서 정한 위치와 방향을 그대로 입체 공간에서 확인합니다.</p>
        </div>
        <div className="scene-project-meta"><span>{nickname} 설계자</span><strong>{project.title}</strong><small>저장된 재료 {sceneObjects.length}개</small></div>
      </header>

      <div className="landscape-3d-layout">
        <aside className="scene-summary-panel">
          <div className="scene-panel-title"><span>01</span><div><strong>설계 구성</strong><small>평면 설계에서 불러옴</small></div></div>
          <div className="scene-count-total"><strong>{sceneObjects.length}</strong><span>배치 재료</span></div>
          <dl className="scene-category-counts">
            {(Object.keys(LANDSCAPE_CATEGORY_LABELS) as LandscapeMaterialCategory[]).map((category) => (
              <div key={category}><dt><i className={`scene-dot scene-dot--${category}`} />{LANDSCAPE_CATEGORY_LABELS[category]}</dt><dd>{categoryCounts[category]}</dd></div>
            ))}
          </dl>
          <div className="scene-reading-note"><strong>3D 확인의 목적</strong><p>높이와 시선을 바꾸며 동선, 그늘, 시설물의 겹침을 확인하세요. 배치를 바꾸려면 평면 설계로 돌아갑니다.</p></div>
        </aside>

        <section className="scene-viewport-panel">
          <div className="scene-toolbar">
            <div><span>VIEW</span><strong>{camera.label}</strong></div>
            <div className="scene-view-buttons">
              <button type="button" className={camera.label === "위에서 보기" ? "is-active" : ""} onClick={() => setView({ tilt: 0, rotation: 0, zoom: 0.86, label: "위에서 보기" })}>위에서</button>
              <button type="button" className={camera.label === "정면 보기" ? "is-active" : ""} onClick={() => setView({ tilt: 70, rotation: 0, zoom: 0.82, label: "정면 보기" })}>정면</button>
              <button type="button" className={camera.label === "입체 보기" ? "is-active" : ""} onClick={() => setView(INITIAL_CAMERA)}>입체</button>
            </div>
          </div>

          <div
            className="scene-viewport"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, tilt: camera.tilt, rotation: camera.rotation };
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerCancel={() => { dragRef.current = null; }}
            aria-label="회전 가능한 학교 조경 3D 미리보기"
          >
            <div className="scene-sky" />
            <div className="scene-ground-shadow" />
            <div
              className="scene-world"
              style={{
                aspectRatio,
                transform: `translate(-50%, -50%) rotateX(${camera.tilt}deg) rotateZ(${camera.rotation}deg) scale(${camera.zoom})`,
              }}
            >
              <div className="scene-plan-base">
                {!previewUrl && !loadError ? <span className="scene-loading">학교 공간 불러오는 중</span> : null}
                {loadError ? <span className="scene-loading">원본 이미지를 표시하지 못했습니다.</span> : null}
                {previewUrl && activeImage.mimeType !== "application/pdf" ? <Image src={previewUrl} alt="3D 미리보기의 학교 공간 바닥" fill sizes="70vw" unoptimized draggable={false} /> : null}
                {previewUrl && activeImage.mimeType === "application/pdf" ? <span className="scene-pdf-base">PDF 학교 배치도</span> : null}
                <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
                  {facilities.map((feature) => {
                    const option = getFeatureOption(feature.kind);
                    return <polygon key={feature.id} className="scene-existing-zone" points={pointsToSvg(feature.points)} fill={option?.color ?? "#68746c"} stroke={option?.color ?? "#68746c"} />;
                  })}
                  {zones.map((zone) => <polygon key={zone.id} className="scene-editable-zone" points={pointsToSvg(zone.points)} />)}
                </svg>
              </div>
              {sceneObjects.map((object) => {
                const style = {
                  left: `${object.xPercent}%`,
                  top: `${object.yPercent}%`,
                  width: `${object.sizePixels}px`,
                  height: `${object.sizePixels}px`,
                  zIndex: object.zIndex + 2,
                  transform: `translate(-50%, -50%) rotateZ(${object.rotationDegrees}deg) translateZ(${object.heightPixels}px)`,
                  "--scene-color": object.color,
                  "--scene-height": `${object.heightPixels}px`,
                } as CSSProperties;
                return (
                  <div
                    key={object.id}
                    className={`scene-object scene-object--${object.category} scene-shape--${object.shape}`}
                    style={style}
                    title={object.label}
                  >
                    <span className="scene-model"><i /></span>
                    <small>{object.label}</small>
                  </div>
                );
              })}
            </div>
            <div className="scene-compass"><span>N</span><i style={{ transform: `rotate(${camera.rotation}deg)` }} /></div>
            <p className="scene-drag-help">화면을 드래그해 360° 돌려보세요.</p>
          </div>
        </section>

        <aside className="scene-control-panel">
          <div className="scene-panel-title"><span>02</span><div><strong>카메라 조작</strong><small>설계는 변경되지 않음</small></div></div>
          <div className="scene-control-group">
            <span>수평 회전 <strong>{Math.round(camera.rotation)}°</strong></span>
            <div><button type="button" aria-label="왼쪽으로 15도 회전" onClick={() => setCamera((current) => ({ ...current, rotation: current.rotation - 15, label: "직접 회전" }))}>−15°</button><button type="button" aria-label="오른쪽으로 15도 회전" onClick={() => setCamera((current) => ({ ...current, rotation: current.rotation + 15, label: "직접 회전" }))}>+15°</button></div>
          </div>
          <label className="scene-zoom-control"><span>확대·축소 <strong>{Math.round(camera.zoom * 100)}%</strong></span><input type="range" min="0.6" max="1.35" step="0.05" value={camera.zoom} onChange={(event) => setCamera((current) => ({ ...current, zoom: Number(event.target.value), label: "사용자 시점" }))} /></label>
          <div className="scene-zoom-buttons"><button type="button" aria-label="축소" onClick={() => setCamera((current) => ({ ...current, zoom: Math.max(0.6, current.zoom - 0.1), label: "사용자 시점" }))}>−</button><button type="button" aria-label="확대" onClick={() => setCamera((current) => ({ ...current, zoom: Math.min(1.35, current.zoom + 0.1), label: "사용자 시점" }))}>+</button></div>
          <button className="scene-reset-button" type="button" onClick={() => setView(INITIAL_CAMERA)}>처음 시점으로</button>
          <div className="scene-layer-key"><strong>높이 표현</strong><div><i className="scene-dot scene-dot--planting" /><span>식재 · 수관 높이 강조</span></div><div><i className="scene-dot scene-dot--facility" /><span>시설물 · 중간 높이</span></div><div><i className="scene-dot scene-dot--paving" /><span>포장 · 바닥면</span></div></div>
          <button className="button button--primary button--wide" type="button" onClick={onBack}>배치 수정</button>
          <button className="button button--quiet button--wide scene-continue-button" type="button" onClick={onContinue}>설계 의도 작성</button>
        </aside>
      </div>
    </main>
  );
}
