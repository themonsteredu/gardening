"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { LandscapeObject, SchoolGardenSide, SchoolSurfaceStroke } from "@/domain/models";
import { isOnSchoolGardenSide } from "@/lib/sample-school";
import styles from "./BongsunDesignReview.module.css";

const GardenSnapshot = dynamic(() => import("./BongsunCompatibleEditor").then(module => module.BongsunGardenSnapshot));

const sides = [
  { id: "front", label: "본관 앞" },
  { id: "rear", label: "수업용 뒤뜰" },
] as const;

export function BongsunDesignReview({ objects, surfaceStrokes = [] }: {
  objects: LandscapeObject[];
  surfaceStrokes?: SchoolSurfaceStroke[];
}) {
  const [side, setSide] = useState<SchoolGardenSide>(() => {
    const items = [...objects, ...surfaceStrokes];
    return items.length && items.every(item => isOnSchoolGardenSide(item, "rear")) ? "rear" : "front";
  });
  const plants = objects.filter(item => isOnSchoolGardenSide(item, side));
  const strokes = surfaceStrokes.filter(item => isOnSchoolGardenSide(item, side));

  return (
    <div className={styles.review}>
      <div className={styles.actions} role="group" aria-label="작품에서 볼 공간">
        {sides.map(({ id, label }) => (
          <button type="button" key={id} aria-pressed={side === id} onClick={() => setSide(id)}>{label}</button>
        ))}
      </div>
      <div className={styles.scene}>
        <GardenSnapshot gardenSide={side} objects={plants} surfaceStrokes={strokes} />
      </div>
      <small>조경물 {plants.length}개 · 바닥 칠하기 {strokes.length}개</small>
    </div>
  );
}
