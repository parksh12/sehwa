// P2-74 「커닝냥이 — 감독관을 피해서 만점을 맞아라!」 게임 진행 (이름 문자열은 examcat-data.js NAME 한 곳에서만 가져옴)
// 규칙: 가만히 있으면 냥이가 스스로 천천히 푼다(안전). AI는 3단계 — 꾹(시험지 찰칵) → 손 떼고 기다리기(AI가 답 생성) → 다시 꾹(힐끔 보기). 빠르지만 위험.
// 찰칵·힐끔하는 순간 감독관 시선(빨간 부채꼴)에 걸리면 의심 게이지가 오르고, 가득 차면 퇴장.
// 감독관은 돌아보기 전에 반드시 예고(노란 점선 부채꼴 + 「?」) → 운이 아니라 읽는 게임. 단계마다 감시 장치·AI 도구가 하나씩 새로 생김.
// 너무 잘 보면 사후 조사(「너무 잘 봤는데?」): AI로 푼 비율만큼 조사 게이지가 차 있고, 시험 문제를 AI 없이 다시 물어봄.
// AI 시험 부정행위 논란을 풍자한 가상의 게임이며 실존 인물과 무관. 기록은 이 기기 localStorage에만(서버 전송 0). 순위표 없음.
(function () {
  const SM = window.EXCAT;
  const root = document.getElementById("examcat");
  if (!root || !SM || !SM.art) return;
  const { art, sound, STAGES, POOL, ENDINGS, PROBE, NAME, SUB } = SM;
  const { W, H, CAT, deg } = art;
  const DEBUG = /[?&]debug=1/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname); // 공개 사이트에선 꺼짐
  let SPEED = 1;
  const KEY = SM.SLUG + "-v1";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const br = (s) => esc(s).replace(/\n/g, "<br>");

  // ---------- 저장(이 기기에만) ----------
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const D = Object.assign({ best: null, endings: {}, plays: 0, sound: true }, load());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} };
  sound.setOn(D.sound);
  SM.FONT = (getComputedStyle(document.body).fontFamily || "sans-serif").replace(/;/g, "");

  // ---------- 화면 뼈대 ----------
  const ICON_SND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path class="w" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="x" d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor"/></svg>';
  root.innerHTML = `
<div class="sm-screen">
  <div class="sm-hud">
    <span class="sm-chip"><b class="sm-sn">1/4</b> <span class="sm-sname">쪽지시험</span></span>
    <span class="sm-time" aria-label="남은 시간"><b>40</b>초</span>
    <span class="sm-tools"><button type="button" class="sm-ib sm-snd" aria-label="소리 끄기" aria-pressed="true">${ICON_SND}</button><button type="button" class="sm-ib sm-pause" aria-label="일시정지">${ICON_PAUSE}</button></span>
  </div>
  <div class="sm-sus" aria-label="의심 게이지"><span class="sm-sus-l">의심</span><span class="sm-sus-bar"><i></i></span><span class="sm-sus-n"><b>0</b>%</span><span class="sm-hits">들킴 <b>0</b></span></div>
  <div class="sm-stage"><canvas class="sm-cv" aria-hidden="true"></canvas><div class="sm-toast" aria-hidden="true"></div></div>
  <div class="sm-qbox">
    <p class="sm-qn"><span>문제 <b>1</b>/<i>4</i></span><span class="sm-who"></span></p>
    <p class="sm-q"></p>
    <div class="sm-prog" aria-hidden="true"><i class="s"></i><i class="a"></i></div>
    <ol class="sm-steps" aria-label="AI 쓰기 3단계"><li data-p="0">① 꾹: 찰칵</li><li data-p="1">② 손 떼고 대기</li><li data-p="2">③ 꾹: 힐끔</li></ol>
    <div class="sm-ch" role="group" aria-label="답을 알면 직접 고르기">
      <button type="button" class="sm-c" data-c="0"><b>1</b><span></span></button>
      <button type="button" class="sm-c" data-c="1"><b>2</b><span></span></button>
      <button type="button" class="sm-c" data-c="2"><b>3</b><span></span></button>
    </div>
    <p class="sm-fb" aria-live="polite"></p>
  </div>
  <button type="button" class="sm-hold" aria-describedby="sm-hold-d"><span class="sm-hold-t">꾹: 시험지 찰칵</span><small id="sm-hold-d"><b class="sm-tool">단추 카메라 + 냥폰</b> · 떼면 숨김 · PC는 Space</small></button>
  <p class="sr sm-live" aria-live="assertive"></p>
  <div class="sm-ov" hidden></div>
</div>`;
  const $ = (s) => root.querySelector(s);
  const scr = $(".sm-screen"), cv = $(".sm-cv"), ctx = cv.getContext("2d"), ov = $(".sm-ov"), holdBtn = $(".sm-hold");
  const choiceBtns = [...root.querySelectorAll(".sm-c")];
  let ovArt = null, ovArtKind = null, ovArtE = null;

  function fitCanvas(c, lw, lh) {
    const r = c.getBoundingClientRect(); if (!r.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pw = Math.round(r.width * dpr), ph = Math.round((r.width * lh / lw) * dpr);
    if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
    const k = pw / lw; c.getContext("2d").setTransform(k, 0, 0, k, 0, 0);
  }
  const fitAll = () => { fitCanvas(cv, W, H); if (ovArt) fitCanvas(ovArt, +ovArt.dataset.w, +ovArt.dataset.h); };

  // ---------- 상태 ----------
  const G = { mode: "title", paused: false, si: 0, t: 0, sus: 0, hits: 0, stageHits: 0, qs: [], qi: 0, prog: 0, aiPart: 0, reveal: 0, held: false, holdT: 0, hideLeft: 0, wasExp: false, ai: { ph: 0, snap: 0, wait: 0 }, seenT: 0, spotted: false, spotCool: 0, flash: 0, busted: 0, det: null, watchers: [], results: [], seen: [], probe: null, stepT: 0, toastT: 0, outcome: null, runT0: 0 };
  const stage = () => STAGES[G.si];

  // ---------- 감독관(감시 장치) ----------
  const head = (w) => (w.kind === "cctv" ? { x: w.x - 4, y: w.y + 4 } : { x: w.x, y: w.y - (w.kind === "paper" ? 54 : 50) * w.s });
  const angTo = (w, px = CAT.x, py = CAT.y) => { const h = head(w); return Math.atan2(py - h.y, px - h.x); };
  function makeWatcher(kind) {
    if (kind === "ta") return { kind, role: "ta", x: 180, y: 118, s: 1, half: deg(17), range: 280, face: "back", dir: 1, look: Math.PI / 2, ang: Math.PI / 2, state: "off", q: [], act: null, at: 0, flip: false, posI: 0 };
    if (kind === "paper") return { kind, role: "boss", x: 318, y: 118, s: 0.95, half: deg(13), range: 300, face: "front", dir: -1, look: deg(130), ang: deg(130), paper: "read", state: "off", q: [], act: null, at: 0 };
    if (kind === "patrol") return { kind, role: "patrol", x: 180, y: 112, s: 1, half: deg(18), range: 160, face: "front", dir: 1, look: Math.PI / 2, ang: Math.PI / 2, state: "off", q: [], act: null, at: 0 };
    if (kind === "cctv") return { kind, x: 346, y: 14, half: deg(11), range: 440, ang: deg(64), va: 1, lo: deg(62), hi: deg(178), pause: 0.6, state: "look" }; // 교실 전체를 크게 쓸고 지나감(냥이 쪽은 잠깐)
    return null; // sleepy(조는 감독관)·detector(전파 탐지기)는 시선 없음
  }
  const A = {
    idle: (dur, o = {}) => ({ k: "idle", dur, ...o }),
    tell: (dur, a0, a1, o = {}) => ({ k: "tell", dur, a0, a1, ...o }),
    look: (dur, a0, a1, o = {}) => ({ k: "look", dur, a0, a1, ...o }),
    walk: (x, y, speed, o = {}) => ({ k: "walk", to: [x, y], speed, ...o }),
    rustle: (dur) => ({ k: "rustle", dur }),
  };
  const TA_POS = [110, 180, 250, 180];
  function genTA(w, st) {
    const reg = st.n === 1; // 쪽지시험: 규칙적(시간·위치 고정)
    const board = reg ? 3.6 : st.n === 4 ? rnd(1.9, 3.2) : rnd(2.6, 4.2);
    const ac = angTo(w), sw = deg(34);
    const fwd = reg ? (w.flip = !w.flip) : Math.random() < 0.5;
    const a0 = ac + (fwd ? -sw : sw), a1 = ac + (fwd ? sw : -sw);
    const lookDur = reg ? 2.6 : st.n === 4 ? 2.0 : 2.3;
    let nx;
    if (reg) { w.posI = (w.posI + 1) % TA_POS.length; nx = TA_POS[w.posI]; }
    else { do { nx = rnd(100, 245); } while (Math.abs(nx - w.x) < 40); }
    w.q.push(A.idle(board, { face: "back", chalk: true }), A.tell(st.tell, a0, a1), A.look(lookDur, a0, a1), A.walk(nx, 118, 70));
  }
  const PAPER_ELSE = [deg(160), deg(169), deg(96)];
  function genPaper(w, st) {
    w.q.push(A.idle(st.n === 4 ? rnd(1.8, 4.0) : rnd(2.4, 5.0), { paper: "read" }));
    const r = Math.random();
    if (r < 0.45) { const ac = angTo(w), j = deg(6); w.q.push(A.tell(st.tell, ac - j, ac + j), A.look(rnd(1.7, 2.4), ac - j, ac + j)); }
    else if (r < 0.72) { const a = pick(PAPER_ELSE); w.q.push(A.tell(st.tell, a, a), A.look(1.5, a, a)); } // 다른 수험생 보기(점선이 다른 곳을 가리킴)
    else w.q.push(A.rustle(0.9)); // 가짜 동작: 신문만 펄럭(점선 없음)
  }
  function genPatrol(w, st) {
    const left = Math.random() < 0.5, a = left ? 120 : 240, b = left ? 240 : 120;
    const ac = angTo(w), sw = deg(30);
    w.q.push(A.idle(0.8, { face: "front" }), A.tell(st.tell, ac - sw, ac + sw), A.look(2.0, ac - sw, ac + sw));
    w.q.push(A.walk(a, 120, 55, { face: "side" }));
    w.q.push(A.walk(a, 226, 42, { face: "front", cone: Math.PI / 2 }));
    if (Math.random() < 0.35) w.q.push(A.tell(st.tell, null, null, { toCat: true, face: "side" }), A.look(1.2, null, null, { toCat: true, face: "side" })); // 안경 검사 눈길
    w.q.push(A.walk(a, 372, 42, { face: "front", cone: Math.PI / 2 }));
    w.q.push(A.tell(st.tell, -Math.PI / 2, -Math.PI / 2, { face: "back", fan: deg(20) }));
    w.q.push(A.walk(b, 372, 40, { face: "back", cone: -Math.PI / 2 }));
    w.q.push(A.walk(b, 120, 42, { face: "back", cone: -Math.PI / 2 }));
    w.q.push(A.walk(180, 112, 55, { face: "side" }));
  }
  const GEN = { ta: genTA, paper: genPaper, patrol: genPatrol };

  function startAct(w) {
    w.act = w.q.shift(); w.at = 0;
    const a = w.act;
    if (a.k === "walk") { const d = Math.hypot(a.to[0] - w.x, a.to[1] - w.y); a.dur = d / a.speed; a.from = [w.x, w.y]; }
    if (a.toCat) { const ac = angTo(w); a.a0 = a.a1 = ac; }
    if (a.k === "tell") { sound.play("hmm"); live(w.kind === "patrol" ? "안경 검사 펭귄이 돌아보려 해요" : w.kind === "paper" ? "부장 펭귄이 신문을 내리려 해요" : "조교 펭귄이 돌아보려 해요"); }
  }
  function stepWatcher(w, dt, st) {
    if (w.kind === "cctv") {
      const sp = deg(st.n === 4 ? 34 : 30);
      if (w.pause > 0) { w.pause -= dt; return; }
      w.ang += w.va * sp * dt;
      if (w.ang > w.hi) { w.ang = w.hi; w.va = -1; w.pause = 0.8; } else if (w.ang < w.lo) { w.ang = w.lo; w.va = 1; w.pause = 0.8; }
      return;
    }
    if (!w.act) { if (!w.q.length) GEN[w.kind](w, st); startAct(w); }
    const a = w.act; w.at += dt;
    const k = Math.min(1, w.at / Math.max(0.001, a.dur));
    w.walk = false; w.bubble = w.lock > 0 ? "!" : null; w.chalk = 0;
    if (a.k === "idle") { w.state = "off"; if (a.face) w.face = a.face; if (w.kind === "paper") w.paper = "read"; if (a.chalk) w.chalk = k; }
    else if (a.k === "rustle") { w.state = "off"; w.paper = "rustle"; }
    else if (a.k === "tell") { w.state = "tell"; w.face = a.face || (w.kind === "ta" ? "side" : w.face); w.dir = Math.cos(a.a0) >= 0 ? 1 : -1; if (w.kind === "paper") w.paper = "fold"; if (!w.bubble) w.bubble = "?"; }
    else if (a.k === "look") { w.state = "look"; w.ang = a.a0 + (a.a1 - a.a0) * k; w.look = w.ang; w.face = a.face || "front"; w.dir = Math.cos(w.ang) >= 0 ? 1 : -1; if (w.kind === "paper") w.paper = "down"; }
    else if (a.k === "walk") {
      w.x = a.from[0] + (a.to[0] - a.from[0]) * k; w.y = a.from[1] + (a.to[1] - a.from[1]) * k; w.walk = true;
      const dx = a.to[0] - a.from[0];
      w.face = a.face || "side"; if (Math.abs(dx) > 1) w.dir = dx > 0 ? 1 : -1;
      if (a.cone != null) { w.state = "look"; w.ang = a.cone; w.look = a.cone; } else w.state = "off";
    }
    if (w.lock > 0) { // 들킨 직후: 그 감독관은 냥이를 계속 봄
      w.lock -= dt; w.state = "look"; w.ang = angTo(w); w.look = w.ang; if (w.kind !== "patrol" || w.y < 300) w.face = "front"; if (w.kind === "paper") w.paper = "down";
    }
    if (w.at >= a.dur) w.act = null;
  }
  function coneOf(w) {
    const h = head(w);
    if (w.state === "look") return { x: h.x, y: h.y, ang: w.ang, half: w.half, range: w.range, w };
    if (w.state === "tell" && w.act) {
      const a = w.act;
      if (a.fan) return { x: h.x, y: h.y, ang: a.a0, half: a.fan + w.half, range: w.range, kind: "preview", w };
      if (a.toCat) return { x: h.x, y: h.y, ang: angTo(w), half: w.half, range: w.range, kind: "preview", w };
      return { x: h.x, y: h.y, ang: (a.a0 + a.a1) / 2, half: Math.abs(a.a1 - a.a0) / 2 + w.half, range: w.range, kind: "preview", w };
    }
    return null;
  }
  function inCone(c, px = CAT.x, py = CAT.y, r = CAT.r, margin = 0) {
    const dx = px - c.x, dy = py - c.y, d = Math.hypot(dx, dy);
    if (d > c.range + r) return false;
    return Math.abs(wrapA(Math.atan2(dy, dx) - c.ang)) <= c.half + Math.atan2(r, Math.max(1, d)) + margin;
  }
  function alarmAll() { // 전파 탐지기 경보: 감독관 모두 냥이 쪽으로(짧은 예고 뒤)
    G.watchers.forEach((w) => { if (w.kind === "ta" || w.kind === "paper") { w.q = []; w.act = null; w.q.push(A.tell(0.45, null, null, { toCat: true }), A.look(1.8, null, null, { toCat: true })); } });
  }

  // ---------- 문제 ----------
  const mkQ = (p) => { const order = shuffle([0, 1, 2]); return { q: p.q, opts: order.map((i) => p.a[i]), ci: order.indexOf(0), x: p.x, who: null }; };
  const makeQs = (st) => shuffle(POOL[st.pool]).slice(0, st.Q).map(mkQ);
  const WHO = { ai: "AI가 풀었다냥", self: "스스로 풀었다!", me: "직접 맞혔다!", wrong: "틀렸다…", miss: "시간 초과" };
  function showQ() {
    const q = G.qs[G.qi], st = stage();
    $(".sm-qn b").textContent = Math.min(G.qi + 1, st.Q); $(".sm-qn i").textContent = st.Q;
    $(".sm-who").textContent = ""; $(".sm-who").className = "sm-who";
    $(".sm-q").textContent = q ? q.q : "";
    choiceBtns.forEach((b, i) => { b.querySelector("span").textContent = q ? q.opts[i] : ""; b.disabled = !q; b.classList.remove("ok", "ng", "dim"); });
    $(".sm-fb").textContent = "";
    G.prog = 0; G.aiPart = 0; G.ai = { ph: 0, snap: 0, wait: 0 }; drawProg(); holdLabel();
  }
  function drawProg() {
    const p = Math.min(100, G.prog), ai = Math.min(p, G.aiPart);
    $(".sm-prog .s").style.width = (p - ai) + "%"; $(".sm-prog .a").style.width = ai + "%"; $(".sm-prog .a").style.left = (p - ai) + "%";
  }
  let lastLabel = "";
  function holdLabel() {
    const ph = G.ai.ph, key = ph + "|" + G.held;
    if (key === lastLabel) return; lastLabel = key;
    $(".sm-hold-t").textContent = ph === 0 ? (G.held ? "찰칵 찍는 중…" : "꾹: 시험지 찰칵") : ph === 1 ? "AI 답 만드는 중… 손 떼고 대기" : (G.held ? "힐끔 보는 중…" : "꾹: AI 답 힐끔");
    holdBtn.dataset.ph = ph;
    root.querySelectorAll(".sm-steps li").forEach((li) => li.classList.toggle("on", +li.dataset.p === ph));
  }
  function solve(who, chosen) {
    const q = G.qs[G.qi]; if (!q || q.who) return;
    q.who = who; G.seen.push(q);
    G.reveal = who === "wrong" ? 1.4 : 1.1;
    choiceBtns.forEach((b, i) => { b.disabled = true; b.classList.toggle("ok", i === q.ci); b.classList.toggle("ng", i === chosen && who === "wrong"); b.classList.toggle("dim", i !== q.ci && i !== chosen); });
    const wEl = $(".sm-who"); wEl.textContent = WHO[who]; wEl.className = "sm-who w-" + who;
    $(".sm-fb").textContent = (who === "wrong" ? `정답은 「${q.opts[q.ci]}」. ` : "") + q.x;
    if (who !== "wrong") { G.prog = 100; if (who === "me") G.aiPart = 0; drawProg(); }
    sound.play(who === "wrong" ? "wrong" : who === "me" ? "me" : "solve");
  }
  function choose(i) {
    if (G.mode === "probe") return probeAnswer(i);
    if (G.mode !== "play" || G.paused || G.reveal > 0) return;
    const q = G.qs[G.qi]; if (!q || q.who) return;
    solve(i === q.ci ? "me" : "wrong", i);
  }

  // ---------- HUD ----------
  let lastHud = "";
  function hud() {
    const st = stage(), left = Math.max(0, Math.ceil(st.T - G.t));
    const key = `${G.si}|${left}|${Math.round(G.sus)}|${G.hits}`;
    holdLabel();
    if (key === lastHud) return; lastHud = key;
    $(".sm-sn").textContent = `${st.n}/${STAGES.length}`; $(".sm-sname").textContent = st.name;
    const tm = $(".sm-time"); tm.querySelector("b").textContent = left; tm.classList.toggle("low", left <= 10);
    const s = Math.round(G.sus); $(".sm-sus-bar i").style.width = s + "%"; $(".sm-sus-n b").textContent = s;
    $(".sm-sus").dataset.lv = s >= 70 ? "3" : s >= 40 ? "2" : "1";
    $(".sm-hits b").textContent = G.hits;
  }
  function sndBtn() { const b = $(".sm-snd"); b.setAttribute("aria-pressed", String(D.sound)); b.setAttribute("aria-label", D.sound ? "소리 끄기" : "소리 켜기"); b.classList.toggle("off", !D.sound); }
  let liveT = 0;
  function live(msg) { const now = performance.now(); if (now - liveT < 1500) return; liveT = now; $(".sm-live").textContent = msg; }
  function toast(msg, kind = "") { const t = $(".sm-toast"); t.textContent = msg; t.className = "sm-toast go " + kind; G.toastT = 1.3; }

  // ---------- 진행 ----------
  function newRun() {
    sound.unlock();
    Object.assign(G, { si: 0, sus: 0, hits: 0, results: [], seen: [], probe: null, outcome: null, runT0: performance.now() });
    D.plays++; save();
    intro(0);
  }
  function intro(si) {
    G.si = si; const st = stage();
    G.mode = "intro"; G.paused = false; releaseHold();
    G.watchers = st.watch.map(makeWatcher).filter(Boolean);
    G.det = st.watch.includes("detector") ? { v: 0, alarm: 0 } : null;
    G.t = 0; G.stageHits = 0; G.qs = makeQs(st); G.qi = 0; G.reveal = 0; G.spotted = false; G.seenT = 0; G.flash = 0; G.busted = 0; G.hideLeft = 0; G.wasExp = false; G.cones = []; G.steps = null;
    if (si > 0) G.sus = Math.max(0, G.sus - 20);
    $(".sm-tool").textContent = st.tool.name; scr.dataset.tool = st.tool.id; scr.dataset.stage = st.n;
    lastHud = ""; lastLabel = ""; hud(); showQ();
    const prevTools = STAGES.slice(0, si).map((s) => s.tool.name);
    openOv(`<div class="sm-card sm-intro"><p class="sm-kicker">${st.n}단계 · ${esc(st.place)}</p><h3>${esc(st.name)}</h3>
<p class="sm-meta">${st.Q}문제 · 제한 ${st.T}초</p>
<div class="sm-new"><p class="sm-tag t-watch">새 감시</p><p><b>${esc(st.newWatch.name)}</b><br>${esc(st.newWatch.desc)}</p></div>
<div class="sm-new"><p class="sm-tag t-ai">새 AI 도구</p><p><b>${esc(st.tool.name)}</b><br>${esc(st.tool.desc)}${prevTools.length ? `<br><small>이전 도구(${esc(prevTools.join(", "))})는 압수됐어요.</small>` : ""}</p></div>
<div class="sm-btns"><button type="button" class="sm-btn" data-act="go" data-focus>시험 시작</button></div>
<p class="sm-note">노란 점선 = 곧 볼 곳 · 빨간 부채꼴 = 지금 보는 곳</p></div>`, "intro");
  }
  function beginStage() { closeOv(); sound.unlock(); G.mode = "play"; G.paused = false; lastTs = 0; toast(`${stage().name} 시작!`); }
  function stageSummary(st, extra = {}) {
    const c = (w) => G.qs.filter((q) => q.who === w).length;
    const correct = c("ai") + c("self") + c("me");
    return Object.assign({ n: st.n, name: st.name, Q: st.Q, correct, score: Math.round((correct / st.Q) * 100), ai: c("ai"), self: c("self"), me: c("me"), wrong: c("wrong"), miss: c("miss"), hits: G.stageHits, sus: Math.round(G.sus), time: Math.round(G.t * 10) / 10 }, extra);
  }
  function endStage(reason) {
    const st = stage();
    G.qs.forEach((q) => { if (!q.who) q.who = "miss"; });
    const r = stageSummary(st, { early: reason === "done" });
    G.results.push(r);
    G.mode = "result"; releaseHold(); sound.play("stage");
    const last = G.si === STAGES.length - 1;
    openOv(`<div class="sm-card sm-res"><p class="sm-kicker">${st.n}단계 결과${r.early ? " · 다 풀고 제출" : " · 시간 종료"}</p><h3>${esc(st.name)} <span class="sm-big">${r.score}점</span></h3>
<ul class="sm-stats"><li><b>${r.ai}</b>AI가 푼 문제</li><li><b>${r.self}</b>스스로 푼 문제</li><li><b>${r.me}</b>직접 맞힌 문제</li><li><b>${r.wrong + r.miss}</b>틀림·못 품</li></ul>
<p class="sm-meta">이번 단계 들킴 ${r.hits}회 · 남은 의심 ${r.sus}%${last ? "" : ` → 다음 단계 시작 때 ${Math.max(0, r.sus - 20)}%`}</p>
<div class="sm-btns"><button type="button" class="sm-btn" data-act="${last ? "judge" : "next"}" data-focus>${last ? "채점 결과 보기" : "다음 단계로"}</button></div></div>`, "result");
  }
  function caught() {
    const st = stage();
    G.mode = "caught"; releaseHold(); sound.play("caught");
    G.qs.forEach((q) => { if (!q.who) q.who = "miss"; });
    G.results.push(stageSummary(st, { out: true, sus: 100 }));
    toast("부정행위 적발! 퇴장!", "bad");
    const e = ENDINGS.find((x) => x.kind === "out" && x.stage === st.n);
    setTimeout(() => finish(e, { out: true }), 900 / SPEED);
  }
  const totals = () => { const R = G.results; const sum = (k) => R.reduce((n, r) => n + (r[k] || 0), 0); const solved = sum("ai") + sum("self") + sum("me"); return { final: Math.round(sum("score") / STAGES.length), ai: sum("ai"), self: sum("self"), me: sum("me"), aiShare: solved ? sum("ai") / solved : 0 }; };

  // ---------- 채점 → 사후 조사(너무 잘 보면) ----------
  function judge() {
    const T = totals();
    if (T.final < PROBE.from) return finishRun(null);
    const inv0 = Math.min(85, Math.round(PROBE.base + T.aiShare * PROBE.perAi + (T.final >= 95 ? PROBE.perfect : 0) + G.hits * PROBE.hit));
    const order = { ai: 0, self: 1, wrong: 2, miss: 2, me: 3 };
    let list = shuffle(G.seen).sort((a, b) => order[a.who] - order[b.who]).slice(0, PROBE.n);
    if (list.length < PROBE.n) list = list.concat(shuffle(POOL.s4).slice(0, PROBE.n - list.length).map((p) => Object.assign(mkQ(p), { who: "miss" })));
    list = list.map((q) => { const o = shuffle([0, 1, 2]); return { q: q.q, opts: o.map((i) => q.opts[i]), ci: o.indexOf(q.ci), x: q.x, was: q.who }; });
    G.probe = { list, i: 0, right: 0, inv: inv0, inv0, lock: false };
    G.mode = "probe";
    probeShow(true);
  }
  function probeShow(first) {
    const P = G.probe, q = P.list[P.i], T = totals();
    openOv(`<div class="sm-card sm-probe"><p class="sm-kicker">사후 조사 · 질문 ${P.i + 1}/${P.list.length}</p>
${first ? `<h3>너무 잘 봤는데?</h3><p class="sm-story">총점 ${T.final}점. 시험장에서는 아무도 못 봤지만, 점수가 너무 좋아서 조사관이 불렀어요.<br>AI는 압수. 시험에 나온 문제를 직접 설명해 보세요.</p>` : ""}
<div class="sm-inv" data-hot="${P.inv >= PROBE.limit - 15 ? 1 : 0}"><span>조사 게이지</span><span class="sm-inv-bar"><i style="width:${P.inv}%"></i><em style="left:${PROBE.limit}%" aria-hidden="true"></em></span><b>${P.inv}%</b></div>
<p class="sm-note">맞히면 내려가고 틀리면 올라가요. 틀렸을 때나 마지막에 ${PROBE.limit}% 이상이면 들통. 시험 때 AI로 푼 문제가 많을수록 높게 시작해요.</p>
<p class="sm-epq">조사관: 「${esc(q.q)}」</p>
<div class="sm-ch sm-epch">${q.opts.map((o, i) => `<button type="button" class="sm-c" data-probe="${i}"${i === 0 ? " data-focus" : ""}><b>${i + 1}</b><span>${esc(o)}</span></button>`).join("")}</div>
<p class="sm-fb sm-epfb" aria-live="polite">${q.was === "ai" ? "시험 때 AI가 대신 풀었던 문제예요." : q.was === "me" ? "시험 때 직접 맞힌 문제예요." : q.was === "self" ? "시험 때 끙끙 풀었던 문제예요." : "시험에서 놓친 문제예요."}</p></div>`, "probe");
    P.lock = false;
  }
  function probeAnswer(i) {
    const P = G.probe; if (!P || P.lock) return;
    P.lock = true;
    const q = P.list[P.i], ok = i === q.ci;
    if (ok) P.right++;
    P.inv = Math.max(0, Math.min(100, P.inv + (ok ? PROBE.right : PROBE.wrong)));
    ov.querySelectorAll("[data-probe]").forEach((b, k) => { b.disabled = true; b.classList.toggle("ok", k === q.ci); b.classList.toggle("ng", k === i && !ok); b.classList.toggle("dim", k !== q.ci && k !== i); });
    ov.querySelector(".sm-epfb").textContent = (ok ? "술술 설명했다! " : `말문이 막혔다… 정답은 「${q.opts[q.ci]}」. `) + q.x;
    const bar = ov.querySelector(".sm-inv-bar i"); if (bar) bar.style.width = P.inv + "%"; const bn = ov.querySelector(".sm-inv b"); if (bn) bn.textContent = P.inv + "%";
    sound.play(ok ? "me" : "wrong");
    setTimeout(() => { if (!ok && P.inv >= PROBE.limit) return finishRun(P); P.i++; if (P.i < P.list.length) probeShow(false); else finishRun(P); }, (ok ? 1300 : 1900) / SPEED);
  }
  function finishRun(P) {
    const T = totals();
    let id;
    if (P) id = P.inv >= PROBE.limit ? "probe" : T.aiShare <= 0.3 && P.right === P.list.length ? "true" : "hollow";
    else if (T.aiShare <= 0.15) id = T.final >= 60 ? "self" : "retry";
    else id = T.final >= 60 ? "pass" : "nerve";
    finish(ENDINGS.find((e) => e.id === id), { probe: P ? { inv: P.inv, inv0: P.inv0, right: P.right, n: P.list.length } : null, caughtLate: id === "probe" });
  }
  function gradeOf(o) {
    if (o.out || o.caughtLate) return "F";
    const p = o.final * 0.7 + (1 - o.aiShare) * 30; // 점수 70% + 스스로 푼 비율 30%
    return p >= 92 ? "S" : p >= 80 ? "A" : p >= 65 ? "B" : p >= 45 ? "C" : "D";
  }
  function finish(e, o) {
    Object.assign(o, totals());
    o.grade = gradeOf(o); o.pts = o.out || o.caughtLate ? 0 : Math.round(o.final * 0.7 + (1 - o.aiShare) * 30);
    o.hits = G.hits; o.sus = Math.round(G.sus); o.sec = Math.round((performance.now() - G.runT0) / 1000);
    const firstSeen = !D.endings[e.id];
    D.endings[e.id] = (D.endings[e.id] || 0) + 1;
    let newBest = false;
    if (o.pts > 0 && (!D.best || o.pts > D.best.pts)) { D.best = { pts: o.pts, final: o.final, grade: o.grade, ending: e.id }; newBest = true; }
    save();
    G.outcome = { e, o, firstSeen, newBest };
    G.mode = "end"; releaseHold();
    if (!o.out && !o.caughtLate) sound.play("end"); else if (o.caughtLate) sound.play("caught");
    endScreen();
  }
  function endScreen() {
    const { e, o, firstSeen, newBest } = G.outcome, R = G.results;
    const rows = STAGES.map((s, i) => { const r = R[i]; return `<tr><th scope="row">${s.n}. ${esc(s.name)}</th><td>${r ? (r.out ? "퇴장" : r.score + "점") : "—"}</td><td>${r ? r.hits : "—"}</td><td>${r ? r.sus + "%" : "—"}</td></tr>`; }).join("");
    const nE = Object.keys(D.endings).length;
    const sub = o.out ? "시험 중 부정행위로 퇴장" : o.caughtLate ? `총점 ${o.final}점 → 사후 조사에서 들통` : `총점 ${o.final}점 · 스스로 푼 비율 ${Math.round((1 - o.aiShare) * 100)}%`;
    openOv(`<div class="sm-card sm-end"><canvas class="sm-art" data-w="360" data-h="230" aria-hidden="true"></canvas>
<p class="sm-kicker">${e.kind === "out" ? "엔딩 · 퇴장" : e.kind === "probe" ? "엔딩 · 사후 조사" : "엔딩"}${firstSeen ? ' <em class="sm-newe">NEW</em>' : ""}</p><h3>${esc(e.name)}</h3>
<p class="sm-story">${br(e.text)}</p><p class="sm-msg">${esc(e.msg)}</p>
<div class="sm-grade"><span class="sm-g g-${o.grade}">${o.grade}</span><span><small>칭호</small><b>${esc(e.title)}</b><small>${esc(sub)}${newBest ? " · 최고 기록!" : ""}</small></span></div>
${o.probe ? `<p class="sm-meta">사후 조사: 시작 ${o.probe.inv0}% → 끝 ${o.probe.inv}% · 설명 성공 ${o.probe.right}/${o.probe.n}</p>` : ""}
<div class="table-wrap"><table class="sm-tbl"><thead><tr><th scope="col">단계</th><th scope="col">점수</th><th scope="col">들킴</th><th scope="col">의심</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="sm-meta">AI ${o.ai}문제 · 스스로 ${o.self}문제 · 직접 ${o.me}문제 · 들킴 합계 ${o.hits}회 · 플레이 ${Math.floor(o.sec / 60)}분 ${o.sec % 60}초</p>
${D.best ? `<p class="sm-meta">이 기기 최고 기록: ${D.best.grade}등급 · ${D.best.pts}점(총점 ${D.best.final})</p>` : ""}
<div class="sm-btns"><button type="button" class="sm-btn" data-act="again" data-focus>다시 도전</button><div class="sm-row"><button type="button" class="sm-btn ghost" data-act="share">결과 카드</button><button type="button" class="sm-btn ghost" data-act="book">엔딩 도감 ${nE}/${ENDINGS.length}</button></div></div>
<p class="sm-note">AI 시험 부정행위 논란을 풍자한 가상의 게임이에요. 실존 인물과 무관하며, 실제 시험에서 부정행위는 하지 마세요.</p></div>`, "end");
    setArt("end", e);
  }

  // ---------- 오버레이 ----------
  function openOv(html, cls = "") {
    ov.className = "sm-ov " + cls; ov.innerHTML = html; ov.hidden = false; ov.scrollTop = 0;
    ovArt = ov.querySelector("canvas.sm-art"); ovArtKind = null;
    if (ovArt) fitCanvas(ovArt, +ovArt.dataset.w, +ovArt.dataset.h);
    const b = ov.querySelector("[data-focus]") || ov.querySelector("button"); if (b) b.focus({ preventScroll: true });
  }
  function closeOv() { ov.hidden = true; ov.innerHTML = ""; ovArt = null; }
  function setArt(kind, e) { ovArtKind = kind; ovArtE = e; }
  function titleScreen() {
    G.mode = "title"; G.paused = false; releaseHold();
    const nE = Object.keys(D.endings).length;
    openOv(`<div class="sm-card sm-title"><canvas class="sm-art" data-w="360" data-h="300" aria-hidden="true"></canvas>
<p class="sm-kicker">AI 시험 부정행위 풍자 게임 · 4단계 · 5분 이내</p><h2 class="sm-logo">${esc(NAME)}</h2><p class="sm-subt">${esc(SUB)}</p>
<ol class="sm-rules"><li><b>가만히 있으면</b> 냥이가 스스로 천천히 풀어요. <em>안전</em></li><li><b>AI는 3단계:</b> 꾹 눌러 찰칵 → 손 떼고 대기 → 다시 꾹 눌러 힐끔. <em class="r">빠르지만 위험</em></li><li><b>노란 점선</b>은 곧 볼 곳, <b>빨간 부채꼴</b>은 지금 보는 곳. 그 안에서 찰칵·힐끔하면 의심이 차요. <b>너무 잘 봐도</b> 사후 조사!</li></ol>
<p class="sm-note">답을 알면 보기를 직접 눌러도 돼요. 휴대폰은 아래 버튼을 꾹, PC는 Space를 꾹.</p>
<div class="sm-btns"><button type="button" class="sm-btn" data-act="start" data-focus>시험 보러 가기</button><button type="button" class="sm-btn ghost" data-act="book">엔딩 도감 ${nE}/${ENDINGS.length}</button></div>
${D.best ? `<p class="sm-meta">이 기기 최고 기록: ${D.best.grade}등급 · ${D.best.pts}점</p>` : ""}
<p class="sm-note">소리 나요(오른쪽 위에서 끄기) · 실존 인물과 무관한 가상의 이야기이고, AI 도구도 모두 지어낸 물건이에요.</p></div>`, "title");
    setArt("title");
    $(".sm-sname").textContent = "대기 중"; $(".sm-sn").textContent = `0/${STAGES.length}`;
  }
  function book() {
    G.bookPrev = G.mode; G.mode = "book";
    openOv(`<div class="sm-card sm-book"><div class="sm-bhead"><h3>엔딩 도감 <small>${Object.keys(D.endings).length}/${ENDINGS.length}</small></h3><button type="button" class="sm-btn ghost sm-x" data-act="bookclose" data-focus>닫기</button></div>
<ol class="sm-blist">${ENDINGS.map((e) => { const c = D.endings[e.id]; return `<li class="${c ? "got" : ""}"><b>${c ? esc(e.name) : "???"}</b><small>${c ? `${esc(e.title)} · ${c}회` : e.kind === "out" ? `${e.stage}단계에서 들키면…` : e.kind === "probe" ? "너무 잘 보면…" : "끝까지 가면 볼 수 있어요"}</small></li>`; }).join("")}</ol>
<p class="sm-note">기록은 이 기기 브라우저에만 저장돼요. <button type="button" class="sm-link" data-act="reset">기록 지우기</button></p></div>`, "book");
  }
  function bookClose() { if (G.bookPrev === "end" && G.outcome) { G.mode = "end"; endScreen(); } else titleScreen(); }
  function pauseGame(why) {
    if (G.mode !== "play" || G.paused) return;
    G.paused = true; releaseHold();
    openOv(`<div class="sm-card sm-pause-c"><p class="sm-kicker">${why ? esc(why) : "일시정지"}</p><h3>잠깐 멈췄어요</h3><p class="sm-meta">${esc(stage().name)} · 남은 ${Math.max(0, Math.ceil(stage().T - G.t))}초 · 의심 ${Math.round(G.sus)}%</p>
<div class="sm-btns"><button type="button" class="sm-btn" data-act="resume" data-focus>계속하기</button><button type="button" class="sm-btn ghost" data-act="quit">처음 화면으로</button></div></div>`, "pause");
  }
  function resume() { closeOv(); G.paused = false; lastTs = 0; }

  // ---------- 결과 카드(9:16) ----------
  async function makeCard() {
    const { e, o } = G.outcome;
    const Wc = 720, Hc = 1280, c = document.createElement("canvas"); c.width = Wc; c.height = Hc;
    const x = c.getContext("2d");
    try { await document.fonts.load('40px "Black Han Sans"'); } catch (er) {}
    const DISP = `"Black Han Sans", ${SM.FONT}`;
    const bad = e.kind !== "end";
    const g = x.createLinearGradient(0, 0, 0, Hc); g.addColorStop(0, "#fff4df"); g.addColorStop(1, bad ? "#ffb4aa" : "#ffd86b"); x.fillStyle = g; x.fillRect(0, 0, Wc, Hc);
    const T = (s, X, Y, size, col, font = SM.FONT, weight = 800) => { x.font = `${weight} ${size}px ${font}`; x.textAlign = "center"; x.textBaseline = "top"; x.fillStyle = col; x.fillText(s, X, Y); };
    T(NAME, Wc / 2, 60, 92, "#141414", DISP, 400);
    T(SUB, Wc / 2, 168, 34, "#c2281d");
    x.save(); art.rr(x, 40, 236, 640, 408, 28); x.clip(); x.translate(40, 236); x.scale(640 / 360, 640 / 360); art.ending(x, e, 1.2, 360, 230); x.restore();
    x.lineWidth = 6; x.strokeStyle = "#141414"; art.rr(x, 40, 236, 640, 408, 28); x.stroke();
    T(e.kind === "out" ? "엔딩 · 퇴장" : e.kind === "probe" ? "엔딩 · 사후 조사" : "엔딩", Wc / 2, 676, 30, "#555");
    T(e.name, Wc / 2, 718, e.name.length > 10 ? 56 : 66, "#141414", DISP, 400);
    x.fillStyle = o.grade === "F" ? "#c2281d" : "#141414"; art.ell(x, 150, 900, 70, 70); x.fill();
    T(o.grade, 150, 852, 92, "#ffc21a", DISP, 400);
    const L = (s, Y, size, col, w = 800) => { x.font = `${w} ${size}px ${SM.FONT}`; x.textAlign = "left"; x.textBaseline = "top"; x.fillStyle = col; x.fillText(s, 250, Y); };
    L("칭호", 838, 26, "#555"); L(e.title, 872, 40, "#141414", 900);
    L(o.out ? "시험 중 퇴장" : o.caughtLate ? `총점 ${o.final}점 → 사후 조사 들통` : `총점 ${o.final}점 · 스스로 ${Math.round((1 - o.aiShare) * 100)}%`, 926, 30, "#3d3d3d");
    T(`AI ${o.ai}문제 · 스스로 ${o.self}문제 · 직접 ${o.me}문제 · 들킴 ${o.hits}회`, Wc / 2, 1010, 28, "#3d3d3d");
    x.font = `800 32px ${SM.FONT}`;
    const lines = []; let line = ""; for (const ch of e.msg) { const tl = line + ch; if (x.measureText(tl).width > 600 && line) { lines.push(line); line = ch; } else line = tl; } if (line) lines.push(line);
    lines.slice(0, 2).forEach((l, i) => T(l, Wc / 2, 1064 + i * 44, 32, "#141414"));
    const site = document.documentElement.dataset.site || "펭귄 툴즈";
    T(`${site} · 오락실 · 실존 인물과 무관한 풍자 게임`, Wc / 2, 1196, 26, "#555");
    return c;
  }
  async function shareCard() {
    const c = await makeCard(); const url = c.toDataURL("image/png");
    const { e } = G.outcome;
    const fn = `${SM.SLUG}-${e.id}`; // P2-72 「파일 이름」 칸(저장 창이 되는 PC는 창에서도 정함)
    G.mode = "share";
    openOv(`<div class="sm-card sm-share fname-scope"><img src="${url}" alt="${esc(NAME)} 결과 카드 미리보기" width="216" height="384">${window.NALGI && NALGI.nameFieldHtml ? NALGI.nameFieldHtml({ def: fn, ext: "png", id: "sm-fname" }) : ""}<div class="sm-btns"><a class="sm-btn" href="${url}" download="${fn}.png" data-dl data-dl-for="sm-fname" data-dl-ext="png" data-focus>이미지 저장</a><button type="button" class="sm-btn ghost" data-act="sys-share" hidden>공유하기</button><button type="button" class="sm-btn ghost" data-act="shareback">돌아가기</button></div><p class="fname-status sm-note" aria-live="polite"></p><p class="sm-note">카드에는 이름 같은 개인정보가 들어가지 않아요.</p></div>`, "share");
    const sb = ov.querySelector('[data-act="sys-share"]');
    c.toBlob((blob) => {
      if (!blob) return;
      if (window.NALGI && NALGI.bindBlob) NALGI.bindBlob(ov.querySelector("a[data-dl]"), blob);
      const file = new File([blob], `${SM.SLUG}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { sb.hidden = false; sb.onclick = () => navigator.share({ files: [file], title: NAME, text: `${NAME} 엔딩 「${e.name}」` }).catch(() => {}); }
    }, "image/png");
  }

  // ---------- 입력 ----------
  function pressHold() {
    if (G.mode !== "play" || G.paused) return;
    if (!G.held) { G.held = true; G.holdT = 0; holdBtn.classList.add("on"); scr.classList.add("using"); }
  }
  function releaseHold() {
    G.held = false; G.holdT = 0; holdBtn.classList.remove("on"); scr.classList.remove("using"); sound.typingOn(false);
  }
  [holdBtn, cv].forEach((el) => {
    el.addEventListener("pointerdown", (e) => { if (e.button > 0) return; e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (er) {} pressHold(); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((n) => el.addEventListener(n, () => releaseHold()));
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  });
  choiceBtns.forEach((b) => b.addEventListener("click", () => choose(+b.dataset.c)));
  root.addEventListener("click", (e) => {
    const pb = e.target.closest("[data-probe]"); if (pb) { probeAnswer(+pb.dataset.probe); return; }
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a !== "sys-share") sound.play("click");
    if (a === "start" || a === "again") newRun();
    else if (a === "go") beginStage();
    else if (a === "next") intro(G.si + 1);
    else if (a === "judge") judge();
    else if (a === "resume") resume();
    else if (a === "quit") titleScreen();
    else if (a === "share") shareCard();
    else if (a === "shareback") { G.mode = "end"; endScreen(); }
    else if (a === "book") book();
    else if (a === "bookclose") bookClose();
    else if (a === "reset") { if (confirm(`${NAME} 기록(최고 기록·엔딩 도감)을 모두 지울까요?`)) { D.best = null; D.endings = {}; D.plays = 0; save(); book(); } }
  });
  $(".sm-snd").addEventListener("click", (e) => { e.stopPropagation(); D.sound = !D.sound; save(); sound.setOn(D.sound); if (D.sound) sound.unlock(); sndBtn(); });
  $(".sm-pause").addEventListener("click", (e) => { e.stopPropagation(); if (G.mode === "play") { if (G.paused) resume(); else pauseGame(); } });
  const inView = () => { const r = scr.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input,textarea,select")) return;
    if (!inView()) return;
    const k = e.key;
    if (G.mode === "play" && !G.paused) {
      if (k === " " || k === "Spacebar") { e.preventDefault(); if (!e.repeat) pressHold(); return; }
      if (k === "1" || k === "2" || k === "3") { e.preventDefault(); choose(+k - 1); return; }
      if (k === "p" || k === "P" || k === "Escape") { e.preventDefault(); pauseGame(); return; }
    } else if (G.mode === "probe" && (k === "1" || k === "2" || k === "3")) { e.preventDefault(); probeAnswer(+k - 1); }
    else if (G.mode === "book" && k === "Escape") { e.preventDefault(); bookClose(); }
  });
  document.addEventListener("keyup", (e) => { if ((e.key === " " || e.key === "Spacebar") && G.held) { e.preventDefault(); releaseHold(); } });
  // 탭 숨김·창 전환·창 너비 변경 → 일시정지(휴대폰 주소창이 접히며 높이만 바뀌는 것은 무시)
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseGame("탭을 벗어나서 멈췄어요"); });
  window.addEventListener("blur", () => { if (!DEBUG) pauseGame("창을 벗어나서 멈췄어요"); else releaseHold(); });
  let lastW = innerWidth;
  window.addEventListener("resize", () => { if (Math.abs(innerWidth - lastW) > 1) { lastW = innerWidth; pauseGame("화면 크기가 바뀌어서 멈췄어요"); } fitAll(); });

  // ---------- 한 프레임 ----------
  function update(dt) {
    const st = stage(), tl = st.tool;
    if (G.toastT > 0) { G.toastT -= dt; if (G.toastT <= 0) $(".sm-toast").className = "sm-toast"; }
    G.flash = Math.max(0, G.flash - dt * 2.5); G.busted = Math.max(0, G.busted - dt * 1.6);
    if (bot) botStep(dt);
    if (G.held) G.holdT += dt;
    // AI 3단계: 0 찍기(꾹) → 1 AI가 답 만드는 중(숨긴 채 대기) → 2 힐끔(꾹)
    const ai = G.ai, open = G.reveal <= 0;
    let snapping = false, peeking = false;
    if (open) {
      if (ai.ph === 0) { if (G.held) { snapping = true; ai.snap += dt / tl.snap; if (ai.snap >= 1) { ai.ph = 1; ai.wait = tl.wait; ai.snap = 0; sound.play("snap"); } } else ai.snap = 0; }
      else if (ai.ph === 1) { ai.wait -= dt; if (ai.wait <= 0) { ai.ph = 2; sound.play("ready"); toast("AI 답 도착! 꾹 눌러 힐끔"); } }
      else if (ai.ph === 2 && G.held) peeking = true;
    }
    const raw = snapping || peeking;
    if (G.wasExp && !raw) G.hideLeft = tl.hide;
    G.wasExp = raw;
    if (!raw && G.hideLeft > 0) G.hideLeft -= dt;
    const exposed = raw || G.hideLeft > 0;
    sound.typingOn(peeking);
    G.watchers.forEach((w) => stepWatcher(w, dt, st));
    // 전파 탐지기
    if (G.det) {
      if (G.det.alarm > 0) G.det.alarm -= dt;
      if (raw) G.det.v += 38 * dt; else if (ai.ph === 1 && open) G.det.v += 15 * dt; else G.det.v = Math.max(0, G.det.v - 30 * dt);
      if (G.det.v >= 100) { G.det.v = 0; G.det.alarm = 2.2; G.sus = Math.min(100, G.sus + 12); alarmAll(); sound.play("alarm"); toast("전파 탐지기 경보! 모두 돌아본다", "bad"); live("전파 탐지기 경보! 모두 돌아봐요"); }
    }
    // 시선 판정
    const cones = G.watchers.map(coneOf).filter(Boolean);
    let seenBy = null;
    if (exposed) for (const c of cones) if (!c.kind && inCone(c)) { seenBy = c.w; c.hot = true; break; }
    if (seenBy) {
      G.seenT += dt;
      if (!G.spotted && G.seenT >= 0.12) {
        G.spotted = true; G.hits++; G.stageHits++; G.sus = Math.min(100, G.sus + 15); G.flash = 1; G.busted = 1;
        if (seenBy.kind !== "cctv") seenBy.lock = 1.2;
        sound.play("busted"); toast(seenBy.kind === "cctv" ? "CCTV에 찍혔다! 의심 +15" : "들켰다! 의심 +15", "bad"); live("들켰어요! 의심이 올라가요");
      }
      if (G.spotted) G.sus = Math.min(100, G.sus + 40 * dt);
    } else {
      G.seenT = 0;
      if (G.spotted) { G.spotCool += dt; if (G.spotCool > 0.8) { G.spotted = false; G.spotCool = 0; } }
      G.sus = Math.max(0, G.sus - 3 * dt);
    }
    G.cones = cones; G.snapping = snapping; G.peeking = peeking; G.exposed = exposed;
    // 발소리(안경 검사 펭귄)
    const pt = G.watchers.find((w) => w.kind === "patrol");
    G.steps = null;
    if (pt && pt.walk) {
      const d = Math.hypot(pt.x - CAT.x, pt.y - CAT.y), near = Math.max(0, 1 - d / 170);
      if (pt.y > 230) G.steps = { x: pt.x, near };
      G.stepT -= dt; if (G.stepT <= 0) { G.stepT = 0.42; if (near > 0.05) sound.play("step", 0.3 + near * 0.9); }
    }
    if (G.sus >= 100) { caught(); return; }
    // 풀이 진행: 힐끔 보는 동안은 AI 속도, 찍는 동안은 멈춤, 그 밖(대기 중 포함)은 스스로 푸는 속도
    if (G.reveal > 0) { G.reveal -= dt; if (G.reveal <= 0) { G.qi++; if (G.qi >= G.qs.length) { endStage("done"); return; } showQ(); } }
    else {
      const rate = peeking ? tl.rate : snapping ? 0 : st.self;
      G.prog += rate * dt; if (peeking) G.aiPart += rate * dt;
      if (G.prog >= 100) solve(G.aiPart > 50 ? "ai" : "self"); else drawProg();
    }
    G.t += dt;
    if (G.t >= st.T && G.mode === "play") { endStage("time"); return; }
    hud();
  }
  function draw(t) {
    const st = stage();
    const pose = G.busted > 0.3 ? "busted" : G.peeking || (G.exposed && !G.snapping) ? "ai" : G.reveal > 0 ? "idle" : "write";
    const ta = G.watchers.find((w) => w.kind === "ta");
    const cam = G.watchers.find((w) => w.kind === "cctv");
    const watchers = G.watchers.filter((w) => w.kind !== "cctv").map((w) => ({ ...w, t }));
    const cones = (G.cones || []).map((c) => ({ ...c, w: null }));
    if (cam) { const ac = Math.atan2(CAT.y - cam.y, CAT.x - cam.x); cam.warn = Math.abs(wrapA(cam.ang - ac)) < deg(26); }
    art.scene(ctx, {
      t, theme: st.theme, boardTitle: st.name, boardSub: st.board, chalk: ta ? ta.chalk : 0, sleepy: st.watch.includes("sleepy"),
      timeFrac: 1 - G.t / st.T, watchers, cones,
      cat: { pose, tool: st.tool.id, exposed: !!(G.peeking || (G.exposed && !G.snapping)), using: !!G.peeking, busted: G.busted, sweat: G.sus / 100, snap: G.snapping ? Math.max(0.05, Math.min(1, G.ai.snap)) : 0, wait: G.ai.ph === 1 ? Math.max(0, G.ai.wait / st.tool.wait) : 0 },
      detector: G.det, steps: G.steps, cctv: cam ? { x: cam.x, y: cam.y, ang: cam.ang, warn: cam.warn } : null, flash: G.flash, alarm: G.det && G.det.alarm > 0,
    });
  }
  function drawOvArt(t) {
    if (!ovArt || !ovArtKind) return;
    const r = ovArt.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    const x = ovArt.getContext("2d"), w = +ovArt.dataset.w, h = +ovArt.dataset.h;
    x.save(); x.beginPath(); x.rect(0, 0, w, h); x.clip();
    if (ovArtKind === "title") art.title(x, t); else if (ovArtKind === "end" && ovArtE) art.ending(x, ovArtE, t, w, h);
    x.restore();
  }
  let lastTs = 0, lastDraw = 0, vis = true;
  if ("IntersectionObserver" in window) new IntersectionObserver((es) => { vis = es[0].isIntersecting; }, { rootMargin: "80px" }).observe(scr);
  function frame(ts) {
    requestAnimationFrame(frame);
    const dtR = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0; lastTs = ts;
    const t = ts / 1000;
    if (G.mode === "play" && !G.paused) {
      const total = dtR * SPEED, n = Math.max(1, Math.ceil(SPEED));
      for (let i = 0; i < n && G.mode === "play"; i++) update(total / n);
    }
    if (!vis) return;
    if (ts - lastDraw < 30) return; lastDraw = ts;
    if (G.mode === "play" || G.mode === "intro" || G.mode === "result" || G.mode === "caught") draw(t);
    drawOvArt(t);
  }

  // ---------- 시작 ----------
  let bot = null;
  fitAll();
  sndBtn();
  G.si = 0; G.watchers = [makeWatcher("ta")]; G.qs = makeQs(STAGES[0]); showQ(); hud();
  draw(0);
  titleScreen();
  root.classList.add("ready");
  requestAnimationFrame(frame);

  // ---------- 디버그·자동 플레이(localhost + ?debug=1 일 때만) ----------
  function botStep(dt) {
    let danger = false;
    if (bot.mode === "honest") danger = true;
    else if (bot.mode !== "reckless") {
      for (const w of G.watchers) {
        if (w.kind === "cctv") { const h = head(w); const d = Math.hypot(CAT.x - h.x, CAT.y - h.y); const ac = Math.atan2(CAT.y - h.y, CAT.x - h.x); if (Math.abs(wrapA(w.ang - ac)) < w.half + Math.atan2(CAT.r, d) + deg(bot.margin)) danger = true; continue; }
        const c = coneOf(w);
        if (c && inCone(c, CAT.x, CAT.y, CAT.r, deg(6))) danger = true;
        if (w.state === "look" && w.act && w.act.k === "look") { const a1 = w.act.a1, h = head(w); if (inCone({ x: h.x, y: h.y, ang: (w.ang + a1) / 2, half: Math.abs(a1 - w.ang) / 2 + w.half, range: w.range }, CAT.x, CAT.y, CAT.r, deg(6))) danger = true; } // 쓸고 지나갈 곳
        if (w.kind === "patrol" && w.y > 290 && w.act && w.act.k === "walk" && w.act.cone === Math.PI / 2) danger = true; // 곧 뒤에서 돌아섬
      }
      if (G.det && G.det.v > 55) bot.detHold = true;
      if (G.det && bot.detHold) { if (G.det.v < 8) bot.detHold = false; else danger = true; }
      if (G.reveal > 0 || G.ai.ph === 1) danger = true; // 대기 중에는 손 뗌
    }
    if (danger) { bot.safeT = 0; bot.dT += dt; if (bot.dT >= bot.react && G.held) releaseHold(); } // 사람처럼 늦게 반응
    else { bot.dT = 0; bot.safeT += dt; if (!G.held && bot.safeT > 0.15) pressHold(); }
  }
  if (DEBUG) {
    const idle = async (pred, limit = 600000) => { const t0 = Date.now(); while (!pred()) { if (Date.now() - t0 > limit) return false; await new Promise((r) => setTimeout(r, 20)); } return true; };
    window.EXCAT_DEBUG = {
      speed(v) { SPEED = v; },
      bot(mode = "smart", opt = {}) { bot = mode ? { mode, react: opt.react == null ? 0.25 : opt.react, margin: opt.margin == null ? 10 : opt.margin, dT: 0, safeT: 0, detHold: false } : null; },
      state: () => ({ mode: G.mode, paused: G.paused, si: G.si, t: G.t, sus: G.sus, hits: G.hits, qi: G.qi, prog: G.prog, held: G.held, ph: G.ai.ph, results: G.results, outcome: G.outcome && { id: G.outcome.e.id, ...G.outcome.o }, sound: sound.state }),
      // 자동으로 끝까지. probe: right|wrong
      async run({ probe = "right", read = 300 } = {}) {
        const click = async (sel) => { await new Promise((r) => setTimeout(r, read)); const b = ov.querySelector(sel); if (b) b.click(); };
        if (G.mode === "title" || G.mode === "end") await click('[data-act="start"],[data-act="again"]');
        for (;;) {
          await idle(() => ["intro", "result", "probe", "end"].includes(G.mode) && !ov.hidden && (G.mode !== "probe" || !G.probe.lock));
          const m = G.mode, si = G.si;
          if (m === "intro") { await click('[data-act="go"]'); await idle(() => G.mode !== "intro"); }
          else if (m === "result") { await click('[data-act="next"],[data-act="judge"]'); await idle(() => G.mode !== "result" || G.si !== si); }
          else if (m === "probe") { const i0 = G.probe.i, q = G.probe.list[i0]; await new Promise((r) => setTimeout(r, read)); probeAnswer(probe === "right" ? q.ci : (q.ci + 1) % 3); await idle(() => G.mode !== "probe" || (G.probe.i !== i0 && !G.probe.lock)); }
          else if (m === "end") return this.state();
        }
      },
      go(si) { closeOv(); intro(si); beginStage(); },
      showEnding(id, o = {}) { const e = ENDINGS.find((x) => x.id === id); if (!G.results.length) G.results = STAGES.map((s) => ({ n: s.n, name: s.name, Q: s.Q, correct: s.Q, score: 100, ai: s.Q - 1, self: 1, me: 0, wrong: 0, miss: 0, hits: 1, sus: 20, time: s.T })); G.runT0 = performance.now() - 250000; finish(e, Object.assign({ out: e.kind === "out", caughtLate: e.kind === "probe" }, o)); },
      judge: () => judge(),
      pause: () => pauseGame(),
      makeCard: () => makeCard(),
      G, D,
    };
  }
})();
