"use client";

import { useEffect, useRef, useState } from "react";
import type {
  Material,
  Object3D,
  PerspectiveCamera,
  Texture,
} from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { EstimatedBuildingFootprint } from "@/domain/models";
import type { LandscapeSceneObject } from "@/lib/landscape-scene";

export interface WebGLCameraState {
  view: "top" | "low" | "perspective";
  rotation: number;
  zoom: number;
}

interface SceneHandle {
  camera: PerspectiveCamera;
  controls: OrbitControls;
  worldRadius: number;
}

function applyCamera(handle: SceneHandle | null, state: WebGLCameraState) {
  if (!handle) return;
  const elevation = state.view === "top" ? 84 : state.view === "low" ? 22 : 43;
  const elevationRadians = elevation * Math.PI / 180;
  const rotationRadians = state.rotation * Math.PI / 180;
  const distance = handle.worldRadius * 1.68 / state.zoom;
  const horizontal = Math.cos(elevationRadians) * distance;
  handle.camera.position.set(
    Math.sin(rotationRadians) * horizontal,
    Math.sin(elevationRadians) * distance,
    Math.cos(rotationRadians) * horizontal,
  );
  handle.controls.target.set(0, 0.35, 0);
  handle.controls.update();
}

function disposeObject(root: Object3D) {
  root.traverse((object) => {
    const candidate = object as Object3D & { geometry?: { dispose: () => void }; material?: Material | Material[] };
    candidate.geometry?.dispose();
    const materials = Array.isArray(candidate.material) ? candidate.material : candidate.material ? [candidate.material] : [];
    for (const material of materials) material.dispose();
  });
}

export function LandscapeWebGLScene({
  photoUrl,
  imageWidth,
  imageHeight,
  buildings,
  objects,
  cameraState,
}: {
  photoUrl: string;
  imageWidth: number;
  imageHeight: number;
  buildings: EstimatedBuildingFootprint[];
  objects: LandscapeSceneObject[];
  cameraState: WebGLCameraState;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<SceneHandle | null>(null);
  const initialCameraStateRef = useRef(cameraState);
  const [failed, setFailed] = useState(false);

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
        scene.background = new THREE.Color(0xe5ebe5);
        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.domElement.setAttribute("aria-label", "건물이 솟아오르는 학교 조경 360도 예상 모형");
        host.appendChild(renderer.domElement);

        const aspect = imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : 4 / 3;
        const worldWidth = 12;
        const worldDepth = worldWidth / Math.max(0.55, Math.min(2.2, aspect));
        const worldRadius = Math.max(worldWidth, worldDepth);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enablePan = false;
        controls.minDistance = worldRadius * 0.75;
        controls.maxDistance = worldRadius * 3.2;
        controls.maxPolarAngle = Math.PI * 0.47;

        const ambient = new THREE.HemisphereLight(0xf5f8f2, 0x697667, 1.45);
        scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xfff7df, 2.35);
        sun.position.set(-7, 12, 8);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -10;
        sun.shadow.camera.right = 10;
        sun.shadow.camera.top = 10;
        sun.shadow.camera.bottom = -10;
        scene.add(sun);

        const textureLoader = new THREE.TextureLoader();
        const groundTexture = await textureLoader.loadAsync(photoUrl);
        if (disposed) {
          groundTexture.dispose();
          renderer.dispose();
          return;
        }
        groundTexture.colorSpace = THREE.SRGBColorSpace;
        groundTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(worldWidth, worldDepth),
          new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.92, metalness: 0 }),
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        const base = new THREE.Mesh(
          new THREE.BoxGeometry(worldWidth + 0.16, 0.24, worldDepth + 0.16),
          new THREE.MeshStandardMaterial({ color: 0x718071, roughness: 1 }),
        );
        base.position.y = -0.14;
        base.receiveShadow = true;
        scene.add(base);

        const generatedTextures: Texture[] = [groundTexture];
        const sourceImage = groundTexture.image as HTMLImageElement;
        for (const building of buildings) {
          const buildingWidth = Math.max(0.38, building.width * worldWidth);
          const buildingDepth = Math.max(0.28, building.depth * worldDepth);
          const buildingHeight = 0.5 + building.estimatedFloors * 0.38;
          const roofCanvas = document.createElement("canvas");
          roofCanvas.width = 256;
          roofCanvas.height = 128;
          const roofContext = roofCanvas.getContext("2d");
          if (roofContext && sourceImage) {
            const sourceWidth = sourceImage.naturalWidth || imageWidth;
            const sourceHeight = sourceImage.naturalHeight || imageHeight;
            const cropWidth = Math.max(8, building.width * sourceWidth * 1.16);
            const cropHeight = Math.max(8, building.depth * sourceHeight * 1.3);
            const sourceX = Math.max(0, Math.min(sourceWidth - cropWidth, building.x * sourceWidth - cropWidth / 2));
            const sourceY = Math.max(0, Math.min(sourceHeight - cropHeight, building.y * sourceHeight - cropHeight / 2));
            roofContext.drawImage(sourceImage, sourceX, sourceY, cropWidth, cropHeight, 0, 0, roofCanvas.width, roofCanvas.height);
          }
          const roofTexture = new THREE.CanvasTexture(roofCanvas);
          roofTexture.colorSpace = THREE.SRGBColorSpace;
          roofTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          generatedTextures.push(roofTexture);
          const roofColor = new THREE.Color(building.roofColor);
          const sideColor = roofColor.clone().lerp(new THREE.Color(0x7d887f), 0.62);
          const sideMaterials = [0, 1, 4, 5].map(() => new THREE.MeshStandardMaterial({ color: sideColor, roughness: 0.86 }));
          const roofMaterial = new THREE.MeshStandardMaterial({ map: roofTexture, color: 0xffffff, roughness: 0.76 });
          const bottomMaterial = new THREE.MeshStandardMaterial({ color: 0x5d685f, roughness: 1 });
          const materials = [sideMaterials[0], sideMaterials[1], roofMaterial, bottomMaterial, sideMaterials[2], sideMaterials[3]];
          const geometry = new THREE.BoxGeometry(buildingWidth, buildingHeight, buildingDepth);
          const mesh = new THREE.Mesh(geometry, materials);
          mesh.position.set((building.x - 0.5) * worldWidth, buildingHeight / 2 + 0.02, (building.y - 0.5) * worldDepth);
          mesh.rotation.y = -building.rotation * Math.PI / 180;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          scene.add(mesh);
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry, 22),
            new THREE.LineBasicMaterial({ color: 0x34493a, transparent: true, opacity: 0.44 }),
          );
          edges.position.copy(mesh.position);
          edges.rotation.copy(mesh.rotation);
          scene.add(edges);
        }

        const uniqueAssetUrls = [...new Set(objects.map((object) => object.assetUrl).filter((url): url is string => Boolean(url)))];
        const assetTextures = new Map<string, Texture>();
        await Promise.all(uniqueAssetUrls.map(async (url) => {
          try {
            const texture = await textureLoader.loadAsync(url);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            assetTextures.set(url, texture);
            generatedTextures.push(texture);
          } catch {
            // A missing optional material photo must not block the 3D school model.
          }
        }));

        for (const object of objects) {
          const x = (object.xPercent / 100 - 0.5) * worldWidth;
          const z = (object.yPercent / 100 - 0.5) * worldDepth;
          const footprintWidth = Math.max(0.28, object.footprintWidthPixels / 70 * 0.72);
          const footprintDepth = Math.max(0.24, object.footprintHeightPixels / 70 * 0.72);
          const texture = object.assetUrl ? assetTextures.get(object.assetUrl) : null;
          const objectColor = new THREE.Color(object.color);
          const rotation = -object.rotationDegrees * Math.PI / 180;

          if (object.category === "planting" && object.materialId !== "lawn") {
            const height = Math.max(0.55, object.heightPixels / 30);
            const trunk = new THREE.Mesh(
              new THREE.CylinderGeometry(0.055, 0.08, height * 0.68, 8),
              new THREE.MeshStandardMaterial({ color: 0x72523b, roughness: 1 }),
            );
            trunk.position.set(x, height * 0.34, z);
            trunk.castShadow = true;
            scene.add(trunk);
            if (texture) {
              const crown = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.08 }));
              crown.position.set(x, height * 0.88, z);
              crown.scale.set(footprintWidth * 1.35, footprintDepth * 1.35, 1);
              scene.add(crown);
            } else {
              const crown = new THREE.Mesh(
                new THREE.SphereGeometry(Math.max(0.22, footprintWidth * 0.42), 16, 12),
                new THREE.MeshStandardMaterial({ color: objectColor, roughness: 0.88 }),
              );
              crown.position.set(x, height * 0.84, z);
              crown.castShadow = true;
              scene.add(crown);
            }
            continue;
          }

          if (object.category === "facility") {
            const facility = new THREE.Mesh(
              new THREE.BoxGeometry(footprintWidth, 0.18, footprintDepth),
              new THREE.MeshStandardMaterial({ color: objectColor, roughness: 0.82 }),
            );
            facility.position.set(x, 0.1, z);
            facility.rotation.y = rotation;
            facility.castShadow = true;
            scene.add(facility);
          }

          if (texture) {
            const materialPlane = new THREE.Mesh(
              new THREE.PlaneGeometry(footprintWidth, footprintDepth),
              new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide }),
            );
            materialPlane.position.set(x, object.category === "facility" ? 0.205 : 0.045, z);
            materialPlane.rotation.x = -Math.PI / 2;
            materialPlane.rotation.z = rotation;
            materialPlane.receiveShadow = true;
            scene.add(materialPlane);
          }
        }

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
        handleRef.current = { camera, controls, worldRadius };
        applyCamera(handleRef.current, initialCameraStateRef.current);

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
          controls.dispose();
          disposeObject(scene);
          for (const texture of generatedTextures) texture.dispose();
          renderer.dispose();
          renderer.domElement.remove();
          handleRef.current = null;
        };
      } catch {
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [buildings, imageHeight, imageWidth, objects, photoUrl]);

  useEffect(() => {
    applyCamera(handleRef.current, cameraState);
  }, [cameraState]);

  return (
    <div ref={hostRef} className="webgl-site-scene" role="img" aria-label="학교 건물과 조경 재료가 입체로 솟아오르는 360도 예상 모형">
      {failed ? <p>이 기기에서는 3D 모형을 표시하지 못했습니다.</p> : null}
    </div>
  );
}
