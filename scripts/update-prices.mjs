// P2-50 SOXL·TQQQ·KORU 일봉 갱신 (수동 실행): node scripts/update-prices.mjs   (P2-50c 시가·고가·저가·종가 OHLC + 작은 정수 열 형식)
// 출처: Yahoo Finance 차트 응답(키·계정 없이 받는 공개 주소). close = 분할·병합 반영 종가(배당 미반영). adjclose(배당 반영)는 쓰지 않음.
// Yahoo quote의 open·high·low·close는 모두 분할·병합 반영값(분할일 시가가 전날 종가와 이어짐을 확인). adjclose/close 비율은 배당 보정분이라 곱하지 않음(기준: 배당 미반영)
// 결과: src/assets/data/stock-<티커>.json  { v:2, t, src, basis, asOf, d0, k, g:[날짜 간격(일)], c:[종가×k 차분], o:[시가−종가], h:[고가−max(시가,종가)], l:[min(시가,종가)−저가] } (모두 정수, k=10000 → $0.0001 단위)
// 확인: ① 빈 값 없음 ② 날짜 오름차순 ③ 분할·병합일 전후 종가가 분할 비율만큼 튀지 않음(= 분할이 반영된 가격) ④ 교차 확인용 마지막 5일 출력
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src", "assets", "data");
const TICKERS = ["SOXL", "TQQQ", "KORU"];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const nyDate = (sec) => new Date(sec * 1000).toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD(뉴욕)
const nyNow = () => { const s = new Date().toLocaleString("en-CA", { timeZone: "America/New_York", hour12: false }); return { d: s.slice(0, 10), hm: s.slice(12, 17) }; };
const dayNum = (d) => Date.parse(d + "T00:00:00Z") / 864e5;

async function get(t) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${t}?period1=0&period2=${Math.floor(Date.now() / 1000) + 86400}&interval=1d&events=split&includeAdjustedClose=true`;
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new Error(`${t}: HTTP ${r.status}`);
  const j = await r.json();
  const res = j.chart && j.chart.result && j.chart.result[0];
  if (!res) throw new Error(`${t}: 응답 형식이 바뀜 ${JSON.stringify(j.chart && j.chart.error)}`);
  return res;
}

fs.mkdirSync(OUT, { recursive: true });
const now = nyNow();
let bad = 0;
for (const t of TICKERS) {
  const res = await get(t);
  const ts = res.timestamp, qt = res.indicators.quote[0], close = qt.close;
  const rows = [];
  for (let i = 0; i < ts.length; i++) {
    const d = nyDate(ts[i]);
    if (close[i] == null || !(close[i] > 0)) continue; // 거래 없는 날(빈 값)은 뺌
    if (d === now.d && now.hm < "16:30") continue; // 장중 미확정 봉은 뺌
    if (rows.length && rows[rows.length - 1][0] >= d) throw new Error(`${t}: 날짜 순서 이상 ${d}`);
    const K = 10000, P = (x) => Math.round(x * K);
    const o = qt.open[i] > 0 ? qt.open[i] : close[i], cc = P(close[i]), oo = P(o);
    const hh = Math.max(P(qt.high[i] > 0 ? qt.high[i] : close[i]), oo, cc), ll = Math.min(P(qt.low[i] > 0 ? qt.low[i] : close[i]), oo, cc); // 고가≥시가·종가≥저가로 맞춤
    rows.push([d, cc / K, oo, hh, ll, cc]);
  }
  // 분할·병합 확인: 분할일 전날→당일 종가 비율이 분할 비율(예: 15:1이면 1/15)에 가까우면 미반영으로 봄
  const splits = Object.values((res.events && res.events.splits) || {}).sort((a, b) => a.date - b.date);
  const checks = splits.map((s) => {
    const d = nyDate(s.date), i = rows.findIndex((r) => r[0] >= d);
    const ratio = s.numerator / s.denominator, move = rows[i][1] / rows[i - 1][1];
    const off = (m) => Math.abs(Math.log(m * ratio)) < Math.abs(Math.log(m)) / 2 && Math.abs(Math.log(ratio)) > 0.3;
    const oMove = rows[i][2] / 1e4 / rows[i - 1][1]; // P2-50c 분할일 시가도 전날 종가와 이어지는지
    const unadj = off(move) || off(oMove);
    if (unadj) bad++;
    return `${d} ${s.splitRatio}: ${rows[i - 1][0]} 종가 $${rows[i - 1][1]} → ${rows[i][0]} 시가 $${rows[i][2] / 1e4} 종가 $${rows[i][1]} (${((move - 1) * 100).toFixed(1)}%)${unadj ? " ← 미반영 의심" : ""}`;
  });
  const g = rows.map((r, i) => (i ? dayNum(r[0]) - dayNum(rows[i - 1][0]) : 0)).slice(1);
  const C = rows.map((r) => r[5]);
  const data = { v: 2, t, src: "Yahoo Finance", basis: "분할·병합 반영 시가·고가·저가·종가(배당 미반영), 미국 달러", asOf: rows[rows.length - 1][0], d0: rows[0][0], k: 10000, g,
    c: C.map((x, i) => (i ? x - C[i - 1] : x)), o: rows.map((r) => r[2] - r[5]), h: rows.map((r) => r[3] - Math.max(r[2], r[5])), l: rows.map((r) => Math.min(r[2], r[5]) - r[4]) };
  const file = path.join(OUT, `stock-${t.toLowerCase()}.json`), before = fs.existsSync(file) ? fs.statSync(file).size : 0;
  const json = JSON.stringify(data); fs.writeFileSync(file, json);
  const naive = JSON.stringify(rows.map((r) => ({ d: r[0], o: +(r[2] / 1e4).toPrecision(6), h: +(r[3] / 1e4).toPrecision(6), l: +(r[4] / 1e4).toPrecision(6), c: +(r[5] / 1e4).toPrecision(6) }))).length;
  console.log(`${t}: ${rows[0][0]} ~ ${rows[rows.length - 1][0]}, ${rows.length}건 · 파일 ${before.toLocaleString()} → ${json.length.toLocaleString()}바이트 (단순 OHLC 객체 JSON이면 ${naive.toLocaleString()}바이트)`);
  checks.forEach((c) => console.log("  분할 " + c));
  console.log("  마지막 5일 " + rows.slice(-5).map((r) => `${r[0]} ${r[1]}`).join(" · "));
}
if (bad) { console.error(`분할 미반영 의심 ${bad}건 — 데이터를 쓰지 마세요`); process.exit(1); }
