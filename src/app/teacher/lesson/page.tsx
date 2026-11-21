import type { Metadata } from "next";
import { LandscapeLesson } from "@/components/teacher/LandscapeLesson";

export const metadata: Metadata = { title: "조경전문가 수업 PPT | 가드닝 커리어 랩" };

export default function TeacherLessonPage() {
  return <LandscapeLesson />;
}
