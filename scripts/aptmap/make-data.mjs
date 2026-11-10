// P2-63a ⑤ 캐시를 합쳐 지도용 JSON과 검수 보고서를 만든다 (키 필요 없음, 네트워크 없음)
// 사용: node scripts/aptmap/make-data.mjs [--through YYYY-MM]
// 입력: data/stations.json, .cache/kapt-list.json, .cache/kapt-basic.json, .cache/trades/*.json, .cache/geo.json
// 결과: out/aptmap.json (요청서 4-3 형식), out/report.md (일치율·시드 10곳·탈락 사유·급변 경고)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CACHE, DATA, OUT, readJson, writeJson, arg, todayKST, lastMonthKST } from "./net.mjs";
import { parseTrade, usable, representativePrice, matchComplex, jibunFromAddr, stationsWithin, qualify, sameName, priceBand, walkBadge, distM, RULES } from "./logic.mjs";

// 12: 전남광주통합특별시(2026 통합, K-apt·실거래 API 모두 새 코드 12xxx 사용. 옛 29·46 코드로는 실거래 0건, 2026-11-10 확인)
export const SIDO = { 11: "서울", 12: "전남광주", 26: "부산", 27: "대구", 28: "인천", 29: "광주", 30: "대전", 31: "울산", 36: "세종", 41: "경기", 42: "강원", 51: "강원", 43: "충북", 44: "충남", 45: "전북", 52: "전북", 46: "전남", 47: "경북", 48: "경남", 50: "제주" };
// seq: 실거래 단지 일련번호(aptSeq). 실거래 단지명이 요청서 이름과 달라 2026-11-10 실거래 캐시에서 찾아 고정했다(kapt: K-apt 단지코드)
export const SEEDS = [
  { name: "벽적골8단지주공", dong: "영통동", expect: "영통 (835m)", seq: "41117-38", note: "정상 처리(COO 6차): K-apt에 8단지가 없음. 같은 지번 972-2에는 벽적골2단지주공·벽적골주공1만 있어 다른 단지에 붙이지 않는다" },          // 실거래명 벽적골주공휴먼시아8단지
  { name: "금화마을3단지주공그린빌", dong: "상갈동", expect: "상갈", seq: "41463-55" },      // 금화마을주공3단지
  { name: "중동한라주공2단지", dong: "중동", expect: "신중동 추정", seq: "41192-257" },        // 한라마을(주공2)
  { name: "반달건영", dong: "상동", expect: "상동 추정", seq: "41192-286" },                  // 반달마을(건영)
  { name: "가야주공5단지1차", dong: "산본동", expect: "수리산", seq: "41410-28" },            // 가야주공(산본동 1155), 추정
  { name: "율곡주공3단지", dong: "금정동", expect: "산본 (401m)", seq: "41410-83" },          // 율곡 / K-apt 군포율곡 A43575706
  { name: "매탄권선역리버파크", dong: "권선동", expect: "매탄권선", seq: "41113-33" },
  { name: "삼호진덕", dong: "천천동", expect: "불명 (1km 안에 역이 없으면 탈락)", seq: "41111-15" },
  // 「산본주공2-1단지」(금정동)는 대표님 지시로 시드에서 뺐다(2026-11-10, 실거래·K-apt에서 같은 단지를 찾지 못함)
  { name: "당동주공4단지", dong: "당동", expect: "당정 추정", seq: "41410-16" },              // 주공4(885) / K-apt A43572302
];

// 순수 조립 함수: 시험·지오코딩 대상 선정에도 쓴다
export function assemble({ stations, kaptList, basic, tradeItems, geo, through }) {
  // 실거래를 단지 일련번호(aptSeq)로 묶기
  const groups = new Map();
  for (const it of tradeItems) {
    const t = parseTrade(it);
    if (!t.aptSeq) continue;
    let g = groups.get(t.aptSeq);
    if (!g) groups.set(t.aptSeq, (g = { aptSeq: t.aptSeq, name: t.name, bjdCode: t.bjdCode, dong: t.dong, jibun: t.jibun, built: t.built, trades: [] }));
    g.trades.push(Object.defineProperty(t, "raw", { value: it, enumerable: false })); // raw: 손계산 표본용 원 응답
  }
  // K-apt 후보(법정동별)
  const kByDong = new Map();
  for (const k of kaptList) {
    const b = basic[k.kaptCode];
    const e = { kaptCode: k.kaptCode, kaptName: k.kaptName, bjdCode: String((b && b.bjdCode) || k.bjdCode), jibun: b ? jibunFromAddr(b.kaptAddr) : "", list: k, basic: b };
    if (!kByDong.has(e.bjdCode)) kByDong.set(e.bjdCode, []);
    kByDong.get(e.bjdCode).push(e);
  }
  const rows = [], match = {}, needGeo = [], geoTargets = [];
  // ① aptSeq마다 K-apt와 연결(일치율은 실거래 단지 aptSeq 단위로 센다)
  const byKapt = new Map(); // kaptCode → [{ g, m, k }]
  for (const g of groups.values()) {
    const rep0 = representativePrice(g.trades, through);
    if (!rep0) continue; // 40~60㎡ 중개 매매가 12개월 0건: 지도 대상 아님(일치율 계산에서도 뺌)
    const sido = SIDO[g.bjdCode.slice(0, 2)] || g.bjdCode.slice(0, 2);
    const m = matchComplex(g, kByDong.get(g.bjdCode) || []);
    const st = (match[sido] ??= { total: 0, stage1: 0, stage2: 0, none: 0 });
    st.total++; m.stage === 1 ? st.stage1++ : m.stage === 2 ? st.stage2++ : st.none++; if (m.rule) st.aux = (st.aux || 0) + 1;
    if (g.trades.length >= 10) { st.bigTotal = (st.bigTotal || 0) + 1; if (m.kaptCode) st.bigOk = (st.bigOk || 0) + 1; } // 큰 단지 일치율(aptSeq 단위)
    if (!m.kaptCode) { rows.push({ ...g, aptSeqs: [g.aptSeq], sido, rep: rep0, match: m, kapt: null, households: null, reason: `K-apt 연결 실패: ${m.reason}` }); continue; }
    const k = (kByDong.get(g.bjdCode) || []).find((x) => x.kaptCode === m.kaptCode);
    if (!byKapt.has(m.kaptCode)) byKapt.set(m.kaptCode, []);
    byKapt.get(m.kaptCode).push({ g, m, k, sido });
  }
  // ② 같은 K-apt 단지에 연결된 aptSeq는 하나로 합친다(P2-63a-2 COO 7차: 「벽적골두산·한신·우성」 → K-apt 「벽적골두산한신우성」 1곳)
  //    대표가격은 합친 거래 전체로 같은 규칙(6개월 중위값, 3건 미만이면 12개월)으로 다시 계산. 대표 aptSeq = 거래가 가장 많은 것
  for (const [kaptCode, parts] of byKapt) {
    parts.sort((x, y) => y.g.trades.length - x.g.trades.length || x.g.aptSeq.localeCompare(y.g.aptSeq));
    const { g: p0, m, k, sido } = parts[0];
    const trades = parts.flatMap((x) => x.g.trades);
    const g = { ...p0, trades, aptSeqs: parts.map((x) => x.g.aptSeq), mergedNames: parts.map((x) => x.g.name) };
    const rep = representativePrice(trades, through);
    const households = k && k.basic ? k.basic.kaptdaCnt : null;
    const c = { ...g, sido, rep, match: m, kapt: k, households };
    if (!k.basic) { c.reason = "K-apt 기본정보 아직 안 받음"; rows.push(c); continue; }
    // 좌표가 필요한 단지: 세대수·가격 조건을 이미 통과한 곳만(호출 절약)
    const pre = qualify({ households, rep, stations: [{}] });
    if (!pre.ok) { c.reason = pre.reason; rows.push(c); continue; }
    geoTargets.push({ kaptCode, aptSeq: g.aptSeq, doroJuso: k.basic.doroJuso, kaptAddr: k.basic.kaptAddr }); // 좌표 대상(300세대·9억 통과) 전체
    const p = geo[kaptCode];
    if (!p || !(p.lat > 0)) { needGeo.push({ kaptCode, doroJuso: k.basic.doroJuso, kaptAddr: k.basic.kaptAddr }); c.reason = p && p.fail ? `좌표 변환 실패: ${p.fail}` : "좌표 아직 없음"; rows.push(c); continue; }
    c.lat = p.lat; c.lng = p.lng;
    c.stations = stationsWithin(p.lat, p.lng, stations);
    const q = qualify({ households, rep, stations: c.stations });
    if (!q.ok) c.reason = q.reason; else c.band = q.band;
    rows.push(c);
  }
  const complexes = rows.filter((c) => c.band).sort((a, b) => a.rep.price - b.rep.price || a.aptSeq.localeCompare(b.aptSeq)).map((c) => {
    const l = c.kapt.list, s0 = c.stations[0];
    const used = c.kapt.basic.kaptUsedate;
    return {
      id: c.aptSeq, kaptCode: c.kapt.kaptCode, aptSeqs: c.aptSeqs, name: c.kapt.kaptName || c.name,
      sido: c.sido, sgg: l.as2 || "", dong: c.dong,
      lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6),
      households: c.households, built: /^\d{4}/.test(used) ? +used.slice(0, 4) : c.built,
      price: c.rep.price, band: c.band, priceBasis: c.rep.basis, tradeCount: c.rep.tradeCount, lowTrades: c.rep.lowTrades,
      station: { name: s0.name, lines: s0.lines, dist: s0.dist, walkMin: s0.walkMin },
      stationsNear: c.stations.slice(1).map((s) => ({ name: s.name, lines: s.lines, dist: s.dist })),
      recent: [...c.rep.used].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map((t) => ({ date: t.date, area: t.area, floor: t.floor, price: t.price })),
    };
  });
  return { rows, complexes, match, needGeo, geoTargets };
}

// ───────── 손계산 대조(로직 파일과 독립적으로 다시 계산) ─────────
// 원 응답 item 배열 → 요청서 3-2 규칙을 그대로 따라 다시 계산. logic.mjs의 함수는 쓰지 않는다.
export function handCalc(items, through) {
  const [ty, tm] = through.split("-").map(Number);
  const idx = (y, m) => y * 12 + m;
  const end = idx(ty, tm);
  let cancelled = 0, direct = 0;
  const p6 = [], p12 = [];
  for (const it of items) {
    const area = parseFloat(it.excluUseAr);
    if (!(area >= 40 && area <= 60)) continue;
    const back = end - idx(+it.dealYear, +it.dealMonth); // 0 = 반영 마지막 달
    if (back < 0 || back > 11) continue;
    if (String(it.cdealType ?? "").trim() || String(it.cdealDay ?? "").trim()) { cancelled++; continue; }
    if (String(it.dealingGbn ?? "").trim() !== "중개거래") { direct++; continue; }
    const price = parseInt(String(it.dealAmount).replace(/[,\s]/g, ""), 10);
    p12.push(price); if (back <= 5) p6.push(price);
  }
  const use = p6.length >= 3 ? p6 : p12;
  const prices = [...use].sort((a, b) => a - b);
  const n = prices.length;
  const median = !n ? null : n % 2 ? prices[(n - 1) / 2] : Math.round((prices[n / 2 - 1] + prices[n / 2]) / 2);
  return { basis: p6.length >= 3 ? "6m" : "12m", prices, median, cancelled, direct };
}
// 표본: 정확히 3억(또는 가장 가까운) / 12개월 확장 / 해제 포함 / 직거래 포함 / 율곡 / 나머지는 시·도별로 고르게
export function pickSamples(rows, through, n = 10) {
  // 경계·특수 사례 5곳 + 시·도가 겹치지 않게 5곳. 같은 시·도는 한 번만(경계 사례 제외)
  const pool = rows.filter((c) => c.rep).sort((a, b) => a.aptSeq.localeCompare(b.aptSeq));
  const out = [], used = new Set(), add = (c) => { if (c && !out.includes(c) && out.length < n) { out.push(c); used.add(c.sido); } };
  const hc = new Map(); const H = (c) => { if (!hc.has(c)) hc.set(c, handCalc(c.trades.map((t) => t.raw), through)); return hc.get(c); };
  const dev = (c) => Math.abs(c.rep.price - 30000);
  add([...pool].sort((a, b) => dev(a) - dev(b))[0]);                                                       // 정확히 3억 → p3
  add(pool.find((c) => c.rep.price === 90000) || [...pool].filter((c) => c.rep.price >= 90000).sort((a, b) => a.rep.price - b.rep.price)[0]); // 정확히 9억 → 제외
  add(pool.find((c) => c.aptSeq === "41410-83"));                                                        // 율곡(시드)
  add(pool.find((c) => !used.has(c.sido) && c.rep.basis === "12m" && c.rep.tradeCount === 2));             // 12개월 확장 + 짝수
  add(pool.find((c) => !used.has(c.sido) && H(c).cancelled > 0 && H(c).direct > 0));                        // 해제·직거래 모두 제외되는 단지
  for (const c of pool) { if (out.length >= n) break; if (!used.has(c.sido) && (H(c).cancelled > 0 || H(c).direct > 0)) add(c); }
  for (const c of pool) { if (out.length >= n) break; if (!used.has(c.sido)) add(c); }
  return out;
}

// 순수 함수: 주소 종류별 좌표 캐시 → 단지별 좌표 하나 + 집계(비교: 두 좌표가 300m 넘게 다른 단지 수)
export function mergeGeo(jibun, doro, diffM = 300) {
  const geo = {}, m = { jibun: 0, doroFallback: 0, doroTemp: 0, fail: 0, compared: 0, over300: 0, overList: [] };
  for (const c of new Set([...Object.keys(jibun), ...Object.keys(doro)])) {
    const j = jibun[c], d = doro[c];
    const jok = j && j.lat > 0, dok = d && d.lat > 0;
    if (jok && dok) { m.compared++; const dist = distM(j.lat, j.lng, d.lat, d.lng); if (dist > diffM) { m.over300++; if (m.overList.length < 30) m.overList.push({ kaptCode: c, dist, jibun: j.query || j.addr, doro: d.addr }); } }
    if (jok) { geo[c] = { ...j, basis: "jibun" }; m.jibun++; }
    else if (j && dok) { geo[c] = { ...d, basis: "doro" }; m.doroFallback++; }       // 지번 검색 실패 → 도로명
    else if (!j && dok) { geo[c] = { ...d, basis: "doro-temp" }; m.doroTemp++; }     // 지번 아직 안 받음 → 도로명 임시
    else { geo[c] = j || d; m.fail++; }
  }
  return { geo, geoMeta: m };
}

export function loadInputs(through) {
  const stations = readJson(path.join(DATA, "stations.json"), null);
  const kaptList = readJson(path.join(CACHE, "kapt-list.json"), null);
  // 세대수·주소: K-apt 파일(kapt-file.json)이 1순위, 기본정보 API(kapt-basic.json)는 파일에 없는 단지만 보완 (P2-63a-2 COO 5차 지시)
  const api = readJson(path.join(CACHE, "kapt-basic.json"), {});
  const kf = readJson(path.join(CACHE, "kapt-file.json"), null);
  const basic = { ...api };
  if (kf) for (const [c, b] of Object.entries(kf.basic)) basic[c] = { ...b, bjdCode: b.bjdCode || (api[c] && api[c].bjdCode) || "" };
  const basicMeta = { fileAsOf: kf ? kf.asOf : null, fileName: kf ? kf.sourceFile : null, fromFile: kf ? Object.keys(kf.basic).length : 0, fromApiOnly: Object.keys(api).filter((c) => !(kf && kf.basic[c])).length };
  // 좌표: 지번 주소(geo-jibun.json) 1순위, 지번 검색 실패면 도로명(geo-doro.json). 지번을 아직 안 받은 단지는 도로명을 임시로 쓴다(COO 6차 결정)
  const { geo, geoMeta } = mergeGeo(readJson(path.join(CACHE, "geo-jibun.json"), {}), readJson(path.join(CACHE, "geo-doro.json"), readJson(path.join(CACHE, "geo.json"), {})));
  const dir = path.join(CACHE, "trades");
  const tradeItems = [];
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) tradeItems.push(...readJson(path.join(dir, f), []));
  return { stations: stations && stations.stations, kaptList, basic, basicMeta, geo, geoMeta, tradeItems, through };
}

function main() {
  const meta = readJson(path.join(CACHE, "trades-meta.json"), {});
  const through = arg("through", meta.through || lastMonthKST());
  const inp = loadInputs(through);
  const missing = [!inp.stations && "data/stations.json (stations.mjs)", !inp.kaptList && ".cache/kapt-list.json (fetch-kapt.mjs list)", !inp.tradeItems.length && ".cache/trades (fetch-trades.mjs)"].filter(Boolean);
  if (missing.length) { console.log("아직 만들 수 없습니다. 먼저 준비할 것:\n  - " + missing.join("\n  - ")); process.exit(2); }
  const { rows, complexes, match } = assemble(inp);
  const prev = readJson(path.join(OUT, "aptmap.json"), null);
  const out = { updated: todayKST(), dataThrough: through, kaptFileAsOf: (inp.basicMeta && inp.basicMeta.fileAsOf) || null, rules: RULES, complexes };
  writeJson(path.join(OUT, "aptmap.json"), out);

  const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) + "%" : "-");
  const bm = inp.basicMeta || {};
  const lines = [`# 아파트 지도 데이터 보고 (${out.updated}, ${through} 계약분까지)`, "", `- 세대수·주소 출처: K-apt 단지 기본정보 파일 ${bm.fileName || "없음"} (**데이터 기준일 ${bm.fileAsOf || "-"}**) ${(bm.fromFile || 0).toLocaleString()}곳 + 기본정보 API 보완 ${(bm.fromApiOnly || 0).toLocaleString()}곳`, `- 지도에 올라가는 단지: **${complexes.length}곳**`];
  // 중복 검사(COO 7차): K-apt 단지코드·id가 겹치면 배포하지 않는다
  const dupK = complexes.length - new Set(complexes.map((c) => c.kaptCode)).size, dupId = complexes.length - new Set(complexes.map((c) => c.id)).size;
  const mergedN = complexes.filter((c) => c.aptSeqs.length > 1).length;
  lines.push(`- 중복 검사: K-apt 단지코드 중복 ${dupK}곳, id 중복 ${dupId}곳${dupK || dupId ? " → **경고: 배포 금지**" : " (정상)"} · 실거래 aptSeq 여러 개를 하나로 합친 단지 ${mergedN}곳`);
  // 월 갱신 운영 확인: K-apt 파일은 자동으로 받을 수 없다(K-apt 사이트가 직접 접근 차단). 기준일이 45일보다 오래되면 경고
  if (bm.fileAsOf) { const age = Math.round((Date.parse(out.updated) - Date.parse(bm.fileAsOf)) / 864e5); if (age > 45) lines.push(`- **경고: K-apt 단지 기본정보 파일이 ${age}일 지났습니다(기준일 ${bm.fileAsOf}).** K-apt에서 새 파일을 받아 .cache/ 에 넣고 kapt-file.mjs 를 다시 실행하세요.`); }
  else lines.push("- **경고: K-apt 단지 기본정보 파일이 없습니다.** 세대수·주소를 기본정보 API에만 의존합니다.");
  if (prev && prev.complexes) {
    const d = (complexes.length - prev.complexes.length) / Math.max(1, prev.complexes.length);
    lines.push(`- 지난 결과 ${prev.complexes.length}곳 대비 ${(d * 100).toFixed(1)}%` + (Math.abs(d) > 0.2 ? " → **경고: ±20% 넘게 바뀜. 배포 전 원인 확인**" : ""));
  }
  const byBand = {}; for (const c of complexes) byBand[c.band] = (byBand[c.band] || 0) + 1;
  lines.push(`- 가격대별: ${Object.keys(byBand).sort().map((b) => `${b} ${byBand[b]}`).join(", ")}`);
  lines.push("", "## 실거래-K-apt 일치율 (9장 목표 90%: 큰 단지 기준으로 판정, COO 6차 결정)", "", "| 시·도 | 대상 | 1순위(지번) | 2순위(이름) | 실패 | 일치율 |", "|---|---|---|---|---|---|");
  let T = { total: 0, stage1: 0, stage2: 0, none: 0 };
  for (const [s, v] of Object.entries(match).sort()) { lines.push(`| ${s} | ${v.total} | ${v.stage1} | ${v.stage2} | ${v.none} | ${pct(v.stage1 + v.stage2, v.total)} |`); for (const k in T) T[k] += v[k]; }
  lines.push(`| 합계 | ${T.total} | ${T.stage1} | ${T.stage2} | ${T.none} | ${pct(T.stage1 + T.stage2, T.total)} |`);
  const gm = inp.geoMeta;
  if (gm) lines.push("", `- 좌표 출처(COO 6차: 지번 주소 1순위): 지번 ${gm.jibun}곳 / 지번 실패→도로명 ${gm.doroFallback}곳 / **지번 아직 안 받아 도로명 임시 ${gm.doroTemp}곳** / 둘 다 실패 ${gm.fail}곳. 지번·도로명 좌표를 둘 다 가진 ${gm.compared}곳 중 **300m 넘게 차이 ${gm.over300}곳**`);
  const AUX = Object.values(match).reduce((x, v) => x + (v.aux || 0), 0);
  lines.push("", `- 1·2순위 중 보조 규칙(본번 일치·이름 일부)으로 붙은 단지: ${AUX}곳`);
  // 큰 단지 기준 일치율: 12개월 40~60㎡ 중개 매매 10건 이상(대단지의 근사치). K-apt는 의무관리 대상(대략 150세대 이상) 위주라 소규모 단지는 원래 없다
  // aptSeq 단위로 센다(같은 K-apt에 합친 뒤의 rows로 세면 분모가 줄어든다)
  const bigBy = {}; for (const [sd, v] of Object.entries(match)) if (v.bigTotal) bigBy[sd] = [v.bigTotal, v.bigOk || 0];
  const big = { length: Object.values(bigBy).reduce((a, v) => a + v[0], 0) }, bigOk = Object.values(bigBy).reduce((a, v) => a + v[1], 0);
  lines.push(`- **판정 기준: 큰 단지 일치율**(12개월 거래 10건 이상): ${bigOk}/${big.length} = **${pct(bigOk, big.length)}** → ${bigOk / Math.max(1, big.length) >= 0.9 ? "목표 90% 달성" : "**목표 90% 미달**"} (위 표의 전체 일치율은 참고, K-apt에 없는 소규모 단지 포함) · 시·도별: ${Object.entries(bigBy).sort().map(([k, v]) => `${k} ${pct(v[1], v[0])}`).join(", ")}`);
  const nBasic = Object.keys(inp.basic).length;
  lines.push("", `- 대상: 12개월 안에 전용 40~60㎡ 중개 매매가 1건 이상인 실거래 단지(aptSeq). K-apt 기본정보(파일+API) ${nBasic.toLocaleString()}곳 / 목록 ${inp.kaptList.length.toLocaleString()}곳.`,
    nBasic < inp.kaptList.length * 0.8 ? "- **잠정치**: 기본정보(법정동 주소)를 받지 못한 K-apt 단지는 지번이 없어 1순위(지번) 매칭을 할 수 없다. 지금 숫자는 대부분 2순위(이름) 결과이고, 기본정보를 다 받으면 다시 계산한다." : "");
  // 가격 조건만 본 규모(세대수 판정 전)
  const priceOnly = {}; for (const c of rows) { const b = priceBand(c.rep.price); const v = (priceOnly[c.sido] ??= { all: 0, ok: 0 }); v.all++; if (b) v.ok++; }
  lines.push("", "## 가격 조건만 적용(대표가격 9억 미만) — 세대수·역 조건 적용 전", "", "| 시·도 | 대상 단지 | 9억 미만 | 비율 |", "|---|---|---|---|");
  let PA = 0, PO = 0; for (const [s, v] of Object.entries(priceOnly).sort()) { lines.push(`| ${s} | ${v.all} | ${v.ok} | ${pct(v.ok, v.all)} |`); PA += v.all; PO += v.ok; }
  lines.push(`| 합계 | ${PA} | ${PO} | ${pct(PO, PA)} |`);
  // 좌표 전 단계: 세대수 300 이상 + 대표가격 9억 미만을 통과한 단지(좌표·역 조건만 남음)
  const preOk = rows.filter((c) => c.band || /^좌표|역 없음/.test(c.reason || "")); // 300세대·9억 통과(역 조건 결과와 무관)
  const inSt = preOk.filter((c) => c.band).length, outSt = preOk.filter((c) => /역 없음/.test(c.reason || "")).length, waitGeo = preOk.length - inSt - outSt;
  const preBy = {}; for (const c of preOk) { const b = priceBand(c.rep.price); (preBy[c.sido] ??= {})[b] = (preBy[c.sido][b] || 0) + 1; }
  const bands = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
  const waitBasic = rows.filter((c) => c.reason === "K-apt 기본정보 아직 안 받음").length;
  lines.push("", "## 300세대·가격(9억 미만) 조건 통과 단지 (좌표·역 조건 적용 전)", "", `- 통과 **${preOk.length}곳** → 그중 **역 1km 안 ${inSt}곳**(지도에 오름), 1km 밖 ${outSt}곳, 좌표 대기·실패 ${waitGeo}곳. 기본정보가 없는 연결 단지 ${waitBasic}곳은 판정 보류`, "", `| 시·도 | ${bands.join(" | ")} | 합계 |`, `|---|${bands.map(() => "---|").join("")}---|`);
  for (const [s, v] of Object.entries(preBy).sort()) lines.push(`| ${s} | ${bands.map((b) => v[b] || 0).join(" | ")} | ${Object.values(v).reduce((a, b) => a + b, 0)} |`);
  const why = {}; for (const c of rows) if (!c.band) { const k = (c.reason || "").replace(/\d[\d,]*/g, "N").replace(/: .*/, ""); why[k] = (why[k] || 0) + 1; }
  lines.push("", "탈락·보류 사유별: " + Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" / "));

  lines.push("", `## 시드 단지 ${SEEDS.length}곳`, "", "| 단지 | 예상 역 | 실거래 단지(aptSeq) | K-apt 연결 | 세대수 | 대표가격(기준·건수) | 가격대 | 결과 |", "|---|---|---|---|---|---|---|---|");
  for (const s of SEEDS) {
    const r = s.seq ? rows.find((c) => (c.aptSeqs || [c.aptSeq]).includes(s.seq)) : rows.find((c) => c.dong === s.dong && (sameName(c.name, s.name) || (c.kapt && sameName(c.kapt.kaptName, s.name))));
    if (!r) { lines.push(`| ${s.name} (${s.dong}) | ${s.expect} | 찾지 못함 | - | - | - | - | ${s.note || "실거래(40~60㎡ 중개 매매, 12개월)에 없음 → 이름 확인 필요"} |`); continue; }
    const res = !r.kapt && s.note ? s.note : r.band ? `통과: ${r.stations[0].name} ${r.stations[0].dist}m` : `${/^좌표/.test(r.reason) ? "좌표 대기" : "탈락"}: ${r.reason}`;
    lines.push(`| ${s.name} (${s.dong}) | ${s.expect} | ${r.name} (${(r.aptSeqs || [r.aptSeq]).join(", ")}) | ${r.kapt ? `${r.kapt.kaptName} ${r.kapt.kaptCode} ${r.match.stage}순위` : "실패"} | ${r.households ?? "-"} | ${r.rep.price.toLocaleString()}만원 (${r.rep.basis}, ${r.rep.tradeCount}건) | ${priceBand(r.rep.price) || "9억 이상"} | ${res} |`);
  }
  // 시드 역 거리(임시 검수): seed-geo.mjs가 실거래 지번 주소로 받은 카카오 좌표 기준
  const sg = readJson(path.join(CACHE, "seed-geo.json"), null);
  if (sg && inp.stations) {
    lines.push("", "### 시드 역 거리 (실거래 지번 주소 → 카카오 좌표, 임시 검수용)", "", "좌표는 실거래의 법정동+지번 1점이다(K-apt 주소 기준 지도 좌표와 다를 수 있음). 거리는 직선, 도보는 ×1.3÷67 추정.", "", "| 단지 | 예상 역 | 검색 주소 | 가장 가까운 역 | 직선 거리 | 도보(추정) | 배지 | 1km 안 다른 역 | 예상과 비교 |", "|---|---|---|---|---|---|---|---|---|");
    for (const s of SEEDS) {
      const g = s.seq && sg[s.seq];
      if (!g || g.fail) { lines.push(`| ${s.name} | ${s.expect} | ${(g && g.query) || "-"} | ${g ? g.fail : "좌표 없음"} | - | - | - | - | - |`); continue; }
      const near = stationsWithin(g.lat, g.lng, inp.stations, 5000);
      const n0 = near[0];
      if (!n0) { lines.push(`| ${s.name} | ${s.expect} | ${g.query} | 5km 안에 역 없음 | - | - | 탈락(1km 밖) | - | - |`); continue; }
      const badge = walkBadge(n0.dist) || "탈락(1km 밖)";
      const others = near.slice(1).filter((x) => x.dist <= RULES.stationMaxM).map((x) => `${x.name} ${x.dist}m`).join(", ") || "-";
      const exp = s.expect.replace(/\s*\(.*\)|\s*추정|불명.*/g, "").trim();
      const cmp = !exp ? "예상 역 없음" : n0.name === exp ? "일치" : near.some((x) => x.name === exp) ? `예상 역은 ${near.find((x) => x.name === exp).dist}m(가장 가깝진 않음)` : "다름";
      lines.push(`| ${s.name} | ${s.expect} | ${g.query} | ${n0.name} (${n0.lines.join("·")}) | ${n0.dist}m | ${n0.walkMin}분 | ${badge} | ${others} | ${cmp} |`);
    }
  }

  // 손계산 표본 10곳: 원자료에서 직접(로직 함수를 쓰지 않고) 다시 걸러 중위값을 구해 대조한다
  lines.push("", "## 가격 계산 손계산 표본 10곳", "", "원 응답 item에서 전용 40~60㎡, cdealType·cdealDay 빈칸, dealingGbn=「중개거래」만 남겨 정렬한 가격 목록과 중위값. 「제외」는 같은 단지·기간의 해제/직거래 건수.", "", "| 단지(aptSeq) | 기준 | 사용 가격(만원, 정렬) | 손계산 중위값 | 파이프라인 | 가격대 | 제외(해제/직거래) | 일치 |", "|---|---|---|---|---|---|---|---|");
  for (const c of pickSamples(rows, through)) {
    const h = handCalc(c.trades.map((t) => t.raw), through);
    const same = h.median === c.rep.price && h.basis === c.rep.basis;
    lines.push(`| ${c.name} (${c.aptSeq}) | ${h.basis} | ${h.prices.join(", ")} | ${h.median} | ${c.rep.price} (${c.rep.basis}) | ${priceBand(c.rep.price) || "9억 이상"} | ${h.cancelled}/${h.direct} | ${same ? "일치" : "**불일치**"} |`);
  }
  const fails = rows.filter((c) => !c.match.kaptCode).slice(0, 200);
  lines.push("", `## K-apt 연결 실패 목록 (최대 200개 / 전체 ${rows.filter((c) => !c.match.kaptCode).length}개)`, "", "| aptSeq | 단지명 | 법정동 | 지번 | 사유 |", "|---|---|---|---|---|");
  for (const c of fails) lines.push(`| ${c.aptSeq} | ${c.name} | ${c.dong} | ${c.jibun} | ${c.match.reason} |`);
  fs.writeFileSync(path.join(OUT, "report.md"), lines.join("\n") + "\n");
  console.log(lines.slice(0, 40).join("\n"));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
