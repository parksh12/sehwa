// 펭귄 RPG 「뽀득이와 오색 연」 엔진 — 타일맵 탐색, 대화, 메뉴, 턴제 전투, 상점, 저장(localStorage). 서버 전송 0.
// 조작: 방향키/WASD 이동, Enter·Space·Z = A(확인·말 걸기), Esc·X·Backspace = B(취소·메뉴). 휴대폰은 화면 아래 패드.
(function () {
  const root = document.getElementById("rpg");
  if (!root || !window.RPG || !RPG.data || !RPG.core || !RPG.art) return;
  const D = RPG.data, C = RPG.core, ART = RPG.art, josa = RPG.josa;
  const SAVE_KEY = "penguin-rpg-save-v1", OPT_KEY = "penguin-rpg-opt";
  const TS = 16, VW = 11, VH = 9, CW = TS * VW, CH = TS * VH;
  const PASS = ".,:=hs";
  const DEBUG = /[?&]debug=1/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname); // 공개 사이트에선 꺼짐(COO)
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const sleep = (ms) => new Promise((r) => setTimeout(r, dbg.fast ? Math.min(ms, 5) : ms));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const dbg = { fast: false, auto: false };

  // ---------- 화면 뼈대 ----------
  root.innerHTML = "";
  const screen = el("div", "rpg-screen");
  const cv = el("canvas", "rpg-cv"); cv.width = CW; cv.height = CH; cv.setAttribute("aria-label", "펭귄 RPG 게임 화면"); cv.setAttribute("role", "img");
  const ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
  const ui = { dlg: el("div", "rpg-dlg"), win: el("div", "rpg-win"), banner: el("div", "rpg-banner"), party: el("div", "rpg-party"), toast: el("div", "rpg-toast"), title: el("div", "rpg-title"), place: el("div", "rpg-place"), warn: el("div", "rpg-warn"), fade: el("div", "rpg-fade") };
  ui.dlg.setAttribute("aria-live", "polite"); ui.banner.setAttribute("aria-live", "polite");
  screen.append(cv, ui.place, ui.banner, ui.warn, ui.party, ui.dlg, ui.win, ui.toast, ui.fade, ui.title);
  for (const k of ["dlg", "win", "banner", "party", "warn"]) ui[k].hidden = true;
  ui.dlg.addEventListener("click", () => { pressQ.push("A"); });
  ui.banner.addEventListener("click", () => { pressQ.push("A"); });
  const pad = el("div", "rpg-pad");
  pad.innerHTML = `<div class="rpg-dpad" aria-label="방향 패드"><span class="u">▲</span><span class="l">◀</span><span class="r">▶</span><span class="d">▼</span></div>
  <div class="rpg-ab"><button type="button" class="rpg-b" aria-label="B 버튼: 취소·메뉴">B</button><button type="button" class="rpg-a" aria-label="A 버튼: 확인·말 걸기">A</button></div>`;
  const keyhint = el("p", "rpg-keys", "<b>조작</b> 방향키·WASD 이동 · <kbd>Enter</kbd>/<kbd>Space</kbd> 확인·말 걸기 · <kbd>Esc</kbd> 메뉴·취소 · 진행은 자동 저장");
  root.append(screen, pad, keyhint);

  // ---------- 소리(WebAudio로 직접 합성, 기본 끔 — 사무실·도서관에서 갑자기 소리 나지 않게) ----------
  let opt = { sound: false };
  try { opt = { ...opt, ...JSON.parse(localStorage.getItem(OPT_KEY) || "{}") }; } catch (e) {}
  let ac = null;
  function beep(type) {
    if (!opt.sound || dbg.fast) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "closed") return;
      if (ac.state === "suspended") ac.resume();
      const N = { blip: [[880, 0.03]], ok: [[660, 0.05], [990, 0.06]], hit: [[160, 0.07, "square"]], heal: [[520, 0.06], [780, 0.08]], lv: [[523, 0.08], [659, 0.08], [784, 0.12]], enc: [[220, 0.06, "square"], [330, 0.06, "square"], [440, 0.1, "square"]], buy: [[1046, 0.05], [1318, 0.07]], ko: [[300, 0.06, "sawtooth"], [150, 0.12, "sawtooth"]] }[type];
      if (!N) return;
      let t = ac.currentTime;
      for (const [f, d, w] of N) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = w || "triangle"; o.frequency.value = f; g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.02); t += d;
      }
    } catch (e) {}
  }

  // ---------- 입력 ----------
  const held = new Set();
  let pressQ = [];
  let active = false;
  const KEYMAP = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right", Enter: "A", " ": "A", z: "A", Z: "A", Escape: "B", x: "B", X: "B", Backspace: "B" };
  window.addEventListener("keydown", (e) => {
    if (!active || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
    const k = KEYMAP[e.key]; if (!k) return;
    e.preventDefault();
    if (DIRS[k]) { if (!held.has(k)) pressQ.push(k); held.add(k); } else if (!e.repeat) pressQ.push(k);
  });
  window.addEventListener("keyup", (e) => { const k = KEYMAP[e.key]; if (k) held.delete(k); });
  window.addEventListener("blur", () => held.clear());
  root.tabIndex = -1;
  root.addEventListener("pointerdown", () => { active = true; });
  document.addEventListener("pointerdown", (e) => { if (!root.contains(e.target)) { active = false; held.clear(); } });
  // 방향 패드: 누른 위치로 방향 판정(손가락을 미끄러뜨려도 됨)
  const dpad = pad.querySelector(".rpg-dpad");
  let padDir = null;
  const setPad = (d) => { if (padDir === d) return; if (padDir) held.delete(padDir); padDir = d; if (d) { held.add(d); pressQ.push(d); } dpad.dataset.dir = d || ""; };
  const padPos = (e) => { const r = dpad.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2; if (Math.hypot(x, y) < r.width * 0.12) return null; return Math.abs(x) > Math.abs(y) ? (x > 0 ? "right" : "left") : y > 0 ? "down" : "up"; };
  dpad.addEventListener("pointerdown", (e) => { e.preventDefault(); active = true; dpad.setPointerCapture(e.pointerId); setPad(padPos(e)); });
  dpad.addEventListener("pointermove", (e) => { if (padDir !== null || e.buttons) setPad(padPos(e)); });
  const padUp = () => setPad(null);
  dpad.addEventListener("pointerup", padUp); dpad.addEventListener("pointercancel", padUp); dpad.addEventListener("lostpointercapture", padUp);
  for (const [sel, k] of [[".rpg-a", "A"], [".rpg-b", "B"]]) {
    const b = pad.querySelector(sel);
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); active = true; pressQ.push(k); b.classList.add("on"); });
    const off = () => b.classList.remove("on");
    b.addEventListener("pointerup", off); b.addEventListener("pointerleave", off); b.addEventListener("pointercancel", off);
  }
  pad.addEventListener("contextmenu", (e) => e.preventDefault());
  // 입력 대기
  let waiters = [];
  function nextPress(kinds) {
    return new Promise((res) => {
      const w = { kinds, res: (k) => { clearInterval(iv); res(k); } };
      waiters.push(w);
      // 시험용 자동 모드로 바뀌면 기다리던 입력을 자동으로 넘김
      const iv = DEBUG ? setInterval(() => { if (dbg.auto) { clearInterval(iv); waiters = waiters.filter((x) => x !== w); res("A"); } }, 50) : 0;
    });
  }
  function pumpInput() {
    while (pressQ.length) {
      const k = pressQ.shift();
      const w = waiters.find((x) => x.kinds.includes(k));
      if (w) { waiters = waiters.filter((x) => x !== w); w.res(k); continue; }
      if (mode === "field" && !busy) fieldPress(k);
    }
  }

  // ---------- 상태 ----------
  let G = null; // 저장되는 상태
  let mode = "title", busy = false;
  let cur = null; // 현재 맵
  const P = { px: 0, py: 0, moving: null, frame: 0, trail: [] };
  let encSteps = 0, lastT = 0, saveTimer = 0;
  const newGame = () => ({ v: 1, map: "village", x: 4, y: 5, dir: "down", party: [C.newMember("ppo", 1)], inv: {}, gold: 30, flags: {}, opened: {}, kills: {}, respawn: ["village", 18, 5], ms: 0, steps: 0, battles: 0 });
  const hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } };
  function save(quiet) {
    if (!G) return false;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); if (!quiet) toast("저장했어요"); return true; } catch (e) { if (!quiet) toast("저장 공간을 쓸 수 없어요(브라우저 설정 확인)"); return false; }
  }
  function load() {
    try { const g = JSON.parse(localStorage.getItem(SAVE_KEY)); if (g && g.v === 1 && D.MAPS[g.map]) return g; } catch (e) {}
    return null;
  }
  const inv = () => G.inv;
  const count = (k) => G.inv[k] || 0;
  function give(k, n = 1) { G.inv[k] = (G.inv[k] || 0) + n; }
  function take(k, n = 1) { G.inv[k] = Math.max(0, (G.inv[k] || 0) - n); if (!G.inv[k]) delete G.inv[k]; }
  const kinds = () => D.NORMAL_KINDS.filter((k) => G.kills[k]).length;
  const hero = () => G.party[0];

  // ---------- 맵 ----------
  function loadMap(id) {
    const m = D.MAPS[id];
    cur = { id, m, rows: m.rows, w: m.rows[0].length, h: m.rows.length, theme: m.theme };
  }
  const cond = (e) => (!e.if || G.flags[e.if]) && (!e.unless || !G.flags[e.unless]);
  const evs = () => (D.EV[cur.id] || []).filter(cond);
  const evAt = (x, y) => evs().find((e) => e.x === x && e.y === y);
  const tileAt = (x, y) => (x < 0 || y < 0 || x >= cur.w || y >= cur.h ? "#" : cur.rows[y][x]);
  function passable(x, y) {
    if (!PASS.includes(tileAt(x, y))) return false;
    const e = evAt(x, y);
    return !e || e.type === "warp";
  }
  function placeAt(map, x, y, dir) {
    G.map = map; G.x = x; G.y = y; if (dir) G.dir = dir;
    loadMap(map);
    P.px = x * TS; P.py = y * TS; P.moving = null;
    P.trail = Array(4).fill(0).map(() => [x, y, G.dir]);
    encSteps = 0;
  }
  function showPlace() {
    ui.place.textContent = cur.m.name;
    ui.place.classList.remove("show"); void ui.place.offsetWidth; ui.place.classList.add("show");
  }
  async function warp(map, x, y, dir) {
    await fade(true);
    placeAt(map, x, y, dir);
    save(true);
    await fade(false);
    showPlace();
  }
  function fade(on) { ui.fade.classList.toggle("on", on); return sleep(on ? 220 : 160); }

  // ---------- 필드 이동 ----------
  function fieldPress(k) {
    if (DIRS[k]) { if (!P.moving && !tryMove(k)) G.dir = k; return; } // 짧게 톡 눌러도 한 칸 이동
    if (k === "A") return interact();
    if (k === "B") return run(menu);
  }
  function tryMove(dir) {
    G.dir = dir;
    const [dx, dy] = DIRS[dir], nx = G.x + dx, ny = G.y + dy;
    const e = evAt(nx, ny);
    if (e && e.type === "boss") return run(() => trigger(e));
    if (!passable(nx, ny)) return false;
    P.trail.unshift([G.x, G.y, dir]); P.trail.length = 4;
    P.moving = { fx: G.x, fy: G.y, tx: nx, ty: ny, t: 0 };
    G.x = nx; G.y = ny;
    return true;
  }
  async function arrive() {
    G.steps++;
    const e = evAt(G.x, G.y);
    if (e && e.type === "warp") { if (cur.id === "village" && G.flags.cleared && e.to[0] !== "village") {} return run(() => warp(...e.to)); }
    if (++saveTimer >= 40) { saveTimer = 0; save(true); }
    const rate = cur.m.rate || 0;
    if (cur.m.enc && !cur.m.safe && !dbg.noEnc) {
      encSteps++;
      if (encSteps >= 15 && Math.random() < 0.07 * rate) {
        encSteps = 0;
        const list = D.ENC[cur.m.enc], tot = list.reduce((n, [w]) => n + w, 0);
        let r = Math.random() * tot, grp = list[0][1];
        for (const [w, g] of list) { if ((r -= w) < 0) { grp = g; break; } }
        run(() => battle({ foes: grp }));
      }
    }
  }
  function interact() {
    const [dx, dy] = DIRS[G.dir];
    const e = evAt(G.x + dx, G.y + dy);
    if (e) run(() => trigger(e));
  }
  async function trigger(e) {
    if (e.type === "npc" || e.type === "boss") e.dir = { up: "down", down: "up", left: "right", right: "left" }[G.dir];
    if (e.type === "sign") return say(null, e.text);
    if (e.type === "fire") {
      beep("heal");
      healAll();
      G.respawn = [cur.id, G.x, G.y];
      save(true);
      return say(null, ["따뜻한 모닥불이다. 몸을 녹였다.", "HP·MP가 모두 회복되었고, 여기서 저장했다. 쓰러지면 이곳에서 다시 시작한다."]);
    }
    if (e.type === "chest") {
      if (G.opened[e.id]) return say(null, [e.sp === "pepper" ? "이미 고추를 땄다." : "빈 상자다."]);
      G.opened[e.id] = 1;
      beep("ok");
      if (e.gold) { G.gold += e.gold; save(true); return say(null, [`상자를 열었다! ${e.gold}골드를 얻었다.`]); }
      const [k, n] = e.item, it = D.ITEMS[k];
      give(k, n);
      save(true);
      if (k === "pepper") return say(null, [`불꽃 고추를 땄다! (${count("pepper")}/3)`, count("pepper") >= 3 ? "세 개 다 모았다. 마을 분식집에 가져가자." : "손끝이 얼얼하다."]);
      if (k === "yarn") return say(null, ["대나무 틈에 털실 뭉치가 걸려 있었다!", G.flags.q1 ? "뜨개 할머니께 가져다드리자." : "누구 거지? 마을에 물어보자."]);
      return say(null, [`상자를 열었다! ${it.name}${n > 1 ? " " + n + "개" : ""}${josa(it.name, "을", "를")} 얻었다.`, it.t !== "use" && it.t !== "key" ? "메뉴의 「장비」에서 바꿔 낄 수 있다." : null].filter(Boolean));
    }
    if (e.run && D.S[e.run]) return D.S[e.run](api, G.flags);
  }

  // ---------- 스크립트 실행 ----------
  async function run(fn) {
    if (busy) return;
    busy = true;
    try { await fn(); } catch (err) { console.error(err); }
    finally { busy = false; held.clear(); }
  }
  const api = {
    say: (n, t) => say(n, t), ask: (n, t, o) => ask(n, t, o),
    set: (k, v = true) => { G.flags[k] = v; save(true); }, flag: (k) => !!G.flags[k],
    has: (k) => count(k) > 0, count, give, take, gold: (n) => { G.gold += n; }, kinds,
    battle: (o) => battle(o), join, shop: (id) => shop(id), heal: async () => { healAll(); G.respawn = [cur.id, G.x, G.y]; save(true); beep("heal"); await sleep(200); },
    warp: (m, x, y, d) => warp(m, x, y, d), toast: (s) => toast(s), shake: () => shake(), learn: (id, sk) => { const m = G.party.find((p) => p.id === id); if (m && !m.extra.includes(sk)) m.extra.push(sk); },
    ending: () => ending(),
  };
  function join(id) {
    if (G.party.some((m) => m.id === id)) return;
    const m = C.newMember(id, hero().lv);
    m.eq = id === "mong" ? { w: "stick", a: "bamboo", c: null } : { w: "tongs", a: "apron", c: null };
    const s = C.stats(m); m.hp = s.maxhp; m.mp = s.maxmp;
    G.party.push(m);
    beep("lv");
    save(true);
  }
  function healAll() { for (const m of G.party) { const s = C.stats(m); m.hp = s.maxhp; m.mp = s.maxmp; } }

  // ---------- 대화 ----------
  async function say(name, lines) {
    lines = [].concat(lines).filter(Boolean);
    ui.dlg.hidden = false;
    for (const line of lines) {
      ui.dlg.innerHTML = `${name ? `<b class="rpg-who">${esc(name)}</b>` : ""}<p></p><i class="rpg-more" aria-hidden="true">▼</i>`;
      const p = ui.dlg.querySelector("p");
      let typing = true, i = 0;
      const typer = (async () => { while (typing && i < line.length) { i += 2; p.textContent = line.slice(0, i); if (i % 8 === 0) beep("blip"); await sleep(22); } typing = false; p.textContent = line; ui.dlg.classList.add("done"); })();
      if (dbg.auto) { typing = false; await typer; await sleep(1); }
      else {
        await nextPress(["A", "B"]);
        if (typing) { typing = false; await typer; await nextPress(["A", "B"]); }
      }
      ui.dlg.classList.remove("done");
    }
    ui.dlg.hidden = true;
  }
  // 목록 창: 위·아래 이동, A 선택, B 취소(-1). 클릭·터치도 가능.
  function list(items, o = {}) {
    return new Promise((resolve) => {
      const w = ui.win;
      w.className = "rpg-win " + (o.pos || "pos-c");
      w.hidden = false;
      let idx = Math.max(0, items.findIndex((x) => !x.disabled));
      if (o.start != null && items[o.start]) idx = o.start;
      w.innerHTML = `${o.title ? `<div class="rpg-wt">${esc(o.title)}${o.back === false ? "" : '<button type="button" class="rpg-x" aria-label="닫기">✕</button>'}</div>` : ""}${o.info ? `<div class="rpg-info">${o.info}</div>` : ""}<ul role="listbox">${items.map((it, i) => `<li role="option" data-i="${i}"${it.disabled ? ' aria-disabled="true"' : ""}><span>${it.html || esc(it.label)}</span>${it.sub != null ? `<small>${esc(it.sub)}</small>` : ""}</li>`).join("")}</ul>${o.foot ? `<div class="rpg-foot">${o.foot}</div>` : ""}`;
      const lis = [...w.querySelectorAll("li")];
      const desc = w.querySelector(".rpg-foot");
      const paint = () => { lis.forEach((li, i) => li.classList.toggle("on", i === idx)); const li = lis[idx]; if (li) li.scrollIntoView({ block: "nearest" }); if (o.onMove) o.onMove(idx, desc); };
      paint();
      let done = false;
      const finish = (v) => { if (done) return; done = true; waiters = waiters.filter((x) => x !== waiter); w.hidden = !o.keep; resolve(v); };
      lis.forEach((li, i) => li.addEventListener("click", () => { if (items[i].disabled) { idx = i; paint(); return; } beep("ok"); finish(i); }));
      const x = w.querySelector(".rpg-x"); if (x) x.addEventListener("click", () => finish(-1));
      const waiter = { kinds: ["up", "down", "left", "right", "A", "B"], res: null };
      const loop = (k) => {
        if (done) return;
        if (k === "up" || k === "left") { do { idx = (idx - 1 + items.length) % items.length; } while (items[idx].disabled && items.some((i) => !i.disabled) && o.skipDisabled); beep("blip"); paint(); }
        else if (k === "down" || k === "right") { do { idx = (idx + 1) % items.length; } while (items[idx].disabled && items.some((i) => !i.disabled) && o.skipDisabled); beep("blip"); paint(); }
        else if (k === "A") { if (!items.length) return finish(-1); if (items[idx].disabled) { beep("ko"); } else { beep("ok"); return finish(idx); } }
        else if (k === "B") { if (o.back !== false) return finish(-1); }
        waiter.res = loop; waiters.push(waiter);
      };
      waiter.res = loop; waiters.push(waiter);
      const autoV = () => (o.autoPick != null ? o.autoPick : o.back === false ? 0 : -1);
      if (dbg.auto) setTimeout(() => finish(autoV()), 0);
      else if (DEBUG) { const iv = setInterval(() => { if (done) clearInterval(iv); else if (dbg.auto) { clearInterval(iv); finish(autoV()); } }, 50); }
    });
  }
  async function ask(name, text, options) {
    ui.dlg.hidden = false;
    ui.dlg.innerHTML = `${name ? `<b class="rpg-who">${esc(name)}</b>` : ""}<p>${esc(text)}</p>`;
    const r = await list(options.map((o) => ({ label: o })), { pos: "pos-ask", back: false, autoPick: 0 });
    ui.dlg.hidden = true;
    return r;
  }
  let toastT = 0;
  function toast(s) { ui.toast.textContent = s; ui.toast.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => ui.toast.classList.remove("show"), 2200); }
  function shake() { screen.classList.remove("shake"); void screen.offsetWidth; screen.classList.add("shake"); beep("hit"); return sleep(450); }

  // ---------- 메뉴 ----------
  const fmtTime = (ms) => { const m = Math.floor(ms / 60000); return `${Math.floor(m / 60)}시간 ${m % 60}분`; };
  const mname = (m) => D.MEMBERS[m.id].name;
  async function menu() {
    let start = 0;
    for (;;) {
      const r = await list([{ label: "상태" }, { label: "아이템" }, { label: "장비" }, { label: "퀘스트" }, { label: "저장" }, { label: `소리: ${opt.sound ? "켬" : "끔"}` }, { label: "닫기" }], { title: `메뉴 · ${G.gold}G`, pos: "pos-menu", start, info: `${esc(cur.m.name)} · 플레이 ${fmtTime(G.ms)}` });
      start = Math.max(0, r);
      if (r === -1 || r === 6) return;
      if (r === 0) await statusMenu();
      if (r === 1) await itemMenu();
      if (r === 2) await equipMenu();
      if (r === 3) await questMenu();
      if (r === 4) { save(false); beep("ok"); }
      if (r === 5) { opt.sound = !opt.sound; try { localStorage.setItem(OPT_KEY, JSON.stringify(opt)); } catch (e) {} }
    }
  }
  const bar = (v, max, cls) => `<i class="rpg-bar ${cls || ""}"><i style="width:${Math.max(0, Math.min(100, (v / max) * 100))}%"></i></i>`;
  async function statusMenu() {
    let i = 0;
    for (;;) {
      const r = await list(G.party.map((m) => { const s = C.stats(m); return { html: `<b>${esc(mname(m))}</b> Lv${m.lv} ${bar(m.hp, s.maxhp)} <small class="n">HP ${m.hp}/${s.maxhp} · MP ${m.mp}/${s.maxmp}</small>` }; }), { title: "상태", pos: "pos-menu", start: i });
      if (r < 0) return;
      i = r;
      const m = G.party[r], s = C.stats(m), eq = (k) => (m.eq[k] ? D.ITEMS[m.eq[k]].name : "없음");
      await list(C.skillsOf(m).map((k) => ({ label: D.SKILLS[k].name, sub: `MP ${D.SKILLS[k].mp} · ${D.SKILLS[k].desc}` })), { title: `${mname(m)} Lv${m.lv}`, pos: "pos-menu", info: `${esc(D.MEMBERS[m.id].desc)}<br>HP ${m.hp}/${s.maxhp} · MP ${m.mp}/${s.maxmp} · 공격 ${s.atk} · 방어 ${s.def} · 속도 ${s.spd}<br>다음 레벨까지 ${C.expTo(m.lv) - m.exp} EXP<br>무기 ${esc(eq("w"))} · 옷 ${esc(eq("a"))} · 장신구 ${esc(eq("c"))}`, foot: "스킬 목록" });
    }
  }
  async function pickMember(title, filter = () => true) {
    const r = await list(G.party.map((m) => { const s = C.stats(m); return { html: `<b>${esc(mname(m))}</b> ${bar(m.hp, s.maxhp)} <small class="n">HP ${m.hp}/${s.maxhp} · MP ${m.mp}/${s.maxmp}</small>`, disabled: !filter(m) }; }), { title, pos: "pos-menu" });
    return r < 0 ? null : G.party[r];
  }
  async function itemMenu() {
    for (;;) {
      const keys = Object.keys(G.inv).filter((k) => G.inv[k] > 0).sort((a, b) => "use w a c key".indexOf(D.ITEMS[a].t) - "use w a c key".indexOf(D.ITEMS[b].t));
      if (!keys.length) { await say(null, ["가방이 비어 있다."]); return; }
      const T = { use: "", w: "무기", a: "옷", c: "장신구", key: "중요" };
      const r = await list(keys.map((k) => ({ label: `${D.ITEMS[k].name} ×${G.inv[k]}`, sub: T[D.ITEMS[k].t] })), { title: "아이템", pos: "pos-menu", foot: " ", onMove: (i, f) => { const it = D.ITEMS[keys[i]]; if (f) f.textContent = it.desc || itemStat(it); } });
      if (r < 0) return;
      const k = keys[r], it = D.ITEMS[k];
      if (it.t !== "use") { toast(it.t === "key" ? "중요한 물건이다" : "장비는 「장비」 메뉴에서 바꿔요"); continue; }
      const m = await pickMember(`${it.name} — 누구에게?`);
      if (!m) continue;
      const out = [];
      C.useItemOn(it, { side: "p", m, name: mname(m), st: {} }, out);
      take(k, 1); beep("heal");
      toast(out.map((o) => o.s || (o.n ? `${mname(m)} HP +${o.n}` : "")).filter(Boolean).join(" ") || "사용했다");
    }
  }
  const itemStat = (it) => [it.atk && `공격+${it.atk}`, it.def && `방어+${it.def}`, it.spd && `속도+${it.spd}`, it.hp && `HP+${it.hp}`, it.mp && `MP+${it.mp}`].filter(Boolean).join(" ");
  async function equipMenu() {
    const m = await pickMember("장비 — 누구?");
    if (!m) return;
    const SL = [["w", "무기"], ["a", "옷"], ["c", "장신구"]];
    let si = 0;
    for (;;) {
      const s = C.stats(m);
      const r = await list(SL.map(([k, n]) => ({ label: `${n}: ${m.eq[k] ? D.ITEMS[m.eq[k]].name : "없음"}`, sub: m.eq[k] ? itemStat(D.ITEMS[m.eq[k]]) : "" })), { title: `${mname(m)}의 장비`, pos: "pos-menu", start: si, info: `공격 ${s.atk} · 방어 ${s.def} · 속도 ${s.spd} · 최대 HP ${s.maxhp}` });
      if (r < 0) return;
      si = r;
      const slot = SL[r][0];
      const cands = Object.keys(G.inv).filter((k) => G.inv[k] > 0 && D.ITEMS[k].t === slot);
      const opts = [{ label: "벗기", sub: "" }, ...cands.map((k) => { const a = C.stats(m), b = C.stats({ ...m, eq: { ...m.eq, [slot]: k } }); const d = (x) => (b[x] - a[x] > 0 ? `+${b[x] - a[x]}` : b[x] - a[x] < 0 ? `${b[x] - a[x]}` : "±0"); return { label: `${D.ITEMS[k].name} ×${G.inv[k]}`, sub: `공격 ${d("atk")} · 방어 ${d("def")} · 속도 ${d("spd")}` }; })];
      const c = await list(opts, { title: `${SL[r][1]} 고르기`, pos: "pos-menu", start: cands.length ? 1 : 0 });
      if (c < 0) continue;
      if (m.eq[slot]) give(m.eq[slot], 1);
      if (c === 0) m.eq[slot] = null; else { m.eq[slot] = cands[c - 1]; take(cands[c - 1], 1); }
      const s2 = C.stats(m); m.hp = Math.min(m.hp, s2.maxhp); m.mp = Math.min(m.mp, s2.maxmp);
      beep("ok");
    }
  }
  async function questMenu() {
    const g = { has: (k) => count(k) > 0, count, kinds };
    const qs = D.QUESTS.filter((q) => q.main || G.flags[q.on] || G.flags[q.id + "done"]);
    await list(qs.map((q) => ({ html: `<b>${q.main ? "[메인] " : ""}${esc(q.name)}</b>`, sub: q.step(G.flags, g) })), { title: `퀘스트 (서브 ${qs.filter((q) => !q.main && G.flags[q.id + "done"]).length}/${D.QUESTS.length - 1} 완료)`, pos: "pos-menu" });
  }
  async function shop(id) {
    for (;;) {
      const r = await list([{ label: "사기" }, { label: "팔기" }, { label: "나가기" }], { title: `상점 · ${G.gold}G`, pos: "pos-menu" });
      if (r < 0 || r === 2) return;
      if (r === 0) {
        for (;;) {
          const stock = D.SHOPS[id](G.flags);
          const k = await list(stock.map((k) => { const it = D.ITEMS[k]; return { label: it.name, sub: `${it.price}G · 가진 수 ${count(k)}${it.t !== "use" ? " · " + itemStat(it) : ""}`, disabled: G.gold < it.price }; }), { title: `사기 · ${G.gold}G`, pos: "pos-menu", foot: " ", onMove: (i, f) => { const it = D.ITEMS[stock[i]]; if (f) f.textContent = it.desc || itemStat(it); } });
          if (k < 0) break;
          const it = D.ITEMS[stock[k]];
          if (G.gold < it.price) { toast("골드가 모자라요"); continue; }
          G.gold -= it.price; give(stock[k], 1); beep("buy"); toast(`${it.name}${josa(it.name, "을", "를")} 샀다`);
        }
      } else {
        for (;;) {
          const keys = Object.keys(G.inv).filter((k) => G.inv[k] > 0 && D.ITEMS[k].t !== "key");
          if (!keys.length) { toast("팔 물건이 없어요"); break; }
          const k = await list(keys.map((k) => { const it = D.ITEMS[k]; return { label: `${it.name} ×${G.inv[k]}`, sub: `${Math.floor((it.price || 20) / 2)}G에 팔기` }; }), { title: `팔기 · ${G.gold}G`, pos: "pos-menu" });
          if (k < 0) break;
          const it = D.ITEMS[keys[k]];
          G.gold += Math.floor((it.price || 20) / 2); take(keys[k], 1); beep("buy");
        }
      }
      save(true);
    }
  }

  // ---------- 전투 ----------
  let B = null;
  const BV = { foes: [], fx: [], shakeT: 0, cursor: null };
  function layoutFoes() {
    const fs = B.foes;
    const sizes = fs.map((f) => (f.big ? 72 : 40));
    const gap = 6, total = sizes.reduce((a, b) => a + b, 0) + gap * (fs.length - 1);
    const scale = total > CW - 8 ? (CW - 8) / total : 1;
    let x = (CW - total * scale) / 2;
    fs.forEach((f, i) => { const w = sizes[i] * scale; f.vx = Math.round(x + w / 2); f.vy = f.big ? 54 : 62; x += w + gap * scale; f.flash = 0; f.alpha = f.alpha == null ? 1 : f.alpha; });
  }
  function drawBattle(t) {
    ART.battleBg(ctx, cur.theme, CW, CH);
    let sx = 0;
    if (BV.shakeT > 0) sx = Math.round(Math.sin(t / 20) * 2);
    for (const f of B.foes) {
      if (f.alpha <= 0) continue;
      const img = ART.monster(f.id), s = 2, w = img.width * s, h = img.height * s;
      const bob = C.alive(f) ? Math.round(Math.sin(t / 300 + f.idx) * 1) : 0;
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(f.vx - w / 3, f.vy + h / 2 - 3, (w / 3) * 2, 3);
      ctx.drawImage(f.flash > 0 && Math.floor(t / 60) % 2 ? ART.flash(img) : img, Math.round(f.vx - w / 2 + sx), Math.round(f.vy - h / 2 + bob), w, h);
      ctx.globalAlpha = 1;
      if (C.alive(f) && f.hp < f.maxhp) { const bw = Math.min(30, w * 0.7); ctx.fillStyle = "#141414"; ctx.fillRect(Math.round(f.vx - bw / 2) - 1, Math.round(f.vy + h / 2) + 1, bw + 2, 4); ctx.fillStyle = f.hp / f.maxhp > 0.3 ? "#1e9e5a" : "#e5372b"; ctx.fillRect(Math.round(f.vx - bw / 2), Math.round(f.vy + h / 2) + 2, Math.max(1, Math.round((bw * f.hp) / f.maxhp)), 2); }
      if (BV.cursor === f && Math.floor(t / 250) % 2) { ctx.fillStyle = "#ffc21a"; const y = Math.round(f.vy - h / 2 - 6); ctx.fillRect(f.vx - 3, y, 7, 2); ctx.fillRect(f.vx - 2, y + 2, 5, 1); ctx.fillRect(f.vx - 1, y + 3, 3, 1); ctx.fillStyle = "#141414"; ctx.fillRect(f.vx - 4, y - 1, 9, 1); }
    }
    BV.fx = BV.fx.filter((x) => t - x.t0 < 800);
    for (const x of BV.fx) {
      const k = (t - x.t0) / 800;
      if (x.kind === "num") ART.num(ctx, x.s, Math.round(x.x - String(x.s).length * 2), Math.round(x.y - k * 10), x.c);
      else if (x.kind === "slash") { ctx.fillStyle = x.c; for (let i = 0; i < 8; i++) ctx.fillRect(Math.round(x.x - 8 + i * 2 + k * 4), Math.round(x.y - 8 + i * 2), 2, 2); }
      else if (x.kind === "burst") { ctx.fillStyle = x.c; const r = 4 + k * 14; for (let a = 0; a < 8; a++) ctx.fillRect(Math.round(x.x + Math.cos(a) * r), Math.round(x.y + Math.sin(a) * r), 2, 2); }
    }
  }
  const EL_COL = { metal: "#dfe3e8", wood: "#5fbf5a", water: "#5aa6e0", fire: "#ff8a3d", earth: "#d9a514", heal: "#7fd06b", hit: "#ffffff" };
  function partyHud(activeIdx = -1, hurt = null) {
    ui.party.hidden = false;
    ui.party.innerHTML = B.party.map((c, i) => { const s = C.stats(c.m), st = Object.keys(c.st).filter((k) => C.ST_NAME[k] || k === "atkUp").map((k) => (k === "atkUp" ? "공↑" : C.ST_NAME[k])).join(" "); return `<div class="rpg-pm${i === activeIdx ? " on" : ""}${c.m.hp <= 0 ? " ko" : ""}${hurt === c ? " hurt" : ""}"><div class="r1"><b>${esc(c.name)}</b><small>Lv${c.m.lv}${st ? " · " + st : ""}</small></div><div class="r2"><span>${bar(c.m.hp, s.maxhp, c.m.hp < s.maxhp * 0.3 ? "low" : "")}${c.m.hp}/${s.maxhp}</span><span>${bar(c.m.mp, s.maxmp, "mp")}${c.m.mp}</span></div></div>`; }).join("");
  }
  async function bmsg(s, ms = 650) {
    ui.banner.hidden = false; ui.banner.textContent = s;
    if (dbg.fast) return;
    let skip = false;
    const w = { kinds: ["A"], res: () => { skip = true; } };
    waiters.push(w);
    const t0 = performance.now();
    while (!skip && performance.now() - t0 < ms) await sleep(25);
    waiters = waiters.filter((x) => x !== w);
  }
  async function play(events) {
    for (const ev of events) {
      if (ev.t === "msg") {
        if (ev.warn) { ui.warn.hidden = false; ui.warn.textContent = "⚠ " + ev.s; }
        if (ev.shake) shake();
        if (ev.who && ev.who.side === "f") { ev.who.flash = 0; }
        if (ev.fx && B) { /* 스킬 색 */ BV.lastFx = EL_COL[ev.fx] || "#fff"; }
        await bmsg(ev.s);
      } else if (ev.t === "miss") { await bmsg(ev.s, 600); }
      else if (ev.t === "hit") {
        const t = ev.tg;
        beep("hit");
        if (t.side === "f") {
          t.flash = 1; setTimeout(() => (t.flash = 0), 350);
          BV.fx.push({ kind: "slash", x: t.vx, y: t.vy, c: BV.lastFx || "#fff", t0: performance.now() });
          BV.fx.push({ kind: "num", s: ev.n, x: t.vx, y: t.vy - 10, c: ev.weak ? "#ffc21a" : ev.crit ? "#ff8a3d" : "#ffffff", t0: performance.now() });
          await sleep(dbg.fast ? 1 : 260);
          const tags = [ev.crit && "급소!", ev.weak && "오행 상극! 큰 피해", ev.resist && "같은 기운이라 덜 아프다", ev.shield && "촉수가 막아 피해 절반", ev.rainbow && "오색 빛이 무채를 꿰뚫는다!"].filter(Boolean);
          await bmsg(ev.s || `${t.name}에게 ${ev.n}의 피해!${tags.length ? " " + tags.join(" · ") : ""}`, 520);
        } else {
          BV.shakeT = 1; setTimeout(() => (BV.shakeT = 0), 250);
          partyHud(-1, t);
          await bmsg(ev.s || `${t.name}${josa(t.name, "은", "는")} ${ev.n}의 피해를 입었다!`, 520);
        }
        BV.lastFx = null;
        partyHud();
      } else if (ev.t === "heal") {
        beep("heal");
        partyHud();
        await bmsg(ev.s || `${ev.tg.name}의 HP가 ${ev.n} 회복되었다.`, 520);
      } else if (ev.t === "ko") {
        const t = ev.tg;
        if (t.side === "f") { beep("ko"); for (let a = 1; a >= 0; a -= 0.2) { t.alpha = a; await sleep(40); } t.alpha = 0; await bmsg(`${t.name}${josa(t.name, "을", "를")} 물리쳤다!`, 450); }
        else { partyHud(); await bmsg(`${t.name}${josa(t.name, "이", "가")} 쓰러졌다…`, 700); }
      } else if (ev.t === "summon") { layoutFoes(); await sleep(200); }
      else if (ev.t === "useItem") { take(ev.item, 1); }
    }
  }
  async function chooseCommand(c, planned) {
    BV.cursor = null;
    if (dbg.auto) { await sleep(1); return C.auto(B, c, invMinus(planned)); }
    for (;;) {
      ui.banner.hidden = false; ui.banner.textContent = `${c.name}${josa(c.name, "은", "는")} 무엇을 할까?`;
      const r = await list([{ label: "공격" }, { label: "스킬", disabled: !!c.st.seal }, { label: "방어" }, { label: "아이템" }, { label: B.opts.boss ? "도망(불가)" : "도망", disabled: !!B.opts.boss }], { pos: "pos-cmd", back: true, start: c._last || 0 });
      if (r === -1) return "back";
      c._last = r;
      if (r === 0) { const t = await pickFoe(); if (t) return { who: c, k: "atk", tg: t }; continue; }
      if (r === 2) return { who: c, k: "def" };
      if (r === 4) return { who: c, k: "run" };
      if (r === 1) {
        const sk = C.skillsOf(c.m);
        const s = await list(sk.map((k) => { const S = D.SKILLS[k]; return { label: S.name, sub: `MP ${S.mp}${S.el ? " · " + D.EL_NAME[S.el] : ""}`, disabled: c.m.mp < S.mp }; }), { pos: "pos-cmd wide", title: `스킬 · MP ${c.m.mp}`, foot: " ", onMove: (i, f) => { if (f) f.textContent = D.SKILLS[sk[i]].desc; } });
        if (s < 0) continue;
        const S = D.SKILLS[sk[s]];
        if (S.tg === "one") { const t = await pickFoe(); if (t) return { who: c, k: "skill", skill: sk[s], tg: t }; continue; }
        if (S.tg === "ally" || S.tg === "dead") { const t = await pickAlly(S.tg === "dead"); if (t) return { who: c, k: "skill", skill: sk[s], tg: t }; continue; }
        return { who: c, k: "skill", skill: sk[s] };
      }
      if (r === 3) {
        const left = invMinus(planned);
        const keys = Object.keys(left).filter((k) => left[k] > 0 && D.ITEMS[k].t === "use");
        if (!keys.length) { toast("쓸 수 있는 아이템이 없어요"); continue; }
        const s = await list(keys.map((k) => ({ label: `${D.ITEMS[k].name} ×${left[k]}`, sub: D.ITEMS[k].desc })), { pos: "pos-cmd wide", title: "아이템" });
        if (s < 0) continue;
        const t = await pickAlly(!!D.ITEMS[keys[s]].revive);
        if (t) return { who: c, k: "item", item: keys[s], tg: t };
      }
    }
  }
  function invMinus(planned) { const o = { ...G.inv }; for (const a of planned) if (a.k === "item") o[a.item] = (o[a.item] || 0) - 1; return o; }
  async function pickFoe() {
    const fs = C.livingFoes(B);
    if (fs.length === 1) return fs[0];
    const r = await list(fs.map((f) => ({ html: `${esc(f.name)} ${bar(f.hp, f.maxhp)}` })), { pos: "pos-cmd wide", title: "누구를?", onMove: (i) => (BV.cursor = fs[i]) });
    BV.cursor = null;
    return r < 0 ? null : fs[r];
  }
  async function pickAlly(dead) {
    const r = await list(B.party.map((c) => { const s = C.stats(c.m); return { html: `${esc(c.name)} ${bar(c.m.hp, s.maxhp)} <small class="n">${c.m.hp}/${s.maxhp}</small>`, disabled: dead ? c.m.hp > 0 : c.m.hp <= 0 }; }), { pos: "pos-cmd wide", title: "누구에게?" });
    return r < 0 ? null : B.party[r];
  }
  async function battle(o) {
    const prevMode = mode;
    mode = "battle";
    beep("enc");
    screen.classList.add("flash"); await sleep(380); screen.classList.remove("flash");
    B = C.create(G.party, o.foes, { boss: !!o.boss, final: !!o.final });
    layoutFoes();
    BV.fx = []; ui.warn.hidden = true;
    screen.classList.add("in-battle");
    partyHud();
    const names = [...new Set(B.foes.map((f) => D.ENEMIES[f.id].name))].join(", ");
    await bmsg(o.boss ? `${names}${josa(names, "이", "가")} 앞을 막아선다!` : `${names}${josa(names, "이", "가")} 나타났다!`, 800);
    let res = null, ran = false;
    while (!res) {
      // 명령 고르기
      const acts = [];
      let i = 0;
      while (i < B.party.length) {
        const c = B.party[i];
        if (!C.alive(c)) { i++; continue; }
        partyHud(i);
        const a = await chooseCommand(c, acts);
        if (a === "back") { let j = i - 1; while (j >= 0 && !C.alive(B.party[j])) j--; if (j >= 0) { while (acts.length && acts[acts.length - 1].who !== B.party[j]) acts.pop(); acts.pop(); i = j; } continue; }
        if (a.k === "run") { acts.length = 0; acts.push(a); break; }
        acts.push(a); i++;
      }
      partyHud();
      ui.win.hidden = true;
      let order;
      if (acts[0] && acts[0].k === "run") {
        await bmsg("도망칠 틈을 엿본다…", 500);
        if (C.tryRun(B, Math.random)) { beep("ok"); await bmsg("무사히 도망쳤다!", 600); ran = true; res = "run"; break; }
        await bmsg("돌아가는 길이 막혔다! 도망치지 못했다.", 600);
        order = C.order(B, C.livingFoes(B).map((f) => C.planFoe(B, f, Math.random)), Math.random);
      } else {
        for (const a of acts) if (a.k === "def") a.who.st.guard = 1;
        const foeActs = C.livingFoes(B).map((f) => C.planFoe(B, f, Math.random));
        order = C.order(B, acts.concat(foeActs), Math.random);
      }
      for (const a of order) {
        if (!C.alive(a.who)) continue;
        if (a.k === "item" && count(a.item) <= 0) { await bmsg(`${a.who.name}${josa(a.who.name, "은", "는")} 가방을 뒤졌지만 ${D.ITEMS[a.item].name}${josa(D.ITEMS[a.item].name, "이", "가")} 없다!`, 500); continue; }
        await play(C.exec(B, a, Math.random));
        await play(C.phase(B));
        if (B.phase2 && !B.phase2shown) { B.phase2shown = true; layoutFoes(); }
        if (C.result(B)) break;
      }
      if (!C.result(B)) await play(C.endRound(B));
      if (!B.warn) ui.warn.hidden = true; else { ui.warn.hidden = false; ui.warn.textContent = "⚠ " + B.warn; }
      res = C.result(B);
    }
    ui.warn.hidden = true;
    G.battles++;
    if (o.boss) { G.bossLog = G.bossLog || []; G.bossLog.push({ foe: o.foes[0], res, turns: B.turn, lv: G.party.map((m) => m.lv).join("/") }); }
    if (res === "win") {
      const rw = C.rewards(B);
      for (const f of B.foes) G.kills[f.id] = (G.kills[f.id] || 0) + 1;
      G.gold += rw.gold;
      beep("ok");
      await bmsg(`승리! ${rw.exp} EXP와 ${rw.gold}골드를 얻었다.`, 1000);
      for (const [k, p] of rw.drops) if (Math.random() < p) { give(k, 1); await bmsg(`${D.ITEMS[k].name}${josa(D.ITEMS[k].name, "을", "를")} 주웠다!`, 700); }
      for (const m of G.party) {
        const ups = C.gainExp(m, rw.exp);
        for (const u of ups) {
          beep("lv"); partyHud();
          await bmsg(`${mname(m)}의 레벨이 ${u.lv}${josa(String(u.lv), "이", "가")} 되었다!`, 900);
          for (const k of u.learned) await bmsg(`${mname(m)}${josa(mname(m), "은", "는")} 「${D.SKILLS[k].name}」${josa(D.SKILLS[k].name, "을", "를")} 배웠다!`, 900);
        }
      }
      if (G.flags.q5 && !G.flags.q5done && kinds() >= 12 && !G.flags.q5told) { G.flags.q5told = 1; toast("몬스터 12종 달성! 학자 펭에게 가 보자"); }
    }
    for (const c of B.party) { c.st = {}; if (c.m.hp <= 0 && res !== "lose") c.m.hp = 1; }
    screen.classList.remove("in-battle");
    ui.banner.hidden = true; ui.party.hidden = true; ui.win.hidden = true;
    B = null;
    mode = prevMode === "battle" ? "field" : prevMode;
    if (res === "lose") {
      await fade(true);
      ui.banner.hidden = true;
      G.losses = (G.losses || 0) + 1;
      const lost = Math.floor(G.gold * 0.1);
      G.gold -= lost;
      healAll();
      placeAt(...G.respawn, "down");
      save(true);
      await fade(false);
      await say(null, ["눈앞이 하얘졌다…", `정신을 차려 보니 마지막으로 쉰 곳이다. (골드 ${lost} 분실, HP·MP 회복)`]);
      return "lose";
    }
    save(true);
    return res;
  }

  // ---------- 엔딩 ----------
  async function ending() {
    mode = "ending";
    for (const [n, s] of D.ENDING) await say(n, s);
    G.flags.cleared = true;
    G.flags.tower = true;
    save(true);
    const t = ui.title;
    t.hidden = false;
    t.className = "rpg-title rpg-end";
    const lv = G.party.map((m) => `${mname(m)} Lv${m.lv}`).join(" · ");
    t.innerHTML = `<div class="rpg-roll"><h2>뽀득이와 오색 연</h2><p class="rpg-sub">— 끝 —</p><dl><dt>플레이 시간</dt><dd>${fmtTime(G.ms)}</dd><dt>전투</dt><dd>${G.battles}번</dd><dt>파티</dt><dd>${esc(lv)}</dd><dt>몬스터 수첩</dt><dd>${kinds()}/15종</dd><dt>서브 퀘스트</dt><dd>${["q1", "q2", "q3", "q4", "q5"].filter((q) => G.flags[q + "done"]).length}/5</dd></dl><p class="rpg-credit">만든 곳: 세화산업 · 펭귄 툴즈<br>그림·이야기·소리 모두 코드로 직접 만들었어요.</p><div class="rank-slot"></div><div class="rpg-tbtn"><button type="button" class="btn" data-a="free">마을에서 계속 놀기</button><button type="button" class="btn ghost" data-a="title">타이틀로</button></div></div>`;
    if (!dbg.auto) window.PT_RANK && PT_RANK.report("rpg", Math.round(G.ms / 1000), t.querySelector(".rank-slot")); // 자동 시험 플레이는 올리지 않음
    const w = { kinds: ["A"], res: null };
    const r = await new Promise((res) => { w.res = () => res("free"); t.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => res(b.dataset.a))); if (dbg.auto) setTimeout(() => res("free"), 50); setTimeout(() => waiters.push(w), 800); });
    waiters = waiters.filter((x) => x !== w);
    t.hidden = true;
    t.className = "rpg-title";
    if (r === "title") { mode = "title"; return showTitle(); }
    placeAt("village", 13, 11, "down");
    save(true);
    mode = "field";
    showPlace();
  }

  // ---------- 타이틀 ----------
  function showTitle() {
    mode = "title";
    const t = ui.title;
    t.hidden = false;
    t.className = "rpg-title";
    const can = hasSave(), g = can ? load() : null;
    t.innerHTML = `<div class="rpg-logo"><small>펭귄 RPG</small><h2>뽀득이와 오색 연</h2><p>찢어진 오색 연의 실 네 가닥을 찾아 떠나는 약 1시간짜리 모험</p></div>
    <div class="rpg-tbtn">${can ? `<button type="button" class="btn" data-a="cont">이어 하기<small>${g ? esc(D.MAPS[g.map].name) + " · Lv" + g.party[0].lv + " · " + fmtTime(g.ms) : ""}</small></button>` : ""}<button type="button" class="btn ${can ? "ghost" : ""}" data-a="new">처음부터</button></div>
    <p class="rpg-tnote">진행은 이 브라우저에만 자동 저장돼요(서버 전송 없음). <button type="button" class="rpg-snd" data-a="snd" aria-pressed="${opt.sound}">소리 ${opt.sound ? "켬" : "끔"}</button></p>`;
    t.querySelectorAll(".rpg-tbtn button").forEach((b) => b.addEventListener("click", () => start(b.dataset.a)));
    const sb = t.querySelector(".rpg-snd");
    sb.addEventListener("click", () => { opt.sound = !opt.sound; try { localStorage.setItem(OPT_KEY, JSON.stringify(opt)); } catch (e) {} sb.textContent = `소리 ${opt.sound ? "켬" : "끔"}`; sb.setAttribute("aria-pressed", opt.sound); beep("ok"); });
    const first = t.querySelector("button");
    waiters.push({ kinds: ["A"], res: () => { if (mode === "title" && !t.hidden) start(can ? "cont" : "new"); } });
    void first;
  }
  async function start(kind) {
    if (mode !== "title") return;
    active = true;
    if (kind === "new" && hasSave() && !dbg.auto) {
      if (!window.confirm("저장된 진행이 지워지고 처음부터 시작해요. 괜찮을까요?")) return;
    }
    waiters = [];
    G = kind === "cont" ? load() || newGame() : newGame();
    ui.title.hidden = true;
    placeAt(G.map, G.x, G.y, G.dir);
    mode = "field";
    root.focus({ preventScroll: true });
    // 게임 화면과 패드가 한 화면에 들어오도록(고정 머리글 아래로) 스크롤
    const hd = document.querySelector(".site-header"), top = hd && getComputedStyle(hd).position === "sticky" ? hd.offsetHeight : 0;
    const r = root.getBoundingClientRect();
    if (r.top < top || r.bottom > innerHeight) window.scrollTo({ top: Math.max(0, scrollY + r.top - top - 8), behavior: "smooth" });
    showPlace();
    if (!G.flags.intro) await run(() => D.S.intro(api, G.flags));
    save(true);
  }

  // ---------- 그리기 ----------
  function cam() {
    const cx = P.px + TS / 2 - CW / 2, cy = P.py + TS / 2 - CH / 2;
    return [Math.round(Math.max(0, Math.min(cur.w * TS - CW, cx))), Math.round(Math.max(0, Math.min(cur.h * TS - CH, cy)))];
  }
  function drawField(t) {
    const [cx, cy] = cam();
    const f = Math.floor(t / 400) % 2;
    ctx.fillStyle = "#141414"; ctx.fillRect(0, 0, CW, CH);
    const x0 = Math.floor(cx / TS), y0 = Math.floor(cy / TS);
    for (let y = y0; y <= y0 + VH; y++) for (let x = x0; x <= x0 + VW; x++) {
      if (x < 0 || y < 0 || x >= cur.w || y >= cur.h) continue;
      ctx.drawImage(ART.tile(cur.theme, cur.rows[y][x], x, y, f), x * TS - cx, y * TS - cy);
    }
    const draws = [];
    for (const e of evs()) {
      let img = null, big = false;
      if (e.type === "chest") img = ART.obj(e.sp === "pepper" ? (G.opened[e.id] ? "pepperGone" : "pepper") : G.opened[e.id] ? "chestOpen" : "chest");
      else if (e.type === "sign") img = ART.obj("sign");
      else if (e.type === "fire") img = ART.obj("fire", f);
      else if (e.type === "boss") { img = ART.monster(e.sp); big = true; }
      else if (e.sp) img = ART.actor(e.sp, e.dir || "down", 0);
      if (img) draws.push({ y: e.y * TS, img, x: e.x * TS, big });
    }
    // 동료(뒤따라 걷기)
    const walking = !!P.moving;
    const fr = walking ? Math.floor(t / 130) % 2 : 0;
    const k = P.moving ? P.moving.t : 1;
    G.party.slice(1).forEach((m, i) => {
      const a = P.trail[i + 1] || P.trail[P.trail.length - 1], b = P.trail[i] || a;
      const x = (a[0] + (b[0] - a[0]) * (P.moving ? k : 1)) * TS, y = (a[1] + (b[1] - a[1]) * (P.moving ? k : 1)) * TS;
      draws.push({ y: y - 0.5, x, img: ART.actor(m.id === "mong" ? "mong" : "kkak", b[2] || "down", fr) });
    });
    if (G.flags.chick && !G.flags.q3done) { const a = P.trail[G.party.length] || P.trail[P.trail.length - 1]; draws.push({ y: a[1] * TS - 0.6, x: a[0] * TS, img: ART.actor("chick", a[2] || "down", fr) }); }
    draws.push({ y: P.py, x: P.px, img: ART.actor("hero", G.dir, fr), hero: true });
    draws.sort((a, b) => a.y - b.y);
    for (const d of draws) {
      if (d.big) ctx.drawImage(d.img, Math.round(d.x + TS / 2 - d.img.width / 2 - cx), Math.round(d.y + TS - d.img.height - cy));
      else ctx.drawImage(d.img, Math.round(d.x - cx), Math.round(d.y - cy));
    }
  }
  function drawTitleBg(t) {
    ART.battleBg(ctx, "village", CW, CH);
    const k = Math.sin(t / 600) * 3;
    ctx.drawImage(ART.obj("kite"), 146, Math.round(62 + k));
    ctx.fillStyle = "#141414";
    for (let i = 0; i <= 20; i++) { const x = 154 + (97 - 154) * (i / 20), y = 78 + k + (104 - 78 - k) * (i / 20) + Math.sin(i / 3) * 1.5; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
    ctx.drawImage(ART.actor("hero", "right", Math.floor(t / 300) % 2), 82, 96);
    ctx.drawImage(ART.actor("mong", "right", 0), 52, 98);
    ctx.drawImage(ART.actor("kkak", "right", 0), 30, 98);
  }

  // ---------- 메인 루프 ----------
  function frame(t) {
    const dt = Math.min(50, t - (lastT || t)); lastT = t;
    pumpInput();
    if (mode === "field" || mode === "ending") {
      if (G) G.ms += dt;
      if (P.moving) {
        P.moving.t += dt / (dbg.fast ? 10 : 150);
        if (P.moving.t >= 1) { P.px = P.moving.tx * TS; P.py = P.moving.ty * TS; P.moving = null; if (!busy) arrive(); }
        else { P.px = (P.moving.fx + (P.moving.tx - P.moving.fx) * P.moving.t) * TS; P.py = (P.moving.fy + (P.moving.ty - P.moving.fy) * P.moving.t) * TS; }
      }
      if (!P.moving && !busy && mode === "field") {
        const dirs = ["up", "down", "left", "right"].filter((d) => held.has(d));
        const d = dbg.dir || dirs[dirs.length - 1];
        if (d) { if (!tryMove(d)) G.dir = d; }
      }
      drawField(t);
    } else if (mode === "battle" && B) { if (G) G.ms += dt; drawBattle(t); }
    else if (mode === "title") drawTitleBg(t);
    requestAnimationFrame(frame);
  }
  showTitle();
  requestAnimationFrame(frame);
  window.addEventListener("pagehide", () => { if (G && mode !== "title") save(true); });

  // ---------- 디버그(자동 플레이 시험용, ?debug=1 일 때만) ----------
  if (DEBUG) {
    const path = (tx, ty) => {
      const H = cur.h, W = cur.w, prev = {};
      const q = [[G.x, G.y]]; prev[G.x + "," + G.y] = null;
      const goal = (x, y) => (x === tx && y === ty) || (!passable(tx, ty) && Math.abs(x - tx) + Math.abs(y - ty) === 1);
      while (q.length) {
        const [x, y] = q.shift();
        if (goal(x, y)) { const out = []; let k = x + "," + y; while (prev[k]) { out.unshift(prev[k][2]); k = prev[k][0] + "," + prev[k][1]; } return { steps: out, end: [x, y] }; }
        for (const [d, [dx, dy]] of Object.entries(DIRS)) {
          const nx = x + dx, ny = y + dy, key = nx + "," + ny;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || key in prev || !passable(nx, ny)) continue;
          const we = evAt(nx, ny);
          if (we && we.type === "warp" && !(nx === tx && ny === ty)) continue; // 목적지가 아니면 출구는 밟지 않음
          prev[key] = [x, y, d]; q.push([nx, ny]);
        }
      }
      return null;
    };
    const idle = async (limit = 120000) => { const t0 = Date.now(); while (busy || P.moving || mode !== "field") { if (Date.now() - t0 > limit) return false; await new Promise((r) => setTimeout(r, 20)); } return true; };
    window.RPG_DEBUG = {
      dbg, get G() { return G; }, get mode() { return mode; }, get busy() { return busy; }, get map() { return cur && cur.id; },
      start: (k = "new") => start(k), save: () => save(true), load,
      fight: (foes, boss) => { run(() => battle({ foes, boss })); },
      press: (k) => { pressQ.push(k); },
      join: (id) => join(id), ending: () => { run(ending); }, menu: () => { run(menu); },
      showPlace: () => showPlace(),
      get battle() { return B ? { warn: B.warn, turn: B.turn, phase2: !!B.phase2, foes: B.foes.map((f) => f.id + ":" + f.hp) } : null; },
      async walkTo(tx, ty, face) {
        for (let guard = 0; guard < 400; guard++) {
          await idle();
          if (G.x === tx && G.y === ty) break;
          const p = path(tx, ty);
          if (!p) throw new Error(`길 없음 ${cur.id} (${G.x},${G.y})→(${tx},${ty})`);
          if (!p.steps.length) { const dx = tx - G.x, dy = ty - G.y; G.dir = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up"; break; }
          const startMap = cur.id;
          tryMove(p.steps[0]);
          await idle();
          if (cur.id !== startMap) return;
        }
        if (face) G.dir = face;
      },
      async talk() { await idle(); interact(); await new Promise((r) => setTimeout(r, 20)); await idle(); },
      async step(dir) { await idle(); tryMove(dir); await idle(); },
      warpNow: (m, x, y, d) => placeAt(m, x, y, d),
      setLevel: (lv) => { for (const m of G.party) { m.lv = lv; m.exp = 0; } healAll(); },
      flag: (k, v = true) => { G.flags[k] = v; },
      give, idle, events: () => evs().map((e) => ({ ...e })), dungeon: (id) => D.MAPS[id].gen,
      // 상점에서 살 수 있는 가장 좋은 장비를 사서 끼우고, 회복 아이템을 채움(자동 플레이 시험용)
      shopBest() {
        const stock = D.SHOPS.village(G.flags), val = (k) => (k ? (D.ITEMS[k].atk || 0) + (D.ITEMS[k].def || 0) + (D.ITEMS[k].spd || 0) / 2 + (D.ITEMS[k].hp || 0) / 10 : 0);
        const bought = [];
        for (const m of G.party) for (const t of ["w", "a", "c"]) {
          const owned = Object.keys(G.inv).filter((k) => G.inv[k] > 0 && D.ITEMS[k].t === t).sort((a, b) => val(b) - val(a))[0];
          if (owned && val(owned) > val(m.eq[t])) { if (m.eq[t]) give(m.eq[t]); take(owned); m.eq[t] = owned; }
          const best = stock.filter((k) => D.ITEMS[k].t === t && G.gold >= D.ITEMS[k].price && val(k) > val(m.eq[t])).sort((a, b) => val(b) - val(a))[0];
          if (best) { G.gold -= D.ITEMS[best].price; if (m.eq[t]) give(m.eq[t]); m.eq[t] = best; bought.push(best); }
        }
        const heal = G.flags.boss1 ? "bigfish" : "fish";
        while (G.gold > D.ITEMS[heal].price * 4 && count(heal) < 6) { G.gold -= D.ITEMS[heal].price; give(heal); bought.push(heal); }
        while (G.gold > 100 && count("candy") < 4) { G.gold -= 25; give("candy"); bought.push("candy"); }
        save(true);
        return bought;
      },
    };
  }
})();
