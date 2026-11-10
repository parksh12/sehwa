// P2-63a 공통: 키 확인, 호출(재시도·일일 한도), 응답 해석(XML/JSON), 캐시 경로
// 키는 환경변수로만 읽는다. 키가 들어간 주소는 화면·파일·오류 메시지에 남기지 않는다(redact).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CACHE = path.join(HERE, ".cache");
export const DATA = path.join(HERE, "data");
export const OUT = path.join(HERE, "out");
export const todayKST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
export const thisMonthKST = () => todayKST().slice(0, 7);

const GUIDE = {
  DATA_GO_KR_KEY: "공공데이터포털(data.go.kr) 일반 인증키(Decoding). 활용 신청: 국토교통부_아파트 매매 실거래가 상세 자료 / 국토교통부_공동주택 단지 목록제공 서비스 / 국토교통부_공동주택 기본 정보제공 서비스",
  JUSO_KEY: "도로명주소 개발자센터(business.juso.go.kr) 「도로명주소 검색 API」 승인키",
  JUSO_COORD_KEY: "도로명주소 개발자센터(business.juso.go.kr) 「좌표제공 API」 승인키 (검색 API 키로는 동작하지 않음)",
  KAKAO_REST_KEY: "카카오 디벨로퍼스(developers.kakao.com) 앱의 「REST API 키」(로컬 API 주소 검색). 저장소 밖 C:/Users/user/.sehwa/aptmap.env 에 KAKAO_REST_KEY=값 으로 넣고 node --env-file=... 로 실행",
};
// 필요한 키가 없으면 무엇을 받아야 하는지 알려 주고 끝낸다(종료 코드 2).
export function requireKeys(names, what) {
  const miss = names.filter((n) => !String(process.env[n] || "").trim());
  if (miss.length) {
    console.log(`[${what}] 아직 실행할 수 없습니다. 아래 환경변수가 비어 있습니다.\n`);
    for (const n of miss) console.log(`  - ${n}: ${GUIDE[n] || ""}`);
    console.log(`\n키를 받은 뒤 이렇게 실행하세요(키는 파일에 저장하지 말고 그때그때 환경변수로 넣습니다).`);
    console.log(`  PowerShell:  $env:${miss[0]}="발급받은키"; node ${path.relative(process.cwd(), process.argv[1]) || process.argv[1]}`);
    console.log(`  GitHub Actions: 저장소 Settings → Secrets 에 같은 이름으로 등록\n`);
    process.exit(2);
  }
  return Object.fromEntries(names.map((n) => [n, String(process.env[n]).trim()]));
}

// 공공데이터포털 키: Decoding 키면 인코딩하고, 이미 Encoding 키(%xx 포함)면 그대로 쓴다.
export const encKey = (k) => (/%[0-9A-Fa-f]{2}/.test(k) ? k : encodeURIComponent(k));
export const redact = (s) => String(s).replace(/(serviceKey|confmKey)=[^&\s"]*/gi, "$1=***").replace(/KakaoAK\s+[^\s"',]+/g, "KakaoAK ***");

// ───────── 일일 호출 한도(서비스별) ─────────
// 개발계정 한도(공공데이터포털 상세 페이지, 2026-11-10 확인): 실거래 10,000 / 단지목록 5,000 / 기본정보 5,000. 여유를 두고 멈춘다.
// kakaoAddr: 카카오 로컬 주소 검색의 무료 일일 한도는 (미확인). 대상이 수천 곳이라 9,000회에서 멈춘다(가정, APTMAP_BUDGET_kakaoAddr 로 조정)
export const BUDGET = { trade: 9500, kaptList: 4800, kaptBasic: 4800, jusoSearch: 9000, jusoCoord: 9000, kakaoAddr: 9000 };
// 호출 집계는 서비스별 파일(calls-날짜.서비스.json)에 둔다. 2026-11-10: 두 수집(기본정보 느린 수집·카카오 좌표)을 동시에 돌리다
// 하나뿐인 calls-날짜.json 을 서로 덮어써 집계가 0부터 다시 시작된 일이 있었다(카카오 상한 9,000 판단이 틀어짐).
// - 서비스마다 파일이 달라 프로세스끼리 같은 파일을 쓰지 않는다
// - 임시 파일에 쓴 뒤 이름을 바꿔(원자적 교체) 반쯤 쓴 파일을 읽지 않는다
// - 파일이 깨져 읽히지 않으면 0으로 되돌리지 않고 멈춘다
// - 예전 합본 파일(calls-날짜.json)의 값이 더 크면 그 값부터 센다(같은 날 이어 실행)
const budgetDir = () => CACHE;
const legacyFile = (d = todayKST()) => path.join(budgetDir(), `calls-${d}.json`);
const serviceFile = (service, d = todayKST()) => path.join(budgetDir(), `calls-${d}.${service}.json`);
function readCount(file) {
  if (!fs.existsSync(file)) return null;
  for (let i = 0; i < 5; i++) {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { const t = Date.now() + 50; while (Date.now() < t); }
  }
  throw new Error(`호출 집계 파일을 읽을 수 없습니다(${path.basename(file)}). 집계를 0으로 되돌리지 않으려고 멈춥니다. 파일을 확인하세요.`);
}
export function callsToday(service, d = todayKST()) {
  const s = readCount(serviceFile(service, d));
  let legacy = 0; try { legacy = +((JSON.parse(fs.readFileSync(legacyFile(d), "utf8")) || {})[service] || 0); } catch { /* 예전 파일은 참고용 */ }
  return Math.max(s ? +s.count || 0 : 0, legacy);
}
export class BudgetExceeded extends Error {}
export function spend(service) {
  const used = callsToday(service);
  const limit = +(process.env["APTMAP_BUDGET_" + service] || BUDGET[service] || Infinity);
  if (used >= limit) throw new BudgetExceeded(`${service} 오늘 호출 ${used}회 → 한도(${limit}) 도달. 내일 다시 실행하면 캐시에 이어서 받습니다.`);
  fs.mkdirSync(budgetDir(), { recursive: true });
  const f = serviceFile(service), tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ service, date: todayKST(), count: used + 1 }));
  fs.renameSync(tmp, f);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// headers: 카카오처럼 키를 헤더로 보내는 API용. 헤더 값은 화면·파일·오류 메시지 어디에도 내보내지 않는다
export async function getText(url, service, { tries = 3, headers = {} } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    spend(service);
    try {
      const r = await fetch(url, { headers: { Accept: "application/json, application/xml;q=0.9, */*;q=0.8", ...headers }, signal: AbortSignal.timeout(30000) });
      const text = await r.text();
      if (r.status === 401 || r.status === 403) throw new Error(`인증 거부(HTTP ${r.status}). 키가 맞는지, 이 서비스를 활용 신청했는지 확인하세요. 신청 직후에는 1~2시간 걸릴 수 있습니다.`);
      if (r.status === 429) throw new Error("일일 호출 한도 초과(HTTP 429)");
      // 4xx(400 등)는 요청 자체가 잘못된 것이라 다시 시도하지 않는다(429는 위에서 처리)
      if (r.status >= 400 && r.status < 500) throw new Error(`요청 오류(HTTP ${r.status}): ${redact(url).slice(0, 160)}`);
      if (!r.ok) { last = new Error(`HTTP ${r.status}`); await sleep(1500 * (i + 1)); continue; }
      return text;
    } catch (e) {
      if (/인증 거부|한도 초과|요청 오류|호출 집계 파일/.test(e.message)) throw e;
      last = e; await sleep(1500 * (i + 1));
    }
  }
  throw new Error(`호출 실패: ${redact(url)} (${redact(last && last.message)})`);
}

// ───────── 응답 해석 ─────────
const unesc = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
function xmlFlat(xml) { const o = {}; for (const m of xml.matchAll(/<([A-Za-z_][\w]*)>([\s\S]*?)<\/\1>/g)) if (!/<[A-Za-z_]/.test(m[2])) o[m[1]] = unesc(m[2]).trim(); return o; }
// data.go.kr 표준 응답(XML 또는 JSON)을 { code, msg, total, items:[{...}] } 로 바꾼다.
export function parseApi(text) {
  const t = String(text).trim();
  if (t.startsWith("{")) {
    const j = JSON.parse(t);
    // 게이트웨이 오류가 JSON 모양으로 올 때(2026-11-10 기본정보 V5에서 확인): { OpenAPI_ServiceResponse: { cmmMsgHeader: { errMsg, returnAuthMsg, returnReasonCode } } }
    if (j.OpenAPI_ServiceResponse) {
      const m = j.OpenAPI_ServiceResponse.cmmMsgHeader || {};
      const rc = String(m.returnReasonCode ?? "");
      return { code: "GW", msg: [m.errMsg, m.returnAuthMsg, rc && `returnReasonCode ${rc}`].filter(Boolean).join(", "), reason: rc, total: 0, items: [] };
    }
    const res = j.response || j;
    const h = res.header || {}, b = res.body || {};
    // 목록형은 body.items(.item), K-apt 기본정보 V5처럼 단건형은 body.item 에 담긴다(P2-63a-2에서 발견: items만 읽어 빈 레코드가 캐시됨)
    let items = b.items ?? b.item;
    if (items && !Array.isArray(items) && "item" in items) items = items.item ?? [];
    if (items && !Array.isArray(items)) items = [items];
    return { code: String(h.resultCode ?? ""), msg: String(h.resultMsg ?? ""), total: +(b.totalCount ?? 0), items: items || [] };
  }
  if (t.startsWith("<")) {
    // 게이트웨이 오류(OpenAPI_ServiceResponse): HTTP 200이어도 오류다. 예: K-apt 기본정보 V5에 _type=json → HTTP_ERROR, returnReasonCode 04
    const gw = t.match(/<returnAuthMsg>([^<]*)<\/returnAuthMsg>/);
    if (gw || /<OpenAPI_ServiceResponse/.test(t)) {
      const rc = (t.match(/<returnReasonCode>([^<]*)<\/returnReasonCode>/) || [, ""])[1];
      const em = (t.match(/<errMsg>([^<]*)<\/errMsg>/) || [, ""])[1];
      return { code: "GW", msg: [em, gw && gw[1], rc && `returnReasonCode ${rc}`].filter(Boolean).join(", "), reason: rc, total: 0, items: [] };
    }
    const code = (t.match(/<resultCode>([^<]*)<\/resultCode>/) || [, ""])[1];
    const msg = (t.match(/<resultMsg>([^<]*)<\/resultMsg>/) || [, ""])[1];
    const total = +((t.match(/<totalCount>([^<]*)<\/totalCount>/) || [, 0])[1]);
    const items = [...t.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => xmlFlat(m[1]));
    return { code, msg, total, items };
  }
  return { code: "TEXT", msg: t.slice(0, 120), total: 0, items: [] };
}
export const okCode = (c) => /^0+$/.test(c); // "00", "000" 모두 정상

export function readJson(p, fallback) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; } }
export function writeJson(p, v) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v)); }
export function arg(name, def) { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : def; }
export const flag = (name) => process.argv.includes("--" + name);
// 지난달(KST) "YYYY-MM": 실거래는 계약 후 30일 안에 신고되므로 기본 반영 범위는 지난달까지
export function lastMonthKST() { const [y, m] = thisMonthKST().split("-").map(Number); const t = y * 12 + m - 2; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; }
