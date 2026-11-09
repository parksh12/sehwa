// SOXL·TQQQ·KORU 주가 예측 (P2-50): 날짜를 가린 실제 일봉 종가 차트 → 오를까·내릴까 / $○○ 이상일까 → 실제 결과와 날짜 공개 → 10문제 뒤 백테스팅 요약
// 데이터: /assets/data/stock-<티커>.json (scripts/update-prices.mjs로 갱신, 분할·병합 반영 종가). 문제의 날짜는 답하기 전에는 화면·DOM에 넣지 않습니다.
// 차트는 canvas로 직접 그림(외부 라이브러리 없음). 입력값은 어디에도 보내지 않습니다.
(function () {
  const box = document.querySelector('[data-tool="stockquiz"]');
  if (!box) return;
  const $ = (s) => box.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const BASE = document.documentElement.dataset.base || "";
  const TICKERS = ["SOXL", "TQQQ", "KORU"];
  const MODES = {
    m1: { L: 21, H: 1, look: "1개월(21거래일)", when: "다음 거래일" },
    m3: { L: 63, H: 1, look: "3개월(63거래일)", when: "다음 거래일" },
    y1: { L: 252, H: 21, look: "1년(252거래일)", when: "21거래일(약 한 달) 뒤" },
  };
  const N_Q = 10;
  const data = {}; // 티커 → { c:[종가], d:[날짜 문자열] }

  const start = $(".sq-start"), play = $(".sq-play"), result = $(".sq-result");
  const cv = $(".sq-canvas"), qEl = $(".sq-q"), ans = $(".sq-ans"), rev = $(".sq-reveal"), nextBtn = $("[data-next]");
  const msg = $(".sq-msg");
  const val = (n) => (box.querySelector(`[name="${n}"]:checked`) || {}).value;

  const money = (p) => "$" + (p >= 1 ? p.toFixed(2) : p.toFixed(4));
  const roundP = (p) => (p >= 1 ? Math.round(p * 100) / 100 : Math.round(p * 1e4) / 1e4);
  const pct = (r, d = 1) => (r >= 0 ? "+" : "") + (r * 100).toFixed(d) + "%";
  const showMsg = (t) => { msg.textContent = t || ""; msg.hidden = !t; };

  async function load(t) {
    if (data[t]) return data[t];
    const r = await fetch(`${BASE}/assets/data/stock-${t.toLowerCase()}.json`);
    if (!r.ok) throw new Error("데이터를 불러오지 못했어요");
    const j = await r.json();
    // 날짜: 첫날 + 간격(일). 공개할 때만 꺼내 씀
    const d = [j.d0]; let ms = Date.parse(j.d0 + "T00:00:00Z");
    for (const g of j.g) { ms += g * 864e5; d.push(new Date(ms).toISOString().slice(0, 10)); }
    return (data[t] = { c: j.c, d });
  }

  // ---------- 문제 만들기 ----------
  let set = null; // { mode, kind, qs:[], i }
  function sigma(c, a, b) { // 로그 일간 수익률 표준편차
    const r = []; for (let i = a + 1; i <= b; i++) r.push(Math.log(c[i] / c[i - 1]));
    const m = r.reduce((x, y) => x + y, 0) / r.length;
    return Math.max(0.008, Math.sqrt(r.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, r.length - 1)));
  }
  function makeQs(mode, kind, pick) {
    const { L, H } = MODES[mode];
    const used = {}; const qs = [];
    for (let k = 0; k < N_Q; k++) {
      const t = pick === "MIX" ? TICKERS[Math.floor(Math.random() * 3)] : pick;
      const c = data[t].c, maxS = c.length - L - H;
      let s = 0;
      for (let tries = 0; tries < 60; tries++) { // 같은 종목 안에서 구간이 겹치지 않게
        s = Math.floor(Math.random() * (maxS + 1));
        if (!(used[t] || []).some(([a, b]) => s <= b && s + L - 1 + H >= a)) break;
      }
      (used[t] = used[t] || []).push([s, s + L - 1 + H]);
      const last = s + L - 1, tgt = last + H;
      let thr = null;
      if (kind === "th") { // 기준가: 마지막 종가 근처(최근 변동성 × 기간에 맞춘 소폭)에서 랜덤, 위·아래 반반
        const z = (0.15 + Math.random() * 0.75) * (Math.random() < 0.5 ? -1 : 1);
        thr = roundP(c[last] * Math.exp(z * sigma(c, s, last) * Math.sqrt(H)));
        if (thr === roundP(c[last])) thr = roundP(c[last] * (z > 0 ? 1.005 : 0.995));
      }
      qs.push({ t, s, last, tgt, thr, a: null });
    }
    return qs;
  }
  const truth = (q) => { const c = data[q.t].c; return q.thr == null ? c[q.tgt] > c[q.last] : c[q.tgt] >= q.thr; };
  const qText = (q) => {
    const m = MODES[set.mode], p = data[q.t].c[q.last];
    if (q.thr == null) return `${m.when} 종가는 마지막 종가 <b>${money(p)}</b>보다 <b>오를까요, 내릴까요?</b>`;
    return `${m.when === "다음 거래일" ? "다음 거래일(내일)" : m.when} 종가는 <b>${money(q.thr)} 이상</b>일까요? <small>(마지막 종가 ${money(p)})</small>`;
  };

  // ---------- 차트 (canvas) ----------
  const CSSV = (n, f) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f;
  function draw(q, revealed) {
    const { c } = data[q.t], { H } = MODES[set.mode];
    const W = cv.clientWidth || 340, Ht = Math.round(Math.max(200, Math.min(340, W * 0.56)));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(Ht * dpr); cv.style.height = Ht + "px";
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Ht);
    const ink = CSSV("--ink", "#141414"), up = CSSV("--jeok", "#e5372b"), dn = CSSV("--cheong", "#2346d8"), soft = "#ecebe6";
    const shown = c.slice(q.s, q.last + 1), fut = c.slice(q.last, q.tgt + 1);
    const vals = shown.concat(revealed ? fut : []).concat(q.thr != null ? [q.thr] : []);
    let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo || hi * 0.02) * 0.08; lo -= pad; hi += pad;
    g.font = "600 11px Pretendard Variable, Pretendard, system-ui, sans-serif";
    // 가격 눈금(오른쪽). 날짜 눈금은 그리지 않음
    const step = niceStep((hi - lo) / 4), ticks = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
    const labW = Math.max(...ticks.map((v) => g.measureText(money(v)).width)) + 10;
    const L0 = 6, R0 = W - labW, T0 = 10, B0 = Ht - 12;
    // 오른쪽에 맞힐 구간 자리를 미리 비워 둠(공개해도 가로 배율이 같음)
    const gap = Math.max(H, Math.round((q.last - q.s) * 0.04));
    const X = (i) => L0 + ((R0 - L0 - 4) * i) / (q.last - q.s + gap);
    const Y = (v) => B0 - ((B0 - T0) * (v - lo)) / (hi - lo);
    g.strokeStyle = soft; g.lineWidth = 1; g.fillStyle = "#6b6b66"; g.textBaseline = "middle"; g.textAlign = "left";
    ticks.forEach((v) => { const y = Math.round(Y(v)) + 0.5; g.beginPath(); g.moveTo(L0, y); g.lineTo(R0, y); g.stroke(); g.fillText(money(v), R0 + 6, y); });
    // 맞힐 구간 칸
    const xl = X(q.last - q.s), xr = X(q.last - q.s + gap);
    g.fillStyle = revealed ? "rgba(255,194,26,.14)" : "rgba(20,20,20,.05)"; g.fillRect(xl, T0, xr - xl, B0 - T0);
    if (!revealed) { g.fillStyle = "#8a8a84"; g.textAlign = "center"; g.font = "800 15px Pretendard Variable, system-ui, sans-serif"; g.fillText("?", (xl + xr) / 2, (T0 + B0) / 2); }
    // 기준가 선
    if (q.thr != null) {
      const y = Y(q.thr); g.setLineDash([5, 4]); g.strokeStyle = "#b8860b"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(L0, y); g.lineTo(R0, y); g.stroke(); g.setLineDash([]);
      // 기준가는 오른쪽 가격 눈금 자리에 노란 꼬리표로(차트 선을 가리지 않음)
      g.font = "800 11px Pretendard Variable, system-ui, sans-serif"; g.textAlign = "left";
      const ly = Math.max(T0 + 8, Math.min(B0 - 8, y));
      g.fillStyle = "#ffc21a"; g.fillRect(R0 + 1, ly - 9, W - R0 - 1, 18); g.fillStyle = "#141414"; g.fillText(money(q.thr), R0 + 6, ly);
    }
    // 보여 준 구간
    g.strokeStyle = ink; g.lineWidth = shown.length > 100 ? 1.6 : 2.2; g.lineJoin = "round"; g.beginPath();
    shown.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)))); g.stroke();
    // 공개 구간
    if (revealed) {
      const k = q.last - q.s, colr = c[q.tgt] > c[q.last] ? up : dn;
      g.strokeStyle = colr; g.lineWidth = 2.4; g.beginPath();
      fut.forEach((v, i) => (i ? g.lineTo(X(k + (i * gap) / H), Y(v)) : g.moveTo(X(k), Y(v)))); g.stroke();
      dot(g, X(k + gap), Y(c[q.tgt]), colr);
    }
    dot(g, X(q.last - q.s), Y(c[q.last]), ink);
    cv.setAttribute("aria-label", `${q.t} 종가 차트 ${q.last - q.s + 1}거래일, 최저 ${money(Math.min(...shown))} 최고 ${money(Math.max(...shown))}, 마지막 종가 ${money(c[q.last])}${revealed ? `, 정답 시점 종가 ${money(c[q.tgt])}` : ""}`);
  }
  function dot(g, x, y, col) { g.fillStyle = "#fff"; g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 4.5, 0, Math.PI * 2); g.fill(); g.stroke(); }
  function niceStep(r) { const p = 10 ** Math.floor(Math.log10(r)), m = r / p; return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p; }

  // ---------- 진행 ----------
  function show(q) {
    const k = set.i + 1;
    $(".sq-no").textContent = `${k} / ${N_Q}`;
    $(".sq-tk").textContent = q.t;
    $(".sq-score").textContent = `맞힌 개수 ${set.qs.filter((x) => x.ok).length}`;
    $(".sq-look").textContent = `${MODES[set.mode].look} 종가 · 날짜는 답한 뒤 공개${q.thr != null ? " · 노란 점선이 기준가" : ""}`;
    qEl.innerHTML = qText(q);
    const [yes, no] = q.thr == null ? ["오른다 ▲", "내린다 ▼"] : ["예, 이상", "아니요, 미만"];
    ans.innerHTML = `<button type="button" class="btn big sq-yes" data-a="1">${yes}</button><button type="button" class="btn big ghost sq-no-btn" data-a="0">${no}</button>`;
    ans.hidden = false; rev.hidden = true; rev.innerHTML = ""; nextBtn.hidden = true;
    draw(q, false);
  }
  function answer(a) {
    const q = set.qs[set.i]; if (q.a != null) return;
    q.a = a === "1"; q.ok = q.a === truth(q);
    const { c, d } = data[q.t], r = c[q.tgt] / c[q.last] - 1;
    ans.hidden = true; draw(q, true);
    const real = q.thr == null ? (c[q.tgt] > c[q.last] ? "올랐어요" : c[q.tgt] < c[q.last] ? "내렸어요" : "그대로였어요(내림으로 쳐요)") : (c[q.tgt] >= q.thr ? `기준가 ${money(q.thr)} 이상이었어요` : `기준가 ${money(q.thr)} 미만이었어요`);
    rev.innerHTML = `<p class="sq-ok ${q.ok ? "is-ok" : "is-no"}">${q.ok ? "맞았어요" : "아쉬워요"}</p>
<p>${MODES[set.mode].when} 종가 <b>${money(c[q.tgt])}</b> (${pct(r, 2)}) — ${real}.</p>
<p class="sq-dates">실제 날짜: 보여 준 구간 <b>${d[q.s]} ~ ${d[q.last]}</b>, 정답 시점 <b>${d[q.tgt]}</b></p>`;
    rev.hidden = false;
    $(".sq-score").textContent = `맞힌 개수 ${set.qs.filter((x) => x.ok).length}`;
    nextBtn.textContent = set.i + 1 < N_Q ? "다음 문제 ›" : "결과 보기 ›";
    nextBtn.hidden = false; nextBtn.focus({ preventScroll: true });
  }
  function next() {
    if (set.i + 1 < N_Q) { set.i++; show(set.qs[set.i]); play.scrollIntoView({ block: "nearest" }); return; }
    finish();
  }
  function finish() {
    play.hidden = true;
    const rows = set.qs.map((q) => { const { c } = data[q.t]; return { q, r: c[q.tgt] / c[q.last] - 1, hold: c[q.tgt] / c[q.s] - 1 }; });
    const ok = rows.filter((x) => x.q.ok).length;
    const all = rows.reduce((s, x) => s + x.r, 0), mine = rows.reduce((s, x) => s + (x.q.a ? x.r : 0), 0), nb = rows.filter((x) => x.q.a).length;
    const hold = rows.reduce((s, x) => s + x.hold, 0) / rows.length;
    const m = MODES[set.mode];
    $(".sq-res-head").innerHTML = `<p class="sq-big"><b>${ok}</b> / ${N_Q} 맞혔어요</p><p class="hint">${esc(m.look)} 보고 ${esc(m.when)} · ${set.kind === "th" ? "기준가 이상일까" : "오를까 내릴까"}</p>`;
    $(".sq-bt").innerHTML = `<h3>백테스팅 요약 <small>각 문제의 마지막 종가에 사서 정답 시점 종가에 팔았다면</small></h3>
<ul class="sq-bt-list">
<li><span>10번 모두 샀다면 (수익률 합)</span><b class="${all >= 0 ? "up" : "dn"}">${pct(all)}</b></li>
<li><span>내 답대로 했다면 (${esc(set.kind === "th" ? "「예」" : "「오른다」")}일 때만 ${nb}번 사고, 나머지는 쉼)</span><b class="${mine >= 0 ? "up" : "dn"}">${pct(mine)}</b></li>
<li><span>보여 준 구간 첫날부터 정답 시점까지 그냥 들고 있었다면 (문제당 평균)</span><b class="${hold >= 0 ? "up" : "dn"}">${pct(hold)}</b></li>
</ul>
<p class="hint">수익률은 문제마다 따로 계산해 단순히 더한 값이에요(복리 아님). 수수료·세금·환율·배당은 넣지 않았어요.</p>`;
    $(".sq-table tbody").innerHTML = rows.map(({ q, r, hold: h }, i) => { const { d } = data[q.t]; return `<tr><td>${i + 1}</td><td><b>${q.t}</b></td><td class="sq-td-d">${d[q.s]} ~<br>${d[q.last]}<br><small>정답 ${d[q.tgt]}</small></td><td>${q.thr == null ? (q.a ? "오른다" : "내린다") : (q.a ? "예" : "아니요") + `<br><small>${money(q.thr)}</small>`}</td><td class="${q.ok ? "ok" : "no"}">${q.ok ? "O" : "X"}</td><td class="${r >= 0 ? "up" : "dn"}">${pct(r)}</td><td class="${h >= 0 ? "up" : "dn"}">${pct(h)}</td></tr>`; }).join("");
    result.hidden = false; result.scrollIntoView({ block: "start", behavior: "smooth" });
    set.summary = `SOXL·TQQQ·KORU 주가 예측: ${m.look} 보고 ${m.when} — ${ok}/${N_Q} 맞힘. 10번 모두 샀다면 ${pct(all)}, 내 답대로 ${pct(mine)}.`;
  }

  async function begin() {
    showMsg("");
    const pick = val("tk") || "SOXL", mode = val("mode") || "m1", kind = val("kind") || "ud";
    const btn = $("[data-start]"); btn.disabled = true; btn.textContent = "불러오는 중…";
    try { await Promise.all((pick === "MIX" ? TICKERS : [pick]).map(load)); }
    catch (e) { showMsg("가격 데이터를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요."); btn.disabled = false; btn.textContent = "10문제 시작"; return; }
    btn.disabled = false; btn.textContent = "10문제 시작";
    set = { mode, kind, pick, qs: makeQs(mode, kind, pick), i: 0 };
    start.hidden = true; result.hidden = true; play.hidden = false;
    show(set.qs[0]);
    play.scrollIntoView({ block: "start" });
  }

  $("[data-start]").addEventListener("click", begin);
  ans.addEventListener("click", (e) => { const b = e.target.closest("[data-a]"); if (b) answer(b.dataset.a); });
  nextBtn.addEventListener("click", next);
  $("[data-again]").addEventListener("click", begin);
  $("[data-setup]").addEventListener("click", () => { result.hidden = true; play.hidden = true; start.hidden = false; start.scrollIntoView({ block: "start" }); });
  $("[data-quit]").addEventListener("click", () => { play.hidden = true; start.hidden = false; set = null; });
  $("[data-copy]").addEventListener("click", async (e) => {
    const t = `${set.summary}\n${location.href.split("#")[0]}`;
    try { await navigator.clipboard.writeText(t); e.target.textContent = "복사했어요"; } catch (_) { e.target.textContent = "복사하지 못했어요"; }
    setTimeout(() => (e.target.textContent = "결과 복사"), 1600);
  });
  let rz = 0;
  window.addEventListener("resize", () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { if (set && !play.hidden) draw(set.qs[set.i], set.qs[set.i].a != null); }); });
})();
