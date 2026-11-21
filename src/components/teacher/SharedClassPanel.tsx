"use client";

import { useEffect, useState } from "react";
import type { LandscapeGalleryEntry, SchoolProject } from "@/domain/models";
import { BongsunDesignReview } from "@/components/student/BongsunDesignReview";
import { CLASS_HISTORY_KEY, readSchoolClasses } from "@/lib/campus-model";
import { PROJECT_STORAGE_KEY } from "@/lib/project-store";
import { useBrowserStorageValue, writeBrowserStorage } from "@/lib/use-browser-storage";
import styles from "./SharedSchoolClass.module.css";

export function SchoolClassPicker({ project }: { project: SchoolProject }) {
  const history = readSchoolClasses(useBrowserStorageValue("local", CLASS_HISTORY_KEY));
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function selectClass(code: string) {
    if (!code) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/school-classes/" + encodeURIComponent(code), { cache: "no-store" });
      if (!res.ok) throw new Error();
      const { project: selected } = await res.json() as { project: SchoolProject };
      if (!selected?.sharedClass || selected.classCode !== code) throw new Error();
      writeBrowserStorage("local", PROJECT_STORAGE_KEY, JSON.stringify(selected));
    } catch { setMessage("수업을 불러오지 못했어요. 잠시 후 다시 선택해 주세요."); }
    finally { setLoading(false); }
  }
  if (!history.length) return null;
  return <div className={styles.history}>
    <label htmlFor="school-class-picker">내가 연 수업</label>
    <select id="school-class-picker" value={project.sharedClass ? project.classCode : ""} disabled={loading}
      onChange={event => void selectClass(event.target.value)}>
      {!project.sharedClass && <option value="">수업 선택</option>}
      {history.map(item => <option key={item.code} value={item.code}>{item.schoolName} · {item.className} ({item.code})</option>)}
    </select>
    {(message || loading) && <small role="status">{message || "수업을 불러오는 중…"}</small>}
  </div>;
}

export function SharedClassPanel({ project, gallery }: { project: SchoolProject; gallery: boolean }) {
  const [works, setWorks] = useState<LandscapeGalleryEntry[]>([]);
  const [status, setStatus] = useState("제출 현황을 불러오는 중…");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    async function load() {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const res = await fetch("/api/school-classes/" + encodeURIComponent(project.classCode) + "/works",
          { signal: controller.signal, cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json() as { entries: LandscapeGalleryEntry[] };
        if (!Array.isArray(data.entries)) throw new Error();
        if (!controller.signal.aborted) { setWorks(data.entries); setStatus(""); }
      } catch {
        if (!controller.signal.aborted) setStatus("제출 현황을 불러오지 못했어요. 다시 확인해 주세요.");
      } finally { busy = false; }
    }
    void load();
    const interval = window.setInterval(load, 12000);
    document.addEventListener("visibilitychange", load);
    return () => { controller.abort(); clearInterval(interval); document.removeEventListener("visibilitychange", load); };
  }, [project.classCode, revision]);
  return <section className="dashboard-content"><div className="wide-panel">
    <div className="panel-heading"><div><h2>{gallery ? "우리 반 작품" : "작품을 제출한 학생"}</h2>
      <p>{project.schoolName} · {project.className} · 제출 {works.length}건</p></div>
      <button className="button button--quiet" type="button" onClick={() => setRevision(n => n + 1)}>새로고침</button>
    </div>
    {status && <p role="status">{status}</p>}
    {!status && !works.length && <p>학생이 설계를 제출하면 여기에 표시돼요.</p>}
    {gallery ? <div className={styles.works}>{works.map(work => <article key={work.id} className={styles.work}>
      <h3>{work.nickname}</h3>
      <BongsunDesignReview campus={project.campusModel} objects={work.objects} surfaceStrokes={work.surfaceStrokes}/>
      <p><strong>{work.intentionKeyword}</strong> · {work.intentionReason}</p>
    </article>)}</div> : works.length > 0 && <table className="student-table"><thead><tr><th>닉네임</th><th>조경물</th><th>제출 시각</th></tr></thead>
      <tbody>{works.map(work => <tr key={work.id}><td>{work.nickname}</td><td>{work.objects.length}개</td>
        <td>{new Date(work.submittedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</td></tr>)}</tbody></table>}
  </div></section>;
}
