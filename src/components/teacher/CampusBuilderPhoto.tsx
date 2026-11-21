"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import styles from "./CampusBuilderPhoto.module.css";

type Crop = { horizontal: number; vertical: number; zoom: number };
type Props = {
  value?: string;
  candidates: { url: string; label: string }[];
  loading: boolean;
  onChange: (photo: string | undefined, wallColor?: string) => void;
  aspectRatio?: number;
  onProcessingChange?: (processing: boolean) => void;
};
const CENTER: Crop = { horizontal: 50, vertical: 50, zoom: 1 };
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_EXPORT_BYTES = 140 * 1024;
const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("사진을 열지 못했어요. 다른 정면 사진을 골라 주세요."));
    image.src = url;
  });
}

function facadeColor(canvas: HTMLCanvasElement) {
  const sample = document.createElement("canvas");
  sample.width = 64;
  sample.height = 18;
  const ctx = sample.getContext("2d", { willReadFrequently: true });
  if (!ctx) return undefined;
  ctx.drawImage(canvas, canvas.width * .06, canvas.height * .15, canvas.width * .88, canvas.height * .68, 0, 0, 64, 18);
  const pixels = ctx.getImageData(0, 0, 64, 18).data;
  const bins = new Map<number, { red: number; green: number; blue: number; count: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
    // Ignore strong sky, foliage, shadows and blown highlights before sampling masonry.
    if (b > r * 1.10 || g > r * 1.09 || Math.max(r, g, b) < 58 || Math.min(r, g, b) > 245) continue;
    const bin = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5);
    const stats = bins.get(bin) ?? { red: 0, green: 0, blue: 0, count: 0 };
    stats.red += r;
    stats.green += g;
    stats.blue += b;
    stats.count++;
    bins.set(bin, stats);
  }
  const dominant = [...bins.values()].sort((a, b) => b.count - a.count)[0];
  if (!dominant || dominant.count < 12) return undefined;
  return "#" + [dominant.red, dominant.green, dominant.blue].map(channel =>
    Math.round(channel / dominant.count).toString(16).padStart(2, "0"),
  ).join("");
}

function cropImage(source: HTMLImageElement, crop: Crop, aspect: number) {
  const width = Math.min(source.naturalWidth, source.naturalHeight * aspect) / crop.zoom;
  const height = width / aspect;
  const left = (source.naturalWidth - width) * crop.horizontal / 100;
  const top = (source.naturalHeight - height) * crop.vertical / 100;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.min(1100, Math.round(width)));
  canvas.height = Math.max(1, Math.round(canvas.width / aspect));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이 기기에서 사진을 편집할 수 없어요.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, left, top, width, height, 0, 0, canvas.width, canvas.height);
  const color = facadeColor(canvas);
  for (const quality of [.85, .70, .55, .38]) {
    const data = canvas.toDataURL("image/jpeg", quality);
    if (data.length < MAX_EXPORT_BYTES * 4 / 3) return { data, color };
  }
  throw new Error("사진 용량을 줄이지 못했어요. 조금 작은 사진을 골라 주세요.");
}

export function CampusBuilderPhoto({ value, candidates, loading, onChange, aspectRatio = 4.4, onProcessingChange }: Props) {
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState(CENTER);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [reading, setReading] = useState(false);
  const pickerId = useId();
  const requestId = useRef(0);
  const aspect = Math.max(2, Math.min(8, aspectRatio));
  useEffect(() => () => { requestId.current++; }, []);

  function apply(image: HTMLImageElement, next: Crop) {
    const { data, color } = cropImage(image, next, aspect);
    setCrop(next);
    onChange(data, color);
  }

  async function openImage(url: string, candidate: string | null = null) {
    const request = ++requestId.current;
    setReading(true);
    onProcessingChange?.(true);
    setNotice("");
    try {
      const decoded = await loadImage(url);
      if (request !== requestId.current) return;
      apply(decoded, CENTER);
      setSource(decoded);
      setSelectedUrl(candidate);
    } catch (error) {
      if (request === requestId.current) setNotice(error instanceof Error ? error.message : "사진을 불러오지 못했어요.");
    } finally {
      if (request === requestId.current) { setReading(false); onProcessingChange?.(false); }
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!SUPPORTED_TYPES.includes(file.type) || !file.size || file.size > MAX_IMAGE_BYTES) {
      requestId.current++;
      setReading(false);
      onProcessingChange?.(false);
      setNotice("JPG, PNG, WebP 형식의 12MB 이하 사진을 골라 주세요.");
      return;
    }
    const url = URL.createObjectURL(file);
    try { await openImage(url); } finally { URL.revokeObjectURL(url); }
  }

  function adjust(field: keyof Crop, value: number) {
    if (!source) return;
    try { apply(source, { ...crop, [field]: value }); }
    catch { setNotice("사진의 범위를 적용하지 못했어요. 다시 조정해 주세요."); }
  }

  function clearPhoto() {
    requestId.current++;
    setReading(false);
    onProcessingChange?.(false);
    setSource(null);
    setSelectedUrl(null);
    setNotice("");
    onChange(undefined);
  }

  return (
    <div className={styles.picker}>
      {loading && <p role="status">학교 홈페이지에서 정면 사진을 찾고 있어요…</p>}
      {candidates.length > 0 && <div>
        <p className={styles.note}>학교 홈페이지 사진 중 본관 정면을 골라 주세요.</p>
        <div className={styles.candidates}>
          {candidates.map((candidate, index) => <button type="button" key={index} className={styles.candidate}
            aria-pressed={selectedUrl === candidate.url} onClick={() => void openImage(candidate.url, candidate.url)}>
            <Image src={candidate.url} width={112} height={65} unoptimized alt="" />
            <span>{candidate.label || `정면 사진 ${index + 1}`}</span>
          </button>)}
        </div>
      </div>}
      <div className={styles.actions}>
        <input id={pickerId} className={styles.file} type="file" accept={SUPPORTED_TYPES.join(",")}
          aria-label="내 본관 정면 사진 올리기 (선택)" onChange={upload} />
        <label htmlFor={pickerId} className={styles.button}>{value ? "다른 사진 올리기" : "내 사진 올리기 (선택)"}</label>
        {value && <button type="button" className={styles.plain} onClick={clearPhoto}>사진 지우기</button>}
      </div>
      {reading && <p role="status">정면 사진을 준비하고 있어요…</p>}
      {notice && <p role="alert" className={styles.error}>{notice}</p>}
      {value && <div className={styles.edit}>
        <div className={styles.frame} style={{ aspectRatio: aspect }}>
          <Image src={value} alt="학교 모형 정면에 적용할 사진 범위" fill sizes="(max-width: 720px) 90vw, 500px" unoptimized />
        </div>
        {source ? <details>
          <summary>사진 범위 조정</summary>
          <div className={styles.sliders}>
            <label>확대 <input type="range" min={1} max={3} step={.05} value={crop.zoom} onChange={e => adjust("zoom", +e.target.value)} /></label>
            <label>좌우 위치 <input type="range" min={0} max={100} value={crop.horizontal} onChange={e => adjust("horizontal", +e.target.value)} /></label>
            <label>위아래 위치 <input type="range" min={0} max={100} value={crop.vertical} onChange={e => adjust("vertical", +e.target.value)} /></label>
          </div>
        </details> : <button type="button" className={styles.plain} onClick={() => void openImage(value)}>사진 범위 조정</button>}
      </div>}
    </div>
  );
}
