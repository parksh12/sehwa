// P2-55 복리 계산기 · 배당 계산기 화면. 계산식은 compound-calc.js(window.CMPCALC).
// 흐름: 탭(복리 | 배당) → 입력 → 결과(큰 숫자 · 칸 · 그래프 · 연도별 표) → 한 줄 복사 → 다음 툴
// 그래프는 SVG로 직접 그림(P2-50·P2-52 톤: 굵은 먹선·노랑 채움·오른쪽 칩, 차트 안에는 데이터만, dca-* 스타일 재사용). 입력값은 저장하거나 전송하지 않습니다.
(function () {
  const box = document.querySelector('[data-tool="compound"] .cmp');
  if (!box || !window.CMPCALC) return;
  const A = window.CMPCALC, R = A.RULES;
  const $ = (s, el = box) => el.querySelector(s);
  const fC = $(".cmp-form"), fD = $(".div-form"), resC = $(".cmp-result"), resD = $(".div-result");
  const toast = (m) => (window.NALGI && NALGI.toast ? NALGI.toast(m) : null);
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok; }
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => { const s = String(v == null ? "" : v).replace(/[,\s원%₩]/g, ""); if (s === "") return null; if (!/^\d*\.?\d*$/.test(s)) return NaN; const n = parseFloat(s); return isFinite(n) ? n : NaN; };
  const val = (f, name) => { const el = f.querySelector(`[name="${name}"]`); if (!el) return null; if (el.type === "checkbox") return el.checked; if (el.type === "radio") { const c = f.querySelector(`[name="${name}"]:checked`); return c ? c.value : null; } return el.value; };
  const setv = (f, name, v) => { const el = f.querySelector(`[name="${name}"]`); if (!el) return; if (el.type === "radio") { const r = f.querySelector(`[name="${name}"][value="${v}"]`); if (r) r.checked = true; } else if (el.type === "checkbox") el.checked = !!v; else el.value = v; };

  // ---------- 숫자 표기 ----------
  const MINUS = "−";
  const fmtN = (n, a = 0, b = 0) => Math.abs(n).toLocaleString("ko-KR", { minimumFractionDigits: a, maximumFractionDigits: b });
  const won = (n) => `${n < 0 ? MINUS : ""}${fmtN(Math.round(n))}원`;
  // 큰 금액 한눈에: 「3억 85만 원」
  const man = (n, unit = " 원") => {
    const w = Math.round(n), s = w < 0 ? MINUS : "", a = Math.abs(w);
    if (a < 1e4) return `${s}${fmtN(a)}${unit.trim() ? "원" : ""}`;
    const eok = Math.floor(a / 1e8), mm = Math.round((a % 1e8) / 1e4);
    if (mm === 1e4) return `${s}${fmtN(eok + 1)}억${unit}`;
    return `${s}${eok ? `${fmtN(eok)}억${mm ? " " : ""}` : ""}${mm || !eok ? `${fmtN(mm)}만` : ""}${unit}`;
  };
  const short = (n) => { const a = Math.abs(n); return a >= 1e8 ? `${+(n / 1e8).toFixed(a >= 1e10 ? 0 : a >= 1e9 ? 1 : 2)}억` : a >= 1e4 ? `${fmtN(Math.round(n / 1e4))}만` : `${fmtN(Math.round(n))}원`; };
  const pct = (r, d = 2) => `${r < 0 ? MINUS : r > 0 ? "+" : ""}${fmtN(r * 100, d, d)}%`;
  const pp = (r) => `${fmtN(r * 100, 0, 2)}%`; // 입력 비율 그대로(7%, 15.4%)
  const yrs = (y) => `${fmtN(y, 1, 1)}년`;

  // 입력 옆 「= 1,000만 원」 읽기 도우미
  function krHints(f) {
    f.querySelectorAll("[data-kr]").forEach((el) => { const n = num(val(f, el.dataset.kr)); el.textContent = n > 0 && n >= 1e4 ? `= ${man(n)}` : ""; });
  }

  // ---------- 차트(하나를 두 탭이 같이 씀: 결과의 [data-chart] 자리로 옮겨 그림) ----------
  const wrap = $(".cmp-chart"), svg = $(".cmp-svg"), chips = $(".cmp-chips"), legend = $(".cmp-legend");
  const f1 = (n) => Math.round(n * 10) / 10;
  const tw = (s, px) => [...s].reduce((w, ch) => w + (/[0-9.,+−\-%]/.test(ch) ? px * 0.6 : ch === " " ? px * 0.3 : px * 0.98), 0);
  function niceStep(span, n) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
  let chart = null, geo = null;
  function draw(c, res) {
    chart = c;
    if (!c) { wrap.hidden = true; svg.innerHTML = ""; return; }
    const slot = res.querySelector("[data-chart]");
    if (slot) slot.replaceWith(wrap);
    wrap.hidden = false;
    const W = Math.max(300, Math.round(svg.getBoundingClientRect().width || wrap.clientWidth || 340));
    const narrow = W < 520;
    const H = narrow ? 260 : 330, T0 = 14, B0 = H - 26;
    const tagW = narrow ? 64 : 78, L0 = 8, R0 = W - tagW - 12;
    const n = c.v.length - 1; // 달 수
    const X = (m) => L0 + ((R0 - L0) * m) / Math.max(1, n);
    let hi = 0;
    for (const s of [c.v, c.paid, c.real || []]) for (const v of s) if (v > hi) hi = v;
    const step = niceStep(hi * 1.04, narrow ? 4 : 5), top = Math.ceil((hi * 1.04) / step) * step;
    const Y = (v) => B0 - ((B0 - T0) * v) / top;
    let s = `<rect class="dca-plot" x="${L0}" y="${T0}" width="${f1(R0 - L0)}" height="${f1(B0 - T0)}"/>`;
    for (let v = step; v < top + step / 2; v += step) { const y = f1(Y(v)); s += `<line class="dca-grid" x1="${L0}" x2="${f1(R0)}" y1="${y}" y2="${y}"/><text class="dca-gl" x="${L0 + 4}" y="${f1(Y(v) + 12)}">${esc(short(v))}</text>`; }
    // 세로 눈금: n년째
    const years = n / 12, ys = years > (narrow ? 24 : 40) ? 10 : years > (narrow ? 10 : 16) ? 5 : years > 6 ? 2 : 1;
    for (let y = ys; y <= years; y += ys) { const x = f1(X(y * 12)); if (y < years) s += `<line class="dca-vgrid" x1="${x}" x2="${x}" y1="${T0}" y2="${B0}"/>`; s += `<text class="dca-xl" x="${Math.min(x, R0 - 10)}" y="${H - 8}">${y}년</text>`; }
    const line = (arr) => arr.map((v, m) => `${m ? "L" : "M"}${f1(X(m))} ${f1(Y(v))}`).join("");
    const dv = line(c.v);
    s += `<path class="dca-area" d="${dv}L${f1(X(n))} ${B0}L${f1(X(0))} ${B0}Z"/>`;
    s += `<path class="dca-inv" d="${line(c.paid)}"/>`;
    if (c.real) s += `<path class="dca-line is-lump" d="${line(c.real)}"/>`;
    s += `<path class="dca-line is-main" d="${dv}"/>`;
    s += `<line class="dca-base" x1="${L0}" x2="${f1(R0)}" y1="${B0}" y2="${B0}"/>`;
    const tags = [{ v: c.v[n], cls: "is-main" }, { v: c.paid[n], cls: "is-inv" }, ...(c.real ? [{ v: c.real[n], cls: "is-lump" }] : [])].map((t) => ({ ...t, txt: short(t.v), y0: Y(t.v), ty: Y(t.v) })).sort((a, b) => a.y0 - b.y0);
    const gap = 24, tMin = T0 + 10, tMax = B0 - 4;
    for (let i = 1; i < tags.length; i++) if (tags[i].ty - tags[i - 1].ty < gap) tags[i].ty = tags[i - 1].ty + gap;
    if (tags[tags.length - 1].ty > tMax) { tags[tags.length - 1].ty = tMax; for (let i = tags.length - 2; i >= 0; i--) if (tags[i + 1].ty - tags[i].ty < gap) tags[i].ty = tags[i + 1].ty - gap; }
    if (tags[0].ty < tMin) { const d = tMin - tags[0].ty; tags.forEach((t) => (t.ty += d)); }
    const tx = R0 + 6;
    for (const t of tags) { const fs = 12.5, w = Math.min(tagW + 4, tw(t.txt, fs) + 14); s += `<g class="dca-tag ${t.cls}"><path class="dca-lead" d="M${f1(R0)} ${f1(t.y0)}L${f1(tx)} ${f1(t.ty)}"/><rect x="${f1(tx)}" y="${f1(t.ty - 10.5)}" width="${f1(w)}" height="21" rx="10.5"/><text x="${f1(tx + w / 2)}" y="${f1(t.ty + 4.4)}" font-size="${fs}">${esc(t.txt)}</text></g>`; }
    s += `<g class="dca-hover" hidden><line class="dca-hl" y1="${T0}" y2="${B0}"/><circle class="dca-hd is-main" r="5"/><circle class="dca-hd is-inv" r="4"/></g>`;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("aria-label", c.aria);
    svg.innerHTML = s;
    geo = { X, Y, L0, R0, W, n };
    legend.innerHTML = `<span class="sq-lg dca-lg is-main"><i></i>${esc(c.label)}</span><span class="sq-lg dca-lg is-inv"><i></i>넣은 돈(원금)</span>` + (c.real ? `<span class="sq-lg dca-lg is-lump"><i></i>물가 반영 실질 가치</span>` : "");
    chips.innerHTML = c.chips;
    c.res = res;
  }
  const mTxt = (m) => (m % 12 ? `${Math.floor(m / 12) ? `${Math.floor(m / 12)}년 ` : ""}${m % 12}개월` : `${m / 12}년`);
  function hover(e) {
    if (!chart || !geo) return;
    const r = svg.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * geo.W;
    if (x < geo.L0 - 4 || x > geo.R0 + 4) return unhover();
    const m = Math.round(((Math.min(geo.R0, Math.max(geo.L0, x)) - geo.L0) / (geo.R0 - geo.L0)) * geo.n);
    const g = svg.querySelector(".dca-hover"); if (!g) return;
    g.removeAttribute("hidden");
    const px = f1(geo.X(m)), hl = g.querySelector(".dca-hl"), d = g.querySelectorAll(".dca-hd");
    hl.setAttribute("x1", px); hl.setAttribute("x2", px);
    d[0].setAttribute("cx", px); d[0].setAttribute("cy", f1(geo.Y(chart.v[m])));
    d[1].setAttribute("cx", px); d[1].setAttribute("cy", f1(geo.Y(chart.paid[m])));
    const v = chart.v[m], p = chart.paid[m];
    chips.innerHTML = `<span class="sq-chip sq-chip-bar">${m ? mTxt(m) : "처음"}</span><span class="sq-chip dca-chip"><small>자산</small> <b>${esc(short(v))}</b></span><span class="sq-chip dca-chip is-inv"><small>원금</small> <b>${esc(short(p))}</b></span>` + (p > 0 && m ? `<span class="sq-chip dca-chip-res ${v >= p ? "up" : "dn"}">수익 <b>${esc(pct(v / p - 1, 1))}</b></span>` : "");
  }
  function unhover() { const g = svg.querySelector(".dca-hover"); if (g) g.setAttribute("hidden", ""); if (chart) chips.innerHTML = chart.chips; }
  svg.addEventListener("pointermove", hover);
  svg.addEventListener("pointerdown", hover);
  svg.addEventListener("pointerleave", unhover);
  let rt = 0;
  window.addEventListener("resize", () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(() => chart && draw(chart, chart.res)); });

  const tab = () => val(box, "tab");
  const lines = { cmp: "", div: "" };
  const msg = (res, t, warn = false) => { res.innerHTML = `<p class="${warn ? "tk-msg" : "hint"}">${t}</p>`; if (chart && chart.res === res) draw(null); lines[res === resC ? "cmp" : "div"] = ""; };
  const BAD = "숫자만 넣어 주세요. 쉼표(,)와 소수점(.)은 써도 돼요.";

  // ---------- 복리 ----------
  function calcC() {
    krHints(fC);
    const p0 = num(val(fC, "p0")), pmt = num(val(fC, "pmt")), rp = num(val(fC, "rate")), years = num(val(fC, "years")), ip = num(val(fC, "infl"));
    if ([p0, pmt, rp, years, ip].some(Number.isNaN)) return msg(resC, BAD, true);
    if (!(p0 > 0) && !(pmt > 0)) return msg(resC, "초기 원금이나 매달 적립금을 넣으면 바로 계산해요.");
    if (rp == null) return msg(resC, "연 수익률(%)을 넣어 주세요. 예: 예금 3, 주식 장기 평균 7");
    if (rp > 100) return msg(resC, "연 수익률은 0~100% 사이로 넣어 주세요.", true);
    if (years == null) return msg(resC, "기간(년)을 넣어 주세요.");
    if (!(years >= 1 && years <= 60 && Math.floor(years) === years)) return msg(resC, "기간은 1~60년 사이의 정수로 넣어 주세요.", true);
    if (ip != null && ip > 50) return msg(resC, "물가상승률은 0~50% 사이로 넣어 주세요.", true);
    const freq = val(fC, "freq"), timing = val(fC, "timing"), infl = ip > 0 ? ip / 100 : null;
    const r = A.compound({ p0: p0 || 0, pmt: pmt || 0, rate: rp / 100, years, freq, timing, infl });
    if (r.err) return msg(resC, "입력값을 다시 확인해 주세요.", true);
    const fT = freq === "y" ? "연복리" : "월복리", tT = timing === "begin" ? "월초" : "월말";
    const n = years * 12;
    const head = `<div class="age-big dca-big cmp-big"><span>${years}년 뒤 자산 <small>(${fT} · 연 ${pp(rp / 100)})</small></span> <b>${man(r.fv)}</b></div>
<p class="hint">넣은 돈 <b>${man(r.paid)}</b> · 불어난 돈(수익) <b class="up">+${man(r.interest)}</b> · 넣은 돈 대비 <b class="up">${pct(r.rate, 1)}</b></p>`;
    const stats = `<ul class="dca-stats">
<li><span>최종 자산</span><b>${won(r.fv)}</b><small>${years}년 = ${n}개월 뒤</small></li>
<li><span>총 납입 (원금)</span><b>${won(r.paid)}</b><small>${p0 > 0 ? `처음 ${man(p0)}` : "처음 0원"}${pmt > 0 ? ` + ${man(pmt)} × ${n}번` : ""}</small></li>
<li class="up"><span>수익 (이자)</span><b>${won(r.interest)}</b><small>넣은 돈 대비 ${pct(r.rate, 2)}</small></li>
<li><span>실효 연 수익률</span><b>${fmtN(r.eff * 100, 2, 2)}%</b><small>${freq === "y" ? "연복리는 입력값 그대로" : `월복리 (1 + ${pp(rp / 100)} ÷ 12)¹² − 1`}</small></li>
<li><span>돈이 두 배까지</span><b>${r.dbl == null ? "–" : yrs(r.dbl)}</b><small>${r.r72 == null ? "수익률 0%" : `72의 법칙 ${yrs(r.r72)}`}</small></li>
<li><span>물가 반영 실질 가치</span><b>${r.real == null ? "–" : won(r.real)}</b><small>${r.real == null ? "물가상승률을 넣으면 계산" : `물가 연 ${pp(infl)} → 지금 돈 가치`}</small></li>
</ul>`;
    const r72 = r.r72 == null ? "" : `<p class="cmp-72"><b>72의 법칙</b> 72 ÷ ${fmtN(rp, 0, 2)} = <b>약 ${yrs(r.r72)}</b>이면 돈이 두 배가 돼요 (정확히는 ${yrs(r.dbl)}${freq === "m" ? `, 월복리 실효 ${fmtN(r.eff * 100, 2, 2)}% 기준` : ""}).</p>`;
    const realH = r.real != null;
    const yt = `<details class="dca-years" open><summary>연도별 표 (${years}년)</summary><div class="table-wrap"><table class="dd-table dca-ytable cmp-ytable"><thead><tr><th scope="col">연도</th><th scope="col">누적 납입</th><th scope="col">연말 자산</th><th scope="col">그해 수익</th><th scope="col">누적 수익</th>${realH ? '<th scope="col">실질 가치</th>' : ""}</tr></thead><tbody>${r.rows.map((y) => `<tr><th scope="row">${y.y}년</th><td>${man(y.paid, "")}</td><td><b>${man(y.value, "")}</b></td><td class="up">+${man(y.gain, "")}</td><td class="up">+${man(y.interest, "")}<small>${pct(y.paid > 0 ? y.interest / y.paid : 0, 1)}</small></td>${realH ? `<td>${man(y.real, "")}</td>` : ""}</tr>`).join("")}</tbody></table></div><p class="hint">금액은 만 원 단위 반올림(1만 원 미만은 원). 그해 수익 = 연말 자산 − 전년 말 자산 − 그해 넣은 돈.${realH ? ` 실질 가치 = 연말 자산 ÷ (1 + ${pp(infl)})^연도.` : ""}</p></details>`;
    const note = `<p class="pay-note">${fT}: ${freq === "y" ? "이자가 1년에 한 번(12월 말) 붙고, 그해 넣은 적립금은 넣은 달부터 연말까지 단리 이자를 받아요." : "매달 연 수익률 ÷ 12만큼 이자가 붙어요(엑셀 FV 함수와 같은 방식)."} 적립금은 매달 ${tT}에 넣어요. 수익률이 해마다 같다고 가정한 계산이고, 세금·수수료는 넣지 않았어요.</p>`;
    resC.innerHTML = head + '<div data-chart></div>' + r72 + stats + yt + note;
    const S = r.series;
    draw({ v: S.bal, paid: S.paid, real: realH ? S.bal.map((v, m) => v / Math.pow(1 + infl, m / 12)) : null, label: `자산 (${fT})`, chips: `<span class="sq-chip sq-chip-bar">${years}년 · 연 ${pp(rp / 100)}</span><span class="sq-chip">${fT} · ${tT} 적립</span><span class="sq-chip dca-chip-res up">수익 <b>${pct(r.rate, 1)}</b></span>`, aria: `복리 자산 그래프: ${years}년 뒤 자산 ${won(r.fv)}, 넣은 돈 ${won(r.paid)}` }, resC);
    lines.cmp = `복리 계산: 처음 ${won(p0 || 0)} + 매달 ${won(pmt || 0)}(${tT}) · 연 ${pp(rp / 100)} ${fT} · ${years}년 → 최종 자산 ${won(r.fv)}, 넣은 돈 ${won(r.paid)}, 수익 ${won(r.interest)}(${pct(r.rate, 1)})${realH ? `, 물가 ${pp(infl)} 반영 실질 ${won(r.real)}` : ""} · 72의 법칙 약 ${r.r72 == null ? "–" : yrs(r.r72)} · 세금·수수료 미반영, 투자 권유 아님`;
  }

  // ---------- 배당 ----------
  const TAXN = { kr: "15.4%", us: "15% (미국)", none: "0%" };
  const taxOf = () => ({ kr: R.kr, us: R.us, none: 0 }[val(fD, "tax")] ?? R.kr);
  const dmode = () => val(fD, "dmode");
  function divTable(d) {
    const tn = d.tax ? `배당소득세 (${pp(d.tax)})` : "세금 (빼지 않음)";
    return `<div class="table-wrap"><table class="dd-table dca-cmp div-table"><thead><tr><th scope="col"></th><th scope="col">1년</th><th scope="col">한 달 (÷ 12)</th></tr></thead><tbody>
<tr><th scope="row">세전 배당</th><td>${won(d.yPre)}</td><td>${won(d.mPre)}</td></tr>
<tr><th scope="row">${tn}</th><td class="dn">${d.tax ? MINUS : ""}${won(d.yTax)}</td><td class="dn">${d.tax ? MINUS : ""}${won(d.mTax)}</td></tr>
<tr><th scope="row">세후 배당</th><td class="on">${won(d.yPost)}</td><td class="on">${won(d.mPost)}</td></tr>
</tbody></table></div>`;
  }
  function divNotes(d, extraGross) {
    const out = [];
    if (d.gross || extraGross) out.push(`연 세전 배당이 ${man(R.gross)}을 넘어요${extraGross && !d.gross ? "(재투자 뒤)" : ""}. 이자·배당 같은 금융소득이 한 해 ${man(R.gross)}을 넘으면 넘는 부분은 다른 소득과 합쳐 종합과세돼서, 15.4%보다 세금이 더 나올 수 있어요(이 계산기는 반영하지 않음).`);
    if (val(fD, "tax") === "us") out.push("미국 주식 배당은 미국에서 15%를 떼고 들어오고, 보통 국내에서 더 떼지 않아요. 금융소득 종합과세 대상이면 미국에서 낸 세금은 외국납부세액공제로 빼요.");
    return out.length ? `<p class="hint dca-note">${out.join(" ")}</p>` : "";
  }
  function calcD() {
    krHints(fD);
    const md = dmode();
    fD.querySelectorAll("[data-dm]").forEach((el) => (el.hidden = el.dataset.dm !== md));
    const reinv = val(fD, "reinv");
    fD.querySelectorAll("[data-reinv]").forEach((el) => (el.hidden = !reinv));
    const yp = num(val(fD, "yld")), tax = taxOf(), tn = TAXN[val(fD, "tax")];
    const amtIn = num(val(fD, "amt")), target = num(val(fD, "target")), ry = num(val(fD, "ryears")), radd = num(val(fD, "radd"));
    if ([yp, amtIn, target, ry, radd].some(Number.isNaN)) return msg(resD, BAD, true);
    if (md === "fwd" && !(amtIn > 0)) return msg(resD, "투자금을 넣으면 바로 계산해요.");
    if (md === "need" && !(target > 0)) return msg(resD, "받고 싶은 월 배당을 넣으면 필요한 투자금을 계산해요.");
    if (!(yp > 0)) return msg(resD, "배당률(연 %)을 넣어 주세요. 예: 국내 고배당주 5, 미국 SCHD 3.5");
    if (yp > 100) return msg(resD, "배당률은 0~100% 사이로 넣어 주세요.", true);
    const yld = yp / 100;
    let d, head;
    if (md === "fwd") {
      d = A.dividend({ amt: amtIn, yld, tax });
      head = `<div class="age-big dca-big cmp-big"><span>월 배당 <small>(${tax ? `세후 · 배당세 ${tn}` : "세전"})</small></span> <b>${won(d.mPost)}</b></div>
<p class="hint">${man(d.amt)} × 배당률 ${pp(yld)} = 연 세전 <b>${won(d.yPre)}</b> · 연 세후 <b>${won(d.yPost)}</b></p>`;
      lines.div = `배당 계산: 투자금 ${won(d.amt)} × 배당률 ${pp(yld)} → 연 배당 세전 ${won(d.yPre)} / 세후 ${won(d.yPost)}(배당세 ${tn}), 월 배당 세전 ${won(d.mPre)} / 세후 ${won(d.mPost)} · 투자 권유 아님`;
    } else {
      const basis = val(fD, "basis");
      d = A.need({ target, basis, yld, tax });
      head = `<div class="age-big dca-big cmp-big"><span>월 ${man(target)} ${basis === "post" && tax ? "(세후)" : "(세전)"} 받으려면 필요한 투자금</span> <b>${man(d.amt)}</b></div>
<p class="hint">${basis === "post" && tax ? `세후 ${won(target)} ÷ (1 − ${pp(tax)}) = 세전 ${won(d.mPre)} → ` : ""}연 세전 ${won(d.yPre)} ÷ 배당률 ${pp(yld)} = <b>${won(d.amt)}</b></p>`;
      const RS = [0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.1];
      head += `<details class="dca-years"><summary>배당률별 필요 투자금 (월 ${man(target)} ${basis === "post" && tax ? "세후" : "세전"})</summary><div class="table-wrap"><table class="dd-table dca-cmp div-rtable"><thead><tr><th scope="col">배당률</th><th scope="col">필요 투자금</th></tr></thead><tbody>${RS.map((x) => { const q = A.need({ target, basis, yld: x, tax }); return `<tr><th scope="row">${pp(x)}</th><td class="${Math.abs(x - yld) < 1e-12 ? "on" : ""}">${man(q.amt)}</td></tr>`; }).join("")}</tbody></table></div></details>`;
      lines.div = `배당 역계산: 월 배당 ${won(target)}(${basis === "post" && tax ? `세후, 배당세 ${tn}` : "세전"}) 받으려면 배당률 ${pp(yld)}에서 투자금 ${won(d.amt)} 필요 (연 세전 배당 ${won(d.yPre)}) · 투자 권유 아님`;
    }
    let reHtml = "", rr = null;
    if (reinv) {
      if (!(ry >= 1 && ry <= 60 && Math.floor(ry) === ry)) return msg(resD, "재투자 기간은 1~60년 사이의 정수로 넣어 주세요.", true);
      rr = A.reinvest({ amt: d.amt, yld, tax, years: ry, pmt: radd > 0 ? radd : 0 });
      if (rr.err) return msg(resD, "입력값을 다시 확인해 주세요.", true);
      const a = rr.after;
      reHtml = `<h3 class="dca-h3">배당을 재투자하면 ${ry}년 뒤</h3>
<div class="rsb-vs"><div><span>지금 월 배당</span><b>${short(d.mPost)}</b><small>${tax ? "세후" : "세전"} ${won(d.mPost)}</small></div><div class="rsb-vs-a up"><span>${ry}년 뒤 월 배당</span><b>${short(a.mPost)}</b><small>${tax ? "세후" : "세전"} ${won(a.mPost)}</small></div></div>
<div data-chart></div>
<ul class="dca-stats">
<li><span>${ry}년 뒤 자산</span><b>${man(a.value)}</b><small>${won(a.value)}</small></li>
<li><span>넣은 돈</span><b>${man(rr.paid)}</b><small>처음 ${man(d.amt)}${radd > 0 ? ` + 매달 ${man(radd)}` : ""}</small></li>
<li class="up"><span>재투자로 불어난 돈</span><b>${man(rr.interest)}</b><small>연 ${fmtN(yld * (1 - tax) * 100, 2, 2)}% 월복리</small></li>
</ul>
<details class="dca-years"><summary>연도별 자산과 월 배당</summary><div class="table-wrap"><table class="dd-table dca-ytable"><thead><tr><th scope="col">연도</th><th scope="col">넣은 돈</th><th scope="col">연말 자산</th><th scope="col">월 배당 (${tax ? "세후" : "세전"})</th></tr></thead><tbody>${rr.rows.map((y) => `<tr><th scope="row">${y.y}년</th><td>${man(y.paid, "")}</td><td>${man(y.value, "")}</td><td><b>${won(y.mPost)}</b></td></tr>`).join("")}</tbody></table></div></details>
<p class="hint">매달 받은 ${tax ? "세후 " : ""}배당으로 같은 종목을 다시 산다고 보고(월복리), <b>주가와 배당률이 그대로</b>라고 가정했어요. 주가가 오르거나 배당이 늘면 더 커지고, 반대면 작아져요.</p>`;
      lines.div += ` · 배당 재투자 ${ry}년${radd > 0 ? `(매달 ${won(radd)} 추가)` : ""} 뒤 자산 ${won(a.value)}, 월 배당 ${tax ? "세후" : "세전"} ${won(a.mPost)}(주가·배당률 그대로 가정)`;
    }
    resD.innerHTML = head + divTable(d) + divNotes(d, rr && rr.after.gross) + reHtml + `<p class="pay-note">배당률(시가배당률) = 1년 배당금 ÷ 주가. 실제 배당은 회사·ETF가 정하는 대로 바뀌고, 분기·연 1회 배당이면 한 달 금액은 1년치를 12로 나눈 평균이에요.</p>`;
    if (rr) {
      const S = rr.series;
      draw({ v: S.bal, paid: S.paid, real: null, label: "자산 (배당 재투자)", chips: `<span class="sq-chip sq-chip-bar">배당 재투자 ${ry}년</span><span class="sq-chip">배당률 ${pp(yld)} · 세금 ${tn}</span><span class="sq-chip dca-chip-res up">월 배당 <b>${esc(short(rr.after.mPost))}</b></span>`, aria: `배당 재투자 자산 그래프: ${ry}년 뒤 ${won(rr.after.value)}, 월 배당 ${won(rr.after.mPost)}` }, resD);
    } else if (chart && chart.res === resD) draw(null);
  }

  // ---------- 탭 ----------
  function showTab(t, push) {
    box.querySelectorAll("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== t));
    setv(box, "tab", t);
    if (push && history.replaceState) history.replaceState(null, "", t === "div" ? "#dividend" : location.pathname + location.search);
    if (t === "cmp") calcC(); else calcD();
  }
  box.querySelectorAll('[name="tab"]').forEach((el) => el.addEventListener("change", () => showTab(tab(), true)));
  window.addEventListener("hashchange", () => { if (location.hash === "#dividend") showTab("div", false); });

  // ---------- 이벤트 ----------
  const DEF_C = { p0: "10,000,000", pmt: "500,000", rate: "7", years: "20", freq: "m", timing: "end", infl: "" };
  const EX_C = { p0: "10,000,000", pmt: "500,000", rate: "6", years: "10", freq: "m", timing: "end", infl: "2.5" };
  const DEF_D = { dmode: "fwd", amt: "100,000,000", target: "1,000,000", basis: "post", yld: "5", tax: "kr", reinv: false, ryears: "10", radd: "" };
  const EX_D = { dmode: "need", amt: "100,000,000", target: "1,000,000", basis: "post", yld: "5", tax: "kr", reinv: true, ryears: "10", radd: "" };
  const fill = (f, o) => Object.entries(o).forEach(([k, v]) => setv(f, k, v));
  for (const [f, run, DEF, EX, key] of [[fC, calcC, DEF_C, EX_C, "cmp"], [fD, calcD, DEF_D, EX_D, "div"]]) {
    let tm = 0;
    f.addEventListener("submit", (e) => { e.preventDefault(); run(); });
    f.addEventListener("input", (e) => { if (e.target.type === "text") { clearTimeout(tm); tm = setTimeout(run, 200); } });
    f.addEventListener("change", (e) => { if (e.target.type !== "text") run(); });
    $("[data-reset]", f).addEventListener("click", () => { fill(f, DEF); run(); });
    $("[data-example]", f).addEventListener("click", () => { fill(f, EX); run(); });
    $("[data-copy]", f).addEventListener("click", async () => {
      if (!lines[key]) { toast("먼저 값을 넣어 계산해 주세요"); return; }
      toast((await copy(lines[key])) ? "결과 한 줄을 복사했어요" : "복사에 실패했어요");
    });
  }
  fC.querySelectorAll("[data-years]").forEach((b) => b.addEventListener("click", () => { setv(fC, "years", b.dataset.years); calcC(); }));
  fD.querySelectorAll("[data-yld]").forEach((b) => b.addEventListener("click", () => { setv(fD, "yld", b.dataset.yld); calcD(); }));
  fill(fC, DEF_C); fill(fD, DEF_D);
  // 배당 탭은 미리 한 번 계산해 둠(탭을 바꿔도 바로 보이게). 차트는 보이는 탭이 마지막에 가져감
  const first = location.hash === "#dividend" ? "div" : "cmp";
  if (first === "div") calcC(); else calcD();
  showTab(first, false);
})();
