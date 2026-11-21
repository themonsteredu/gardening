import { searchSchools } from "@/lib/school-directory";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 80) return Response.json({ schools: [] }, { status: 400 });
  const result = await searchSchools(query);
  return Response.json(result, { headers: { "Cache-Control": result.notice ? "no-store" : "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
