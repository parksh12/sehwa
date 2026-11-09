"use strict";
/* 지뢰찾기 화면 (P2-60). 규칙은 mines-core.js(MinesCore)에 있고, 여기는 그리기·조작·기록만 맡음
   - PC: 왼쪽 클릭 열기, 오른쪽 클릭 깃발, 숫자 칸 클릭(또는 가운데 클릭) = 코드(동시 열기)
   - 휴대폰: 탭 = 지금 모드(열기/깃발), 길게 누르기 = 깃발. 판은 끌어서 스크롤, −/+로 확대·축소
   - 키보드: 판에 초점 → 방향키 이동, Enter·Space 열기(숫자 칸이면 코드), F 깃발
   - 최고 기록·판 수는 이 기기의 localStorage("sehwa-mines")에만 저장(서버 전송 없음) */
(function () {
  const M = window.MinesCore;
  const root = document.getElementById("mn");
  if (!root || !M) return;
  const $ = (s) => root.querySelector(s);
  const scroll = $("#mn-scroll"), boardEl = $("#mn-board"), leftEl = $("#mn-left"), timeEl = $("#mn-time"), result = $("#mn-result"), modeBtn = $('[data-act="mode"]');
  const custom = $(".mn-custom");
  const STORE = "sehwa-mines";
  const LONG_MS = 380, MOVE_PX = 10;
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 직접 그린 아이콘(사이트 오방색). 특정 제품의 그림을 본뜨지 않음
  const ICON = {
    flag: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3v13" stroke="#141414" stroke-width="2.2" stroke-linecap="round"/><path d="M7 3.5l9 3.2-4 1.3 4 1.6-9 2.9z" fill="#e5372b" stroke="#141414" stroke-width="1.3" stroke-linejoin="round"/><rect x="3" y="15.5" width="7" height="2.6" rx="1.3" fill="#141414"/></svg>',
    mine: '<svg viewBox="0 0 20 20" aria-hidden="true"><g stroke="#141414" stroke-width="2.2" stroke-linecap="round"><path d="M10 2.2v15.6M2.2 10h15.6"/><path d="M4.6 4.6l10.8 10.8M15.4 4.6 4.6 15.4" stroke-width="1.6"/></g><circle cx="10" cy="10" r="5.6" fill="#141414"/><circle cx="10" cy="10" r="2.4" fill="#ffc21a"/><circle cx="8" cy="7.9" r="1.1" fill="#fff"/></svg>',
    clock: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="11" r="7" fill="#fff" stroke="#141414" stroke-width="2"/><path d="M10 7v4l3 2" fill="none" stroke="#141414" stroke-width="2" stroke-linecap="round"/><rect x="8" y="1.5" width="4" height="2.4" rx="1" fill="#141414"/></svg>',
  };
  root.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = ICON[el.dataset.icon]; });

  // ---- 기록 ----
  const readStore = () => { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } };
  const writeStore = (o) => { try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) {} };
  const fmt = (ms) => (ms / 1000).toFixed(1) + "초";

  // ---- 상태 ----
  let lv = "beginner", conf = M.LEVELS.beginner, b, flagMode = false, cs = 30, fitMode = true;
  let t0 = 0, tick = 0, elapsed = 0, keyIdx = 0, keyOn = false, cells = [], shown = [];

  function pickLevel(k) {
    lv = k;
    root.querySelectorAll("[data-lv]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.lv === k)));
    custom.hidden = k !== "custom";
    if (k === "custom") {
      conf = readCustom();
    } else conf = M.LEVELS[k];
    const s = readStore(); s.lv = k; writeStore(s);
    newGame();
  }

  function portrait() { return scroll.clientWidth < conf.w * 20; } // 가로가 긴 판이 화면에 안 들어가면 세로로
  function newGame() {
    stopTimer(); elapsed = 0; timeEl.textContent = "0";
    const o = M.orient(conf.w, conf.h, portrait());
    b = M.create(o.w, o.h, conf.n);
    if (lv === "custom" && conf.n !== b.n) { conf = { ...conf, n: b.n }; custom.elements.n.value = b.n; } // 지뢰 수는 가로×세로−9까지
    root.dataset.state = "ready";
    boardEl.className = "mn-board";
    result.hidden = true; result.innerHTML = "";
    keyIdx = Math.floor(b.size / 2);
    build();
    updateLeft();
  }

  function build() {
    boardEl.style.setProperty("--cols", b.w);
    boardEl.setAttribute("aria-label", `지뢰찾기 판 ${b.w}×${b.h}, 지뢰 ${b.n}개. 방향키로 이동, Enter 열기, F 깃발`);
    const frag = document.createDocumentFragment();
    cells = [];
    for (let i = 0; i < b.size; i++) {
      const d = document.createElement("div");
      d.className = "mc";
      d.dataset.i = i;
      cells.push(d); frag.appendChild(d);
    }
    boardEl.replaceChildren(frag);
    shown = new Array(b.size).fill("");
    fit();
  }

  // 칸 크기: 「맞춤」은 판 너비에 맞추되 최소 22px(P2-61: 390px 중급판 약 17px는 누르기 어려워서). 넘치면 판 안에서 가로 스크롤. −/+는 4px씩(−로 14px까지 줄여 전체 보기)
  const FIT_MIN = 22;
  function fit() {
    const pad = 10, gap = 2;
    const avail = scroll.clientWidth - pad * 2 - (b.w - 1) * gap - 6;
    const f = Math.max(FIT_MIN, Math.min(42, Math.floor(avail / b.w)));
    if (fitMode) cs = f;
    boardEl.style.setProperty("--cs", cs + "px");
    $('[data-act="fit"]').setAttribute("aria-pressed", String(fitMode));
  }
  function zoom(d) {
    const keep = { x: (scroll.scrollLeft + scroll.clientWidth / 2) / scroll.scrollWidth, y: (scroll.scrollTop + scroll.clientHeight / 2) / scroll.scrollHeight };
    cs = Math.max(14, Math.min(56, cs + d));
    fitMode = false; fit();
    scroll.scrollLeft = keep.x * scroll.scrollWidth - scroll.clientWidth / 2;
    scroll.scrollTop = keep.y * scroll.scrollHeight - scroll.clientHeight / 2;
  }

  function keyOf(i) {
    const st = b.st[i];
    if (b.over === -1) {
      if (i === b.boom) return "b";
      if (b.mine[i] && st !== 2) return "m";
      if (st === 2 && !b.mine[i]) return "x";
    }
    if (st === 2) return "f";
    if (st === 1) return "o" + b.adj[i];
    return "";
  }
  function render() {
    for (let i = 0; i < b.size; i++) {
      const k = keyOf(i);
      if (k === shown[i]) continue;
      shown[i] = k;
      const d = cells[i];
      let cls = "mc", html = "";
      if (k === "f") { cls += " f"; html = ICON.flag; }
      else if (k === "m" || k === "b") { cls += " o m" + (k === "b" ? " boom" : ""); html = ICON.mine; }
      else if (k === "x") { cls += " f x"; html = ICON.flag; }
      else if (k[0] === "o") { const n = +k[1]; cls += " o" + (n ? " n" + n : ""); html = n ? String(n) : ""; }
      d.className = cls;
      d.innerHTML = html;
      if (b.over === -1 && (k === "m" || k === "x")) d.style.setProperty("--d", Math.min(700, dist(i, b.boom) * 45) + "ms");
    }
    markKey();
    updateLeft();
  }
  const dist = (i, j) => Math.hypot((i % b.w) - (j % b.w), Math.floor(i / b.w) - Math.floor(j / b.w));
  function updateLeft() { leftEl.textContent = String(b.n - b.flags); }
  function markKey() {
    root.querySelectorAll(".mc.k").forEach((x) => x.classList.remove("k"));
    if (keyOn && cells[keyIdx]) cells[keyIdx].classList.add("k");
  }

  // ---- 타이머 ----
  function startTimer() {
    t0 = performance.now();
    root.dataset.state = "play";
    tick = setInterval(() => { elapsed = performance.now() - t0; timeEl.textContent = String(Math.min(9999, Math.floor(elapsed / 1000))); }, 200);
    if (lv !== "custom") { const s = readStore(); const r = s[lv] || {}; r.p = (r.p || 0) + 1; s[lv] = r; writeStore(s); }
  }
  function stopTimer() { clearInterval(tick); tick = 0; }

  // ---- 조작 ----
  const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
  function nudge(i) { const d = cells[i]; d.classList.remove("nudge"); void d.offsetWidth; d.classList.add("nudge"); }
  function doOpen(i) {
    if (b.over) return;
    const first = !b.laid;
    if (b.st[i] === 2) { nudge(i); hint("깃발 칸은 열리지 않아요. 먼저 깃발을 빼 주세요."); return; }
    if (b.st[i] === 1) { M.chord(b, i); }
    else { M.open(b, i, rand); if (first && b.laid) startTimer(); }
    after();
  }
  function doFlag(i) {
    if (b.over) return;
    if (b.st[i] === 1) { M.chord(b, i); after(); return; } // 깃발 모드에서 숫자를 눌러도 코드
    if (M.toggleFlag(b, i)) { buzz(12); render(); }
  }
  function act(i, how) { if (how === "flag" || (how !== "open" && flagMode)) doFlag(i); else doOpen(i); }
  function after() {
    render();
    if (b.over) end();
  }
  function rand() { // 지뢰 위치는 crypto 난수
    try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; } catch (e) { return Math.random(); }
  }

  let hintT = 0;
  function hint(msg) {
    const h = $(".mn-toast");
    h.textContent = msg; h.hidden = false;
    clearTimeout(hintT); hintT = setTimeout(() => { h.hidden = true; }, 1800);
  }

  function end() {
    stopTimer();
    elapsed = t0 ? performance.now() - t0 : 0;
    timeEl.textContent = String(Math.floor(elapsed / 1000));
    const win = b.over === 1;
    root.dataset.state = win ? "won" : "lost";
    boardEl.classList.add(win ? "mn-won" : "mn-lost");
    if (win) cells.forEach((d, i) => d.style.setProperty("--d", Math.min(700, ((i % b.w) + Math.floor(i / b.w)) * 18) + "ms"));
    buzz(win ? [20, 60, 20] : 120);
    let best = 0, isBest = false, stat = null;
    if (lv !== "custom") {
      const s = readStore(), r = s[lv] || {};
      if (win) { r.w = (r.w || 0) + 1; if (!r.b || elapsed < r.b) { r.b = Math.round(elapsed); isBest = true; } }
      s[lv] = r; writeStore(s); best = r.b; stat = r;
    }
    const safeLeft = b.size - b.n - b.opened, pct = Math.floor((b.opened / (b.size - b.n)) * 100);
    const next = { beginner: "intermediate", intermediate: "expert" }[lv];
    result.innerHTML = win
      ? `<p class="mn-r-h">${isBest ? '<span class="mn-new">신기록</span> ' : ""}지뢰를 다 찾았어요!</p><p>${conf.name} ${b.w}×${b.h} · 지뢰 ${b.n}개 · <b>${fmt(elapsed)}</b>${best && !isBest ? ` <small>(내 최고 ${fmt(best)})</small>` : ""}</p><div class="mn-r-btns"><button class="btn" type="button" data-act="new">한 판 더</button>${next ? `<button class="btn ghost" type="button" data-lv-go="${next}">${M.LEVELS[next].name}에 도전</button>` : ""}<button class="btn ghost mn-r-x" type="button" data-act="hide" aria-label="결과 닫고 판 보기">판 보기</button></div>`
      : `<p class="mn-r-h">펑! 지뢰를 밟았어요</p><p>안전한 칸 ${pct}%를 열었어요${safeLeft ? ` · 남은 칸 ${safeLeft}개` : ""} · ${fmt(elapsed)}</p><div class="mn-r-btns"><button class="btn" type="button" data-act="new">다시 하기</button><button class="btn ghost mn-r-x" type="button" data-act="hide" aria-label="결과 닫고 판 보기">판 보기</button></div>`;
    result.className = "mn-result " + (win ? "won" : "lost");
    setTimeout(() => { if (b.over) result.hidden = false; }, reduce ? 0 : win ? 750 : 650);
    renderBest(stat && isBest ? lv : "");
  }

  function renderBest(flash) {
    const s = readStore();
    $("#mn-best").innerHTML = Object.entries(M.LEVELS).map(([k, L]) => {
      const r = s[k] || {};
      return `<tr${flash === k ? ' class="hot"' : ""}><th scope="row">${L.name} <small>${L.h}×${L.w} · ${L.n}</small></th><td>${r.b ? fmt(r.b) : "—"}</td><td>${r.w || 0} / ${r.p || 0}</td></tr>`;
    }).join("");
  }

  // ---- 포인터(마우스·터치·펜) ----
  let press = null;
  const cellAt = (e) => { const t = e.target.closest && e.target.closest(".mc"); return t && boardEl.contains(t) ? +t.dataset.i : -1; };
  function pressVisual(i, on) {
    const list = i < 0 ? [] : b.st[i] === 1 ? M.neighbors(b, i).filter((j) => b.st[j] === 0) : b.st[i] === 0 && !flagMode ? [i] : [];
    root.querySelectorAll(".mc.p").forEach((x) => x.classList.remove("p"));
    if (on && !b.over) list.forEach((j) => cells[j].classList.add("p"));
  }
  boardEl.addEventListener("pointerdown", (e) => {
    const i = cellAt(e);
    if (i < 0 || b.over) return;
    keyOn = false;
    if (e.pointerType === "mouse") {
      if (e.button === 2) { e.preventDefault(); doFlag(i); return; }
      if (e.button === 1) { e.preventDefault(); M.chord(b, i); after(); return; }
      if (e.button !== 0) return;
    }
    press = { i, id: e.pointerId, x: e.clientX, y: e.clientY, used: false, timer: 0 };
    if (e.pointerType !== "mouse") press.timer = setTimeout(() => { if (press && press.i === i) { press.used = true; pressVisual(-1); if (b.st[i] !== 1) doFlag(i); } }, LONG_MS);
    pressVisual(i, true);
  });
  boardEl.addEventListener("pointermove", (e) => {
    if (!press || e.pointerId !== press.id) return;
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_PX) cancelPress();
  });
  function cancelPress() { if (press) clearTimeout(press.timer); press = null; pressVisual(-1); }
  boardEl.addEventListener("pointerup", (e) => {
    if (!press || e.pointerId !== press.id) return;
    const p = press; cancelPress();
    if (p.used) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const j = el && el.closest && el.closest(".mc") ? +el.closest(".mc").dataset.i : -1;
    if (j === p.i) act(p.i);
  });
  boardEl.addEventListener("pointercancel", cancelPress);
  boardEl.addEventListener("pointerleave", (e) => { if (press && e.pointerType === "mouse") cancelPress(); });
  // P2-61 우클릭 메뉴 막기: 판 칸뿐 아니라 게임 영역 전체(상태줄·스크롤 테두리·결과 덮개·확대 상태 포함). 입력칸·링크만 브라우저 메뉴 허용(복사·붙여넣기용)
  // 칸 위 우클릭 = 깃발(위 pointerdown 단계에서 처리, 판이 끝났으면 아무 일 없음). 칸 밖 우클릭 = 아무 일 없음
  const area = root.closest(".tool-box") || root;
  const menuOk = (t) => !!(t && t.closest && t.closest("input, textarea, select, a, [contenteditable]"));
  area.addEventListener("contextmenu", (e) => { if (!menuOk(e.target)) e.preventDefault(); });
  area.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse" && e.button === 2 && !menuOk(e.target)) e.preventDefault(); }); // 칸 밖 우클릭: 글자 선택·초점 이동 없이 끝

  // ---- 키보드 ----
  boardEl.addEventListener("keydown", (e) => {
    const k = e.key;
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (mv) {
      e.preventDefault(); keyOn = true;
      const x = Math.max(0, Math.min(b.w - 1, (keyIdx % b.w) + mv[0])), y = Math.max(0, Math.min(b.h - 1, Math.floor(keyIdx / b.w) + mv[1]));
      keyIdx = y * b.w + x; markKey();
      cells[keyIdx].scrollIntoView({ block: "nearest", inline: "nearest" });
    } else if (k === "Enter" || k === " ") { e.preventDefault(); keyOn = true; act(keyIdx, "open"); }
    else if (k === "f" || k === "F") { e.preventDefault(); keyOn = true; act(keyIdx, "flag"); }
  });
  boardEl.addEventListener("blur", () => { keyOn = false; markKey(); });
  boardEl.addEventListener("focus", () => { try { if (boardEl.matches(":focus-visible")) { keyOn = true; markKey(); } } catch (e) {} });

  // ---- 버튼 ----
  root.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !root.contains(t)) return;
    const a = t.dataset.act;
    if (t.dataset.lv) pickLevel(t.dataset.lv);
    else if (t.dataset.lvGo) { pickLevel(t.dataset.lvGo); scroll.scrollIntoView({ block: "nearest" }); }
    else if (a === "new") newGame();
    else if (a === "mode") { flagMode = !flagMode; modeBtn.setAttribute("aria-pressed", String(flagMode)); root.classList.toggle("flagging", flagMode); }
    else if (a === "zoom-in") zoom(4);
    else if (a === "zoom-out") zoom(-4);
    else if (a === "fit") { fitMode = true; fit(); }
    else if (a === "hide") result.hidden = true;
    else if (a === "reset-best") { if (confirm("이 기기에 저장된 지뢰찾기 최고 기록과 판 수를 지울까요?")) { const s = readStore(); writeStore({ lv: s.lv }); renderBest(); } }
  });
  custom.addEventListener("submit", (e) => {
    e.preventDefault();
    conf = readCustom();
    newGame();
  });
  function readCustom() {
    const f = custom.elements;
    const w = Math.max(5, Math.min(30, Math.round(+f.w.value) || 9)), h = Math.max(5, Math.min(30, Math.round(+f.h.value) || 9));
    const n = Math.max(1, Math.min(M.maxMines(w, h), Math.round(+f.n.value) || 10));
    f.w.value = w; f.h.value = h; f.n.value = n;
    return { name: "사용자 지정", w, h, n };
  }
  custom.addEventListener("input", () => {
    const f = custom.elements, w = +f.w.value || 5, h = +f.h.value || 5;
    $(".mn-custom .hint b").textContent = String(M.maxMines(Math.max(5, Math.min(30, w)), Math.max(5, Math.min(30, h))));
  });
  document.addEventListener("keydown", (e) => { if ((e.key === "n" || e.key === "N") && document.activeElement === boardEl) newGame(); });

  let rw = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rw);
    rw = setTimeout(() => { if (!b.laid && M.orient(conf.w, conf.h, portrait()).w !== b.w) newGame(); else fit(); }, 150);
  });

  // 시작: 지난번 난이도
  const saved = readStore().lv;
  renderBest();
  pickLevel(saved && (saved === "custom" || M.LEVELS[saved]) ? saved : "beginner");
  render();
})();
