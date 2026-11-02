// 헬조선에서 살아남기 — 게임 진행 (P2-28)
// 40단계(0~80세, 5장) A/B 선택 + 4대 스탯(자산·체력·멘탈·눈치). 즉사 선택은 눈치 40% 이상이면 한 번 피함.
// 챕터 끝 정비 시간, 챕터 체크포인트, 환생(유산) 보너스, 사망 도감 44장 + 엔딩 4종(localStorage), 9:16 공유 카드. 서버 전송 0.
(function () {
  const H = window.HELL;
  const root = document.getElementById("hc");
  if (!root || !H || !H.hcArt || !H.HC) return;
  const art = H.hcArt, sound = H.sound, C = H.HC, STAGES = C.STAGES, CH = C.CHAPTERS;
  const DEBUG = /[?&]debug=1/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname); // 공개 사이트에선 꺼짐
  let SPEED = 1;
  const KEY = "hellchosun-v1";
  const CPS = CH.map((c) => c.from), RESTS = [8, 16, 24, 32];
  const chOf = (n) => CH.find((c) => n >= c.from && n <= c.to);
  const pad = (n) => String(n).padStart(2, "0");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms / SPEED));
  const fmtM = (m) => { const neg = m < 0, a = Math.abs(Math.round(m)); const e = Math.floor(a / 10000), r = a % 10000; const s = e ? `${e}억${r ? " " + r.toLocaleString("ko-KR") + "만" : ""}` : `${r.toLocaleString("ko-KR")}만`; return (neg ? "-" : "") + s; };
  const STAT_N = { m: "자산", h: "체력", mt: "멘탈", i: "눈치" };
  const TOTAL = STAGES.length + 4;

  // ---------- 저장(이 브라우저에만) ----------
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const S = Object.assign({ got: {}, ends: {}, lives: 0, sound: true, cp: null, maxAge: 0, legacy: null }, load());
  sound.setOn(S.sound);

  // ---------- 화면 뼈대 ----------
  const ICON_SND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path class="w" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="x" d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const ICON_BOOK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-5a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  const chip = (k) => `<span class="hc-st" data-k="${k}"><small>${STAT_N[k]}</small><b>-</b>${k === "m" ? "" : `<i class="hc-bar"><i></i>${k === "i" ? `<em style="left:${C.DODGE}%"></em>` : ""}</i>`}</span>`;
  root.innerHTML = `
<div class="hl-screen" tabindex="-1" data-ch="1">
  <div class="hl-hud">
    <span class="hl-floor">1장 · 1세</span>
    <span class="hl-stg">STAGE <b>01</b><small>/40</small></span>
    <span class="hl-tools"><button type="button" class="hl-ib hl-snd" aria-label="소리 끄기" aria-pressed="true">${ICON_SND}</button><button type="button" class="hl-ib hl-bookbtn" aria-label="사망 도감">${ICON_BOOK}</button></span>
  </div>
  <div class="hc-stats">${["m", "h", "mt", "i"].map(chip).join("")}</div>
  <div class="hc-life"><span>직업 <b class="hc-job">-</b></span><span>주거 <b class="hc-house">-</b></span></div>
  <div class="hl-pips hc-pips" aria-hidden="true">${STAGES.map((s) => `<i${CPS.includes(s.n) ? ' class="cp"' : ""}></i>`).join("")}</div>
  <div class="hl-stage"><canvas class="hl-cv" width="${art.W}" height="${art.H}" aria-hidden="true"></canvas><div class="hl-fcard" hidden></div><div class="hc-pop" hidden></div><div class="hl-flash"></div></div>
  <div class="hl-sub" aria-live="polite"><span class="hl-tag"></span><p class="hl-say"></p><p class="hl-safe" hidden></p></div>
  <div class="hl-cards">
    <button type="button" class="hl-card" data-k="0"><span class="hl-ab">A</span><canvas class="hl-ic" width="14" height="14" aria-hidden="true"></canvas><span class="hl-ct"></span></button>
    <button type="button" class="hl-card" data-k="1"><span class="hl-ab">B</span><canvas class="hl-ic" width="14" height="14" aria-hidden="true"></canvas><span class="hl-ct"></span></button>
  </div>
  <div class="hl-ov" hidden></div>
</div>`;
  const $ = (s) => root.querySelector(s);
  const scr = $(".hl-screen"), cvs = $(".hl-cv"), ctx = cvs.getContext("2d"), ov = $(".hl-ov"), cardsBox = $(".hl-cards");
  const cards = [...root.querySelectorAll(".hl-card")];
  ctx.imageSmoothingEnabled = false;
  const fitOv = () => { ov.style.top = $(".hl-stage").offsetTop + "px"; };
  fitOv(); addEventListener("resize", fitOv); if (document.fonts) document.fonts.ready.then(fitOv);

  // ---------- 상태 ----------
  const G = { mode: "title", n: 1, order: {}, st: { ...C.START, job: "", house: "" }, lifeDeaths: 0, t0: 0, anim: 0, lock: true, trans: null, death: null, caf: false, started: false, ending: null };
  const shuffle = () => { G.order = {}; STAGES.forEach((s) => { G.order[s.n] = Math.random() < 0.5 ? 0 : 1; }); };
  const stage = () => STAGES[G.n - 1];
  const now = () => performance.now() / 1000;

  // ---------- 그리기 루프(30fps) ----------
  let lastDraw = 0, snap = null, inView = true;
  const off = document.createElement("canvas"); off.width = art.W; off.height = art.H; const offx = off.getContext("2d");
  function drawMode(x, t) {
    if (G.mode === "title") art.drawTitle(x, t);
    else if (G.mode === "ending") art.drawEnding(x, G.ending, t - G.anim);
    else if (G.mode === "win") art.drawStage(x, stage(), t, { kind: "win", t: Math.min(1, ((t - G.anim) * SPEED) / 0.75) });
    else if (G.mode === "dodge") art.drawStage(x, stage(), t, { kind: "dodge", t: Math.min(1, ((t - G.anim) * SPEED) / 0.9) });
    else if (G.mode === "death" || G.mode === "dead") art.drawStage(x, stage(), t, { kind: "death", t: Math.min(1, ((t - G.anim) * SPEED) / 0.9) }, G.death);
    else art.drawStage(x, stage(), t);
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    if (ts - lastDraw < 32) return;
    lastDraw = ts;
    if (!inView) return;
    const t = now(), tr = G.trans;
    if (!tr) { drawMode(ctx, t); return; }
    const k = Math.min(1, ((t - tr.t0) * SPEED) / tr.dur);
    drawMode(offx, t);
    ctx.save(); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, art.W, art.H);
    if (tr.type === "fade") { ctx.drawImage(off, 0, 0); ctx.fillStyle = `rgba(255,255,255,${1 - k})`; ctx.fillRect(0, 0, art.W, art.H); }
    else if (tr.type === "dark") { if (k < 0.45 && snap) { ctx.drawImage(snap, 0, 0); ctx.fillStyle = `rgba(0,0,0,${k / 0.45})`; ctx.fillRect(0, 0, art.W, art.H); } else { ctx.drawImage(off, 0, 0); ctx.fillStyle = `rgba(0,0,0,${Math.max(0, 1 - (k - 0.45) / 0.55) * 0.9})`; ctx.fillRect(0, 0, art.W, art.H); } }
    else if (tr.type === "clock") { ctx.drawImage(k < 0.5 && snap ? snap : off, 0, 0); ctx.fillStyle = `rgba(10,14,30,${0.75 * (1 - Math.max(0, k - 0.6) / 0.4)})`; ctx.fillRect(0, 0, art.W, art.H); const cx = 80, cy = 56, r = 34 * Math.min(1, k * 3) * (1 - Math.max(0, k - 0.75) * 4); if (r > 2) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.strokeStyle = "#141414"; ctx.lineWidth = 3; ctx.stroke(); const a = t * 30, b = t * 3; ctx.strokeStyle = "#e5372b"; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85); ctx.stroke(); ctx.strokeStyle = "#141414"; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(b) * r * 0.55, cy + Math.sin(b) * r * 0.55); ctx.stroke(); } }
    else if (tr.type === "fry") { ctx.drawImage(off, 0, 0); const h = (1 - k) * art.H; ctx.fillStyle = "#e8a82a"; ctx.fillRect(0, art.H - h, art.W, h); for (let i = 0; i < 30; i++) { ctx.fillStyle = "#fff3b0"; ctx.fillRect(Math.random() * art.W, art.H - h + Math.random() * h, 2, 2); } }
    else if (tr.type === "crt") { ctx.drawImage(off, 0, 0); const h = Math.max(1, art.H * Math.min(1, k * 1.6)); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, art.W, (art.H - h) / 2); ctx.fillRect(0, (art.H + h) / 2, art.W, (art.H - h) / 2); if (k < 0.3) { ctx.fillStyle = "#fff"; ctx.fillRect(0, art.H / 2 - 1, art.W, 2); } }
    ctx.restore();
    if (k >= 1) G.trans = null;
  }
  if ("IntersectionObserver" in window) new IntersectionObserver((es) => { inView = es[0].isIntersecting; }, { rootMargin: "100px" }).observe(cvs);
  requestAnimationFrame(frame);

  // ---------- HUD ----------
  function hud(deltas) {
    const s = stage(), ch = chOf(G.n);
    scr.dataset.ch = ch.no;
    $(".hl-floor").textContent = `${ch.no}장 · ${s.age}세`;
    $(".hl-stg b").textContent = pad(G.n);
    ["m", "h", "mt", "i"].forEach((k) => {
      const el = root.querySelector(`.hc-st[data-k="${k}"]`), v = G.st[k];
      el.querySelector("b").textContent = k === "m" ? fmtM(v) : v + "%";
      const bar = el.querySelector(".hc-bar > i"); if (bar) bar.style.width = Math.max(0, Math.min(100, v)) + "%";
      el.classList.toggle("low", k === "m" ? v < 50 : v <= 20);
      if (k === "i") el.classList.toggle("ready", v >= C.DODGE);
      if (deltas && deltas[k]) { const d = document.createElement("span"); d.className = "hc-dl " + (deltas[k] > 0 ? "up" : "dn"); d.textContent = (deltas[k] > 0 ? "+" : "") + (k === "m" ? fmtM(deltas[k]) : deltas[k]); el.appendChild(d); setTimeout(() => d.remove(), 1400); }
    });
    $(".hc-job").textContent = G.st.job || (s.age < 19 ? "학생" : "무직");
    $(".hc-house").textContent = G.st.house || (s.age < 19 ? "부모님 집" : "-");
    root.querySelectorAll(".hc-pips i").forEach((p, i) => { p.classList.toggle("on", i < G.n - 1); p.classList.toggle("now", i === G.n - 1); });
    const snd = $(".hl-snd"); snd.setAttribute("aria-pressed", String(S.sound)); snd.setAttribute("aria-label", S.sound ? "소리 끄기" : "소리 켜기"); snd.classList.toggle("off", !S.sound);
  }
  function applyFx(fx) {
    const f = typeof fx === "function" ? fx(G.st) : fx || {}, d = {};
    for (const k of Object.keys(f)) { const before = G.st[k]; G.st[k] = k === "m" ? before + f[k] : Math.max(0, Math.min(100, before + f[k])); d[k] = G.st[k] - before; }
    return d;
  }
  const NOTE = { invest: "※ 게임 속 병맛 설정이에요. 현실 투자 조언이 아닙니다.", health: "※ 게임 속 병맛 설정이에요. 현실 건강 조언이 아닙니다.", safe: "※ 게임 속 설정이에요. 현실에서 따라 하지 마세요." };
  function drawIcon(c, key) { const x = c.getContext("2d"); x.clearRect(0, 0, 14, 14); x.imageSmoothingEnabled = false; x.drawImage(art.icon(key), 0, 0); }
  function showStage() {
    const s = stage(), okAt = G.order[s.n];
    $(".hl-tag").textContent = `STAGE ${pad(s.n)} · ${s.age}세`;
    $(".hl-say").textContent = s.title; $(".hl-say").className = "hl-say";
    const safe = $(".hl-safe"); safe.hidden = !s.tag; safe.textContent = s.tag ? NOTE[s.tag] : "";
    cards.forEach((c, k) => { const ch = k === okAt ? s.ok : s.ng; c.querySelector(".hl-ct").textContent = ch.t; drawIcon(c.querySelector(".hl-ic"), ch.icon); c.disabled = false; c.classList.remove("pick", "dim"); });
    cardsBox.classList.remove("idle");
    G.mode = "stage"; G.lock = false; hud();
  }
  function idleCards(text) { cardsBox.classList.add("idle"); $(".hl-tag").textContent = ""; $(".hl-say").textContent = text || ""; $(".hl-safe").hidden = true; }

  // ---------- 진행 ----------
  async function enterStage(n, { fx = true, quick = false } = {}) {
    G.n = n; G.lock = true;
    const ch = chOf(n);
    sound.bgm("c" + ch.no);
    hud();
    if (fx && CPS.includes(n)) { saveCp(); await chapterTransition(ch, quick); }
    showStage();
  }
  function saveCp() { S.cp = { n: G.n, st: { ...G.st }, caf: G.caf }; save(); }
  async function chapterTransition(ch, quick) {
    snap = document.createElement("canvas"); snap.width = art.W; snap.height = art.H; snap.getContext("2d").drawImage(cvs, 0, 0);
    G.mode = "stage";
    const dur = quick ? 0.5 : 1.3;
    G.trans = { type: ch.fx, t0: now(), dur };
    idleCards("");
    const fc = $(".hl-fcard");
    fc.innerHTML = `<b>${ch.no}장 · ${esc(ch.ages)}</b><span>${esc(ch.name)}</span><small>${esc(ch.sub)}${ch.passive ? `<br>패시브: ${esc(ch.passive)}` : ""}</small>`;
    fc.dataset.f = ch.no; fc.hidden = false; fc.classList.remove("go"); void fc.offsetWidth; fc.classList.add("go");
    if (ch.fx === "clock") sound.play("combo"); else if (ch.no > 1) sound.play("ding");
    if (ch.popup && !quick) setTimeout(() => popup(ch.popup), 500 / SPEED);
    await wait((quick ? 0.6 : 1.9) * 1000);
    fc.hidden = true;
  }
  function popup(text, cls = "") { const p = $(".hc-pop"); p.textContent = text; p.className = "hc-pop " + cls; p.hidden = false; void p.offsetWidth; p.classList.add("go"); clearTimeout(p._t); p._t = setTimeout(() => { p.hidden = true; }, 2200 / SPEED); }
  function newLife() {
    sound.unlock(); shuffle();
    const lg = C.legacy(S); G.st = { ...C.START, job: "", house: "" }; G.caf = false;
    const d = applyFx(lg.fx); G.legacyApplied = lg;
    S.lives++; save();
    G.lifeDeaths = 0; G.t0 = Date.now(); G.started = true;
    closeOv();
    enterStage(1).then(() => { if (lg.pts) { popup(`유산 보너스! 눈치 +${d.i || 0} · 멘탈 +${d.mt || 0} · 자산 +${fmtM(d.m || 0)}`, "gold"); hud(d); } });
  }
  function fromCp() {
    sound.unlock(); shuffle(); closeOv();
    const cp = S.cp || { n: 1, st: { ...C.START, job: "", house: "" } };
    G.st = { ...cp.st }; G.caf = !!cp.caf; G.started = true; if (!G.t0) G.t0 = Date.now();
    enterStage(cp.n, { quick: true });
  }
  async function choose(k) {
    if (G.lock || G.mode !== "stage") return;
    G.lock = true;
    const s = stage(), ok = k === G.order[s.n];
    cards.forEach((c, i) => { c.disabled = true; c.classList.toggle("pick", i === k); c.classList.toggle("dim", i !== k); });
    G.anim = now();
    if (ok) {
      G.mode = "win"; sound.play("fanfare");
      const d = applyFx(s.ok.fx);
      if (s.ok.caf) G.caf = true; else if ((d.h || 0) > 0) G.caf = false;
      $(".hl-tag").textContent = "생존!"; $(".hl-say").textContent = s.ok.msg; $(".hl-say").className = "hl-say ok";
      hud(d); flash("ok");
      if (d.m) setTimeout(() => sound.play(d.m > 0 ? "coin" : "drop"), 350 / SPEED);
      if (s.ok.set) setTimeout(() => popup(s.ok.set.job ? `직업 변경 → ${s.ok.set.job}` : `주거 변경 → ${s.ok.set.house}`, "gold"), 500 / SPEED);
      if (s.ok.set) Object.assign(G.st, s.ok.set);
      await wait(1900);
    } else if (G.st.i >= C.DODGE) {
      G.mode = "dodge"; sound.play("warn");
      const d = applyFx(C.DODGE_COST);
      $(".hl-tag").textContent = "눈치 발동!"; $(".hl-say").textContent = `쎄한 느낌에 「${s.ng.t}」 직전에 발을 뺐다. 눈치 ${d.i}, 멘탈 ${d.mt}.`; $(".hl-say").className = "hl-say warn";
      hud(d); flash("warn");
      await wait(1900);
    } else {
      return die(s.death, s.n, s.ng.t);
    }
    // 생활비·노화(챕터 패시브)
    const ch = chOf(s.n);
    const ld = applyFx(ch.living);
    hud(ld);
    S.maxAge = Math.max(S.maxAge || 0, s.age); save();
    const sd = statDeath();
    if (sd) { await wait(400); return die(C.STAT_DEATHS[sd], C.STAT_DEATHS[sd].no, null); }
    if (s.n === 40) return ending();
    if (RESTS.includes(s.n)) return rest();
    enterStage(s.n + 1);
  }
  function statDeath() { if (G.st.m < 0) return "debt"; if (G.st.h <= 0) return G.caf ? "caf" : "work"; if (G.st.mt <= 0) return "mental"; return null; }
  async function die(death, no, choice) {
    G.mode = "death"; G.death = death; G.anim = now(); sound.play("death"); idleCards();
    $(".hl-tag").textContent = "사망"; $(".hl-say").textContent = choice || `${death.name.split(" ")[0]}…`; $(".hl-say").className = "hl-say ng";
    setTimeout(() => { flash("ng"); scr.classList.remove("hl-shake"); void scr.offsetWidth; scr.classList.add("hl-shake"); }, 300 / SPEED);
    await wait(1000);
    G.mode = "dead";
    const first = !S.got[no];
    S.got[no] = (S.got[no] || 0) + 1; G.lifeDeaths++; G.lastNo = no; S.maxAge = Math.max(S.maxAge || 0, stage().age);
    save(); hud();
    deathCard(death, no, first);
  }
  function flash(kind) { const f = $(".hl-flash"); f.className = "hl-flash " + kind; void f.offsetWidth; f.classList.add("go"); }

  // ---------- 오버레이 ----------
  function openOv(html, cls = "") { ov.className = "hl-ov " + cls; ov.innerHTML = html; ov.hidden = false; ov.scrollTop = 0; const b = ov.querySelector("[data-focus]") || ov.querySelector("button"); if (b) b.focus({ preventScroll: true }); }
  function closeOv() { ov.hidden = true; ov.innerHTML = ""; ov.className = "hl-ov"; }
  const gotN = () => Object.keys(S.got).length;
  const endN = () => Object.keys(S.ends).length;
  const legacyLine = () => { const lg = C.legacy(S); return lg.pts ? `다음 생 유산 보너스: 눈치 +${lg.fx.i} · 멘탈 +${lg.fx.mt} · 자산 +${fmtM(lg.fx.m)}` : "유산 보너스: 아직 없음(오래 살수록 커져요)"; };
  function titleScreen() {
    G.mode = "title"; G.lock = true; G.started = false; G.n = 1; G.st = { ...C.START, job: "", house: "" };
    idleCards(""); hud(); $(".hl-floor").textContent = "헬조선 입구"; scr.dataset.ch = "0";
    const cont = S.cp && S.cp.n > 1 ? `<button type="button" class="hl-btn ghost" data-act="cp">이어 하기 · ${chOf(S.cp.n).no}장(${STAGES[S.cp.n - 1].age}세)부터</button>` : "";
    openOv(`<div class="hl-title"><p class="hl-kicker">SURVIVAL IN HELL-CHOSUN</p><h2 class="hl-logo">헬조선에서<br>살아남기</h2><p class="hl-desc">0세부터 80세까지 40단계. 자산·체력·멘탈·눈치 중 하나라도 바닥나면 끝. 상식대로 고르면… 아마 죽는다.</p>
<div class="hl-btns"><button type="button" class="hl-btn" data-act="life" data-focus>${S.lives ? "환생하기 · 0세부터" : "응애, 태어나기"}</button>${cont}<button type="button" class="hl-btn ghost" data-act="book">사망 도감 ${gotN()}/${TOTAL} · 엔딩 ${endN()}/4</button></div>
<p class="hl-note">${esc(legacyLine())}<br>※ 모든 선택지는 게임 속 병맛 설정이에요. 현실 투자·건강 조언이 아니며, 따라 하지 마세요.</p></div>`, "title");
  }
  function deathCard(d, no, first) {
    const q = C.QUIPS[Math.floor(Math.random() * C.QUIPS.length)];
    const cp = S.cp && S.cp.n ? S.cp.n : 1;
    openOv(`<div class="hl-dead"><p class="hl-dno">사망 카드 #${pad(no)}${first ? ' <em class="hl-new">NEW</em>' : ""} · ${stage().age}세</p><h3>${esc(d.name)}</h3><p class="hl-ddesc">${esc(d.desc)}</p><p class="hl-quip">“${esc(q)}”</p>
<p class="hl-dmeta">자산 ${fmtM(G.st.m)} · 체력 ${G.st.h}% · 멘탈 ${G.st.mt}% · 눈치 ${G.st.i}% · 도감 ${gotN()}/${TOTAL}</p>
<div class="hl-btns"><div class="hl-row"><button type="button" class="hl-btn" data-act="cp" data-focus>${chOf(cp).no}장부터 다시</button><button type="button" class="hl-btn" data-act="life">환생(0세)</button></div><p class="hc-lg">${esc(legacyLine())}</p><div class="hl-row"><button type="button" class="hl-btn ghost" data-act="share" data-n="${no}">억울한 죽음 카드</button><button type="button" class="hl-btn ghost" data-act="book">도감</button></div></div></div>`, "dead");
  }
  function rest() {
    G.mode = "stage"; G.lock = true; idleCards("정비 시간이에요. 다음 장으로 가기 전에 하나만 고르세요.");
    openOv(`<div class="hc-rest"><p class="hl-dno">${chOf(G.n).no}장 끝 · ${stage().age}세</p><h3>정비 시간</h3><p class="hl-ddesc">하나만 고를 수 있어요. 지금 가장 낮은 스탯을 챙기세요.</p>
<div class="hc-rgrid">${C.REST.map((r) => `<button type="button" class="hl-btn ghost hc-rb" data-act="rest" data-id="${r.id}"><canvas class="hl-ic" width="14" height="14" data-icon="${r.icon}"></canvas><b>${esc(r.t)}</b><small>${esc(r.msg)}</small></button>`).join("")}</div></div>`, "rest");
    ov.querySelectorAll("canvas[data-icon]").forEach((c) => drawIcon(c, c.dataset.icon));
  }
  function doRest(id) {
    const r = C.REST.find((x) => x.id === id); if (!r) return;
    closeOv(); const d = applyFx(r.fx); if ((d.h || 0) > 0) G.caf = false; hud(d); sound.play(d.m > 0 ? "coin" : "fanfare");
    const sd = statDeath(); if (sd) return die(C.STAT_DEATHS[sd], C.STAT_DEATHS[sd].no, null);
    enterStage(G.n + 1);
  }
  async function ending() {
    const e = C.ENDINGS.find((x) => x.when(G.st));
    G.ending = e.id; G.mode = "ending"; G.anim = now(); G.lock = true; idleCards("80세 관문 통과!");
    sound.bgm(null); sound.play("clear");
    const sec = Math.round((Date.now() - G.t0) / 1000);
    const first = !S.ends[e.id];
    S.ends[e.id] = (S.ends[e.id] || 0) + 1; S.endings = endN(); S.maxAge = 80; S.cp = null; save();
    G.clear = { id: e.id, s: sec, st: { ...G.st }, d: G.lifeDeaths };
    await wait(2600);
    endCard(e, first);
  }
  function endCard(e, first) {
    const cl = G.clear;
    openOv(`<div class="hl-dead hl-clear"><p class="hl-dno">80세 생존 · 엔딩 ${endN()}/4${first ? ' <em class="hl-new">NEW</em>' : ""}</p><h3>${esc(e.name)}</h3><p class="hl-ddesc">${esc(e.desc)}</p>
<p class="hl-dmeta">자산 ${fmtM(cl.st.m)} · 체력 ${cl.st.h}% · 멘탈 ${cl.st.mt}% · 눈치 ${cl.st.i}%<br>직업 ${esc(cl.st.job || "-")} · 주거 ${esc(cl.st.house || "-")} · ${Math.floor(cl.s / 60)}분 ${cl.s % 60}초</p>
<div class="hl-btns"><button type="button" class="hl-btn" data-act="life" data-focus>환생하기(유산 보너스)</button><p class="hc-lg">${esc(legacyLine())}</p><div class="hl-row"><button type="button" class="hl-btn ghost" data-act="share" data-n="end">엔딩 카드</button><button type="button" class="hl-btn ghost" data-act="book">도감</button></div></div></div>`, "dead clear");
  }
  // 사망 도감(44장 + 엔딩 4종)
  const ALLD = () => [...STAGES.map((s) => ({ no: s.n, d: s.death, st: s, age: s.age })), ...Object.values(C.STAT_DEATHS).map((d) => ({ no: d.no, d, st: null, age: null }))];
  const thumbs = {};
  function thumbFor(it) { if (!thumbs[it.no]) thumbs[it.no] = art.deathThumb(it.st || STAGES[[19, 18, 18, 12][it.no - 41]], it.st ? null : it.d); return thumbs[it.no]; }
  function book() {
    G.bookBack = G.mode === "title" ? "title" : G.mode === "dead" ? "dead" : G.mode === "ending" ? "ending" : ov.classList.contains("rest") ? "rest" : "stage";
    G.lockBefore = G.lock; G.lock = true;
    openOv(`<div class="hl-book"><div class="hl-bhead"><h3>사망 도감 <small>${gotN()}/${TOTAL}</small></h3><button type="button" class="hl-x" data-act="close" aria-label="도감 닫기" data-focus>닫기</button></div>
<ol class="hl-grid">${ALLD().map((it) => { const c = S.got[it.no]; return `<li><button type="button" class="hl-dc2${c ? " got" : ""}" data-act="detail" data-n="${it.no}" ${c ? "" : "disabled"}><span class="hl-thumb" data-n="${it.no}"></span><b>#${pad(it.no)}</b><span>${c ? esc(it.d.name) : "???"}</span><small>${c ? `${c}회` : it.age ? `${it.age}세` : "스탯 사망"}</small></button></li>`; }).join("")}</ol>
<h3 class="hc-eh">엔딩 <small>${endN()}/4</small></h3><ul class="hc-ends">${C.ENDINGS.map((e) => `<li class="${S.ends[e.id] ? "got" : ""}"><b>${S.ends[e.id] ? esc(e.name) : e.hidden ? "??? (숨은 엔딩)" : "???"}</b><small>${S.ends[e.id] ? esc(e.desc) : "80세까지 살아남으면 스탯에 따라 갈려요."}</small></li>`).join("")}</ul>
<p class="hl-note">기록은 이 브라우저에만 저장돼요. <button type="button" class="hl-link" data-act="reset">기록 초기화</button></p></div>`, "book");
    ov.querySelectorAll(".hl-thumb").forEach((el) => { const n = +el.dataset.n; if (!S.got[n]) return; const it = ALLD().find((a) => a.no === n); const c = document.createElement("canvas"); c.width = art.W; c.height = art.H; c.getContext("2d").drawImage(thumbFor(it), 0, 0); el.appendChild(c); });
  }
  function closeBook() {
    const b = G.bookBack; closeOv();
    if (b === "title") return titleScreen();
    if (b === "dead") return deathCard(G.death, G.lastNo, false);
    if (b === "ending") return endCard(C.ENDINGS.find((e) => e.id === G.ending), false);
    if (b === "rest") return rest();
    G.lock = G.lockBefore;
  }
  function detail(n) {
    const it = ALLD().find((a) => a.no === n);
    openOv(`<div class="hl-dead hl-detail"><p class="hl-dno">사망 카드 #${pad(n)} · ${S.got[n]}회</p><div class="hl-dthumb"></div><h3>${esc(it.d.name)}</h3><p class="hl-ddesc">${it.st ? `${it.age}세 「${esc(it.st.title)}」에서 「${esc(it.st.ng.t)}」를 골랐다.<br>` : ""}${esc(it.d.desc)}</p>
<div class="hl-btns"><button type="button" class="hl-btn" data-act="share" data-n="${n}" data-focus>이 죽음으로 공유 카드</button><button type="button" class="hl-btn ghost" data-act="bookback">도감으로</button></div></div>`, "detail");
    const c = document.createElement("canvas"); c.width = art.W; c.height = art.H; c.getContext("2d").drawImage(thumbFor(it), 0, 0); ov.querySelector(".hl-dthumb").appendChild(c);
  }

  // ---------- 9:16 공유 카드 ----------
  function wrap(x, text, maxW) { const out = []; let line = ""; for (const ch of text) { const tl = line + ch; if (x.measureText(tl).width > maxW && line) { out.push(line); line = ch; } else line = tl; } if (line) out.push(line); return out; }
  async function makeCard(n) {
    const Wc = 720, Hc = 1280, c = document.createElement("canvas"); c.width = Wc; c.height = Hc;
    const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
    try { await document.fonts.load('700 40px "Galmuri11"'); } catch (e) {}
    const FONT = '"Galmuri11", "Pretendard Variable", sans-serif';
    const isEnd = n === "end";
    const g = x.createLinearGradient(0, 0, 0, Hc); g.addColorStop(0, isEnd ? "#2a1a40" : "#20262e"); g.addColorStop(1, "#0a0a0c"); x.fillStyle = g; x.fillRect(0, 0, Wc, Hc);
    const out = (t, X, Y, size, col = "#fff") => { x.font = `700 ${size}px ${FONT}`; x.textAlign = "center"; x.textBaseline = "top"; x.lineJoin = "round"; x.lineWidth = Math.max(6, size / 6); x.strokeStyle = "#000"; x.strokeText(t, X, Y); x.fillStyle = col; x.fillText(t, X, Y); };
    out("헬조선에서 살아남기", Wc / 2, 70, 44, "#ffc21a");
    out(isEnd ? "80세 생존 인증" : "가장 억울한 죽음", Wc / 2, 140, 64, isEnd ? "#3ff0ff" : "#fff");
    const pic = document.createElement("canvas"); pic.width = art.W; pic.height = art.H; const px = pic.getContext("2d");
    let it = null;
    if (isEnd) art.drawEnding(px, G.clear ? G.clear.id : "pension", 2.6); else { it = ALLD().find((a) => a.no === n); px.drawImage(thumbFor(it), 0, 0); }
    x.fillStyle = "#000"; x.fillRect(32, 252, 656, 496); x.drawImage(pic, 40, 260, 640, 480); x.fillStyle = "#ffc21a"; x.fillRect(32, 252, 656, 8); x.fillRect(32, 740, 656, 8);
    let y = 780;
    if (isEnd) {
      const e = C.ENDINGS.find((a) => a.id === (G.clear ? G.clear.id : "pension")), st = G.clear ? G.clear.st : G.st;
      out(e.name, Wc / 2, y, 44, "#ffc21a"); y += 70;
      out(`자산 ${fmtM(st.m)} · 체력 ${st.h}% · 멘탈 ${st.mt}%`, Wc / 2, y, 30); y += 50;
      x.font = `700 30px ${FONT}`; wrap(x, e.desc, 620).slice(0, 4).forEach((l) => { out(l, Wc / 2, y, 30, "#e8e2d0"); y += 44; });
    } else {
      out(`#${pad(n)} ${it.d.name}`, Wc / 2, y, 50, "#ff6a5a"); y += 76;
      x.font = `700 30px ${FONT}`;
      const lines = it.st ? [`${it.age}세 · ${it.st.title}`, `내 선택: ${it.st.ng.t}`] : ["스탯이 바닥났다"];
      lines.forEach((t) => wrap(x, t, 620).forEach((l) => { out(l, Wc / 2, y, 30, "#e8e2d0"); y += 42; }));
      y += 10; x.font = `700 32px ${FONT}`; wrap(x, it.d.desc, 620).forEach((l) => { out(l, Wc / 2, y, 32); y += 46; });
    }
    out(`사망 도감 ${gotN()}/${TOTAL} · 엔딩 ${endN()}/4`, Wc / 2, 1130, 30, "#ffc21a");
    out(`${document.documentElement.dataset.site || "펭귄 툴즈"} · 이야기 게임`, Wc / 2, 1180, 28, "#bbb");
    return c;
  }
  async function shareCard(n) {
    const c = await makeCard(n), url = c.toDataURL("image/png");
    openOv(`<div class="hl-share"><img src="${url}" alt="공유 카드 미리보기" width="216" height="384"><div class="hl-btns"><a class="hl-btn" href="${url}" download="hell-chosun-${n === "end" ? "ending" : "death-" + pad(n)}.png" data-focus>이미지 저장</a><button type="button" class="hl-btn ghost" data-act="sys-share" hidden>공유하기</button><button type="button" class="hl-btn ghost" data-act="shareback">돌아가기</button></div><p class="hl-note">카드에는 이름 같은 개인정보가 들어가지 않아요.</p></div>`, "share");
    const sb = ov.querySelector('[data-act="sys-share"]');
    c.toBlob((blob) => { if (!blob) return; const file = new File([blob], "hell-chosun.png", { type: "image/png" }); if (navigator.canShare && navigator.canShare({ files: [file] })) { sb.hidden = false; sb.onclick = () => navigator.share({ files: [file], title: "헬조선에서 살아남기", text: n === "end" ? "헬조선 80세 생존!" : "이게 말이 돼?" }).catch(() => {}); } }, "image/png");
  }

  // ---------- 입력 ----------
  root.addEventListener("click", (e) => {
    const card = e.target.closest(".hl-card"); if (card) { choose(+card.dataset.k); return; }
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a !== "sys-share") sound.play("click");
    if (a === "life") newLife();
    else if (a === "cp") fromCp();
    else if (a === "rest") doRest(b.dataset.id);
    else if (a === "book") book();
    else if (a === "close") closeBook();
    else if (a === "detail") detail(+b.dataset.n);
    else if (a === "bookback") book();
    else if (a === "share") { G.shareFrom = ov.classList.contains("detail") ? "book" : G.mode === "ending" ? "ending" : "dead"; shareCard(b.dataset.n === "end" ? "end" : +b.dataset.n); }
    else if (a === "shareback") { const f = G.shareFrom; if (f === "book") book(); else if (f === "ending") endCard(C.ENDINGS.find((x) => x.id === G.ending), false); else deathCard(G.death, G.lastNo, false); }
    else if (a === "reset") { if (confirm("사망 도감·엔딩·유산 기록을 모두 지울까요?")) { S.got = {}; S.ends = {}; S.lives = 0; S.cp = null; S.maxAge = 0; S.endings = 0; save(); book(); } }
  });
  $(".hl-snd").addEventListener("click", (e) => { e.stopPropagation(); S.sound = !S.sound; save(); sound.setOn(S.sound); if (S.sound) { sound.unlock(); if (G.started && G.mode !== "ending") sound.bgm("c" + chOf(G.n).no); } hud(); if (G.mode === "title") $(".hl-floor").textContent = "헬조선 입구"; });
  $(".hl-bookbtn").addEventListener("click", (e) => { e.stopPropagation(); if (!ov.hidden && ov.classList.contains("book")) return closeBook(); book(); });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input,textarea,select")) return;
    const r = scr.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    const k = e.key;
    if (!ov.hidden) { if (k === "Escape" && ov.classList.contains("book")) { e.preventDefault(); closeBook(); } return; }
    if (G.mode !== "stage") return;
    if (k === "1" || k === "a" || k === "A" || k === "ArrowLeft") { e.preventDefault(); choose(0); }
    else if (k === "2" || k === "b" || k === "B" || k === "ArrowRight") { e.preventDefault(); choose(1); }
  });

  titleScreen();
  root.classList.add("ready");

  // ---------- 디버그(localhost + ?debug=1 일 때만) ----------
  if (DEBUG) {
    const idle = async (pred, limit = 30000) => { const t0 = Date.now(); while (!pred()) { if (Date.now() - t0 > limit) return false; await new Promise((r) => setTimeout(r, 15)); } return true; };
    window.HC_DEBUG = {
      speed(v) { SPEED = v; },
      state: () => ({ mode: G.mode, n: G.n, age: stage().age, lock: G.lock, st: { ...G.st }, caf: G.caf, got: Object.keys(S.got).map(Number), ends: { ...S.ends }, ov: ov.hidden ? null : ov.className, sound: { ...sound.status, ready: sound.ready, bgm: sound.current() } }),
      waitStage: () => idle(() => G.mode === "stage" && !G.lock && !G.trans && ov.hidden),
      async answer(correct) { await this.waitStage(); const k = correct ? G.order[G.n] : 1 - G.order[G.n]; cards[k].click(); },
      async step(restId = "sing") { // 정답 하나 고르고, 정비 화면이면 restId 선택
        await this.answer(true);
        await idle(() => (G.mode === "stage" && !G.lock && ov.hidden) || G.mode === "ending" || G.mode === "dead" || (!ov.hidden && ov.classList.contains("rest")));
        if (!ov.hidden && ov.classList.contains("rest")) { ov.querySelector(`[data-id="${restId}"]`).click(); }
      },
      async playAll(rests = ["sing", "sing", "sing", "sing"]) { for (let i = 0; i < 40; i++) { if (G.mode === "dead") return "dead"; await this.step(rests[RESTS.filter((r) => r < G.n).length] || "sing"); if (G.mode === "ending") break; } await idle(() => !ov.hidden && ov.classList.contains("clear"), 30000); return G.mode === "ending" ? G.ending : G.mode; },
      async go(n, st) { closeOv(); shuffle(); G.started = true; G.t0 = Date.now(); if (n === 1) Object.assign(G.st, { ...C.START, job: "", house: "" }); if (st) Object.assign(G.st, st); await enterStage(n, { fx: true }); },
      async dieAt(n) { await this.go(n, { i: 0 }); await this.answer(false); return idle(() => G.mode === "dead" && !ov.hidden); },
      async statDeath(kind) { const plan = { debt: [20, { m: -1 }], work: [27, { h: 1 }], caf: [19, { h: 5 }], mental: [13, { mt: 1 }] }[kind]; G.caf = false; await this.go(plan[0], { i: 0, m: 5000, h: 60, mt: 60, ...plan[1] }); G.caf = false; await this.answer(true); return idle(() => G.mode === "dead" && !ov.hidden); },
      async ending(id) { const st = { pension: { m: 50000, h: 40, mt: 60, i: 50, job: "치킨집 사장" }, dirt: { m: 500, h: 40, mt: 60, i: 50 }, cyborg: { m: 50000, h: 95, mt: 60, i: 50 }, cult: { m: 50000, h: 40, mt: 60, i: 95, job: "비둘기 교단 교주" } }[id]; await this.go(40, st); await this.answer(true); return idle(() => !ov.hidden && ov.classList.contains("clear"), 30000); },
      shareCanvas: (n) => makeCard(n),
      G, S,
    };
  }
})();
