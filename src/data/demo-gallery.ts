import type { LandscapeGalleryEntry, LandscapeMaterialCategory, LandscapeObject } from "@/domain/models";
import { DEMO_PROJECT } from "@/data/demo-project";

function object(
  id: string,
  materialId: string,
  category: LandscapeMaterialCategory,
  x: number,
  y: number,
  scale = 1,
  rotation = 0,
): LandscapeObject {
  return { id, materialId, category, x, y, scale, rotation, width: 2, height: 2, zIndex: 1 };
}

export const DEMO_GALLERY_ENTRIES: LandscapeGalleryEntry[] = [
  {
    id: "gallery-minji",
    studentSessionId: "gallery-student-minji",
    schoolProjectId: DEMO_PROJECT.id,
    nickname: "민지",
    intentionKeyword: "휴식",
    intentionReason: "큰 나무 아래에 벤치와 화단을 두어 친구들이 편하게 이야기할 수 있게 했습니다.",
    submittedAt: "2026-08-17T09:21:00.000Z",
    objects: [
      object("m-1", "tree-canopy", "planting", 0.59, 0.42, 1.15),
      object("m-2", "tree-canopy", "planting", 0.72, 0.43),
      object("m-3", "bench", "facility", 0.65, 0.58, 1, 15),
      object("m-4", "flower-bed", "scenery", 0.78, 0.61, 1.2),
    ],
  },
  {
    id: "gallery-junho",
    studentSessionId: "gallery-student-junho",
    schoolProjectId: DEMO_PROJECT.id,
    nickname: "준호",
    intentionKeyword: "녹지",
    intentionReason: "기존 나무와 이어지는 녹지 띠를 만들고 가운데는 넓게 비워 두었습니다.",
    submittedAt: "2026-08-17T09:24:00.000Z",
    objects: [
      object("j-1", "shrub", "planting", 0.54, 0.39, 1.2),
      object("j-2", "shrub", "planting", 0.61, 0.39, 1.2),
      object("j-3", "shrub", "planting", 0.68, 0.39, 1.2),
      object("j-4", "lawn", "planting", 0.67, 0.56, 1.8),
      object("j-5", "tree-canopy", "planting", 0.78, 0.44),
    ],
  },
  {
    id: "gallery-seoyeon",
    studentSessionId: "gallery-student-seoyeon",
    schoolProjectId: DEMO_PROJECT.id,
    nickname: "서연",
    intentionKeyword: "이동",
    intentionReason: "출입구에서 운동장까지 자연스럽게 걸을 수 있도록 디딤석 동선을 연결했습니다.",
    submittedAt: "2026-08-17T09:26:00.000Z",
    objects: [
      object("s-1", "stepping-stone", "paving", 0.53, 0.62, 1, -24),
      object("s-2", "stepping-stone", "paving", 0.61, 0.57, 1, -24),
      object("s-3", "stepping-stone", "paving", 0.69, 0.52, 1, -24),
      object("s-4", "stepping-stone", "paving", 0.77, 0.47, 1, -24),
      object("s-5", "light", "facility", 0.63, 0.48),
    ],
  },
  {
    id: "gallery-jiho",
    studentSessionId: "gallery-student-jiho",
    schoolProjectId: DEMO_PROJECT.id,
    nickname: "지호",
    intentionKeyword: "경관",
    intentionReason: "작은 연못을 중심으로 계절마다 색이 달라지는 식물을 둘러 배치했습니다.",
    submittedAt: "2026-08-17T09:29:00.000Z",
    objects: [
      object("h-1", "pond", "scenery", 0.67, 0.52, 1.35),
      object("h-2", "maple", "planting", 0.55, 0.44),
      object("h-3", "flower", "planting", 0.76, 0.43, 1.4),
      object("h-4", "rock", "scenery", 0.79, 0.58),
    ],
  },
];
