// P2-63a ① K-apt 단지 목록 / ③ 단지 기본정보 수집 (DATA_GO_KR_KEY 필요)
// 사용: node scripts/aptmap/fetch-kapt.mjs list            전국 단지 목록(getTotalAptList4). 25일 안에 받은 목록이 있으면 건너뜀(--refresh로 강제)
//       node scripts/aptmap/fetch-kapt.mjs basic           기본정보(getAphusBassInfoV5). 대표가격 9억 미만 실거래 단지가 있는 법정동의 단지만(이름 비슷한 단지 먼저), 캐시에 없는 것만
//       node scripts/aptmap/fetch-kapt.mjs basic --all     목록의 모든 단지(개발계정 5,000회/일이라 여러 날 걸림)
//       node scripts/aptmap/fetch-kapt.mjs basic --slow    느린 수집(2초 간격, 04·429·504면 10분 쉬고 이어 받기, 연속 6번이면 종료, 하루 4,500회). 종료 코드 0/3/4/1
//                                                          진행: .cache/basic-progress.json, 콘솔 30분마다 한 줄 (slow.mjs)
// 출처: data.go.kr 15057332(공동주택 단지 목록제공 서비스), 15058453(공동주택 기본 정보제공 서비스)
// 결과: .cache/kapt-list.json  [{ kaptCode, kaptName, bjdCode, as1, as2, as3, as4 }]
//       .cache/kapt-basic.json { kaptCode: { kaptName, kaptAddr, doroJuso, kaptdaCnt, kaptUsedate, bjdCode } }
import fs from "node:fs";
import path from "node:path";
import { requireKeys, encKey, getText, parseApi, okCode, readJson, writeJson, CACHE, flag, BudgetExceeded, redact, todayKST, callsToday } from "./net.mjs";
import { parseTrade, usable, representativePrice, nameKeys, RULES } from "./logic.mjs";
import { runSlow, SLOW, EXIT } from "./slow.mjs";

const LIST_URL = "https://apis.data.go.kr/1613000/AptListService4/getTotalAptList4";
const BASIC_URL = "https://apis.data.go.kr/1613000/AptBasisInfoServiceV5/getAphusBassInfoV5";
const LIST = path.join(CACHE, "kapt-list.json");
const BASIC = path.join(CACHE, "kapt-basic.json");

async function list(key) {
  if (fs.existsSync(LIST) && !flag("refresh") && Date.now() - fs.statSync(LIST).mtimeMs < 25 * 864e5) { console.log("단지 목록: 25일 안에 받은 캐시 사용"); return; }
  const out = [];
  for (let page = 1; ; page++) {
    const r = parseApi(await getText(`${LIST_URL}?serviceKey=${encKey(key)}&pageNo=${page}&numOfRows=1000&_type=json`, "kaptList"));
    if (!okCode(r.code)) throw new Error(`단지 목록 오류: ${r.code} ${r.msg}`);
    for (const it of r.items) out.push({ kaptCode: it.kaptCode, kaptName: it.kaptName, bjdCode: String(it.bjdCode || ""), as1: it.as1, as2: it.as2, as3: it.as3, as4: it.as4 || "" });
    process.stdout.write(`\r단지 목록 ${out.length}/${r.total}`);
    if (!r.items.length || out.length >= r.total) break;
  }
  console.log("");
  writeJson(LIST, out);
}

// 실거래 캐시에서 「전용 40~60㎡ 중개 매매」 대표가격이 9억 미만인 단지가 있는 법정동코드 모음 (P2-63a-2: 호출 절약)
// 9억 이상 단지만 있는 동은 K-apt 정보가 있어도 지도에 오르지 않으므로 받지 않는다. --all-price 로 끌 수 있다.
// names: 법정동별 실거래 단지명 키(이름이 맞는 K-apt 단지를 먼저 받기 위해)
function candidateDongs() {
  const dir = path.join(CACHE, "trades");
  const set = new Set(), names = new Map();
  if (!fs.existsSync(dir)) return { set, names };
  const through = readJson(path.join(CACHE, "trades-meta.json"), {}).through;
  const groups = new Map();
  for (const f of fs.readdirSync(dir)) for (const it of readJson(path.join(dir, f), [])) {
    const t = parseTrade(it); if (!usable(t) || !t.aptSeq) continue;
    if (!groups.has(t.aptSeq)) groups.set(t.aptSeq, []);
    groups.get(t.aptSeq).push(t);
  }
  for (const ts of groups.values()) {
    const rep = through ? representativePrice(ts, through) : { price: 0 };
    if (!rep || (!flag("all-price") && rep.price >= RULES.priceMaxExcl)) continue;
    const b = ts[0].bjdCode; set.add(b);
    if (!names.has(b)) names.set(b, new Set());
    names.get(b).add(nameKeys(ts[0].name).drop);
  }
  return { set, names };
}

async function basic(key) {
  const all = readJson(LIST, null);
  if (!all) { console.log("먼저 `fetch-kapt.mjs list`를 실행하세요."); process.exit(2); }
  const cache = readJson(BASIC, {});
  // 예전 해석 버그로 저장된 빈 레코드(주소 없음·세대수 0)는 지우고 다시 받는다
  const bad = Object.keys(cache).filter((c) => !cache[c].kaptAddr && !cache[c].doroJuso && !cache[c].kaptdaCnt);
  if (bad.length) { for (const c of bad) delete cache[c]; writeJson(BASIC, cache); console.log(`빈 기본정보 레코드 ${bad.length}곳을 지웠습니다(다시 받음).`); }
  let targets = all;
  if (!flag("all")) {
    const { set: dongs, names } = candidateDongs();
    if (!dongs.size) { console.log("실거래 캐시가 없습니다. 먼저 `fetch-trades.mjs`를 실행하거나 --all 을 붙이세요."); process.exit(2); }
    targets = all.filter((k) => dongs.has(k.bjdCode));
    // 실거래 단지명과 이름이 비슷한(한쪽이 다른 쪽을 포함) K-apt 단지를 먼저 받는다
    const likely = (k) => { const a = nameKeys(k.kaptName).drop; return !!a && [...(names.get(k.bjdCode) || [])].some((b) => b && (a.includes(b) || b.includes(a))); };
    // 순서: ① 시드 단지가 있는 법정동(검수용) ② 이름 비슷한 단지 ③ 나머지
    const SEED_DONGS = new Set(["4111113300", "4111313700", "4111710500", "4119210800", "4119210900", "4141010500", "4141010100", "4141010400", "4146310300"]);
    const rank = (k) => (SEED_DONGS.has(k.bjdCode) ? 0 : likely(k) ? 1 : 2);
    targets = targets.map((k, i) => [rank(k), i, k]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[2]);
  }
  // K-apt 단지 기본정보 파일(kapt-file.json)에 있는 단지는 API로 받지 않는다(파일이 1순위, API는 보완). --ignore-file 로 끔
  const kf = flag("ignore-file") ? null : readJson(path.join(CACHE, "kapt-file.json"), null);
  const inFile = (c) => !!(kf && kf.basic[c] && (kf.basic[c].kaptAddr || kf.basic[c].kaptdaCnt));
  const todo = targets.filter((k) => !cache[k.kaptCode] && !inFile(k.kaptCode));
  console.log(`기본정보 대상 ${targets.length}곳, API 캐시 ${targets.filter((k) => cache[k.kaptCode]).length}곳, 파일(${kf ? kf.asOf : "없음"})로 해결 ${targets.filter((k) => !cache[k.kaptCode] && inFile(k.kaptCode)).length}곳, 새로 받을 곳 ${todo.length}곳`);
  writeJson(path.join(CACHE, "kapt-basic-todo.json"), { at: new Date().toISOString(), targets: targets.length, todo: todo.length });
  if (flag("slow")) return basicSlow(key, todo, cache);
  let n = 0, fail = 0, empty = 0, failRun = 0;
  try {
    for (const k of todo) {
      // _type=json 을 붙이면 기본정보 V5는 HTTP 200 + OpenAPI_ServiceResponse(HTTP_ERROR, 04)를 준다(COO 확인 2026-11-10). 붙이지 않는다
      // 초당 5회 이하(250ms 간격)로 천천히 부른다
      await new Promise((res) => setTimeout(res, 250));
      const r = parseApi(await getText(`${BASIC_URL}?serviceKey=${encKey(key)}&kaptCode=${encodeURIComponent(k.kaptCode)}`, "kaptBasic"));
      if (!okCode(r.code)) {
        fail++;
        // 게이트웨이 오류는 캐시하지 않고 바로 멈춘다(같은 오류로 한도를 태우지 않게)
        if (r.code === "GW") { if (r.reason === "22" || /LIMITED/i.test(r.msg)) throw new BudgetExceeded(`기본정보 한도 응답(${r.msg}). 내일 이어서 받습니다.`); throw new Error(`게이트웨이 오류: ${r.msg}`); }
        if (r.code === "22" || /LIMITED|EXCEED/i.test(r.msg)) throw new BudgetExceeded(`기본정보 서버 한도 응답(${r.code} ${r.msg}). 내일 다시 실행하면 캐시에 이어서 받습니다.`);
        // 알 수 없는 응답(코드 빈칸 등)도 바로 멈춘다(COO 지시: 오류가 나면 즉시 중단. APTMAP_BASIC_FAILRUN 으로 허용 횟수 조정)
        if (++failRun >= +(process.env.APTMAP_BASIC_FAILRUN || 1)) throw new Error(`기본정보 응답 오류(코드 「${r.code}」 ${r.msg}). 호출을 멈춥니다.`);
        continue;
      }
      const it = r.items[0];
      // 빈 응답은 캐시하지 않는다(다음에 다시 받음). 처음부터 계속 비면 응답 해석 문제이므로 한도를 태우지 않게 멈춘다
      if (!it || !(it.kaptAddr || it.doroJuso || +it.kaptdaCnt)) {
        empty++;
        if (empty >= 20 && n === 0) throw new Error("기본정보 응답이 20번 연속 비었습니다. 응답 형식이 바뀌었는지 확인하세요(호출을 멈춤).");
        continue;
      }
      failRun = 0;
      cache[k.kaptCode] = { kaptName: it.kaptName || k.kaptName, kaptAddr: it.kaptAddr || "", doroJuso: it.doroJuso || "", kaptdaCnt: +(it.kaptdaCnt || 0), kaptUsedate: String(it.kaptUsedate || ""), bjdCode: String(it.bjdCode || k.bjdCode) };
      if (++n % 50 === 0) { writeJson(BASIC, cache); process.stdout.write(`\r기본정보 ${n}/${todo.length}`); }
    }
  } catch (e) {
    writeJson(BASIC, cache);
    if (e instanceof BudgetExceeded) { console.log(`\n${e.message}`); return; }
    throw e;
  }
  writeJson(BASIC, cache);
  console.log(`\n기본정보 새로 ${n}곳 저장, 응답 오류 ${fail}곳, 빈 응답 ${empty}곳`);
}

// ───────── 느린 수집 모드 (basic --slow): 오래 돌려도 되는 백오프 설계, COO 4차 지시 ─────────
// 간격 2초, HTTP_ERROR 04·429·504는 10분 쉬고 같은 단지부터 이어 받기, 연속 6번이면 그날 종료, 하루 4,500회 상한
// 진행: .cache/basic-progress.json(매번 갱신) + 콘솔 30분마다 한 줄. 종료 코드 0 전부 받음 / 3 하루 상한 / 4 연속 오류 / 1 그 밖의 오류
// 시험용 조정(환경변수): APTMAP_SLOW_INTERVAL_MS, APTMAP_SLOW_BACKOFF_MS, APTMAP_SLOW_PROGRESS_MS, APTMAP_BUDGET_kaptBasic
async function basicSlow(key, todo, cache) {
  if (!process.env.APTMAP_BUDGET_kaptBasic) process.env.APTMAP_BUDGET_kaptBasic = String(SLOW.dailyCap);
  const PROGRESS = path.join(CACHE, "basic-progress.json");
  const env = (n, d) => (process.env[n] ? +process.env[n] : d);
  // 단지 1곳 받기: 레코드 / null(자료 없음·빈 응답 → 건너뜀) / throw(분류는 slow.mjs classify)
  const fetchOne = async (k) => {
    const r = parseApi(await getText(`${BASIC_URL}?serviceKey=${encKey(key)}&kaptCode=${encodeURIComponent(k.kaptCode)}`, "kaptBasic", { tries: 1 }));
    if (r.code === "GW") throw new Error(`게이트웨이 오류: ${r.msg}`);
    if (r.code === "22" || /LIMITED/i.test(r.msg)) throw new Error(`LIMITED_NUMBER 기본정보 한도 응답(${r.code} ${r.msg})`);
    if (r.code === "03" || /NO.?DATA/i.test(r.msg)) return null;
    if (!okCode(r.code)) throw new Error(`기본정보 응답 오류(코드 「${r.code}」 ${r.msg})`);
    const it = r.items[0];
    if (!it || !(it.kaptAddr || it.doroJuso || +it.kaptdaCnt)) return null;
    return { kaptName: it.kaptName || k.kaptName, kaptAddr: it.kaptAddr || "", doroJuso: it.doroJuso || "", kaptdaCnt: +(it.kaptdaCnt || 0), kaptUsedate: String(it.kaptUsedate || ""), bjdCode: String(it.bjdCode || k.bjdCode) };
  };
  const writeProgress = (st, line) => writeJson(PROGRESS, {
    at: new Date().toISOString(), state: st.state, fetchedThisRun: st.fetched, skippedThisRun: st.skipped, remaining: st.remaining,
    cachedTotal: Object.keys(cache).length, callsToday: callsToday("kaptBasic"), dailyCap: +process.env.APTMAP_BUDGET_kaptBasic,
    errors: st.errors, consecutiveErrors: st.consecutiveErrors, lastError: st.lastError, line: redact(line),
  });
  let res;
  try {
    res = await runSlow({
      items: todo,
      fetchOne,
      save: (k, rec) => { cache[k.kaptCode] = rec; },
      flush: () => writeJson(BASIC, cache),
      progress: (st, line, toConsole) => { writeProgress(st, line); if (toConsole) console.log(`${new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })} ${redact(line)}`); },
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      now: () => Date.now(),
      opts: { intervalMs: env("APTMAP_SLOW_INTERVAL_MS", SLOW.intervalMs), backoffMs: env("APTMAP_SLOW_BACKOFF_MS", SLOW.backoffMs), progressMs: env("APTMAP_SLOW_PROGRESS_MS", SLOW.progressMs) },
    });
  } catch (e) {
    writeJson(BASIC, cache);
    console.error(redact(e.message));
    process.exit(EXIT.fatal);
  }
  writeJson(BASIC, cache);
  process.exit(res.code);
}

const step = process.argv[2];
if (!["list", "basic"].includes(step)) { console.log("사용: node scripts/aptmap/fetch-kapt.mjs list | basic [--all]"); process.exit(1); }
const { DATA_GO_KR_KEY } = requireKeys(["DATA_GO_KR_KEY"], "K-apt 단지 정보");
(step === "list" ? list : basic)(DATA_GO_KR_KEY).catch((e) => { console.error("\n" + redact(e.message)); process.exit(1); });
