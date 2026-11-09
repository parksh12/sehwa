// P2-51 물타기 계산기(평단가 계산) 화면. 계산식은 avg-calc.js(window.AVGCALC).
// 흐름: 보유(평단·수량) + 추가 매수 여러 줄 → 새 평단·총 수량·총 투자금·평가손익 / 역계산: 목표 평단·현재가 → 필요 수량·금액
// 입력값은 저장하거나 전송하지 않습니다.
(function () {
  const box = document.querySelector('[data-tool="avgdown"] .avg');
  if (!box || !window.AVGCALC) return;
  const A = window.AVGCALC;
  const $ = (s) => box.querySelector(s);
  const toast = (m) => (window.NALGI && NALGI.toast ? NALGI.toast(m) : null);
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok; }
  };
  const num = (v) => { const s = String(v == null ? "" : v).replace(/[,\s원$₩주]/g, ""); if (s === "") return null; if (!/^\d*\.?\d*$/.test(s)) return NaN; const n = parseFloat(s); return isFinite(n) ? n : NaN; };
  const val = (name) => { const el = box.querySelector(`[name="${name}"]`); if (!el) return null; if (el.type === "checkbox") return el.checked; if (el.type === "radio") { const c = box.querySelector(`[name="${name}"]:checked`); return c ? c.value : null; } return el.value; };
  const usd = () => val("unit") === "usd";
  const frac = () => val("frac") === true;
  const MINUS = "−";
  const fmtN = (n, min, max) => Math.abs(n).toLocaleString("ko-KR", { minimumFractionDigits: min, maximumFractionDigits: max });
  const sign = (n) => (n < 0 ? MINUS : "");
  // 금액(총 투자금·손익): 원은 정수, 달러는 센트까지
  const money = (n, plus = false) => { const s = n < 0 ? MINUS : plus && n > 0 ? "+" : ""; return usd() ? `${s}$${fmtN(n, 2, 2)}` : `${s}${fmtN(Math.round(n), 0, 0)}원`; };
  // 가격(평단·현재가): 원은 소수 2자리까지, 달러는 2~4자리
  const price = (n) => (usd() ? `${sign(n)}$${fmtN(n, 2, 4)}` : `${sign(n)}${fmtN(n, 0, 2)}원`);
  const qtyS = (n) => `${fmtN(n, 0, 6)}주`;
  const pct = (r) => `${r > 0 ? "+" : r < 0 ? MINUS : ""}${fmtN(r * 100, 2, 2)}%`;
  const cls = (n) => (n > 0 ? "up" : n < 0 ? "dn" : "");
  const res = $(".avg-result");
  const NOTE = '<p class="pay-note">수수료·세금·환율은 넣지 않은 계산이에요. 증권사 앱의 평단과 조금 다를 수 있어요.</p>';
  const SLOT = '<div data-chart></div>'; // 그림 자리: 결과 첫 줄 바로 아래
  const row = (k, v, c = "") => `<tr${c ? ` class="${c}"` : ""}><th scope="row">${k}</th><td>${v}</td></tr>`;
  let line = "";
  let lastChart = null;

  // ---------- 단위·라벨 ----------
  const unitLabels = () => {
    const u = usd() ? "($)" : "(원)";
    box.querySelectorAll("[data-u]").forEach((el) => { el.textContent = u; });
    box.querySelectorAll("[data-ph]").forEach((el) => { const [w, d] = el.dataset.ph.split("|"); el.placeholder = `예: ${usd() ? d : w}`; });
    box.querySelectorAll("[data-qty]").forEach((el) => { el.placeholder = frac() ? "예: 1.5" : "예: 10"; el.inputMode = frac() ? "decimal" : "numeric"; });
  };

  // ---------- 추가 매수 줄 ----------
  const list = $(".avg-rows");
  const MAXROWS = 30;
  const renum = () => {
    const lis = [...list.children];
    lis.forEach((li, i) => {
      li.querySelector(".avg-no").textContent = `${i + 1}`;
      li.querySelector("[data-del]").setAttribute("aria-label", `${i + 1}번째 매수 줄 지우기`);
      li.querySelectorAll("input").forEach((el) => { el.setAttribute("aria-label", `${i + 1}번째 추가 매수 ${el.name === "bp" ? "가격" : "수량"}`); });
    });
    $("[data-add]").disabled = lis.length >= MAXROWS;
  };
  const addRow = (p = "", q = "", focus = false) => {
    if (list.children.length >= MAXROWS) return;
    const li = document.createElement("li");
    li.className = "avg-row";
    li.innerHTML = `<span class="avg-no" aria-hidden="true"></span><label class="avg-f"><span class="avg-fl">가격 <i data-u></i></span><input name="bp" type="text" inputmode="decimal" autocomplete="off" data-ph="60,000|30.00"></label><label class="avg-f"><span class="avg-fl">수량</span><input name="bq" type="text" inputmode="numeric" autocomplete="off" data-qty></label><span class="avg-amt" aria-live="off"></span><button type="button" class="avg-del" data-del>×</button>`;
    li.querySelector('[name="bp"]').value = p;
    li.querySelector('[name="bq"]').value = q;
    list.appendChild(li);
    renum(); unitLabels();
    if (focus) li.querySelector('[name="bp"]').focus();
  };
  list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    const li = b.closest("li");
    if (list.children.length === 1) { li.querySelectorAll("input").forEach((el) => (el.value = "")); }
    else { const next = li.nextElementSibling || li.previousElementSibling; li.remove(); if (next) next.querySelector("[data-del]").focus(); }
    renum(); calc();
  });
  $("[data-add]").addEventListener("click", () => { addRow("", "", true); calc(); });

  // ---------- 시각화: 가격 사다리(점선 + 오른쪽 칩, P2-50 차트 톤) ----------
  const svg = $(".avg-svg");
  const NS = "http://www.w3.org/2000/svg";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // levels: [{ v, k: "before"|"after"|"cur"|"target", lab }], dots: [{ v, q }] 추가 매수 점, pair: [전 평단, 후 평단]
  function draw(c) {
    lastChart = c;
    const wrap = svg.closest(".avg-chart");
    if (!c) { svg.innerHTML = ""; wrap.hidden = true; return; }
    const slot = res.querySelector("[data-chart]");
    if (slot) slot.replaceWith(wrap);
    wrap.hidden = false;
    const W = Math.max(300, Math.round(svg.getBoundingClientRect().width || 340));
    const narrow = W < 460;
    const H = narrow ? 240 : 250, top = 24, bot = 42;
    const tagW = narrow ? 128 : 150, fs = narrow ? 12 : 13;
    const x0 = 10, x1 = W - tagW - 14;
    const vals = [...c.levels.map((l) => l.v), ...c.dots.map((d) => d.v)];
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const span = hi - lo || hi * 0.1 || 1;
    lo -= span * 0.14; hi += span * 0.14;
    const y = (v) => top + ((hi - v) / (hi - lo)) * (H - top - bot);
    const cB = x0 + (x1 - x0) * 0.16, cA = x0 + (x1 - x0) * 0.84, cM = (cB + cA) / 2;
    let s = `<defs><marker id="avg-ar" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#141414"/></marker></defs>`;
    s += `<rect class="avg-plot" x="${x0}" y="${top - 12}" width="${x1 - x0}" height="${H - top - bot + 24}" rx="10"/>`;
    // 현재가와 새 평단 사이(본전까지) 칠하기
    const after = c.levels.find((l) => l.k === "after"), cur = c.levels.find((l) => l.k === "cur");
    if (after && cur && Math.abs(after.v - cur.v) > 0) {
      const ya = y(after.v), yc = y(cur.v), up = cur.v >= after.v;
      s += `<rect class="avg-gap ${up ? "is-up" : "is-dn"}" x="${x0}" y="${Math.min(ya, yc)}" width="${x1 - x0}" height="${Math.abs(ya - yc)}"/>`;
    }
    // 가격 선
    for (const l of c.levels) s += `<line class="avg-lv is-${l.k}" x1="${x0}" x2="${x1}" y1="${y(l.v)}" y2="${y(l.v)}"/>`;
    // 추가 매수 점(크기 = 수량)
    if (c.dots.length) {
      const qmax = Math.max(...c.dots.map((d) => d.q));
      const n = c.dots.length;
      c.dots.forEach((d, i) => {
        const x = n === 1 ? cM : cB + 34 + ((cA - cB - 68) * i) / (n - 1);
        const r = 4 + 6 * Math.sqrt(d.q / qmax);
        s += `<circle class="avg-buy" cx="${x}" cy="${y(d.v)}" r="${r}"/>`;
      });
    }
    // 전 → 후 화살표
    if (c.pair) {
      const [b, a] = c.pair;
      const yb = y(b), ya = y(a);
      if (Math.abs(yb - ya) > 14) s += `<path class="avg-arrow" d="M${cB + 10} ${yb} C ${cM} ${yb}, ${cM} ${ya}, ${cA - 12} ${ya}" marker-end="url(#avg-ar)"/>`;
      s += `<circle class="avg-pt is-before" cx="${cB}" cy="${yb}" r="7"/><circle class="avg-pt is-after" cx="${cA}" cy="${ya}" r="8"/>`;
    }
    // 아래 칸 이름
    const yl = H - 8;
    const xl = narrow && c.xs ? c.xs : c.xl; // 좁은 화면은 짧은 이름
    s += `<text class="avg-xl" x="${cB}" y="${yl}">${xl[0]}</text>`;
    if (c.dots.length) s += `<text class="avg-xl" x="${cM}" y="${yl}">${xl[1]}</text>`;
    s += `<text class="avg-xl" x="${cA}" y="${yl}">${xl[2]}</text>`;
    // 오른쪽 칩: 겹치지 않게 위아래로 밀어 냄
    const tags = c.levels.map((l) => ({ ...l, y0: y(l.v), ty: y(l.v) })).sort((a, b) => a.y0 - b.y0);
    const gap = narrow ? 24 : 26, tMin = 12, tMax = H - bot + 8;
    for (let i = 1; i < tags.length; i++) if (tags[i].ty - tags[i - 1].ty < gap) tags[i].ty = tags[i - 1].ty + gap;
    if (tags.length && tags[tags.length - 1].ty > tMax) { tags[tags.length - 1].ty = tMax; for (let i = tags.length - 2; i >= 0; i--) if (tags[i + 1].ty - tags[i].ty < gap) tags[i].ty = tags[i + 1].ty - gap; }
    if (tags.length && tags[0].ty < tMin) { const d = tMin - tags[0].ty; tags.forEach((t) => (t.ty += d)); }
    const tx = x1 + 8;
    for (const t of tags) {
      s += `<g class="avg-tag is-${t.k}"><path class="avg-lead" d="M${x1} ${t.y0} L${tx} ${t.ty}"/><rect x="${tx}" y="${t.ty - 10.5}" width="${tagW}" height="21" rx="10.5"/><text x="${tx + 9}" y="${t.ty + 4.3}" font-size="${fs}"><tspan class="avg-tl">${esc(t.lab)}</tspan> ${esc(t.txt)}</text></g>`;
    }
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("aria-label", c.aria);
    svg.innerHTML = s;
  }
  let rt = 0;
  window.addEventListener("resize", () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(() => draw(lastChart)); });

  // ---------- 계산 ----------
  const qtyOk = (q) => q == null || frac() || Number.isInteger(q);
  const msg = (t, warn = false) => { res.innerHTML = `<p class="${warn ? "tk-msg" : "hint"}">${t}</p>`; draw(null); line = ""; };

  function calcFwd() {
    const avg = num(val("avg")), qty = num(val("qty")), cur = num(val("cur"));
    const rows = [...list.children].map((li) => ({ p: num(li.querySelector('[name="bp"]').value), q: num(li.querySelector('[name="bq"]').value), li }));
    rows.forEach((r) => { r.li.querySelector(".avg-amt").textContent = r.p > 0 && r.q > 0 ? `= ${money(r.p * r.q)}` : ""; });
    if ([avg, qty, cur].some((x) => Number.isNaN(x)) || rows.some((r) => Number.isNaN(r.p) || Number.isNaN(r.q))) return msg("숫자만 넣어 주세요. 쉼표(,)와 소수점(.)은 써도 돼요.", true);
    if ([qty, ...rows.map((r) => r.q)].some((q) => !qtyOk(q))) return msg("수량에 소수점이 있어요. 소수 주식(소수점 수량)을 사고팔았다면 위의 「소수점 수량 허용」을 켜 주세요.", true);
    if ((qty > 0 && !(avg > 0)) || (avg > 0 && !(qty > 0))) return msg("지금 평단과 보유 수량을 함께 넣어 주세요. 처음 사는 거라면 둘 다 비워 두고 매수 줄만 넣어도 돼요.");
    const buys = rows.filter((r) => r.p > 0 && r.q > 0);
    if (!buys.length) return msg(avg > 0 ? "추가로 살 가격과 수량을 넣으면 바로 새 평단이 나와요." : "지금 평단과 보유 수량, 추가로 살 가격과 수량을 넣어 주세요.");
    const r = A.forward({ avg: avg || 0, qty: qty || 0, buys, cur: cur > 0 ? cur : null });
    if (r.err) return msg("값을 확인해 주세요.", true);
    const has0 = qty > 0;
    const d = r.drop;
    const head = `<div class="age-big avg-big"><span>${has0 ? "물타기 후 새 평단" : "평균 단가"}</span> <b>${price(r.avg)}</b></div>
<p class="hint">${has0 ? `물타기 전 ${price(avg)} → 후 ${price(r.avg)} <b class="${cls(d)}">(${pct(d)})</b> · ` : ""}총 ${qtyS(r.qty)} · 총 투자금 ${money(r.cost)}</p>`;
    let pl = "";
    if (r.cur) {
      pl = `<div class="avg-pl ${cls(r.pnl)}"><span>현재가 ${price(r.cur)} 기준 평가손익</span><b>${money(r.pnl, true)}</b><b>${pct(r.rate)}</b></div>
<p class="hint">${r.pnl < 0 ? `본전(새 평단)까지 현재가에서 <b>${pct(r.need)}</b> 올라야 해요.${has0 && r.before.need > 0 ? ` 물타기 전에는 ${pct(r.before.need)} 올라야 했어요.` : ""}` : r.pnl > 0 ? "현재가가 새 평단보다 높아요." : "현재가가 새 평단과 같아요."}</p>`;
    }
    const tb = `<div class="table-wrap"><table class="dd-table pay-table avg-table"><tbody>
${has0 ? row("물타기 전", `${price(avg)} × ${qtyS(qty)} <small>투자금 ${money(r.before.cost)}</small>`) : ""}
${row(`추가 매수 ${buys.length}줄`, `${qtyS(r.add.qty)} <small>금액 ${money(r.add.cost)}</small>`)}
${row("총 수량", qtyS(r.qty))}
${row("총 투자금", money(r.cost))}
${row(has0 ? "새 평단 = 총 투자금 ÷ 총 수량" : "평균 단가 = 총 투자금 ÷ 총 수량", price(r.avg), "on")}
${r.cur ? row(`평가금액 (현재가 × ${qtyS(r.qty)})`, money(r.value)) : ""}
${r.cur ? row("평가손익 · 수익률", `<span class="${cls(r.pnl)}">${money(r.pnl, true)} · ${pct(r.rate)}</span>`, "on") : ""}
${r.cur && has0 ? row("물타기 안 했다면", `<span class="${cls(r.before.pnl)}">${money(r.before.pnl, true)} · ${pct(r.before.rate)}</span>`) : ""}
</tbody></table></div>`;
    const steps = r.steps.length > 1 || (has0 && r.steps.length) ? `<details class="avg-steps"${r.steps.length > 1 ? " open" : ""}><summary>매수할 때마다 평단 변화</summary><div class="table-wrap"><table class="dd-table avg-stable"><thead><tr><th scope="col">#</th><th scope="col">매수가 × 수량</th><th scope="col">누적 수량</th><th scope="col">누적 평단</th></tr></thead><tbody>${has0 ? `<tr><th scope="row">보유</th><td>${price(avg)} × ${qtyS(qty)}</td><td>${qtyS(qty)}</td><td>${price(avg)}</td></tr>` : ""}${r.steps.map((s, i) => `<tr><th scope="row">${i + 1}</th><td>${price(s.p)} × ${qtyS(s.q)}</td><td>${qtyS(s.qty)}</td><td>${price(s.avg)}</td></tr>`).join("")}</tbody></table></div></details>` : "";
    res.innerHTML = head + SLOT + pl + tb + steps + NOTE;
    const levels = [];
    if (has0) levels.push({ v: avg, k: "before", lab: "전 평단", txt: price(avg) });
    levels.push({ v: r.avg, k: "after", lab: has0 ? "새 평단" : "평균 단가", txt: price(r.avg) });
    if (r.cur) levels.push({ v: r.cur, k: "cur", lab: "현재가", txt: price(r.cur) });
    draw({ levels, dots: buys.map((b) => ({ v: b.p, q: b.q })), pair: has0 ? [avg, r.avg] : null, xl: ["물타기 전", "추가 매수", "물타기 후"], xs: ["전", "추가 매수", "후"], aria: `가격 비교: ${levels.map((l) => `${l.lab} ${l.txt}`).join(", ")}` });
    line = `물타기 계산: ${has0 ? `평단 ${price(avg)} × ${qtyS(qty)} + ` : ""}${buys.map((b) => `${price(b.p)} × ${qtyS(b.q)}`).join(" + ")} → ${has0 ? "새 평단" : "평균 단가"} ${price(r.avg)}${has0 ? `(${pct(d)})` : ""}, 총 ${qtyS(r.qty)}, 총 투자금 ${money(r.cost)}${r.cur ? ` · 현재가 ${price(r.cur)} 기준 ${money(r.pnl, true)}(${pct(r.rate)})` : ""} · 수수료 미반영, 투자 권유 아님`;
  }

  function calcRev() {
    const avg = num(val("avg")), qty = num(val("qty")), target = num(val("target")), cur = num(val("rcur"));
    if ([avg, qty, target, cur].some((x) => Number.isNaN(x))) return msg("숫자만 넣어 주세요. 쉼표(,)와 소수점(.)은 써도 돼요.", true);
    if (!qtyOk(qty)) return msg("보유 수량에 소수점이 있어요. 소수 주식이라면 위의 「소수점 수량 허용」을 켜 주세요.", true);
    if (!(avg > 0) || !(qty > 0)) return msg("지금 평단과 보유 수량을 넣어 주세요.");
    if (!(target > 0) || !(cur > 0)) return msg("목표 평단과 현재가(살 가격)를 넣으면 몇 주를 사야 하는지 나와요.");
    const r = A.reverse({ avg, qty, target, cur, frac: frac() });
    const lv = [{ v: avg, k: "before", lab: "지금 평단", txt: price(avg) }, { v: target, k: "target", lab: "목표 평단", txt: price(target) }, { v: cur, k: "cur", lab: "현재가", txt: price(cur) }];
    if (r.err === "already") { res.innerHTML = `<p class="tk-warn" role="note"><b>지금 평단(${price(avg)})이 이미 목표 평단(${price(target)}) 이하예요.</b> 더 사지 않아도 돼요. 목표를 지금 평단보다 낮게 넣어 주세요.</p>`; draw(null); line = ""; return; }
    if (r.err === "impossible") {
      res.innerHTML = `<p class="tk-warn" role="alert"><b>이 목표는 불가능해요.</b> 현재가(${price(cur)})가 목표 평단(${price(target)})${cur === target ? "과 같아서" : "보다 높아서"} 아무리 많이 사도 평단은 현재가에 가까워질 뿐 ${price(target)}${cur === target ? "에 닿지 않아요" : "까지 내려가지 않아요"}. 목표 평단은 <b>현재가보다 높고 지금 평단보다 낮게</b> 정해야 해요(지금이라면 ${price(cur)} 초과 ~ ${price(avg)} 미만).</p>${SLOT}${NOTE}`;
      draw({ levels: lv, dots: [], pair: null, xl: ["", "", ""], aria: `가격 비교: 지금 평단 ${price(avg)}, 목표 평단 ${price(target)}, 현재가 ${price(cur)}` });
      line = `역계산: 평단 ${price(avg)} × ${qtyS(qty)}, 현재가 ${price(cur)} → 목표 평단 ${price(target)}는 현재가 이상이라 불가능`;
      return;
    }
    if (r.err) return msg("값을 확인해 주세요.", true);
    const rounded = Math.abs(r.n - r.exact) > 1e-9;
    const val2 = cur * r.qty - r.cost, rate2 = val2 / r.cost, need2 = r.avg / cur - 1;
    // 목표 평단별 필요 수량 표(현재가와 지금 평단 사이 5단계)
    const alt = [...new Set([0.2, 0.35, 0.5, 0.65, 0.8].map((f) => +(cur + (avg - cur) * f).toFixed(usd() ? 2 : 0)))].filter((tg) => tg > cur && tg < avg).map((tg) => { const x = A.reverse({ avg, qty, target: tg, cur, frac: frac() }); return x.err ? "" : `<tr><th scope="row">${price(tg)}</th><td>${qtyS(x.n)}</td><td>${money(x.amt)}</td></tr>`; }).join("");
    res.innerHTML = `<div class="age-big avg-big"><span>현재가 ${price(cur)}에 더 살 수량</span> <b>${fmtN(r.n, 0, 6)}</b><span>주</span></div>
<p class="hint">필요한 금액 <b>${money(r.amt)}</b>${rounded ? ` · 계산값 ${fmtN(r.exact, 0, 4)}주를 ${r.frac ? "소수 6자리에서" : "정수 주로"} 올림` : ""} · 사고 나면 평단 ${price(r.avg)}</p>${SLOT}
<div class="table-wrap"><table class="dd-table pay-table avg-table"><tbody>
${row("지금", `${price(avg)} × ${qtyS(qty)} <small>투자금 ${money(avg * qty)}</small>`)}
${row("필요 수량 = 보유 수량 × (지금 평단 − 목표) ÷ (목표 − 현재가)", `${fmtN(r.exact, 0, 4)}주${rounded ? ` → <b>${qtyS(r.n)}</b>` : ""}`, "on")}
${row("필요한 금액 (현재가 × 수량)", money(r.amt), "on")}
${row("산 뒤 총 수량", qtyS(r.qty))}
${row("산 뒤 총 투자금", money(r.cost))}
${row("산 뒤 평단", price(r.avg))}
${row("산 뒤 평가손익 (현재가 기준)", `<span class="${cls(val2)}">${money(val2, true)} · ${pct(rate2)}</span>`)}
${row("본전까지 필요한 상승률", `${pct(need2)} <small>사기 전 ${pct(avg / cur - 1)}</small>`)}
</tbody></table></div>
<details class="avg-steps"><summary>목표 평단별 필요 수량·금액</summary><div class="table-wrap"><table class="dd-table avg-stable"><thead><tr><th scope="col">목표 평단</th><th scope="col">필요 수량</th><th scope="col">필요 금액</th></tr></thead><tbody>${alt}</tbody></table></div><p class="hint">목표를 현재가에 가깝게 잡을수록 필요한 수량이 빠르게 늘어나요.</p></details>
${NOTE}`;
    draw({ levels: lv, dots: [{ v: cur, q: r.n }], pair: [avg, r.avg], xl: ["지금", "추가 매수", "산 뒤"], xs: ["지금", "매수", "산 뒤"], aria: `가격 비교: 지금 평단 ${price(avg)}, 목표 평단 ${price(target)}, 현재가 ${price(cur)}, 산 뒤 평단 ${price(r.avg)}` });
    line = `평단 역계산: 평단 ${price(avg)} × ${qtyS(qty)} → 목표 평단 ${price(target)}, 현재가 ${price(cur)}에서 ${qtyS(r.n)}(${money(r.amt)}) 추가 매수 시 평단 ${price(r.avg)} · 수수료 미반영, 투자 권유 아님`;
  }

  const mode = () => val("mode");
  function calc() {
    const rev = mode() === "rev";
    box.querySelectorAll("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== mode()));
    $(".avg-cur-label").hidden = rev;
    if (rev) calcRev(); else calcFwd();
  }

  // ---------- 예시 ----------
  const EX = {
    fwd: { usd: { avg: "50", qty: "10", rows: [["30", "10"]], cur: "35" }, krw: { avg: "70000", qty: "30", rows: [["60000", "20"], ["50000", "30"]], cur: "55000" } },
    rev: { usd: { avg: "50", qty: "10", target: "40", rcur: "30" }, krw: { avg: "80000", qty: "15", target: "70000", rcur: "62000" } }
  };
  $("[data-example]").addEventListener("click", () => {
    const e = EX[mode()][usd() ? "usd" : "krw"];
    const set = (n, v) => { const el = box.querySelector(`[name="${n}"]`); if (el) el.value = v; };
    set("avg", e.avg); set("qty", e.qty);
    if (e.rows) { list.innerHTML = ""; e.rows.forEach(([p, q]) => addRow(p, q)); set("cur", e.cur); }
    else { set("target", e.target); set("rcur", e.rcur); }
    calc();
  });
  $("[data-reset]").addEventListener("click", () => {
    box.querySelectorAll('input[type="text"]').forEach((el) => (el.value = ""));
    list.innerHTML = ""; addRow(); calc();
  });
  box.querySelector("[data-copy]").addEventListener("click", async () => {
    if (!line) { toast("먼저 값을 넣어 계산해 주세요"); return; }
    toast((await copy(line)) ? "결과 한 줄을 복사했어요" : "복사에 실패했어요");
  });
  const form = box.querySelector("form");
  form.addEventListener("submit", (e) => { e.preventDefault(); calc(); });
  form.addEventListener("input", () => calc());
  form.addEventListener("change", (e) => { if (e.target.name === "unit" || e.target.name === "frac") unitLabels(); calc(); });

  addRow();
  unitLabels();
  calc();
})();
