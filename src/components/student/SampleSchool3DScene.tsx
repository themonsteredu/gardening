"use client";

import { useEffect, useRef, useState } from "react";
import type {
  Group,
  Material,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Texture,
  Vector2,
  WebGLRenderer,
} from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { findLandscapeMaterial, LANDSCAPE_MATERIALS, type PlanLandscapeMaterial } from "@/data/landscape-materials";
import type { LandscapeObject, Point2D } from "@/domain/models";
import {
  SAMPLE_SCHOOL_DEPTH_METERS,
  SAMPLE_SCHOOL_WIDTH_METERS,
  sampleSchoolToNormalized,
} from "@/lib/sample-school";

export type SampleSchoolCameraView = "aerial" | "orbit" | "walk";

interface SceneRuntime {
  THREE: typeof import("three");
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  controls: OrbitControls;
  ground: Mesh;
  landscapeRoot: Group;
  raycaster: Raycaster;
  pointer: Vector2;
  textures: Map<string, Texture>;
  generatedTextures: Texture[];
}

interface SceneCallbacks {
  onPlace: (materialId: string, point: Point2D) => void;
  onMove: (objectId: string, point: Point2D) => void;
  onSelect: (objectId: string | null) => void;
}

function disposeObject(root: Object3D) {
  root.traverse((object) => {
    const candidate = object as Object3D & { geometry?: { dispose: () => void }; material?: Material | Material[] };
    candidate.geometry?.dispose();
    const materials = Array.isArray(candidate.material) ? candidate.material : candidate.material ? [candidate.material] : [];
    for (const material of materials) material.dispose();
  });
}

function clearGroup(group: Group) {
  for (const child of [...group.children]) {
    group.remove(child);
    disposeObject(child);
  }
}

function getLandscapeObjectId(object: Object3D | null): string | null {
  let current = object;
  while (current) {
    if (typeof current.userData.landscapeObjectId === "string") return current.userData.landscapeObjectId;
    current = current.parent;
  }
  return null;
}

function setInteractiveObjectId(root: Object3D, id: string) {
  root.traverse((object) => { object.userData.landscapeObjectId = id; });
}

function applyCamera(runtime: SceneRuntime | null, view: SampleSchoolCameraView) {
  if (!runtime) return;
  const { camera, controls } = runtime;
  if (view === "aerial") {
    camera.position.set(0, 31, 0.001);
    controls.target.set(0, 0, 0);
    controls.minDistance = 20;
    controls.maxDistance = 38;
    controls.maxPolarAngle = Math.PI * 0.48;
  } else if (view === "walk") {
    camera.position.set(-1.5, 2.1, 9.7);
    controls.target.set(-0.5, 1.2, 0.4);
    controls.minDistance = 4;
    controls.maxDistance = 22;
    controls.maxPolarAngle = Math.PI * 0.5;
  } else {
    camera.position.set(17, 15, 19);
    controls.target.set(0, 0.8, 0);
    controls.minDistance = 12;
    controls.maxDistance = 42;
    controls.maxPolarAngle = Math.PI * 0.49;
  }
  camera.near = 0.1;
  camera.far = 120;
  camera.updateProjectionMatrix();
  controls.update();
}

function addFlatArea(
  THREE: typeof import("three"),
  parent: Object3D,
  width: number,
  depth: number,
  color: number,
  x: number,
  z: number,
  y = 0.025,
) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.94, metalness: 0 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addSchoolBuilding(
  THREE: typeof import("three"),
  parent: Object3D,
  options: { x: number; z: number; width: number; depth: number; height: number; floors: number; color: number; windows?: boolean },
) {
  const { x, z, width, depth, height, floors, color, windows = true } = options;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.82 }),
  );
  body.position.set(x, height / 2, z);
  body.castShadow = true;
  body.receiveShadow = true;
  parent.add(body);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.16, 0.2, depth + 0.16),
    new THREE.MeshStandardMaterial({ color: 0x5c675f, roughness: 0.9 }),
  );
  roof.position.set(x, height + 0.1, z);
  roof.castShadow = true;
  parent.add(roof);

  if (!windows) return;
  const columns = Math.max(2, Math.floor(width / 1.45));
  const paneGeometry = new THREE.BoxGeometry(0.72, 0.62, 0.055);
  const paneMaterial = new THREE.MeshStandardMaterial({ color: 0x7395a0, roughness: 0.24, metalness: 0.12 });
  for (let floor = 0; floor < floors; floor += 1) {
    for (let column = 0; column < columns; column += 1) {
      const pane = new THREE.Mesh(paneGeometry, paneMaterial);
      pane.position.set(
        x - width / 2 + (column + 0.5) * width / columns,
        0.82 + floor * (height / floors),
        z + depth / 2 + 0.035,
      );
      parent.add(pane);
    }
  }
}

function createSchoolSignTexture(THREE: typeof import("three")): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#f5f1e6";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#173f31";
    context.font = "700 58px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("푸른솔중학교", canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildSampleCampus(runtime: SceneRuntime) {
  const { THREE, scene, generatedTextures } = runtime;
  const campus = new THREE.Group();
  scene.add(campus);

  const ground = addFlatArea(THREE, campus, SAMPLE_SCHOOL_WIDTH_METERS, SAMPLE_SCHOOL_DEPTH_METERS, 0x78975d, 0, 0, 0);
  ground.name = "sample-school-placement-ground";

  addFlatArea(THREE, campus, 18.5, 3.8, 0xb9b5a8, 0, -7.15, 0.018);
  addFlatArea(THREE, campus, 3.8, 8.1, 0xb9b5a8, -8, -2.2, 0.018);
  addFlatArea(THREE, campus, 6, 5, 0xb9b5a8, 8, -1.8, 0.018);
  addFlatArea(THREE, campus, 7.2, 5.6, 0xc4bba9, -2.5, 0.4, 0.03);
  addFlatArea(THREE, campus, 3.4, 15.4, 0xc9c6ba, 0, 0.7, 0.035);
  addFlatArea(THREE, campus, 10.8, 2.1, 0xc9c6ba, -4.8, 8.65, 0.035);
  addFlatArea(THREE, campus, 9.8, 6.3, 0xb16a50, 8.4, 6.1, 0.04);
  addFlatArea(THREE, campus, 7.9, 4.55, 0x72915b, 8.4, 6.1, 0.05);

  const court = addFlatArea(THREE, campus, 7, 4.8, 0x607d86, -8.4, 6.2, 0.045);
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xf0eee1 });
  const courtLinePoints = [
    new THREE.Vector3(-11.5, 0.06, 3.95), new THREE.Vector3(-5.3, 0.06, 3.95),
    new THREE.Vector3(-5.3, 0.06, 8.45), new THREE.Vector3(-11.5, 0.06, 8.45),
    new THREE.Vector3(-11.5, 0.06, 3.95),
  ];
  campus.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(courtLinePoints), lineMaterial));
  court.receiveShadow = true;

  addSchoolBuilding(THREE, campus, { x: 0, z: -7.2, width: 18, depth: 3.2, height: 5.4, floors: 3, color: 0xd8d0bd });
  addSchoolBuilding(THREE, campus, { x: -8, z: -2.25, width: 3, depth: 7.2, height: 5.4, floors: 3, color: 0xd2c9b3, windows: false });
  addSchoolBuilding(THREE, campus, { x: 8, z: -1.8, width: 5.2, depth: 4.2, height: 4, floors: 2, color: 0xb8c3bd, windows: false });

  const entrance = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.9, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x36574a, roughness: 0.7 }),
  );
  entrance.position.set(0, 0.95, -5.42);
  campus.add(entrance);

  const signTexture = createSchoolSignTexture(THREE);
  generatedTextures.push(signTexture);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 0.9),
    new THREE.MeshBasicMaterial({ map: signTexture }),
  );
  sign.position.set(0, 4.1, -5.56);
  campus.add(sign);

  const existingTreePositions = [
    [-13.2, -8.5], [-10.8, -8.7], [10.8, -8.6], [13.1, -8.2],
    [-13.3, -3.2], [-13.2, 1.2], [13.2, 0.8], [13.1, 4.2],
    [-13.2, 9], [13, 9], [1.8, 9.2], [4.1, 9.2],
  ] as const;
  for (const [x, z] of existingTreePositions) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.14, 1.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x6d513b, roughness: 1 }),
    );
    trunk.position.set(x, 0.75, z);
    trunk.castShadow = true;
    campus.add(trunk);
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.82, 1),
      new THREE.MeshStandardMaterial({ color: 0x486f42, roughness: 0.95 }),
    );
    crown.position.set(x, 1.85, z);
    crown.castShadow = true;
    campus.add(crown);
  }

  const fenceMaterial = new THREE.MeshStandardMaterial({ color: 0x58645f, roughness: 0.8 });
  for (let x = -14.5; x <= 14.5; x += 1.8) {
    for (const z of [-10.65, 10.65]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.65, 0.055), fenceMaterial);
      post.position.set(x, 0.325, z);
      campus.add(post);
    }
  }

  return ground;
}

function addPhotoTop(
  runtime: SceneRuntime,
  group: Group,
  texture: Texture | undefined,
  width: number,
  depth: number,
  y: number,
) {
  if (!texture) return;
  const { THREE } = runtime;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = y;
  group.add(plane);
}

function createLandscapeModel(runtime: SceneRuntime, object: LandscapeObject, material: PlanLandscapeMaterial): Group {
  const { THREE, textures } = runtime;
  const group = new THREE.Group();
  const texture = material.planAssetUrl ? textures.get(material.planAssetUrl) : undefined;
  const width = Math.max(0.42, object.width);
  const depth = Math.max(0.36, object.height);

  if (material.id === "tree-canopy" || material.id === "pine") {
    const tall = material.id === "tree-canopy";
    const height = tall ? 4.7 : 3.2;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(tall ? 0.16 : 0.12, tall ? 0.24 : 0.18, height * 0.58, 10),
      new THREE.MeshStandardMaterial({ color: 0x725039, roughness: 1 }),
    );
    trunk.position.y = height * 0.29;
    trunk.castShadow = true;
    group.add(trunk);
    if (tall) {
      const crownColors = [0x356a3d, 0x467d47, 0x2f6138, 0x57844d, 0x3c7142];
      const crownPositions = [
        [0, height * 0.82, 0, 0.9],
        [-width * 0.19, height * 0.76, 0.08, 0.72],
        [width * 0.19, height * 0.78, 0.02, 0.7],
        [0.04, height * 0.75, -width * 0.17, 0.68],
        [-0.04, height * 0.93, 0.03, 0.64],
      ] as const;
      crownPositions.forEach(([x, y, z, size], index) => {
        const crownPart = new THREE.Mesh(
          new THREE.IcosahedronGeometry(Math.max(0.72, width * 0.24) * size, 2),
          new THREE.MeshStandardMaterial({ color: crownColors[index], roughness: 0.98 }),
        );
        crownPart.position.set(x, y, z);
        crownPart.castShadow = true;
        group.add(crownPart);
      });
    } else {
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(0.65, width * 0.35), 2.2, 12),
        new THREE.MeshStandardMaterial({ color: 0x4b7c3d, roughness: 0.95 }),
      );
      crown.position.y = height * 0.72;
      crown.castShadow = true;
      group.add(crown);
    }
    addPhotoTop(runtime, group, texture, width * 1.08, width * 1.08, height + 0.04);
  } else if (material.id === "bench") {
    const wood = new THREE.MeshStandardMaterial({ color: 0x825538, roughness: 0.78 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x303b39, roughness: 0.5, metalness: 0.32 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.13, 0.56), wood);
    seat.position.y = 0.56;
    seat.castShadow = true;
    group.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.68, 0.11), wood);
    back.position.set(0, 0.9, 0.24);
    back.rotation.x = -0.13;
    back.castShadow = true;
    group.add(back);
    for (const x of [-0.67, 0.67]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.56, 0.11), metal);
      leg.position.set(x, 0.28, 0);
      group.add(leg);
    }
    addPhotoTop(runtime, group, texture, 1.9, 0.82, 1.27);
  } else if (material.id === "rock") {
    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x747872, roughness: 1 });
    const positions = [[-0.28, 0.23, 0], [0.24, 0.34, 0.04], [0.03, 0.2, -0.25]] as const;
    for (const [x, y, z] of positions) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(y * 1.45, 0), rockMaterial);
      rock.position.set(x, y, z);
      rock.scale.set(1.2, 0.85, 1);
      rock.rotation.set(x + 0.2, z + 0.5, y);
      rock.castShadow = true;
      group.add(rock);
    }
    addPhotoTop(runtime, group, texture, 1.25, 1, 0.72);
  } else if (material.id === "flower" || material.id === "flower-bed") {
    const bedWidth = material.id === "flower-bed" ? 2.2 : 1.25;
    const bedDepth = material.id === "flower-bed" ? 1.35 : 1.1;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(bedWidth, 0.22, bedDepth),
      new THREE.MeshStandardMaterial({ color: material.id === "flower-bed" ? 0x906346 : 0x5d4936, roughness: 1 }),
    );
    base.position.y = 0.11;
    base.castShadow = true;
    group.add(base);
    addPhotoTop(runtime, group, texture, bedWidth * 0.94, bedDepth * 0.9, 0.235);
  } else {
    const planeWidth = material.id === "dirt-path" ? 3.2 : Math.max(2.4, width);
    const planeDepth = material.id === "dirt-path" ? 1.35 : Math.max(2.1, depth);
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(planeWidth, 0.08, planeDepth),
      new THREE.MeshStandardMaterial({ color: material.id === "lawn" ? 0x76a451 : 0x9c805b, roughness: 1 }),
    );
    base.position.y = 0.04;
    base.receiveShadow = true;
    group.add(base);
    addPhotoTop(runtime, group, texture, planeWidth, planeDepth, 0.086);
  }

  group.rotation.y = -object.rotation * Math.PI / 180;
  group.scale.setScalar(object.scale);
  setInteractiveObjectId(group, object.id);
  return group;
}

function rebuildLandscape(runtime: SceneRuntime, objects: LandscapeObject[], selectedId: string | null) {
  const { THREE, landscapeRoot } = runtime;
  clearGroup(landscapeRoot);
  for (const object of objects) {
    const material = findLandscapeMaterial(object.materialId);
    if (!material) continue;
    const point = {
      x: (object.x - 0.5) * SAMPLE_SCHOOL_WIDTH_METERS,
      z: (object.y - 0.5) * SAMPLE_SCHOOL_DEPTH_METERS,
    };
    const model = createLandscapeModel(runtime, object, material);
    model.position.set(point.x, 0.06, point.z);
    landscapeRoot.add(model);
    if (object.id === selectedId) {
      const radius = Math.max(0.65, Math.max(object.width, object.height) * object.scale * 0.62);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius, radius + 0.14, 48),
        new THREE.MeshBasicMaterial({ color: 0xf3c74f, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(point.x, 0.075, point.z);
      landscapeRoot.add(ring);
    }
  }
}

function updatePointer(runtime: SceneRuntime, event: PointerEvent | DragEvent): boolean {
  const rect = runtime.renderer.domElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  runtime.pointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  runtime.raycaster.setFromCamera(runtime.pointer, runtime.camera);
  return true;
}

function groundPoint(runtime: SceneRuntime, event: PointerEvent | DragEvent): Point2D | null {
  if (!updatePointer(runtime, event)) return null;
  const hit = runtime.raycaster.intersectObject(runtime.ground, false)[0];
  return hit ? sampleSchoolToNormalized({ x: hit.point.x, z: hit.point.z }) : null;
}

export function SampleSchool3DScene({
  objects,
  selectedId,
  activeMaterialId,
  cameraView,
  onPlace,
  onMove,
  onSelect,
}: {
  objects: LandscapeObject[];
  selectedId: string | null;
  activeMaterialId: string | null;
  cameraView: SampleSchoolCameraView;
  onPlace: (materialId: string, point: Point2D) => void;
  onMove: (objectId: string, point: Point2D) => void;
  onSelect: (objectId: string | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<SceneRuntime | null>(null);
  const callbacksRef = useRef<SceneCallbacks>({ onPlace, onMove, onSelect });
  const activeMaterialRef = useRef(activeMaterialId);
  const objectsRef = useRef(objects);
  const selectedIdRef = useRef(selectedId);
  const initialViewRef = useRef(cameraView);
  const [failed, setFailed] = useState(false);

  useEffect(() => { callbacksRef.current = { onPlace, onMove, onSelect }; }, [onMove, onPlace, onSelect]);
  useEffect(() => { activeMaterialRef.current = activeMaterialId; }, [activeMaterialId]);
  useEffect(() => { objectsRef.current = objects; }, [objects]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => undefined;
    setFailed(false);

    void (async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        if (disposed) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xdce8e5);
        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.domElement.setAttribute("aria-label", "조경 재료를 직접 배치하는 샘플 중학교 3D 캠퍼스");
        renderer.domElement.style.touchAction = "none";
        host.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enablePan = false;

        scene.add(new THREE.HemisphereLight(0xf5f7ef, 0x556354, 1.7));
        const sun = new THREE.DirectionalLight(0xfff3d0, 2.5);
        sun.position.set(-12, 24, 13);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -20;
        sun.shadow.camera.right = 20;
        sun.shadow.camera.top = 18;
        sun.shadow.camera.bottom = -18;
        scene.add(sun);

        const landscapeRoot = new THREE.Group();
        scene.add(landscapeRoot);
        const runtime: SceneRuntime = {
          THREE,
          scene,
          camera,
          renderer,
          controls,
          ground: null as unknown as Mesh,
          landscapeRoot,
          raycaster: new THREE.Raycaster(),
          pointer: new THREE.Vector2(),
          textures: new Map(),
          generatedTextures: [],
        };
        runtime.ground = buildSampleCampus(runtime);

        const textureLoader = new THREE.TextureLoader();
        const assetUrls = [...new Set(LANDSCAPE_MATERIALS.map((material) => material.planAssetUrl).filter((url): url is string => Boolean(url)))];
        await Promise.all(assetUrls.map(async (url) => {
          try {
            const texture = await textureLoader.loadAsync(url);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            runtime.textures.set(url, texture);
          } catch {
            // The procedural 3D model remains usable if an optional photo texture fails.
          }
        }));
        if (disposed) {
          for (const texture of runtime.textures.values()) texture.dispose();
          renderer.dispose();
          return;
        }

        runtimeRef.current = runtime;
        rebuildLandscape(runtime, objectsRef.current, selectedIdRef.current);
        applyCamera(runtime, initialViewRef.current);

        let draggingId: string | null = null;
        const selectObjectAtPointer = (event: PointerEvent): string | null => {
          if (!updatePointer(runtime, event)) return null;
          const hit = runtime.raycaster.intersectObject(runtime.landscapeRoot, true)
            .find((intersection) => getLandscapeObjectId(intersection.object));
          return hit ? getLandscapeObjectId(hit.object) : null;
        };
        const handlePointerDown = (event: PointerEvent) => {
          const objectId = selectObjectAtPointer(event);
          if (objectId) {
            event.preventDefault();
            draggingId = objectId;
            controls.enabled = false;
            callbacksRef.current.onSelect(objectId);
            renderer.domElement.setPointerCapture(event.pointerId);
            return;
          }
          const materialId = activeMaterialRef.current;
          if (materialId) {
            const point = groundPoint(runtime, event);
            if (point) callbacksRef.current.onPlace(materialId, point);
            controls.enabled = false;
            window.requestAnimationFrame(() => { controls.enabled = true; });
          } else {
            callbacksRef.current.onSelect(null);
          }
        };
        const handlePointerMove = (event: PointerEvent) => {
          if (draggingId) {
            event.preventDefault();
            const point = groundPoint(runtime, event);
            if (point) callbacksRef.current.onMove(draggingId, point);
            renderer.domElement.style.cursor = "grabbing";
            return;
          }
          renderer.domElement.style.cursor = selectObjectAtPointer(event) ? "grab" : activeMaterialRef.current ? "crosshair" : "default";
        };
        const stopDragging = () => {
          draggingId = null;
          controls.enabled = true;
          renderer.domElement.style.cursor = activeMaterialRef.current ? "crosshair" : "default";
        };
        const handleDragOver = (event: DragEvent) => {
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        };
        const handleDrop = (event: DragEvent) => {
          event.preventDefault();
          const materialId = event.dataTransfer?.getData("text/gardening-material");
          const point = groundPoint(runtime, event);
          if (materialId && point) callbacksRef.current.onPlace(materialId, point);
        };
        renderer.domElement.addEventListener("pointerdown", handlePointerDown);
        renderer.domElement.addEventListener("pointermove", handlePointerMove);
        renderer.domElement.addEventListener("pointerup", stopDragging);
        renderer.domElement.addEventListener("pointercancel", stopDragging);
        renderer.domElement.addEventListener("dragover", handleDragOver);
        renderer.domElement.addEventListener("drop", handleDrop);

        const resize = () => {
          const width = Math.max(1, host.clientWidth);
          const height = Math.max(1, host.clientHeight);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        resize();

        let frame = 0;
        const render = () => {
          controls.update();
          renderer.render(scene, camera);
          frame = window.requestAnimationFrame(render);
        };
        render();

        cleanup = () => {
          window.cancelAnimationFrame(frame);
          resizeObserver.disconnect();
          renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
          renderer.domElement.removeEventListener("pointermove", handlePointerMove);
          renderer.domElement.removeEventListener("pointerup", stopDragging);
          renderer.domElement.removeEventListener("pointercancel", stopDragging);
          renderer.domElement.removeEventListener("dragover", handleDragOver);
          renderer.domElement.removeEventListener("drop", handleDrop);
          controls.dispose();
          disposeObject(scene);
          for (const texture of runtime.textures.values()) texture.dispose();
          for (const texture of runtime.generatedTextures) texture.dispose();
          renderer.dispose();
          renderer.domElement.remove();
          runtimeRef.current = null;
        };
      } catch {
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (runtimeRef.current) rebuildLandscape(runtimeRef.current, objects, selectedId);
  }, [objects, selectedId]);

  useEffect(() => {
    applyCamera(runtimeRef.current, cameraView);
  }, [cameraView]);

  return (
    <div ref={hostRef} className="sample-school-scene" role="application" aria-label="샘플 중학교 3D 조경 설계 공간">
      {failed ? <p className="sample-school-scene__error">이 기기에서는 3D 학교를 표시하지 못했습니다.</p> : null}
    </div>
  );
}
