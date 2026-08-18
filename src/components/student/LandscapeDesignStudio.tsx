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
  LandscapeObject,
  Point2D,
  SchoolProject,
  SiteImage,
  StudentLandscapeDesign,
} from "@/domain/models";
import {
  createLandscapeObject,
  getMaterialFootprintRadius,
  isFootprintInsideCanvas,
} from "@/lib/landscape-design";
import { normalizePointerPoint } from "@/lib/pointer-coordinate";
import {
  AUTO_SITE_BACKGROUND_META_STORAGE_KEY,
  parseStoredAutoSiteBackground,
  parseStoredSiteImage,
  parseStoredLandscapeDesign,
  getStudentLandscapeDesignStorageKey,
  SITE_IMAGE_META_STORAGE_KEY,
} from "@/lib/project-store";
import { getSiteImageFile } from "@/lib/site-image-store";
import { useBrowserStorageValue, writeBrowserStorage } from "@/lib/use-browser-storage";
import { LandscapePlanOverlay } from "@/components/student/LandscapePlanOverlay";

const PRIMARY_MATERIAL_IDS = ["tree-canopy", "pine", "flower", "lawn", "bench", "rock", "dirt-path", "flower-bed"];
const PRIMARY_MATERIALS = LANDSCAPE_MATERIALS.filter(
  (material) => PRIMARY_MATERIAL_IDS.includes(material.id) && material.planAssetUrl,
);

export function LandscapeDesignStudio({
  project,
  nickname,
  sessionId,
  onPreview3D,
  onContinue,
}: {
  project: SchoolProject;
  nickname: string;
  sessionId: string;
  onPreview3D: () => void;
  onContinue: () => void;
}) {
  const imageValue = useBrowserStorageValue("local", SITE_IMAGE_META_STORAGE_KEY);
  const backgroundValue = useBrowserStorageValue("local", AUTO_SITE_BACKGROUND_META_STORAGE_KEY);
  const siteImage = useMemo(() => parseStoredSiteImage(imageValue), [imageValue]);
  const autoBackground = useMemo(() => parseStoredAutoSiteBackground(backgroundValue), [backgroundValue]);
  const designStorageKey = getStudentLandscapeDesignStorageKey(sessionId);
  const designValue = useBrowserStorageValue("local", designStorageKey);
  const storedDesign = useMemo(() => parseStoredLandscapeDesign(designValue), [designValue]);

  return (
    <LandscapeDesignWorkspace
      key={`${project.siteImageId ?? "no-image"}-${autoBackground?.id ?? "no-background"}-${storedDesign?.id ?? "new-design"}`}
      project={project}
      nickname={nickname}
      sessionId={sessionId}
      siteImage={siteImage}
      storedDesign={storedDesign}
      designStorageKey={designStorageKey}
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
  storedDesign,
  designStorageKey,
  onPreview3D,
  onContinue,
}: {
  project: SchoolProject;
  nickname: string;
  sessionId: string;
  siteImage: SiteImage | null;
  storedDesign: StudentLandscapeDesign | null;
  designStorageKey: string;
  onPreview3D: () => void;
  onContinue: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const movingObjectIdRef = useRef<string | null>(null);
  const hasUnsavedChangeRef = useRef(false);
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);
  const [objects, setObjects] = useState<LandscapeObject[]>(() =>
    storedDesign?.schoolProjectId === project.id ? storedDesign.objects : [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [backgroundMode, setBackgroundMode] = useState<"photo" | "plan">("photo");
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState("재료를 끌어 사진 위에 놓아보세요.");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "loaded">(
    storedDesign && storedDesign.objects.length > 0 ? "loaded" : "idle",
  );

  const activeImage = siteImage?.id === project.siteImageId ? siteImage : null;
  const selectedObject = objects.find((object) => object.id === selectedId) ?? null;
  const selectedMaterial = selectedObject ? findLandscapeMaterial(selectedObject.materialId) : null;
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
    let photoObjectUrl: string | null = null;
    getSiteImageFile(activeImage.storageKey).then((photoBlob) => {
      if (!alive || !photoBlob) { if (alive) setLoadError(true); return; }
      photoObjectUrl = URL.createObjectURL(photoBlob);
      setPhotoUrl(photoObjectUrl);
    })
      .catch(() => { if (alive) setLoadError(true); });
    return () => {
      alive = false;
      if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
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
    if (!isFootprintInsideCanvas(point, getMaterialFootprintRadius(material))) {
      setNotice("사진 안쪽에 재료를 놓아주세요.");
      return;
    }
    const id = `landscape-object-${crypto.randomUUID()}`;
    const next = createLandscapeObject(material, point, objects.length + 1, id);
    changeObjects((current) => [...current, next]);
    setSelectedId(id);
    setActiveMaterialId(null);
    setNotice(`${material.name} 재료를 배치했습니다.`);
  }

  function updateObject(id: string, patch: Partial<LandscapeObject>) {
    changeObjects((current) => current.map((object) => object.id === id ? { ...object, ...patch } : object));
  }

  function moveObject(event: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (movingObjectIdRef.current !== id) return;
    const point = pointFromClient(event.clientX, event.clientY);
    const object = objects.find((item) => item.id === id);
    const material = object ? findLandscapeMaterial(object.materialId) : null;
    if (!point || !object || !material || !isFootprintInsideCanvas(point, getMaterialFootprintRadius(material, object.scale))) return;
    updateObject(id, point);
  }

  function duplicateSelected() {
    if (!selectedObject) return;
    const offsetPoint = { x: Math.min(0.98, selectedObject.x + 0.025), y: Math.min(0.98, selectedObject.y + 0.025) };
    const material = findLandscapeMaterial(selectedObject.materialId);
    const position = material && isFootprintInsideCanvas(offsetPoint, getMaterialFootprintRadius(material, selectedObject.scale))
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
    setNotice("재료를 지웠습니다.");
  }

  function resizeSelected(delta: number) {
    if (!selectedObject || !selectedMaterial) return;
    const nextScale = Math.max(0.5, Math.min(2, selectedObject.scale + delta));
    const point = { x: selectedObject.x, y: selectedObject.y };
    const radius = getMaterialFootprintRadius(selectedMaterial, nextScale);
    if (!isFootprintInsideCanvas(point, radius)) {
      setNotice("사진 안에서만 크게 만들 수 있어요.");
      return;
    }
    updateObject(selectedObject.id, { scale: nextScale });
    setNotice(delta > 0 ? "재료를 크게 만들었습니다." : "재료를 작게 만들었습니다.");
  }

  function rotateSelected() {
    if (!selectedObject) return;
    updateObject(selectedObject.id, { rotation: (selectedObject.rotation + 45) % 360 });
    setNotice("재료를 돌렸습니다.");
  }

  if (!activeImage) {
    return (
      <main className="student-design-empty">
        <h1>학교 공간 준비 중</h1>
        <p>선생님이 학교 사진을 올리면 바로 시작할 수 있어요.</p>
      </main>
    );
  }

  const aspectRatio = activeImage.width > 0 && activeImage.height > 0
    ? `${activeImage.width} / ${activeImage.height}`
    : "4 / 3";

  return (
    <main className={`student-design-studio ${selectedObject ? "has-selection" : ""}`}>
      <aside className="material-library" aria-label="조경 재료함">
        <div className="design-panel-heading">
          <h1>재료</h1>
          <span>사진 위에 끌어 놓으세요.</span>
        </div>
        <div className="material-grid">
          {PRIMARY_MATERIALS.map((material) => (
            <button
              key={material.id}
              type="button"
              draggable
              className={activeMaterialId === material.id ? "is-active" : ""}
              onClick={() => {
                setActiveMaterialId((current) => current === material.id ? null : material.id);
                setSelectedId(null);
                setNotice(`${material.name} 선택됨 · 원하는 곳을 눌러보세요.`);
              }}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/gardening-material", material.id);
                event.dataTransfer.effectAllowed = "copy";
              }}
            >
              <MaterialPhoto material={material} />
              <span><strong>{material.shortLabel}</strong></span>
            </button>
          ))}
        </div>
      </aside>

      <section className="student-plan-workspace">
        <header className="student-plan-toolbar">
          <div><span>우리 학교를 조경해보세요</span><strong>{project.schoolName}</strong></div>
          <div className="student-background-toggle" role="group" aria-label="학교 배경 선택">
            <button type="button" className={backgroundMode === "photo" ? "is-active" : ""} onClick={() => { setBackgroundMode("photo"); setNotice("항공사진 위에서 재료를 배치합니다."); }}>항공 배치</button>
            <button type="button" className={backgroundMode === "plan" ? "is-active" : ""} onClick={() => { setBackgroundMode("plan"); setNotice("재료 코드와 수량을 표시한 예상 도면입니다."); }}>예상 도면</button>
          </div>
          <div className="student-plan-save-summary">
            <span className={`save-state save-state--${saveState}`}>
              {saveState === "saving" ? "자동 저장 중" : saveState === "loaded" ? "저장된 설계 불러옴" : saveState === "saved" ? "자동 저장됨" : "새 설계"}
            </span>
            <div><small>{nickname} 설계자</small><strong>배치 {objects.length}개</strong></div>
          </div>
        </header>
        <div
          ref={stageRef}
          className={`student-plan-stage ${activeMaterialId ? "is-placing" : ""} ${backgroundMode === "plan" ? "is-plan-view" : ""}`}
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
          aria-label="학교 사진 위 조경 재료 배치"
        >
          {!photoUrl && !loadError ? <div className="plan-stage-message">학교 공간 불러오는 중</div> : null}
          {loadError ? <div className="plan-stage-message">학교 이미지를 불러오지 못했습니다.</div> : null}
          {photoUrl && activeImage.mimeType === "application/pdf" ? <object className={backgroundMode === "plan" ? "is-technical-plan" : ""} data={photoUrl} type="application/pdf" title="학교 배치 이미지 PDF" /> : null}
          {photoUrl && activeImage.mimeType !== "application/pdf" ? <Image className={backgroundMode === "plan" ? "is-technical-plan" : ""} src={photoUrl} alt={backgroundMode === "plan" ? "항공사진을 바탕으로 밝게 표시한 예상 배치도" : "실제 학교 항공사진"} fill sizes="(max-width: 1000px) 100vw, 65vw" unoptimized draggable={false} /> : null}
          {objects.map((object) => {
            const material = findLandscapeMaterial(object.materialId);
            if (!material) return null;
            const style = {
              left: `${object.x * 100}%`,
              top: `${object.y * 100}%`,
              zIndex: object.zIndex + 5,
              width: `${material.planWidth ?? 76}px`,
              height: `${material.planHeight ?? 76}px`,
              transform: `translate(-50%, -50%) rotate(${object.rotation}deg) scale(${object.scale})`,
            } as CSSProperties;
            return (
              <button
                key={object.id}
                type="button"
                className={`landscape-object landscape-object--${material.id} ${selectedId === object.id ? "is-selected" : ""}`}
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
                <MaterialPhoto material={material} placed />
              </button>
            );
          })}
          {backgroundMode === "plan" ? <LandscapePlanOverlay objects={objects} schoolName={project.schoolName} /> : null}
          {objects.length === 0 ? <div className="student-zone-label">여기에 놓기</div> : null}
        </div>
        <footer className="student-plan-status">
          <p role="status">{notice}</p>
          <div>
            <button
              className="student-preview3d-button"
              type="button"
              disabled={objects.length === 0}
              onClick={() => {
                persistDesign(objects);
                onPreview3D();
              }}
            >
              360° 예상전경 <span>{objects.length > 0 ? "예상 모형 보기" : "재료 배치 후"}</span>
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
              완성 <span>{objects.length > 0 ? "다음" : "재료 배치 후"}</span>
            </button>
          </div>
        </footer>
      </section>

      {selectedObject && selectedMaterial ? (
        <aside className="object-inspector" aria-label="선택한 재료 조작">
          <div className="inspector-controls">
            <div className="selected-material-summary"><MaterialPhoto material={selectedMaterial} /><div><small>{LANDSCAPE_CATEGORY_LABELS[selectedMaterial.category]}</small><strong>{selectedMaterial.name}</strong></div></div>
            <div className="simple-object-actions">
              <button type="button" onClick={() => resizeSelected(-0.1)}>작게</button>
              <button type="button" onClick={() => resizeSelected(0.1)}>크게</button>
              <button type="button" onClick={rotateSelected}>돌리기</button>
              <button type="button" onClick={duplicateSelected}>복사</button>
              <button type="button" onClick={deleteSelected}>지우기</button>
            </div>
          </div>
        </aside>
      ) : null}
    </main>
  );
}

function MaterialPhoto({ material, placed = false }: { material: PlanLandscapeMaterial; placed?: boolean }) {
  if (!material.planAssetUrl) return null;
  return (
    <span className={placed ? "material-photo material-photo--placed" : "material-photo"} aria-hidden="true">
      <Image src={material.planAssetUrl} alt="" fill sizes={placed ? "160px" : "96px"} unoptimized draggable={false} />
    </span>
  );
}
