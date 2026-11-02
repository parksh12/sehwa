/* 펭귄 툴즈 사주 계산 모듈 (P2-22)
 * - 브라우저와 Node 검증(build.mjs → content/saju.mjs, scripts/saju-verify.mjs)이 이 파일 하나를 그대로 씁니다.
 * - DOM·네트워크·저장소를 쓰지 않습니다. 같은 입력이면 항상 같은 결과가 나옵니다.
 * - 필요한 데이터: globalThis.SAJU_VSOP (vendor/saju-vsop87d-earth.js), globalThis.SAJU_LUNAR (vendor/saju-kr-lunar.js)
 * 계산 근거: 03.생산·개발팀 산출물 「P2-22_사주_계산법_조사.md」
 *   연·월주 = 출생 순간(UTC)과 12절 순간(UTC) 비교 (경도 보정 없음)
 *   일·시주 = 보정한 현지 시각 (보정 안 함 / 지방평균시(경도) / 진태양시(경도+균시차))
 *   절기 = 태양 시황경 (VSOP87D 지구 급수 + IAU1980 장동 + 광행차, Meeus 『Astronomical Algorithms』 25·32·22장)
 */
(function (G) {
  "use strict";
  const mod = (a, n) => ((a % n) + n) % n;
  const DEG = Math.PI / 180;

  // ---------- 기본 자료 ----------
  const STEM_H = "甲乙丙丁戊己庚辛壬癸".split(""), STEM_K = "갑을병정무기경신임계".split("");
  const BR_H = "子丑寅卯辰巳午未申酉戌亥".split(""), BR_K = "자축인묘진사오미신유술해".split("");
  const BR_ANIMAL = ["쥐", "소", "범", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"];
  const EL_K = ["목", "화", "토", "금", "수"], EL_H = ["木", "火", "土", "金", "水"];
  const stemEl = (s) => Math.floor(s / 2);
  const BR_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
  // 지장간 [여기, 중기, 정기] (조사 문서 §8-2 월률분야 표). null = 없음
  const HIDDEN = [[8, null, 9], [9, 7, 5], [4, 2, 0], [0, null, 1], [1, 9, 4], [4, 6, 2], [2, 5, 3], [3, 1, 5], [4, 8, 6], [6, null, 7], [7, 3, 4], [4, 0, 8]];
  const BR_MAIN = HIDDEN.map((h) => h[2]);
  const GOD = [["비견", "겁재"], ["식신", "상관"], ["편재", "정재"], ["편관", "정관"], ["편인", "정인"]];
  const GROUP = ["비겁", "식상", "재성", "관성", "인성"];
  const STAGE = ["장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양"];
  const STAGE_START = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3]; // 甲亥 乙午 丙寅 丁酉 戊寅 己酉 庚巳 辛子 壬申 癸卯
  const TERM_NAMES = ["소한", "대한", "입춘", "우수", "경칩", "춘분", "청명", "곡우", "입하", "소만", "망종", "하지", "소서", "대서", "입추", "처서", "백로", "추분", "한로", "상강", "입동", "소설", "대설", "동지"];

  const gz = (i) => ({ i: mod(i, 60), s: mod(i, 10), b: mod(i, 12) });
  const gzOf = (s, b) => gz(mod(6 * s - 5 * b, 60));
  const gzName = (g) => STEM_H[g.s] + BR_H[g.b];
  const gzKor = (g) => STEM_K[g.s] + BR_K[g.b];

  // ---------- 날짜 ----------
  // 그레고리력 → 율리우스 적일(정수, 그날 정오). Fliegel & Van Flandern (1968)
  function jdn(Y, M, D) {
    const a = Math.floor((14 - M) / 12), y = Y + 4800 - a, m = M + 12 * a - 3;
    return D + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  }
  function fromJdn(J) {
    const d = new Date((J - 2440588) * 86400000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  }
  const dayGz = (J) => gz(J - 11);
  const validYmd = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };
  const msToJd = (ms) => ms / 86400000 + 2440587.5;
  const jdToMs = (jd) => (jd - 2440587.5) * 86400000;

  // ---------- 천문: ΔT, 장동, 태양 시황경, 절기 ----------
  // ΔT(초) — Espenak & Meeus 다항식 (NASA Eclipse 웹사이트 "Polynomial Expressions for Delta T")
  function deltaT(y) {
    let t;
    if (y < 1860) { t = y - 1800; return 13.72 - 0.332447 * t + 0.0068612 * t * t + 0.0041116 * t ** 3 - 0.00037436 * t ** 4 + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7; }
    if (y < 1900) { t = y - 1860; return 7.62 + 0.5737 * t - 0.251754 * t * t + 0.01680668 * t ** 3 - 0.0004473624 * t ** 4 + t ** 5 / 233174; }
    if (y < 1920) { t = y - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4; }
    if (y < 1941) { t = y - 1920; return 21.2 + 0.84493 * t - 0.0761 * t * t + 0.0020936 * t ** 3; }
    if (y < 1961) { t = y - 1950; return 29.07 + 0.407 * t - t * t / 233 + t ** 3 / 2547; }
    if (y < 1986) { t = y - 1975; return 45.45 + 1.067 * t - t * t / 260 - t ** 3 / 718; }
    if (y < 2005) { t = y - 2000; return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5; }
    if (y < 2050) { t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
    const u = (y - 1820) / 100;
    if (y < 2150) return -20 + 32 * u * u - 0.5628 * (2150 - y);
    return -20 + 32 * u * u;
  }
  // 장동 Δψ(초각) — IAU 1980 (Meeus 표 22.A, 0.0003″ 미만 항 생략). 열: D M M' F Ω, 계수(0.0001″), T 계수
  const NUT = [
    [0, 0, 0, 0, 1, -171996, -174.2], [-2, 0, 0, 2, 2, -13187, -1.6], [0, 0, 0, 2, 2, -2274, -0.2], [0, 0, 0, 0, 2, 2062, 0.2], [0, 1, 0, 0, 0, 1426, -3.4], [0, 0, 1, 0, 0, 712, 0.1],
    [-2, 1, 0, 2, 2, -517, 1.2], [0, 0, 0, 2, 1, -386, -0.4], [0, 0, 1, 2, 2, -301, 0], [-2, -1, 0, 2, 2, 217, -0.5], [-2, 0, 1, 0, 0, -158, 0], [-2, 0, 0, 2, 1, 129, 0.1],
    [0, 0, -1, 2, 2, 123, 0], [2, 0, 0, 0, 0, 63, 0], [0, 0, 1, 0, 1, 63, 0.1], [2, 0, -1, 2, 2, -59, 0], [0, 0, -1, 0, 1, -58, -0.1], [0, 0, 1, 2, 1, -51, 0],
    [-2, 0, 2, 0, 0, 48, 0], [0, 0, -2, 2, 1, 46, 0], [2, 0, 0, 2, 2, -38, 0], [0, 0, 2, 2, 2, -31, 0], [0, 0, 2, 0, 0, 29, 0], [-2, 0, 1, 2, 2, 29, 0],
    [0, 0, 0, 2, 0, 26, 0], [-2, 0, 0, 2, 0, -22, 0], [0, 0, -1, 2, 1, 21, 0], [0, 2, 0, 0, 0, 17, -0.1], [2, 0, -1, 0, 1, 16, 0], [-2, 2, 0, 2, 2, -16, 0.1],
    [0, 1, 0, 0, 1, -15, 0], [-2, 0, 1, 0, 1, -13, 0], [0, -1, 0, 0, 1, -12, 0], [0, 0, 2, -2, 0, 11, 0], [2, 0, -1, 2, 1, -10, 0], [2, 0, 1, 2, 2, -8, 0],
    [0, 1, 0, 2, 2, 7, 0], [-2, 1, 1, 0, 0, -7, 0], [0, -1, 0, 2, 2, -7, 0], [2, 0, 0, 2, 1, -7, 0], [2, 0, 1, 0, 0, 6, 0], [-2, 0, 2, 2, 2, 6, 0],
    [-2, 0, 1, 2, 1, 6, 0], [2, 0, -2, 0, 1, -6, 0], [2, 0, 0, 0, 1, -6, 0], [0, -1, 1, 0, 0, 5, 0], [-2, -1, 0, 2, 1, -5, 0], [-2, 0, 0, 0, 1, -5, 0],
    [0, 0, 2, 2, 1, -5, 0], [-2, 0, 2, 0, 1, 4, 0], [-2, 1, 0, 2, 1, 4, 0], [0, 0, 1, -2, 0, 4, 0], [-1, 0, 1, 0, 0, -4, 0], [-2, 1, 0, 0, 0, -4, 0],
    [1, 0, 0, 0, 0, -4, 0], [0, 0, 1, 2, 0, 3, 0], [0, 0, -2, 2, 2, -3, 0], [-1, -1, 1, 0, 0, -3, 0], [0, 1, 1, 0, 0, -3, 0], [0, -1, 1, 2, 2, -3, 0],
    [2, -1, -1, 2, 2, -3, 0], [0, 0, 3, 2, 2, -3, 0], [2, -1, 0, 2, 2, -3, 0],
  ];
  const poly = (T, a) => a.reduce((s, c, i) => s + c * T ** i, 0);
  function nutLon(jde) {
    const T = (jde - 2451545) / 36525;
    const D = poly(T, [297.85036, 445267.11148, -0.0019142, 1 / 189474]) * DEG;
    const M = poly(T, [357.52772, 35999.05034, -0.0001603, -1 / 300000]) * DEG;
    const N = poly(T, [134.96298, 477198.867398, 0.0086972, 1 / 56250]) * DEG;
    const F = poly(T, [93.27191, 483202.017538, -0.0036825, 1 / 327270]) * DEG;
    const O = poly(T, [125.04452, -1934.136261, 0.0020708, 1 / 450000]) * DEG;
    let s = 0;
    for (let i = NUT.length - 1; i >= 0; i--) { const r = NUT[i]; s += Math.sin(r[0] * D + r[1] * M + r[2] * N + r[3] * F + r[4] * O) * (r[5] + r[6] * T); }
    return s * 0.0001;
  }
  function vsop(series, tau) {
    let sum = 0, tp = 1;
    for (const terms of series) { let x = 0; for (let i = 0; i < terms.length; i += 3) x += terms[i] * Math.cos(terms[i + 1] + terms[i + 2] * tau); sum += x * tp; tp *= tau; }
    return sum;
  }
  // 태양의 지심 시황경(도). jde = 역학시(TT) 율리우스일
  function sunLongitude(jde) {
    const V = G.SAJU_VSOP;
    if (!V) throw new Error("SAJU_VSOP 데이터가 없습니다");
    const tau = (jde - 2451545) / 365250;
    const L = vsop(V.L, tau), R = vsop(V.R, tau);
    let lon = L / DEG + 180; // 일심 황경 + 180°
    lon += (-0.09033 + nutLon(jde) - 20.4898 / R) / 3600; // FK5 보정 + 장동 + 광행차
    return mod(lon, 360);
  }
  // year년(양력)에 태양 황경이 lon°가 되는 순간 → UTC 밀리초
  const termCache = {};
  function termMs(year, lon) {
    const key = year + ":" + lon;
    if (termCache[key] !== undefined) return termCache[key];
    const off = lon >= 285 ? lon - 360 : lon; // 소한~경칩은 그해 춘분보다 앞
    let jde = jdn(year, 3, 20) + off * (365.2422 / 360);
    for (let i = 0; i < 40; i++) {
      const d = mod(lon - sunLongitude(jde) + 180, 360) - 180;
      jde += d * (365.2422 / 360);
      if (Math.abs(d) < 1e-8) break;
    }
    const yr = year + (off + 80) / 365.2422;
    const ms = Math.round(jdToMs(jde - deltaT(yr) / 86400));
    termCache[key] = ms;
    return ms;
  }
  // 그해 24절기 (소한부터). [{name, lon, ms, jeol}]
  function solarTerms(year) {
    return TERM_NAMES.map((name, k) => { const lon = mod(285 + 15 * k, 360); return { name, k, lon, jeol: k % 2 === 0, ms: termMs(year, lon) }; });
  }
  // 12절만 (월지: 소한→丑 … 대설→子)
  function jeols(year) {
    return solarTerms(year).filter((t) => t.jeol).map((t) => ({ ...t, branch: mod(1 + t.k / 2, 12) }));
  }
  // 출생 순간 앞뒤의 절
  function jeolAround(ms) {
    const y = new Date(ms + 9 * 3600000).getUTCFullYear();
    const all = [...jeols(y - 1), ...jeols(y), ...jeols(y + 1)];
    let i = all.length - 1;
    while (i > 0 && all[i].ms > ms) i--;
    return { prev: all[i], next: all[i + 1] };
  }

  // ---------- 한국 표준시·서머타임 (IANA tz Asia/Seoul, Rule ROK) ----------
  const wall = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi);
  const LMT = 8 * 60 + 27 + 52 / 60; // 8:27:52
  // [바뀌는 순간(UTC ms), 이후 표준 오프셋(분)]
  const STD = [
    [wall(1908, 4, 1) - LMT * 60000, 510],
    [wall(1912, 1, 1) - 510 * 60000, 540],
    [wall(1954, 3, 21) - 540 * 60000, 510],
    [wall(1961, 8, 10) - 510 * 60000, 540],
  ];
  // 서머타임 [시작(현지 표준시 벽시계), 끝(현지 서머타임 벽시계)] — 1시간 앞당김
  const DST_WALL = [
    [[1948, 6, 1, 0], [1948, 9, 13, 0]], [[1949, 4, 3, 0], [1949, 9, 11, 0]], [[1950, 4, 1, 0], [1950, 9, 10, 0]], [[1951, 5, 6, 0], [1951, 9, 9, 0]],
    [[1955, 5, 5, 0], [1955, 9, 9, 0]], [[1956, 5, 20, 0], [1956, 9, 30, 0]], [[1957, 5, 5, 0], [1957, 9, 22, 0]], [[1958, 5, 4, 0], [1958, 9, 21, 0]],
    [[1959, 5, 3, 0], [1959, 9, 20, 0]], [[1960, 5, 1, 0], [1960, 9, 18, 0]], [[1987, 5, 10, 2], [1987, 10, 11, 3]], [[1988, 5, 8, 2], [1988, 10, 9, 3]],
  ];
  function stdOffsetAt(ms) { let o = LMT; for (const [t, v] of STD) if (ms >= t) o = v; return o; }
  const DST = DST_WALL.map(([s, e]) => {
    const sw = wall(...s), ew = wall(...e);
    const so = stdOffsetAt(sw - 540 * 60000);
    return [sw - so * 60000, ew - (so + 60) * 60000];
  });
  const dstAt = (ms) => DST.some(([a, b]) => ms >= a && ms < b);
  const offsetAt = (ms) => stdOffsetAt(ms) + (dstAt(ms) ? 60 : 0);
  // 당시 벽시계 시각 → UTC. status: ok | gap(없는 시각) | overlap(두 번 있는 시각)
  function koreaToUtc(y, m, d, h, mi) {
    const w = wall(y, m, d, h, mi);
    const cands = [LMT, 510, 540, 570, 600].filter((o) => offsetAt(w - o * 60000) === o);
    if (cands.length === 1) { const o = cands[0]; return { ms: w - o * 60000, offset: o, dst: dstAt(w - o * 60000), status: "ok" }; }
    if (cands.length > 1) { const o = Math.min(...cands); return { ms: w - o * 60000, offset: o, dst: dstAt(w - o * 60000), status: "overlap" }; }
    // 없는 시각: 바뀌기 직전 오프셋으로 읽음(= 서머타임이면 1시간 뒤 시각으로 처리)
    const o = offsetAt(w - 600 * 60000 - 3 * 3600000);
    return { ms: w - o * 60000, offset: o, dst: false, status: "gap" };
  }

  // ---------- 균시차(분) — NOAA General Solar Position Calculations (Spencer 1971) ----------
  function equationOfTime(ms) {
    const d = new Date(ms), y = d.getUTCFullYear();
    const doy = (ms - Date.UTC(y, 0, 1)) / 86400000; // 0부터
    const days = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
    const g = (2 * Math.PI / days) * doy;
    return 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  }

  // ---------- 음력(한국) → 양력 ----------
  // SAJU_LUNAR.years[i] = [음력 설날의 JDN − base, 큰달 비트(윤달 포함 순서대로, 1=30일), 윤달(0=없음)]. KASI 음양력 자료로 만든 표
  function lunarYear(y) {
    const L = G.SAJU_LUNAR;
    if (!L) throw new Error("SAJU_LUNAR 데이터가 없습니다");
    const r = L.years[y - L.from];
    if (!r) return null;
    const months = [];
    let j = L.base + r[0], bit = 0;
    for (let mth = 1; mth <= 12; mth++) {
      for (const leap of r[2] === mth ? [false, true] : [false]) {
        if (bit >= r[3]) break;
        const len = (r[1] >> bit) & 1 ? 30 : 29;
        months.push({ m: mth, leap, start: j, len });
        j += len; bit++;
      }
    }
    return { y, leapMonth: r[2], months };
  }
  function lunarToSolar(y, m, d, leap) {
    const Y = lunarYear(y);
    if (!Y) return { error: "range" };
    if (leap && Y.leapMonth !== m) return { error: "noleap", leapMonth: Y.leapMonth };
    const mo = Y.months.find((x) => x.m === m && x.leap === !!leap);
    if (!mo) return { error: "range" };
    if (d < 1 || d > mo.len) return { error: "day", len: mo.len };
    return { ...fromJdn(mo.start + d - 1), jdn: mo.start + d - 1 };
  }
  function solarToLunar(y, m, d) {
    const L = G.SAJU_LUNAR, J = jdn(y, m, d);
    for (let ly = y; ly >= y - 1; ly--) {
      const Y = lunarYear(ly);
      if (!Y) continue;
      for (const mo of Y.months) if (J >= mo.start && J < mo.start + mo.len) return { y: ly, m: mo.m, d: J - mo.start + 1, leap: mo.leap };
    }
    return null;
  }

  // ---------- 십신·12운성·관계 ----------
  function tenGod(day, s) {
    const rel = mod(stemEl(s) - stemEl(day), 5);
    return { name: GOD[rel][day % 2 === s % 2 ? 0 : 1], group: rel };
  }
  function stage(day, b) {
    const S = STAGE_START[day];
    return STAGE[day % 2 === 0 ? mod(b - S, 12) : mod(S - b, 12)];
  }
  const POS = ["연", "월", "일", "시"];
  function relations(P) {
    const out = [];
    const idx = P.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
    for (let a = 0; a < idx.length; a++) for (let c = a + 1; c < idx.length; c++) {
      const i = idx[a], j = idx[c], s1 = P[i].s, s2 = P[j].s, b1 = P[i].b, b2 = P[j].b;
      const lo = Math.min(s1, s2), hi = Math.max(s1, s2);
      if (hi - lo === 5) out.push({ kind: "천간합", text: `${POS[i]}간 ${STEM_H[s1]}·${POS[j]}간 ${STEM_H[s2]} 합(${EL_K[mod(stemEl(lo) + 2, 5)]})`, at: [i, j], good: true });
      if (hi - lo === 6 && lo <= 3) out.push({ kind: "천간충", text: `${POS[i]}간 ${STEM_H[s1]}·${POS[j]}간 ${STEM_H[s2]} 충`, at: [i, j], good: false });
      if (mod(b1 + b2, 12) === 1) out.push({ kind: "육합", text: `${POS[i]}지 ${BR_H[b1]}·${POS[j]}지 ${BR_H[b2]} 육합`, at: [i, j], good: true });
      if (Math.abs(b1 - b2) === 6) out.push({ kind: "육충", text: `${POS[i]}지 ${BR_H[b1]}·${POS[j]}지 ${BR_H[b2]} 충`, at: [i, j], good: false });
    }
    const bs = new Set(idx.map((i) => P[i].b));
    [[8, 0, 4, "수"], [11, 3, 7, "목"], [2, 6, 10, "화"], [5, 9, 1, "금"]].forEach(([a, w, c, e]) => {
      const has = [a, w, c].filter((x) => bs.has(x));
      if (has.length === 3) out.push({ kind: "삼합", text: `${BR_H[a]}${BR_H[w]}${BR_H[c]} 삼합(${e})`, good: true });
      else if (has.length === 2 && bs.has(w)) out.push({ kind: "반합", text: `${has.map((x) => BR_H[x]).join("")} 반합(${e})`, good: true });
    });
    [[2, 3, 4, "목"], [5, 6, 7, "화"], [8, 9, 10, "금"], [11, 0, 1, "수"]].forEach(([a, b, c, e]) => {
      if ([a, b, c].every((x) => bs.has(x))) out.push({ kind: "방합", text: `${BR_H[a]}${BR_H[b]}${BR_H[c]} 방합(${e})`, good: true });
    });
    return out;
  }
  // 신강·신약 간이 점수 (조사 문서 §8-5, 이 서비스의 자체 기준)
  function strength(P) {
    const d = P[2].s, de = stemEl(d);
    const W = [["s", 0, 1], ["s", 1, 1], ["s", 3, 1], ["b", 0, 1], ["b", 1, 3], ["b", 2, 1.5], ["b", 3, 1]];
    let help = 0, total = 0;
    const parts = [];
    for (const [k, i, w] of W) {
      if (!P[i]) continue;
      const el = k === "s" ? stemEl(P[i].s) : BR_EL[P[i].b];
      const ok = el === de || mod(el + 1, 5) === de;
      total += w; if (ok) help += w;
      parts.push({ pos: POS[i] + (k === "s" ? "간" : "지"), w, ok });
    }
    const score = Math.round((help / total) * 1000) / 10;
    const label = score >= 65 ? "신강" : score >= 50 ? "중화(약간 강)" : score >= 35 ? "중화(약간 약)" : "신약";
    return { score, help, total, label, strong: score >= 50, parts };
  }

  // ---------- 메인 계산 ----------
  // opts: { calendar: "solar"|"lunar", y, m, d, leap, time: {h, mi}|null, gender: "m"|"f", lon: 경도|null(보정 안 함), eot: bool, jasi: "A"|"B"|"C" }
  const DEFAULTS = { calendar: "solar", leap: false, time: null, gender: "m", lon: null, eot: false, jasi: "A" };
  function calc(input) {
    const o = { ...DEFAULTS, ...input };
    let y = +o.y, m = +o.m, d = +o.d, lunar = null;
    if (o.calendar === "lunar") {
      const r = lunarToSolar(y, m, d, o.leap);
      if (r.error) return { error: r.error, detail: r };
      lunar = { y, m, d, leap: !!o.leap };
      y = r.y; m = r.m; d = r.d;
    } else if (!validYmd(y, m, d)) return { error: "date" };
    if (y < 1900 || y > 2100) return { error: "range" };
    if (!lunar && G.SAJU_LUNAR) lunar = solarToLunar(y, m, d);
    const known = !!o.time;
    const h = known ? +o.time.h : 12, mi = known ? +o.time.mi : 0;
    const conv = koreaToUtc(y, m, d, h, mi);
    const T = conv.ms;

    // 연·월주: 절대 시각
    const { prev, next } = jeolAround(T);
    const ipchun = termMs(new Date(T + 9 * 3600000).getUTCFullYear(), 315);
    let sajuYear = new Date(T + 9 * 3600000).getUTCFullYear();
    if (T < ipchun) sajuYear -= 1;
    // 1월 소한~입춘 구간 처리: 위 KST 연도 기준으로 입춘 전이면 전년
    const yearP = gz(sajuYear - 4);
    const k = mod(prev.branch - 2, 12);
    const monthP = gzOf(mod(yearP.s * 2 + 2 + k, 10), prev.branch);

    // 일·시주: 보정한 현지 시각
    let corr = 0, corrNote = "보정 안 함(당시 표준시, 서머타임만 뺌)";
    let localMs = T + stdOffsetAt(T) * 60000;
    if (o.lon != null && known) {
      const eot = o.eot ? equationOfTime(T) : 0;
      localMs = T + (o.lon * 4 + eot) * 60000;
      corr = Math.round((localMs - (T + stdOffsetAt(T) * 60000)) / 60000);
      corrNote = `${o.eot ? "진태양시" : "지방평균시"}(경도 ${o.lon.toFixed(2)}°${o.eot ? ", 균시차 " + eot.toFixed(1) + "분" : ""}) → 당시 표준시보다 ${corr >= 0 ? "+" : "−"}${Math.abs(corr)}분`;
    }
    const L = new Date(localMs);
    const ly = L.getUTCFullYear(), lm = L.getUTCMonth() + 1, ld = L.getUTCDate(), lh = L.getUTCHours(), lmi = L.getUTCMinutes();
    let J = jdn(ly, lm, ld);
    let hourP = null, late = known && lh >= 23;
    if (known && late && o.jasi === "A") J += 1;
    const dayP = dayGz(J);
    if (known) {
      const hb = mod(Math.floor((lh + lmi / 60 + 1) / 2), 12);
      const stemDay = late && o.jasi === "B" ? dayGz(J + 1).s : dayP.s;
      hourP = gzOf(mod(stemDay * 2 + hb, 10), hb);
    }
    const P = [yearP, monthP, dayP, hourP];

    // 해석 요소
    const day = dayP.s;
    const pillars = P.map((p, i) => p && {
      pos: POS[i], ...p, name: gzName(p), kor: gzKor(p),
      stemEl: stemEl(p.s), brEl: BR_EL[p.b],
      stemGod: i === 2 ? { name: "일간(나)", group: 0 } : tenGod(day, p.s),
      brGod: tenGod(day, BR_MAIN[p.b]),
      hidden: HIDDEN[p.b].map((s) => (s == null ? null : { s, h: STEM_H[s], k: STEM_K[s], god: tenGod(day, s).name })),
      stage: stage(day, p.b),
    });
    const elements = [0, 0, 0, 0, 0];
    P.forEach((p) => { if (p) { elements[stemEl(p.s)]++; elements[BR_EL[p.b]]++; } });
    const groups = [0, 0, 0, 0, 0];
    P.forEach((p, i) => { if (!p) return; if (i !== 2) groups[tenGod(day, p.s).group]++; groups[tenGod(day, BR_MAIN[p.b]).group]++; });

    // 대운
    const yangYear = yearP.s % 2 === 0;
    const forward = (yangYear && o.gender === "m") || (!yangYear && o.gender === "f");
    const spanDays = forward ? (next.ms - T) / 86400000 : (T - prev.ms) / 86400000;
    const exactYears = spanDays / 3;
    let num = Math.round(exactYears);
    if (num < 1) num = 1;
    if (num > 10) num = 10;
    const totalMonths = Math.round(spanDays * 4); // 1일 = 4개월
    const startMs = T + exactYears * 365.2422 * 86400000;
    const daeun = [];
    for (let i = 0; i < 10; i++) {
      const g = gz(monthP.i + (forward ? i + 1 : -(i + 1)));
      const from = new Date(startMs + i * 10 * 365.2422 * 86400000).getUTCFullYear();
      daeun.push({ ...g, name: gzName(g), kor: gzKor(g), age: num + i * 10, from, stemGod: tenGod(day, g.s).name, brGod: tenGod(day, BR_MAIN[g.b]).name, stemGroup: tenGod(day, g.s).group, brGroup: tenGod(day, BR_MAIN[g.b]).group });
    }

    const near = Math.min(Math.abs(T - prev.ms), Math.abs(next.ms - T)) <= 2 * 60000 || (known && Math.abs(T - ipchun) <= 2 * 60000);
    return {
      input: { ...o, solar: { y, m, d }, lunar, known },
      utc: T, offset: conv.offset, dst: conv.dst, status: conv.status,
      local: { y: ly, m: lm, d: ld, h: lh, mi: lmi }, corr, corrNote,
      sajuYear, pillars, elements, groups,
      strength: strength(P), relations: relations(P),
      jeol: { prev: { name: prev.name, ms: prev.ms }, next: { name: next.name, ms: next.ms } },
      nearBoundary: near,
      daeun: { forward, spanDays, exactYears, num, years: Math.floor(totalMonths / 12), months: totalMonths % 12, startYear: new Date(startMs).getUTCFullYear(), list: daeun },
      notKnownTime: !known,
    };
  }
  // 세운(그해 입춘 이후 간지)과 그해에 해당하는 대운
  function yearLuck(res, year) {
    const g = gz(year - 4), day = res.pillars[2].s;
    const mid = Date.UTC(year, 6, 1);
    let cur = null;
    for (const dw of res.daeun.list) {
      const startMs = res.utc + (res.daeun.exactYears + (dw.age - res.daeun.num)) * 365.2422 * 86400000;
      if (startMs <= mid) cur = dw;
    }
    const rel = [];
    res.pillars.forEach((p, i) => {
      if (!p) return;
      if (Math.abs(p.b - g.b) === 6) rel.push({ kind: "충", pos: i, text: `세운 ${BR_H[g.b]}과 ${POS[i]}지 ${BR_H[p.b]} 충` });
      if (mod(p.b + g.b, 12) === 1) rel.push({ kind: "합", pos: i, text: `세운 ${BR_H[g.b]}과 ${POS[i]}지 ${BR_H[p.b]} 육합` });
    });
    return { year, ...g, name: gzName(g), kor: gzKor(g), stemGod: tenGod(day, g.s), brGod: tenGod(day, BR_MAIN[g.b]), daeun: cur, rel };
  }

  const SAJU = {
    STEM_H, STEM_K, BR_H, BR_K, BR_ANIMAL, EL_K, EL_H, BR_EL, HIDDEN, GROUP, STAGE, TERM_NAMES,
    mod, gz, gzOf, gzName, gzKor, stemEl, jdn, fromJdn, dayGz, validYmd, msToJd, jdToMs,
    deltaT, nutLon, sunLongitude, termMs, solarTerms, jeols, jeolAround,
    koreaToUtc, offsetAt, stdOffsetAt, dstAt, equationOfTime,
    lunarYear, lunarToSolar, solarToLunar,
    tenGod, stage, relations, strength, calc, yearLuck,
  };
  G.SAJU = SAJU;
  if (typeof module === "object" && module.exports) module.exports = SAJU;
})(typeof globalThis !== "undefined" ? globalThis : this);
