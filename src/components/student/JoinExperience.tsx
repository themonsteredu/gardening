"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { PlanPreview } from "@/components/PlanPreview";
import { BONGSUN_PRACTICE_PROJECT, DEMO_CLASS_CODE, DEMO_PROJECT } from "@/data/demo-project";
import type { SchoolProject, StudentLandscapeDesign, StudentSession } from "@/domain/models";
import { normalizeClassCode } from "@/lib/class-code";
import { getStudentWorkEditKey } from "@/lib/student-work-key";
import { getSchoolSceneVersion } from "@/lib/sample-school";
import {
  getSharedProjectSnapshotStorageKey,
  getStudentSessionStorageKey,
  getStudentLandscapeDesignStorageKey,
  parseStoredProject,
  PROJECT_STORAGE_KEY,
} from "@/lib/project-store";
import { joinClassSchema } from "@/lib/validation";

const missingClass = "수업 코드를 찾지 못했습니다. 선생님이 공유한 코드를 확인해 주세요.";

async function loadSharedProject(code: string, signal?: AbortSignal): Promise<SchoolProject> {
  const response = await fetch("/api/school-classes/" + encodeURIComponent(code), { cache: "no-store", signal });
  if (!response.ok) throw new Error(response.status === 404 ? missingClass : "수업 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  const { project } = await response.json() as { project: SchoolProject };
  if (!project?.id || project.classCode !== code) throw new Error(missingClass);
  return { ...project, sharedClass: true };
}

export function JoinExperience({ bongsunPreset, initialCode = "" }: { bongsunPreset: boolean; initialCode?: string }) {
  const router = useRouter();
  const [classCode, setClassCode] = useState(initialCode || (bongsunPreset ? BONGSUN_PRACTICE_PROJECT.classCode : ""));
  const isBongsunPractice = classCode === BONGSUN_PRACTICE_PROJECT.classCode;
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [linkedProject, setLinkedProject] = useState<SchoolProject | null>(null);
  const previewProject = linkedProject?.classCode === classCode ? linkedProject : null;

  useEffect(() => {
    if (!initialCode || initialCode === DEMO_CLASS_CODE || initialCode === BONGSUN_PRACTICE_PROJECT.classCode) return;
    const controller = new AbortController();
    loadSharedProject(initialCode, controller.signal)
      .then(project => { if (!controller.signal.aborted) setLinkedProject(project); })
      .catch(() => { /* Submission retries the lookup and displays a relevant error. */ });
    return () => controller.abort();
  }, [initialCode]);

  function fillDemoCode() {
    setClassCode(bongsunPreset ? BONGSUN_PRACTICE_PROJECT.classCode : DEMO_CLASS_CODE);
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    if (busy) { event.preventDefault(); return; }
    event.preventDefault();
    setError(null);
    const normalizedCode = normalizeClassCode(classCode);
    const parsed = joinClassSchema.safeParse({ classCode: normalizedCode, nickname });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "입력 내용을 확인하세요.");
      return;
    }

    setBusy(true);
    try {
      const localProject = parseStoredProject(window.localStorage.getItem(PROJECT_STORAGE_KEY));
      let activeProject: SchoolProject;
      if (normalizedCode === BONGSUN_PRACTICE_PROJECT.classCode) {
        activeProject = BONGSUN_PRACTICE_PROJECT;
      } else if (normalizedCode === DEMO_CLASS_CODE) {
        activeProject = !localProject.sharedClass && localProject.classCode === DEMO_CLASS_CODE ? localProject : DEMO_PROJECT;
      } else if (!initialCode && !localProject.sharedClass && localProject.classCode === normalizedCode) {
        activeProject = localProject;
      } else {
        activeProject = previewProject ?? await loadSharedProject(normalizedCode);
      }
      const sessionId = crypto.randomUUID();
      if (activeProject.sharedClass) getStudentWorkEditKey(sessionId);
      const now = new Date().toISOString();
      const session: StudentSession = {
        id: sessionId,
        classroomId: activeProject.id,
        nickname: parsed.data.nickname.trim(),
        stage: "joined",
        joinedAt: now,
        updatedAt: now,
      };
      let sessionProject = activeProject;
      if (activeProject.sharedClass) {
        // Classmates using one tablet share a single copy of the campus photos.
        window.localStorage.setItem(getSharedProjectSnapshotStorageKey(activeProject.id), JSON.stringify(activeProject));
        sessionProject = { ...activeProject, campusModel: undefined, schoolLogoDataUrl: undefined };
      }
      const studentContext = JSON.stringify({ session, project: sessionProject });
      const studentStorageKey = getStudentSessionStorageKey(sessionId);
      window.sessionStorage.setItem(studentStorageKey, studentContext);
      window.localStorage.setItem(studentStorageKey, studentContext);
      const emptyDesign: StudentLandscapeDesign = {
        id: `landscape-design-${sessionId}`,
        studentSessionId: sessionId,
        schoolProjectId: activeProject.id,
        sceneVersion: getSchoolSceneVersion(activeProject.schoolName, null, activeProject.campusModel),
        objects: [],
        surfaceStrokes: [],
        intentionKeyword: null,
        intentionReason: null,
        thumbnailUrl: null,
        submittedAt: null,
      };
      window.localStorage.setItem(
        getStudentLandscapeDesignStorageKey(sessionId),
        JSON.stringify(emptyDesign),
      );
      router.push(`/student/${sessionId}`);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "QuotaExceededError") {
        setError("이 기기의 작품 저장 공간이 가득 찼어요. 여유 공간을 확보한 뒤 다시 입장해 주세요.");
      } else {
        setError(cause instanceof Error && cause.message.startsWith("수업") ? cause.message : "수업에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.");
      }
      setBusy(false);
    }
  }

  return (
    <div className="join-page">
      <AppHeader compact current="student" />
      <main className="join-layout">
        <section className="join-intro">
          <p className="eyebrow">STUDENT ENTRANCE</p>
          <h1>
            오늘부터 나는
            <br />
            <em>3D 학교 조경 설계자</em>입니다.
          </h1>
          <p>
            {isBongsunPractice
              ? "봉선중학교 본관 앞과 수업용 뒤뜰에 꽃과 나무를 심어 보세요."
              : previewProject ? previewProject.schoolName + " 본관을 돌려 보며 앞마당과 뒤뜰에 꽃과 나무를 심어 보세요." : "선생님이 준비한 학교 공간에 꽃과 나무를 심고 우리 반 정원을 설계해 보세요."}
          </p>
          {!isBongsunPractice && !initialCode && <PlanPreview variant="student" />}
          <div className="join-principle">
            <span>설계 원칙</span>
            <p>보기 좋은 배치보다 공간을 사용하는 사람과 그 이유를 먼저 생각합니다.</p>
          </div>
        </section>

        <section className="join-form-panel" aria-labelledby="join-title">
          <div className="join-form-heading">
            <span>01</span>
            <div>
              <p>{isBongsunPractice ? "개인 연습" : "수업 참여"}</p>
              <h2 id="join-title">{isBongsunPractice ? "봉선중학교 정원 꾸미기" : previewProject ? previewProject.schoolName + " · " + previewProject.className : "설계 프로젝트에 입장하기"}</h2>
            </div>
          </div>

          <form onSubmit={submit} noValidate>
            <div className="form-field">
              <label htmlFor="class-code"><span>수업 코드</span></label>
              <div className="code-input-wrap">
                <input
                  id="class-code"
                  aria-describedby="class-code-help"
                  autoFocus={!bongsunPreset && !initialCode}
                  autoCapitalize="characters"
                  autoComplete="off"
                  inputMode="text"
                  maxLength={10}
                  placeholder="예: GARDEN24"
                  value={classCode}
                  onChange={(event) => {
                    setClassCode(normalizeClassCode(event.target.value));
                    setError(null);
                  }}
                />
                {!initialCode && <button type="button" onClick={fillDemoCode}>{bongsunPreset ? "연습 코드" : "데모 코드"}</button>}
              </div>
              <small id="class-code-help">{isBongsunPractice ? "이 코드는 어느 기기에서나 봉선중 개인 연습을 열어요." : "선생님이 화면에 보여준 영문·숫자 코드를 입력하세요."}</small>
            </div>

            <div className="form-field">
              <label htmlFor="student-nickname"><span>이름 또는 닉네임</span></label>
              <input
                id="student-nickname"
                autoFocus={bongsunPreset || Boolean(initialCode)}
                aria-describedby="student-nickname-help"
                autoComplete="nickname"
                maxLength={12}
                placeholder="작품에 표시할 이름"
                value={nickname}
                onChange={(event) => {
                  setNickname(event.target.value);
                  setError(null);
                }}
              />
              <small id="student-nickname-help">회원가입 없이 이 수업에서만 사용합니다.</small>
            </div>

            {error ? <p className="form-error" role="alert">{error}</p> : null}

            <button className="button button--primary button--wide" type="submit" disabled={busy}>
              {busy ? "설계실 여는 중" : "내 설계실 열기"}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <div className="join-help">
            {isBongsunPractice ? (
              <>
                <p>작품은 어디에 저장되나요?</p>
                <span>개인 연습 작품은 지금 사용하는 기기의 브라우저에 저장돼요.</span>
              </>
            ) : (
              <>
                <p>수업 코드를 모르겠나요?</p>
                <span>선생님이 공유한 QR이나 링크로 접속하면 수업 코드가 자동으로 입력돼요.</span>
              </>
            )}
          </div>
          <Link className="teacher-text-link" href="/teacher">교사라면 수업 설계실로 이동</Link>
        </section>
      </main>
    </div>
  );
}
