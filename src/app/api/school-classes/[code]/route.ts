import { classError, readSchoolClass } from "@/lib/school-class-server";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  try { return await readSchoolClass((await context.params).code); }
  catch (error) { return classError(error); }
}
