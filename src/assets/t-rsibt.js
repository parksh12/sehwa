// P2-54 RSI 매매 백테스트(SOXL·TQQQ·KORU) 화면. 계산식은 rsi-bt-calc.js(window.RSIBT).
// 흐름: 종목·일봉/주봉·기간·RSI 기간·매수/매도 기준·손절·수수료·초기 자금 → 요약(전략 vs 그냥 보유) → 가격 차트(매수▲·매도▼) + RSI 패널 → 지표 칸 → 자산 곡선 → 거래 목록 → 한 줄 복사
// 데이터: /assets/data/stock-<티커>.json(P2-50, scripts/update-prices.mjs). 차트는 SVG로 직접 그림(P2-50 톤: 캔들·점선·칩, 차트 안에는 데이터만). 입력값은 저장하거나 전송하지 않습니다.
(function () {
  const box = document.querySelector('[data-tool="rsibt"] .rsb');
  if (!box || !window.RSIBT) return;
  const A = window.RSIBT;
  const $ = (s) => box.querySelector(s);
  const META = JSON.parse(box.dataset.meta); // { asOf, list: { SOXL: "2010-03", ... } }
  const BASE = document.documentElement.dataset.base || "";
  const toast = (m) => (window.NALGI && NALGI.toast ? NALGI.toast(m) : null);
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok; }
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => { const s = String(v == null ? "" : v).replace(/[,\s%$]/g, ""); if (s === "") return null; if (!/^\d*\.?\d*$/.test(s)) return NaN; const n = parseFloat(s); return isFinite(n) ? n : NaN; };
  const val = (name) => { const el = box.querySelector(`[name="${name}"]`); if (!el) return null; if (el.type === "radio") { const c = box.querySelector(`[name="${name}"]:checked`); return c ? c.value : null; } return el.value; };
  const setv = (name, v) => { const el = box.querySelector(`[name="${name}"]`); if (el) el.value = v; };

  // ---------- 숫자 표기 ----------
  const MINUS = "−";
  const fmtN = (n, a, b) => Math.abs(n).toLocaleString("ko-KR", { minimumFractionDigits: a, maximumFractionDigits: b });
  const sg = (n, plus) => (n < 0 ? MINUS : plus && n > 0 ? "+" : "");
  const usd = (d) => `${sg(d)}$${fmtN(d, 2, 2)}`;
  const usd0 = (d) => `${sg(d)}$${fmtN(Math.round(d), 0, 0)}`;
  const px = (p) => "$" + (p >= 1 ? fmtN(p, 2, 2) : fmtN(p, 4, 4));
  const short = (d) => { const a = Math.abs(d); return a >= 1e6 ? `$${+(d / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M` : a >= 1e3 ? `$${+(d / 1e3).toFixed(a >= 1e5 ? 0 : 1)}k` : `$${a >= 10 ? Math.round(d) : +d.toFixed(2)}`; };
  const pct = (r) => (r == null ? "–" : `${sg(r, true)}${fmtN(r * 100, 2, 2)}%`);
  const pct1 = (r) => (r == null ? "–" : `${sg(r, true)}${fmtN(r * 100, 1, 1)}%`);
  const cls = (n) => (n > 0 ? "up" : n < 0 ? "dn" : "");
  const ymTxt = (m) => `${m.slice(0, 4)}년 ${+m.slice(5, 7)}월`;
  const dS = (d) => d.slice(2).replace(/-/g, ".");
  const dTxt = (d) => `${d.slice(0, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}`;
  const addM = (m, k) => { const t = +m.slice(0, 4) * 12 + (+m.slice(5, 7) - 1) + k; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };
  const LAST = META.asOf.slice(0, 7);
  const dur = (days) => (days >= 365 ? `${fmtN(days / 365, 1, 1)}년` : `${fmtN(days, 0, 0)}일`);

  // ---------- 데이터 ----------
  const data = {};
  const load = async (t) => {
    if (data[t]) return data[t];
    const r = await fetch(`${BASE}/assets/data/stock-${t.toLowerCase()}.json`);
    if (!r.ok) throw new Error("load");
    return (data[t] = A.decode(await r.json()));
  };

  // ---------- 입력: 연월 ----------
  const y0 = Math.min(...Object.values(META.list).map((m) => +m.slice(0, 4))), y1 = +LAST.slice(0, 4);
  for (const n of ["sy", "ey"]) { const el = box.querySelector(`[name="${n}"]`); for (let y = y0; y <= y1; y++) el.insertAdjacentHTML("beforeend", `<option value="${y}">${y}년</option>`); }
  for (const n of ["sm", "em"]) { const el = box.querySelector(`[name="${n}"]`); for (let m = 1; m <= 12; m++) el.insertAdjacentHTML("beforeend", `<option value="${String(m).padStart(2, "0")}">${m}월</option>`); }
  const getYM = (p) => `${val(p + "y")}-${val(p + "m")}`;
  const setYM = (p, m) => { setv(p + "y", m.slice(0, 4)); setv(p + "m", m.slice(5, 7)); };

  // ---------- 차트 공통 ----------
  const res = $(".rsb-result");
  const pWrap = $(".rsb-pchart"), pSvg = $(".rsb-psvg"), rSvg = $(".rsb-rsvg"), pChips = $(".rsb-pchips"), pLeg = $(".rsb-plegend");
  const eWrap = $(".rsb-echart"), eSvg = $(".rsb-esvg"), eChips = $(".rsb-echips"), eLeg = $(".rsb-elegend");
  const f1 = (n) => Math.round(n * 10) / 10;
  const tw = (s, px) => [...s].reduce((w, ch) => w + (/[0-9$.,+−\-%kM]/.test(ch) ? px * 0.6 : ch === " " ? px * 0.3 : px * 0.98), 0);
  function niceStep(span, n) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
  // 값 축: 최고 ÷ 최저가 10배 넘으면 로그 눈금(레버리지 ETF는 10년에 수십 배라 선형이면 앞부분이 바닥에 붙음)
  function scale(lo, hi, T0, B0, nTicks) {
    const log = hi / lo > 10;
    if (log) {
      const a = Math.log(lo * 0.92), b = Math.log(hi * 1.06);
      const Y = (v) => B0 - ((B0 - T0) * (Math.log(v) - a)) / (b - a);
      const ticks = [];
      for (let e = Math.floor(Math.log10(lo * 0.92)); e <= Math.ceil(Math.log10(hi * 1.06)); e++) for (const m of [1, 2, 5]) { const v = m * Math.pow(10, e); if (v >= lo * 0.92 && v <= hi * 1.06) ticks.push(v); }
      const keep = ticks.length > nTicks * 1.6 ? ticks.filter((v) => /^1/.test(String(v / Math.pow(10, Math.floor(Math.log10(v) + 1e-9))))) : ticks;
      return { Y, ticks: keep, log };
    }
    const pad = (hi - lo || hi * 0.05) * 0.06, l = Math.max(0, lo - pad), h = hi + pad;
    const st = niceStep(h - l, nTicks), t0 = Math.ceil(l / st) * st, ticks = [];
    for (let v = t0; v <= h; v += st) ticks.push(v);
    return { Y: (v) => B0 - ((B0 - T0) * (v - l)) / (h - l), ticks, log };
  }
  function thin(xs, ys, X, Y) { // 픽셀 칸마다 최저·최고 두 점만 남김(급락 바닥 모양 유지)
    const out = []; let col = null, lo = null, hi = null;
    const flush = () => { if (!col && col !== 0) return; const a = lo.i < hi.i ? [lo, hi] : [hi, lo]; out.push(a[0]); if (a[1] !== a[0]) out.push(a[1]); };
    for (let i = 0; i < xs.length; i++) {
      const p = { i, x: X(xs[i]), y: Y(ys[i]) }, c = Math.round(p.x);
      if (col !== c) { flush(); col = c; lo = hi = p; } else { if (p.y > lo.y) lo = p; if (p.y < hi.y) hi = p; }
    }
    flush();
    if (out.length && out[out.length - 1].i !== xs.length - 1) out.push({ i: xs.length - 1, x: X(xs[xs.length - 1]), y: Y(ys[ys.length - 1]) });
    return out;
  }
  const path = (pts) => pts.map((p, k) => `${k ? "L" : "M"}${f1(p.x)} ${f1(p.y)}`).join("");
  // 연도 세로 눈금: 봉의 해가 바뀌는 자리
  function yearTicks(B, D, X, T0, B0, H, narrow) {
    const yA = +D.d[B[0].e].slice(0, 4), yB = +D.d[B[B.length - 1].e].slice(0, 4), span = yB - yA + 1;
    const step = span > (narrow ? 12 : 18) ? 4 : span > (narrow ? 6 : 10) ? 2 : 1;
    let s = "";
    if (span <= 1) { // 1년 안: 분기마다 월 표시
      for (let k = 1; k < B.length; k++) { const a = D.d[B[k - 1].e].slice(5, 7), b = D.d[B[k].e].slice(5, 7); if (a !== b && ["01", "04", "07", "10"].includes(b)) { const x = f1(X(k)); s += `<line class="dca-vgrid" x1="${x}" x2="${x}" y1="${T0}" y2="${B0}"/><text class="dca-xl" x="${x}" y="${H - 6}">${+b}월</text>`; } }
      return s;
    }
    for (let k = 1; k < B.length; k++) {
      const y = +D.d[B[k].e].slice(0, 4);
      if (y === +D.d[B[k - 1].e].slice(0, 4) || (y - yA) % step) continue;
      const x = f1(X(k)); s += `<line class="dca-vgrid" x1="${x}" x2="${x}" y1="${T0}" y2="${B0}"/><text class="dca-xl" x="${x}" y="${H - 6}">${narrow && step === 1 && span > 4 ? `'${String(y).slice(2)}` : y}</text>`;
    }
    return s;
  }

  // ---------- 가격 차트 + 매수·매도 표시 + RSI 패널 ----------
  let pc = null; // { r, D, X, W, L0, R0, chips }
  function drawPrice(r, D, t) {
    const S = r.series, B = S.B, M = B.length;
    const W = Math.max(300, Math.round(pSvg.getBoundingClientRect().width || pWrap.clientWidth || 340));
    const narrow = W < 520, H = narrow ? 250 : 320, T0 = 12, B0 = H - 24, L0 = 8, R0 = W - 30; // 오른쪽 22px은 RSI 기준값(30·70) 자리(가격 차트와 RSI 패널 가로축을 맞춤)
    const slot = (R0 - L0) / M, X = (k) => L0 + slot * (k + 0.5);
    const candles = slot >= 2.4; // 봉 칸이 2.4px 이상이면 캔들, 아니면 종가선
    let lo = Infinity, hi = 0;
    for (const b of B) { const a = candles ? b.l : b.c, z = candles ? b.h : b.c; if (a < lo) lo = a; if (z > hi) hi = z; }
    const { Y, ticks, log } = scale(lo, hi, T0 + 10, B0 - 10, narrow ? 4 : 5);
    let s = `<rect class="dca-plot" x="${L0}" y="${T0}" width="${f1(R0 - L0)}" height="${f1(B0 - T0)}"/>`;
    // 보유 구간(매수 봉 ~ 매도 봉) 연노랑 띠
    for (const tr of r.trades) { const a = X(tr.ek) - slot / 2, b = X(tr.xk == null ? M - 1 : tr.xk) + slot / 2; s += `<rect class="rsb-hold" x="${f1(a)}" y="${T0}" width="${f1(Math.max(2, b - a))}" height="${f1(B0 - T0)}"/>`; }
    let gl = ""; // 눈금 글자는 선·표시 위에(흰 테두리) 맨 나중에 그림
    for (const v of ticks) { const y = Y(v); if (y < T0 + 8 || y > B0 - 4) continue; s += `<line class="dca-grid" x1="${L0}" x2="${f1(R0)}" y1="${f1(y)}" y2="${f1(y)}"/>`; gl += `<text class="dca-gl" x="${L0 + 4}" y="${f1(y - 3)}">${esc(v >= 1 ? short(v) : "$" + +v.toFixed(3))}</text>`; }
    s += yearTicks(B, D, X, T0, B0, H, narrow);
    if (candles) {
      const bw = Math.max(1.6, slot * 0.66), dense = slot < 4 ? " is-thin" : slot < 8 ? " is-mid" : "";
      s += `<g class="sqc-cdls${dense}">${B.map((b, k) => { const up = b.c > b.o, dn = b.c < b.o, yt = Y(Math.max(b.o, b.c)), yb = Y(Math.min(b.o, b.c)), hg = Math.max(1.6, yb - yt), x = X(k); return `<g class="sqc-cdl ${up ? "is-up" : dn ? "is-dn" : "is-eq"}"><line x1="${f1(x)}" y1="${f1(Y(b.h))}" x2="${f1(x)}" y2="${f1(Y(b.l))}"/><rect x="${f1(x - bw / 2)}" y="${f1(yt - (hg - (yb - yt)) / 2)}" width="${f1(bw)}" height="${f1(hg)}"/></g>`; }).join("")}</g>`;
    } else {
      s += `<path class="rsb-close" d="${path(thin(B.map((_, k) => k), B.map((b) => b.c), X, Y))}"/>`;
    }
    // 매수 ▲(봉 아래)·매도 ▼(봉 위). 손절 매도는 속이 빈 ▼
    const tri = narrow ? 6 : 7;
    const at = (k, up) => { const b = B[k], y = candles ? (up ? Y(b.l) + 4 : Y(b.h) - 4) : (up ? Y(b.c) + 5 : Y(b.c) - 5); return [X(k), Math.max(T0 + tri + 2, Math.min(B0 - tri - 2, y))]; };
    let mk = "";
    for (const tr of r.trades) {
      const [bx, by] = at(tr.ek, true);
      mk += `<path class="rsb-mk is-buy" d="M${f1(bx)} ${f1(by)}l${tri} ${f1(tri * 1.6)}h${-2 * tri}z"/>`;
      if (tr.xk != null) { const [sx, sy] = at(tr.xk, false); mk += `<path class="rsb-mk is-sell${tr.why === "stop" ? " is-stop" : ""}" d="M${f1(sx)} ${f1(sy)}l${tri} ${f1(-tri * 1.6)}h${-2 * tri}z"/>`; }
    }
    s += `<g class="rsb-mks">${mk}</g>` + gl;
    s += `<line class="dca-base" x1="${L0}" x2="${f1(R0)}" y1="${B0}" y2="${B0}"/>`;
    s += `<g class="rsb-hover" visibility="hidden"><line class="dca-hl" y1="${T0}" y2="${B0}"/><circle class="dca-hd is-main" r="4.5"/></g>`;
    pSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    pSvg.innerHTML = s;
    const tf = r.weekly ? "주봉" : "일봉";
    pSvg.setAttribute("aria-label", `${t} ${tf} ${candles ? "캔들" : "종가"} 차트 ${M}개 봉, 매수 ${r.trades.length}번, 매도 ${r.closed}번${log ? ", 로그 눈금" : ""}`);
    // RSI 패널: 매수·매도 기준선(점선)과 그 사이 띠, RSI 선, 매매 점
    const RH = narrow ? 110 : 124, RT = 22, RB = RH - 10, RY = (v) => RB - ((RB - RT) * v) / 100;
    let q = `<rect class="sqr-band" x="${L0}" y="${f1(RY(r.sell))}" width="${f1(R0 - L0)}" height="${f1(RY(r.buy) - RY(r.sell))}"/>`;
    q += [[r.sell, "is-sell"], [r.buy, "is-buy"]].map(([v, c]) => `<line class="sqr-lv rsb-lv ${c}" x1="${L0}" y1="${f1(RY(v))}" x2="${f1(R0)}" y2="${f1(RY(v))}"/><text class="sqr-lvt" x="${f1(R0 + 4)}" y="${f1(RY(v) + 4.5)}" font-size="12.5">${fmtN(v, 0, 1)}</text>`).join("");
    const rp = []; S.rsi.forEach((v, k) => { if (v != null) rp.push({ x: X(k), y: RY(v), i: k }); });
    if (rp.length > 1) { const th = thin(rp.map((p) => p.i), rp.map((p) => S.rsi[p.i]), X, RY); q += `<path class="sqr-line rsb-rline" d="${path(th)}"/>`; }
    for (const tr of r.trades) {
      q += `<circle class="sqr-dot is-cold" cx="${f1(X(tr.ek))}" cy="${f1(RY(tr.rin))}" r="3.6"/>`;
      if (tr.xk != null && tr.rout != null) q += `<circle class="sqr-dot ${tr.why === "stop" ? "" : "is-hot"}" cx="${f1(X(tr.xk))}" cy="${f1(RY(tr.rout))}" r="3.6"/>`;
    }
    q += `<text class="sqr-h" x="${L0 + 2}" y="15" font-size="13">RSI(${r.n}) · ${tf}</text>`;
    q += `<line class="dca-hl rsb-rhl" y1="${RT}" y2="${RB}" visibility="hidden"/>`;
    rSvg.setAttribute("viewBox", `0 0 ${W} ${RH}`);
    rSvg.innerHTML = q;
    rSvg.setAttribute("aria-label", `RSI(${r.n}) ${tf}, 매수 기준 ${r.buy} 이하, 매도 기준 ${r.sell} 이상`);
    const lastR = S.rsi[M - 1];
    const chips = `<span class="sq-chip sq-chip-bar">${t} ${tf} <small>${M}개</small></span><span class="sq-chip">${dS(r.first)} ~ ${dS(r.last)}</span><span class="sq-chip sq-chip-rsi">마지막 RSI <b>${lastR == null ? "–" : fmtN(lastR, 1, 1)}</b></span>${log ? '<span class="sq-chip"><small>로그 눈금</small></span>' : ""}`;
    pChips.innerHTML = chips;
    const ico = (d, c) => `<svg class="rsb-ico ${c}" viewBox="0 0 14 12" width="14" height="12" aria-hidden="true"><path d="${d}"/></svg>`, UP = "M7 1 13 11H1z", DN = "M7 11 13 1H1z";
    pLeg.innerHTML = `<span class="sq-lg rsb-lg is-buy">${ico(UP, "is-buy")}매수 ≤ ${fmtN(r.buy, 0, 1)}</span><span class="sq-lg rsb-lg is-sell">${ico(DN, "is-sell")}매도 ≥ ${fmtN(r.sell, 0, 1)}</span>${r.stop != null ? `<span class="sq-lg rsb-lg is-stop">${ico(DN, "is-stop")}손절</span>` : ""}<span class="sq-lg rsb-lg is-hold"><i></i>보유</span>`;
    pc = { r, D, X, W, L0, R0, Y, M, chips, candles };
  }
  function pHover(e) {
    if (!pc) return;
    const svg = e.currentTarget, rc = svg.getBoundingClientRect(), x = ((e.clientX - rc.left) / rc.width) * pc.W;
    if (x < pc.L0 - 4 || x > pc.R0 + 4) return pUnhover();
    const k = Math.max(0, Math.min(pc.M - 1, Math.round((x - pc.L0) / ((pc.R0 - pc.L0) / pc.M) - 0.5)));
    const S = pc.r.series, b = S.B[k], X = f1(pc.X(k));
    const g = pSvg.querySelector(".rsb-hover"); if (!g) return;
    g.setAttribute("visibility", "visible");
    g.querySelector("line").setAttribute("x1", X); g.querySelector("line").setAttribute("x2", X);
    g.querySelector("circle").setAttribute("cx", X); g.querySelector("circle").setAttribute("cy", f1(pc.Y(b.c)));
    const rl = rSvg.querySelector(".rsb-rhl"); if (rl) { rl.setAttribute("x1", X); rl.setAttribute("x2", X); rl.setAttribute("visibility", "visible"); }
    const rv = S.rsi[k], tr = pc.r.trades.find((t) => t.ek === k || t.xk === k);
    const act = tr ? (tr.ek === k ? '<span class="sq-chip rsb-chip-act is-buy">매수</span>' : `<span class="sq-chip rsb-chip-act is-sell">${tr.why === "stop" ? "손절" : "매도"} ${pct1(tr.ret)}</span>`) : S.pos[k] ? '<span class="sq-chip"><small>보유 중</small></span>' : "";
    pChips.innerHTML = `<span class="sq-chip sq-chip-bar">${dTxt(pc.D.d[b.e])}</span><span class="sq-chip">종가 <b>${px(b.c)}</b></span><span class="sq-chip sq-chip-rsi">RSI <b>${rv == null ? "–" : fmtN(rv, 1, 1)}</b>${rv != null && rv <= pc.r.buy ? '<i class="sq-rsi-tag is-cold">과매도</i>' : rv != null && rv >= pc.r.sell ? '<i class="sq-rsi-tag is-hot">과매수</i>' : ""}</span>${act}`;
  }
  function pUnhover() {
    const g = pSvg.querySelector(".rsb-hover"); if (g) g.setAttribute("visibility", "hidden");
    const rl = rSvg.querySelector(".rsb-rhl"); if (rl) rl.setAttribute("visibility", "hidden");
    if (pc) pChips.innerHTML = pc.chips;
  }
  for (const el of [pSvg, rSvg]) { el.addEventListener("pointermove", pHover); el.addEventListener("pointerdown", pHover); el.addEventListener("pointerleave", pUnhover); }

  // ---------- 자산 곡선(전략 vs 그냥 보유) ----------
  let ec = null;
  function drawEquity(r, D, t) {
    const S = r.series, B = S.B, M = B.length;
    const W = Math.max(300, Math.round(eSvg.getBoundingClientRect().width || eWrap.clientWidth || 340));
    const narrow = W < 520, H = narrow ? 240 : 300, T0 = 12, B0 = H - 24;
    const tagW = narrow ? 66 : 80, L0 = 8, R0 = W - tagW - 12;
    const X = (k) => L0 + ((R0 - L0) * k) / Math.max(1, M - 1);
    let lo = Infinity, hi = 0;
    for (const v of S.eq.concat(S.hold)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    lo = Math.min(lo, r.cap); hi = Math.max(hi, r.cap);
    const { Y, ticks, log } = scale(lo, hi, T0 + 8, B0 - 6, narrow ? 4 : 5);
    let s = `<rect class="dca-plot" x="${L0}" y="${T0}" width="${f1(R0 - L0)}" height="${f1(B0 - T0)}"/>`;
    let gl = "";
    for (const v of ticks) { const y = Y(v); if (y < T0 + 8 || y > B0 - 4) continue; s += `<line class="dca-grid" x1="${L0}" x2="${f1(R0)}" y1="${f1(y)}" y2="${f1(y)}"/>`; gl += `<text class="dca-gl" x="${L0 + 4}" y="${f1(y - 3)}">${esc(short(v))}</text>`; }
    s += yearTicks(B, D, X, T0, B0, H, narrow);
    // 전략 MDD 구간 연한 빨강 띠
    if (r.mdd < 0) { const ka = B.findIndex((b) => D.d[b.e] === r.mddPeak), kb = B.findIndex((b) => D.d[b.e] === r.mddTrough); if (ka >= 0 && kb >= 0) s += `<rect class="dca-mdd" x="${f1(X(ka))}" y="${T0}" width="${f1(Math.max(2, X(kb) - X(ka)))}" height="${f1(B0 - T0)}"/>`; }
    const yc = f1(Y(r.cap));
    s += `<line class="dca-inv rsb-cap" x1="${L0}" x2="${f1(R0)}" y1="${yc}" y2="${yc}"/>`;
    const ks = B.map((_, k) => k), sp = thin(ks, S.eq, X, Y), hp = thin(ks, S.hold, X, Y);
    s += `<path class="dca-area" d="${path(sp)}L${f1(sp[sp.length - 1].x)} ${B0}L${f1(sp[0].x)} ${B0}Z"/>`;
    s += `<path class="dca-line rsb-hline" d="${path(hp)}"/><path class="dca-line is-main" d="${path(sp)}"/>`;
    s += gl + `<line class="dca-base" x1="${L0}" x2="${f1(R0)}" y1="${B0}" y2="${B0}"/>`;
    const tags = [{ v: S.eq[M - 1], cls: "is-main" }, { v: S.hold[M - 1], cls: "is-hold" }, { v: r.cap, cls: "is-cap" }].map((x) => ({ ...x, txt: short(x.v), y0: Y(x.v), ty: Y(x.v) })).sort((a, b) => a.y0 - b.y0);
    const gap = 24, tMin = T0 + 10, tMax = B0 - 4;
    for (let i = 1; i < tags.length; i++) if (tags[i].ty - tags[i - 1].ty < gap) tags[i].ty = tags[i - 1].ty + gap;
    if (tags[tags.length - 1].ty > tMax) { tags[tags.length - 1].ty = tMax; for (let i = tags.length - 2; i >= 0; i--) if (tags[i + 1].ty - tags[i].ty < gap) tags[i].ty = tags[i + 1].ty - gap; }
    if (tags[0].ty < tMin) { const d = tMin - tags[0].ty; tags.forEach((x) => (x.ty += d)); }
    const tx = R0 + 6;
    for (const g of tags) { const fs = 12.5, w = Math.min(tagW + 4, tw(g.txt, fs) + 14); s += `<g class="dca-tag ${g.cls}"><path class="dca-lead" d="M${f1(R0)} ${f1(g.y0)}L${f1(tx)} ${f1(g.ty)}"/><rect x="${f1(tx)}" y="${f1(g.ty - 10.5)}" width="${f1(w)}" height="21" rx="10.5"/><text x="${f1(tx + w / 2)}" y="${f1(g.ty + 4.4)}" font-size="${fs}">${esc(g.txt)}</text></g>`; }
    s += `<g class="rsb-ehover" visibility="hidden"><line class="dca-hl" y1="${T0}" y2="${B0}"/><circle class="dca-hd is-main" r="5"/><circle class="dca-hd rsb-hd-hold" r="4"/></g>`;
    eSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    eSvg.innerHTML = s;
    eSvg.setAttribute("aria-label", `${t} 자산 곡선: RSI 매매 ${usd0(r.value)}(${pct(r.rate)}), 그냥 보유 ${usd0(r.hvalue)}(${pct(r.hrate)}), 초기 자금 ${usd0(r.cap)}${log ? ", 로그 눈금" : ""}`);
    const chips = `<span class="sq-chip sq-chip-bar">자산 곡선</span><span class="sq-chip dca-chip-res ${cls(r.rate)}">RSI 매매 <b>${pct1(r.rate)}</b></span><span class="sq-chip">그냥 보유 <b>${pct1(r.hrate)}</b></span>${log ? '<span class="sq-chip"><small>로그 눈금</small></span>' : ""}`;
    eChips.innerHTML = chips;
    eLeg.innerHTML = `<span class="sq-lg dca-lg is-main"><i></i>RSI 매매</span><span class="sq-lg dca-lg rsb-lg-hold"><i></i>그냥 보유</span><span class="sq-lg dca-lg rsb-lg-cap"><i></i>초기 자금</span>${r.mdd < 0 ? '<span class="sq-lg dca-lg is-mdd"><i></i>전략 최대 낙폭</span>' : ""}`;
    ec = { r, D, X, Y, W, L0, R0, M, chips };
  }
  function eHover(e) {
    if (!ec) return;
    const rc = eSvg.getBoundingClientRect(), x = ((e.clientX - rc.left) / rc.width) * ec.W;
    if (x < ec.L0 - 4 || x > ec.R0 + 4) return eUnhover();
    const k = Math.max(0, Math.min(ec.M - 1, Math.round(((x - ec.L0) / (ec.R0 - ec.L0)) * (ec.M - 1))));
    const S = ec.r.series, X = f1(ec.X(k)), g = eSvg.querySelector(".rsb-ehover"); if (!g) return;
    g.setAttribute("visibility", "visible");
    g.querySelector("line").setAttribute("x1", X); g.querySelector("line").setAttribute("x2", X);
    const c = g.querySelectorAll("circle");
    c[0].setAttribute("cx", X); c[0].setAttribute("cy", f1(ec.Y(S.eq[k]))); c[1].setAttribute("cx", X); c[1].setAttribute("cy", f1(ec.Y(S.hold[k])));
    eChips.innerHTML = `<span class="sq-chip sq-chip-bar">${dTxt(ec.D.d[S.B[k].e])}</span><span class="sq-chip dca-chip"><small>RSI 매매</small> <b>${esc(short(S.eq[k]))}</b> <small class="${cls(S.eq[k] - ec.r.cap)}">${pct1(S.eq[k] / ec.r.cap - 1)}</small></span><span class="sq-chip dca-chip"><small>보유</small> <b>${esc(short(S.hold[k]))}</b> <small class="${cls(S.hold[k] - ec.r.cap)}">${pct1(S.hold[k] / ec.r.cap - 1)}</small></span>`;
  }
  function eUnhover() { const g = eSvg.querySelector(".rsb-ehover"); if (g) g.setAttribute("visibility", "hidden"); if (ec) eChips.innerHTML = ec.chips; }
  eSvg.addEventListener("pointermove", eHover); eSvg.addEventListener("pointerdown", eHover); eSvg.addEventListener("pointerleave", eUnhover);

  let last = null, rt = 0;
  window.addEventListener("resize", () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(() => { if (last) { drawPrice(last.r, last.D, last.t); drawEquity(last.r, last.D, last.t); } }); });

  // ---------- 계산 ----------
  let line = "", seq = 0;
  const hide = () => { pWrap.hidden = true; eWrap.hidden = true; last = null; pc = null; ec = null; };
  const msg = (t, warn = false) => { res.innerHTML = `<p class="${warn ? "tk-msg" : "hint"}">${t}</p>`; hide(); line = ""; };
  const NOTE = '<p class="pay-note">신호는 그 봉 종가로 계산한 RSI로 정하고, 체결도 같은 종가로 한다고 가정했어요(미래 가격은 쓰지 않음). 실제로는 종가가 확정된 뒤 주문하면 다음 날 가격에 체결돼 결과가 달라질 수 있어요. 세금·배당·환율은 넣지 않았어요. 과거 결과가 앞으로의 수익을 뜻하지 않아요.</p>';
  const WHY = { rsi: "RSI 매도", stop: "손절", open: "미청산" };

  async function calc() {
    const my = ++seq;
    const t = val("tk"), weekly = val("tf") === "w";
    const n = num(val("n")), buy = num(val("buy")), sell = num(val("sell")), stopP = num(val("stop")), feeP = num(val("fee")), cap = num(val("cap"));
    if ([n, buy, sell, stopP, feeP, cap].some((x) => Number.isNaN(x))) return msg("숫자만 넣어 주세요. 쉼표(,)와 소수점(.)은 써도 돼요.", true);
    if (n == null || !Number.isInteger(n) || n < 2 || n > 100) return msg("RSI 기간은 2~100 사이의 정수로 넣어 주세요. 보통 14를 써요.", true);
    if (buy == null || sell == null) return msg("매수 기준과 매도 기준을 넣어 주세요. 보통 30과 70이에요.");
    if (!(buy < sell) || sell > 100) return msg("매수 기준(RSI ≤)은 매도 기준(RSI ≥)보다 작아야 하고, RSI는 0~100이에요.", true);
    if (stopP != null && !(stopP > 0 && stopP < 100)) return msg("손절 %는 0보다 크고 100보다 작게 넣거나, 비워서 끄세요.", true);
    if (feeP != null && !(feeP >= 0 && feeP < 10)) return msg("수수료 %는 0 이상 10 미만으로 넣어 주세요.", true);
    if (!(cap > 0)) return msg("초기 자금(달러)을 넣어 주세요.");
    let start = getYM("s"), end = getYM("e");
    const notes = [], lst = META.list[t];
    if (start < lst) { notes.push(`${t}은 ${ymTxt(lst)}에 상장해서 ${ymTxt(lst)}부터 계산했어요.`); start = lst; }
    if (end > LAST) { notes.push(`가격 데이터가 ${dTxt(META.asOf)}까지라 ${ymTxt(LAST)}까지 계산했어요.`); end = LAST; }
    if (start > end) return msg("시작 연월이 끝 연월보다 늦어요. 기간을 다시 골라 주세요.", true);
    let D;
    try { if (!data[t]) res.innerHTML = '<p class="hint">가격 데이터를 불러오는 중이에요…</p>'; D = await load(t); }
    catch (e) { return msg("가격 데이터를 불러오지 못했어요. 새로 고침해 주세요.", true); }
    if (my !== seq) return;
    const o = { start, end, weekly, n, buy, sell, stop: stopP == null ? null : stopP / 100, fee: (feeP || 0) / 100, cap };
    const r = A.run(D, o);
    if (r.err) return msg("이 기간에는 가격 데이터가 없어요. 기간을 다시 골라 주세요.", true);
    if (r.series.rsi.every((v) => v == null)) notes.push(`상장 직후라 RSI(${n})를 계산할 봉이 아직 모자라요.`);
    else if (!r.trades.length) notes.push(`이 기간에는 RSI가 ${fmtN(buy, 0, 1)} 이하로 내려간 적이 없어 한 번도 사지 않았어요(현금 그대로).`);
    show(t, r, D, `${ymTxt(start)} ~ ${ymTxt(end)}`, notes);
  }

  function show(t, r, D, per, notes) {
    const tf = r.weekly ? "주봉" : "일봉", rule = `RSI(${r.n}) ≤ ${fmtN(r.buy, 0, 1)} 매수 · ≥ ${fmtN(r.sell, 0, 1)} 매도`;
    const extra = [r.stop != null ? `손절 ${fmtN(r.stop * 100, 0, 2)}%` : "손절 없음", `수수료 ${fmtN(r.fee * 100, 0, 3)}%`].join(" · ");
    const beat = r.value >= r.hvalue;
    const noteHtml = notes.length ? `<p class="hint dca-note">${notes.join(" ")}</p>` : "";
    const head = `<div class="rsb-vs"><div class="rsb-vs-a ${cls(r.rate)}"><span>RSI 매매</span><b>${pct1(r.rate)}</b><small>${usd0(r.cap)} → ${usd0(r.value)}</small></div><div class="rsb-vs-b ${cls(r.hrate)}"><span>그냥 보유</span><b>${pct1(r.hrate)}</b><small>${usd0(r.cap)} → ${usd0(r.hvalue)}</small></div></div>
<p class="hint">${t} · ${tf} · ${per} (${dTxt(r.first)} ~ ${dTxt(r.last)}) · ${rule} · ${extra}. 이 기간에는 <b>${beat ? "RSI 매매" : "그냥 보유"}</b>의 최종 자산이 더 컸어요${r.open ? " · 끝날 때 보유 중(미청산)" : ""}.</p>${noteHtml}`;
    const stats = `<ul class="dca-stats rsb-stats">
<li><span>매매 횟수</span><b>${r.trades.length}번</b><small>청산 ${r.closed}${r.open ? " · 미청산 1" : ""}</small></li>
<li class="${r.winRate == null ? "" : r.winRate >= 0.5 ? "up" : "dn"}"><span>승률</span><b>${r.winRate == null ? "–" : fmtN(r.winRate * 100, 0, 1) + "%"}</b><small>${r.closed ? `${r.wins}승 ${r.closed - r.wins}패 (청산 기준)` : "청산된 거래 없음"}</small></li>
<li class="${cls(r.rate)}"><span>누적 수익률</span><b>${pct1(r.rate)}</b><small>${r.cagr == null ? "1년 미만" : `연 ${pct1(r.cagr)} (CAGR)`}</small></li>
<li class="${cls(r.hrate)}"><span>그냥 보유</span><b>${pct1(r.hrate)}</b><small>${r.hcagr == null ? "1년 미만" : `연 ${pct1(r.hcagr)} (CAGR)`}</small></li>
<li class="dn"><span>전략 MDD</span><b>${pct1(r.mdd)}</b><small>보유 MDD ${pct1(r.hmdd)}</small></li>
<li><span>평균 보유 기간</span><b>${r.avgDays == null ? "–" : dur(r.avgDays)}</b><small>${r.avgBars == null ? "청산 기준" : `봉 ${fmtN(r.avgBars, 0, 1)}개 · 시장에 ${fmtN(r.expo * 100, 0, 0)}%`}</small></li>
</ul>
<p class="hint dca-def">승률 = 청산된 거래 중 수익으로 끝난 비율. 최대 낙폭(MDD) = ${tf} 종가 기준 자산이 그때까지의 최고에서 가장 많이 줄어든 비율(전략 ${dTxt(r.mddPeak)} → ${dTxt(r.mddTrough)}). 그냥 보유 = 첫 봉 종가에 전액 사서 끝까지 보유. 시장에 있던 비율 = 주식을 들고 있던 봉 ÷ 전체 봉.</p>`;
    const rows = r.trades.map((x, i) => `<tr class="${x.why === "open" ? "rsb-open" : ""}"><th scope="row">${i + 1}</th><td>${dS(x.ed)}<small>${px(x.pin)} · ${fmtN(x.rin, 1, 1)}</small></td><td>${x.xd ? dS(x.xd) : `<i>${dS(r.last)}</i>`}<small>${px(x.pout)} · ${x.why === "rsi" ? fmtN(x.rout, 1, 1) : WHY[x.why]}</small></td><td class="${cls(x.ret)}"><b>${pct1(x.ret)}</b><small>${dur(x.days)}</small></td></tr>`).join("");
    const tbl = r.trades.length ? `<details class="dca-years rsb-trades" open><summary>거래 목록 (${r.trades.length}번)</summary><div class="table-wrap"><table class="dd-table dca-ytable rsb-ttable"><thead><tr><th scope="col">#</th><th scope="col">매수 <small>종가 · RSI</small></th><th scope="col">매도 <small>종가 · RSI·이유</small></th><th scope="col">수익률 <small>보유 기간</small></th></tr></thead><tbody>${rows}</tbody></table></div><p class="hint">수익률은 수수료를 뺀 값이에요. 미청산은 ${dTxt(r.last)} 종가로 평가했어요(매도 수수료 미차감).</p></details>` : "";
    res.innerHTML = head + '<div data-pchart></div>' + stats + '<div data-echart></div>' + tbl + NOTE;
    res.querySelector("[data-pchart]").replaceWith(pWrap);
    res.querySelector("[data-echart]").replaceWith(eWrap);
    pWrap.hidden = false; eWrap.hidden = false;
    last = { r, D, t };
    drawPrice(r, D, t); drawEquity(r, D, t);
    line = `${t} RSI 매매 백테스트(${tf}, ${rule}, ${extra}): ${per} 매매 ${r.trades.length}번${r.open ? "(미청산 1)" : ""}, 승률 ${r.winRate == null ? "–" : fmtN(r.winRate * 100, 0, 1) + "%"}, 누적 수익률 ${pct(r.rate)} vs 그냥 보유 ${pct(r.hrate)}, MDD ${pct(r.mdd)}(보유 ${pct(r.hmdd)}), 평균 보유 ${r.avgDays == null ? "–" : dur(r.avgDays)} · 종가 신호·종가 체결 가정, 과거 성과는 미래를 보장하지 않음, 투자 권유 아님`;
  }

  // ---------- 이벤트 ----------
  const DEF = { tk: "TQQQ", tf: "d", s: `${+LAST.slice(0, 4) - 10}-01`, e: LAST, n: "14", buy: "30", sell: "70", stop: "", fee: "0", cap: "10,000" };
  const reset = () => {
    box.querySelector(`[name="tk"][value="${DEF.tk}"]`).checked = true;
    box.querySelector(`[name="tf"][value="${DEF.tf}"]`).checked = true;
    setYM("s", DEF.s); setYM("e", DEF.e);
    for (const k of ["n", "buy", "sell", "stop", "fee", "cap"]) setv(k, DEF[k]);
    calc();
  };
  box.querySelectorAll("[data-range]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.range;
    setYM("e", LAST);
    setYM("s", k === "list" ? META.list[val("tk")] : addM(LAST, -12 * +k + 1));
    calc();
  }));
  box.querySelectorAll("[data-rule]").forEach((b) => b.addEventListener("click", () => { const [a, z] = b.dataset.rule.split(","); setv("buy", a); setv("sell", z); calc(); }));
  $("[data-reset]").addEventListener("click", reset);
  $("[data-copy]").addEventListener("click", async () => {
    if (!line) { toast("먼저 값을 넣어 계산해 주세요"); return; }
    toast((await copy(line)) ? "결과 한 줄을 복사했어요" : "복사에 실패했어요");
  });
  const form = box.querySelector("form");
  let tm = 0;
  form.addEventListener("submit", (e) => { e.preventDefault(); calc(); });
  form.addEventListener("input", (e) => { if (e.target.tagName === "INPUT" && e.target.type === "text") { clearTimeout(tm); tm = setTimeout(calc, 250); } });
  form.addEventListener("change", (e) => { if (e.target.type !== "text") calc(); });
  reset();
})();
