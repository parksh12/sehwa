// P2-63a 역세권 아파트 지도: 계산 로직(순수 함수만. 네트워크·파일 접근 없음)
// 기준 원문: 부동산투자\아파트지도_업무요청서.md (v2) 3장 데이터 정의. 여기 숫자를 바꾸려면 요청서부터 바뀌어야 한다.
// 자동 시험: node scripts/aptmap/test.mjs

// ───────── 3-1 조건 상수 ─────────
export const RULES = Object.freeze({
  minHouseholds: 300,      // 세대수 300 이상
  areaMin: 40,             // 전용 40㎡ 이상
  areaMax: 60,             // 전용 60㎡ 이하
  stationMaxM: 1000,       // 가장 가까운 역까지 직선 1,000m 이내(포함)
  walk10M: 500,            // 「도보 10분 이내만」 토글: 직선 500m 이내(포함)
  priceMaxExcl: 90000,     // 대표가격 9억(90,000만원) 미만. 정확히 9억은 제외
  months: 6,               // 대표가격 기본 기간
  monthsWide: 12,          // 3건 미만이면 넓히는 기간
  minTrades: 3,            // 6개월 거래가 이 건수 미만이면 12개월로
  walkFactor: 1.3,         // 도보 추정 = 직선 × 1.3 ÷ 67m/분
  walkMPerMin: 67,
});

// ───────── 실거래 한 건 정리 ─────────
// 국토부 아파트 매매 실거래가 상세 자료(RTMSDataSvcAptTradeDev) 응답 item 하나 → 내부 형식
// 필드명 출처: data.go.kr/data/15126468 Open API 명세(2026-11-10 확인)
export function parseTrade(it) {
  const s = (v) => (v == null ? "" : String(v).trim());
  const y = +s(it.dealYear), m = +s(it.dealMonth), d = +s(it.dealDay);
  const price = +s(it.dealAmount).replace(/,/g, "");
  return {
    aptSeq: s(it.aptSeq),
    name: s(it.aptNm),
    sggCd: s(it.sggCd),
    umdCd: s(it.umdCd),
    bjdCode: s(it.sggCd) + s(it.umdCd),          // 법정동코드 10자리 = 시군구 5 + 읍면동 5
    dong: s(it.umdNm),
    jibun: s(it.jibun),
    area: +s(it.excluUseAr),
    price,                                          // 만원
    floor: +s(it.floor),
    built: +s(it.buildYear) || null,
    ym: y && m ? `${y}-${String(m).padStart(2, "0")}` : "",
    date: y && m && d ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : "",
    cancelled: isCancelled(it),
    brokered: isBrokered(it),
  };
}

// 해제여부(cdealType)에 값(공개 자료에서 "O")이 있거나 해제사유발생일(cdealDay)이 있으면 해제된 거래
export function isCancelled(it) {
  const t = String(it.cdealType ?? "").trim(), d = String(it.cdealDay ?? "").trim();
  return t !== "" || d !== "";
}
// 거래유형(dealingGbn)이 정확히 「중개거래」인 것만 쓴다. 「직거래」와 빈 값은 쓰지 않는다(요청서 3-2: 중개거래만 사용)
export function isBrokered(it) {
  return String(it.dealingGbn ?? "").replace(/\s/g, "") === "중개거래";
}

// ───────── 3-2 대표가격 ─────────
export function median(nums) {
  const a = nums.filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  if (!a.length) return null;
  const h = a.length >> 1;
  return a.length % 2 ? a[h] : Math.round((a[h - 1] + a[h]) / 2); // 짝수면 가운데 두 값 평균, 만원 단위 반올림
}

// "2026-10" 기준으로 n개월 전 달 문자열. monthsBack("2026-10", 5) = "2026-05"
export function monthsBack(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) - n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export const inArea = (a) => a >= RULES.areaMin && a <= RULES.areaMax;
export const usable = (t) => inArea(t.area) && !t.cancelled && t.brokered && t.price > 0 && !!t.ym;

// trades: parseTrade 결과 배열(한 단지분), through: 반영하는 마지막 계약월 "YYYY-MM"
// 결과: null(12개월에도 0건 → 지도에서 뺌) 또는 { price, basis:"6m"|"12m", tradeCount, lowTrades, used:[거래] }
export function representativePrice(trades, through) {
  const ok = trades.filter(usable);
  const within = (n) => { const from = monthsBack(through, n - 1); return ok.filter((t) => t.ym >= from && t.ym <= through); };
  const six = within(RULES.months);
  if (six.length >= RULES.minTrades) return { price: median(six.map((t) => t.price)), basis: "6m", tradeCount: six.length, lowTrades: false, used: six };
  const twelve = within(RULES.monthsWide);
  if (!twelve.length) return null;
  return { price: median(twelve.map((t) => t.price)), basis: "12m", tradeCount: twelve.length, lowTrades: true, used: twelve };
}

// ───────── 3-3 가격대 ─────────
// 경계값은 위 구간: 정확히 30,000 → p3. 90,000 이상은 null(제외)
export function priceBand(price) {
  if (!Number.isFinite(price) || price <= 0) return null;
  if (price >= RULES.priceMaxExcl) return null;
  if (price < 20000) return "p1";
  return "p" + Math.floor(price / 10000);
}

// ───────── 3-5 거리 ─────────
const R_EARTH = 6371008.8; // 지구 평균 반지름(m, IUGG)
const rad = (d) => (d * Math.PI) / 180;
export function haversine(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
}
// 화면·필터 모두 정수 m(station.dist)로 판단한다
export const distM = (lat1, lng1, lat2, lng2) => Math.round(haversine(lat1, lng1, lat2, lng2));
export const walkMin = (dist) => Math.round((dist * RULES.walkFactor) / RULES.walkMPerMin);
export const isWalk10 = (dist) => dist <= RULES.walk10M;
export function walkBadge(dist) {
  if (!(dist >= 0) || dist > RULES.stationMaxM) return null;
  // 대표님 승인 2026-11-10: 500m 초과~1km는 「역까지 도보 약 N분」(N = 반올림(거리×1.3÷67))
  return dist <= RULES.walk10M ? "도보 10분 역세권" : `역까지 도보 약 ${walkMin(dist)}분`;
}

// stations: [{ id, name, lines:[...], points:[{lat,lng}] }] (환승역은 points가 여러 개)
// 결과: 1km 안의 역을 가까운 순으로 [{ id, name, lines, dist, walkMin }]
export function stationsWithin(lat, lng, stations, maxM = RULES.stationMaxM) {
  const out = [];
  for (const s of stations) {
    let best = Infinity;
    for (const p of s.points) { const d = distM(lat, lng, p.lat, p.lng); if (d < best) best = d; }
    if (best <= maxM) out.push({ id: s.id, name: s.name, lines: s.lines, dist: best, walkMin: walkMin(best) });
  }
  return out.sort((a, b) => a.dist - b.dist || a.name.localeCompare(b.name, "ko"));
}

// ───────── 4-2 ③ 단지명 정규화와 2단계 매칭 ─────────
const FW = (s) => s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
// 공백·「아파트」·괄호를 지운다. 두 가지 키를 만든다.
//  keep: 괄호 기호만 지우고 안의 글자는 남김  "율곡주공(3단지)" → "율곡주공3단지"
//  drop: 괄호와 안의 글자를 모두 지움        "반달마을(건영)" → "반달마을"
export function nameKeys(name) {
  let s = FW(String(name || "")).toLowerCase();
  s = s.replace(/아파트|apt\.?/g, "").replace(/[\s·.,\-_~'"]/g, "");
  const keep = s.replace(/[()\[\]{}<>]/g, "");
  const drop = s.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|<[^>]*>/g, "").replace(/[()\[\]{}<>]/g, "");
  return { keep, drop };
}
export const normalizeName = (name) => nameKeys(name).keep;
export function sameName(a, b) {
  const x = nameKeys(a), y = nameKeys(b);
  if (!x.keep || !y.keep) return false;
  return x.keep === y.keep || (x.drop !== "" && x.drop === y.drop);
}

// 지번 정리: "산 12-03번지" → "산12-3", "0123-0000" → "123"
export function normJibun(j) {
  // 끝에 「-」만 붙은 지번("73-", K-apt 파일·기본정보에서 1,310곳)은 부번 없음으로 본다
  const m = String(j || "").replace(/\s/g, "").replace(/번지$/, "").match(/^(산)?0*(\d+)(?:-0*(\d*))?$/);
  if (!m) return "";
  return (m[1] || "") + m[2] + (m[3] && m[3] !== "0" ? "-" + m[3] : "");
}
// K-apt 법정동주소(kaptAddr)에서 지번만 꺼낸다. "경기도 군포시 금정동 845 율곡주공3단지" → "845"
export function jibunFromAddr(addr) {
  const toks = String(addr || "").trim().split(/\s+/);
  const isDong = (t) => /(동|리|가)$/.test(t || "");
  for (let i = 1; i < toks.length; i++) {
    if (toks[i] === "산" && isDong(toks[i - 1]) && /^\d/.test(toks[i + 1] || "")) return normJibun("산" + toks[i + 1]);
    if (/^(산)?\d+(-\d*)?(번지)?$/.test(toks[i]) && isDong(toks[i - 1])) return normJibun(toks[i]);
  }
  return "";
}

// tradeCx: { aptSeq, name, bjdCode, jibun }
// kapts:   [{ kaptCode, kaptName, bjdCode, jibun }]  (jibun은 jibunFromAddr로 미리 정리)
// 1순위: 법정동코드(시군구+법정동) + 지번 일치. 같은 지번에 단지가 여럿이면 이름이 맞는 것 하나만 인정
// 2순위: 같은 법정동 안에서 정규화한 단지명 일치(후보가 정확히 하나일 때만)
export function matchComplex(tradeCx, kapts) {
  const sameDong = kapts.filter((k) => k.bjdCode === tradeCx.bjdCode);
  const j = normJibun(tradeCx.jibun);
  if (j) {
    const byJibun = sameDong.filter((k) => k.jibun && k.jibun === j);
    if (byJibun.length === 1) return { kaptCode: byJibun[0].kaptCode, stage: 1 };
    if (byJibun.length > 1) {
      const named = byJibun.filter((k) => sameName(k.kaptName, tradeCx.name));
      if (named.length === 1) return { kaptCode: named[0].kaptCode, stage: 1 };
      // 같은 지번 안에서만 쓰는 고르기(P2-63a-2 시드 사례)
      //  ① 괄호 안 글자까지 살린 이름이 한쪽에 포함: 「반달마을(건영)」→「반달마을건영」 ⊂ 「상동반달마을건영」
      const tk = nameKeys(tradeCx.name).keep;
      const kin = byJibun.filter((k) => { const a = nameKeys(k.kaptName).keep; return tk.length >= 3 && a && (a.includes(tk) || tk.includes(a)); });
      if (kin.length === 1) return { kaptCode: kin[0].kaptCode, stage: 1, rule: "같은 지번+이름 일부" };
      //  ② 이름의 번호가 똑같은 단지가 하나: 「한라마을(주공2)」{2} ↔ 「한라뜨란채2단지」{2} (같은 지번 「중동한라1」{1}은 제외)
      const tn = (tk.match(/\d+/g) || []).join(",");
      if (tn) {
        const same = byJibun.filter((k) => (nameKeys(k.kaptName).keep.match(/\d+/g) || []).join(",") === tn);
        if (same.length === 1) return { kaptCode: same[0].kaptCode, stage: 1, rule: "같은 지번+번호" };
      }
    }
  }
  const byName = sameDong.filter((k) => sameName(k.kaptName, tradeCx.name));
  if (byName.length === 1) return { kaptCode: byName[0].kaptCode, stage: 2 };
  // ── 보조 규칙(P2-63a-2, 실데이터 일치율 66.8%에서 추가). 잘못 붙으면 작은 단지에 큰 단지 세대수가 붙으므로 보수적으로 ──
  // 번호 보호: 실거래 이름의 숫자(2단지·2차·101동 등)가 K-apt 이름에 모두 있어야 한다(「헤센2차」↔「헤센1차」, 「○○2단지」↔「○○아파트」 막기)
  const nums = (s) => String(s || "").match(/\d+/g) || [];
  const numOk = (k) => { const kn = nums(nameKeys(k.kaptName).keep); return nums(nameKeys(tradeCx.name).keep).every((n) => kn.includes(n)); };
  const partial = (k) => { const a = nameKeys(k.kaptName).drop, b = nameKeys(tradeCx.name).drop; const s = a.length <= b.length ? a : b; return s.length >= 2 && (a.includes(b) || b.includes(a)) && numOk(k); };
  if (j && byName.length === 0) {
    // 1순위 보조: 본번이 같은 단지 중 이름이 부분 일치(번호 보호 포함)하는 단지가 하나
    const main = j.split("-")[0];
    const byMain = sameDong.filter((k) => k.jibun && k.jibun.split("-")[0] === main);
    const pn = byMain.filter(partial);
    if (pn.length === 1) return { kaptCode: pn[0].kaptCode, stage: 1, rule: "본번+이름 일부" };
    // (뺀 규칙) 「부번 없는 지번의 본번만 같으면 연결」: 실데이터 표본에서 「오화 ↔ 삼두아파트」 같은 엉뚱한 연결이 나와 쓰지 않는다
  }
  if (byName.length === 0) {
    // 2순위 보조: 정규화한 이름이 한쪽에 포함(짧은 쪽 3글자 이상)되는 단지가 법정동 안에 하나뿐
    const pn = sameDong.filter((k) => partial(k) && Math.min(nameKeys(k.kaptName).drop.length, nameKeys(tradeCx.name).drop.length) >= 3);
    if (pn.length === 1) return { kaptCode: pn[0].kaptCode, stage: 2, rule: "이름 일부" };
  }
  return { kaptCode: null, stage: 0, reason: byName.length > 1 ? "이름 같은 단지 여러 개" : sameDong.length ? "같은 법정동에 지번·이름 일치 없음" : "같은 법정동에 K-apt 단지 없음" };
}

// ───────── 4-2 ④ UTM-K(EPSG:5179) → WGS84 ─────────
// 도로명주소 좌표제공 API의 entX/entY(UTM-K, GRS80)를 위경도로 바꾼다.
// 횡메르카토르 역변환(Snyder 1987, USGS PP1395 식 8-12~8-25). 한국 범위에서 오차는 mm 수준.
export const UTMK = Object.freeze({ a: 6378137, f: 1 / 298.257222101, lat0: 38, lon0: 127.5, k0: 0.9996, x0: 1000000, y0: 2000000 });

export function tmInverse(x, y, P) {
  const { a, f, k0, x0, y0 } = P;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const M = (phi) => a * ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * phi
    - ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi)
    + ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi)
    - ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi));
  const M0 = M(rad(P.lat0));
  const Mv = M0 + (y - y0) / k0;
  const mu = Mv / (a * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 = mu + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) + ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const s1 = Math.sin(phi1), c1 = Math.cos(phi1), t1 = Math.tan(phi1);
  const C1 = ep2 * c1 * c1, T1 = t1 * t1;
  const N1 = a / Math.sqrt(1 - e2 * s1 * s1), R1 = (a * (1 - e2)) / (1 - e2 * s1 * s1) ** 1.5;
  const D = (x - x0) / (N1 * k0);
  const lat = phi1 - ((N1 * t1) / R1) * (D * D / 2 - ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4) / 24
    + ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6) / 720);
  const lon = rad(P.lon0) + (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5) / 120) / c1;
  return { lat: (lat * 180) / Math.PI, lng: (lon * 180) / Math.PI };
}
export const utmkToWgs84 = (x, y) => tmInverse(+x, +y, UTMK);

// ───────── 4-2 ④ 카카오 로컬 주소 검색 (P2-63a-2, 대표님 결정으로 좌표 출처 변경) ─────────
// 주소 검색에 넣기 전에 정리: 괄호 내용 제거, 지번(…동 876)·건물번호(…로 43) 뒤에 붙은 단지명 등은 잘라낸다
//  "경기도 군포시 금정동 876 군포율곡" → "경기도 군포시 금정동 876"
//  "경기도 군포시 오금로 43 (금정동, 군포율곡)" → "경기도 군포시 오금로 43"
export function cleanAddr(addr) {
  // 쉼표로 여러 주소가 이어진 경우(K-apt 「…오남리 632,경기도 … 683-40,…」 → 카카오 400)는 첫 주소만 쓴다
  const toks = String(addr || "").split(",")[0].replace(/\([^)]*\)/g, " ").replace(/[()]/g, " ").trim().split(/\s+/).filter(Boolean);
  const num = /^(산)?\d+(-\d*)?(번지)?$/;
  const head = /(동|리|가|로|길|읍|면)$/;
  for (let i = 1; i < toks.length; i++) {
    if (!num.test(toks[i])) continue;
    const prev = toks[i - 1] === "산" || toks[i - 1] === "지하" ? toks[i - 2] : toks[i - 1];
    if (prev && head.test(prev)) return toks.slice(0, i + 1).join(" ").replace(/번지$/, "").replace(/-$/, "");
  }
  return toks.join(" ");
}
// 카카오 주소 검색 응답(JSON) → { lat, lng, addr } 또는 null. 카카오는 WGS84(x=경도, y=위도)를 바로 준다(UTM-K 변환 없음)
// 한국 범위(위도 33~39, 경도 124~132)를 벗어난 결과는 쓰지 않는다
export function pickKakao(json) {
  const docs = json && Array.isArray(json.documents) ? json.documents : [];
  for (const d of docs) {
    const lng = +d.x, lat = +d.y;
    if (!(lat > 33 && lat < 39 && lng > 124 && lng < 132)) continue;
    const addr = (d.road_address && d.road_address.address_name) || (d.address && d.address.address_name) || d.address_name || "";
    return { lat: +lat.toFixed(6), lng: +lng.toFixed(6), addr };
  }
  return null;
}

// ───────── 3-1 최종 판정 ─────────
// cx: { households, stations:[stationsWithin 결과], rep: representativePrice 결과 }
// 결과: { ok:true, band } 또는 { ok:false, reason }
export function qualify(cx) {
  if (!(cx.households >= RULES.minHouseholds)) return { ok: false, reason: `세대수 ${cx.households ?? "모름"} (300 미만)` };
  if (!cx.rep) return { ok: false, reason: "12개월 안에 전용 40~60㎡ 중개 매매 0건" };
  const band = priceBand(cx.rep.price);
  if (!band) return { ok: false, reason: `대표가격 ${cx.rep.price}만원 (9억 이상)` };
  if (!cx.stations || !cx.stations.length) return { ok: false, reason: "직선 1km 안에 운행 중인 역 없음" };
  return { ok: true, band };
}
