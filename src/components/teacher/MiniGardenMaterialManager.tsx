"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import type { MiniGardenKit, MiniGardenMaterial, MiniMaterialType } from "@/domain/models";
import {
  MINI_MATERIAL_IMAGE_ACCEPT,
  MINI_MATERIAL_TYPE_DESCRIPTIONS,
  MINI_MATERIAL_TYPE_LABELS,
  resolveMiniMaterialImageMimeType,
  validateMiniMaterialImage,
  validateMiniMaterialQuantity,
  validateMiniMaterialSize,
} from "@/lib/mini-garden-material";
import { removeMiniImageBackground } from "@/lib/mini-image-background";
import { deleteMiniMaterialImage, getMiniMaterialImage, saveMiniMaterialImage } from "@/lib/mini-material-image-store";
import {
  MINI_GARDEN_KITS_STORAGE_KEY,
  parseStoredMiniGardenKits,
  parseStoredProject,
  PROJECT_STORAGE_KEY,
  upsertMiniGardenKit,
} from "@/lib/project-store";
import { useBrowserStorageValue, writeBrowserStorage } from "@/lib/use-browser-storage";

const MATERIAL_TYPES = Object.keys(MINI_MATERIAL_TYPE_LABELS) as MiniMaterialType[];

interface CandidatePhoto {
  sourceFile: File;
  blob: Blob;
  mimeType: string;
  previewUrl: string;
  backgroundRemoved: boolean;
}

function usesCutoutPhoto(type: MiniMaterialType): boolean {
  return type === "object" || type === "plant" || type === "structure";
}

export function MiniGardenMaterialManager() {
  const projectValue = useBrowserStorageValue("local", PROJECT_STORAGE_KEY);
  const kitsValue = useBrowserStorageValue("local", MINI_GARDEN_KITS_STORAGE_KEY);
  const project = useMemo(() => parseStoredProject(projectValue), [projectValue]);
  const kits = useMemo(() => parseStoredMiniGardenKits(kitsValue), [kitsValue]);
  const activeKit = kits.find((kit) => kit.id === project.miniGardenKitId) ?? null;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const editingMaterial = activeKit?.materials.find((material) => material.id === editingId) ?? null;

  function persistKit(nextKit: MiniGardenKit) {
    writeBrowserStorage("local", MINI_GARDEN_KITS_STORAGE_KEY, JSON.stringify(upsertMiniGardenKit(kits, nextKit)));
  }

  function saveMaterial(material: MiniGardenMaterial) {
    if (!activeKit) return;
    const materials = [material, ...activeKit.materials.filter((item) => item.id !== material.id)];
    persistKit({ ...activeKit, materials });
    setEditingId(material.id);
    setNotice(`${material.name} 재료를 키트에 저장했습니다.`);
  }

  async function deleteMaterial(material: MiniGardenMaterial) {
    if (!activeKit || deleteCandidateId !== material.id) {
      setDeleteCandidateId(material.id);
      return;
    }
    persistKit({ ...activeKit, materials: activeKit.materials.filter((item) => item.id !== material.id) });
    if (material.photoStorageKey) await deleteMiniMaterialImage(material.photoStorageKey).catch(() => undefined);
    setDeleteCandidateId(null);
    setEditingId(null);
    setEditorVersion((version) => version + 1);
    setNotice(`${material.name} 재료를 삭제했습니다.`);
  }

  if (!activeKit) {
    return (
      <div className="material-manager-shell"><AppHeader compact current="teacher" /><main className="student-design-empty"><p className="eyebrow">STEP 10 · REAL MATERIALS</p><h1>먼저 미니조경 키트를 저장해 주세요.</h1><p>투명화분의 형태와 크기가 정해진 키트에 실제 수업 재료를 연결합니다.</p><Link className="button button--primary" href="/teacher/mini-garden-kit">미니조경 키트 만들기</Link></main></div>
    );
  }

  return (
    <div className="material-manager-shell">
      <AppHeader compact current="teacher" />
      <main className="material-manager-page">
        <header className="material-manager-heading">
          <div><Link href="/teacher/mini-garden-kit">← 미니조경 키트</Link><p className="eyebrow">STEP 10 · REAL MATERIALS</p><h1>실제 재료를 키트에 추가하세요.</h1><p>수업 당일 학생에게 제공할 재료 사진과 사용 방식을 그대로 등록합니다.</p></div>
          <div><span>현재 키트</span><strong>{activeKit.name}</strong><small>{MINI_MATERIAL_TYPE_LABELS.layer} 포함 · 재료 {activeKit.materials.length}종</small></div>
        </header>

        <div className="material-manager-layout">
          <aside className="registered-material-panel">
            <div className="kit-panel-title"><span>01</span><div><strong>등록된 실제 재료</strong><small>현재 키트에 포함</small></div></div>
            <button className="material-add-new" type="button" onClick={() => { setEditingId(null); setEditorVersion((version) => version + 1); setNotice(""); }}>+ 실제 재료 추가</button>
            <div className="registered-material-list">
              {activeKit.materials.length === 0 ? <p>아직 등록된 재료가 없습니다.<br />실제 수업 재료부터 촬영해 주세요.</p> : null}
              {activeKit.materials.map((material) => (
                <article className={editingId === material.id ? "is-selected" : ""} key={material.id}>
                  <MiniMaterialPhoto material={material} />
                  <div><span>{MINI_MATERIAL_TYPE_LABELS[material.type]}</span><strong>{material.name}</strong><small>{material.availableQuantity === null ? "수량 제한 없음" : `${material.availableQuantity}개 사용`} {material.actualSizeCm ? `· ${material.actualSizeCm}cm` : ""}</small></div>
                  <div className="registered-material-actions"><button type="button" onClick={() => { setEditingId(material.id); setDeleteCandidateId(null); setNotice(""); }}>편집</button><button type="button" className={deleteCandidateId === material.id ? "is-confirming" : ""} onClick={() => void deleteMaterial(material)}>{deleteCandidateId === material.id ? "삭제 확인" : "삭제"}</button></div>
                </article>
              ))}
            </div>
            {deleteCandidateId ? <button className="material-delete-cancel" type="button" onClick={() => setDeleteCandidateId(null)}>삭제 취소</button> : null}
          </aside>

          <MaterialForm key={`${editingMaterial?.id ?? "new"}-${editorVersion}`} kit={activeKit} material={editingMaterial} onSave={saveMaterial} notice={notice} />

          <aside className="material-type-guide">
            <div className="kit-panel-title"><span>03</span><div><strong>유형별 사용 방식</strong><small>모든 사진을 억지로 3D화하지 않음</small></div></div>
            {MATERIAL_TYPES.map((type, index) => <div key={type}><span>{String.fromCharCode(65 + index)}</span><p><strong>{MINI_MATERIAL_TYPE_LABELS[type]}</strong><small>{MINI_MATERIAL_TYPE_DESCRIPTIONS[type]}</small></p></div>)}
            <div className="material-photo-guide"><strong>사진 촬영 팁</strong><ul><li>밝고 그림자가 적은 곳</li><li>재료 하나가 화면 중앙에 오도록</li><li>크기 비교가 필요하면 자와 함께 촬영</li></ul></div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function MaterialForm({ kit, material, onSave, notice }: { kit: MiniGardenKit; material: MiniGardenMaterial | null; onSave: (material: MiniGardenMaterial) => void; notice: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const candidateUrlRef = useRef<string | null>(null);
  const [candidate, setCandidate] = useState<CandidatePhoto | null>(null);
  const [name, setName] = useState(material?.name ?? "");
  const [type, setType] = useState<MiniMaterialType>(material?.type ?? "layer");
  const [quantityMode, setQuantityMode] = useState<"unlimited" | "limited">(material?.availableQuantity === null || !material ? "unlimited" : "limited");
  const [quantity, setQuantity] = useState(material?.availableQuantity ?? 1);
  const [actualSize, setActualSize] = useState(material?.actualSizeCm?.toString() ?? "");
  const [color, setColor] = useState(material?.color ?? "#b8a47a");
  const [dragActive, setDragActive] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);

  useEffect(() => () => { if (candidateUrlRef.current) URL.revokeObjectURL(candidateUrlRef.current); }, []);

  async function selectFile(file: File, nextType = type) {
    const error = validateMiniMaterialImage(file);
    if (error) { setFormError(error); return; }
    const mimeType = resolveMiniMaterialImageMimeType(file);
    if (!mimeType) return;
    setProcessingPhoto(true);
    const shouldRemoveBackground = usesCutoutPhoto(nextType);
    let blob: Blob = file;
    try {
      if (shouldRemoveBackground) blob = await removeMiniImageBackground(file);
    } catch {
      setFormError("배경을 자동으로 지우지 못해 원본 사진을 사용합니다. 밝고 단순한 배경에서 다시 촬영하면 더 깔끔합니다.");
    }
    if (candidateUrlRef.current) URL.revokeObjectURL(candidateUrlRef.current);
    const previewUrl = URL.createObjectURL(blob);
    candidateUrlRef.current = previewUrl;
    setCandidate({ sourceFile: file, blob, mimeType: shouldRemoveBackground && blob !== file ? "image/png" : mimeType, previewUrl, backgroundRemoved: shouldRemoveBackground && blob !== file });
    if (shouldRemoveBackground && blob !== file) setFormError("");
    setProcessingPhoto(false);
  }

  async function submit() {
    const availableQuantity = quantityMode === "unlimited" ? null : quantity;
    const actualSizeCm = actualSize.trim() ? Number(actualSize) : null;
    if (type !== "layer" && !candidate && !material?.photoStorageKey) { setFormError("학생이 확인할 실제 재료 사진을 등록해 주세요."); return; }
    if (!name.trim()) { setFormError("재료 이름을 입력해 주세요."); return; }
    if (!validateMiniMaterialQuantity(availableQuantity)) { setFormError("사용 가능 수량은 1~99개로 입력해 주세요."); return; }
    if (!validateMiniMaterialSize(actualSizeCm)) { setFormError("실제 크기는 0보다 크고 100cm 이하로 입력해 주세요."); return; }
    setSaving(true);
    setFormError("");
    const id = material?.id ?? `mini-material-${crypto.randomUUID()}`;
    let photoStorageKey = material?.photoStorageKey ?? null;
    let photoMimeType = material?.photoMimeType ?? null;
    let photoName = material?.photoName ?? null;
    try {
      if (candidate) {
        const nextStorageKey = `mini-material-image-${crypto.randomUUID()}`;
        await saveMiniMaterialImage(nextStorageKey, candidate.blob);
        if (photoStorageKey && photoStorageKey !== nextStorageKey) await deleteMiniMaterialImage(photoStorageKey).catch(() => undefined);
        photoStorageKey = nextStorageKey;
        photoMimeType = candidate.mimeType;
        photoName = candidate.backgroundRemoved ? `${candidate.sourceFile.name.replace(/\.[^.]+$/, "")}-cutout.png` : candidate.sourceFile.name;
      }
      onSave({ id, name: name.trim(), type, photoUrl: null, photoStorageKey, photoMimeType, photoName, modelAssetUrl: null, color: type === "layer" || type === "scatter" ? color : null, availableQuantity, actualSizeCm });
      setCandidate(null);
      if (candidateUrlRef.current) URL.revokeObjectURL(candidateUrlRef.current);
      candidateUrlRef.current = null;
    } catch {
      setFormError("재료 사진을 브라우저에 저장하지 못했습니다. 저장 공간을 확인해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="material-form-workspace">
      <div className="kit-panel-title"><span>02</span><div><strong>{material ? "실제 재료 편집" : "새 실제 재료"}</strong><small>{kit.name}에 저장</small></div></div>
      <div className="material-form-top">
        <div className="material-photo-field">
          <input ref={inputRef} className="visually-hidden" type="file" accept={MINI_MATERIAL_IMAGE_ACCEPT} capture="environment" aria-label="실제 재료 사진 촬영 또는 파일 선택" onChange={(event) => { const file = event.target.files?.[0]; if (file) void selectFile(file); event.target.value = ""; }} />
          {candidate ? <button className="material-photo-preview" type="button" onClick={() => inputRef.current?.click()}><Image src={candidate.previewUrl} alt="선택한 실제 재료 사진" fill sizes="360px" unoptimized /><span>{processingPhoto ? "배경 처리 중" : candidate.backgroundRemoved ? "배경 제거 완료 · 사진 교체" : "사진 교체"}</span></button> : material?.photoStorageKey ? <button className="material-photo-preview" type="button" onClick={() => inputRef.current?.click()}><MiniMaterialPhoto material={material} large /><span>사진 교체</span></button> : <button className={`material-photo-dropzone ${dragActive ? "is-dragging" : ""}`} type="button" onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => { event.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={(event) => { event.preventDefault(); setDragActive(false); const file = event.dataTransfer.files[0]; if (file) void selectFile(file); }}><span aria-hidden="true" /><strong>{type === "layer" ? "가루 사진 (선택)" : "실제 재료 촬영·올리기"}</strong><p>{usesCutoutPhoto(type) ? "올리면 배경을 자동으로 지웁니다" : "사진을 놓거나 눌러서 선택"}</p><small>JPG · PNG · WEBP / 최대 8MB</small></button>}
        </div>
        <div className="material-basic-fields">
          <label><span>재료 이름</span><input value={name} maxLength={40} placeholder="예: 민트색 색모래" onChange={(event) => { setName(event.target.value); setFormError(""); }} /></label>
          <fieldset><legend>재료 유형</legend><div>{MATERIAL_TYPES.map((item) => <button key={item} type="button" className={type === item ? "is-selected" : ""} aria-pressed={type === item} onClick={() => { setType(item); setFormError(""); if (candidate) void selectFile(candidate.sourceFile, item); }}><strong>{MINI_MATERIAL_TYPE_LABELS[item]}</strong><small>{MINI_MATERIAL_TYPE_DESCRIPTIONS[item]}</small></button>)}</div></fieldset>
        </div>
      </div>
      <div className="material-detail-fields">
        <fieldset><legend>사용 가능 수량</legend><div className="material-quantity-options"><button type="button" className={quantityMode === "unlimited" ? "is-selected" : ""} onClick={() => setQuantityMode("unlimited")}>제한 없음</button><button type="button" className={quantityMode === "limited" ? "is-selected" : ""} onClick={() => setQuantityMode("limited")}>수량 지정</button>{quantityMode === "limited" ? <label><input type="number" min="1" max="99" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /> 개</label> : null}</div></fieldset>
        <label><span>실제 크기 <small>선택 입력</small></span><span><input type="number" min="0.1" max="100" step="0.1" value={actualSize} placeholder="예: 3" onChange={(event) => setActualSize(event.target.value)} /> cm</span></label>
        {type === "layer" || type === "scatter" ? <label><span>가루·표면 색상 <small>언제든 변경 가능</small></span><span><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><code>{color}</code></span></label> : null}
      </div>
      <p className="material-form-status" role="status">{formError || notice}</p>
      <footer><span>{type === "layer" ? "가루는 색상만으로도 추가할 수 있습니다." : "배경을 지운 투명 이미지가 이 브라우저의 수업 데이터에 저장됩니다."}</span><button className="button button--primary" type="button" disabled={saving || processingPhoto} onClick={() => void submit()}>{saving ? "저장하는 중" : processingPhoto ? "사진 처리 중" : material ? "변경사항 저장" : "키트에 재료 추가"}</button></footer>
    </section>
  );
}

function MiniMaterialPhoto({ material, large = false }: { material: MiniGardenMaterial; large?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!material.photoStorageKey) return;
    let objectUrl: string | null = null;
    let alive = true;
    getMiniMaterialImage(material.photoStorageKey).then((blob) => {
      if (!alive || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => undefined);
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [material.photoStorageKey]);
  return <div className={`mini-material-photo ${large ? "mini-material-photo--large" : ""}`}>{url ? <Image src={url} alt={`${material.name} 실제 재료`} fill sizes={large ? "360px" : "72px"} unoptimized /> : <span>{material.name.slice(0, 1)}</span>}</div>;
}
