// P2-74c 「커닝냥이 — 감독관을 피해서 만점을 맞아라!」 게임 진행 (이름 문자열은 examcat-data.js NAME 한 곳에서만 가져옴)
// 조작은 하나: 꾹 누르면 치팅(게이지가 찰칵 → 전송 → 정답 듣기로 차고, 다 차면 정답 1개), 떼면 숨김. 감독관이 볼 때 누르고 있으면 즉시 퇴장.
// 감독관은 돌아보기 전에 반드시 예고(노란 점선 부채꼴 + 「?」, 신문 접기, 발소리) → 운이 아니라 눈치 게임. 시험 3분 고정, 시간이 갈수록 감시가 늘고 빨라짐.
// 점수 = 누른 시간 + 정답 보너스 + 완주 보너스(정수 하나). 순위는 rank.js(이번 주·역대, 「순위에 올리기」를 고른 경우만).
// AI 시험 부정행위 논란을 풍자한 가상의 게임이며 실존 인물과 무관. 이 기기에는 최고 점수·플레이 횟수·소리 설정만(localStorage).
(function () {
  const SM = window.EXCAT;
  const root = document.getElementById("examcat");
  if (!root || !SM || !SM.art) return;
  const { art, sound, EXAM, GAUGE, SCORE, PHASES, ENDS, MSG, NAME, SUB } = SM;
  const { W, H, CAT, deg } = art;
  const DEBUG = /[?&]debug=1/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname); // 공개 사이트에선 꺼짐
  let SPEED = 1;
  const KEY = SM.SLUG + "-v3";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const br = (s) => esc(s).replace(/\n/g, "<br>");
  const num = (n) => Math.round(n).toLocaleString("ko-KR");

  // ---------- 저장(이 기기에만): 최고 점수·플레이 횟수·소리 ----------
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const D = Object.assign({ best: 0, plays: 0, sound: true }, load());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} };
  sound.setOn(D.sound);
  SM.FONT = (getComputedStyle(document.body).fontFamily || "sans-serif").replace(/;/g, "");

  // ---------- 화면 뼈대 ----------
  const ICON_SND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path class="w" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="x" d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor"/></svg>';
  root.innerHTML = `
<div class="sm-screen">
  <div class="sm-hud">
    <span class="sm-time" aria-label="남은 시간"><b>3:00</b></span>
    <span class="sm-chip">정답 <b class="sm-ans">0</b></span>
    <span class="sm-score" aria-label="점수"><b>0</b>점</span>
    <span class="sm-tools"><button type="button" class="sm-ib sm-snd" aria-label="소리 끄기" aria-pressed="true">${ICON_SND}</button><button type="button" class="sm-ib sm-pause" aria-label="일시정지">${ICON_PAUSE}</button></span>
  </div>
  <div class="sm-stage"><canvas class="sm-cv" aria-hidden="true"></canvas><div class="sm-toast" aria-hidden="true"></div></div>
  <button type="button" class="sm-hold" aria-describedby="sm-hold-d"><span class="sm-gauge" aria-hidden="true"><i></i>${GAUGE.map((g) => `<em style="left:${g.at * 100}%">${esc(g.label)}</em>`).join("")}</span><span class="sm-hold-t">꾹 누르면 치팅</span><small id="sm-hold-d">떼면 숨김 · PC는 Space·마우스</small></button>
  <p class="sr sm-live" aria-live="assertive"></p>
  <div class="sm-ov" hidden></div>
</div>`;
  const $ = (s) => root.querySelector(s);
  const scr = $(".sm-screen"), cv = $(".sm-cv"), ctx = cv.getContext("2d"), ov = $(".sm-ov"), holdBtn = $(".sm-hold");
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
  const G = { mode: "title", paused: false, pi: 0, t: 0, held: false, holdT: 0, gauge: 0, answers: 0, flash: 0, busted: 0, det: null, watchers: [], cones: [], steps: null, stepT: 0, toastT: 0, outcome: null };
  const phase = () => PHASES[G.pi];
  const scoreNow = () => Math.floor(G.holdT * SCORE.perSec) + G.answers * SCORE.answer;

  // ---------- 감독관(감시 장치) ----------
  const head = (w) => (w.kind === "cctv" ? { x: w.x - 4, y: w.y + 4 } : { x: w.x, y: w.y - (w.kind === "paper" ? 54 : 50) * w.s });
  const angTo = (w, px = CAT.x, py = CAT.y) => { const h = head(w); return Math.atan2(py - h.y, px - h.x); };
  function makeWatcher(kind) {
    if (kind === "ta") return { kind, role: "ta", x: 180, y: 118, s: 1, half: deg(17), range: 280, face: "back", dir: 1, look: Math.PI / 2, ang: Math.PI / 2, state: "off", q: [], act: null, at: 0 };
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
  function genTA(w) {
    const p = phase(), ac = angTo(w), sw = deg(34), fwd = Math.random() < 0.5;
    const a0 = ac + (fwd ? -sw : sw), a1 = ac + (fwd ? sw : -sw);
    let nx; do { nx = rnd(100, 245); } while (Math.abs(nx - w.x) < 40);
    w.q.push(A.idle(rnd(p.idle[0], p.idle[1]), { face: "back", chalk: true }), A.tell(p.tell, a0, a1));
    if (Math.random() < p.fake) w.q.push(A.idle(0.4, { face: "back" })); // 가짜 동작: 갸웃하다가 다시 칠판으로
    else w.q.push(A.look(rnd(1.8, 2.4), a0, a1), A.walk(nx, 118, 70));
  }
  const PAPER_ELSE = [deg(160), deg(169), deg(96)];
  function genPaper(w) {
    const p = phase();
    w.q.push(A.idle(rnd(p.idle[0] + 0.4, p.idle[1] + 0.8), { paper: "read" }));
    const r = Math.random();
    if (r < p.fake) w.q.push(A.rustle(0.9)); // 가짜 동작: 신문만 펄럭(점선 없음)
    else if (r < p.fake + 0.25) { const a = pick(PAPER_ELSE); w.q.push(A.tell(p.tell, a, a), A.look(1.4, a, a)); } // 다른 수험생 보기(점선이 다른 곳)
    else { const ac = angTo(w), j = deg(6); w.q.push(A.tell(p.tell, ac - j, ac + j), A.look(rnd(1.5, 2.1), ac - j, ac + j)); }
  }
  function genPatrol(w) {
    const p = phase(), left = Math.random() < 0.5, a = left ? 120 : 240, b = left ? 240 : 120;
    const ac = angTo(w), sw = deg(30);
    w.q.push(A.idle(0.8, { face: "front" }), A.tell(p.tell, ac - sw, ac + sw), A.look(1.8, ac - sw, ac + sw));
    w.q.push(A.walk(a, 120, 55, { face: "side" }));
    w.q.push(A.walk(a, 226, 46, { face: "front" })); // 통로를 걸을 때는 발밑만 봄(시선 없음). 냥이를 보는 건 모두 예고 뒤
    if (Math.random() < 0.35) { w.q.push(A.tell(p.tell, null, null, { toCat: true, face: "side" })); if (Math.random() > p.fake) w.q.push(A.look(1.1, null, null, { toCat: true, face: "side" })); } // 안경 검사 눈길(가끔 가짜)
    w.q.push(A.walk(a, 372, 46, { face: "front" }));
    w.q.push(A.tell(p.tell, -Math.PI / 2, -Math.PI / 2, { face: "back", fan: deg(20) }));
    w.q.push(A.walk(b, 372, 44, { face: "back", cone: -Math.PI / 2 }));
    w.q.push(A.walk(b, 120, 46, { face: "back" }));
    w.q.push(A.walk(180, 112, 55, { face: "side" }));
  }
  const GEN = { ta: genTA, paper: genPaper, patrol: genPatrol };
  function startAct(w) {
    if (!w.q.length) GEN[w.kind](w);
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
    if (!w.act) startAct(w);
    const a = w.act; w.at += dt;
    const k = Math.min(1, w.at / Math.max(0.001, a.dur));
    w.walk = false; w.bubble = null; w.chalk = 0;
    if (a.k === "idle") { w.state = "off"; if (a.face) w.face = a.face; if (w.kind === "paper") w.paper = "read"; if (a.chalk) w.chalk = k; }
    else if (a.k === "rustle") { w.state = "off"; w.paper = "rustle"; }
    else if (a.k === "tell") { w.state = "tell"; w.face = a.face || (w.kind === "ta" ? "side" : w.face); w.dir = Math.cos(a.a0) >= 0 ? 1 : -1; if (w.kind === "paper") w.paper = "fold"; w.bubble = "?"; }
    else if (a.k === "look") { w.state = "look"; w.ang = a.a0 + (a.a1 - a.a0) * k; w.look = w.ang; w.face = a.face || "front"; w.dir = Math.cos(w.ang) >= 0 ? 1 : -1; if (w.kind === "paper") w.paper = "down"; }
    else if (a.k === "walk") {
      w.x = a.from[0] + (a.to[0] - a.from[0]) * k; w.y = a.from[1] + (a.to[1] - a.from[1]) * k; w.walk = true;
      const dx = a.to[0] - a.from[0];
      w.face = a.face || "side"; if (Math.abs(dx) > 1) w.dir = dx > 0 ? 1 : -1;
      if (a.cone != null) { w.state = "look"; w.ang = a.cone; w.look = a.cone; } else w.state = "off";
    }
    if (w.at >= a.dur) startAct(w); // 다음 동작을 바로 시작(신호가 비는 프레임이 없게)
  }
  function coneOf(w) {
    const h = head(w);
    if (w.state === "look") return { x: h.x, y: h.y, ang: w.ang, half: w.half, range: w.range, w };
    if (w.state === "tell" && w.act && w.act.k === "tell") {
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
  function alarmAll() { // 전파 탐지기 경보: 감독관 모두 냥이 쪽으로(예고 뒤)
    G.watchers.forEach((w) => { if (w.kind === "ta" || w.kind === "paper") { w.q = [A.look(1.8, null, null, { toCat: true }), A.idle(0.5)]; w.act = null; w.q.unshift(A.tell(phase().tell, null, null, { toCat: true })); startAct(w); } });
  }

  // ---------- HUD ----------
  let lastHud = "";
  function hud() {
    const left = Math.max(0, Math.ceil(EXAM.T - G.t)), sc = scoreNow();
    const key = `${left}|${sc}|${G.answers}|${Math.round(G.gauge * 100)}|${G.held}`;
    if (key === lastHud) return; lastHud = key;
    const tm = $(".sm-time"); tm.querySelector("b").textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`; tm.classList.toggle("low", left <= 15);
    $(".sm-score b").textContent = num(sc); $(".sm-ans").textContent = G.answers;
    $(".sm-gauge i").style.width = G.gauge * 100 + "%";
    const gi = GAUGE.filter((g) => G.gauge >= g.at).length - 1;
    $(".sm-hold-t").textContent = G.held ? `${GAUGE[gi].label} 중… 감독관 보면 떼기!` : "꾹 누르면 치팅";
  }
  function sndBtn() { const b = $(".sm-snd"); b.setAttribute("aria-pressed", String(D.sound)); b.setAttribute("aria-label", D.sound ? "소리 끄기" : "소리 켜기"); b.classList.toggle("off", !D.sound); }
  let liveT = 0;
  function live(msg) { const now = performance.now(); if (now - liveT < 1500) return; liveT = now; $(".sm-live").textContent = msg; }
  function toast(msg, kind = "") { const t = $(".sm-toast"); t.textContent = msg; t.className = "sm-toast go " + kind; G.toastT = 1.6; }

  // ---------- 진행 ----------
  function addPhase(i) {
    G.pi = i;
    PHASES[i].add.forEach((k) => { const w = makeWatcher(k); if (w) G.watchers.push(w); if (k === "detector") G.det = { v: 0, alarm: 0 }; });
    scr.dataset.phase = i;
    if (i > 0) { toast(`새 감시: ${PHASES[i].name}!`, "warn"); live(`새 감시가 생겼어요: ${PHASES[i].name}`); sound.play("hmm"); }
  }
  function start() {
    sound.unlock();
    Object.assign(G, { mode: "play", paused: false, t: 0, held: false, holdT: 0, gauge: 0, answers: 0, flash: 0, busted: 0, det: null, watchers: [], cones: [], steps: null, outcome: null });
    D.plays++; save();
    closeOv(); addPhase(0); lastHud = ""; hud(); lastTs = 0;
    toast(`${EXAM.name} 시작! 3분 버티기`);
    scr.scrollIntoView && root.getBoundingClientRect().top < 0 && root.scrollIntoView({ block: "start" });
  }
  function caught(w) {
    const kind = G.det && G.det.alarm > 0 ? "alarm" : w.kind === "cctv" ? "camera" : "teacher";
    G.mode = "caught"; release(); G.flash = 1; G.busted = 1; if (w.kind !== "cctv") { w.bubble = "!"; w.state = "look"; w.ang = angTo(w); }
    sound.play("busted"); toast("들켰다! 퇴장!", "bad"); live("들켰어요! 퇴장");
    setTimeout(() => { sound.play("caught"); finish(kind); }, 1100 / SPEED);
  }
  function finish(kind) {
    const fin = kind === "finish";
    const hold = Math.floor(G.holdT * SCORE.perSec), ans = G.answers * SCORE.answer, bonus = fin ? SCORE.finish : 0;
    const score = Math.min(SCORE.max, hold + ans + bonus);
    const newBest = score > (D.best || 0); if (newBest) D.best = score; save();
    G.outcome = { kind, e: ENDS[kind], score, hold, ans, bonus, holdSec: Math.round(G.holdT * 10) / 10, sec: Math.round(G.t * 10) / 10, answers: G.answers, newBest };
    G.mode = "end"; release();
    if (fin) sound.play("end");
    endScreen(true);
  }
  function endScreen(report) {
    const o = G.outcome, e = o.e;
    openOv(`<div class="sm-card sm-end"><canvas class="sm-art" data-w="360" data-h="200" aria-hidden="true"></canvas>
<p class="sm-kicker">${e.kind === "out" ? `퇴장 · ${Math.floor(o.sec)}초 버팀` : "3분 완주"}</p><h3>${esc(e.name)}</h3>
<p class="sm-big"><b>${num(o.score)}</b>점${o.newBest ? ' <em class="sm-newe">최고 기록</em>' : ""}</p>
<p class="sm-rankline" aria-live="polite"></p>
<ul class="sm-stats"><li><b>${num(o.hold)}</b>누른 시간 ${o.holdSec}초</li><li><b>${num(o.ans)}</b>정답 ${o.answers}개</li><li><b>${num(o.bonus)}</b>완주 보너스</li></ul>
<p class="sm-story">${br(e.text)}</p><p class="sm-msg">${esc(MSG)}</p>
<div class="sm-btns"><button type="button" class="sm-btn" data-act="again" data-focus>다시 도전</button><button type="button" class="sm-btn ghost" data-act="share">결과 카드</button></div>
<div class="sm-rank rank-slot"></div>
<p class="sm-meta">이 기기 최고 점수: ${num(D.best || 0)}점</p>
<p class="sm-note">AI 시험 부정행위 논란을 풍자한 가상의 게임이에요. 실존 인물과 무관하며, 실제 시험에서 부정행위는 하지 마세요.</p></div>`, "end");
    setArt("end", e);
    const slot = ov.querySelector(".rank-slot");
    if (window.PT_RANK && slot) {
      const done = () => { const me = slot.querySelector(".rank-list li.me .rk"), wk = slot.querySelector('[data-kind="week"][aria-selected="true"]'); const line = ov.querySelector(".sm-rankline"); if (me && line) line.textContent = `${wk ? "이번 주" : "역대"} ${me.textContent}위`; };
      if (report) Promise.resolve(PT_RANK.report(SM.SLUG, o.score, slot)).then(done, () => {});
      else Promise.resolve(PT_RANK.render(slot, SM.SLUG, "week")).then(done, () => {});
      new MutationObserver(done).observe(slot, { childList: true, subtree: true });
    }
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
    G.mode = "title"; G.paused = false; release();
    openOv(`<div class="sm-card sm-title"><canvas class="sm-art" data-w="360" data-h="200" aria-hidden="true"></canvas>
<p class="sm-kicker">AI 시험 부정행위 풍자 게임 · 3분</p><h2 class="sm-logo">${esc(NAME)}</h2><p class="sm-subt">${esc(SUB)}</p>
<ol class="sm-rules"><li><b>꾹 누르면 치팅.</b> 찰칵 → 전송 → 정답 듣기 게이지가 차면 정답 1개.</li><li><b>감독관이 보면 바로 떼기.</b> 보는데 누르고 있으면 즉시 퇴장! 노란 점선·「?」는 곧 돌아본다는 신호.</li><li><b>3분 버티면 끝.</b> 오래 누를수록, 정답이 많을수록 점수가 높아요.</li></ol>
<div class="sm-btns"><button type="button" class="sm-btn" data-act="start" data-focus>시험 보러 가기</button></div>
${D.best ? `<p class="sm-meta">이 기기 최고 점수: ${num(D.best)}점</p>` : ""}
<p class="sm-note">휴대폰은 아래 큰 버튼을, PC는 Space나 마우스를 꾹 · 소리 나요(오른쪽 위에서 끄기) · 실존 인물과 무관한 가상의 이야기예요.</p></div>`, "title");
    setArt("title");
  }
  function pauseGame(why) {
    if (G.mode !== "play" || G.paused) return;
    G.paused = true; release();
    openOv(`<div class="sm-card sm-pause-c"><p class="sm-kicker">${why ? esc(why) : "일시정지"}</p><h3>잠깐 멈췄어요</h3><p class="sm-meta">남은 ${Math.max(0, Math.ceil(EXAM.T - G.t))}초 · ${num(scoreNow())}점</p>
<div class="sm-btns"><button type="button" class="sm-btn" data-act="resume" data-focus>계속하기</button><button type="button" class="sm-btn ghost" data-act="quit">처음 화면으로</button></div></div>`, "pause");
  }
  function resume() { closeOv(); G.paused = false; lastTs = 0; }

  // ---------- 결과 카드(9:16) ----------
  async function makeCard() {
    const o = G.outcome, e = o.e;
    const Wc = 720, Hc = 1280, c = document.createElement("canvas"); c.width = Wc; c.height = Hc;
    const x = c.getContext("2d");
    try { await document.fonts.load('40px "Black Han Sans"'); } catch (er) {}
    const DISP = `"Black Han Sans", ${SM.FONT}`;
    const g = x.createLinearGradient(0, 0, 0, Hc); g.addColorStop(0, "#fff4df"); g.addColorStop(1, e.kind === "end" ? "#ffd86b" : "#ffb4aa"); x.fillStyle = g; x.fillRect(0, 0, Wc, Hc);
    const T = (s, X, Y, size, col, font = SM.FONT, weight = 800) => { x.font = `${weight} ${size}px ${font}`; x.textAlign = "center"; x.textBaseline = "top"; x.fillStyle = col; x.fillText(s, X, Y); };
    T(NAME, Wc / 2, 60, 92, "#141414", DISP, 400);
    T(SUB, Wc / 2, 168, 34, "#c2281d");
    x.save(); art.rr(x, 40, 236, 640, 360, 28); x.clip(); x.translate(40, 236); x.scale(640 / 360, 640 / 360); art.ending(x, e, 1.2, 360, 202); x.restore();
    x.lineWidth = 6; x.strokeStyle = "#141414"; art.rr(x, 40, 236, 640, 360, 28); x.stroke();
    T(e.name, Wc / 2, 628, 60, "#141414", DISP, 400);
    T(`${num(o.score)}점`, Wc / 2, 720, 110, "#c2281d", DISP, 400);
    T(e.kind === "end" ? "3분 완주" : `${Math.floor(o.sec)}초 버티고 퇴장`, Wc / 2, 850, 34, "#3d3d3d");
    T(`누른 시간 ${o.holdSec}초 · 정답 ${o.answers}개`, Wc / 2, 902, 32, "#3d3d3d");
    T(MSG, Wc / 2, 1010, 36, "#141414");
    const site = document.documentElement.dataset.site || "펭귄 툴즈";
    T(`${site} · 오락실 · 실존 인물과 무관한 풍자 게임`, Wc / 2, 1196, 26, "#555");
    return c;
  }
  async function shareCard() {
    const c = await makeCard(); const url = c.toDataURL("image/png");
    const o = G.outcome, fn = `${SM.SLUG}-${o.score}`; // P2-72 「파일 이름」 칸(저장 창이 되는 PC는 창에서도 정함)
    G.mode = "share";
    openOv(`<div class="sm-card sm-share fname-scope"><img src="${url}" alt="${esc(NAME)} 결과 카드 미리보기" width="216" height="384">${window.NALGI && NALGI.nameFieldHtml ? NALGI.nameFieldHtml({ def: fn, ext: "png", id: "sm-fname" }) : ""}<div class="sm-btns"><a class="sm-btn" href="${url}" download="${fn}.png" data-dl data-dl-for="sm-fname" data-dl-ext="png" data-focus>이미지 저장</a><button type="button" class="sm-btn ghost" data-act="sys-share" hidden>공유하기</button><button type="button" class="sm-btn ghost" data-act="shareback">돌아가기</button></div><p class="fname-status sm-note" aria-live="polite"></p><p class="sm-note">카드에는 이름 같은 개인정보가 들어가지 않아요.</p></div>`, "share");
    const sb = ov.querySelector('[data-act="sys-share"]');
    c.toBlob((blob) => {
      if (!blob) return;
      if (window.NALGI && NALGI.bindBlob) NALGI.bindBlob(ov.querySelector("a[data-dl]"), blob);
      const file = new File([blob], `${SM.SLUG}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { sb.hidden = false; sb.onclick = () => navigator.share({ files: [file], title: NAME, text: `${NAME} ${num(o.score)}점` }).catch(() => {}); }
    }, "image/png");
  }

  // ---------- 입력: 꾹 누르기 하나 ----------
  function press() { if (G.mode !== "play" || G.paused || G.held) return; G.held = true; if (G.gauge < GAUGE[1].at) sound.play("snap"); holdBtn.classList.add("on"); scr.classList.add("using"); }
  function release() { G.held = false; holdBtn.classList.remove("on"); scr.classList.remove("using"); sound.typingOn(false); }
  [holdBtn, cv].forEach((el) => {
    el.addEventListener("pointerdown", (e) => { if (e.button > 0) return; e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (er) {} press(); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((n) => el.addEventListener(n, () => release()));
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  });
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a !== "sys-share") sound.play("click");
    if (a === "start" || a === "again") start();
    else if (a === "resume") resume();
    else if (a === "quit") titleScreen();
    else if (a === "share") shareCard();
    else if (a === "shareback") { G.mode = "end"; endScreen(false); }
  });
  $(".sm-snd").addEventListener("click", (e) => { e.stopPropagation(); D.sound = !D.sound; save(); sound.setOn(D.sound); if (D.sound) sound.unlock(); sndBtn(); });
  $(".sm-pause").addEventListener("click", (e) => { e.stopPropagation(); if (G.mode === "play") { if (G.paused) resume(); else pauseGame(); } });
  const inView = () => { const r = scr.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input,textarea,select")) return;
    if (!inView() || G.mode !== "play" || G.paused) return;
    if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); if (!e.repeat) press(); }
    else if (e.key === "Escape" || e.key === "p" || e.key === "P") { e.preventDefault(); pauseGame(); }
  });
  document.addEventListener("keyup", (e) => { if ((e.key === " " || e.key === "Spacebar") && G.held) { e.preventDefault(); release(); } });
  // 탭 숨김·창 전환·창 너비 변경 → 일시정지(휴대폰 주소창이 접히며 높이만 바뀌는 것은 무시)
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseGame("탭을 벗어나서 멈췄어요"); });
  window.addEventListener("blur", () => { if (!DEBUG) pauseGame("창을 벗어나서 멈췄어요"); });
  let lastW = innerWidth;
  window.addEventListener("resize", () => { if (Math.abs(innerWidth - lastW) > 1) { lastW = innerWidth; pauseGame("화면 크기가 바뀌어서 멈췄어요"); } fitAll(); });

  // ---------- 한 프레임 ----------
  function update(dt) {
    if (G.toastT > 0) { G.toastT -= dt; if (G.toastT <= 0) $(".sm-toast").className = "sm-toast"; }
    G.flash = Math.max(0, G.flash - dt * 2.5);
    if (bot) botStep(dt);
    G.t += dt;
    const next = PHASES.findIndex((p, i) => i > G.pi && G.t >= p.from); if (next > 0) addPhase(next);
    G.watchers.forEach((w) => stepWatcher(w, dt));
    if (G.held) {
      const g0 = G.gauge; G.holdT += dt; G.gauge += dt / EXAM.fill;
      if (g0 < GAUGE[1].at && G.gauge >= GAUGE[1].at) sound.play("send"); else if (g0 < GAUGE[2].at && G.gauge >= GAUGE[2].at) sound.play("ready");
      if (G.gauge >= 1) { G.gauge -= 1; G.answers++; sound.play("solve"); toast(`정답 1개 획득! +${SCORE.answer}`); }
    }
    sound.typingOn(G.held && G.gauge >= GAUGE[2].at);
    if (G.det) {
      if (G.det.alarm > 0) G.det.alarm -= dt;
      if (G.held) G.det.v += 22 * dt; else G.det.v = Math.max(0, G.det.v - 25 * dt);
      if (G.det.v >= 100) { G.det.v = 0; G.det.alarm = 3.2; alarmAll(); sound.play("alarm"); toast("전파 탐지기 경보! 손 떼!", "bad"); live("전파 탐지기 경보! 모두 돌아봐요"); }
    }
    G.cones = G.watchers.map(coneOf).filter(Boolean);
    // 발소리(안경 검사 펭귄)
    const pt = G.watchers.find((w) => w.kind === "patrol");
    G.steps = null;
    if (pt && pt.walk) {
      const d = Math.hypot(pt.x - CAT.x, pt.y - CAT.y), near = Math.max(0, 1 - d / 170);
      if (pt.y > 230) G.steps = { x: pt.x, near };
      G.stepT -= dt; if (G.stepT <= 0) { G.stepT = 0.42; if (near > 0.05) sound.play("step", 0.3 + near * 0.9); }
    }
    if (G.held) { for (const c of G.cones) if (!c.kind && inCone(c)) { c.hot = true; caught(c.w); return; } }
    if (G.t >= EXAM.T) { G.t = EXAM.T; hud(); finish("finish"); return; }
    hud();
  }
  function draw(t) {
    const p = phase();
    const ta = G.watchers.find((w) => w.kind === "ta");
    const cam = G.watchers.find((w) => w.kind === "cctv");
    const watchers = G.watchers.filter((w) => w.kind !== "cctv").map((w) => ({ ...w, t }));
    const cones = (G.cones || []).map((c) => ({ ...c, w: null, hot: !c.kind && inCone(c) }));
    if (cam) { const ac = Math.atan2(CAT.y - cam.y, CAT.x - cam.x); cam.warn = Math.abs(wrapA(cam.ang - ac)) < deg(26); }
    const gi = GAUGE.filter((g) => G.gauge >= g.at).length - 1;
    art.scene(ctx, {
      t, theme: p.theme, boardTitle: EXAM.name, boardSub: p.board, chalk: ta ? ta.chalk : 0, sleepy: PHASES.slice(0, G.pi + 1).some((q) => q.add.includes("sleepy")),
      timeFrac: 1 - G.t / EXAM.T, watchers, cones,
      cat: { pose: G.mode === "caught" ? "busted" : G.held ? (gi === 0 ? "write" : "ai") : "write", tool: gi === 2 ? "earbud" : "phone", exposed: G.held && gi > 0, using: G.held && gi > 0, busted: G.mode === "caught" ? 1 : 0, sweat: G.held ? 0.6 : 0,
        snap: G.held && gi === 0 ? Math.max(0.05, G.gauge * 3) : 0, say: G.held ? GAUGE[gi].say : "" },
      detector: G.det, steps: G.steps, cctv: cam ? { x: cam.x, y: cam.y, ang: cam.ang, warn: cam.warn } : null, flash: G.flash, alarm: G.det && G.det.alarm > 0,
    });
  }
  function drawOvArt(t) {
    if (!ovArt || !ovArtKind) return;
    const r = ovArt.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    const x = ovArt.getContext("2d"), w = +ovArt.dataset.w, h = +ovArt.dataset.h;
    x.save(); x.beginPath(); x.rect(0, 0, w, h); x.clip();
    if (ovArtKind === "title") { x.fillStyle = "#fff4df"; x.fillRect(0, 0, w, h); x.translate((w - 360 * h / 300) / 2, 0); x.scale(h / 300, h / 300); art.title(x, t); } // 첫 화면은 그림을 줄여 시작 버튼이 한 화면에 보이게
    else if (ovArtKind === "end" && ovArtE) art.ending(x, ovArtE, t, w, h);
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
    if (G.mode === "play" || G.mode === "caught") draw(t);
    drawOvArt(t);
  }

  // ---------- 시작 ----------
  let bot = null;
  fitAll(); sndBtn();
  G.watchers = [makeWatcher("ta")]; draw(0); G.watchers = [];
  hud(); titleScreen();
  root.classList.add("ready");
  requestAnimationFrame(frame);

  // ---------- 디버그·자동 플레이(localhost + ?debug=1 일 때만) ----------
  // 봇: 위험(예고·시선·곧 지나갈 CCTV·뒤로 오는 순찰·탐지기 눈금)이 보이면 react초 뒤에 손을 떼고, 안전하면 다시 누름
  function danger() {
    for (const w of G.watchers) {
      if (w.kind === "cctv") { const h = head(w), d = Math.hypot(CAT.x - h.x, CAT.y - h.y), ac = Math.atan2(CAT.y - h.y, CAT.x - h.x), sp = deg(G.pi === 3 ? 34 : 30), m = w.half + Math.atan2(CAT.r, d) + deg(5);
        const move = Math.max(0, 0.6 - Math.max(0, w.pause)) * sp, end = Math.max(w.lo, Math.min(w.hi, w.ang + w.va * move)); if (ac >= Math.min(w.ang, end) - m && ac <= Math.max(w.ang, end) + m) return true; continue; }
      const c = coneOf(w);
      if (c && inCone(c, CAT.x, CAT.y, CAT.r, deg(6))) return true;
      if (w.state === "look" && w.act && w.act.k === "look") { const a1 = w.act.a1, h = head(w); if (inCone({ x: h.x, y: h.y, ang: (w.ang + a1) / 2, half: Math.abs(a1 - w.ang) / 2 + w.half, range: w.range }, CAT.x, CAT.y, CAT.r, deg(6))) return true; }
    }
    if (G.det && (G.det.v > 70 || G.det.alarm > 0)) return true;
    return false;
  }
  function botStep(dt) {
    if (bot.mode === "honest") return; // 한 번도 안 누름
    if (bot.mode === "reckless") { press(); return; }
    if (danger()) { bot.safe = 0; bot.d += dt; if (bot.d >= bot.react) release(); }
    else { bot.d = 0; bot.safe += dt; if (bot.safe > 0.15 && !(G.det && G.det.v > 20 && !G.held && bot.cool)) press(); }
    if (G.det) bot.cool = G.det.v > 70 ? true : G.det.v < 10 ? false : bot.cool;
  }
  if (DEBUG) {
    const idle = async (pred, limit = 600000) => { const t0 = Date.now(); while (!pred()) { if (Date.now() - t0 > limit) return false; await new Promise((r) => setTimeout(r, 20)); } return true; };
    window.EXCAT_DEBUG = {
      speed(v) { SPEED = v; },
      bot(mode = "smart", opt = {}) { bot = mode ? { mode, react: opt.react == null ? 0.25 : opt.react, d: 0, safe: 0, cool: false } : null; },
      state: () => ({ mode: G.mode, paused: G.paused, pi: G.pi, t: G.t, held: G.held, holdT: G.holdT, gauge: G.gauge, answers: G.answers, score: scoreNow(), outcome: G.outcome && { ...G.outcome, e: undefined }, sound: sound.state }),
      async run({ read = 300 } = {}) {
        await new Promise((r) => setTimeout(r, read));
        if (G.mode === "title" || G.mode === "end") (ov.querySelector('[data-act="start"],[data-act="again"]') || {}).click();
        await idle(() => G.mode === "end");
        return this.state();
      },
      start: () => start(),
      at(sec) { start(); G.t = sec; PHASES.forEach((p, i) => { if (i > 0 && p.from <= sec) addPhase(i); }); },
      showEnd(kind, o = {}) { if (G.mode !== "play") start(); G.holdT = o.holdT == null ? 61.3 : o.holdT; G.answers = o.answers == null ? 15 : o.answers; G.t = o.t == null ? 97.4 : o.t; finish(kind); },
      press: () => press(), release: () => release(),
      makeCard: () => makeCard(),
      G, D,
    };
  }
})();
