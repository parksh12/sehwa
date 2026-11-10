// P2-63a ② 아파트 매매 실거래가 상세 수집 (DATA_GO_KR_KEY 필요)
// 사용: node scripts/aptmap/fetch-trades.mjs                     지난달까지 12개월, 전국 시군구(K-apt 목록에서 뽑음)
//       node scripts/aptmap/fetch-trades.mjs --through 2026-10 --sgg 41410,41117   (시험용: 특정 시군구만)
// 갱신 규칙(요청서 4-2 ①): 최근 3개월은 매번 다시 받는다(늦은 신고·해제 반영). 그보다 오래된 달은 캐시가 있으면 건너뛴다.
// 출처: data.go.kr 15126468 국토교통부_아파트 매매 실거래가 상세 자료 (RTMSDataSvcAptTradeDev)
// 결과: .cache/trades/{시군구5}_{YYYYMM}.json  (응답 item 원본 배열)
import fs from "node:fs";
import path from "node:path";
import { requireKeys, encKey, getText, parseApi, okCode, readJson, writeJson, CACHE, arg, lastMonthKST, BudgetExceeded, redact } from "./net.mjs";
import { monthsBack, RULES } from "./logic.mjs";

const URL_ = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";
const DIR = path.join(CACHE, "trades");

function sggList() {
  const s = arg("sgg");
  if (s) return s.split(",").map((x) => x.trim()).filter(Boolean);
  const list = readJson(path.join(CACHE, "kapt-list.json"), null);
  if (!list) { console.log("시군구 목록을 만들 K-apt 단지 목록이 없습니다. 먼저 `fetch-kapt.mjs list`를 실행하거나 --sgg 로 지정하세요."); process.exit(2); }
  return [...new Set(list.map((k) => String(k.bjdCode).slice(0, 5)).filter((c) => /^\d{5}$/.test(c)))].sort();
}

async function main() {
  const { DATA_GO_KR_KEY: key } = requireKeys(["DATA_GO_KR_KEY"], "실거래 수집");
  const through = arg("through", lastMonthKST());
  if (!/^\d{4}-\d{2}$/.test(through)) throw new Error("--through 는 YYYY-MM 형식");
  const months = Array.from({ length: RULES.monthsWide }, (_, i) => monthsBack(through, i));
  const fresh = new Set(months.slice(0, 3)); // 최근 3개월은 다시 받기
  const sggs = sggList();
  console.log(`시군구 ${sggs.length}곳 × ${months.length}개월 (${months.at(-1)} ~ ${through}), 최근 3개월은 다시 받음`);
  fs.mkdirSync(DIR, { recursive: true });
  let calls = 0, skipped = 0, rows = 0;
  try {
    for (const sgg of sggs) for (const ym of months) {
      const file = path.join(DIR, `${sgg}_${ym.replace("-", "")}.json`);
      if (!fresh.has(ym) && fs.existsSync(file)) { skipped++; continue; }
      const items = [];
      for (let page = 1; ; page++) {
        const r = parseApi(await getText(`${URL_}?serviceKey=${encKey(key)}&LAWD_CD=${sgg}&DEAL_YMD=${ym.replace("-", "")}&pageNo=${page}&numOfRows=1000`, "trade"));
        calls++;
        if (!okCode(r.code)) throw new Error(`실거래 오류(${sgg} ${ym}): ${r.code} ${r.msg}`);
        items.push(...r.items);
        if (!r.items.length || items.length >= r.total) break;
      }
      writeJson(file, items);
      rows += items.length;
      process.stdout.write(`\r호출 ${calls}, 건너뜀 ${skipped}, 거래 ${rows}  (${sgg} ${ym})   `);
    }
  } catch (e) {
    if (e instanceof BudgetExceeded) { console.log(`\n${e.message}`); return; }
    throw e;
  }
  console.log(`\n완료: 호출 ${calls}회, 캐시 사용 ${skipped}건, 새로 받은 거래 ${rows}건. 반영 범위 ${through} 계약분까지`);
  writeJson(path.join(CACHE, "trades-meta.json"), { through, fetched: new Date().toISOString(), sggCount: sggs.length });
}
main().catch((e) => { console.error("\n" + redact(e.message)); process.exit(1); });
