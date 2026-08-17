"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlanPreview } from "@/components/PlanPreview";
import { LandscapeDesignStudio } from "@/components/student/LandscapeDesignStudio";
import { Landscape3DPreview } from "@/components/student/Landscape3DPreview";
import { LandscapeIntentionForm } from "@/components/student/LandscapeIntentionForm";
import { ClassLandscapeGallery } from "@/components/student/ClassLandscapeGallery";
import { MiniGardenPotStudio } from "@/components/student/MiniGardenPotStudio";
import { MiniGardenSandStudio } from "@/components/student/MiniGardenSandStudio";
import { MiniGardenObjectStudio } from "@/components/student/MiniGardenObjectStudio";
import { MiniGardenMakingPlan } from "@/components/student/MiniGardenMakingPlan";
import { MiniGardenFinalComparison } from "@/components/student/MiniGardenFinalComparison";
import { DEMO_PROJECT, PROJECT_FLOW } from "@/data/demo-project";
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
  const [view, setView] = useState<"briefing" | "site" | "design" | "preview3d" | "intention" | "gallery" | "miniPot" | "sandLayers" | "objectPlacement" | "makingPlan" | "finalComparison">("briefing");
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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);

  return (
    <div className="studio-shell">
      <header className="studio-header">
        <Link className="brand brand--light" href="/">
          <span className="brand-mark" aria-hidden="true"><span /><span /></span>
          <span><strong>GARDENING</strong><small>CAREER LAB</small></span>
        </Link>
        <div className="studio-project-name">
          <small>{context.project.schoolName} · {context.project.className}</small>
          <strong>{context.project.title}</strong>
        </div>
        <div className="student-identity">
          <span>{context.session.nickname.slice(0, 1)}</span>
          <div><small>학생 설계자</small><strong>{context.session.nickname}</strong></div>
        </div>
      </header>

      <div className="studio-progress" aria-label="프로젝트 진행 단계">
        <div className={`progress-part ${isMiniGardenView ? "" : "is-active"}`}>
          <span>PART 1</span>
          <strong>학교 조경 설계</strong>
        </div>
        <div className="progress-steps">
          {["공간 확인", "도면 설계", "설계 의도", "작품 비교"].map((label, index) => (
            <div className={(index === 0 && (view === "briefing" || view === "site")) || (index === 1 && (view === "design" || view === "preview3d")) || (index === 2 && view === "intention") || (index === 3 && view === "gallery") ? "is-current" : ""} key={label}>
              <span>{index + 1}</span><small>{label}</small>
            </div>
          ))}
        </div>
        <div className={`progress-part ${isMiniGardenView ? "is-active" : ""}`}>
          <span>PART 2</span>
          <strong>미니조경 제작</strong>
        </div>
      </div>

      {view === "briefing" ? (
        <main className="briefing-layout">
          <section className="briefing-copy">
            <p className="eyebrow">LANDSCAPE BRIEF 01</p>
            <h1>{context.session.nickname} 설계자님,<br />오늘의 공간을 확인하세요.</h1>
            <div className="briefing-rule" />
            <dl className="briefing-facts">
              <div><dt>대상 공간</dt><dd>{context.project.schoolName} 중앙 빈 공간</dd></div>
              <div><dt>사용자</dt><dd>쉬는 시간의 학생과 교직원</dd></div>
              <div><dt>설계 목표</dt><dd>안전하고 편안한 작은 휴식정원</dd></div>
            </dl>
            <div className="mission-quote">
              <small>선생님의 설계 미션</small>
              <blockquote>{context.project.mission}</blockquote>
            </div>
            <button className="button button--primary button--large" type="button" onClick={() => setView("site")}>
              학교 공간 살펴보기 <span aria-hidden="true">→</span>
            </button>
          </section>

          <section className="briefing-map">
            <div className="map-label"><span>PROJECT SITE</span><strong>중앙 광장 · 약 820㎡</strong></div>
            <PlanPreview variant="student" showMaterials={false} />
            <div className="map-note"><span>조경 가능 영역</span><p>점선 안쪽이 이번 수업에서 새롭게 설계할 공간입니다.</p></div>
          </section>
        </main>
      ) : view === "site" ? (
        <main className="site-review-layout">
          <aside className="site-review-sidebar">
            <button type="button" className="text-back" onClick={() => setView("briefing")}>← 미션으로 돌아가기</button>
            <p className="eyebrow">STEP 01</p>
            <h1>학교 공간 확인</h1>
            <p>도면을 움직이기 전에 기존 시설과 설계 가능한 영역을 구분해 보세요.</p>
            <div className="layer-legend">
              <div><span className="legend-source" /><p><strong>원본 이미지</strong><small>학교 항공사진 또는 배치도</small></p></div>
              <div><span className="legend-existing" /><p><strong>기존 시설</strong><small>건물, 운동장, 보행로, 수목</small></p></div>
              <div><span className="legend-zone" /><p><strong>설계 가능 공간</strong><small>학생이 재료를 배치할 영역</small></p></div>
            </div>
            <div className="step-one-note"><strong>설계 전 확인</strong><p>기존 시설은 그대로 두고, 연두색 조경 가능 영역 안에서만 새 재료를 배치합니다.</p></div>
            <button className="button button--primary button--wide" type="button" onClick={() => setView("design")}>도면 설계 시작 <span aria-hidden="true">→</span></button>
          </aside>
          <section className="site-review-canvas">
            <div className="canvas-toolbar"><span>학교 조경 배치도</span><div><button type="button">화면 맞춤</button><button type="button">레이어</button></div></div>
            <PlanPreview variant="student" showMaterials={false} />
            <div className="canvas-status"><span>축척 기준 미설정</span><strong>읽기 전용 미리보기</strong></div>
          </section>
          <aside className="journey-outline">
            <p className="eyebrow">FULL JOURNEY</p>
            {PROJECT_FLOW.map((flow) => (
              <div key={flow.part}><span>{flow.part}</span><strong>{flow.title}</strong><ol>{flow.steps.map((step) => <li key={step}>{step}</li>)}</ol></div>
            ))}
          </aside>
        </main>
      ) : view === "design" ? (
        <LandscapeDesignStudio
          project={context.project}
          nickname={context.session.nickname}
          sessionId={context.session.id}
          onBack={() => setView("site")}
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
