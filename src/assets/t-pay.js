// P2-45 직장인 돈 계산기 4종 화면(연봉 실수령액 · 퇴직금 · 실업급여 · 주휴수당). 계산식은 pay-calc.js, 요율은 #pay-rates.
// 입력값은 저장하거나 전송하지 않습니다. 다른 계산기로 넘길 때만 숫자를 주소(?…)에 담습니다.
(function () {
  const box = document.querySelector("[data-pay]");
  const rj = document.getElementById("pay-rates");
  if (!box || !rj || !window.PAYCALC) return;
  const R = JSON.parse(rj.textContent);
  const P = window.PAYCALC;
  const base = document.documentElement.dataset.base || "";
  const won = (n) => `${Math.round(n).toLocaleString("ko-KR")}원`;
  const num = (v) => { const s = String(v == null ? "" : v).replace(/[^0-9.]/g, ""); const n = parseFloat(s); return isFinite(n) ? n : null; };
  const toast = (m) => (window.NALGI && NALGI.toast ? NALGI.toast(m) : null);
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok; }
  };
  // 큰 금액 읽기: 41,234,000 → 4,123만 4,000원
  const kor = (n) => {
    if (n == null || !isFinite(n) || n <= 0) return "";
    n = Math.round(n);
    const eok = Math.floor(n / 1e8), man = Math.floor((n % 1e8) / 1e4), rest = n % 1e4;
    return [eok ? `${eok.toLocaleString("ko-KR")}억` : "", man ? `${man.toLocaleString("ko-KR")}만` : "", rest ? rest.toLocaleString("ko-KR") : ""].filter(Boolean).join(" ") + "원";
  };
  const q = new URLSearchParams(location.search);
  const $ = (s) => box.querySelector(s);
  const val = (name) => { const el = box.querySelector(`[name="${name}"]`); if (!el) return null; if (el.type === "checkbox") return el.checked; if (el.type === "radio") { const c = box.querySelector(`[name="${name}"]:checked`); return c ? c.value : null; } return el.value; };
  const setVal = (name, v) => { const el = box.querySelector(`[name="${name}"]`); if (el && v != null && v !== "") el.value = v; };
  const res = $(".pay-result");
  let line = "";
  const NOTE = `<p class="pay-note">참고용 추정치예요. 회사 급여 규정, 비과세 항목, 연말정산, 기관 판정에 따라 실제 금액은 달라질 수 있어요. ${R.year}년 요율 기준(확인일 ${R.checked}).</p>`;
  const row = (k, v, cls = "") => `<tr${cls ? ` class="${cls}"` : ""}><th scope="row">${k}</th><td>${v}</td></tr>`;
  const link = (path, params, text) => `<a class="chip" href="${base}${path}?${new URLSearchParams(params)}">${text}</a>`;
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const minW = R.minWage[R.year];

  // 금액 칸 아래에 「4,000만원」처럼 읽어 주기
  box.querySelectorAll("[data-kor]").forEach((el) => {
    const out = document.createElement("small"); out.className = "pay-kor"; out.setAttribute("aria-hidden", "true");
    el.closest("label").appendChild(out);
    const upd = () => { out.textContent = kor(num(el.value)); };
    el.addEventListener("input", upd); el.addEventListener("pay-upd", upd); upd();
  });
  box.querySelectorAll("[data-fill]").forEach((b) => b.addEventListener("click", () => {
    const [name, v] = b.dataset.fill.split("=");
    const el = box.querySelector(`[name="${name}"]`); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("pay-upd"));
  }));

  const tool = box.dataset.pay;
  let calc = () => {};

  // ---------- 연봉 실수령액 ----------
  if (tool === "salary") {
    if (q.get("annual")) setVal("amt", q.get("annual"));
    calc = () => {
      const mode = val("mode"), amt = num(val("amt"));
      line = "";
      if (!amt) { res.innerHTML = '<p class="hint">연봉(또는 월급)을 넣으면 바로 계산돼요.</p>'; return; }
      const fam = Math.max(1, Math.min(20, num(val("family")) || 1)), kids = Math.max(0, Math.min(fam - 1, num(val("kids")) || 0));
      const o = { nontax: num(val("nontax")) || 0, family: fam, kids, ratio: (num(val("ratio")) || 100) / 100, sevIncluded: val("sev") === true, date: today() };
      if (mode === "month") o.monthly = amt; else o.annual = amt;
      const r = P.salary(R, o);
      const yearNet = r.net * 12;
      const lowWage = r.hourly < minW;
      res.innerHTML = `<div class="age-big"><span>월 실수령액</span> <b>${r.net.toLocaleString("ko-KR")}</b><span>원</span></div>
<p class="hint">세전 월 ${won(r.gross)} − 공제 ${won(r.ded)} · 1년이면 약 ${won(yearNet)}${o.sevIncluded ? " · 퇴직금 포함 연봉이라 13으로 나눴어요" : ""}</p>
<div class="table-wrap"><table class="dd-table pay-table"><tbody>
${row("세전 월급", won(r.gross))}
${row("비과세(식대 등)", won(r.nontax))}
${row(`국민연금 4.75%`, `${won(r.pension)} <small>기준소득월액 ${r.pBase.toLocaleString("ko-KR")}원 (상한 ${r.pp.max.toLocaleString("ko-KR")}원)</small>`)}
${row("건강보험 3.595%", won(r.health))}
${row("장기요양보험", won(r.ltc))}
${row("고용보험 0.9%", won(r.employ))}
${row(`근로소득세 (간이세액표${o.ratio !== 1 ? ` ${Math.round(o.ratio * 100)}%` : ""})`, won(r.tax))}
${row("지방소득세 10%", won(r.local))}
${row("공제 합계", won(r.ded), "on")}
${row("월 실수령액", won(r.net), "on")}
</tbody></table></div>
<p>주 40시간(월 209시간) 기준으로 시급을 환산하면 <b>${won(r.hourly)}</b>이에요.${lowWage ? ` <span class="pay-warn">${R.year}년 최저임금(${won(minW)})보다 낮아요. 근로시간과 계약 내용을 확인해 보세요.</span>` : ""}</p>
<nav class="pay-links" aria-label="이어서 계산하기">${link("/calc/weekly-holiday-pay/", { wage: r.hourly, hours: 40 }, "이 시급으로 주휴수당·알바 월급 계산 ›")}${link("/calc/severance/", { wage: r.gross }, "이 월급으로 퇴직금 계산 ›")}</nav>
${NOTE}`;
      line = `${mode === "month" ? "월급" : "연봉"} ${kor(amt)} → 월 실수령액 약 ${won(r.net)} (국민연금 ${won(r.pension)}, 건강 ${won(r.health)}, 장기요양 ${won(r.ltc)}, 고용 ${won(r.employ)}, 소득세 ${won(r.tax)}, 지방세 ${won(r.local)}) · 부양가족 ${fam}명 · ${R.year}년 기준 참고용 추정치`;
    };
    box.querySelectorAll('[name="mode"]').forEach((el) => el.addEventListener("change", () => {
      const m = val("mode") === "month";
      $(".pay-amt-label").firstChild.textContent = m ? "월급 (세전)" : "연봉 (세전)";
      $('[name="amt"]').placeholder = m ? "예: 3,000,000" : "예: 40,000,000";
      box.querySelectorAll(".pay-quick-y").forEach((x) => (x.hidden = m));
      box.querySelectorAll(".pay-quick-m").forEach((x) => (x.hidden = !m));
      $(".pay-sev").hidden = m;
      $('[name="amt"]').dataset.max = m ? 1e9 : 1e10; // P2-67 상한: 월급 10억원, 연봉 100억원
    }));
  }

  // ---------- 퇴직금 ----------
  if (tool === "severance") {
    if (q.get("wage")) setVal("wage", Math.round(num(q.get("wage"))));
    const lastEl = $('[name="last"]'); if (!lastEl.value) lastEl.value = today();
    const w3 = $('[name="wage3"]');
    let w3Touched = false;
    w3.addEventListener("input", () => { w3Touched = !!w3.value; });
    $('[name="wage"]').addEventListener("input", () => { if (!w3Touched) { const w = num(val("wage")); w3.value = w ? Math.round(w * 3) : ""; w3.dispatchEvent(new Event("pay-upd")); } });
    if (q.get("wage") && !w3.value) w3.value = Math.round(num(q.get("wage")) * 3);
    calc = () => {
      line = "";
      const r = P.severance(R, { start: val("start"), last: val("last"), wage3: num(val("wage3")) || 0, bonus: num(val("bonus")) || 0, leave: num(val("leave")) || 0, ordinaryDaily: num(val("ord")) || 0 });
      if (r.err === "date") { res.innerHTML = '<p class="hint">입사일과 마지막 근무일을 넣어 주세요.</p>'; return; }
      if (r.err === "order") { res.innerHTML = '<p class="tk-msg">마지막 근무일이 입사일보다 빨라요. 날짜를 확인해 주세요.</p>'; return; }
      if (!num(val("wage3"))) { res.innerHTML = '<p class="hint">월급(세전)이나 퇴직 전 3개월 임금 총액을 넣어 주세요.</p>'; return; }
      const yrs = Math.floor(r.days / 365), dd = r.days - yrs * 365;
      const warn = r.eligible ? "" : `<p class="tk-warn" role="note"><b>재직 1년 미만이에요.</b> 계속근로기간이 1년 미만이면 법정 퇴직금 대상이 아니에요(근로자퇴직급여 보장법 제4조). 아래 금액은 1년을 채웠다면 받을 금액의 비율 계산일 뿐이에요.</p>`;
      res.innerHTML = `${warn}<div class="age-big"><span>예상 퇴직금 (세전)</span> <b>${r.pay.toLocaleString("ko-KR")}</b><span>원</span></div>
<p class="hint">재직 ${r.days.toLocaleString("ko-KR")}일(약 ${yrs}년 ${dd}일) · 1일 평균임금 ${won(r.daily)}${r.usedOrd ? " (통상임금이 더 커서 통상임금 적용)" : ""}</p>
<div class="table-wrap"><table class="dd-table pay-table"><tbody>
${row("퇴직 전 3개월 임금", won(num(val("wage3"))))}
${row("상여금·연차수당 가산 (각 3/12)", won(r.add))}
${row(`3개월 일수`, `${r.d3}일`)}
${row("1일 평균임금", won(r.avg))}
${row("퇴직금 = 1일 평균임금 × 30 × 재직일수 ÷ 365", won(r.pay), "on")}
</tbody></table></div>
<p class="hint">퇴직소득세는 빼지 않은 <b>세전 금액</b>이에요. 실제로는 퇴직소득세(근속연수 공제 등)를 떼고 받거나 IRP 계좌로 받아요.</p>
<nav class="pay-links" aria-label="이어서 계산하기">${link("/calc/unemployment/", { daily: r.avg, years: (r.years).toFixed(1) }, "이 평균임금으로 실업급여 계산 ›")}</nav>
${NOTE}`;
      line = `퇴직금(세전) 약 ${won(r.pay)} · 재직 ${r.days}일 · 1일 평균임금 ${won(r.daily)} · ${R.year}년 기준 참고용 추정치`;
    };
  }

  // ---------- 실업급여 ----------
  if (tool === "unemp") {
    if (q.get("daily")) { const d = box.querySelector('[name="wmode"][value="day"]'); d.checked = true; setVal("wv", Math.round(num(q.get("daily")))); }
    if (q.get("years")) { const y = num(q.get("years")); $('[name="period"]').value = y < 1 ? 0 : y < 3 ? 1 : y < 5 ? 2 : y < 10 ? 3 : 4; }
    const lab = () => { const day = val("wmode") === "day"; $(".pay-wv-label").firstChild.textContent = day ? "1일 평균임금 (세전)" : "퇴직 전 월 평균 임금 (세전)"; $('[name="wv"]').placeholder = day ? "예: 100,000" : "예: 3,000,000"; $('[name="wv"]').dataset.max = day ? 1e8 : 1e9; };
    box.querySelectorAll('[name="wmode"]').forEach((el) => el.addEventListener("change", lab)); lab();
    calc = () => {
      line = "";
      const v = num(val("wv")), age = num(val("age"));
      if (!v) { res.innerHTML = '<p class="hint">평균임금을 넣으면 바로 계산돼요.</p>'; return; }
      if (age == null) { res.innerHTML = '<p class="hint">퇴사일 기준 나이를 넣어 주세요.</p>'; return; }
      const daily = val("wmode") === "day" ? v : (v * 3) / 91; // 월 평균 × 3 ÷ 91일(3개월 평균 일수, 가정)
      const year = num(val("year")) || R.year;
      const r = P.unemp(R, { daily, age, disabled: val("dis") === true, period: num(val("period")) || 0, hours: num(val("hours")) || 8, year });
      const tag = r.capped ? " · 상한액 적용" : r.floored ? " · 하한액 적용" : "";
      res.innerHTML = `<div class="age-big"><span>총 예상 수급액</span> <b>${r.total.toLocaleString("ko-KR")}</b><span>원</span></div>
<p class="hint">하루 ${won(r.day)} × ${r.days}일${tag} · 30일이면 약 ${won(r.month)}</p>
<div class="table-wrap"><table class="dd-table pay-table"><tbody>
${row("1일 평균임금", `${won(daily)}${val("wmode") === "day" ? "" : " <small>(월 평균 × 3 ÷ 91일로 어림)</small>"}`)}
${row("평균임금 × 60%", won(r.raw))}
${row(`${r.y}년 이직 하한 (최저임금 ${R.minWage[r.y].toLocaleString("ko-KR")}원 × 80% × ${Math.min(num(val("hours")) || 8, 8)}시간)`, won(r.floor))}
${row(`${r.y}년 이직 상한`, won(R.unemp.dayCap[r.y]))}
${row("구직급여 일액", won(r.day), "on")}
${row(`소정급여일수 (${r.old ? "50세 이상·장애인" : "50세 미만"})`, `${r.days}일`, "on")}
</tbody></table></div>
<p class="hint">받으려면 이직 전 18개월 동안 고용보험 피보험단위기간이 180일 이상이고, 권고사직·계약 만료처럼 본인 뜻이 아닌 이유로 그만둬야 하며, 고용24에 구직 등록을 하고 구직 활동을 해야 해요. 자진 퇴사는 원칙적으로 받을 수 없어요.</p>
<nav class="pay-links" aria-label="이어서 계산하기">${link("/calc/severance/", {}, "퇴직금도 계산해 보기 ›")}${link("/calc/salary/", {}, "다음 직장 연봉 실수령액 ›")}</nav>
${NOTE}`;
      line = `실업급여 예상: 하루 ${won(r.day)} × ${r.days}일 = 총 ${won(r.total)}${tag} · ${r.y}년 이직 기준 참고용 추정치`;
    };
  }

  // ---------- 주휴수당 ----------
  if (tool === "juhyu") {
    setVal("wage", q.get("wage") ? Math.round(num(q.get("wage"))) : "");
    if (q.get("hours")) setVal("hours", num(q.get("hours")));
    const dh = $('[name="dh"]'), dn = $('[name="dn"]');
    const fromDays = () => { const a = num(dh.value), b = num(dn.value); if (a && b) { setVal("hours", +(a * b).toFixed(2)); } };
    dh.addEventListener("input", fromDays); dn.addEventListener("input", fromDays);
    calc = () => {
      line = "";
      const wage = num(val("wage")), hours = num(val("hours"));
      if (!wage || !hours) { res.innerHTML = '<p class="hint">시급과 일주일 근무시간을 넣어 주세요.</p>'; return; }
      const r = P.weekly(R, { wage, hours });
      const low = wage < minW;
      const nextY = R.year + 1, nextW = R.minWage[nextY];
      const warn = low ? `<p class="tk-warn" role="alert"><b>${R.year}년 최저임금(시급 ${won(minW)})보다 낮아요.</b> 최저임금보다 적게 주기로 한 계약은 그 부분이 무효이고, 최저임금으로 계산해 받을 수 있어요(수습 3개월 감액 등 예외 확인).</p>` : "";
      res.innerHTML = `${warn}<div class="age-big"><span>예상 월급 (세전)</span> <b>${r.month.toLocaleString("ko-KR")}</b><span>원</span></div>
<p class="hint">주급 ${won(r.week)} × 4.345주 · 주휴수당 ${r.ok ? `주 ${won(r.holiday)}` : "없음(주 15시간 미만)"}</p>
<div class="table-wrap"><table class="dd-table pay-table"><tbody>
${row("일한 시간 급여 (주)", `${won(r.base)} <small>${hours}시간 × ${won(wage)}</small>`)}
${row("주휴시간", r.ok ? `${+r.hh.toFixed(2)}시간 <small>(${Math.min(hours, 40)} ÷ 40 × 8)</small>` : "0시간 (주 15시간 미만)")}
${row("주휴수당 (주)", won(r.holiday), "on")}
${row("주급 합계", won(r.week))}
${row("월 환산 (× 4.345주)", won(r.month), "on")}
${row("월 환산 시간", `${+r.monthHours.toFixed(1)}시간`)}
</tbody></table></div>
${r.over40 ? '<p class="hint">주 40시간을 넘는 시간은 연장근로라서 5명 이상 사업장이면 50%를 더 받아요. 이 계산에는 넣지 않았어요.</p>' : ""}
${nextW ? `<p class="hint">${nextY}년 1월 1일부터 최저임금은 시급 ${won(nextW)}로 오를 예정이에요(고시 예고).</p>` : ""}
<nav class="pay-links" aria-label="이어서 계산하기">${link("/calc/salary/", { annual: Math.round(r.month * 12) }, "이 월급의 실수령액 계산 ›")}</nav>
${NOTE}`;
      line = `시급 ${won(wage)} · 주 ${hours}시간 → 주휴수당 주 ${won(r.holiday)}, 월급 약 ${won(r.month)}(세전, 4.345주) · ${R.year}년 기준 참고용 추정치`;
    };
  }

  // P2-67 입력 범위 확인(점검표 T2·C11): 음수·상한 초과·범위 밖 숫자·날짜는 계산하지 않고 결과 칸에 안내.
  // 입력 중(input)에 최솟값보다 작은 것은 아직 치는 중일 수 있어 회색 안내, 칸을 벗어나거나(change) 계산하기를 누르면 빨간 안내.
  const nf = (n) => Number(n).toLocaleString("ko-KR");
  const labelOf = (el) => { const l = el.closest("label"); const t = l && l.firstChild && l.firstChild.nodeType === 3 ? l.firstChild.textContent : el.getAttribute("aria-label") || el.name; return String(t).trim(); };
  const check = (strict) => {
    let msg = "", soft = false, bad = null;
    for (const el of box.querySelectorAll("input")) {
      if (el.type === "radio" || el.type === "checkbox") continue;
      el.removeAttribute("aria-invalid");
      if (bad || el.closest("[hidden]")) continue;
      const raw = String(el.value || "").trim();
      if (!raw) continue;
      let m = "", s = false;
      if (el.type === "date") {
        if ((el.min && raw < el.min) || (el.max && raw > el.max)) m = `${el.min.slice(0, 4)}년부터 ${el.max.slice(0, 4)}년 사이 날짜로 넣어 주세요.`;
      } else if (el.type === "number") {
        const v = Number(raw), lo = el.min === "" ? null : +el.min, hi = el.max === "" ? null : +el.max;
        const range = lo != null && hi != null ? `${nf(lo)}~${nf(hi)} 사이로` : hi != null ? `${nf(hi)} 이하로` : `${nf(lo)} 이상으로`;
        if (!isFinite(v)) m = "숫자로 넣어 주세요.";
        else if (v < 0 && (lo == null || lo >= 0)) m = `음수는 넣을 수 없어요. ${range} 넣어 주세요.`;
        else if (hi != null && v > hi) m = `${range} 넣어 주세요.`;
        else if (lo != null && v < lo) { m = `${range} 넣어 주세요.`; s = true; }
      } else {
        const hi = +el.dataset.max || 0, v = num(raw);
        if (/^[-−–]/.test(raw)) m = "음수는 넣을 수 없어요. 0보다 큰 금액으로 넣어 주세요.";
        else if (hi && v != null && v > hi) m = `${kor(hi)}(${nf(hi)}원) 이하로 넣어 주세요.`;
      }
      if (m) { bad = el; msg = `「${labelOf(el)}」: ${m}`; soft = s; }
    }
    if (!bad) return false;
    const show = strict || !soft;
    if (show) bad.setAttribute("aria-invalid", "true");
    if (strict) { const d = bad.closest("details"); if (d && !d.open) d.open = true; }
    res.innerHTML = show ? `<p class="tk-msg" role="alert">${msg.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</p>` : `<p class="hint">${msg.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</p>`;
    line = "";
    return true;
  };
  const run = (strict) => { if (!check(strict)) calc(); };
  box.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); run(true); });
  box.querySelector("form").addEventListener("input", () => run(false));
  box.querySelector("form").addEventListener("change", () => run(true));
  box.querySelectorAll("[data-fill]").forEach((b) => b.addEventListener("click", () => run(true)));
  box.querySelector("[data-copy]").addEventListener("click", async () => {
    if (!line) { toast("먼저 값을 넣어 계산해 주세요"); return; }
    toast((await copy(line)) ? "결과 한 줄을 복사했어요" : "복사에 실패했어요");
  });
  box.querySelectorAll("[data-kor]").forEach((el) => el.dispatchEvent(new Event("pay-upd")));
  run(true);
})();
