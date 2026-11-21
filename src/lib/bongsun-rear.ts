import type { Matrix4 } from "three";
import { createBongsunBuilding, createBongsunSurroundings } from "./bongsun-building";

type Three = typeof import("three");

/** A teaching model of the unphotographed garden side. Returned in the editor's world coordinates. */
export function createBongsunRear(THREE: Three) {
  const site = new THREE.Group();
  site.name = "수업용 뒤뜰";

  const school = new THREE.Group();
  school.scale.setScalar(0.37);
  school.position.z = -7.7;
  site.add(school);

  const originalBuilding = createBongsunBuilding(THREE);
  originalBuilding.rotation.y = Math.PI;
  school.add(originalBuilding);

  const parts: { matrix: Matrix4; color: number }[] = [];
  const transform = new THREE.Object3D();
  function box(color: number, x: number, y: number, z: number, width: number, height: number, depth: number) {
    transform.position.set(x, y, z);
    transform.scale.set(width, height, depth);
    transform.updateMatrix();
    parts.push({ matrix: transform.matrix.clone(), color });
  }

  const stone = 0xd5cec1;
  const lightStone = 0xe7e1d5;
  const bronze = 0x596862;
  const frame = 0xccd2c7;
  const panes = [0x849991, 0x879d9e, 0x74888a, 0x91a39b, 0x718d85];

  // Windows sit on the reverse face of each existing volume, including the taller pale wing.
  function windowBay(x: number, y: number, z: number, width: number, height: number, tint: number) {
    box(bronze, x, y, z + 0.075, width, height, 0.15);
    box(frame, x, y, z + 0.155, width - 0.06, height - 0.06, 0.05);
    const pane = (width - 0.22) / 2;
    for (let i = 0; i < 2; i++) {
      const px = x + (i - 0.5) * (pane + 0.045);
      box(panes[(i + tint) % panes.length], px, y, z + 0.19, pane, height - 0.17, 0.04);
      if ((i + tint) % 4 === 0) box(0xb5b5a3, px, y + height * 0.28, z + 0.218, pane, height * 0.24, 0.02);
    }
    box(frame, x, y + height * 0.22, z + 0.233, width - 0.1, 0.05, 0.055);
    box(stone, x, y - height / 2 - 0.06, z + 0.16, width + 0.23, 0.13, 0.38);
  }

  const wingZ = 10.625;
  const wingX = -1.6;
  for (const x of [-30.2, -26.35, -22.5, -18.65, 15.8, 19.65, 23.5, 27.35, 31.2]) {
    for (let floor = 0; floor < 3; floor++) {
      windowBay(x, 1.85 + 3.10 * floor, 4, 2.40, 1.63, (Math.round(x + 34) + floor) % panes.length);
    }
  }
  for (const x of [-31.6, -24.4, -16.8, 13.75, 21.55, 29.1]) {
    box(lightStone, x, 4.89, 4.07, 0.38, 9.72, 0.17);
  }
  for (let floor = 0; floor < 4; floor++) {
    const y = 1.88 + floor * 3.03;
    for (const [bay, x] of [-13.3, -9.8, -6.3, 1.8, 5.3, 8.8].entries()) {
      windowBay(x, y, wingZ, 2.65, 1.48, (bay + floor) % panes.length);
    }
    box(lightStone, wingX, y - 1.16, wingZ + 0.10, 29.8, 0.13, 0.24);
  }

  // A glazed stairwell and small doorway give the central wing a garden-facing entrance.
  box(0x9da19a, -2.25, 6.16, wingZ + 0.19, 3.2, 12.32, 0.46);
  box(0x68858a, -2.25, 6.38, wingZ + 0.45, 2.7, 11.65, 0.12);
  for (let level = 1; level < 9; level++) {
    box(frame, -2.25, 0.6 + level * 1.34, wingZ + 0.54, 2.75, 0.08, 0.08);
  }
  box(frame, -2.25, 6.4, wingZ + 0.55, 0.085, 11.7, 0.09);
  box(bronze, -2.25, 1.13, wingZ + 0.57, 2.75, 2.26, 0.16);
  for (const x of [-2.88, -1.62]) {
    box(0x8ca6a0, x, 1.30, wingZ + 0.70, 1.13, 1.57, 0.055);
    box(frame, x, 0.42, wingZ + 0.70, 1.13, 0.22, 0.055);
  }
  box(0x779186, -2.25, 2.46, wingZ + 1.05, 4.05, 0.19, 1.95);
  box(0xe8e0ce, -2.25, 0.12, wingZ + 1.15, 3.70, 0.24, 1.9);

  // Paved apron and its curb sit between the building and the editable soil.
  box(0xc6bbb0, 0, 0.025, 13.66, 64, 0.05, 2.13);
  box(0xa7a99d, 0, 0.047, 14.72, 64.12, 0.09, 0.16);
  for (let section = -15; section <= 15; section++) {
    box(0xa9a291, 2.05 * section, 0.056, 13.66, 0.04, 0.014, 2.08);
  }
  // Small timber benches are fixed at the building edge, outside the student's planting bed.
  for (const x of [-20.8, 21.8]) {
    for (const leg of [-1.28, 1.28]) box(bronze, x + leg, 0.30, 11.65, 0.16, 0.6, 0.64);
    for (let slat = 0; slat < 4; slat++) {
      box(0x927252, x, 0.65, 11.32 + 0.22 * slat, 3.4, 0.16, 0.17);
    }
    box(0x8e7258, x, 0.98, 11.21, 3.4, 0.29, 0.13);
  }

  const details = new THREE.InstancedMesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial({ roughness: 0.81, metalness: 0.05 }),
    parts.length,
  );
  const color = new THREE.Color();
  parts.forEach((part, index) => {
    details.setMatrixAt(index, part.matrix);
    details.setColorAt(index, color.setHex(part.color));
  });
  details.computeBoundingBox();
  details.computeBoundingSphere();
  details.castShadow = details.receiveShadow = true;
  school.add(details);

  // The skyline is a softened contextual backdrop, as on the front of the teaching model.
  const surroundings = createBongsunSurroundings(THREE);
  surroundings.scale.set(0.38, 0.37, 0.37);
  surroundings.position.set(-0.9, 0, -7.3);
  site.add(surroundings);
  return site;
}
