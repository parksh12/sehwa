// P2-56 손절·익절·포지션 계산기 화면. 계산식은 pos-calc.js(window.POSCALC).
// 흐름: 방향·단위 → 진입가·손절(가격|%)·익절(가격|%|R배수) → 계좌·감당할 손실(%|금액)·(환율·수수료) → 수량·포지션·손익·R:R·본전 승률 → 가격 사다리 → 한 줄 복사 → 다음 툴
// 가격 사다리는 P2-51 물타기 그림(avg-* 점선 + 오른쪽 칩) 톤을 따름. 입력값은 저장하거나 전송하지 않습니다.
(function () {
  const box = document.querySelector('[data-tool="possize"] .pos');
  if (!box || !window.POSCALC) return;
  const A = window.POSCALC;
  const $ = (s) => box.querySelector(s);
  const toast = (m) => (window.NALGI && NALGI.toast ? NALGI.toast(m) : null);
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok; }
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => { const s = String(v == null ? "" : v).replace(/[,\s원$₩%R주]/gi, ""); if (s === "") return null; if (!/^\d*\.?\d*$/.test(s)) return NaN; const n = parseFloat(s); return isFinite(n) ? n : NaN; };
  const val = (name) => { const el = box.querySelector(`[name="${name}"]`); if (!el) return null; if (el.type === "checkbox") return el.checked; if (el.type === "radio") { const c = box.querySelector(`[name="${name}"]:checked`); return c ? c.value : null; } return el.value; };
  const setv = (name, v) => { const el = box.querySelector(`[name="${name}"]`); if (!el) return; if (el.type === "radio") { const r = box.querySelector(`[name="${name}"][value="${v}"]`); if (r) r.checked = true; } else if (el.type === "checkbox") el.checked = !!v; else el.value = v; };

  // ---------- 숫자 표기 ----------
  const MINUS = "−";
  const fmtN = (n, a = 0, b = 0) => Math.abs(n).toLocaleString("ko-KR", { minimumFractionDigits: a, maximumFractionDigits: b });
  const usd = () => val("unit") === "usd";
  const acctKrw = () => usd() && val("acur") === "krw";
  const sg = (n, plus) => (n < 0 ? MINUS : plus && n > 0 ? "+" : "");
  // 가격(진입·손절·익절): 원은 소수 2자리까지, 달러는 2~4자리
  const price = (n) => (usd() ? `${sg(n)}$${fmtN(n, 2, 4)}` : `${sg(n)}${fmtN(n, 0, 2)}원`);
  // 금액(가격 통화): 원은 정수, 달러는 센트
  const money = (n, plus = false) => (usd() ? `${sg(n, plus)}$${fmtN(n, 2, 2)}` : `${sg(n, plus)}${fmtN(Math.round(n))}원`);
  const wonS = (n, plus = false) => `${sg(n, plus)}${fmtN(Math.round(n))}원`;
  let FX = null; // 달러일 때 원 환산용 환율
  const krwEq = (n, plus = false) => (usd() && FX ? ` <small>(약 ${wonS(n * FX, plus)})</small>` : "");
  const krwEqT = (n, plus = false) => (usd() && FX ? `(약 ${wonS(n * FX, plus)})` : "");
  const qtyS = (n) => `${fmtN(n, 0, 6)}주`;
  const pct = (r, d = 2) => `${sg(r, true)}${fmtN(r * 100, d, d)}%`;
  const pp = (r) => `${fmtN(r * 100, 0, 2)}%`;
  const rrS = (r) => `1 : ${fmtN(r, 2, 2)}`;
  const cls = (n) => (n > 0 ? "up" : n < 0 ? "dn" : "");

  const res = $(".pos-result");
  const NOTE = '<p class="pay-note">세금, 환전 비용, 슬리피지(손절가보다 불리한 가격에 체결되는 것)는 넣지 않았어요. 장이 열릴 때 갭으로 손절가를 건너뛰면 실제 손실은 이보다 커질 수 있어요.</p>';
  const SLOT = '<div data-chart></div>';
  const row = (k, v, c = "") => `<tr${c ? ` class="${c}"` : ""}><th scope="row">${k}</th><td>${v}</td></tr>`;
  let line = "";
  let lastChart = null;
  let prev = { smode: null, tmode: null };

  // ---------- 라벨·보이기 ----------
  function labels() {
    const u = usd() ? "($)" : "(원)";
    const smode = val("smode"), tmode = val("tmode"), rmode = val("rmode");
    box.querySelectorAll("[data-u]").forEach((el) => { el.textContent = u; });
    const short = val("dir") === "short";
    $("[data-su]").textContent = smode === "pct" ? "(%)" : u;
    $("[data-tu]").textContent = tmode === "pct" ? "(%)" : tmode === "r" ? "(R 배수)" : u;
    const ph = (el, w, d) => { el.placeholder = `예: ${usd() ? d : w}`; };
    ph($('[name="entry"]'), "50,000", "100.00");
    if (smode === "pct") $('[name="stop"]').placeholder = "예: 5"; else ph($('[name="stop"]'), short ? "52,500" : "47,500", short ? "105.00" : "95.00");
    if (tmode === "pct") $('[name="target"]').placeholder = "예: 15"; else if (tmode === "r") $('[name="target"]').placeholder = "예: 2"; else ph($('[name="target"]'), short ? "42,500" : "57,500", short ? "90.00" : "110.00");
    $("[data-acct-u]").textContent = acctKrw() || !usd() ? "(원)" : "($)";
    $("[data-risk-u]").textContent = rmode === "pct" ? "(계좌의 %)" : acctKrw() || !usd() ? "(원)" : "($)";
    $('[name="risk"]').placeholder = rmode === "pct" ? "예: 1" : acctKrw() || !usd() ? "예: 100,000" : "예: 200";
    $('[name="acct"]').placeholder = acctKrw() || !usd() ? "예: 10,000,000" : "예: 20,000";
    box.querySelectorAll("[data-usd]").forEach((el) => (el.hidden = !usd()));
    $("[data-fx-hint]").textContent = acctKrw() ? "계좌를 원으로 넣었으니 꼭 넣어 주세요" : "(선택) 넣으면 원으로도 보여 줘요";
    box.querySelectorAll("[data-rq]").forEach((el) => (el.hidden = rmode !== "pct"));
    box.querySelectorAll("[data-tq]").forEach((el) => el.classList.toggle("on", tmode === "r" && num(val("target")) === +el.dataset.tq));
    const sideS = short ? "숏(공매도·매도 먼저): 손절가는 진입가보다 위, 익절가는 아래" : "롱(매수): 손절가는 진입가보다 아래, 익절가는 위";
    $("[data-side]").textContent = sideS;
  }

  // ---------- 가격 사다리 그림(진입·손절·익절 점선 + 손실·이익 구간 + 오른쪽 칩) ----------
  const svg = $(".pos-svg");
  function draw(c) {
    lastChart = c;
    const wrap = svg.closest(".pos-chart");
    if (!c) { svg.innerHTML = ""; wrap.hidden = true; return; }
    const slot = res.querySelector("[data-chart]");
    if (slot) slot.replaceWith(wrap);
    wrap.hidden = false;
    const W = Math.max(300, Math.round(svg.getBoundingClientRect().width || 340));
    const narrow = W < 460;
    const H = narrow ? 250 : 270, top = 22, bot = 22;
    const tagW = narrow ? 132 : 196, fs = narrow ? 12 : 13;
    const x0 = 10, x1 = W - tagW - 14;
    const vals = c.levels.map((l) => l.v);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const span = hi - lo || hi * 0.1 || 1;
    lo -= span * 0.1; hi += span * 0.1;
    const y = (v) => top + ((hi - v) / (hi - lo)) * (H - top - bot);
    let s = `<rect class="avg-plot" x="${x0}" y="${top - 12}" width="${x1 - x0}" height="${H - top - bot + 24}" rx="10"/>`;
    const E = c.levels.find((l) => l.k === "entry"), S = c.levels.find((l) => l.k === "stop"), T = c.levels.find((l) => l.k === "target");
    const zx = x0 + (x1 - x0) * 0.08, zw = (x1 - x0) * 0.84;
    const zt = []; // 구간 글자는 눈금 위에 그림
    const zone = (a, b, k, txt) => {
      const ya = y(a.v), yb = y(b.v), h = Math.abs(ya - yb), ym = (ya + yb) / 2;
      s += `<rect class="pos-zone is-${k}" x="${zx}" y="${Math.min(ya, yb)}" width="${zw}" height="${h}"/>`;
      if (h >= 18) zt.push({ ym, svg: `<text class="pos-zt is-${k}" x="${zx + zw / 2}" y="${ym + 5}" font-size="${narrow ? 13 : 15}">${esc(txt)}</text>` });
    };
    if (T) zone(E, T, "gain", c.gainTxt);
    zone(E, S, "loss", c.lossTxt);
    // 1R, 2R … 눈금(익절 쪽으로, 손익비 만큼). 구간 글자와 겹치는 눈금 이름은 뺌
    if (T && c.rTicks) for (let i = 1; i <= c.rTicks.length; i++) {
      const yy = y(c.rTicks[i - 1]);
      s += `<line class="pos-rt" x1="${zx}" x2="${zx + zw}" y1="${yy}" y2="${yy}"/>`;
      if (!zt.some((z) => Math.abs(yy - 7 - z.ym) < 15)) s += `<text class="pos-rl" x="${zx + 4}" y="${yy - 3}">${i}R</text>`;
    }
    s += zt.map((z) => z.svg).join("");
    for (const l of c.levels) s += `<line class="pos-lv is-${l.k}" x1="${x0}" x2="${x1}" y1="${y(l.v)}" y2="${y(l.v)}"/>`;
    // 오른쪽 칩: 겹치지 않게 밀어 냄
    const tags = c.levels.map((l) => ({ ...l, y0: y(l.v), ty: y(l.v) })).sort((a, b) => a.y0 - b.y0);
    const gap = narrow ? 24 : 26, tMin = 12, tMax = H - 12;
    for (let i = 1; i < tags.length; i++) if (tags[i].ty - tags[i - 1].ty < gap) tags[i].ty = tags[i - 1].ty + gap;
    if (tags.length && tags[tags.length - 1].ty > tMax) { tags[tags.length - 1].ty = tMax; for (let i = tags.length - 2; i >= 0; i--) if (tags[i + 1].ty - tags[i].ty < gap) tags[i].ty = tags[i + 1].ty - gap; }
    if (tags.length && tags[0].ty < tMin) { const d = tMin - tags[0].ty; tags.forEach((t) => (t.ty += d)); }
    const tx = x1 + 8;
    for (const t of tags) {
      const txt = narrow ? t.txt : `${t.txt}${t.p ? ` ${t.p}` : ""}`;
      s += `<g class="pos-tag is-${t.k}"><path class="avg-lead" d="M${x1} ${t.y0} L${tx} ${t.ty}"/><rect x="${tx}" y="${t.ty - 10.5}" width="${tagW}" height="21" rx="10.5"/><text x="${tx + 9}" y="${t.ty + 4.3}" font-size="${fs}"><tspan class="avg-tl">${esc(t.lab)}</tspan> ${esc(txt)}</text></g>`;
    }
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("aria-label", c.aria);
    svg.innerHTML = s;
  }
  let rt = 0;
  window.addEventListener("resize", () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(() => draw(lastChart)); });

  // ---------- 계산 ----------
  const msg = (t, warn = false) => { res.innerHTML = `<p class="${warn ? "tk-msg" : "hint"}">${t}</p>`; draw(null); line = ""; };
  const ERR = {
    entry: "진입가(사거나 팔 가격)를 넣어 주세요.",
    stop: "손절가를 넣어 주세요. 가격 대신 %로 넣으려면 손절 칸 위의 「%」를 고르세요.",
    stopPct: "롱의 손절 %는 0보다 크고 100보다 작아야 해요.",
    targetR: "목표 R 배수는 0보다 커야 해요.",
    targetPct: "숏의 목표 %는 0보다 크고 100보다 작아야 해요(가격은 0 아래로 내려갈 수 없어요).",
    targetNeg: "익절가가 0 이하가 돼요. 숏의 목표 R 배수나 목표 %를 줄여 주세요.",
    fx: "계좌를 원으로 넣었으니 환율(원/달러)을 넣어 주세요. 예: 1,400",
    account: "계좌 금액(이 매매에 쓸 수 있는 전체 투자금)을 넣어 주세요.",
    risk: "감당할 손실을 넣어 주세요. 계좌의 1~2%가 흔히 쓰는 기준이에요.",
    riskPct: "감당할 손실(%)은 0보다 크고 100 이하여야 해요.",
    riskAmt: "감당할 손실 금액은 0보다 커야 해요.",
    riskOver: "감당할 손실 금액이 계좌 금액보다 커요. 계좌 금액 이하로 넣어 주세요.",
    fee: "수수료는 10%보다 작게 넣어 주세요. 보통 0.01~0.25% 정도예요."
  };
  function calc() {
    prev = { smode: val("smode"), tmode: val("tmode") }; // 입력 방식 바꿀 때 변환 기준
    labels();
    const dir = val("dir"), smode = val("smode"), tmode = val("tmode"), rmode = val("rmode");
    const raw = { entry: num(val("entry")), stop: num(val("stop")), target: num(val("target")), acct: num(val("acct")), risk: num(val("risk")), fee: num(val("fee")), fx: num(val("fx")) };
    if (Object.values(raw).some((x) => Number.isNaN(x))) return msg("숫자만 넣어 주세요. 쉼표(,)와 소수점(.)은 써도 돼요.", true);
    FX = usd() && raw.fx > 0 ? raw.fx : null;
    if (raw.entry == null && raw.stop == null) return msg("진입가와 손절가를 넣으면 몇 주를 사야 하는지 바로 나와요. 「예시 넣기」로 먼저 볼 수도 있어요.");
    const o = { dir, entry: raw.entry, frac: val("frac") === true, account: raw.acct, acctKrw: acctKrw(), fx: raw.fx, fee: raw.fee != null ? raw.fee / 100 : null };
    if (smode === "pct") o.stopPct = raw.stop != null ? raw.stop / 100 : null; else o.stop = raw.stop;
    if (raw.target != null) { if (tmode === "pct") o.targetPct = raw.target / 100; else if (tmode === "r") o.targetR = raw.target; else o.target = raw.target; }
    if (raw.risk != null) { if (rmode === "pct") o.riskPct = raw.risk / 100; else o.riskAmt = raw.risk; }
    const r = A.calc(o);
    const short = dir === "short";
    if (r.err === "stopSide") return msg(short ? `숏인데 손절가(${price(r.stop)})가 진입가(${price(raw.entry)}) 이하예요. 숏은 주가가 <b>오르면</b> 손해라서 손절가를 진입가보다 <b>높게</b> 넣어야 해요. 롱(매수)이라면 맨 위 방향을 「롱」으로 바꾸세요.` : `롱인데 손절가(${price(r.stop)})가 진입가(${price(raw.entry)}) 이상이에요. 롱은 주가가 <b>내리면</b> 손해라서 손절가를 진입가보다 <b>낮게</b> 넣어야 해요. 숏이라면 맨 위 방향을 「숏」으로 바꾸세요.`, true);
    if (r.err === "targetSide") return msg(short ? `숏인데 익절가(${price(r.target)})가 진입가(${price(raw.entry)}) 이상이에요. 숏은 주가가 내려야 이익이라 익절가를 진입가보다 <b>낮게</b> 넣어야 해요.` : `롱인데 익절가(${price(r.target)})가 진입가(${price(raw.entry)}) 이하예요. 롱은 주가가 올라야 이익이라 익절가를 진입가보다 <b>높게</b> 넣어야 해요.`, true);
    if (r.err === "zero") {
      const unitQ = r.frac ? "0.000001주" : "1주";
      return msg(`감당할 손실(${money(r.budget)})이 ${unitQ} 손절 손실(${money(r.loss1 * (r.frac ? 1e-6 : 1))})보다 작아서 ${r.frac ? "살 수 있는 수량이 없어요" : "1주도 살 수 없어요"}. 손절가를 진입가에 더 가깝게 하거나, 감당할 손실을 ${money(r.loss1)} 이상으로 늘리거나, 「소수 주식 허용」을 켜 보세요.`, true);
    }
    if (r.err) return msg(ERR[r.err] || "값을 확인해 주세요.", ["entry", "stop", "account", "risk"].includes(r.err) ? false : true);

    const aMoney = (n, plus) => (r.k !== 1 ? `${money(n, plus)} <small>(${wonS(n / r.k, plus)})</small>` : `${money(n, plus)}${krwEq(n, plus)}`); // 계좌가 원이면 원 금액을 같이
    const aMoneyT = (n, plus) => (r.k !== 1 ? `${money(n, plus)}(${wonS(n / r.k, plus)})` : `${money(n, plus)}${krwEqT(n, plus) ? ` ${krwEqT(n, plus)}` : ""}`);
    const rounded = Math.abs(r.n - r.exact) > 1e-9;
    const verb = short ? "공매도(매도)" : "매수";
    let h = `<div class="age-big avg-big pos-big"><span>${short ? "공매도(먼저 매도)할 수량" : "매수할 수량"}</span> <b>${fmtN(r.n, 0, 6)}</b><span>주</span></div>
<p class="hint">포지션 금액 <b>${aMoney(r.pos)}</b> · 계좌의 <b>${pp(r.weight)}</b>${rounded ? ` · 계산값 ${fmtN(r.exact, 0, 4)}주를 ${r.frac ? "소수 6자리에서" : "정수 주로"} 내림` : ""}</p>`;
    if (r.lev) {
      h += `<p class="tk-warn pos-lev" role="note"><b>포지션 금액이 계좌보다 커요 (계좌의 ${pp(r.weight)}).</b> 이만큼 ${verb}하려면 신용·미수·마진 같은 레버리지 약 ${fmtN(r.weight, 1, 1)}배가 필요해요. 손절가가 진입가에 너무 가까우면 이렇게 돼요. 현금만으로는 최대 <b>${qtyS(r.cashMax)}</b>까지 ${short ? "공매도할" : "살"} 수 있어요(그때 손절하면 ${aMoneyT(-r.cashMax * r.loss1)}).</p>`;
    }
    h += SLOT;
    h += `<div class="pos-pl">`;
    h += `<div class="avg-pl dn"><span>손절 시 (${price(r.stop)}, ${pct(r.stopPct)})</span><b>${money(-r.loss)}</b><b>계좌 ${pct(-r.lossAcct)}</b></div>`;
    if (r.hasT) h += `<div class="avg-pl ${cls(r.gain)}"><span>익절 시 (${price(r.target)}, ${pct(r.targetPct)})</span><b>${money(r.gain, true)}</b><b>계좌 ${pct(r.gainAcct)}</b></div>`;
    h += `</div>`;
    if (r.hasT) {
      h += `<p class="hint">손익비(R:R) <b>${rrS(r.rr)}</b>${r.fee ? ` <small>(수수료 빼기 전 ${rrS(r.rrGross)})</small>` : ""} · 본전 승률 <b>${r.be != null ? pp(r.be) : "—"}</b> — ${r.be != null ? `이 손익비로 같은 매매를 여러 번 하면, ${fmtN(r.be * 100, 0, 1)}%보다 자주 이겨야 남아요.` : "수수료가 이익보다 커서 익절해도 손해예요."}</p>`;
    } else h += `<p class="hint">익절가(또는 목표 %·R 배수)를 넣으면 익절 시 이익, 손익비(R:R), 본전 승률까지 나와요.</p>`;
    if (r.hasT && r.rr > 0 && r.rr < 1) h += `<p class="tk-warn" role="note">손익비가 1보다 작아요. 이기면 버는 돈보다 지면 잃는 돈이 커서, 본전을 맞추려면 승률이 ${pp(r.be)} 넘게 필요해요.</p>`;
    const budgetS = r.k !== 1 ? `${money(r.budget)} <small>(${wonS(r.budget / r.k)})</small>` : `${money(r.budget)}${krwEq(r.budget)}`;
    h += `<div class="table-wrap"><table class="dd-table pay-table avg-table pos-table"><tbody>
${row("방향", short ? "숏 — 먼저 팔고 나중에 되사기(내릴 때 이익)" : "롱 — 사고 나중에 팔기(오를 때 이익)")}
${row("진입가", price(r.entry))}
${row("손절가", `${price(r.stop)} <small>${pct(r.stopPct)}</small>`)}
${r.hasT ? row("익절가", `${price(r.target)} <small>${pct(r.targetPct)} · ${fmtN(r.rrGross, 0, 2)}R</small>`) : ""}
${row("계좌 금액", r.k !== 1 ? `${wonS(r.acct / r.k)} <small>= ${money(r.acct)} (환율 ${fmtN(FX, 0, 2)}원)</small>` : `${money(r.acct)}${krwEq(r.acct)}`)}
${row(`감당할 손실 ${val("rmode") === "pct" ? `(계좌의 ${pp(o.riskPct)})` : `(계좌의 ${pp(r.budget / r.acct)})`}`, budgetS)}
${row(`1주 손절 손실 = |진입 − 손절|${r.fee ? " + 수수료" : ""}`, `${money(r.loss1)}${r.fee ? ` <small>가격 ${money(r.risk1)} + 수수료 ${money(r.loss1 - r.risk1)}</small>` : ""}`)}
${row("수량 = 감당할 손실 ÷ 1주 손절 손실", `${fmtN(r.exact, 0, 4)}주${rounded ? ` → <b>${qtyS(r.n)}</b>` : ""}`, "on")}
${row("포지션 금액 = 진입가 × 수량", `${aMoney(r.pos)} <small>계좌의 ${pp(r.weight)}</small>`, "on")}
${row("손절 시 손실", `<span class="dn">${aMoney(-r.loss)}</span>`)}
${r.hasT ? row(`익절 시 이익${r.fee ? " (수수료 뺌)" : ""}`, `<span class="${cls(r.gain)}">${aMoney(r.gain, true)}</span>`) : ""}
${r.hasT ? row("손익비 R:R = 1주 이익 ÷ 1주 손실", rrS(r.rr), "on") : ""}
${r.hasT && r.be != null ? row("본전 승률 = 1 ÷ (1 + R)", pp(r.be), "on") : ""}
${r.fee ? row("수수료 (사고 팔 때 각각)", `${pp(r.fee)} <small>왕복 약 ${money(r.n * r.fee * (r.entry + r.stop))}(손절) ~ ${r.hasT ? money(r.n * r.fee * (r.entry + r.target)) : "—"}(익절)</small>`) : ""}
</tbody></table></div>`;
    // 계좌 위험별 수량(같은 진입·손절)
    const alt = [0.005, 0.01, 0.02, 0.03].map((p) => { const x = A.calc({ ...o, riskPct: p, riskAmt: undefined }); return x.err ? "" : `<tr${Math.abs(x.budget - r.budget) < 1e-9 ? ' class="on"' : ""}><th scope="row">${pp(p)}</th><td>${money(x.budget)}</td><td>${qtyS(x.n)}</td><td>${money(x.pos)}</td><td>${pp(x.weight)}${x.lev ? " ⚠" : ""}</td></tr>`; }).join("");
    h += `<details class="avg-steps"><summary>감당할 손실(계좌의 %)별 수량</summary><div class="table-wrap"><table class="dd-table avg-stable"><thead><tr><th scope="col">계좌 위험</th><th scope="col">손실 한도</th><th scope="col">수량</th><th scope="col">포지션</th><th scope="col">비중</th></tr></thead><tbody>${alt}</tbody></table></div><p class="hint">한 번 매매에서 계좌의 1~2%까지만 잃도록 수량을 정하는 방법을 흔히 「1% 규칙」·「2% 규칙」이라고 불러요. ⚠는 계좌보다 큰 포지션이에요.</p></details>`;
    h += NOTE;
    res.innerHTML = h;
    // 그림
    const levels = [{ v: r.entry, k: "entry", lab: "진입", txt: price(r.entry) }, { v: r.stop, k: "stop", lab: "손절", txt: price(r.stop), p: pct(r.stopPct) }];
    if (r.hasT) levels.push({ v: r.target, k: "target", lab: "익절", txt: price(r.target), p: pct(r.targetPct) });
    const rTicks = [];
    if (r.hasT) for (let i = 1; i < r.rrGross - 1e-9 && i <= 6; i++) rTicks.push(r.entry + (short ? -1 : 1) * i * r.risk1);
    draw({ levels, rTicks, gainTxt: `익절 ${money(r.gain || 0, true)}`, lossTxt: `손절 ${money(-r.loss)}`, aria: `가격 사다리: 진입 ${price(r.entry)}, 손절 ${price(r.stop)}${r.hasT ? `, 익절 ${price(r.target)}, 손익비 ${rrS(r.rr)}` : ""}` });
    line = `손절·익절 계산(${short ? "숏" : "롱"}): 진입 ${price(r.entry)}, 손절 ${price(r.stop)}(${pct(r.stopPct)})${r.hasT ? `, 익절 ${price(r.target)}(${pct(r.targetPct)})` : ""} · 계좌 ${r.k !== 1 ? wonS(r.acct / r.k) : money(r.acct)}, 감당할 손실 ${r.k !== 1 ? wonS(r.budget / r.k) : money(r.budget)}(${pp(r.budget / r.acct)}) → ${verb} ${qtyS(r.n)}, 포지션 ${money(r.pos)}(계좌의 ${pp(r.weight)}${r.lev ? ", 레버리지 필요" : ""}) · 손절 시 ${money(-r.loss)}${r.hasT ? `, 익절 시 ${money(r.gain, true)} · 손익비 ${rrS(r.rr)}, 본전 승률 ${r.be != null ? pp(r.be) : "—"}` : ""}${r.fee ? ` · 수수료 ${pp(r.fee)} 반영` : ""} · 투자 권유 아님`;
  }

  // ---------- 예시 ----------
  const EX = {
    long: { krw: { entry: "50000", smode: "price", stop: "47500", tmode: "price", target: "57500", acct: "10000000", rmode: "pct", risk: "1", fee: "", frac: false },
      usd: { entry: "250", smode: "pct", stop: "4", tmode: "pct", target: "10", acur: "krw", fx: "1400", acct: "5000000", rmode: "amt", risk: "49000", fee: "", frac: true } },
    short: { krw: { entry: "30000", smode: "pct", stop: "5", tmode: "r", target: "2", acct: "20000000", rmode: "pct", risk: "1", fee: "", frac: false },
      usd: { entry: "100", smode: "price", stop: "105", tmode: "r", target: "2", acur: "usd", fx: "", acct: "20000", rmode: "pct", risk: "2", fee: "", frac: false } }
  };
  $("[data-example]").addEventListener("click", () => {
    const e = EX[val("dir")][usd() ? "usd" : "krw"];
    Object.entries(e).forEach(([k, v]) => setv(k, v));
    calc();
  });
  $("[data-reset]").addEventListener("click", () => {
    box.querySelectorAll('input[type="text"]').forEach((el) => (el.value = ""));
    calc();
  });
  box.querySelectorAll("[data-rq]").forEach((b) => b.addEventListener("click", () => { setv("rmode", "pct"); setv("risk", b.dataset.rq); calc(); }));
  box.querySelectorAll("[data-tq]").forEach((b) => b.addEventListener("click", () => { setv("tmode", "r"); setv("target", b.dataset.tq); calc(); }));
  // 손절·익절 입력 방식을 바꾸면 지금 값을 새 방식으로 바꿔 넣음(가격 ↔ %·R)
  function convert(name) {
    const e = num(val("entry")), dir = val("dir") === "short" ? -1 : 1;
    const f = (n) => String(+n.toFixed(usd() ? 4 : 2));
    if (name === "smode") {
      const v = num(val("stop")), to = val("smode");
      if (e > 0 && v > 0) setv("stop", to === "pct" ? f(Math.abs((e - v) / e) * 100) : f(e * (1 - (dir * v) / 100)));
    } else {
      const v = num(val("target")), to = val("tmode"), from = prev.tmode;
      const sv = num(val("stop")), stop = val("smode") === "pct" ? (sv > 0 && e > 0 ? e * (1 - (dir * sv) / 100) : null) : sv;
      const r1 = e > 0 && stop > 0 ? Math.abs(e - stop) : null;
      let tp = null; // 지금 값을 가격으로
      if (e > 0 && v > 0) tp = from === "pct" ? e * (1 + (dir * v) / 100) : from === "r" ? (r1 ? e + dir * v * r1 : null) : v;
      if (tp != null) setv("target", to === "price" ? f(tp) : to === "pct" ? f(Math.abs((tp - e) / e) * 100) : r1 ? f(Math.abs(tp - e) / r1) : "");
    }
  }
  box.querySelector("[data-copy]").addEventListener("click", async () => {
    if (!line) { toast("먼저 값을 넣어 계산해 주세요"); return; }
    toast((await copy(line)) ? "결과 한 줄을 복사했어요" : "복사에 실패했어요");
  });
  const form = box.querySelector("form");
  form.addEventListener("submit", (e) => { e.preventDefault(); calc(); });
  form.addEventListener("input", (e) => { if (e.target.type !== "radio" && e.target.type !== "checkbox") calc(); });
  form.addEventListener("change", (e) => {
    if (e.target.name === "smode" || e.target.name === "tmode") convert(e.target.name);
    calc();
  });

  // 처음 화면: 롱·원 예시로 결과를 바로 보여 줌
  Object.entries(EX.long.krw).forEach(([k, v]) => setv(k, v));
  calc();
})();
