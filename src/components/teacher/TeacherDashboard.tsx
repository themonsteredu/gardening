"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AutoSiteBackgroundPreview } from "@/components/teacher/AutoSiteBackgroundPreview";
import { DEMO_PROJECT, DEMO_STUDENTS } from "@/data/demo-project";
import {
  LANDSCAPE_STAGE_LABELS,
  type SchoolProject,
} from "@/domain/models";
import { generateClassCode } from "@/lib/class-code";
import {
  parseStoredProject,
  parseStoredMiniGardenKits,
  parseStoredSiteImage,
  parseStoredAutoSiteBackground,
  AUTO_SITE_BACKGROUND_META_STORAGE_KEY,
  MINI_GARDEN_KITS_STORAGE_KEY,
  PROJECT_STORAGE_KEY,
  SITE_IMAGE_META_STORAGE_KEY,
} from "@/lib/project-store";
import {
  useBrowserStorageValue,
  writeBrowserStorage,
} from "@/lib/use-browser-storage";

type TeacherTab = "setup" | "students" | "gallery";

interface ProjectFormState {
  schoolName: string;
  className: string;
  title: string;
  mission: string;
}

export function TeacherDashboard() {
  const [tab, setTab] = useState<TeacherTab>("setup");
  const [editorOpen, setEditorOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState<ProjectFormState>({
    schoolName: DEMO_PROJECT.schoolName,
    className: DEMO_PROJECT.className,
    title: DEMO_PROJECT.title,
    mission: DEMO_PROJECT.mission,
  });
  const storedProject = useBrowserStorageValue("local", PROJECT_STORAGE_KEY);
  const storedSiteImage = useBrowserStorageValue("local", SITE_IMAGE_META_STORAGE_KEY);
  const storedAutoBackground = useBrowserStorageValue("local", AUTO_SITE_BACKGROUND_META_STORAGE_KEY);
  const storedMiniGardenKits = useBrowserStorageValue("local", MINI_GARDEN_KITS_STORAGE_KEY);
  const project = useMemo(() => parseStoredProject(storedProject), [storedProject]);
  const siteImage = useMemo(() => parseStoredSiteImage(storedSiteImage), [storedSiteImage]);
  const autoBackground = useMemo(() => parseStoredAutoSiteBackground(storedAutoBackground), [storedAutoBackground]);
  const miniGardenKits = useMemo(() => parseStoredMiniGardenKits(storedMiniGardenKits), [storedMiniGardenKits]);

  const setupProgress = useMemo(() => {
    return project.siteImageId && autoBackground?.siteImageId === project.siteImageId ? 100 : 0;
  }, [autoBackground, project.siteImageId]);

  function saveProject() {
    const next: SchoolProject = {
      ...project,
      ...form,
      classCode: project.classCode || generateClassCode(),
      status: "draft",
    };
    writeBrowserStorage("local", PROJECT_STORAGE_KEY, JSON.stringify(next));
    setEditorOpen(false);
  }

  function openEditor() {
    setForm({
      schoolName: project.schoolName,
      className: project.className,
      title: project.title,
      mission: project.mission,
    });
    setEditorOpen(true);
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
            <span className="project-monogram">{project.schoolName.slice(0, 1)}</span>
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
          <SetupPanel project={project} siteImage={siteImage} autoBackground={autoBackground} miniGardenKits={miniGardenKits} onStart={startClass} />
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
              학교 사진 한 장을 넣으면 학생이 바로 재료를 배치할 수 있는 설계도가 자동으로 준비됩니다.
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
  siteImage,
  autoBackground,
  miniGardenKits,
  onStart,
}: {
  project: SchoolProject;
  siteImage: ReturnType<typeof parseStoredSiteImage>;
  autoBackground: ReturnType<typeof parseStoredAutoSiteBackground>;
  miniGardenKits: ReturnType<typeof parseStoredMiniGardenKits>;
  onStart: () => void;
}) {
  const hasPhoto = Boolean(project.siteImageId && siteImage?.id === project.siteImageId);
  const hasBackground = Boolean(autoBackground?.siteImageId === project.siteImageId);
  const hasKit = Boolean(project.miniGardenKitId && miniGardenKits.some((kit) => kit.id === project.miniGardenKitId));

  return (
    <section className="dashboard-content dashboard-content--setup">
      <div className="teacher-simple-setup">
        <header>
          <div><h2>학교 공간 준비</h2><p>{hasPhoto && hasBackground ? "자동 설계도가 준비되었습니다." : "학교 사진 한 장이면 충분합니다."}</p></div>
          <span className={hasPhoto && hasBackground ? "is-ready" : ""}>{hasPhoto && hasBackground ? "준비됨" : "준비 전"}</span>
        </header>
        <div className="teacher-simple-photo">
        {autoBackground && hasBackground ? (
          <AutoSiteBackgroundPreview background={autoBackground} compact />
        ) : (
          <div className="teacher-simple-photo__empty"><strong>학교 사진</strong><span>항공사진이나 배치 이미지를 넣어주세요.</span></div>
        )}
        </div>
        <div className="teacher-simple-actions">
          <Link className="button button--quiet" href="/teacher/site-image">{hasPhoto ? "사진 바꾸기" : "학교 사진 올리기"}</Link>
          {hasPhoto && hasBackground ? <Link className="teacher-simple-adjust" href="/teacher/site-image">간단히 수정</Link> : null}
          <button className="button button--primary" type="button" disabled={!hasPhoto || !hasBackground} onClick={onStart}>수업 시작</button>
        </div>
        {hasPhoto && hasBackground ? <Link className="teacher-kit-link" href="/teacher/mini-garden-kit">{hasKit ? "오늘의 재료 바꾸기" : "오늘의 재료 준비"}</Link> : null}
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
