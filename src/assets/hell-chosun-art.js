// 헬조선에서 살아남기 — 도트 그림 (P2-28). P2-27 엔진(hell-art.js의 HELL.lib)을 재사용합니다. 이미지 파일 0.
// 챕터 배경 5종 + 장면 40종(소품 조합) + 나이별 옷차림 6종 + 새 사망 연출 4종 + 엔딩 4종.
(function () {
  const H = window.HELL, L = H && H.lib;
  if (!L) return;
  const { pen, sprite, cv, hash, clamp, ease, seg, C, K, W, HH, GY, txt, bubble, hero, ghost, skull, shoe, flame, steam, puff, stars, DEATH, FALL, IC, OUTFITS } = L;

  // ---------- 나이별 옷차림 ----------
  const dot = (P, xy, c) => xy.forEach(([a, b]) => P.p(a + 1, b + 1, c));
  Object.assign(OUTFITS, {
    baby: { scale: 0.72, pal: { h: "#6a4a2a", w: "#ffe0f0", b: "#ffe0f0", k: "#f0c0d8" } },
    kid: { scale: 0.85, pal: { h: "#3a2a20", w: "#ffd21a", b: "#2f6fe0", k: "#e5372b" } },
    student: { pal: { h: "#22222a", w: "#2a3a6a", b: "#2a3a6a", k: "#141414" }, deco: (P) => { dot(P, [[5, 7], [6, 7], [5, 8], [6, 8]], "#fff"); dot(P, [[5, 9], [6, 9], [5, 10]], "#e5372b"); } },
    youth: { pal: { h: "#3a3036", w: "#7a8a7a", b: "#3a4a6a", k: "#d8d8d8" }, deco: (P) => { dot(P, [[2, 0], [9, 0], [10, 1]], "#3a3036"); dot(P, [[5, 8], [6, 8]], "#5a6a5a"); } },
    suit: { pal: { h: "#22222a", w: "#3a3a4a", b: "#2a2a36", k: "#141414" }, deco: (P, pose, f) => { dot(P, [[5, 7], [6, 7], [5, 8], [6, 8]], "#fff"); dot(P, [[5, 9], [6, 9], [5, 10], [6, 10]], "#e5372b"); if (f === "n" || f === "w" || f === "p") dot(P, [[3, 5], [8, 5]], "#8a5aa8"); } },
    chef: { pal: { h: "#3a3036", w: "#ffffff", b: "#3a3a46", k: "#141414" }, deco: (P) => { dot(P, [[2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1]], "#e5372b"); dot(P, [[4, 9], [5, 9], [6, 9], [7, 9], [4, 10], [5, 10], [6, 10], [7, 10], [4, 11], [5, 11], [6, 11], [7, 11]], "#e5372b"); } },
    elder: { pal: { h: "#e8e8e8", w: "#c8a878", b: "#6a5a4a", k: "#3a2a20" }, deco: (P) => { dot(P, [[2, 0], [9, 0]], "#e8e8e8"); for (let j = 8; j < 15; j++) P.p(12, j + 1, "#8a5a32"); P.p(11, 9, "#8a5a32"); } },
  });
  const outfitFor = (n) => (n <= 2 ? "baby" : n <= 5 ? "kid" : n <= 8 ? "student" : n <= 16 ? "youth" : n <= 24 ? "suit" : n <= 32 ? "chef" : "elder");

  // ---------- 사람(NPC) ----------
  const NPC = [
    "...hhhhhh...", "..hhhhhhhh..", "..hssssssh..", "..sEssssEs..", "..ssssssss..", "..ssMMMsss..", "...ssssss...",
    "...wwwwww...", "..wwwwwwww..", ".swwwwwwwws.", ".s.wwwwww.s.", "...wwwwww...", "...bb..bb...", "...bb..bb...", "..kkk..kkk..",
  ];
  const NPCS = {
    adultA: { h: "#3a2a20", w: "#3fbf5a", b: "#4a4a55" }, adultB: { h: "#8a4a2a", w: "#9b4dff", b: "#2a2a36" },
    kid: { h: "#22222a", w: "#ff7a1a", b: "#2f6fe0", sc: 0.8 }, baby: { h: "#6a4a2a", w: "#bfe8ff", b: "#bfe8ff", sc: 0.65 },
    teacher: { h: "#22222a", w: "#e8e2d0", b: "#4a4a55", glasses: true }, boss: { h: "#5a5a5a", w: "#3a3a4a", b: "#2a2a36", tie: true, glasses: true, angry: true },
    rider: { h: "#ffc21a", w: "#2f6fe0", b: "#22222a", helmet: true }, owner: { h: "#22222a", w: "#e5372b", b: "#3a3a46" },
    doctor: { h: "#3a2a20", w: "#ffffff", b: "#6a6a74", glasses: true }, friend: { h: "#ff8fb1", w: "#ffd21a", b: "#3a4a6a" },
    elder: { h: "#e8e8e8", w: "#a8786a", b: "#5a4a3a" }, elder2: { h: "#cfcfcf", w: "#6a8ad8", b: "#4a4a55" }, customer: { h: "#22222a", w: "#3ff0ff", b: "#2a2a36" },
    clerk: { h: "#22222a", w: "#3a7ad8", b: "#22222a" },
  };
  function npc(x, X, Y, kind, o = {}) {
    const d = NPCS[kind] || NPCS.adultA;
    const s = sprite("npc:" + kind, NPC, { ...C, h: d.h, s: C.s, w: d.w, b: d.b, k: "#22222a", E: K, M: "#a0523a" }, (P) => {
      if (d.glasses) { P.r(3, 4, 3, 2, K); P.r(8, 4, 3, 2, K); P.r(6, 4, 2, 1, K); }
      if (d.tie) { P.r(6, 8, 2, 4, "#e5372b"); }
      if (d.angry) { P.r(3, 3, 3, 1, K); P.r(8, 3, 3, 1, K); }
      if (d.helmet) { P.r(2, 0, 10, 3, "#ffc21a"); P.r(2, 3, 10, 1, "#141414"); }
    });
    const sc = (d.sc || 1) * (o.sc || 1);
    x.save(); x.translate(Math.round(X), Math.round(Y)); x.scale((o.flip ? -1 : 1) * sc, sc); x.drawImage(s, -7, -s.height + 1); x.restore();
  }

  // ---------- 챕터 배경 ----------
  const bgCache = {};
  function bgStatic(no) {
    if (bgCache[no]) return bgCache[no];
    const c = cv(W, HH), x = c.getContext("2d"), P = pen(x);
    if (no === 1) { // 아기자기한 방
      P.r(0, 0, W, HH, "#ffe8f0"); for (let j = 0; j < 100; j += 10) for (let i = (j / 10) % 2 ? 5 : 0; i < W; i += 10) P.p(i, j + 4, "#ffc0d8");
      P.box(20, 18, 34, 28, "#bfe8ff"); P.r(36, 19, 2, 26, "#fff"); P.r(21, 31, 32, 2, "#fff"); P.e(30, 26, 4, 4, "#ffd21a");
      P.r(0, 100, W, 20, "#d8a878"); for (let i = 0; i < W; i += 20) P.r(i, 100, 1, 20, "#b8885a"); P.r(0, 100, W, 1, "#8a5a32");
      P.box(130, 14, 20, 14, "#fff"); P.tri(134, 24, 140, 17, 146, 24, "#3fbf5a");
    } else if (no === 2) { // 곰팡이 핀 반지하
      P.r(0, 0, W, HH, "#4a5248"); for (let i = 0; i < 70; i++) P.e(hash(i, 1) * W, hash(i, 2) * 90, 1 + hash(i, 3) * 3, 1 + hash(i, 4) * 2, hash(i, 5) > 0.5 ? "#3a4a30" : "#5a6a3a");
      P.box(60, 6, 44, 16, "#8aa0b8"); P.r(61, 7, 42, 4, "#6a7a6a");
      P.r(0, 100, W, 20, "#3a3a36"); P.r(0, 100, W, 1, "#22221e"); P.box(118, 76, 34, 24, "#6a6a5a"); P.r(119, 77, 32, 6, "#e8e8d8");
      P.r(79, 0, 1, 26, "#222");
    } else if (no === 3) { // 파티션 오피스(밤)
      P.r(0, 0, W, HH, "#1c2234"); P.box(10, 8, 140, 34, "#0c1020"); for (let i = 0; i < 30; i++) P.r(14 + hash(i, 7) * 130, 14 + hash(i, 8) * 26, 2, 3, hash(i, 9) > 0.4 ? "#ffe07a" : "#3a4a6a");
      for (let i = 0; i < 5; i++) { P.box(i * 34 - 4, 60, 30, 40, "#5a6070"); P.r(i * 34 - 2, 62, 26, 2, "#7a8090"); }
      P.r(0, 100, W, 20, "#2a3040"); for (let i = 0; i < W; i += 8) P.r(i, 100, 4, 20, "#262c3a"); P.r(0, 100, W, 1, "#7a8090");
    } else if (no === 4) { // 치킨집 주방
      P.r(0, 0, W, HH, "#f4ead0"); for (let j = 0; j < 100; j += 10) for (let i = 0; i < W; i += 10) P.r(i, j, 9, 9, (i / 10 + j / 10) % 2 ? "#fff6e0" : "#f0e2c0");
      P.box(12, 10, 56, 24, "#3a2a20"); for (let i = 0; i < 4; i++) P.r(16, 14 + i * 5, 30 + (i % 2) * 8, 2, "#ffc21a");
      P.r(0, 100, W, 20, "#8a3a2a"); for (let i = 0; i < W; i += 10) P.r(i, 100, 1, 20, "#6a2a1a"); P.r(0, 100, W, 1, "#3a1a10");
      P.r(100, 0, 1, 14, "#333"); P.tri(92, 20, 108, 20, 100, 13, "#e5372b");
    } else { // 노을 공원
      const sky = ["#2a1a4a", "#4a2a5a", "#7a3a5a", "#b04a4a", "#e0703a", "#ffa040", "#ffc860"]; sky.forEach((col, i) => P.r(0, i * 10, W, 10, col));
      P.e(110, 66, 16, 16, "#ffe07a"); for (let i = 0; i < W; i++) { const h = 8 + Math.floor(hash(Math.floor(i / 9), 3) * 10); P.r(i, 72 - h, 1, h, "#3a2a4a"); }
      P.r(0, 70, W, 30, "#5a7a3a"); P.r(0, 100, W, 20, "#c8a060"); P.r(0, 100, W, 1, "#8a6a3a");
      [[18, 70], [146, 72]].forEach(([tx, ty]) => { P.r(tx - 2, ty - 16, 4, 18, "#4a2a1a"); P.e(tx, ty - 22, 12, 10, "#2a4a2a"); });
    }
    bgCache[no] = c; return c;
  }
  function background(x, no, t) {
    x.drawImage(bgStatic(no), 0, 0);
    const P = pen(x);
    if (no === 2) { const k = (t * 0.6) % 1; const fx = 50 + k * 70; P.r(fx, 16, 5, 3, "#22222a"); P.r(fx + 8, 16 + (Math.floor(t * 4) % 2), 5, 3, "#22222a"); const sw = Math.sin(t * 2) * 3; P.r(79 + sw, 26, 3, 4, "#ffe07a"); P.e(80 + sw, 30, 2, 2, "#fff6c0"); }
    else if (no === 3) { if (Math.floor(t * 7) % 9) P.r(30, 0, 100, 2, "#e8f0ff"); else P.r(30, 0, 100, 2, "#6a7080"); }
    else if (no === 4) { for (let i = 0; i < 4; i++) steam(P, 30 + i * 30, 54, t + i * 0.3, "#fff"); }
    else if (no === 5) { for (let i = 0; i < 3; i++) { const bx = ((t * 8 + i * 60) % 190) - 15; P.r(bx, 30 + i * 6, 3, 1, "#2a1a3a"); P.p(bx + 1 + (Math.floor(t * 6) % 2 ? -1 : 3), 29 + i * 6, "#2a1a3a"); } }
  }
  function crt(x, t) { // 5장 브라운관 필터
    x.save(); x.fillStyle = "rgba(0,0,0,0.18)"; for (let y = 0; y < HH; y += 2) x.fillRect(0, y, W, 1);
    x.fillStyle = "rgba(255,200,120,0.06)"; x.fillRect(0, 0, W, HH); x.restore();
  }

  // ---------- 소품 ----------
  const PR = {
    crib(P, X, t) { P.box(X - 16, 80, 32, 20, "#fff"); for (let i = 0; i < 6; i++) P.r(X - 13 + i * 5, 82, 2, 14, "#d8c8e8"); P.r(X - 16, 96, 32, 4, "#d8c8e8"); },
    formula(P, X) { P.box(X - 5, 88, 10, 12, "#fff"); P.r(X - 4, 92, 8, 4, "#3a7ad8"); P.r(X - 5, 86, 10, 3, "#ffc21a"); },
    bottle(P, X, Y = 100) { P.box(X - 3, Y - 12, 7, 10, "#e8f8ff"); P.r(X - 2, Y - 8, 5, 5, "#fff"); P.r(X - 1, Y - 15, 3, 3, "#ffc21a"); },
    carrot(P, X) { P.tri(X - 3, 88, X + 3, 88, X, 99, "#ff7a1a"); P.r(X - 2, 85, 1, 3, "#3fbf5a"); P.r(X + 1, 84, 1, 4, "#3fbf5a"); },
    table(P, X, w = 40) { P.box(X - w / 2, 84, w, 5, "#c88a4a"); P.r(X - w / 2 + 2, 89, 2, 11, "#8a5a32"); P.r(X + w / 2 - 4, 89, 2, 11, "#8a5a32"); },
    board(P, X, Y = 40) { P.box(X - 22, Y, 44, 30, "#2a5a3a"); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) P.r(X - 18 + i * 13, Y + 4 + j * 8, 11, 6, ["#ffc21a", "#ff8fb1", "#3ff0ff"][(i + j) % 3]); },
    ballot(P, X) { P.box(X - 9, 82, 18, 18, "#fff"); P.r(X - 4, 84, 8, 2, K); txt(P, "V", X - 1, 90, "#e5372b"); },
    mirror(P, X) { P.box(X - 12, 44, 24, 40, "#ffc21a"); P.box(X - 9, 47, 18, 34, "#bfe8ff"); P.line(X - 6, 50, X - 2, 56, "#fff"); P.r(X - 2, 84, 4, 16, "#c88a4a"); },
    cans(P, X) { for (let i = 0; i < 5; i++) { P.box(X - 12 + i * 5, 76 - (i % 2) * 3, 5, 8, i % 2 ? "#3fbf5a" : "#ff3fd8"); } },
    desk(P, X, w = 40) { P.box(X - w / 2, 84, w, 6, "#8a5a32"); P.r(X - w / 2 + 2, 90, 3, 10, "#6a4a2a"); P.r(X + w / 2 - 5, 90, 3, 10, "#6a4a2a"); },
    moon(P, X) { P.box(X - 12, 20, 24, 20, "#1a1a3a"); P.e(X + 3, 28, 4, 4, "#ffe07a"); P.e(X + 5, 27, 3, 3, "#1a1a3a"); },
    bike(P, X, t) { const b = Math.sin(t * 20) > 0 ? 1 : 0; P.e(X - 12, 96, 5, 5, K); P.e(X + 12, 96, 5, 5, K); P.e(X - 12, 96, 2, 2, "#888"); P.e(X + 12, 96, 2, 2, "#888"); P.box(X - 10, 84 - b, 22, 8, "#e8e8f0"); P.r(X + 6, 78 - b, 2, 8, "#555"); P.r(X - 1, 76 - b, 4, 2, Math.floor(t * 6) % 2 ? "#2f6fe0" : "#e5372b"); P.box(X - 22, 74 - b, 12, 12, "#c88a4a"); P.e(X - 16, 80 - b, 3, 2, "#ff8fb1"); },
    gate(P, X) { P.r(X - 20, 50, 4, 50, "#8a8a96"); P.r(X + 16, 50, 4, 50, "#8a8a96"); P.box(X - 22, 44, 44, 10, "#3a7a3a"); },
    stairs(P, X) { for (let i = 0; i < 6; i++) P.box(X - 20 + i * 7, 94 - i * 8, 30 - i * 2, 8, "#a8a8b0"); P.box(X - 20, 92, 14, 8, "#5a3a2a"); },
    tower(P, X) { P.box(X - 10, 20, 20, 80, "#c8d8e8"); for (let j = 0; j < 9; j++) for (let i = 0; i < 3; i++) P.r(X - 7 + i * 5, 24 + j * 8, 3, 4, "#6a8ad8"); P.r(X - 12, 18, 24, 3, "#ffc21a"); },
    counter(P, X) { P.box(X - 24, 78, 48, 22, "#d8d8e0"); P.box(X - 20, 70, 14, 9, "#22222a"); P.r(X - 18, 72, 10, 4, "#3fbf5a"); for (let i = 0; i < 4; i++) P.box(X + i * 6 - 2, 70, 5, 8, ["#e5372b", "#ffc21a", "#3fbf5a", "#2f6fe0"][i]); },
    phone(P, X, Y = 72, t = 0, mode = "chart") { P.box(X - 8, Y, 16, 26, "#22222a"); P.r(X - 6, Y + 2, 12, 20, mode === "msg" ? "#e8f0ff" : "#0c1020"); if (mode === "chart") { for (let i = 0; i < 5; i++) P.r(X - 5 + i * 2, Y + 18 - Math.round(Math.abs(Math.sin(t * 2 + i)) * 12), 2, Math.round(Math.abs(Math.sin(t * 2 + i)) * 12) + 1, i % 2 ? "#e5372b" : "#3fbf5a"); } else if (mode === "msg") { P.r(X - 5, Y + 4, 10, 3, "#e5372b"); P.r(X - 5, Y + 9, 8, 1, "#888"); P.r(X - 5, Y + 12, 9, 1, "#888"); P.r(X - 5, Y + 16, 6, 2, "#2f6fe0"); } else if (mode === "star") { txt(P, "1", X - 1, Y + 9, "#ffc21a"); P.tri(X - 4, Y + 7, X - 2, Y + 3, X, Y + 7, "#ffc21a"); } else if (mode === "shop") { for (let i = 0; i < 3; i++) P.r(X - 5, Y + 4 + i * 6, 10, 4, ["#ff8fb1", "#3ff0ff", "#ffc21a"][i]); } },
    bowl(P, X, Y = 82) { P.e(X, Y, 8, 4, "#fff"); P.e(X, Y - 1, 7, 2, "#3a2a1a"); },
    mold(P, X, t) { const bl = Math.floor(t * 2) % 5 === 0; P.e(X, 60, 14, 12, "#3a5a2a"); P.e(X, 60, 12, 10, "#4a7a3a"); if (!bl) { P.r(X - 6, 56, 3, 3, "#fff"); P.r(X + 3, 56, 3, 3, "#fff"); P.p(X - 5, 57, K); P.p(X + 4, 57, K); } else { P.r(X - 6, 57, 3, 1, K); P.r(X + 3, 57, 3, 1, K); } P.r(X - 4, 64, 8, 2, K); },
    spray(P, X) { P.box(X - 4, 86, 8, 14, "#fff"); P.r(X - 3, 90, 6, 4, "#3a7ad8"); P.r(X - 2, 82, 4, 4, "#e5372b"); },
    arch(P, X, t) { for (let a = 0; a <= 20; a++) { const r = a / 20 * Math.PI; P.e(X + Math.cos(r) * 26, 92 - Math.sin(r) * 40, 3, 3, a % 3 ? "#ffd0e0" : "#fff"); } P.e(X, 52, 4, 3, "#ff8fb1"); },
    envelope(P, X) { P.box(X - 7, 88, 14, 10, "#fff"); P.line(X - 6, 89, X, 94, "#e5372b"); P.line(X + 6, 89, X, 94, "#e5372b"); },
    calendar(P, X) { P.box(X - 14, 30, 28, 30, "#fff"); P.r(X - 13, 31, 26, 7, "#e5372b"); txt(P, "30", X - 6, 44, K, 2); },
    rocket(P, X, t) { const y = 60 - ((t * 20) % 40); P.e(X, y, 4, 7, "#ffc21a"); P.r(X - 1, y - 2, 3, 3, K); flame(P, X, y + 12, 3, t); },
    mic(P, X) { P.r(X, 70, 1, 30, "#888"); P.e(X, 68, 3, 3, "#555"); P.r(X - 5, 99, 11, 1, "#888"); },
    tamb(P, X, t) { const a = Math.sin(t * 14) * 3; P.ring(X + a, 74, 6, "#c88a4a", 20); P.ring(X + a, 74, 5, "#ffc21a", 12); },
    screen(P, X, Y = 18) { P.box(X - 26, Y, 52, 32, "#22222a"); P.r(X - 24, Y + 2, 48, 28, "#2a2a6a"); },
    frogchart(P, X, t) { P.box(X - 26, 20, 52, 40, "#0c1020"); let y = 54; for (let i = 0; i < 24; i++) { const ny = 54 - i * 1.3 - Math.sin(i + t * 3) * 3; P.line(X - 24 + i * 2, y, X - 22 + i * 2, ny, "#3fbf5a"); y = ny; } P.e(X + 14, 30, 6, 5, "#3fbf5a"); P.r(X + 10, 26, 3, 3, "#fff"); P.r(X + 16, 26, 3, 3, "#fff"); P.p(X + 11, 27, K); P.p(X + 17, 27, K); P.r(X + 11, 33, 6, 1, K); },
    monitor(P, X, t) { P.box(X - 14, 62, 28, 20, "#22222a"); P.r(X - 12, 64, 24, 16, "#e8f0ff"); P.r(X - 10, 66, 20, 3, "#3a7ad8"); P.e(X, 74, 3, 3, "#ffc21a"); P.p(X - 1, 73, K); P.p(X + 1, 73, K); P.r(X - 2, 82, 4, 3, "#22222a"); },
    coffee(P, X) { for (let i = 0; i < 4; i++) { P.box(X + i * 6 - 10, 77 - (i % 2) * 6, 5, 7, "#fff"); P.r(X + i * 6 - 9, 79 - (i % 2) * 6, 3, 2, "#6a3a1a"); } },
    clockBig(P, X, Y, t, spd = 1) { P.e(X, Y, 12, 12, K); P.e(X, Y, 11, 11, "#fff"); const a = t * spd * 6, b = t * spd * 0.5; P.line(X, Y, X + Math.cos(a) * 9, Y + Math.sin(a) * 9, "#e5372b"); P.line(X, Y, X + Math.cos(b) * 6, Y + Math.sin(b) * 6, K); },
    canhouse(P, X, t) { P.box(X - 16, 64, 32, 36, "#b8c0c8"); for (let j = 0; j < 4; j++) P.r(X - 15, 68 + j * 8, 30, 1, "#8a929a"); P.tri(X - 20, 64, X + 20, 64, X, 48, "#8a929a"); P.box(X - 4, 86, 8, 14, "#5a3a2a"); if (Math.sin(t * 8) > 0.6) txt(P, "!", X + 18, 52, "#e5372b", 2); },
    xray(P, X) { P.box(X - 12, 40, 24, 30, "#0c1020"); P.e(X, 52, 6, 7, "#bfe8ff"); P.r(X - 1, 46, 2, 18, "#bfe8ff"); for (let i = 0; i < 3; i++) P.r(X - 6, 50 + i * 4, 12, 1, "#bfe8ff"); P.r(X + 5, 42, 5, 5, "#e5372b"); },
    mountain(P, X) { P.tri(X - 40, 100, X + 40, 100, X, 30, "#6a8a5a"); P.tri(X - 10, 50, X + 10, 50, X, 30, "#fff"); },
    notice(P, X) { P.box(X - 18, 40, 36, 30, "#fff"); for (let i = 0; i < 4; i++) P.r(X - 14, 44 + i * 5, 26 - (i % 2) * 6, 2, K); P.e(X + 10, 62, 5, 5, "#e5372b"); P.e(X + 10, 62, 3, 3, "#fff"); },
    chickensign(P, X) { P.box(X - 16, 40, 32, 18, "#ffc21a"); P.e(X - 6, 49, 5, 4, "#c8641a"); P.r(X - 3, 52, 6, 2, "#fff"); P.r(X + 2, 44, 10, 2, "#e5372b"); P.r(X + 2, 50, 8, 2, "#e5372b"); },
    tanghulu(P, X) { P.r(X, 70, 1, 30, "#c88a4a"); for (let i = 0; i < 4; i++) P.e(X, 66 - i * 6, 3, 3, ["#e5372b", "#3fbf5a", "#ffc21a", "#e5372b"][i]); },
    chickenbox(P, X) { P.box(X - 10, 86, 20, 14, "#fff"); P.r(X - 9, 88, 18, 3, "#e5372b"); P.e(X, 85, 6, 3, "#c8641a"); },
    bill(P, X) { P.box(X - 10, 66, 20, 26, "#fff"); P.r(X - 8, 69, 16, 3, "#e5372b"); for (let i = 0; i < 4; i++) P.r(X - 8, 75 + i * 4, 12, 1, "#888"); txt(P, "200", X - 6, 84, "#e5372b"); },
    fryer(P, X, t) { P.box(X - 18, 76, 36, 24, "#9a9aa6"); P.r(X - 16, 78, 32, 6, "#c88a1a"); for (let i = 0; i < 5; i++) if (Math.sin(t * 10 + i * 2) > 0) P.e(X - 12 + i * 6, 79, 1, 1, "#ffe07a"); },
    apt(P, X) { P.box(X - 14, 40, 28, 60, "#e8e2d0"); for (let j = 0; j < 7; j++) for (let i = 0; i < 3; i++) P.r(X - 10 + i * 8, 44 + j * 8, 5, 4, j === 3 && i === 1 ? "#ffe07a" : "#6a8ad8"); },
    cake(P, X, t, n = 6) { P.box(X - 16, 84, 32, 16, "#fff"); P.r(X - 15, 88, 30, 3, "#ff8fb1"); for (let i = 0; i < n; i++) { P.r(X - 14 + i * (28 / Math.max(1, n - 1)), 78, 1, 6, "#3ff0ff"); if (Math.sin(t * 12 + i) > -0.6) P.p(X - 14 + i * (28 / Math.max(1, n - 1)), 76, "#ffc21a"); } },
    stores(P, X) { [0, 1, 2].forEach((i) => { P.box(X - 30 + i * 22, 66 - i * 6, 20, 34 + i * 6, "#ffc21a"); txt(P, String([2, 3, 100][i]), X - 26 + i * 22, 70 - i * 6, K); }); },
    pills(P, X) { for (let i = 0; i < 12; i++) P.e(X - 12 + (i % 6) * 5, 92 - Math.floor(i / 6) * 4, 2, 1, i % 2 ? "#ff9ec0" : "#ffe07a"); P.box(X - 6, 76, 12, 10, "#fff"); txt(P, "30", X - 3, 78, "#e5372b"); },
    jar(P, X) { P.box(X - 8, 78, 16, 22, "#bfe8ff"); P.r(X - 6, 84, 12, 14, "#ffd08a"); P.r(X - 4, 86, 2, 6, "#8a5a32"); P.r(X + 1, 88, 3, 2, "#e5372b"); P.r(X - 6, 76, 12, 3, "#8a8a96"); },
    tv(P, X, t, mode = "news") { P.box(X - 20, 30, 40, 30, "#3a2a20"); P.r(X - 18, 32, 36, 26, mode === "ad" ? "#ffe8f0" : "#0c1430"); if (mode === "news") { P.r(X - 16, 50, 32, 5, "#e5372b"); txt(P, "0%", X - 4, 37, "#ffc21a", 2); } else { P.e(X, 44, 5, 7, "#ff9ec0"); for (let i = 0; i < 4; i++) { const a = t * 4 + i * 1.6; P.p(X + Math.cos(a) * 10, 44 + Math.sin(a) * 8, "#ffc21a"); } } P.r(X - 2, 60, 4, 6, "#3a2a20"); },
    hwatu(P, X) { P.box(X - 20, 84, 40, 6, "#3a7a3a"); [[-12, 0], [-2, 1], [8, 2]].forEach(([dx, k]) => { P.box(X + dx - 3, 76, 7, 10, "#e5372b"); P.r(X + dx - 2, 78, 5, 3, ["#fff", "#ffc21a", "#22222a"][k]); }); },
    kiosk(P, X, t) { P.box(X - 12, 40, 24, 60, "#e8e8f0"); P.r(X - 10, 44, 20, 28, "#2a2a6a"); for (let i = 0; i < 6; i++) P.r(X - 8 + (i % 2) * 9, 46 + Math.floor(i / 2) * 8 + ((t * 20) % 8), 7, 6, ["#ffc21a", "#ff8fb1", "#3ff0ff"][i % 3]); P.r(X - 6, 80, 12, 4, "#22222a"); },
    bench(P, X) { P.box(X - 20, 84, 40, 4, "#8a5a32"); P.box(X - 20, 76, 40, 3, "#8a5a32"); P.r(X - 18, 88, 2, 12, "#3a2a20"); P.r(X + 16, 88, 2, 12, "#3a2a20"); },
    pigeons(P, X, t, n = 6) { for (let i = 0; i < n; i++) { const px = X - 24 + i * 9, hop = Math.abs(Math.sin(t * 5 + i)) * 2; P.e(px, 96 - hop, 4, 3, "#8a8aa6"); P.e(px + 3, 92 - hop, 2, 2, "#6a6a86"); P.p(px + 4, 92 - hop, "#ff3a2a"); P.p(px + 5, 93 - hop, "#ffc21a"); } },
    book(P, X) { P.box(X - 10, 80, 20, 20, "#2f6fe0"); P.r(X - 8, 84, 14, 2, "#ffc21a"); P.r(X - 8, 88, 10, 1, "#fff"); },
    fan(P, X, t) { P.r(X - 1, 80, 2, 20, "#888"); P.e(X, 74, 9, 9, "#bfe8ff"); for (let i = 0; i < 3; i++) { const a = t * 20 + i * 2.1; P.line(X, 74, X + Math.cos(a) * 8, 74 + Math.sin(a) * 8, "#3a7ad8"); } },
  };
  // 장면 40종: [소품, x, 인자] 목록 + NPC + 주인공 위치/표정
  const SCN = {
    nursery: { p: [["crib", 118], ["formula", 80]], n: [["baby", 118, 92]], hx: 50, face: "w" },
    daycare: { p: [["table", 90, 50], ["carrot", 82]], n: [["kid", 120]], hx: 50, face: "p" },
    family: { p: [["table", 80, 60]], n: [["adultA", 112], ["adultB", 134, 100, true]], b: [104, 52, "?"], hx: 50, face: "w" },
    academy: { p: [["board", 110, 36]], hx: 54, face: "p" },
    election: { p: [["ballot", 100]], n: [["kid", 128], ["kid", 144, 100, true]], b: [92, 56, "!"], hx: 56, face: "h" },
    mirror: { p: [["mirror", 110]], hx: 66, face: "p" },
    studynight: { p: [["moon", 120], ["desk", 104, 44], ["cans", 104]], hx: 56, face: "w" },
    counsel: { p: [["desk", 100, 40]], n: [["teacher", 124]], b: [110, 52, "?"], hx: 56, face: "w" },
    examroad: { p: [["gate", 30], ["bike", 112]], n: [["rider", 118, 82]], hx: 64, face: "p" },
    househunt: { p: [["stairs", 70], ["tower", 132]], hx: 40, face: "w" },
    store: { p: [["counter", 112]], n: [["owner", 118, 82]], b: [104, 46, "?"], hx: 54, face: "w" },
    stockfriend: { p: [["phone", 100, 70]], n: [["friend", 124]], hx: 56, face: "w" },
    latte: { p: [["bowl", 104, 82], ["desk", 104, 40]], n: [["boss", 130]], b: [116, 48, "!"], hx: 56, face: "p" },
    mold: { p: [["mold", 104], ["spray", 136]], hx: 56, face: "o" },
    wedding: { p: [["arch", 116], ["envelope", 84]], hx: 56, face: "p" },
    bucket: { p: [["calendar", 112], ["rocket", 140]], hx: 56, face: "w" },
    karaoke: { p: [["screen", 104], ["mic", 128], ["tamb", 80]], n: [["boss", 136]], hx: 56, face: "p" },
    coinmarket: { p: [["frogchart", 110]], hx: 56, face: "o" },
    ppt: { p: [["desk", 110, 46], ["monitor", 112], ["coffee", 130], ["clockBig", 40, 30, 3]], hx: 66, face: "w" },
    jeonse: { p: [["canhouse", 116]], hx: 56, face: "p" },
    checkup: { p: [["xray", 110]], n: [["doctor", 136]], hx: 56, face: "o" },
    hike: { p: [["mountain", 116]], n: [["boss", 104]], b: [92, 52, "!"], hx: 50, face: "w" },
    layoff: { p: [["notice", 112]], n: [["boss", 140]], hx: 56, face: "p" },
    overtime: { p: [["desk", 110, 46], ["monitor", 112], ["clockBig", 80, 32, 20]], combo: true, hx: 56, face: "w" },
    startup: { p: [["chickensign", 100], ["tanghulu", 136]], hx: 50, face: "h" },
    customer: { p: [["chickenbox", 96]], n: [["customer", 128]], b: [112, 48, "?"], hx: 56, face: "w" },
    tuition: { p: [["bill", 108]], n: [["kid", 136]], hx: 56, face: "o" },
    review: { p: [["phone", 110, 64, "star"]], hx: 56, face: "p" },
    fryer: { p: [["fryer", 110]], hx: 56, face: "w" },
    apartment: { p: [["apt", 116], ["cake", 76, 6]], hx: 50, face: "h" },
    scam: { p: [["phone", 110, 64, "msg"]], hx: 56, face: "o" },
    expand: { p: [["stores", 116]], hx: 50, face: "h" },
    pills: { p: [["pills", 100], ["jar", 136]], n: [["doctor", 70, 100, true]], hx: 44, face: "o" },
    pension: { p: [["tv", 110, "news"]], hx: 56, face: "p" },
    hwatu: { p: [["hwatu", 104]], n: [["elder", 128], ["elder2", 80]], hx: 50, face: "w" },
    kiosk: { p: [["kiosk", 112]], hx: 60, face: "p" },
    pigeon: { p: [["bench", 64], ["pigeons", 120]], hx: 64, hy: 86, face: "p" },
    tvad: { p: [["tv", 110, "ad"]], hx: 56, face: "w" },
    memoir: { p: [["book", 100]], n: [["clerk", 130]], b: [116, 50, "?"], hx: 56, face: "h" },
    cake: { p: [["cake", 104, 14], ["fan", 140]], hx: 60, face: "o" },
  };
  function drawScene(x, key, t) {
    const sc = SCN[key] || {}, P = pen(x);
    (sc.p || []).forEach(([k, X, a, b]) => { const f = PR[k]; if (!f) return; if (k === "clockBig") f(P, X, a, t, b); else if (k === "phone") f(P, X, a, t, b); else if (k === "tv") f(P, X, t, a); else if (k === "cake") f(P, X, t, a); else if (k === "table" || k === "desk") f(P, X, a); else if (k === "board") f(P, X, a); else f(P, X, t); });
    (sc.n || []).forEach(([k, X, Y, flip]) => npc(x, X, Y || GY, k, { flip: flip !== undefined ? flip : true }));
    if (sc.b) { const [bx, by, s] = sc.b; bubble(P, bx, by, 12, 11, "r"); txt(P, s, bx + 4, by + 3, s === "!" ? "#e5372b" : K); }
    if (sc.combo) { const k = Math.floor(t * 3) % 2; txt(P, "X100", 104, 24 + k, "#ffc21a", 2); }
    return { hx: sc.hx || 56, hy: sc.hy || GY, face: sc.face || "n" };
  }

  // ---------- 새 떨어지는 물체 ----------
  Object.assign(FALL, {
    bottle(x, X, Y) { const P = pen(x); P.box(X - 5, Y - 18, 11, 16, "#e8f8ff"); P.r(X - 3, Y - 12, 7, 8, "#fff"); P.r(X - 2, Y - 22, 5, 4, "#ffc21a"); },
    blocks(x, X, Y) { const P = pen(x); [["#e5372b", -10, 0], ["#2f6fe0", 0, 0], ["#ffc21a", -5, -8], ["#3fbf5a", 5, -8], ["#ff8fb1", 0, -16]].forEach(([c, dx, dy]) => P.box(X + dx - 5, Y + dy - 8, 10, 8, c)); },
    safe(x, X, Y) { const P = pen(x); P.box(X - 14, Y - 22, 28, 22, "#5a5a66"); P.e(X, Y - 11, 5, 5, "#ffc21a"); P.e(X, Y - 11, 2, 2, K); },
    hwatu(x, X, Y) { const P = pen(x); P.box(X - 12, Y - 30, 24, 30, "#e5372b"); P.e(X, Y - 18, 7, 7, "#fff"); P.r(X - 8, Y - 8, 16, 4, "#22222a"); },
  });
  // ---------- 새 사망 연출 ----------
  Object.assign(DEATH, {
    vibrate(x, t, b) { const P = pen(x); const k = seg(t, 0, 0.55); if (t < 0.55) { const j = (Math.random() * 2 - 1) * (1 + k * 3); hero(x, b.hx + j, b.hy, { face: "o", pal: k > 0.5 ? "red" : undefined }); for (let i = 0; i < 4; i++) P.r(b.hx - 10 + Math.random() * 20, b.hy - 22 + Math.random() * 20, 1, 3, "#fff"); } else { const q = seg(t, 0.55, 1); hero(x, b.hx, b.hy - q * q * 110, { face: "o", pose: "up", sy: 1 + q * 0.5 }); flame(P, b.hx, b.hy - q * q * 110 + 6, 4, t * 4); puff(P, b.hx, b.hy - 2, 4 + q * 6, "#d8d8e0"); } },
    zap(x, t, b) { const P = pen(x); const beam = t > 0.1 && t < 0.5; if (beam) { for (let i = 0; i < 3; i++) P.line(150, 60 + i, b.hx + 4, b.hy - 12 + i, i === 1 ? "#fff" : "#ff3a2a"); } if (t < 0.15) hero(x, b.hx, b.hy, { face: "o" }); else if (t < 0.55) { if (Math.floor(t * 30) % 2) { P.r(b.hx - 7, b.hy - 16, 14, 16, "#2f6fe0"); skull(x, b.hx, b.hy - 18); P.r(b.hx - 1, b.hy - 12, 2, 8, "#fff"); for (let i = 0; i < 3; i++) P.r(b.hx - 4, b.hy - 11 + i * 2, 8, 1, "#fff"); } else hero(x, b.hx, b.hy, { face: "x" }); } else { hero(x, b.hx, b.hy, { face: "s", pal: "soot" }); puff(P, b.hx + 4, b.hy - 26 - seg(t, 0.55, 1) * 14, 3, "#6a6a74"); } },
    canroll(x, t, b) { const P = pen(x); const k = seg(t, 0, 0.3), q = seg(t, 0.3, 1); const X = b.hx + q * q * 120; const r = q * 20; if (t < 0.3) { hero(x, b.hx, b.hy, { face: "o" }); P.box(b.hx - 10, -30 + k * (b.hy - 22 + 30), 20, 24, "#b8c0c8"); } else { x.save(); x.translate(X, b.hy - 10); x.rotate(r); const Q = pen(x); Q.box(-12, -10, 24, 20, "#b8c0c8"); Q.r(-11, -4, 22, 2, "#8a929a"); Q.r(-11, 4, 22, 2, "#8a929a"); x.restore(); for (let i = 0; i < 3; i++) P.r(X - 20 - i * 6, b.hy - 6 + i * 2, 4, 1, "#fff"); if (Math.floor(t * 10) % 2) txt(P, "!", X, b.hy - 30, "#e5372b"); } },
    flock(x, t, b) { const P = pen(x); const k = seg(t, 0, 0.4), q = seg(t, 0.4, 1); const hx = b.hx + q * 60, hy = b.hy - q * 90; hero(x, hx, hy, { face: q > 0 ? "o" : "p", pose: "up" }); for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + t * 6; const rr = (1 - k) * 70 + 10; const px = hx + Math.cos(a) * rr, py = hy - 8 + Math.sin(a) * rr * 0.5; P.e(px, py, 3, 2, "#8a8aa6"); P.r(px - 4, py - 1 - (Math.floor(t * 20 + i) % 2) * 2, 3, 1, "#6a6a86"); P.p(px + 2, py - 1, "#ffc21a"); } },
  });
  // ---------- 새 아이콘(12x12) ----------
  Object.assign(IC, {
    can: ["...aaaa.....", "..wwwwww....", "..wbbbbw....", "..wbyybw....", "..wbyybw....", "..wbbbbw....", "..wbbbbw....", "..wwwwww...."],
    cry: ["..ssssss....", ".ssssssss...", ".sbkssbks...", ".sbssssbs...", ".bsskksb....", ".bs.kk.b....", "..b....b...."],
    spoon: ["...aaa......", "..aaaaa.....", "..aaaaa.....", "...aaa......", "....a.......", "....a.......", "....a.......", "....a......."],
    bottle: ["....pp......", "...pppp.....", "..pwwwwp....", "..pwppwp....", "..pwwwwp....", "..pppppp...."],
    building: ["..dddddd....", "..dcdcdd....", "..dddddd....", "..dcdcdd....", "..dddddd....", "..dcdcdd....", "..dddkdd....", "..dddkdd...."],
    mic: ["...aaa......", "..aaaaa.....", "..aaaaa.....", "...aaa......", "....d.......", "....d.......", "..ddddd....."],
    bike: ["......kk....", ".....bbb....", "..wwwbbbb...", ".kk.....kk..", "k..k...k..k.", ".kk.....kk.."],
    stairs: ["........aaaa", "......aaaa..", "....aaaa....", "..aaaa......", "aaaa........"],
    card: ["bbbbbbbbbb..", "bbbbbbbbbb..", "kkkkkkkkkk..", "bbbbbbbbbb..", "byybbbbbbb..", "bbbbbbbbbb.."],
    click: ["..k.........", "..kk........", "..kwk.......", "..kwwk......", "..kwwwk.....", "..kwwkk.....", "..kk.wk.....", "......k....."],
    bowl: ["............", "kkkkkkkkkk..", "wnnnnnnnnw..", ".wwwwwwww...", "..wwwwww...."],
    spray: ["...rr.......", "...ww.c.c...", "..wwww.c....", "..wbbw.c.c..", "..wbbw......", "..wwww......"],
    tamb: ["...nnnn.....", "..nyyyyn....", ".ny....yn...", ".ny....yn...", "..nyyyyn....", "...nnnn....."],
    door: ["..nnnnnn....", "..nNNNNn....", "..nNNNNn....", "..nNNNyn....", "..nNNNNn....", "..nNNNNn....", "..nnnnnn...."],
    frog: [".gg...gg....", "gwkg.gwkg...", "gggggggggg..", "gGGGGGGGgg..", ".gggggggg...", "..g....g...."],
    chart: ["k...........", "k.......g...", "k......g.g..", "k..g..g.....", "k.g.gg......", "k...........", "kkkkkkkkkk.."],
    cat: ["a......a....", "aa....aa....", "aaaaaaaa....", "akaaaaka....", "aaappaaa....", ".aaaaaa....."],
    car: ["...rrrr.....", "..rccccr....", ".rrrrrrrr...", ".rrrrrrrr...", "..kk...kk..."],
    knee: ["..ss........", "..ss........", "..sss.......", "...sss......", "....ss......", "....ss......", "....ss......"],
    mountain: [".....w......", "....www.....", "...ggggg....", "..ggggggg...", ".ggggggggg.."],
    chicken: ["..oooo......", ".oooooo.....", "oooooooo....", "oooooooo....", ".oooooo.....", "...ww.......", "...ww......."],
    candy: ["....r.......", "...rrr......", "....g.......", "...ggg......", "....y.......", "...yyy......", "....n.......", "....n......."],
    safe: ["dddddddd....", "daaaaaad....", "daayyaad....", "daayyaad....", "daaaaaad....", "dddddddd...."],
    keyboard: ["kkkkkkkkkk..", "kwkwkwkwkk..", "kkwkwkwkwk..", "kwwwwwwwkk..", "kkkkkkkkkk.."],
    fan: ["...ccc......", "..c.a.c.....", ".cccaccc....", "..c.a.c.....", "...ccc......", "....a.......", "..aaaaa....."],
    oil: ["...yy.......", "..yyyy......", ".yoyyyy.....", ".yyyyyy.....", ".yyyyyy.....", "..yyyy......"],
    firework: ["y....r....y.", ".y...r...y..", "..y..r..y...", "rrrrr.rrrrr.", "..y..r..y...", ".y...r...y..", "y....r....y."],
    phone: ["..kkkkk.....", "..kcccck....", "..kcccck....", "..kcccck....", "..kcccck....", "..kkkkk....."],
    jar: ["..aaaa......", ".cccccc.....", ".cyyyyc.....", ".cynyyc.....", ".cyyyyc.....", ".cccccc....."],
    pill: ["..pppyyy....", ".ppppyyyy...", ".ppppyyyy...", "..pppyyy...."],
    bread: ["..nnnnn.....", ".nyyyyyn....", "nyyyyyyyn...", "nnnnnnnnn..."],
    wind: ["cccccc......", "......c.....", ".cccccc.....", "...cccccc...", "........c...", "..ccccccc..."],
  });

  // ---------- 그리기 ----------
  const chOf = (n) => (n <= 8 ? 1 : n <= 16 ? 2 : n <= 24 ? 3 : n <= 32 ? 4 : 5);
  function drawStage(x, st, t, mode = { kind: "idle" }, death) {
    x.imageSmoothingEnabled = false;
    const ch = chOf(st.n);
    L.setOutfit(outfitFor(st.n));
    background(x, ch, t);
    const b = drawScene(x, st.scene, t);
    if (mode.kind === "death") { const d = death || st.death; (DEATH[d.anim] || DEATH.shrink)(x, clamp(mode.t, 0, 1), b, d); }
    else if (mode.kind === "win") L.win(x, mode.t, b);
    else if (mode.kind === "dodge") { const k = clamp(mode.t, 0, 1); hero(x, b.hx - Math.sin(k * Math.PI) * 14, b.hy, { face: "o", pose: k < 0.6 ? "run" : "idle" }); const P = pen(x); if (Math.floor(t * 8) % 2) { bubble(P, b.hx - 4, b.hy - 34, 12, 11, "l"); txt(P, "!", b.hx, b.hy - 31, "#e5372b"); } }
    else hero(x, b.hx, b.hy - (Math.floor(t * 4) % 2), { face: b.face });
    if (ch === 5) crt(x, t);
    L.setOutfit("n");
  }
  function drawTitle(x, t) {
    x.imageSmoothingEnabled = false;
    // 왼쪽→오른쪽으로 다섯 나이대 주인공이 나란히(아기·학생·청년·직장인·노인)
    background(x, 5, t);
    const P = pen(x);
    ["baby", "student", "youth", "suit", "elder"].forEach((o, i) => { L.setOutfit(o); hero(x, 22 + i * 29, 100 - Math.abs(Math.sin(t * 4 + i)) * 2, { face: ["w", "p", "o", "w", "h"][i] }); });
    L.setOutfit("n");
    for (let i = 0; i < 4; i++) P.tri(36 + i * 29, 86, 40 + i * 29, 88, 36 + i * 29, 90, "#fff");
    crt(x, t);
  }
  function drawEnding(x, id, t) {
    x.imageSmoothingEnabled = false;
    const P = pen(x);
    L.setOutfit("elder");
    if (id === "cyborg") {
      background(x, 3, t); P.r(0, 0, W, HH, "rgba(20,40,80,0.45)");
      for (let i = 0; i < 6; i++) if (Math.sin(t * 9 + i) > 0.7) P.line(60 + i * 8, 60, 64 + i * 8, 70, "#3ff0ff");
      hero(x, 80, 100, { face: "n", pal: "grey", pose: "up" }); P.r(75, 82, 3, 2, Math.floor(t * 4) % 2 ? "#ff3a2a" : "#3ff0ff"); P.r(82, 82, 3, 2, "#3ff0ff"); P.r(70, 92, 20, 2, "#9a9aa6"); txt(P, "V2.0", 66, 50, "#3ff0ff", 2);
    } else if (id === "dirt") {
      background(x, 5, t); const k = clamp(t / 2.5, 0, 1);
      for (let i = 0; i < 2; i++) { const s = i ? -1 : 1; P.tri(80, 84 - k * 20, 80 + s * (20 + k * 20), 70 - k * 30, 80 + s * 10, 96 - k * 20, i ? "#ff7a1a" : "#ffc21a"); }
      hero(x, 80, 100 - k * 20, { face: "h", a: 1 - Math.max(0, k - 0.7) * 2 }); txt(P, "0", 92, 60 - k * 20, "#fff", 3);
      for (let i = 0; i < 16; i++) P.p(60 + hash(i, 4) * 40, 100 - ((t * 30 + i * 9) % 70), "#fff6c0");
    } else if (id === "cult") {
      background(x, 5, t); P.box(60, 84, 40, 4, "#8a5a32"); hero(x, 80, 84, { face: "h", pose: "up" }); P.tri(74, 64, 86, 64, 80, 58, "#ffc21a");
      for (let i = 0; i < 10; i++) { const px = 16 + i * 14, bow = Math.floor(t * 2 + i) % 2; if (px > 60 && px < 100) continue; P.e(px, 98 - bow, 4, 3, "#8a8aa6"); P.e(px + 3, 94 + bow, 2, 2, "#6a6a86"); P.p(px + 5, 95 + bow, "#ffc21a"); }
    } else { // pension
      background(x, 5, t); P.box(52, 84, 56, 4, "#8a5a32"); hero(x, 80, 84, { face: "h" }); P.box(86, 72, 10, 12, "#2f6fe0"); P.r(88, 75, 6, 1, "#fff");
      for (let i = 0; i < 12; i++) { const cx = 30 + hash(i, 8) * 100, cy = ((t * 25 + hash(i, 9) * 100) % 110) - 10; P.e(cx, cy, 2, 2, "#ffc21a"); P.p(cx, cy, "#b08000"); }
    }
    crt(x, t);
    L.setOutfit("n");
  }
  function deathThumb(st, death) {
    const c = cv(W, HH), x = c.getContext("2d");
    drawStage(x, st, 1.3, { kind: "death", t: 0.97 }, death);
    return c;
  }
  H.hcArt = { W, H: HH, drawStage, drawTitle, drawEnding, deathThumb, chOf, outfitFor, hasScene: (k) => !!SCN[k], hasAnim: (k) => !!DEATH[k], hasIcon: (k) => !!IC[k], icon: L.icon };
})();
