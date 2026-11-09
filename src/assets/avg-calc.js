// P2-51 물타기 계산기(평단가 계산) 계산식 한 벌. 화면(t-avg.js)과 빌드의 예시 표(build.mjs, vm)가 같은 파일을 씀.
// 수수료·세금·환율은 넣지 않음. 입력값은 저장하거나 전송하지 않음.
(function (root) {
  const ok = (n) => typeof n === "number" && isFinite(n);
  // 순방향: 보유(평단 avg × 수량 qty) + 추가 매수 buys[{ p, q }] → 새 평단, 총 수량, 총 투자금, (현재가 cur가 있으면) 평가손익·수익률
  function forward({ avg, qty, buys = [], cur = null }) {
    if (!ok(avg) || !ok(qty) || avg < 0 || qty < 0) return { err: "hold" };
    const rows = buys.filter((b) => ok(b.p) && ok(b.q) && b.p > 0 && b.q > 0);
    let cost = avg * qty, n = qty;
    const steps = [];
    for (const b of rows) {
      cost += b.p * b.q; n += b.q;
      steps.push({ p: b.p, q: b.q, amt: b.p * b.q, cost, qty: n, avg: cost / n });
    }
    if (!(n > 0)) return { err: "qty" };
    const r = { before: { avg: qty > 0 ? avg : null, qty, cost: avg * qty }, add: { qty: n - qty, cost: cost - avg * qty }, steps, qty: n, cost, avg: cost / n };
    r.drop = qty > 0 && avg > 0 ? (r.avg - avg) / avg : null; // 평단 변화율(음수면 낮아짐)
    if (ok(cur) && cur > 0) {
      r.cur = cur;
      r.value = cur * n;
      r.pnl = r.value - cost;
      r.rate = cost > 0 ? r.pnl / cost : null;
      r.need = r.avg / cur - 1; // 본전까지 현재가에서 필요한 상승률
      if (qty > 0 && avg > 0) { r.before.pnl = (cur - avg) * qty; r.before.rate = cur / avg - 1; r.before.need = avg / cur - 1; }
    }
    return r;
  }
  // 역계산: 보유(평단 avg × 수량 qty)에서 현재가 cur로 사서 평단을 target으로 맞추려면 몇 주? n = qty × (avg − target) ÷ (target − cur)
  // frac=false면 정수 주로 올림(그 결과 평단은 목표보다 조금 낮아짐)
  function reverse({ avg, qty, target, cur, frac = false, dp = 6 }) {
    if (![avg, qty, target, cur].every(ok) || avg <= 0 || qty <= 0 || target <= 0 || cur <= 0) return { err: "input" };
    if (target >= avg) return { err: "already" }; // 이미 목표 이하
    if (cur >= target) return { err: "impossible" }; // 현재가가 목표 평단 이상이면 아무리 사도 목표에 못 닿음
    const exact = (qty * (avg - target)) / (target - cur);
    const f = Math.pow(10, dp);
    const n = frac ? Math.ceil(exact * f - 1e-7) / f : Math.ceil(exact - 1e-9);
    const amt = n * cur, cost = avg * qty + amt, total = qty + n;
    return { exact, n, amt, qty: total, cost, avg: cost / total, frac };
  }
  root.AVGCALC = { forward, reverse };
})(typeof window !== "undefined" ? window : globalThis);
