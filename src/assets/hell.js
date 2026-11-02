// 지옥에서 살아남기 (Hell Survival 31) — 게임 진행 (P2-27)
// 31단계 A/B 선택. 정답 위치는 판마다 섞음. 체크포인트 9·18·26단계. 사망 도감 31장(localStorage), 9:16 공유 카드. 서버 전송 0.
(function () {
  const H = window.HELL;
  const root = document.getElementById("hell");
  if (!root || !H || !H.art) return;
  const { art, sound, STAGES, FLOORS, QUIPS, TITLES } = H;
  const DEBUG = /[?&]debug=1/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname); // 공개 사이트에선 꺼짐
  let SPEED = 1; // 디버그에서만 바꿈
  const KEY = "hell31-v1";
  const CPS = [1, 9, 18, 26];
  const floorOf = (n) => FLOORS.find((f) => n >= f.from && n <= f.to);
  const cpOf = (n) => CPS.filter((c) => c <= n).pop();
  const pad = (n) => String(n).padStart(2, "0");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms / SPEED));

  // ---------- 저장(이 브라우저에만) ----------
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const S = Object.assign({ got: {}, best: 0, clears: 0, deaths: 0, sound: true, cp: 1, last: 0, bestClear: null }, load());
  sound.setOn(S.sound);

  // ---------- 화면 뼈대 ----------
  const ICON_SND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path class="w" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="x" d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON_BOOK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-5a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  root.innerHTML = `
<div class="hl-screen" tabindex="-1">
  <div class="hl-hud">
    <span class="hl-floor" data-f="1">1층 초입</span>
    <span class="hl-stg">STAGE <b>01</b><small>/31</small></span>
    <span class="hl-dc" title="이번 판 사망 횟수">사망 <b>0</b></span>
    <span class="hl-tools"><button type="button" class="hl-ib hl-snd" aria-label="소리 끄기" aria-pressed="true">${ICON_SND}</button><button type="button" class="hl-ib hl-bookbtn" aria-label="사망 도감">${ICON_BOOK}</button></span>
  </div>
  <div class="hl-pips" aria-hidden="true">${STAGES.map((s) => `<i${CPS.includes(s.n) ? ' class="cp"' : ""}></i>`).join("")}</div>
  <div class="hl-stage"><canvas class="hl-cv" width="${art.W}" height="${art.H}" aria-hidden="true"></canvas><div class="hl-fcard" hidden></div><div class="hl-flash"></div></div>
  <div class="hl-sub" aria-live="polite"><span class="hl-tag"></span><p class="hl-say"></p><p class="hl-safe" hidden>※ 게임 속 설정이에요. 현실에서 따라 하지 마세요.</p></div>
  <div class="hl-cards">
    <button type="button" class="hl-card" data-k="0"><span class="hl-ab">A</span><canvas class="hl-ic" width="14" height="14" aria-hidden="true"></canvas><span class="hl-ct"></span></button>
    <button type="button" class="hl-card" data-k="1"><span class="hl-ab">B</span><canvas class="hl-ic" width="14" height="14" aria-hidden="true"></canvas><span class="hl-ct"></span></button>
  </div>
  <div class="hl-ov" hidden></div>
</div>`;
  const $ = (s) => root.querySelector(s);
  const scr = $(".hl-screen"), cvs = $(".hl-cv"), ctx = cvs.getContext("2d"), stageBox = $(".hl-stage"), ov = $(".hl-ov");
  const cards = [...root.querySelectorAll(".hl-card")];
  ctx.imageSmoothingEnabled = false;
  const fitOv = () => { ov.style.top = ($(".hl-hud").offsetHeight + $(".hl-pips").offsetHeight) + "px"; };
  fitOv(); addEventListener("resize", fitOv); if (document.fonts) document.fonts.ready.then(fitOv);

  // ---------- 상태 ----------
  const G = { mode: "title", n: 1, order: {}, runDeaths: 0, t0: 0, anim: 0, lock: true, trans: null, lastDeath: 0, started: false };
  const shuffle = () => { G.order = {}; STAGES.forEach((s) => { G.order[s.n] = Math.random() < 0.5 ? 0 : 1; }); }; // order = 살아남는 선택이 놓일 카드(0=A, 1=B)
  const stage = () => STAGES[G.n - 1];
  const now = () => performance.now() / 1000;

  // ---------- 그리기 루프(30fps) ----------
  let lastDraw = 0, snap = null;
  const pxc = document.createElement("canvas");
  const off = document.createElement("canvas"); off.width = art.W; off.height = art.H; const offx = off.getContext("2d");
  function drawMode(x, t) {
    if (G.mode === "title") art.drawTitle(x, t);
    else if (G.mode === "ending") art.drawEnding(x, t - G.anim);
    else if (G.mode === "win") art.drawStage(x, stage(), t, { kind: "win", t: Math.min(1, ((t - G.anim) * SPEED) / 0.75) });
    else if (G.mode === "death" || G.mode === "dead") art.drawStage(x, stage(), t, { kind: "death", t: Math.min(1, ((t - G.anim) * SPEED) / 0.9) });
    else art.drawStage(x, stage(), t);
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    if (ts - lastDraw < 32) return;
    lastDraw = ts;
    if (!inView) return;
    const t = now();
    const tr = G.trans;
    if (!tr) { drawMode(ctx, t); return; }
    const k = Math.min(1, ((t - tr.t0) * SPEED) / tr.dur);
    drawMode(offx, t);
    ctx.save(); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, art.W, art.H);
    if (tr.type === "shake") { const a = (1 - k) * 4; ctx.drawImage(off, Math.round((Math.random() * 2 - 1) * a), Math.round((Math.random() * 2 - 1) * a * 1.5)); if (k < 0.15) { ctx.globalAlpha = 1 - k / 0.15; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, art.W, art.H); } }
    else if (tr.type === "red") { const a = k < 0.2 ? 2 : (1 - k) * 2; ctx.drawImage(off, Math.round((Math.random() * 2 - 1) * a), 0); ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = `rgba(255,${Math.round(40 + k * 215)},${Math.round(40 + k * 215)},1)`; ctx.fillRect(0, 0, art.W, art.H); ctx.globalCompositeOperation = "source-over"; if (k < 0.12) { ctx.fillStyle = "rgba(255,40,30,0.6)"; ctx.fillRect(0, 0, art.W, art.H); } }
    else if (tr.type === "noise") { const px = Math.max(1, Math.round((1 - k) * 16)); const sw = Math.ceil(art.W / px), sh = Math.ceil(art.H / px); const src = k < 0.4 && snap ? snap : off; pxc.width = sw; pxc.height = sh; const pq = pxc.getContext("2d"); pq.imageSmoothingEnabled = true; pq.drawImage(src, 0, 0, sw, sh); ctx.imageSmoothingEnabled = false; ctx.drawImage(pxc, 0, 0, sw, sh, 0, 0, art.W, art.H); const n = Math.round((1 - k) * 900); for (let i = 0; i < n; i++) { const v = Math.random() * 255 | 0; ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(Math.random() * art.W | 0, Math.random() * art.H | 0, 1, 1); } for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? "rgba(63,240,255,.4)" : "rgba(255,63,216,.4)"; ctx.fillRect(0, Math.random() * art.H | 0, art.W, 2); } }
    else if (tr.type === "tear") { ctx.drawImage(off, 0, 0); if (snap) { const d = Math.pow(k, 1.6) * 90; const half = (side) => { ctx.save(); ctx.translate(side * d, 0); ctx.beginPath(); const sx = side < 0 ? 0 : art.W; ctx.moveTo(sx, 0); for (let y = 0; y <= art.H; y += 6) ctx.lineTo(80 + ((y / 6) % 2 ? 3 : -3), y); ctx.lineTo(sx, art.H); ctx.closePath(); ctx.clip(); ctx.drawImage(snap, 0, 0); ctx.restore(); }; half(-1); half(1); } }
    ctx.restore();
    if (k >= 1) { G.trans = null; }
  }
  let inView = true;
  if ("IntersectionObserver" in window) new IntersectionObserver((es) => { inView = es[0].isIntersecting; }, { rootMargin: "100px" }).observe(cvs);
  requestAnimationFrame(frame);

  // ---------- HUD·카드 ----------
  function hud() {
    const f = floorOf(G.n);
    const fl = $(".hl-floor"); fl.textContent = `${f.no}층 ${f.name}`; fl.dataset.f = f.no; scr.dataset.f = f.no;
    $(".hl-stg b").textContent = pad(G.n);
    $(".hl-dc b").textContent = G.runDeaths;
    root.querySelectorAll(".hl-pips i").forEach((p, i) => { p.classList.toggle("on", i < G.n - 1); p.classList.toggle("now", i === G.n - 1); });
    const snd = $(".hl-snd"); snd.setAttribute("aria-pressed", String(S.sound)); snd.setAttribute("aria-label", S.sound ? "소리 끄기" : "소리 켜기"); snd.classList.toggle("off", !S.sound);
  }
  function drawIcon(c, key) { const x = c.getContext("2d"); x.clearRect(0, 0, 14, 14); x.imageSmoothingEnabled = false; x.drawImage(art.icon(key), 0, 0); }
  function showStage() {
    const s = stage(), okAt = G.order[s.n];
    $(".hl-tag").textContent = `STAGE ${pad(s.n)}`;
    $(".hl-say").textContent = s.title;
    $(".hl-say").className = "hl-say";
    $(".hl-safe").hidden = !s.safe;
    cards.forEach((c, k) => { const ch = k === okAt ? s.ok : s.ng; c.querySelector(".hl-ct").textContent = ch.t; drawIcon(c.querySelector(".hl-ic"), ch.icon); c.disabled = false; c.classList.remove("pick", "dim"); c.dataset.ok = k === okAt ? "1" : "0"; });
    root.querySelector(".hl-cards").classList.remove("idle");
    G.mode = "stage"; G.lock = false; hud();
  }
  function setCardsIdle(text) { root.querySelector(".hl-cards").classList.add("idle"); $(".hl-tag").textContent = ""; $(".hl-say").textContent = text || ""; $(".hl-safe").hidden = true; }

  // ---------- 진행 ----------
  async function enterStage(n, { fx = true, quick = false } = {}) {
    G.n = n; G.lock = true; hud();
    const f = floorOf(n);
    sound.bgm("f" + f.no);
    if (fx && CPS.includes(n)) await floorTransition(f, quick);
    showStage();
  }
  async function floorTransition(f, quick) {
    snap = document.createElement("canvas"); snap.width = art.W; snap.height = art.H; snap.getContext("2d").drawImage(cvs, 0, 0);
    G.mode = "stage";
    const dur = quick ? 0.6 : { shake: 1.1, red: 1.0, noise: 1.1, tear: 1.2 }[f.fx];
    G.trans = { type: f.fx, t0: now(), dur };
    sound.play({ shake: "shake", red: "thud", noise: "noise", tear: "tear" }[f.fx]);
    if (f.fx === "red" && !quick) setTimeout(() => sound.play("laugh"), 700 / SPEED);
    if (f.fx === "shake") { scr.classList.remove("hl-shake"); void scr.offsetWidth; scr.classList.add("hl-shake"); }
    const fc = $(".hl-fcard");
    fc.innerHTML = `<b>${f.no}층 · ${esc(f.name)}</b><span>${esc(f.sub)}</span><small>STAGE ${pad(f.from)}–${pad(f.to)}</small>`;
    fc.dataset.f = f.no; fc.hidden = false; fc.classList.remove("go"); void fc.offsetWidth; fc.classList.add("go");
    setCardsIdle("");
    await wait((quick ? 0.7 : dur + 0.35) * 1000);
    fc.hidden = true;
  }
  function startRun(from = 1) {
    sound.unlock();
    shuffle();
    G.runDeaths = from === 1 ? 0 : G.runDeaths;
    if (from === 1) G.t0 = Date.now();
    G.started = true;
    closeOv();
    enterStage(from);
  }
  async function choose(k) {
    if (G.lock || G.mode !== "stage") return;
    G.lock = true;
    const s = stage(), ok = k === G.order[s.n];
    cards.forEach((c, i) => { c.disabled = true; c.classList.toggle("pick", i === k); c.classList.toggle("dim", i !== k); });
    G.anim = now();
    if (ok) {
      G.mode = "win"; sound.play("fanfare");
      $(".hl-tag").textContent = "생존!"; $(".hl-say").textContent = s.ok.msg; $(".hl-say").className = "hl-say ok";
      flash("ok");
      await wait(1250);
      if (s.n === 31) return ending();
      if (s.n + 1 > S.best) { S.best = s.n + 1; }
      if (CPS.includes(s.n + 1)) { S.cp = s.n + 1; }
      save();
      enterStage(s.n + 1);
    } else {
      G.mode = "death"; sound.play("death");
      $(".hl-tag").textContent = "사망"; $(".hl-say").textContent = s.ng.t; $(".hl-say").className = "hl-say ng";
      setTimeout(() => { flash("ng"); scr.classList.remove("hl-shake"); void scr.offsetWidth; scr.classList.add("hl-shake"); }, 300 / SPEED);
      await wait(1000);
      G.mode = "dead";
      const first = !S.got[s.n];
      S.got[s.n] = (S.got[s.n] || 0) + 1; S.deaths++; S.last = s.n; G.runDeaths++; G.lastDeath = s.n;
      save(); hud();
      deathCard(s, first);
    }
  }
  function flash(kind) { const f = $(".hl-flash"); f.className = "hl-flash " + kind; void f.offsetWidth; f.classList.add("go"); }

  // ---------- 오버레이 ----------
  function openOv(html, cls = "") { ov.className = "hl-ov " + cls; ov.innerHTML = html; ov.hidden = false; ov.scrollTop = 0; const b = ov.querySelector("[data-focus]") || ov.querySelector("button"); if (b) b.focus({ preventScroll: true }); }
  function closeOv() { ov.hidden = true; ov.innerHTML = ""; }
  const gotN = () => Object.keys(S.got).length;
  function titleScreen() {
    G.mode = "title"; G.lock = true; G.started = false;
    setCardsIdle("");
    hud(); $(".hl-floor").textContent = "지옥 입구"; scr.dataset.f = "0";
    const cont = S.cp > 1 ? `<button type="button" class="hl-btn ghost" data-act="cont">이어 하기 · STAGE ${pad(S.cp)}부터</button>` : "";
    openOv(`<div class="hl-title"><p class="hl-kicker">HELL SURVIVAL 31</p><h2 class="hl-logo">지옥에서<br>살아남기</h2><p class="hl-desc">A와 B 중 하나는 살고, 하나는 죽는다.<br>상식대로 고르면… 아마 죽는다.</p>
<div class="hl-btns"><button type="button" class="hl-btn" data-act="start" data-focus>${S.cp > 1 ? "처음부터 시작" : "지옥 입장"}</button>${cont}<button type="button" class="hl-btn ghost" data-act="book">사망 도감 ${gotN()}/31</button></div>
<p class="hl-note">※ 모든 선택지는 게임 속 설정이에요. 현실에서 따라 하지 마세요.<br>소리 나요(오른쪽 위에서 끄기) · 피 없는 만화식 연출</p></div>`, "title");
  }
  function deathCard(s, first) {
    const q = QUIPS[Math.floor(Math.random() * QUIPS.length)];
    const cp = cpOf(s.n);
    openOv(`<div class="hl-dead"><p class="hl-dno">사망 카드 #${pad(s.n)}${first ? ' <em class="hl-new">NEW</em>' : ""}</p><h3>${esc(s.death.name)}</h3><p class="hl-ddesc">${esc(s.death.desc)}</p><p class="hl-quip">“${esc(q)}”</p>
<p class="hl-dmeta">이번 판 사망 ${G.runDeaths}회 · 도감 ${gotN()}/31</p>
<div class="hl-btns"><button type="button" class="hl-btn" data-act="retry" data-focus>다시 도전 · STAGE ${pad(cp)}부터</button><div class="hl-row"><button type="button" class="hl-btn ghost" data-act="share" data-n="${s.n}">억울한 죽음 카드</button><button type="button" class="hl-btn ghost" data-act="book">도감</button></div></div><div class="rank-slot"></div></div>`, "dead");
    window.PT_RANK && PT_RANK.report("hell", PT_RANK.score.hell({ stage: s.n }), ov.querySelector(".rank-slot"));
  }
  async function ending() {
    G.mode = "ending"; G.anim = now(); G.lock = true; setCardsIdle("염라대왕이 환생 버튼을 눌렀다!");
    sound.bgm(null); sound.play("clear");
    const sec = Math.round((Date.now() - G.t0) / 1000);
    S.clears++; S.cp = 1; S.best = 32;
    if (!S.bestClear || G.runDeaths < S.bestClear.d) S.bestClear = { d: G.runDeaths, s: sec };
    save();
    await wait(2600);
    const title = TITLES.find(([max]) => G.runDeaths <= max)[1];
    G.clear = { d: G.runDeaths, s: sec, title };
    openOv(`<div class="hl-dead hl-clear"><p class="hl-dno">31단계 클리어</p><h3>환생 성공!</h3><p class="hl-ddesc">칭호: <b>${esc(title)}</b></p>
<p class="hl-dmeta">사망 ${G.runDeaths}회 · ${Math.floor(sec / 60)}분 ${sec % 60}초 · 도감 ${gotN()}/31</p>${gotN() < 31 ? `<p class="hl-quip">아직 못 본 죽음이 ${31 - gotN()}가지 남았어요. 일부러 죽어 보는 것도 방법!</p>` : `<p class="hl-quip">사망 도감 31장 완성! 당신이 진정한 지옥 박사입니다.</p>`}
<div class="hl-btns"><button type="button" class="hl-btn" data-act="start" data-focus>다시 하기</button><div class="hl-row"><button type="button" class="hl-btn ghost" data-act="share" data-n="clear">클리어 카드</button><button type="button" class="hl-btn ghost" data-act="book">도감</button></div></div><div class="rank-slot"></div></div>`, "dead clear");
    window.PT_RANK && PT_RANK.report("hell", PT_RANK.score.hell({ clear: true, deaths: G.runDeaths }), ov.querySelector(".rank-slot"));
  }
  // 사망 도감
  const thumbs = {};
  function book(back) {
    const prev = back || (G.mode === "title" ? "title" : G.mode === "dead" ? "dead" : G.mode === "ending" ? "ending" : "stage");
    G.bookBack = prev; G.lockBefore = G.lock; G.lock = true;
    openOv(`<div class="hl-book"><div class="hl-bhead"><h3>사망 도감 <small>${gotN()}/31</small></h3><button type="button" class="hl-x" data-act="close" aria-label="도감 닫기" data-focus>닫기</button></div>
<ol class="hl-grid">${STAGES.map((s) => { const c = S.got[s.n]; return `<li><button type="button" class="hl-dc2${c ? " got" : ""}" data-act="detail" data-n="${s.n}" ${c ? "" : "disabled"}><span class="hl-thumb" data-n="${s.n}"></span><b>#${pad(s.n)}</b><span>${c ? esc(s.death.name) : "???"}</span>${c ? `<small>${c}회</small>` : `<small>STAGE ${pad(s.n)}</small>`}</button></li>`; }).join("")}</ol>
<p class="hl-note">기록은 이 브라우저에만 저장돼요. <button type="button" class="hl-link" data-act="reset">도감 초기화</button></p></div>`, "book");
    ov.querySelectorAll(".hl-thumb").forEach((el) => { const n = +el.dataset.n; if (!S.got[n]) return; if (!thumbs[n]) thumbs[n] = art.deathThumb(STAGES[n - 1]); const c = document.createElement("canvas"); c.width = art.W; c.height = art.H; c.getContext("2d").drawImage(thumbs[n], 0, 0); el.appendChild(c); });
  }
  function closeBook() {
    const b = G.bookBack; closeOv();
    if (b === "title") return titleScreen();
    if (b === "dead") return deathCard(stage(), false);
    if (b === "ending" && G.clear) return ending();
    G.lock = G.lockBefore;
  }
  function detail(n) {
    const s = STAGES[n - 1];
    if (!thumbs[n]) thumbs[n] = art.deathThumb(s);
    openOv(`<div class="hl-dead hl-detail"><p class="hl-dno">사망 카드 #${pad(n)} · ${S.got[n]}회</p><div class="hl-dthumb"></div><h3>${esc(s.death.name)}</h3><p class="hl-ddesc">STAGE ${pad(n)} 「${esc(s.title)}」에서 「${esc(s.ng.t)}」를 골랐다.<br>${esc(s.death.desc)}</p>
<div class="hl-btns"><button type="button" class="hl-btn" data-act="share" data-n="${n}" data-focus>이 죽음으로 공유 카드</button><button type="button" class="hl-btn ghost" data-act="bookback">도감으로</button></div></div>`, "detail");
    const c = document.createElement("canvas"); c.width = art.W; c.height = art.H; c.getContext("2d").drawImage(thumbs[n], 0, 0); ov.querySelector(".hl-dthumb").appendChild(c);
  }

  // ---------- 9:16 공유 카드 ----------
  function wrap(x, text, maxW) { const out = []; let line = ""; for (const ch of text) { if (ch === "\n") { out.push(line); line = ""; continue; } const tl = line + ch; if (x.measureText(tl).width > maxW && line) { out.push(line); line = ch; } else line = tl; } if (line) out.push(line); return out; }
  async function makeCard(n) {
    const Wc = 720, Hc = 1280, c = document.createElement("canvas"); c.width = Wc; c.height = Hc;
    const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
    try { await document.fonts.load('700 40px "Galmuri11"'); } catch (e) {}
    const FONT = '"Galmuri11", "Pretendard Variable", sans-serif';
    const clear = n === "clear";
    const s = clear ? STAGES[30] : STAGES[n - 1];
    const g = x.createLinearGradient(0, 0, 0, Hc); g.addColorStop(0, clear ? "#2a1a40" : "#3a0608"); g.addColorStop(1, "#0c0204"); x.fillStyle = g; x.fillRect(0, 0, Wc, Hc);
    for (let i = 0; i < 60; i++) { x.fillStyle = i % 2 ? "#ff5a1a" : "#ffc21a"; x.globalAlpha = 0.5; x.fillRect((i * 97) % Wc, (i * 211) % Hc, 6, 6); } x.globalAlpha = 1;
    const out = (t, X, Y, size, col = "#fff", align = "center") => { x.font = `700 ${size}px ${FONT}`; x.textAlign = align; x.textBaseline = "top"; x.lineJoin = "round"; x.lineWidth = Math.max(6, size / 6); x.strokeStyle = "#000"; x.strokeText(t, X, Y); x.fillStyle = col; x.fillText(t, X, Y); };
    out("지옥에서 살아남기", Wc / 2, 70, 44, "#ffc21a");
    out(clear ? "환생 성공 인증" : "가장 억울한 죽음", Wc / 2, 140, 64, clear ? "#3ff0ff" : "#fff");
    // 그림(160x120 → 640x480)
    const pic = document.createElement("canvas"); pic.width = art.W; pic.height = art.H; const px = pic.getContext("2d");
    if (clear) art.drawEnding(px, 2.6); else px.drawImage(art.deathThumb(s), 0, 0);
    x.fillStyle = "#000"; x.fillRect(32, 252, 656, 496); x.drawImage(pic, 40, 260, 640, 480);
    x.fillStyle = "#ffc21a"; x.fillRect(32, 252, 656, 8); x.fillRect(32, 740, 656, 8);
    if (clear) {
      const cl = G.clear || { d: 0, s: 0, title: "" };
      out("31단계 클리어!", Wc / 2, 790, 56, "#ffc21a");
      out(`사망 ${cl.d}회 · ${Math.floor(cl.s / 60)}분 ${cl.s % 60}초`, Wc / 2, 870, 38);
      x.font = `700 32px ${FONT}`; wrap(x, cl.title, 600).forEach((l, i) => out(l, Wc / 2, 940 + i * 46, 32, "#ffe9b0"));
    } else {
      out(`#${pad(s.n)} ${s.death.name}`, Wc / 2, 780, 54, "#ff6a5a");
      x.font = `700 30px ${FONT}`;
      const lines = [`STAGE ${pad(s.n)} · ${s.title}`, `내 선택: ${s.ng.t}`];
      let y = 860; lines.forEach((t) => wrap(x, t, 620).forEach((l) => { out(l, Wc / 2, y, 30, "#e8e2d0"); y += 42; }));
      y += 10; x.font = `700 32px ${FONT}`; wrap(x, s.death.desc, 620).forEach((l) => { out(l, Wc / 2, y, 32); y += 46; });
    }
    out(`도감 ${gotN()}/31`, Wc / 2, 1130, 30, "#ffc21a");
    const site = document.documentElement.dataset.site || "펭귄 툴즈";
    out(`${site} · 오락실`, Wc / 2, 1180, 28, "#bbb");
    return c;
  }
  async function shareCard(n) {
    const c = await makeCard(n);
    const url = c.toDataURL("image/png");
    const prevMode = G.mode;
    openOv(`<div class="hl-share"><img src="${url}" alt="공유 카드 미리보기" width="216" height="384"><div class="hl-btns"><a class="hl-btn" href="${url}" download="hell31-${n === "clear" ? "clear" : "death-" + pad(n)}.png" data-focus>이미지 저장</a><button type="button" class="hl-btn ghost" data-act="sys-share" hidden>공유하기</button><button type="button" class="hl-btn ghost" data-act="shareback">돌아가기</button></div><p class="hl-note">카드에는 이름·기록 같은 개인정보가 들어가지 않아요.</p></div>`, "share");
    G.shareBack = prevMode === "dead" ? (ov.dataset.from || "dead") : prevMode;
    const sb = ov.querySelector('[data-act="sys-share"]');
    c.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "hell31.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { sb.hidden = false; sb.onclick = () => navigator.share({ files: [file], title: "지옥에서 살아남기", text: n === "clear" ? "지옥 31단계 클리어!" : `#${pad(n)} ${STAGES[n - 1].death.name}… 이게 말이 돼?` }).catch(() => {}); }
    }, "image/png");
  }

  // ---------- 입력 ----------
  root.addEventListener("click", (e) => {
    const card = e.target.closest(".hl-card"); if (card) { choose(+card.dataset.k); return; }
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a !== "sys-share") sound.play("click");
    if (a === "start") startRun(1);
    else if (a === "cont") { G.runDeaths = 0; G.t0 = Date.now(); startRun(S.cp); }
    else if (a === "retry") { closeOv(); sound.unlock(); shuffle(); enterStage(cpOf(G.n), { quick: true }); }
    else if (a === "book") { ov.dataset.from = G.mode; book(); }
    else if (a === "close") closeBook();
    else if (a === "detail") detail(+b.dataset.n);
    else if (a === "bookback") book(G.bookBack);
    else if (a === "share") { G.shareFrom = ov.classList.contains("book") || b.closest(".hl-detail") ? "book" : G.mode === "ending" ? "ending" : "dead"; shareCard(b.dataset.n === "clear" ? "clear" : +b.dataset.n); }
    else if (a === "shareback") { const f = G.shareFrom; if (f === "book") book(G.bookBack); else if (f === "ending") ending2(); else deathCard(stage(), false); }
    else if (a === "reset") { if (confirm("사망 도감 기록을 모두 지울까요?")) { S.got = {}; S.deaths = 0; S.cp = 1; S.best = 0; save(); book(G.bookBack); } }
  });
  function ending2() { // 클리어 화면 다시 열기(소리·연출 없이)
    const cl = G.clear; if (!cl) return titleScreen();
    openOv(`<div class="hl-dead hl-clear"><p class="hl-dno">31단계 클리어</p><h3>환생 성공!</h3><p class="hl-ddesc">칭호: <b>${esc(cl.title)}</b></p><p class="hl-dmeta">사망 ${cl.d}회 · ${Math.floor(cl.s / 60)}분 ${cl.s % 60}초 · 도감 ${gotN()}/31</p><div class="hl-btns"><button type="button" class="hl-btn" data-act="start" data-focus>다시 하기</button><div class="hl-row"><button type="button" class="hl-btn ghost" data-act="share" data-n="clear">클리어 카드</button><button type="button" class="hl-btn ghost" data-act="book">도감</button></div></div></div>`, "dead clear");
  }
  $(".hl-snd").addEventListener("click", (e) => { e.stopPropagation(); S.sound = !S.sound; save(); sound.setOn(S.sound); if (S.sound) { sound.unlock(); if (G.started && G.mode !== "ending") sound.bgm("f" + floorOf(G.n).no); } hud(); if (G.mode === "title") $(".hl-floor").textContent = "지옥 입구"; });
  $(".hl-bookbtn").addEventListener("click", (e) => { e.stopPropagation(); if (!ov.hidden && ov.classList.contains("book")) return closeBook(); book(); });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input,textarea,select")) return;
    const r = scr.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    const k = e.key;
    if (!ov.hidden) { if (k === "Escape" && ov.classList.contains("book")) { e.preventDefault(); closeBook(); } return; }
    if (k === "1" || k === "a" || k === "A" || k === "ArrowLeft") { if (G.mode === "stage") { e.preventDefault(); choose(0); } }
    else if (k === "2" || k === "b" || k === "B" || k === "ArrowRight") { if (G.mode === "stage") { e.preventDefault(); choose(1); } }
  });

  // ---------- 시작 ----------
  titleScreen();
  root.classList.add("ready");

  // ---------- 디버그(localhost + ?debug=1 일 때만) ----------
  if (DEBUG) {
    const idle = async (pred, limit = 20000) => { const t0 = Date.now(); while (!pred()) { if (Date.now() - t0 > limit) return false; await new Promise((r) => setTimeout(r, 15)); } return true; };
    window.HELL_DEBUG = {
      speed(v) { SPEED = v; },
      state: () => ({ mode: G.mode, n: G.n, lock: G.lock, order: G.order[G.n], runDeaths: G.runDeaths, got: Object.keys(S.got).map(Number), cp: S.cp, sound: { ...sound.status, ready: sound.ready, bgm: sound.current() }, trans: !!G.trans }),
      waitStage: () => idle(() => G.mode === "stage" && !G.lock && !G.trans),
      async answer(correct) { await this.waitStage(); const k = correct ? G.order[G.n] : 1 - G.order[G.n]; cards[k].click(); },
      async clearAll() { for (let i = 0; i < 31; i++) { await this.answer(true); } return idle(() => !ov.hidden && ov.classList.contains("clear"), 30000); },
      async go(n) { closeOv(); shuffle(); G.started = true; G.t0 = Date.now(); await enterStage(n, { fx: true }); },
      async dieAt(n) { await this.go(n); await this.answer(false); return idle(() => G.mode === "dead" && !ov.hidden); },
      shareCanvas: (n) => makeCard(n),
      G, S,
    };
  }
})();
