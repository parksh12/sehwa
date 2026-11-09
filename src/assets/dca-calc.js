// P2-52 SOXL·TQQQ·KORU 적립식 백테스트 계산식 한 벌. 화면(t-dca.js)과 빌드의 손계산·독립 계산 대조(build.mjs, vm)가 같은 파일을 씀.
// 가정: 매달 첫 거래일 종가에 매달 투자금 전부를 산다(소수 주식). 수수료·세금·배당·환율 변동은 넣지 않음. 입력값은 저장하거나 전송하지 않음.
// 데이터 풀기(decode)는 t-stock.js 로더(P2-50c 정수 열 형식)에서 종가·날짜 부분만 옮겨 온 복사본(t-stock.js는 건드리지 않음).
(function (root) {
  const DAY = 864e5;
  // stock-<티커>.json(v2) → { d:[YYYY-MM-DD], dn:[1970-01-01부터 일수], c:[종가] }
  function decode(j) {
    const n = j.c.length, d = new Array(n), dn = new Array(n), c = new Array(n);
    let day = Date.parse(j.d0 + "T00:00:00Z") / DAY, ci = 0;
    for (let i = 0; i < n; i++) {
      if (i) day += j.g[i - 1];
      d[i] = new Date(day * DAY).toISOString().slice(0, 10); dn[i] = day;
      ci += j.c[i]; c[i] = ci / j.k;
    }
    return { d, dn, c };
  }
  const ym = (s) => s.slice(0, 7);
  // 연환산 수익률(XIRR): 매달 넣은 돈(−)과 마지막 날 평가액(+)의 현재가치 합이 0이 되는 연 수익률 r. Σ 금액 × (1 + r)^(−경과일/365) = 0, 이분법
  function xirr(flows) {
    if (flows.length < 2) return null;
    const t0 = flows[0].t;
    const npv = (r) => flows.reduce((s, f) => s + f.v * Math.pow(1 + r, -(f.t - t0) / 365), 0);
    let lo = -0.9999, hi = 100;
    let flo = npv(lo), fhi = npv(hi);
    if (!(flo * fhi < 0)) return null;
    for (let k = 0; k < 300; k++) {
      const mid = (lo + hi) / 2, fm = npv(mid);
      if (fm === 0) return mid;
      if (fm * flo < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
      if (hi - lo < 1e-13) break;
    }
    return (lo + hi) / 2;
  }
  // 적립식 백테스트. D = decode 결과, start·end = "YYYY-MM", amt = 매달 투자금(달러)
  // 매수일: start~end 각 달의 첫 거래일(데이터의 그달 첫 날짜, 상장한 달은 상장일). 평가 마지막 날: end 달의 마지막 거래일(데이터 끝이면 기준일)
  function run(D, { start, end, amt }) {
    if (!(amt > 0) || !start || !end || start > end) return { err: "input" };
    const n = D.c.length;
    let s = -1, e = -1;
    for (let i = 0; i < n; i++) { const m = ym(D.d[i]); if (m >= start && s < 0) s = i; if (m <= end) e = i; else break; }
    if (s < 0 || e < s) return { err: "range" };
    const buys = [], val = [], inv = [], lump = [], idx = [];
    let sh = 0, cost = 0;
    // 거치식: 적립식 총 투자금과 같은 금액을 첫 매수일 종가에 한 번에
    for (let i = s; i <= e; i++) if (i === s || ym(D.d[i]) !== ym(D.d[i - 1])) buys.push(i);
    const total = amt * buys.length, lsh = total / D.c[s];
    let peak = 0, mdd = 0, pk = s, mPk = s, mTr = s, low = 0, lowI = s;
    let lpeak = 0, lmdd = 0, lpk = s, lmPk = s, lmTr = s;
    const flows = [];
    let b = 0;
    for (let i = s; i <= e; i++) {
      if (b < buys.length && buys[b] === i) { sh += amt / D.c[i]; cost += amt; flows.push({ t: D.dn[i], v: -amt }); b++; }
      const v = sh * D.c[i], lv = lsh * D.c[i];
      idx.push(i); val.push(v); inv.push(cost); lump.push(lv);
      // 최대 낙폭(MDD, 평가액 기준): 평가액이 그때까지의 최고 평가액에서 가장 많이 줄어든 비율(중간에 넣은 돈도 평가액에 포함)
      if (v > peak) { peak = v; pk = i; }
      const dd = v / peak - 1; if (dd < mdd) { mdd = dd; mPk = pk; mTr = i; }
      const r = v / cost - 1; if (r < low) { low = r; lowI = i; }
      if (lv > lpeak) { lpeak = lv; lpk = i; }
      const ld = lv / lpeak - 1; if (ld < lmdd) { lmdd = ld; lmPk = lpk; lmTr = i; }
    }
    const value = sh * D.c[e], lvalue = lsh * D.c[e], days = D.dn[e] - D.dn[s];
    flows.push({ t: D.dn[e], v: value });
    // 연도별: 그해 마지막 거래일(범위 안) 기준
    const years = [];
    let prevInv = 0, prevC = D.c[s], prevLv = total;
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k], y = D.d[i].slice(0, 4);
      if (k === idx.length - 1 || D.d[idx[k + 1]].slice(0, 4) !== y) {
        years.push({ y: +y, last: D.d[i], add: inv[k] - prevInv, inv: inv[k], value: val[k], rate: val[k] / inv[k] - 1, price: D.c[i], move: D.c[i] / prevC - 1, lump: lump[k], lmove: lump[k] / prevLv - 1 });
        prevInv = inv[k]; prevC = D.c[i]; prevLv = lump[k];
      }
    }
    const yrs = days / 365;
    return {
      s, e, first: D.d[s], last: D.d[e], days, n: buys.length, amt, buys,
      inv: cost, shares: sh, avg: cost / sh, value, pnl: value - cost, rate: value / cost - 1,
      irr: days >= 365 ? xirr(flows) : null, // 1년 미만이면 연환산하지 않음
      mdd, mddPeak: D.d[mPk], mddTrough: D.d[mTr], low, lowDate: D.d[lowI],
      lump: { inv: total, shares: lsh, value: lvalue, pnl: lvalue - total, rate: lvalue / total - 1, cagr: days >= 365 ? Math.pow(lvalue / total, 365 / days) - 1 : null, mdd: lmdd, mddPeak: D.d[lmPk], mddTrough: D.d[lmTr] },
      years, series: { idx, val, inv, lump }, yrs
    };
  }
  root.DCACALC = { decode, run, xirr };
})(typeof window !== "undefined" ? window : globalThis);
