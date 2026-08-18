import type { SchoolProject, StudentSession } from "@/domain/models";

export const DEMO_CLASS_CODE = "GARDEN24";

export const DEMO_PROJECT: SchoolProject = {
  id: "project-demo-garden",
  schoolName: "푸른솔중학교",
  className: "1학년 3반",
  title: "우리 학교 쉼정원 만들기",
  mission:
    "중앙의 빈 공간을 학생들이 쉬고 이야기할 수 있는 작은 휴식정원으로 설계하세요.",
  classCode: DEMO_CLASS_CODE,
  status: "draft",
  createdAt: "2026-08-17T00:00:00.000Z",
  siteImageId: null,
  miniGardenKitId: null,
};

export const DEMO_STUDENTS: StudentSession[] = [
  {
    id: "student-minji",
    classroomId: "classroom-demo",
    nickname: "민지",
    stage: "site_design",
    joinedAt: "2026-08-17T09:00:00.000Z",
    updatedAt: "2026-08-17T09:14:00.000Z",
  },
  {
    id: "student-junho",
    classroomId: "classroom-demo",
    nickname: "준호",
    stage: "submitted",
    joinedAt: "2026-08-17T09:01:00.000Z",
    updatedAt: "2026-08-17T09:21:00.000Z",
  },
  {
    id: "student-seoyeon",
    classroomId: "classroom-demo",
    nickname: "서연",
    stage: "mini_model",
    joinedAt: "2026-08-17T09:02:00.000Z",
    updatedAt: "2026-08-17T09:29:00.000Z",
  },
];

export const PROJECT_FLOW = [
  {
    part: "PART 1",
    title: "우리 학교 실제 공간 조경설계",
    description: "실제 학교 사진 위에 조경 재료를 바로 배치합니다.",
    steps: ["학교 사진 꾸미기", "설계 의도 기록", "친구 작품 비교"],
  },
  {
    part: "PART 2",
    title: "미니 조경 모델링과 실제 제작",
    description: "수업에서 받을 화분과 재료를 먼저 3D로 설계합니다.",
    steps: ["오늘의 키트 확인", "투명화분 모델링", "제작 순서 확인", "실제 작품 제작"],
  },
] as const;
