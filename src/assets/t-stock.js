// SOXL·TQQQ·KORU 주가 예측 (P2-50): 날짜를 가린 실제 일봉 종가 차트 → 오를까·내릴까 / $○○ 이상일까 → 실제 결과와 날짜 공개 → 10문제 뒤 백테스팅 요약
// 데이터: /assets/data/stock-<티커>.json (scripts/update-prices.mjs로 갱신, 분할·병합 반영 종가). 문제의 날짜는 답하기 전에는 화면·DOM에 넣지 않습니다.
// 차트는 SVG로 직접 그림(외부 라이브러리 없음, P2-50b 사이트 스타일). 입력값은 어디에도 보내지 않습니다.
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
  const qEl = $(".sq-q"), ans = $(".sq-ans"), rev = $(".sq-reveal"), nextBtn = $("[data-next]");
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

  // ---------- 차트 (P2-50b: 펭귄 툴즈 스타일 SVG) ----------
  // 굵은 먹선 + 노란 채움, 줄무늬 「?」 예측 칸, 마지막 종가 말풍선, 최고·최저 칩, 기준가 굵은 점선 + 칩.
  // 공개하면 이어지는 구간을 오르면 초록·내리면 빨강으로 그려 나가고 도장을 찍음. 날짜는 그리지 않음
  const svgBox = $(".sq-svg"), stamp = $(".sq-stamp");
  const NS = "http://www.w3.org/2000/svg";
  const f1 = (n) => Math.round(n * 10) / 10;
  const tw = (s, px) => [...s].reduce((w, ch) => w + (/[0-9$.,]/.test(ch) ? px * 0.6 : ch === " " ? px * 0.3 : px * 0.98), 0); // 글자 폭 어림(측정 없이)
  // 칩: 둥근 사각 + 글자. cls로 색을 바꿈. (x,y) = 칩 가운데, 영역 안으로 밀어 넣음
  function chip(txt, x, y, cls, W, px = 12) {
    const w = tw(txt, px) + 16, h = px + 11;
    const cx = Math.max(w / 2 + 2, Math.min(W - w / 2 - 2, x));
    return `<g class="sqc-chip ${cls}"><rect x="${f1(cx - w / 2)}" y="${f1(y - h / 2)}" width="${f1(w)}" height="${h}" rx="${h / 2}"/><text x="${f1(cx)}" y="${f1(y + px * 0.36)}" font-size="${px}">${esc(txt)}</text></g>`;
  }
  // 말풍선: 점(px,py) 위(또는 아래)에 꼬리 달린 상자
  function bubble(txt, sub, px, py, cls, W, below) {
    const fs = W < 420 ? 15 : 17, w = Math.max(tw(txt, fs), tw(sub, 10.5)) + 20, h = fs + 22;
    const cx = Math.max(w / 2 + 2, Math.min(W - w / 2 - 2, px));
    const top = below ? py + 14 : py - 14 - h, tip = below ? py + 6 : py - 6, base = below ? top : top + h;
    const tx = Math.max(cx - w / 2 + 10, Math.min(cx + w / 2 - 10, px));
    return `<g class="sqc-bub ${cls}"><path d="M${f1(tx - 7)} ${f1(base)}L${f1(px)} ${f1(tip)}L${f1(tx + 7)} ${f1(base)}Z"/><rect x="${f1(cx - w / 2)}" y="${f1(top)}" width="${f1(w)}" height="${h}" rx="10"/><text class="sqc-bub-sub" x="${f1(cx)}" y="${f1(top + 14)}" font-size="10.5">${esc(sub)}</text><text x="${f1(cx)}" y="${f1(top + 14 + fs)}" font-size="${fs}">${esc(txt)}</text></g>`;
  }
  function draw(q, revealed, animate) {
    const { c } = data[q.t], { H } = MODES[set.mode];
    const W = Math.max(280, Math.round(svgBox.getBoundingClientRect().width || svgBox.parentNode.clientWidth || 340));
    const Ht = Math.round(Math.max(250, Math.min(380, W * 0.62)));
    const shown = c.slice(q.s, q.last + 1), fut = c.slice(q.last, q.tgt + 1), n = shown.length;
    const vals = shown.concat(revealed ? fut : []).concat(q.thr != null ? [q.thr] : []);
    let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo || hi * 0.02) * 0.06; lo -= pad; hi += pad;
    const L0 = 12, R0 = W - 12, T0 = 58, B0 = Ht - 34; // 위: 말풍선·최고 칩 자리, 아래: 최저 칩 자리
    const zoneW = Math.max(H > 1 ? 74 : 58, (R0 - L0) * (H > 1 ? 0.17 : 0.1));
    const xl = R0 - zoneW, xr = R0;
    const X = (i) => L0 + ((xl - 10 - L0) * i) / (n - 1);
    const XF = (j) => xl - 10 + ((xr - 14 - (xl - 10)) * j) / H; // 공개 구간 j=0..H
    const Y = (v) => B0 - ((B0 - T0) * (v - lo)) / (hi - lo);
    const pts = shown.map((v, i) => `${f1(X(i))},${f1(Y(v))}`);
    const xLast = X(n - 1), yLast = Y(c[q.last]);
    let s = `<defs><pattern id="sqc-stripe" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(45)"><rect class="sqc-stripe-a" width="12" height="12"/><rect class="sqc-stripe-b" width="6" height="12"/></pattern></defs>`;
    // 예측 칸
    s += `<rect class="sqc-zone${revealed ? " is-open" : ""}" x="${f1(xl)}" y="${T0 - 18}" width="${f1(zoneW)}" height="${f1(B0 - T0 + 30)}" rx="12"/>`;
    if (!revealed) { // 「?」 배지는 마지막 종가 말풍선과 반대쪽(위/아래)에
      const bc = yLast < T0 + 6 ? yLast + 40 : yLast - 40, top = T0 + (B0 - T0) * 0.2, bot = B0 - (B0 - T0) * 0.2, qy = Math.abs(bc - top) > Math.abs(bc - bot) ? top : bot, qr = zoneW > 64 ? 20 : 17;
      s += `<g class="sqc-q"><circle cx="${f1((xl + xr) / 2)}" cy="${f1(qy)}" r="${qr}"/><text x="${f1((xl + xr) / 2)}" y="${f1(qy + qr * 0.42)}" font-size="${qr + 4}">?</text></g>`;
    }
    // 바닥선 + 채운 영역 + 먹선
    s += `<line class="sqc-base" x1="${L0}" y1="${B0 + 4}" x2="${f1(xl - 6)}" y2="${B0 + 4}"/>`;
    s += `<path class="sqc-area" d="M${f1(X(0))},${B0 + 4}L${pts.join("L")}L${f1(xLast)},${B0 + 4}Z"/>`;
    s += `<polyline class="sqc-line${n > 100 ? " is-long" : ""}" points="${pts.join(" ")}"/>`;
    // 기준가: 굵은 점선 + 칩
    if (q.thr != null) {
      const y = Y(q.thr);
      s += `<line class="sqc-thr" x1="${L0}" y1="${f1(y)}" x2="${R0}" y2="${f1(y)}"/>`;
      s += chip(`기준 ${money(q.thr)}`, L0 + 50, y, "is-thr", W);
    }
    // 최고·최저 칩(보여 준 구간 안에서만, 마지막 점과 겹치면 생략)
    let iMax = 0, iMin = 0; shown.forEach((v, i) => { if (v > shown[iMax]) iMax = i; if (v < shown[iMin]) iMin = i; });
    if (n - 1 - iMax > n * 0.12) s += `<circle class="sqc-pt" cx="${f1(X(iMax))}" cy="${f1(Y(shown[iMax]))}" r="4"/>` + chip(`최고 ${money(shown[iMax])}`, X(iMax), Y(shown[iMax]) - 16, "", W, 11.5);
    if (n - 1 - iMin > n * 0.12) s += `<circle class="sqc-pt" cx="${f1(X(iMin))}" cy="${f1(Y(shown[iMin]))}" r="4"/>` + chip(`최저 ${money(shown[iMin])}`, X(iMin), Y(shown[iMin]) + 17, "", W, 11.5);
    // 공개 구간
    if (revealed) {
      const upMove = c[q.tgt] > c[q.last], col = upMove ? "is-up" : "is-dn";
      const fp = fut.map((v, j) => `${f1(XF(j))},${f1(Y(v))}`);
      s += `<path class="sqc-farea ${col}" d="M${f1(xLast)},${f1(yLast)}L${f1(XF(0))},${f1(Y(fut[0]))}L${fp.join("L")}L${f1(XF(H))},${B0 + 4}L${f1(xLast)},${B0 + 4}Z"/>`;
      s += `<polyline class="sqc-fut ${col}" pathLength="1" points="${f1(xLast)},${f1(yLast)} ${fp.join(" ")}"/>`;
      const yt = Y(c[q.tgt]);
      s += `<circle class="sqc-dot sqc-end ${col}" cx="${f1(XF(H))}" cy="${f1(yt)}" r="7"/>`;
      s += `<g class="sqc-endbub">${bubble(money(c[q.tgt]), `${H > 1 ? "21거래일 뒤" : "다음 거래일"} ${pct(c[q.tgt] / c[q.last] - 1)}`, XF(H), yt, col, W, yt < T0 + 40)}</g>`;
    }
    // 마지막 종가 점 + 말풍선(공개 뒤에는 작은 점만)
    s += `<circle class="sqc-dot" cx="${f1(xLast)}" cy="${f1(yLast)}" r="7"/>`;
    if (!revealed) s += bubble(money(c[q.last]), "마지막 종가", xLast, yLast, "is-last", W, yLast < T0 + 6);
    svgBox.setAttribute("viewBox", `0 0 ${W} ${Ht}`);
    svgBox.setAttribute("width", W); svgBox.setAttribute("height", Ht);
    svgBox.classList.toggle("no-anim", !animate);
    svgBox.innerHTML = s;
    svgBox.setAttribute("aria-label", `${q.t} 종가 차트 ${n}거래일, 최저 ${money(Math.min(...shown))} 최고 ${money(Math.max(...shown))}, 마지막 종가 ${money(c[q.last])}${q.thr != null ? `, 기준가 ${money(q.thr)}` : ""}${revealed ? `, 정답 시점 종가 ${money(c[q.tgt])}` : ""}`);
    // 도장
    if (revealed && q.a != null) {
      stamp.textContent = q.ok ? "맞았어요" : "틀렸어요";
      stamp.className = `sq-stamp ${q.ok ? "is-ok" : "is-no"}${animate ? "" : " no-anim"}`;
      stamp.hidden = false;
    } else stamp.hidden = true;
  }
  // 결과 표용 작은 차트(보여 준 구간 먹선 + 공개 구간 색선)
  function spark(q) {
    const { c } = data[q.t], { H } = MODES[set.mode];
    const W = 76, Ht = 30, a = c.slice(q.s, q.last + 1), f = c.slice(q.last, q.tgt + 1);
    const all = a.concat(f), lo = Math.min(...all), hi = Math.max(...all), sp = hi - lo || 1;
    const xw = W - 14, X = (i) => 2 + ((xw - 2) * i) / (a.length - 1), XF = (j) => xw + (10 * j) / H, Y = (v) => Ht - 3 - ((Ht - 6) * (v - lo)) / sp;
    const col = c[q.tgt] > c[q.last] ? "is-up" : "is-dn";
    return `<svg class="sq-spark" viewBox="0 0 ${W} ${Ht}" width="${W}" height="${Ht}" aria-hidden="true"><polyline class="sqc-line" points="${a.map((v, i) => `${f1(X(i))},${f1(Y(v))}`).join(" ")}"/><polyline class="sqc-fut ${col}" points="${f.map((v, j) => `${f1(XF(j))},${f1(Y(v))}`).join(" ")}"/></svg>`;
  }

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
    draw(q, false, false);
  }
  function answer(a) {
    const q = set.qs[set.i]; if (q.a != null) return;
    q.a = a === "1"; q.ok = q.a === truth(q);
    const { c, d } = data[q.t], r = c[q.tgt] / c[q.last] - 1;
    ans.hidden = true; draw(q, true, true);
    const real = q.thr == null ? (c[q.tgt] > c[q.last] ? "올랐어요" : c[q.tgt] < c[q.last] ? "내렸어요" : "그대로였어요(내림으로 쳐요)") : (c[q.tgt] >= q.thr ? `기준가 ${money(q.thr)} 이상이었어요` : `기준가 ${money(q.thr)} 미만이었어요`);
    rev.innerHTML = `<p class="sq-ok ${q.ok ? "is-ok" : "is-no"}">${q.ok ? "맞았어요" : "틀렸어요"}</p>
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
    $(".sq-table tbody").innerHTML = rows.map(({ q, r, hold: h }, i) => { const { d } = data[q.t]; return `<tr><td>${i + 1}</td><td class="sq-td-tk"><b>${q.t}</b>${spark(q)}</td><td class="sq-td-d">${d[q.s]} ~<br>${d[q.last]}<br><small>정답 ${d[q.tgt]}</small></td><td>${q.thr == null ? (q.a ? "오른다" : "내린다") : (q.a ? "예" : "아니요") + `<br><small>${money(q.thr)}</small>`}</td><td class="${q.ok ? "ok" : "no"}">${q.ok ? "O" : "X"}</td><td class="${r >= 0 ? "up" : "dn"}">${pct(r)}</td><td class="${h >= 0 ? "up" : "dn"}">${pct(h)}</td></tr>`; }).join("");
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
  window.addEventListener("resize", () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { if (set && !play.hidden) draw(set.qs[set.i], set.qs[set.i].a != null, false); }); });
})();
