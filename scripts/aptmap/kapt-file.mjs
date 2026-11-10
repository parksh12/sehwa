// P2-63a-2 K-apt 「단지 기본정보」 엑셀 파일 → 세대수·주소의 1순위 출처 (COO 5차 지시, 대표님이 K-apt에서 직접 받은 파일)
// 파일: .cache/YYYYMMDD_단지_기본정보.xlsx (파일 이름의 날짜 = 데이터 기준일). 자동으로 받을 수 없어 사람이 K-apt에서 받아 넣는다.
// 사용: node scripts/aptmap/kapt-file.mjs [--file 경로]     (키·네트워크 필요 없음. 가장 최근 날짜 파일을 고른다)
// 결과: .cache/kapt-file.json { asOf, sourceFile, columns, stats, basic: { kaptCode: { kaptName, kaptAddr, doroJuso, kaptdaCnt, kaptUsedate, bjdCode, src:"file" } } }
//   bjdCode(법정동코드)는 파일에 없어서 K-apt 단지 목록 API(.cache/kapt-list.json)에서 단지코드로 붙인다.
// 기본정보 API(fetch-kapt basic)는 이 파일에 없는 단지만 보완한다. make-data는 파일 값을 API 값보다 먼저 쓴다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CACHE, readJson, writeJson, arg } from "./net.mjs";
import { readXlsx } from "./xlsx.mjs";

export const KAPT_FILE_JSON = path.join(CACHE, "kapt-file.json");
// 쓰는 열(파일의 실제 열 이름, 2026-11-06 파일에서 확인)
export const COLS = { sido: "시도", sgg: "시군구", eup: "읍면", ri: "동리", code: "단지코드", name: "단지명", kind: "단지분류", addr: "법정동주소", doro: "도로명주소", use: "사용승인일", cnt: "세대수" };

// "20261106_단지_기본정보.xlsx" → "2026-11-06"
export function asOfFromName(name) {
  const m = path.basename(String(name || "")).match(/^(\d{4})(\d{2})(\d{2})_/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// 순수 함수: 엑셀 행 배열 → 기본정보 사전. list: K-apt 목록(법정동코드 붙이기용)
export function parseKaptFile(rows, { list = [], asOf = null, sourceFile = "" } = {}) {
  const h = rows.findIndex((r) => r.includes(COLS.code) && r.includes(COLS.cnt));
  if (h < 0) throw new Error(`열 이름 줄을 찾지 못함(「${COLS.code}」「${COLS.cnt}」 열 필요). 파일 형식이 바뀌었는지 확인하세요.`);
  const head = rows[h];
  const idx = Object.fromEntries(Object.entries(COLS).map(([k, n]) => [k, head.indexOf(n)]));
  const missing = Object.entries(idx).filter(([k, i]) => i < 0 && ["code", "name", "addr", "doro", "use", "cnt"].includes(k)).map(([k]) => COLS[k]);
  if (missing.length) throw new Error(`필요한 열이 없음: ${missing.join(", ")}`);
  const bjd = new Map(list.map((k) => [k.kaptCode, String(k.bjdCode || "")]));
  const basic = {};
  const stats = { rows: 0, noCode: 0, noBjd: 0, noCnt: 0, dup: 0 };
  for (const r of rows.slice(h + 1)) {
    const code = String(r[idx.code] || "").trim();
    if (!code) { if (r.some((x) => x)) stats.noCode++; continue; }
    stats.rows++;
    if (basic[code]) stats.dup++;
    const cnt = Math.round(parseFloat(String(r[idx.cnt]).replace(/,/g, "")) || 0); // "150.0" → 150
    if (!cnt) stats.noCnt++;
    const b = bjd.get(code) || "";
    if (!b) stats.noBjd++;
    basic[code] = { kaptName: r[idx.name] || "", kaptAddr: r[idx.addr] || "", doroJuso: r[idx.doro] || "", kaptdaCnt: cnt, kaptUsedate: String(r[idx.use] || ""), bjdCode: b, src: "file" };
  }
  return { asOf, sourceFile, columns: head.filter(Boolean), headerRow: h + 1, note: String(rows[0] && rows[0][0] || "").slice(0, 200), stats, basic };
}

// .cache 안에서 가장 최근 날짜의 「YYYYMMDD_단지_기본정보.xlsx」
export function latestFile(dir = CACHE) {
  if (!fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).filter((x) => /^\d{8}_단지_기본정보\.xlsx$/.test(x)).sort().at(-1);
  return f ? path.join(dir, f) : null;
}

// make-data·fetch-kapt에서 쓰는 읽기 함수(없으면 null)
export function loadKaptFile() { return readJson(KAPT_FILE_JSON, null); }

function main() {
  const file = arg("file", null) || latestFile();
  if (!file || !fs.existsSync(file)) { console.log("K-apt 단지 기본정보 파일이 없습니다. K-apt(www.k-apt.go.kr)에서 받은 「YYYYMMDD_단지_기본정보.xlsx」를 scripts/aptmap/.cache/ 에 넣으세요."); process.exit(2); }
  const list = readJson(path.join(CACHE, "kapt-list.json"), null);
  if (!list) console.log("주의: .cache/kapt-list.json 이 없어 법정동코드를 붙이지 못합니다(fetch-kapt.mjs list 먼저).");
  const rows = readXlsx(fs.readFileSync(file));
  const out = parseKaptFile(rows, { list: list || [], asOf: asOfFromName(file), sourceFile: path.basename(file) });
  writeJson(KAPT_FILE_JSON, out);
  const s = out.stats;
  console.log(`K-apt 파일 ${out.sourceFile} (기준일 ${out.asOf || "모름"}): 열 ${out.columns.length}개, 단지 ${s.rows.toLocaleString()}곳, 법정동코드 없음 ${s.noBjd}, 세대수 없음 ${s.noCnt}, 중복 ${s.dup}`);
  console.log(`→ ${path.relative(process.cwd(), KAPT_FILE_JSON)}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
