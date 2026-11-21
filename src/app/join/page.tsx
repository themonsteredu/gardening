import { JoinExperience } from "@/components/student/JoinExperience";
import { normalizeClassCode } from "@/lib/class-code";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string | string[]; code?: string | string[] }>;
}) {
  const { campus, code } = await searchParams;
  const initialCode = typeof code === "string" ? normalizeClassCode(code).slice(0, 10) : "";
  const bongsunPreset = !initialCode && campus === "bongsun";
  return <JoinExperience key={initialCode || (bongsunPreset ? "bongsun" : "class")}
    bongsunPreset={bongsunPreset} initialCode={initialCode} />;
}
