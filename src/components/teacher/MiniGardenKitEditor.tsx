"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { POT_PRESETS, POT_SHAPE_LABELS, estimatePotVolumeLiters, isValidPotDimension } from "@/data/pot-presets";
import type { MiniGardenKit, PotPreset, PotShape, SchoolProject } from "@/domain/models";
import {
  MINI_GARDEN_KITS_STORAGE_KEY,
  parseStoredMiniGardenKits,
  parseStoredProject,
  PROJECT_STORAGE_KEY,
  upsertMiniGardenKit,
} from "@/lib/project-store";
import { useBrowserStorageValue, writeBrowserStorage } from "@/lib/use-browser-storage";

const NEW_KIT_SELECTION = "__new-kit__";

export function MiniGardenKitEditor() {
  const projectValue = useBrowserStorageValue("local", PROJECT_STORAGE_KEY);
  const kitsValue = useBrowserStorageValue("local", MINI_GARDEN_KITS_STORAGE_KEY);
  const project = useMemo(() => parseStoredProject(projectValue), [projectValue]);
  const kits = useMemo(() => parseStoredMiniGardenKits(kitsValue), [kitsValue]);
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const effectiveKitId = selectedKitId ?? project.miniGardenKitId;
  const activeKit = effectiveKitId === NEW_KIT_SELECTION
    ? null
    : kits.find((kit) => kit.id === effectiveKitId) ?? null;

  function saveKit(kit: MiniGardenKit) {
    const nextKits = upsertMiniGardenKit(kits, kit);
    const nextProject: SchoolProject = { ...project, miniGardenKitId: kit.id };
    writeBrowserStorage("local", MINI_GARDEN_KITS_STORAGE_KEY, JSON.stringify(nextKits));
    writeBrowserStorage("local", PROJECT_STORAGE_KEY, JSON.stringify(nextProject));
    setSelectedKitId(kit.id);
    setNotice(`${kit.name}을 현재 수업 키트로 저장했습니다.`);
  }

  return (
    <div className="kit-editor-shell">
      <AppHeader compact current="teacher" />
      <main className="kit-editor-page">
        <header className="kit-editor-heading">
          <div>
            <Link href="/teacher">← 수업 설계실</Link>
            <p className="eyebrow">STEP 09 · MINI GARDEN KIT</p>
            <h1>오늘의 미니조경 키트</h1>
            <p>실제 수업에서 제공할 투명화분의 형태와 크기를 먼저 등록합니다.</p>
          </div>
          <div className="kit-project-meta"><span>현재 수업</span><strong>{project.title}</strong><small>{project.schoolName} · {project.className}</small></div>
        </header>

        <div className="kit-editor-layout">
          <aside className="kit-library-panel">
            <div className="kit-panel-title"><span>01</span><div><strong>저장된 키트</strong><small>다른 수업에서도 다시 사용</small></div></div>
            <button className="kit-new-button" type="button" onClick={() => { setSelectedKitId(NEW_KIT_SELECTION); setNotice(""); }}>+ 새 키트 만들기</button>
            <div className="kit-saved-list">
              {kits.length === 0 ? <p>저장된 키트가 없습니다.<br />첫 키트를 만들어 주세요.</p> : null}
              {kits.map((kit) => {
                const selected = activeKit?.id === kit.id;
                const isCurrent = project.miniGardenKitId === kit.id;
                return (
                  <button key={kit.id} type="button" className={selected ? "is-selected" : ""} onClick={() => { setSelectedKitId(kit.id); setNotice(""); }}>
                    <span className={`kit-list-shape kit-list-shape--${kit.potPreset.shape}`} aria-hidden="true" />
                    <span><strong>{kit.name}</strong><small>{POT_SHAPE_LABELS[kit.potPreset.shape]} · {kit.potPreset.widthCm}×{kit.potPreset.depthCm}×{kit.potPreset.heightCm}cm</small></span>
                    {isCurrent ? <em>현재 수업</em> : null}
                  </button>
                );
              })}
            </div>
            <div className="kit-library-note"><strong>키트에 저장되는 내용</strong><p>화분 형태와 실제 크기, 다음 단계에서 추가할 실제 재료 구성을 함께 저장합니다.</p></div>
          </aside>

          <KitForm key={activeKit?.id ?? NEW_KIT_SELECTION} kit={activeKit} onSave={saveKit} notice={notice} />

          <aside className="kit-guide-panel">
            <div className="kit-panel-title"><span>03</span><div><strong>수업 준비 안내</strong><small>실물과 같은 기준으로 입력</small></div></div>
            <ol><li><span>1</span><div><strong>실제 화분 측정</strong><p>가장 넓은 지점의 가로·세로·높이를 cm로 측정합니다.</p></div></li><li><span>2</span><div><strong>형태 선택</strong><p>실제 화분과 가장 가까운 프리셋을 고릅니다.</p></div></li><li><span>3</span><div><strong>재료 연결</strong><p>STEP 10에서 수업 당일의 모래, 식물, 돌을 추가합니다.</p></div></li></ol>
            <div className="kit-next-preview"><span>NEXT · STEP 10</span><strong>실제 재료 추가</strong><p>사진, 재료 유형, 수량과 실제 크기를 등록합니다.</p>{activeKit ? <Link href="/teacher/mini-garden-materials">실제 재료 관리</Link> : <button type="button" disabled>키트 저장 후 준비</button>}</div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function KitForm({ kit, onSave, notice }: { kit: MiniGardenKit | null; onSave: (kit: MiniGardenKit) => void; notice: string }) {
  const initialPot = kit?.potPreset ?? POT_PRESETS[0];
  const [name, setName] = useState(kit?.name ?? "");
  const [shape, setShape] = useState<PotShape>(initialPot.shape);
  const [presetId, setPresetId] = useState(initialPot.id);
  const [widthCm, setWidthCm] = useState(initialPot.widthCm);
  const [depthCm, setDepthCm] = useState(initialPot.depthCm);
  const [heightCm, setHeightCm] = useState(initialPot.heightCm);
  const [saveAsNew, setSaveAsNew] = useState(false);
  const [formError, setFormError] = useState("");
  const dimensionsValid = [widthCm, depthCm, heightCm].every(isValidPotDimension);
  const currentPot: PotPreset = { id: presetId, name: POT_SHAPE_LABELS[shape], shape, widthCm, depthCm, heightCm };
  const volume = estimatePotVolumeLiters(currentPot);

  function applyPreset(preset: PotPreset) {
    setShape(preset.shape);
    setPresetId(preset.id);
    setWidthCm(preset.widthCm);
    setDepthCm(preset.depthCm);
    setHeightCm(preset.heightCm);
    setFormError("");
  }

  function submit() {
    if (!name.trim()) {
      setFormError("수업에서 구분할 수 있는 키트 이름을 입력해 주세요.");
      return;
    }
    if (!dimensionsValid) {
      setFormError("화분 크기는 각 항목을 5~60cm 사이로 입력해 주세요.");
      return;
    }
    const id = kit && !saveAsNew ? kit.id : `mini-kit-${crypto.randomUUID()}`;
    onSave({
      id,
      name: name.trim(),
      potPreset: { ...currentPot, id: `${presetId}-${id}`, name: `${POT_SHAPE_LABELS[shape]} ${widthCm}cm` },
      materials: kit?.materials ?? [],
    });
    setSaveAsNew(false);
    setFormError("");
  }

  return (
    <section className="kit-form-workspace">
      <div className="kit-panel-title"><span>02</span><div><strong>화분과 키트 설정</strong><small>{kit ? "저장된 키트 편집" : "새 수업 키트"}</small></div></div>
      <label className="kit-name-field"><span>키트 이름</span><input value={name} maxLength={50} placeholder="예: 푸른솔중 미니조경 키트 A" onChange={(event) => { setName(event.target.value); setFormError(""); }} /></label>
      <fieldset className="pot-preset-fieldset"><legend>투명화분 형태</legend><div>{POT_PRESETS.map((preset) => <button key={preset.id} type="button" className={shape === preset.shape ? "is-selected" : ""} aria-pressed={shape === preset.shape} onClick={() => applyPreset(preset)}><span className={`pot-preset-icon pot-preset-icon--${preset.shape}`} aria-hidden="true" /><strong>{POT_SHAPE_LABELS[preset.shape]}</strong><small>{preset.widthCm}×{preset.depthCm}×{preset.heightCm}cm</small></button>)}</div></fieldset>
      <div className="pot-configuration-row">
        <TransparentPotPreview pot={currentPot} />
        <div className="pot-dimension-fields">
          <strong>실제 화분 크기</strong>
          <p>프리셋을 선택한 후 실물 측정값으로 수정할 수 있습니다.</p>
          <div>
            <label><span>가로</span><span><input type="number" min="5" max="60" value={widthCm} onChange={(event) => { setWidthCm(Number(event.target.value)); setFormError(""); }} /> cm</span></label>
            <label><span>세로</span><span><input type="number" min="5" max="60" value={depthCm} onChange={(event) => { setDepthCm(Number(event.target.value)); setFormError(""); }} /> cm</span></label>
            <label><span>높이</span><span><input type="number" min="5" max="60" value={heightCm} onChange={(event) => { setHeightCm(Number(event.target.value)); setFormError(""); }} /> cm</span></label>
          </div>
          <dl><div><dt>예상 내부 용량</dt><dd>약 {volume}L</dd></div><div><dt>등록 재료</dt><dd>{kit?.materials.length ?? 0}종</dd></div></dl>
        </div>
      </div>
      <div className="kit-material-placeholder"><div><span>STEP 10</span><strong>오늘 제공할 실제 재료</strong><p>키트를 저장한 뒤 실제 모래·자갈·식물 사진과 수량을 추가합니다.</p></div>{kit ? <Link href="/teacher/mini-garden-materials">+ 실제 재료 추가</Link> : <button type="button" disabled>키트 저장 후 준비</button>}</div>
      <p className="kit-form-status" role="status">{formError || notice}</p>
      <footer className="kit-form-actions">
        {kit ? <button type="button" className="button button--quiet" onClick={() => { setSaveAsNew(true); setName(`${name} 복사본`); }}>새 키트로 복사</button> : <span />}
        <button type="button" className="button button--primary" onClick={submit}>{saveAsNew ? "복사본 저장" : kit ? "변경사항 저장" : "키트 저장"}</button>
      </footer>
    </section>
  );
}

function TransparentPotPreview({ pot }: { pot: PotPreset }) {
  const widthRatio = Math.max(0.55, Math.min(1, pot.widthCm / 28));
  const heightRatio = Math.max(0.45, Math.min(1, pot.heightCm / 26));
  const isTall = pot.shape === "tall_cylinder";
  return (
    <div className="pot-preview-card">
      <div className="pot-preview-stage">
        <div className={`pot-photo-preview ${isTall ? "is-tall" : "is-low"}`} style={{ width: `${Math.round(widthRatio * (isTall ? 150 : 220))}px`, height: `${Math.round(heightRatio * (isTall ? 235 : 150))}px` }}>
          <Image src={isTall ? "/assets/photoreal/tall-clear-glass-vase-v2.png" : "/assets/photoreal/clear-glass-vase.png"} alt={`${POT_SHAPE_LABELS[pot.shape]} 실제 화분 미리보기`} fill sizes="220px" unoptimized />
        </div>
        <span className="pot-width-guide">{pot.widthCm}cm</span><span className="pot-height-guide">{pot.heightCm}cm</span>
      </div>
      <div><span>TRANSPARENT POT PREVIEW</span><strong>{POT_SHAPE_LABELS[pot.shape]}</strong><small>가로 {pot.widthCm} · 세로 {pot.depthCm} · 높이 {pot.heightCm}cm</small></div>
    </div>
  );
}
