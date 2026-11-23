import savedSchools from "@/data/school-directory.json";

export type DirectorySchool = { schoolName: string; schoolCode: string; region: string; homepage: string };
const offices: Record<string, string> = { 서울: "B10", 부산: "C10", 대구: "D10", 인천: "E10", 광주: "F10", 대전: "G10", 울산: "H10", 세종: "I10", 경기: "J10", 강원: "K10", 충북: "M10", 충남: "N10", 전북: "P10", 전남: "Q10", 경북: "R10", 경남: "S10", 제주: "T10" };
const provinces: Record<string, string> = { 충청북도: "충북", 충청남도: "충남", 전라북도: "전북", 전북특별자치도: "전북", 전라남도: "전남", 경상북도: "경북", 경상남도: "경남", 강원특별자치도: "강원", 제주특별자치도: "제주" };

export function parseSchoolQuery(query: string) {
  const words = query.normalize("NFKC").trim().split(/\s+/);
  const names: string[] = [];
  const region: string[] = [];
  for (const word of words) {
    const place = provinces[word] ?? word.replace(/(?:광역시|특별시|특별자치시|도)$/, "");
    if (offices[place] || (words.length > 1 && /[시군구]$/.test(word))) region.push(place);
    else names.push(word);
  }
  const office = region.map(word => offices[word]).find(Boolean);
  return { schoolName: names.join(""), region, office };
}

export function parseHomepage(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const raw = value.trim();
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^[a-z\d.-]+\.[a-z]{2,}$/i.test(url.hostname) || url.username || url.password || url.port) return "";
    url.protocol = "https:";
    return url.href;
  } catch { return ""; }
}

type NeisRow = { SCHUL_NM?: string; SD_SCHUL_CODE?: string; HMPG_ADRES?: string; ORG_RDNMA?: string; ATPT_OFCDC_SC_CODE?: string; LCTN_SC_NM?: string };
function parseRow(row: NeisRow): DirectorySchool | null {
  if (!row.SCHUL_NM || !row.SD_SCHUL_CODE || !/^\d{7}$/.test(row.SD_SCHUL_CODE)) return null;
  const province = Object.keys(offices).find(name => offices[name] === row.ATPT_OFCDC_SC_CODE) ?? row.LCTN_SC_NM;
  const district = (row.ORG_RDNMA ?? "").split(/\s+/).slice(1, 3).filter(part => /[시군구]$/.test(part));
  return { schoolName: row.SCHUL_NM, schoolCode: row.SD_SCHUL_CODE, region: [province, ...district].filter(Boolean).join(" "), homepage: parseHomepage(row.HMPG_ADRES) };
}

async function fromNeis(params: Record<string, string>): Promise<DirectorySchool[]> {
  // 교육부 나이스 교육정보개방포털, 학교기본정보 (OPEN17020190531110010104913).
  const url = new URL("https://open.neis.go.kr/hub/schoolInfo");
  const key = process.env.NEIS_API_KEY;
  url.search = new URLSearchParams({ Type: "json", pIndex: "1", pSize: key ? "50" : "5", ...params }).toString();
  if (key) url.searchParams.set("KEY", key);
  const response = await fetch(url, { signal: AbortSignal.timeout(8500), redirect: "error", next: { revalidate: 86400 } });
  if (!response.ok) throw new Error("School directory unavailable");
  const data = await response.json() as { RESULT?: { CODE?: string }; schoolInfo?: { row?: NeisRow[] }[] };
  if (data.RESULT?.CODE === "INFO-200") return [];
  if (!Array.isArray(data.schoolInfo)) throw new Error("School directory unavailable");
  return data.schoolInfo.flatMap(block => (block.row ?? []).map(parseRow).filter((s): s is DirectorySchool => Boolean(s)));
}

const snapshot = savedSchools.map(school => ({ ...school, homepage: parseHomepage(school.homepage) }));
function matches(school: DirectorySchool, name: string, region: string[]) {
  return school.schoolName.includes(name) && region.every(word => school.region.includes(word));
}

export async function searchSchools(query: string) {
  const { schoolName, region, office } = parseSchoolQuery(query);
  if (!schoolName && !office || schoolName.length === 1) return { schools: [] as DirectorySchool[] };
  let rows: DirectorySchool[] = [];
  let unavailable = false;
  try { rows = await fromNeis({ ...(schoolName ? { SCHUL_NM: schoolName } : {}), ...(office ? { ATPT_OFCDC_SC_CODE: office } : {}) }); }
  catch { unavailable = true; }
  const combined = new Map<string, DirectorySchool>();
  // Live records override locally cached directory entries if a school changes address.
  for (const school of [...snapshot, ...rows]) {
    if (matches(school, schoolName, region)) combined.set(school.schoolCode, school);
  }
  const schools = [...combined.values()].sort((a, b) => Number(b.schoolName === schoolName) - Number(a.schoolName === schoolName) || a.schoolName.localeCompare(b.schoolName, "ko")).slice(0, 25);
  return { schools, ...(unavailable ? { notice: "학교정보 서비스에 연결하지 못했어요. 저장된 학교를 선택하거나 직접 입력해 주세요." } : {}) };
}

export async function getDirectorySchool(code: string, name: string) {
  if (!/^\d{7}$/.test(code) || !name || name.length > 70) return null;
  const saved = snapshot.find(school => school.schoolCode === code && school.schoolName === name);
  if (saved) return saved;
  const rows = await fromNeis({ SD_SCHUL_CODE: code });
  return rows.find(school => school.schoolCode === code && school.schoolName === name) ?? null;
}
