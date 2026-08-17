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
  getFeatureOption,
  getEditableZoneFeatures,
  getExistingSiteFeatures,
  isUsablePolygon,
  normalizePointerPoint,
  pointsToSvg,
  SITE_FEATURE_OPTIONS,
} from "@/lib/site-plan";
import { useBrowserStorageValue, writeBrowserStorage } from "@/lib/use-browser-storage";

export function SitePlanEditor() {
  const projectValue = useBrowserStorageValue("local", PROJECT_STORAGE_KEY);
  const imageValue = useBrowserStorageValue("local", SITE_IMAGE_META_STORAGE_KEY);
  const planValue = useBrowserStorageValue("local", SITE_PLAN_STORAGE_KEY);
  const project = useMemo(() => parseStoredProject(projectValue), [projectValue]);
  const siteImage = useMemo(() => parseStoredSiteImage(imageValue), [imageValue]);
  const storedPlan = useMemo(() => parseStoredSitePlan(planValue), [planValue]);

  return (
    <SitePlanWorkspace
      key={project.siteImageId ?? "no-image"}
      project={project}
      siteImage={siteImage}
      storedPlan={storedPlan}
    />
  );
}

function SitePlanWorkspace({
  project,
  siteImage,
  storedPlan,
}: {
  project: SchoolProject;
  siteImage: SiteImage | null;
  storedPlan: SitePlan | null;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [features, setFeatures] = useState<SitePlanFeature[]>(
    storedPlan?.siteImageId === project.siteImageId
      ? getExistingSiteFeatures(storedPlan.features)
      : [],
  );
  const [activeKind, setActiveKind] = useState(SITE_FEATURE_OPTIONS[0].kind);
  const [draftPoints, setDraftPoints] = useState<Point2D[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sourceVisible, setSourceVisible] = useState(true);
  const [facilitiesVisible, setFacilitiesVisible] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const activeImage = siteImage?.id === project.siteImageId ? siteImage : null;
  const selectedFeature = features.find((feature) => feature.id === selectedId) ?? null;

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
    if (!stageRef.current || !facilitiesVisible || !previewUrl) return;
    if ((event.target as Element).closest("[data-editor-control]")) return;
    const point = normalizePointerPoint(event.clientX, event.clientY, stageRef.current.getBoundingClientRect());
    setDraftPoints((current) => [...current, point]);
    setNotice(null);
  }

  function completeArea() {
    if (!isUsablePolygon(draftPoints)) {
      setNotice("서로 떨어진 점을 3개 이상 찍어 영역을 만들어 주세요.");
      return;
    }
    const option = getFeatureOption(activeKind)!;
    const count = features.filter((feature) => feature.kind === activeKind).length + 1;
    const next: SitePlanFeature = {
      id: `feature-${crypto.randomUUID()}`,
      kind: activeKind,
      label: `${option.label} ${count}`,
      points: draftPoints,
      layer: "existing",
    };
    setFeatures((current) => [...current, next]);
    setSelectedId(next.id);
    setDraftPoints([]);
    setNotice(`${next.label} 영역을 만들었습니다.`);
  }

  function updateSelectedLabel(label: string) {
    if (!selectedId) return;
    setFeatures((current) => current.map((feature) => feature.id === selectedId ? { ...feature, label } : feature));
  }

  function deleteFeature(id: string) {
    setFeatures((current) => current.filter((feature) => feature.id !== id));
    setSelectedId((current) => current === id ? null : current);
    setNotice("영역을 삭제했습니다.");
  }

  function savePlan() {
    if (!activeImage || features.length === 0) {
      setNotice("기존 시설 영역을 하나 이상 만든 뒤 저장해 주세요.");
      return;
    }
    const existingId = storedPlan?.siteImageId === activeImage.id ? storedPlan.id : null;
    const plan: SitePlan = {
      id: existingId ?? `site-plan-${crypto.randomUUID()}`,
      siteImageId: activeImage.id,
      features: [
        ...features,
        ...(storedPlan?.siteImageId === activeImage.id
          ? getEditableZoneFeatures(storedPlan.features)
          : []),
      ],
      scaleReference: storedPlan?.siteImageId === activeImage.id ? storedPlan.scaleReference : null,
    };
    writeBrowserStorage("local", SITE_PLAN_STORAGE_KEY, JSON.stringify(plan));
    writeBrowserStorage("local", PROJECT_STORAGE_KEY, JSON.stringify({ ...project, sitePlanId: plan.id }));
    setNotice(`도면을 저장했습니다. 기존 시설 ${features.length}개가 연결되었습니다.`);
  }

  if (!activeImage) {
    return (
      <div className="site-plan-page">
        <AppHeader compact current="teacher" />
        <main className="site-plan-empty">
          <p className="eyebrow">STEP 03 · EXISTING SITE</p>
          <h1>먼저 학교 이미지를 등록해 주세요.</h1>
          <p>기존 시설 도면은 STEP 2에서 등록한 원본 이미지 위에 만들어집니다.</p>
          <Link className="button button--primary" href="/teacher/site-image">학교 이미지 등록</Link>
        </main>
      </div>
    );
  }

  const aspectRatio = activeImage.width > 0 && activeImage.height > 0
    ? `${activeImage.width} / ${activeImage.height}`
    : "4 / 3";

  return (
    <div className="site-plan-page">
      <AppHeader compact current="teacher" />
      <main className="site-plan-main">
        <header className="site-plan-heading">
          <div>
            <Link className="text-back" href="/teacher">← 수업 설계실</Link>
            <p className="eyebrow">STEP 03 · EXISTING SITE</p>
            <h1>학교 도면 만들기</h1>
            <p>원본 이미지 위에서 기존 시설의 경계를 점으로 표시합니다.</p>
          </div>
          <div className="plan-save-actions">
            <span>{features.length}개 시설</span>
            {storedPlan?.features.some((feature) => feature.kind !== "editable_zone") ? (
              <Link className="button button--quiet" href="/teacher/editable-zone">다음: 가능 영역</Link>
            ) : null}
            <button className="button button--primary" type="button" onClick={savePlan}>도면 저장</button>
          </div>
        </header>

        <div className="site-plan-workspace">
          <aside className="feature-palette" aria-label="시설 종류">
            <div className="palette-heading"><span>01</span><div><strong>시설 종류</strong><small>한 종류를 선택하세요</small></div></div>
            <div className="feature-options">
              {SITE_FEATURE_OPTIONS.map((option) => (
                <button
                  key={option.kind}
                  type="button"
                  className={activeKind === option.kind ? "is-active" : ""}
                  onClick={() => { setActiveKind(option.kind); setDraftPoints([]); setNotice(null); }}
                >
                  <i style={{ background: option.color }} />{option.label}
                </button>
              ))}
            </div>
            <div className="draw-guide">
              <strong>영역 그리는 법</strong>
              <ol><li>시설 종류를 선택합니다.</li><li>경계를 따라 점을 3개 이상 찍습니다.</li><li>‘영역 완성’을 누릅니다.</li></ol>
            </div>
          </aside>

          <section className="plan-canvas-panel">
            <div className="canvas-toolbar">
              <div><strong>LAYER 2 · 기존 시설</strong><span>{draftPoints.length > 0 ? `점 ${draftPoints.length}개 표시 중` : "이미지 위를 눌러 시작"}</span></div>
              <div data-editor-control>
                <button type="button" disabled={draftPoints.length === 0} onClick={() => setDraftPoints((points) => points.slice(0, -1))}>점 되돌리기</button>
                <button type="button" disabled={draftPoints.length === 0} onClick={() => setDraftPoints([])}>취소</button>
                <button className="toolbar-complete" type="button" disabled={draftPoints.length < 3} onClick={completeArea}>영역 완성</button>
              </div>
            </div>

            <div
              ref={stageRef}
              className={`plan-drawing-stage ${draftPoints.length ? "is-drawing" : ""}`}
              style={{ aspectRatio }}
              onPointerDown={addPoint}
              aria-label="학교 이미지 위 도면 편집 영역"
            >
              {!previewUrl && !loadError ? <div className="plan-stage-message">원본 이미지 불러오는 중</div> : null}
              {loadError ? <div className="plan-stage-message">원본 파일을 불러오지 못했습니다. STEP 2에서 다시 등록해 주세요.</div> : null}
              {previewUrl && activeImage.mimeType === "application/pdf" ? (
                <object className={sourceVisible ? "" : "is-hidden"} data={previewUrl} type="application/pdf" title="학교 배치도 PDF" />
              ) : null}
              {previewUrl && activeImage.mimeType !== "application/pdf" ? (
                <Image className={sourceVisible ? "" : "is-hidden"} src={previewUrl} alt="도면의 원본 학교 공간" fill sizes="(max-width: 1100px) 100vw, 70vw" unoptimized draggable={false} />
              ) : null}
              <svg className={facilitiesVisible ? "plan-overlay" : "plan-overlay is-hidden"} viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
                {features.map((feature) => {
                  const option = getFeatureOption(feature.kind);
                  return (
                    <g key={feature.id} className={selectedId === feature.id ? "is-selected" : ""}>
                      <polygon points={pointsToSvg(feature.points)} fill={option?.color ?? "#596776"} stroke={option?.color ?? "#596776"} />
                    </g>
                  );
                })}
                {draftPoints.length > 0 ? (
                  <g className="draft-shape">
                    <polyline points={pointsToSvg(draftPoints)} />
                    {draftPoints.map((point, index) => <circle key={`${point.x}-${point.y}`} cx={point.x * 1000} cy={point.y * 1000} r="9" data-index={index + 1} />)}
                  </g>
                ) : null}
              </svg>
              <div className="canvas-badges" data-editor-control><span>L1 {sourceVisible ? "ON" : "OFF"}</span><span>L2 {facilitiesVisible ? "ON" : "OFF"}</span></div>
            </div>
            {activeImage.mimeType === "application/pdf" ? <p className="pdf-draw-note">PDF는 현재 보이는 첫 페이지를 기준으로 표시하세요. 더 정확한 작업은 PNG 또는 JPG를 권장합니다.</p> : null}
            {notice ? <p className="plan-editor-notice" role="status">{notice}</p> : null}
          </section>

          <aside className="plan-inspector">
            <section className="layer-panel">
              <div className="palette-heading"><span>02</span><div><strong>레이어</strong><small>화면 표시 전환</small></div></div>
              <label><span><i className="layer-swatch layer-swatch--image" />원본 이미지</span><input type="checkbox" checked={sourceVisible} onChange={(event) => setSourceVisible(event.target.checked)} /></label>
              <label><span><i className="layer-swatch layer-swatch--plan" />기존 시설</span><input type="checkbox" checked={facilitiesVisible} onChange={(event) => setFacilitiesVisible(event.target.checked)} /></label>
            </section>
            <section className="feature-list-panel">
              <div className="palette-heading"><span>03</span><div><strong>등록된 영역</strong><small>{features.length}개</small></div></div>
              {features.length === 0 ? <p className="feature-list-empty">아직 표시한 시설이 없습니다.</p> : (
                <div className="feature-list">
                  {features.map((feature) => {
                    const option = getFeatureOption(feature.kind);
                    return <button key={feature.id} type="button" className={selectedId === feature.id ? "is-active" : ""} onClick={() => setSelectedId(feature.id)}><i style={{ background: option?.color }} /><span><strong>{feature.label}</strong><small>{option?.label} · 점 {feature.points.length}개</small></span></button>;
                  })}
                </div>
              )}
            </section>
            {selectedFeature ? (
              <section className="selected-feature-editor">
                <label><span>영역 이름</span><input value={selectedFeature.label} maxLength={30} onChange={(event) => updateSelectedLabel(event.target.value)} /></label>
                <button type="button" onClick={() => deleteFeature(selectedFeature.id)}>이 영역 삭제</button>
              </section>
            ) : null}
          </aside>
        </div>
      </main>
    </div>
  );
}
