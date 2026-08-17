"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  findLandscapeMaterial,
  LANDSCAPE_CATEGORY_LABELS,
  LANDSCAPE_MATERIALS,
  type PlanLandscapeMaterial,
} from "@/data/landscape-materials";
import type {
  LandscapeMaterialCategory,
  LandscapeObject,
  Point2D,
  SchoolProject,
  SiteImage,
  SitePlan,
  StudentLandscapeDesign,
} from "@/domain/models";
import {
  createLandscapeObject,
  getMaterialFootprintRadius,
  isFootprintInsideEditableZones,
} from "@/lib/landscape-design";
import {
  getEditableZoneFeatures,
  getExistingSiteFeatures,
  getFeatureOption,
  normalizePointerPoint,
  pointsToSvg,
} from "@/lib/site-plan";
import {
  parseStoredSiteImage,
  parseStoredSitePlan,
  parseStoredLandscapeDesign,
  getStudentLandscapeDesignStorageKey,
  SITE_IMAGE_META_STORAGE_KEY,
  SITE_PLAN_STORAGE_KEY,
} from "@/lib/project-store";
import { getSiteImageFile } from "@/lib/site-image-store";
import { useBrowserStorageValue, writeBrowserStorage } from "@/lib/use-browser-storage";

const MATERIAL_CATEGORIES = Object.keys(LANDSCAPE_CATEGORY_LABELS) as LandscapeMaterialCategory[];

export function LandscapeDesignStudio({
  project,
  nickname,
  sessionId,
  onBack,
  onPreview3D,
  onContinue,
}: {
  project: SchoolProject;
  nickname: string;
  sessionId: string;
  onBack: () => void;
  onPreview3D: () => void;
  onContinue: () => void;
}) {
  const imageValue = useBrowserStorageValue("local", SITE_IMAGE_META_STORAGE_KEY);
  const planValue = useBrowserStorageValue("local", SITE_PLAN_STORAGE_KEY);
  const siteImage = useMemo(() => parseStoredSiteImage(imageValue), [imageValue]);
  const sitePlan = useMemo(() => parseStoredSitePlan(planValue), [planValue]);
  const designStorageKey = getStudentLandscapeDesignStorageKey(sessionId);
  const designValue = useBrowserStorageValue("local", designStorageKey);
  const storedDesign = useMemo(() => parseStoredLandscapeDesign(designValue), [designValue]);

  return (
    <LandscapeDesignWorkspace
      key={`${project.siteImageId ?? "no-image"}-${project.sitePlanId ?? "no-plan"}-${storedDesign?.id ?? "new-design"}`}
      project={project}
      nickname={nickname}
      sessionId={sessionId}
      siteImage={siteImage}
      sitePlan={sitePlan}
      storedDesign={storedDesign}
      designStorageKey={designStorageKey}
      onBack={onBack}
      onPreview3D={onPreview3D}
      onContinue={onContinue}
    />
  );
}

function LandscapeDesignWorkspace({
  project,
  nickname,
  sessionId,
  siteImage,
  sitePlan,
  storedDesign,
  designStorageKey,
  onBack,
  onPreview3D,
  onContinue,
}: {
  project: SchoolProject;
  nickname: string;
  sessionId: string;
  siteImage: SiteImage | null;
  sitePlan: SitePlan | null;
  storedDesign: StudentLandscapeDesign | null;
  designStorageKey: string;
  onBack: () => void;
  onPreview3D: () => void;
  onContinue: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const movingObjectIdRef = useRef<string | null>(null);
  const hasUnsavedChangeRef = useRef(false);
  const [category, setCategory] = useState<LandscapeMaterialCategory>("planting");
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);
  const [objects, setObjects] = useState<LandscapeObject[]>(() =>
    storedDesign?.schoolProjectId === project.id ? storedDesign.objects : [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState("재료를 드래그하거나 선택한 뒤 도면을 눌러 배치하세요.");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "loaded">(
    storedDesign && storedDesign.objects.length > 0 ? "loaded" : "idle",
  );

  const activeImage = siteImage?.id === project.siteImageId ? siteImage : null;
  const activePlan = sitePlan?.id === project.sitePlanId ? sitePlan : null;
  const facilities = activePlan ? getExistingSiteFeatures(activePlan.features) : [];
  const zones = activePlan ? getEditableZoneFeatures(activePlan.features) : [];
  const selectedObject = objects.find((object) => object.id === selectedId) ?? null;
  const selectedMaterial = selectedObject ? findLandscapeMaterial(selectedObject.materialId) : null;
  const paletteMaterials = LANDSCAPE_MATERIALS.filter((material) => material.category === category);
  const designId = storedDesign?.id ?? `landscape-design-${sessionId}`;

  const persistDesign = useCallback((nextObjects: LandscapeObject[]) => {
    const design: StudentLandscapeDesign = {
      id: designId,
      studentSessionId: sessionId,
      schoolProjectId: project.id,
      objects: nextObjects,
      intentionKeyword: storedDesign?.intentionKeyword ?? null,
      intentionReason: storedDesign?.intentionReason ?? null,
      thumbnailUrl: storedDesign?.thumbnailUrl ?? null,
      submittedAt: storedDesign?.submittedAt ?? null,
    };
    writeBrowserStorage("local", designStorageKey, JSON.stringify(design));
    hasUnsavedChangeRef.current = false;
    setSaveState("saved");
  }, [designId, designStorageKey, project.id, sessionId, storedDesign]);

  useEffect(() => {
    if (!hasUnsavedChangeRef.current) return;
    const timer = window.setTimeout(() => persistDesign(objects), 450);
    return () => window.clearTimeout(timer);
  }, [objects, persistDesign]);

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

  function pointFromClient(clientX: number, clientY: number): Point2D | null {
    if (!stageRef.current) return null;
    return normalizePointerPoint(clientX, clientY, stageRef.current.getBoundingClientRect());
  }

  function changeObjects(updater: (current: LandscapeObject[]) => LandscapeObject[]) {
    hasUnsavedChangeRef.current = true;
    setSaveState("saving");
    setObjects(updater);
  }

  function placeMaterial(materialId: string, point: Point2D) {
    const material = findLandscapeMaterial(materialId);
    if (!material) return;
    if (!isFootprintInsideEditableZones(point, getMaterialFootprintRadius(material), zones)) {
      setNotice("연두색 조경 가능 영역 안에만 재료를 배치할 수 있습니다.");
      return;
    }
    const id = `landscape-object-${crypto.randomUUID()}`;
    const next = createLandscapeObject(material, point, objects.length + 1, id);
    changeObjects((current) => [...current, next]);
    setSelectedId(id);
    setActiveMaterialId(null);
    setNotice(`${material.name} 재료를 배치했습니다. 오른쪽에서 크기와 방향을 조절할 수 있습니다.`);
  }

  function updateObject(id: string, patch: Partial<LandscapeObject>) {
    changeObjects((current) => current.map((object) => object.id === id ? { ...object, ...patch } : object));
  }

  function moveObject(event: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (movingObjectIdRef.current !== id) return;
    const point = pointFromClient(event.clientX, event.clientY);
    const object = objects.find((item) => item.id === id);
    const material = object ? findLandscapeMaterial(object.materialId) : null;
    if (!point || !object || !material || !isFootprintInsideEditableZones(point, getMaterialFootprintRadius(material, object.scale), zones)) return;
    updateObject(id, point);
  }

  function duplicateSelected() {
    if (!selectedObject) return;
    const offsetPoint = { x: Math.min(0.98, selectedObject.x + 0.025), y: Math.min(0.98, selectedObject.y + 0.025) };
    const material = findLandscapeMaterial(selectedObject.materialId);
    const position = material && isFootprintInsideEditableZones(offsetPoint, getMaterialFootprintRadius(material, selectedObject.scale), zones)
      ? offsetPoint
      : { x: selectedObject.x, y: selectedObject.y };
    const copy = {
      ...selectedObject,
      ...position,
      id: `landscape-object-${crypto.randomUUID()}`,
      zIndex: objects.length + 1,
    };
    changeObjects((current) => [...current, copy]);
    setSelectedId(copy.id);
    setNotice("선택한 재료를 복제했습니다.");
  }

  function deleteSelected() {
    if (!selectedObject) return;
    changeObjects((current) => current.filter((object) => object.id !== selectedObject.id));
    setSelectedId(null);
    setNotice("재료를 도면에서 삭제했습니다.");
  }

  function moveLayer(direction: "front" | "back") {
    if (!selectedObject || objects.length < 2) return;
    const zValues = objects.map((object) => object.zIndex);
    updateObject(selectedObject.id, {
      zIndex: direction === "front" ? Math.max(...zValues) + 1 : Math.min(...zValues) - 1,
    });
  }

  function nudgeSelected(dx: number, dy: number) {
    if (!selectedObject || !selectedMaterial) return;
    const point = { x: selectedObject.x + dx, y: selectedObject.y + dy };
    const radius = getMaterialFootprintRadius(selectedMaterial, selectedObject.scale);
    if (!isFootprintInsideEditableZones(point, radius, zones)) {
      setNotice("재료 전체가 조경 가능 영역 안에 있어야 합니다.");
      return;
    }
    updateObject(selectedObject.id, point);
    setNotice(`${selectedMaterial.name} 위치를 조금 이동했습니다.`);
  }

  if (!activeImage || !activePlan || zones.length === 0) {
    return (
      <main className="student-design-empty">
        <p className="eyebrow">SITE DESIGN</p>
        <h1>설계 도면을 준비하고 있습니다.</h1>
        <p>선생님이 학교 이미지와 조경 가능 영역을 등록하면 재료 배치를 시작할 수 있습니다.</p>
        <button className="button button--quiet" type="button" onClick={onBack}>공간 확인으로 돌아가기</button>
      </main>
    );
  }

  const aspectRatio = activeImage.width > 0 && activeImage.height > 0
    ? `${activeImage.width} / ${activeImage.height}`
    : "4 / 3";

  return (
    <main className="student-design-studio">
      <aside className="material-library" aria-label="조경 재료함">
        <div className="design-panel-heading">
          <button type="button" onClick={onBack}>← 공간 확인</button>
          <p className="eyebrow">MATERIAL LIBRARY</p>
          <h1>조경 재료함</h1>
          <span>도면으로 끌어놓거나 재료 선택 후 공간을 누르세요.</span>
        </div>
        <div className="material-category-tabs" role="tablist" aria-label="재료 카테고리">
          {MATERIAL_CATEGORIES.map((item) => (
            <button key={item} type="button" role="tab" aria-selected={category === item} className={category === item ? "is-active" : ""} onClick={() => setCategory(item)}>{LANDSCAPE_CATEGORY_LABELS[item]}</button>
          ))}
        </div>
        <div className="material-grid">
          {paletteMaterials.map((material) => (
            <button
              key={material.id}
              type="button"
              draggable
              className={activeMaterialId === material.id ? "is-active" : ""}
              onClick={() => {
                setActiveMaterialId((current) => current === material.id ? null : material.id);
                setSelectedId(null);
                setNotice(`${material.name} 선택됨 · 연두색 영역을 눌러 배치하세요.`);
              }}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/gardening-material", material.id);
                event.dataTransfer.effectAllowed = "copy";
              }}
            >
              <MaterialSymbol material={material} />
              <span><strong>{material.name}</strong><small>{material.realWidthMeters}m 기준</small></span>
            </button>
          ))}
        </div>
      </aside>

      <section className="student-plan-workspace">
        <header className="student-plan-toolbar">
          <div><span>PART 1 · 도면 설계</span><strong>{project.schoolName} 조경 배치도</strong></div>
          <div className="student-plan-save-summary">
            <span className={`save-state save-state--${saveState}`}>
              {saveState === "saving" ? "자동 저장 중" : saveState === "loaded" ? "저장된 설계 불러옴" : saveState === "saved" ? "자동 저장됨" : "새 설계"}
            </span>
            <div><small>{nickname} 설계자</small><strong>배치 {objects.length}개</strong></div>
          </div>
        </header>
        <div
          ref={stageRef}
          className={`student-plan-stage ${activeMaterialId ? "is-placing" : ""}`}
          style={{ aspectRatio }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
          onDrop={(event) => {
            event.preventDefault();
            const point = pointFromClient(event.clientX, event.clientY);
            const materialId = event.dataTransfer.getData("text/gardening-material");
            if (point && materialId) placeMaterial(materialId, point);
          }}
          onPointerDown={(event) => {
            if (!activeMaterialId || (event.target as Element).closest(".landscape-object")) return;
            const point = pointFromClient(event.clientX, event.clientY);
            if (point) placeMaterial(activeMaterialId, point);
          }}
          aria-label="학생 학교 조경 설계 도면"
        >
          {!previewUrl && !loadError ? <div className="plan-stage-message">학교 도면 불러오는 중</div> : null}
          {loadError ? <div className="plan-stage-message">학교 이미지를 불러오지 못했습니다.</div> : null}
          {previewUrl && activeImage.mimeType === "application/pdf" ? <object data={previewUrl} type="application/pdf" title="학교 배치도 PDF" /> : null}
          {previewUrl && activeImage.mimeType !== "application/pdf" ? <Image src={previewUrl} alt="학생 설계용 학교 공간" fill sizes="(max-width: 1000px) 100vw, 65vw" unoptimized draggable={false} /> : null}
          <svg className="student-base-overlay" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <pattern id="student-zone-stripes" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="18" fill="#b7d93d" fillOpacity="0.28" /></pattern>
            </defs>
            {facilities.map((feature) => {
              const option = getFeatureOption(feature.kind);
              return <polygon className="student-existing-shape" key={feature.id} points={pointsToSvg(feature.points)} fill={option?.color ?? "#596776"} stroke={option?.color ?? "#596776"} />;
            })}
            {zones.map((zone) => <polygon className="student-editable-shape" key={zone.id} points={pointsToSvg(zone.points)} fill="url(#student-zone-stripes)" stroke="#9fbd2d" />)}
          </svg>
          {objects.map((object) => {
            const material = findLandscapeMaterial(object.materialId);
            if (!material) return null;
            const baseSize = Math.max(30, Math.min(82, Math.sqrt(object.width * object.height) * 19));
            const style = {
              left: `${object.x * 100}%`,
              top: `${object.y * 100}%`,
              zIndex: object.zIndex + 5,
              width: `${baseSize}px`,
              height: `${baseSize}px`,
              transform: `translate(-50%, -50%) rotate(${object.rotation}deg) scale(${object.scale})`,
              "--object-color": material.color,
            } as CSSProperties;
            return (
              <button
                key={object.id}
                type="button"
                className={`landscape-object material-shape--${material.shape} ${selectedId === object.id ? "is-selected" : ""}`}
                style={style}
                aria-label={`${material.name} 배치 개체`}
                onClick={(event) => { event.stopPropagation(); setSelectedId(object.id); setActiveMaterialId(null); }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  movingObjectIdRef.current = object.id;
                  setSelectedId(object.id);
                  setActiveMaterialId(null);
                }}
                onPointerMove={(event) => moveObject(event, object.id)}
                onPointerUp={() => { movingObjectIdRef.current = null; }}
                onPointerCancel={() => { movingObjectIdRef.current = null; }}
              >
                <span />
                <small>{material.shortLabel}</small>
              </button>
            );
          })}
          <div className="student-zone-label">조경 가능 영역 안에서 설계</div>
        </div>
        <footer className="student-plan-status">
          <p role="status">{notice}</p>
          <div>
            <button className="student-save-button" type="button" onClick={() => persistDesign(objects)}>지금 저장</button>
            <button
              className="student-preview3d-button"
              type="button"
              disabled={objects.length === 0}
              onClick={() => {
                persistDesign(objects);
                onPreview3D();
              }}
            >
              3D 미리보기 <span>{objects.length > 0 ? "설계 확인" : "재료 배치 후"}</span>
            </button>
            <button
              className="student-complete-design-button"
              type="button"
              disabled={objects.length === 0}
              onClick={() => {
                persistDesign(objects);
                onContinue();
              }}
            >
              설계 완료 <span>{objects.length > 0 ? "의도 작성" : "재료 배치 후"}</span>
            </button>
          </div>
        </footer>
      </section>

      <aside className="object-inspector" aria-label="선택한 재료 속성">
        <div className="design-panel-heading">
          <p className="eyebrow">OBJECT PROPERTIES</p>
          <h2>선택한 재료</h2>
        </div>
        {!selectedObject || !selectedMaterial ? (
          <div className="inspector-empty"><span /><strong>도면의 재료를 선택하세요.</strong><p>이동하거나 크기와 방향을 조절할 수 있습니다.</p></div>
        ) : (
          <div className="inspector-controls">
            <div className="selected-material-summary"><MaterialSymbol material={selectedMaterial} /><div><small>{LANDSCAPE_CATEGORY_LABELS[selectedMaterial.category]}</small><strong>{selectedMaterial.name}</strong><span>실제 기준 {selectedMaterial.realWidthMeters} × {selectedMaterial.realHeightMeters}m</span></div></div>
            <label><span>크기 <strong>{Math.round(selectedObject.scale * 100)}%</strong></span><input type="range" min="0.5" max="2" step="0.1" value={selectedObject.scale} onChange={(event) => updateObject(selectedObject.id, { scale: Number(event.target.value) })} /></label>
            <label><span>방향 <strong>{selectedObject.rotation}°</strong></span><input type="range" min="0" max="350" step="10" value={selectedObject.rotation} onChange={(event) => updateObject(selectedObject.id, { rotation: Number(event.target.value) })} /></label>
            <div className="nudge-actions"><span>위치 미세 조정</span><div><button type="button" aria-label="위로 이동" onClick={() => nudgeSelected(0, -0.02)}>위</button><button type="button" aria-label="왼쪽으로 이동" onClick={() => nudgeSelected(-0.02, 0)}>왼쪽</button><button type="button" aria-label="아래로 이동" onClick={() => nudgeSelected(0, 0.02)}>아래</button><button type="button" aria-label="오른쪽으로 이동" onClick={() => nudgeSelected(0.02, 0)}>오른쪽</button></div></div>
            <div className="layer-actions"><span>겹침 순서</span><div><button type="button" onClick={() => moveLayer("back")}>뒤로</button><button type="button" onClick={() => moveLayer("front")}>앞으로</button></div></div>
            <div className="object-actions"><button type="button" onClick={duplicateSelected}>복제</button><button type="button" onClick={deleteSelected}>삭제</button></div>
            <p className="move-tip">도면에서 선택한 재료를 직접 끌어 위치를 바꿀 수 있습니다.</p>
          </div>
        )}
        <div className="design-checklist"><strong>설계할 때 생각하기</strong><ul><li>사람이 편하게 이동할 수 있나요?</li><li>그늘과 쉴 곳이 있나요?</li><li>기존 시설을 막지 않았나요?</li></ul></div>
      </aside>
    </main>
  );
}

function MaterialSymbol({ material }: { material: PlanLandscapeMaterial }) {
  return (
    <span
      className={`material-symbol material-shape--${material.shape}`}
      style={{ "--object-color": material.color } as CSSProperties}
      aria-hidden="true"
    ><i /></span>
  );
}
