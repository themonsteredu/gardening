"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import { POT_SHAPE_LABELS, estimatePotVolumeLiters } from "@/data/pot-presets";
import type { MiniGardenKit, SchoolProject } from "@/domain/models";
import { clampMiniPotCamera, createMiniPotSceneDimensions } from "@/lib/mini-pot-scene";
import { MINI_GARDEN_KITS_STORAGE_KEY, parseStoredMiniGardenKits } from "@/lib/project-store";
import { useBrowserStorageValue } from "@/lib/use-browser-storage";

interface PotCamera {
  tilt: number;
  rotation: number;
  zoom: number;
  label: string;
}

const INITIAL_POT_CAMERA: PotCamera = { tilt: 63, rotation: -28, zoom: 0.92, label: "입체 보기" };

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
      <main className="student-design-empty"><p className="eyebrow">STEP 11 · TRANSPARENT POT 3D</p><h1>수업용 화분을 준비하고 있습니다.</h1><p>선생님이 오늘 사용할 투명화분 키트를 지정하면 3D 모델을 확인할 수 있습니다.</p><button className="button button--primary" type="button" onClick={onBack}>작품 갤러리로 돌아가기</button></main>
    );
  }

  return <MiniGardenPotWorkspace key={kit.id} kit={kit} nickname={nickname} onBack={onBack} onContinue={onContinue} />;
}

function MiniGardenPotWorkspace({ kit, nickname, onBack, onContinue }: { kit: MiniGardenKit; nickname: string; onBack: () => void; onContinue: () => void }) {
  const [camera, setCamera] = useState<PotCamera>(INITIAL_POT_CAMERA);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; tilt: number; rotation: number } | null>(null);
  const pot = kit.potPreset;
  const scene = createMiniPotSceneDimensions(pot);
  const volume = estimatePotVolumeLiters(pot);

  function setView(next: PotCamera) {
    setCamera(next);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const next = clampMiniPotCamera(drag.tilt - (event.clientY - drag.y) * 0.25, camera.zoom);
    setCamera((current) => ({ ...current, rotation: drag.rotation + (event.clientX - drag.x) * 0.42, tilt: next.tilt, label: "직접 회전" }));
  }

  const potStyle = {
    "--student-pot-width": `${scene.widthPixels}px`,
    "--student-pot-depth": `${scene.depthPixels}px`,
    "--student-pot-height": `${scene.heightPixels}px`,
    transform: `rotateX(${camera.tilt}deg) rotateZ(${camera.rotation}deg) scale(${camera.zoom})`,
  } as CSSProperties;

  return (
    <main className="student-pot-page">
      <header className="student-pot-heading">
        <div><button type="button" onClick={onBack}>← 우리 반 갤러리</button><p className="eyebrow">STEP 11 · TRANSPARENT POT 3D</p><h1>오늘 사용할 화분을 입체로 확인하세요.</h1><p>실제 화분과 같은 비율을 여러 방향에서 살펴본 뒤 미니조경 설계를 시작합니다.</p></div>
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
          <div className="student-pot-toolbar"><div><span>VIEW</span><strong>{camera.label}</strong></div><div><button type="button" className={camera.label === "정면 보기" ? "is-active" : ""} onClick={() => setView({ tilt: 78, rotation: 0, zoom: 0.92, label: "정면 보기" })}>정면</button><button type="button" className={camera.label === "측면 보기" ? "is-active" : ""} onClick={() => setView({ tilt: 78, rotation: 90, zoom: 0.92, label: "측면 보기" })}>측면</button><button type="button" className={camera.label === "위에서 보기" ? "is-active" : ""} onClick={() => setView({ tilt: 8, rotation: 0, zoom: 0.92, label: "위에서 보기" })}>위에서</button><button type="button" className={camera.label === "입체 보기" ? "is-active" : ""} onClick={() => setView(INITIAL_POT_CAMERA)}>입체</button></div></div>
          <div className="student-pot-viewport" aria-label="회전 가능한 투명화분 3D 미리보기" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, tilt: camera.tilt, rotation: camera.rotation }; }} onPointerMove={handlePointerMove} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}>
            <div className="student-pot-grid-floor" />
            <div className={`student-pot-model student-pot-model--${pot.shape}`} style={potStyle}>
              <span className="student-pot-rim student-pot-rim--back" />
              <span className="student-pot-wall student-pot-wall--back" />
              <span className="student-pot-wall student-pot-wall--left" />
              <span className="student-pot-wall student-pot-wall--right" />
              <span className="student-pot-bottom" />
              <span className="student-pot-wall student-pot-wall--front" />
              <span className="student-pot-rim student-pot-rim--front" />
              <span className="student-pot-fill-guide"><i />재료 배치 영역</span>
            </div>
            <span className="student-pot-width-label">가로 {pot.widthCm}cm</span><span className="student-pot-depth-label">세로 {pot.depthCm}cm</span><span className="student-pot-height-label">높이 {pot.heightCm}cm</span>
            <p>화분을 드래그해 360° 돌려보세요.</p>
          </div>
        </section>

        <aside className="student-pot-controls">
          <div className="scene-panel-title"><span>02</span><div><strong>3D 시점 조작</strong><small>화분 비율은 변경되지 않음</small></div></div>
          <div className="student-pot-control-group"><span>수평 회전 <strong>{Math.round(camera.rotation)}°</strong></span><div><button type="button" onClick={() => setCamera((current) => ({ ...current, rotation: current.rotation - 15, label: "직접 회전" }))}>−15°</button><button type="button" onClick={() => setCamera((current) => ({ ...current, rotation: current.rotation + 15, label: "직접 회전" }))}>+15°</button></div></div>
          <label className="student-pot-zoom"><span>확대·축소 <strong>{Math.round(camera.zoom * 100)}%</strong></span><input type="range" min="0.65" max="1.35" step="0.05" value={camera.zoom} onChange={(event) => setCamera((current) => ({ ...current, zoom: Number(event.target.value), label: "사용자 시점" }))} /></label>
          <div className="student-pot-zoom-buttons"><button type="button" aria-label="화분 축소" onClick={() => setCamera((current) => ({ ...current, zoom: clampMiniPotCamera(current.tilt, current.zoom - 0.1).zoom, label: "사용자 시점" }))}>−</button><button type="button" aria-label="화분 확대" onClick={() => setCamera((current) => ({ ...current, zoom: clampMiniPotCamera(current.tilt, current.zoom + 0.1).zoom, label: "사용자 시점" }))}>+</button></div>
          <button className="student-pot-reset" type="button" onClick={() => setView(INITIAL_POT_CAMERA)}>처음 시점으로</button>
          <div className="student-pot-transparent-key"><strong>현재 모델 상태</strong><div><i />투명 옆면</div><div><i />재료 배치 전 빈 화분</div><p>다음 단계부터 실제 색모래와 자갈층을 안쪽에 쌓습니다.</p></div>
          <button className="button button--primary button--wide" type="button" onClick={onContinue}>다음: 색모래 층 쌓기</button>
        </aside>
      </div>
    </main>
  );
}
