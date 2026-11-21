"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import slides from "@/data/landscape-lesson.json";
import styles from "./LandscapeLesson.module.css";

const directory = "/lessons/landscape";
const slideImage = (index: number) => `${directory}/slide-${index + 1}.webp`;
const last = slides.length - 1;

export function LandscapeLesson() {
  const [index, setIndex] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const stage = useRef<HTMLElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const stopButton = useRef<HTMLButtonElement>(null);
  const slide = slides[index];

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return;
      if (event.target instanceof HTMLElement && event.target.closest("select, input, textarea, [contenteditable=true]")) return;
      switch (event.key) {
        case "ArrowRight": case "PageDown":
          setIndex(current => Math.min(last, current + 1)); break;
        case "ArrowLeft": case "PageUp":
          setIndex(current => Math.max(0, current - 1)); break;
        case "Home": setIndex(0); break;
        case "End": setIndex(last); break;
        case "Escape":
          if (!presenting) return;
          setPresenting(false);
          if (document.fullscreenElement === stage.current) void document.exitFullscreen().catch(() => {});
          break;
        default: return;
      }
      event.preventDefault();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [presenting]);

  useEffect(() => {
    function syncFullscreen() {
      if (!document.fullscreenElement) setPresenting(false);
    }
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    if (index < last) {
      const next = new window.Image();
      next.src = slideImage(index + 1);
    }
  }, [index]);

  useEffect(() => {
    if (!presenting) return;
    const returnTo = startButton.current;
    stopButton.current?.focus({ preventScroll: true });
    return () => returnTo?.focus({ preventScroll: true });
  }, [presenting]);

  function togglePresentation() {
    if (presenting) {
      setPresenting(false);
      if (document.fullscreenElement === stage.current) void document.exitFullscreen().catch(() => {});
    } else {
      setPresenting(true);
      // Keep the full-viewport layout on tablets without element fullscreen.
      if (stage.current?.requestFullscreen) void stage.current.requestFullscreen().catch(() => {});
    }
  }

  return (
    <main ref={stage} className={`${styles.lesson} ${presenting ? styles.presenting : ""}`}>
      <header className={styles.header}>
        <div>
          <Link href="/teacher" className={styles.back}>수업 설계실로</Link>
          <h1>조경전문가 수업 PPT</h1>
        </div>
        <div className={styles.actions}>
          <a className={styles.secondary} href={directory + "/school-garden.pptx"} download="조경전문가_학교_정원_설계.pptx">PPTX 받기</a>
          <button ref={startButton} className={styles.primary} type="button" onClick={togglePresentation}>전체화면 발표</button>
        </div>
      </header>
      <div className={styles.viewer}>
        <figure className={styles.frame} aria-label={slide.title}>
          <Image src={slideImage(index)} width={1280} height={720} alt={slide.title + ". " + slide.description} loading="eager" unoptimized />
        </figure>
        <nav className={styles.navigation} aria-label="슬라이드 이동">
          <span className={styles.count} aria-live="polite" aria-atomic="true">{index + 1} / {slides.length}</span>
          <select value={index} aria-label="슬라이드 선택" onChange={event => setIndex(Number(event.target.value))}>
            {slides.map((item, i) => <option key={item.title} value={i}>{i + 1}. {item.title}</option>)}
          </select>
          <div className={styles.controls}>
            <button className={styles.secondary} type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>이전</button>
            {index < last
              ? <button className={styles.primary} type="button" onClick={() => setIndex(index + 1)}>다음</button>
              : <Link className={styles.primary} href="/teacher">수업 설계실로</Link>}
            {presenting && <button ref={stopButton} className={styles.secondary} type="button" onClick={togglePresentation}>발표 마치기</button>}
          </div>
        </nav>
        <p className={styles.transcript}>{slide.description}</p>
        <details className={styles.notes}>
          <summary>강사 진행 메모</summary>
          <p>{slide.note}</p>
          {slide.sources?.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>)}
        </details>
      </div>
    </main>
  );
}
