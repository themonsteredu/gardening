"use client";

import { useEffect, useRef } from "react";
import { Box3, Vector3, type PerspectiveCamera } from "three";
import type { CampusModel } from "@/lib/campus-model";

const WIDTH = 1100;
const HEIGHT = 520;
const FRONT = -5.65;
const REAR = -9.75;
const TREE_IMAGE = "/assets/photoreal/large-tree-side.webp";
type V3 = [number, number, number];
type V2 = [number, number];
type Quad = [V3, V3, V3, V3];
type Painting = { distance: number; paint: () => void };
type Side = "front" | "rear" | "end";
type Textures = Record<Side, HTMLCanvasElement>;

function dimensions(campus: CampusModel) {
  const floors = Math.max(1, Math.min(8, Math.round(campus.floors)));
  const bays = Math.max(3, Math.min(20, Math.round(campus.bays)));
  const halfWidth = Math.min(11.65, 5.8 + bays * 0.45);
  return { floors, bays, halfWidth, height: 0.38 + floors * 0.97 };
}

export function customCampusVolumes(campus: CampusModel) {
  const { halfWidth, height } = dimensions(campus);
  return [new Box3(new Vector3(-halfWidth, 0, REAR), new Vector3(halfWidth, height, FRONT))];
}

// Draw one elevation in local coordinates. The same texture is then projected
// onto the physical wall, so windows, photographs and the crest rotate together.
function elevation(campus: CampusModel, side: Side, photo: HTMLImageElement | undefined, logo: HTMLImageElement | undefined) {
  const { floors, bays, halfWidth, height } = dimensions(campus);
  const length = side === "end" ? FRONT - REAR : 2 * halfWidth;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(length * 80);
  canvas.height = Math.round(height * 80);
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  ctx.fillStyle = campus.wallColor;
  ctx.fillRect(0, 0, w, h);

  if (side === "front" && photo) {
    // Keep the original framing and aspect ratio and crop the excess above
    // and below, to avoid stretching the school or its individual windows.
    const frontScale = Math.max(w / photo.naturalWidth, h / photo.naturalHeight);
    const sw = w / frontScale, sh = h / frontScale;
    ctx.drawImage(photo, (photo.naturalWidth - sw) / 2, (photo.naturalHeight - sh) / 2, sw, sh, 0, 0, w, h);
  } else {
    const base = ctx.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, "rgba(255,253,238,.17)");
    base.addColorStop(.72, "rgba(250,246,232,.03)");
    base.addColorStop(1, "rgba(52,48,38,.15)");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    // Staggered masonry remains visible around the windows at every angle.
    ctx.strokeStyle = "rgba(247,236,217,.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let row = 0; row * 8 < h; row++) {
      const y = row * 8;
      ctx.moveTo(0, y); ctx.lineTo(w, y);
      for (let x = row % 2 * 11; x < w; x += 22) {
        ctx.moveTo(x, y); ctx.lineTo(x, y + 8);
      }
    }
    ctx.stroke();
    const count = side === "end" ? 2 : bays;
    const pitch = (w - 28) / count;
    const floorH = (h - 25) / floors;
    for (let row = 0; row < floors; row++) {
      const y = 21 + row * floorH;
      ctx.fillStyle = "rgba(70,65,55,.14)";
      ctx.fillRect(0, y + floorH - 5, w, 4);
      ctx.fillStyle = "#e1dccc";
      ctx.fillRect(0, y + floorH - 7, w, 3);
      for (let bay = 0; bay < count; bay++) {
        const x = 14 + (bay + .13) * pitch;
        const ww = pitch * .74;
        const door = side !== "end" && row === floors - 1 && bay === Math.floor(count / 2);
        const hh = door ? floorH * .85 : floorH * .55;
        ctx.fillStyle = "#6e7066";
        ctx.fillRect(x - 3, y + 4, ww + 6, hh + 6);
        ctx.fillStyle = "#dedfd4";
        ctx.fillRect(x, y + 5, ww, hh);
        const glass = ctx.createLinearGradient(x, y, x + ww / 3, y + hh);
        glass.addColorStop(0, "#a0b8b2");
        glass.addColorStop(.55, (bay + row) % 4 === 0 ? "#74918c" : "#829e9d");
        glass.addColorStop(1, door ? "#3c5654" : "#476569");
        ctx.fillStyle = glass;
        ctx.fillRect(x + 3, y + 8, ww - 6, hh - 6);
        ctx.fillStyle = "#d1d2c6";
        ctx.fillRect(x + ww / 2 - 1.2, y + 6, 2.4, hh - 2);
        ctx.fillRect(x + 2, y + hh * .34, ww - 4, 2.4);
        ctx.fillStyle = "rgba(246,246,231,.24)";
        ctx.fillRect(x + 4, y + 8, ww * .46, Math.max(2, hh * .17));
        ctx.fillStyle = "#b9b6a7";
        ctx.fillRect(x - 5, y + hh + 7, ww + 10, 3);
      }
    }
  }

  if (side === "rear") {
    const stairX = w * .30, stairW = Math.min(w * .12, 108);
    ctx.fillStyle = "#e0dcca";
    ctx.fillRect(stairX, 8, stairW, h - 8);
    const glass = ctx.createLinearGradient(stairX, 0, stairX + stairW, h);
    glass.addColorStop(0, "#98b2ac"); glass.addColorStop(1, "#547372");
    ctx.fillStyle = glass; ctx.fillRect(stairX + 8, 13, stairW - 16, h - 16);
    ctx.fillStyle = "#c7cdc0";
    ctx.fillRect(stairX + stairW * .50, 13, 3, h - 13);
    for (let i = 1; i < floors * 2; i++) ctx.fillRect(stairX + 8, 13 + i * (h-13) / (floors*2), stairW - 16, 3);
  }
  ctx.fillStyle = campus.roofColor;
  ctx.fillRect(0, 0, w, 8);
  ctx.fillStyle = "rgba(35,41,38,.35)";
  ctx.fillRect(0, 8, w, 3);
  if (side === "front") {
    const title = campus.schoolName;
    let fontSize = 40;
    const setFont = () => { ctx.font = '700 ' + fontSize + 'px "S-Core Dream", "Apple SD Gothic Neo", sans-serif'; };
    setFont();
    while (ctx.measureText(title).width > w * .61 && fontSize > 12) { fontSize--; setFont(); }
    const labelWidth = ctx.measureText(title).width;
    const badgeWidth = labelWidth + (logo ? 42 : 0) + 28, badgeHeight = fontSize + 13;
    const x = (w - badgeWidth) / 2, y = 3;
    ctx.fillStyle = "rgba(44,49,44,.42)";
    ctx.fillRect(x + 2, y + 3, badgeWidth, badgeHeight);
    ctx.fillStyle = "#f4f2e8";
    ctx.fillRect(x, y, badgeWidth, badgeHeight);
    ctx.strokeStyle = "#a6a99a";
    ctx.strokeRect(x + .5, y + .5, badgeWidth - 1, badgeHeight - 1);
    if (logo) {
      const size = Math.min(36, badgeHeight - 6);
      const scale = Math.min(size / logo.naturalWidth, size / logo.naturalHeight);
      const lw = logo.naturalWidth * scale, lh = logo.naturalHeight * scale;
      ctx.drawImage(logo, x + 10 + (size - lw) / 2, y + (badgeHeight - lh) / 2, lw, lh);
    }
    ctx.fillStyle = "#243b38"; ctx.textBaseline = "middle";
    ctx.fillText(title, x + 14 + (logo ? 42 : 0), y + badgeHeight * .52);
  }
  return canvas;
}

function drawCampus(canvas: HTMLCanvasElement, camera: PerspectiveCamera, campus: CampusModel, walls: Textures, tree?: HTMLImageElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { halfWidth: w, height: h } = dimensions(campus);
  const vector = new Vector3();
  function project([x, y, z]: V3): V2 {
    const p = vector.set(x, y, z).project(camera);
    return [(p.x + 1) * WIDTH / 2, (1 - p.y) * HEIGHT / 2];
  }
  function polygon(points: V2[], color: string) {
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  function flat(points: Quad, color: string) { polygon(points.map(project), color); }

  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#aecedb"); sky.addColorStop(.52, "#e4ece4"); sky.addColorStop(1, "#edf0e6");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const horizon = HEIGHT / 2 - .105 * HEIGHT / (2 * Math.tan(21 * Math.PI / 180));
  const ground = ctx.createLinearGradient(0, horizon, 0, HEIGHT);
  ground.addColorStop(0, "#c9c4ae"); ground.addColorStop(.31, "#d6c6a9"); ground.addColorStop(1, "#c8af8b");
  ctx.fillStyle = ground; ctx.fillRect(0, horizon, WIDTH, HEIGHT - horizon);

  // In the distance, tree-covered hills stay just above the horizon as the camera turns.
  const yaw = Math.atan2(camera.matrixWorld.elements[8], camera.matrixWorld.elements[10]);
  for (let layer = 0; layer < 2; layer++) {
    const hill: V2[] = [[0, horizon], [0, horizon - 8]];
    for (let px = 0; px <= WIDTH + 10; px += 10) {
      const az = yaw + Math.atan((px / WIDTH - .5) * 1.65);
      const rise = 8 + 5 * Math.sin(az * 9 + layer) + 4 * Math.cos(az * 16 + .75 * layer);
      hill.push([px, horizon - rise - layer * 3]);
    }
    hill.push([WIDTH, horizon]);
    polygon(hill, layer ? "#c5d0bd" : "#d0dacc");
  }
  const surround = w + .7;
  flat([[-surround-.42,.004,FRONT+1.2],[surround+.42,.004,FRONT+1.2],[surround+.42,.004,REAR-1.1],[-surround-.42,.004,REAR-1.1]], "#b5a793");
  flat([[-surround,.01,FRONT+1.1],[surround,.01,FRONT+1.1],[surround,.01,REAR-1],[-surround,.01,REAR-1]], "#d8cebb");
  const wallsToPaint: Painting[] = [];
  const distance = (p: V3) => camera.position.distanceToSquared(vector.set(...p));
  const add = (center: V3, paint: () => void) => wallsToPaint.push({ distance: distance(center), paint });

  function textured(quad: Quad, texture: HTMLCanvasElement, shade: number) {
    const context = ctx!;
    // Subdivide along perspective depth. Each affine triangle samples the same
    // wall texture, keeping the image and nameplate anchored at oblique views.
    const depth = (point: V3) => -vector.set(...point).applyMatrix4(camera.matrixWorldInverse).z;
    const depths = quad.map(depth);
    const nearest = Math.max(1, Math.min(...depths));
    const edge = (a: number, b: number) => {
      const p = project(quad[a]), q = project(quad[b]);
      return Math.sqrt(Math.hypot(p[0] - q[0], p[1] - q[1]) * Math.abs(depths[a] - depths[b]) / (nearest * 4));
    };
    const nx = Math.max(1, Math.min(16, Math.ceil(edge(0, 1))));
    const ny = Math.max(1, Math.min(3, Math.ceil(edge(0, 3))));
    const grid = Array.from({length: ny + 1}, (_, row) => Array.from({length: nx + 1}, (_, col) => {
      const u = col / nx, v = row / ny;
      const p: V3 = [0, 0, 0];
      for (let j = 0; j < 3; j++) p[j] = quad[0][j] + u * (quad[1][j] - quad[0][j]) + v * (quad[3][j] - quad[0][j]);
      return project(p);
    }));
    const sw = texture.width / nx, sh = texture.height / ny;
    function triangle(a: V2, b: V2, c: V2, x: number, y: number, upper: boolean) {
      const horizontal = upper ? [b[0] - a[0], b[1] - a[1]] : [c[0] - b[0], c[1] - b[1]];
      const vertical = upper ? [c[0] - b[0], c[1] - b[1]] : [b[0] - a[0], b[1] - a[1]];
      context.save(); context.beginPath();
      // A subpixel overlap prevents seams between neighboring triangles in the same material.
      const mx = (a[0] + b[0] + c[0]) / 3, my = (a[1] + b[1] + c[1]) / 3;
      [a,b,c].forEach(([tx, ty], i) => {
        const length = Math.hypot(tx - mx, ty - my) || 1;
        const xx = tx + .65 * (tx - mx) / length, yy = ty + .65 * (ty - my) / length;
        if (i) context.lineTo(xx, yy); else context.moveTo(xx, yy);
      });
      context.closePath(); context.clip();
      context.transform(horizontal[0] / sw, horizontal[1] / sw, vertical[0] / sh, vertical[1] / sh, a[0], a[1]);
      const sx = x * sw, sy = y * sh;
      const left = Math.max(0, sx - 1), top = Math.max(0, sy - 1);
      const width = Math.min(texture.width, sx + sw + 1) - left, height = Math.min(texture.height, sy + sh + 1) - top;
      context.drawImage(texture, left, top, width, height, left - sx, top - sy, width, height);
      context.restore();
    }
    for (let row = 0; row < ny; row++) for (let col = 0; col < nx; col++) {
      const a = grid[row][col], b = grid[row][col+1], c = grid[row+1][col+1], d = grid[row+1][col];
      triangle(a,b,c,col,row,true); triangle(a,d,c,col,row,false);
    }
    if (shade) polygon(quad.map(project), 'rgba(41,50,48,' + shade + ')');
  }

  function wall(quad: Quad, texture: HTMLCanvasElement, shadow: number) {
    const center: V3 = [(quad[0][0]+quad[2][0])/2,h/2,(quad[0][2]+quad[2][2])/2];
    add(center, () => textured(quad, texture, shadow));
  }
  if (camera.position.z > FRONT) wall([[-w,h,FRONT],[w,h,FRONT],[w,0,FRONT],[-w,0,FRONT]], walls.front, 0);
  if (camera.position.z < REAR) wall([[w,h,REAR],[-w,h,REAR],[-w,0,REAR],[w,0,REAR]], walls.rear, .075);
  if (camera.position.x > w) wall([[w,h,FRONT],[w,h,REAR],[w,0,REAR],[w,0,FRONT]], walls.end, .13);
  if (camera.position.x < -w) wall([[-w,h,REAR],[-w,h,FRONT],[-w,0,FRONT],[-w,0,REAR]], walls.end, .22);
  if (camera.position.y >= h) add([0,h,(FRONT+REAR)/2], () => {
    flat([[-w,h,FRONT],[w,h,FRONT],[w,h,REAR],[-w,h,REAR]], campus.roofColor);
    flat([[-w+.16,h+.003,FRONT-.16],[w-.16,h+.003,FRONT-.16],[w-.16,h+.003,REAR+.16],[-w+.16,h+.003,REAR+.16]], "#9a9f93");
  });

  function canopy(z: number, direction: number, width: number) {
    if ((camera.position.z - z) * direction <= 0) return;
    const outer = z + .60 * direction, top = Math.min(1.05, h * .60);
    add([0,top,outer], () => {
      flat([[-width,top,outer],[width,top,outer],[width,top-.105,outer],[-width,top-.105,outer]], campus.roofColor);
      if (camera.position.y >= top) flat([[-width,top,outer],[width,top,outer],[width,top,z],[-width,top,z]], "#bcc9b8");
    });
  }
  canopy(FRONT,1,1.6); canopy(REAR,-1,1.1);

  // Billboard trees stand at the ends of the school, outside both planting beds.
  for (const [x,z,height] of [[-w-1.1,FRONT+.33,3.12],[w+1.05,REAR+.65,2.92]]) {
    if (!tree) continue;
    const foot = project([x,0,z]), crown = project([x,height,z]);
    const screenH = foot[1] - crown[1];
    if (screenH <= 0) continue;
    const screenW = screenH * tree.naturalWidth / tree.naturalHeight;
    add([x,height/2,z], () => {
      ctx.fillStyle = "rgba(81,78,49,.15)";
      ctx.beginPath(); ctx.ellipse(foot[0],foot[1],screenW*.28,Math.max(1,screenH*.027),0,0,Math.PI*2); ctx.fill();
      ctx.drawImage(tree,foot[0]-screenW/2,crown[1],screenW,screenH);
    });
  }
  wallsToPaint.sort((a,b) => b.distance - a.distance);
  for (const part of wallsToPaint) part.paint();
}

const pictureCache = new Map<string, Promise<HTMLImageElement | undefined>>();
function loadPicture(url?: string) {
  if (!url) return Promise.resolve(undefined);
  const pending = pictureCache.get(url);
  if (pending) return pending;
  const img = new Image();
  const result = new Promise<HTMLImageElement | undefined>(resolve => {
    img.onload = () => resolve(img);
    img.onerror = () => { pictureCache.delete(url); resolve(undefined); };
  });
  // Keep only a small working set when a teacher switches repeatedly between photos.
  if (pictureCache.size >= 20) pictureCache.delete(pictureCache.keys().next().value!);
  pictureCache.set(url, result); img.src = url;
  return result;
}

export function CustomCampusBackdrop({ campus, camera }: { campus: CampusModel; camera: PerspectiveCamera }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const lastCamera = useRef(camera);
  const render = useRef<((view: PerspectiveCamera) => void) | null>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let active = true;
    const walls = {
      front: elevation(campus, "front", undefined, undefined),
      rear: elevation(campus, "rear", undefined, undefined),
      end: elevation(campus, "end", undefined, undefined),
    };
    let tree: HTMLImageElement | undefined;
    render.current = view => drawCampus(element, view, campus, walls, tree);
    render.current(lastCamera.current);
    void loadPicture(TREE_IMAGE).then(image => {
      if (!active || !image) return;
      tree = image; render.current?.(lastCamera.current);
    });
    if (campus.frontPhoto || campus.logo) {
      void Promise.all([loadPicture(campus.frontPhoto), loadPicture(campus.logo)]).then(([photo, mark]) => {
        if (!active) return;
        walls.front = elevation(campus, "front", photo, mark);
        render.current?.(lastCamera.current);
      });
    }
    return () => { active = false; render.current = null; };
  }, [campus]);
  useEffect(() => {
    lastCamera.current = camera;
    render.current?.(camera);
  }, [camera]);
  return <foreignObject x={0} y={0} width={WIDTH} height={HEIGHT} pointerEvents="none">
    <canvas ref={canvas} width={WIDTH} height={HEIGHT} style={{ display:"block", width:"100%", height:"100%" }}
      role="img" aria-label={campus.schoolName + " 본관 3D 모형"} />
  </foreignObject>;
}
