import type { MiniGardenKit, MiniMaterialType, StudentMiniGardenDesign } from "@/domain/models";
import { normalizeMiniGardenLayerOrder } from "@/lib/mini-garden-layers";

export type MiniGardenMakingPhase = "prepare" | "layer" | "plant" | "place" | "finish";

export interface MiniGardenMakingPlanStep {
  id: string;
  phase: MiniGardenMakingPhase;
  title: string;
  instruction: string;
  materialId: string | null;
  amountLabel: string;
}

const OBJECT_MAKING_ORDER: Array<Exclude<MiniMaterialType, "layer">> = [
  "plant",
  "structure",
  "object",
  "scatter",
];

export const MINI_GARDEN_MAKING_PHASE_LABELS: Record<MiniGardenMakingPhase, string> = {
  prepare: "작업 준비",
  layer: "바닥층 만들기",
  plant: "식재",
  place: "장식 배치",
  finish: "마무리",
};

function withObjectParticle(name: string): string {
  const lastCode = name.charCodeAt(name.length - 1);
  const hasFinalConsonant = lastCode >= 0xac00 && lastCode <= 0xd7a3
    ? (lastCode - 0xac00) % 28 !== 0
    : true;
  return `${name}${hasFinalConsonant ? "을" : "를"}`;
}

export function createMiniGardenMakingPlan(
  design: StudentMiniGardenDesign,
  kit: MiniGardenKit,
): MiniGardenMakingPlanStep[] {
  const materialMap = new Map(kit.materials.map((material) => [material.id, material]));
  const usedMaterialIds = new Set([
    ...design.layers.map((layer) => layer.materialId),
    ...design.objects.map((object) => object.materialId),
  ]);
  const steps: MiniGardenMakingPlanStep[] = [{
    id: "prepare-pot-and-materials",
    phase: "prepare",
    title: "화분과 실제 재료 확인",
    instruction: `${kit.potPreset.widthCm}×${kit.potPreset.depthCm}×${kit.potPreset.heightCm}cm 투명화분과 설계에 사용한 실제 재료 ${usedMaterialIds.size}종을 작업대에 준비하세요.`,
    materialId: null,
    amountLabel: `화분 1개 · 재료 ${usedMaterialIds.size}종`,
  }];

  normalizeMiniGardenLayerOrder(design.layers).forEach((layer, index) => {
    const material = materialMap.get(layer.materialId);
    const name = material?.name ?? "등록이 변경된 층 재료";
    steps.push({
      id: `layer-${layer.id}`,
      phase: "layer",
      title: `${index + 1}층 · ${name}`,
      instruction: `${index === 0 ? "화분 바닥" : "바로 아래층 위"}에 ${name}를 ${layer.heightCm}cm 높이로 고르게 펴고, 투명 옆면에서 수평을 확인하세요.`,
      materialId: layer.materialId,
      amountLabel: `${layer.heightCm}cm 높이`,
    });
  });

  for (const type of OBJECT_MAKING_ORDER) {
    const materials = kit.materials.filter((material) => material.type === type);
    for (const material of materials) {
      const objects = design.objects.filter((object) => object.materialId === material.id);
      if (objects.length === 0) continue;
      if (type === "plant") {
        steps.push({ id: `objects-${material.id}`, phase: "plant", title: `${material.name} 심기`, instruction: `3D 설계의 위치와 방향을 보면서 ${material.name} ${objects.length}개를 심고, 뿌리 주변의 층 재료를 가볍게 눌러 고정하세요.`, materialId: material.id, amountLabel: `${objects.length}개` });
      } else if (type === "scatter") {
        steps.push({ id: `objects-${material.id}`, phase: "finish", title: `${material.name} 표면 마감`, instruction: `식물과 장식의 위치가 흐트러지지 않도록 ${withObjectParticle(material.name)} 설계한 영역에 얇고 고르게 펼치세요.`, materialId: material.id, amountLabel: `${objects.length}개 영역` });
      } else {
        steps.push({ id: `objects-${material.id}`, phase: "place", title: `${material.name} 배치`, instruction: `3D 설계의 위치·크기·회전 방향을 확인하며 ${material.name} ${objects.length}개를 놓고 흔들리지 않게 고정하세요.`, materialId: material.id, amountLabel: `${objects.length}개` });
      }
    }
  }

  steps.push({
    id: "finish-compare-model",
    phase: "finish",
    title: "모델링과 최종 비교",
    instruction: "화분을 정면·측면·위에서 살펴보고 색모래 층, 식물, 돌과 장식의 위치가 3D 설계와 같은지 확인하세요.",
    materialId: null,
    amountLabel: "전체 점검 1회",
  });
  return steps;
}

export function estimateMiniGardenMakingMinutes(steps: MiniGardenMakingPlanStep[]): number {
  return Math.max(5, 3 + steps.reduce((minutes, step) => minutes + (step.phase === "layer" ? 3 : step.phase === "prepare" ? 2 : 2), 0));
}

export function getMakingPlanProgress(completedIds: string[], steps: MiniGardenMakingPlanStep[]): { completed: number; total: number; percent: number } {
  const validIds = new Set(steps.map((step) => step.id));
  const completed = new Set(completedIds.filter((id) => validIds.has(id))).size;
  return { completed, total: steps.length, percent: steps.length === 0 ? 0 : Math.round((completed / steps.length) * 100) };
}
