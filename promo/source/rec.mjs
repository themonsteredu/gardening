// CDP screencast recorder (adapted from ai-air promo). Records real app interactions only.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
export const FF = execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
export const BASE = 'http://localhost:3000';
// Small visible cursor so viewers can follow drags/clicks (overlay only; app UI untouched).
const CURSOR = () => {
  document.addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.id = '__promo_cursor';
    c.style.cssText = 'position:fixed;left:-50px;top:-50px;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(166,195,55,.35);border:2.5px solid #315d48;box-shadow:0 2px 10px rgba(0,0,0,.25);z-index:2147483647;pointer-events:none;transition:transform .12s';
    document.body.appendChild(c);
    const mv = e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; };
    window.addEventListener('pointermove', mv, true); window.addEventListener('mousemove', mv, true);
    window.addEventListener('pointerdown', e => { mv(e); c.style.transform = 'scale(.7)'; }, true);
    window.addEventListener('pointerup', () => { c.style.transform = 'scale(1)'; }, true);
  });
};
export async function session(fn, { dpr = 1, storageState } = {}) {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: dpr, storageState });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  try { await fn(page, ctx); } finally { await b.close(); }
}
export async function record(page, name, actions) {
  const dir = `clips/${name}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const dpr = await page.evaluate(() => devicePixelRatio);
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async f => {
    const i = frames.length; frames.push(f.metadata.timestamp);
    fs.writeFileSync(`${dir}/${String(i).padStart(5, '0')}.jpg`, Buffer.from(f.data, 'base64'));
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1600 * dpr, maxHeight: 900 * dpr, everyNthFrame: 1 });
  const start = Date.now() / 1000;
  await actions();
  const end = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  let list = '';
  frames.forEach((t, i) => { const next = i + 1 < frames.length ? frames[i + 1] : end; list += `file '${String(i).padStart(5, '0')}.jpg'\nduration ${Math.max(0.001, next - t).toFixed(4)}\n`; });
  list += `file '${String(frames.length - 1).padStart(5, '0')}.jpg'\n`;
  fs.writeFileSync(`${dir}/list.txt`, list);
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`, '-vf', `fps=30,scale=${1600 * dpr}:${900 * dpr}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', `clips/${name}.mp4`]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(name, frames.length, 'frames', (end - start).toFixed(1), 's');
}
