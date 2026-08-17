"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import type { Point2D, SchoolProject, SiteImage, SitePlan, SitePlanFeature } from "@/domain/models";
import {
  parseStoredProject,
  parseStoredSiteImage,
  parseStoredSitePlan,
  PROJECT_STORAGE_KEY,
  SITE_IMAGE_META_STORAGE_KEY,
  SITE_PLAN_STORAGE_KEY,
} from "@/lib/project-store";
import { getSiteImageFile } from "@/lib/site-image-store";
import { getEditableZoneFeatures, isUsablePolygon, normalizePointerPoint } from "@/lib/site-plan";
import { useBrowserStorageValue, writeBrowserStorage } from "@/lib/use-browser-storage";

export function EditableZoneEditor() {
  const projectValue = useBrowserStorageValue("local", PROJECT_STORAGE_KEY);
  const imageValue = useBrowserStorageValue("local", SITE_IMAGE_META_STORAGE_KEY);
  const planValue = useBrowserStorageValue("local", SITE_PLAN_STORAGE_KEY);
  const project = useMemo(() => parseStoredProject(projectValue), [projectValue]);
  const siteImage = useMemo(() => parseStoredSiteImage(imageValue), [imageValue]);
  const sitePlan = useMemo(() => parseStoredSitePlan(planValue), [planValue]);

  return (
    <EditableZoneWorkspace
      key={project.siteImageId ?? "no-image"}
      project={project}
      siteImage={siteImage}
      sitePlan={sitePlan}
    />
  );
}

function rectanglePoints(start: Point2D, end: Point2D): Point2D[] {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function zoneStyle(points: Point2D[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return {
    left: `${left * 100}%`,
    top: `${top * 100}%`,
    width: `${(right - left) * 100}%`,
    height: `${(bottom - top) * 100}%`,
  };
}

function EditableZoneWorkspace({
  project,
  siteImage,
  sitePlan,
}: {
  project: SchoolProject;
  siteImage: SiteImage | null;
  sitePlan: SitePlan | null;
}) {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);
  const planIdRef = useRef<string | null>(sitePlan?.id ?? null);
  const activeImage = siteImage?.id === project.siteImageId ? siteImage : null;
  const storedZone = sitePlan && sitePlan.siteImageId === activeImage?.id
    ? getEditableZoneFeatures(sitePlan.features)[0] ?? null
    : null;
  const [zone, setZone] = useState<SitePlanFeature | null>(storedZone);
  const [dragStart, setDragStart] = useState<Point2D | null>(null);
  const [draftPoints, setDraftPoints] = useState<Point2D[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState(storedZone ? "조경영역이 표시되어 있습니다." : "사진 위를 한 번 끌어 표시하세요.");

  useEffect(() => {
    if (!activeImage) return;
    let alive = true;
    let objectUrl: string | null = null;
    getSiteImageFile(activeImage.storageKey)
      .then((blob) => {
        if (!alive || !blob) {
          if (alive) setLoadError(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => { if (alive) setLoadError(true); });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activeImage]);

  function pointFromEvent(event: React.PointerEvent<HTMLDivElement>): Point2D | null {
    if (!stageRef.current) return null;
    return normalizePointerPoint(event.clientX, event.clientY, stageRef.current.getBoundingClientRect());
  }

  function persistZone(nextZone: SitePlanFeature): string | null {
    if (!activeImage) return null;
    const planId = sitePlan?.id ?? planIdRef.current ?? `site-area-${crypto.randomUUID()}`;
    planIdRef.current = planId;
    const plan: SitePlan = {
      id: planId,
      siteImageId: activeImage.id,
      features: [nextZone],
      scaleReference: null,
    };
    writeBrowserStorage("local", SITE_PLAN_STORAGE_KEY, JSON.stringify(plan));
    writeBrowserStorage("local", PROJECT_STORAGE_KEY, JSON.stringify({ ...project, sitePlanId: plan.id }));
    return planId;
  }

  function beginArea(event: React.PointerEvent<HTMLDivElement>) {
    if (!previewUrl) return;
    const point = pointFromEvent(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart(point);
    setDraftPoints(rectanglePoints(point, point));
    setNotice("손을 떼면 바로 표시됩니다.");
  }

  function resizeArea(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart) return;
    const point = pointFromEvent(event);
    if (point) setDraftPoints(rectanglePoints(dragStart, point));
  }

  function finishArea(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart) return;
    const point = pointFromEvent(event);
    const points = point ? rectanglePoints(dragStart, point) : draftPoints;
    setDragStart(null);
    setDraftPoints([]);
    if (!isUsablePolygon(points)) {
      setNotice("조금 더 넓게 끌어 표시해 주세요.");
      return;
    }
    const nextZone: SitePlanFeature = {
      id: zone?.id ?? `editable-zone-${crypto.randomUUID()}`,
      kind: "editable_zone",
      label: "조경 가능 영역",
      points,
      layer: "existing",
    };
    setZone(nextZone);
    persistZone(nextZone);
    setNotice("조경영역이 표시되었습니다.");
  }

  function resetArea() {
    setZone(null);
    setDraftPoints([]);
    setDragStart(null);
    setNotice("사진 위를 한 번 끌어 표시하세요.");
  }

  function startClass() {
    if (!zone) return;
    const planId = persistZone(zone);
    writeBrowserStorage("local", PROJECT_STORAGE_KEY, JSON.stringify({ ...project, sitePlanId: planId, status: "open" }));
    router.push("/teacher");
  }

  if (!activeImage) {
    return (
      <div className="site-plan-page">
        <AppHeader compact current="teacher" />
        <main className="site-plan-empty">
          <h1>학교 사진을 먼저 넣어주세요.</h1>
          <p>항공사진이나 학교 배치 이미지를 그대로 사용합니다.</p>
          <Link className="button button--primary" href="/teacher/site-image">학교 사진 넣기</Link>
        </main>
      </div>
    );
  }

  const aspectRatio = activeImage.width > 0 && activeImage.height > 0
    ? `${activeImage.width} / ${activeImage.height}`
    : "4 / 3";
  const visiblePoints = draftPoints.length > 0 ? draftPoints : zone?.points ?? [];

  return (
    <div className="simple-zone-page">
      <AppHeader compact current="teacher" />
      <main className="simple-zone-main">
        <header className="simple-zone-heading">
          <div>
            <Link className="text-back" href="/teacher">← 수업 준비</Link>
            <h1>조경할 곳 표시</h1>
            <p>사진 위를 한 번 끌어주세요.</p>
          </div>
          <span className={zone ? "is-ready" : ""}>{zone ? "표시됨" : "표시 전"}</span>
        </header>

        <section className="simple-zone-workspace">
          <div
            ref={stageRef}
            className={`simple-zone-stage ${dragStart ? "is-drawing" : ""}`}
            style={{ aspectRatio }}
            onPointerDown={beginArea}
            onPointerMove={resizeArea}
            onPointerUp={finishArea}
            onPointerCancel={() => { setDragStart(null); setDraftPoints([]); }}
            aria-label="학교 사진에서 조경할 공간 표시"
          >
            {!previewUrl && !loadError ? <div className="plan-stage-message">학교 사진 불러오는 중</div> : null}
            {loadError ? <div className="plan-stage-message">학교 사진을 다시 넣어주세요.</div> : null}
            {previewUrl && activeImage.mimeType === "application/pdf" ? <object data={previewUrl} type="application/pdf" title="학교 사진" /> : null}
            {previewUrl && activeImage.mimeType !== "application/pdf" ? <Image src={previewUrl} alt={`${project.schoolName} 학교 공간`} fill sizes="(max-width: 900px) 100vw, 80vw" unoptimized draggable={false} /> : null}
            {visiblePoints.length > 0 ? <div className="simple-zone-boundary" style={zoneStyle(visiblePoints)}><span>조경할 공간</span></div> : null}
          </div>
          <p className="simple-zone-notice" role="status">{notice}</p>
          <div className="simple-zone-actions">
            <Link className="button button--quiet" href="/teacher/site-image">사진 바꾸기</Link>
            <button className="button button--quiet" type="button" onClick={resetArea}>조경영역 표시</button>
            <button className="button button--primary" type="button" disabled={!zone} onClick={startClass}>수업 시작</button>
          </div>
        </section>
      </main>
    </div>
  );
}
