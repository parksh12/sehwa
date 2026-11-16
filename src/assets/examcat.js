// P2-74b 「커닝냥이 — 감독관을 피해서 만점을 맞아라!」 게임 진행 (이름 문자열은 examcat-data.js NAME 한 곳에서만 가져옴)
// 시험 1개·10문제(세법 법리). 한 문제마다 ① 찍기 → ② 전송 → (AI 대기) → ③ 정답 듣기 → ④ 들은 번호 키로 답 쓰기. 단계마다 화면에 나온 키를 눌러야 함(키는 문제·단계마다 무작위).
// 감시(빨간 부채꼴) 안에서 ①~③을 하면 들킴(의심 +2.5초). 틀린 키는 감시 밖 +0.5초, 안 +1.5초. 성공 = 10문제 모두 정답 + 의심 누적 10초 미만.
// 감독관은 돌아보기 전에 반드시 예고(노란 점선 부채꼴 + 「?」) → 운이 아니라 읽는 게임. 감시는 문제가 진행될수록 하나씩 늘어남.
// 성공하면 「너무 잘 봤는데?」 사후 조사. AI 시험 부정행위 논란을 풍자한 가상의 게임이며 실존 인물과 무관. 기록은 이 기기 localStorage에만(서버 전송 0).
(function () {
  const SM = window.EXCAT;
  const root = document.getElementById("examcat");
  if (!root || !SM || !SM.art) return;
  const { art, sound, EXAM, SUSP, STEPS, KEYS, PHASES, BANK, ENDINGS, PROBE, NAME, SUB } = SM;
  const { W, H, CAT, deg } = art;
  const DEBUG = /[?&]debug=1/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname); // 공개 사이트에선 꺼짐
  let SPEED = 1;
  const KEY = SM.SLUG + "-v2";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const br = (s) => esc(s).replace(/\n/g, "<br>");
  const f1 = (n) => (Math.floor(n * 10) / 10).toFixed(1);

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
    <span class="sm-chip">문제 <b class="sm-sn">1</b>/${EXAM.Q}</span>
    <span class="sm-time" aria-label="남은 시간"><b>${EXAM.T}</b>초</span>
    <span class="sm-tools"><button type="button" class="sm-ib sm-snd" aria-label="소리 끄기" aria-pressed="true">${ICON_SND}</button><button type="button" class="sm-ib sm-pause" aria-label="일시정지">${ICON_PAUSE}</button></span>
  </div>
  <div class="sm-sus" aria-label="의심받은 시간"><span class="sm-sus-l">의심</span><span class="sm-sus-bar"><i></i></span><span class="sm-sus-n"><b>0.0</b>초 / ${EXAM.limit}초</span></div>
  <div class="sm-stage"><canvas class="sm-cv" aria-hidden="true"></canvas><div class="sm-toast" aria-hidden="true"></div></div>
  <div class="sm-keybox">
    <ol class="sm-steps" aria-label="한 문제 4단계">${STEPS.map((s, i) => `<li data-p="${i}">${"①②③④"[i]} ${esc(s.label)}</li>`).join("")}</ol>
    <p class="sm-do" aria-live="polite"></p>
    <div class="sm-keys" role="group" aria-label="키 버튼"></div>
  </div>
  <div class="sm-qbox">
    <p class="sm-qn"><span class="sm-law"></span><span class="sm-who"></span></p>
    <p class="sm-q"></p>
    <div class="sm-ch" role="group" aria-label="답 고르기(숫자 키 1·2·3)">
      <button type="button" class="sm-c" data-c="0"><b>1</b><span></span></button>
      <button type="button" class="sm-c" data-c="1"><b>2</b><span></span></button>
      <button type="button" class="sm-c" data-c="2"><b>3</b><span></span></button>
    </div>
    <p class="sm-fb" aria-live="polite"></p>
  </div>
  <p class="sr sm-live" aria-live="assertive"></p>
  <div class="sm-ov" hidden></div>
</div>`;
  const $ = (s) => root.querySelector(s);
  const scr = $(".sm-screen"), cv = $(".sm-cv"), ctx = cv.getContext("2d"), ov = $(".sm-ov"), keysBox = $(".sm-keys");
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
  const G = { mode: "title", paused: false, pi: 0, t: 0, susT: 0, susBy: {}, hits: 0, wrongKeys: 0, qs: [], qi: 0, step: 0, act: null, waitT: 0, heard: -1, keys: null, reveal: 0, revealNext: null, flash: 0, busted: 0, det: null, watchers: [], seen: [], probe: null, stepT: 0, toastT: 0, outcome: null, runT0: 0, cones: [] };
  const phase = () => PHASES[G.pi];

  // ---------- 감독관(감시 장치) ----------
  const head = (w) => (w.kind === "cctv" ? { x: w.x - 4, y: w.y + 4 } : { x: w.x, y: w.y - (w.kind === "paper" ? 54 : 50) * w.s });
  const angTo = (w, px = CAT.x, py = CAT.y) => { const h = head(w); return Math.atan2(py - h.y, px - h.x); };
  function makeWatcher(kind) {
    if (kind === "ta") return { kind, role: "ta", x: 180, y: 118, s: 1, half: deg(17), range: 280, face: "back", dir: 1, look: Math.PI / 2, ang: Math.PI / 2, state: "off", q: [], act: null, at: 0, flip: false, posI: 0 };
    if (kind === "paper") return { kind, role: "boss", x: 318, y: 118, s: 0.95, half: deg(13), range: 300, face: "front", dir: -1, look: deg(130), ang: deg(130), paper: "read", state: "off", q: [], act: null, at: 0 };
    if (kind === "patrol") return { kind, role: "patrol", x: 180, y: 112, s: 1, half: deg(18), range: 160, face: "front", dir: 1, look: Math.PI / 2, ang: Math.PI / 2, state: "off", q: [], act: null, at: 0 };
    if (kind === "cctv") return { kind, x: 346, y: 14, half: deg(11), range: 440, ang: deg(64), va: 1, lo: deg(62), hi: deg(178), pause: 0.6, state: "look" }; // 교실 전체를 크게 쓸고 지나감
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
  function genTA(w) {
    const reg = G.pi === 0; // 처음 감시 구간: 규칙적(시간·위치 고정)
    const board = reg ? 3.6 : G.pi === 1 ? rnd(3.0, 4.5) : rnd(3.5, 5.0); // 감시가 늘수록 조교는 칠판을 더 오래 봄(전체 감시 밀도 유지)
    const ac = angTo(w), sw = deg(34);
    const fwd = reg ? (w.flip = !w.flip) : Math.random() < 0.5;
    const a0 = ac + (fwd ? -sw : sw), a1 = ac + (fwd ? sw : -sw);
    const lookDur = reg ? 2.6 : 2.0;
    let nx;
    if (reg) { w.posI = (w.posI + 1) % TA_POS.length; nx = TA_POS[w.posI]; }
    else { do { nx = rnd(100, 245); } while (Math.abs(nx - w.x) < 40); }
    w.q.push(A.idle(board, { face: "back", chalk: true }), A.tell(phase().tell, a0, a1), A.look(lookDur, a0, a1), A.walk(nx, 118, 70));
  }
  const PAPER_ELSE = [deg(160), deg(169), deg(96)];
  function genPaper(w) {
    w.q.push(A.idle(rnd(3.0, 5.5), { paper: "read" }));
    const r = Math.random();
    if (r < 0.45) { const ac = angTo(w), j = deg(6); w.q.push(A.tell(phase().tell, ac - j, ac + j), A.look(rnd(1.5, 2.0), ac - j, ac + j)); }
    else if (r < 0.72) { const a = pick(PAPER_ELSE); w.q.push(A.tell(phase().tell, a, a), A.look(1.5, a, a)); } // 다른 수험생 보기(점선이 다른 곳을 가리킴)
    else w.q.push(A.rustle(0.9)); // 가짜 동작: 신문만 펄럭(점선 없음)
  }
  function genPatrol(w) {
    const left = Math.random() < 0.5, a = left ? 120 : 240, b = left ? 240 : 120;
    const ac = angTo(w), sw = deg(30), tell = phase().tell;
    w.q.push(A.idle(0.8, { face: "front" }), A.tell(tell, ac - sw, ac + sw), A.look(2.0, ac - sw, ac + sw));
    w.q.push(A.walk(a, 120, 55, { face: "side" }));
    w.q.push(A.walk(a, 226, 42, { face: "front", cone: Math.PI / 2 }));
    if (Math.random() < 0.3) w.q.push(A.tell(tell, null, null, { toCat: true, face: "side" }), A.look(1.2, null, null, { toCat: true, face: "side" })); // 안경 검사 눈길
    w.q.push(A.walk(a, 372, 42, { face: "front", cone: Math.PI / 2 }));
    w.q.push(A.tell(tell, -Math.PI / 2, -Math.PI / 2, { face: "back", fan: deg(20) }));
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
  function stepWatcher(w, dt) {
    if (w.kind === "cctv") {
      const sp = deg(G.pi === 3 ? 34 : 30);
      if (w.pause > 0) { w.pause -= dt; return; }
      w.ang += w.va * sp * dt;
      if (w.ang > w.hi) { w.ang = w.hi; w.va = -1; w.pause = 1.2; } else if (w.ang < w.lo) { w.ang = w.lo; w.va = 1; w.pause = 1.2; }
      return;
    }
    if (!w.act) { if (!w.q.length) GEN[w.kind](w); startAct(w); }
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
  const watchingNow = () => { for (const w of G.watchers) { const c = coneOf(w); if (c && !c.kind && inCone(c)) return w; } return null; };
  function alarmAll() { // 전파 탐지기 경보: 감독관 모두 냥이 쪽으로(짧은 예고 뒤)
    G.watchers.forEach((w) => { if (w.kind === "ta" || w.kind === "paper") { w.q = []; w.act = null; w.q.push(A.tell(0.45, null, null, { toCat: true }), A.look(1.8, null, null, { toCat: true })); } });
  }

  // ---------- 문제·키 ----------
  const mkQ = (p) => { const order = shuffle([0, 1, 2]); return { q: p.q, opts: order.map((i) => p.a[i]), ci: order.indexOf(0), x: p.x, law: p.law, jo: p.jo, who: null }; };
  const WHO = { ai: "AI가 풀었다냥", me: "직접 맞혔다!", wrong: "틀렸다…" };
  function newKeys() {
    const pool = shuffle([...KEYS.pool]).slice(0, KEYS.count);
    G.keys = { list: pool, correct: pick(pool) };
    drawKeys();
  }
  function drawKeys() {
    const k = G.keys, st = G.step, waiting = st === 2 && G.waitT > 0;
    keysBox.innerHTML = k.list.map((c) => `<button type="button" class="sm-k" data-key="${c}"${waiting || G.act || st >= 3 || G.reveal > 0 ? " disabled" : ""}>${c}</button>`).join(""); // ④ 단계에도 자리 유지(화면이 들썩이지 않게)
    root.querySelectorAll(".sm-steps li").forEach((li) => { const p = +li.dataset.p; li.classList.toggle("on", p === st); li.classList.toggle("done", p < st); });
    const S = STEPS[st];
    const doEl = $(".sm-do");
    if (G.reveal > 0) doEl.innerHTML = "";
    else if (G.act) doEl.innerHTML = `<span class="sm-busy">${esc(STEPS[G.act.step].verb)} 중…</span>`;
    else if (waiting) doEl.innerHTML = `<span class="sm-busy">AI가 답을 만드는 중… ${f1(G.waitT)}초</span>`;
    else if (st < 3) doEl.innerHTML = `<kbd>${k.correct}</kbd> 키 → ${esc(S.desc)}`;
    else doEl.innerHTML = `이어폰: 「정답은 <b>${G.heard + 1}번</b>」 → <kbd>${G.heard + 1}</kbd> 또는 아래 ${G.heard + 1}번 보기`;
  }
  function showQ() {
    const q = G.qs[G.qi];
    $(".sm-sn").textContent = G.qi + 1;
    $(".sm-law").textContent = `${q.law} · 문제 ${G.qi + 1}/${EXAM.Q}`;
    $(".sm-who").textContent = ""; $(".sm-who").className = "sm-who";
    $(".sm-q").textContent = q.q;
    choiceBtns.forEach((b, i) => { b.querySelector("span").textContent = q.opts[i]; b.disabled = false; b.classList.remove("ok", "ng", "dim"); });
    $(".sm-fb").textContent = "";
    G.step = 0; G.act = null; G.waitT = 0; G.heard = -1; newKeys();
  }
  function solve(who, chosen) {
    const q = G.qs[G.qi]; if (!q || q.who) return;
    q.who = who; G.seen.push(q);
    G.reveal = who === "wrong" ? 2.4 : 2.0; G.act = null;
    choiceBtns.forEach((b, i) => { b.disabled = true; b.classList.toggle("ok", i === q.ci); b.classList.toggle("ng", i === chosen && who === "wrong"); b.classList.toggle("dim", i !== q.ci && i !== chosen); });
    const wEl = $(".sm-who"); wEl.textContent = WHO[who]; wEl.className = "sm-who w-" + who;
    $(".sm-fb").textContent = `${q.jo} · ${q.x}`;
    keysBox.querySelectorAll(".sm-k").forEach((b) => { b.disabled = true; }); $(".sm-do").innerHTML = `<span class="sm-busy">${esc(WHO[who])}</span>`;
    sound.play(who === "wrong" ? "wrong" : who === "me" ? "me" : "solve");
  }
  function answer(i) {
    if (G.mode !== "play" || G.paused || G.reveal > 0 || G.act) return;
    const q = G.qs[G.qi]; if (!q || q.who) return;
    if (G.step === 3) solve(i === q.ci ? "ai" : "wrong", i); // 들은 번호를 눌렀는가(다른 번호를 누르면 오답)
    else solve(i === q.ci ? "me" : "wrong", i); // AI 없이 직접 고름
  }
  function addSus(sec, by) { G.susT += sec; G.susBy[by] = (G.susBy[by] || 0) + sec; }
  function pressKey(c) {
    if (G.mode !== "play" || G.paused || G.reveal > 0 || G.act) return;
    if (G.step === 2 && G.waitT > 0) return; // AI가 아직 답을 만드는 중
    const watcher = watchingNow();
    if (G.step >= 3 || c !== G.keys.correct) { // 틀린 키
      const s = watcher ? SUSP.keyIn : SUSP.keyOut;
      addSus(s, "keys"); G.wrongKeys++; G.flash = Math.max(G.flash, watcher ? 0.8 : 0.35);
      sound.play("buzz"); toast(`엉뚱한 키! 의심 +${s}초`, "bad");
      const b = keysBox.querySelector(`[data-key="${c}"]`); if (b) { b.classList.remove("bad"); void b.offsetWidth; b.classList.add("bad"); }
      return;
    }
    G.act = { step: G.step, t: 0, dur: STEPS[G.step].dur, busted: false };
    sound.play(G.step === 0 ? "snap" : G.step === 1 ? "send" : "ready");
    drawKeys();
  }
  function finishAct() {
    const a = G.act; G.act = null;
    if (a.step === 0) { G.step = 1; newKeys(); }
    else if (a.step === 1) { G.step = 2; G.waitT = KEYS.wait; newKeys(); }
    else if (a.step === 2) { G.step = 3; G.heard = G.qs[G.qi].ci; drawKeys(); }
  }
  function bust(w) {
    const a = G.act; if (!a || a.busted) return;
    a.busted = true; G.act = null; // 동작이 취소되고 같은 단계를 다시 해야 함
    G.hits++; addSus(SUSP.bust, G.det && G.det.alarm > 0 ? "detector" : w.kind);
    G.flash = 1; G.busted = 1; if (w.kind !== "cctv") w.lock = 1.2;
    sound.play("busted"); toast(`${w.kind === "cctv" ? "CCTV에 찍혔다!" : "들켰다!"} 의심 +${SUSP.bust}초`, "bad"); live("들켰어요! 의심이 올라가요");
    drawKeys();
  }

  // ---------- HUD ----------
  let lastHud = "";
  function hud() {
    const left = Math.max(0, Math.ceil(EXAM.T - G.t));
    const key = `${G.qi}|${left}|${f1(G.susT)}`;
    if (key === lastHud) return; lastHud = key;
    const tm = $(".sm-time"); tm.querySelector("b").textContent = left; tm.classList.toggle("low", left <= 15);
    const s = Math.min(1, G.susT / EXAM.limit);
    $(".sm-sus-bar i").style.width = s * 100 + "%"; $(".sm-sus-n b").textContent = f1(G.susT);
    $(".sm-sus").dataset.lv = s >= 0.7 ? "3" : s >= 0.4 ? "2" : "1";
  }
  function sndBtn() { const b = $(".sm-snd"); b.setAttribute("aria-pressed", String(D.sound)); b.setAttribute("aria-label", D.sound ? "소리 끄기" : "소리 켜기"); b.classList.toggle("off", !D.sound); }
  let liveT = 0;
  function live(msg) { const now = performance.now(); if (now - liveT < 1500) return; liveT = now; $(".sm-live").textContent = msg; }
  function toast(msg, kind = "") { const t = $(".sm-toast"); t.textContent = msg; t.className = "sm-toast go " + kind; G.toastT = 1.3; }

  // ---------- 진행 ----------
  function newRun() {
    sound.unlock();
    Object.assign(G, { pi: 0, t: 0, susT: 0, susBy: {}, hits: 0, wrongKeys: 0, seen: [], probe: null, outcome: null, runT0: performance.now(), watchers: [], det: null, reveal: 0, flash: 0, busted: 0, cones: [], steps: null });
    G.qs = shuffle(BANK).slice(0, EXAM.Q).map(mkQ); G.qi = 0;
    D.plays++; save();
    showQ(); lastHud = ""; hud();
    phaseCard(0);
  }
  function phaseCard(pi) {
    G.pi = pi; const p = phase();
    p.add.forEach((k) => { const w = makeWatcher(k); if (w) G.watchers.push(w); if (k === "detector") G.det = { v: 0, alarm: 0 }; });
    G.mode = "intro";
    scr.dataset.phase = pi;
    openOv(`<div class="sm-card sm-intro"><p class="sm-kicker">${pi === 0 ? `${esc(EXAM.place)} · ${EXAM.Q}문제 · 제한 ${EXAM.T}초` : `문제 ${p.from}부터`}</p><h3>${pi === 0 ? esc(EXAM.name) : "감시가 늘었다!"}</h3>
${pi === 0 ? `<p class="sm-meta">성공 조건: <b>${EXAM.Q}문제 모두 정답</b> + <b>의심 ${EXAM.limit}초 미만</b></p>
<div class="sm-new"><p class="sm-tag t-ai">한 문제 4단계</p><p>① 찍기 → ② 전송 → ③ 정답 듣기 → ④ 답 쓰기<br><small>단계마다 화면에 나온 키를 누르세요. 키는 매번 바뀌어요.</small></p></div>` : ""}
<div class="sm-new"><p class="sm-tag t-watch">새 감시</p><p><b>${esc(p.name)}</b><br>${esc(p.desc)}</p></div>
<div class="sm-btns"><button type="button" class="sm-btn" data-act="go" data-focus>${pi === 0 ? "시험 시작" : "계속"}</button></div>
<p class="sm-note">노란 점선 = 곧 볼 곳 · 빨간 부채꼴 = 지금 보는 곳. 그 안에서 ①~③을 하면 들켜요(+${SUSP.bust}초). 틀린 키도 의심을 사요.</p></div>`, "intro");
  }
  function go() { closeOv(); sound.unlock(); G.mode = "play"; G.paused = false; lastTs = 0; if (G.pi === 0) toast(`${EXAM.name} 시작!`); }
  function afterReveal() {
    const q = G.qs[G.qi];
    if (q.who === "wrong") return fail("wrong");
    G.qi++;
    if (G.qi >= EXAM.Q) return examDone();
    showQ();
    const next = PHASES.findIndex((p, i) => i > G.pi && p.from === G.qi + 1);
    if (next > 0) phaseCard(next);
  }
  function examDone() {
    G.mode = "result"; sound.play("stage");
    const T = totals();
    openOv(`<div class="sm-card sm-res"><p class="sm-kicker">시험 종료</p><h3>시험 성공! <span class="sm-big">${EXAM.Q}/${EXAM.Q}</span></h3>
<ul class="sm-stats"><li><b>${f1(G.susT)}</b>의심(초)</li><li><b>${T.ai}</b>AI가 푼 문제</li><li><b>${T.me}</b>직접 맞힌 문제</li><li><b>${G.hits}</b>들킴</li></ul>
<p class="sm-meta">시험장에서는 아무도 결정적인 장면을 못 봤어요. 그런데…</p>
<div class="sm-btns"><button type="button" class="sm-btn" data-act="judge" data-focus>채점 결과 보기</button></div></div>`, "result");
  }
  function fail(reason, by) {
    G.mode = "caught"; sound.play("caught");
    let e;
    if (reason === "susp") {
      const top = Object.entries(G.susBy).sort((a, b) => b[1] - a[1])[0];
      e = top && top[0] === "keys" ? ENDINGS.find((x) => x.id === "fumble") : ENDINGS.find((x) => x.kind === "out" && x.by === (top ? top[0] : by)) || ENDINGS.find((x) => x.id === "out1");
      toast("의심 10초! 퇴장!", "bad");
    } else e = ENDINGS.find((x) => x.id === reason);
    setTimeout(() => finish(e, { fail: reason }), (reason === "susp" ? 900 : 300) / SPEED);
  }
  const totals = () => { const s = G.qs.filter((q) => q.who); const ai = s.filter((q) => q.who === "ai").length, me = s.filter((q) => q.who === "me").length; return { ai, me, solved: ai + me, aiShare: ai + me ? ai / (ai + me) : 0 }; };

  // ---------- 사후 조사 ----------
  function judge() {
    const T = totals();
    const inv0 = Math.min(85, Math.round(PROBE.base + T.aiShare * PROBE.perAi + G.hits * PROBE.hit));
    const order = { ai: 0, me: 1 };
    let list = shuffle(G.seen).sort((a, b) => order[a.who] - order[b.who]).slice(0, PROBE.n);
    list = list.map((q) => { const o = shuffle([0, 1, 2]); return { q: q.q, opts: o.map((i) => q.opts[i]), ci: o.indexOf(q.ci), x: q.x, jo: q.jo, law: q.law, was: q.who }; });
    G.probe = { list, i: 0, right: 0, inv: inv0, inv0, lock: false };
    G.mode = "probe";
    probeShow(true);
  }
  function probeShow(first) {
    const P = G.probe, q = P.list[P.i];
    openOv(`<div class="sm-card sm-probe"><p class="sm-kicker">사후 조사 · 질문 ${P.i + 1}/${P.list.length}</p>
${first ? `<h3>너무 잘 봤는데?</h3><p class="sm-story">세법 시험 만점. 시험장에서는 아무도 못 봤지만, 점수가 너무 좋아서 조사관이 불렀어요.<br>AI는 압수. 시험에 나온 문제를 직접 설명해 보세요.</p>` : ""}
<div class="sm-inv" data-hot="${P.inv >= PROBE.limit - 15 ? 1 : 0}"><span>조사 게이지</span><span class="sm-inv-bar"><i style="width:${P.inv}%"></i><em style="left:${PROBE.limit}%" aria-hidden="true"></em></span><b>${P.inv}%</b></div>
<p class="sm-note">맞히면 내려가고 틀리면 올라가요. 틀렸을 때나 마지막에 ${PROBE.limit}% 이상이면 들통. 시험 때 AI로 푼 문제가 많을수록 높게 시작해요.</p>
<p class="sm-epq">조사관: 「${esc(q.q)}」</p>
<div class="sm-ch sm-epch">${q.opts.map((o, i) => `<button type="button" class="sm-c" data-probe="${i}"${i === 0 ? " data-focus" : ""}><b>${i + 1}</b><span>${esc(o)}</span></button>`).join("")}</div>
<p class="sm-fb sm-epfb" aria-live="polite">${q.was === "ai" ? "시험 때 AI가 대신 풀었던 문제예요." : "시험 때 직접 맞힌 문제예요."}</p></div>`, "probe");
    P.lock = false;
  }
  function probeAnswer(i) {
    const P = G.probe; if (!P || P.lock) return;
    P.lock = true;
    const q = P.list[P.i], ok = i === q.ci;
    if (ok) P.right++;
    P.inv = Math.max(0, Math.min(100, P.inv + (ok ? PROBE.right : PROBE.wrong)));
    ov.querySelectorAll("[data-probe]").forEach((b, k) => { b.disabled = true; b.classList.toggle("ok", k === q.ci); b.classList.toggle("ng", k === i && !ok); b.classList.toggle("dim", k !== q.ci && k !== i); });
    ov.querySelector(".sm-epfb").textContent = (ok ? "술술 설명했다! " : `말문이 막혔다… 정답은 「${q.opts[q.ci]}」. `) + `${q.law} ${q.jo}. ${q.x}`;
    const bar = ov.querySelector(".sm-inv-bar i"); if (bar) bar.style.width = P.inv + "%"; const bn = ov.querySelector(".sm-inv b"); if (bn) bn.textContent = P.inv + "%";
    sound.play(ok ? "me" : "wrong");
    setTimeout(() => { if (!ok && P.inv >= PROBE.limit) return finishProbe(); P.i++; if (P.i < P.list.length) probeShow(false); else finishProbe(); }, (ok ? 1800 : 2600) / SPEED);
  }
  function finishProbe() {
    const P = G.probe, T = totals();
    const id = P.inv >= PROBE.limit ? "probe" : T.aiShare <= 0.3 && P.right === P.list.length ? "true" : "hollow";
    finish(ENDINGS.find((e) => e.id === id), { probe: { inv: P.inv, inv0: P.inv0, right: P.right, n: P.list.length }, caughtLate: id === "probe", success: true });
  }
  function gradeOf(o) {
    if (o.fail || o.caughtLate) return "F";
    if (o.e === "true") return "S";
    return o.susT < 3 ? "A" : o.susT < 6 ? "B" : "C";
  }
  function finish(e, o) {
    Object.assign(o, totals(), { e: e.id, susT: G.susT, hits: G.hits, wrongKeys: G.wrongKeys, solvedN: G.qs.filter((q) => q.who && q.who !== "wrong").length, sec: Math.round((performance.now() - G.runT0) / 1000), examSec: Math.round(G.t * 10) / 10 });
    o.grade = gradeOf(o);
    const firstSeen = !D.endings[e.id];
    D.endings[e.id] = (D.endings[e.id] || 0) + 1;
    let newBest = false;
    if (o.success && !o.caughtLate && (!D.best || o.susT < D.best.susT)) { D.best = { susT: Math.round(o.susT * 10) / 10, grade: o.grade, ending: e.id }; newBest = true; }
    save();
    G.outcome = { e, o, firstSeen, newBest };
    G.mode = "end";
    if (o.success && !o.caughtLate) sound.play("end"); else if (o.caughtLate) sound.play("caught");
    endScreen();
  }
  const REASON = { susp: "의심 10초를 넘겨 퇴장", wrong: "오답 1개로 만점 실패", timeout: "제한 시간 초과" };
  function endScreen() {
    const { e, o, firstSeen, newBest } = G.outcome;
    const nE = Object.keys(D.endings).length;
    const sub = o.fail ? REASON[o.fail] : o.caughtLate ? "시험 성공 → 사후 조사에서 들통" : "시험 성공 · 사후 조사 통과";
    const kick = e.kind === "out" ? "실패 · 퇴장" : e.kind === "fail" ? "실패" : e.kind === "probe" ? "성공 후 사후 조사" : "성공";
    openOv(`<div class="sm-card sm-end"><canvas class="sm-art" data-w="360" data-h="230" aria-hidden="true"></canvas>
<p class="sm-kicker">엔딩 · ${kick}${firstSeen ? ' <em class="sm-newe">NEW</em>' : ""}</p><h3>${esc(e.name)}</h3>
<p class="sm-story">${br(e.text)}</p><p class="sm-msg">${esc(e.msg)}</p>
<div class="sm-grade"><span class="sm-g g-${o.grade}">${o.grade}</span><span><small>칭호</small><b>${esc(e.title)}</b><small>${esc(sub)}${newBest ? " · 최고 기록!" : ""}</small></span></div>
<ul class="sm-stats"><li><b>${o.solvedN}/${EXAM.Q}</b>맞힌 문제</li><li><b>${f1(o.susT)}</b>의심(초)</li><li><b>${o.hits}</b>들킴</li><li><b>${o.wrongKeys}</b>틀린 키</li></ul>
${o.probe ? `<p class="sm-meta">사후 조사: 시작 ${o.probe.inv0}% → 끝 ${o.probe.inv}% · 설명 성공 ${o.probe.right}/${o.probe.n}</p>` : ""}
<p class="sm-meta">AI ${o.ai}문제 · 직접 ${o.me}문제 · 시험 시간 ${Math.round(o.examSec)}초 · 플레이 ${Math.floor(o.sec / 60)}분 ${o.sec % 60}초</p>
${D.best ? `<p class="sm-meta">이 기기 최고 기록: 성공 · 의심 ${f1(D.best.susT)}초 · ${D.best.grade}등급</p>` : ""}
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
    G.mode = "title"; G.paused = false;
    const nE = Object.keys(D.endings).length;
    openOv(`<div class="sm-card sm-title"><canvas class="sm-art" data-w="360" data-h="300" aria-hidden="true"></canvas>
<p class="sm-kicker">AI 시험 부정행위 풍자 게임 · 세법 ${EXAM.Q}문제 · 5분 이내</p><h2 class="sm-logo">${esc(NAME)}</h2><p class="sm-subt">${esc(SUB)}</p>
<ol class="sm-rules"><li>세법 문제는 너무 어렵다. 한 문제마다 <b>① 찍기 → ② 전송 → ③ 정답 듣기 → ④ 답 쓰기</b>, 화면에 나온 <b>키</b>를 차례로 누르세요. <em class="r">틀린 키도 의심</em></li><li><b>노란 점선</b>은 곧 볼 곳, <b>빨간 부채꼴</b>은 지금 보는 곳. 그 안에서 ①~③을 하면 들켜요.</li><li><b>${EXAM.Q}문제 모두 정답 + 의심 ${EXAM.limit}초 미만</b>이면 성공! <em>너무 잘 보면 사후 조사</em></li></ol>
<p class="sm-note">휴대폰은 화면의 키 버튼을 누르면 돼요. 답을 정말 안다면 보기를 직접 눌러도 돼요(틀리면 즉시 실패).</p>
<div class="sm-btns"><button type="button" class="sm-btn" data-act="start" data-focus>시험 보러 가기</button><button type="button" class="sm-btn ghost" data-act="book">엔딩 도감 ${nE}/${ENDINGS.length}</button></div>
${D.best ? `<p class="sm-meta">이 기기 최고 기록: 성공 · 의심 ${f1(D.best.susT)}초 · ${D.best.grade}등급</p>` : ""}
<p class="sm-note">소리 나요(오른쪽 위에서 끄기) · 실존 인물과 무관한 가상의 이야기이고, 등장 도구도 모두 지어낸 물건이에요.</p></div>`, "title");
    setArt("title");
  }
  function book() {
    G.bookPrev = G.mode; G.mode = "book";
    const hint = (e) => (e.kind === "out" ? `의심 10초… ${({ ta: "조교", paper: "부장", cctv: "CCTV", patrol: "안경 검사", detector: "전파 탐지기" })[e.by]} 때문이라면` : e.kind === "fail" ? "다른 이유로 실패하면…" : e.kind === "probe" ? "성공한 뒤…" : "성공하고 사후 조사까지 넘기면");
    openOv(`<div class="sm-card sm-book"><div class="sm-bhead"><h3>엔딩 도감 <small>${Object.keys(D.endings).length}/${ENDINGS.length}</small></h3><button type="button" class="sm-btn ghost sm-x" data-act="bookclose" data-focus>닫기</button></div>
<ol class="sm-blist">${ENDINGS.map((e) => { const c = D.endings[e.id]; return `<li class="${c ? "got" : ""}"><b>${c ? esc(e.name) : "???"}</b><small>${c ? `${esc(e.title)} · ${c}회` : esc(hint(e))}</small></li>`; }).join("")}</ol>
<p class="sm-note">기록은 이 기기 브라우저에만 저장돼요. <button type="button" class="sm-link" data-act="reset">기록 지우기</button></p></div>`, "book");
  }
  function bookClose() { if (G.bookPrev === "end" && G.outcome) { G.mode = "end"; endScreen(); } else titleScreen(); }
  function pauseGame(why) {
    if (G.mode !== "play" || G.paused) return;
    G.paused = true;
    openOv(`<div class="sm-card sm-pause-c"><p class="sm-kicker">${why ? esc(why) : "일시정지"}</p><h3>잠깐 멈췄어요</h3><p class="sm-meta">문제 ${G.qi + 1}/${EXAM.Q} · 남은 ${Math.max(0, Math.ceil(EXAM.T - G.t))}초 · 의심 ${f1(G.susT)}초</p>
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
    const good = e.kind === "end";
    const g = x.createLinearGradient(0, 0, 0, Hc); g.addColorStop(0, "#fff4df"); g.addColorStop(1, good ? "#ffd86b" : "#ffb4aa"); x.fillStyle = g; x.fillRect(0, 0, Wc, Hc);
    const T = (s, X, Y, size, col, font = SM.FONT, weight = 800) => { x.font = `${weight} ${size}px ${font}`; x.textAlign = "center"; x.textBaseline = "top"; x.fillStyle = col; x.fillText(s, X, Y); };
    T(NAME, Wc / 2, 60, 92, "#141414", DISP, 400);
    T(SUB, Wc / 2, 168, 34, "#c2281d");
    x.save(); art.rr(x, 40, 236, 640, 408, 28); x.clip(); x.translate(40, 236); x.scale(640 / 360, 640 / 360); art.ending(x, e, 1.2, 360, 230); x.restore();
    x.lineWidth = 6; x.strokeStyle = "#141414"; art.rr(x, 40, 236, 640, 408, 28); x.stroke();
    T(`엔딩 · ${e.kind === "end" ? "성공" : e.kind === "probe" ? "성공 후 사후 조사" : "실패"}`, Wc / 2, 676, 30, "#555");
    T(e.name, Wc / 2, 718, e.name.length > 10 ? 56 : 66, "#141414", DISP, 400);
    x.fillStyle = o.grade === "F" ? "#c2281d" : "#141414"; art.ell(x, 150, 900, 70, 70); x.fill();
    T(o.grade, 150, 852, 92, "#ffc21a", DISP, 400);
    const L = (s, Y, size, col, w = 800) => { x.font = `${w} ${size}px ${SM.FONT}`; x.textAlign = "left"; x.textBaseline = "top"; x.fillStyle = col; x.fillText(s, 250, Y); };
    L("칭호", 838, 26, "#555"); L(e.title, 872, 40, "#141414", 900);
    L(o.fail ? REASON[o.fail] : o.caughtLate ? "시험 성공 → 사후 조사 들통" : "세법 10문제 만점 · 조사 통과", 926, 30, "#3d3d3d");
    T(`맞힌 문제 ${o.solvedN}/${EXAM.Q} · 의심 ${f1(o.susT)}초 / ${EXAM.limit}초 · 들킴 ${o.hits}회`, Wc / 2, 1010, 28, "#3d3d3d");
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
  keysBox.addEventListener("click", (e) => { const b = e.target.closest("[data-key]"); if (b) pressKey(b.dataset.key); });
  choiceBtns.forEach((b) => b.addEventListener("click", () => answer(+b.dataset.c)));
  root.addEventListener("click", (e) => {
    const pb = e.target.closest("[data-probe]"); if (pb) { probeAnswer(+pb.dataset.probe); return; }
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a !== "sys-share") sound.play("click");
    if (a === "start" || a === "again") newRun();
    else if (a === "go") go();
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
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (!inView()) return;
    const k = e.key;
    if (G.mode === "play" && !G.paused) {
      if (k === "1" || k === "2" || k === "3") { e.preventDefault(); answer(+k - 1); return; }
      if (k === "Escape") { e.preventDefault(); pauseGame(); return; }
      const code = /^Key([A-Z])$/.exec(e.code || ""); // 한글 입력 상태에서도 자판 위치로 판단
      const c = code ? code[1] : k.length === 1 && /[a-z]/i.test(k) ? k.toUpperCase() : null;
      if (c) { e.preventDefault(); pressKey(c); }
    } else if (G.mode === "probe" && (k === "1" || k === "2" || k === "3")) { e.preventDefault(); probeAnswer(+k - 1); }
    else if (G.mode === "book" && k === "Escape") { e.preventDefault(); bookClose(); }
  });
  // 탭 숨김·창 전환·창 너비 변경 → 일시정지(휴대폰 주소창이 접히며 높이만 바뀌는 것은 무시)
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseGame("탭을 벗어나서 멈췄어요"); });
  window.addEventListener("blur", () => { if (!DEBUG) pauseGame("창을 벗어나서 멈췄어요"); });
  let lastW = innerWidth;
  window.addEventListener("resize", () => { if (Math.abs(innerWidth - lastW) > 1) { lastW = innerWidth; pauseGame("화면 크기가 바뀌어서 멈췄어요"); } fitAll(); });

  // ---------- 한 프레임 ----------
  function update(dt) {
    if (G.toastT > 0) { G.toastT -= dt; if (G.toastT <= 0) $(".sm-toast").className = "sm-toast"; }
    G.flash = Math.max(0, G.flash - dt * 2.5); G.busted = Math.max(0, G.busted - dt * 1.6);
    if (bot) botStep(dt);
    G.watchers.forEach((w) => stepWatcher(w, dt));
    const a = G.act;
    // 전파 탐지기: 동작 중·AI 대기 중에 눈금이 참
    if (G.det) {
      if (G.det.alarm > 0) G.det.alarm -= dt;
      if (a) G.det.v += 48 * dt; else if (G.step === 2 && G.waitT > 0) G.det.v += 14 * dt; else G.det.v = Math.max(0, G.det.v - 16 * dt);
      if (G.det.v >= 100) { G.det.v = 0; G.det.alarm = 2.2; addSus(1, "detector"); alarmAll(); sound.play("alarm"); toast("전파 탐지기 경보! 의심 +1초, 모두 돌아본다", "bad"); live("전파 탐지기 경보! 모두 돌아봐요"); }
    }
    G.cones = G.watchers.map(coneOf).filter(Boolean);
    if (a) {
      const w = watchingNow();
      if (w) bust(w);
      else { a.t += dt; if (a.t >= a.dur) finishAct(); else if (Math.floor(a.t * 10) !== Math.floor((a.t - dt) * 10)) drawKeys(); }
    }
    if (G.step === 2 && G.waitT > 0 && G.reveal <= 0) { const p = G.waitT; G.waitT -= dt; if (G.waitT <= 0) { G.waitT = 0; sound.play("ready"); toast("AI 답 도착! 이제 듣기"); drawKeys(); } else if (Math.floor(p * 10) !== Math.floor(G.waitT * 10)) drawKeys(); }
    // 발소리(안경 검사 펭귄)
    const pt = G.watchers.find((w) => w.kind === "patrol");
    G.steps = null;
    if (pt && pt.walk) {
      const d = Math.hypot(pt.x - CAT.x, pt.y - CAT.y), near = Math.max(0, 1 - d / 170);
      if (pt.y > 230) G.steps = { x: pt.x, near };
      G.stepT -= dt; if (G.stepT <= 0) { G.stepT = 0.42; if (near > 0.05) sound.play("step", 0.3 + near * 0.9); }
    }
    if (G.susT >= EXAM.limit) { fail("susp"); return; }
    if (G.reveal > 0) { G.reveal -= dt; if (G.reveal <= 0) { afterReveal(); } hud(); return; } // 정답 공개 동안은 시험 시계 멈춤
    G.t += dt;
    if (G.t >= EXAM.T) { G.t = EXAM.T; hud(); fail("timeout"); return; }
    hud();
  }
  function draw(t) {
    const p = phase(), a = G.act;
    const ta = G.watchers.find((w) => w.kind === "ta");
    const cam = G.watchers.find((w) => w.kind === "cctv");
    const watchers = G.watchers.filter((w) => w.kind !== "cctv").map((w) => ({ ...w, t }));
    const cones = (G.cones || []).map((c) => ({ ...c, w: null, hot: !c.kind && inCone(c) }));
    if (cam) { const ac = Math.atan2(CAT.y - cam.y, CAT.x - cam.x); cam.warn = Math.abs(wrapA(cam.ang - ac)) < deg(26); }
    const step = a ? a.step : -1;
    art.scene(ctx, {
      t, theme: p.theme, boardTitle: EXAM.name, boardSub: p.board, chalk: ta ? ta.chalk : 0, sleepy: G.watchers.length && PHASES.slice(0, G.pi + 1).some((q) => q.add.includes("sleepy")),
      timeFrac: 1 - G.t / EXAM.T, watchers, cones,
      cat: { pose: G.busted > 0.3 ? "busted" : step >= 1 ? "ai" : G.reveal > 0 ? "idle" : "write", tool: step === 2 ? "earbud" : "phone", exposed: step >= 1, using: step >= 1, busted: G.busted, sweat: G.susT / EXAM.limit,
        snap: step === 0 ? Math.max(0.05, a.t / a.dur) : 0, wait: G.step === 2 && G.waitT > 0 ? G.waitT / KEYS.wait : 0, say: G.step === 3 && G.reveal <= 0 ? `정답은 ${G.heard + 1}번…` : step === 1 ? "전송 중…" : "" },
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
  G.qs = shuffle(BANK).slice(0, EXAM.Q).map(mkQ); showQ(); hud();
  G.watchers = [makeWatcher("ta")]; draw(0); G.watchers = [];
  titleScreen();
  root.classList.add("ready");
  requestAnimationFrame(frame);

  // ---------- 디버그·자동 플레이(localhost + ?debug=1 일 때만) ----------
  // 봇은 사람처럼: 키를 읽는 데 read초, 위험을 알아채는 데 react초. 동작 시간(+여유) 동안 시선이 오지 않을 때만 누름
  const R = (why) => { if (bot && why) bot.why[why] = (bot.why[why] || 0) + 1; return !!why; };
  function dangerFor(horizon) {
    for (const w of G.watchers) {
      if (w.kind === "cctv") { // 지금 각도부터 horizon초 뒤 각도까지 쓸고 갈 범위에 냥이가 있으면 위험
        const h = head(w), d = Math.hypot(CAT.x - h.x, CAT.y - h.y), ac = Math.atan2(CAT.y - h.y, CAT.x - h.x), sp = deg(G.pi === 3 ? 34 : 30), m = w.half + Math.atan2(CAT.r, d) + deg(5);
        const move = Math.max(0, horizon - Math.max(0, w.pause)) * sp, end = Math.max(w.lo, Math.min(w.hi, w.ang + w.va * move)), lo = Math.min(w.ang, end) - m, hi = Math.max(w.ang, end) + m;
        if (ac >= lo && ac <= hi) return R(w.kind + ":cctv"); continue; }
      if (!w.act) return R(w.kind + ":gap"); // 동작이 바뀌는 순간(다음 동작을 아직 모름)
      const c = coneOf(w);
      if (c && inCone(c, CAT.x, CAT.y, CAT.r, deg(6))) return R(w.kind + ":cone");
      if (w.state === "look" && w.act && w.act.k === "look") { const a1 = w.act.a1, h = head(w); if (inCone({ x: h.x, y: h.y, ang: (w.ang + a1) / 2, half: Math.abs(a1 - w.ang) / 2 + w.half, range: w.range }, CAT.x, CAT.y, CAT.r, deg(6))) return R(w.kind + ":sweep"); }
      if (w.kind === "patrol" && w.y > 290 && w.act && w.act.k === "walk" && w.act.cone === Math.PI / 2) return R(w.kind + ":patrolBack"); // 곧 뒤에서 돌아섬
      if (w.kind === "paper" && w.paper === "rustle") continue;
    }
    if (G.det && (G.det.v > 45 || G.det.alarm > 0)) return R("det");
    return R(null);
  }
  function botStep(dt) {
    if (G.reveal > 0 || G.act) { bot.t = 0; return; }
    if (G.step === 2 && G.waitT > 0) { bot.t = 0; return; }
    bot.t += dt;
    if (bot.t < bot.read) return;
    if (G.step === 3) { answer(G.heard); bot.t = 0; return; }
    if (bot.mode === "honest") { answer(pick([0, 1, 2])); bot.t = 0; return; } // AI 없이 찍기(대개 틀림)
    if (bot.mode === "fumble" && Math.random() < 0.5) { pressKey(G.keys.list.find((c) => c !== G.keys.correct)); bot.t = 0; return; }
    if (bot.mode === "reckless" || !dangerFor(STEPS[G.step].dur + 0.15)) { pressKey(G.keys.correct); bot.t = 0; }
  }
  if (DEBUG) {
    const idle = async (pred, limit = 600000) => { const t0 = Date.now(); while (!pred()) { if (Date.now() - t0 > limit) return false; await new Promise((r) => setTimeout(r, 20)); } return true; };
    window.EXCAT_DEBUG = {
      speed(v) { SPEED = v; },
      bot(mode = "smart", opt = {}) { bot = mode ? { mode, read: opt.read == null ? 0.45 : opt.read, t: 0, why: {} } : null; },
      state: () => ({ why: bot && bot.why, mode: G.mode, paused: G.paused, pi: G.pi, qi: G.qi, step: G.step, t: G.t, susT: G.susT, susBy: G.susBy, hits: G.hits, wrongKeys: G.wrongKeys, keys: G.keys, act: !!G.act, outcome: G.outcome && { id: G.outcome.e.id, ...G.outcome.o }, sound: sound.state }),
      async run({ probe = "right", read = 300 } = {}) {
        const click = async (sel) => { await new Promise((r) => setTimeout(r, read)); const b = ov.querySelector(sel); if (b) b.click(); };
        if (G.mode === "title" || G.mode === "end") await click('[data-act="start"],[data-act="again"]');
        for (;;) {
          await idle(() => ["intro", "result", "probe", "end"].includes(G.mode) && !ov.hidden && (G.mode !== "probe" || !G.probe.lock));
          const m = G.mode, pi = G.pi;
          if (m === "intro") { await click('[data-act="go"]'); await idle(() => G.mode !== "intro" || G.pi !== pi); }
          else if (m === "result") { await click('[data-act="judge"]'); await idle(() => G.mode !== "result"); }
          else if (m === "probe") { const i0 = G.probe.i, q = G.probe.list[i0]; await new Promise((r) => setTimeout(r, read)); probeAnswer(probe === "right" ? q.ci : (q.ci + 1) % 3); await idle(() => G.mode !== "probe" || (G.probe.i !== i0 && !G.probe.lock)); }
          else if (m === "end") return this.state();
        }
      },
      start() { newRun(); go(); },
      goQ(n) { newRun(); closeOv(); G.watchers = []; G.det = null; PHASES.forEach((p, i) => { if (p.from <= n) { G.pi = i; p.add.forEach((k) => { const w = makeWatcher(k); if (w) G.watchers.push(w); if (k === "detector") G.det = { v: 0, alarm: 0 }; }); } }); G.qi = n - 1; G.qs.slice(0, n - 1).forEach((q) => { q.who = "ai"; G.seen.push(q); }); showQ(); go(); },
      examDone: () => { G.qs.forEach((q) => { q.who = q.who || "ai"; }); G.seen = G.qs.slice(); examDone(); },
      press: (c) => pressKey(c), answer: (i) => answer(i),
      showEnding(id, o = {}) { const e = ENDINGS.find((x) => x.id === id); G.runT0 = performance.now() - 200000; if (!G.qs.some((q) => q.who)) G.qs.forEach((q, i) => { q.who = i < 8 ? "ai" : "me"; }); finish(e, Object.assign(e.kind === "out" ? { fail: "susp" } : e.kind === "fail" ? { fail: e.id === "fumble" ? "susp" : e.id } : e.kind === "probe" ? { caughtLate: true, success: true, probe: { inv: 78, inv0: 85, right: 0, n: 1 } } : { success: true, probe: { inv: 49, inv0: 85, right: 3, n: 3 } }, o)); },
      judge: () => { G.qs.forEach((q, i) => { if (!q.who) q.who = i < 8 ? "ai" : "me"; }); G.seen = G.qs.slice(); judge(); },
      pause: () => pauseGame(),
      makeCard: () => makeCard(),
      G, D,
    };
  }
})();
