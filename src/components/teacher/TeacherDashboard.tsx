"use client";

import Image from "next/image";
import Link from "next/link";
import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DEMO_PROJECT, DEMO_STUDENTS } from "@/data/demo-project";
import {
  LANDSCAPE_STAGE_LABELS,
  type SchoolProject,
} from "@/domain/models";
import { generateClassCode } from "@/lib/class-code";
import {
  createSchoolLogoDataUrl,
  SCHOOL_LOGO_ACCEPT,
  validateSchoolLogo,
} from "@/lib/school-logo";
import {
  parseStoredProject,
  parseStoredMiniGardenKits,
  MINI_GARDEN_KITS_STORAGE_KEY,
  PROJECT_STORAGE_KEY,
} from "@/lib/project-store";
import {
  useBrowserStorageValue,
  writeBrowserStorage,
} from "@/lib/use-browser-storage";

type TeacherTab = "setup" | "students" | "gallery";

interface ProjectFormState {
  schoolName: string;
  schoolLogoDataUrl: string | null;
  schoolLogoName: string | null;
  className: string;
  title: string;
  mission: string;
}

export function TeacherDashboard() {
  const [tab, setTab] = useState<TeacherTab>("setup");
  const [editorOpen, setEditorOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logoStatus, setLogoStatus] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProjectFormState>({
    schoolName: DEMO_PROJECT.schoolName,
    schoolLogoDataUrl: DEMO_PROJECT.schoolLogoDataUrl ?? null,
    schoolLogoName: DEMO_PROJECT.schoolLogoName ?? null,
    className: DEMO_PROJECT.className,
    title: DEMO_PROJECT.title,
    mission: DEMO_PROJECT.mission,
  });
  const storedProject = useBrowserStorageValue("local", PROJECT_STORAGE_KEY);
  const storedMiniGardenKits = useBrowserStorageValue("local", MINI_GARDEN_KITS_STORAGE_KEY);
  const project = useMemo(() => parseStoredProject(storedProject), [storedProject]);
  const miniGardenKits = useMemo(() => parseStoredMiniGardenKits(storedMiniGardenKits), [storedMiniGardenKits]);
  const setupProgress = 100;

  function saveProject() {
    const next: SchoolProject = {
      ...project,
      ...form,
      schoolName: form.schoolName.trim(),
      className: form.className.trim(),
      title: form.title.trim(),
      classCode: project.classCode || generateClassCode(),
      status: "draft",
    };
    writeBrowserStorage("local", PROJECT_STORAGE_KEY, JSON.stringify(next));
    setEditorOpen(false);
  }

  function openEditor() {
    setForm({
      schoolName: project.schoolName,
      schoolLogoDataUrl: project.schoolLogoDataUrl ?? null,
      schoolLogoName: project.schoolLogoName ?? null,
      className: project.className,
      title: project.title,
      mission: project.mission,
    });
    setLogoStatus("");
    setEditorOpen(true);
  }

  async function handleLogoSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const validationError = validateSchoolLogo(file);
    if (validationError) {
      setLogoStatus(validationError);
      return;
    }
    setLogoStatus("로고를 준비하고 있어요.");
    try {
      const schoolLogoDataUrl = await createSchoolLogoDataUrl(file);
      setForm((current) => ({
        ...current,
        schoolLogoDataUrl,
        schoolLogoName: file.name,
      }));
      setLogoStatus("학교 표지판에 로고가 함께 표시됩니다.");
    } catch (error) {
      setLogoStatus(error instanceof Error ? error.message : "학교 로고를 처리하지 못했습니다.");
    }
  }

  function removeSchoolLogo() {
    setForm((current) => ({ ...current, schoolLogoDataUrl: null, schoolLogoName: null }));
    setLogoStatus("로고를 지웠습니다. 학교명만 표시됩니다.");
  }

  async function copyClassCode() {
    await navigator.clipboard.writeText(project.classCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function startClass() {
    writeBrowserStorage("local", PROJECT_STORAGE_KEY, JSON.stringify({ ...project, status: "open" }));
  }

  return (
    <div className="dashboard-shell">
      <AppHeader compact current="teacher" />

      <main className="dashboard-main">
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">TEACHER WORKSPACE</p>
            <h1>수업 설계실</h1>
            <p>학교 공간과 실제 재료를 준비하고 학생의 설계 과정을 확인합니다.</p>
          </div>
          <button
            className="button button--primary"
            type="button"
            onClick={openEditor}
          >
            수업 기본 정보 편집
          </button>
        </div>

        <section className="project-strip" aria-label="현재 수업">
          <div className="project-strip__identity">
            <span className={`project-monogram${project.schoolLogoDataUrl ? " project-monogram--logo" : ""}`}>
              {project.schoolLogoDataUrl ? (
                <Image src={project.schoolLogoDataUrl} alt={`${project.schoolName} 로고`} fill sizes="66px" unoptimized />
              ) : project.schoolName.slice(0, 1)}
            </span>
            <div>
              <small>현재 준비 중인 수업</small>
              <h2>{project.title}</h2>
              <p>
                {project.schoolName} · {project.className}
              </p>
            </div>
          </div>
          <div className="class-code-block">
            <small>학생 입장 코드</small>
            <strong>{project.classCode}</strong>
            <button type="button" onClick={copyClassCode}>
              {copied ? "복사됨" : "코드 복사"}
            </button>
          </div>
          <div className="readiness-block">
            <div>
              <small>수업 준비도</small>
              <strong>{setupProgress}%</strong>
            </div>
            <div className="readiness-track" aria-label={`수업 준비도 ${setupProgress}%`}>
              <span style={{ width: `${setupProgress}%` }} />
            </div>
          </div>
        </section>

        <div className="dashboard-tabs" role="tablist" aria-label="교사 메뉴">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "setup"}
            className={tab === "setup" ? "is-active" : ""}
            onClick={() => setTab("setup")}
          >
            수업 준비
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "students"}
            className={tab === "students" ? "is-active" : ""}
            onClick={() => setTab("students")}
          >
            학생 현황 <span>{DEMO_STUDENTS.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "gallery"}
            className={tab === "gallery" ? "is-active" : ""}
            onClick={() => setTab("gallery")}
          >
            반 작품 보기
          </button>
        </div>

        {tab === "setup" ? (
          <SetupPanel project={project} miniGardenKits={miniGardenKits} onStart={startClass} />
        ) : null}
        {tab === "students" ? <StudentsPanel /> : null}
        {tab === "gallery" ? <GalleryPanel /> : null}
      </main>

      {editorOpen ? (
        <div className="drawer-backdrop" role="presentation">
          <aside className="project-drawer" role="dialog" aria-modal="true" aria-labelledby="project-editor-title">
            <div className="drawer-heading">
              <div>
                <p className="eyebrow">CLASS SETUP</p>
                <h2 id="project-editor-title">수업 기본 정보</h2>
              </div>
              <button className="drawer-close" type="button" onClick={() => setEditorOpen(false)} aria-label="닫기">
                ×
              </button>
            </div>

            <div className="form-stack">
              <label>
                <span>학교명</span>
                <input
                  value={form.schoolName}
                  onChange={(event) => setForm({ ...form, schoolName: event.target.value })}
                  maxLength={40}
                />
              </label>
              <div className="school-logo-field">
                <span className="school-logo-field__label">학교 로고</span>
                <div className="school-logo-field__content">
                  <div className={`school-logo-preview${form.schoolLogoDataUrl ? " has-logo" : ""}`}>
                    {form.schoolLogoDataUrl ? (
                      <Image src={form.schoolLogoDataUrl} alt="등록한 학교 로고 미리보기" fill sizes="76px" unoptimized />
                    ) : (
                      <span>로고</span>
                    )}
                  </div>
                  <div className="school-logo-field__actions">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept={SCHOOL_LOGO_ACCEPT}
                      onChange={handleLogoSelect}
                      hidden
                    />
                    <div>
                      <button className="school-logo-button" type="button" onClick={() => logoInputRef.current?.click()}>
                        {form.schoolLogoDataUrl ? "로고 바꾸기" : "로고 넣기"}
                      </button>
                      {form.schoolLogoDataUrl ? (
                        <button className="school-logo-button school-logo-button--remove" type="button" onClick={removeSchoolLogo}>
                          지우기
                        </button>
                      ) : null}
                    </div>
                    <small role="status">{logoStatus || "PNG, JPG, WebP · 5MB 이하"}</small>
                  </div>
                </div>
              </div>
              <label>
                <span>반</span>
                <input
                  value={form.className}
                  onChange={(event) => setForm({ ...form, className: event.target.value })}
                  maxLength={30}
                />
              </label>
              <label>
                <span>수업명</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  maxLength={50}
                />
              </label>
              <label>
                <span>학생 설계 미션</span>
                <textarea
                  value={form.mission}
                  onChange={(event) => setForm({ ...form, mission: event.target.value })}
                  rows={5}
                  maxLength={240}
                />
                <small>{form.mission.length}/240</small>
              </label>
            </div>

            <div className="drawer-note">
              모든 학생은 같은 3D 샘플 중학교에서 조경을 시작합니다.
            </div>
            <div className="drawer-actions">
              <button className="button button--quiet" type="button" onClick={() => setEditorOpen(false)}>
                취소
              </button>
              <button
                className="button button--primary"
                type="button"
                disabled={!form.schoolName.trim() || !form.className.trim() || !form.title.trim()}
                onClick={saveProject}
              >
                저장하기
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function SetupPanel({
  project,
  miniGardenKits,
  onStart,
}: {
  project: SchoolProject;
  miniGardenKits: ReturnType<typeof parseStoredMiniGardenKits>;
  onStart: () => void;
}) {
  const hasKit = Boolean(project.miniGardenKitId && miniGardenKits.some((kit) => kit.id === project.miniGardenKitId));

  return (
    <section className="dashboard-content dashboard-content--setup">
      <div className="teacher-simple-setup">
        <header>
          <div><h2>3D 학교 준비</h2><p>설정한 학교명과 조경 재료가 3D 캠퍼스에 반영됩니다.</p></div>
          <span className="is-ready">준비됨</span>
        </header>
        <div className="teacher-sample-campus">
          <div className="teacher-sample-campus__mark"><span /><span /><span /></div>
          <div><small>기본 실습 공간</small><strong>{project.schoolName} 3D 캠퍼스</strong><p>본관 · 별관 · 운동장 · 중앙정원 · 보행로</p></div>
          <ul><li>항공샷</li><li>360° 입체</li><li>학생 시점</li></ul>
        </div>
        <div className="teacher-simple-actions">
          <Link className="button button--quiet" href="/teacher/mini-garden-kit">{hasKit ? "오늘의 재료 바꾸기" : "오늘의 재료 준비"}</Link>
          <button className="button button--primary" type="button" onClick={onStart}>수업 시작</button>
        </div>
        <p className="teacher-simple-mission"><strong>오늘의 의뢰</strong><span>{project.mission}</span></p>
      </div>
    </section>
  );
}

function StudentsPanel() {
  return (
    <section className="dashboard-content">
      <div className="wide-panel">
        <div className="panel-heading">
          <div>
            <h2>학생 진행 현황</h2>
            <p>순위가 아니라 각 학생이 어느 설계 단계에 있는지 확인합니다.</p>
          </div>
          <span>데모 데이터</span>
        </div>
        <div className="student-table-wrap">
          <table className="student-table">
            <thead>
              <tr>
                <th>학생</th>
                <th>현재 단계</th>
                <th>학교 조경 설계</th>
                <th>미니조경</th>
                <th>최근 활동</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_STUDENTS.map((student, index) => (
                <tr key={student.id}>
                  <td>
                    <span className="student-avatar">{student.nickname.slice(0, 1)}</span>
                    {student.nickname}
                  </td>
                  <td><span className="stage-chip">{LANDSCAPE_STAGE_LABELS[student.stage]}</span></td>
                  <td>{index === 0 ? "설계 중" : "제출 완료"}</td>
                  <td>{index === 2 ? "모델링 중" : "대기"}</td>
                  <td>{14 + index * 7}분 전</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function GalleryPanel() {
  return (
    <section className="dashboard-content">
      <div className="empty-gallery">
        <span className="empty-gallery__mark" aria-hidden="true" />
        <p className="eyebrow">CLASS GALLERY</p>
        <h2>아직 제출된 설계가 없습니다.</h2>
        <p>STEP 8에서 학생의 배치도, 3D 미리보기와 설계 의도를 비교할 수 있습니다.</p>
      </div>
    </section>
  );
}
