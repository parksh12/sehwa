// P2-63a 역 데이터 정리 (키 필요 없음)
// 출처: 전국도시철도역사정보표준데이터 (data.go.kr/data/15013205/standard.do → 레일포털 data.kric.go.kr 「역사정보(전체 기관)」 XLSX, 로그인 없이 다운로드)
// 사용: node scripts/aptmap/stations.mjs            (내려받아 정리)
//       node scripts/aptmap/stations.mjs 파일.xlsx  (이미 받은 파일로 정리)
// 결과: scripts/aptmap/data/stations.json  { source, sourceFile, built, lines:[...], stations:[{ id, name, lines, points:[{lat,lng}] }] }
//       scripts/aptmap/data/stations-check.md  (역 수·노선 수·환승 합치기·누락 점검)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readXlsx } from "./xlsx.mjs";
import { distM } from "./logic.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = process.env.APTMAP_CACHE_DIR ? path.resolve(process.env.APTMAP_CACHE_DIR) : path.join(HERE, ".cache"); // net.mjs 와 같은 규칙
const OUTDIR = path.join(HERE, "data");
const SRC_URL = "https://data.kric.go.kr/rips/dataset/download.file?type=filedata&id=32&operation=1";

// 노선명(원자료) → 화면 노선명. 코레일 구간은 이용자가 부르는 이름(1호선, 수인분당 등)으로 묶는다.
export const LINE_MAP = {
  "1호선": "1호선", "경부선": "1호선", "경인선": "1호선", "경원선": "1호선", "장항선": "1호선",
  "2호선": "2호선", "3호선": "3호선", "일산선": "3호선",
  "4호선": "4호선", "안산과천선": "4호선", "진접선": "4호선",
  "5호선": "5호선", "6호선": "6호선", "7호선": "7호선", "도시철도 7호선": "7호선",
  "8호선": "8호선", "수도권 광역철도 8호선": "8호선",
  "수도권  도시철도 9호선": "9호선", "서울 도시철도 9호선": "9호선",
  "분당선": "수인분당", "수인선": "수인분당",
  "경의중앙선": "경의중앙", "경춘선": "경춘", "경강선": "경강", "서해선": "서해",
  "신분당선": "신분당", "인천국제공항선": "공항철도", "우이신설선": "우이신설",
  "수도권 경량도시철도 신림선": "신림선", "의정부": "의정부경전철", "에버라인": "용인에버라인", "김포도시철도": "김포골드",
  "인천지하철 1호선": "인천1호선", "인천지하철 2호선": "인천2호선",
  "자기부상철도": "인천공항자기부상",
  "대전 도시철도 1호선": "대전1호선", "광주도시철도 1호선": "광주1호선",
  "대구 도시철도 1호선": "대구1호선", "대구 도시철도 2호선": "대구2호선", "대구 도시철도 3호선": "대구3호선", "대경선": "대경선",
  "부산 도시철도 1호선": "부산1호선", "부산 도시철도 2호선": "부산2호선", "부산 도시철도 3호선": "부산3호선",
  "부산 경량도시철도 4호선": "부산4호선", "부산김해경전철": "부산김해경전철", "동해선": "동해선",
};
// 운행 중이 아닌 노선(원자료에 남아 있어도 뺀다). 근거는 보고서에 적는다.
export const NOT_RUNNING = new Set(["인천공항자기부상"]);

// 코레일 광역전철 누락 점검표: 노선별 반드시 있어야 하는 역(양 끝·분기·시드 단지 관련 역)
export const KORAIL_CHECK = {
  "1호선": ["서울", "구로", "인천", "천안", "신창", "서동탄", "광명", "소요산", "연천", "금정", "당정", "성균관대", "화서"],
  "수인분당": ["청량리", "왕십리", "수서", "죽전", "기흥", "상갈", "영통", "매탄권선", "수원", "오이도", "인천"],
  "4호선": ["인덕원", "금정", "산본", "수리산", "오이도", "진접"],
  "3호선": ["대화", "지축"],
  "경의중앙": ["문산", "서울", "용산", "청량리", "지평"],
  "경춘": ["상봉", "광운대", "춘천"],
  "경강": ["판교", "여주"],
  "서해": ["일산", "대곡", "김포공항", "소사", "원시"],
  "동해선": ["부전", "태화강"],
  "대경선": ["구미", "경산"],
  "7호선": ["신중동", "상동", "석남"],
};
// 표준데이터에 없는 것으로 알려진 운행 노선(코레일 외 운영). 자동으로 넣지 않고 보고만 한다.
export const KNOWN_GAPS = [
  { line: "GTX-A", note: "수서~동탄(2024-03 개통), 운정중앙~서울역(2024-12 개통) 구간. 운영사 SG레일(코레일 아님). 표준데이터 운영기관 목록에 없음" },
];

// 원자료 「경원선」 중 용산~왕십리 구간은 경의중앙선 열차만 서는 역이다(1호선은 청량리부터 경원선으로 간다).
export const GYEONGWON_TO_GYEONGUI = new Set(["용산", "이촌", "서빙고", "한남", "옥수", "응봉", "왕십리"]);
// 원자료 노선 목록에 빠진 운행 노선 보정(역 이름 → 더할 노선). 근거: 수인분당선 왕십리~청량리 연장 운행(2020-09).
export const EXTRA_LINES = { "청량리": ["수인분당"] };

export const baseName = (n) => String(n).replace(/\([^)]*\)/g, "").replace(/\s/g, "").replace(/역$/, "");

export function buildStations(rows) {
  const h = rows[0];
  const col = (name) => { const i = h.indexOf(name); if (i < 0) throw new Error(`열 「${name}」이 없습니다. 원자료 형식이 바뀌었는지 확인하세요`); return i; };
  const C = { name: col("역사명"), line: col("노선명"), op: col("운영기관명"), lat: col("역위도"), lng: col("역경도") };
  const raw = [], unknownLines = new Set(), dropped = [];
  for (const r of rows.slice(1)) {
    if (!r[C.name]) continue;
    let line = LINE_MAP[r[C.line]];
    if (r[C.line] === "경원선" && GYEONGWON_TO_GYEONGUI.has(baseName(r[C.name]))) line = "경의중앙";
    if (!line) { unknownLines.add(r[C.line]); continue; }
    const lat = +r[C.lat], lng = +r[C.lng];
    if (!(lat > 33 && lat < 39 && lng > 124 && lng < 132)) { dropped.push(`${r[C.name]}(${r[C.line]}): 좌표 없음/범위 밖`); continue; }
    if (NOT_RUNNING.has(line)) { dropped.push(`${r[C.name]}(${r[C.line]}): 운행 중단 노선`); continue; }
    raw.push({ name: baseName(r[C.name]), rawName: r[C.name], line, op: r[C.op], lat, lng });
  }
  // 환승역 합치기: 이름(괄호·끝의 「역」 제외)이 같고 서로 700m 안이면 한 역. 이름이 같아도 멀면(다른 도시) 따로 둔다.
  const groups = [];
  for (const s of raw) {
    const g = groups.find((g) => g.name === s.name && g.points.some((p) => distM(p.lat, p.lng, s.lat, s.lng) <= 700));
    if (g) {
      if (!g.lines.includes(s.line)) g.lines.push(s.line);
      if (!g.points.some((p) => distM(p.lat, p.lng, s.lat, s.lng) < 30)) g.points.push({ lat: s.lat, lng: s.lng });
      g.rows++;
    } else groups.push({ name: s.name, lines: [s.line], points: [{ lat: s.lat, lng: s.lng }], rows: 1 });
  }
  const patched = [];
  for (const [name, add] of Object.entries(EXTRA_LINES)) {
    const hit = groups.filter((g) => g.name === name);
    if (hit.length === 1) for (const l of add) if (!hit[0].lines.includes(l)) { hit[0].lines.push(l); patched.push(`${name}+${l}`); }
  }
  const sameNameFar = {};
  for (const g of groups) (sameNameFar[g.name] ??= []).push(g);
  // 이름이 같은데 0.7~3km 떨어진 경우: 같은 역의 좌표가 틀렸을 수 있다(사람 확인 필요). 합치지 않고 따로 둔다.
  const suspect = [];
  for (const [name, gs] of Object.entries(sameNameFar)) {
    for (let i = 0; i < gs.length; i++) for (let k = i + 1; k < gs.length; k++) {
      let d = Infinity;
      for (const p of gs[i].points) for (const q of gs[k].points) d = Math.min(d, distM(p.lat, p.lng, q.lat, q.lng));
      if (d < 3000) suspect.push(`${name}(${gs[i].lines.join("/")} ↔ ${gs[k].lines.join("/")}, ${d}m)`);
    }
  }
  groups.sort((a, b) => a.name.localeCompare(b.name, "ko") || a.points[0].lat - b.points[0].lat);
  const stations = groups.map((g, i) => ({
    id: "s" + String(i + 1).padStart(4, "0"),
    name: g.name,
    lines: g.lines.sort((a, b) => a.localeCompare(b, "ko", { numeric: true })),
    points: g.points.map((p) => ({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) })),
    _rows: g.rows,
  }));
  const lines = [...new Set(stations.flatMap((s) => s.lines))].sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
  const homonyms = Object.entries(sameNameFar).filter(([, v]) => v.length > 1).map(([k, v]) => `${k}(${v.map((g) => g.lines.join("/")).join(" · ")})`);
  return { stations, lines, rawCount: raw.length, unknownLines: [...unknownLines], dropped, homonyms, suspect, patched };
}

export function korailCheck(stations) {
  const miss = [];
  for (const [line, names] of Object.entries(KORAIL_CHECK)) {
    for (const n of names) if (!stations.some((s) => s.name === n && s.lines.includes(line))) miss.push(`${line} ${n}`);
  }
  return miss;
}

async function main() {
  const arg = process.argv[2];
  let buf, sourceFile;
  if (arg) { buf = fs.readFileSync(arg); sourceFile = path.basename(arg); }
  else {
    fs.mkdirSync(CACHE, { recursive: true });
    const r = await fetch(SRC_URL);
    if (!r.ok) { console.error(`역 데이터 다운로드 실패: HTTP ${r.status}. 레일포털(data.kric.go.kr) 「역사정보(전체 기관)」를 직접 받아 파일 경로를 넘겨 주세요.`); process.exit(1); }
    const cd = r.headers.get("content-disposition") || "";
    const fn = (cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i) || [, "station.xlsx"])[1];
    sourceFile = /%[0-9A-F]{2}/i.test(fn) ? decodeURIComponent(fn) : Buffer.from(fn, "latin1").toString("utf8"); // 서버가 UTF-8 이름을 그대로 보냄
    buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(path.join(CACHE, "stations-src.xlsx"), buf);
  }
  const rows = readXlsx(buf);
  const res = buildStations(rows);
  const miss = korailCheck(res.stations);
  fs.mkdirSync(OUTDIR, { recursive: true });
  const out = {
    source: "국가철도공단 레일포털 전국도시철도역사정보 표준데이터(역사정보 전체 기관), 공공데이터포털 15013205, 이용허락범위 제한 없음",
    sourceFile, built: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }), lines: res.lines,
    stations: res.stations.map(({ _rows, ...s }) => s),
  };
  fs.writeFileSync(path.join(OUTDIR, "stations.json"), JSON.stringify(out));
  const transfer = res.stations.filter((s) => s.lines.length > 1);
  const perLine = Object.fromEntries(res.lines.map((l) => [l, res.stations.filter((s) => s.lines.includes(l)).length]));
  const md = [
    `# 역 데이터 정리 결과 (${out.built})`, "",
    `- 원자료: ${sourceFile} (행 ${rows.length - 1}개)`,
    `- 노선명 대응표에 있어 쓴 행: ${res.rawCount}개 / 대응표에 없는 노선: ${res.unknownLines.length ? res.unknownLines.join(", ") : "없음"}`,
    `- 뺀 행 ${res.dropped.length}개: ${res.dropped.join("; ") || "없음"}`,
    `- **역 ${res.stations.length}곳** (환승역 합친 뒤), **노선 ${res.lines.length}개**, 환승역 ${transfer.length}곳`,
    `- 이름이 같지만 700m 넘게 떨어져 따로 둔 역: ${res.homonyms.join(", ") || "없음"}`,
    `- **좌표 의심(같은 이름, 0.7~3km)**: ${res.suspect.join(", ") || "없음"} → 사람이 지도에서 확인 필요`,
    `- 노선 보정: ${res.patched.join(", ") || "없음"} / 경원선 용산~왕십리 ${GYEONGWON_TO_GYEONGUI.size}개 역은 경의중앙으로 분류`,
    `- 코레일 광역전철 점검표 누락: ${miss.length ? miss.join(", ") : "없음"} (점검 ${Object.values(KORAIL_CHECK).flat().length}개 역)`,
    `- 표준데이터에 없는 운행 노선(보완 필요): ${KNOWN_GAPS.map((g) => `${g.line} — ${g.note}`).join("; ")}`,
    "", "## 노선별 역 수", "", "| 노선 | 역 수 |", "|---|---|",
    ...Object.entries(perLine).map(([l, n]) => `| ${l} | ${n} |`),
    "", "## 환승역 (노선 3개 이상)", "",
    transfer.filter((s) => s.lines.length >= 3).map((s) => `${s.name}(${s.lines.join("·")})`).join(", "),
  ].join("\n");
  fs.writeFileSync(path.join(OUTDIR, "stations-check.md"), md + "\n");
  console.log(md);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e.message); process.exit(1); });
