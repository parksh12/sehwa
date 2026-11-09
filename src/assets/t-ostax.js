// P2-53 해외주식 양도소득세 계산기 화면. 계산식은 ostax-calc.js(window.OSTAX), 요율은 #ostax-rates(JSON).
// 흐름: 과세 연도 → 종목 줄(원 또는 달러+매수·매도 환율) → 수수료(선택) → 결과(통산·공제·과세표준·세금) → 한 줄 복사 → 다음 툴
// 입력값은 저장하거나 전송하지 않습니다.
(function () {
  const box = document.querySelector('[data-tool="ostax"] .ost');
  const rj = document.getElementById("ostax-rates");
  if (!box || !rj || !window.OSTAX) return;
  const R = JSON.parse(rj.textContent);
  const O = window.OSTAX;
  const $ = (s) => box.querySelector(s);
  const toast = (m) => (window.NALGI && NALGI.toast ? NALGI.toast(m) : null);
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok; }
  };
  const num = (v) => { const s = String(v == null ? "" : v).replace(/[,\s원$₩]/g, ""); if (s === "") return null; if (!/^\d*\.?\d*$/.test(s)) return NaN; const n = parseFloat(s); return isFinite(n) ? n : NaN; };
  const val = (name) => { const el = box.querySelector(`[name="${name}"]`); if (!el) return null; if (el.type === "checkbox") return el.checked; if (el.type === "radio") { const c = box.querySelector(`[name="${name}"]:checked`); return c ? c.value : null; } return el.value; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const MINUS = "−";
  const fmt = (n, d = 0) => Math.abs(n).toLocaleString("ko-KR", { minimumFractionDigits: 0, maximumFractionDigits: d });
  const won = (n, plus = false) => `${n < 0 && Math.round(Math.abs(n)) > 0 ? MINUS : plus && n >= 0.5 ? "+" : ""}${fmt(Math.round(n))}원`;
  const usd = (n) => `$${fmt(n, 2)}`;
  const pct = (r) => `${fmt(r * 100, 2)}%`;
  const cls = (n) => (n > 0 ? "up" : n < 0 ? "dn" : "");
  const dk = (iso) => `${iso.slice(0, 4)}년 ${+iso.slice(5, 7)}월 ${+iso.slice(8, 10)}일`;
  const res = $(".ost-result");
  const row = (k, v, c = "") => `<tr${c ? ` class="${c}"` : ""}><th scope="row">${k}</th><td>${v}</td></tr>`;
  let line = "";

  // ---------- 연도 ----------
  const ysel = $('[name="year"]');
  Object.keys(R.years).sort().reverse().forEach((y) => { const o = document.createElement("option"); o.value = y; o.textContent = `${y}년에 판 주식 (${+y + 1}년 5월 신고)`; ysel.appendChild(o); });
  ysel.value = String(R.defaultYear);

  // ---------- 종목 줄 ----------
  const list = $(".ost-rows");
  const MAXROWS = 30;
  const renum = () => {
    const lis = [...list.children];
    lis.forEach((li, i) => {
      li.querySelector(".avg-no").textContent = `${i + 1}`;
      li.querySelector("[data-del]").setAttribute("aria-label", `${i + 1}번째 종목 줄 지우기`);
      const lab = { nm: "종목명", cur: "통화", buy: "매수 금액", sell: "매도 금액", bfx: "매수 결제일 환율", sfx: "매도 결제일 환율" };
      li.querySelectorAll("input,select").forEach((el) => el.setAttribute("aria-label", `${i + 1}번째 종목 ${lab[el.name] || ""}`));
    });
    $("[data-add]").disabled = lis.length >= MAXROWS;
  };
  const curOf = (li) => li.querySelector('[name="cur"]').value;
  const relabel = (li) => {
    const u = curOf(li) === "usd";
    li.classList.toggle("is-usd", u);
    li.querySelectorAll("[data-fx]").forEach((el) => (el.hidden = !u));
    li.querySelectorAll("[data-u]").forEach((el) => (el.textContent = u ? "($)" : "(원)"));
    li.querySelector('[name="buy"]').placeholder = u ? "예: 10,000" : "예: 5,000,000";
    li.querySelector('[name="sell"]').placeholder = u ? "예: 14,000" : "예: 7,000,000";
  };
  const addRow = (d = {}, focus = false) => {
    if (list.children.length >= MAXROWS) return;
    const prev = list.lastElementChild;
    const cur = d.cur || (prev ? curOf(prev) : "usd");
    const li = document.createElement("li");
    li.className = "ost-row";
    li.innerHTML = `<span class="avg-no" aria-hidden="true"></span>
<label class="ost-f ost-nm"><span class="avg-fl">종목명 <small>(선택)</small></span><input name="nm" type="text" autocomplete="off" maxlength="30" placeholder="예: 엔비디아"></label>
<label class="ost-f ost-cur"><span class="avg-fl">통화</span><select name="cur"><option value="usd">달러 $</option><option value="krw">원 ₩</option></select></label>
<button type="button" class="avg-del" data-del>×</button>
<label class="ost-f ost-buy"><span class="avg-fl">매수 금액 <i data-u></i></span><input name="buy" type="text" inputmode="decimal" autocomplete="off"></label>
<label class="ost-f ost-sell"><span class="avg-fl">매도 금액 <i data-u></i></span><input name="sell" type="text" inputmode="decimal" autocomplete="off"></label>
<label class="ost-f ost-bfx" data-fx><span class="avg-fl">매수 결제일 환율</span><input name="bfx" type="text" inputmode="decimal" autocomplete="off" placeholder="예: 1,350"></label>
<label class="ost-f ost-sfx" data-fx><span class="avg-fl">매도 결제일 환율</span><input name="sfx" type="text" inputmode="decimal" autocomplete="off" placeholder="예: 1,420"></label>
<span class="ost-amt" aria-live="off"></span>`;
    const set = (n, v) => { if (v != null) li.querySelector(`[name="${n}"]`).value = v; };
    set("cur", cur); set("nm", d.nm); set("buy", d.buy); set("sell", d.sell); set("bfx", d.bfx); set("sfx", d.sfx);
    list.appendChild(li);
    relabel(li); renum();
    if (focus) li.querySelector('[name="nm"]').focus();
  };
  list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    const li = b.closest("li");
    if (list.children.length === 1) li.querySelectorAll("input").forEach((el) => (el.value = ""));
    else { const next = li.nextElementSibling || li.previousElementSibling; li.remove(); if (next) next.querySelector("[data-del]").focus(); }
    renum(); calc();
  });
  list.addEventListener("change", (e) => { if (e.target.name === "cur") relabel(e.target.closest("li")); });
  $("[data-add]").addEventListener("click", () => { addRow({}, true); calc(); });

  // ---------- 계산 ----------
  const feeMode = () => val("feemode");
  const msg = (t, warn = false) => { res.innerHTML = `<p class="${warn ? "tk-msg" : "hint"}">${t}</p>`; line = ""; };
  function calc() {
    box.querySelectorAll("[data-fee]").forEach((el) => (el.hidden = el.dataset.fee !== feeMode()));
    const year = +ysel.value;
    const raw = [...list.children].map((li) => {
      const g = (n) => li.querySelector(`[name="${n}"]`).value;
      return { li, name: g("nm").trim(), cur: curOf(li), buy: num(g("buy")), sell: num(g("sell")), bfx: num(g("bfx")), sfx: num(g("sfx")) };
    });
    let bad = false, part = false;
    raw.forEach((r) => {
      const amt = r.li.querySelector(".ost-amt");
      const nums = r.cur === "usd" ? [r.buy, r.sell, r.bfx, r.sfx] : [r.buy, r.sell];
      if (nums.some((x) => Number.isNaN(x))) { bad = true; amt.textContent = ""; return; }
      const filled = nums.filter((x) => x != null).length;
      if (filled && filled < nums.length) part = true;
      const k = filled === nums.length ? O.rowKrw(r) : null;
      if (!k) { amt.textContent = ""; amt.className = "ost-amt"; return; }
      const g = k.sellK - k.buyK;
      amt.textContent = `${r.cur === "usd" ? `매도 ${won(k.sellK)} − 매수 ${won(k.buyK)} = ` : ""}손익 ${won(g, true)}${feeMode() === "rate" ? " (수수료 전)" : ""}`;
      amt.className = `ost-amt ${cls(g)}`;
    });
    const fr = num(val("feerate")), fk = num(val("feekrw"));
    if (bad || (feeMode() === "rate" && Number.isNaN(fr)) || (feeMode() === "krw" && Number.isNaN(fk))) return msg("숫자만 넣어 주세요. 쉼표(,)와 소수점(.)은 써도 돼요.", true);
    if (feeMode() === "rate" && fr > 5) return msg("수수료율은 % 단위로 넣어 주세요. 예: 0.25", true);
    const rows = raw.filter((r) => (r.cur === "usd" ? [r.buy, r.sell, r.bfx, r.sfx] : [r.buy, r.sell]).every((x) => x != null));
    if (!rows.length) return msg(part ? "달러 종목은 매수·매도 금액과 두 환율을 모두 넣어 주세요." : "판 종목의 매수 금액과 매도 금액을 넣으면 바로 세금이 나와요. 「예시 넣기」로 먼저 볼 수도 있어요.");
    const r = O.calc(R, { year, rows, fee: { mode: feeMode(), rate: fr != null ? fr / 100 : 0, krw: fk || 0 }, dedUsed: val("dedused") === true });
    if (r.err) return msg("값을 확인해 주세요.", true);
    render(r, part);
  }

  function render(r, part) {
    const due = `${dk(r.due.from)} ~ ${dk(r.due.to)}${r.due.shifted ? " (31일이 주말이라 미뤄짐)" : ""}`;
    const head = `<div class="age-big avg-big ost-big"><span>예상 세금 합계 (양도소득세 + 지방소득세)</span> <b>${won(r.total)}</b></div>
<p class="hint">${r.year}년에 판 주식 · 신고·납부 <b>${due}</b> · 홈택스</p>`;
    // 막대: 통산 이익을 기본공제 / 세금 / 남는 이익으로 나눔
    let bar = "";
    if (r.net > 0) {
      const w = (x) => `${Math.max(0, (x / r.net) * 100).toFixed(2)}%`;
      const keep = r.net - r.ded - r.total;
      bar = `<div class="ost-bar" role="img" aria-label="통산 이익 ${won(r.net)} 가운데 기본공제 ${won(r.ded)}, 세금 ${won(r.total)}, 세금 뒤 남는 이익 ${won(keep)}"><span class="b-ded" style="width:${w(r.ded)}"></span><span class="b-tax" style="width:${w(r.total)}"></span><span class="b-keep" style="width:${w(keep)}"></span></div>
<p class="ost-legend" aria-hidden="true"><span><i class="b-ded"></i>기본공제 ${won(r.ded)}</span><span><i class="b-tax"></i>세금 ${won(r.total)}</span><span><i class="b-keep"></i>남는 이익 ${won(keep)}</span></p>`;
    }
    const tb = `<div class="table-wrap"><table class="dd-table pay-table avg-table ost-table"><tbody>
${row("총 양도가액 (매도 원화 합)", won(r.sellK))}
${row("총 취득가액 (매수 원화 합)", won(r.buyK))}
${r.fees > 0 ? row("수수료 등 필요경비", won(r.fees)) : ""}
${row("이익 난 종목 합 (총 양도차익)", `<span class="up">${won(r.gains, true)}</span>`)}
${row("손실 난 종목 합", `<span class="${cls(r.losses)}">${won(r.losses)}</span>`)}
${row("통산 손익 (양도소득금액)", `<span class="${cls(r.net)}">${won(r.net, true)}</span>`, "on")}
${row(`기본공제 ${r.dedUsed ? "(다른 양도에서 이미 받음)" : "(연 250만 원)"}`, `${r.ded > 0 ? MINUS : ""}${won(r.ded)}`)}
${row("과세표준", won(r.base), "on")}
${row(`양도소득세 (과세표준 × ${pct(r.rate)})`, won(r.tax))}
${row(`지방소득세 (양도소득세 × ${pct(r.localRatio)})`, won(r.local))}
${row("세금 합계", `<b>${won(r.total)}</b>`, "on")}
${r.net > 0 ? row("통산 손익 대비 세금", pct(r.eff)) : ""}
</tbody></table></div>`;
    const per = `<details class="avg-steps"${r.rows.length > 1 ? " open" : ""}><summary>종목별 원화 손익</summary><div class="table-wrap"><table class="dd-table avg-stable ost-ptable"><thead><tr><th scope="col">#</th><th scope="col">종목</th><th scope="col">매도(원)</th><th scope="col">매수(원)</th>${r.fees - r.extra > 0 ? '<th scope="col">수수료</th>' : ""}<th scope="col">손익</th></tr></thead><tbody>${r.rows.map((x, i) => `<tr><th scope="row">${i + 1}</th><td class="ost-nmcell">${esc(x.name || "-")}${x.cur === "usd" ? " <small>$</small>" : ""}</td><td>${won(x.sellK)}</td><td>${won(x.buyK)}</td>${r.fees - r.extra > 0 ? `<td>${won(x.fee)}</td>` : ""}<td class="${cls(x.gain)}">${won(x.gain, true)}</td></tr>`).join("")}</tbody></table></div></details>`;
    // 일반 안내(권유 아님)
    const tips = [];
    if (r.net <= 0) tips.push(`통산 손익이 0 이하라 이 해에 낼 양도소득세가 없어요. 해외주식 양도 손실은 <b>다음 해로 넘어가지 않아요</b>(이월공제 없음). 이익이 없어도 신고 의무는 없지만, 국내 대주주 주식 등과 통산할 게 있으면 함께 신고해요.`);
    else if (r.total === 0) tips.push(`통산 이익이 기본공제 안이라 세금이 0원이에요. 올해 남은 기본공제 <b>${won(r.dedLeft)}</b>은 다음 해로 넘어가지 않아요.`);
    else tips.push(`같은 해에 판 종목끼리는 이익과 손실이 합쳐져요. 그래서 일반적으로 <b>평가손실이 난 종목을 같은 해 안에 팔면</b> 통산 손익이 줄어 세금도 줄어드는 구조예요(손실 100만 원당 세금 약 ${won(1e6 * r.rate * (1 + r.localRatio))}). 다만 팔지 말지는 투자 판단이라 이 계산기는 권하지 않아요.`);
    tips.push(`양도 시기는 <b>결제일(대금 청산일)</b> 기준이에요. 미국 주식은 보통 거래일 다음 영업일에 결제되어, 12월 말에 판 것은 다음 해 양도로 잡힐 수 있어요. 그해 마지막 매도일은 증권사 공지를 확인하세요.`);
    if (part) tips.push("값을 다 넣지 않은 줄은 빼고 계산했어요.");
    const tipH = `<div class="pay-note ost-tips"><b>참고 안내</b><ul>${tips.map((x) => `<li>${x}</li>`).join("")}</ul></div>`;
    res.innerHTML = head + bar + tb + per + tipH;
    const names = r.rows.map((x) => x.name).filter(Boolean);
    line = `해외주식 양도소득세(${r.year}년 양도): ${names.length ? `${names.slice(0, 4).join("·")}${names.length > 4 ? ` 외 ${names.length - 4}` : ""} ` : ""}${r.rows.length}종목 통산 손익 ${won(r.net, true)} − 기본공제 ${won(r.ded)} = 과세표준 ${won(r.base)} → 양도세 ${won(r.tax)} + 지방세 ${won(r.local)} = ${won(r.total)} · 신고 ${r.due.from.slice(0, 4)}.5월 · 참고용 추정치(실제 신고는 홈택스·세무사 확인)`;
  }

  // ---------- 예시·초기화·복사 ----------
  const EX = [
    { nm: "엔비디아", cur: "usd", buy: "10000", sell: "14000", bfx: "1350", sfx: "1420" },
    { nm: "테슬라", cur: "usd", buy: "8000", sell: "6500", bfx: "1300", sfx: "1400" },
    { nm: "애플", cur: "krw", buy: "3000000", sell: "3900000" }
  ];
  $("[data-example]").addEventListener("click", () => {
    list.innerHTML = ""; EX.forEach((d) => addRow(d));
    box.querySelector('[name="feemode"][value="none"]').checked = true;
    $('[name="dedused"]').checked = false;
    ysel.value = String(R.defaultYear);
    calc();
  });
  $("[data-reset]").addEventListener("click", () => {
    box.querySelectorAll('input[type="text"]').forEach((el) => (el.value = ""));
    box.querySelector('[name="feemode"][value="none"]').checked = true;
    $('[name="dedused"]').checked = false;
    list.innerHTML = ""; addRow(); calc();
  });
  box.querySelector("[data-copy]").addEventListener("click", async () => {
    if (!line) { toast("먼저 값을 넣어 계산해 주세요"); return; }
    toast((await copy(line)) ? "결과 한 줄을 복사했어요" : "복사에 실패했어요");
  });
  const form = box.querySelector("form");
  form.addEventListener("submit", (e) => { e.preventDefault(); calc(); });
  form.addEventListener("input", () => calc());
  form.addEventListener("change", () => calc());

  addRow();
  calc();
})();
