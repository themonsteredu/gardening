import type { Metadata } from "next";
import { CampusBuilder } from "@/components/teacher/CampusBuilder";

export const metadata: Metadata = { title: "학교 본관 만들기 | 가드닝 커리어 랩" };

export default function TeacherCampusesPage() {
  return <CampusBuilder />;
}
