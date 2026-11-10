// P2-63a-2 시드 단지 역 거리 확인 (COO 승인, 기본정보 API 장애 중 임시 검수용)
// 실거래 자료의 법정동 + 지번 주소로 카카오 주소 검색 → WGS84 좌표 → make-data 보고서의 시드 표에 「가장 가까운 역·거리·배지」로 표시
// 사용: node --env-file=C:/Users/user/.sehwa/aptmap.env scripts/aptmap/seed-geo.mjs   (KAKAO_REST_KEY 필요, 시드 수만큼만 호출, 캐시 있으면 건너뜀)
// 결과: .cache/seed-geo.json { aptSeq: { lat, lng, addr, query } | { fail, query } }
// 주의: 지도용 좌표는 geocode.mjs(K-apt 주소 기준)로 따로 만든다. 이 파일은 시드 대조에만 쓴다.
import fs from "node:fs";
import path from "node:path";
import { requireKeys, getText, readJson, writeJson, CACHE, redact, BudgetExceeded } from "./net.mjs";
import { parseTrade, normJibun, pickKakao } from "./logic.mjs";
import { SEEDS } from "./make-data.mjs";

const KAKAO = "https://dapi.kakao.com/v2/local/search/address.json";
const OUTF = path.join(CACHE, "seed-geo.json");

async function main() {
  const { KAKAO_REST_KEY } = requireKeys(["KAKAO_REST_KEY"], "시드 좌표(카카오 로컬 API)");
  const seeds = SEEDS.filter((s) => s.seq);
  const want = new Set(seeds.map((s) => s.seq));
  const cache = readJson(OUTF, {});
  const todo = [...want].filter((q) => !cache[q] || cache[q].fail);
  if (!todo.length) { console.log("시드 좌표: 모두 캐시에 있음"); return; }
  // 실거래 캐시에서 시드 단지의 법정동코드·지번 찾기 (aptSeq 앞 5자리 = 시군구 파일)
  const info = {};
  const dir = path.join(CACHE, "trades");
  const prefixes = new Set(todo.map((q) => q.split("-")[0]));
  for (const f of fs.readdirSync(dir)) {
    if (!prefixes.has(f.slice(0, 5))) continue;
    for (const it of readJson(path.join(dir, f), [])) if (want.has(it.aptSeq) && !info[it.aptSeq]) { const t = parseTrade(it); info[t.aptSeq] = { bjdCode: t.bjdCode, dong: t.dong, jibun: normJibun(t.jibun) }; }
  }
  // 법정동코드 → 시도·시군구·읍면동·리 이름(K-apt 목록)
  const names = new Map();
  for (const k of readJson(path.join(CACHE, "kapt-list.json"), [])) if (!names.has(k.bjdCode)) names.set(k.bjdCode, [k.as1, k.as2, k.as3, k.as4].filter(Boolean).join(" "));
  const headers = { Authorization: `KakaoAK ${KAKAO_REST_KEY}` };
  try {
    for (const q of todo) {
      const i = info[q];
      if (!i || !i.jibun) { cache[q] = { fail: "실거래에서 지번을 찾지 못함" }; continue; }
      const query = `${names.get(i.bjdCode) || i.dong} ${i.jibun}`;
      await new Promise((r) => setTimeout(r, 250));
      const hit = pickKakao(JSON.parse(await getText(`${KAKAO}?query=${encodeURIComponent(query)}&size=5`, "kakaoAddr", { headers, tries: 1 })));
      cache[q] = hit ? { ...hit, query } : { fail: "카카오 주소 검색 결과 없음", query };
      console.log(`${q} ${query} → ${hit ? `${hit.lat}, ${hit.lng}` : "실패"}`);
    }
  } catch (e) {
    writeJson(OUTF, cache);
    if (e instanceof BudgetExceeded) { console.log(e.message); return; }
    throw e;
  }
  writeJson(OUTF, cache);
}
main().catch((e) => { console.error(redact(e.message)); process.exit(1); });
