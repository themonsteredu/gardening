"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SampleSchool3DScene, type SampleSchoolCameraView } from "@/components/student/SampleSchool3DScene";
import { findLandscapeMaterial, LANDSCAPE_MATERIALS, type PlanLandscapeMaterial } from "@/data/landscape-materials";
import type {
  LandscapeObject,
  Point2D,
  SchoolProject,
  SchoolSurfaceMaterialId,
  SchoolSurfaceStroke,
  StudentLandscapeDesign,
} from "@/domain/models";
import { createLandscapeObject } from "@/lib/landscape-design";
import { getStudentLandscapeDesignStorageKey, parseStoredLandscapeDesign } from "@/lib/project-store";
import {
  getSampleSchoolPlacementClearance,
  findSampleSchoolSurfaceMaterial,
  isSampleSchoolPlacementAllowed,
  SAMPLE_SCHOOL_DEPTH_METERS,
  SAMPLE_SCHOOL_SCENE_VERSION,
  SAMPLE_SCHOOL_SURFACE_MATERIALS,
  SAMPLE_SCHOOL_WIDTH_METERS,
  type SampleSchoolSurfaceMaterial,
} from "@/lib/sample-school";
import { useBrowserStorageValue, writeBrowserStorage } from "@/lib/use-browser-storage";

type MaterialPickerGroup = "trees" | "flowers" | "facilities";

const MATERIAL_GROUPS: Array<{ id: MaterialPickerGroup; label: string }> = [
  { id: "trees", label: "나무" },
  { id: "flowers", label: "꽃·관목" },
  { id: "facilities", label: "시설" },
];

function materialRadius(material: PlanLandscapeMaterial, scale = 1): number {
  return Math.max(0.35, Math.max(material.realWidthMeters, material.realHeightMeters) * scale * 0.42);
}

function materialPlacementClearance(material: PlanLandscapeMaterial, scale = 1): number {
  return getSampleSchoolPlacementClearance(material.id, materialRadius(material, scale));
}

function distanceInMeters(a: Point2D, b: Point2D): number {
  return Math.hypot(
    (a.x - b.x) * SAMPLE_SCHOOL_WIDTH_METERS,
    (a.y - b.y) * SAMPLE_SCHOOL_DEPTH_METERS,
  );
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
      key={sessionId}
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
  const isCurrentScene = storedDesign?.sceneVersion === SAMPLE_SCHOOL_SCENE_VERSION;
  const startingObjects = isCurrentScene ? storedDesign.objects : [];
  const startingStrokes = isCurrentScene ? storedDesign.surfaceStrokes ?? [] : [];
  const [objects, setObjects] = useState<LandscapeObject[]>(startingObjects);
  const [surfaceStrokes, setSurfaceStrokes] = useState<SchoolSurfaceStroke[]>(startingStrokes);
  const [toolMode, setToolMode] = useState<"surface" | "objects">("surface");
  const [materialGroup, setMaterialGroup] = useState<MaterialPickerGroup>("trees");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);
  const [activeSurfaceId, setActiveSurfaceId] = useState<SchoolSurfaceMaterialId | null>(null);
  const [cameraView, setCameraView] = useState<SampleSchoolCameraView>("orbit");
  const [notice, setNotice] = useState("먼저 바닥 재료를 골라 빈 땅에 그려보세요.");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    startingObjects.length > 0 || startingStrokes.length > 0 ? "saved" : "idle",
  );
  const hasUnsavedChangeRef = useRef(false);
  const designId = storedDesign?.id ?? `landscape-design-${sessionId}`;
  const selectedObject = objects.find((object) => object.id === selectedId) ?? null;
  const selectedMaterial = selectedObject ? findLandscapeMaterial(selectedObject.materialId) : null;
  const visibleMaterials = LANDSCAPE_MATERIALS.filter((material) => material.pickerGroup === materialGroup);

  const persistDesign = useCallback((nextObjects: LandscapeObject[], nextStrokes: SchoolSurfaceStroke[]) => {
    const design: StudentLandscapeDesign = {
      id: designId,
      studentSessionId: sessionId,
      schoolProjectId: project.id,
      sceneVersion: SAMPLE_SCHOOL_SCENE_VERSION,
      objects: nextObjects,
      surfaceStrokes: nextStrokes,
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
    const timer = window.setTimeout(() => persistDesign(objects, surfaceStrokes), 500);
    return () => window.clearTimeout(timer);
  }, [objects, persistDesign, surfaceStrokes]);

  const markChanged = useCallback(() => {
    hasUnsavedChangeRef.current = true;
    setSaveState("saving");
  }, []);

  const changeObjects = useCallback((updater: (current: LandscapeObject[]) => LandscapeObject[]) => {
    markChanged();
    setObjects(updater);
  }, [markChanged]);

  const changeSurfaceStrokes = useCallback((updater: (current: SchoolSurfaceStroke[]) => SchoolSurfaceStroke[]) => {
    markChanged();
    setSurfaceStrokes(updater);
  }, [markChanged]);

  const paintSurface = useCallback((
    strokeId: string,
    materialId: SchoolSurfaceMaterialId,
    point: Point2D,
    startsStroke: boolean,
  ) => {
    const surface = findSampleSchoolSurfaceMaterial(materialId);
    if (!surface) return;
    markChanged();
    setSurfaceStrokes((current) => {
      if (startsStroke) {
        return [...current, {
          id: strokeId,
          materialId,
          points: [point],
          widthMeters: surface.widthMeters,
          zIndex: current.length + 1,
        }];
      }
      return current.map((stroke) => {
        if (stroke.id !== strokeId) return stroke;
        const previous = stroke.points.at(-1);
        if (previous && distanceInMeters(previous, point) < 0.18) return stroke;
        return { ...stroke, points: [...stroke.points, point] };
      });
    });
  }, [markChanged]);

  const placeMaterial = useCallback((materialId: string, point: Point2D) => {
    const material = findLandscapeMaterial(materialId);
    if (!material) return;
    if (!isSampleSchoolPlacementAllowed(point, materialPlacementClearance(material))) {
      setNotice("건물과 학교 경계를 피해 빈 공간에 놓아주세요.");
      return;
    }
    const id = `landscape-object-${crypto.randomUUID()}`;
    changeObjects((current) => [...current, createLandscapeObject(material, point, current.length + 1, id)]);
    setSelectedId(id);
    setNotice(`${material.name} 배치 완료 · 끌어서 위치를 바꿀 수 있어요.`);
  }, [changeObjects]);

  const moveObject = useCallback((objectId: string, point: Point2D) => {
    const object = objects.find((item) => item.id === objectId);
    const material = object ? findLandscapeMaterial(object.materialId) : null;
    if (!object || !material || !isSampleSchoolPlacementAllowed(point, materialPlacementClearance(material, object.scale))) return;
    changeObjects((current) => current.map((item) => item.id === objectId ? { ...item, ...point } : item));
  }, [changeObjects, objects]);

  function updateSelected(patch: Partial<LandscapeObject>) {
    if (!selectedObject) return;
    changeObjects((current) => current.map((item) => item.id === selectedObject.id ? { ...item, ...patch } : item));
  }

  function resizeSelected(delta: number) {
    if (!selectedObject || !selectedMaterial) return;
    const scale = Math.max(0.55, Math.min(1.8, selectedObject.scale + delta));
    if (!isSampleSchoolPlacementAllowed(selectedObject, materialPlacementClearance(selectedMaterial, scale))) {
      setNotice("건물과 겹치지 않는 곳에서 크기를 조절해 주세요.");
      return;
    }
    updateSelected({ scale });
    setNotice(delta > 0 ? "재료를 크게 만들었습니다." : "재료를 작게 만들었습니다.");
  }

  function duplicateSelected() {
    if (!selectedObject || !selectedMaterial) return;
    const candidate = { x: Math.min(0.96, selectedObject.x + 0.045), y: Math.min(0.96, selectedObject.y + 0.045) };
    const position = isSampleSchoolPlacementAllowed(candidate, materialPlacementClearance(selectedMaterial, selectedObject.scale))
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

  function setMode(nextMode: "surface" | "objects") {
    setToolMode(nextMode);
    setSelectedId(null);
    setActiveMaterialId(null);
    setActiveSurfaceId(null);
    setNotice(nextMode === "surface"
      ? "바닥 재료를 고른 뒤 빈 땅에 손가락이나 마우스로 그리세요."
      : "실사 조경물을 고른 뒤 원하는 자리에 놓으세요.");
  }

  const hasDesign = objects.length > 0 || surfaceStrokes.length > 0;

  return (
    <main className="sample-school-studio">
      <aside className="sample-materials" aria-label="조경 도구">
        <div className="sample-tool-tabs" role="tablist" aria-label="조경 순서">
          <button type="button" role="tab" aria-selected={toolMode === "surface"} className={toolMode === "surface" ? "is-active" : ""} onClick={() => setMode("surface")}>1 바닥 만들기</button>
          <button type="button" role="tab" aria-selected={toolMode === "objects"} className={toolMode === "objects" ? "is-active" : ""} onClick={() => setMode("objects")}>2 조경물 놓기</button>
        </div>

        <header>
          <span>{toolMode === "surface" ? "실제 바닥 질감" : "실사·3D 조경재료"}</span>
          <strong>{toolMode === "surface" ? "바닥 재료" : "놓을 재료"}</strong>
          <p>{toolMode === "surface" ? "고른 뒤 빈 땅에 드래그하세요." : "선택하거나 끌어서 놓으세요."}</p>
        </header>
        <div className="sample-tool-picker">
          {toolMode === "objects" ? (
            <div className="sample-material-groups" role="tablist" aria-label="조경 재료 종류">
              {MATERIAL_GROUPS.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  role="tab"
                  aria-selected={materialGroup === group.id}
                  className={materialGroup === group.id ? "is-active" : ""}
                  onClick={() => {
                    setMaterialGroup(group.id);
                    setActiveMaterialId(null);
                    setSelectedId(null);
                    setNotice(`${group.label} 재료를 골라 학교의 빈 공간에 놓으세요.`);
                  }}
                >
                  {group.label}
                </button>
              ))}
            </div>
          ) : null}

          {toolMode === "surface" ? (
            <div className="sample-materials__grid sample-surfaces__grid">
              {SAMPLE_SCHOOL_SURFACE_MATERIALS.map((surface) => (
                <SurfaceButton
                  key={surface.id}
                  surface={surface}
                  active={activeSurfaceId === surface.id}
                  onClick={() => {
                    setActiveSurfaceId((current) => current === surface.id ? null : surface.id);
                    setActiveMaterialId(null);
                    setSelectedId(null);
                    setNotice(`${surface.name} 선택 · 빈 땅에 이어서 그리세요.`);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="sample-materials__grid">
              {visibleMaterials.map((material) => (
              <button
                key={material.id}
                type="button"
                className={activeMaterialId === material.id ? "is-active" : ""}
                aria-pressed={activeMaterialId === material.id}
                draggable
                onClick={() => {
                  setActiveMaterialId((current) => current === material.id ? null : material.id);
                  setActiveSurfaceId(null);
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
          )}
        </div>
      </aside>

      <section className="sample-school-workspace">
        <header className="sample-school-toolbar">
          <div className="sample-school-toolbar__title">
            <small>빈 학교에서 시작하는 3D 조경</small>
            <strong>{project.schoolName}</strong>
          </div>
          <div className="sample-camera-tabs" role="group" aria-label="학교 보는 시점">
            <button type="button" className={cameraView === "aerial" ? "is-active" : ""} onClick={() => setCameraView("aerial")}>항공샷</button>
            <button type="button" className={cameraView === "orbit" ? "is-active" : ""} onClick={() => setCameraView("orbit")}>입체</button>
            <button type="button" className={cameraView === "rear" ? "is-active" : ""} onClick={() => setCameraView("rear")}>뒤·옆</button>
            <button type="button" className={cameraView === "walk" ? "is-active" : ""} onClick={() => setCameraView("walk")}>학생 시점</button>
          </div>
          <div className="sample-school-toolbar__status">
            <span>{saveState === "saving" ? "저장 중" : saveState === "saved" ? "자동 저장됨" : "새 설계"}</span>
            <strong>{nickname} · 바닥 {surfaceStrokes.length} · 조경물 {objects.length}</strong>
          </div>
        </header>

        <div className={`sample-school-canvas ${activeMaterialId || activeSurfaceId ? "is-placing" : ""}`}>
          <SampleSchool3DScene
            schoolName={project.schoolName}
            objects={objects}
            surfaceStrokes={surfaceStrokes}
            selectedId={selectedId}
            activeMaterialId={activeMaterialId}
            activeSurfaceId={activeSurfaceId}
            cameraView={cameraView}
            onPaintSurface={paintSurface}
            onPlace={placeMaterial}
            onMove={moveObject}
            onSelect={(id) => {
              setSelectedId(id);
              if (id) {
                setActiveMaterialId(null);
                setActiveSurfaceId(null);
              }
            }}
          />
          <div className="sample-school-canvas__badge">
            <strong>{toolMode === "surface" ? "빈 땅부터 직접 만들기" : cameraView === "aerial" ? "학교 전체 배치" : cameraView === "walk" ? "학생 눈높이" : cameraView === "rear" ? "학교 뒤·옆 보기" : "360° 입체 보기"}</strong>
            <span>{toolMode === "surface" ? "바닥 재료를 골라 드래그" : cameraView === "aerial" ? "항공에서 위치 확인" : cameraView === "rear" ? "건물 뒤 공간도 꾸며보세요" : "드래그해 둘러보기"}</span>
          </div>
          <p className="sample-school-notice" role="status">{notice}</p>
        </div>

        <footer className="sample-school-footer">
          <div className="sample-selected-tools">
            {toolMode === "surface" ? (
              <>
                <p><strong>바닥 만들기</strong><span>흙·잔디·산책로를 고르고 빈 땅에 이어 그리세요.</span></p>
                <button type="button" disabled={surfaceStrokes.length === 0} onClick={() => { changeSurfaceStrokes((current) => current.slice(0, -1)); setNotice("마지막 바닥 작업을 되돌렸습니다."); }}>되돌리기</button>
                <button type="button" className="is-danger" disabled={surfaceStrokes.length === 0} onClick={() => { changeSurfaceStrokes(() => []); setNotice("바닥을 다시 빈 흙으로 만들었습니다."); }}>바닥 비우기</button>
                <button type="button" onClick={() => setMode("objects")}>조경물 놓기</button>
              </>
            ) : selectedObject && selectedMaterial ? (
              <>
                <div className="sample-selected-tools__name"><MaterialThumbnail material={selectedMaterial} /><span><small>선택됨</small><strong>{selectedMaterial.name}</strong></span></div>
                <button type="button" onClick={() => resizeSelected(-0.1)}>작게</button>
                <button type="button" onClick={() => resizeSelected(0.1)}>크게</button>
                <button type="button" onClick={() => { updateSelected({ rotation: (selectedObject.rotation + 45) % 360 }); setNotice("재료를 돌렸습니다."); }}>돌리기</button>
                <button type="button" onClick={duplicateSelected}>복사</button>
                <button type="button" className="is-danger" onClick={deleteSelected}>지우기</button>
              </>
            ) : (
              <p><strong>조경물 놓기</strong><span>실사 재료 선택 → 빈 공간 누르기 → 끌어서 이동</span></p>
            )}
          </div>
          <button
            className="sample-school-complete"
            type="button"
            disabled={!hasDesign}
            onClick={() => {
              persistDesign(objects, surfaceStrokes);
              onContinue();
            }}
          >
            완성 <span>{hasDesign ? "친구 작품 보기" : "바닥이나 조경물을 만들어주세요"}</span>
          </button>
        </footer>
      </section>
    </main>
  );
}

function MaterialThumbnail({ material }: { material: PlanLandscapeMaterial }) {
  return (
    <span className="sample-material-thumb" aria-hidden="true">
      {material.planAssetUrl ? <Image src={material.planAssetUrl} alt="" fill sizes="96px" loading="eager" unoptimized draggable={false} /> : null}
    </span>
  );
}

function SurfaceButton({
  surface,
  active,
  onClick,
}: {
  surface: SampleSchoolSurfaceMaterial;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={active ? "is-active" : ""} aria-pressed={active} onClick={onClick}>
      <span className="sample-material-thumb sample-surface-thumb" aria-hidden="true">
        <Image src={surface.textureUrl} alt="" fill sizes="96px" loading="eager" unoptimized draggable={false} />
      </span>
      <span>{surface.name}</span>
      <small>{surface.instruction}</small>
    </button>
  );
}
