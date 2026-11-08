"use strict";
/* 사다리타기 · 돌림판 · 제비뽑기 (P2-44)
   - 참가자·결과 항목 입력 → 탭(사다리 / 돌림판 / 제비뽑기) → 결과 → 공정성 링크 · 결과 이미지 저장
   - 결과는 「추첨 번호(시드)」 하나로 정해짐. 시드는 crypto.getRandomValues로 만들고, 같은 시드·참가자·항목이면 같은 결과
   - 공정성 링크 = 주소 # 뒤에 모드·시드·참가자·항목을 담음(# 뒤는 웹 서버 요청에 포함되지 않음). 입력값은 기기에 저장하지 않음 */
(function () {
  const root = document.getElementById("dr");
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => Array.from(root.querySelectorAll(s));
  const MAXN = 12, MAXLEN = 12, PAD = "통과";
  const PAL = ["#2346d8", "#e5372b", "#1e9e5a", "#e0a100", "#7b3fe4", "#ff6a00", "#0a9396", "#d6338a", "#5c7a00", "#0b5fa5", "#a61e4d", "#495057"];
  const WHEEL = ["#2346d8", "#ffc21a", "#e5372b", "#1e9e5a", "#ffffff", "#7b3fe4", "#ff8a3d", "#0a9396"];
  const DARK_TEXT = new Set(["#ffc21a", "#ffffff", "#ff8a3d"]);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PRESETS = {
    coffee: { p: ["민수", "지영", "현우", "서연"], r: ["커피 쏘기"], w: "p" },
    lunch: { p: [], r: ["김치찌개", "돈가스", "짜장면", "비빔밥", "쌀국수", "샐러드"], w: "r" },
    clean: { p: ["민수", "지영", "현우", "서연"], r: ["바닥 쓸기", "창문 닦기", "분리수거", "쉬는 날"], w: "p" },
    order: { p: ["민수", "지영", "현우", "서연", "도윤"], r: ["1번째", "2번째", "3번째", "4번째", "5번째"], w: "p" },
  };
  const MODE_KEY = { ladder: "l", wheel: "w", cards: "c" };
  const MODE_NAME = { ladder: "사다리타기", wheel: "돌림판", cards: "제비뽑기" };

  // ---- 난수: 시드 → mulberry32 (모드마다 다른 흐름) ----
  const newSeed = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] >>> 0 || 1; };
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const seedText = (s) => s.toString(36).toUpperCase().padStart(7, "0");

  // ---- 상태 ----
  const ta = { p: $("#dr-p"), r: $("#dr-r") };
  const state = { p: [], r: [], seed: newSeed(), mode: "ladder", w: "p" };
  let fromLink = false;
  const parse = (s) => s.split(/[\n,]+/).map((x) => x.trim().slice(0, MAXLEN)).filter(Boolean).slice(0, MAXN);
  function derived() {
    const names = state.p.length ? state.p : state.r.map((_, i) => `${i + 1}번`);
    const N = names.length;
    const ends = state.r.slice(0, N);
    while (ends.length < N) ends.push(PAD);
    const wheel = state.w === "p" && state.p.length ? state.p : state.r.length ? state.r : state.p;
    return { names, N, ends, wheel };
  }

  // ---- 주소(#) ↔ 상태 ----
  const enc = (a) => a.map(encodeURIComponent).join(",");
  const dec = (s) => (s ? s.split(",").map((x) => { try { return decodeURIComponent(x); } catch (e) { return ""; } }).map((x) => x.trim().slice(0, MAXLEN)).filter(Boolean).slice(0, MAXN) : []);
  const hashOf = () => `#m=${MODE_KEY[state.mode]}&s=${state.seed.toString(36)}&w=${state.w}&p=${enc(state.p)}&r=${enc(state.r)}`;
  function readHash() {
    const h = location.hash.slice(1);
    if (!/(^|&)s=/.test(h)) return false;
    const q = {};
    h.split("&").forEach((kv) => { const i = kv.indexOf("="); if (i > 0) q[kv.slice(0, i)] = kv.slice(i + 1); });
    const seed = parseInt(q.s, 36);
    if (!(seed > 0 && seed <= 0xffffffff)) return false;
    state.seed = seed >>> 0;
    state.p = dec(q.p); state.r = dec(q.r);
    state.w = q.w === "r" ? "r" : "p";
    state.mode = Object.keys(MODE_KEY).find((k) => MODE_KEY[k] === q.m) || "ladder";
    return true;
  }
  const writeHash = () => { try { history.replaceState(null, "", hashOf()); } catch (e) {} };

  // ---- 사다리 만들기·따라가기 ----
  function makeLadder(seed, N) {
    const R = rng((seed ^ 0x9e3779b9) >>> 0);
    const rows = Math.max(8, N + 5), g = [];
    for (let y = 0; y < rows; y++) {
      const row = new Array(N - 1).fill(false);
      for (let i = 0; i < N - 1; i++) if (!(i > 0 && row[i - 1]) && R() < 0.42) row[i] = true;
      g.push(row);
    }
    for (let i = 0; i < N - 1; i++) { // 모든 칸 사이에 가로줄이 하나 이상 있게
      if (g.some((row) => row[i])) continue;
      const cand = [];
      for (let y = 0; y < g.length; y++) if (!(i > 0 && g[y][i - 1]) && !(i < N - 2 && g[y][i + 1])) cand.push(y);
      if (cand.length) g[cand[Math.floor(R() * cand.length)]][i] = true;
      else { const row = new Array(N - 1).fill(false); row[i] = true; g.splice(Math.floor(R() * (g.length + 1)), 0, row); }
    }
    return g;
  }
  function trace(g, s) {
    let c = s; const pts = [[c, 0]];
    for (let y = 0; y < g.length; y++) {
      const lv = y + 1;
      if (c < g[y].length && g[y][c]) { pts.push([c, lv], [c + 1, lv]); c++; }
      else if (c > 0 && g[y][c - 1]) { pts.push([c, lv], [c - 1, lv]); c--; }
    }
    pts.push([c, g.length + 1]);
    return { end: c, pts };
  }
  function shuffled(arr, seed) {
    const R = rng((seed ^ 0x85ebca6b) >>> 0), a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function wheelPick(seed, K) {
    const R = rng((seed ^ 0xc2b2ae35) >>> 0);
    return { idx: Math.floor(R() * K), off: 0.18 + 0.64 * R() };
  }

  // ---- 그리기 공통 ----
  function fitCanvas(cv, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.height = h + "px";
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return g;
  }
  const clipText = (g, s, max) => { if (g.measureText(s).width <= max) return s; let t = s; while (t.length > 1 && g.measureText(t + "…").width > max) t = t.slice(0, -1); return t + "…"; };
  // 사다리: (열, 단) → 화면 좌표. x는 열 가운데, y는 위·아래 여백 사이를 고르게 나눔
  function ladderGeo(W, H, N, rows, top = 8, bot = 8) {
    return { x: (c) => ((c + 0.5) * W) / N, y: (lv) => top + (lv * (H - top - bot)) / (rows + 1) };
  }
  function polyAt(P, t) { // 점 목록 P를 t(0~1)만큼 따라간 부분 경로와 끝점
    let L = 0; const seg = [];
    for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); seg.push(d); L += d; }
    let rest = L * Math.max(0, Math.min(1, t)); const out = [P[0]];
    for (let i = 1; i < P.length; i++) {
      if (rest >= seg[i - 1]) { out.push(P[i]); rest -= seg[i - 1]; continue; }
      const k = seg[i - 1] ? rest / seg[i - 1] : 0;
      out.push([P[i - 1][0] + (P[i][0] - P[i - 1][0]) * k, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * k]);
      break;
    }
    return { pts: out, len: L };
  }
  function drawLadder(g, W, H, ladder, N, paths, geo) {
    const rows = ladder.length;
    g.clearRect(0, 0, W, H);
    g.lineCap = "round"; g.lineJoin = "round";
    g.strokeStyle = "#141414"; g.lineWidth = 3;
    g.beginPath();
    for (let c = 0; c < N; c++) { g.moveTo(geo.x(c), geo.y(0)); g.lineTo(geo.x(c), geo.y(rows + 1)); }
    ladder.forEach((row, y) => row.forEach((on, i) => { if (on) { g.moveTo(geo.x(i), geo.y(y + 1)); g.lineTo(geo.x(i + 1), geo.y(y + 1)); } }));
    g.stroke();
    for (const p of paths) {
      const P = p.pts.map(([c, lv]) => [geo.x(c), geo.y(lv)]);
      const { pts } = polyAt(P, p.t);
      g.strokeStyle = p.color; g.lineWidth = 6;
      g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      const [hx, hy] = pts[pts.length - 1];
      g.fillStyle = p.color; g.strokeStyle = "#fff"; g.lineWidth = 3;
      g.beginPath(); g.arc(hx, hy, 8, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  }
  function drawWheel(g, S, list, rot, hi = -1) {
    const R = S / 2 - 6, cx = S / 2, cy = S / 2, K = list.length, seg = (Math.PI * 2) / K;
    g.clearRect(0, 0, S, S);
    for (let k = 0; k < K; k++) {
      const a0 = rot + k * seg - Math.PI / 2, col = WHEEL[k === K - 1 && k % WHEEL.length === 0 ? 1 : k % WHEEL.length]; // 마지막 칸이 첫 칸과 같은 색이 되지 않게
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a0, a0 + seg); g.closePath();
      g.fillStyle = col; g.fill();
      g.strokeStyle = "#141414"; g.lineWidth = 2.5; g.stroke();
      if (k === hi) { g.save(); g.clip(); g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(0, 0, S, S); g.restore(); }
      // 글자는 돌리지 않고 가로로: 칸 가운데 방향, 반지름 62% 지점에 둠(휴대폰에서 고개를 돌리지 않고 읽게)
      const mid = a0 + seg / 2, rr = R * (K > 8 ? 0.68 : 0.62);
      const fs = Math.max(12, Math.min(20, S / 18));
      g.save();
      g.font = `800 ${fs}px "Pretendard Variable", system-ui, sans-serif`;
      g.fillStyle = DARK_TEXT.has(col) ? "#141414" : "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(clipText(g, list[k], Math.min(R * 0.62, Math.max(fs * 3, 2 * rr * Math.sin(Math.min(seg, Math.PI) / 2) - 8))), cx + Math.cos(mid) * rr, cy + Math.sin(mid) * rr);
      g.restore();
    }
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.lineWidth = 4; g.strokeStyle = "#141414"; g.stroke();
    g.beginPath(); g.arc(cx, cy, Math.max(14, R * 0.12), 0, Math.PI * 2); g.fillStyle = "#141414"; g.fill();
  }

  // ---- 화면 요소 ----
  const tabs = $$('[role="tab"]');
  const panels = { ladder: $("#dr-ladder"), wheel: $("#dr-wheel"), cards: $("#dr-cards") };
  const out = $("#dr-result"), note = $("#dr-note"), seedEl = $("#dr-seed"), linkNote = $("#dr-link-note");
  const L = { box: $(".dr-ladder"), names: $(".dr-names"), ends: $(".dr-ends"), cv: $("#dr-ladder-cv") };
  const Wh = { cv: $("#dr-wheel-cv"), btn: $("#dr-spin"), gauge: $(".dr-gauge i"), box: $(".dr-wheel-box") };
  const cardsBox = $(".dr-cards");

  // 사다리 상태
  let ladder = null, lgeo = null, lW = 0, lH = 0, lg = null;
  const anim = new Map(); // 참가자 → { t0, dur, t }
  let rafL = 0;
  // 돌림판 상태
  let rot = 0, spinning = false, wheelDone = null, usedSeed = null, holdT0 = 0, holdRaf = 0;
  // 제비뽑기 상태
  const flipped = new Set();

  function rebuild() {
    const d = derived();
    cancelAnimationFrame(rafL); anim.clear(); flipped.clear(); wheelDone = null;
    seedEl.textContent = seedText(state.seed);
    const msgs = [];
    if (state.p.length && state.r.length < state.p.length) msgs.push(`결과 항목이 참가자보다 ${state.p.length - state.r.length}개 적어서 남는 칸은 「${PAD}」으로 채웠어요.`);
    if (state.p.length && state.r.length > state.p.length) msgs.push(`결과 항목이 참가자보다 많아서 사다리·제비뽑기는 앞에서부터 ${state.p.length}개만 써요.`);
    if (!state.p.length && state.r.length) msgs.push("참가자를 비워 두면 1번, 2번… 번호로 대신해요.");
    note.textContent = msgs.join(" ");
    buildLadder(d); buildCards(d); drawWheelNow();
    showResult();
  }

  // ---- 사다리 ----
  function buildLadder(d) {
    L.names.innerHTML = ""; L.ends.innerHTML = "";
    if (d.N < 2) { ladder = null; L.box.hidden = true; return; }
    L.box.hidden = false;
    ladder = makeLadder(state.seed, d.N);
    L.box.style.setProperty("--n", d.N);
    d.names.forEach((n, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "dr-name"; b.dataset.i = i; b.style.setProperty("--c", PAL[i % PAL.length]);
      b.innerHTML = `<i aria-hidden="true"></i><span></span>`; b.querySelector("span").textContent = n;
      b.setAttribute("aria-label", `${n}의 사다리 열기`);
      L.names.appendChild(b);
    });
    d.ends.forEach((e) => { const s = document.createElement("span"); s.className = "dr-end"; s.innerHTML = "<b></b><small></small>"; s.querySelector("b").textContent = e; L.ends.appendChild(s); });
    sizeLadder();
  }
  function sizeLadder() {
    if (!ladder) return;
    lW = L.cv.clientWidth || L.box.clientWidth; lH = Math.max(240, Math.min(420, ladder.length * 28 + 30));
    lg = fitCanvas(L.cv, lW, lH);
    lgeo = ladderGeo(lW, lH, derived().N, ladder.length);
    paintLadder();
  }
  function paintLadder() {
    if (!ladder) return;
    const d = derived();
    const paths = [...anim.entries()].map(([i, a]) => ({ pts: trace(ladder, i).pts, color: PAL[i % PAL.length], t: a.t }));
    drawLadder(lg, lW, lH, ladder, d.N, paths, lgeo);
  }
  function openLadder(list) {
    if (!ladder) return;
    const now = performance.now();
    list.forEach((i, k) => {
      if (anim.has(i)) return;
      const P = trace(ladder, i).pts.map(([c, lv]) => [lgeo.x(c), lgeo.y(lv)]);
      const len = polyAt(P, 1).len;
      anim.set(i, { t0: now + (list.length > 1 ? k * 120 : 0), dur: reduce ? 0 : Math.max(1100, Math.min(3200, len * 3.2)), t: 0 });
    });
    cancelAnimationFrame(rafL);
    const step = (ts) => {
      let busy = false;
      anim.forEach((a, i) => {
        if (a.t >= 1) return;
        a.t = a.dur ? Math.max(0, Math.min(1, (ts - a.t0) / a.dur)) : 1;
        if (a.t >= 1) markLadderDone(i); else busy = true;
      });
      paintLadder();
      if (busy) rafL = requestAnimationFrame(step);
    };
    rafL = requestAnimationFrame(step);
  }
  function markLadderDone(i) {
    const d = derived(), end = trace(ladder, i).end;
    const b = L.names.children[i]; if (b) b.classList.add("done");
    const e = L.ends.children[end];
    if (e) { e.classList.add("done"); e.style.setProperty("--c", PAL[i % PAL.length]); e.querySelector("small").textContent = d.names[i]; }
    showResult();
  }
  const ladderPairs = () => { const d = derived(); return [...anim.entries()].filter(([, a]) => a.t >= 1).sort((a, b) => a[0] - b[0]).map(([i]) => [i, d.names[i], d.ends[trace(ladder, i).end]]); };

  // ---- 돌림판 ----
  function wheelSize() { return Math.max(220, Math.min(380, Wh.box.clientWidth || 320)); }
  let wg = null, wS = 0;
  function drawWheelNow() {
    const list = derived().wheel;
    wS = wheelSize(); Wh.cv.style.width = wS + "px"; wg = fitCanvas(Wh.cv, wS, wS);
    Wh.btn.disabled = list.length < 2 || spinning;
    if (list.length < 2) { wg.clearRect(0, 0, wS, wS); return; }
    drawWheel(wg, wS, list, rot, wheelDone ? wheelDone.idx : -1);
  }
  function holdStart(ev) {
    if (spinning || Wh.btn.disabled || holdT0) return;
    if (ev && ev.preventDefault) ev.preventDefault();
    holdT0 = performance.now(); Wh.btn.classList.add("holding");
    const tick = (ts) => { if (!holdT0) return; Wh.gauge.style.transform = `scaleX(${Math.min(1, (ts - holdT0) / 1500)})`; holdRaf = requestAnimationFrame(tick); };
    holdRaf = requestAnimationFrame(tick);
  }
  function holdEnd() {
    if (!holdT0) return;
    const power = Math.min(1, (performance.now() - holdT0) / 1500);
    holdT0 = 0; cancelAnimationFrame(holdRaf); Wh.btn.classList.remove("holding");
    spin(power);
  }
  function spin(power) {
    const list = derived().wheel; if (list.length < 2) return;
    if (usedSeed === state.seed) { state.seed = newSeed(); writeHash(); rebuild(); } // 한 추첨 번호 = 한 번의 결과. 다시 돌리면 새 번호
    usedSeed = state.seed; fromLink = false; linkBanner();
    const K = list.length, seg = (Math.PI * 2) / K, pick = wheelPick(state.seed, K);
    const turns = 3 + Math.round(power * 7), dur = reduce ? 0 : 2600 + power * 4200;
    const base = ((rot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const target = (((-(pick.idx + pick.off) * seg - base) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const from = base, total = turns * Math.PI * 2 + target;
    spinning = true; Wh.btn.disabled = true; wheelDone = null; showResult();
    const t0 = performance.now();
    const step = (ts) => {
      const t = dur ? Math.min(1, (ts - t0) / dur) : 1;
      rot = from + total * (1 - Math.pow(1 - t, 3));
      drawWheel(wg, wS, list, rot);
      if (t < 1) return requestAnimationFrame(step);
      spinning = false; Wh.btn.disabled = false; Wh.gauge.style.transform = "scaleX(0)";
      wheelDone = { idx: pick.idx, label: list[pick.idx] };
      drawWheel(wg, wS, list, rot, pick.idx);
      showResult();
    };
    requestAnimationFrame(step);
  }

  // ---- 제비뽑기 ----
  let cardMap = [];
  function buildCards(d) {
    cardsBox.innerHTML = "";
    if (d.N < 2) return;
    cardMap = shuffled(d.ends, state.seed);
    d.names.forEach((n, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "dr-card"; b.dataset.i = i; b.setAttribute("aria-pressed", "false");
      b.style.setProperty("--c", PAL[i % PAL.length]);
      b.innerHTML = `<span class="dr-card-in"><span class="dr-card-back"><b></b><small>눌러서 뒤집기</small></span><span class="dr-card-front"><small></small><b></b></span></span>`;
      b.querySelector(".dr-card-back b").textContent = n;
      b.querySelector(".dr-card-front small").textContent = n;
      b.querySelector(".dr-card-front b").textContent = cardMap[i];
      b.setAttribute("aria-label", `${n}의 제비 뒤집기`);
      cardsBox.appendChild(b);
    });
  }
  function flip(i) {
    const b = cardsBox.children[i]; if (!b || flipped.has(i)) return;
    flipped.add(i); b.classList.add("flipped"); b.setAttribute("aria-pressed", "true");
    b.setAttribute("aria-label", `${derived().names[i]}: ${cardMap[i]}`);
    showResult();
  }

  // ---- 결과 표시 ----
  function pairsOf(mode) {
    if (mode === "ladder") return ladder ? ladderPairs() : [];
    if (mode === "cards") { const d = derived(); return [...flipped].sort((a, b) => a - b).map((i) => [i, d.names[i], cardMap[i]]); }
    return [];
  }
  function showResult() {
    const m = state.mode, d = derived();
    const minN = m === "wheel" ? d.wheel.length : d.N;
    if (minN < 2) { out.innerHTML = `<p class="dr-empty">${m === "wheel" ? "돌림판 칸이" : "참가자(또는 결과 항목)가"} 2개 이상 있어야 시작할 수 있어요.</p>`; return; }
    if (m === "wheel") {
      out.innerHTML = wheelDone ? `<p class="dr-big">결과: <b></b></p>` : `<p class="dr-empty">${spinning ? "돌아가는 중…" : "버튼을 길게 누를수록 세게 돌아가요."}</p>`;
      if (wheelDone) out.querySelector("b").textContent = wheelDone.label;
      return;
    }
    const pairs = pairsOf(m);
    if (!pairs.length) { out.innerHTML = `<p class="dr-empty">${m === "ladder" ? "이름을 눌러 한 명씩 열거나 「전체 공개」를 누르세요." : "카드를 눌러 한 장씩 뒤집거나 「모두 뒤집기」를 누르세요."}</p>`; return; }
    const ul = document.createElement("ul"); ul.className = "dr-pairs";
    pairs.forEach(([i, n, r]) => { const li = document.createElement("li"); li.style.setProperty("--c", PAL[i % PAL.length]); li.innerHTML = "<span></span><b></b>"; li.querySelector("span").textContent = n; li.querySelector("b").textContent = r; ul.appendChild(li); });
    out.innerHTML = `<p class="dr-sum">${pairs.length} / ${d.N}명 공개</p>`; out.appendChild(ul);
  }
  function linkBanner() {
    const b = $("#dr-from-link");
    b.hidden = !fromLink;
    if (fromLink) b.querySelector("b").textContent = seedText(state.seed);
  }

  // ---- 탭 ----
  function setMode(m, focus, quiet) { // quiet: 처음 열 때는 주소를 바꾸지 않음(사용자가 움직인 뒤에만 # 갱신)
    state.mode = m;
    tabs.forEach((t) => { const on = t.dataset.mode === m; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    Object.entries(panels).forEach(([k, el]) => (el.hidden = k !== m));
    if (!quiet) writeHash();
    if (m === "ladder") sizeLadder();
    if (m === "wheel") drawWheelNow();
    showResult();
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => setMode(t.dataset.mode));
    t.addEventListener("keydown", (e) => {
      const k = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (k) { e.preventDefault(); setMode(tabs[(i + k + tabs.length) % tabs.length].dataset.mode, true); }
    });
  });

  // ---- 입력 ----
  function fillInputs() {
    ta.p.value = state.p.join("\n"); ta.r.value = state.r.join("\n");
    $$('input[name="dr-w"]').forEach((x) => (x.checked = x.value === state.w));
  }
  let tmr = 0;
  const onInput = () => { clearTimeout(tmr); tmr = setTimeout(() => { state.p = parse(ta.p.value); state.r = parse(ta.r.value); fromLink = false; linkBanner(); writeHash(); rebuild(); }, 250); };
  ta.p.addEventListener("input", onInput); ta.r.addEventListener("input", onInput);
  $$('input[name="dr-w"]').forEach((x) => x.addEventListener("change", () => { state.w = x.value; usedSeed = null; writeHash(); rebuild(); }));
  $$("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    const p = PRESETS[b.dataset.preset];
    state.p = p.p.slice(); state.r = p.r.slice(); state.w = p.w; state.seed = newSeed(); usedSeed = null; fromLink = false;
    fillInputs(); linkBanner(); writeHash(); rebuild();
  }));
  root.addEventListener("click", (e) => {
    const a = e.target.closest("[data-dr]");
    if (a) {
      const act = a.dataset.dr;
      if (act === "reseed") { state.seed = newSeed(); usedSeed = null; fromLink = false; linkBanner(); writeHash(); rebuild(); }
      if (act === "all") openLadder(derived().names.map((_, i) => i));
      if (act === "flipall") derived().names.forEach((_, i) => flip(i));
      if (act === "link") copyLink();
      if (act === "image") saveImage();
      return;
    }
    const n = e.target.closest(".dr-name"); if (n) return openLadder([+n.dataset.i]);
    const c = e.target.closest(".dr-card"); if (c) flip(+c.dataset.i);
  });
  // 돌림판: 누르고 있는 시간 = 힘. 손가락·마우스·키보드(Space·Enter) 모두
  Wh.btn.addEventListener("pointerdown", (e) => { Wh.btn.setPointerCapture && Wh.btn.setPointerCapture(e.pointerId); holdStart(e); });
  Wh.btn.addEventListener("pointerup", holdEnd);
  Wh.btn.addEventListener("pointercancel", holdEnd);
  Wh.btn.addEventListener("lostpointercapture", holdEnd);
  Wh.btn.addEventListener("contextmenu", (e) => e.preventDefault());
  Wh.btn.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); holdStart(); } });
  Wh.btn.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); holdEnd(); } });
  Wh.btn.addEventListener("blur", holdEnd);
  let rz = 0;
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (state.mode === "ladder") sizeLadder(); else if (state.mode === "wheel" && !spinning) drawWheelNow(); }, 120); });

  // ---- 공정성 링크 ----
  async function copyLink() {
    writeHash();
    const url = location.href;
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch (e) {
      const t = document.createElement("textarea"); t.value = url; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select(); try { ok = document.execCommand("copy"); } catch (e2) {} t.remove();
    }
    linkNote.textContent = ok ? `링크를 복사했어요(추첨 번호 ${seedText(state.seed)}). 결과를 열기 전에 단톡방에 먼저 보내 두면, 받은 사람도 같은 결과를 그대로 볼 수 있어요.` : "복사하지 못했어요. 주소창의 주소를 그대로 복사해 보내 주세요.";
  }

  // ---- 결과 이미지 저장 (canvas → PNG) ----
  async function saveImage() {
    const m = state.mode, d = derived();
    const pairs = m === "wheel" ? (wheelDone ? [[0, "결과", wheelDone.label]] : []) : pairsOf(m);
    if (!pairs.length) { linkNote.textContent = m === "wheel" ? "돌림판을 먼저 돌려 주세요." : "결과를 한 명 이상 연 뒤에 저장해 주세요."; return; }
    try { await document.fonts.ready; } catch (e) {}
    const W = 1080, P = 60, F = '"Pretendard Variable", system-ui, sans-serif';
    let vis = 0;
    if (m === "ladder") vis = 140 + Math.min(620, ladder.length * 44);
    if (m === "wheel") vis = 640;
    const listH = m === "wheel" ? 0 : pairs.length * 62 + 20;
    const H = 170 + vis + listH + 110;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#141414"; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8);
    g.fillStyle = "#141414"; g.textBaseline = "alphabetic"; g.textAlign = "left";
    g.font = `800 52px ${F}`; g.fillText(`${MODE_NAME[m]} 결과`, P, 100);
    g.font = `700 26px ${F}`; g.fillStyle = "#3d3d3d";
    const dt = new Date(), pad2 = (n) => String(n).padStart(2, "0");
    g.fillText(`추첨 번호 ${seedText(state.seed)} · ${dt.getFullYear()}.${pad2(dt.getMonth() + 1)}.${pad2(dt.getDate())} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`, P, 145);
    let y = 170;
    if (m === "ladder") {
      const lw = W - P * 2, colW = lw / d.N, top = y + 50, lh = vis - 140;
      g.save(); g.translate(P, top);
      const geo = ladderGeo(lw, lh, d.N, ladder.length, 0, 0);
      const done = new Set(pairs.map((x) => x[0]));
      drawLadder(g, lw, lh, ladder, d.N, [...done].map((i) => ({ pts: trace(ladder, i).pts, color: PAL[i % PAL.length], t: 1 })), geo);
      g.restore();
      g.textAlign = "center";
      const fs = Math.max(16, Math.min(28, colW / 3.4));
      d.names.forEach((n, i) => { g.font = `800 ${fs}px ${F}`; g.fillStyle = done.has(i) ? PAL[i % PAL.length] : "#141414"; g.fillText(clipText(g, n, colW - 8), P + (i + 0.5) * colW, top - 16); });
      g.fillStyle = "#141414";
      d.ends.forEach((e, k) => { g.font = `800 ${fs}px ${F}`; g.fillText(clipText(g, e, colW - 8), P + (k + 0.5) * colW, top + lh + 40); });
      y += vis;
    }
    if (m === "wheel") {
      const S = 560, ox = (W - S) / 2, oy = y + 20;
      const tmp = document.createElement("canvas"); tmp.width = S; tmp.height = S;
      drawWheel(tmp.getContext("2d"), S, d.wheel, rot, wheelDone.idx);
      g.drawImage(tmp, ox, oy);
      g.fillStyle = "#e5372b"; g.strokeStyle = "#141414"; g.lineWidth = 4;
      g.beginPath(); g.moveTo(W / 2 - 22, oy - 10); g.lineTo(W / 2 + 22, oy - 10); g.lineTo(W / 2, oy + 34); g.closePath(); g.fill(); g.stroke();
      y += vis;
      g.textAlign = "center"; g.fillStyle = "#141414"; g.font = `800 54px ${F}`;
      g.fillText(clipText(g, wheelDone.label, W - P * 2), W / 2, y + 30);
      y += 40;
    } else {
      g.textAlign = "left";
      pairs.forEach(([i, n, r], k) => {
        const yy = y + 20 + k * 62;
        g.fillStyle = PAL[i % PAL.length]; g.beginPath(); g.arc(P + 14, yy + 22, 12, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#141414"; g.font = `800 34px ${F}`;
        g.fillText(clipText(g, n, 360), P + 42, yy + 34);
        g.fillStyle = "#3d3d3d"; g.font = `700 34px ${F}`; g.fillText("→", P + 420, yy + 34);
        g.fillStyle = "#141414"; g.font = `800 34px ${F}`; g.fillText(clipText(g, r, W - P - (P + 480)), P + 480, yy + 34);
      });
      y += listH;
    }
    g.textAlign = "left"; g.fillStyle = "#767676"; g.font = `700 24px ${F}`;
    g.fillText("같은 추첨 번호·참가자·항목으로 공정성 링크를 열면 같은 결과가 나와요.", P, H - 50);
    cv.toBlob((blob) => {
      if (!blob) { linkNote.textContent = "이미지를 만들지 못했어요."; return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${MODE_NAME[m]}-결과-${seedText(state.seed)}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      linkNote.textContent = "결과 이미지를 저장했어요.";
    }, "image/png");
  }

  // ---- 시작 ----
  if (readHash()) fromLink = true;
  else { const p = PRESETS.coffee; state.p = p.p.slice(); state.r = p.r.slice(); state.w = p.w; }
  fillInputs(); linkBanner();
  rebuild(); setMode(state.mode, false, true);
  window.addEventListener("hashchange", () => { if (readHash()) { fromLink = true; usedSeed = null; fillInputs(); linkBanner(); rebuild(); setMode(state.mode, false, true); } });
})();
