"use client";

import { useEffect, useId, useMemo, useRef, useState, type ComponentProps, type PointerEvent } from "react";
import { Box3, PerspectiveCamera, Plane, Ray, Raycaster, Vector2, Vector3 } from "three";
import type { SampleSchool3DScene, SampleSchoolCameraView } from "./SampleSchool3DScene";
import { findLandscapeMaterial } from "@/data/landscape-materials";
import type { LandscapeObject, Point2D, SchoolGardenSide, SchoolSurfaceStroke } from "@/domain/models";
import {
  findSampleSchoolSurfaceMaterial, isSampleSchoolSurfacePlacementAllowed, isSampleSchoolSurfacePointOpen,
  normalizedToSampleSchool, sampleSchoolToNormalized, SAMPLE_SCHOOL_SURFACE_MATERIALS,
} from "@/lib/sample-school";
import {
  BONGSUN_BUILDING_BOUNDS, BONGSUN_ORBIT_STEP, campusToLocalPoint, getOrbitCameraPose, getOrbitFrameAngle, getOrbitFrameUrl,
  getOrbitGardenSide, getOrbitViewAngle, getOrbitViewLabel, localToCampusPoint, normalizeOrbitAngle, orbitDragAngle,
} from "@/lib/bongsun-orbit";
import { CustomCampusBackdrop, customCampusVolumes } from "./CustomCampusBackdrop";
import type { CampusModel } from "@/lib/campus-model";
import styles from "./BongsunCompatibleEditor.module.css";

type Props = Pick<ComponentProps<typeof SampleSchool3DScene>,
  "objects" | "surfaceStrokes" | "selectedId" | "activeMaterialId" | "activeSurfaceId" |
  "cameraView" | "gardenSide" | "cameraResetKey" | "onGardenSideChange" | "onPaintSurface" | "onPlace" | "onMove" | "onSelect"> & { campus?: CampusModel };

type ViewerProps = Pick<Props, "objects" | "surfaceStrokes" | "onGardenSideChange" | "cameraResetKey" | "campus"> & {
  cameraView?: SampleSchoolCameraView;
  initialSide?: SchoolGardenSide;
};
type GroundPoint = { x: number; z: number };

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

// Test line of sight against the brick block and the taller stone wing. This also
// lets the two gardens appear beside each other in a view down the end wall.
const SCHOOL_VOLUMES = BONGSUN_BUILDING_BOUNDS.map(({ min, max }) =>
  new Box3(new Vector3(...min), new Vector3(...max)));
function visibleFrom(camera: PerspectiveCamera, point: GroundPoint, volumes: Box3[]) {
  const target = new Vector3(point.x, 0.025, point.z);
  const length = camera.position.distanceTo(target);
  const ray = new Ray(camera.position, target.sub(camera.position).normalize());
  const hit = new Vector3();
  return volumes.every(box => !ray.intersectBox(box, hit) || camera.position.distanceTo(hit) >= length);
}

function makeCamera(degrees: number) {
  const camera = new PerspectiveCamera(42, WIDTH / HEIGHT, 0.1, 160);
  const { position, target } = getOrbitCameraPose(degrees, camera.aspect);
  camera.position.set(position.x, position.y, position.z);
  camera.lookAt(target.x, target.y, target.z);
  camera.updateMatrixWorld();
  return camera;
}

function project(camera: PerspectiveCamera, x: number, y: number, z: number): Point2D {
  const p = new Vector3(x, y, z).project(camera);
  return { x: (p.x + 1) * WIDTH / 2, y: (1 - p.y) * HEIGHT / 2 };
}

function groundAt(camera: PerspectiveCamera, point: Point2D, volumes: Box3[]) {
  if (point.x < 0 || point.x > WIDTH || point.y < 0 || point.y > HEIGHT) return null;
  const ray = new Raycaster();
  ray.setFromCamera(new Vector2(2 * point.x / WIDTH - 1, 1 - 2 * point.y / HEIGHT), camera);
  const ground = ray.ray.intersectPlane(GROUND, new Vector3());
  if (!ground || !visibleFrom(camera, ground, volumes)) return null;
  for (const side of ["front", "rear"] as const) {
    const local = campusToLocalPoint(ground, side);
    if (isSampleSchoolSurfacePointOpen(local, 0, true)) return { point: sampleSchoolToNormalized(local), side };
  }
  return null;
}

function svgPoint(node: SVGGraphicsElement, x: number, y: number) {
  const matrix = node.getScreenCTM();
  return matrix ? new DOMPoint(x, y).matrixTransform(matrix.inverse()) : null;
}

// Project both sides of the brush in world space so its width foreshortens with the soil.
function strokeStrip(points: GroundPoint[], radius: number, camera: PerspectiveCamera) {
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

function strokePath(stroke: SchoolSurfaceStroke, camera: PerspectiveCamera, volumes: Box3[]) {
  const runs: GroundPoint[][] = [];
  let run: GroundPoint[] = [];
  const side = stroke.gardenSide ?? "front";
  for (const p of stroke.points) {
    const world = localToCampusPoint(normalizedToSampleSchool(p), side);
    if (isSampleSchoolSurfacePlacementAllowed(p, stroke.widthMeters, true) && visibleFrom(camera, world, volumes)) {
      run.push(world);
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs.map(points => strokeStrip(points, stroke.widthMeters / 2, camera)).join(" ");
}

function spriteFor(object: LandscapeObject, camera: PerspectiveCamera, volumes: Box3[]) {
  const material = findLandscapeMaterial(object.materialId);
  if (!material) return null;
  const world = localToCampusPoint(normalizedToSampleSchool(object), object.gardenSide ?? "front");
  if (!visibleFrom(camera, world, volumes)) return null;
  const { x, z } = world;
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
  id: number; start: Point2D; screenX: number; screenY: number; angle: number;
  item?: LandscapeObject; stroke?: { id: string; side: SchoolGardenSide }; moved?: boolean;
};

type GardenLayersProps = Pick<Props, "objects" | "surfaceStrokes" | "campus"> & {
  volumes: Box3[];
  camera: PerspectiveCamera;
  angle: number;
  selectedId?: Props["selectedId"];
  onSelect?: Props["onSelect"];
};

function GardenLayers({ objects, surfaceStrokes, camera, angle, campus, volumes, selectedId, onSelect }: GardenLayersProps) {
  const brushPrefix = useId() + "-brush-";
  const strokes = useMemo(() => [...surfaceStrokes].sort((a, b) => a.zIndex - b.zIndex)
    .map(stroke => ({ stroke, d: strokePath(stroke, camera, volumes) })), [surfaceStrokes, camera, volumes]);
  const sprites = useMemo(() => objects.map(o => spriteFor(o, camera, volumes))
    .filter(s => s !== null).sort((a, b) => b.depth - a.depth || a.object.zIndex - b.object.zIndex), [objects, camera, volumes]);
  return <>
    <defs>
      {SAMPLE_SCHOOL_SURFACE_MATERIALS.map(s => <pattern key={s.id} id={brushPrefix + s.id}
        patternUnits="userSpaceOnUse" width={64} height={22}>
        <image href={s.textureUrl} width={64} height={22} preserveAspectRatio="none" />
      </pattern>)}
    </defs>
    {campus?.kind === "generated" ? <CustomCampusBackdrop campus={campus} camera={camera} /> : (
      <image href={getOrbitFrameUrl(angle)} width={WIDTH} height={HEIGHT} aria-label={getOrbitViewLabel(angle)} />
    )}
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

const pendingFrames = new Map<number, Promise<boolean>>();
const loadedFrames = new Set<number>();

// Multiple gallery cards and both adjacent frame requests can share one browser load.
function loadFrame(degrees: number) {
  const angle = getOrbitFrameAngle(degrees);
  if (loadedFrames.has(angle)) return Promise.resolve(true);
  const pending = pendingFrames.get(angle);
  if (pending) return pending;
  const image = new Image();
  image.src = getOrbitFrameUrl(angle);
  const promise = image.decode().then(() => {
    loadedFrames.add(angle);
    return true;
  }, () => false).finally(() => pendingFrames.delete(angle));
  pendingFrames.set(angle, promise);
  return promise;
}

export function BongsunCompatibleEditor(props: Props) {
  return <OrbitCanvas key={`${props.cameraView}-${props.cameraResetKey ?? 0}`}
    campus={props.campus} objects={props.objects} surfaceStrokes={props.surfaceStrokes} cameraView={props.cameraView}
    onGardenSideChange={props.onGardenSideChange} editor={props} />;
}

export function BongsunOrbitViewer(props: ViewerProps) {
  return <OrbitCanvas key={`${props.cameraView}-${props.cameraResetKey ?? 0}`} {...props} />;
}

function OrbitCanvas({ objects, surfaceStrokes, initialSide = "front", cameraView, onGardenSideChange, campus, editor }:
  ViewerProps & { editor?: Props }) {
  const [angle, setAngle] = useState(() => getOrbitFrameAngle(cameraView ? getOrbitViewAngle(cameraView) : getOrbitViewAngle("front", initialSide)));
  const generated = campus?.kind === "generated";
  const campusName = campus?.schoolName ?? "봉선중학교";
  const volumes = useMemo(() => campus?.kind === "generated" ? customCampusVolumes(campus) : SCHOOL_VOLUMES, [campus]);
  const requestedAngle = useRef(angle);
  const mounted = useRef(false);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const camera = useMemo(() => makeCamera(angle), [angle]);
  const worldRef = useRef<SVGGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const touches = useRef(new Map<number, Point2D>());
  const pinch = useRef<{ distance: number; anchor: Point2D; scale: number } | null>(null);
  const surface = editor?.activeSurfaceId && findSampleSchoolSurfaceMaterial(editor.activeSurfaceId);
  const side = getOrbitGardenSide(angle);
  const hintId = useId();

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    onGardenSideChange?.(side);
  }, [side, onGardenSideChange]);
  useEffect(() => {
    if (generated) return;
    for (const offset of [-2, -1, 0, 1, 2]) void loadFrame(angle + offset * BONGSUN_ORBIT_STEP);
  }, [angle, generated]);

  function rotateTo(degrees: number) {
    const next = generated ? normalizeOrbitAngle(Math.round(degrees)) : getOrbitFrameAngle(degrees);
    if (next === requestedAngle.current) return;
    requestedAngle.current = next;
    if (generated || loadedFrames.has(next)) {
      setAngle(next);
      return;
    }
    // A slower connection may decode several intermediate frames while the
    // finger is still moving. Show them in travel order without flashing blank.
    function advance() {
      if (!mounted.current) return;
      const target = requestedAngle.current;
      setAngle(current => {
        const delta = (target - current + 540) % 360 - 180;
        const direction = Math.sign(delta);
        for (let distance = Math.abs(delta); distance > 0; distance -= BONGSUN_ORBIT_STEP) {
          const candidate = getOrbitFrameAngle(current + distance * direction);
          if (loadedFrames.has(candidate)) return candidate;
        }
        return current;
      });
    }
    advance();
    void loadFrame(next).then(ready => {
      if (ready) advance();
      else if (mounted.current && requestedAngle.current === next) requestedAngle.current = angle;
    });
  }

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
    if (!p) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.current.size === 2) {
      const pair = fingers();
      const anchor = worldPointer(pair.x, pair.y);
      if (anchor) pinch.current = { anchor, distance: pair.distance, scale: zoom.scale };
      gesture.current = null;
      return;
    }
    const action: Gesture = { id: event.pointerId, start: p, screenX: event.clientX, screenY: event.clientY, angle: requestedAngle.current };
    gesture.current = action;
    if (!editor) return;
    const hit = groundAt(camera, p, volumes);
    if (surface && hit && isSampleSchoolSurfacePlacementAllowed(hit.point, surface.widthMeters, true)) {
      action.stroke = { id: "surface-stroke-" + crypto.randomUUID(), side: hit.side };
      editor.onPaintSurface(action.stroke.id, surface.id, hit.point, true, hit.side);
      return;
    }
    if (surface) return;
    const id = (event.target as Element).closest("[data-object]")?.getAttribute("data-object");
    action.item = id ? objects.find(o => o.id === id) : undefined;
    if (action.item || !editor.activeMaterialId) editor.onSelect(action.item?.id ?? null);
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
    if (action.stroke && surface && editor) {
      const hit = groundAt(camera, p, volumes);
      if (hit && hit.side === action.stroke.side && isSampleSchoolSurfacePlacementAllowed(hit.point, surface.widthMeters, true)) {
        editor.onPaintSurface(action.stroke.id, surface.id, hit.point, false, hit.side);
      }
    } else if (action.item && action.moved && editor) {
      const itemSide = action.item.gardenSide ?? "front";
      const world = localToCampusPoint(normalizedToSampleSchool(action.item), itemSide);
      const anchor = project(camera, world.x, 0, world.z);
      const hit = groundAt(camera, { x: anchor.x + p.x - action.start.x, y: anchor.y + p.y - action.start.y }, volumes);
      if (hit && hit.side === itemSide) editor.onMove(action.item.id, hit.point);
    } else if (action.moved && Math.abs(dx) >= Math.abs(dy)) {
      rotateTo(orbitDragAngle(action.angle, dx, event.currentTarget.getBoundingClientRect().width));
    }
  }

  function finish(event: PointerEvent<SVGSVGElement>) {
    const action = gesture.current;
    if (event.type === "pointerup" && action?.id === event.pointerId) {
      const delta = Math.hypot(event.clientX - action.screenX, event.clientY - action.screenY);
      if (delta > 6) move(event);
      if (!action.moved && !action.item && !surface && editor?.activeMaterialId) {
        const p = worldPointer(event.clientX, event.clientY);
        const hit = p && groundAt(camera, p, volumes);
        if (hit) editor.onPlace(editor.activeMaterialId, hit.point, hit.side);
      }
    }
    touches.current.delete(event.pointerId);
    if (touches.current.size < 2) pinch.current = null;
    if (action?.id === event.pointerId) gesture.current = null;
  }

  const label = getOrbitViewLabel(angle);
  return (
    <svg className={editor ? styles.editor : styles.viewer} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      tabIndex={0} role={editor ? "group" : "slider"}
      aria-label={editor ? `${campusName} ${label} 조경 편집` : `${campusName}를 보는 방향`}
      aria-describedby={hintId}
      aria-valuemin={editor ? undefined : 0} aria-valuemax={editor ? undefined : 360 - (generated ? 1 : BONGSUN_ORBIT_STEP)}
      aria-valuenow={editor ? undefined : angle} aria-valuetext={editor ? undefined : label + " · " + angle + "도"}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        let next: number;
        switch (event.key) {
          case "ArrowLeft": next = requestedAngle.current - BONGSUN_ORBIT_STEP; break;
          case "ArrowRight": next = requestedAngle.current + BONGSUN_ORBIT_STEP; break;
          case "Home": next = 0; break;
          case "End": next = 360 - BONGSUN_ORBIT_STEP; break;
          default: return;
        }
        event.preventDefault();
        rotateTo(next);
      }}
      onPointerDown={down} onPointerMove={move}
      onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
      onDragOver={editor ? event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } : undefined}
      onDrop={editor ? event => {
        event.preventDefault();
        const id = event.dataTransfer.getData("text/gardening-material");
        const p = worldPointer(event.clientX, event.clientY);
        const hit = p && groundAt(camera, p, volumes);
        if (id && hit) editor.onPlace(id, hit.point, hit.side);
      } : undefined} data-placing={Boolean(surface || editor?.activeMaterialId)}>
      <desc id={hintId}>좌우로 끌거나 방향키로 학교를 한 바퀴 돌아보세요.</desc>
      <svg width={WIDTH} height={HEIGHT} overflow="hidden">
        <g ref={worldRef} transform={`translate(${zoom.x} ${zoom.y}) scale(${zoom.scale})`}>
          <GardenLayers objects={objects} surfaceStrokes={surfaceStrokes} camera={camera} campus={campus} volumes={volumes}
            angle={angle} selectedId={editor?.selectedId} onSelect={editor?.onSelect} />
        </g>
      </svg>
    </svg>
  );
}
