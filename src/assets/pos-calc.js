// P2-56 손절·익절·포지션 계산기 계산식 한 벌. 화면(t-pos.js)과 빌드의 대조 표(build.mjs, vm)가 같은 파일을 씀.
// 입력값은 저장하거나 전송하지 않음.
// 기준: 가격·금액은 모두 「가격 통화」(원 또는 달러)로 계산. 계좌를 원으로 넣고 가격이 달러면 환율로 나눠 달러로 바꿈.
// 수수료 fee는 「한 번 거래할 때 거래 금액의 비율」(사고 팔 때 각각). 손절 1주 손실 = |진입 − 손절| + fee × (진입 + 손절)
(function (root) {
  const ok = (n) => typeof n === "number" && isFinite(n);
  const EPS = 1e-10; // 0.2 같은 소수 오차로 500주가 499주로 내려가지 않게(상대 오차)
  // o: { dir: "long"|"short", entry, stop | stopPct, target | targetPct | targetR (모두 없으면 익절 생략),
  //      account, acctKrw(계좌가 원이고 가격이 달러), fx(원/달러), riskPct | riskAmt(계좌 통화), fee, frac(소수 주식) }
  function calc(o) {
    const dir = o.dir === "short" ? -1 : 1; // 롱 +1: 오르면 이익, 숏 −1: 내리면 이익
    const e = o.entry;
    if (!(ok(e) && e > 0)) return { err: "entry" };
    let stop = o.stop;
    if (ok(o.stopPct)) {
      if (!(o.stopPct > 0) || (dir > 0 && o.stopPct >= 1)) return { err: "stopPct" };
      stop = e * (1 - dir * o.stopPct);
    }
    if (!(ok(stop) && stop > 0)) return { err: "stop" };
    if ((stop - e) * dir >= 0) return { err: "stopSide", stop }; // 롱은 손절가 < 진입가, 숏은 손절가 > 진입가
    const risk1 = Math.abs(e - stop); // 1주당 가격 위험(1R)
    let target = ok(o.target) ? o.target : null;
    if (ok(o.targetR)) {
      if (!(o.targetR > 0)) return { err: "targetR" };
      target = e + dir * o.targetR * risk1;
    } else if (ok(o.targetPct)) {
      if (!(o.targetPct > 0) || (dir < 0 && o.targetPct >= 1)) return { err: "targetPct" };
      target = e * (1 + dir * o.targetPct);
    }
    const hasT = target !== null;
    if (hasT && !(target > 0)) return { err: "targetNeg", stop, target };
    if (hasT && (target - e) * dir <= 0) return { err: "targetSide", stop, target }; // 롱은 익절가 > 진입가, 숏은 익절가 < 진입가
    const fx = ok(o.fx) && o.fx > 0 ? o.fx : null;
    if (o.acctKrw && !fx) return { err: "fx" };
    const k = o.acctKrw ? 1 / fx : 1; // 계좌 통화 → 가격 통화
    if (!(ok(o.account) && o.account > 0)) return { err: "account" };
    const acct = o.account * k;
    let budget;
    if (ok(o.riskPct)) {
      if (!(o.riskPct > 0) || o.riskPct > 1) return { err: "riskPct" };
      budget = acct * o.riskPct;
    } else if (ok(o.riskAmt)) {
      if (!(o.riskAmt > 0)) return { err: "riskAmt" };
      if (o.riskAmt > o.account) return { err: "riskOver" };
      budget = o.riskAmt * k;
    } else return { err: "risk" };
    const fee = ok(o.fee) && o.fee > 0 ? o.fee : 0;
    if (fee >= 0.1) return { err: "fee" };
    const loss1 = risk1 + fee * (e + stop); // 손절 때 1주 손실(수수료 포함)
    const exact = budget / loss1;
    const n = o.frac ? Math.floor(exact * 1e6 * (1 + EPS)) / 1e6 : Math.floor(exact * (1 + EPS));
    const r = {
      dir: dir > 0 ? "long" : "short", entry: e, stop, target, hasT, risk1, loss1, fee, fx, k, acct, budget, exact, n, frac: !!o.frac,
      stopPct: (stop - e) / e, targetPct: hasT ? (target - e) / e : null,
      cashMax: Math.floor((acct / (e * (1 + fee))) * (o.frac ? 1e6 : 1) * (1 + EPS)) / (o.frac ? 1e6 : 1) // 현금만으로 살 수 있는 수량(수수료 포함)
    };
    if (!(n > 0)) { r.err = "zero"; return r; } // 감당할 손실이 1주(소수 주식이면 0.000001주) 손실보다 작음
    r.pos = n * e; // 포지션 금액(진입가 × 수량)
    r.weight = r.pos / acct; // 계좌 대비 비중
    r.lev = r.weight > 1 + 1e-12; // 계좌보다 크면 레버리지(신용·마진) 필요
    r.loss = n * loss1;
    r.lossAcct = r.loss / acct;
    if (hasT) {
      r.gain1 = Math.abs(target - e) - fee * (e + target); // 익절 때 1주 이익(수수료 뺀 값)
      r.gain = n * r.gain1;
      r.gainAcct = r.gain / acct;
      r.rrGross = Math.abs(target - e) / risk1; // 가격만 본 손익비
      r.rr = r.gain1 / loss1; // 수수료까지 넣은 손익비
      r.be = r.rr > 0 ? 1 / (1 + r.rr) : null; // 본전 승률 = 손실 ÷ (손실 + 이익)
    }
    return r;
  }
  root.POSCALC = { calc };
})(typeof window !== "undefined" ? window : globalThis);
