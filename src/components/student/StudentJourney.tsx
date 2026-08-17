"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LandscapeDesignStudio } from "@/components/student/LandscapeDesignStudio";
import { Landscape3DPreview } from "@/components/student/Landscape3DPreview";
import { LandscapeIntentionForm } from "@/components/student/LandscapeIntentionForm";
import { ClassLandscapeGallery } from "@/components/student/ClassLandscapeGallery";
import { MiniGardenPotStudio } from "@/components/student/MiniGardenPotStudio";
import { MiniGardenSandStudio } from "@/components/student/MiniGardenSandStudio";
import { MiniGardenObjectStudio } from "@/components/student/MiniGardenObjectStudio";
import { MiniGardenMakingPlan } from "@/components/student/MiniGardenMakingPlan";
import { MiniGardenFinalComparison } from "@/components/student/MiniGardenFinalComparison";
import { DEMO_PROJECT } from "@/data/demo-project";
import type { SchoolProject, StudentSession } from "@/domain/models";
import { getStudentSessionStorageKey, parseStoredProject, PROJECT_STORAGE_KEY } from "@/lib/project-store";
import { useBrowserStorageValue } from "@/lib/use-browser-storage";

interface StoredStudentContext {
  session: StudentSession;
  project: SchoolProject;
}

export function StudentJourney({ sessionId }: { sessionId: string }) {
  const fallbackContext = useMemo<StoredStudentContext>(() => ({
    session: {
      id: sessionId,
      classroomId: DEMO_PROJECT.id,
      nickname: "설계자",
      stage: "joined",
      joinedAt: DEMO_PROJECT.createdAt,
      updatedAt: DEMO_PROJECT.createdAt,
    },
    project: DEMO_PROJECT,
  }), [sessionId]);
  const [view, setView] = useState<"design" | "preview3d" | "intention" | "gallery" | "miniPot" | "sandLayers" | "objectPlacement" | "makingPlan" | "finalComparison">("design");
  const studentStorageKey = getStudentSessionStorageKey(sessionId);
  const sessionContext = useBrowserStorageValue(
    "session",
    studentStorageKey,
  );
  const localContext = useBrowserStorageValue("local", studentStorageKey);
  const teacherProjectValue = useBrowserStorageValue("local", PROJECT_STORAGE_KEY);
  const teacherProject = useMemo(() => parseStoredProject(teacherProjectValue), [teacherProjectValue]);
  const storedContext = sessionContext ?? localContext;
  const context = useMemo(() => {
    if (!storedContext) return { ...fallbackContext, project: teacherProject };
    try {
      const parsed = JSON.parse(storedContext) as StoredStudentContext;
      return { ...parsed, project: teacherProject.id === parsed.project.id ? teacherProject : parsed.project };
    } catch {
      return { ...fallbackContext, project: teacherProject };
    }
  }, [fallbackContext, storedContext, teacherProject]);
  const isMiniGardenView = view === "miniPot" || view === "sandLayers" || view === "objectPlacement" || view === "makingPlan" || view === "finalComparison";
  const journeyStep = view === "gallery" ? 1 : isMiniGardenView && view !== "makingPlan" && view !== "finalComparison" ? 2 : view === "makingPlan" || view === "finalComparison" ? 3 : 0;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);

  return (
    <div className="studio-shell">
      <header className="studio-header studio-header--simple">
        <Link className="brand brand--light" href="/">
          <span className="brand-mark" aria-hidden="true"><span /><span /></span>
          <span><strong>조경전문가</strong><small>직업체험</small></span>
        </Link>
        <div className="studio-project-name">
          <small>{context.project.schoolName} · {context.project.className}</small>
          <strong>{context.project.title}</strong>
        </div>
        <div className="student-identity">
          <span>{context.session.nickname.slice(0, 1)}</span>
          <div><small>나의 작업</small><strong>{context.session.nickname}</strong></div>
        </div>
      </header>

      <div className="studio-progress studio-progress--simple" aria-label="체험 진행 단계">
        <div className="progress-steps">
          {["학교조경", "친구작품", "미니조경", "실제제작"].map((label, index) => (
            <div className={journeyStep === index ? "is-current" : journeyStep > index ? "is-done" : ""} key={label}>
              <span>{index + 1}</span><small>{label}</small>
            </div>
          ))}
        </div>
      </div>

      {view === "design" ? (
        <LandscapeDesignStudio
          project={context.project}
          nickname={context.session.nickname}
          sessionId={context.session.id}
          onPreview3D={() => setView("preview3d")}
          onContinue={() => setView("intention")}
        />
      ) : view === "preview3d" ? (
        <Landscape3DPreview
          project={context.project}
          nickname={context.session.nickname}
          sessionId={context.session.id}
          onBack={() => setView("design")}
          onContinue={() => setView("intention")}
        />
      ) : view === "intention" ? (
        <LandscapeIntentionForm
          project={context.project}
          nickname={context.session.nickname}
          sessionId={context.session.id}
          onBack={() => setView("design")}
          onPreview3D={() => setView("preview3d")}
          onSubmitted={() => setView("gallery")}
        />
      ) : view === "gallery" ? (
        <ClassLandscapeGallery
          project={context.project}
          nickname={context.session.nickname}
          sessionId={context.session.id}
          onBack={() => setView("intention")}
          onContinue={() => setView("miniPot")}
        />
      ) : view === "miniPot" ? (
        <MiniGardenPotStudio
          project={context.project}
          nickname={context.session.nickname}
          onBack={() => setView("gallery")}
          onContinue={() => setView("sandLayers")}
        />
      ) : view === "sandLayers" ? (
        <MiniGardenSandStudio
          project={context.project}
          nickname={context.session.nickname}
          sessionId={context.session.id}
          onBack={() => setView("miniPot")}
          onContinue={() => setView("objectPlacement")}
        />
      ) : view === "objectPlacement" ? (
        <MiniGardenObjectStudio
          project={context.project}
          nickname={context.session.nickname}
          sessionId={context.session.id}
          onBack={() => setView("sandLayers")}
          onContinue={() => setView("makingPlan")}
        />
      ) : view === "makingPlan" ? (
        <MiniGardenMakingPlan
          project={context.project}
          nickname={context.session.nickname}
          sessionId={context.session.id}
          onBack={() => setView("objectPlacement")}
          onContinue={() => setView("finalComparison")}
        />
      ) : (
        <MiniGardenFinalComparison
          project={context.project}
          nickname={context.session.nickname}
          sessionId={context.session.id}
          onBack={() => setView("makingPlan")}
        />
      )}
    </div>
  );
}
