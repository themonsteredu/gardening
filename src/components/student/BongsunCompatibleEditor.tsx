"use client";

import { useId, useMemo, useRef, useState, type ComponentProps, type PointerEvent } from "react";
import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from "three";
import type { SampleSchool3DScene } from "./SampleSchool3DScene";
import { findLandscapeMaterial } from "@/data/landscape-materials";
import type { LandscapeObject, Point2D, SchoolGardenSide, SchoolSurfaceStroke } from "@/domain/models";
import {
  findSampleSchoolSurfaceMaterial, isSampleSchoolSurfacePlacementAllowed,
  normalizedToSampleSchool, sampleSchoolToNormalized, SAMPLE_SCHOOL_SURFACE_MATERIALS,
} from "@/lib/sample-school";
import { BONGSUN_VIEWS as VIEWS, getBongsunFrameUrl } from "@/lib/bongsun-views";
import styles from "./BongsunCompatibleEditor.module.css";

type Props = Pick<ComponentProps<typeof SampleSchool3DScene>,
  "objects" | "surfaceStrokes" | "selectedId" | "activeMaterialId" | "activeSurfaceId" |
  "cameraView" | "gardenSide" | "cameraResetKey" | "onPaintSurface" | "onPlace" | "onMove" | "onSelect">;

// The baked backgrounds and the WebGL scene share a camera in the same world coordinates.
const WIDTH = 1100;
const HEIGHT = 520;
const GROUND = new Plane(new Vector3(0, 1, 0), 0);
const MODEL_IMAGES: Record<string, string> = {
  flower: "/assets/photoreal/flower_gazania-thumb.png",
  bench: "/assets/photoreal/painted_wooden_bench-thumb.png",
  rock: "/assets/photoreal/rock_moss_set_01-thumb.png",
};
const INITIAL_ZOOM = { scale: 1, x: 0, y: 0 };

function makeCamera(viewIndex: number) {
  const aspect = WIDTH / HEIGHT;
  const camera = new PerspectiveCamera(42, aspect, 0.1, 120);
  const distance = Math.max(14, 13.2 / (Math.tan(42 * Math.PI / 360) * aspect));
  const angle = VIEWS[viewIndex].angle * Math.PI / 180;
  camera.position.set(Math.sin(angle) * distance, 1.35 + distance * 0.105, -3.7 + Math.cos(angle) * distance);
  camera.lookAt(0, 1.35, -3.7);
  camera.updateMatrixWorld();
  return camera;
}

function project(camera: PerspectiveCamera, x: number, y: number, z: number): Point2D {
  const p = new Vector3(x, y, z).project(camera);
  return { x: (p.x + 1) * WIDTH / 2, y: (1 - p.y) * HEIGHT / 2 };
}

function groundAt(camera: PerspectiveCamera, point: Point2D): Point2D | null {
  const ray = new Raycaster();
  ray.setFromCamera(new Vector2(2 * point.x / WIDTH - 1, 1 - 2 * point.y / HEIGHT), camera);
  const ground = ray.ray.intersectPlane(GROUND, new Vector3());
  return ground && sampleSchoolToNormalized(ground);
}

function svgPoint(node: SVGGraphicsElement, x: number, y: number) {
  const matrix = node.getScreenCTM();
  return matrix ? new DOMPoint(x, y).matrixTransform(matrix.inverse()) : null;
}

// Project both sides of the brush in world space so its width foreshortens with the soil.
function strokePath(stroke: SchoolSurfaceStroke, camera: PerspectiveCamera) {
  const points = stroke.points.filter(p => isSampleSchoolSurfacePlacementAllowed(p, stroke.widthMeters, true))
    .map(normalizedToSampleSchool);
  if (!points.length) return "";
  const radius = stroke.widthMeters / 2;
  const vertex = (x: number, z: number) => {
    const p = project(camera, x, 0.01, z);
    return p.x.toFixed(2) + " " + p.y.toFixed(2);
  };
  const disc = (p: typeof points[number]) => "M" + Array.from({ length: 16 }, (_, i) => {
    const angle = i * Math.PI / 8;
    return vertex(p.x + radius * Math.cos(angle), p.z + radius * Math.sin(angle));
  }).join("L") + "Z";
  if (points.length === 1) return disc(points[0]);
  const left: string[] = [];
  const right: string[] = [];
  points.forEach((p, index) => {
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(points.length - 1, index + 1)];
    const dx = after.x - before.x;
    const dz = after.z - before.z;
    const width = radius / (Math.hypot(dx, dz) || 1);
    left.push(vertex(p.x - dz * width, p.z + dx * width));
    right.push(vertex(p.x + dz * width, p.z - dx * width));
  });
  // The strip and its end caps use the same winding.
  return "M" + right.concat(left.reverse()).join("L") + "Z" + disc(points[0]) + disc(points[points.length - 1]);
}

function spriteFor(object: LandscapeObject, camera: PerspectiveCamera) {
  const material = findLandscapeMaterial(object.materialId);
  if (!material) return null;
  const { x, z } = normalizedToSampleSchool(object);
  const anchor = project(camera, x, 0.015, z);
  const depth = -new Vector3(x, 0.015, z).applyMatrix4(camera.matrixWorldInverse).z;
  if (depth <= camera.near) return null;
  const pxPerMeter = HEIGHT / (2 * Math.tan(camera.fov * Math.PI / 360) * depth);
  return {
    object, material, anchor, depth, src: material.sideAssetUrl || MODEL_IMAGES[material.id] || material.planAssetUrl,
    width: material.realWidthMeters * object.scale * pxPerMeter,
    height: material.realHeightMeters * object.scale * pxPerMeter,
  };
}

type Gesture = {
  id: number; start: Point2D; screenX: number; screenY: number; view: number;
  item?: LandscapeObject; stroke?: string; moved?: boolean;
};

export function BongsunCompatibleEditor(props: Props) {
  // Remount when a toolbar view is selected, including repeated clicks on the same view.
  return <EditorView key={`${props.gardenSide}-${props.cameraView}-${props.cameraResetKey ?? 0}`} {...props} />;
}

type GardenLayersProps = Pick<Props, "objects" | "surfaceStrokes"> & {
  camera: PerspectiveCamera;
  gardenSide: SchoolGardenSide;
  view: number;
  selectedId?: Props["selectedId"];
  onSelect?: Props["onSelect"];
};

function GardenLayers({ objects, surfaceStrokes, camera, gardenSide, view, selectedId, onSelect }: GardenLayersProps) {
  const brushPrefix = useId() + "-brush-";
  const strokes = useMemo(() => [...surfaceStrokes].sort((a, b) => a.zIndex - b.zIndex)
    .map(stroke => ({ stroke, d: strokePath(stroke, camera) })), [surfaceStrokes, camera]);
  const sprites = useMemo(() => objects.map(o => spriteFor(o, camera))
    .filter(s => s !== null).sort((a, b) => b.depth - a.depth || a.object.zIndex - b.object.zIndex), [objects, camera]);
  return <>
    <defs>
      {SAMPLE_SCHOOL_SURFACE_MATERIALS.map(s => <pattern key={s.id} id={brushPrefix + s.id}
        patternUnits="userSpaceOnUse" width={64} height={22}>
        <image href={s.textureUrl} width={64} height={22} preserveAspectRatio="none" />
      </pattern>)}
    </defs>
    <image href={getBongsunFrameUrl(gardenSide, VIEWS[view].frame)} width={WIDTH} height={HEIGHT}
      aria-label={`${gardenSide === "rear" ? "수업용 뒤뜰" : "본관"} ${VIEWS[view].angle === 0 ? "정면" : VIEWS[view].angle < 0 ? "왼쪽" : "오른쪽"}`} />
    {strokes.map(({ stroke, d }) => <path key={stroke.id} d={d} fill={`url(#${brushPrefix}${stroke.materialId})`} />)}
    {sprites.map(({ object, material, anchor, src, width, height }) => (
      <g key={object.id} data-object={onSelect ? object.id : undefined} className={onSelect ? styles.item : undefined}
        transform={`translate(${anchor.x} ${anchor.y})`} tabIndex={onSelect ? 0 : undefined} role={onSelect ? "button" : undefined}
        aria-label={onSelect ? material.name + " 선택" : undefined} aria-pressed={onSelect ? selectedId === object.id : undefined}
        onKeyDown={onSelect ? event => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(object.id); }
        } : undefined}>
        {onSelect && <rect width={width} height={height} x={-width / 2} y={-height} fill="transparent" />}
        {selectedId === object.id && <ellipse rx={width * 0.53} ry={Math.max(3, width * 0.09)}
          fill="none" stroke="#ffcf4d" strokeWidth={3} />}
        {src ? <image href={src} x={-width / 2} y={-height} width={width} height={height}
          preserveAspectRatio="none" /> : <ellipse cy={-height / 2} rx={width / 2} ry={height / 2} fill={material.color} />}
      </g>
    ))}
  </>;
}

export function BongsunGardenSnapshot({ gardenSide, objects, surfaceStrokes }: {
  gardenSide: SchoolGardenSide;
  objects: LandscapeObject[];
  surfaceStrokes: SchoolSurfaceStroke[];
}) {
  const view = VIEWS.findIndex(v => v.angle === 0);
  const camera = useMemo(() => makeCamera(view), [view]);
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img"
      aria-label={gardenSide === "rear" ? "봉선중학교 수업용 뒤뜰 설계" : "봉선중학교 본관 앞 설계"}
      style={{ display: "block", width: "100%", height: "auto" }}>
      <GardenLayers objects={objects} surfaceStrokes={surfaceStrokes} camera={camera} gardenSide={gardenSide} view={view} />
    </svg>
  );
}

function EditorView({ objects, surfaceStrokes, selectedId, activeMaterialId, activeSurfaceId, cameraView, gardenSide = "front",
  onPlace, onMove, onSelect, onPaintSurface }: Props) {
  const [view, setView] = useState(() => {
    const initial = VIEWS.findIndex(v => v.frame === cameraView);
    return initial < 0 ? 5 : initial;
  });
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const camera = useMemo(() => makeCamera(view), [view]);
  const worldRef = useRef<SVGGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const touches = useRef(new Map<number, Point2D>());
  const pinch = useRef<{ distance: number; anchor: Point2D; scale: number } | null>(null);
  const surface = activeSurfaceId && findSampleSchoolSurfaceMaterial(activeSurfaceId);

  function worldPointer(clientX: number, clientY: number) {
    return worldRef.current && svgPoint(worldRef.current, clientX, clientY);
  }

  function fingers() {
    const [a, b] = Array.from(touches.current.values());
    return { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function down(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || touches.current.size >= 2) return;
    const p = worldPointer(event.clientX, event.clientY);
    if (!p || p.x < 0 || p.x > WIDTH || p.y < 0 || p.y > HEIGHT) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.current.size === 2) {
      const pair = fingers();
      const anchor = worldPointer(pair.x, pair.y);
      if (anchor) pinch.current = { anchor, distance: pair.distance, scale: zoom.scale };
      gesture.current = null;
      return;
    }
    const action: Gesture = { id: event.pointerId, start: p, screenX: event.clientX, screenY: event.clientY, view };
    gesture.current = action;
    const point = groundAt(camera, p);
    if (surface && point && isSampleSchoolSurfacePlacementAllowed(point, surface.widthMeters, true)) {
      action.stroke = "surface-stroke-" + crypto.randomUUID();
      onPaintSurface(action.stroke, surface.id, point, true);
      return;
    }
    if (surface) return;
    const id = (event.target as Element).closest("[data-object]")?.getAttribute("data-object");
    action.item = objects.find(o => o.id === id);
    if (action.item || !activeMaterialId) onSelect(action.item?.id ?? null);
  }

  function move(event: PointerEvent<SVGSVGElement>) {
    if (!touches.current.has(event.pointerId)) return;
    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.current && touches.current.size === 2) {
      const pair = fingers();
      const center = svgPoint(event.currentTarget, pair.x, pair.y);
      if (!center) return;
      const { anchor, distance, scale: startScale } = pinch.current;
      const scale = Math.max(1, Math.min(2.5, startScale * pair.distance / distance));
      setZoom({ scale, x: Math.max(WIDTH * (1 - scale), Math.min(0, center.x - anchor.x * scale)),
        y: Math.max(HEIGHT * (1 - scale), Math.min(0, center.y - anchor.y * scale)) });
      return;
    }
    const action = gesture.current;
    const p = worldPointer(event.clientX, event.clientY);
    if (!action || action.id !== event.pointerId || !p) return;
    const dx = event.clientX - action.screenX;
    const dy = event.clientY - action.screenY;
    if (Math.hypot(dx, dy) > 6) action.moved = true;
    if (action.stroke && surface) {
      const point = groundAt(camera, p);
      if (point && isSampleSchoolSurfacePlacementAllowed(point, surface.widthMeters, true)) {
        onPaintSurface(action.stroke, surface.id, point, false);
      }
    } else if (action.item && action.moved) {
      const world = normalizedToSampleSchool(action.item);
      const anchor = project(camera, world.x, 0, world.z);
      const point = groundAt(camera, { x: anchor.x + p.x - action.start.x, y: anchor.y + p.y - action.start.y });
      if (point) onMove(action.item.id, point);
    } else if (action.moved && Math.abs(dx) >= Math.abs(dy)) {
      const fullSweep = Math.max(90, event.currentTarget.getBoundingClientRect().width * 0.48);
      const angle = VIEWS[action.view].angle - dx / fullSweep * 90;
      const nearest = VIEWS.reduce((best, v, i) =>
        Math.abs(v.angle - angle) < Math.abs(VIEWS[best].angle - angle) ? i : best, action.view);
      setView(nearest);
    }
  }

  function finish(event: PointerEvent<SVGSVGElement>) {
    const action = gesture.current;
    if (event.type === "pointerup" && action?.id === event.pointerId && !action.moved && !action.item
      && !surface && activeMaterialId) {
      const p = worldPointer(event.clientX, event.clientY);
      const point = p && groundAt(camera, p);
      if (point) onPlace(activeMaterialId, point);
    }
    touches.current.delete(event.pointerId);
    if (touches.current.size < 2) pinch.current = null;
    if (action?.id === event.pointerId) gesture.current = null;
  }

  return (
    <svg className={styles.editor} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group"
      aria-label={gardenSide === "rear" ? "봉선중학교 수업용 뒤뜰 조경 편집" : "봉선중학교 본관 앞 화단 조경 편집"} onPointerDown={down} onPointerMove={move}
      onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
      onDrop={event => {
        event.preventDefault();
        const id = event.dataTransfer.getData("text/gardening-material");
        const p = worldPointer(event.clientX, event.clientY);
        const point = p && groundAt(camera, p);
        if (id && point) onPlace(id, point);
      }} data-placing={Boolean(surface || activeMaterialId)}>
      <svg width={WIDTH} height={HEIGHT} overflow="hidden">
        <g ref={worldRef} transform={`translate(${zoom.x} ${zoom.y}) scale(${zoom.scale})`}>
          <GardenLayers objects={objects} surfaceStrokes={surfaceStrokes} camera={camera}
            gardenSide={gardenSide} view={view} selectedId={selectedId} onSelect={onSelect} />
        </g>
      </svg>
    </svg>
  );
}
