// SOXL·TQQQ·KORU 주가 예측 (P2-50): 날짜를 가린 실제 일봉 종가 차트 → 오를까·내릴까 / $○○ 이상일까 → 실제 결과와 날짜 공개 → 10문제 뒤 백테스팅 요약
// 데이터: /assets/data/stock-<티커>.json (scripts/update-prices.mjs로 갱신, 분할·병합 반영 종가). 문제의 날짜는 답하기 전에는 화면·DOM에 넣지 않습니다.
// 차트는 SVG로 직접 그림(외부 라이브러리 없음, P2-50b 사이트 스타일). P2-50c 캔들(1·3개월 일봉, 1년 주봉) + RSI(14) 패널. 입력값은 어디에도 보내지 않습니다.
(function () {
  const box = document.querySelector('[data-tool="stockquiz"]');
  if (!box) return;
  const $ = (s) => box.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const BASE = document.documentElement.dataset.base || "";
  const TICKERS = ["SOXL", "TQQQ", "KORU"];
  const MODES = {
    m1: { L: 21, H: 1, look: "1개월(21거래일)", when: "다음 거래일", short: "다음 거래일" },
    m3: { L: 63, H: 1, look: "3개월(63거래일)", when: "다음 거래일", short: "다음 거래일" },
    w1: { L: 63, H: 5, look: "3개월(63거래일)", when: "일주일(5거래일) 뒤", short: "5거래일 뒤" }, // P2-50c 대표님 「일주일 후 주가는 상승할까요?」
    y1: { L: 252, H: 21, look: "1년(252거래일)", when: "21거래일(약 한 달) 뒤", short: "21거래일 뒤" },
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
    // 날짜: 첫날 + 간격(일). 공개할 때만 꺼내 씀. dn(일수)은 주봉 묶기에만 씀
    const d = [j.d0], dn = [Date.parse(j.d0 + "T00:00:00Z") / 864e5]; let ms = dn[0] * 864e5;
    for (const g of j.g) { ms += g * 864e5; d.push(new Date(ms).toISOString().slice(0, 10)); dn.push(dn[dn.length - 1] + g); }
    // P2-50c 정수 열 형식 풀기: 종가 = 차분 누적, 시가 = 종가 + o, 고가 = max(시가, 종가) + h, 저가 = min(시가, 종가) − l (÷k)
    const k = j.k, n = j.c.length, c = new Array(n), o = new Array(n), h = new Array(n), l = new Array(n);
    let ci = 0;
    for (let i = 0; i < n; i++) { ci += j.c[i]; const oi = ci + j.o[i]; c[i] = ci / k; o[i] = oi / k; h[i] = (Math.max(oi, ci) + j.h[i]) / k; l[i] = (Math.min(oi, ci) - j.l[i]) / k; }
    return (data[t] = { c, o, h, l, d, dn });
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
  // 굵은 먹선 + 노란 채움, 줄무늬 「?」 예측 칸, 마지막 날 종가 점선(P2-50d), 최고·최저 칩, 기준가 굵은 점선 + 칩.
  // 공개하면 이어지는 구간을 오르면 초록·내리면 빨강으로 그려 나가고 도장을 찍음. 날짜는 그리지 않음
  const svgBox = $(".sq-svg"), stamp = $(".sq-stamp"), rsiBox = $(".sq-rsi"), chips = $(".sq-chips"), legend = $(".sq-legend"); // P2-50c 봉 종류·RSI 칩, RSI 패널
  const NS = "http://www.w3.org/2000/svg";
  const f1 = (n) => Math.round(n * 10) / 10;
  const tw = (s, px) => [...s].reduce((w, ch) => w + (/[0-9$.,]/.test(ch) ? px * 0.6 : ch === " " ? px * 0.3 : px * 0.98), 0); // 글자 폭 어림(측정 없이)
  // P2-50c 봉 만들기: 일봉은 하루가 봉 1개, 주봉은 달력 주(월~일)로 묶음. 일 인덱스 [a, b]만 씀
  function bars(D, a, b, weekly) {
    const out = [];
    for (let i = a; i <= b; i++) {
      const k = weekly ? Math.floor((D.dn[i] + 3) / 7) : i; // dn = 1970-01-01(목)부터 일수 → +3이면 월요일에 주가 바뀜
      const p = out[out.length - 1];
      if (p && p.k === k) { p.h = Math.max(p.h, D.h[i]); p.l = Math.min(p.l, D.l[i]); p.c = D.c[i]; p.e = i; }
      else out.push({ k, o: D.o[i], h: D.h[i], l: D.l[i], c: D.c[i], s: i, e: i });
    }
    return out;
  }
  // P2-50c RSI(14), 와일더 방식: 첫 14개 변화의 단순 평균 → 이후 (이전×13 + 이번)/14. 배열 길이 그대로(앞 14개는 null)
  function rsi14(cl) {
    const out = new Array(cl.length).fill(null); let ag = 0, al = 0;
    const v = () => (al === 0 ? 100 : 100 - 100 / (1 + ag / al));
    for (let i = 1; i < cl.length; i++) {
      const ch = cl[i] - cl[i - 1], g = ch > 0 ? ch : 0, l = ch < 0 ? -ch : 0;
      if (i <= 14) { ag += g; al += l; if (i === 14) { ag /= 14; al /= 14; out[i] = v(); } }
      else { ag = (ag * 13 + g) / 14; al = (al * 13 + l) / 14; out[i] = v(); }
    }
    return out;
  }
  // 보여 준 봉마다 RSI. 상장일부터 마지막으로 보여 준 날(q.last)까지만 씀 → 미래 정보 없음
  function rsiFor(q, shownBars, weekly) {
    const D = data[q.t];
    const hist = bars(D, 0, q.last, weekly), r = rsi14(hist.map((b) => b.c)), byKey = new Map(hist.map((b, i) => [b.k, r[i]]));
    return shownBars.map((b) => byKey.get(b.k) ?? null);
  }
  function candle(b, x, bw, Y, cls, style = "") {
    const up = b.c > b.o, dn = b.c < b.o, yt = Y(Math.max(b.o, b.c)), yb = Y(Math.min(b.o, b.c)), hgt = Math.max(1.6, yb - yt);
    return `<g class="sqc-cdl ${up ? "is-up" : dn ? "is-dn" : "is-eq"}${cls}"${style}><line x1="${f1(x)}" y1="${f1(Y(b.h))}" x2="${f1(x)}" y2="${f1(Y(b.l))}"/><rect x="${f1(x - bw / 2)}" y="${f1(yt - (hgt - (yb - yt)) / 2)}" width="${f1(bw)}" height="${f1(hgt)}"/></g>`;
  }
  // P2-50d/e 점선 끝(오른쪽 「?」 칸 안)에 붙는 가격 칩 + 위쪽 작은 라벨. y = 칩 가운데, ly0 = 그 선의 실제 높이(비켜 놓았으면 짧은 연결선)
  function rtag(price, label, y, cls, R0, ly0) {
    const fs = 12.5, w = tw(price, fs) + 16, h = fs + 10, x0 = R0 - w;
    const ly = y - h / 2 - 5;
    const lead = Math.abs(ly0 - y) > 3 ? `<path class="sqc-lead" d="M${f1(x0 - 12)} ${f1(ly0)}L${f1(x0 - 3)} ${f1(y)}"/>` : "";
    return `<g class="sqc-rtag ${cls}">${lead}<rect x="${f1(x0)}" y="${f1(y - h / 2)}" width="${f1(w)}" height="${h}" rx="${h / 2}"/><text x="${f1(x0 + w / 2)}" y="${f1(y + fs * 0.36)}" font-size="${fs}">${esc(price)}</text><text class="sqc-rtag-lab" x="${f1(R0 - 2)}" y="${f1(ly)}" font-size="11">${esc(label)}</text></g>`;
  }
  function draw(q, revealed, animate) {
    const D = data[q.t], { c } = D, { H } = MODES[set.mode], weekly = set.mode === "y1";
    const W = Math.max(280, Math.round(svgBox.getBoundingClientRect().width || svgBox.parentNode.clientWidth || 340));
    const Ht = Math.round(Math.max(260, Math.min(390, W * 0.64)));
    const sb = bars(D, q.s, q.last, weekly), fb = revealed ? bars(D, q.last + 1, q.tgt, weekly) : [], n = sb.length;
    const vals = sb.flatMap((b) => [b.h, b.l]).concat(fb.flatMap((b) => [b.h, b.l])).concat(q.thr != null ? [q.thr] : []);
    let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo || hi * 0.02) * 0.06; lo -= pad; hi += pad;
    const L0 = 10, R0 = W - 10, T0 = 24, B0 = Ht - 16; // P2-50e 차트 안 칩·바닥선을 없애 위아래 여백을 줄임
    const zoneW = Math.max(88, (R0 - L0) * (H > 1 ? 0.19 : 0.14)); // P2-50d 가격 칩·라벨이 「?」 칸 안에 들어가게 넓힘
    const xl = R0 - zoneW, xr = R0;
    const slot = (xl - 8 - L0) / n, bw = Math.max(1.6, slot * 0.66);
    const X = (i) => L0 + slot * (i + 0.5);
    const Y = (v) => B0 - ((B0 - T0) * (v - lo)) / (hi - lo);
    const dense = slot < 4 ? " is-thin" : slot < 8 ? " is-mid" : "";
    const xLast = X(n - 1), yLast = Y(c[q.last]);
    let s = `<defs><pattern id="sqc-stripe" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(45)"><rect class="sqc-stripe-a" width="12" height="12"/><rect class="sqc-stripe-b" width="6" height="12"/></pattern></defs>`;
    s += `<rect class="sqc-zone${revealed ? " is-open " + (c[q.tgt] > c[q.last] ? "is-up" : "is-dn") : ""}" x="${f1(xl)}" y="${T0 - 16}" width="${f1(zoneW)}" height="${f1(B0 - T0 + 28)}" rx="12"/>`;
    // P2-50e 기간 최고가(보여 준 봉의 고가 최대)·최저가(저가 최소). 공개 뒤에도 질문 시점 값을 그대로 씀
    let iMax = 0, iMin = 0; sb.forEach((b, i) => { if (b.h > sb[iMax].h) iMax = i; if (b.l < sb[iMin].l) iMin = i; });
    const pHi = sb[iMax].h, pLo = sb[iMin].l;
    const lines = [{ y: yLast, price: money(c[q.last]), label: "마지막 날 종가", cls: "is-last" }, { y: Y(pHi), price: money(pHi), label: "기간 최고가", cls: "is-hi" }, { y: Y(pLo), price: money(pLo), label: "기간 최저가", cls: "is-lo" }];
    if (q.thr != null) lines.push({ y: Y(q.thr), price: money(q.thr), label: "기준가", cls: "is-thr" });
    // P2-50e 오른쪽 가격 칩(「?」 칸 안) 배치. 라벨은 칩 위. 가까우면 위에서부터 차례로 비켜 놓고(한 덩이 41px), 아래가 넘치면 위로 밀어 올림
    const TH = 41, minC = 28, maxC = Ht - 14, tags = lines.slice().sort((a, b) => a.y - b.y);
    tags.forEach((t) => { t.cy = Math.max(minC, Math.min(maxC, t.y)); });
    for (let i = 1; i < tags.length; i++) if (tags[i].cy < tags[i - 1].cy + TH) tags[i].cy = tags[i - 1].cy + TH;
    if (tags[tags.length - 1].cy > maxC) { tags[tags.length - 1].cy = maxC; for (let i = tags.length - 2; i >= 0; i--) if (tags[i].cy > tags[i + 1].cy - TH) tags[i].cy = tags[i + 1].cy - TH; }
    if (!revealed) { // 「?」 배지는 칩 덩이(라벨 포함, 가운데 cy−7)에서 가장 먼 자리
      const ys = tags.map((t) => t.cy - 7), cand = Array.from({ length: 13 }, (_, k) => T0 + 4 + ((B0 - T0 - 8) * k) / 12), qr = 20;
      const far = (y) => Math.min(...ys.map((v) => Math.abs(v - y))), qy = cand.reduce((a, b) => (far(b) > far(a) ? b : a));
      if (far(qy) >= 40) s += `<g class="sqc-q"><circle cx="${f1((xl + xr) / 2)}" cy="${f1(qy)}" r="${qr}"/><text x="${f1((xl + xr) / 2)}" y="${f1(qy + qr * 0.42)}" font-size="${qr + 4}">?</text></g>`;
    }
    // P2-50e 차트 안에는 캔들과 가격선만: 마지막 날 종가(파랑)·기간 최고가(빨강)·기간 최저가(초록) 점선, 기준가(검정 끊긴 선). 캔들 밑에 깔기
    s += lines.map((t) => `<line class="${t.cls === "is-thr" ? "sqc-thr" : "sqc-pline " + t.cls}" x1="${L0}" y1="${f1(t.y)}" x2="${R0}" y2="${f1(t.y)}"/>`).join("");
    // 보여 준 봉
    s += `<g class="sqc-cdls${dense}">${sb.map((b, i) => candle(b, X(i), bw, Y, "")).join("")}</g>`;
    // 공개 구간: 봉으로 이어 그림(다음 거래일 = 봉 1개, 일주일 뒤 = 일봉 5개, 21거래일 뒤 = 주봉 약 4~5개)
    if (revealed) {
      const fslot = (zoneW - 16) / Math.max(fb.length, H > 1 ? 5 : 2), fbw = Math.max(3, Math.min(fslot * 0.66, Math.max(bw, 10) * 1.4));
      const XF = (j) => xl + 8 + fslot * (j + 0.5) + (H > 1 ? 0 : (zoneW - 16 - fslot) / 2);
      s += `<g class="sqc-cdls sqc-fcdls">${fb.map((b, j) => candle(b, XF(j), fbw, Y, " sqc-fc", ` style="--i:${j}"`)).join("")}</g>`;
    }
    if (!revealed) s += tags.map((t) => rtag(t.price, t.label, t.cy, t.cls, R0, t.y)).join("");
    svgBox.setAttribute("viewBox", `0 0 ${W} ${Ht}`);
    svgBox.setAttribute("width", W); svgBox.setAttribute("height", Ht);
    svgBox.classList.toggle("no-anim", !animate);
    svgBox.innerHTML = s;
    // 봉 종류·RSI 칩 + RSI 패널
    const rs = rsiFor(q, sb, weekly), rNow = rs[n - 1];
    const tag = rNow == null ? "" : rNow >= 70 ? '<i class="sq-rsi-tag is-hot">과매수</i>' : rNow <= 30 ? '<i class="sq-rsi-tag is-cold">과매도</i>' : "";
    chips.innerHTML = `<span class="sq-chip sq-chip-bar">${weekly ? "주봉" : "일봉"} <small>${n}개</small></span><span class="sq-chip sq-chip-rsi">RSI(14) <b>${rNow == null ? "–" : rNow.toFixed(1)}</b>${tag}</span>`
      + (revealed ? `<span class="sq-chip sq-chip-res ${c[q.tgt] > c[q.last] ? "is-up" : "is-dn"}">${MODES[set.mode].short} ${pct(c[q.tgt] / c[q.last] - 1)} <b>${money(c[q.tgt])}</b></span>` : ""); // P2-50d 공개 결과는 차트 밖 칩으로(캔들 가림 없음)
    // P2-50e 색 범례 한 줄(차트 아래, 390px에서도 한 줄). 값은 질문 전에는 오른쪽 칩, 공개 뒤에는 아래 공개 문구에 있음
    legend.innerHTML = lines.map((t) => `<span class="sq-lg ${t.cls}"><i></i>${{ "is-last": "마지막 날 종가", "is-hi": "최고가", "is-lo": "최저가", "is-thr": "기준가" }[t.cls]}</span>`).join("");
    const RH = 117, RT = 26, RB = RH - 12, RY = (v) => RB - ((RB - RT) * v) / 100; // P2-50d 높이 78 → 117(1.5배)
    let r = `<rect class="sqr-band" x="${L0}" y="${f1(RY(70))}" width="${f1(xl - 8 - L0)}" height="${f1(RY(30) - RY(70))}"/>`;
    r += [70, 30].map((v) => `<line class="sqr-lv" x1="${L0}" y1="${f1(RY(v))}" x2="${f1(xl - 8)}" y2="${f1(RY(v))}"/><text class="sqr-lvt" x="${f1(xl + 2)}" y="${f1(RY(v) + 5)}" font-size="13.5">${v}</text>`).join("");
    const rp = rs.map((v, i) => (v == null ? null : `${f1(X(i))},${f1(RY(v))}`)).filter(Boolean);
    if (rp.length > 1) r += `<polyline class="sqr-line" points="${rp.join(" ")}"/>`;
    r += `<text class="sqr-h" x="${L0 + 2}" y="17" font-size="13.5">RSI(14) · ${weekly ? "주봉" : "일봉"}</text>`;
    rsiBox.setAttribute("viewBox", `0 0 ${W} ${RH}`); rsiBox.setAttribute("width", W); rsiBox.setAttribute("height", RH);
    rsiBox.innerHTML = r;
    rsiBox.setAttribute("aria-label", `RSI(14) ${weekly ? "주봉" : "일봉"} ${rNow == null ? "계산 불가" : rNow.toFixed(1)}`);
    svgBox.setAttribute("aria-label", `${q.t} ${weekly ? "주봉" : "일봉"} 캔들 차트 ${n}개, 기간 최저가 ${money(pLo)} 최고가 ${money(pHi)}, 마지막 종가 ${money(c[q.last])}${q.thr != null ? `, 기준가 ${money(q.thr)}` : ""}${revealed ? `, 정답 시점 종가 ${money(c[q.tgt])}` : ""}`);
    if (revealed && q.a != null) {
      // P2-50d 도장은 차트 위에 겹치지 않게 칩 줄 맨 앞에 찍음(캔들·칩을 가리지 않음)
      chips.querySelector(".sq-chip-res").insertAdjacentHTML("beforebegin", `<span class="sq-stamp sq-stamp-chip ${q.ok ? "is-ok" : "is-no"}${animate ? "" : " no-anim"}` + '">' + (q.ok ? "맞았어요" : "틀렸어요") + "</span>");
    }
    stamp.hidden = true;
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
