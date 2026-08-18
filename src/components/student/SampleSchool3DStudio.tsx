"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SampleSchool3DScene, type SampleSchoolCameraView } from "@/components/student/SampleSchool3DScene";
import {
  findLandscapeMaterial,
  LANDSCAPE_MATERIALS,
  type PlanLandscapeMaterial,
} from "@/data/landscape-materials";
import type { LandscapeObject, Point2D, SchoolProject, StudentLandscapeDesign } from "@/domain/models";
import { createLandscapeObject } from "@/lib/landscape-design";
import {
  getStudentLandscapeDesignStorageKey,
  parseStoredLandscapeDesign,
} from "@/lib/project-store";
import {
  isSampleSchoolPlacementAllowed,
  SAMPLE_SCHOOL_SCENE_VERSION,
} from "@/lib/sample-school";
import { useBrowserStorageValue, writeBrowserStorage } from "@/lib/use-browser-storage";

const PRIMARY_MATERIAL_IDS = ["tree-canopy", "pine", "flower", "lawn", "bench", "rock", "dirt-path", "flower-bed"];
const PRIMARY_MATERIALS = LANDSCAPE_MATERIALS.filter((material) => PRIMARY_MATERIAL_IDS.includes(material.id));

function materialRadius(material: PlanLandscapeMaterial, scale = 1): number {
  return Math.max(0.35, Math.max(material.realWidthMeters, material.realHeightMeters) * scale * 0.42);
}

export function SampleSchool3DStudio({
  project,
  nickname,
  sessionId,
  onContinue,
}: {
  project: SchoolProject;
  nickname: string;
  sessionId: string;
  onContinue: () => void;
}) {
  const designStorageKey = getStudentLandscapeDesignStorageKey(sessionId);
  const designValue = useBrowserStorageValue("local", designStorageKey);
  const storedDesign = useMemo(() => parseStoredLandscapeDesign(designValue), [designValue]);

  return (
    <SampleSchool3DWorkspace
      key={`${sessionId}-${storedDesign?.id ?? "new"}-${storedDesign?.sceneVersion ?? "legacy"}`}
      project={project}
      nickname={nickname}
      sessionId={sessionId}
      storedDesign={storedDesign}
      designStorageKey={designStorageKey}
      onContinue={onContinue}
    />
  );
}

function SampleSchool3DWorkspace({
  project,
  nickname,
  sessionId,
  storedDesign,
  designStorageKey,
  onContinue,
}: {
  project: SchoolProject;
  nickname: string;
  sessionId: string;
  storedDesign: StudentLandscapeDesign | null;
  designStorageKey: string;
  onContinue: () => void;
}) {
  const startingObjects = storedDesign?.sceneVersion === SAMPLE_SCHOOL_SCENE_VERSION ? storedDesign.objects : [];
  const [objects, setObjects] = useState<LandscapeObject[]>(startingObjects);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);
  const [cameraView, setCameraView] = useState<SampleSchoolCameraView>("orbit");
  const [notice, setNotice] = useState("재료를 고르고 학교 공간을 눌러보세요.");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(startingObjects.length > 0 ? "saved" : "idle");
  const hasUnsavedChangeRef = useRef(false);
  const designId = storedDesign?.id ?? `landscape-design-${sessionId}`;
  const selectedObject = objects.find((object) => object.id === selectedId) ?? null;
  const selectedMaterial = selectedObject ? findLandscapeMaterial(selectedObject.materialId) : null;

  const persistDesign = useCallback((nextObjects: LandscapeObject[]) => {
    const design: StudentLandscapeDesign = {
      id: designId,
      studentSessionId: sessionId,
      schoolProjectId: project.id,
      sceneVersion: SAMPLE_SCHOOL_SCENE_VERSION,
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

  function changeObjects(updater: (current: LandscapeObject[]) => LandscapeObject[]) {
    hasUnsavedChangeRef.current = true;
    setSaveState("saving");
    setObjects(updater);
  }

  const placeMaterial = useCallback((materialId: string, point: Point2D) => {
    const material = findLandscapeMaterial(materialId);
    if (!material) return;
    if (!isSampleSchoolPlacementAllowed(point, materialRadius(material))) {
      setNotice("건물과 학교 경계를 피해 빈 공간에 놓아주세요.");
      return;
    }
    const id = `landscape-object-${crypto.randomUUID()}`;
    const next = createLandscapeObject(material, point, objects.length + 1, id);
    changeObjects((current) => [...current, next]);
    setSelectedId(id);
    setNotice(`${material.name} 배치 완료 · 끌어서 위치를 바꿀 수 있어요.`);
  }, [objects.length]);

  const moveObject = useCallback((objectId: string, point: Point2D) => {
    const object = objects.find((item) => item.id === objectId);
    const material = object ? findLandscapeMaterial(object.materialId) : null;
    if (!object || !material || !isSampleSchoolPlacementAllowed(point, materialRadius(material, object.scale))) return;
    changeObjects((current) => current.map((item) => item.id === objectId ? { ...item, ...point } : item));
  }, [objects]);

  function updateSelected(patch: Partial<LandscapeObject>) {
    if (!selectedObject) return;
    changeObjects((current) => current.map((item) => item.id === selectedObject.id ? { ...item, ...patch } : item));
  }

  function resizeSelected(delta: number) {
    if (!selectedObject || !selectedMaterial) return;
    const scale = Math.max(0.55, Math.min(1.8, selectedObject.scale + delta));
    if (!isSampleSchoolPlacementAllowed(selectedObject, materialRadius(selectedMaterial, scale))) {
      setNotice("건물과 겹치지 않는 곳에서 크기를 조절해 주세요.");
      return;
    }
    updateSelected({ scale });
    setNotice(delta > 0 ? "재료를 크게 만들었습니다." : "재료를 작게 만들었습니다.");
  }

  function duplicateSelected() {
    if (!selectedObject || !selectedMaterial) return;
    const candidate = { x: Math.min(0.96, selectedObject.x + 0.045), y: Math.min(0.96, selectedObject.y + 0.045) };
    const position = isSampleSchoolPlacementAllowed(candidate, materialRadius(selectedMaterial, selectedObject.scale))
      ? candidate
      : { x: selectedObject.x, y: selectedObject.y };
    const copy: LandscapeObject = {
      ...selectedObject,
      ...position,
      id: `landscape-object-${crypto.randomUUID()}`,
      zIndex: objects.length + 1,
    };
    changeObjects((current) => [...current, copy]);
    setSelectedId(copy.id);
    setNotice("같은 재료를 하나 더 만들었습니다.");
  }

  function deleteSelected() {
    if (!selectedObject) return;
    changeObjects((current) => current.filter((item) => item.id !== selectedObject.id));
    setSelectedId(null);
    setNotice("선택한 재료를 지웠습니다.");
  }

  return (
    <main className="sample-school-studio">
      <aside className="sample-materials" aria-label="조경 재료">
        <header>
          <span>실사 조경재료</span>
          <strong>놓을 재료</strong>
          <p>선택하거나 끌어서 놓으세요.</p>
        </header>
        <div className="sample-materials__grid">
          {PRIMARY_MATERIALS.map((material) => (
            <button
              key={material.id}
              type="button"
              className={activeMaterialId === material.id ? "is-active" : ""}
              aria-pressed={activeMaterialId === material.id}
              draggable
              onClick={() => {
                setActiveMaterialId((current) => current === material.id ? null : material.id);
                setSelectedId(null);
                setNotice(`${material.name} 선택 · 학교의 빈 공간을 눌러보세요.`);
              }}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/gardening-material", material.id);
                event.dataTransfer.effectAllowed = "copy";
              }}
            >
              <MaterialThumbnail material={material} />
              <span>{material.shortLabel}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="sample-school-workspace">
        <header className="sample-school-toolbar">
          <div className="sample-school-toolbar__title">
            <small>3D 중학교 조경 스튜디오</small>
            <strong>{project.schoolName}</strong>
          </div>
          <div className="sample-camera-tabs" role="group" aria-label="학교 보는 시점">
            <button type="button" className={cameraView === "aerial" ? "is-active" : ""} onClick={() => setCameraView("aerial")}>항공샷</button>
            <button type="button" className={cameraView === "orbit" ? "is-active" : ""} onClick={() => setCameraView("orbit")}>입체</button>
            <button type="button" className={cameraView === "walk" ? "is-active" : ""} onClick={() => setCameraView("walk")}>학생 시점</button>
          </div>
          <div className="sample-school-toolbar__status">
            <span>{saveState === "saving" ? "저장 중" : saveState === "saved" ? "자동 저장됨" : "새 설계"}</span>
            <strong>{nickname} · {objects.length}개</strong>
          </div>
        </header>

        <div className={`sample-school-canvas ${activeMaterialId ? "is-placing" : ""}`}>
          <SampleSchool3DScene
            objects={objects}
            selectedId={selectedId}
            activeMaterialId={activeMaterialId}
            cameraView={cameraView}
            onPlace={placeMaterial}
            onMove={moveObject}
            onSelect={(id) => {
              setSelectedId(id);
              if (id) setActiveMaterialId(null);
            }}
          />
          <div className="sample-school-canvas__badge">
            <strong>{cameraView === "aerial" ? "학교 전체 배치" : cameraView === "walk" ? "학생 눈높이" : "360° 입체 보기"}</strong>
            <span>{cameraView === "aerial" ? "항공에서 위치 확인" : "드래그해 둘러보기"}</span>
          </div>
          <p className="sample-school-notice" role="status">{notice}</p>
        </div>

        <footer className="sample-school-footer">
          <div className="sample-selected-tools">
            {selectedObject && selectedMaterial ? (
              <>
                <div className="sample-selected-tools__name"><MaterialThumbnail material={selectedMaterial} /><span><small>선택됨</small><strong>{selectedMaterial.name}</strong></span></div>
                <button type="button" onClick={() => resizeSelected(-0.1)}>작게</button>
                <button type="button" onClick={() => resizeSelected(0.1)}>크게</button>
                <button type="button" onClick={() => { updateSelected({ rotation: (selectedObject.rotation + 45) % 360 }); setNotice("재료를 돌렸습니다."); }}>돌리기</button>
                <button type="button" onClick={duplicateSelected}>복사</button>
                <button type="button" className="is-danger" onClick={deleteSelected}>지우기</button>
              </>
            ) : (
              <p><strong>배치 방법</strong><span>재료 선택 → 빈 공간 누르기 → 재료를 끌어 이동</span></p>
            )}
          </div>
          <button
            className="sample-school-complete"
            type="button"
            disabled={objects.length === 0}
            onClick={() => {
              persistDesign(objects);
              onContinue();
            }}
          >
            완성 <span>{objects.length > 0 ? "다음" : "재료를 놓아주세요"}</span>
          </button>
        </footer>
      </section>
    </main>
  );
}

function MaterialThumbnail({ material }: { material: PlanLandscapeMaterial }) {
  return (
    <span className="sample-material-thumb" aria-hidden="true">
      {material.planAssetUrl ? <Image src={material.planAssetUrl} alt="" fill sizes="96px" unoptimized draggable={false} /> : null}
    </span>
  );
}
