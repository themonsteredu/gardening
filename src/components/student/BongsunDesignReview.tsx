"use client";

import dynamic from "next/dynamic";
import type { CampusModel } from "@/lib/campus-model";
import { useState } from "react";
import type { LandscapeObject, SchoolGardenSide, SchoolSurfaceStroke } from "@/domain/models";
import { isOnSchoolGardenSide } from "@/lib/sample-school";
import styles from "./BongsunDesignReview.module.css";

const OrbitViewer = dynamic(() => import("./BongsunCompatibleEditor").then(module => module.BongsunOrbitViewer));

export function BongsunDesignReview({ objects, surfaceStrokes = [], campus }: {
  campus?: CampusModel;
  objects: LandscapeObject[];
  surfaceStrokes?: SchoolSurfaceStroke[];
}) {
  const items = [...objects, ...surfaceStrokes];
  const initialSide = items.length > 0 && items.every(item => isOnSchoolGardenSide(item, "rear")) ? "rear" : "front";
  const [side, setSide] = useState<SchoolGardenSide>(initialSide);
  const objectCount = objects.filter(item => isOnSchoolGardenSide(item, side)).length;
  const strokeCount = surfaceStrokes.filter(item => isOnSchoolGardenSide(item, side)).length;

  return (
    <div className={styles.review}>
      <div className={styles.scene}>
        <OrbitViewer campus={campus} objects={objects} surfaceStrokes={surfaceStrokes} initialSide={initialSide} onGardenSideChange={setSide} />
      </div>
      <div className={styles.caption}>
        <strong>{side === "front" ? "본관 앞" : "수업용 뒤뜰"}</strong>
        <span>조경물 {objectCount}개 · 바닥 칠하기 {strokeCount}개</span>
        <span>좌우로 끌어 둘러보기</span>
      </div>
    </div>
  );
}
