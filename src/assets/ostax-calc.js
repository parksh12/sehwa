// P2-53 해외주식 양도소득세 계산기 계산식 한 벌. 화면(t-ostax.js)과 빌드의 대조 표(build.mjs, vm)가 같은 파일을 씀.
// 요율은 content/tax-overseas-2026.mjs(페이지의 #ostax-rates JSON)에서 받음. 입력값은 저장하거나 전송하지 않음.
// 흐름: 종목별(매수·매도 금액, 달러면 각 결제일 환율) → 원화 손익 → 통산 → 기본공제 → 과세표준 × 20% → 지방소득세(양도세의 10%)
(function (root) {
  const ok = (n) => typeof n === "number" && isFinite(n);
  const fl = (n, on) => (on ? Math.floor(n + 1e-7) : n); // 원 미만 버림(부동소수 오차 1e-7 보정)

  // 한 종목: { name, cur: "krw"|"usd", buy, sell, bfx, sfx } → 원화 취득가액·양도가액. 잘못된 줄은 null
  function rowKrw(r) {
    if (!r || !ok(r.buy) || !ok(r.sell) || r.buy < 0 || r.sell < 0) return null;
    if (r.cur === "usd") {
      if (!ok(r.bfx) || !ok(r.sfx) || r.bfx <= 0 || r.sfx <= 0) return null;
      return { buyK: r.buy * r.bfx, sellK: r.sell * r.sfx };
    }
    return { buyK: r.buy, sellK: r.sell };
  }

  // 신고·납부 기간: 다음 해 5월 1일~31일. 끝날이 토·일이면 다음 월요일(국세기본법 제5조, 공휴일 미반영)
  function deadline(R, year) {
    const f = R.file || { month: 5, from: 1, to: 31 };
    const y = year + 1;
    const d = new Date(Date.UTC(y, f.month - 1, f.to));
    let shift = 0;
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) { d.setUTCDate(d.getUTCDate() + 1); shift++; }
    const iso = (x) => x.toISOString().slice(0, 10);
    return { from: iso(new Date(Date.UTC(y, f.month - 1, f.from))), to: iso(d), shifted: shift > 0 };
  }

  // R: 요율 파일 전체, opt: { year, rows, fee: { mode: "none"|"rate"|"krw", rate(소수, 0.0025 = 0.25%), krw }, dedUsed }
  function calc(R, { year, rows = [], fee = { mode: "none" }, dedUsed = false }) {
    const Y = R.years[year];
    if (!Y) return { err: "year" };
    const fw = R.floorWon !== false;
    const list = [];
    for (const r of rows) {
      const k = rowKrw(r);
      if (!k) continue;
      const cost = fee.mode === "rate" && ok(fee.rate) && fee.rate > 0 ? (k.buyK + k.sellK) * fee.rate : 0; // 매수·매도 수수료(필요경비)
      list.push({ name: r.name || "", cur: r.cur, buyK: k.buyK, sellK: k.sellK, fee: cost, gain: k.sellK - k.buyK - cost });
    }
    if (!list.length) return { err: "rows" };
    const extra = fee.mode === "krw" && ok(fee.krw) && fee.krw > 0 ? fee.krw : 0; // 1년치 비용 합계(원)를 따로 넣은 경우
    const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
    const gains = sum(list.filter((x) => x.gain > 0), (x) => x.gain); // 이익 종목 합(총 양도차익)
    const losses = sum(list.filter((x) => x.gain < 0), (x) => x.gain); // 손실 종목 합(음수)
    const sellK = sum(list, (x) => x.sellK), buyK = sum(list, (x) => x.buyK);
    const fees = sum(list, (x) => x.fee) + extra;
    const net = gains + losses - extra; // 통산 손익 = 양도소득금액
    const ded = dedUsed ? 0 : Math.min(Y.deduction, Math.max(0, net)); // 기본공제(남는 공제는 다음 해로 넘어가지 않음)
    const base = fl(Math.max(0, net - ded), fw); // 과세표준
    const tax = fl(base * Y.rate, fw); // 양도소득세
    const local = fl(tax * Y.localRatio, fw); // 지방소득세
    const total = tax + local;
    return {
      year, rows: list, sellK, buyK, fees, extra, gains, losses, net, ded, base, tax, local, total,
      rate: Y.rate, localRatio: Y.localRatio, deduction: Y.deduction, dedUsed,
      dedLeft: dedUsed ? 0 : Math.max(0, Y.deduction - Math.max(0, net)), // 올해 남은 기본공제
      eff: net > 0 ? total / net : 0, // 통산 손익 대비 실제 세금 비율
      due: deadline(R, year)
    };
  }
  root.OSTAX = { calc, rowKrw, deadline };
})(typeof window !== "undefined" ? window : globalThis);
