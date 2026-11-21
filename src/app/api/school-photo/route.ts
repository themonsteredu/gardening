import { schoolPhotoReferences } from "@/data/school-photo-references";
import { getDirectorySchool } from "@/lib/school-directory";
import { discoverSchoolPhotos } from "@/lib/school-photo-discovery";

export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get("schoolCode") ?? "";
  const name = params.get("schoolName")?.trim() ?? "";
  if (!/^\d{7}$/.test(code) || !name || name.length > 70) return Response.json({ images: [] }, { status: 400 });
  const school = await getDirectorySchool(code, name).catch(() => null);
  if (!school) return Response.json({ images: [], notice: "학교 정보를 확인하지 못했어요. 본관 사진을 직접 올릴 수 있어요." });
  const cache = { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" };
  const reference = schoolPhotoReferences[code];
  if (reference?.schoolName === school.schoolName) {
    return Response.json({ homepage: reference.homepage, images: [{ url: reference.url, originalUrl: reference.originalUrl, label: "공식 홈페이지 학교 전경" }] }, { headers: cache });
  }
  const images = await discoverSchoolPhotos(school.homepage, AbortSignal.timeout(10000)).catch(() => []);
  return Response.json({ homepage: school.homepage, images, ...(images.length ? {} : { notice: "자동으로 확인할 전경 사진이 없어요. 본관 사진을 직접 올려 주세요." }) }, { headers: images.length ? cache : { "Cache-Control": "no-store" } });
}
