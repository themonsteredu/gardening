"use client";

import Image from "next/image";
import { type PointerEvent, useId, useRef, useState } from "react";
import type { SchoolGardenSide } from "@/domain/models";
import { BONGSUN_VIEWS as angles, getBongsunFrameUrl } from "@/lib/bongsun-views";
import styles from "./preview.module.css";

type View = "front-left" | "front" | "front-right";

export function BongsunPreviewFallback({
  gardenSide,
  view,
  cameraResetKey,
  planted,
}: {
  gardenSide: SchoolGardenSide;
  view: View;
  cameraResetKey: number;
  planted: boolean;
}) {
  return <FrameViewer key={`${gardenSide}-${view}-${cameraResetKey}`} gardenSide={gardenSide} initialView={view} planted={planted} />;
}

function FrameViewer({ gardenSide, initialView, planted }: { gardenSide: SchoolGardenSide; initialView: View; planted: boolean }) {
  const [index, setIndex] = useState(() => angles.findIndex((angle) => angle.frame === initialView));
  const drag = useRef<{ pointerId: number; x: number; index: number } | null>(null);
  const hintId = useId();
  const angle = angles[index];
  const label = angle.angle === 0 ? "정면" : `${angle.angle < 0 ? "왼쪽" : "오른쪽"} ${Math.round(Math.abs(angle.angle))}도`;
  const location = gardenSide === "front" ? "봉선중학교 본관" : "봉선중학교 수업용 뒤뜰";
  const frame = getBongsunFrameUrl(gardenSide, angle.frame, planted);

  function showAngle(next: number) {
    setIndex(Math.max(0, Math.min(angles.length - 1, next)));
  }

  function updateDrag(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const step = Math.min(60, event.currentTarget.clientWidth / 12);
    if (step > 0) showAngle(start.index + Math.round((start.x - event.clientX) / step));
  }

  return (
    <div
      className={styles.frameViewer}
      role="slider"
      tabIndex={0}
      aria-label={`${location}을 보는 방향`}
      aria-describedby={hintId}
      aria-valuemin={1}
      aria-valuemax={angles.length}
      aria-valuenow={index + 1}
      aria-valuetext={`${label} · ${planted ? "꽃 심은 뒤" : "심기 전"}`}
      onKeyDown={(event) => {
        switch (event.key) {
          case "ArrowLeft": showAngle(index - 1); break;
          case "ArrowRight": showAngle(index + 1); break;
          case "Home": showAngle(0); break;
          case "End": showAngle(angles.length - 1); break;
          default: return;
        }
        event.preventDefault();
      }}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, x: event.clientX, index };
      }}
      onPointerMove={updateDrag}
      onPointerUp={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        updateDrag(event);
        drag.current = null;
      }}
      onLostPointerCapture={(event) => {
        if (drag.current?.pointerId === event.pointerId) drag.current = null;
      }}
    >
      <Image
        src={frame}
        alt={`${label}에서 본 ${location} 모형과 ${planted ? "꽃을 심은 화단" : "심기 전 화단"}`}
        fill
        unoptimized
        draggable={false}
        className={styles.frameImage}
      />
      <span className={styles.frameHint} id={hintId}>호환 보기 · 좌우로 밀어서 보기</span>
    </div>
  );
}
