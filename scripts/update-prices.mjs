// P2-50 SOXL·TQQQ·KORU 일봉 종가 갱신 (수동 실행): node scripts/update-prices.mjs
// 출처: Yahoo Finance 차트 응답(키·계정 없이 받는 공개 주소). close = 분할·병합 반영 종가(배당 미반영). adjclose(배당 반영)는 쓰지 않음.
// 결과: src/assets/data/stock-<티커>.json  { t, src, basis, asOf, d0, g:[날짜 간격(일)], c:[종가] }
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
  const ts = res.timestamp, close = res.indicators.quote[0].close;
  const rows = [];
  for (let i = 0; i < ts.length; i++) {
    const d = nyDate(ts[i]);
    if (close[i] == null || !(close[i] > 0)) continue; // 거래 없는 날(빈 값)은 뺌
    if (d === now.d && now.hm < "16:30") continue; // 장중 미확정 봉은 뺌
    if (rows.length && rows[rows.length - 1][0] >= d) throw new Error(`${t}: 날짜 순서 이상 ${d}`);
    rows.push([d, Number(close[i].toPrecision(6))]);
  }
  // 분할·병합 확인: 분할일 전날→당일 종가 비율이 분할 비율(예: 15:1이면 1/15)에 가까우면 미반영으로 봄
  const splits = Object.values((res.events && res.events.splits) || {}).sort((a, b) => a.date - b.date);
  const checks = splits.map((s) => {
    const d = nyDate(s.date), i = rows.findIndex((r) => r[0] >= d);
    const ratio = s.numerator / s.denominator, move = rows[i][1] / rows[i - 1][1];
    const unadj = Math.abs(Math.log(move * ratio)) < Math.abs(Math.log(move)) / 2 && Math.abs(Math.log(ratio)) > 0.3;
    if (unadj) bad++;
    return `${d} ${s.splitRatio}: ${rows[i - 1][0]} $${rows[i - 1][1]} → ${rows[i][0]} $${rows[i][1]} (${((move - 1) * 100).toFixed(1)}%)${unadj ? " ← 미반영 의심" : ""}`;
  });
  const g = rows.map((r, i) => (i ? dayNum(r[0]) - dayNum(rows[i - 1][0]) : 0)).slice(1);
  const data = { t, src: "Yahoo Finance", basis: "분할·병합 반영 종가(배당 미반영), 미국 달러", asOf: rows[rows.length - 1][0], d0: rows[0][0], g, c: rows.map((r) => r[1]) };
  fs.writeFileSync(path.join(OUT, `stock-${t.toLowerCase()}.json`), JSON.stringify(data));
  console.log(`${t}: ${rows[0][0]} ~ ${rows[rows.length - 1][0]}, ${rows.length}건`);
  checks.forEach((c) => console.log("  분할 " + c));
  console.log("  마지막 5일 " + rows.slice(-5).map((r) => `${r[0]} ${r[1]}`).join(" · "));
}
if (bad) { console.error(`분할 미반영 의심 ${bad}건 — 데이터를 쓰지 마세요`); process.exit(1); }
