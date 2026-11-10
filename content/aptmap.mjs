// P2-63b 역세권 아파트 지도 (/apt-map/) — build.mjs가 빌드 도구를 넘겨 호출합니다.
// 1) 데이터: scripts/aptmap/out/aptmap.json(P2-63a 파이프라인 결과, 저장소 밖) → 화면에 필요한 필드만 짧은 배열로 → dist/assets/data/aptmap.json
//    로컬 빌드는 같은 결과를 content/aptmap-data.json(저장소에 올림)에도 써 두고, 원본이 없는 배포(CI) 빌드는 이 사본을 씀. 둘 다 없으면 경고만.
// 2) 카카오맵 JS 키: 환경변수 KAKAO_JS_KEY가 있으면 그 값, 없으면 아래 공개 키 상수(KAKAO_JS_KEY_PUBLIC). 도메인 제한 공개 키라 페이지에 들어감
// 3) 화면: src/assets/aptmap-core.js(순수 계산) + aptmap.js(지도·목록·카드). 지도 SDK는 이 페이지에서만 불러옴
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";

// 시·도 코드(행정표준). 광주·전남은 2026 통합 코드 12(전남광주통합특별시). 지역 필터는 데이터에 있는 시·도만 보여 줌
const SIDO = [[11, "서울"], [41, "경기"], [28, "인천"], [26, "부산"], [27, "대구"], [12, "전남광주"], [30, "대전"], [31, "울산"], [36, "세종"], [51, "강원"], [43, "충북"], [44, "충남"], [52, "전북"], [47, "경북"], [48, "경남"], [50, "제주"]];
const SIDO_BY_NAME = { ...Object.fromEntries(SIDO.map(([c, n]) => [n, c])), 광주: 12, 전남: 12, 광주전남: 12 };
const OLD_CODE = { 29: 12, 46: 12, 42: 51, 45: 52 }; // 옛 시·도 코드 → 현재 코드
const r5 = (x) => Math.round(x * 1e5) / 1e5;
// P2-63c 시·도별 요약 페이지 주소(/apt-map/<slug>/). 광주·전남은 통합 코드 12 하나로 jeonnam-gwangju
const REGION_SLUG = { 11: "seoul", 41: "gyeonggi", 28: "incheon", 26: "busan", 27: "daegu", 12: "jeonnam-gwangju", 30: "daejeon", 31: "ulsan", 36: "sejong", 51: "gangwon", 43: "chungbuk", 44: "chungnam", 52: "jeonbuk", 47: "gyeongbuk", 48: "gyeongnam", 50: "jeju" };
const REGION_MIN_INDEX = 20; // P2-63c COO 결정: 단지가 이 수 미만인 시·도 페이지는 noindex,follow + sitemap 제외(얇은 콘텐츠). 이 수 이상이 되면 자동 색인
const REGION_TITLE = { 12: "전남광주(광주·전남)" }; // 제목·설명에만 쓰는 긴 이름(검색어 「광주」「전남」)

// 카카오맵 JavaScript 키: 브라우저에 그대로 보이는 공개 키이며 카카오 콘솔에서 도메인(penguintools.kr, localhost:8000)으로 제한됨(COO 결정 2026-11-10).
// REST 키 등 다른 키는 절대 여기에 넣지 않는다. 환경변수 KAKAO_JS_KEY가 있으면 그 값을 우선 씀
const KAKAO_JS_KEY_PUBLIC = "8bcdddb9a386724f1c4e8833ad8b049e";
function readKakaoKey(warnings) {
  const k = (process.env.KAKAO_JS_KEY || "").trim() || KAKAO_JS_KEY_PUBLIC;
  if (!k) warnings.push("/apt-map/ 카카오맵 JS 키 없음 → 지도 없이 목록만 보임");
  return k;
}

// 원본 → 사이트용 짧은 배열. [id, 이름, 시도코드, 시군구, 법정동, 위도, 경도, 세대수, 준공, 대표가격, 가격대(1~8), 기간(6|12), 거래 수, 거래 적음(0|1), 역[[이름, [노선 번호], 거리]], 최근[[YYMMDD, 면적, 층, 가격]]]
function compact(src, logic, warnings) {
  const lines = [], lineIdx = new Map();
  const li = (n) => { if (!lineIdx.has(n)) { lineIdx.set(n, lines.length); lines.push(n); } return lineIdx.get(n); };
  const R = logic.RULES;
  const bad = { rule: 0, band: 0, sido: 0, walk: 0 };
  const rows = [];
  for (const c of src.complexes || []) {
    let code = SIDO_BY_NAME[c.sido] || OLD_CODE[+String(c.id).slice(0, 2)] || +String(c.id).slice(0, 2);
    if (!SIDO.some(([k]) => k === code)) { bad.sido++; continue; }
    const st = [c.station, ...(c.stationsNear || [])].filter(Boolean).sort((a, b) => a.dist - b.dist);
    if (!st.length || !(c.households >= R.minHouseholds) || !(st[0].dist <= R.stationMaxM) || !(c.price > 0 && c.price < R.priceMaxExcl)) { bad.rule++; continue; } // 요청서 3-1 다시 확인
    if (logic.priceBand(c.price) !== c.band) bad.band++;
    if (c.station.walkMin !== logic.walkMin(c.station.dist)) bad.walk++;
    rows.push([
      String(c.id), c.name, code, c.sgg || "", c.dong || "", r5(c.lat), r5(c.lng), c.households, c.built || 0, c.price,
      +String(logic.priceBand(c.price)).slice(1), c.priceBasis === "12m" ? 12 : 6, c.tradeCount || 0, c.lowTrades ? 1 : 0,
      st.map((s) => [s.name, (s.lines || []).map(li), Math.round(s.dist)]),
      (c.recent || []).slice(0, 3).map((x) => [String(x.date).replace(/-/g, "").slice(2), x.area, x.floor, x.price]),
    ]);
  }
  if (bad.rule) warnings.push(`/apt-map/ 지도 조건(300세대·역 1km·9억 미만)에 맞지 않는 단지 ${bad.rule}곳을 뺐어요`);
  if (bad.sido) warnings.push(`/apt-map/ 시·도 코드를 알 수 없는 단지 ${bad.sido}곳을 뺐어요`);
  if (bad.band) warnings.push(`/apt-map/ 원본 가격대(band)와 다시 계산한 가격대가 다른 단지 ${bad.band}곳(다시 계산한 값으로 표시)`);
  if (bad.walk) warnings.push(`/apt-map/ 원본 도보 분과 다시 계산한 값이 다른 단지 ${bad.walk}곳`);
  const present = new Set(rows.map((r) => r[2]));
  return {
    v: 1, updated: src.updated, through: src.dataThrough, kaptAsOf: src.kaptFileAsOf || "",
    sido: SIDO.filter(([k]) => present.has(k)), lines, c: rows,
  };
}

// 화면 계산(aptmap-core.js)이 파이프라인 계산(logic.mjs)과 같은지 빌드 때마다 대조. 다르면 빌드 실패
function checkCore(root, logic) {
  const ctx = { URLSearchParams }; vm.createContext(ctx); // 브라우저 내장과 같은 것만 넘김
  vm.runInContext(fs.readFileSync(path.join(root, "src", "assets", "aptmap-core.js"), "utf8"), ctx);
  const A = ctx.AptCore, err = [];
  for (let d = 0; d <= 1000; d++) { // 지도 대상은 1km 이내(logic.walkBadge는 1km 초과면 null)
    if (A.walkMin(d) !== logic.walkMin(d)) err.push(`walkMin(${d})`);
    if (A.isWalk10(d) !== logic.isWalk10(d)) err.push(`isWalk10(${d})`);
    if (A.badge(d) !== logic.walkBadge(d)) err.push(`badge(${d}) ${A.badge(d)} ≠ ${logic.walkBadge(d)}`);
  }
  for (const p of [1, 19999, 20000, 29999, 30000, 39999, 40000, 59999, 60000, 89999, 90000, 120000]) {
    const want = logic.priceBand(p) || null;
    if ((A.bandOf(p) || null) !== want) err.push(`bandOf(${p}) ${A.bandOf(p)} ≠ ${want}`);
  }
  const fm = [[37500, "3억 7,500만"], [30000, "3억"], [8000, "8,000만"], [89999, "8억 9,999만"], [100, "100만"]];
  for (const [p, s] of fm) if (A.fmtPrice(p) !== s) err.push(`fmtPrice(${p}) ${A.fmtPrice(p)}`);
  const fs2 = [[39500, "3.95억"], [30000, "3억"], [36200, "3.62억"], [41000, "4.1억"], [8000, "8,000만"]];
  for (const [p, s] of fs2) if (A.fmtShort(p) !== s) err.push(`fmtShort(${p}) ${A.fmtShort(p)}`);
  // 주소 왕복
  const q = "?p=p3,p4&sido=41&line=4%ED%98%B8%EC%84%A0&built=2000&walk10=1&sort=dist&c=41410-83&m=37.35000,126.93000,5";
  const s = A.parse(q);
  if (A.query(s) !== q) err.push(`query 왕복 ${A.query(s)}`);
  if (s.line !== "4호선" || !s.walk10 || s.p.size !== 2 || s.sido !== "41") err.push("parse 결과");
  if (A.query(A.parse("")) !== "") err.push("기본 상태 주소는 빈 문자열이어야 함");
  if (A.parse("?p=zz").p.size !== 8) err.push("잘못된 p는 전체로");
  // 토글: 경계 500m 포함
  const mk = (d) => ({ band: "p3", sido: "41", built: 2000, st: [{ n: "x", l: ["4호선"], d }] });
  const on = { ...A.DEFAULT(), walk10: true };
  if (!A.pass(mk(500), on) || A.pass(mk(501), on) || !A.pass(mk(835), A.DEFAULT())) err.push("도보 10분 토글 경계");
  if (err.length) throw new Error("P2-63b 아파트 지도 화면 계산 대조 실패: " + err.slice(0, 8).join(", "));
  return { A, n: 1001 * 3 + 12 + fm.length + fs2.length + 8 };
}

export default async function buildAptmap(h) {
  const { root, dist, write, layout, crumbHtml, crumbs, faqHtml, faqLd, adSlotFixed, recoRows, favBtn, esc, t, u, abs, warnings, tool, guide, csp, buildV } = h;
  const logic = await import(new URL(`file:///${path.join(root, "scripts", "aptmap", "logic.mjs").replace(/\\/g, "/")}`).href);
  const { A: core, n: nCheck } = checkCore(root, logic);

  // ── 데이터 ──
  const SRC = path.join(root, "scripts", "aptmap", "out", "aptmap.json");
  const SNAP = path.join(root, "content", "aptmap-data.json");
  let data = null, srcRaw = null;
  if (fs.existsSync(SRC)) {
    srcRaw = JSON.parse(fs.readFileSync(SRC, "utf8"));
    data = compact(srcRaw, logic, warnings);
    const txt = JSON.stringify(data);
    if (!process.env.CI && (!fs.existsSync(SNAP) || fs.readFileSync(SNAP, "utf8") !== txt)) fs.writeFileSync(SNAP, txt);
  } else if (fs.existsSync(SNAP)) {
    data = JSON.parse(fs.readFileSync(SNAP, "utf8"));
    warnings.push(`/apt-map/ 원본 ${path.relative(root, SRC)} 없음 → 저장해 둔 사본(${data.through} 거래분, ${data.updated} 갱신) 사용`);
  } else {
    warnings.push(`/apt-map/ 데이터 없음(${path.relative(root, SRC)}) → 지도 페이지는 「데이터 준비 중」으로 나감`);
  }
  let dataInfo = { n: 0, raw: 0, gz: 0 };
  if (data) { // 원고 「예시」에 적은 거리가 데이터와 맞는지(좌표 갱신 뒤 어긋나면 알림)
    for (const [name, sta, d] of [["군포율곡", "산본", 458], ["한라뜨란채2단지", "부천시청", 570]]) {
      const r = data.c.find((x) => x[1] === name);
      if (!r || r[14][0][0] !== sta || r[14][0][2] !== d) warnings.push(`/apt-map/ 원고 예시(${name} ${sta} ${d}m)가 데이터(${r ? `${r[14][0][0]} ${r[14][0][2]}m` : "없음"})와 달라요 → content/tools.mjs aptmap.example 고치기`);
    }
  }
  if (data) {
    const txt = JSON.stringify(data);
    fs.mkdirSync(path.join(dist, "assets", "data"), { recursive: true });
    fs.writeFileSync(path.join(dist, "assets", "data", "aptmap.json"), txt);
    dataInfo = { n: data.c.length, raw: Buffer.byteLength(txt), gz: zlib.gzipSync(txt, { level: 9 }).length };
    if (dataInfo.gz > 300 * 1024) warnings.push(`/apt-map/ 데이터 gzip ${Math.round(dataInfo.gz / 1024)}KB > 300KB → 시·도별로 나누기 검토`);
  }
  const key = readKakaoKey(warnings);

  // ── 페이지 ──
  const [y, m] = String(data?.through || "").split("-");
  const [uy, um, ud] = String(data?.updated || "").split("-");
  const thr = data ? `${y}년 ${+m}월 거래분까지` : "데이터 준비 중";
  const upd = data ? `${uy}년 ${+um}월 ${+ud}일 갱신` : "";
  const NOTICE = `국토교통부 실거래가 공개 자료 기준(${thr}${upd ? `, ${upd}` : ""}). 거래가 끝난 기록이라 현재 호가와 다를 수 있어요. 투자 권유가 아니에요.`;
  const SOURCES = "출처: 국토교통부 실거래가, K-apt(공동주택관리정보시스템), 국가철도공단 역사정보, 카카오맵";
  const items = [["홈", "/"], ["내 집 마련", "/house/"], [tool.title, tool.path]];
  const g = guide;
  const chips = core.BANDS.map((b) => `<button type="button" class="am-chip am-${b.k}" data-band="${b.k}" aria-pressed="true"><i aria-hidden="true">${esc(b.m)}</i>${esc(b.n)}</button>`).join("");
  const sidoOpts = (data?.sido || []).map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join("");
  const builtOpts = core.BUILT.map((b) => `<option value="${b.v}">${esc(b.n)}</option>`).join("");
  const sortOpts = Object.entries(core.SORTS).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join("");
  const RULE_TXT = [
    ["지도에 오르는 단지", "세대수 300 이상(K-apt 단지 기본정보), 최근 12개월에 전용 40㎡ 이상 60㎡ 이하 매매 거래가 1건 이상, 가장 가까운 운행 중인 지하철·광역전철·경전철역까지 직선 1km 이내, 대표가격 9억 미만인 단지만 올려요."],
    ["대표가격", "국토교통부 아파트 매매 실거래가에서 전용 40~60㎡ 중개 거래만 골라 최근 6개월 거래가의 중위값을 써요. 해제(취소)된 거래와 직거래는 뺍니다. 6개월에 3건 미만이면 12개월로 넓히고 「거래 적음」을 붙이며, 12개월에도 없으면 지도에서 빼요."],
    ["가격대", "2억 미만, 2억대, 3억대 … 8억대의 8개 구간이에요. 경계값은 위 구간에 넣어서 정확히 3억은 3억대예요. 마커와 칩에는 색과 함께 숫자(2억 미만은 2↓)를 적어요."],
    ["역세권과 도보 시간", "단지 대표 좌표와 역 좌표 사이의 직선거리예요. 도보 시간은 직선거리 × 1.3 ÷ 분당 67m로 어림한 추정이에요. 「도보 10분 이내만」을 켜면 직선 500m 이내(500m 포함) 단지만 보이고, 카드 배지는 500m 이내 「도보 10분 역세권」, 그보다 멀면 「역까지 도보 약 N분」이에요."],
  ];
  const ruleHtml = RULE_TXT.map(([h1, p]) => `<h3>${esc(h1)}</h3><p>${esc(p)}</p>`).join("");
  // P2-63c 시·도별 요약 페이지 목록(데이터에 단지가 있는 시·도만). 지도 페이지 하단과 각 시·도 페이지 하단에 같은 링크 목록
  const regions = data ? data.sido.map(([code, name]) => ({ code, name, slug: REGION_SLUG[code], n: data.c.filter((r) => r[2] === code).length })).filter((r) => r.n > 0 && r.slug) : [];
  const regionLinks = (cur) => regions.length ? `<ul class="amr-links">${regions.map((r) => r.code === cur ? `<li><span class="chip on" aria-current="page">${esc(r.name)} <small>${r.n.toLocaleString("en-US")}곳</small></span></li>` : `<li><a class="chip" href="${u(`${tool.path}${r.slug}/`)}">${esc(r.name)} <small>${r.n.toLocaleString("en-US")}곳</small></a></li>`).join("")}</ul>` : "";
  const body = `
${crumbHtml(items)}
<article class="tool am-page">
  <header class="page-head am-head">
    <span class="eyebrow">내 집 마련</span>
    <h1>${esc(tool.h1)} ${favBtn(tool, "fav-title")}</h1>
    <p class="lead">${esc(tool.desc)}</p>
  </header>
  <section class="am" id="tool" data-tool="aptmap" data-src="${u("/assets/data/aptmap.json")}?v=${buildV}" data-k="${esc(key)}" data-n="${dataInfo.n}">
    <div class="am-filters">
      <div class="am-ftop"><b id="am-band-h">가격대 <small>여러 개 고를 수 있어요</small></b><button type="button" class="am-info-btn" data-am-info aria-haspopup="dialog"><span aria-hidden="true">ⓘ</span> 기준·출처</button></div>
      <div class="am-chips" role="group" aria-labelledby="am-band-h">${chips}</div>
      <div class="am-sels">
        <label><span class="sr">지역</span><select name="sido" aria-label="지역"><option value="">지역 전체</option>${sidoOpts}</select></label>
        <label><span class="sr">노선</span><select name="line" aria-label="노선"><option value="">노선 전체</option></select></label>
        <label><span class="sr">준공</span><select name="built" aria-label="준공연도"><option value="">준공 전체</option>${builtOpts}</select></label>
        <button type="button" class="am-reset" data-am-reset aria-label="필터 초기화" title="필터 초기화">↺</button>
      </div>
      <label class="am-walk"><span><b>도보 10분 이내만</b> <small>역까지 직선 500m</small></span><input type="checkbox" name="walk10" role="switch"><i aria-hidden="true"></i></label>
    </div>
    <div class="am-mapbox">
      <div class="am-map" id="am-map" role="region" aria-label="역세권 아파트 지도"></div>
      <p class="am-loading" role="status">실거래 데이터 불러오는 중</p>
      <div class="am-ctrl"><button type="button" data-zoom="1" aria-label="지도 확대">+</button><button type="button" data-zoom="-1" aria-label="지도 축소">−</button><button type="button" data-locate aria-label="내 위치로 이동" title="내 위치(이 기기 안에서만 써요)"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4" stroke="currentColor" stroke-width="2"/></svg></button></div>
      <div class="am-card" id="am-card" role="dialog" aria-modal="false" aria-labelledby="am-card-h" hidden></div>
    </div>
    <div class="am-list" id="am-list">
      <div class="am-list-head">
        <button type="button" class="am-sheet" aria-expanded="false" aria-controls="am-rows"><span class="am-sheet-ar" aria-hidden="true">▲</span> <span class="am-count" aria-live="polite">이 지역 단지 0곳</span></button>
        <label><span class="sr">정렬</span><select name="sort" aria-label="정렬">${sortOpts}</select></label>
      </div>
      <div class="am-list-body">
        <div class="am-empty" hidden></div>
        <ol class="am-rows" id="am-rows"></ol>
        <button type="button" class="btn ghost am-more" hidden>더 보기</button>
        <p class="am-list-foot"><button type="button" class="btn ghost am-copy" data-am-copy>이 조건 링크 복사</button></p>
      </div>
    </div>
    <p class="am-notice"><span>${esc(NOTICE)}</span> <span>${esc(SOURCES)}</span></p>
  </section>
  <dialog class="am-dlg" id="am-info" aria-labelledby="am-info-h">
    <div class="am-dlg-in">
      <h2 id="am-info-h">기준·계산법·출처</h2>
      ${ruleHtml}
      <h3>갱신</h3><p>${esc(data ? `${thr} 반영했어요(${upd}). 실거래는 계약 후 30일 안에 신고되므로 가장 최근 달은 아직 덜 찬 상태예요.` : "데이터를 준비하고 있어요.")}${data?.kaptAsOf ? esc(` 세대수·주소는 K-apt 단지 기본정보 ${data.kaptAsOf} 기준이에요.`) : ""}</p>
      <h3>출처</h3><p>국토교통부 아파트 매매 실거래가(공공데이터포털), K-apt 공동주택관리정보시스템 단지 기본정보, 국가철도공단 철도역 정보, 지도는 카카오맵을 써요. 민간 부동산 사이트의 자료는 쓰지 않아요.</p>
      <p class="hint">거래 완료 기록을 정리한 참고 자료예요. 중개나 매수 권유가 아니에요.</p>
      <form method="dialog"><button class="btn">닫기</button></form>
    </div>
  </dialog>
  <noscript><p class="sq-warn">이 지도는 자바스크립트가 켜져 있어야 보여요.</p></noscript>
  ${adSlotFixed("below-tool")}
  <section class="prose">
    <p>${t(g.intro)}</p>
    <h2>사용법</h2>
    <ol>${g.howto.map((x) => `<li>${t(x)}</li>`).join("")}</ol>
    <h2>기준과 계산법</h2>
    ${ruleHtml}
    <h2>예시</h2>
    <p>${t(g.example)}</p>
    <h2>알아 두세요 (한계)</h2>
    <p>${t(g.limits)}</p>
  </section>
  ${faqHtml(g.faq)}
  ${regions.length ? `<section class="amr-more" aria-labelledby="amr-more-h"><h2 id="amr-more-h">시·도별 가격대 정리</h2><p class="hint">시·도마다 가격대별 단지 수와 최저가 TOP10을 표로 정리했어요(${esc(thr)}).</p>${regionLinks(0)}</section>` : ""}
  ${recoRows(h.next, "다른 툴도 써 보세요")}
</article>`;
  // CSP: 툴 페이지 CSP + 카카오맵 SDK(dapi.kakao.com이 t1.daumcdn.net의 지도 코드를 불러옴). 지도 타일은 이미지(img-src https:)
  // 주소에 scheme을 붙이지 않음: SDK가 페이지와 같은 scheme으로 지도 코드를 불러와서(로컬 http 시험 / 배포 https). https 페이지에서는 https만 허용됨
  const KAKAO = "dapi.kakao.com t1.daumcdn.net t1.kakaocdn.net";
  const pageCsp = csp.replace(/script-src ([^;]+)/, `script-src $1 ${KAKAO}`).replace(/img-src ([^;]+)/, "img-src $1 *.daumcdn.net *.kakaocdn.net");
  write(tool.path, layout({
    title: tool.seo, desc: tool.desc, path: tool.path, body, wide: true, csp: pageCsp, scripts: ["aptmap-core.js", "aptmap.js"],
    jsonld: [faqLd(g.faq), crumbs(items), { "@context": "https://schema.org", "@type": "WebApplication", name: tool.h1, url: abs(tool.path), applicationCategory: "ReferenceApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" } }],
  }));
  const reg = data ? await buildRegions({ ...h, data, srcRaw, logic, core, regions, regionLinks, ruleHtml, NOTICE, SOURCES, items }) : { pages: [], checks: 0, empty: [] }; // P2-63c
  return { ...dataInfo, checks: nCheck, key: !!key, regions: reg.pages, regionChecks: reg.checks, regionsEmpty: reg.empty };
}

// ───────────────────────── P2-63c 시·도별 요약 페이지 ─────────────────────────
// 기준: 요청서 6장 + 업무지시서 P2-63c. 빌드 때마다 aptmap 데이터로 자동 생성(데이터에 단지가 있는 시·도만).
// 표 숫자는 원본 scripts/aptmap/out/aptmap.json을 따로 세어 페이지 HTML에서 읽은 값과 대조하고, 하나라도 다르면 빌드 실패.
// 지역 해설(사람 검수)은 content/aptmap-regions.mjs. 비어 있으면 데이터 숫자만으로 만든 사실 요약 1~2문장만 나감
const pct = (a, b) => (b ? Math.round((a * 100) / b) : 0);
const num = (n) => Number(n).toLocaleString("en-US");
// 가격 낮은 순(같으면 역 가까운 순, 그다음 단지 id) — 지도 목록의 「가격 낮은 순」과 같은 기준
const byPrice = (price, dist, id) => (a, b) => price(a) - price(b) || dist(a) - dist(b) || (id(a) < id(b) ? -1 : id(a) > id(b) ? 1 : 0);
const sidoOf = (c) => SIDO_BY_NAME[c.sido] || OLD_CODE[+String(c.id).slice(0, 2)] || +String(c.id).slice(0, 2); // compact()와 같은 규칙

async function buildRegions(h) {
  const { root, dist, data, srcRaw, logic, core, regions, regionLinks, ruleHtml, NOTICE, SOURCES, items: mapItems, write, layout, crumbHtml, crumbs, adSlotFixed, esc, u, warnings, tool } = h;
  let human = {};
  const HF = path.join(root, "content", "aptmap-regions.mjs");
  if (fs.existsSync(HF)) human = (await import(new URL(`file:///${HF.replace(/\\/g, "/")}`).href)).default || {};
  for (const k of Object.keys(human)) if (!Object.values(REGION_SLUG).includes(k)) warnings.push(`content/aptmap-regions.mjs: 알 수 없는 시·도 주소 「${k}」`);

  const [y, m] = String(data.through).split("-");
  const ym = `${y}년 ${+m}월`;
  const lines = data.lines;
  const near0 = (r) => r[14][0][2];
  const pages = [];
  let checks = 0;
  for (const R of regions) {
    const rows = data.c.filter((r) => r[2] === R.code);
    const total = rows.length;
    const w10 = rows.filter((r) => core.isWalk10(near0(r))).length;
    const sorted = rows.slice().sort(byPrice((r) => r[9], near0, (r) => r[0]));
    const bands = core.BANDS.map((b, i) => {
      const list = sorted.filter((r) => r[10] === i + 1);
      return { ...b, cnt: list.length, w: list.filter((r) => core.isWalk10(near0(r))).length, top: list.slice(0, 10) };
    });
    const cheapest = sorted[0];
    const most = bands.reduce((a, b) => (b.cnt > a.cnt ? b : a));
    const under3 = bands[0].cnt + bands[1].cnt;
    const name = R.name, tname = REGION_TITLE[R.code] || name;
    const p = `${tool.path}${R.slug}/`;
    const mapQ = (q) => u(`${tool.path}?sido=${R.code}${q || ""}`);
    const title = `${tname} 역세권 20평대 아파트 가격대별 정리 (${ym} 실거래 기준)`;
    const desc = `${tname}에서 역 1km 안, 300세대 이상, 전용 40~60㎡(20평대) 아파트 ${num(total)}곳을 국토교통부 실거래 중위값(${ym} 거래분까지)으로 가격대별로 정리했어요. 가격대별 단지 수, 최저가 TOP10, 도보 10분 역세권 단지 수를 볼 수 있어요. 투자 권유가 아니에요.`;
    // 사실 요약(데이터 숫자만, 사람 해설이 아님)
    const facts = [
      `${name}에서 지도 조건(역 직선 1km·300세대 이상·전용 40~60㎡·대표가격 9억 미만)에 맞는 단지는 ${num(total)}곳이에요. 가장 많은 가격대는 ${most.n}로 ${num(most.cnt)}곳(전체의 ${pct(most.cnt, total)}%)이에요.`,
      `${under3 ? `3억 미만 단지는 ${num(under3)}곳으로 전체의 ${pct(under3, total)}%이고` : "3억 미만 단지는 없고"}, 역까지 직선 500m 이내인 도보 10분 역세권 단지는 ${num(w10)}곳(${pct(w10, total)}%)이에요.`,
    ];
    const hu = human[R.slug];
    const huParas = hu ? (Array.isArray(hu) ? hu : hu.paras || []).filter((x) => String(x).trim()) : [];
    const huHtml = huParas.length ? `<h3>지역 해설</h3>${huParas.map((x) => `<p>${esc(x)}</p>`).join("")}${hu.by || hu.date ? `<p class="hint">작성·검수: ${esc([hu.by, hu.date].filter(Boolean).join(", "))}</p>` : ""}` : "";

    const bd = (b) => `<span class="am-bd am-${b.k}"><i aria-hidden="true">${esc(b.m)}</i>${esc(b.n)}</span>`;
    const stCell = (r) => { const s = r[14][0]; return `${esc(core.stName(s[0]))}<small>${esc(s[1].map((k) => lines[k]).join("·"))}</small><small>직선 ${esc(core.fmtDist(s[2]))} · ${esc(core.badge(s[2]))}</small>`; };
    const bandTbl = `<div class="amr-box"><table class="amr-tbl amr-cnt">
<caption class="sr">${esc(name)} 가격대별 단지 수</caption>
<thead><tr><th scope="col">가격대</th><th scope="col" class="n">단지 수</th><th scope="col" class="n">비율</th><th scope="col" class="n">도보 10분<br>역세권</th><th scope="col"><span class="sr">지도</span></th></tr></thead>
<tbody>${bands.map((b) => `<tr data-band="${b.k}" data-n="${b.cnt}" data-w="${b.w}"><th scope="row">${bd(b)}</th><td class="n">${num(b.cnt)}곳</td><td class="n">${pct(b.cnt, total)}%</td><td class="n">${num(b.w)}곳</td><td>${b.cnt ? `<a href="${mapQ(`&p=${b.k}`)}">지도<span class="sr">에서 ${esc(b.n)} 보기</span></a>` : ""}</td></tr>`).join("")}</tbody>
<tfoot><tr><th scope="row">합계</th><td class="n">${num(total)}곳</td><td class="n">100%</td><td class="n">${num(w10)}곳</td><td></td></tr></tfoot>
</table></div>`;
    const topHtml = bands.filter((b) => b.cnt).map((b) => `<h3 id="top-${b.k}">${bd(b)} ${b.cnt > 10 ? `최저가 TOP10 <small>(${num(b.cnt)}곳 중)</small>` : `단지 ${num(b.cnt)}곳 <small>(가격 낮은 순)</small>`}</h3>
<div class="amr-box"><table class="amr-tbl amr-top" data-top="${b.k}">
<caption class="sr">${esc(name)} ${esc(b.n)} 대표가격 낮은 순</caption>
<thead><tr><th scope="col" class="n">#</th><th scope="col">단지명 <small>시군구·동</small></th><th scope="col" class="n">대표가격</th><th scope="col">가까운 역·거리</th><th scope="col" class="n">세대수</th><th scope="col" class="n">준공</th></tr></thead>
<tbody>${b.top.map((r, i) => `<tr data-id="${esc(r[0])}" data-price="${r[9]}"><td class="n">${i + 1}</td><td><a href="${mapQ(`&c=${encodeURIComponent(r[0])}`)}">${esc(r[1])}</a><small>${esc([r[3], r[4]].filter(Boolean).join(" "))}</small></td><td class="n"><b>${esc(core.fmtPrice(r[9]))}</b>${r[13] ? '<small><span class="am-low">거래 적음</span></small>' : ""}</td><td>${stCell(r)}</td><td class="n">${num(r[7])}</td><td class="n">${r[8] || "-"}</td></tr>`).join("")}</tbody>
</table></div>`).join("\n");

    const items = [...mapItems, [name, p]];
    const body = `
${crumbHtml(items)}
<article class="amr" data-sido="${R.code}" data-total="${total}" data-w10="${w10}">
  <header class="page-head">
    <span class="eyebrow">내 집 마련</span>
    <h1>${esc(title)}</h1>
    <p class="lead">${esc(desc)}</p>
  </header>
  <div class="amr-key">
    <div><small>지도에 오른 단지</small><b>${num(total)}곳</b><span>역 직선 1km 안</span></div>
    <div><small>도보 10분 역세권</small><b>${num(w10)}곳</b><span>역까지 직선 500m 이내</span></div>
    <div><small>가장 낮은 대표가격</small><b>${esc(core.fmtPrice(cheapest[9]))}</b><span>${esc(cheapest[1])}${cheapest[13] ? " · 거래 적음" : ""}</span></div>
  </div>
  <p class="amr-cta"><a class="btn" href="${mapQ()}">이 지역 지도로 보기 →</a><a class="btn ghost" href="${mapQ("&walk10=1")}">도보 10분 이내만 지도로</a></p>
  <section class="prose amr-sum" aria-labelledby="amr-sum-h">
    <h2 id="amr-sum-h">한눈에 보기</h2>
    ${facts.map((x) => `<p>${esc(x)}</p>`).join("")}
    ${huHtml}
  </section>
  <section aria-labelledby="amr-cnt-h">
    <h2 id="amr-cnt-h">가격대별 단지 수</h2>
    ${bandTbl}
  </section>
  ${adSlotFixed("below-tool")}
  <section aria-labelledby="amr-top-h">
    <h2 id="amr-top-h">가격대별 최저가 TOP10</h2>
    <p class="hint">대표가격이 낮은 순서예요. 단지명을 누르면 지도에서 그 단지 카드(최근 거래·역·세대수)가 열려요. 값이 같으면 역이 가까운 단지를 먼저 적었어요.</p>
    ${topHtml}
  </section>
  <section class="prose" aria-labelledby="amr-rule-h">
    <h2 id="amr-rule-h">기준과 계산법</h2>
    ${ruleHtml}
    <p>표는 매달 실거래 자료를 새로 받으면 다시 만들어져요. 대표가격은 거래가 끝난 기록의 중위값이라 지금 부르는 값(호가)과 다를 수 있어요. 단지 좌표는 대표 주소 1점이라 큰 단지는 동마다 역까지 거리가 달라요.</p>
  </section>
  <p class="amr-notice"><span>${esc(NOTICE)}</span> <span>${esc(SOURCES)}</span></p>
  <section class="amr-more" aria-labelledby="amr-other-h">
    <h2 id="amr-other-h">다른 시·도 보기</h2>
    ${regionLinks(R.code)}
    <p><a href="${u(tool.path)}">← 전국 역세권 아파트 지도로</a></p>
  </section>
</article>`;
    const noindex = total < REGION_MIN_INDEX;
    write(p, layout({ title, desc, path: p, body, csp: true, noindex, jsonld: [crumbs(items)] }));
    pages.push({ path: p, name, n: total, w10, noindex });

    // ── 빌드 대조: 원본(aptmap.json)을 따로 세어 방금 만든 HTML의 숫자·TOP10·링크와 비교 ──
    if (srcRaw) {
      const err = [];
      const raw = (srcRaw.complexes || []).filter((c) => sidoOf(c) === R.code);
      const near = (c) => Math.min(...[c.station, ...(c.stationsNear || [])].filter(Boolean).map((s) => Math.round(s.dist)));
      const html = fs.readFileSync(path.join(dist, p, "index.html"), "utf8");
      const art = html.match(/<article class="amr" data-sido="(\d+)" data-total="(\d+)" data-w10="(\d+)"/);
      const rw10 = raw.filter((c) => logic.isWalk10(near(c))).length;
      if (!art || +art[2] !== raw.length) err.push(`합계 ${art && art[2]} ≠ 원본 ${raw.length}`);
      if (!art || +art[3] !== rw10) err.push(`도보 10분 ${art && art[3]} ≠ 원본 ${rw10}`);
      const got = Object.fromEntries([...html.matchAll(/<tr data-band="(p\d)" data-n="(\d+)" data-w="(\d+)"/g)].map((x) => [x[1], [+x[2], +x[3]]]));
      for (const b of core.BAND_KEYS) {
        const rb = raw.filter((c) => logic.priceBand(c.price) === b);
        const want = [rb.length, rb.filter((c) => logic.isWalk10(near(c))).length];
        if (!got[b] || got[b].join() !== want.join()) err.push(`${b} 단지 수 ${got[b]} ≠ 원본 ${want}`);
        const wantIds = rb.slice().sort(byPrice((c) => c.price, near, (c) => String(c.id))).slice(0, 10).map((c) => `${c.id}:${c.price}`);
        const tb = html.match(new RegExp(`data-top="${b}"[\\s\\S]*?</table>`));
        const gotIds = tb ? [...tb[0].matchAll(/<tr data-id="([^"]+)" data-price="(\d+)"/g)].map((x) => `${x[1]}:${x[2]}`) : [];
        if (wantIds.join() !== gotIds.join()) err.push(`${b} TOP10 [${gotIds.slice(0, 2)}…] ≠ 원본 [${wantIds.slice(0, 2)}…]`);
        const links = tb ? [...tb[0].matchAll(/href="[^"]*\?sido=(\d+)&c=([^"]+)"/g)] : [];
        if (links.length !== gotIds.length || links.some((x, i) => +x[1] !== R.code || decodeURIComponent(x[2]) !== gotIds[i].split(":")[0])) err.push(`${b} TOP10 지도 링크`);
        checks += 3;
      }
      checks += 2;
      if (/매물/.test(html)) err.push("「매물」 표현");
      if (err.length) throw new Error(`P2-63c ${p} 표 숫자 대조 실패: ${err.slice(0, 6).join(" / ")}`);
    }
  }
  const empty = Object.entries(REGION_SLUG).filter(([c]) => !regions.some((r) => r.code === +c)).map(([c]) => (SIDO.find(([k]) => k === +c) || [])[1]);
  return { pages, checks, empty };
}
