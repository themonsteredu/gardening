import { z } from "zod";
import { findLandscapeMaterial } from "@/data/landscape-materials";
import type { LandscapeGalleryEntry } from "@/domain/models";
import type { CampusModel } from "./campus-model";

const identifier = z.string().min(1).max(145).regex(/^[a-zA-Z0-9_-]+$/);
const color = z.string().regex(/^#[a-f0-9]{6}$/i);
const gardenSide = z.enum(["front", "rear"]).optional();

function rasterDataUrl(maxLength: number) {
  return z.string().max(maxLength).refine(value => {
    if (value.length > maxLength) return false;
    const [, format, data] = /^data:image\/(jpeg|png|webp);base64,([a-zA-Z0-9+/]+={0,2})$/.exec(value) || [];
    if (!data || data.length % 4 !== 0) return false;
    const header = Buffer.from(data.slice(0, 16), "base64");
    if (format === "jpeg") return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    if (format === "png") return header.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
    return header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP";
  }, "이미지 형식이나 용량을 확인해 주세요.");
}

const campus = z.strictObject({
  id: identifier,
  kind: z.enum(["generated", "bongsun"]),
  schoolName: z.string().trim().min(2).max(60),
  region: z.string().trim().max(100),
  floors: z.number().int().min(1).max(6),
  bays: z.number().int().min(4).max(16),
  wallColor: color,
  roofColor: color,
  frontPhoto: rasterDataUrl(230_000).optional(),
  logo: rasterDataUrl(100_000).optional(),
  sourceUrl: z.url({ protocol: /^https?$/ }).max(2_048).refine(value => {
    const parsed = URL.parse(value);
    return parsed !== null && !parsed.username && !parsed.password;
  }).optional(),
}) satisfies z.ZodType<CampusModel>;

const classCreation = z.strictObject({
  campus,
  className: z.string().trim().min(1).max(50),
  idempotencyKey: z.uuid().optional(),
});

const coordinate = z.number().min(0).max(1);
const point = z.strictObject({ x: coordinate, y: coordinate });
const object = z.strictObject({
  id: identifier,
  gardenSide,
  materialId: z.string().min(1).max(48),
  x: coordinate,
  y: coordinate,
  scale: z.number().min(0.5).max(2),
  rotation: z.number().min(0).max(360),
  width: z.number().positive().max(30),
  height: z.number().positive().max(30),
  category: z.enum(["planting", "paving", "facility", "scenery"]),
  zIndex: z.number().int().min(0).max(65_535),
}).refine(value => findLandscapeMaterial(value.materialId)?.category === value.category, "조경 재료를 확인해 주세요.");

const stroke = z.strictObject({
  id: identifier,
  gardenSide,
  materialId: z.enum(["bare-soil", "lawn-surface", "walking-path", "paving", "gravel-surface", "sand-surface"]),
  points: z.array(point).min(1).max(6_000),
  widthMeters: z.number().positive().max(10),
  zIndex: z.number().int().min(0).max(65_535),
});

const work = z.strictObject({
  id: identifier,
  studentSessionId: identifier,
  schoolProjectId: identifier,
  nickname: z.string().trim().min(1).max(12),
  sceneVersion: z.enum(["photo-plan-v1", "sample-middle-school-v1", "sample-middle-school-v2", "bongsun-facade-v1", "generated-campus-v1"]).optional(),
  objects: z.array(object).max(1_000),
  surfaceStrokes: z.array(stroke).max(1_000).optional(),
  intentionKeyword: z.enum(["휴식", "녹지", "이동", "경관", "자연친화", "놀이", "기타"]),
  intentionReason: z.string().trim().min(8).max(180),
  submittedAt: z.iso.datetime({ offset: true }),
}).refine(entry => entry.objects.length > 0 || Boolean(entry.surfaceStrokes?.length), "작품에 조경물이나 바닥이 필요해요.") satisfies z.ZodType<LandscapeGalleryEntry>;

const workSubmission = z.strictObject({
  entry: work,
  editKey: z.string().regex(/^[0-9a-f]{64}$/),
});

export function parseClassCreation(value: unknown) {
  return classCreation.parse(value);
}

export function parseWorkSubmission(value: unknown) {
  return workSubmission.parse(value);
}
