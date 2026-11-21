import type { SchoolProject } from "@/domain/models";
import { PROJECT_STORAGE_KEY } from "./project-store";
import { writeBrowserStorage } from "./use-browser-storage";

export interface CampusModel {
  id: string;
  kind: "generated" | "bongsun";
  schoolName: string;
  region: string;
  floors: number;
  bays: number;
  wallColor: string;
  roofColor: string;
  frontPhoto?: string;
  logo?: string;
  sourceUrl?: string;
}

export const BONGSUN_CAMPUS: CampusModel = {
  id: "bongsun-official", kind: "bongsun", schoolName: "봉선중학교", region: "광주광역시 남구",
  floors: 3, bays: 16, wallColor: "#ad7963", roofColor: "#718777",
  sourceUrl: "https://bongsun.jge.ms.kr",
};

const TABLE = "campuses";
function openCatalog(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("gardening-school-catalog", 1);
    request.onupgradeneeded = () => request.result.createObjectStore(TABLE, { keyPath: "id" });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function listCampusModels(): Promise<CampusModel[]> {
  const db = await openCatalog();
  try {
    const models = await new Promise<CampusModel[]>((resolve, reject) => {
      const request = db.transaction(TABLE).objectStore(TABLE).getAll();
      request.onsuccess = () => resolve(request.result as CampusModel[]);
      request.onerror = () => reject(request.error);
    });
    return [BONGSUN_CAMPUS, ...models.filter(model => model.id !== BONGSUN_CAMPUS.id)
      .sort((a, b) => a.schoolName.localeCompare(b.schoolName, "ko"))];
  } finally { db.close(); }
}

export async function saveCampusModel(model: CampusModel): Promise<void> {
  if (model.id === BONGSUN_CAMPUS.id) return;
  const db = await openCatalog();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(TABLE, "readwrite");
      tx.onabort = tx.onerror = () => reject(tx.error || new Error("학교 모형을 저장하지 못했어요."));
      tx.oncomplete = () => resolve();
      tx.objectStore(TABLE).put(model);
    });
  } finally { db.close(); }
}

export const CLASS_HISTORY_KEY = "gardening.teacher.shared-classes.v1";
interface SavedClass {
  code: string;
  schoolName: string;
  className: string;
  teacherKey: string;
}

export function readSchoolClasses(raw: string | null): SavedClass[] {
  if (!raw) return [];
  try {
    const items: unknown = JSON.parse(raw);
    return Array.isArray(items) ? items.filter(item => item && typeof item.code === "string"
      && typeof item.schoolName === "string" && typeof item.className === "string" && typeof item.teacherKey === "string") : [];
  } catch { return []; }
}

export function rememberSchoolClass(project: SchoolProject, teacherKey: string): void {
  const classes = readSchoolClasses(localStorage.getItem(CLASS_HISTORY_KEY));
  const { classCode: code, schoolName, className } = project;
  writeBrowserStorage("local", CLASS_HISTORY_KEY,
    JSON.stringify([{ code, schoolName, className, teacherKey }, ...classes.filter(item => item.code !== code)]));
  writeBrowserStorage("local", PROJECT_STORAGE_KEY, JSON.stringify(project));
}
