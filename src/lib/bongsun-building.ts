import type { BufferGeometry, Matrix4, MeshStandardMaterial } from "three";

type Three = typeof import("three");
type BoxPart = { transform: Matrix4; color: number };

function drawParts(THREE: Three, parts: BoxPart[], geometry: BufferGeometry, material: MeshStandardMaterial) {
  const mesh = new THREE.InstancedMesh(geometry, material, parts.length);
  const color = new THREE.Color();
  parts.forEach((part, index) => {
    mesh.setMatrixAt(index, part.transform);
    mesh.setColorAt(index, color.setHex(part.color));
  });
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// Course and mortar colours follow the brickwork visible between the classroom windows.
function brickwork(THREE: Three) {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / 8);
    for (let x = 0; x < size; x++) {
      const staggered = x + (row % 2) * 12;
      const column = Math.floor(staggered / 32);
      const seam = y % 8 === 0 || staggered % 32 === 0;
      const variation = ((row * 13 + column * 7) % 19) - 9 + ((x * 3 + y * 7) % 5);
      const pixel = (y * size + x) * 4;
      const base = seam ? [147, 128, 111] : [151, 101, 77];
      for (let channel = 0; channel < 3; channel++) data[pixel + channel] = base[channel] + variation;
      data[pixel + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Photo-guided massing of the field-facing school. +Z faces the editable garden. */
export function createBongsunBuilding(THREE: Three) {
  const group = new THREE.Group();
  group.name = "봉선중학교 본관";
  const joinery: BoxPart[] = [];
  const glass: BoxPart[] = [];
  const transform = new THREE.Object3D();

  function box(color: number, x: number, y: number, z: number, w: number, h: number, d: number,
    pitch = 0, roll = 0, batch = joinery) {
    transform.position.set(x, y, z);
    transform.scale.set(w, h, d);
    transform.rotation.set(pitch, 0, roll);
    transform.updateMatrix();
    batch.push({ color, transform: transform.matrix.clone() });
  }

  const wall = new THREE.BoxGeometry(64, 9.8, 8);
  const uv = wall.attributes.uv;
  // Repeat the brick tile at the same physical scale on the main and side elevations.
  for (let i = 0; i < uv.count; i++) {
    const normal = wall.attributes.normal;
    const span = Math.abs(normal.getX(i)) > 0.5 ? 8 : 64;
    const rise = Math.abs(normal.getY(i)) > 0.5 ? 8 : 9.8;
    uv.setXY(i, uv.getX(i) * span / 1.58, uv.getY(i) * rise / 1.55);
  }
  const texture = brickwork(THREE);
  const masonry = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.94 });
  masonry.addEventListener("dispose", () => texture.dispose());
  const main = new THREE.Mesh(wall, masonry);
  main.position.y = 4.9;
  main.castShadow = main.receiveShadow = true;
  group.add(main);

  const stone = 0xe5d4b9, paleStone = 0xf2e6d1, shade = 0x3c4240;
  const frame = 0xcfcfc3, sill = 0xd1c4ae, coping = 0xe7deca;
  const roof = 0x71877b, green = 0x387155;
  box(0xa19a8d, 0, 0.20, 0.04, 64.10, 0.40, 8.12);
  box(stone, 0, 9.89, 0, 64.18, 0.48, 8.15);
  box(coping, 0, 10.17, 0, 64.42, 0.14, 8.34);
  box(roof, 0, 10.27, -0.04, 63.83, 0.07, 7.73);
  box(green, 0, 10.39, -3.78, 63.95, 0.35, 0.15);
  box(green, -31.90, 10.39, 0.01, 0.15, 0.35, 7.70);
  box(green, 31.90, 10.39, 0.01, 0.15, 0.35, 7.70);

  // Broad stucco piers separate groups of finer brick window bays on the field side.
  for (const x of [-31.64, -23.75, -11.85, 0, 11.85, 23.75, 31.64]) {
    box(stone, x, 5.00, 4.07, 0.69, 9.61, 0.27);
    box(paleStone, x - 0.26, 5.00, 4.22, 0.075, 9.61, 0.045);
  }
  const glazes = [0x879c98, 0x758782, 0x9ba8a0, 0x778d91, 0x89958b, 0x7c8f89];
  function fieldWindow(x: number, y: number, z: number, w: number, h: number, index: number) {
    box(shade, x, y, z + 0.05, w + 0.15, h + 0.16, 0.11);
    box(frame, x, y, z + 0.105, w + 0.045, h + 0.035, 0.07);
    const lite = (w - 0.18) / 3;
    for (let p = 0; p < 3; p++) {
      const px = x + (p - 1) * (lite + 0.045);
      const c = glazes[(index + p) % glazes.length];
      box(c, px, y - 0.19, z + 0.15, lite, h - 0.49, 0.022, 0, 0, glass);
      box(glazes[(index + 4) % glazes.length], px, y + h / 2 - 0.22, z + 0.15, lite, 0.34, 0.022, 0, 0, glass);
      // Partly lowered classroom blinds break up the reflection pattern.
      if ((index * 3 + p) % 8 === 0) box(0xb4ad97, px, y + h * 0.13, z + 0.169, lite, h * 0.23, 0.02);
    }
    box(sill, x, y - h / 2 - 0.07, z + 0.14, w + 0.25, 0.105, 0.35);
  }
  for (let level = 0; level < 3; level++) {
    const y = 1.85 + level * 3.10;
    for (let bay = 0; bay < 16; bay++) {
      fieldWindow(-29.65 + bay * 3.95, y, 4.02, 2.76, 1.76, bay + level * 5);
    }
  }

  // Glazed entry visible through the break in the field shelter.
  box(shade, 0, 1.45, 4.28, 2.53, 2.70, 0.12);
  box(frame, 0, 1.42, 4.35, 2.33, 2.59, 0.06);
  for (const x of [-0.56, 0.56]) {
    box(0x697d76, x, 1.25, 4.40, 1.04, 2.05, 0.035, 0, 0, glass);
    box(frame, x, 0.57, 4.43, 1.01, 0.075, 0.045);
  }
  box(0x80938a, 0, 2.52, 4.40, 2.16, 0.25, 0.035, 0, 0, glass);

  // The paler rear block rises above the main roof in the official oblique photograph.
  box(0xd6d2c5, 1.6, 6.36, -7.0, 29.8, 12.72, 7.25);
  box(coping, 1.6, 12.81, -7.0, 30.12, 0.19, 7.5);
  box(roof, 1.6, 12.98, -7.0, 29.82, 0.15, 7.17);
  for (let bay = 0; bay < 9; bay++) {
    fieldWindow(-11.20 + bay * 3.18, 11.52, -3.37, 2.30, 1.32, bay + 2);
  }
  // Simple side walls and back are approximations; detail is concentrated on the observed facade.
  for (const face of [-1, 1]) {
    for (let level = 0; level < 3; level++) {
      for (const z of [-2.2, 1.2]) {
        const y = 1.8 + level * 3.1;
        box(frame, face * 32.03, y, z, 0.11, 1.7, 1.66);
        box(0x82938e, face * 32.10, y, z, 0.045, 1.53, 1.49, 0, 0, glass);
        box(frame, face * 32.13, y, z, 0.035, 1.54, 0.06);
      }
    }
  }

  // Low stepped spectator seating, and the long, green-and-ivory shelter on the field edge.
  const canopyRear = 4.22, canopyFront = 7.23;
  const canopyCurve = (t: number) => 2.47 + 0.37 * t + 0.58 * Math.sin(t * Math.PI);
  const canopyColors = [0x69a37c, 0x83b68b, 0xe1dec0, 0xf1ecd7];
  for (const side of [-1, 1]) {
    for (let step = 0; step < 3; step++) {
      box(0x9e9686, side * 15.54, 0.11 + step * 0.13, 6.07 - step * 0.44,
        27.28, 0.22 + step * 0.26, 0.56);
      box(0x746754, side * 15.54, 0.24 + step * 0.26, 6.07 - step * 0.44,
        27.31, 0.055, 0.59);
    }
    const x0 = side < 0 ? -29.35 : 1.74;
    const shelterWidth = 27.61, stripes = 32, stripeWidth = shelterWidth / stripes;
    for (let stripe = 0; stripe < stripes; stripe++) {
      const x = x0 + (stripe + 0.5) * stripeWidth;
      for (let segment = 0; segment < 6; segment++) {
        const t0 = segment / 6, t1 = (segment + 1) / 6;
        const dz = (canopyFront - canopyRear) / 6;
        const y0 = canopyCurve(t0), y1 = canopyCurve(t1);
        box(canopyColors[stripe % 4], x, (y0 + y1) / 2, canopyRear + (segment + 0.5) * dz,
          stripeWidth + 0.006, 0.068, Math.hypot(dz, y1 - y0) + 0.012, -Math.atan2(y1 - y0, dz));
      }
    }
    const center = x0 + shelterWidth / 2;
    box(0xe2d4ad, center, canopyCurve(1) - 0.055, canopyFront, shelterWidth, 0.13, 0.09);
    box(0x8c816b, center, canopyCurve(0) - 0.075, canopyRear, shelterWidth, 0.15, 0.10);
    for (let post = 0; post <= 8; post++) {
      const x = x0 + 0.09 + (shelterWidth - 0.18) * post / 8;
      box(0x9a8666, x, 1.40, canopyFront - 0.15, 0.075, 2.80, 0.075);
    }
  }

  // A slightly taller arched shelter marks the break in the long awning.
  const entryHalfWidth = 1.88, entryDepth = 3.68, entryZ = 5.85;
  const arch = (x: number) => 3.02 + 0.91 * Math.cos(Math.PI * x / (entryHalfWidth * 2));
  for (let slice = 0; slice < 16; slice++) {
    const x0 = -entryHalfWidth + slice * entryHalfWidth / 8, x1 = x0 + entryHalfWidth / 8;
    const y0 = arch(x0), y1 = arch(x1), slope = Math.atan2(y1 - y0, x1 - x0);
    const length = Math.hypot(x1 - x0, y1 - y0) + 0.015;
    box(slice % 8 < 4 ? 0x7aad85 : 0xe0dec0, (x0 + x1) / 2, (y0 + y1) / 2, entryZ,
      length, 0.09, entryDepth, 0, slope);
    box(0xe1cba8, (x0 + x1) / 2, (y0 + y1) / 2 - 0.035, entryZ + entryDepth / 2,
      length, 0.14, 0.105, 0, slope);
  }
  for (const x of [-1.79, 1.79]) box(0x978467, x, 1.48, 7.60, 0.12, 2.96, 0.13);
  box(0xc7ba9e, 0, 0.14, 6.12, 3.46, 0.28, 3.48);
  box(0xb1a793, 0, 0.07, 7.98, 3.55, 0.14, 0.35);

  group.add(drawParts(THREE, joinery, new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0.04 })));
  group.add(drawParts(THREE, glass, new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.16 })));
  return group;
}

/** Distant residential backdrop and mature boundary planting suggested by the same photograph. */
export function createBongsunSurroundings(THREE: Three) {
  const group = new THREE.Group();
  group.name = "봉선중학교 주변 풍경";
  const architecture: BoxPart[] = [], trunks: BoxPart[] = [], foliage: BoxPart[] = [];
  const object = new THREE.Object3D();
  function part(batch: BoxPart[], color: number, x: number, y: number, z: number,
    width: number, height: number, depth: number, yaw = 0, lean = 0) {
    object.position.set(x, y, z);
    object.scale.set(width, height, depth);
    object.rotation.set(0, yaw, lean);
    object.updateMatrix();
    batch.push({ color, transform: object.matrix.clone() });
  }
  // Fade the far skyline through its palette, keeping architectural contrast on the school.
  const towers = [
    [-70, -80, 15, 24], [-52, -67, 13, 22], [-34, -85, 15, 28], [-15, -77, 12, 22],
    [6, -89, 19, 29], [23, -74, 12, 23], [40, -87, 15, 27], [58, -69, 13, 22], [76, -83, 17, 26],
  ];
  towers.forEach(([x, z, width, height], index) => {
    const surface = [0xcfcec7, 0xc9cfca, 0xd3cfc5][index % 3];
    const strip = [0xb9c3c3, 0xb3bec0, 0xbfc4bd][index % 3];
    part(architecture, surface, x, height / 2, z, width, height, 6.6);
    part(architecture, 0xc9cdca, x - width * 0.19, height + 0.44, z - 0.5, width * 0.39, 0.88, 3.7);
    for (let stack = 0; stack < 4; stack++) {
      const wx = x + ((stack + 0.5) / 4 - 0.5) * width;
      part(architecture, strip, wx, height / 2, z + 3.32, 1.34, height - 1.1, 0.25);
      for (let floor = 2.2; floor < height - 0.8; floor += 2.1) {
        part(architecture, 0xcdd2cf, wx, floor, z + 3.49, 1.40, 0.16, 0.18);
      }
    }
  });
  // Lower roofs and trees step down in scale between the distant towers and the main block.
  for (const [x, z, w, h] of [[-35, -31, 9, 5.3], [-24, -30, 9, 4.3], [-13, -34, 8, 5.4],
    [17, -33, 10, 4.8], [30, -31, 8, 5.8], [42, -35, 10, 4.2]]) {
    part(architecture, 0xb5ab97, x, h / 2, z, w, h, 6.2);
    part(architecture, 0x998a76, x, h + 0.12, z, w + 0.4, 0.24, 6.5);
  }
  part(architecture, 0x9baf94, 0, -0.33, -49, 190, 0.32, 86);
  for (const sign of [-1, 1]) part(architecture, 0xa3b295, sign * 53, -0.31, -2, 38, 0.29, 23);
  const skyline = drawParts(THREE, architecture, new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ roughness: 1 }));
  skyline.castShadow = false;
  group.add(skyline);

  const crownGeometry = new THREE.IcosahedronGeometry(1, 2);
  const points = crownGeometry.attributes.position, normals = crownGeometry.attributes.normal;
  const shades = new Float32Array(points.count * 3);
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i), y = points.getY(i), z = points.getZ(i);
    const roughness = 0.08 * Math.sin(5 * x + 2 * z) * Math.sin(6 * y - z) + 0.05 * Math.cos(8 * y + 4 * x);
    points.setXYZ(i, x * (1 + roughness), y * (1 + roughness), z * (1 + roughness));
    normals.setXYZ(i, x, y, z);
    const shade = 0.80 + 0.14 * y + roughness * 0.6;
    shades.set([shade, shade, shade], i * 3);
  }
  crownGeometry.setAttribute("color", new THREE.BufferAttribute(shades, 3));
  const treeList = [
    [-32.8, 2.5, 7.8], [-36.6, -3.8, 8.8], [-31.8, -9.7, 9.7], [-39.8, -11.5, 7.6],
    [32.7, 2.9, 7.8], [35.2, -3.3, 9.0], [31.8, -10, 8.4], [40.4, -8.2, 6.2],
    [-25, -17, 7.5], [-17, -19, 7.7], [-8, -23, 8.4], [2, -21, 6.9], [12, -22, 8.5],
    [23, -18, 7.0], [35, -23, 7.4], [-44, -22, 7.0], [46, -24, 7.9],
  ];
  const leafy = [0x557747, 0x66854c, 0x5a7c47, 0x78945a, 0x587c49];
  treeList.forEach(([x, z, height], index) => {
    const radius = height * 0.34;
    part(trunks, 0x736653, x, height * 0.30, z, height * 0.035, height * 0.60, height * 0.035);
    for (let branch = 0; branch < 6; branch++) {
      const angle = branch * 2.39996 + index;
      const offset = radius * (0.41 + 0.18 * Math.cos(branch + index));
      const by = height * (0.58 + branch * 0.053);
      const size = radius * (0.78 - 0.038 * branch);
      part(foliage, leafy[(index + branch) % leafy.length], x + Math.cos(angle) * offset, by,
        z + Math.sin(angle) * offset, size * 1.12, size * 1.18, size, angle, Math.sin(angle) * 0.15);
    }
  });
  group.add(drawParts(THREE, trunks, new THREE.CylinderGeometry(0.57, 1, 1, 7), new THREE.MeshStandardMaterial({ roughness: 1 })));
  group.add(drawParts(THREE, foliage, crownGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
  return group;
}
