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
  isSampleSchoolSurfacePointOpen,
  SAMPLE_SCHOOL_DEPTH_METERS,
  SAMPLE_SCHOOL_WIDTH_METERS,
  sampleSchoolToNormalized,
} from "@/lib/sample-school";

export type SampleSchoolCameraView = "aerial" | "orbit" | "rear" | "walk";

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
  lawnSurfaceTexture: Texture | null;
  pathSurfaceTexture: Texture | null;
  paverSurfaceTexture: Texture | null;
}

interface SceneCallbacks {
  onPlace: (materialId: string, point: Point2D) => void;
  onMove: (objectId: string, point: Point2D) => void;
  onSelect: (objectId: string | null) => void;
}

const LAWN_TEXTURE_URL = "/materials/landscape/lawn.webp";
const LAWN_CELL_SIZE_METERS = 0.07;
const LAWN_TEXTURE_TILE_METERS = 1.35;

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
  } else if (view === "rear") {
    camera.position.set(-17, 13, -18);
    controls.target.set(0, 1.1, -2.7);
    controls.minDistance = 10;
    controls.maxDistance = 42;
    controls.maxPolarAngle = Math.PI * 0.49;
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

function createSchoolSignTexture(THREE: typeof import("three"), schoolName: string): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#fffdf5";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#c8bfa7";
    context.lineWidth = 12;
    context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    context.fillStyle = "#173f31";
    const label = schoolName.trim() || "우리 학교";
    let fontSize = 78;
    context.font = `700 ${fontSize}px sans-serif`;
    while (context.measureText(label).width > canvas.width - 110 && fontSize > 38) {
      fontSize -= 2;
      context.font = `700 ${fontSize}px sans-serif`;
    }
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildSampleCampus(runtime: SceneRuntime, schoolName: string) {
  const { THREE, scene, generatedTextures } = runtime;
  const campus = new THREE.Group();
  scene.add(campus);

  const ground = addFlatArea(THREE, campus, SAMPLE_SCHOOL_WIDTH_METERS, SAMPLE_SCHOOL_DEPTH_METERS, 0xd9dad5, 0, 0, 0);
  ground.name = "sample-school-placement-ground";

  addSchoolBuilding(THREE, campus, { x: 0, z: -5, width: 18, depth: 3.2, height: 5.4, floors: 3, color: 0xd8d0bd });
  addSchoolBuilding(THREE, campus, { x: -8, z: -0.05, width: 3, depth: 7.2, height: 5.4, floors: 3, color: 0xd2c9b3, windows: false });
  addSchoolBuilding(THREE, campus, { x: 8, z: 0.4, width: 5.2, depth: 4.2, height: 4, floors: 2, color: 0xb8c3bd, windows: false });

  const entrance = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.9, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x36574a, roughness: 0.7 }),
  );
  entrance.position.set(0, 0.95, -3.2);
  campus.add(entrance);

  const signTexture = createSchoolSignTexture(THREE, schoolName);
  generatedTextures.push(signTexture);
  const signBacking = new THREE.Mesh(
    new THREE.BoxGeometry(7.6, 1.25, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xf8f5e9, roughness: 0.82 }),
  );
  signBacking.position.set(0, 4.15, -3.3);
  signBacking.castShadow = true;
  campus.add(signBacking);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(7.25, 0.96),
    new THREE.MeshBasicMaterial({ map: signTexture }),
  );
  sign.position.set(0, 4.15, -3.22);
  sign.renderOrder = 2;
  campus.add(sign);

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

function addPhotoSprite(
  runtime: SceneRuntime,
  group: Group,
  texture: Texture,
  width: number,
  trunkHeight: number,
  tint = 0xffffff,
) {
  const { THREE } = runtime;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    color: tint,
    transparent: true,
    alphaTest: 0.05,
    depthWrite: false,
  }));
  sprite.center.set(0.5, 0.5);
  sprite.position.y = trunkHeight + width * 0.18;
  sprite.scale.set(width, width, 1);
  sprite.renderOrder = 2;
  group.add(sprite);
}

function createLawnSurfaceTexture(runtime: SceneRuntime, source: Texture | undefined): Texture | null {
  const sourceImage = source?.image as (CanvasImageSource & {
    naturalWidth?: number;
    naturalHeight?: number;
    width?: number;
    height?: number;
  }) | undefined;
  const sourceWidth = sourceImage?.naturalWidth ?? sourceImage?.width ?? 0;
  const sourceHeight = sourceImage?.naturalHeight ?? sourceImage?.height ?? 0;
  if (!sourceImage || sourceWidth <= 0 || sourceHeight <= 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const cropSize = Math.min(sourceWidth, sourceHeight) * 0.5;
  context.fillStyle = "#73984f";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    sourceImage,
    (sourceWidth - cropSize) / 2,
    (sourceHeight - cropSize) / 2,
    cropSize,
    cropSize,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const texture = new runtime.THREE.CanvasTexture(canvas);
  texture.colorSpace = runtime.THREE.SRGBColorSpace;
  texture.wrapS = runtime.THREE.RepeatWrapping;
  texture.wrapT = runtime.THREE.RepeatWrapping;
  texture.anisotropy = runtime.renderer.capabilities.getMaxAnisotropy();
  runtime.generatedTextures.push(texture);
  return texture;
}

function createPavingTexture(runtime: SceneRuntime, kind: "path" | "paver"): Texture | null {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;

  if (kind === "path") {
    context.fillStyle = "#b39a77";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 180; index += 1) {
      const x = (index * 67 + 19) % canvas.width;
      const y = (index * 43 + 31) % canvas.height;
      const radius = 1 + (index % 4) * 0.55;
      context.fillStyle = index % 3 === 0 ? "rgba(91,72,50,.18)" : "rgba(244,231,199,.2)";
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  } else {
    context.fillStyle = "#aeb2aa";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(87,94,89,.38)";
    context.lineWidth = 4;
    for (let y = 0; y <= canvas.height; y += 64) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }
    for (let row = 0; row < 4; row += 1) {
      const offset = row % 2 === 0 ? 0 : 32;
      for (let x = offset; x <= canvas.width; x += 64) {
        context.beginPath();
        context.moveTo(x, row * 64);
        context.lineTo(x, (row + 1) * 64);
        context.stroke();
      }
    }
  }

  const texture = new runtime.THREE.CanvasTexture(canvas);
  texture.colorSpace = runtime.THREE.SRGBColorSpace;
  texture.wrapS = runtime.THREE.RepeatWrapping;
  texture.wrapT = runtime.THREE.RepeatWrapping;
  texture.repeat.set(kind === "path" ? 3 : 4, kind === "path" ? 1.2 : 4);
  texture.anisotropy = runtime.renderer.capabilities.getMaxAnisotropy();
  runtime.generatedTextures.push(texture);
  return texture;
}

function getOrganicPhase(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff * Math.PI * 2;
}

function addLawnSurface(
  runtime: SceneRuntime,
  group: Group,
  object: LandscapeObject,
  center: { x: number; z: number },
) {
  const { THREE } = runtime;
  const width = Math.max(1.4, object.width * object.scale);
  const depth = Math.max(1.4, object.height * object.scale);
  const columns = Math.max(8, Math.ceil(width / LAWN_CELL_SIZE_METERS));
  const rows = Math.max(8, Math.ceil(depth / LAWN_CELL_SIZE_METERS));
  const cellWidth = width / columns;
  const cellDepth = depth / rows;
  const rotation = -object.rotation * Math.PI / 180;
  const rotationCos = Math.cos(rotation);
  const rotationSin = Math.sin(rotation);
  const organicPhase = getOrganicPhase(object.id);
  const positions: number[] = [];
  const uvs: number[] = [];

  const toWorld = (localX: number, localZ: number) => ({
    x: center.x + localX * rotationCos + localZ * rotationSin,
    z: center.z - localX * rotationSin + localZ * rotationCos,
  });
  const pushVertex = (point: { x: number; z: number }) => {
    positions.push(point.x - center.x, 0, point.z - center.z);
    uvs.push(point.x / LAWN_TEXTURE_TILE_METERS, point.z / LAWN_TEXTURE_TILE_METERS);
  };

  for (let row = 0; row < rows; row += 1) {
    const z0 = -depth / 2 + row * cellDepth;
    const z1 = z0 + cellDepth;
    for (let column = 0; column < columns; column += 1) {
      const x0 = -width / 2 + column * cellWidth;
      const x1 = x0 + cellWidth;
      const normalizedX = ((x0 + x1) / 2) / (width / 2);
      const normalizedZ = ((z0 + z1) / 2) / (depth / 2);
      const angle = Math.atan2(normalizedZ, normalizedX);
      const organicEdge = 0.91
        + Math.sin(angle * 3 + organicPhase) * 0.055
        + Math.sin(angle * 7 - organicPhase * 0.7) * 0.03;
      if (Math.hypot(normalizedX, normalizedZ) > organicEdge) continue;

      const corners = [
        toWorld(x0, z0),
        toWorld(x1, z0),
        toWorld(x1, z1),
        toWorld(x0, z1),
      ];
      if (!corners.every((point) => isSampleSchoolSurfacePointOpen(point, 0.015))) continue;

      pushVertex(corners[0]);
      pushVertex(corners[3]);
      pushVertex(corners[1]);
      pushVertex(corners[1]);
      pushVertex(corners[3]);
      pushVertex(corners[2]);
    }
  }

  if (positions.length === 0) return;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  const texture = runtime.lawnSurfaceTexture ?? runtime.textures.get(LAWN_TEXTURE_URL);
  const lawn = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      map: texture,
      color: texture ? 0xffffff : 0x73984f,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  lawn.receiveShadow = true;
  lawn.renderOrder = 1;
  group.add(lawn);
}

function addTreeModel(
  runtime: SceneRuntime,
  group: Group,
  material: PlanLandscapeMaterial,
  texture: Texture | undefined,
  width: number,
) {
  const { THREE } = runtime;
  const isPine = material.id === "pine";
  const isMaple = material.id === "maple";
  const canopyWidth = isPine ? Math.max(2.8, width) : Math.max(4.1, width);
  const trunkHeight = isPine ? 1.7 : isMaple ? 2.25 : 2.6;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(isPine ? 0.11 : 0.15, isPine ? 0.19 : 0.25, trunkHeight, 10),
    new THREE.MeshStandardMaterial({ color: isMaple ? 0x704335 : 0x6d4c36, roughness: 1 }),
  );
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  group.add(trunk);

  const groundShadow = new THREE.Mesh(
    new THREE.CircleGeometry(canopyWidth * 0.29, 32),
    new THREE.MeshBasicMaterial({ color: 0x294630, transparent: true, opacity: 0.16, depthWrite: false }),
  );
  groundShadow.rotation.x = -Math.PI / 2;
  groundShadow.position.y = 0.008;
  groundShadow.scale.y = 0.62;
  group.add(groundShadow);

  if (texture) {
    addPhotoSprite(runtime, group, texture, canopyWidth, trunkHeight, isMaple ? 0xffaf79 : 0xffffff);
    return;
  }

  const crown = new THREE.Mesh(
    isPine
      ? new THREE.ConeGeometry(canopyWidth * 0.34, 2.6, 14)
      : new THREE.IcosahedronGeometry(canopyWidth * 0.34, 2),
    new THREE.MeshStandardMaterial({ color: isMaple ? 0xb56d3d : 0x4b7c3d, roughness: 0.95 }),
  );
  crown.position.y = trunkHeight + (isPine ? 0.85 : 0.3);
  crown.castShadow = true;
  group.add(crown);
}

function addFlowerCluster(
  runtime: SceneRuntime,
  group: Group,
  palette: readonly number[],
  options: { count?: number; spreadX?: number; spreadZ?: number; baseY?: number } = {},
) {
  const { THREE } = runtime;
  const count = options.count ?? 8;
  const spreadX = options.spreadX ?? 0.86;
  const spreadZ = options.spreadZ ?? 0.72;
  const baseY = options.baseY ?? 0;
  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x54753d, roughness: 0.95 });
  const centerMaterial = new THREE.MeshStandardMaterial({ color: 0x704c2c, roughness: 0.9 });

  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.399;
    const radius = 0.16 + ((index * 7) % 11) / 10 * 0.34;
    const x = Math.cos(angle) * spreadX * radius;
    const z = Math.sin(angle) * spreadZ * radius;
    const stemHeight = 0.32 + (index % 4) * 0.065;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, stemHeight, 5), stemMaterial);
    stem.position.set(x, baseY + stemHeight / 2, z);
    stem.rotation.z = Math.sin(angle) * 0.08;
    group.add(stem);

    const bloomY = baseY + stemHeight;
    const petalMaterial = new THREE.MeshStandardMaterial({ color: palette[index % palette.length], roughness: 0.78 });
    for (let petalIndex = 0; petalIndex < 5; petalIndex += 1) {
      const petalAngle = petalIndex / 5 * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.052, 7, 5), petalMaterial);
      petal.position.set(x + Math.cos(petalAngle) * 0.06, bloomY, z + Math.sin(petalAngle) * 0.06);
      petal.scale.set(1, 0.38, 0.72);
      petal.castShadow = true;
      group.add(petal);
    }
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.038, 7, 5), centerMaterial);
    center.position.set(x, bloomY + 0.012, z);
    group.add(center);
  }
}

function addLowPlanting(runtime: SceneRuntime, group: Group, material: PlanLandscapeMaterial) {
  const { THREE } = runtime;
  if (material.id === "lavender") {
    const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x5d7847, roughness: 1 });
    const bloomMaterial = new THREE.MeshStandardMaterial({ color: 0x8063aa, roughness: 0.84 });
    for (let index = 0; index < 13; index += 1) {
      const angle = index * 2.31;
      const radius = 0.12 + (index % 5) * 0.075;
      const height = 0.38 + (index % 4) * 0.055;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, height, 5), stemMaterial);
      stem.position.set(x, height / 2, z);
      group.add(stem);
      const bloom = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.05, 0.19, 7), bloomMaterial);
      bloom.position.set(x, height + 0.08, z);
      bloom.castShadow = true;
      group.add(bloom);
    }
    return;
  }

  if (material.id === "ornamental-grass") {
    const colors = [0x82924f, 0xa3a867, 0xc1b77a];
    for (let index = 0; index < 18; index += 1) {
      const angle = index * 2.19;
      const radius = 0.08 + (index % 7) * 0.045;
      const height = 0.48 + (index % 6) * 0.07;
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.025, height, 5),
        new THREE.MeshStandardMaterial({ color: colors[index % colors.length], roughness: 1 }),
      );
      blade.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
      blade.rotation.z = Math.cos(angle) * 0.18;
      blade.rotation.x = Math.sin(angle) * 0.18;
      blade.castShadow = true;
      group.add(blade);
    }
    return;
  }

  const isGroundcover = material.id === "groundcover";
  const foliageMaterial = new THREE.MeshStandardMaterial({ color: isGroundcover ? 0x82a846 : 0x608f43, roughness: 1 });
  const positions = [[-0.24, 0.24, 0.02], [0.2, 0.3, 0.04], [0, 0.27, -0.23], [0.04, 0.34, 0.2], [0.3, 0.2, -0.18]] as const;
  for (const [x, y, z] of positions) {
    const mound = new THREE.Mesh(new THREE.IcosahedronGeometry(y * 1.25, 1), foliageMaterial);
    mound.position.set(x, isGroundcover ? y * 0.52 : y, z);
    mound.scale.y = isGroundcover ? 0.42 : 0.8;
    mound.castShadow = true;
    group.add(mound);
  }
}

function addPavingModel(runtime: SceneRuntime, group: Group, material: PlanLandscapeMaterial, texture: Texture | undefined) {
  const { THREE } = runtime;
  const pathMaterial = new THREE.MeshStandardMaterial({
    map: runtime.pathSurfaceTexture ?? undefined,
    color: runtime.pathSurfaceTexture ? 0xffffff : 0xad9270,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  if (material.id === "straight-path") {
    const path = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.055, 1.15), pathMaterial);
    path.position.y = 0.0275;
    path.receiveShadow = true;
    group.add(path);
    return;
  }

  if (material.id === "curved-path") {
    const outerRadius = 3.08;
    const innerRadius = 1.9;
    const shape = new THREE.Shape();
    shape.moveTo(outerRadius, 0);
    shape.absarc(0, 0, outerRadius, 0, Math.PI / 2, false);
    shape.lineTo(0, innerRadius);
    shape.absarc(0, 0, innerRadius, Math.PI / 2, 0, true);
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape, 32);
    geometry.translate(-outerRadius / 2, -outerRadius / 2, 0);
    const path = new THREE.Mesh(geometry, pathMaterial);
    path.rotation.x = -Math.PI / 2;
    path.position.y = 0.035;
    path.receiveShadow = true;
    group.add(path);
    return;
  }

  if (material.id === "school-paver") {
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.05, 2.4),
      new THREE.MeshStandardMaterial({
        map: runtime.paverSurfaceTexture ?? undefined,
        color: runtime.paverSurfaceTexture ? 0xffffff : 0xaeb1aa,
        roughness: 0.96,
      }),
    );
    tile.position.y = 0.025;
    tile.receiveShadow = true;
    group.add(tile);
    return;
  }

  if (material.id === "stepping-stone") {
    const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x85877f, roughness: 1 });
    for (let index = -1; index <= 1; index += 1) {
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), stoneMaterial);
      stone.position.set(index * 0.48, 0.08, Math.abs(index) * 0.05);
      stone.scale.set(1.18, 0.26, 0.82);
      stone.rotation.y = index * 0.31;
      stone.receiveShadow = true;
      group.add(stone);
    }
    return;
  }

  if (material.id === "dirt-path") {
    addPhotoTop(runtime, group, texture, 3, 3, 0.02);
    return;
  }

  const fallback = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(0.8, material.realWidthMeters), 0.06, Math.max(0.6, material.realHeightMeters)),
    new THREE.MeshStandardMaterial({ color: material.color, roughness: 1 }),
  );
  fallback.position.y = 0.03;
  fallback.receiveShadow = true;
  group.add(fallback);
}

function addFeatureModel(runtime: SceneRuntime, group: Group, material: PlanLandscapeMaterial) {
  const { THREE } = runtime;
  if (material.id === "bench") {
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
    return;
  }

  if (material.id === "rock") {
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
    return;
  }

  if (material.id === "flower-bed") {
    const border = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 0.24, 32),
      new THREE.MeshStandardMaterial({ color: 0x8e674b, roughness: 1 }),
    );
    border.position.y = 0.12;
    border.scale.set(1.12, 1, 0.68);
    border.castShadow = true;
    group.add(border);
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.88, 0.88, 0.05, 32),
      new THREE.MeshStandardMaterial({ color: 0x594331, roughness: 1 }),
    );
    soil.position.y = 0.265;
    soil.scale.set(1.12, 1, 0.68);
    group.add(soil);
    addFlowerCluster(runtime, group, [0xf19aaf, 0xf2c94c, 0xf4f0e7, 0xb67ac7], { count: 11, spreadX: 1.65, spreadZ: 0.86, baseY: 0.27 });
    return;
  }

  if (material.id === "planter") {
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.42, 0.48, 12),
      new THREE.MeshStandardMaterial({ color: 0xa46848, roughness: 0.92 }),
    );
    pot.position.y = 0.24;
    pot.castShadow = true;
    group.add(pot);
    const leaves = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.38, 1),
      new THREE.MeshStandardMaterial({ color: 0x568342, roughness: 1 }),
    );
    leaves.position.y = 0.72;
    leaves.scale.y = 0.78;
    leaves.castShadow = true;
    group.add(leaves);
    return;
  }

  if (material.id === "light") {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.055, 1.7, 8),
      new THREE.MeshStandardMaterial({ color: 0x3e4a49, roughness: 0.6, metalness: 0.28 }),
    );
    pole.position.y = 0.85;
    pole.castShadow = true;
    group.add(pole);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xffe7a0, emissive: 0x8a6519, emissiveIntensity: 0.72, roughness: 0.4 }),
    );
    lamp.position.y = 1.72;
    group.add(lamp);
    return;
  }

  if (material.id === "pond") {
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 0.08, 40),
      new THREE.MeshStandardMaterial({ color: 0x56a0ad, roughness: 0.32, metalness: 0.08, transparent: true, opacity: 0.9 }),
    );
    water.position.y = 0.04;
    water.scale.set(1.5, 1, 1);
    water.receiveShadow = true;
    group.add(water);
    const rimMaterial = new THREE.MeshStandardMaterial({ color: 0x74776f, roughness: 1 });
    for (let index = 0; index < 12; index += 1) {
      const angle = index / 12 * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), rimMaterial);
      stone.position.set(Math.cos(angle) * 1.5, 0.12, Math.sin(angle));
      stone.scale.y = 0.55;
      group.add(stone);
    }
    return;
  }

  const fallback = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(0.45, material.realWidthMeters), 0.5, Math.max(0.4, material.realHeightMeters)),
    new THREE.MeshStandardMaterial({ color: material.color, roughness: 0.9 }),
  );
  fallback.position.y = 0.25;
  fallback.castShadow = true;
  group.add(fallback);
}

function createLandscapeModel(
  runtime: SceneRuntime,
  object: LandscapeObject,
  material: PlanLandscapeMaterial,
  center: { x: number; z: number },
): Group {
  const { THREE, textures } = runtime;
  const group = new THREE.Group();
  const texture = material.planAssetUrl ? textures.get(material.planAssetUrl) : undefined;
  const width = Math.max(0.42, object.width);

  if (["tree-canopy", "pine", "maple"].includes(material.id)) {
    addTreeModel(runtime, group, material, texture, width);
  } else if (material.id === "lawn") {
    addLawnSurface(runtime, group, object, center);
  } else if (["flower", "flower-pink", "flower-yellow"].includes(material.id)) {
    const palette = material.id === "flower-pink"
      ? [0xf39ab6, 0xd96996, 0xf7c1d2]
      : material.id === "flower-yellow"
        ? [0xffd85a, 0xf3b83f, 0xffee9d]
        : [0xf19aaf, 0xf2c94c, 0xf4f0e7, 0xb67ac7];
    addFlowerCluster(runtime, group, palette);
  } else if (["shrub", "lavender", "ornamental-grass", "groundcover"].includes(material.id)) {
    addLowPlanting(runtime, group, material);
  } else if (material.category === "paving") {
    addPavingModel(runtime, group, material, texture);
  } else {
    addFeatureModel(runtime, group, material);
  }

  if (material.id !== "lawn") {
    group.rotation.y = -object.rotation * Math.PI / 180;
    group.scale.setScalar(object.scale);
  }
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
    const model = createLandscapeModel(runtime, object, material, point);
    const groundOffset = material.id === "lawn"
      ? 0.018 + Math.min(0.004, object.zIndex * 0.0001)
      : material.category === "paving"
        ? 0.012
        : 0.01;
    model.position.set(point.x, groundOffset, point.z);
    landscapeRoot.add(model);
    if (object.id === selectedId) {
      const radius = Math.max(0.65, Math.max(object.width, object.height) * object.scale * 0.62);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius, radius + 0.14, 48),
        new THREE.MeshBasicMaterial({ color: 0xf3c74f, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(point.x, material.category === "paving" || material.id === "lawn" ? 0.07 : 0.035, point.z);
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
  schoolName,
  objects,
  selectedId,
  activeMaterialId,
  cameraView,
  onPlace,
  onMove,
  onSelect,
}: {
  schoolName: string;
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
          lawnSurfaceTexture: null,
          pathSurfaceTexture: null,
          paverSurfaceTexture: null,
        };
        runtime.ground = buildSampleCampus(runtime, schoolName);

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
        runtime.lawnSurfaceTexture = createLawnSurfaceTexture(runtime, runtime.textures.get(LAWN_TEXTURE_URL));
        runtime.pathSurfaceTexture = createPavingTexture(runtime, "path");
        runtime.paverSurfaceTexture = createPavingTexture(runtime, "paver");

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
  }, [schoolName]);

  useEffect(() => {
    if (runtimeRef.current) rebuildLandscape(runtimeRef.current, objects, selectedId);
  }, [objects, selectedId]);

  useEffect(() => {
    initialViewRef.current = cameraView;
    applyCamera(runtimeRef.current, cameraView);
  }, [cameraView]);

  return (
    <div ref={hostRef} className="sample-school-scene" role="application" aria-label="샘플 중학교 3D 조경 설계 공간">
      {failed ? <p className="sample-school-scene__error">이 기기에서는 3D 학교를 표시하지 못했습니다.</p> : null}
    </div>
  );
}
