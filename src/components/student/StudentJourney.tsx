"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SampleSchool3DStudio } from "@/components/student/SampleSchool3DStudio";
import { LandscapeIntentionForm } from "@/components/student/LandscapeIntentionForm";
import { ClassLandscapeGallery } from "@/components/student/ClassLandscapeGallery";
import { MiniGardenPotStudio } from "@/components/student/MiniGardenPotStudio";
import { MiniGardenSandStudio } from "@/components/student/MiniGardenSandStudio";
import { MiniGardenObjectStudio } from "@/components/student/MiniGardenObjectStudio";
import { MiniGardenMakingPlan } from "@/components/student/MiniGardenMakingPlan";
import { MiniGardenFinalComparison } from "@/components/student/MiniGardenFinalComparison";
import { DEMO_MINI_GARDEN_KIT } from "@/data/demo-mini-garden";
import { DEMO_PROJECT } from "@/data/demo-project";
import type { SchoolProject, StudentSession } from "@/domain/models";
import { getStudentSessionStorageKey, MINI_GARDEN_KITS_STORAGE_KEY, parseStoredMiniGardenKits, parseStoredProject, PROJECT_STORAGE_KEY } from "@/lib/project-store";
import { useBrowserStorageValue, writeBrowserStorage } from "@/lib/use-browser-storage";

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
  const [view, setView] = useState<"design" | "intention" | "gallery" | "miniPot" | "sandLayers" | "objectPlacement" | "makingPlan" | "finalComparison">("design");
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
  const project = context.project.miniGardenKitId
    ? context.project
    : { ...context.project, miniGardenKitId: DEMO_MINI_GARDEN_KIT.id };
  const isMiniGardenView = view === "miniPot" || view === "sandLayers" || view === "objectPlacement" || view === "makingPlan" || view === "finalComparison";
  const journeyStep = view === "gallery" ? 1 : isMiniGardenView && view !== "makingPlan" && view !== "finalComparison" ? 2 : view === "makingPlan" || view === "finalComparison" ? 3 : 0;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);

  useEffect(() => {
    if (project.miniGardenKitId !== DEMO_MINI_GARDEN_KIT.id) return;
    const kits = parseStoredMiniGardenKits(window.localStorage.getItem(MINI_GARDEN_KITS_STORAGE_KEY));
    const nextKits = kits.some((kit) => kit.id === DEMO_MINI_GARDEN_KIT.id)
      ? kits.map((kit) => kit.id === DEMO_MINI_GARDEN_KIT.id ? DEMO_MINI_GARDEN_KIT : kit)
      : [...kits, DEMO_MINI_GARDEN_KIT];
    writeBrowserStorage("local", MINI_GARDEN_KITS_STORAGE_KEY, JSON.stringify(nextKits));
  }, [project.miniGardenKitId]);

  return (
    <div className="studio-shell">
      <header className="studio-header studio-header--simple">
        <Link className="brand brand--light" href="/">
          <span className="brand-mark" aria-hidden="true"><span /><span /></span>
          <span><strong>조경전문가</strong><small>직업체험</small></span>
        </Link>
        <div className="studio-project-name">
          <small>{project.schoolName} · {project.className}</small>
          <strong>{project.title}</strong>
        </div>
        <div className="student-identity">
          <span>{context.session.nickname.slice(0, 1)}</span>
          <div><small>나의 작업</small><strong>{context.session.nickname}</strong></div>
        </div>
      </header>

      <div className="studio-progress studio-progress--simple" aria-label="체험 진행 단계">
        <div className="progress-steps">
          {["학교조경", "친구작품", "꽃꾸미기", "완성"].map((label, index) => (
            <div className={journeyStep === index ? "is-current" : journeyStep > index ? "is-done" : ""} key={label}>
              <span>{index + 1}</span><small>{label}</small>
            </div>
          ))}
        </div>
      </div>

      {view === "design" ? (
        <SampleSchool3DStudio
          project={project}
          nickname={context.session.nickname}
          sessionId={context.session.id}
          onContinue={() => setView("intention")}
        />
      ) : view === "intention" ? (
        <LandscapeIntentionForm
          project={project}
          nickname={context.session.nickname}
          sessionId={context.session.id}
          onBack={() => setView("design")}
          onPreview3D={() => setView("design")}
          onSubmitted={() => setView("gallery")}
        />
      ) : view === "gallery" ? (
        <ClassLandscapeGallery
          project={project}
          nickname={context.session.nickname}
          sessionId={context.session.id}
          onBack={() => setView("intention")}
          onContinue={() => setView("miniPot")}
        />
      ) : view === "miniPot" ? (
        <MiniGardenPotStudio
          project={project}
          nickname={context.session.nickname}
          onBack={() => setView("gallery")}
          onContinue={() => setView("sandLayers")}
        />
      ) : view === "sandLayers" ? (
        <MiniGardenSandStudio
          project={project}
          nickname={context.session.nickname}
          sessionId={context.session.id}
          onBack={() => setView("miniPot")}
          onContinue={() => setView("objectPlacement")}
        />
      ) : view === "objectPlacement" ? (
        <MiniGardenObjectStudio
          project={project}
          nickname={context.session.nickname}
          sessionId={context.session.id}
          onBack={() => setView("sandLayers")}
          onContinue={() => setView("makingPlan")}
        />
      ) : view === "makingPlan" ? (
        <MiniGardenMakingPlan
          project={project}
          nickname={context.session.nickname}
          sessionId={context.session.id}
          onBack={() => setView("objectPlacement")}
          onContinue={() => setView("finalComparison")}
        />
      ) : (
        <MiniGardenFinalComparison
          project={project}
          nickname={context.session.nickname}
          sessionId={context.session.id}
          onBack={() => setView("makingPlan")}
        />
      )}
    </div>
  );
}
