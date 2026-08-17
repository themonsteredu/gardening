import type {
  SchoolProject,
  StudentLandscapeDesign,
  StudentMiniGardenDesign,
  StudentProgressSummary,
  StudentSession,
} from "@/domain/models";

export interface CreateSchoolProjectInput {
  schoolName: string;
  className: string;
  title: string;
  mission: string;
}

export interface JoinClassroomInput {
  classCode: string;
  nickname: string;
}

/**
 * 브라우저 데모 저장과 향후 Supabase 저장이 동일한 계약을 사용한다.
 * 화면 컴포넌트는 실제 저장 위치를 알 필요가 없다.
 */
export interface GardeningRepository {
  createProject(input: CreateSchoolProjectInput): Promise<SchoolProject>;
  updateProject(
    id: string,
    patch: Partial<Omit<SchoolProject, "id" | "createdAt">>,
  ): Promise<SchoolProject | null>;
  getProjectById(id: string): Promise<SchoolProject | null>;
  getProjectByCode(classCode: string): Promise<SchoolProject | null>;

  joinClassroom(input: JoinClassroomInput): Promise<StudentSession>;
  listStudents(schoolProjectId: string): Promise<StudentSession[]>;
  getProgress(schoolProjectId: string): Promise<StudentProgressSummary>;

  saveLandscapeDesign(design: StudentLandscapeDesign): Promise<void>;
  getLandscapeDesign(
    studentSessionId: string,
  ): Promise<StudentLandscapeDesign | null>;

  saveMiniGardenDesign(design: StudentMiniGardenDesign): Promise<void>;
  getMiniGardenDesign(
    studentSessionId: string,
  ): Promise<StudentMiniGardenDesign | null>;
}
