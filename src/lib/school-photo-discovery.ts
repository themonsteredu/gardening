import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList, isIPv4 } from "node:net";
import sharp from "sharp";

// Only directory-approved institutional sites and assets referenced by their public homepage are read.
const schoolDomain = /(?:\.(?:es|ms|hs|sc|edu|go|ac)\.kr|\.(?:edunet\.net|gyo6\.net|busanedu\.net|jbedu\.kr|icehs\.kr|icems\.kr|icees\.kr)|\.school\.kr)$/i;
const denied = new BlockList();
for (const [ip, prefix] of [["0.0.0.0",8], ["10.0.0.0",8], ["100.64.0.0",10], ["127.0.0.0",8], ["169.254.0.0",16], ["172.16.0.0",12], ["192.0.0.0",24], ["192.0.2.0",24], ["192.88.99.0",24], ["192.168.0.0",16], ["198.18.0.0",15], ["198.51.100.0",24], ["203.0.113.0",24], ["224.0.0.0",4], ["240.0.0.0",4]] as const) denied.addSubnet(ip, prefix);
export function isPublicAddress(address: string) { return isIPv4(address) && !denied.check(address); }
export function schoolUrl(raw: string, base?: URL) {
  try {
    const url = new URL(raw.replaceAll("&amp;", "&"), base);
    if (!/^https?:$/.test(url.protocol) || !schoolDomain.test(url.hostname) || url.username || url.password || url.port) return null;
    url.protocol = "https:";
    url.hash = "";
    return url;
  } catch { return null; }
}

type SchoolResource = { url: URL; bytes: Buffer; contentType: string };
async function readSchoolResource(url: URL, size: number, signal: AbortSignal, redirects = 0): Promise<SchoolResource> {
  // Pin the resolved public address for this connection. TLS still validates the institutional hostname.
  signal.throwIfAborted();
  const addresses = await new Promise<{ address: string }[]>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    lookup(url.hostname, { all: true, family: 4 }).then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
  if (!addresses.length || !addresses.every(({ address }) => isPublicAddress(address))) throw new Error("School site unavailable");
  signal.throwIfAborted();
  const resource = await new Promise<SchoolResource | URL>((resolve, reject) => {
    const req = request({ hostname: addresses[0].address, servername: url.hostname, path: url.pathname + url.search, signal,
      headers: { host: url.hostname, accept: "*/*", "accept-encoding": "identity", "user-agent": "Mozilla/5.0 (compatible; SchoolGarden/1.0)" } }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode <= 399) {
        const next = res.headers.location && schoolUrl(res.headers.location, url);
        res.destroy();
        if (!next || redirects >= 3) reject(new Error("School redirect unavailable"));
        else resolve(next);
        return;
      }
      if (res.statusCode !== 200 || Number(res.headers["content-length"]) > size) {
        res.destroy(); reject(new Error("School content unavailable")); return;
      }
      let length = 0;
      const chunks: Buffer[] = [];
      res.on("error", reject);
      res.on("data", (chunk: Buffer) => {
        length += chunk.length;
        if (length > size) res.destroy(new Error("School resource too large"));
        else chunks.push(chunk);
      });
      res.on("end", () => resolve({ url, bytes: Buffer.concat(chunks), contentType: String(res.headers["content-type"] ?? "") }));
    });
    req.on("error", reject);
    req.end();
  });
  return resource instanceof URL ? readSchoolResource(resource, size, signal, redirects + 1) : resource;
}

function attr(tag: string, key: string) {
  const match = tag.match(new RegExp(`(?:^|\\s)${key}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
}
const hero = /visual|hero|main[-_ ]?(?:img|photo|slide|picture)|(?:img|slide)[-_ ]?main|슬라이드|메인\s*(?:이미지|사진|비주얼)/i;
const facade = /학교\s*(?:전경|외관|정면|풍경)|본관|교사\s*전경|전경|facade|campus[-_ ]?(?:view|photo)|school[-_ ]?(?:view|building)/i;
const exclude = /(?:logo|badge|icon|symbol|quick|thumb|button|popup|banner|\/bbs\/|\/board\/|\.svg\b|\.gif\b|로고|교표|아이콘|버튼|팝업|배너|행사|학생회|학예|대회|체험|홍보|카드뉴스)/i;
export function homepageImageCandidates(html: string, base: URL) {
  const options = new Map<string, { url: string; label: string; score: number }>();
  const add = (raw: string, clue: string, context = "", openGraph = false) => {
    if (!raw || exclude.test(raw + " " + clue)) return;
    const url = schoolUrl(raw, base);
    if (!url) return;
    const evidence = raw + " " + clue;
    const score = facade.test(evidence) ? 5 : hero.test(evidence) ? 4 : hero.test(context) ? 3 : openGraph ? 1 : 0;
    if (!score || (options.get(url.href)?.score ?? 0) >= score) return;
    options.set(url.href, { url: url.href, label: score === 5 ? "학교 전경 후보" : "공식 홈페이지 대표 이미지 후보", score });
  };
  const safeHtml = html.replace(/<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script\s*>/gi, "");
  for (const match of safeHtml.matchAll(/<img\b[^>]{1,2400}>|<meta\b[^>]{1,1200}>/gi)) {
    const tag = match[0];
    if (/^<meta/i.test(tag)) {
      if (attr(tag, "property").toLowerCase() === "og:image") add(attr(tag, "content"), "", "", true);
    } else {
      const clue = [attr(tag, "alt"), attr(tag, "class"), attr(tag, "title")].join(" ");
      const context = safeHtml.slice(Math.max(0, match.index - 230), match.index);
      add(attr(tag, "data-src") || attr(tag, "data-lazy") || attr(tag, "src"), clue, context);
    }
  }
  for (const match of safeHtml.matchAll(/url\(\s*['"]?([^)'"\s]{1,600})['"]?\s*\)/gi)) {
    add(match[1], "", safeHtml.slice(Math.max(0, match.index - 180), match.index));
  }
  return [...options.values()].sort((a, b) => b.score - a.score).slice(0, 4);
}

function htmlText(resource: SchoolResource) {
  const prefix = resource.bytes.subarray(0, 1500).toString("latin1");
  const korean = /charset\s*=\s*['"]?\s*(?:euc[-_]?kr|ks_c_5601|cp949)/i.test(resource.contentType + " " + prefix);
  return new TextDecoder(korean ? "euc-kr" : "utf-8").decode(resource.bytes);
}
function landingPage(html: string, base: URL) {
  const meta = html.match(/<meta\b[^>]*http-equiv\s*=\s*['"]?refresh\b[^>]*>/i)?.[0];
  const target = meta && attr(meta, "content").match(/^\s*[0-3]\s*;\s*url\s*=\s*(.+)$/i)?.[1];
  const scriptLanding = html.length < 12000 && html.match(/(?:location\.(?:href\s*=|replace\s*\()|location\s*=)\s*["']([^"']{1,350})["']/i)?.[1];
  const path = target || scriptLanding;
  return path ? schoolUrl(path, base) : null;
}

export type SchoolPhoto = { url: string; originalUrl: string; label: string };
export async function discoverSchoolPhotos(homepage: string, signal: AbortSignal): Promise<SchoolPhoto[]> {
  const home = schoolUrl(homepage);
  if (!home) return [];
  let page = await readSchoolResource(home, 680_000, signal);
  let html = htmlText(page);
  let candidates = homepageImageCandidates(html, page.url);
  const next = !candidates.length && landingPage(html, page.url);
  if (next && next.href !== page.url.href) {
    page = await readSchoolResource(next, 680_000, signal);
    html = htmlText(page);
    candidates = homepageImageCandidates(html, page.url);
  }
  const images = await Promise.allSettled(candidates.map(async item => {
    const image = await readSchoolResource(new URL(item.url), 3_000_000, signal);
    const pipeline = sharp(image.bytes, { limitInputPixels: 24_000_000, failOn: "error" });
    const meta = await pipeline.metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || !meta.height || !meta.width || meta.width < 400 || meta.height < 150 || meta.width / meta.height < 1.2) return null;
    const jpeg = await pipeline.rotate().resize({ width: 1050, height: 740, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
    return { url: `data:image/jpeg;base64,${jpeg.toString("base64")}`, originalUrl: image.url.href, label: item.label };
  }));
  return images.flatMap(r => r.status === "fulfilled" && r.value ? [r.value] : []).slice(0, 3);
}
