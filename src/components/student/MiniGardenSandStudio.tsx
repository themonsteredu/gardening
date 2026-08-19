"use client";

import Image from "next/image";
import { useMemo, useState, type CSSProperties } from "react";
import { MiniMaterialTexture, MiniMaterialThumbnail } from "@/components/student/MiniMaterialThumbnail";
import type { MiniGardenKit, MiniGardenLayer, MiniGardenMaterial, SchoolProject, StudentMiniGardenDesign } from "@/domain/models";
import {
  canAddMiniGardenLayer,
  createMiniGardenLayerSegments,
  getMiniGardenLayerMaxHeight,
  getMiniGardenLayerTotalHeight,
  MINI_GARDEN_LAYER_STEP_CM,
  moveMiniGardenLayer,
  normalizeMiniGardenLayerOrder,
  sortMiniGardenLayers,
  updateMiniGardenLayerHeight,
} from "@/lib/mini-garden-layers";
import { createMiniPotSceneDimensions } from "@/lib/mini-pot-scene";
import {
  getStudentMiniGardenDesignStorageKey,
  MINI_GARDEN_KITS_STORAGE_KEY,
  parseStoredMiniGardenDesign,
  parseStoredMiniGardenKits,
} from "@/lib/project-store";
import { useBrowserStorageValue, writeBrowserStorage } from "@/lib/use-browser-storage";

const DEFAULT_LAYER_COLOR = "#c8b38b";

export function MiniGardenSandStudio({
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
      <main className="student-design-empty"><p className="eyebrow">STEP 12 · SAND LAYERS</p><h1>색모래 키트를 준비하고 있습니다.</h1><p>선생님이 오늘 사용할 키트를 지정하면 층 쌓기를 시작할 수 있습니다.</p><button className="button button--primary" type="button" onClick={onBack}>화분 확인으로 돌아가기</button></main>
    );
  }

  return <MiniGardenSandWorkspace key={`${kit.id}-${sessionId}`} kit={kit} nickname={nickname} sessionId={sessionId} onBack={onBack} onContinue={onContinue} />;
}

function MiniGardenSandWorkspace({ kit, nickname, sessionId, onBack, onContinue }: { kit: MiniGardenKit; nickname: string; sessionId: string; onBack: () => void; onContinue: () => void }) {
  const storageKey = getStudentMiniGardenDesignStorageKey(sessionId);
  const storedValue = useBrowserStorageValue("local", storageKey);
  const storedDesign = useMemo(() => parseStoredMiniGardenDesign(storedValue), [storedValue]);
  const design = useMemo<StudentMiniGardenDesign>(() => {
    if (storedDesign?.miniGardenKitId === kit.id && storedDesign.studentSessionId === sessionId) return storedDesign;
    return {
      id: `mini-design-${sessionId}`,
      studentSessionId: sessionId,
      miniGardenKitId: kit.id,
      layers: [],
      objects: [],
      makingSteps: [],
      completedMakingStepIds: [],
      renderedImageUrl: null,
      finalPhotoUrl: null,
      finalPhotoStorageKey: null,
      finalPhotoName: null,
      finalPhotoMimeType: null,
      finalPhotoUploadedAt: null,
      finalComparisonChecklistIds: [],
      finalComparisonReflection: "",
      completedAt: null,
    };
  }, [kit.id, sessionId, storedDesign]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(design.layers[0]?.id ?? null);
  const [notice, setNotice] = useState("층을 추가하면 자동으로 저장됩니다.");
  const pot = kit.potPreset;
  const scene = createMiniPotSceneDimensions(pot);
  const layerMaterials = kit.materials.filter((material) => material.type === "layer");
  const materialMap = useMemo(() => new Map(kit.materials.map((material) => [material.id, material])), [kit.materials]);
  const orderedLayers = normalizeMiniGardenLayerOrder(design.layers);
  const displayLayers = [...orderedLayers].reverse();
  const resolvedSelectedLayerId = orderedLayers.some((layer) => layer.id === selectedLayerId)
    ? selectedLayerId
    : orderedLayers.at(-1)?.id ?? null;
  const selectedLayer = orderedLayers.find((layer) => layer.id === resolvedSelectedLayerId) ?? null;
  const selectedMaterial = selectedLayer ? materialMap.get(selectedLayer.materialId) ?? null : null;
  const totalHeight = getMiniGardenLayerTotalHeight(orderedLayers);
  const remainingHeight = Math.max(0, pot.heightCm - totalHeight);
  const segments = createMiniGardenLayerSegments(orderedLayers, pot.heightCm);

  function persistLayers(layers: MiniGardenLayer[], message: string) {
    const nextDesign = { ...design, layers: normalizeMiniGardenLayerOrder(layers) };
    writeBrowserStorage("local", storageKey, JSON.stringify(nextDesign));
    setNotice(message);
  }

  function addLayer(material: MiniGardenMaterial) {
    const usedCount = design.layers.filter((layer) => layer.materialId === material.id).length;
    if (material.availableQuantity !== null && usedCount >= material.availableQuantity) {
      setNotice(`${material.name}은 사용할 수 있는 수량을 모두 배치했습니다.`);
      return;
    }
    if (!canAddMiniGardenLayer(pot.heightCm, design.layers)) {
      setNotice("화분 높이를 모두 사용했습니다. 기존 층 높이를 줄여 주세요.");
      return;
    }
    const layerId = `mini-layer-${crypto.randomUUID()}`;
    const heightCm = Math.min(2, remainingHeight);
    const nextLayer = { id: layerId, materialId: material.id, heightCm, order: design.layers.length };
    persistLayers([...design.layers, nextLayer], `${material.name} 층을 맨 위에 추가했습니다.`);
    setSelectedLayerId(layerId);
  }

  function changeHeight(nextHeight: number) {
    if (!selectedLayer || !selectedMaterial) return;
    setSelectedLayerId(selectedLayer.id);
    const nextLayers = updateMiniGardenLayerHeight(design.layers, selectedLayer.id, nextHeight, pot.heightCm);
    persistLayers(nextLayers, `${selectedMaterial.name} 높이를 저장했습니다.`);
  }

  function moveLayer(direction: "up" | "down") {
    if (!selectedLayer || !selectedMaterial) return;
    setSelectedLayerId(selectedLayer.id);
    const nextLayers = moveMiniGardenLayer(design.layers, selectedLayer.id, direction);
    persistLayers(nextLayers, `${selectedMaterial.name} 층 순서를 변경했습니다.`);
  }

  function deleteLayer() {
    if (!selectedLayer || !selectedMaterial) return;
    const remaining = design.layers.filter((layer) => layer.id !== selectedLayer.id);
    persistLayers(remaining, `${selectedMaterial.name} 층을 삭제했습니다.`);
    setSelectedLayerId(sortMiniGardenLayers(remaining).at(-1)?.id ?? null);
  }

  const potStyle = {
    "--student-pot-width": `${scene.widthPixels}px`,
    "--student-pot-depth": `${scene.depthPixels}px`,
    "--student-pot-height": `${scene.heightPixels}px`,
    transform: "translate(-50%, -50%) scale(0.9)",
  } as CSSProperties;

  return (
    <main className="student-sand-page">
      <header className="student-pot-heading">
        <div><button type="button" onClick={onBack}>← 투명화분 확인</button><p className="eyebrow">STEP 12 · SAND LAYERS</p><h1>색모래 층을 설계하세요.</h1><p>실제로 제공되는 재료를 아래에서 위 순서로 쌓고, 투명 옆면에서 높이를 확인합니다.</p></div>
        <div><span>{nickname} 설계자</span><strong>{kit.name}</strong><small>층 재료 {layerMaterials.length}종 · 자동 저장</small></div>
      </header>

      <div className="student-sand-layout">
        <aside className="student-sand-materials">
          <div className="scene-panel-title"><span>01</span><div><strong>오늘의 층 재료</strong><small>선생님이 준비한 실제 재료</small></div></div>
          <div className="student-sand-material-list">
            {layerMaterials.length === 0 ? <div className="student-sand-empty"><strong>층 재료가 없습니다.</strong><p>선생님이 키트에 색모래나 흙을 `층으로 쌓기` 유형으로 등록해야 합니다.</p></div> : null}
            {layerMaterials.map((material) => {
              const usedCount = design.layers.filter((layer) => layer.materialId === material.id).length;
              const unavailable = material.availableQuantity !== null && usedCount >= material.availableQuantity;
              return <button key={material.id} type="button" disabled={unavailable} onClick={() => addLayer(material)}><MiniMaterialThumbnail material={material} /><span><strong>{material.name}</strong><small>{material.availableQuantity === null ? `현재 ${usedCount}층 · 제한 없음` : `${usedCount}/${material.availableQuantity}층 사용`}</small></span><b>{unavailable ? "완료" : "+ 추가"}</b></button>;
            })}
          </div>
          <div className="student-sand-stack-list"><div><strong>쌓은 순서</strong><small>위에서부터 표시</small></div>{displayLayers.length === 0 ? <p>재료를 선택해 첫 층을 추가하세요.</p> : displayLayers.map((layer) => { const material = materialMap.get(layer.materialId); return <button className={resolvedSelectedLayerId === layer.id ? "is-selected" : ""} type="button" key={layer.id} onClick={() => setSelectedLayerId(layer.id)}>{material ? <MiniMaterialThumbnail material={material} /> : null}<span><strong>{material?.name ?? "삭제된 재료"}</strong><small>{layer.order === 0 ? "바닥층" : `${layer.order + 1}번째 층`} · {layer.heightCm}cm</small></span></button>; })}</div>
        </aside>

        <section className="student-pot-viewport-panel student-sand-viewport-panel">
          <div className="student-pot-toolbar"><div><span>REAL MATERIAL SIDE VIEW</span><strong>실사 정면</strong></div></div>
          <div className="student-pot-viewport student-sand-viewport" aria-label="실제 재료 사진으로 쌓은 색모래 층과 긴 투명 꽃병">
            <div className="student-pot-grid-floor" />
            <div className={`student-pot-model student-pot-model--${pot.shape} student-pot-model--photo`} style={potStyle}>
              {segments.map((segment, index) => {
                const layer = orderedLayers.find((item) => item.id === segment.id);
                const material = layer ? materialMap.get(layer.materialId) : null;
                if (!material) return null;
                const layerStyle = { "--sand-bottom": `calc(var(--student-pot-height) * ${segment.bottomRatio})`, "--sand-height": `calc(var(--student-pot-height) * ${segment.heightRatio})`, "--sand-top": `calc(var(--student-pot-height) * ${segment.topRatio})`, "--sand-color": material.color ?? DEFAULT_LAYER_COLOR } as CSSProperties;
                return <MiniMaterialTexture className={`student-pot-sand-layer ${resolvedSelectedLayerId === segment.id ? "is-selected" : ""} ${index === segments.length - 1 ? "is-top" : ""}`} style={layerStyle} material={material} key={segment.id} />;
              })}
              <Image className="student-pot-photo-asset student-pot-photo-asset--glass" src="/assets/photoreal/tall-clear-glass-vase-v2.png" alt="모래층이 보이는 실제 모습의 긴 투명 꽃병" fill sizes="420px" unoptimized />
            </div>
            <div className="student-sand-capacity"><span style={{ width: `${Math.min(100, (totalHeight / pot.heightCm) * 100)}%` }} /><strong>{totalHeight} / {pot.heightCm}cm</strong></div>
            <p>투명 옆면에서 층 높이와 순서를 확인하세요.</p>
          </div>
        </section>

        <aside className="student-sand-inspector">
          <div className="scene-panel-title"><span>02</span><div><strong>선택한 층 속성</strong><small>높이 · 순서 · 삭제</small></div></div>
          {selectedLayer && selectedMaterial ? <>
            <div className="student-sand-selected"><MiniMaterialThumbnail material={selectedMaterial} /><div><small>선택한 실제 재료</small><strong>{selectedMaterial.name}</strong></div></div>
            <label className="student-sand-height"><span>층 높이 <strong>{selectedLayer.heightCm}cm</strong></span><input type="range" min={MINI_GARDEN_LAYER_STEP_CM} max={getMiniGardenLayerMaxHeight(pot.heightCm, design.layers, selectedLayer.id)} step={MINI_GARDEN_LAYER_STEP_CM} value={selectedLayer.heightCm} onChange={(event) => changeHeight(Number(event.target.value))} /><div><button type="button" disabled={selectedLayer.heightCm <= MINI_GARDEN_LAYER_STEP_CM} onClick={() => changeHeight(selectedLayer.heightCm - MINI_GARDEN_LAYER_STEP_CM)}>− 0.5cm</button><button type="button" disabled={selectedLayer.heightCm >= getMiniGardenLayerMaxHeight(pot.heightCm, design.layers, selectedLayer.id)} onClick={() => changeHeight(selectedLayer.heightCm + MINI_GARDEN_LAYER_STEP_CM)}>+ 0.5cm</button></div></label>
            <div className="student-sand-order"><span>층 순서 <strong>{selectedLayer.order + 1}번째</strong></span><div><button type="button" disabled={selectedLayer.order === design.layers.length - 1} onClick={() => moveLayer("up")}>↑ 한 층 위</button><button type="button" disabled={selectedLayer.order === 0} onClick={() => moveLayer("down")}>↓ 한 층 아래</button></div></div>
            <button className="student-sand-delete" type="button" onClick={deleteLayer}>선택한 층 삭제</button>
          </> : <div className="student-sand-empty student-sand-empty--inspector"><strong>편집할 층을 선택하세요.</strong><p>왼쪽에서 재료를 추가하거나 쌓은 층을 선택하면 속성이 표시됩니다.</p></div>}
          <dl className="student-sand-totals"><div><dt>쌓은 높이</dt><dd>{totalHeight}cm</dd></div><div><dt>남은 높이</dt><dd>{remainingHeight}cm</dd></div><div><dt>전체 층</dt><dd>{design.layers.length}개</dd></div></dl>
          <p className="student-sand-notice" role="status">{notice}</p>
          <button className="button button--primary button--wide" type="button" disabled={design.layers.length === 0} onClick={onContinue}>다음: 식물·돌·장식 배치</button>
        </aside>
      </div>
    </main>
  );
}
