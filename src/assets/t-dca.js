// P2-52 SOXL·TQQQ·KORU 적립식 백테스트 화면. 계산식은 dca-calc.js(window.DCACALC).
// 흐름: 종목(하나 또는 3개 비교)·시작/끝 연월·매달 투자금(원은 고정 환율 1개) → 평가액·총 투자금·수익률·연환산·MDD → 자산 곡선 vs 누적 투자금 → 거치식 비교 → 연도별 표 → 한 줄 복사
// 데이터: /assets/data/stock-<티커>.json(P2-50, scripts/update-prices.mjs). 차트는 SVG로 직접 그림(P2-50 톤: 굵은 먹선·노랑 채움·칩, 차트 안에는 데이터만). 입력값은 저장하거나 전송하지 않습니다.
(function () {
  const box = document.querySelector('[data-tool="dca"] .dca');
  if (!box || !window.DCACALC) return;
  const A = window.DCACALC;
  const $ = (s) => box.querySelector(s);
  const META = JSON.parse(box.dataset.meta); // { asOf, list: { SOXL: "2010-03", ... } }
  const TICKERS = ["SOXL", "TQQQ", "KORU"];
  const BASE = document.documentElement.dataset.base || "";
  const toast = (m) => (window.NALGI && NALGI.toast ? NALGI.toast(m) : null);
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok; }
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => { const s = String(v == null ? "" : v).replace(/[,\s원$₩]/g, ""); if (s === "") return null; if (!/^\d*\.?\d*$/.test(s)) return NaN; const n = parseFloat(s); return isFinite(n) ? n : NaN; };
  const val = (name) => { const el = box.querySelector(`[name="${name}"]`); if (!el) return null; if (el.type === "checkbox") return el.checked; if (el.type === "radio") { const c = box.querySelector(`[name="${name}"]:checked`); return c ? c.value : null; } return el.value; };
  const setv = (name, v) => { const el = box.querySelector(`[name="${name}"]`); if (el) el.value = v; };

  // ---------- 숫자 표기 ----------
  const MINUS = "−";
  const usd = () => val("unit") === "usd";
  let FX = 1400;
  const fmtN = (n, a, b) => Math.abs(n).toLocaleString("ko-KR", { minimumFractionDigits: a, maximumFractionDigits: b });
  const sg = (n, plus) => (n < 0 ? MINUS : plus && n > 0 ? "+" : "");
  // 금액은 계산을 모두 달러로 하고, 원이면 고정 환율을 곱해 보여 줌
  const money = (d, plus = false) => (usd() ? `${sg(d, plus)}$${fmtN(d, 2, 2)}` : `${sg(d, plus)}${fmtN(Math.round(d * FX), 0, 0)}원`);
  // 큰 금액 한눈에: 원은 「1억 2,345만 원」, 달러는 그대로
  const moneyBig = (d) => {
    if (usd()) return money(d);
    const w = Math.round(d * FX), s = w < 0 ? MINUS : "", a = Math.abs(w);
    if (a < 1e4) return `${s}${fmtN(a, 0, 0)}원`;
    const eok = Math.floor(a / 1e8), man = Math.round((a % 1e8) / 1e4);
    return `${s}${eok ? `${fmtN(eok, 0, 0)}억 ` : ""}${man || !eok ? `${fmtN(man, 0, 0)}만 ` : ""}원`;
  };
  // 3종목 표용: 달러는 센트 없이, 원은 「억·만」
  const moneyC = (d) => (usd() ? `${sg(d)}$${fmtN(Math.round(d), 0, 0)}` : moneyBig(d));
  // 차트 칩·눈금용 짧은 표기
  const short = (d) => {
    if (usd()) { const a = Math.abs(d); return a >= 1e6 ? `$${+(d / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M` : a >= 1e3 ? `$${+(d / 1e3).toFixed(a >= 1e5 ? 0 : 1)}k` : `$${Math.round(d)}`; }
    const w = d * FX, a = Math.abs(w);
    return a >= 1e8 ? `${+(w / 1e8).toFixed(a >= 1e10 ? 0 : 2)}억` : a >= 1e4 ? `${fmtN(Math.round(w / 1e4), 0, 0)}만` : `${fmtN(Math.round(w), 0, 0)}원`;
  };
  const pct = (r) => (r == null ? "–" : `${sg(r, true)}${fmtN(r * 100, 2, 2)}%`);
  const pct1 = (r) => (r == null ? "–" : `${sg(r, true)}${fmtN(r * 100, 1, 1)}%`);
  const cls = (n) => (n > 0 ? "up" : n < 0 ? "dn" : "");
  const ymTxt = (m) => `${m.slice(0, 4)}년 ${+m.slice(5, 7)}월`;
  const dS = (d) => d.slice(2).replace(/-/g, "."); // 칩용 짧은 날짜 26.11.06
  const dTxt = (d) => `${d.slice(0, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}`;
  const addM = (m, k) => { const t = +m.slice(0, 4) * 12 + (+m.slice(5, 7) - 1) + k; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };
  const LAST = META.asOf.slice(0, 7);

  // ---------- 데이터 ----------
  const data = {};
  const load = async (t) => {
    if (data[t]) return data[t];
    const r = await fetch(`${BASE}/assets/data/stock-${t.toLowerCase()}.json`);
    if (!r.ok) throw new Error("load");
    return (data[t] = A.decode(await r.json()));
  };

  // ---------- 입력: 연월 선택 ----------
  const y0 = Math.min(...Object.values(META.list).map((m) => +m.slice(0, 4))), y1 = +LAST.slice(0, 4);
  for (const n of ["sy", "ey"]) { const el = box.querySelector(`[name="${n}"]`); for (let y = y0; y <= y1; y++) el.insertAdjacentHTML("beforeend", `<option value="${y}">${y}년</option>`); }
  for (const n of ["sm", "em"]) { const el = box.querySelector(`[name="${n}"]`); for (let m = 1; m <= 12; m++) el.insertAdjacentHTML("beforeend", `<option value="${String(m).padStart(2, "0")}">${m}월</option>`); }
  const getYM = (p) => `${val(p + "y")}-${val(p + "m")}`;
  const setYM = (p, m) => { setv(p + "y", m.slice(0, 4)); setv(p + "m", m.slice(5, 7)); };
  const tk = () => val("tk");
  const listOf = (t) => (t === "ALL" ? TICKERS.map((x) => META.list[x]).sort().pop() : META.list[t]); // 3개 비교는 가장 늦게 상장한 종목(KORU)부터

  const unitLabels = () => {
    box.querySelectorAll("[data-u]").forEach((el) => (el.textContent = usd() ? "($)" : "(원)"));
    box.querySelectorAll("[data-krw]").forEach((el) => (el.hidden = usd()));
    $('[name="amt"]').placeholder = usd() ? "예: 200" : "예: 300,000";
  };

  // ---------- 차트 ----------
  const wrap = $(".dca-chart"), svg = $(".dca-svg"), chips = $(".dca-chips"), legend = $(".dca-legend");
  const res = $(".dca-result");
  const f1 = (n) => Math.round(n * 10) / 10;
  const tw = (s, px) => [...s].reduce((w, ch) => w + (/[0-9$.,+−\-%kM]/.test(ch) ? px * 0.6 : ch === " " ? px * 0.3 : px * 0.98), 0);
  let chart = null, geo = null;
  const SER = { SOXL: "is-soxl", TQQQ: "is-tqqq", KORU: "is-koru" };
  // 픽셀 칸마다 최저·최고 두 점만 남겨 선 모양(폭락 바닥 포함)은 그대로 두고 점 수를 줄임
  function thin(xs, ys, X, Y) {
    const out = []; let col = null, lo = null, hi = null;
    const flush = () => { if (!col) return; const a = lo.i < hi.i ? [lo, hi] : [hi, lo]; out.push(a[0]); if (a[1] !== a[0]) out.push(a[1]); };
    for (let i = 0; i < xs.length; i++) {
      const px = Math.round(X(xs[i])), p = { i, x: X(xs[i]), y: Y(ys[i]) };
      if (col !== px) { flush(); col = px; lo = hi = p; } else { if (p.y > lo.y) lo = p; if (p.y < hi.y) hi = p; }
    }
    flush();
    if (out.length && out[out.length - 1].i !== xs.length - 1) out.push({ i: xs.length - 1, x: X(xs[xs.length - 1]), y: Y(ys[ys.length - 1]) });
    return out;
  }
  function niceStep(span, n) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
  function draw(c) {
    chart = c;
    if (!c) { wrap.hidden = true; svg.innerHTML = ""; return; }
    const slot = res.querySelector("[data-chart]");
    if (slot) slot.replaceWith(wrap);
    wrap.hidden = false;
    const W = Math.max(300, Math.round(svg.getBoundingClientRect().width || wrap.clientWidth || 340));
    const narrow = W < 520;
    const H = narrow ? 270 : 340, T0 = 14, B0 = H - 26;
    const tagW = narrow ? 70 : 84, L0 = 8, R0 = W - tagW - 12;
    const xs = c.dn, n = xs.length;
    const X = (t) => L0 + ((R0 - L0) * (t - xs[0])) / Math.max(1, xs[n - 1] - xs[0]);
    let hi = 0;
    for (const s of c.series) for (const v of s.v) if (v > hi) hi = v;
    for (const v of c.inv) if (v > hi) hi = v;
    const step = niceStep(hi * 1.04, narrow ? 4 : 5), top = Math.ceil((hi * 1.04) / step) * step;
    const Y = (v) => B0 - ((B0 - T0) * v) / top;
    let s = `<rect class="dca-plot" x="${L0}" y="${T0}" width="${f1(R0 - L0)}" height="${f1(B0 - T0)}"/>`;
    // 가로 눈금(금액)
    for (let v = step; v < top + step / 2; v += step) { const y = f1(Y(v)); s += `<line class="dca-grid" x1="${L0}" x2="${f1(R0)}" y1="${y}" y2="${y}"/><text class="dca-gl" x="${L0 + 4}" y="${f1(Y(v) + 12)}">${esc(short(v))}</text>`; }
    // 세로 눈금(연도)
    const yA = +c.d[0].slice(0, 4), yB = +c.d[n - 1].slice(0, 4), span = yB - yA + 1, ys = span > (narrow ? 12 : 18) ? 4 : span > (narrow ? 6 : 10) ? 2 : 1;
    for (let y = yA + 1; y <= yB; y++) {
      if ((y - yA) % ys) continue;
      const t = Date.parse(`${y}-01-01T00:00:00Z`) / 864e5; if (t <= xs[0] || t >= xs[n - 1]) continue;
      const x = f1(X(t)); s += `<line class="dca-vgrid" x1="${x}" x2="${x}" y1="${T0}" y2="${B0}"/><text class="dca-xl" x="${x}" y="${H - 8}">${narrow && ys === 1 && span > 4 ? `'${String(y).slice(2)}` : y}</text>`;
    }
    // MDD 구간(최고점 → 바닥) 연한 빨강 띠
    if (c.mdd) { const a = X(c.mdd[0]), b = X(c.mdd[1]); s += `<rect class="dca-mdd" x="${f1(a)}" y="${T0}" width="${f1(Math.max(2, b - a))}" height="${f1(B0 - T0)}"/>`; }
    // 평가액(하나면 노랑 채움 + 굵은 먹선, 비교면 종목색 3줄, 거치식은 가는 회색 선). 채움 → 누적 투자금(파랑 점선 계단) → 선 순서로 깔아 점선이 채움에 묻히지 않게
    const paths = c.series.map((sr) => { const pts = thin(xs, sr.v, X, Y); return { sr, pts, d: pts.map((p, k) => `${k ? "L" : "M"}${f1(p.x)} ${f1(p.y)}`).join("") }; });
    for (const { sr, pts, d } of paths) if (sr.fill) s += `<path class="dca-area" d="${d}L${f1(pts[pts.length - 1].x)} ${B0}L${f1(pts[0].x)} ${B0}Z"/>`;
    const ip = thin(xs, c.inv, X, Y);
    s += `<path class="dca-inv" d="${ip.map((p, k) => (k ? `H${f1(p.x)}V${f1(p.y)}` : `M${f1(p.x)} ${f1(p.y)}`)).join("")}"/>`;
    for (const { sr, d } of paths) s += `<path class="dca-line ${sr.cls}" d="${d}"/>`;
    s += `<line class="dca-base" x1="${L0}" x2="${f1(R0)}" y1="${B0}" y2="${B0}"/>`;
    // 오른쪽 끝 칩(마지막 날 값): 겹치지 않게 밀어 냄
    const tags = [...c.series.map((sr) => ({ v: sr.v[n - 1], cls: sr.cls, txt: short(sr.v[n - 1]) })), { v: c.inv[n - 1], cls: "is-inv", txt: short(c.inv[n - 1]) }].map((t) => ({ ...t, y0: Y(t.v), ty: Y(t.v) })).sort((a, b) => a.y0 - b.y0);
    const gap = 24, tMin = T0 + 10, tMax = B0 - 4;
    for (let i = 1; i < tags.length; i++) if (tags[i].ty - tags[i - 1].ty < gap) tags[i].ty = tags[i - 1].ty + gap;
    if (tags[tags.length - 1].ty > tMax) { tags[tags.length - 1].ty = tMax; for (let i = tags.length - 2; i >= 0; i--) if (tags[i + 1].ty - tags[i].ty < gap) tags[i].ty = tags[i + 1].ty - gap; }
    if (tags[0].ty < tMin) { const d = tMin - tags[0].ty; tags.forEach((t) => (t.ty += d)); }
    const tx = R0 + 6;
    for (const t of tags) { const fs = 12.5, w = Math.min(tagW + 4, tw(t.txt, fs) + 14); s += `<g class="dca-tag ${t.cls}"><path class="dca-lead" d="M${f1(R0)} ${f1(t.y0)}L${f1(tx)} ${f1(t.ty)}"/><rect x="${f1(tx)}" y="${f1(t.ty - 10.5)}" width="${f1(w)}" height="21" rx="10.5"/><text x="${f1(tx + w / 2)}" y="${f1(t.ty + 4.4)}" font-size="${fs}">${esc(t.txt)}</text></g>`; }
    s += `<g class="dca-hover" hidden><line class="dca-hl" y1="${T0}" y2="${B0}"/>${c.series.map((sr) => `<circle class="dca-hd ${sr.cls}" r="5"/>`).join("")}<circle class="dca-hd is-inv" r="4"/></g>`;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("aria-label", c.aria);
    svg.innerHTML = s;
    geo = { X, Y, L0, R0, W };
    legend.innerHTML = c.series.map((sr) => `<span class="sq-lg dca-lg ${sr.cls}"><i></i>${esc(sr.label)}</span>`).join("") + `<span class="sq-lg dca-lg is-inv"><i></i>누적 투자금</span>` + (c.mdd ? `<span class="sq-lg dca-lg is-mdd"><i></i>최대 낙폭 구간</span>` : "");
    chips.innerHTML = c.chips;
  }
  // 차트 위를 누르거나 훑으면 그날 값(차트 위 칩 줄에 표시)
  function hover(e) {
    if (!chart || !geo) return;
    const r = svg.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * geo.W;
    if (x < geo.L0 - 4 || x > geo.R0 + 4) return unhover();
    const xs = chart.dn, t = xs[0] + ((Math.min(geo.R0, Math.max(geo.L0, x)) - geo.L0) / (geo.R0 - geo.L0)) * (xs[xs.length - 1] - xs[0]);
    let lo = 0, hi2 = xs.length - 1;
    while (hi2 - lo > 1) { const m = (lo + hi2) >> 1; if (xs[m] <= t) lo = m; else hi2 = m; }
    const k = Math.abs(xs[hi2] - t) < Math.abs(t - xs[lo]) ? hi2 : lo;
    const g = svg.querySelector(".dca-hover"); if (!g) return;
    g.removeAttribute("hidden"); // SVG 요소는 .hidden 속성이 없어 속성으로 켜고 끔
    const px = f1(geo.X(xs[k]));
    g.querySelector(".dca-hl").setAttribute("x1", px); g.querySelector(".dca-hl").setAttribute("x2", px);
    const dots = g.querySelectorAll(".dca-hd");
    chart.series.forEach((sr, j) => { dots[j].setAttribute("cx", px); dots[j].setAttribute("cy", f1(geo.Y(sr.v[k]))); });
    dots[dots.length - 1].setAttribute("cx", px); dots[dots.length - 1].setAttribute("cy", f1(geo.Y(chart.inv[k])));
    const inv = chart.inv[k];
    chips.innerHTML = `<span class="sq-chip sq-chip-bar">${dTxt(chart.d[k])}</span>` + chart.series.map((sr) => `<span class="sq-chip dca-chip ${sr.cls}"><small>${esc(sr.short)}</small> <b>${esc(short(sr.v[k]))}</b> <small class="${cls(sr.v[k] - inv)}">${pct1(sr.v[k] / inv - 1)}</small></span>`).join("") + `<span class="sq-chip dca-chip is-inv"><small>투자금</small> <b>${esc(short(inv))}</b></span>`;
  }
  function unhover() { const g = svg.querySelector(".dca-hover"); if (g) g.setAttribute("hidden", ""); if (chart) chips.innerHTML = chart.chips; }
  svg.addEventListener("pointermove", hover);
  svg.addEventListener("pointerdown", hover);
  svg.addEventListener("pointerleave", unhover);
  let rt = 0;
  window.addEventListener("resize", () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(() => chart && draw(chart)); });

  // ---------- 계산 ----------
  let line = "", seq = 0;
  const row = (k, v, c = "") => `<tr${c ? ` class="${c}"` : ""}><th scope="row">${k}</th><td>${v}</td></tr>`;
  const msg = (t, warn = false) => { res.innerHTML = `<p class="${warn ? "tk-msg" : "hint"}">${t}</p>`; draw(null); line = ""; };
  const NOTE = `<p class="pay-note">매달 첫 거래일 종가에 투자금 전부를 소수 주식으로 산다고 보고 계산했어요. 수수료·세금·배당·환율 변동은 넣지 않았어요${""}. 과거 결과가 앞으로의 수익을 뜻하지 않아요.</p>`;
  const IRR_DEF = "연환산 수익률 = 매달 넣은 돈마다 넣은 날부터 마지막 날까지 같은 연 수익률로 불어났다고 볼 때 지금 평가액과 같아지는 연 수익률(XIRR, 1년 = 365일). 거치식은 연복리 수익률(CAGR)과 같아요.";

  async function calc() {
    const my = ++seq;
    const t = tk(), amtIn = num(val("amt")), fx = num(val("fx"));
    if (Number.isNaN(amtIn) || Number.isNaN(fx)) return msg("숫자만 넣어 주세요. 쉼표(,)와 소수점(.)은 써도 돼요.", true);
    if (!usd()) { if (!(fx > 0)) return msg("환율(1달러가 몇 원인지)을 넣어 주세요.", true); FX = fx; } else FX = fx > 0 ? fx : 1400;
    if (!(amtIn > 0)) return msg("매달 투자금을 넣으면 바로 계산해요.");
    const amt = usd() ? amtIn : amtIn / FX; // 계산은 달러
    let start = getYM("s"), end = getYM("e");
    const notes = [];
    const lst = listOf(t);
    if (start < lst) { notes.push(t === "ALL" ? `3개 비교는 세 종목을 같은 기간으로 맞추려고 가장 늦게 상장한 KORU의 상장 달(${ymTxt(lst)})부터 계산했어요.` : `${t}은 ${ymTxt(lst)}에 상장해서 ${ymTxt(lst)}부터 계산했어요.`); start = lst; }
    if (end > LAST) { notes.push(`가격 데이터가 ${dTxt(META.asOf)}까지라 ${ymTxt(LAST)}까지 계산했어요.`); end = LAST; }
    if (start > end) return msg("시작 연월이 끝 연월보다 늦어요. 기간을 다시 골라 주세요.", true);
    if (start === lst) notes.push(`상장한 달(${ymTxt(lst)})은 첫 거래일 대신 상장일 종가에 샀다고 봤어요.`);
    const list = t === "ALL" ? TICKERS : [t];
    let D;
    try { if (list.some((x) => !data[x])) res.innerHTML = '<p class="hint">가격 데이터를 불러오는 중이에요…</p>'; D = await Promise.all(list.map(load)); }
    catch (e) { return msg("가격 데이터를 불러오지 못했어요. 새로 고침해 주세요.", true); }
    if (my !== seq) return;
    const R = D.map((d) => A.run(d, { start, end, amt }));
    if (R.some((r) => r.err)) return msg("이 기간에는 가격 데이터가 없어요. 기간을 다시 골라 주세요.", true);
    const noteHtml = notes.length ? `<p class="hint dca-note">${notes.join(" ")}</p>` : "";
    const per = `${ymTxt(start)} ~ ${ymTxt(end)}`;
    const fxTxt = usd() ? "" : ` (1달러 = ${fmtN(FX, 0, 2)}원 고정)`;
    if (t !== "ALL") single(t, R[0], D[0], per, fxTxt, noteHtml, amtIn);
    else compare(R, D, per, fxTxt, noteHtml, amtIn);
  }

  function single(t, r, D, per, fxTxt, noteHtml, amtIn) {
    const L = r.lump, amtS = usd() ? money(r.amt) : `${fmtN(amtIn, 0, 0)}원`;
    const head = `<div class="age-big dca-big"><span>${t} 매달 ${amtS} 적립 → ${dTxt(r.last)} 평가액</span> <b>${moneyBig(r.value)}</b></div>
<p class="hint">${per} · ${r.n}번 매수 · 총 투자금 <b>${money(r.inv)}</b> · 수익률 <b class="${cls(r.rate)}">${pct(r.rate)}</b>${r.irr != null ? ` · 연환산 <b class="${cls(r.irr)}">${pct(r.irr)}</b>` : ""}${fxTxt}</p>${noteHtml}`;
    const stats = `<ul class="dca-stats">
<li><span>총 투자금</span><b>${money(r.inv)}</b><small>${amtS} × ${r.n}번</small></li>
<li class="${cls(r.pnl)}"><span>손익</span><b>${r.pnl > 0 ? "+" : ""}${moneyBig(r.pnl)}</b><small>수익률 ${pct(r.rate)}</small></li>
<li class="${cls(r.irr)}"><span>연환산 수익률</span><b>${r.irr == null ? "–" : pct(r.irr)}</b><small>${r.irr == null ? "1년 미만이라 생략" : "XIRR, 아래 정의"}</small></li>
<li class="dn"><span>최대 낙폭 (MDD)</span><b>${pct(r.mdd)}</b><small>${dTxt(r.mddPeak)} → ${dTxt(r.mddTrough)}</small></li>
<li class="${cls(r.low)}"><span>가장 나빴을 때</span><b>${pct(r.low)}</b><small>${dTxt(r.lowDate)} · 투자금 대비</small></li>
<li><span>모은 주식</span><b>${fmtN(r.shares, 0, 4)}주</b><small>평균 매수가 ${usd() ? `$${fmtN(r.avg, 2, 4)}` : `${fmtN(r.avg * FX, 0, 2)}원`}</small></li>
</ul>`;
    const better = r.value >= L.value ? "적립식" : "거치식";
    const cmp = `<h3 class="dca-h3">거치식(같은 총액을 처음에 한 번에)과 비교</h3>
<div class="table-wrap"><table class="dd-table dca-cmp"><thead><tr><th scope="col"></th><th scope="col">적립식 <small>매달 ${amtS}</small></th><th scope="col">거치식 <small>${dTxt(r.first)}에 ${money(L.inv)}</small></th></tr></thead><tbody>
<tr><th scope="row">평가액</th><td class="${r.value >= L.value ? "on" : ""}">${money(r.value)}</td><td class="${L.value > r.value ? "on" : ""}">${money(L.value)}</td></tr>
<tr><th scope="row">수익률</th><td class="${cls(r.rate)}">${pct(r.rate)}</td><td class="${cls(L.rate)}">${pct(L.rate)}</td></tr>
<tr><th scope="row">연환산</th><td>${r.irr == null ? "–" : pct(r.irr)}</td><td>${L.cagr == null ? "–" : pct(L.cagr)}</td></tr>
<tr><th scope="row">최대 낙폭</th><td class="dn">${pct(r.mdd)}</td><td class="dn">${pct(L.mdd)}</td></tr>
</tbody></table></div>
<p class="hint">이 기간에는 <b>${better}</b>이 평가액이 더 컸어요. 거치식은 첫날부터 돈이 모두 들어가 있어 오를 때는 크게 벌고 떨어질 때는 크게 잃어요. 적립식은 돈이 나눠 들어가 처음 낙폭의 영향이 작아요.</p>`;
    const yt = `<details class="dca-years" open><summary>연도별 표</summary><div class="table-wrap"><table class="dd-table dca-ytable"><thead><tr><th scope="col">연도</th><th scope="col">그해 넣은 돈</th><th scope="col">누적 투자금</th><th scope="col">연말 평가액</th><th scope="col">누적 수익률</th><th scope="col">그해 주가</th><th scope="col">거치식 평가액</th></tr></thead><tbody>${r.years.map((y) => `<tr><th scope="row">${y.y}${y.last.slice(5) !== "12-31" && y === r.years[r.years.length - 1] ? `<small>~${+y.last.slice(5, 7)}.${+y.last.slice(8)}</small>` : ""}</th><td>${money(y.add)}</td><td>${money(y.inv)}</td><td>${money(y.value)}</td><td class="${cls(y.rate)}">${pct1(y.rate)}</td><td class="${cls(y.move)}">${pct1(y.move)}</td><td>${money(y.lump)}</td></tr>`).join("")}</tbody></table></div><p class="hint">연말 = 그해 마지막 거래일 종가 기준. 「그해 주가」는 전년 말(첫해는 첫 매수일) 종가 대비 등락이에요.</p></details>`;
    const bl = `<details class="dca-years"><summary>매달 매수 내역 (${r.n}번)</summary><div class="table-wrap"><table class="dd-table dca-ytable"><thead><tr><th scope="col">#</th><th scope="col">매수일</th><th scope="col">종가</th><th scope="col">산 주식</th><th scope="col">누적 주식</th></tr></thead><tbody>${(() => { let acc = 0; return r.buys.map((i, k) => { const q = r.amt / D.c[i]; acc += q; return `<tr><th scope="row">${k + 1}</th><td>${D.d[i]}</td><td>$${fmtN(D.c[i], 2, 4)}</td><td>${fmtN(q, 0, 4)}</td><td>${fmtN(acc, 0, 4)}</td></tr>`; }).join(""); })()}</tbody></table></div></details>`;
    res.innerHTML = head + '<div data-chart></div>' + stats + `<p class="hint dca-def">${IRR_DEF} 최대 낙폭 = 평가액이 그때까지의 최고 평가액에서 가장 많이 줄어든 비율(중간에 넣은 돈도 평가액에 포함).</p>` + cmp + yt + bl + NOTE;
    const S = r.series, dn = S.idx.map((i) => D.dn[i]), d = S.idx.map((i) => D.d[i]);
    const series = [{ v: S.val, cls: "is-main", label: `${t} 적립식 평가액`, short: "평가액", fill: true }];
    if (val("lumpline")) series.push({ v: S.lump, cls: "is-lump", label: "거치식 평가액", short: "거치식" });
    const mdd = r.mdd < 0 ? [D.dn[D.d.indexOf(r.mddPeak)], D.dn[D.d.indexOf(r.mddTrough)]] : null;
    draw({ dn, d, inv: S.inv, series, mdd, chips: `<span class="sq-chip sq-chip-bar">${t}</span><span class="sq-chip">${dS(r.first)} ~ ${dS(r.last)}</span><span class="sq-chip dca-chip-res ${cls(r.rate)}">수익률 <b>${pct1(r.rate)}</b></span>`, aria: `${t} 적립식 자산 곡선: ${per}, 평가액 ${money(r.value)}, 누적 투자금 ${money(r.inv)}, 최대 낙폭 ${pct(r.mdd)}` });
    line = `${t} 적립식 백테스트: ${per} 매달 첫 거래일에 ${amtS}${fxTxt} → ${dTxt(r.last)} 평가액 ${money(r.value)}, 총 투자금 ${money(r.inv)}, 수익률 ${pct(r.rate)}${r.irr != null ? `, 연환산(XIRR) ${pct(r.irr)}` : ""}, MDD ${pct(r.mdd)} · 거치식이면 ${money(L.value)}(${pct(L.rate)}) · 수수료·세금·배당 미반영, 투자 권유 아님`;
  }

  function compare(R, D, per, fxTxt, noteHtml, amtIn) {
    const amtS = usd() ? money(R[0].amt) : `${fmtN(amtIn, 0, 0)}원`;
    const best = R.reduce((a, r, i) => (r.value > R[a].value ? i : a), 0);
    const head = `<div class="age-big dca-big"><span>3종목 매달 ${amtS} 적립 → ${dTxt(R[0].last)} 평가액이 가장 큰 종목</span> <b>${TICKERS[best]} ${moneyBig(R[best].value)}</b></div>
<p class="hint">${per} · 종목마다 ${R[0].n}번 매수 · 총 투자금 각 <b>${money(R[0].inv)}</b>${fxTxt}</p>${noteHtml}`;
    const cell = (f, c) => R.map((r, i) => `<td class="${c ? c(r, i) : ""}">${f(r)}</td>`).join("");
    const top = (g) => (r, i) => (R.every((x) => g(x) <= g(r)) ? "on" : "");
    // 3종목 표는 좁은 화면에 맞게 평가액을 달러는 센트 없이, 원화는 「2억 4,480만 원」처럼(moneyC)
    const tb = `<div class="table-wrap"><table class="dd-table dca-cmp dca-cmp3"><thead><tr><th scope="col"></th>${TICKERS.map((x) => `<th scope="col"><span class="dca-dot ${SER[x]}"></span>${x}</th>`).join("")}</tr></thead><tbody>
<tr><th scope="row">평가액</th>${cell((r) => moneyC(r.value), top((r) => r.value))}</tr>
<tr><th scope="row">수익률</th>${cell((r) => pct(r.rate), (r) => cls(r.rate))}</tr>
<tr><th scope="row">연환산</th>${cell((r) => (r.irr == null ? "–" : pct(r.irr)))}</tr>
<tr><th scope="row">최대 낙폭</th>${cell((r) => pct(r.mdd), () => "dn")}</tr>
<tr><th scope="row">가장 나빴을 때</th>${cell((r) => `${pct(r.low)}<small>${dS(r.lowDate)}</small>`, (r) => cls(r.low))}</tr>
<tr class="dca-sep"><th scope="row">거치식 평가액</th>${cell((r) => moneyC(r.lump.value))}</tr>
<tr><th scope="row">거치식 수익률</th>${cell((r) => pct(r.lump.rate), (r) => cls(r.lump.rate))}</tr>
<tr><th scope="row">거치식 최대 낙폭</th>${cell((r) => pct(r.lump.mdd), () => "dn")}</tr>
</tbody></table></div>
<p class="hint">거치식 = 같은 총액 ${money(R[0].lump.inv)}을 ${dTxt(R[0].first)} 종가에 한 번에 산 경우. ${IRR_DEF}</p>`;
    // 연도별: 종목마다 날짜가 조금 다를 수 있어 연도로 맞춤
    const ys = [...new Set(R.flatMap((r) => r.years.map((y) => y.y)))].sort();
    const yt = `<details class="dca-years" open><summary>연도별 연말 평가액</summary><div class="table-wrap"><table class="dd-table dca-ytable"><thead><tr><th scope="col">연도</th><th scope="col">누적 투자금</th>${TICKERS.map((x) => `<th scope="col">${x}</th>`).join("")}</tr></thead><tbody>${ys.map((y) => { const row0 = R[0].years.find((v) => v.y === y); return `<tr><th scope="row">${y}</th><td>${row0 ? money(row0.inv) : "–"}</td>${R.map((r) => { const v = r.years.find((z) => z.y === y); return v ? `<td>${money(v.value)}<small class="${cls(v.rate)}">${pct1(v.rate)}</small></td>` : "<td>–</td>"; }).join("")}</tr>`; }).join("")}</tbody></table></div></details>`;
    res.innerHTML = head + '<div data-chart></div>' + tb + yt + NOTE;
    // 차트: 날짜 축은 첫 종목 기준, 다른 종목은 같은 날짜의 값(없으면 직전 값)
    const base = R[0], dn = base.series.idx.map((i) => D[0].dn[i]), d = base.series.idx.map((i) => D[0].d[i]);
    const align = (r, Dk) => { const m = new Map(r.series.idx.map((i, k) => [Dk.dn[i], r.series.val[k]])); let last = 0; return dn.map((t) => { if (m.has(t)) last = m.get(t); return last; }); };
    const series = R.map((r, k) => ({ v: k ? align(r, D[k]) : r.series.val, cls: SER[TICKERS[k]], label: TICKERS[k], short: TICKERS[k] }));
    draw({ dn, d, inv: base.series.inv, series, mdd: null, chips: `<span class="sq-chip sq-chip-bar">3종목 비교</span><span class="sq-chip">${dS(base.first)} ~ ${dS(base.last)}</span>`, aria: `3종목 적립식 자산 곡선: ${TICKERS.map((x, i) => `${x} ${money(R[i].value)}`).join(", ")}, 누적 투자금 ${money(base.inv)}` });
    line = `SOXL·TQQQ·KORU 적립식 백테스트: ${per} 매달 첫 거래일에 ${amtS}${fxTxt}, 총 투자금 각 ${money(base.inv)} → ${dTxt(base.last)} 평가액 ${TICKERS.map((x, i) => `${x} ${money(R[i].value)}(${pct(R[i].rate)}, MDD ${pct(R[i].mdd)})`).join(" · ")} · 수수료·세금·배당 미반영, 투자 권유 아님`;
  }

  // ---------- 이벤트 ----------
  const DEF = { tk: "TQQQ", s: `${+LAST.slice(0, 4) - 10}-01`, e: LAST, unit: "krw", amt: "300,000", fx: "1,400" };
  const reset = () => {
    box.querySelector(`[name="tk"][value="${DEF.tk}"]`).checked = true;
    box.querySelector(`[name="unit"][value="${DEF.unit}"]`).checked = true;
    setYM("s", DEF.s); setYM("e", DEF.e); setv("amt", DEF.amt); setv("fx", DEF.fx); $('[name="lumpline"]').checked = false;
    unitLabels(); calc();
  };
  box.querySelectorAll("[data-range]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.range;
    setYM("e", LAST);
    setYM("s", k === "list" ? listOf(tk()) : addM(LAST, -12 * +k + 1));
    calc();
  }));
  $("[data-reset]").addEventListener("click", reset);
  $("[data-copy]").addEventListener("click", async () => {
    if (!line) { toast("먼저 값을 넣어 계산해 주세요"); return; }
    toast((await copy(line)) ? "결과 한 줄을 복사했어요" : "복사에 실패했어요");
  });
  const form = box.querySelector("form");
  let tm = 0;
  form.addEventListener("submit", (e) => { e.preventDefault(); calc(); });
  form.addEventListener("input", (e) => { if (e.target.tagName === "INPUT" && e.target.type === "text") { clearTimeout(tm); tm = setTimeout(calc, 200); } });
  form.addEventListener("change", (e) => {
    if (e.target.name === "unit") { // 단위를 바꾸면 매달 투자금을 고정 환율로 바꿔 넣음
      const a = num(val("amt")), fx = num(val("fx")) > 0 ? num(val("fx")) : 1400;
      if (a > 0) setv("amt", usd() ? fmtN(Math.round(a / fx), 0, 0) : fmtN(Math.round((a * fx) / 1000) * 1000, 0, 0));
      unitLabels();
    }
    if (e.target.type !== "text") calc();
  });
  reset();
})();
