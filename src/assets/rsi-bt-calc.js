// P2-54 RSI 매매 백테스트 계산식 한 벌. 화면(t-rsibt.js)과 빌드의 손계산·독립 계산·미래 정보 대조(build.mjs, vm)가 같은 파일을 씀.
// 데이터 풀기(decode)·봉 묶기(bars)·RSI(와일더)는 t-stock.js(P2-50c)의 해당 부분을 옮겨 온 복사본(t-stock.js·dca-calc.js는 건드리지 않음). RSI는 기간 n을 받게 일반화(n = 14면 t-stock.js와 같음).
// 가정: 신호는 그 봉 종가로 계산한 RSI, 체결도 그 봉 종가. 전액 매수·전량 매도(소수 주식). 보유 중 매수 신호는 무시, 한 봉에 한 번만 사고팖. 입력값은 저장하거나 전송하지 않음.
(function (root) {
  const DAY = 864e5;
  // stock-<티커>.json(v2) → { d:[YYYY-MM-DD], dn:[1970-01-01부터 일수], c, o, h, l }
  // 종가 = 차분 누적, 시가 = 종가 + o, 고가 = max(시가, 종가) + h, 저가 = min(시가, 종가) − l (÷k)
  function decode(j) {
    const n = j.c.length, d = new Array(n), dn = new Array(n), c = new Array(n), o = new Array(n), h = new Array(n), l = new Array(n);
    let day = Date.parse(j.d0 + "T00:00:00Z") / DAY, ci = 0;
    for (let i = 0; i < n; i++) {
      if (i) day += j.g[i - 1];
      d[i] = new Date(day * DAY).toISOString().slice(0, 10); dn[i] = day;
      ci += j.c[i]; const oi = ci + j.o[i];
      c[i] = ci / j.k; o[i] = oi / j.k; h[i] = (Math.max(oi, ci) + j.h[i]) / j.k; l[i] = (Math.min(oi, ci) - j.l[i]) / j.k;
    }
    return { d, dn, c, o, h, l };
  }
  // 봉 만들기: 일봉은 하루가 봉 1개, 주봉은 달력 주(월~일)로 묶음. 일 인덱스 [a, b]만 씀 → b 뒤 날짜는 보지 않음
  function bars(D, a, b, weekly) {
    const out = [];
    for (let i = a; i <= b; i++) {
      const k = weekly ? Math.floor((D.dn[i] + 3) / 7) : i; // dn = 1970-01-01(목)부터 일수 → +3이면 월요일에 주가 바뀜
      const p = out[out.length - 1];
      if (p && p.k === k) { p.h = Math.max(p.h, D.h[i]); p.l = Math.min(p.l, D.l[i]); p.c = D.c[i]; p.e = i; }
      else out.push({ k, o: D.o[i], h: D.h[i], l: D.l[i], c: D.c[i], s: i, e: i });
    }
    return out;
  }
  // RSI(n), 와일더 방식: 첫 n개 변화의 단순 평균 → 이후 (이전 × (n − 1) + 이번) ÷ n. 배열 길이 그대로(앞 n개는 null). 평균 하락이 0이면 100
  function rsi(cl, n = 14) {
    const out = new Array(cl.length).fill(null); let ag = 0, al = 0;
    const v = () => (al === 0 ? 100 : 100 - 100 / (1 + ag / al));
    for (let i = 1; i < cl.length; i++) {
      const ch = cl[i] - cl[i - 1], g = ch > 0 ? ch : 0, l = ch < 0 ? -ch : 0;
      if (i <= n) { ag += g; al += l; if (i === n) { ag /= n; al /= n; out[i] = v(); } }
      else { ag = (ag * (n - 1) + g) / n; al = (al * (n - 1) + l) / n; out[i] = v(); }
    }
    return out;
  }
  const ym = (s) => s.slice(0, 7);
  // RSI 매매 백테스트. D = decode 결과, start·end = "YYYY-MM"
  // o: weekly(주봉), n(RSI 기간), buy(RSI ≤ buy면 매수), sell(RSI ≥ sell이면 매도), stop(손절 비율 0.1 = −10%, 없으면 null), fee(한 번 사고팔 때마다 비율), cap(초기 자금 달러)
  // RSI는 상장일부터 끝 연월 마지막 거래일까지의 봉으로 계산(시작 연월 앞 가격은 RSI 준비에만 씀). 매매는 시작~끝 연월 안의 봉에서만
  function run(D, { start, end, weekly = false, n = 14, buy = 30, sell = 70, stop = null, fee = 0, cap = 10000 }) {
    if (!start || !end || start > end) return { err: "input" };
    if (!(n >= 2 && n <= 100 && Number.isInteger(n)) || !(buy >= 0 && sell <= 100 && buy < sell) || !(cap > 0) || !(fee >= 0 && fee < 0.1) || (stop != null && !(stop > 0 && stop < 1))) return { err: "input" };
    const N = D.c.length;
    let s = -1, e = -1;
    for (let i = 0; i < N; i++) { const m = ym(D.d[i]); if (m >= start && s < 0) s = i; if (m <= end) e = i; else break; }
    if (s < 0 || e < s) return { err: "range" };
    const all = bars(D, 0, e, weekly), R = rsi(all.map((b) => b.c), n);
    let b0 = 0; while (all[b0].e < s) b0++; // 마감(종가) 날이 시작 연월 안에 있는 첫 봉부터
    const B = all.slice(b0), rs = R.slice(b0), M = B.length;
    let cash = cap, sh = 0, open = null;
    const trades = [], eq = new Array(M), hold = new Array(M), pos = new Array(M);
    const hsh = (cap * (1 - fee)) / B[0].c; // 그냥 보유: 첫 봉 종가에 전액 매수(매수 수수료 1번), 끝까지 보유
    let held = 0;
    for (let k = 0; k < M; k++) {
      const p = B[k].c, r = rs[k];
      if (sh > 0) {
        // 보유 중: 손절(종가가 매수가 대비 −stop 이하) → RSI ≥ 매도 기준 순서로 확인, 그 봉 종가에 전량 매도
        const why = stop != null && p <= open.pin * (1 - stop) ? "stop" : r != null && r >= sell ? "rsi" : null;
        if (why) {
          cash = sh * p * (1 - fee);
          trades.push({ ...open, xk: k, xd: D.d[B[k].e], pout: p, rout: r, why, out: cash, ret: cash / open.in - 1, bars: k - open.ek, days: D.dn[B[k].e] - D.dn[B[open.ek].e] });
          sh = 0; open = null;
        }
      } else if (r != null && r <= buy) {
        // 현금: RSI ≤ 매수 기준이면 그 봉 종가에 전액 매수. 같은 봉에서 판 뒤 다시 사지는 않음(위 if에서 걸러짐)
        sh = (cash * (1 - fee)) / p;
        open = { ek: k, ed: D.d[B[k].e], pin: p, rin: r, in: cash };
        cash = 0;
      }
      eq[k] = cash + sh * p; hold[k] = hsh * p; pos[k] = sh > 0;
      if (sh > 0) held++;
    }
    const last = M - 1;
    if (open) trades.push({ ...open, xk: null, xd: null, pout: B[last].c, rout: rs[last], why: "open", out: sh * B[last].c, ret: (sh * B[last].c) / open.in - 1, bars: last - open.ek, days: D.dn[B[last].e] - D.dn[B[open.ek].e] }); // 미청산: 마지막 종가로 평가(매도 수수료 미차감)
    // 최대 낙폭(MDD): 봉 종가 기준 자산이 그때까지의 최고 자산에서 가장 많이 줄어든 비율
    const mddOf = (v) => { let pk = v[0], pi = 0, m = 0, a = 0, b = 0; for (let k = 0; k < v.length; k++) { if (v[k] > pk) { pk = v[k]; pi = k; } const dd = v[k] / pk - 1; if (dd < m) { m = dd; a = pi; b = k; } } return { mdd: m, a, b }; };
    const sm = mddOf(eq), hm = mddOf(hold);
    const closed = trades.filter((t) => t.why !== "open");
    const wins = closed.filter((t) => t.ret > 0).length;
    const days = D.dn[B[last].e] - D.dn[B[0].e];
    const value = eq[last], hvalue = hold[last];
    return {
      first: D.d[B[0].e], last: D.d[B[last].e], days, weekly, n, buy, sell, stop, fee, cap,
      bars: M, trades, closed: closed.length, open: !!open, wins,
      winRate: closed.length ? wins / closed.length : null, // 승률: 청산된 거래 중 수익(> 0)으로 끝난 비율
      value, rate: value / cap - 1, cagr: days >= 365 ? Math.pow(value / cap, 365 / days) - 1 : null,
      hvalue, hrate: hvalue / cap - 1, hcagr: days >= 365 ? Math.pow(hvalue / cap, 365 / days) - 1 : null,
      mdd: sm.mdd, mddPeak: D.d[B[sm.a].e], mddTrough: D.d[B[sm.b].e], hmdd: hm.mdd, hmddPeak: D.d[B[hm.a].e], hmddTrough: D.d[B[hm.b].e],
      avgDays: closed.length ? closed.reduce((a, t) => a + t.days, 0) / closed.length : null, // 평균 보유 기간: 청산된 거래의 매수일 → 매도일 달력 일수 평균
      avgBars: closed.length ? closed.reduce((a, t) => a + t.bars, 0) / closed.length : null,
      expo: held / M, // 시장에 있던 비율(보유한 봉 ÷ 전체 봉)
      series: { B, rsi: rs, eq, hold, pos }
    };
  }
  root.RSIBT = { decode, bars, rsi, run };
})(typeof window !== "undefined" ? window : globalThis);
