import { JoinExperience } from "@/components/student/JoinExperience";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string | string[] }>;
}) {
  const { campus } = await searchParams;
  const bongsunPreset = campus === "bongsun";
  return <JoinExperience key={bongsunPreset ? "bongsun" : "class"} bongsunPreset={bongsunPreset} />;
}
