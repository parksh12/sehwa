// P2-45 직장인 돈 계산기 계산식(화면 없음). 요율은 content/pay-rates-2026.mjs → 페이지 #pay-rates JSON으로 받습니다.
// build.mjs도 이 파일을 vm으로 불러 연봉표·대조표를 만듭니다(같은 식 한 벌).
(function (root) {
  const f10 = (x) => Math.floor(x / 10 + 1e-9) * 10; // 10원 미만 절사
  const f1 = (x) => Math.floor(x + 1e-9);

  // ---------- 근로소득 간이세액(월) ----------
  function taxCore(R, mon, n) {
    const T = R.incomeTax, F = T.tableFit;
    const g = mon * 12;
    let wd = 0;
    for (const [cap, base, rate, from] of T.earnedDeduction) { if (g <= cap) { wd = base + (g - from) * rate; break; } }
    wd = Math.min(wd, T.earnedDeductionMax);
    const pen = f10(Math.min(Math.floor(mon / 1000) * 1000, F.pensionMax) * F.pensionRate) * 12;
    const s = T.special[Math.min(n, 3)];
    let sp;
    if (g <= 3e7) sp = s[0] + g * s[1];
    else if (g <= 4.5e7) sp = s[0] + g * s[2] - (g - 3e7) * 0.05;
    else if (g <= 7e7) sp = s[0] + g * s[3];
    else sp = s[0] + g * s[4];
    if (n >= 3 && g > 4e7) sp += (g - 4e7) * 0.04;
    const ti = Math.max(0, g - wd - T.personal * n - pen - sp);
    let t = 0;
    for (const [cap, rate, ded] of T.brackets) { if (ti <= cap) { t = ti * rate - ded; break; } }
    const cb = F.creditBreak;
    let c = t <= cb ? t * 0.55 : cb * 0.55 + (t - cb) * 0.3;
    let lim = null;
    for (const [cap, v] of F.creditLimit) { if (g <= cap) { lim = v; break; } }
    if (lim == null) { const h = F.creditLimitHigh; lim = Math.max(h.floor, h.base - (g - h.from) * h.slope); }
    c = Math.min(c, lim);
    const d = Math.max(0, t - c);
    const m = Math.floor(Math.round(d * 100) / 100 / 120 + 1e-9) * 10;
    return m < T.minCollect ? 0 : m;
  }
  // 표에 있는 가족 수(1~11)의 세액. 11명 초과는 별표2 제4호
  function taxN(R, mon, n) {
    if (n <= 11) return taxCore(R, mon, n);
    const a = taxCore(R, mon, 11), b = taxCore(R, mon, 10);
    return Math.max(0, a - (b - a) * (n - 11));
  }
  // 월 과세급여(비과세 제외) → 간이세액(소득세). kids: 8세 이상 20세 이하 자녀 수
  function incomeTax(R, mon, family, kids) {
    const T = R.incomeTax;
    const n = Math.max(1, Math.floor(family || 1));
    let tax = 0;
    if (mon < T.steps[0][0]) tax = 0;
    else if (mon < 10000000) {
      const st = T.steps.find(([lo, hi]) => mon >= lo && mon < hi);
      const lo = st[0] + Math.floor((mon - st[0]) / st[2]) * st[2];
      tax = taxN(R, lo + st[2] / 2, n);
    } else if (mon === 10000000) tax = taxN(R, 10000000, n);
    else {
      const base = taxN(R, 10000000, n);
      const o = T.over10m.find(([cap]) => mon <= cap);
      tax = base + o[1] + f1((mon - o[2]) * o[3] * o[4]);
      tax = f10(tax);
    }
    const k = Math.max(0, Math.floor(kids || 0));
    const cd = k === 0 ? 0 : k === 1 ? T.child.one : T.child.two + (k - 2) * T.child.extra;
    return Math.max(0, tax - cd);
  }

  const pensionPeriod = (R, ymd) => R.pension.periods.find((p) => ymd >= p.from && ymd <= p.to) || R.pension.periods[R.pension.periods.length - 1];

  // ---------- 연봉 실수령액 ----------
  // o: { annual, monthly, nontax, family, kids, ratio(0.8/1/1.2), sevIncluded, date }
  function salary(R, o) {
    const gross = o.monthly != null ? o.monthly : o.annual / (o.sevIncluded ? 13 : 12);
    const m = Math.max(0, Math.floor(gross));
    const nontax = Math.min(Math.max(0, o.nontax || 0), m);
    const taxable = m - nontax;
    const pp = pensionPeriod(R, o.date || `${R.year}-12-31`);
    const pBase = Math.min(Math.max(Math.floor(taxable / 1000) * 1000, pp.min), pp.max);
    const pension = taxable > 0 ? f10(pBase * R.pension.worker) : 0;
    const health = f10(taxable * R.health.worker);
    const ltc = f10(health * R.health.ltcRate / R.health.rate);
    const employ = f10(taxable * R.employ.worker);
    const tax100 = incomeTax(R, taxable, o.family, o.kids);
    const tax = f10(tax100 * (o.ratio || 1));
    const local = f10(tax * R.incomeTax.localRate);
    const ded = pension + health + ltc + employ + tax + local;
    return { gross: m, nontax, taxable, pension, pBase, pp, health, ltc, employ, tax, tax100, local, ded, net: m - ded, hourly: f1(m / R.minWageMonthHours) };
  }

  // ---------- 퇴직금 ----------
  const DAY = 86400000;
  const ut = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); if (!m) return null; const t = Date.UTC(+m[1], +m[2] - 1, +m[3]); return new Date(t).getUTCDate() === +m[3] ? t : null; };
  // start: 입사일, last: 마지막 근무일(퇴직일은 그다음 날). wage3: 퇴직 전 3개월 임금 총액(세전)
  function severance(R, o) {
    const a = ut(o.start), b = ut(o.last);
    if (a == null || b == null) return { err: "date" };
    if (b < a) return { err: "order" };
    const quit = b + DAY; // 퇴직일
    const days = Math.round((quit - a) / DAY); // 재직일수
    const q = new Date(quit);
    const from3 = Date.UTC(q.getUTCFullYear(), q.getUTCMonth() - 3, q.getUTCDate());
    const d3 = Math.round((quit - from3) / DAY); // 퇴직 전 3개월 달력 일수(89~92)
    const S = R.severance;
    const add = (o.bonus || 0) * S.bonusShare + (o.leave || 0) * S.leaveShare;
    const total3 = (o.wage3 || 0) + add;
    const avg = total3 / d3;
    const ord = o.ordinaryDaily || 0; // 1일 통상임금(선택). 평균임금보다 크면 통상임금 사용(근로기준법 제2조②)
    const daily = Math.max(avg, ord);
    const pay = f1(daily * S.days * days / S.year);
    return { days, d3, add: f1(add), total3: f1(total3), avg: f1(avg), daily: f1(daily), usedOrd: ord > avg, pay, eligible: days >= S.minDays, years: days / 365 };
  }

  // ---------- 실업급여 ----------
  // o: { daily(1일 평균임금), age, disabled, period(0~4), hours(1일 소정근로시간), year(이직 연도) }
  function unemp(R, o) {
    const U = R.unemp, y = U.dayCap[o.year] ? o.year : R.year;
    const base = Math.min(o.daily || 0, U.baseCap[y]);
    const raw = f1(base * U.ratio);
    const hours = Math.min(Math.max(o.hours || 8, 1), 8);
    const floor = f1(R.minWage[y] * U.minRatio * hours);
    let day = Math.max(raw, floor);
    day = Math.min(day, U.dayCap[y]);
    const cap = raw >= U.dayCap[y] || (o.daily || 0) >= U.baseCap[y];
    const old = o.age >= 50 || !!o.disabled;
    const days = (old ? U.days.over50 : U.days.under50)[Math.min(Math.max(o.period | 0, 0), 4)];
    return { y, raw, floor, day, capped: cap && day === U.dayCap[y], floored: raw < floor, days, total: day * days, month: day * 30, old };
  }

  // ---------- 주휴수당 ----------
  function weekly(R, o) {
    const W = R.weekly;
    const h = Math.max(0, o.hours || 0), w = Math.max(0, o.wage || 0);
    const ok = h >= W.minHours;
    const hh = ok ? Math.min(h, W.fullHours) / W.fullHours * W.paidHours : 0;
    const holiday = f1(hh * w);
    const base = f1(h * w);
    const week = base + holiday;
    return { ok, hh, holiday, base, week, month: f1(week * W.weeksPerMonth), monthHours: (h + hh) * W.weeksPerMonth, over40: h > W.fullHours };
  }

  root.PAYCALC = { incomeTax, taxN, salary, severance, unemp, weekly, f10 };
})(typeof window !== "undefined" ? window : globalThis);
