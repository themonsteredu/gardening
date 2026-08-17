"use client";

import { useMemo, useState } from "react";
import type { LandscapeGalleryEntry, SchoolProject, StudentLandscapeDesign } from "@/domain/models";
import {
  getClassLandscapeGalleryStorageKey,
  getStudentLandscapeDesignStorageKey,
  parseStoredLandscapeDesign,
  parseStoredLandscapeGallery,
  upsertLandscapeGalleryEntry,
} from "@/lib/project-store";
import { useBrowserStorageValue, writeBrowserStorage } from "@/lib/use-browser-storage";
import { LandscapeDesignPreview } from "@/components/student/LandscapeDesignPreview";

export const INTENTION_KEYWORDS = ["휴식", "녹지", "이동", "경관", "자연친화", "놀이", "기타"] as const;

export function LandscapeIntentionForm({
  project,
  nickname,
  sessionId,
  onBack,
  onPreview3D,
  onSubmitted,
}: {
  project: SchoolProject;
  nickname: string;
  sessionId: string;
  onBack: () => void;
  onPreview3D: () => void;
  onSubmitted: () => void;
}) {
  const designStorageKey = getStudentLandscapeDesignStorageKey(sessionId);
  const galleryStorageKey = getClassLandscapeGalleryStorageKey(project.id);
  const designValue = useBrowserStorageValue("local", designStorageKey);
  const galleryValue = useBrowserStorageValue("local", galleryStorageKey);
  const design = useMemo(() => parseStoredLandscapeDesign(designValue), [designValue]);
  const [keyword, setKeyword] = useState(design?.intentionKeyword ?? "");
  const [reason, setReason] = useState(design?.intentionReason ?? "");
  const [notice, setNotice] = useState("");

  if (!design || design.objects.length === 0) {
    return (
      <main className="student-design-empty">
        <p className="eyebrow">STEP 08 · DESIGN STATEMENT</p>
        <h1>먼저 조경 재료를 배치해 주세요.</h1>
        <p>설계 의도는 완성한 배치도와 함께 우리 반 갤러리에 제출됩니다.</p>
        <button className="button button--primary" type="button" onClick={onBack}>다시 꾸미기</button>
      </main>
    );
  }

  function submitDesign() {
    if (!design || design.objects.length === 0) return;
    const trimmedReason = reason.trim();
    if (!keyword) {
      setNotice("가장 중요하게 생각한 한 가지를 선택해 주세요.");
      return;
    }
    if (trimmedReason.length < 8) {
      setNotice("배치한 이유를 한 문장 이상 적어 주세요.");
      return;
    }

    const submittedAt = new Date().toISOString();
    const submittedDesign: StudentLandscapeDesign = {
      ...design,
      intentionKeyword: keyword,
      intentionReason: trimmedReason,
      submittedAt,
    };
    const entry: LandscapeGalleryEntry = {
      id: `gallery-${design.id}`,
      studentSessionId: sessionId,
      schoolProjectId: project.id,
      nickname,
      objects: design.objects,
      intentionKeyword: keyword,
      intentionReason: trimmedReason,
      submittedAt,
    };
    const gallery = upsertLandscapeGalleryEntry(parseStoredLandscapeGallery(galleryValue), entry);
    writeBrowserStorage("local", designStorageKey, JSON.stringify(submittedDesign));
    writeBrowserStorage("local", galleryStorageKey, JSON.stringify(gallery));
    onSubmitted();
  }

  return (
    <main className="intention-page">
      <header className="intention-heading">
        <div>
          <button type="button" onClick={onBack}>← 배치 수정</button>
          <p className="eyebrow">STEP 08 · DESIGN STATEMENT</p>
          <h1>내 설계의 생각을 기록하세요.</h1>
          <p>조경전문가는 무엇을 배치했는지뿐 아니라 왜 그렇게 설계했는지도 설명합니다.</p>
        </div>
        <div><span>{nickname} 설계자</span><strong>배치 재료 {design.objects.length}개</strong><button type="button" onClick={onPreview3D}>3D 다시 확인</button></div>
      </header>

      <div className="intention-layout">
        <section className="intention-design-review">
          <div className="intention-section-label"><span>01</span><div><strong>완성한 설계 확인</strong><small>제출 전 마지막 점검</small></div></div>
          <LandscapeDesignPreview objects={design.objects} variant="plan" label={`${nickname}의 조경 배치도`} />
          <dl>
            <div><dt>대상 공간</dt><dd>{project.schoolName} 중앙 빈 공간</dd></div>
            <div><dt>설계 미션</dt><dd>{project.mission}</dd></div>
          </dl>
        </section>

        <section className="intention-form-panel">
          <div className="intention-section-label"><span>02</span><div><strong>설계 의도 작성</strong><small>갤러리에 함께 공개됩니다</small></div></div>
          <fieldset>
            <legend>이 공간에서 가장 중요하게 생각한 것은 무엇인가요?</legend>
            <div className="intention-keywords">
              {INTENTION_KEYWORDS.map((item) => (
                <button key={item} className={keyword === item ? "is-selected" : ""} type="button" aria-pressed={keyword === item} onClick={() => { setKeyword(item); setNotice(""); }}>{item}</button>
              ))}
            </div>
          </fieldset>
          <label className="intention-reason">
            <span>왜 이렇게 배치했나요?</span>
            <textarea value={reason} maxLength={180} rows={5} placeholder="예: 큰 나무 아래에 벤치를 놓아 쉬는 시간에 친구들이 그늘에서 편하게 이야기할 수 있도록 했습니다." onChange={(event) => { setReason(event.target.value); setNotice(""); }} />
            <small>{reason.length} / 180자 · 한두 문장으로 작성하세요.</small>
          </label>
          <div className="intention-checklist"><strong>제출 전 확인</strong><ul><li>이동 동선을 막지 않았나요?</li><li>공간의 목적이 배치에 드러나나요?</li><li>내 설계 이유를 친구가 이해할 수 있나요?</li></ul></div>
          <p className="intention-notice" role="status">{notice}</p>
          <button className="button button--primary button--wide intention-submit" type="button" onClick={submitDesign}>우리 반 갤러리에 제출 <span aria-hidden="true">→</span></button>
        </section>
      </div>
    </main>
  );
}
