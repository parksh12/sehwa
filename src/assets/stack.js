"use strict";
/* 블록 쌓기 게임 (P2-20) — 랜덤7942 대기 화면 게임(random-chat/game.js, 대표님 소유 코드)을 펭귄 놀이터용으로 옮김
   - 좌우로 움직이는 블록을 탭(클릭·Space)해서 멈춤 → 아래 블록과 겹친 부분만 남음
   - 거의 딱 맞으면 PERFECT, 3연속부터 블록이 조금씩 다시 넓어짐. 점수 = 쌓은 층수
   - 바뀐 점: 모달 → 페이지 안 게임 영역, Firebase 순위표 제거 → 이 기기의 최고 기록만 localStorage에 저장(서버 전송 0) */
(function () {
  const $ = (id) => document.getElementById(id);
  const stage = $("stack-stage");
  if (!stage) return;
  const BEST_KEY = "nalgi-stack-best", COMBO_KEY = "nalgi-stack-combo"; // 최고 층수, PERFECT 최고 연속 (숫자 두 개)
  const BH = 24;                 // 블록 높이(px)
  let cv, g, W = 0, H = 0, dpr = 1;
  let stack, cur, pieces, score, combo, maxCombo, camY, over, playing, raf = 0, lastT = 0, baseW, flash;

  const PAL = ["#2346d8", "#e5372b", "#ffc21a", "#1e9e5a", "#ffffff"]; // 오방색 순환
  const num = (k) => { try { return +localStorage.getItem(k) || 0; } catch (e) { return 0; } };
  const save = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (e) {} };

  function resize() {
    W = stage.clientWidth; H = stage.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---- 게임 진행 ----
  function reset() {
    baseW = Math.round(W * 0.55);
    stack = [{ x: (W - baseW) / 2, w: baseW, h: 0 }];
    pieces = []; score = 0; combo = 0; maxCombo = 0; camY = 0; over = false; flash = 0;
    spawn();
    setScore(0);
  }
  function spawn() {
    const top = stack[stack.length - 1];
    const fromLeft = stack.length % 2 === 1;
    cur = { x: fromLeft ? -top.w * 0.5 : W - top.w * 0.5, w: top.w, dir: fromLeft ? 1 : -1, h: stack.length };
  }
  const speed = () => Math.min(2.1 + score * 0.09, 6.4) * (W / 360);
  const layerY = (i) => H - 36 - (i + 1) * BH; // 층 i의 화면상 y (카메라 반영 전)

  function place() {
    if (!playing || over) return;
    const prev = stack[stack.length - 1];
    const dx = cur.x - prev.x;
    const tol = Math.max(3, W * 0.012);
    let nb;
    if (Math.abs(dx) <= tol) {                       // PERFECT
      combo++; maxCombo = Math.max(maxCombo, combo);
      nb = { x: prev.x, w: prev.w, h: cur.h };
      if (combo >= 3 && nb.w < baseW) {              // 3연속부터 조금씩 다시 넓어짐
        const grow = Math.min(baseW - nb.w, Math.max(4, nb.w * 0.08));
        nb.w += grow; nb.x -= grow / 2;
      }
      pop(combo >= 2 ? "PERFECT ×" + combo : "PERFECT!");
      flash = 1; buzz(12);
    } else {
      combo = 0;
      const overlap = prev.w - Math.abs(dx);
      if (overlap <= 0) {                            // 완전히 빗나감 → 끝
        pieces.push({ x: cur.x, y: layerY(stack.length), w: cur.w, h: cur.h, vy: 0, a: 1 });
        return gameOver();
      }
      nb = { x: dx > 0 ? cur.x : prev.x, w: overlap, h: cur.h };
      pieces.push({ x: dx > 0 ? cur.x + overlap : cur.x, y: layerY(stack.length), w: Math.abs(dx), h: cur.h, vy: 0, a: 1 });
      buzz(6);
    }
    stack.push(nb);
    setScore(++score);
    spawn();
  }

  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((t - (lastT || t)) / 16.67, 3); lastT = t;
    if (playing && !over) {
      cur.x += cur.dir * speed() * dt;
      const lo = -cur.w * 0.5, hi = W - cur.w * 0.5;
      if (cur.x < lo) { cur.x = lo; cur.dir = 1; }
      if (cur.x > hi) { cur.x = hi; cur.dir = -1; }
    }
    const target = Math.max(0, (stack.length + 1) * BH - H * 0.55);
    camY += (target - camY) * Math.min(1, 0.12 * dt);
    pieces.forEach((p) => { p.vy += 0.45 * dt; p.y += p.vy * dt; p.a -= 0.02 * dt; });
    pieces = pieces.filter((p) => p.a > 0 && p.y - camY < H + 40);
    flash = Math.max(0, flash - 0.06 * dt);
    draw();
  }

  function block(x, y, w, h, a) {
    const r = Math.min(4, w / 2);
    g.globalAlpha = a == null ? 1 : Math.max(0, a);
    g.fillStyle = PAL[h % PAL.length];
    g.strokeStyle = "#141414"; g.lineWidth = 2;
    g.beginPath(); g.roundRect(x + 1, y + 1, Math.max(0, w - 2), BH - 3, r); g.fill(); g.stroke();
    g.globalAlpha = 1;
  }
  function draw() {
    g.clearRect(0, 0, W, H);
    if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash * 0.18})`; g.fillRect(0, 0, W, H); }
    stack.forEach((b, i) => { const y = layerY(i) + camY; if (y < H + BH && y > -BH) block(b.x, y, b.w, b.h); });
    pieces.forEach((p) => block(p.x, p.y + camY, p.w, p.h, p.a));
    if (playing && !over) block(cur.x, layerY(stack.length) + camY, cur.w, cur.h);
  }

  // ---- 화면 요소 ----
  function setScore(n) { $("stack-score").textContent = n; stage.dataset.score = n; }
  function pop(text) { const el = $("stack-pop"); el.textContent = text; el.classList.remove("show"); void el.offsetWidth; el.classList.add("show"); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function overlay(html) { const o = $("stack-overlay"); o.innerHTML = html; o.classList.toggle("show", !!html); }
  const setState = (s) => { stage.dataset.state = s; };

  function readyView() {
    const b = num(BEST_KEY), c = num(COMBO_KEY);
    overlay(
      '<div class="go-title">블록 쌓기</div>' +
      '<div class="go-sub">화면을 탭하거나 Space를 눌러 블록을 멈추세요.<br>아래 블록과 겹친 만큼만 남아요.</div>' +
      (b ? `<div class="go-best">이 기기의 최고 기록 <b>${b}층</b>${c ? ` · PERFECT 최고 연속 <b>${c}번</b>` : ""}</div>` : "") +
      '<button type="button" class="btn big go-btn" data-act="start">시작하기</button>');
    setState("ready");
  }
  function gameOver() {
    over = true; playing = false; buzz(40);
    const prevBest = num(BEST_KEY), prevCombo = num(COMBO_KEY);
    const isNew = score > prevBest;
    if (isNew) save(BEST_KEY, score);
    if (maxCombo > prevCombo) save(COMBO_KEY, maxCombo);
    overlay(
      `<div class="go-title">${score}층</div>` +
      (isNew && score > 0 ? '<div class="go-new">최고 기록 갱신!</div>' : "") +
      `<dl class="go-stats"><div><dt>점수</dt><dd>${score}층</dd></div><div><dt>최고 기록</dt><dd>${Math.max(prevBest, score)}층</dd></div><div><dt>PERFECT 연속</dt><dd>${maxCombo}번</dd></div></dl>` +
      '<button type="button" class="btn big go-btn" data-act="start">다시 하기</button>' +
      '<p class="go-sub">기록은 이 기기에만 남고 어디에도 보내지 않아요.</p>');
    setState("over");
    const n = +(stage.dataset.games || 0) + 1; stage.dataset.games = n;
  }
  function start() { overlay(""); reset(); playing = true; setState("play"); }

  // ---- 입력 ----
  cv = $("stack-canvas"); g = cv.getContext("2d");
  if (!g.roundRect) g.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); }; // 구형 브라우저
  stage.addEventListener("pointerdown", (e) => {
    const act = e.target.closest("[data-act]");
    if (act) { e.preventDefault(); if (act.dataset.act === "start") start(); return; }
    if (e.target.closest(".stack-overlay.show")) return;
    e.preventDefault();
    place();
  });
  stage.addEventListener("dblclick", (e) => e.preventDefault());           // 더블탭 확대 막기(touch-action:none과 함께)
  stage.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false }); // 게임 영역 안 스크롤 막기
  stage.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target === stage) { e.preventDefault(); playing ? place() : start(); } });
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Space" && e.key !== " ") return;
    const tag = (e.target && e.target.tagName) || "";
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || e.ctrlKey || e.metaKey || e.altKey) return;
    if ((tag === "BUTTON" || tag === "A") && !stage.contains(e.target)) return;
    const r = stage.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;                  // 게임 영역이 화면에 보일 때만
    e.preventDefault();
    if (e.repeat) return;
    if (playing) place(); else start();
  });
  window.addEventListener("resize", () => { const was = playing; resize(); if (!was) { reset(); draw(); } });
  // 다른 탭으로 가면 프레임만 쉬고, 돌아오면 이어서
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancelAnimationFrame(raf); else { lastT = 0; raf = requestAnimationFrame(frame); } });

  // 자동 테스트용 읽기 전용 값(주소에 #stackdebug가 있을 때만). 게임 동작에는 영향 없음
  if (/stackdebug/.test(location.hash)) window.__stack = { dx: () => cur.x - stack[stack.length - 1].x, w: () => stack[stack.length - 1].w, tol: () => Math.max(3, W * 0.012), playing: () => playing && !over };

  resize(); reset(); playing = false; readyView();
  raf = requestAnimationFrame(frame);
})();
