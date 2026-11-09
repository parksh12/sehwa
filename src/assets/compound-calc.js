// P2-55 복리·배당 계산기 계산식 한 벌. 화면(t-cmp.js)과 빌드의 대조(build.mjs, vm)가 같은 파일을 씀.
// 복리는 달마다 굴려서(시뮬레이션) 계산하고, 빌드는 엑셀 FV 공식(닫힌 식)·손계산·파이썬 독립 계산(scripts/compound-verify.py)과 대조함.
// 세금 요율(RULES)은 이 파일 한 곳. 입력값은 저장하거나 전송하지 않음.
(function (root) {
  const ok = (n) => typeof n === "number" && isFinite(n);

  // 확인일 2026-11-10 (03.개발). 출처는 build.mjs가 페이지 「기준·출처」에 그대로 보여 줌
  const RULES = {
    checked: "2026-11-10",
    // 국내 배당 원천징수: 소득세 14% + 지방소득세 1.4%(소득세의 10%) = 15.4%
    kr: 0.154,
    // 미국 주식 배당: 미국에서 15% 원천징수(한미 조세조약 제한세율). 한국 세율 14%보다 높아 국내 추가 징수 없음(2차 자료)
    us: 0.15,
    // 금융소득(이자 + 배당) 연 2천만 원 초과분은 다른 종합소득과 합산해 종합과세
    gross: 20000000,
    sources: [
      { name: "금융소득 연 2천만 원 이하 원천징수로 납세의무 종결, 초과 시 종합과세(2천만 원 × 14% + 초과분 기본세율)", by: "국세청 국세상담센터 자주묻는 Q&A(종합소득세 › 금융소득)", url: "https://call.nts.go.kr/call/qna/selectQnaInfo.do?ctgId=CTG11775&mi=1441", date: "2026-11-10 열람", check: "원문" },
      { name: "이자·배당 원천징수 14%, 개인지방소득세 포함 15.4%", by: "국세청 국세상담센터 같은 Q&A", url: "https://call.nts.go.kr/call/qna/selectQnaInfo.do?ctgId=CTG11775&mi=1441", date: "2026-11-10 열람", check: "원문" },
      { name: "금융소득종합과세 기준금액 2천만 원(2013년 하향)", by: "기획재정부 시사경제용어사전", url: "https://mofe.go.kr/sisa/dictionary/detail?idx=675", date: "2026-11-10 열람", check: "원문" },
      { name: "미국 주식 배당은 미국에서 15% 원천징수(한미 조세조약), 종합과세 때 외국납부세액공제", by: "비즈워치 「서학개미 인가요? 양도세 신고 한방에 알아보기」(언론, 조약 원문 미열람)", url: "https://news.bizwatch.co.kr/article/market/2024/05/03/0040", date: "2024-05-08 기사 · 2026-11-10 열람", check: "2차" }
    ]
  };

  // ---------- 복리 ----------
  // p0 초기 원금, pmt 매달 적립금, rate 연 수익률(0.07 = 7%), years 기간(년, 정수), freq "m" 월복리 | "y" 연복리, timing "end" 월말 | "begin" 월초, infl 물가상승률(선택)
  // 월복리: 달마다 (연 수익률 ÷ 12) 이자가 붙음 → 엑셀 FV(rate/12, 12×년, −pmt, −p0, 월초면 1)
  // 연복리: 이자는 해마다 12월 말에 한 번 붙음. 그해 넣은 돈은 넣은 달부터 연말까지 단리(연 수익률 × 남은 달 ÷ 12)로 이자를 받음
  function compound({ p0 = 0, pmt = 0, rate, years, freq = "m", timing = "end", infl = null }) {
    if (!ok(p0) || !ok(pmt) || p0 < 0 || pmt < 0) return { err: "money" };
    if (!(p0 > 0 || pmt > 0)) return { err: "empty" };
    if (!ok(rate) || rate < 0 || rate > 1) return { err: "rate" };
    if (!ok(years) || years < 1 || years > 60 || Math.floor(years) !== years) return { err: "years" };
    if (infl != null && (!ok(infl) || infl < 0 || infl > 0.5)) return { err: "infl" };
    const begin = timing === "begin", yearly = freq === "y";
    let bal = p0, paid = p0, pend = 0, prev = p0, addY = 0;
    const series = { bal: [p0], paid: [p0] }, rows = [];
    for (let m = 1; m <= years * 12; m++) {
      if (begin) { bal += pmt; paid += pmt; addY += pmt; }
      const it = (bal * rate) / 12;
      if (yearly) { pend += it; if (m % 12 === 0) { bal += pend; pend = 0; } }
      else bal += it;
      if (!begin) { bal += pmt; paid += pmt; addY += pmt; }
      series.bal.push(bal); series.paid.push(paid);
      if (m % 12 === 0) {
        const y = m / 12, real = infl ? bal / Math.pow(1 + infl, y) : null;
        rows.push({ y, add: addY, paid, value: bal, gain: bal - prev - addY, interest: bal - paid, real });
        prev = bal; addY = 0;
      }
    }
    const eff = yearly ? rate : Math.pow(1 + rate / 12, 12) - 1; // 실효 연 수익률
    return {
      fv: bal, paid, interest: bal - paid, rate: paid > 0 ? (bal - paid) / paid : 0, rows, series, eff,
      real: infl ? bal / Math.pow(1 + infl, years) : null,
      // 72의 법칙: 72 ÷ 연 수익률(%) ≈ 원금이 두 배가 되는 햇수. 정확한 값은 ln 2 ÷ ln(1 + 실효 연 수익률)
      r72: rate > 0 ? 72 / (rate * 100) : null, dbl: eff > 0 ? Math.log(2) / Math.log(1 + eff) : null
    };
  }

  // ---------- 배당 ----------
  // 투자금 amt × 배당률 yld → 연·월 배당(세전·세금·세후). tax = 0.154 | 0.15 | 0
  function dividend({ amt, yld, tax }) {
    if (!ok(amt) || amt <= 0) return { err: "amt" };
    if (!ok(yld) || yld <= 0 || yld > 1) return { err: "yld" };
    if (!ok(tax) || tax < 0 || tax >= 1) return { err: "tax" };
    const yPre = amt * yld, yTax = yPre * tax, yPost = yPre - yTax;
    return { amt, yld, tax, yPre, yTax, yPost, mPre: yPre / 12, mTax: yTax / 12, mPost: yPost / 12, gross: yPre > RULES.gross };
  }
  // 목표 월 배당 target(basis "post" 세후 | "pre" 세전) ÷ 배당률 → 필요 투자금
  function need({ target, basis = "post", yld, tax }) {
    if (!ok(target) || target <= 0) return { err: "target" };
    if (!ok(yld) || yld <= 0 || yld > 1) return { err: "yld" };
    if (!ok(tax) || tax < 0 || tax >= 1) return { err: "tax" };
    const mPre = basis === "post" ? target / (1 - tax) : target;
    const amt = (mPre * 12) / yld;
    return { ...dividend({ amt, yld, tax }), target, basis };
  }
  // 배당 재투자: 매달 받은 세후 배당을 같은 배당률로 다시 사서 굴림(주가·배당률은 그대로라고 가정) → 월복리 연 yld × (1 − tax)
  // 매달 추가 투자 pmt(선택)는 월말에 넣음. n년 뒤 자산 × 배당률 ÷ 12 = 그때 월 배당
  function reinvest({ amt, yld, tax, years, pmt = 0 }) {
    const d = dividend({ amt, yld, tax });
    if (d.err) return d;
    const c = compound({ p0: amt, pmt, rate: yld * (1 - tax), years, freq: "m", timing: "end" });
    if (c.err) return c;
    const at = (v) => ({ mPre: (v * yld) / 12, mPost: (v * yld * (1 - tax)) / 12 });
    return { ...c, now: d, after: { value: c.fv, ...at(c.fv), gross: c.fv * yld > RULES.gross }, rows: c.rows.map((r) => ({ ...r, ...at(r.value) })) };
  }

  root.CMPCALC = { RULES, compound, dividend, need, reinvest };
})(typeof window !== "undefined" ? window : globalThis);
