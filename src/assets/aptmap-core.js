// P2-63b 역세권 아파트 지도: 화면과 상관없는 순수 계산(필터·배지·가격 표기·주소 상태)
// 기준: 부동산투자\아파트지도_업무요청서.md v2 3장, 5-4. 도보·배지 식은 scripts/aptmap/logic.mjs와 같고, build.mjs가 빌드 때마다 대조한다.
(function (root) {
  "use strict";
  const RULES = { walk10M: 500, stationMaxM: 1000, walkFactor: 1.3, walkMPerMin: 67 };
  // 가격대(요청서 3-3). m: 마커·칩 안 숫자(색만으로 구분하지 않음)
  const BANDS = [
    { k: "p1", n: "2억 미만", m: "2↓" },
    { k: "p2", n: "2억대", m: "2" },
    { k: "p3", n: "3억대", m: "3" },
    { k: "p4", n: "4억대", m: "4" },
    { k: "p5", n: "5억대", m: "5" },
    { k: "p6", n: "6억대", m: "6" },
    { k: "p7", n: "7억대", m: "7" },
    { k: "p8", n: "8억대", m: "8" },
  ];
  const BAND_KEYS = BANDS.map((b) => b.k);
  const BUILT = [
    { v: 1990, n: "1990년 이후" },
    { v: 2000, n: "2000년 이후" },
    { v: 2010, n: "2010년 이후" },
    { v: 2020, n: "2020년 이후" },
  ];
  const SORTS = { price: "가격 낮은 순", dist: "역 가까운 순", built: "최신 준공 순" };

  const walkMin = (d) => Math.round((d * RULES.walkFactor) / RULES.walkMPerMin);
  const isWalk10 = (d) => d <= RULES.walk10M; // 경계 500m 포함
  const badge = (d) => (isWalk10(d) ? "도보 10분 역세권" : `역까지 도보 약 ${walkMin(d)}분`);
  // 가격대(만원) — 경계값은 위 구간(정확히 3억 → p3). 9억 이상·0 이하는 null
  const bandOf = (p) => (p > 0 && p < 90000 ? (p < 20000 ? "p1" : `p${Math.floor(p / 10000)}`) : null);

  const comma = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  // 37500 → 「3억 7,500만」, 30000 → 「3억」, 8000 → 「8,000만」
  function fmtPrice(p) {
    const e = Math.floor(p / 10000), r = p % 10000;
    if (!e) return `${comma(r)}만`;
    return r ? `${e}억 ${comma(r)}만` : `${e}억`;
  }
  // 39500 → 「3.95억」, 8000 → 「8,000만」
  function fmtShort(p) {
    if (p < 10000) return `${comma(p)}만`;
    return `${(Math.round(p / 100) / 100).toFixed(2).replace(/\.?0+$/, "")}억`;
  }
  const fmtDist = (d) => (d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${d}m`);
  const stName = (n) => (/역$/.test(n) ? n : `${n}역`);

  // 필터 상태 → 단지 하나가 통과하는지. s = { p: Set(밴드), sido, line, built, walk10 }
  function pass(c, s) {
    if (!s.p.has(c.band)) return false;
    if (s.sido && c.sido !== s.sido) return false;
    if (s.built && !(c.built >= s.built)) return false;
    const lim = s.walk10 ? RULES.walk10M : RULES.stationMaxM;
    if (s.walk10 && !isWalk10(c.st[0].d)) return false;
    if (s.line && !c.st.some((x) => x.d <= lim && x.l.includes(s.line))) return false;
    return true;
  }
  const CMP = {
    price: (a, b) => a.price - b.price || a.st[0].d - b.st[0].d,
    dist: (a, b) => a.st[0].d - b.st[0].d || a.price - b.price,
    built: (a, b) => b.built - a.built || a.price - b.price,
  };

  const DEFAULT = () => ({ p: new Set(BAND_KEYS), sido: "", line: "", built: 0, walk10: false, sort: "price", c: "", m: null });
  // 주소 → 상태. 예: ?p=p3,p4&sido=41&line=4호선&walk10=1
  function parse(search) {
    const q = new URLSearchParams(search || "");
    const s = DEFAULT();
    if (q.has("p")) {
      const ks = q.get("p").split(",").map((x) => x.trim()).filter((x) => BAND_KEYS.includes(x));
      if (ks.length) s.p = new Set(ks);
    }
    if (/^\d{2}$/.test(q.get("sido") || "")) s.sido = q.get("sido");
    if (q.get("line")) s.line = q.get("line").slice(0, 30);
    const b = +q.get("built");
    if (BUILT.some((x) => x.v === b)) s.built = b;
    s.walk10 = q.get("walk10") === "1";
    if (SORTS[q.get("sort")]) s.sort = q.get("sort");
    if (/^[\w-]{3,24}$/.test(q.get("c") || "")) s.c = q.get("c");
    const m = (q.get("m") || "").split(",").map(Number);
    if (m.length === 3 && m.every(Number.isFinite) && m[0] > 32 && m[0] < 39.5 && m[1] > 124 && m[1] < 132 && m[2] >= 1 && m[2] <= 14) s.m = { lat: m[0], lng: m[1], z: Math.round(m[2]) };
    return s;
  }
  // 상태 → 주소 query(기본값은 생략). URLSearchParams를 쓰지 않아 쉼표가 그대로 보임
  function query(s, { withCard = true, withMap = true } = {}) {
    const out = [];
    const enc = (v) => encodeURIComponent(v).replace(/%2C/g, ",");
    if (s.p.size !== BAND_KEYS.length) out.push(`p=${BAND_KEYS.filter((k) => s.p.has(k)).join(",")}`);
    if (s.sido) out.push(`sido=${s.sido}`);
    if (s.line) out.push(`line=${enc(s.line)}`);
    if (s.built) out.push(`built=${s.built}`);
    if (s.walk10) out.push("walk10=1");
    if (s.sort !== "price") out.push(`sort=${s.sort}`);
    if (withCard && s.c) out.push(`c=${s.c}`);
    if (withMap && s.m) out.push(`m=${s.m.lat.toFixed(5)},${s.m.lng.toFixed(5)},${s.m.z}`);
    return out.length ? `?${out.join("&")}` : "";
  }

  // 빌드 데이터(짧은 키 배열) → 화면용 객체
  function inflate(d) {
    const lines = d.lines;
    return d.c.map((r, i) => ({
      i, id: r[0], name: r[1], sido: String(r[2]), sgg: r[3], dong: r[4], lat: r[5], lng: r[6], hh: r[7], built: r[8], price: r[9],
      band: `p${r[10]}`, basis: r[11], n: r[12], low: !!r[13],
      st: r[14].map((x) => ({ n: x[0], l: x[1].map((k) => lines[k]), d: x[2] })),
      rc: r[15].map((x) => ({ date: `${x[0].slice(0, 2)}.${x[0].slice(2, 4)}.${x[0].slice(4, 6)}`, area: x[1], floor: x[2], price: x[3] })),
    }));
  }

  root.AptCore = { RULES, BANDS, BAND_KEYS, BUILT, SORTS, walkMin, isWalk10, badge, bandOf, fmtPrice, fmtShort, fmtDist, stName, pass, CMP, DEFAULT, parse, query, inflate };
})(typeof window !== "undefined" ? window : globalThis);
