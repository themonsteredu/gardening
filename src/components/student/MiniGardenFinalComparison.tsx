"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { MiniMaterialTexture, MiniMaterialThumbnail } from "@/components/student/MiniMaterialThumbnail";
import { MiniPotPhoto } from "@/components/student/MiniPotPhoto";
import type { MiniGardenKit, MiniGardenMaterial, SchoolProject, StudentMiniGardenDesign } from "@/domain/models";
import { normalizeMiniGardenLayerOrder } from "@/lib/mini-garden-layers";
import {
  isMiniFinalComparisonReady,
  MINI_FINAL_COMPARISON_CHECKS,
  MINI_FINAL_PHOTO_ACCEPT,
  MINI_FINAL_REFLECTION_MIN_LENGTH,
  validateMiniFinalPhoto,
} from "@/lib/mini-final-photo";
import { deleteMiniFinalPhoto, getMiniFinalPhoto, saveMiniFinalPhoto } from "@/lib/mini-final-photo-store";
import {
  getStudentMiniGardenDesignStorageKey,
  MINI_GARDEN_KITS_STORAGE_KEY,
  parseStoredMiniGardenDesign,
  parseStoredMiniGardenKits,
} from "@/lib/project-store";
import { useBrowserStorageValue, writeBrowserStorage } from "@/lib/use-browser-storage";

export function MiniGardenFinalComparison({
  project,
  nickname,
  sessionId,
  onBack,
}: {
  project: SchoolProject;
  nickname: string;
  sessionId: string;
  onBack: () => void;
}) {
  const kitsValue = useBrowserStorageValue("local", MINI_GARDEN_KITS_STORAGE_KEY);
  const kits = useMemo(() => parseStoredMiniGardenKits(kitsValue), [kitsValue]);
  const kit = kits.find((item) => item.id === project.miniGardenKitId) ?? null;
  const storageKey = getStudentMiniGardenDesignStorageKey(sessionId);
  const storedValue = useBrowserStorageValue("local", storageKey);
  const design = useMemo(() => parseStoredMiniGardenDesign(storedValue), [storedValue]);

  if (!kit || !design || design.miniGardenKitId !== kit.id) {
    return <main className="student-design-empty"><p className="eyebrow">STEP 15 · FINAL COMPARISON</p><h1>비교할 미니조경 설계를 준비하고 있습니다.</h1><p>제작 순서 화면에서 설계를 모두 확인한 뒤 다시 시도하세요.</p><button className="button button--primary" type="button" onClick={onBack}>제작 순서로 돌아가기</button></main>;
  }

  return <MiniGardenFinalComparisonWorkspace key={`${kit.id}-${sessionId}`} kit={kit} design={design} nickname={nickname} storageKey={storageKey} onBack={onBack} />;
}

function MiniGardenFinalComparisonWorkspace({
  kit,
  design,
  nickname,
  storageKey,
  onBack,
}: {
  kit: MiniGardenKit;
  design: StudentMiniGardenDesign;
  nickname: string;
  storageKey: string;
  onBack: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("완성한 작품을 밝은 곳에서 정면으로 촬영해 주세요.");
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const materialMap = useMemo(() => new Map(kit.materials.map((material) => [material.id, material])), [kit.materials]);
  const layers = normalizeMiniGardenLayerOrder(design.layers);
  const hasPhoto = Boolean(design.finalPhotoStorageKey);
  const ready = isMiniFinalComparisonReady(hasPhoto, design.finalComparisonChecklistIds, design.finalComparisonReflection);
  const checkedCount = MINI_FINAL_COMPARISON_CHECKS.filter((item) => design.finalComparisonChecklistIds.includes(item.id)).length;

  function persist(changes: Partial<StudentMiniGardenDesign>) {
    writeBrowserStorage("local", storageKey, JSON.stringify({ ...design, ...changes }));
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const validationMessage = validateMiniFinalPhoto(file);
    if (validationMessage) {
      setNotice(validationMessage);
      return;
    }

    setIsSaving(true);
    const previousKey = design.finalPhotoStorageKey;
    const nextKey = `${design.id}:${crypto.randomUUID()}`;
    try {
      await saveMiniFinalPhoto(nextKey, file);
      persist({
        finalPhotoStorageKey: nextKey,
        finalPhotoName: file.name,
        finalPhotoMimeType: file.type || null,
        finalPhotoUploadedAt: new Date().toISOString(),
        finalPhotoUrl: null,
        completedAt: null,
      });
      if (previousKey && previousKey !== nextKey) await deleteMiniFinalPhoto(previousKey);
      setNotice("완성작 사진을 저장했습니다. 왼쪽 모델과 차근차근 비교해 보세요.");
      setRemoveConfirm(false);
    } catch {
      setNotice("사진을 저장하지 못했습니다. 브라우저 저장 공간을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setIsSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void handleFile(event.dataTransfer.files[0]);
  }

  async function removePhoto() {
    if (!removeConfirm) {
      setRemoveConfirm(true);
      return;
    }
    if (design.finalPhotoStorageKey) await deleteMiniFinalPhoto(design.finalPhotoStorageKey);
    persist({
      finalPhotoStorageKey: null,
      finalPhotoName: null,
      finalPhotoMimeType: null,
      finalPhotoUploadedAt: null,
      finalPhotoUrl: null,
      completedAt: null,
    });
    setNotice("완성작 사진을 삭제했습니다. 새 사진을 올려 주세요.");
    setRemoveConfirm(false);
  }

  function toggleCheck(id: string) {
    const current = new Set(design.finalComparisonChecklistIds);
    if (current.has(id)) current.delete(id); else current.add(id);
    persist({ finalComparisonChecklistIds: [...current], completedAt: null });
  }

  function completeExperience() {
    if (!ready) return;
    persist({ completedAt: new Date().toISOString() });
    setNotice("미니조경 설계와 실제 제작 비교를 모두 마쳤습니다.");
  }

  return (
    <main className="student-final-page">
      <header className="student-pot-heading student-final-heading">
        <div><button type="button" onClick={onBack}>← 제작 순서</button><p className="eyebrow">STEP 15 · FINAL COMPARISON</p><h1>설계와 실제 작품을 비교하세요.</h1><p>모델링을 옆에 두고 완성작 사진을 올린 뒤, 달라진 점과 잘된 점을 기록합니다.</p></div>
        <div><span>{nickname} 조경전문가</span><strong>{kit.name}</strong><small>{design.completedAt ? "직업체험 완료" : "마지막 비교 기록 중"}</small></div>
      </header>

      <section className="student-final-intro">
        <div><span>01</span><p><strong>이제 실제 작품을 기록할 시간입니다.</strong><small>같은 높이와 방향에서 촬영하면 모델과 더 정확히 비교할 수 있어요.</small></p></div>
        <ul><li>작품 전체가 보이게</li><li>밝은 곳에서 정면으로</li><li>얼굴·이름표 없이 작품만</li></ul>
      </section>

      <section className="student-final-comparison" aria-label="3D 설계와 실제 완성작 비교">
        <article className="student-final-panel student-final-model-panel">
          <header><span>나의 3D 설계</span><strong>모델링 기준</strong></header>
          <MiniGardenModelSnapshot kit={kit} design={design} materialMap={materialMap} />
          <dl><div><dt>모래 층</dt><dd>{layers.length}개</dd></div><div><dt>배치 물체</dt><dd>{design.objects.length}개</dd></div><div><dt>화분 크기</dt><dd>{kit.potPreset.widthCm}×{kit.potPreset.depthCm}×{kit.potPreset.heightCm}cm</dd></div></dl>
        </article>

        <div className="student-final-versus" aria-hidden="true"><span>VS</span><small>관찰하고 비교하기</small></div>

        <article className="student-final-panel student-final-photo-panel">
          <header><span>내가 만든 실제 작품</span><strong>{hasPhoto ? "촬영 완료" : "사진 필요"}</strong></header>
          {design.finalPhotoStorageKey ? (
            <div className="student-final-photo-preview">
              <StoredFinalPhoto storageKey={design.finalPhotoStorageKey} name={design.finalPhotoName ?? "완성한 미니조경 작품"} />
              <div className="student-final-photo-actions"><button type="button" onClick={() => fileInputRef.current?.click()} disabled={isSaving}>사진 바꾸기</button><button className={removeConfirm ? "is-confirming" : ""} type="button" onClick={() => void removePhoto()}>{removeConfirm ? "삭제 확인" : "사진 삭제"}</button></div>
            </div>
          ) : (
            <div className={`student-final-upload ${isDragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
              <span aria-hidden="true">＋</span><strong>{isSaving ? "사진 저장 중…" : "완성 작품 사진 올리기"}</strong><p>사진을 끌어 놓거나 아래 버튼으로 선택하세요.</p><small>JPG · PNG · WebP / 최대 12MB</small><button className="button button--primary" type="button" onClick={() => fileInputRef.current?.click()} disabled={isSaving}>사진 선택</button>
            </div>
          )}
          <input ref={fileInputRef} className="visually-hidden" type="file" accept={MINI_FINAL_PHOTO_ACCEPT} onChange={(event) => void handleFile(event.target.files?.[0])} />
          <div className="student-final-photo-meta"><span>{design.finalPhotoName ?? "아직 등록된 사진이 없습니다."}</span><small>{design.finalPhotoUploadedAt ? `${formatKoreanDate(design.finalPhotoUploadedAt)} 저장` : "원본 사진은 이 기기의 브라우저에 보관됩니다."}</small></div>
        </article>
      </section>

      <p className="student-final-notice" role="status">{notice}</p>

      <section className="student-final-review">
        <div className="student-final-review-heading"><span>02</span><div><strong>조경전문가 비교 기록</strong><small>모델과 실제 작품을 번갈아 보며 모두 확인하세요.</small></div><b>{checkedCount}/{MINI_FINAL_COMPARISON_CHECKS.length}</b></div>
        <div className="student-final-review-grid">
          <div className="student-final-checklist">
            {MINI_FINAL_COMPARISON_CHECKS.map((item) => {
              const checked = design.finalComparisonChecklistIds.includes(item.id);
              return <label className={checked ? "is-checked" : ""} key={item.id}><input type="checkbox" checked={checked} onChange={() => toggleCheck(item.id)} /><span>{checked ? "✓" : ""}</span><strong>{item.label}</strong></label>;
            })}
          </div>
          <label className="student-final-reflection"><span>비교하며 발견한 점 <b>{design.finalComparisonReflection.trim().length}/{MINI_FINAL_REFLECTION_MIN_LENGTH}자 이상</b></span><textarea rows={6} value={design.finalComparisonReflection} placeholder="예: 실제 식물이 모델보다 커서 중앙 쪽으로 옮겼고, 흰 모래 층은 설계한 높이와 비슷하게 잘 만들었습니다." onChange={(event) => persist({ finalComparisonReflection: event.target.value, completedAt: null })} /><small>모델과 달라진 점 또는 설계대로 잘 표현된 점을 구체적으로 적어 보세요.</small></label>
        </div>
      </section>

      <section className={`student-final-complete ${design.completedAt ? "is-complete" : ""}`}>
        <div><span aria-hidden="true">{design.completedAt ? "✓" : "15"}</span><p><strong>{design.completedAt ? `${nickname} 조경전문가, 직업체험을 완료했습니다.` : "사진과 비교 기록을 마무리하세요."}</strong><small>{design.completedAt ? `${formatKoreanDate(design.completedAt)} · 설계에서 실제 제작까지 모든 과정을 완수했습니다.` : "사진 1장, 비교 확인 4개, 발견한 점 10자 이상이 필요합니다."}</small></p></div>
        {design.completedAt ? <button type="button" onClick={() => persist({ completedAt: null })}>기록 수정하기</button> : <button className="button button--primary button--large" type="button" disabled={!ready} onClick={completeExperience}>조경전문가 직업체험 완료</button>}
      </section>
    </main>
  );
}

function MiniGardenModelSnapshot({ kit, design, materialMap }: { kit: MiniGardenKit; design: StudentMiniGardenDesign; materialMap: Map<string, MiniGardenMaterial> }) {
  const layers = normalizeMiniGardenLayerOrder(design.layers);
  return <div className="student-final-model" aria-label="학생이 설계한 미니조경 실사 이미지 요약"><div className="student-final-model-front"><div className="student-final-model-pot"><div className="student-final-model-pot-fill">{layers.map((layer) => { const material = materialMap.get(layer.materialId); if (!material) return null; return <MiniMaterialTexture key={layer.id} material={material} className="student-final-layer-photo" style={{ height: `${Math.min(100, (layer.heightCm / kit.potPreset.heightCm) * 100)}%` }} />; })}</div><MiniPotPhoto pot={kit.potPreset} sizes="190px" /></div><small>정면 · 실제 재료 층</small></div><div className="student-final-model-top"><div className="student-final-model-map">{design.objects.map((object) => { const material = materialMap.get(object.materialId); if (!material || material.type === "layer") return null; const style = { left: `${object.x}%`, top: `${object.y}%`, "--marker-scale": Math.max(0.7, Math.min(1.4, object.scale)) } as CSSProperties; return <span className={`student-final-marker student-final-marker--${material.type}`} style={style} key={object.id} title={material.name}><MiniMaterialThumbnail material={material} /></span>; })}</div><small>위에서 · 실제 재료 위치</small></div></div>;
}

function StoredFinalPhoto({ storageKey, name }: { storageKey: string; name: string }) {
  const [source, setSource] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let objectUrl: string | null = null;
    let active = true;
    getMiniFinalPhoto(storageKey).then((blob) => {
      if (!active) return;
      if (!blob) {
        setMissing(true);
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    }).catch(() => { if (active) setMissing(true); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [storageKey]);

  if (missing) return <div className="student-final-photo-missing"><strong>사진 원본을 찾지 못했습니다.</strong><p>사진 바꾸기를 눌러 다시 등록해 주세요.</p></div>;
  if (!source) return <div className="student-final-photo-loading">사진 불러오는 중…</div>;
  return <Image src={source} alt={name} fill sizes="(max-width: 900px) 100vw, 44vw" unoptimized />;
}

function formatKoreanDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "날짜 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
