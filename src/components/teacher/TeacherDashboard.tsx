"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { PlanPreview } from "@/components/PlanPreview";
import { StoredSiteImagePreview } from "@/components/teacher/StoredSiteImagePreview";
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
  parseStoredSitePlan,
  MINI_GARDEN_KITS_STORAGE_KEY,
  PROJECT_STORAGE_KEY,
  SITE_IMAGE_META_STORAGE_KEY,
  SITE_PLAN_STORAGE_KEY,
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

const SETUP_ITEMS = [
  {
    key: "basic",
    index: "01",
    title: "수업 기본 정보",
    detail: "학교명, 반, 수업명과 설계 미션",
    step: "STEP 1",
  },
  {
    key: "image",
    index: "02",
    title: "학교 이미지 등록",
    detail: "항공사진, 배치도 또는 PDF",
    step: "STEP 2",
  },
  {
    key: "plan",
    index: "03",
    title: "기존 시설과 설계 영역",
    detail: "도면 레이어와 조경 가능 영역 지정",
    step: "STEP 3–4",
  },
  {
    key: "kit",
    index: "04",
    title: "오늘의 미니조경 키트",
    detail: "화분 크기와 실제 재료 구성",
    step: "STEP 9",
  },
] as const;

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
  const storedSitePlan = useBrowserStorageValue("local", SITE_PLAN_STORAGE_KEY);
  const storedMiniGardenKits = useBrowserStorageValue("local", MINI_GARDEN_KITS_STORAGE_KEY);
  const project = useMemo(() => parseStoredProject(storedProject), [storedProject]);
  const siteImage = useMemo(() => parseStoredSiteImage(storedSiteImage), [storedSiteImage]);
  const sitePlan = useMemo(() => parseStoredSitePlan(storedSitePlan), [storedSitePlan]);
  const miniGardenKits = useMemo(() => parseStoredMiniGardenKits(storedMiniGardenKits), [storedMiniGardenKits]);

  const setupProgress = useMemo(() => {
    const done = [
      Boolean(project.schoolName && project.className && project.title),
      Boolean(project.siteImageId),
      Boolean(sitePlan?.features.some((feature) => feature.kind === "editable_zone")),
      Boolean(project.miniGardenKitId && miniGardenKits.some((kit) => kit.id === project.miniGardenKitId)),
    ].filter(Boolean).length;
    return Math.round((done / SETUP_ITEMS.length) * 100);
  }, [miniGardenKits, project, sitePlan]);

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
          <SetupPanel project={project} siteImage={siteImage} sitePlan={sitePlan} miniGardenKits={miniGardenKits} onEdit={openEditor} />
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
              학교 이미지는 수업 준비 목록의 STEP 2에서 등록할 수 있습니다. 도면 영역과 미니조경 키트는 이후 단계에서 연결됩니다.
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
  sitePlan,
  miniGardenKits,
  onEdit,
}: {
  project: SchoolProject;
  siteImage: ReturnType<typeof parseStoredSiteImage>;
  sitePlan: ReturnType<typeof parseStoredSitePlan>;
  miniGardenKits: ReturnType<typeof parseStoredMiniGardenKits>;
  onEdit: () => void;
}) {
  const completed = [
    Boolean(project.schoolName && project.className && project.title),
    Boolean(project.siteImageId && siteImage?.id === project.siteImageId),
    Boolean(sitePlan?.features.some((feature) => feature.kind === "editable_zone")),
    Boolean(project.miniGardenKitId && miniGardenKits.some((kit) => kit.id === project.miniGardenKitId)),
  ];
  const completedCount = completed.filter(Boolean).length;

  return (
    <section className="dashboard-content dashboard-content--setup">
      <div className="setup-list-panel">
        <div className="panel-heading">
          <div>
            <h2>수업 준비 순서</h2>
            <p>학생이 입장하기 전에 실제 공간과 실제 재료를 연결합니다.</p>
          </div>
          <span>{completedCount} / 4 완료</span>
        </div>

        <ol className="setup-list">
          {SETUP_ITEMS.map((item, index) => {
            const done = completed[index];
            const available = index <= 1 || (index === 2 && Boolean(siteImage)) || index === 3;
            const existingFeatureCount = sitePlan?.features.filter((feature) => feature.kind !== "editable_zone").length ?? 0;
            const editableZoneCount = sitePlan?.features.filter((feature) => feature.kind === "editable_zone").length ?? 0;
            return (
              <li className={done ? "is-complete" : available ? "is-available" : "is-pending"} key={item.key}>
                <span className="setup-index">{done ? "✓" : item.index}</span>
                <div>
                  <span className="step-label">{item.step}</span>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
                {index === 0 ? (
                  <button type="button" onClick={onEdit}>편집</button>
                ) : null}
                {index === 1 ? (
                  <Link href="/teacher/site-image">{done ? "이미지 관리" : "시작"}</Link>
                ) : null}
                {index === 2 && available ? (
                  <Link href={existingFeatureCount > 0 ? "/teacher/editable-zone" : "/teacher/site-plan"}>
                    {editableZoneCount > 0
                      ? `가능 영역 ${editableZoneCount}개 · 관리`
                      : existingFeatureCount > 0
                        ? "가능 영역 지정"
                        : "도면 시작"}
                  </Link>
                ) : null}
                {index === 2 && !available ? <button type="button" disabled>이미지 등록 후</button> : null}
                {index === 3 ? <Link href="/teacher/mini-garden-kit">{done ? "키트 관리" : "시작"}</Link> : null}
              </li>
            );
          })}
        </ol>
      </div>

      <aside className="setup-preview-panel">
        <div className="panel-heading">
          <div>
            <span className="step-label">PROJECT PREVIEW</span>
            <h2>학생에게 보일 공간</h2>
          </div>
        </div>
        {siteImage && project.siteImageId === siteImage.id ? (
          <StoredSiteImagePreview siteImage={siteImage} compact showDetails={false} />
        ) : (
          <PlanPreview variant="teacher" showMaterials={false} />
        )}
        <div className="mission-box">
          <small>이번 설계 미션</small>
          <p>{project.mission}</p>
        </div>
        <p className="preview-help">
          {siteImage && project.siteImageId === siteImage.id
            ? `${siteImage.name}이 원본 이미지 레이어로 연결되었습니다.`
            : "학교 이미지가 등록되면 이 자리에 실제 도면 미리보기가 표시됩니다."}
        </p>
      </aside>
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
