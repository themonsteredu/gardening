import { createHash, createHmac, randomUUID } from "node:crypto";
import { ZodError } from "zod";
import type { LandscapeGalleryEntry, SchoolProject } from "@/domain/models";
import { DEMO_MINI_GARDEN_KIT } from "@/data/demo-mini-garden";
import { runLocalSchoolCommand } from "./school-class-dev-store";
import { parseClassCreation, parseWorkSubmission } from "./school-class-validation";

type Command = "create" | "get" | "list" | "submit";
interface CommandResult {
  status: number;
  project?: SchoolProject;
  entries?: LandscapeGalleryEntry[];
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function localDevelopment() {
  return !process.env.VERCEL && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test");
}

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function classError(error: unknown) {
  if (error instanceof HttpError) return reply({ error: error.message }, error.status);
  if (error instanceof ZodError) return reply({ error: "입력한 수업 정보와 작품을 확인해 주세요." }, 400);
  return reply({ error: "수업 저장소에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." }, 503);
}

async function readBody(request: Request, limit: number) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "JSON 형식의 요청이 필요해요.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "수업 정보가 비어 있어요.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new HttpError(413, "첨부한 사진이나 작품이 너무 커요.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new HttpError(400, "요청을 읽지 못했어요."); }
}

function classCode(raw: string) {
  const code = raw.toUpperCase();
  if (!/^[A-Z0-9]{6,10}$/.test(code)) throw new HttpError(404, "수업을 찾을 수 없어요.");
  return code;
}

async function execute(command: Command, code: string, payload: Record<string, unknown> = {}): Promise<CommandResult> {
  const host = process.env.GARDENING_SUPABASE_URL;
  const key = process.env.GARDENING_SUPABASE_PUBLISHABLE_KEY;
  const token = process.env.GARDENING_STORAGE_TOKEN;
  if (!host && !key && !token && localDevelopment()) return runLocalSchoolCommand(command, code, payload);
  if (!host || !key || !token) throw new Error("Shared class storage is not configured");
  const response = await fetch(new URL("/rest/v1/rpc/gardening_class_command", host), {
    method: "POST",
    cache: "no-store",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, p_operation: command, p_code: code, p_payload: payload }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("Shared class storage failed");
  return await response.json() as CommandResult;
}

function verify(result: CommandResult) {
  if (result.status >= 200 && result.status < 300) return;
  if (result.status === 404) throw new HttpError(404, "수업을 찾을 수 없어요.");
  if (result.status === 403) throw new HttpError(403, "처음 제출한 기기에서 내 작품을 수정할 수 있어요.");
  if (result.status === 400) throw new HttpError(400, "이 반의 작품인지 확인해 주세요.");
  throw new Error("Unexpected storage status");
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function createSchoolClass(request: Request) {
  const { campus, className, idempotencyKey } = parseClassCreation(await readBody(request, 500_000));
  const secret = process.env.GARDENING_STORAGE_TOKEN || (localDevelopment() ? "development-school-garden" : "");
  if (!secret) throw new Error("Shared class storage is not configured");
  const seed = (idempotencyKey || randomUUID()) + hash(JSON.stringify([campus, className]));
  const derive = (label: string) => createHmac("sha256", secret).update(label).update(seed).digest();
  const teacherKey = derive("teacher:").toString("hex");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 5; attempt++) {
    const entropy = derive("code:" + attempt + ":");
    const code = Array.from(entropy.subarray(0, 9), byte => alphabet[byte % alphabet.length]).join("");
    const project: SchoolProject = {
      id: "class-" + derive("id:").subarray(0, 16).toString("hex"), sharedClass: true, campusModel: campus,
      schoolName: campus.schoolName, className, title: campus.schoolName + " 본관 정원 꾸미기",
      mission: "우리 학교 본관 앞마당과 뒤뜰을 지나는 친구들을 위한 정원을 설계해 보세요.",
      classCode: code, status: "open", createdAt: new Date().toISOString(), siteImageId: null,
      miniGardenKitId: DEMO_MINI_GARDEN_KIT.id,
    };
    const result = await execute("create", code, { project, teacherHash: hash(teacherKey) });
    if (result.status === 409) continue;
    verify(result);
    return reply({ project: result.project, teacherKey }, result.status);
  }
  throw new Error("Could not allocate a class code");
}

export async function readSchoolClass(raw: string) {
  const result = await execute("get", classCode(raw));
  verify(result);
  return reply({ project: result.project });
}

export async function listSchoolWorks(raw: string) {
  const result = await execute("list", classCode(raw));
  verify(result);
  return reply({ entries: result.entries });
}

export async function submitSchoolWork(raw: string, request: Request) {
  const { entry, editKey } = parseWorkSubmission(await readBody(request, 1_500_000));
  const result = await execute("submit", classCode(raw), { entry, editHash: hash(editKey) });
  verify(result);
  return reply({ saved: true });
}
