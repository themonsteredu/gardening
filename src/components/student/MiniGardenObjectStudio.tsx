"use client";

import Image from "next/image";
import { useMemo, useState, type CSSProperties } from "react";
import { MiniMaterialTexture, MiniMaterialThumbnail } from "@/components/student/MiniMaterialThumbnail";
import type { MiniGardenKit, MiniGardenMaterial, MiniGardenObject, MiniMaterialType, SchoolProject, StudentMiniGardenDesign } from "@/domain/models";
import { createMiniGardenLayerSegments, getMiniGardenLayerTotalHeight, normalizeMiniGardenLayerOrder } from "@/lib/mini-garden-layers";
import {
  canPlaceMiniGardenMaterial,
  countMiniGardenMaterialUsage,
  duplicateMiniGardenObject,
  getNextMiniGardenObjectPosition,
  MINI_GARDEN_OBJECT_MAX_POSITION,
  MINI_GARDEN_OBJECT_MAX_SCALE,
  MINI_GARDEN_OBJECT_MIN_POSITION,
  MINI_GARDEN_OBJECT_MIN_SCALE,
  normalizeMiniGardenObject,
  updateMiniGardenObject,
} from "@/lib/mini-garden-objects";
import { createMiniPotSceneDimensions } from "@/lib/mini-pot-scene";
import {
  getStudentMiniGardenDesignStorageKey,
  MINI_GARDEN_KITS_STORAGE_KEY,
  parseStoredMiniGardenDesign,
  parseStoredMiniGardenKits,
} from "@/lib/project-store";
import { useBrowserStorageValue, writeBrowserStorage } from "@/lib/use-browser-storage";

const LAYER_COLOR_FALLBACK = "#c8b38b";
const OBJECT_TYPE_LABELS: Record<Exclude<MiniMaterialType, "layer">, string> = {
  scatter: "표면 재료",
  object: "돌·장식",
  plant: "식물",
  structure: "구조물",
};
const OBJECT_TYPE_COLORS: Record<Exclude<MiniMaterialType, "layer">, string> = {
  scatter: "#b4a47f",
  object: "#8c796b",
  plant: "#6f9443",
  structure: "#9a7555",
};
const OBJECT_TYPES = Object.keys(OBJECT_TYPE_LABELS) as Array<Exclude<MiniMaterialType, "layer">>;

export function MiniGardenObjectStudio({
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
  const kitsValue = useBrowserStorageValue("local", MINI_GARDEN_KITS_STORAGE_KEY);
  const kits = useMemo(() => parseStoredMiniGardenKits(kitsValue), [kitsValue]);
  const kit = kits.find((item) => item.id === project.miniGardenKitId) ?? null;

  if (!kit) {
    return (
      <main className="student-design-empty"><p className="eyebrow">STEP 13 · OBJECT PLACEMENT</p><h1>배치 재료를 준비하고 있습니다.</h1><p>선생님이 실제 수업 키트를 지정하면 식물과 장식을 배치할 수 있습니다.</p><button className="button button--primary" type="button" onClick={onBack}>색모래 설계로 돌아가기</button></main>
    );
  }

  return <MiniGardenObjectWorkspace key={`${kit.id}-${sessionId}`} kit={kit} nickname={nickname} sessionId={sessionId} onBack={onBack} onContinue={onContinue} />;
}

function MiniGardenObjectWorkspace({ kit, nickname, sessionId, onBack, onContinue }: { kit: MiniGardenKit; nickname: string; sessionId: string; onBack: () => void; onContinue: () => void }) {
  const storageKey = getStudentMiniGardenDesignStorageKey(sessionId);
  const storedValue = useBrowserStorageValue("local", storageKey);
  const storedDesign = useMemo(() => parseStoredMiniGardenDesign(storedValue), [storedValue]);
  const design = useMemo<StudentMiniGardenDesign>(() => {
    if (storedDesign?.miniGardenKitId === kit.id && storedDesign.studentSessionId === sessionId) return storedDesign;
    return { id: `mini-design-${sessionId}`, studentSessionId: sessionId, miniGardenKitId: kit.id, layers: [], objects: [], makingSteps: [], completedMakingStepIds: [], renderedImageUrl: null, finalPhotoUrl: null, finalPhotoStorageKey: null, finalPhotoName: null, finalPhotoMimeType: null, finalPhotoUploadedAt: null, finalComparisonChecklistIds: [], finalComparisonReflection: "", completedAt: null };
  }, [kit.id, sessionId, storedDesign]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(design.objects[0]?.id ?? null);
  const [notice, setNotice] = useState("재료를 배치하면 자동으로 저장됩니다.");
  const pot = kit.potPreset;
  const scene = createMiniPotSceneDimensions(pot);
  const placementMaterials = kit.materials.filter((material) => material.type !== "layer");
  const materialMap = useMemo(() => new Map(kit.materials.map((material) => [material.id, material])), [kit.materials]);
  const orderedLayers = normalizeMiniGardenLayerOrder(design.layers);
  const layerSegments = createMiniGardenLayerSegments(orderedLayers, pot.heightCm);
  const surfaceHeight = getMiniGardenLayerTotalHeight(orderedLayers);
  const resolvedSelectedObjectId = design.objects.some((object) => object.id === selectedObjectId)
    ? selectedObjectId
    : design.objects.at(-1)?.id ?? null;
  const selectedObject = design.objects.find((object) => object.id === resolvedSelectedObjectId) ?? null;
  const selectedMaterial = selectedObject ? materialMap.get(selectedObject.materialId) ?? null : null;

  function persistObjects(objects: MiniGardenObject[], message: string) {
    const nextObjects = objects.map((object) => ({ ...object, z: surfaceHeight }));
    writeBrowserStorage("local", storageKey, JSON.stringify({ ...design, objects: nextObjects }));
    setNotice(message);
  }

  function addObject(material: MiniGardenMaterial) {
    if (!canPlaceMiniGardenMaterial(design.objects, material.id, material.availableQuantity)) {
      setNotice(`${material.name}은 사용할 수 있는 수량을 모두 배치했습니다.`);
      return;
    }
    const id = `mini-object-${crypto.randomUUID()}`;
    const position = getNextMiniGardenObjectPosition(design.objects.length);
    const actualScale = material.actualSizeCm
      ? Math.max(MINI_GARDEN_OBJECT_MIN_SCALE, Math.min(MINI_GARDEN_OBJECT_MAX_SCALE, material.actualSizeCm / Math.max(4, pot.heightCm * 0.68)))
      : 1;
    const nextObject = normalizeMiniGardenObject({ id, materialId: material.id, ...position, z: surfaceHeight, scale: actualScale, rotationY: 0 });
    persistObjects([...design.objects, nextObject], `${material.name}을 화분 중앙에 배치했습니다.`);
    setSelectedObjectId(id);
  }

  function updateSelected(changes: Partial<Pick<MiniGardenObject, "x" | "y" | "scale" | "rotationY">>, message: string) {
    if (!selectedObject) return;
    setSelectedObjectId(selectedObject.id);
    persistObjects(updateMiniGardenObject(design.objects, selectedObject.id, changes), message);
  }

  function duplicateSelected() {
    if (!selectedObject || !selectedMaterial) return;
    if (!canPlaceMiniGardenMaterial(design.objects, selectedMaterial.id, selectedMaterial.availableQuantity)) {
      setNotice(`${selectedMaterial.name}은 수량 제한 때문에 더 복제할 수 없습니다.`);
      return;
    }
    const id = `mini-object-${crypto.randomUUID()}`;
    persistObjects(duplicateMiniGardenObject(design.objects, selectedObject, id), `${selectedMaterial.name}을 복제했습니다.`);
    setSelectedObjectId(id);
  }

  function deleteSelected() {
    if (!selectedObject || !selectedMaterial) return;
    const remaining = design.objects.filter((object) => object.id !== selectedObject.id);
    persistObjects(remaining, `${selectedMaterial.name}을 화분에서 삭제했습니다.`);
    setSelectedObjectId(remaining.at(-1)?.id ?? null);
  }

  function placeOnMap(event: React.PointerEvent<HTMLDivElement>) {
    if (!selectedObject || event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    updateSelected({ x, y }, "배치 위치를 저장했습니다.");
  }

  const potStyle = {
    "--student-pot-width": `${scene.widthPixels}px`,
    "--student-pot-depth": `${scene.depthPixels}px`,
    "--student-pot-height": `${scene.heightPixels}px`,
    transform: "translate(-50%, -50%) scale(0.88)",
  } as CSSProperties;

  return (
    <main className="student-object-page">
      <header className="student-pot-heading">
        <div><button type="button" onClick={onBack}>← 색모래 층 설계</button><p className="eyebrow">STEP 13 · OBJECT PLACEMENT</p><h1>식물과 장식을 배치하세요.</h1><p>실제로 제공되는 재료만 사용해 위치·크기·방향을 미리 설계합니다.</p></div>
        <div><span>{nickname} 설계자</span><strong>{kit.name}</strong><small>배치 재료 {placementMaterials.length}종 · 자동 저장</small></div>
      </header>

      <div className="student-object-layout">
        <aside className="student-object-materials">
          <div className="scene-panel-title"><span>01</span><div><strong>오늘의 실제 재료</strong><small>선생님이 준비한 수량만 사용</small></div></div>
          {placementMaterials.length === 0 ? <div className="student-object-empty"><strong>배치 재료가 없습니다.</strong><p>선생님이 식물·돌·장식 또는 구조물을 키트에 등록해야 합니다.</p></div> : null}
          {OBJECT_TYPES.map((type) => {
            const materials = placementMaterials.filter((material) => material.type === type);
            if (materials.length === 0) return null;
            return <section className="student-object-material-group" key={type}><div><strong>{OBJECT_TYPE_LABELS[type]}</strong><small>{materials.length}종</small></div>{materials.map((material) => { const used = countMiniGardenMaterialUsage(design.objects, material.id); const available = canPlaceMiniGardenMaterial(design.objects, material.id, material.availableQuantity); return <button type="button" key={material.id} disabled={!available} onClick={() => addObject(material)}><MiniMaterialThumbnail material={material} /><span><strong>{material.name}</strong><small>{material.availableQuantity === null ? `${used}개 배치 · 제한 없음` : `${used}/${material.availableQuantity}개 사용`}</small></span><b>{available ? "+ 배치" : "완료"}</b></button>; })}</section>;
          })}
        </aside>

        <section className="student-pot-viewport-panel student-object-viewport-panel">
          <div className="student-pot-toolbar"><div><span>REAL MATERIAL MODEL</span><strong>실사 정면</strong></div></div>
          <div className="student-pot-viewport student-object-viewport" aria-label="실제 재료 사진으로 꾸미는 긴 투명 꽃병">
            <div className="student-pot-grid-floor" />
            <div className={`student-pot-model student-pot-model--${pot.shape} student-pot-model--photo`} style={potStyle}>
              {layerSegments.map((segment, index) => { const layer = orderedLayers.find((item) => item.id === segment.id); const material = layer ? materialMap.get(layer.materialId) : null; if (!material) return null; const layerStyle = { "--sand-color": material.color ?? LAYER_COLOR_FALLBACK, "--sand-bottom": `calc(var(--student-pot-height) * ${segment.bottomRatio})`, "--sand-height": `calc(var(--student-pot-height) * ${segment.heightRatio})`, "--sand-top": `calc(var(--student-pot-height) * ${segment.topRatio})` } as CSSProperties; return <MiniMaterialTexture className={`student-pot-sand-layer ${index === layerSegments.length - 1 ? "is-top" : ""}`} style={layerStyle} material={material} key={segment.id} />; })}
              <Image className="student-pot-photo-asset student-pot-photo-asset--glass" src="/assets/photoreal/tall-clear-glass-vase-v2.png" alt="꽃과 장식이 배치된 실제 모습의 긴 투명 꽃병" fill sizes="420px" unoptimized />
              {design.objects.map((object) => { const material = materialMap.get(object.materialId); if (!material || material.type === "layer") return null; const type = material.type; const objectStyle = { left: `${object.x}%`, top: `${object.y}%`, "--mini-object-scale": object.scale, "--mini-object-rotation": `${object.rotationY}deg` } as CSSProperties; return <button type="button" aria-label={`${material.name} 배치물 선택`} className={`student-mini-object student-mini-object--${type} ${resolvedSelectedObjectId === object.id ? "is-selected" : ""}`} style={objectStyle} key={object.id} onPointerDown={(event) => event.stopPropagation()} onClick={() => setSelectedObjectId(object.id)}><MiniMaterialThumbnail material={material} /></button>; })}
            </div>
            <div className="student-object-scene-status"><strong>{design.objects.length}개 배치</strong><span>바닥층 {surfaceHeight}cm 위</span></div>
            <p>화분을 드래그해 배치를 여러 방향에서 확인하세요.</p>
          </div>
        </section>

        <aside className="student-object-inspector">
          <div className="scene-panel-title"><span>02</span><div><strong>선택한 재료 속성</strong><small>위치 · 크기 · 회전 · 복제</small></div></div>
          {selectedObject && selectedMaterial && selectedMaterial.type !== "layer" ? <>
            <div className="student-object-selected"><MiniMaterialThumbnail material={selectedMaterial} /><div><small>{OBJECT_TYPE_LABELS[selectedMaterial.type]}</small><strong>{selectedMaterial.name}</strong></div></div>
            <div className="student-object-position-map" aria-label="화분 위 배치 위치" onPointerDown={placeOnMap}>{design.objects.map((object) => { const material = materialMap.get(object.materialId); return <button type="button" aria-label={`${material?.name ?? "재료"} 위치`} className={resolvedSelectedObjectId === object.id ? "is-selected" : ""} style={{ left: `${object.x}%`, top: `${object.y}%`, background: material?.color ?? (material && material.type !== "layer" ? OBJECT_TYPE_COLORS[material.type] : "#87958b") }} key={object.id} onPointerDown={(event) => { event.stopPropagation(); setSelectedObjectId(object.id); }} />; })}<span>빈 곳을 눌러 선택 재료 이동</span></div>
            <div className="student-object-position-fields"><label><span>가로 위치 <strong>{Math.round(selectedObject.x)}%</strong></span><input type="range" min={MINI_GARDEN_OBJECT_MIN_POSITION} max={MINI_GARDEN_OBJECT_MAX_POSITION} value={selectedObject.x} onChange={(event) => updateSelected({ x: Number(event.target.value) }, "가로 위치를 저장했습니다.")} /></label><label><span>세로 위치 <strong>{Math.round(selectedObject.y)}%</strong></span><input type="range" min={MINI_GARDEN_OBJECT_MIN_POSITION} max={MINI_GARDEN_OBJECT_MAX_POSITION} value={selectedObject.y} onChange={(event) => updateSelected({ y: Number(event.target.value) }, "세로 위치를 저장했습니다.")} /></label></div>
            <label className="student-object-scale"><span>크기 <strong>{Math.round(selectedObject.scale * 100)}%</strong></span><input type="range" min={MINI_GARDEN_OBJECT_MIN_SCALE} max={MINI_GARDEN_OBJECT_MAX_SCALE} step="0.1" value={selectedObject.scale} onChange={(event) => updateSelected({ scale: Number(event.target.value) }, "재료 크기를 저장했습니다.")} /></label>
            <label className="student-object-rotation"><span>회전 <strong>{selectedObject.rotationY}°</strong></span><input type="range" min="0" max="345" step="15" value={selectedObject.rotationY} onChange={(event) => updateSelected({ rotationY: Number(event.target.value) }, "재료 방향을 저장했습니다.")} /><div><button type="button" onClick={() => updateSelected({ rotationY: selectedObject.rotationY - 15 }, "재료를 왼쪽으로 회전했습니다.")}>↺ −15°</button><button type="button" onClick={() => updateSelected({ rotationY: selectedObject.rotationY + 15 }, "재료를 오른쪽으로 회전했습니다.")}>↻ +15°</button></div></label>
            <div className="student-object-actions"><button type="button" disabled={!canPlaceMiniGardenMaterial(design.objects, selectedMaterial.id, selectedMaterial.availableQuantity)} onClick={duplicateSelected}>복제</button><button type="button" onClick={deleteSelected}>삭제</button></div>
          </> : <div className="student-object-empty student-object-empty--inspector"><strong>편집할 재료를 선택하세요.</strong><p>왼쪽 실제 재료를 배치하거나 화분 위 물체를 선택하면 속성이 표시됩니다.</p></div>}
          <dl className="student-object-totals"><div><dt>배치한 재료</dt><dd>{design.objects.length}개</dd></div><div><dt>사용 재료 종류</dt><dd>{new Set(design.objects.map((object) => object.materialId)).size}종</dd></div><div><dt>층 높이</dt><dd>{surfaceHeight}cm</dd></div></dl>
          <p className="student-object-notice" role="status">{notice}</p>
          <button className="button button--primary button--wide" type="button" onClick={onContinue}>다음: 제작 순서 확인</button>
        </aside>
      </div>
    </main>
  );
}
