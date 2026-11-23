import { classError, createSchoolClass } from "@/lib/school-class-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try { return await createSchoolClass(request); }
  catch (error) { return classError(error); }
}
