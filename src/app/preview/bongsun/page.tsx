"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { BongsunOrbitViewer } from "@/components/student/BongsunCompatibleEditor";
import { SampleSchool3DScene } from "@/components/student/SampleSchool3DScene";
import { findLandscapeMaterial } from "@/data/landscape-materials";
import type { LandscapeObject, SchoolGardenSide, SchoolSurfaceStroke } from "@/domain/models";
import { createLandscapeObject } from "@/lib/landscape-design";
import { sampleSchoolToNormalized } from "@/lib/sample-school";
import styles from "./preview.module.css";

const plantings: [string, number, number][] = [
  ["hydrangea", -7.8, -0.3], ["lavender", -6, -0.35], ["hydrangea", -4.2, -0.3],
  ["marigold", -7.1, 0.65], ["marigold", -5.1, 0.65],
  ["lavender", 3.8, -0.35], ["hydrangea", 5.7, -0.3], ["lavender", 7.6, -0.35],
  ["marigold", 4.8, 0.65], ["marigold", 6.8, 0.65],
];
const emptyGarden: LandscapeObject[] = [];
const noStrokes: SchoolSurfaceStroke[] = [];
const exampleGarden = (["front", "rear"] as const).flatMap(gardenSide =>
  plantings.flatMap(([id, x, z], index) => {
    const material = findLandscapeMaterial(id);
    if (!material) return [];
    const object = createLandscapeObject(material, sampleSchoolToNormalized({ x, z }), index, gardenSide + "-" + index);
    return [{ ...object, gardenSide }];
  }),
);
const noAction = () => {};

export default function BongsunPreviewPage() {
  const [side, setSide] = useState<SchoolGardenSide>("front");
  const [resetKey, setResetKey] = useState(0);
  const [planted, setPlanted] = useState(true);
  const [sceneState, setSceneState] = useState<"loading" | "ready" | "fallback">("loading");
  const ready = useCallback(() => setSceneState("ready"), []);
  const fallback = useCallback(() => setSceneState("fallback"), []);
  const objects = planted ? exampleGarden : emptyGarden;
  const common = {
    objects, surfaceStrokes: noStrokes, cameraView: "front" as const,
    cameraResetKey: resetKey, onGardenSideChange: setSide,
  };

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p>3D 조경 미리보기</p>
          <h1>봉선중학교 본관</h1>
        </div>
        <a href="https://bongsun.jge.ms.kr/data_files/skin/skin_res_1/images/main/visual25.jpg" target="_blank" rel="noreferrer">학교 전경 사진 보기 ↗</a>
      </header>
      <p className={styles.instruction}>건물을 좌우로 끌어 앞마당에서 뒤뜰까지 둘러보세요.</p>
      <section className={styles.viewer} aria-label="봉선중학교 본관 360도 조경 미리보기">
        {sceneState === "fallback" ? <BongsunOrbitViewer {...common} /> : (
          <SampleSchool3DScene {...common} schoolName="봉선중학교" gardenSide={side} readOnly onReady={ready} onUnavailable={fallback}
            selectedId={null} activeMaterialId={null} activeSurfaceId={null}
            onPlace={noAction} onMove={noAction} onSelect={noAction} onPaintSurface={noAction} />
        )}
        {sceneState === "loading" ? <span className={styles.loading} role="status">학교 모형을 불러오는 중…</span> : (
          <span className={styles.location}>{side === "front" ? "본관 앞" : "수업용 뒤뜰"}</span>
        )}
      </section>
      <div className={styles.controls}>
        <button className={styles.reset} type="button" onClick={() => setResetKey(key => key + 1)}>정면으로</button>
        <div>
          <strong>화단</strong>
          <div className={styles.switches} role="group" aria-label="예시 화단 표시">
            <button type="button" aria-pressed={!planted} onClick={() => setPlanted(false)}>심기 전</button>
            <button type="button" aria-pressed={planted} onClick={() => setPlanted(true)}>꽃 심은 뒤</button>
          </div>
        </div>
        <Link className={styles.practice} href="/join?campus=bongsun">직접 꾸며보기</Link>
      </div>
      <p className={styles.note}>본관 정면은 학교 전경 사진을 참고했어요. 건물 뒤편과 뒤뜰은 조경 수업을 위해 구성한 예시 공간이에요.</p>
    </main>
  );
}
