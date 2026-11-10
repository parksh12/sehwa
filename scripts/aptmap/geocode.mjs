// P2-63a ④ 단지 주소 → 좌표
// 기본(P2-63a-2, 대표님 결정): 카카오 로컬 API 주소 검색 (KAKAO_REST_KEY 필요, 헤더 Authorization: KakaoAK {키})
//   - K-apt 도로명주소 → (실패 시) 법정동주소 순으로 카카오 주소 검색. 카카오는 WGS84(x=경도, y=위도)를 바로 주므로 UTM-K 변환을 거치지 않는다.
//   - 둘 다 실패하면 도로명주소 검색 API(JUSO_KEY, 있으면)로 주소를 정규화(roadAddrPart1·jibunAddr)한 뒤 카카오로 다시 검색한다.
// 예전 경로(--via juso): 도로명주소 검색 API → 좌표제공 API(UTM-K, JUSO_COORD_KEY) → WGS84. 좌표제공 키 승인이 늦어 지금은 쓰지 않는다.
// 대상: 세대수·가격 조건을 통과했는데 좌표가 아직 없는 단지만(make-data의 assemble이 고른다). 결과는 캐시하고 새 단지만 호출한다.
// 사용: node --env-file=C:/Users/user/.sehwa/aptmap.env scripts/aptmap/geocode.mjs [--retry-fail] [--via juso]
//   --retry-fail: 지난번 실패로 캐시된 단지도 다시 시도
// 결과: .cache/geo-jibun.json, .cache/geo-doro.json { kaptCode: { lat, lng, addr, query, src } | { fail, query } } (예전 .cache/geo.json 은 --via juso 용으로만 남음)
// 종료 코드: 0 완료 / 3 카카오 하루 한도(9,000)에서 멈춤 → 다음 날 같은 명령으로 이어 받기
import fs from "node:fs";
import path from "node:path";
import { requireKeys, getText, readJson, writeJson, CACHE, BudgetExceeded, redact, lastMonthKST, arg, flag } from "./net.mjs";
import { utmkToWgs84, cleanAddr, pickKakao } from "./logic.mjs";
import { assemble, loadInputs, SEEDS } from "./make-data.mjs";

const KAKAO = "https://dapi.kakao.com/v2/local/search/address.json";
const SEARCH = "https://business.juso.go.kr/addrlink/addrLinkApi.do";
const COORD = "https://business.juso.go.kr/addrlink/addrCoordApi.do";
const GEO = path.join(CACHE, "geo.json");

async function juso(url, service) {
  const j = JSON.parse(await getText(url, service));
  const c = j.results && j.results.common;
  if (!c) throw new Error("주소 API 응답 형식이 바뀜");
  if (c.errorCode !== "0") return { err: `${c.errorCode} ${c.errorMessage}`, juso: [] };
  return { juso: j.results.juso || [] };
}
const jusoSearchUrl = (key, addr) => `${SEARCH}?confmKey=${encodeURIComponent(key)}&currentPage=1&countPerPage=5&keyword=${encodeURIComponent(addr)}&resultType=json`;

// 공통: 입력을 읽고 좌표가 필요한 단지 목록을 만든다
function prepare() {
  const meta = readJson(path.join(CACHE, "trades-meta.json"), {});
  const inp = loadInputs(meta.through || lastMonthKST());
  if (!inp.stations || !inp.kaptList || !inp.tradeItems.length) { console.log("먼저 stations.mjs, fetch-kapt.mjs list, fetch-trades.mjs, fetch-kapt.mjs basic 을 실행하세요."); process.exit(2); }
  const geo = inp.geo;
  const { needGeo } = assemble(inp);
  const retry = flag("retry-fail");
  const todo = needGeo.filter((n) => !geo[n.kaptCode] || (retry && geo[n.kaptCode].fail));
  console.log(`좌표가 필요한 단지 ${todo.length}곳 (캐시 ${Object.keys(geo).length}곳)`);
  return { geo, todo };
}

// 기본: 카카오 로컬 주소 검색 (COO 6차 결정: 지번 주소 1순위 → 실패하면 도로명 → 둘 다 실패하면 도로명주소 검색으로 정규화해 다시)
// 캐시는 주소 종류별로 따로 둔다: .cache/geo-jibun.json, .cache/geo-doro.json (하루 한도에서 멈추면 다음 날 같은 명령으로 이어 받기)
// 대상: 300세대·9억 통과 단지 전체(assemble.geoTargets). 시드 단지를 먼저 받는다.
export const GEO_JIBUN = path.join(CACHE, "geo-jibun.json");
export const GEO_DORO = path.join(CACHE, "geo-doro.json");
async function viaKakao() {
  const { KAKAO_REST_KEY } = requireKeys(["KAKAO_REST_KEY"], "좌표 변환(카카오 로컬 API)");
  const JUSO_KEY = String(process.env.JUSO_KEY || "").trim(); // 선택: 주소 정규화용
  let jusoOff = !JUSO_KEY;
  if (jusoOff) console.log("JUSO_KEY가 없어 카카오 검색 실패 시 도로명주소 보정은 하지 않습니다.");
  const headers = { Authorization: `KakaoAK ${KAKAO_REST_KEY}` };
  // 주소가 잘못돼 카카오가 400을 주면 그 단지만 실패로 두고 계속한다(2026-11-10: 쉼표로 이어진 여러 지번 주소에서 400)
  const kakao = async (q) => { try { return pickKakao(JSON.parse(await getText(`${KAKAO}?query=${encodeURIComponent(q)}&size=5`, "kakaoAddr", { headers }))); } catch (e) { if (/요청 오류(HTTP 400)/.test(e.message)) return null; throw e; } };
  // 예전 geo.json(도로명 우선으로 받은 것)은 버리지 않고 도로명 캐시로 옮긴다(비교용)
  if (!fs.existsSync(GEO_DORO) && fs.existsSync(GEO)) { const old = readJson(GEO, {}); for (const v of Object.values(old)) if (v && !v.src) v.src = "kakao"; writeJson(GEO_DORO, old); console.log(`예전 좌표 ${Object.keys(old).length}곳을 도로명 캐시(geo-doro.json)로 옮겼습니다(geo.json 원본은 그대로).`); }
  const gj = readJson(GEO_JIBUN, {}), gd = readJson(GEO_DORO, {});
  const meta = readJson(path.join(CACHE, "trades-meta.json"), {});
  const inp = loadInputs(meta.through || lastMonthKST());
  if (!inp.stations || !inp.kaptList || !inp.tradeItems.length) { console.log("먼저 stations.mjs, fetch-kapt.mjs list, fetch-trades.mjs, kapt-file.mjs 를 실행하세요."); process.exit(2); }
  const { geoTargets } = assemble(inp);
  const seedSeq = new Set(SEEDS.map((s) => s.seq).filter(Boolean));
  const uniq = new Map(); for (const t of geoTargets) if (!uniq.has(t.kaptCode)) uniq.set(t.kaptCode, t);
  const retry = flag("retry-fail");
  const need = (t) => !gj[t.kaptCode] || (retry && gj[t.kaptCode].fail && !(gd[t.kaptCode] && gd[t.kaptCode].lat > 0));
  const todo = [...uniq.values()].filter(need).sort((a, b) => (seedSeq.has(b.aptSeq) ? 1 : 0) - (seedSeq.has(a.aptSeq) ? 1 : 0));
  console.log(`좌표 대상 ${uniq.size}곳: 지번 좌표 캐시 ${[...uniq.keys()].filter((c) => gj[c]).length}곳, 새로 받을 곳 ${todo.length}곳 (시드 먼저)`);
  let ok = 0, viaDoro = 0, fixed = 0, fail = 0;
  const save = () => { writeJson(GEO_JIBUN, gj); writeJson(GEO_DORO, gd); };
  try {
    for (const n of todo) {
      const jq = cleanAddr(n.kaptAddr), dq = cleanAddr(n.doroJuso);
      // ① 지번(법정동+지번)
      let hit = jq ? await kakao(jq) : null;
      if (hit) { gj[n.kaptCode] = { ...hit, query: jq, src: "kakao" }; ok++; }
      else {
        gj[n.kaptCode] = { fail: jq ? "카카오 지번 주소 검색 결과 없음" : "지번 주소 없음", query: jq };
        // ② 도로명(이미 받은 도로명 좌표가 있으면 다시 부르지 않음)
        if (!(gd[n.kaptCode] && gd[n.kaptCode].lat > 0) && dq) { const h2 = await kakao(dq); gd[n.kaptCode] = h2 ? { ...h2, query: dq, src: "kakao" } : { fail: "카카오 도로명 주소 검색 결과 없음", query: dq }; }
        if (gd[n.kaptCode] && gd[n.kaptCode].lat > 0) viaDoro++;
        else if (!jusoOff) {
          // ③ 도로명주소 검색으로 정규화한 주소로 다시(결과는 지번 캐시에 src kakao+juso로)
          for (const q of [jq, dq].filter(Boolean)) {
            const s = await juso(jusoSearchUrl(JUSO_KEY, q), "jusoSearch");
            if (s.err && /E0001|승인/.test(s.err)) { jusoOff = true; console.log(`\n도로명주소 검색 키 오류(${s.err}) → 이번 실행에서는 주소 보정을 생략합니다.`); break; }
            const a = s.juso[0]; if (!a) continue;
            for (const q2 of [a.jibunAddr, a.roadAddrPart1].filter(Boolean)) { if ((hit = await kakao(q2))) break; }
            if (hit) { gj[n.kaptCode] = { ...hit, query: a.jibunAddr || q, src: "kakao+juso" }; fixed++; break; }
          }
          if (!hit) fail++;
        } else fail++;
      }
      if ((ok + viaDoro + fixed + fail) % 50 === 0) { save(); process.stdout.write(`\r좌표 지번 ${ok} · 도로명 ${viaDoro} · 보정 ${fixed} · 실패 ${fail} / ${todo.length}`); }
    }
  } catch (e) {
    save();
    if (e instanceof BudgetExceeded) { console.log(`\n${e.message}`); console.log(`남은 단지 ${todo.length - ok - viaDoro - fixed - fail}곳은 내일 같은 명령으로 이어 받습니다.`); process.exit(3); }
    throw e;
  }
  save();
  console.log(`\n좌표 완료: 지번 ${ok}곳, 지번 실패→도로명 ${viaDoro}곳, 도로명주소 보정 후 성공 ${fixed}곳, 실패 ${fail}곳`);
}

// 예전 경로: 도로명주소 검색 → 좌표제공(UTM-K) → WGS84
async function viaJuso() {
  const { JUSO_KEY, JUSO_COORD_KEY } = requireKeys(["JUSO_KEY", "JUSO_COORD_KEY"], "좌표 변환(도로명주소)");
  const { geo, todo } = prepare();
  let ok = 0, fail = 0;
  try {
    for (const n of todo) {
      const addr = (n.doroJuso || n.kaptAddr || "").trim();
      if (!addr) { geo[n.kaptCode] = { fail: "주소 없음" }; fail++; continue; }
      const s = await juso(jusoSearchUrl(JUSO_KEY, addr), "jusoSearch");
      if (s.err && /E0001|승인/.test(s.err)) throw new Error(`검색 API 키 오류: ${s.err}`);
      const a = s.juso[0];
      if (!a) { geo[n.kaptCode] = { fail: `주소 검색 결과 없음${s.err ? " (" + s.err + ")" : ""}`, addr }; fail++; continue; }
      const q = `admCd=${a.admCd}&rnMgtSn=${a.rnMgtSn}&udrtYn=${a.udrtYn}&buldMnnm=${a.buldMnnm}&buldSlno=${a.buldSlno}`;
      const c = await juso(`${COORD}?confmKey=${encodeURIComponent(JUSO_COORD_KEY)}&${q}&resultType=json`, "jusoCoord");
      if (c.err && /E0001|승인/.test(c.err)) throw new Error(`좌표제공 API 키 오류: ${c.err}`);
      const p = c.juso[0];
      if (!p || !p.entX) { geo[n.kaptCode] = { fail: `좌표 없음${c.err ? " (" + c.err + ")" : ""}`, addr }; fail++; continue; }
      const w = utmkToWgs84(+p.entX, +p.entY);
      if (!(w.lat > 33 && w.lat < 39 && w.lng > 124 && w.lng < 132)) { geo[n.kaptCode] = { fail: `좌표 범위 밖 ${p.entX},${p.entY}`, addr }; fail++; continue; }
      geo[n.kaptCode] = { lat: +w.lat.toFixed(6), lng: +w.lng.toFixed(6), x: +p.entX, y: +p.entY, addr: a.roadAddr || addr, src: "juso" };
      if (++ok % 50 === 0) { writeJson(GEO, geo); process.stdout.write(`\r좌표 ${ok}/${todo.length}`); }
    }
  } catch (e) {
    writeJson(GEO, geo);
    if (e instanceof BudgetExceeded) { console.log(`\n${e.message}`); return; }
    throw e;
  }
  writeJson(GEO, geo);
  console.log(`\n좌표 성공 ${ok}곳, 실패 ${fail}곳 (실패 사유는 .cache/geo.json)`);
}

const via = arg("via", "kakao");
if (!["kakao", "juso"].includes(via)) { console.log("사용: node scripts/aptmap/geocode.mjs [--via kakao|juso] [--retry-fail]"); process.exit(1); }
(via === "juso" ? viaJuso : viaKakao)().catch((e) => { console.error("\n" + redact(e.message)); process.exit(1); });
