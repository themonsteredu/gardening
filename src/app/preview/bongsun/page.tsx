"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { BongsunPreviewFallback } from "./BongsunPreviewFallback";
import { SampleSchool3DScene } from "@/components/student/SampleSchool3DScene";
import { findLandscapeMaterial } from "@/data/landscape-materials";
import type { LandscapeObject, SchoolGardenSide } from "@/domain/models";
import { createLandscapeObject } from "@/lib/landscape-design";
import { sampleSchoolToNormalized } from "@/lib/sample-school";
import styles from "./preview.module.css";

const views = [
  { id: "front-left", label: "왼쪽" },
  { id: "front", label: "정면" },
  { id: "front-right", label: "오른쪽" },
] as const;
type View = (typeof views)[number]["id"];

const plantings: [string, number, number][] = [
  ["hydrangea", -7.8, -0.3], ["lavender", -6, -0.35], ["hydrangea", -4.2, -0.3],
  ["marigold", -7.1, 0.65], ["marigold", -5.1, 0.65],
  ["lavender", 3.8, -0.35], ["hydrangea", 5.7, -0.3], ["lavender", 7.6, -0.35],
  ["marigold", 4.8, 0.65], ["marigold", 6.8, 0.65],
];
const emptyGarden: LandscapeObject[] = [];
const exampleGarden = plantings.flatMap(([id, x, z], index) => {
  const material = findLandscapeMaterial(id);
  return material ? [createLandscapeObject(material, sampleSchoolToNormalized({ x, z }), index, `preview-${index}`)] : [];
});
const noAction = () => {};

export default function BongsunPreviewPage() {
  const [gardenSide, setGardenSide] = useState<SchoolGardenSide>("front");
  const [view, setView] = useState<View>("front");
  const [resetKey, setResetKey] = useState(0);
  const [planted, setPlanted] = useState(true);
  const [sceneState, setSceneState] = useState<"loading" | "ready" | "fallback">("loading");
  const ready = useCallback(() => setSceneState("ready"), []);
  const fallback = useCallback(() => setSceneState("fallback"), []);

  function lookFrom(next: View) {
    setView(next);
    setResetKey((key) => key + 1);
  }

  function switchSide(next: SchoolGardenSide) {
    if (next === gardenSide) return;
    setGardenSide(next);
    lookFrom("front");
  }

  const location = gardenSide === "front" ? "본관 앞" : "수업용 뒤뜰";

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p>3D 조경 미리보기</p>
          <h1>봉선중학교 {location}</h1>
        </div>
        <a href="https://bongsun.jge.ms.kr/data_files/skin/skin_res_1/images/main/visual25.jpg" target="_blank" rel="noreferrer">학교 전경 사진 보기 ↗</a>
      </header>
      <div className={styles.sideSwitch} role="group" aria-label="꾸밀 공간">
        <button type="button" aria-pressed={gardenSide === "front"} onClick={() => switchSide("front")}>본관 앞</button>
        <button type="button" aria-pressed={gardenSide === "rear"} onClick={() => switchSide("rear")}>뒤뜰</button>
      </div>
      <section className={styles.viewer} aria-label={`${location} 조경 미리보기`}>
        {sceneState === "fallback" ? (
          <BongsunPreviewFallback gardenSide={gardenSide} view={view} cameraResetKey={resetKey} planted={planted} />
        ) : <SampleSchool3DScene schoolName="봉선중학교" gardenSide={gardenSide} readOnly onReady={ready} onUnavailable={fallback} objects={planted ? exampleGarden : emptyGarden}
          surfaceStrokes={[]} selectedId={null} activeMaterialId={null} activeSurfaceId={null}
          cameraView={view} cameraResetKey={resetKey} onPlace={noAction}
          onMove={noAction} onSelect={noAction} onPaintSurface={noAction} />}
        {sceneState === "loading" && <span className={styles.loading} role="status">{location}을 불러오는 중…</span>}
      </section>
      <div className={styles.controls}>
        <div>
          <strong>보는 방향</strong>
          <div className={styles.switches} role="group" aria-label="보는 방향">
            {views.map((item) => (
              <button key={item.id} type="button" onClick={() => lookFrom(item.id)}>{item.label}</button>
            ))}
          </div>
        </div>
        <div>
          <strong>화단</strong>
          <div className={styles.switches} role="group" aria-label="예시 화단 표시">
            <button type="button" aria-pressed={!planted} onClick={() => setPlanted(false)}>심기 전</button>
            <button type="button" aria-pressed={planted} onClick={() => setPlanted(true)}>꽃 심은 뒤</button>
          </div>
        </div>
        <Link className={styles.practice} href="/join?campus=bongsun">직접 꾸며보기</Link>
      </div>
      <footer className={styles.note}>
        <span>화면을 좌우로 끌어 보세요. ‘정면’을 누르면 처음 방향으로 돌아와요.</span>
        <span>{gardenSide === "front" ? "본관 정면은 학교 전경 사진을 참고했고, 화단은 수업용으로 구성했어요." : "뒤뜰과 건물 뒷면은 조경을 연습할 수 있도록 구성한 예시 공간이에요."}</span>
      </footer>
    </main>
  );
}
