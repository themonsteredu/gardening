import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LandscapeGalleryEntry, SchoolProject } from "@/domain/models";

type Command = "create" | "get" | "list" | "submit";
type Result = { status: number; project?: SchoolProject; entries?: LandscapeGalleryEntry[] };
type LocalClass = { project: SchoolProject; teacherHash: string };
type LocalWork = { entry: LandscapeGalleryEntry; editHash: string };

async function readRecord<T>(filename: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filename, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

// Hard-linking a fully written file claims an ID exclusively across processes.
// Replacement keeps that original owner's digest and publishes with an atomic rename.
async function writeRecord(filename: string, value: LocalClass | LocalWork, exclusive: boolean) {
  const temporary = filename + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temporary, JSON.stringify(value), { flag: "wx", mode: 0o600 });
    if (exclusive) await link(temporary, filename);
    else await rename(temporary, filename);
    return true;
  } catch (error) {
    if (exclusive && (error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  } finally {
    await rm(temporary, { force: true });
  }
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export async function runLocalSchoolCommand(
  command: Command,
  code: string,
  payload: Record<string, unknown>,
  directory = path.join(process.cwd(), "work", "school-classes"),
): Promise<Result> {
  if (process.env.VERCEL || !["development", "test"].includes(process.env.NODE_ENV)) {
    throw new Error("로컬 수업 저장소는 개발 환경에서만 사용할 수 있습니다.");
  }
  if (!/^[A-Z0-9]{6,10}$/.test(code)) return { status: 400 };

  const folder = path.join(directory, code);
  const classFile = path.join(folder, "class.json");
  if (command === "create") {
    const project = payload.project as SchoolProject | undefined;
    const teacherHash = payload.teacherHash;
    if (!project?.id || project.classCode !== code || !isDigest(teacherHash)) return { status: 400 };
    await mkdir(folder, { recursive: true, mode: 0o700 });
    if (await writeRecord(classFile, { project, teacherHash }, true)) return { status: 201, project };
    const existing = await readRecord<LocalClass>(classFile);
    return existing?.teacherHash === teacherHash ? { status: 200, project: existing.project } : { status: 409 };
  }

  const room = await readRecord<LocalClass>(classFile);
  if (!room) return { status: 404 };
  if (command === "get") return { status: 200, project: room.project };

  if (command === "list") {
    const files = (await readdir(folder)).filter(file => /^[a-f0-9]{64}\.json$/.test(file));
    const works = await Promise.all(files.map(file => readRecord<LocalWork>(path.join(folder, file))));
    const entries = works.flatMap(work => work ? [work.entry] : [])
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || a.id.localeCompare(b.id));
    return { status: 200, entries };
  }

  const entry = payload.entry as LandscapeGalleryEntry | undefined;
  const editHash = payload.editHash;
  if (!entry?.studentSessionId || entry.schoolProjectId !== room.project.id || !isDigest(editHash)) {
    return { status: 400 };
  }

  const sessionDigest = createHash("sha256").update(entry.studentSessionId).digest("hex");
  const workFile = path.join(folder, sessionDigest + ".json");
  if (await writeRecord(workFile, { entry, editHash }, true)) return { status: 200 };
  const existing = await readRecord<LocalWork>(workFile);
  if (existing?.editHash !== editHash) return { status: 403 };
  await writeRecord(workFile, { entry, editHash }, false);
  return { status: 200 };
}
