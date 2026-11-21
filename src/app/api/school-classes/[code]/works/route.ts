import { classError, listSchoolWorks, submitSchoolWork } from "@/lib/school-class-server";

export const runtime = "nodejs";

type Context = { params: Promise<{ code: string }> };

export async function GET(_request: Request, context: Context) {
  try { return await listSchoolWorks((await context.params).code); }
  catch (error) { return classError(error); }
}

export async function POST(request: Request, context: Context) {
  try { return await submitSchoolWork((await context.params).code, request); }
  catch (error) { return classError(error); }
}
