"use client";

import qrCode from "qrcode-generator";
import { useMemo, useState, useSyncExternalStore } from "react";
import styles from "./SharedSchoolClass.module.css";

const subscribe = () => () => {};
export function ClassJoinShare({ code }: { code: string }) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const url = origin ? new URL("/join?code=" + encodeURIComponent(code), origin).href : "";
  const [feedback, setFeedback] = useState("");
  const qr = useMemo(() => {
    if (!url) return null;
    const symbol = qrCode(0, "M");
    symbol.addData(url);
    symbol.make();
    const count = symbol.getModuleCount();
    const cells: string[] = [];
    for (let y = 0; y < count; y++) {
      for (let x = 0; x < count; x++) {
        if (symbol.isDark(y, x)) cells.push(`M${x + 4} ${y + 4}h1v1h-1z`);
      }
    }
    return { size: count + 8, path: cells.join("") };
  }, [url]);

  async function copyLink() {
    try { await navigator.clipboard.writeText(url); setFeedback("입장 링크를 복사했어요."); }
    catch { setFeedback("학생 입장 링크를 길게 눌러 복사해 주세요."); }
  }

  return <div className={styles.share}>
    {qr && <svg role="img" aria-label="이 반의 학생 입장 QR 코드" viewBox={`0 0 ${qr.size} ${qr.size}`}
      width="168" height="168" shapeRendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d={qr.path} fill="#14281f"/></svg>}
    <div><p>학생 입장 코드</p><strong className={styles.code}>{code}</strong><p>태블릿으로 QR을 찍고 닉네임을 입력하세요.</p>
      <div className={styles.actions}>
        {url && <a className="button button--quiet" href={url}>학생 입장 링크</a>}
        <button type="button" className="button button--quiet" disabled={!url} onClick={copyLink}>링크 복사</button>
      </div>{feedback && <small role="status">{feedback}</small>}
    </div>
  </div>;
}
