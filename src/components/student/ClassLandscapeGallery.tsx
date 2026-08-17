"use client";

import { useMemo, useState } from "react";
import { LandscapeDesignPreview } from "@/components/student/LandscapeDesignPreview";
import { INTENTION_KEYWORDS } from "@/components/student/LandscapeIntentionForm";
import { DEMO_GALLERY_ENTRIES } from "@/data/demo-gallery";
import type { LandscapeGalleryEntry, SchoolProject } from "@/domain/models";
import {
  getClassLandscapeGalleryStorageKey,
  MINI_GARDEN_KITS_STORAGE_KEY,
  parseStoredLandscapeGallery,
  parseStoredMiniGardenKits,
} from "@/lib/project-store";
import { useBrowserStorageValue } from "@/lib/use-browser-storage";

export function ClassLandscapeGallery({
  project,
  nickname,
  sessionId,
  onBack,
  onContinue,
}: {
  project: SchoolProject;
  nickname: string;
  sessionId: string;
  onBack: () => void;
  onContinue: () => void;
}) {
  const galleryValue = useBrowserStorageValue("local", getClassLandscapeGalleryStorageKey(project.id));
  const kitsValue = useBrowserStorageValue("local", MINI_GARDEN_KITS_STORAGE_KEY);
  const [activeKeyword, setActiveKeyword] = useState("전체");
  const galleryEntries = useMemo(() => {
    const stored = parseStoredLandscapeGallery(galleryValue);
    const storedSessionIds = new Set(stored.map((entry) => entry.studentSessionId));
    const demoEntries = DEMO_GALLERY_ENTRIES
      .filter((entry) => !storedSessionIds.has(entry.studentSessionId))
      .map((entry) => ({ ...entry, schoolProjectId: project.id }));
    return [...stored, ...demoEntries];
  }, [galleryValue, project.id]);
  const visibleEntries = activeKeyword === "전체"
    ? galleryEntries
    : galleryEntries.filter((entry) => entry.intentionKeyword === activeKeyword);
  const activeKit = useMemo(
    () => parseStoredMiniGardenKits(kitsValue).find((kit) => kit.id === project.miniGardenKitId) ?? null,
    [kitsValue, project.miniGardenKitId],
  );

  return (
    <main className="class-gallery-page">
      <header className="gallery-heading">
        <div>
          <button type="button" onClick={onBack}>← 설계 의도 수정</button>
          <p className="eyebrow">STEP 08 · CLASS GALLERY</p>
          <h1>우리 반 조경 갤러리</h1>
          <p>같은 학교 공간도 목적과 생각에 따라 서로 다른 설계가 될 수 있습니다.</p>
        </div>
        <div className="gallery-class-meta"><span>{project.schoolName}</span><strong>{project.className}</strong><small>제출된 설계 {galleryEntries.length}개</small></div>
      </header>

      <section className="gallery-principle">
        <span>COMPARE IDEAS, NOT SCORES</span>
        <strong>순위를 매기지 않고 서로 다른 생각을 발견합니다.</strong>
        <p>친구가 중요하게 생각한 키워드와 재료의 위치를 함께 살펴보세요.</p>
      </section>

      <nav className="gallery-filter" aria-label="설계 핵심 키워드 필터">
        {["전체", ...INTENTION_KEYWORDS].map((keyword) => (
          <button key={keyword} type="button" className={activeKeyword === keyword ? "is-active" : ""} aria-pressed={activeKeyword === keyword} onClick={() => setActiveKeyword(keyword)}>{keyword}</button>
        ))}
      </nav>

      <section className="gallery-grid" aria-live="polite">
        {visibleEntries.map((entry) => (
          <GalleryCard key={entry.id} entry={entry} isMine={entry.studentSessionId === sessionId} currentNickname={nickname} />
        ))}
      </section>
      {visibleEntries.length === 0 ? <p className="gallery-empty">이 키워드로 제출된 설계가 아직 없습니다.</p> : null}

      <footer className="gallery-next-step">
        <div><span>PART 1 COMPLETE</span><strong>실제 공간 조경설계를 마쳤습니다.</strong><p>다음 단계에서는 실제 수업에서 받을 화분과 재료를 확인합니다.</p></div>
        <button type="button" disabled={!activeKit} onClick={onContinue}>{activeKit ? "미니조경 모델링 시작" : "미니조경 키트 준비 중"}</button>
      </footer>
    </main>
  );
}

function GalleryCard({
  entry,
  isMine,
  currentNickname,
}: {
  entry: LandscapeGalleryEntry;
  isMine: boolean;
  currentNickname: string;
}) {
  const categories = new Set(entry.objects.map((object) => object.category)).size;
  return (
    <article className={`gallery-card ${isMine ? "is-mine" : ""}`}>
      <header>
        <div className="gallery-avatar" aria-hidden="true">{(isMine ? currentNickname : entry.nickname).slice(0, 1)}</div>
        <div><span>{isMine ? "나의 설계" : "학생 설계자"}</span><strong>{isMine ? currentNickname : entry.nickname}</strong></div>
        <em>{entry.intentionKeyword} 중심</em>
      </header>
      <div className="gallery-card-previews">
        <LandscapeDesignPreview objects={entry.objects} variant="plan" label={`${entry.nickname}의 조경 배치도 썸네일`} />
        <LandscapeDesignPreview objects={entry.objects} variant="spatial" label={`${entry.nickname}의 3D 미리보기`} />
      </div>
      <div className="gallery-card-body">
        <blockquote>“{entry.intentionReason}”</blockquote>
        <dl><div><dt>배치 재료</dt><dd>{entry.objects.length}개</dd></div><div><dt>사용 범주</dt><dd>{categories}종</dd></div></dl>
      </div>
    </article>
  );
}
