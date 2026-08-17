"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { MiniMaterialThumbnail } from "@/components/student/MiniMaterialThumbnail";
import type { MiniGardenKit, SchoolProject, StudentMiniGardenDesign } from "@/domain/models";
import {
  createMiniGardenMakingPlan,
  estimateMiniGardenMakingMinutes,
  getMakingPlanProgress,
  MINI_GARDEN_MAKING_PHASE_LABELS,
} from "@/lib/mini-garden-making-plan";
import {
  getStudentMiniGardenDesignStorageKey,
  MINI_GARDEN_KITS_STORAGE_KEY,
  parseStoredMiniGardenDesign,
  parseStoredMiniGardenKits,
} from "@/lib/project-store";
import { useBrowserStorageValue, writeBrowserStorage } from "@/lib/use-browser-storage";

export function MiniGardenMakingPlan({
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
    return <main className="student-design-empty"><p className="eyebrow">STEP 14 · MAKING PLAN</p><h1>제작 키트를 준비하고 있습니다.</h1><p>선생님이 오늘의 키트를 지정하면 자동 제작 순서를 확인할 수 있습니다.</p><button className="button button--primary" type="button" onClick={onBack}>재료 배치로 돌아가기</button></main>;
  }
  return <MiniGardenMakingPlanWorkspace key={`${kit.id}-${sessionId}`} kit={kit} nickname={nickname} sessionId={sessionId} onBack={onBack} onContinue={onContinue} />;
}

function MiniGardenMakingPlanWorkspace({ kit, nickname, sessionId, onBack, onContinue }: { kit: MiniGardenKit; nickname: string; sessionId: string; onBack: () => void; onContinue: () => void }) {
  const storageKey = getStudentMiniGardenDesignStorageKey(sessionId);
  const storedValue = useBrowserStorageValue("local", storageKey);
  const storedDesign = useMemo(() => parseStoredMiniGardenDesign(storedValue), [storedValue]);
  const design = useMemo<StudentMiniGardenDesign>(() => storedDesign?.miniGardenKitId === kit.id ? storedDesign : {
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
  }, [kit.id, sessionId, storedDesign]);
  const plan = useMemo(() => createMiniGardenMakingPlan(design, kit), [design, kit]);
  const validStepIds = useMemo(() => new Set(plan.map((step) => step.id)), [plan]);
  const completedIds = design.completedMakingStepIds.filter((id) => validStepIds.has(id));
  const progress = getMakingPlanProgress(completedIds, plan);
  const firstIncomplete = plan.find((step) => !completedIds.includes(step.id)) ?? plan.at(-1) ?? null;
  const [activeStepId, setActiveStepId] = useState<string | null>(firstIncomplete?.id ?? null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const activeStep = plan.find((step) => step.id === activeStepId) ?? firstIncomplete;
  const usedMaterialIds = new Set([
    ...design.layers.map((layer) => layer.materialId),
    ...design.objects.map((object) => object.materialId),
  ]);
  const usedMaterials = kit.materials.filter((material) => usedMaterialIds.has(material.id));
  const estimatedMinutes = estimateMiniGardenMakingMinutes(plan);

  function persistCompleted(nextCompletedIds: string[], messageStepId?: string) {
    const nextDesign = {
      ...design,
      makingSteps: plan.map((step) => step.instruction),
      completedMakingStepIds: nextCompletedIds,
    };
    writeBrowserStorage("local", storageKey, JSON.stringify(nextDesign));
    if (messageStepId) setActiveStepId(messageStepId);
  }

  function toggleStep(stepId: string) {
    const isCompleted = completedIds.includes(stepId);
    const nextCompleted = isCompleted
      ? completedIds.filter((id) => id !== stepId)
      : [...completedIds, stepId];
    const nextStep = !isCompleted
      ? plan.find((step) => !nextCompleted.includes(step.id))
      : plan.find((step) => step.id === stepId);
    persistCompleted(nextCompleted, nextStep?.id);
  }

  function resetProgress() {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    persistCompleted([], plan[0]?.id);
    setResetConfirm(false);
  }

  const progressStyle = { "--making-progress": `${progress.percent * 3.6}deg` } as CSSProperties;

  return (
    <main className="student-making-page">
      <header className="student-pot-heading">
        <div><button type="button" onClick={onBack}>← 식물·장식 배치</button><p className="eyebrow">STEP 14 · MAKING PLAN</p><h1>설계대로 직접 만들어 보세요.</h1><p>모델링 결과를 실제 작업 순서로 바꿨습니다. 한 단계씩 확인하며 제작하세요.</p></div>
        <div><span>{nickname} 제작자</span><strong>{kit.name}</strong><small>예상 {estimatedMinutes}분 · {plan.length}단계</small></div>
      </header>

      <div className="student-making-layout">
        <aside className="student-making-summary">
          <div className="scene-panel-title"><span>01</span><div><strong>제작 준비</strong><small>설계에서 사용한 실제 재료</small></div></div>
          <div className="student-making-progress-ring" style={progressStyle}><div><strong>{progress.percent}%</strong><small>{progress.completed}/{progress.total} 완료</small></div></div>
          <dl><div><dt>투명화분</dt><dd>{kit.potPreset.widthCm}×{kit.potPreset.depthCm}×{kit.potPreset.heightCm}cm</dd></div><div><dt>색모래 층</dt><dd>{design.layers.length}개</dd></div><div><dt>배치 물체</dt><dd>{design.objects.length}개</dd></div><div><dt>예상 시간</dt><dd>약 {estimatedMinutes}분</dd></div></dl>
          <div className="student-making-materials"><strong>준비할 재료 {usedMaterials.length}종</strong>{usedMaterials.length === 0 ? <p>설계에 사용한 재료가 없습니다.</p> : usedMaterials.map((material) => <div key={material.id}><MiniMaterialThumbnail material={material} /><span><strong>{material.name}</strong><small>{material.type === "layer" ? "층 재료" : design.objects.filter((object) => object.materialId === material.id).length + "개 배치"}</small></span></div>)}</div>
        </aside>

        <section className="student-making-timeline">
          <div className="student-making-timeline-heading"><div><span>02</span><div><strong>자동 제작 순서</strong><small>설계 변경 시 순서도 자동 갱신</small></div></div><button type="button" className={resetConfirm ? "is-confirming" : ""} onClick={resetProgress}>{resetConfirm ? "초기화 확인" : "진행 초기화"}</button></div>
          <div className="student-making-step-list">
            {plan.map((step, index) => {
              const completed = completedIds.includes(step.id);
              return <article className={`${activeStep?.id === step.id ? "is-active" : ""} ${completed ? "is-completed" : ""}`} key={step.id}><button className="student-making-check" type="button" aria-label={`${index + 1}단계 ${completed ? "완료 취소" : "완료 표시"}`} aria-pressed={completed} onClick={() => toggleStep(step.id)}>{completed ? "✓" : index + 1}</button><button className="student-making-step-copy" type="button" onClick={() => setActiveStepId(step.id)}><span>{MINI_GARDEN_MAKING_PHASE_LABELS[step.phase]}</span><strong>{step.title}</strong><p>{step.instruction}</p><small>{step.amountLabel}</small></button></article>;
            })}
          </div>
        </section>

        <aside className="student-making-current">
          <div className="scene-panel-title"><span>03</span><div><strong>현재 작업</strong><small>작업대에서 한 단계씩 진행</small></div></div>
          {activeStep ? <>
            <div className="student-making-current-number"><span>{plan.findIndex((step) => step.id === activeStep.id) + 1}</span><small>{MINI_GARDEN_MAKING_PHASE_LABELS[activeStep.phase]}</small></div>
            <h2>{activeStep.title}</h2>
            <p>{activeStep.instruction}</p>
            <div className="student-making-amount"><span>준비량</span><strong>{activeStep.amountLabel}</strong></div>
            <button className={`student-making-complete ${completedIds.includes(activeStep.id) ? "is-completed" : ""}`} type="button" onClick={() => toggleStep(activeStep.id)}>{completedIds.includes(activeStep.id) ? "✓ 완료됨 · 다시 열기" : "이 단계 완료"}</button>
          </> : null}
          <div className={`student-making-finish ${progress.percent === 100 ? "is-complete" : ""}`}><strong>{progress.percent === 100 ? "제작 순서 완료" : "완료까지 남은 단계"}</strong><p>{progress.percent === 100 ? "이제 실제 작품을 촬영하고 모델링과 비교할 준비가 됐습니다." : `${progress.total - progress.completed}단계를 차례로 확인하세요.`}</p></div>
          <button className="button button--primary button--wide" type="button" disabled={progress.percent < 100} onClick={onContinue}>다음: 완성작 촬영 및 비교</button>
        </aside>
      </div>
    </main>
  );
}
