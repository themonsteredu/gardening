import { StudentJourney } from "@/components/student/StudentJourney";

export default async function StudentProjectPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <StudentJourney sessionId={sessionId} />;
}
