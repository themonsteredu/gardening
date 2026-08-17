"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import type { Point2D, SchoolProject, SiteImage, SitePlan, SitePlanFeature } from "@/domain/models";
import {
  parseStoredProject,
  parseStoredSiteImage,
  parseStoredSitePlan,
  PROJECT_STORAGE_KEY,
  SITE_IMAGE_META_STORAGE_KEY,
  SITE_PLAN_STORAGE_KEY,
} from "@/lib/project-store";
import { getSiteImageFile } from "@/lib/site-image-store";
import {
  getEditableZoneFeatures,
  getExistingSiteFeatures,
  getFeatureOption,
  isUsablePolygon,
  normalizePointerPoint,
  pointsToSvg,
} from "@/lib/site-plan";
import { useBrowserStorageValue, writeBrowserStorage } from "@/lib/use-browser-storage";

const ZONE_COLOR = "#b7d93d";

export function EditableZoneEditor() {
  const projectValue = useBrowserStorageValue("local", PROJECT_STORAGE_KEY);
  const imageValue = useBrowserStorageValue("local", SITE_IMAGE_META_STORAGE_KEY);
  const planValue = useBrowserStorageValue("local", SITE_PLAN_STORAGE_KEY);
  const project = useMemo(() => parseStoredProject(projectValue), [projectValue]);
  const siteImage = useMemo(() => parseStoredSiteImage(imageValue), [imageValue]);
  const sitePlan = useMemo(() => parseStoredSitePlan(planValue), [planValue]);

  return (
    <EditableZoneWorkspace
      key={project.siteImageId ?? "no-image"}
      project={project}
      siteImage={siteImage}
      sitePlan={sitePlan}
    />
  );
}

function EditableZoneWorkspace({
  project,
  siteImage,
  sitePlan,
}: {
  project: SchoolProject;
  siteImage: SiteImage | null;
  sitePlan: SitePlan | null;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const activeImage = siteImage?.id === project.siteImageId ? siteImage : null;
  const facilities = sitePlan && sitePlan.siteImageId === activeImage?.id
    ? getExistingSiteFeatures(sitePlan.features)
    : [];
  const [zones, setZones] = useState<SitePlanFeature[]>(() =>
    sitePlan?.siteImageId === project.siteImageId
      ? getEditableZoneFeatures(sitePlan.features)
      : [],
  );
  const [draftPoints, setDraftPoints] = useState<Point2D[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sourceVisible, setSourceVisible] = useState(true);
  const [facilitiesVisible, setFacilitiesVisible] = useState(true);
  const [zonesVisible, setZonesVisible] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const selectedZone = zones.find((zone) => zone.id === selectedId) ?? null;

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

  function addPoint(event: React.PointerEvent<HTMLDivElement>) {
    if (!stageRef.current || !zonesVisible || !previewUrl) return;
    if ((event.target as Element).closest("[data-editor-control]")) return;
    const point = normalizePointerPoint(event.clientX, event.clientY, stageRef.current.getBoundingClientRect());
    setDraftPoints((current) => [...current, point]);
    setNotice(null);
  }

  function completeZone() {
    if (!isUsablePolygon(draftPoints)) {
      setNotice("서로 떨어진 점을 3개 이상 찍어 조경 가능 영역을 만들어 주세요.");
      return;
    }
    const zone: SitePlanFeature = {
      id: `editable-zone-${crypto.randomUUID()}`,
      kind: "editable_zone",
      label: `조경 가능 영역 ${zones.length + 1}`,
      points: draftPoints,
      layer: "existing",
    };
    setZones((current) => [...current, zone]);
    setSelectedId(zone.id);
    setDraftPoints([]);
    setNotice(`${zone.label}을 만들었습니다.`);
  }

  function updateSelectedLabel(label: string) {
    if (!selectedId) return;
    setZones((current) => current.map((zone) => zone.id === selectedId ? { ...zone, label } : zone));
  }

  function deleteZone(id: string) {
    setZones((current) => current.filter((zone) => zone.id !== id));
    setSelectedId((current) => current === id ? null : current);
    setNotice("조경 가능 영역을 삭제했습니다.");
  }

  function saveZones() {
    if (!activeImage || !sitePlan || zones.length === 0) {
      setNotice("조경 가능 영역을 하나 이상 만든 뒤 저장해 주세요.");
      return;
    }
    const plan: SitePlan = {
      ...sitePlan,
      siteImageId: activeImage.id,
      features: [...facilities, ...zones],
    };
    writeBrowserStorage("local", SITE_PLAN_STORAGE_KEY, JSON.stringify(plan));
    writeBrowserStorage("local", PROJECT_STORAGE_KEY, JSON.stringify({ ...project, sitePlanId: plan.id }));
    setNotice(`조경 가능 영역 ${zones.length}개를 저장했습니다. 학생 설계 범위로 사용할 준비가 되었습니다.`);
  }

  if (!activeImage || !sitePlan || facilities.length === 0) {
    return (
      <div className="site-plan-page">
        <AppHeader compact current="teacher" />
        <main className="site-plan-empty">
          <p className="eyebrow">STEP 04 · EDITABLE ZONE</p>
          <h1>먼저 기존 시설 도면을 완성해 주세요.</h1>
          <p>조경 가능 영역은 등록된 학교 이미지와 기존 시설 도면 위에 지정합니다.</p>
          <Link className="button button--primary" href={activeImage ? "/teacher/site-plan" : "/teacher/site-image"}>
            {activeImage ? "학교 도면 만들기" : "학교 이미지 등록"}
          </Link>
        </main>
      </div>
    );
  }

  const aspectRatio = activeImage.width > 0 && activeImage.height > 0
    ? `${activeImage.width} / ${activeImage.height}`
    : "4 / 3";

  return (
    <div className="site-plan-page editable-zone-page">
      <AppHeader compact current="teacher" />
      <main className="site-plan-main">
        <header className="site-plan-heading">
          <div>
            <Link className="text-back" href="/teacher/site-plan">← 기존 시설 도면</Link>
            <p className="eyebrow">STEP 04 · EDITABLE ZONE</p>
            <h1>조경 가능 영역 지정</h1>
            <p>학생이 재료를 배치할 수 있는 공간만 경계를 따라 표시합니다.</p>
          </div>
          <div className="plan-save-actions">
            <span>{zones.length}개 영역</span>
            <button className="button button--primary" type="button" onClick={saveZones}>영역 저장</button>
          </div>
        </header>

        <div className="site-plan-workspace editable-zone-workspace">
          <aside className="zone-guide-panel">
            <div className="palette-heading"><span>01</span><div><strong>지정 기준</strong><small>학생이 바꿀 수 있는 곳</small></div></div>
            <div className="zone-symbol"><i /><div><strong>조경 가능 영역</strong><small>연두색 사선으로 표시</small></div></div>
            <ul>
              <li>건물과 기존 시설은 제외합니다.</li>
              <li>학생이 안전하게 이용할 수 있는 공간을 선택합니다.</li>
              <li>여러 공간을 각각 나누어 지정할 수 있습니다.</li>
            </ul>
            <div className="zone-warning"><strong>학생 편집 제한</strong><p>다음 단계에서 재료는 이 경계 안에만 배치할 수 있게 됩니다.</p></div>
          </aside>

          <section className="plan-canvas-panel">
            <div className="canvas-toolbar">
              <div><strong>GUIDE · 조경 가능 영역</strong><span>{draftPoints.length > 0 ? `점 ${draftPoints.length}개 표시 중` : "경계를 따라 점을 찍어주세요"}</span></div>
              <div data-editor-control>
                <button type="button" disabled={draftPoints.length === 0} onClick={() => setDraftPoints((points) => points.slice(0, -1))}>점 되돌리기</button>
                <button type="button" disabled={draftPoints.length === 0} onClick={() => setDraftPoints([])}>취소</button>
                <button className="toolbar-complete" type="button" disabled={draftPoints.length < 3} onClick={completeZone}>영역 완성</button>
              </div>
            </div>

            <div
              ref={stageRef}
              className={`plan-drawing-stage zone-drawing-stage ${draftPoints.length ? "is-drawing" : ""}`}
              style={{ aspectRatio }}
              onPointerDown={addPoint}
              aria-label="조경 가능 영역 편집 화면"
            >
              {!previewUrl && !loadError ? <div className="plan-stage-message">원본 이미지 불러오는 중</div> : null}
              {loadError ? <div className="plan-stage-message">원본 파일을 불러오지 못했습니다.</div> : null}
              {previewUrl && activeImage.mimeType === "application/pdf" ? <object className={sourceVisible ? "" : "is-hidden"} data={previewUrl} type="application/pdf" title="학교 배치도 PDF" /> : null}
              {previewUrl && activeImage.mimeType !== "application/pdf" ? <Image className={sourceVisible ? "" : "is-hidden"} src={previewUrl} alt="조경 가능 영역의 원본 학교 공간" fill sizes="(max-width: 1100px) 100vw, 70vw" unoptimized draggable={false} /> : null}
              <svg className="plan-overlay" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <pattern id="editable-zone-stripes" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="7" height="18" fill={ZONE_COLOR} fillOpacity="0.48" />
                  </pattern>
                </defs>
                {facilitiesVisible ? facilities.map((feature) => {
                  const option = getFeatureOption(feature.kind);
                  return <polygon className="reference-facility" key={feature.id} points={pointsToSvg(feature.points)} fill={option?.color ?? "#596776"} stroke={option?.color ?? "#596776"} />;
                }) : null}
                {zonesVisible ? zones.map((zone) => (
                  <polygon className={`editable-zone-shape ${selectedId === zone.id ? "is-selected" : ""}`} key={zone.id} points={pointsToSvg(zone.points)} fill="url(#editable-zone-stripes)" stroke={ZONE_COLOR} />
                )) : null}
                {draftPoints.length > 0 ? (
                  <g className="draft-shape zone-draft">
                    <polyline points={pointsToSvg(draftPoints)} />
                    {draftPoints.map((point) => <circle key={`${point.x}-${point.y}`} cx={point.x * 1000} cy={point.y * 1000} r="9" />)}
                  </g>
                ) : null}
              </svg>
              <div className="canvas-badges" data-editor-control><span>원본 {sourceVisible ? "ON" : "OFF"}</span><span>시설 {facilitiesVisible ? "ON" : "OFF"}</span><span>가능 영역 {zonesVisible ? "ON" : "OFF"}</span></div>
            </div>
            {notice ? <p className="plan-editor-notice" role="status">{notice}</p> : null}
          </section>

          <aside className="plan-inspector">
            <section className="layer-panel">
              <div className="palette-heading"><span>02</span><div><strong>표시 항목</strong><small>작업 화면 정리</small></div></div>
              <label><span><i className="layer-swatch layer-swatch--image" />원본 이미지</span><input type="checkbox" checked={sourceVisible} onChange={(event) => setSourceVisible(event.target.checked)} /></label>
              <label><span><i className="layer-swatch layer-swatch--plan" />기존 시설</span><input type="checkbox" checked={facilitiesVisible} onChange={(event) => setFacilitiesVisible(event.target.checked)} /></label>
              <label><span><i className="layer-swatch layer-swatch--zone" />가능 영역</span><input type="checkbox" checked={zonesVisible} onChange={(event) => setZonesVisible(event.target.checked)} /></label>
            </section>
            <section className="feature-list-panel">
              <div className="palette-heading"><span>03</span><div><strong>지정된 영역</strong><small>{zones.length}개</small></div></div>
              {zones.length === 0 ? <p className="feature-list-empty">첫 번째 조경 가능 영역의 경계를 표시해 주세요.</p> : (
                <div className="feature-list zone-list">
                  {zones.map((zone) => <button key={zone.id} type="button" className={selectedId === zone.id ? "is-active" : ""} onClick={() => setSelectedId(zone.id)}><i /><span><strong>{zone.label}</strong><small>경계점 {zone.points.length}개</small></span></button>)}
                </div>
              )}
            </section>
            {selectedZone ? (
              <section className="selected-feature-editor">
                <label><span>영역 이름</span><input value={selectedZone.label} maxLength={30} onChange={(event) => updateSelectedLabel(event.target.value)} /></label>
                <button type="button" onClick={() => deleteZone(selectedZone.id)}>이 영역 삭제</button>
              </section>
            ) : null}
          </aside>
        </div>
      </main>
    </div>
  );
}
