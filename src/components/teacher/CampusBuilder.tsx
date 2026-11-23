"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ClassJoinShare } from "@/components/teacher/ClassJoinShare";
import type { SchoolProject } from "@/domain/models";
import { BONGSUN_CAMPUS, listCampusModels, rememberSchoolClass, saveCampusModel, type CampusModel } from "@/lib/campus-model";
import { createSchoolLogoDataUrl, SCHOOL_LOGO_ACCEPT } from "@/lib/school-logo";
import { CampusBuilderPhoto } from "./CampusBuilderPhoto";
import styles from "./CampusBuilder.module.css";

const OrbitViewer = dynamic(() => import("@/components/student/BongsunCompatibleEditor").then(m => m.BongsunOrbitViewer), {
  loading: () => <span className={styles.wait}>모형을 불러오는 중…</span>,
});

interface SchoolResult { schoolName: string; region: string; homepage?: string; schoolCode: string }
interface PhotoCandidate { url: string; label: string }
interface ClassResult { project: SchoolProject; teacherKey: string }

function newModel(): CampusModel {
  return { id: "", schoolName: "", region: "", kind: "generated", floors: 3, bays: 10, wallColor: "#bb9a80", roofColor: "#64796c" };
}

function officialLink(value?: string) {
  try {
    const url = new URL(value || "");
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch { /* Some directory records have no official homepage. */ }
  return undefined;
}

async function prepareLogo(file: File) {
  const png = await createSchoolLogoDataUrl(file);
  if (png.length <= 79000) return png;
  const img = new window.Image();
  img.src = png;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("교표를 읽을 수 없어요.");
  ctx.drawImage(img, 0, 0, 160, 160);
  return canvas.toDataURL("image/webp", 0.8);
}

export function CampusBuilder() {
  const [catalogue, setCatalogue] = useState<CampusModel[]>([BONGSUN_CAMPUS]);
  const [draft, setDraft] = useState<CampusModel>(newModel);
  const [ready, setReady] = useState(false);
  const [storedId, setStoredId] = useState("");
  const [className, setClassName] = useState("");
  const [shared, setShared] = useState<ClassResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [searchResults, setSearchResults] = useState<SchoolResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState("");
  const [candidates, setCandidates] = useState<PhotoCandidate[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [photoNote, setPhotoNote] = useState("");
  const [photoKey, setPhotoKey] = useState(0);
  const [loadingLogo, setLoadingLogo] = useState(false);
  const searchSeq = useRef(0);
  const photoSeq = useRef(0);
  const logoSeq = useRef(0);
  const classPending = useRef(false);
  const creationKey = useRef<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const locked = draft.kind === "bongsun";
  const busy = saving || opening;
  const homepage = officialLink(draft.sourceUrl);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const models = await listCampusModels();
        if (active) setCatalogue(models);
      } catch {
        if (active) setError("이 브라우저에서 저장한 학교 목록을 열지 못했어요. 새 모형은 계속 만들 수 있어요.");
      }
    }
    void refresh();
    return () => { active = false; };
  }, []);

  function clearFeedback() {
    creationKey.current = null;
    setError("");
    setNotice("");
    setShared(null);
  }

  function cancelLookups() {
    ++searchSeq.current;
    ++photoSeq.current;
    ++logoSeq.current;
    setSearching(false);
    setLoadingPhotos(false);
    setLoadingLogo(false);
    setSearchResults([]);
    setCandidates([]);
    setSearchNote("");
    setPhotoNote("");
  }

  function changeAppearance(patch: Partial<CampusModel>) {
    clearFeedback();
    setDraft(current => ({ ...current, ...patch }));
  }

  function chooseModel(model: CampusModel | undefined, focusName = true) {
    cancelLookups();
    clearFeedback();
    setDraft(model || newModel());
    setStoredId(model?.id || "");
    setClassName("");
    setReady(Boolean(model));
    setProcessingPhoto(false);
    setPhotoKey(v => v + 1);
    if (!model && focusName) requestAnimationFrame(() => nameInput.current?.focus());
  }

  function editName(schoolName: string) {
    clearFeedback();
    ++searchSeq.current;
    setSearchResults([]);
    setSearchNote("");
    setSearching(false);
    ++photoSeq.current;
    setLoadingPhotos(false);
    setCandidates([]);
    setPhotoNote("");
    setStoredId("");
    setReady(false);
    setDraft(current => ({ ...current, id: "", schoolName, sourceUrl: undefined }));
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    const q = draft.schoolName.trim();
    if (q.length < 2 || searching) return;
    const seq = ++searchSeq.current;
    setSearching(true);
    setSearchNote("");
    setSearchResults([]);
    try {
      const region = draft.region.trim();
      const query = region && region.length + q.length < 79 ? region + " " + q : q;
      const res = await fetch("/api/school-search?" + new URLSearchParams({ q: query }));
      if (!res.ok) throw new Error();
      const result: { schools: SchoolResult[]; notice?: string } = await res.json();
      if (seq !== searchSeq.current) return;
      setSearchResults(result.schools);
      setSearchNote(result.notice || (result.schools.length ? "지역을 확인하고 출강할 학교를 선택하세요." : "일치하는 학교가 없어요. 입력한 이름으로 모형을 만들 수 있어요."));
    } catch {
      if (seq === searchSeq.current) setSearchNote("학교 목록을 불러오지 못했어요. 이름과 지역을 직접 입력해 계속할 수 있어요.");
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  }

  async function chooseDirectorySchool(school: SchoolResult) {
    const existing = catalogue.find(record => record.schoolName === school.schoolName && record.region === school.region);
    if (existing) { chooseModel(existing); return; }
    const official = officialLink(school.homepage);
    const knownBongsun = school.schoolName === "봉선중학교" && /광주/.test(school.region)
      ? catalogue.find(record => record.kind === "bongsun") : undefined;
    if (knownBongsun) { chooseModel(knownBongsun); return; }
    chooseModel(undefined, false);
    setDraft({ ...newModel(), schoolName: school.schoolName, region: school.region, sourceUrl: official });
    setLoadingPhotos(true);
    const seq = ++photoSeq.current;
    try {
      const res = await fetch("/api/school-photo?" + new URLSearchParams({ schoolCode: school.schoolCode, schoolName: school.schoolName }));
      if (!res.ok) throw new Error();
      const info: { images: PhotoCandidate[]; homepage?: string } = await res.json();
      if (seq !== photoSeq.current) return;
      setCandidates(info.images);
      const sourceUrl = officialLink(info.homepage) || official;
      if (sourceUrl) setDraft(current => ({ ...current, sourceUrl }));
      if (!info.images.length) setPhotoNote("홈페이지에서 정면 사진을 찾지 못했어요. 가지고 있는 사진을 올리거나 층수와 색으로 시작하세요.");
    } catch {
      if (seq === photoSeq.current) setPhotoNote("홈페이지 사진을 가져오지 못했어요. 층수와 색으로 모형을 만들거나 직접 사진을 올려 주세요.");
    } finally {
      if (seq === photoSeq.current) setLoadingPhotos(false);
    }
  }

  async function uploadLogo(file?: File) {
    if (!file) return;
    const seq = ++logoSeq.current;
    clearFeedback();
    setLoadingLogo(true);
    try {
      const logo = await prepareLogo(file);
      if (seq === logoSeq.current) changeAppearance({ logo });
    } catch (reason) {
      if (seq === logoSeq.current) setError(reason instanceof Error ? reason.message : "교표 파일을 읽지 못했어요.");
    } finally {
      if (seq === logoSeq.current) setLoadingLogo(false);
    }
  }

  function generate() {
    const schoolName = draft.schoolName.trim();
    if (schoolName.length < 2) {
      setError("학교 이름을 두 글자 이상 입력해 주세요.");
      nameInput.current?.focus();
      return;
    }
    clearFeedback();
    setDraft(current => ({ ...current, id: current.id || crypto.randomUUID(), schoolName, region: current.region.trim() }));
    setReady(true);
    requestAnimationFrame(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  async function storeModel(model: CampusModel) {
    if (model.kind !== "bongsun") await saveCampusModel(model);
    setStoredId(model.id);
    setCatalogue(await listCampusModels());
  }

  async function save() {
    if (!ready || busy) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await storeModel(draft);
      setNotice("이 기기의 학교 목록에 저장했어요. 다음 출강 때 다시 선택할 수 있어요.");
    } catch { setError("이 기기에 모형을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요."); }
    finally { setSaving(false); }
  }

  async function openClass(event: FormEvent) {
    event.preventDefault();
    if (!ready || busy || processingPhoto || !className.trim() || classPending.current) return;
    classPending.current = true;
    creationKey.current ??= crypto.randomUUID();
    setOpening(true);
    setError("");
    setNotice("");
    setShared(null);
    try {
      const res = await fetch("/api/school-classes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campus: draft, className: className.trim(), idempotencyKey: creationKey.current }),
      });
      if (!res.ok) throw new Error();
      const created: ClassResult = await res.json();
      setShared(created);
      try {
        rememberSchoolClass(created.project, created.teacherKey);
        await storeModel(draft);
      } catch {
        setNotice("수업은 열렸어요. 이 기기에 보관하지 못했으니 아래 입장 코드를 기록해 주세요.");
      }
    } catch { setError("수업을 열지 못했어요. 준비한 모형과 반 이름을 확인하고 다시 시도해 주세요."); }
    finally { classPending.current = false; setOpening(false); }
  }

  const example = catalogue.find(model => model.kind === "bongsun");
  const displayedCampus = ready ? draft : !draft.schoolName.trim() ? example : undefined;

  return (
    <div className={styles.page}>
      <AppHeader compact current="teacher" />
      <main className={styles.main}>
        <Link className={styles.back} href="/teacher">← 수업 설계실</Link>
        <header className={styles.header}>
          <div><h1>학교 본관 만들기</h1><p>출강할 학교의 본관을 만들고, 그 학교에서 학생들이 꾸밀 정원을 열어 주세요.</p></div>
          <label className={styles.savedSelect}>이 기기의 학교 목록
            <select disabled={busy} value={storedId} onChange={event => chooseModel(catalogue.find(model => model.id === event.target.value))}>
              <option value="">새 학교 만들기</option>
              {catalogue.map(model => <option key={model.id} value={model.id}>{model.schoolName}{model.region ? ` · ${model.region}` : ""}</option>)}
            </select>
          </label>
        </header>
        <div className={styles.columns}>
          <section className={styles.formCard} aria-label="학교와 본관 자료">
            <h2>출강할 학교</h2>
            {locked ? (
              <div className={styles.registered}>
                <h3>{draft.schoolName}</h3><p>{draft.region} · 등록된 360° 모형</p>
                <button type="button" className={styles.secondary} disabled={busy} onClick={() => chooseModel(undefined)}>다른 학교 만들기</button>
              </div>
            ) : <>
              <form onSubmit={search}>
                <label className={styles.field} htmlFor="campus-name">학교 이름</label>
                <div className={styles.row}>
                  <input id="campus-name" ref={nameInput} value={draft.schoolName} disabled={busy} maxLength={60}
                    placeholder="예) 봉선중학교" onChange={event => editName(event.target.value)} />
                  <button type="submit" className={styles.secondary} disabled={busy || searching || draft.schoolName.trim().length < 2}>{searching ? "검색 중…" : "학교 검색"}</button>
                </div>
              </form>
              {searchNote && <p className={styles.help} role="status">{searchNote}</p>}
              {searchResults.length > 0 && <ul className={styles.results} aria-label="학교 검색 결과">
                {searchResults.map(school => <li key={school.schoolCode}><button type="button" disabled={busy} onClick={() => void chooseDirectorySchool(school)}>
                  <strong>{school.schoolName}</strong><span>{school.region}</span>
                </button></li>)}
              </ul>}
              <label className={styles.field}>지역
                <input disabled={busy} value={draft.region} maxLength={100} placeholder="예) 광주광역시 남구" onChange={event => changeAppearance({ region: event.target.value })} />
              </label>
              <hr />
              <h2>본관 정면</h2>
              {!homepage && !loadingPhotos && !draft.frontPhoto && !photoNote && <p className={styles.help}>학교를 검색해 선택하면 공식 홈페이지에서 사진을 찾아요. 사진 없이 층수와 색만으로도 모형을 만들 수 있어요.</p>}
              {homepage && <a className={styles.source} href={homepage} target="_blank" rel="noreferrer">학교 공식 홈페이지 ↗</a>}
              <fieldset className={styles.resetFieldset} disabled={busy}>
                <CampusBuilderPhoto key={photoKey} value={draft.frontPhoto} candidates={candidates} loading={loadingPhotos} onProcessingChange={setProcessingPhoto}
                  onChange={(frontPhoto, wallColor) => changeAppearance(wallColor ? { frontPhoto, wallColor } : { frontPhoto })} />
                {photoNote && <p className={styles.help} role="status">{photoNote}</p>}
                <div className={styles.params}>
                  <label className={styles.field}>본관 층수<select value={draft.floors} onChange={e => changeAppearance({ floors: Number(e.target.value) })}>
                    {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}층</option>)}
                  </select></label>
                  <label className={styles.field}>가로 창문 수<select value={draft.bays} onChange={e => changeAppearance({ bays: Number(e.target.value) })}>
                    {Array.from({ length: 13 }, (_, i) => i + 4).map(n => <option key={n} value={n}>{n}칸</option>)}
                  </select></label>
                  <label className={styles.colorField}>외벽 색<input type="color" value={draft.wallColor} onChange={e => changeAppearance({ wallColor: e.target.value })} /></label>
                  <label className={styles.colorField}>지붕 색<input type="color" value={draft.roofColor} onChange={e => changeAppearance({ roofColor: e.target.value })} /></label>
                </div>
                <div className={styles.logoRow}>
                  {draft.logo && <Image src={draft.logo} width={40} height={40} alt="등록한 교표" unoptimized />}
                  <label className={styles.upload} htmlFor="campus-logo">{loadingLogo ? "교표 읽는 중…" : draft.logo ? "교표 바꾸기" : "교표 추가"}
                    <input id="campus-logo" type="file" accept={SCHOOL_LOGO_ACCEPT} onChange={event => { void uploadLogo(event.target.files?.[0]); event.target.value = ""; }} />
                  </label>
                  {draft.logo && <button className={styles.textButton} type="button" onClick={() => changeAppearance({ logo: undefined })}>교표 지우기</button>}
                </div>
              </fieldset>
              {!ready && <button className={styles.primaryFull} type="button" disabled={busy || processingPhoto || loadingLogo || !draft.schoolName.trim()} onClick={generate}>360° 본관 만들기</button>}
            </>}
          </section>

          <div className={styles.right}>
            <section className={styles.previewCard} ref={previewRef} aria-label="본관 모형 미리보기">
              <div className={styles.previewHeading}><h2>{displayedCampus?.schoolName || "본관 미리보기"}</h2>
                {displayedCampus && <span>{ready ? "좌우로 끌어 보기" : "등록된 모형 예시"}</span>}
              </div>
              <div className={styles.viewport}>
                {displayedCampus ? <OrbitViewer key={displayedCampus.id} campus={displayedCampus} objects={[]} surfaceStrokes={[]} /> :
                  <p className={styles.wait}>학교 이름과 자료를 입력한 뒤<br /><strong>360° 본관 만들기</strong>를 눌러 주세요.</p>}
              </div>
              <div className={styles.previewNote}>
                <p>{ready && !locked && !draft.frontPhoto
                  ? "층수·창문·색으로 구성한 수업용 본관이에요. 정면 사진을 추가할 수 있어요."
                  : "뒤뜰과 건물 옆면은 조경 수업을 위해 구성한 공간이에요."}</p>
                {ready && !locked && <button className={styles.secondary} disabled={busy || processingPhoto || loadingLogo} type="button" onClick={() => void save()}>{saving ? "저장 중…" : "학교 목록에 저장"}</button>}
              </div>
            </section>
            {ready && <section className={styles.classCard} aria-label="반 수업 열기">
              <h2>이 학교로 수업 열기</h2>
              <form onSubmit={openClass}><label className={styles.field} htmlFor="campus-class">학년·반 또는 수업 이름</label>
                <div className={styles.row}><input id="campus-class" disabled={busy} maxLength={50} value={className} placeholder="예) 1학년 2반"
                  onChange={event => { clearFeedback(); setClassName(event.target.value); }} required />
                  <button className={styles.primary} type="submit" disabled={busy || processingPhoto || loadingLogo || !className.trim() || Boolean(shared)}>{opening ? "여는 중…" : "수업 열기"}</button>
                </div>
              </form>
              {shared && <div className={styles.share}><h3>{shared.project.className} 학생 입장</h3><ClassJoinShare code={shared.project.classCode} />
                <div className={styles.classLinks}>
                  <Link className={styles.secondary} href="/teacher/lesson">조경전문가 수업 PPT</Link>
                  <Link className={styles.source} href="/teacher">수업 설계실로 돌아가기 →</Link>
                </div>
              </div>}
            </section>}
            {notice && <p className={styles.status} role="status">{notice}</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
          </div>
        </div>
      </main>
    </div>
  );
}
