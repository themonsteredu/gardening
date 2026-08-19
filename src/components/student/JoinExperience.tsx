"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { PlanPreview } from "@/components/PlanPreview";
import { DEMO_CLASS_CODE, DEMO_PROJECT } from "@/data/demo-project";
import type { SchoolProject, StudentLandscapeDesign, StudentSession } from "@/domain/models";
import { normalizeClassCode } from "@/lib/class-code";
import {
  getStudentSessionStorageKey,
  getStudentLandscapeDesignStorageKey,
  parseStoredProject,
  PROJECT_STORAGE_KEY,
} from "@/lib/project-store";
import { joinClassSchema } from "@/lib/validation";

export function JoinExperience() {
  const router = useRouter();
  const [classCode, setClassCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function fillDemoCode() {
    setClassCode(DEMO_CLASS_CODE);
    setError(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const normalizedCode = normalizeClassCode(classCode);
    const parsed = joinClassSchema.safeParse({ classCode: normalizedCode, nickname });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "입력 내용을 확인하세요.");
      return;
    }

    let activeProject: SchoolProject = DEMO_PROJECT;
    const savedProject = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    if (savedProject) activeProject = parseStoredProject(savedProject);

    const isDemoCode = normalizedCode === DEMO_CLASS_CODE;
    const isCurrentTeacherCode = normalizedCode === activeProject.classCode;
    if (!isDemoCode && !isCurrentTeacherCode) {
      setError("수업 코드를 찾지 못했습니다. 교사에게 코드를 다시 확인해 주세요.");
      return;
    }

    setBusy(true);
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const session: StudentSession = {
      id: sessionId,
      classroomId: activeProject.id,
      nickname: parsed.data.nickname.trim(),
      stage: "joined",
      joinedAt: now,
      updatedAt: now,
    };
    const studentContext = JSON.stringify({ session, project: activeProject });
    const studentStorageKey = getStudentSessionStorageKey(sessionId);
    window.sessionStorage.setItem(studentStorageKey, studentContext);
    window.localStorage.setItem(studentStorageKey, studentContext);
    const emptyDesign: StudentLandscapeDesign = {
      id: `landscape-design-${sessionId}`,
      studentSessionId: sessionId,
      schoolProjectId: activeProject.id,
      sceneVersion: "sample-middle-school-v2",
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
            샘플 중학교를 항공과 학생 시점으로 둘러보고,
            실제 모습의 조경 재료를 직접 배치합니다.
          </p>
          <PlanPreview variant="student" />
          <div className="join-principle">
            <span>설계 원칙</span>
            <p>보기 좋은 배치보다 공간을 사용하는 사람과 그 이유를 먼저 생각합니다.</p>
          </div>
        </section>

        <section className="join-form-panel" aria-labelledby="join-title">
          <div className="join-form-heading">
            <span>01</span>
            <div>
              <p>수업 참여</p>
              <h2 id="join-title">설계 프로젝트에 입장하기</h2>
            </div>
          </div>

          <form onSubmit={submit} noValidate>
            <div className="form-field">
              <label htmlFor="class-code"><span>수업 코드</span></label>
              <div className="code-input-wrap">
                <input
                  id="class-code"
                  aria-describedby="class-code-help"
                  autoFocus
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
                <button type="button" onClick={fillDemoCode}>데모 코드</button>
              </div>
              <small id="class-code-help">선생님이 화면에 보여준 영문·숫자 코드를 입력하세요.</small>
            </div>

            <div className="form-field">
              <label htmlFor="student-nickname"><span>이름 또는 닉네임</span></label>
              <input
                id="student-nickname"
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
            <p>수업 코드를 모르겠나요?</p>
            <span>선생님께 수업 코드를 확인하거나, 위의 데모 코드 버튼으로 체험해 보세요.</span>
          </div>
          <Link className="teacher-text-link" href="/teacher">교사라면 수업 설계실로 이동</Link>
        </section>
      </main>
    </div>
  );
}
