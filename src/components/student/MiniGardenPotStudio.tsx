"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { MiniPotPhoto } from "@/components/student/MiniPotPhoto";
import { POT_SHAPE_LABELS, estimatePotVolumeLiters } from "@/data/pot-presets";
import type { MiniGardenKit, SchoolProject } from "@/domain/models";
import { createMiniPotSceneDimensions } from "@/lib/mini-pot-scene";
import { MINI_GARDEN_KITS_STORAGE_KEY, parseStoredMiniGardenKits } from "@/lib/project-store";
import { useBrowserStorageValue } from "@/lib/use-browser-storage";

const INITIAL_POT_ZOOM = 0.92;

export function MiniGardenPotStudio({
  project,
  nickname,
  onBack,
  onContinue,
}: {
  project: SchoolProject;
  nickname: string;
  onBack: () => void;
  onContinue: () => void;
}) {
  const kitsValue = useBrowserStorageValue("local", MINI_GARDEN_KITS_STORAGE_KEY);
  const kits = useMemo(() => parseStoredMiniGardenKits(kitsValue), [kitsValue]);
  const kit = kits.find((item) => item.id === project.miniGardenKitId) ?? null;

  if (!kit) {
    return (
      <main className="student-design-empty"><p className="eyebrow">STEP 11 · REAL POT</p><h1>수업용 화분을 준비하고 있습니다.</h1><p>선생님이 오늘 사용할 투명화분 키트를 지정하면 실물 모습을 확인할 수 있습니다.</p><button className="button button--primary" type="button" onClick={onBack}>작품 갤러리로 돌아가기</button></main>
    );
  }

  return <MiniGardenPotWorkspace key={kit.id} kit={kit} nickname={nickname} onBack={onBack} onContinue={onContinue} />;
}

function MiniGardenPotWorkspace({ kit, nickname, onBack, onContinue }: { kit: MiniGardenKit; nickname: string; onBack: () => void; onContinue: () => void }) {
  const [zoom, setZoom] = useState(INITIAL_POT_ZOOM);
  const pot = kit.potPreset;
  const scene = createMiniPotSceneDimensions(pot);
  const volume = estimatePotVolumeLiters(pot);

  const potStyle = {
    "--student-pot-width": `${scene.widthPixels}px`,
    "--student-pot-depth": `${scene.depthPixels}px`,
    "--student-pot-height": `${scene.heightPixels}px`,
    transform: `translate(-50%, -50%) scale(${zoom})`,
  } as CSSProperties;

  return (
    <main className="student-pot-page">
      <header className="student-pot-heading">
        <div><button type="button" onClick={onBack}>← 우리 반 갤러리</button><p className="eyebrow">STEP 11 · REAL POT</p><h1>오늘 사용할 실제 화분을 확인하세요.</h1><p>긴 투명 꽃병의 크기와 재료가 들어갈 공간을 확인한 뒤 꽃꾸미기를 시작합니다.</p></div>
        <div><span>{nickname} 설계자</span><strong>{kit.name}</strong><small>실제 재료 {kit.materials.length}종 준비</small></div>
      </header>

      <div className="student-pot-layout">
        <aside className="student-pot-summary">
          <div className="scene-panel-title"><span>01</span><div><strong>실물 화분 정보</strong><small>선생님이 등록한 수업 키트</small></div></div>
          <div className={`student-pot-shape-symbol student-pot-shape-symbol--${pot.shape}`} aria-hidden="true" />
          <strong className="student-pot-shape-name">{POT_SHAPE_LABELS[pot.shape]}</strong>
          <dl><div><dt>가로</dt><dd>{pot.widthCm}cm</dd></div><div><dt>세로</dt><dd>{pot.depthCm}cm</dd></div><div><dt>높이</dt><dd>{pot.heightCm}cm</dd></div><div><dt>예상 용량</dt><dd>약 {volume}L</dd></div></dl>
          <div className="student-pot-purpose"><strong>투명화분을 쓰는 이유</strong><p>옆면을 통해 모래와 자갈이 쌓이는 순서를 실제 제작 전에도 확인할 수 있습니다.</p></div>
        </aside>

        <section className="student-pot-viewport-panel">
          <div className="student-pot-toolbar"><div><span>REAL PHOTO</span><strong>실사 정면</strong></div></div>
          <div className="student-pot-viewport" aria-label="긴 투명 꽃병 실사 미리보기">
            <div className="student-pot-grid-floor" />
            <div className={`student-pot-model student-pot-model--${pot.shape} student-pot-model--photo`} style={potStyle}>
              <MiniPotPhoto className="student-pot-photo-asset" pot={pot} sizes="420px" priority />
              <span className="student-pot-fill-guide"><i />꽃과 재료가 들어갈 공간</span>
            </div>
            <span className="student-pot-width-label">가로 {pot.widthCm}cm</span><span className="student-pot-depth-label">세로 {pot.depthCm}cm</span><span className="student-pot-height-label">높이 {pot.heightCm}cm</span>
            <p>실제 꽃병의 높이와 재료가 들어갈 공간을 확인하세요.</p>
          </div>
        </section>

        <aside className="student-pot-controls">
          <div className="scene-panel-title"><span>02</span><div><strong>크기 확인</strong><small>실제 비율은 변경되지 않음</small></div></div>
          <label className="student-pot-zoom"><span>확대·축소 <strong>{Math.round(zoom * 100)}%</strong></span><input type="range" min="0.65" max="1.25" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
          <div className="student-pot-zoom-buttons"><button type="button" aria-label="화분 축소" onClick={() => setZoom((current) => Math.max(0.65, current - 0.1))}>−</button><button type="button" aria-label="화분 확대" onClick={() => setZoom((current) => Math.min(1.25, current + 0.1))}>+</button></div>
          <button className="student-pot-reset" type="button" onClick={() => setZoom(INITIAL_POT_ZOOM)}>처음 크기로</button>
          <div className="student-pot-transparent-key"><strong>현재 모델 상태</strong><div><i />투명 옆면</div><div><i />재료 배치 전 빈 화분</div><p>다음 단계부터 실제 색모래와 자갈층을 안쪽에 쌓습니다.</p></div>
          <button className="button button--primary button--wide" type="button" onClick={onContinue}>다음: 색모래 층 쌓기</button>
        </aside>
      </div>
    </main>
  );
}
