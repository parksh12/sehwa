// 지옥에서 살아남기 — 도트 그림 (P2-27). 이미지 파일 없이 캔버스에 코드로 한 점씩 그립니다(외부 에셋 0).
// 화면 160x120. 층 배경 4종(정적 부분은 캐시) + 장면 31종 + 사망 애니메이션 24종 + 선택 카드 아이콘.
// 표현 기준: 피·내장 없음. 사망은 해골·연기·납작·별·유령 같은 만화 연출만 씁니다.
(function () {
  const H = (window.HELL = window.HELL || {});
  const W = 160, HH = 120, GY = 100; // 바닥선(주인공 발끝)
  const K = "#141414";
  const C = {
    k: K, w: "#ffffff", r: "#e5372b", R: "#9c1d16", y: "#ffc21a", o: "#ff7a1a", b: "#2f6fe0", B: "#1b3f8f", g: "#3fbf5a", G: "#1e7a3a",
    n: "#8a5a32", N: "#5a3820", s: "#ffd7b0", S: "#e8a878", p: "#ff8fb1", c: "#3ff0ff", a: "#9a9aa6", d: "#4a4a55", v: "#9b4dff", m: "#ff3fd8", e: "#e8e2d0",
  };
  const cv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 974711) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => t * t * (3 - 2 * t);
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1); // t가 a~b 구간에서 0→1

  // ---------- 그리기 도구 ----------
  function pen(x) {
    const P = {
      x,
      r(X, Y, w, h, c) { x.fillStyle = c; x.fillRect(Math.round(X), Math.round(Y), Math.round(w), Math.round(h)); return P; },
      p(X, Y, c) { return P.r(X, Y, 1, 1, c); },
      e(cx, cy, rx, ry, c) { // 채운 타원(가로줄 단위)
        cx = Math.round(cx); cy = Math.round(cy);
        x.fillStyle = c;
        for (let j = -ry; j <= ry; j++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j * j) / ((ry + 0.4) * (ry + 0.4))))); x.fillRect(cx - w, cy + j, w * 2 + 1, 1); }
        return P;
      },
      ring(cx, cy, rr, c, n = 24) { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; P.p(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, c); } return P; },
      line(x0, y0, x1, y1, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) P.p(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c); return P; },
      tri(x1, y1, x2, y2, x3, y3, c) {
        const minY = Math.round(Math.min(y1, y2, y3)), maxY = Math.round(Math.max(y1, y2, y3));
        for (let y = minY; y <= maxY; y++) {
          const xs = [];
          [[x1, y1, x2, y2], [x2, y2, x3, y3], [x3, y3, x1, y1]].forEach(([ax, ay, bx, by]) => { if ((y >= ay && y <= by) || (y >= by && y <= ay)) { if (ay === by) xs.push(ax, bx); else xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay)); } });
          if (xs.length) P.r(Math.min(...xs), y, Math.round(Math.max(...xs) - Math.min(...xs)) + 1, 1, c);
        }
        return P;
      },
      map(rows, X = 0, Y = 0, pal = C) { rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) P.p(X + i, Y + j, c); } }); return P; },
      box(X, Y, w, h, fill, line = K) { P.r(X, Y, w, h, line); P.r(X + 1, Y + 1, w - 2, h - 2, fill); return P; },
    };
    return P;
  }
  function outline(c, col = K) {
    const x = c.getContext("2d"), { width: w, height: h } = c;
    const d = x.getImageData(0, 0, w, h), a = d.data;
    const solid = (i, j) => i >= 0 && j >= 0 && i < w && j < h && a[(j * w + i) * 4 + 3] > 0;
    const pts = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!solid(i, j) && (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1))) pts.push([i, j]);
    x.fillStyle = col; pts.forEach(([i, j]) => x.fillRect(i, j, 1, 1));
    return c;
  }
  // 문자열 그림 → 외곽선 씌운 스프라이트(1px 여백 포함)
  const cache = new Map();
  function sprite(key, rows, pal = C, extra) {
    if (cache.has(key)) return cache.get(key);
    const w = Math.max(...rows.map((r) => r.length)), c = cv(w + 2, rows.length + 2), P = pen(c.getContext("2d"));
    P.map(rows, 1, 1, pal);
    if (extra) extra(P);
    outline(c);
    cache.set(key, c);
    return c;
  }
  // 3x5 숫자·기호 글꼴(캔버스 안 짧은 표시용)
  const F3 = { 0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001111001111", 4: "101101111001001", 5: "111100111001111", 6: "111100111101111", 7: "111001010010010", 8: "111101111101111", 9: "111101111001111", "+": "000010111010000", "=": "000111000111000", "?": "111001011000010", "!": "010010010000010", E: "111100110100111", R: "110101110101101", O: "111101101101111", F: "111100110100100", "°": "010101010000000", ",": "000000000010100", A: "010101111101101", B: "110101110101110", V: "101101101101010", I: "111010010010111", P: "110101110100100", ".": "000000000000010", "-": "000000111000000", X: "101101010101101", " ": "000000000000000", "%": "101001010100101", Z: "111001010100111" };
  function txt(P, s, X, Y, c = K, sc = 1) {
    [...String(s)].forEach((ch, k) => { const g = F3[ch]; if (!g) return; for (let i = 0; i < 15; i++) if (g[i] === "1") P.r(X + k * 4 * sc + (i % 3) * sc, Y + Math.floor(i / 3) * sc, sc, sc, c); });
  }
  const txtW = (s, sc = 1) => String(s).length * 4 * sc - sc;
  function bubble(P, X, Y, w, h, tail = "l") { // 말풍선
    P.r(X + 1, Y, w - 2, h, K); P.r(X, Y + 1, w, h - 2, K); P.r(X + 1, Y + 1, w - 2, h - 2, "#fff");
    const tx = tail === "l" ? X + 4 : X + w - 7;
    P.r(tx, Y + h - 1, 3, 1, "#fff"); P.p(tx - (tail === "l" ? 1 : -3), Y + h, K); P.r(tail === "l" ? tx - 1 : tx + 1, Y + h, 3, 1, "#fff"); P.p(tail === "l" ? tx - 2 : tx + 4, Y + h + 1, K); P.r(tail === "l" ? tx - 1 : tx + 2, Y + h + 1, 2, 1, K);
  }

  // ---------- 캐릭터 ----------
  const HERO = [
    "...hhhhhh...",
    "..hhhhhhhh..",
    "..hssssssh..",
    "..ssssssss..",
    "..ssssssss..",
    "..ssssssss..",
    "...ssssss...",
    "...wwwwww...",
    "..wwwwwwww..",
    ".swwwwwwwws.",
    ".s.wwwwww.s.",
    "...wwwwww...",
    "...bb..bb...",
    "...bb..bb...",
    "..kkk..kkk..",
  ];
  const HERO_UP = HERO.slice(); HERO_UP[7] = ".s.wwwwww.s."; HERO_UP[8] = ".swwwwwwwws."; HERO_UP[9] = "..wwwwwwww.."; HERO_UP[10] = "...wwwwww...";
  const HERO_RUN = HERO.slice(); HERO_RUN[12] = "..bb....bb.."; HERO_RUN[13] = ".bb......bb."; HERO_RUN[14] = "kkk......kkk";
  const HERO_BABY = ["..hhhh..", ".hssssh.", ".ssssss.", ".ssssss.", "..ssss..", ".wwwwww.", "swwwwwws", "..wwww..", "..s..s.."];
  const PALS = {
    n: { ...C, h: "#2b2b33", s: C.s, w: "#f4f4f4", b: C.b, k: "#3a2a20" },
    soot: { ...C, h: "#141414", s: "#2a2a2a", w: "#333", b: "#222", k: "#111" },
    red: { ...C, h: "#5a1010", s: "#ff5a4a", w: "#ffb0a8", b: "#d02a2a", k: "#5a1a1a" },
    ice: { ...C, h: "#6aa8d8", s: "#bfe8ff", w: "#e4f6ff", b: "#7fb8e8", k: "#5a8ab8" },
    grey: { ...C, h: "#555", s: "#aaa", w: "#ccc", b: "#888", k: "#555" },
    green: { ...C, h: "#2b4a2b", s: "#9be27a", w: "#c8f0b0", b: "#4a9a4a", k: "#2a4a2a" },
    pink: { ...C, h: "#6a2a40", s: "#ff9ec0", w: "#ffd0e0", b: "#e06a9a", k: "#6a2a40" },
    white: { ...C, h: "#fff", s: "#fff", w: "#fff", b: "#fff", k: "#fff" },
    old: { ...C, h: "#e8e8e8", s: C.s, w: "#f4f4f4", b: C.b, k: "#3a2a20" },
  };
  function face(P, f, ox = 1, oy = 1) { // 스프라이트 위 얼굴(12x15 기준 좌표 + 여백)
    const X = ox, Y = oy;
    if (f === "n") { P.r(X + 4, Y + 3, 1, 2, K); P.r(X + 7, Y + 3, 1, 2, K); P.r(X + 5, Y + 5, 2, 1, "#a0523a"); }
    else if (f === "p") { P.r(X + 3, Y + 3, 2, 2, "#fff"); P.p(X + 4, Y + 4, K); P.r(X + 7, Y + 3, 2, 2, "#fff"); P.p(X + 7, Y + 4, K); P.r(X + 5, Y + 5, 2, 1, K); P.p(X + 10, Y + 2, "#7fd0ff"); P.p(X + 10, Y + 3, "#7fd0ff"); }
    else if (f === "h") { P.p(X + 3, Y + 4, K); P.p(X + 4, Y + 3, K); P.p(X + 5, Y + 4, K); P.p(X + 6, Y + 4, K); P.p(X + 7, Y + 3, K); P.p(X + 8, Y + 4, K); P.r(X + 4, Y + 5, 4, 1, "#a0523a"); P.p(X + 3, Y + 5, "#ff9a9a"); P.p(X + 8, Y + 5, "#ff9a9a"); }
    else if (f === "x") { [[3, 3], [5, 3], [4, 4], [3, 5], [5, 5]].forEach(([a, b]) => { P.p(X + a, Y + b, K); P.p(X + a + 4, Y + b, K); }); }
    else if (f === "w") { P.r(X + 3, Y + 3, 2, 2, "#fff"); P.p(X + 3, Y + 3, K); P.r(X + 7, Y + 3, 2, 2, "#fff"); P.p(X + 8, Y + 3, K); P.r(X + 5, Y + 5, 2, 1, K); } // 멍
    else if (f === "o") { P.r(X + 3, Y + 3, 2, 2, "#fff"); P.p(X + 4, Y + 3, K); P.r(X + 7, Y + 3, 2, 2, "#fff"); P.p(X + 7, Y + 3, K); P.r(X + 5, Y + 4, 2, 3, K); } // 놀람(입 O)
    else if (f === "l") { P.p(X + 3, Y + 3, K); P.p(X + 4, Y + 4, K); P.p(X + 8, Y + 3, K); P.p(X + 7, Y + 4, K); P.r(X + 4, Y + 5, 4, 2, K); P.r(X + 5, Y + 6, 2, 1, "#ff6a6a"); } // 깔깔(눈 질끈)
    else if (f === "s") { P.r(X + 3, Y + 3, 2, 2, "#fff"); P.r(X + 7, Y + 3, 2, 2, "#fff"); } // 숯검댕이: 흰 눈만
  }
  function heroSprite(face_ = "n", pose = "idle", pal = "n") {
    const key = `hero:${face_}:${pose}:${pal}`;
    if (cache.has(key)) return cache.get(key);
    const rows = pose === "up" ? HERO_UP : pose === "run" ? HERO_RUN : pose === "baby" ? HERO_BABY : HERO;
    const c = sprite(key, rows, PALS[pal] || PALS.n, (P) => { if (pose !== "baby") face(P, face_); else { P.p(3, 3, K); P.p(6, 3, K); } });
    if (pal === "soot") { // 아프로 머리
      const c2 = cv(c.width + 6, c.height + 5), x2 = c2.getContext("2d"), P = pen(x2);
      P.e(c2.width / 2, 5, 9, 5, "#141414"); [[-6, 2], [5, 1], [0, -2], [-3, 4], [6, 5]].forEach(([a, b]) => P.e(c2.width / 2 + a, 5 + b, 3, 3, "#2a2a2a"));
      x2.drawImage(c, 3, 5); cache.set(key, c2); return c2;
    }
    return c;
  }
  // 주인공 그리기: (x,y)=발끝 가운데. sx/sy 늘이기, rot 회전, a 투명도
  function hero(x, X, Y, o = {}) {
    const s = heroSprite(o.face || "n", o.pose || "idle", o.pal || "n");
    x.save(); x.globalAlpha = o.a == null ? 1 : o.a; x.translate(Math.round(X), Math.round(Y));
    if (o.rot) x.rotate(o.rot);
    x.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1);
    x.drawImage(s, -Math.round(s.width / 2), -s.height + 1);
    x.restore();
  }
  const GHOST = ["...wwww...", "..wwwwww..", ".wwwwwwww.", ".wkwwwwkw.", ".wwwwwwww.", ".wwwkkwww.", ".wwwwwwww.", ".wwwwwwww.", "wwwwwwwwww", "w.ww.ww.ww", "...w..w..."];
  const SKULL = ["..wwww..", ".wwwwww.", "wwwwwwww", "wkkwwkkw", "wkkwwkkw", "wwwwwwww", ".wwkkww.", "..wwww..", "..wkwk.."];
  const SHOE = ["..kk....", ".kkkk...", "kkkkkkkk", "aaaaaaaa"];
  const ghost = (x, X, Y, a = 1) => { x.save(); x.globalAlpha = a; x.drawImage(sprite("ghost", GHOST, { ...C, w: "#eef6ff" }), Math.round(X - 6), Math.round(Y - 12)); x.restore(); };
  const skull = (x, X, Y) => x.drawImage(sprite("skull", SKULL, { ...C, w: "#f2ecd8" }), Math.round(X - 5), Math.round(Y - 5));
  const shoe = (x, X, Y) => x.drawImage(sprite("shoe", SHOE, { ...C, k: "#3a2a20", a: "#ddd" }), Math.round(X - 5), Math.round(Y - 5));

  const DEVIL = [
    ".y..........y.",
    ".yy.rrrrrr.yy.",
    "..yrrrrrrrry..",
    "..rrrrrrrrrr..",
    "..rwkrrrrwkr..",
    "..rrrrrrrrrr..",
    "..rrkkkkkkrr..",
    "...rrwrrwrr...",
    "....rrrrrr....",
    "...RRRRRRRR...",
    "..rRRRRRRRRr..",
    "..r.RRRRRR.r..",
    "....RRRRRR....",
    "....RR..RR....",
    "....RR..RR....",
    "...kkk..kkk...",
  ];
  const DEVIL_DANCE = DEVIL.slice(); DEVIL_DANCE[9] = ".r.RRRRRRRR.r."; DEVIL_DANCE[10] = "..rRRRRRRRRr.."; DEVIL_DANCE[11] = "....RRRRRR...."; DEVIL_DANCE[13] = "...RR....RR..."; DEVIL_DANCE[14] = "..RR......RR.."; DEVIL_DANCE[15] = ".kkk......kkk.";
  function devil(x, X, Y, o = {}) { // (X,Y)=발끝 가운데
    const pal = { ...C, r: o.col || "#e0402a", R: o.dark || "#9c1d16", y: "#f2ecd8" };
    const s = sprite(`devil:${o.dance ? 1 : 0}:${o.col || ""}`, o.dance ? DEVIL_DANCE : DEVIL, pal);
    const P = pen(x);
    // 꼬리
    const tw = Math.sin((o.t || 0) * 6) * 2;
    P.line(X + 5, Y - 6, X + 10, Y - 9 + tw, K); P.line(X + 5, Y - 5, X + 10, Y - 8 + tw, pal.R); P.tri(X + 9, Y - 12 + tw, X + 13, Y - 9 + tw, X + 9, Y - 7 + tw, K);
    x.save(); x.translate(Math.round(X), Math.round(Y)); if (o.flip) x.scale(-1, 1); x.drawImage(s, -8, -s.height + 1); x.restore();
    if (o.trident) { const tx = X + (o.flip ? 9 : -9); P.r(tx, Y - 26, 1, 22, "#6a4a2a"); P.r(tx - 3, Y - 28, 7, 1, "#c8c8d0"); P.r(tx - 3, Y - 31, 1, 3, "#c8c8d0"); P.r(tx, Y - 32, 1, 4, "#c8c8d0"); P.r(tx + 3, Y - 31, 1, 3, "#c8c8d0"); }
    if (o.chef) { P.e(X, Y - 19, 5, 3, "#fff"); P.r(X - 4, Y - 18, 9, 3, "#fff"); P.r(X - 4, Y - 16, 9, 1, "#ccc"); }
    if (o.tie) { P.r(X - 1, Y - 7, 2, 1, "#2f6fe0"); P.r(X - 1, Y - 6, 2, 3, "#2f6fe0"); P.r(X - 2, Y - 8, 4, 1, "#fff"); }
    if (o.glasses) { P.r(X - 5, Y - 13, 4, 2, K); P.r(X + 1, Y - 13, 4, 2, K); P.r(X - 1, Y - 13, 2, 1, K); }
  }
  // 머리 셋 달린 지옥 개
  function dog(x, X, Y, t = 0, o = {}) { // (X,Y)=몸통 아래 가운데
    const P = pen(x), f = o.flip ? -1 : 1, open = Math.sin(t * 10) > 0;
    const bx = (dx) => X + dx * f;
    P.e(X, Y - 9, 13, 7, K); P.e(X, Y - 9, 12, 6, "#3a3036");
    [-9, -4, 4, 9].forEach((dx, i) => { P.r(bx(dx) - 1, Y - 4, 3, 4 + (o.run && i % 2 ? -1 : 0), K); P.r(bx(dx), Y - 4, 1, 3, "#3a3036"); });
    P.line(bx(-12), Y - 11, bx(-17), Y - 16 + Math.sin(t * 12) * 2, K);
    [[-2, -22], [7, -20], [12, -14]].forEach(([dx, dy], i) => {
      const hx = bx(dx + 4), hy = Y + dy + (i === 1 ? Math.sin(t * 8) : 0);
      P.e(hx, hy, 5, 4, K); P.e(hx, hy, 4, 3, "#4a3c44");
      P.tri(hx - 4, hy - 3, hx - 2, hy - 8, hx, hy - 3, K); P.tri(hx + 1, hy - 3, hx + 3, hy - 8, hx + 4, hy - 3, K);
      P.p(hx + f, hy - 1, "#ff3a2a"); P.p(hx + 2 * f, hy - 1, "#ffdd55");
      P.r(hx + 2 * f - (f < 0 ? 3 : 0), hy + 1, 4, open ? 2 : 1, K); if (open) P.p(hx + 3 * f, hy + 1, "#fff");
    });
  }
  // 저승사자(검은 갓)
  function reaper(x, X, Y) {
    const P = pen(x);
    P.r(X - 5, Y - 10, 10, 10, K); P.r(X - 4, Y - 9, 8, 9, "#22222a");
    P.r(X - 3, Y - 16, 6, 6, "#e8e0d0"); P.p(X - 2, Y - 14, K); P.p(X + 1, Y - 14, K);
    P.r(X - 8, Y - 18, 16, 2, K); P.r(X - 3, Y - 23, 6, 5, K); P.r(X - 7, Y - 17, 14, 1, "#333");
  }
  // 염라대왕 얼굴(배경 전면). mood: stern/happy/sneeze/angry/smile, look: 눈동자 x 이동
  function yeomraFace(x, cx, cy, mood = "stern", look = 0, blink = false, sc = 1) {
    const key = `yf:${mood}:${sc}`;
    let base = cache.get(key);
    if (!base) {
      base = cv(124, 100); const P = pen(base.getContext("2d")); const X = 62, Y = 52;
      // 관(검은 사모) + 앞 장식
      P.r(X - 30, Y - 50, 60, 18, K); P.r(X - 29, Y - 49, 58, 16, "#1e1e28"); P.r(X - 40, Y - 38, 80, 6, K); P.r(X - 39, Y - 37, 78, 4, "#2a2a36");
      P.r(X - 9, Y - 47, 18, 11, "#ffc21a"); P.r(X - 8, Y - 46, 16, 9, "#e8a00a"); P.r(X - 6, Y - 44, 12, 1, "#7a4a00"); P.r(X - 1, Y - 44, 2, 6, "#7a4a00"); P.r(X - 6, Y - 41, 12, 1, "#7a4a00"); P.r(X - 7, Y - 38, 14, 1, "#7a4a00"); // 王
      // 얼굴(각진 픽셀 턱선)
      const skin = mood === "happy" || mood === "smile" ? "#e8836a" : mood === "angry" ? "#d84a3a" : "#d8735a";
      for (let j = 0; j < 44; j++) { const half = j < 26 ? 26 : 26 - Math.floor((j - 26) * 1.15); P.r(X - half - 1, Y - 32 + j, half * 2 + 2, 1, K); P.r(X - half, Y - 32 + j, half * 2, 1, skin); }
      P.r(X - 30, Y - 22, 4, 12, skin); P.r(X + 26, Y - 22, 4, 12, skin); P.r(X - 31, Y - 22, 1, 12, K); P.r(X + 30, Y - 22, 1, 12, K); // 귀
      // 눈썹
      const brow = mood === "happy" || mood === "smile" ? 0 : mood === "angry" ? 3 : 2;
      for (let i = 0; i < 14; i++) { P.r(X - 22 + i, Y - 24 + Math.round((i / 13) * brow), 1, 4, K); P.r(X + 8 + i, Y - 24 + Math.round(((13 - i) / 13) * brow), 1, 4, K); }
      // 코
      P.r(X - 3, Y - 12, 6, 10, "#c05a44"); P.r(X - 5, Y - 4, 10, 4, "#c05a44"); P.p(X - 3, Y - 2, K); P.p(X + 2, Y - 2, K);
      if (mood === "sneeze") { P.r(X - 4, Y - 3, 2, 2, K); P.r(X + 2, Y - 3, 2, 2, K); }
      // 수염(콧수염 + 긴 턱수염)
      P.r(X - 16, Y + 1, 13, 3, K); P.r(X + 3, Y + 1, 13, 3, K); P.r(X - 18, Y + 3, 4, 3, K); P.r(X + 14, Y + 3, 4, 3, K);
      P.tri(X - 12, Y + 8, X + 12, Y + 8, X, Y + 46, K); P.tri(X - 9, Y + 9, X + 9, Y + 9, X, Y + 40, "#2a2a30");
      // 입
      if (mood === "happy" || mood === "smile") { P.r(X - 8, Y + 5, 16, 3, K); P.r(X - 6, Y + 5, 12, 2, "#fff"); P.e(X - 18, Y - 6, 3, 2, "#ff8f8f"); P.e(X + 18, Y - 6, 3, 2, "#ff8f8f"); }
      else if (mood === "sneeze") P.e(X, Y + 7, 5, 3, K);
      else { P.r(X - 7, Y + 5, 14, 2, K); P.r(X - 7, Y + 4, 2, 1, K); P.r(X + 5, Y + 4, 2, 1, K); }
      cache.set(key, base);
    }
    const P = pen(x), ox = Math.round(cx - 62), oy = Math.round(cy - 52);
    x.drawImage(base, ox, oy);
    // 눈(동공은 매 프레임)
    const ex = [cx - 15, cx + 15], ey = cy - 15;
    ex.forEach((e) => {
      if (mood === "happy" || mood === "smile") { for (let i = -5; i <= 5; i++) P.p(e + i, ey - 1 + Math.abs(i) * 0.4, K); P.r(e - 5, ey, 11, 1, K); return; }
      if (mood === "sneeze" || blink) { P.r(e - 6, ey, 12, 2, K); return; }
      P.e(e, ey, 6, 4, K); P.e(e, ey, 5, 3, mood === "angry" ? "#ffe0d0" : "#fff"); P.r(e - 1 + look, ey - 2, 3, 4, K); if (mood === "angry") P.p(e + look, ey - 1, "#ff3a2a");
    });
  }

  // ---------- 층 배경 ----------
  function bgStatic(no) {
    const key = "bg" + no;
    if (cache.has(key)) return cache.get(key);
    const c = cv(W, HH), x = c.getContext("2d"), P = pen(x);
    if (no === 1) { // 붉은 하늘 + 용암 도로
      const sky = ["#1c0507", "#2e0809", "#460c0b", "#64130e", "#871d12", "#a92a16", "#c8401c", "#e2601f"];
      sky.forEach((col, i) => P.r(0, i * 8, W, 8, col));
      for (let i = 0; i < 40; i++) P.p(hash(i, 1) * W, hash(i, 2) * 30, "#ff9a5a");
      P.e(122, 46, 14, 14, "#ff9a3a"); P.e(122, 46, 11, 11, "#ffd05a");
      for (let i = 0; i < W; i++) { const h = 10 + Math.floor(hash(Math.floor(i / 6), 3) * 14) - Math.abs(((i % 12) - 6)); P.r(i, 64 - h, 1, h, "#3a0c0c"); }
      P.r(0, 62, W, 58, "#2a1714");
      P.tri(48, 62, 112, 62, 160, 120, "#3a3434"); P.tri(48, 62, 0, 120, 160, 120, "#3a3434"); P.tri(52, 62, 108, 62, 152, 120, "#4a4444"); P.tri(52, 62, 8, 120, 152, 120, "#4a4444");
      for (let j = 0; j < 8; j++) { const y = 64 + j * j * 0.9, w = 1 + j * 0.5; P.r(80 - w / 2, y, w, 1 + j * 0.4, "#ffc21a"); }
      for (let i = 0; i < 26; i++) { const x0 = hash(i, 4) * W, y0 = 66 + hash(i, 5) * 52; if (x0 > 30 && x0 < 130 && y0 > 70) continue; P.line(x0, y0, x0 + 6 - hash(i, 6) * 12, y0 + 3, "#ff5a1a"); }
      P.r(0, 100, W, 20, "#2f1a16"); P.r(0, 100, W, 1, "#5a2a1a");
      for (let i = 0; i < 30; i++) P.r(hash(i, 8) * W, 101 + hash(i, 9) * 18, 2 + hash(i, 7) * 4, 1, "#ff5a1a");
    } else if (no === 2) { // 벽돌 + 불구덩이 + 사슬
      P.r(0, 0, W, HH, "#2a0a10");
      for (let j = 0; j < 12; j++) for (let i = -1; i < 12; i++) { const bx = i * 16 + (j % 2) * 8, by = j * 8; P.r(bx, by, 15, 7, hash(i, j, 2) > 0.5 ? "#3a1218" : "#341016"); P.r(bx, by + 6, 15, 1, "#22070c"); }
      for (let i = 0; i < 4; i++) { const cx = 14 + i * 42; for (let y = 0; y < 34; y += 3) P.r(cx, y, 2, 2, (y / 3) % 2 ? "#6a6a74" : "#4a4a54"); }
      P.r(0, 74, W, 26, "#1a0508");
      P.r(0, 100, W, 20, "#3a1f22"); for (let i = 0; i < 10; i++) P.r(i * 16, 100, 1, 20, "#2a1416"); P.r(0, 100, W, 1, "#6a3a3a"); P.r(0, 110, W, 1, "#2a1416");
    } else if (no === 3) { // 네온 그리드
      P.r(0, 0, W, HH, "#0c0418");
      for (let i = 0; i < 60; i++) P.p(hash(i, 11) * W, hash(i, 12) * 64, hash(i, 13) > 0.6 ? "#3ff0ff" : "#ff3fd8");
      for (let j = 0; j < 30; j++) P.r(0, 64 + j, W, 1, j % 2 ? "#1a0630" : "#16052a");
      P.r(0, 63, W, 1, "#3ff0ff");
      for (let i = -10; i <= 10; i++) P.line(80 + i * 6, 64, 80 + i * 26, 120, "#7a1fa8");
      [66, 70, 76, 84, 94, 106].forEach((y) => P.r(0, y, W, 1, "#7a1fa8"));
      P.r(0, 100, W, 1, "#ff3fd8");
    } else { // 알현실
      P.r(0, 0, W, HH, "#1e0608");
      for (let j = 0; j < 10; j++) P.r(0, j * 10, W, 10, j % 2 ? "#26080a" : "#2c0a0c");
      [6, 140].forEach((px) => { P.r(px, 0, 14, 100, K); P.r(px + 1, 0, 12, 100, "#8a1a14"); P.r(px + 3, 0, 2, 100, "#b02a1e"); P.r(px, 8, 14, 3, "#ffc21a"); P.r(px, 90, 14, 3, "#ffc21a"); });
      for (let i = 0; i < 20; i++) for (let j = 0; j < 4; j++) P.r(i * 8, 100 + j * 5, 8, 5, (i + j) % 2 ? "#3a0e10" : "#140405");
      P.r(0, 100, W, 1, "#ffc21a");
    }
    cache.set(key, c);
    return c;
  }
  function background(x, no, t, o = {}) {
    x.drawImage(bgStatic(no), 0, 0);
    const P = pen(x);
    if (no === 1) {
      for (let i = 0; i < 14; i++) { const y = (100 - ((t * 18 + hash(i, 21) * 100) % 100)), xx = hash(i, 22) * W + Math.sin(t * 2 + i) * 3; P.p(xx, y, hash(i, 23) > 0.5 ? "#ffb04a" : "#ff6a2a"); }
      for (let i = 0; i < 8; i++) { const a = 0.5 + 0.5 * Math.sin(t * 5 + i * 1.7); if (a > 0.6) P.r(hash(i, 31) * W, 102 + hash(i, 32) * 16, 3, 1, "#ffd05a"); }
    } else if (no === 2) {
      for (let i = 0; i < 10; i++) { const fx = 8 + i * 16, h = 8 + Math.sin(t * 9 + i * 2.1) * 3 + hash(i, 41) * 4; P.tri(fx - 6, 76, fx + 6, 76, fx + Math.sin(t * 7 + i) * 2, 76 - h, "#ff5a1a"); P.tri(fx - 3, 76, fx + 3, 76, fx, 76 - h * 0.6, "#ffc21a"); }
      [[20, 14], [140, 14]].forEach(([sx, sy], k) => { P.e(sx, sy, 10, 10, "#8a8a96"); P.e(sx, sy, 7, 7, "#5a5a66"); for (let i = 0; i < 10; i++) { const a = t * (k ? -4 : 4) + (i / 10) * Math.PI * 2; P.tri(sx + Math.cos(a) * 9, sy + Math.sin(a) * 9, sx + Math.cos(a + 0.3) * 13, sy + Math.sin(a + 0.3) * 13, sx + Math.cos(a + 0.5) * 9, sy + Math.sin(a + 0.5) * 9, "#c8c8d4"); } P.e(sx, sy, 2, 2, K); });
      if (!o.noDancers) for (let i = 0; i < 5; i++) { const dx = 36 + i * 22, hop = Math.abs(Math.sin(t * 6 + i)) * 3; P.r(dx - 2, 64 - hop, 5, 6, "#5a0a10"); P.r(dx - 3, 62 - hop, 1, 2, "#5a0a10"); P.r(dx + 3, 62 - hop, 1, 2, "#5a0a10"); P.r(dx - 1, 70 - hop, 1, 3, "#5a0a10"); P.r(dx + 2, 70 - hop, 1, 3, "#5a0a10"); P.r(dx - 4 + (i % 2 ? Math.sin(t * 12) * 2 : 0), 65 - hop, 2, 1, "#5a0a10"); }
    } else if (no === 3) {
      const objs = [[24, 26, 0], [130, 20, 1], [70, 14, 2], [104, 44, 3]];
      objs.forEach(([ox, oy, k]) => {
        const yy = oy + Math.sin(t * 1.5 + k) * 4;
        x.save(); x.translate(ox, yy); x.rotate(t * (k % 2 ? 0.8 : -0.6) + k); const Q = pen(x);
        if (k === 0) { Q.r(-5, -1, 10, 2, "#ff3fd8"); Q.r(-5, 1, 2, 6, "#ff3fd8"); Q.r(3, 1, 2, 6, "#ff3fd8"); Q.r(-5, -8, 2, 7, "#ff3fd8"); } // 의자
        else if (k === 1) { Q.e(0, 0, 6, 3, "#3ff0ff"); Q.tri(5, 0, 9, -3, 9, 3, "#3ff0ff"); Q.p(-3, -1, K); } // 물고기
        else if (k === 2) { Q.r(-4, -4, 8, 8, "#ffc21a"); Q.r(-3, -3, 6, 6, "#ffe07a"); } // 큐브
        else { Q.e(0, 0, 5, 5, "#fff"); Q.r(0, -4, 1, 4, K); Q.r(0, 0, 3, 1, K); } // 시계
        x.restore();
      });
      const sh = Math.floor(t * 8) % 4; P.r(0, 63, W, 1, sh % 2 ? "#3ff0ff" : "#ff3fd8");
    } else {
      if (!o.noFace) yeomraFace(x, 80, o.faceY || 54, o.mood || "stern", o.look == null ? Math.round(Math.sin(t * 0.9) * 2) : o.look, (t % 4) > 3.85);
      [[28, 96], [132, 96]].forEach(([cx, cy], i) => { P.r(cx - 2, cy - 10, 4, 10, "#f2ecd8"); const f = Math.sin(t * 10 + i) > 0; P.tri(cx - 2, cy - 11, cx + 2, cy - 11, cx, cy - (f ? 17 : 15), "#ff9a2a"); P.p(cx, cy - 12, "#ffe07a"); });
    }
  }
  const floorOf = (n) => (n <= 8 ? 1 : n <= 17 ? 2 : n <= 25 ? 3 : 4);

  // ---------- 장면 31종 ----------
  // 각 함수: 소품을 그리고 주인공 위치·표정을 돌려줍니다. {hx, hy, face, pose, bob}
  const flame = (P, X, Y, s, t, i = 0) => { const h = s + Math.sin(t * 12 + i) * s * 0.3; P.tri(X - s * 0.6, Y, X + s * 0.6, Y, X + Math.sin(t * 9 + i) * 1.5, Y - h * 1.6, "#ff5a1a"); P.tri(X - s * 0.35, Y, X + s * 0.35, Y, X, Y - h, "#ffc21a"); };
  const steam = (P, X, Y, t, col = "#e8e8f0") => { for (let i = 0; i < 3; i++) { const k = (t * 1.2 + i / 3) % 1; P.e(X + Math.sin(k * 6 + i) * 2, Y - k * 14, 1 + k * 2, 1 + k * 2, col); } };
  const SC = {
    lavaroad(x, t) { const P = pen(x); [[30, 104], [96, 108], [124, 102]].forEach(([a, b], i) => { P.e(a, b, 9, 2, "#ff5a1a"); P.e(a, b, 6, 1, "#ffc21a"); if ((t * 3 + i) % 1 < 0.3) P.p(a + 2, b - 2, "#ffd05a"); }); steam(P, 50, 98, t); steam(P, 58, 98, t + 0.4); const hop = Math.abs(Math.sin(t * 14)) * 4; return { hx: 54, hy: GY - hop, face: "p", pose: Math.sin(t * 14) > 0 ? "run" : "idle" }; },
    sign(x, t) { const P = pen(x); P.r(106, 60, 4, 40, K); P.r(107, 60, 2, 40, "#6a4a2a"); P.box(86, 54, 44, 12, "#e8d8b0"); P.box(86, 68, 44, 12, "#e8d8b0"); P.tri(80, 60, 88, 55, 88, 65, "#e8d8b0"); P.line(80, 60, 88, 54, K); P.line(80, 60, 88, 66, K); P.tri(136, 74, 128, 69, 128, 79, "#e8d8b0"); P.line(136, 74, 128, 68, K); P.line(136, 74, 128, 80, K); skull(x, 104, 61); skull(x, 112, 75); flame(P, 92, 54, 4, t); flame(P, 124, 54, 3, t, 2); flame(P, 128, 68, 3, t, 4); P.r(148, 100, 12, 20, "#140404"); return { hx: 56, hy: GY, face: "w" }; },
    thirst(x, t) { const P = pen(x); P.e(34, 104, 14, 4, K); P.e(34, 104, 13, 3, "#4aa8ff"); P.r(28, 103, 4, 1, "#c8ecff"); [[30, 104], [39, 105]].forEach(([a, b], i) => { if (Math.sin(t * 4 + i * 2) > 0) { P.p(a, b, "#3fbf5a"); P.p(a + 1, b, "#3fbf5a"); P.p(a, b - 1, K); } }); P.r(110, 80, 12, 20, K); P.r(111, 81, 10, 19, "#d81e1e"); P.r(114, 74, 6, 7, K); P.r(115, 75, 4, 6, "#d81e1e"); P.r(113, 72, 8, 3, "#ffc21a"); P.r(112, 87, 8, 7, "#fff"); flame(P, 116, 93, 2, t); for (let i = 0; i < 3; i++) P.p(72 + i * 6, 70 + Math.sin(t * 6 + i) * 2, "#ffe07a"); return { hx: 72, hy: GY, face: "o" }; },
    taxi(x, t) { const P = pen(x); const X = 96, Y = 100, sh = Math.sin(t * 20) > 0.7 ? 1 : 0; P.r(X - 2, Y - 22 + sh, 60, 16, K); P.r(X - 1, Y - 21 + sh, 58, 14, "#22222a"); P.r(X + 10, Y - 32 + sh, 36, 11, K); P.r(X + 11, Y - 31 + sh, 34, 10, "#2a2a36"); P.r(X + 14, Y - 29 + sh, 13, 7, "#6a7aa8"); P.r(X + 30, Y - 29 + sh, 13, 7, "#6a7aa8"); reaper(x, X + 22, Y - 22 + sh); P.box(X + 20, Y - 38 + sh, 16, 6, "#ffc21a"); skull(x, X + 28, Y - 35 + sh); P.r(X + 40, Y - 18 + sh, 10, 5, K); txt(P, "99", X + 41, Y - 18 + sh, "#ff3a2a"); [X + 8, X + 46].forEach((wx) => { P.e(wx, Y - 4, 6, 6, K); P.e(wx, Y - 4, 3, 3, "#888"); }); P.r(X - 3, Y - 16 + sh, 3, 3, "#ffe07a"); return { hx: 60, hy: GY, face: "w" }; },
    boat(x, t) { const P = pen(x); P.r(0, 100, W, 20, "#1a2a4a"); P.r(64, 96, 96, 24, "#1a2a4a"); for (let i = 0; i < 12; i++) P.r(((i * 23 + t * 12) % 170) - 10, 102 + (i % 4) * 4, 6, 1, "#4a6aa8"); P.r(0, 96, 62, 24, "#2a1714"); P.r(0, 96, 62, 1, "#5a2a1a"); const bob = Math.sin(t * 3) * 1.5; P.tri(84, 98 + bob, 150, 98 + bob, 140, 106 + bob, K); P.tri(86, 99 + bob, 148, 99 + bob, 139, 105 + bob, "#6a4a2a"); P.r(110, 76 + bob, 10, 22, K); P.r(111, 77 + bob, 8, 21, "#55556a"); P.e(115, 74 + bob, 6, 6, K); P.e(115, 75 + bob, 5, 5, "#55556a"); P.r(113, 75 + bob, 4, 3, "#222"); P.p(114, 76 + bob, "#ffe07a"); P.p(116, 76 + bob, "#ffe07a"); P.line(124, 70 + bob, 134, 108 + bob, "#8a6a3a"); bubble(P, 94, 54 + bob, 18, 11, "r"); P.e(103, 59 + bob, 3, 3, "#ffc21a"); P.p(103, 59 + bob, "#b08000"); return { hx: 40, hy: 96, face: "n" }; },
    meteor(x, t) { const P = pen(x); const k = (t * 0.5) % 1, mx = 120 - k * 10, my = 14 + k * 8; for (let i = 0; i < 6; i++) P.e(mx + 6 + i * 4, my - 4 - i * 3, 5 - i * 0.6, 4 - i * 0.5, i % 2 ? "#ffc21a" : "#ff5a1a"); P.e(mx, my, 8, 8, K); P.e(mx, my, 7, 7, "#6a4a3a"); P.e(mx - 2, my - 2, 2, 2, "#8a6a5a"); P.e(mx + 3, my + 2, 2, 1, "#4a3a2a"); P.e(60, 101, 10 + Math.sin(t * 4) * 2, 2, "#140404"); return { hx: 60, hy: GY, face: "p" }; },
    booth(x, t) { const P = pen(x); P.box(96, 62, 50, 38, "#5a5a66"); P.box(100, 66, 42, 18, "#a8d8ff"); devil(x, 121, 86, { t, glasses: true }); P.box(92, 84, 58, 6, "#8a8a96"); P.r(140, 54, 4, 8, K); P.e(142, 52, 4, 4, "#ff3a2a"); const st = Math.sin(t * 5) > 0.5; P.r(104, st ? 76 : 80, 6, 5, "#6a4a2a"); P.r(103, st ? 81 : 85, 8, 2, "#d81e1e"); [[18, 0], [32, 1]].forEach(([gx, i]) => ghost(x, gx, 98 + Math.sin(t * 3 + i) * 2, 0.7)); return { hx: 66, hy: GY, face: "w" }; },
    dog(x, t) { const P = pen(x); dog(x, 116, 100, t); for (let i = 0; i < 3; i++) { const k = (t * 2 + i / 3) % 1; P.r(92 - k * 8, 72 + i * 6, 3, 1, "#ff9a5a"); } return { hx: 50, hy: GY, face: "p" }; },
    guard(x, t) { const P = pen(x); devil(x, 112, 100, { t, trident: true, flip: true }); bubble(P, 92, 52, 30, 13, "r"); txt(P, "1+1=?", 96, 56, K); return { hx: 56, hy: GY, face: "w" }; },
    grill(x, t) { const P = pen(x); P.r(80, 96, 34, 4, "#3a2a20"); for (let i = 0; i < 4; i++) flame(P, 85 + i * 8, 96, 4, t, i); P.r(78, 74, 2, 24, K); P.r(114, 74, 2, 24, K); P.r(74, 79, 46, 2, "#c8c8d0"); const sp = Math.sin(t * 4); P.e(97, 80, 13, 5 + sp, K); P.e(97, 80, 12, 4 + sp, "#d8823a"); P.r(88, 78, 18, 1, "#a85a20"); devil(x, 132, 100, { t, chef: true, flip: true }); P.r(122, 82, 1, 10, "#c8c8d0"); return { hx: 46, hy: GY, face: "p" }; },
    saw(x, t) { const P = pen(x); const X = 112 - ((t * 4) % 6); P.box(X - 10, 82, 32, 14, "#6a6a74"); [X - 4, X + 14].forEach((wx) => P.e(wx, 97, 3, 3, K)); P.r(X - 4, 70, 4, 14, "#4a4a54"); P.e(X - 6, 68, 14, 14, "#9a9aa6"); for (let i = 0; i < 12; i++) { const a = t * -14 + (i / 12) * Math.PI * 2; P.tri(X - 6 + Math.cos(a) * 13, 68 + Math.sin(a) * 13, X - 6 + Math.cos(a + 0.25) * 18, 68 + Math.sin(a + 0.25) * 18, X - 6 + Math.cos(a + 0.45) * 13, 68 + Math.sin(a + 0.45) * 13, "#d8d8e0"); } P.e(X - 6, 68, 3, 3, K); for (let i = 0; i < 3; i++) P.p(X - 24 - i * 3, 64 + ((t * 30 + i * 5) % 10), "#ffe07a"); return { hx: 50, hy: GY, face: "p" }; },
    gaslight(x, t) { const P = pen(x); devil(x, 104, 100, { t, flip: true }); P.r(92, 84, 4, 2, "#e0402a"); bubble(P, 106, 56, 26, 18, "r"); P.tri(113, 66, 119, 60, 125, 66, "#e5372b"); P.r(114, 66, 10, 6, "#e8d8b0"); P.r(118, 68, 2, 4, "#6a4a2a"); txt(P, "?", 127, 60, K); for (let i = 0; i < 5; i++) { const a = t * 3 + (i / 5) * Math.PI * 2; P.p(56 + Math.cos(a) * 9, 76 + Math.sin(a) * 3, i % 2 ? "#ff3fd8" : "#9b4dff"); } return { hx: 56, hy: GY, face: "w" }; },
    dance(x, t) { const P = pen(x); P.line(80, 0, 80, 10, "#888"); P.e(80, 14, 5, 5, "#c8c8d4"); for (let i = 0; i < 6; i++) P.p(77 + (i % 3) * 3, 11 + Math.floor(i / 3) * 4, Math.sin(t * 8 + i) > 0 ? "#fff" : "#6a6a74"); [98, 118, 138].forEach((dx, i) => devil(x, dx, 100 - Math.abs(Math.sin(t * 6 + i)) * 4, { t, dance: Math.sin(t * 6 + i) > 0, flip: i % 2 === 1 })); for (let i = 0; i < 3; i++) { const k = (t + i / 3) % 1; P.r(94 + i * 18, 50 - k * 12, 2, 4, "#ffc21a"); P.r(95 + i * 18, 48 - k * 12, 3, 1, "#ffc21a"); } return { hx: 50, hy: GY, face: "p" }; },
    sauna(x, t) { const P = pen(x); P.box(70, 84, 30, 16, "#d81e1e"); P.r(72, 86, 26, 4, "#ff7a3a"); steam(P, 78, 84, t); steam(P, 90, 84, t + 0.5); P.box(112, 84, 30, 16, "#3a7ad8"); P.r(114, 86, 26, 4, "#9adcff"); for (let i = 0; i < 4; i++) P.tri(116 + i * 7, 84, 119 + i * 7, 84, 117 + i * 7, 90, "#e8f8ff"); devil(x, 150, 100, { t, flip: true }); P.r(140, 80, 4, 2, "#e0402a"); P.box(16, 54, 12, 30, "#fff"); P.r(20, 58, 4, 22, "#d81e1e"); txt(P, "9999", 6, 46, "#ffc21a"); for (let i = 0; i < 6; i++) P.e(hash(i, 51) * W, 30 + ((t * 8 + i * 20) % 50), 4, 2, "rgba(255,255,255,0.15)"); return { hx: 48, hy: GY, face: "o" }; },
    tickle(x, t) { const P = pen(x); P.box(100, 64, 34, 36, "#7a7a86"); P.box(106, 70, 22, 10, "#3a3a46"); P.p(110, 74, Math.sin(t * 6) > 0 ? "#3fbf5a" : "#ff3a2a"); P.p(116, 74, "#ffc21a"); for (let i = 0; i < 2; i++) { const a = Math.sin(t * 10 + i * 2) * 4; P.line(100, 76 + i * 12, 76, 72 + i * 12 + a, "#9a9aa6"); P.e(73, 72 + i * 12 + a, 4, 2, "#fff"); P.line(70, 72 + i * 12 + a, 77, 72 + i * 12 + a, "#c8c8d0"); } devil(x, 148, 100, { t, flip: true }); return { hx: 54, hy: GY, face: "l" }; },
    boss(x, t) { const P = pen(x); P.box(84, 82, 60, 18, "#6a4a2a"); devil(x, 118, 84, { t, tie: true }); for (let i = 0; i < 9; i++) P.box(88 + (i % 2), 80 - i * 4, 16, 5, "#fff"); P.box(128, 66, 12, 12, "#fff"); P.r(134, 68, 1, 5, K); P.r(134, 72, 3, 1, K); bubble(P, 96, 40, 14, 11, "l"); txt(P, "!!", 99, 43, "#e5372b"); return { hx: 50, hy: GY, face: "w" }; },
    thorns(x, t) { const P = pen(x); for (let i = 0; i < 22; i++) { const tx = 4 + i * 7 + (i % 2) * 2; P.tri(tx - 3, 101, tx + 3, 101, tx, 93 - (i % 3) * 2, "#c8c8d4"); P.line(tx, 93 - (i % 3) * 2, tx + 2, 101, "#8a8a96"); } P.e(16, 82, 6, 4, "#140404"); P.p(14, 81, "#ff3a2a"); P.p(18, 81, "#ff3a2a"); return { hx: 72, hy: 94, face: "p" }; },
    gravity(x, t) { const P = pen(x); P.r(0, 0, W, 8, "#1a0630"); P.r(0, 8, W, 1, "#ff3fd8"); P.box(100, 9, 30, 4, "#ff3fd8"); P.r(104, 13, 2, 10, "#ff3fd8"); P.r(124, 13, 2, 10, "#ff3fd8"); P.r(40, 9, 2, 8, "#3ff0ff"); P.tri(34, 17, 48, 17, 41, 24, "#3ff0ff"); for (let i = 0; i < 3; i++) { const k = (t * 2 + i / 3) % 1; P.tri(76 + i * 8, 40 - k * 20, 80 + i * 8, 34 - k * 20, 84 + i * 8, 40 - k * 20, "#3ff0ff"); } const fl = Math.sin(t * 3) * 3; return { hx: 64, hy: 44 + fl, face: "o", pose: "up", rot: Math.PI }; },
    vending(x, t) { const P = pen(x); const g = Math.sin(t * 4) > 0 ? "#ff3fd8" : "#3ff0ff"; P.r(94, 40, 40, 60, g); P.box(96, 42, 36, 56, "#22183a"); P.box(99, 45, 22, 30, "#0c0418"); for (let i = 0; i < 6; i++) { P.r(101 + (i % 3) * 7, 47 + Math.floor(i / 3) * 14, 5, 10, i % 2 ? "#e5372b" : "#3ff0ff"); } P.box(123, 46, 7, 10, "#3ff0ff"); ghost(x, 112, 88, 0.9); txt(P, "=1", 118, 80, "#ffc21a"); P.e(127, 62, 2, 2, "#ff3a2a"); P.box(100, 88, 20, 7, K); return { hx: 56, hy: GY, face: "n" }; },
    doors(x, t) { const P = pen(x); P.box(28, 46, 28, 54, "#fff"); P.box(31, 49, 22, 51, "#e8f0ff"); P.e(42, 42, 9, 2, "#ffe07a"); P.ring(42, 42, 9, "#ffc21a"); P.p(50, 76, "#ffc21a"); [26, 58].forEach((cx) => P.e(cx, 50, 4, 3, "#fff")); P.box(104, 46, 28, 54, "#5a0a10"); P.box(107, 49, 22, 51, "#8a1a14"); P.tri(104, 46, 100, 36, 110, 46, "#f2ecd8"); P.tri(132, 46, 136, 36, 126, 46, "#f2ecd8"); P.p(109, 76, "#ffc21a"); flame(P, 118, 46, 3, t); return { hx: 80, hy: GY, face: "w" }; },
    duck(x, t) { const P = pen(x); const bob = Math.sin(t * 2) * 2; P.e(118, 86 + bob, 26, 14, K); P.e(118, 86 + bob, 25, 13, "#ffd21a"); P.e(104, 62 + bob, 14, 13, K); P.e(104, 62 + bob, 13, 12, "#ffd21a"); P.e(90, 66 + bob, 8, 3, K); P.e(90, 66 + bob, 7, 2, "#ff7a1a"); P.e(100, 58 + bob, 3, 3, K); P.p(99, 57 + bob, "#fff"); P.e(130, 80 + bob, 10, 5, "#f0b80a"); bubble(P, 70, 34 + bob, 14, 11, "r"); txt(P, "?", 75, 37 + bob, K); return { hx: 46, hy: GY, face: "w" }; },
    clocks(x, t) { const P = pen(x); const clock = (cx, cy, r, sk, ph) => { P.e(cx, cy, r + 1, r + 1 + sk, K); P.e(cx, cy, r, r + sk, "#fff"); for (let i = 0; i < sk + 3; i++) P.r(cx - 2 + i % 3, cy + r + sk + i, 2, 1, "#fff"); const a = -t * 3 + ph; P.line(cx, cy, cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2), K); P.line(cx, cy, cx + Math.cos(a / 12) * (r - 4), cy + Math.sin(a / 12) * (r - 4), "#e5372b"); }; P.r(96, 70, 40, 3, "#3ff0ff"); P.r(114, 73, 3, 27, "#3ff0ff"); clock(108, 62, 8, 4, 0); clock(130, 36, 7, 2, 2); clock(30, 40, 6, 3, 4); return { hx: 66, hy: GY, face: "w" }; },
    quiz(x, t) { const P = pen(x); for (let i = 0; i < 8; i++) P.e(10 + i * 20, 6, 3, 3, (Math.floor(t * 6) + i) % 2 ? "#ffc21a" : "#ff3fd8"); P.box(56, 14, 48, 26, "#22183a"); txt(P, "?", 74, 18, "#3ff0ff", 3); P.box(46, 84, 22, 16, "#3a3aa8"); P.e(57, 83, 5, 2, "#e5372b"); devil(x, 124, 100, { t, flip: true }); P.r(112, 82, 2, 6, "#888"); P.e(113, 81, 2, 2, K); return { hx: 57, hy: 84, face: "w" }; },
    contract(x, t) { const P = pen(x); devil(x, 116, 100, { t, flip: true }); P.box(84, 70, 22, 28, "#f2ecd8"); for (let i = 0; i < 4; i++) P.r(87, 74 + i * 4, 14 + (i % 2) * 2, 2, K); for (let i = 0; i < 3; i++) P.r(87, 91 + i * 2, 16, 1, "#9a9aa6"); P.line(108, 66, 100, 80, "#fff"); P.line(108, 66, 104, 64, "#e5372b"); return { hx: 52, hy: GY, face: "w" }; },
    glitch(x, t) { const P = pen(x); for (let i = 0; i < 10; i++) { if (hash(i, Math.floor(t * 6)) > 0.5) P.r(i * 16, 100, 16, 20, "#000"); } for (let i = 0; i < 8; i++) { const gx = hash(i, Math.floor(t * 10), 7) * W, gy = hash(i, Math.floor(t * 10), 8) * 100; P.r(gx, gy, 6 + hash(i, 3) * 20, 2, ["#3ff0ff", "#ff3fd8", "#ffc21a", "#3fbf5a"][i % 4]); } P.box(96, 30, 44, 14, "#000"); txt(P, "ERR", 100, 34, "#ff3a2a"); txt(P, "404", 120, 34, "#3ff0ff"); return { hx: 60, hy: GY, face: "o", glitch: true }; },
    gate(x, t) { const P = pen(x); for (let i = 0; i < 8; i++) { const k = (t * 1.5 + i / 8) % 1; P.p(30 + i * 15, 99 - k * 8, "#ff9a3a"); } P.r(0, 100, W, 2, "#ff7a1a"); devil(x, 126, 100, { t, trident: true, flip: true, col: "#4a7ae0", dark: "#2a4a9a" }); P.box(88, 86, 18, 14, "#6a4a2a"); shoe(x, 94, 88); shoe(x, 100, 94); return { hx: 54, hy: GY, face: "w" }; },
    ticket(x, t) { const P = pen(x); P.box(96, 18, 46, 14, "#000"); txt(P, "999999", 98, 22, "#ff3a2a"); for (let i = 0; i < 5; i++) ghost(x, 100 + i * 12, 96 + Math.sin(t * 2 + i) * 1.5, 0.75); P.box(70, 70, 8, 10, "#fff"); txt(P, "9", 72, 72, K); return { hx: 60, hy: GY, face: "w" }; },
    mirror(x, t) { const P = pen(x); P.box(92, 40, 50, 46, "#ffc21a"); P.box(95, 43, 44, 40, "#0c1430"); for (let i = 0; i < 5; i++) P.r(99, 48 + i * 6, 20 + hash(i, 5) * 16, 2, i === Math.floor(t * 2) % 5 ? "#ffe07a" : "#6a8ad8"); P.e(132, 50, 3, 3, "#fff"); P.e(132, 50, 2, 2, "#0c1430"); P.line(134, 52, 136, 54, "#fff"); P.r(114, 86, 6, 14, "#ffc21a"); return { hx: 56, hy: GY, face: "p" }; },
    sneeze(x, t) { const P = pen(x); bubble(P, 104, 70, 26, 11, "l"); txt(P, "E...", 107, 73, K); return { hx: 60, hy: GY, face: "p" }; },
    rps(x, t) { const P = pen(x); const hy = 74 + Math.sin(t * 6) * 3; P.e(118, hy, 14, 12, K); P.e(118, hy, 13, 11, "#d8735a"); for (let i = 0; i < 4; i++) P.r(108 + i * 6, hy - 12, 5, 6, K), P.r(109 + i * 6, hy - 11, 3, 5, "#e8836a"); P.r(102, hy + 8, 32, 14, "#a8201a"); bubble(P, 60, 40, 20, 13, "r"); txt(P, "?", 68, 44, K); return { hx: 56, hy: GY, face: "w" }; },
    final(x, t) { const P = pen(x); P.box(92, 78, 24, 22, "#5a5a66"); P.box(95, 81, 18, 10, "#0c1a0c"); for (let i = 0; i < 16; i++) P.p(96 + i, 86 + Math.round(Math.sin(t * 8 + i * 0.9) * 3), "#3fbf5a"); P.e(104, 95, 2, 2, "#ffc21a"); P.box(128, 86, 14, 14, "#8a8a96"); P.e(135, 84, 6, 3, K); P.e(135, 84, 5, 2, "#3fbf5a"); return { hx: 60, hy: GY, face: "w" }; },
  };
  const SCENE_BG = { sneeze: { mood: "sneeze" }, rps: { mood: "stern" }, final: { mood: "stern" }, mirror: { mood: "stern" } };

  // ---------- 사망 애니메이션 24종 ----------
  // t: 0→1 (약 0.9초). base: 장면이 준 주인공 위치. d: 사망 데이터
  function puff(P, X, Y, r, col = "#e8e8f0") { P.e(X, Y, r, r, col); P.e(X - r * 0.8, Y + r * 0.3, r * 0.7, r * 0.7, col); P.e(X + r * 0.8, Y + r * 0.2, r * 0.75, r * 0.75, col); }
  function stars(P, X, Y, t, n = 3, r = 7) { for (let i = 0; i < n; i++) { const a = t * 10 + (i / n) * Math.PI * 2; const sx = X + Math.cos(a) * r, sy = Y + Math.sin(a) * r * 0.4; P.p(sx, sy, "#ffe07a"); P.p(sx - 1, sy, "#ffc21a"); P.p(sx + 1, sy, "#ffc21a"); P.p(sx, sy - 1, "#ffc21a"); P.p(sx, sy + 1, "#ffc21a"); } }
  function fallObj(x, kind, X, Y) {
    const P = pen(x);
    if (kind === "meteor") { P.e(X, Y - 7, 9, 8, K); P.e(X, Y - 7, 8, 7, "#6a4a3a"); P.e(X - 2, Y - 9, 2, 2, "#8a6a5a"); flame(P, X, Y - 14, 4, Y); }
    else if (kind === "boot") { P.r(X - 10, Y - 16, 14, 12, K); P.r(X - 9, Y - 16, 12, 11, "#5a0a10"); P.r(X - 10, Y - 6, 24, 7, K); P.r(X - 9, Y - 5, 22, 5, "#3a0508"); }
    else if (kind === "stamp") { P.r(X - 3, Y - 30, 6, 18, K); P.r(X - 2, Y - 30, 4, 18, "#8a5a32"); P.e(X, Y - 32, 5, 3, "#8a5a32"); P.r(X - 14, Y - 12, 28, 8, K); P.r(X - 13, Y - 11, 26, 6, "#6a4a2a"); P.r(X - 14, Y - 4, 28, 4, "#d81e1e"); }
    else if (kind === "rock") { P.e(X, Y - 11, 16, 12, K); P.e(X, Y - 11, 15, 11, "#8a8a96"); P.e(X - 5, Y - 15, 4, 3, "#aaaab6"); P.p(X + 6, Y - 8, "#5a5a66"); P.r(X - 15, Y - 3, 30, 2, "#5a5a66"); }
    else if (kind === "floor") { P.r(0, Y - 8, W, 8, K); P.r(0, Y - 7, W, 6, "#7a1fa8"); for (let i = 0; i < 10; i++) P.r(i * 16, Y - 7, 1, 6, "#ff3fd8"); }
  }
  const DEATH = {
    melt(x, t, b) { const P = pen(x); const lw = 4 + ease(seg(t, 0, 0.3)) * 18; P.e(b.hx, b.hy + 2, lw, 3, "#ff5a1a"); P.e(b.hx, b.hy + 2, lw - 3, 2, "#ffc21a"); const sink = ease(seg(t, 0.1, 0.6)); if (sink < 1) { x.save(); x.beginPath(); x.rect(0, 0, W, b.hy + 1); x.clip(); hero(x, b.hx, b.hy + sink * 18, { face: "o", pose: "up", sx: 1 + sink * 0.3, sy: 1 - sink * 0.2 }); x.restore(); } if (t > 0.55) { const bob = Math.sin(t * 20) * 1.2; skull(x, b.hx, b.hy - 1 + bob); for (let i = 0; i < 3; i++) { const k = (t * 3 + i / 3) % 1; P.e(b.hx - 8 + i * 8, b.hy - k * 10, 1, 1, "#ffc21a"); } } },
    cliff(x, t, b) { const P = pen(x); const ex = b.hx + 26; P.r(ex, 100, W - ex, 20, "#0c0202"); P.r(ex, 100, 1, 20, "#5a2a1a"); const walk = seg(t, 0, 0.35), hang = seg(t, 0.35, 0.6), drop = seg(t, 0.6, 1); const X = b.hx + walk * 38; if (drop === 0) { hero(x, X, b.hy, { face: hang > 0 ? "o" : "w", pose: hang > 0 ? "up" : (Math.floor(t * 20) % 2 ? "run" : "idle") }); if (hang > 0.2) { bubble(P, X + 6, b.hy - 28, 10, 10, "l"); txt(P, "?", X + 9, b.hy - 26, K); } } else { hero(x, X, b.hy + drop * drop * 60, { face: "o", pose: "up", sx: 1 - drop * 0.4, sy: 1 + drop * 0.6 }); for (let i = 0; i < 3; i++) P.r(X - 4 + i * 4, b.hy - 22 - drop * 10, 1, 6, "#fff"); } },
    bloat(x, t, b, d) { const P = pen(x); const g = ease(seg(t, 0, 0.65)); if (t < 0.68) { hero(x, b.hx, b.hy, { face: d.tint === "pink" ? "l" : "p", pal: d.tint === "pink" ? "pink" : "green", sx: 1 + g * 1.4, sy: 1 + g * 0.8 }); if (d.tint !== "pink") for (let i = 0; i < 4; i++) { const a = t * 9 + i * 1.6; const gx = b.hx + Math.cos(a) * (12 + g * 8), gy = b.hy - 12 + Math.sin(a) * 8; P.e(gx, gy, 2, 2, "#3fbf5a"); P.p(gx, gy, K); } } else { const k = seg(t, 0.68, 1); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; P.e(b.hx + Math.cos(a) * k * 26, b.hy - 12 + Math.sin(a) * k * 20, 4 - k * 3, 4 - k * 3, "#fff"); } puff(P, b.hx, b.hy - 10, 8 - k * 4); ghost(x, b.hx, b.hy - 16 - k * 30, 1 - k * 0.3); } },
    soul(x, t, b, d) { const P = pen(x); const [tx, ty] = d.target || [120, 60]; const k = ease(seg(t, 0.15, 0.85)); hero(x, b.hx, b.hy, { face: t > 0.2 ? "x" : "o", pal: t > 0.3 ? "grey" : "n", sy: 1 - seg(t, 0.3, 1) * 0.15 }); const gx = b.hx + (tx - b.hx) * k, gy = b.hy - 18 + (ty - b.hy + 18) * k - Math.sin(k * Math.PI) * 16; for (let i = 0; i < 6; i++) { const q = i / 6; P.e(b.hx + (gx - b.hx) * q, b.hy - 14 + (gy - b.hy + 14) * q, 1 + q * 2, 1 + q * 2, "rgba(238,246,255,0.6)"); } ghost(x, gx, gy, 1 - seg(t, 0.85, 1)); if (t > 0.85) { txt(P, "+1", tx - 4, ty - 16 - (t - 0.85) * 40, "#ffc21a"); } },
    vortex(x, t, b) { const P = pen(x); const cx = 104, cy = 106; for (let r = 2; r < 20; r += 2) for (let i = 0; i < 10; i++) { const a = t * 14 + r * 0.4 + (i / 10) * Math.PI * 2; P.p(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.35, r % 4 ? "#4a6aa8" : "#9adcff"); } const k = ease(seg(t, 0, 1)); const a = t * 20; hero(x, b.hx + (cx - b.hx) * k + Math.cos(a) * (1 - k) * 12, b.hy + (cy - b.hy) * k - Math.sin(k * Math.PI) * 24, { face: "o", rot: a, sx: 1 - k * 0.85, sy: 1 - k * 0.85 }); },
    flatten(x, t, b, d) { const P = pen(x); const obj = d.obj || "meteor"; const fall = seg(t, 0, 0.3), sq = seg(t, 0.28, 0.4); const hitY = b.hy - 16 + sq * 13; const oy = fall < 1 ? -24 + (hitY + 24) * fall * fall : hitY; hero(x, b.hx, b.hy, { face: sq > 0 ? "x" : "o", pose: sq > 0 ? "idle" : "up", sx: 1 + sq * 1.2, sy: 1 - sq * 0.85 }); if (t < 0.55) fallObj(x, obj, b.hx, oy); else { const lift = ease(seg(t, 0.55, 0.85)); fallObj(x, obj, b.hx + (obj === "boot" ? lift * 50 : 0), oy - lift * 100); } if (sq > 0) { const f = 1 - seg(t, 0.4, 0.8); if (f > 0) { puff(P, b.hx - 14, b.hy - 2, 3 * f); puff(P, b.hx + 14, b.hy - 2, 3 * f); } } if (t > 0.55) stars(P, b.hx, b.hy - 6, t, 3, 9); },
    sandwich(x, t, b) { const P = pen(x); const up = ease(seg(t, 0, 0.3)); const top = 9; const hy = b.hy - up * (b.hy - (top + 1)); const fy = 120 - ease(seg(t, 0.25, 0.5)) * (120 - (top + 18)); const sq = seg(t, 0.42, 0.52); x.save(); x.translate(b.hx, hy); x.scale(1 + sq * 1.2, 1 - sq * 0.8); hero(x, 0, 0, { face: sq > 0 ? "x" : "o", pose: "up", rot: Math.PI }); x.restore(); const ffy = Math.max(fy, top + 1 + 17 * (1 - 0.8 * sq)); P.r(0, ffy, W, 6, K); P.r(0, ffy + 1, W, 4, "#7a1fa8"); for (let i = 0; i < 10; i++) P.r(i * 16, ffy + 1, 1, 4, "#ff3fd8"); P.r(0, ffy + 6, W, 120 - ffy, "#1a0630"); for (let i = 0; i < 10; i++) P.r(i * 16 + 8, ffy + 6, 1, 120 - ffy, "#7a1fa8"); if (sq > 0) stars(P, b.hx, top + 8, t, 3, 10); },
    conveyor(x, t, b) { const P = pen(x); P.r(30, 100, 110, 4, K); for (let i = 0; i < 14; i++) P.r(30 + ((i * 8 + t * 60) % 110), 101, 4, 2, "#6a6a74"); P.box(130, 70, 30, 30, "#3a3a46"); P.r(134, 76, 22, 24, "#140404"); flame(P, 145, 100, 7, t * 3); const k = seg(t, 0, 0.6); const X = b.hx + k * k * 90; if (X < 140) { x.save(); x.beginPath(); x.rect(0, 0, 134, HH); x.clip(); hero(x, X, b.hy - 4, { face: "o", pose: "up" }); x.restore(); } if (t > 0.6) { const q = seg(t, 0.6, 1); puff(P, 146, 66 - q * 20, 3 + q * 6, "#6a6a74"); skull(x, 146, 60 - q * 28); } },
    chomp(x, t, b) { const P = pen(x); const dx = 116 - ease(seg(t, 0, 0.25)) * (116 - b.hx); if (t < 0.25) { dog(x, dx, 100, t * 3, { flip: true, run: true }); hero(x, b.hx, b.hy, { face: "p" }); } else if (t < 0.8) { const j = Math.sin(t * 60) * 3; puff(P, b.hx + j, b.hy - 12, 12, "#d8d0c8"); puff(P, b.hx - j, b.hy - 18, 8, "#e8e0d8"); stars(P, b.hx, b.hy - 14, t, 4, 14); if (Math.sin(t * 50) > 0) hero(x, b.hx - 14, b.hy - 18, { face: "x", sx: 0.6, sy: 0.6, rot: t * 20 }); if (Math.sin(t * 40) > 0.3) shoe(x, b.hx + 12, b.hy - 20); } else { const k = seg(t, 0.8, 1); dog(x, b.hx - 10 - k * 80, 100, t * 3, { run: true }); shoe(x, b.hx + 6, b.hy - 2); } },
    poke(x, t, b) { const P = pen(x); const k = seg(t, 0, 0.2); const tx = b.hx + 34 - k * 22; P.r(tx, b.hy - 7, 40, 1, "#6a4a2a"); P.r(tx - 3, b.hy - 10, 1, 7, "#c8c8d0"); P.r(tx - 3, b.hy - 7, 4, 1, "#c8c8d0"); if (t < 0.25) { hero(x, b.hx, b.hy, { face: k > 0.8 ? "o" : "w", flip: true }); } else { const q = seg(t, 0.25, 1); const X = b.hx - q * 40, Y = b.hy - q * 90 + q * q * 10; hero(x, X, Y, { face: "o", rot: q * 14, sx: 1 - q * 0.6, sy: 1 - q * 0.6 }); for (let i = 0; i < 4; i++) P.r(X + 4 + i * 3, Y + 4 + i * 3, 1, 3, "#fff"); if (q > 0.8) stars(P, X, Y, t, 4, 4); } if (t > 0.18 && t < 0.4) { txt(P, "!", b.hx - 4, b.hy - 28, "#ffc21a", 2); } },
    soot(x, t, b) { const P = pen(x); if (t < 0.35) { hero(x, b.hx, b.hy, { face: "o" }); const k = seg(t, 0.05, 0.35); for (let i = 0; i < 5; i++) flame(P, b.hx - 10 + i * 5, b.hy, 3 + k * 8, t * 4, i); } else { const k = seg(t, 0.35, 1); hero(x, b.hx, b.hy, { face: "s", pal: "soot" }); if (Math.floor(t * 12) % 4 === 0) P.r(b.hx - 4, b.hy - 15, 8, 2, "#141414"); for (let i = 0; i < 3; i++) puff(P, b.hx + 6 + i * 4, b.hy - 20 - k * 16 - i * 4, 2 + i, "#6a6a74"); if (t > 0.6) { P.r(b.hx + 4, b.hy - 10, 3, 2, "#6a6a74"); } } },
    paper(x, t, b) { const P = pen(x); const k = seg(t, 0, 0.75); const n = Math.floor(k * 22); hero(x, b.hx, b.hy, { face: "o", pose: "up" }); for (let i = 0; i < n; i++) { const px = b.hx - 16 + hash(i, 61) * 32, py = b.hy - 3 - Math.floor(i / 5) * 4 - (i % 5 === 4 ? 0 : 0); P.box(px - 5, py - (i < 8 ? 0 : i * 0.9), 12, 5, "#fff"); P.r(px - 3, py + 2 - (i < 8 ? 0 : i * 0.9), 7, 1, "#9a9aa6"); } for (let i = 0; i < 3; i++) { const fy = ((t * 2 + i / 3) % 1) * 70; P.box(b.hx - 12 + i * 12, fy, 10, 4, "#fff"); } if (t > 0.75) { const w = Math.sin(t * 40) * 2; P.r(b.hx + w, b.hy - 32, 2, 6, "#ffd7b0"); P.r(b.hx - 1 + w, b.hy - 34, 4, 2, "#ffd7b0"); if (t > 0.92) P.r(b.hx - 4, b.hy - 32, 6, 2, "#ffd7b0"); } },
    shrink(x, t, b, d) { const P = pen(x); const k = ease(seg(t, 0, 0.85)); if (t < 0.85) { const fl = Math.sin(t * 50) > 0 || t < 0.4; if (fl) { if (d.baby && k > 0.4) hero(x, b.hx, b.hy, { pose: "baby", sx: 1.4 - (k - 0.4) * 2.4, sy: 1.4 - (k - 0.4) * 2.4 }); else hero(x, b.hx, b.hy, { face: "w", sx: 1 - k * (d.baby ? 0.5 : 0.95), sy: 1 - k * (d.baby ? 0.5 : 0.95), a: d.baby ? 1 : 1 - k * 0.6 }); } } else { const q = seg(t, 0.85, 1); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; P.p(b.hx + Math.cos(a) * q * 8, b.hy - 2 + Math.sin(a) * q * 8, "#ffe07a"); } } if (d.baby) for (let i = 0; i < 3; i++) { const a = -t * 14 + i * 2; P.line(b.hx + 22, b.hy - 30, b.hx + 22 + Math.cos(a) * 6, b.hy - 30 + Math.sin(a) * 6, "#fff"); } },
    freeze(x, t, b) { const P = pen(x); const k = seg(t, 0, 0.4); hero(x, b.hx + seg(t, 0.55, 1) ** 2 * 120, b.hy, { face: "o", pal: k > 0.5 ? "ice" : "n", pose: "up" }); if (k > 0.3) { const X = b.hx + seg(t, 0.55, 1) ** 2 * 120; x.save(); x.globalAlpha = 0.55; P.r(X - 10, b.hy - 22, 20, 23, "#bfe8ff"); x.restore(); P.r(X - 10, b.hy - 22, 20, 1, "#fff"); P.r(X - 10, b.hy - 22, 1, 23, "#fff"); P.r(X + 9, b.hy - 22, 1, 23, "#7fb8e8"); P.r(X - 10, b.hy, 20, 1, "#7fb8e8"); P.r(X - 7, b.hy - 19, 2, 6, "#fff"); if (t > 0.55) for (let i = 0; i < 4; i++) P.r(X - 14 - i * 6, b.hy - 4 + i, 4, 1, "#fff"); } for (let i = 0; i < 6; i++) P.p(b.hx - 14 + hash(i, 71) * 28, b.hy - 30 + ((t * 40 + i * 9) % 30), "#fff"); },
    chase(x, t, b) { const P = pen(x); const k = seg(t, 0, 0.6); const hx = b.hx + k * 100; const dx = -20 + k * 150; hero(x, hx, b.hy - Math.abs(Math.sin(t * 30)) * 3, { face: "p", pose: Math.floor(t * 20) % 2 ? "run" : "idle" }); dog(x, dx, 100, t * 3, { run: true }); for (let i = 0; i < 3; i++) P.r(dx - 20 - i * 6, 90 + i * 3, 4, 1, "#fff"); if (t > 0.6) { const q = seg(t, 0.6, 1); const sx = 150 - q * 70, sy = 40 + (q - 0.5) * (q - 0.5) * 220 - 10; x.save(); x.translate(sx, Math.min(sy, b.hy - 2)); x.rotate(q * 12); x.drawImage(sprite("shoe", SHOE, { ...C, k: "#3a2a20", a: "#ddd" }), -5, -3); x.restore(); if (q > 0.9) stars(P, sx, b.hy - 8, t, 2, 5); } },
    bonk(x, t, b) { const P = pen(x); const wx = 117; const run = seg(t, 0, 0.3); const X = b.hx + run * (wx - 10 - b.hx); P.box(104, 46, 28, 54, "#e8f0ff"); P.e(118, 64, 8, 6, "#9adcff"); P.e(114, 60, 4, 3, "#fff"); if (t < 0.3) hero(x, X, b.hy, { face: "n", pose: Math.floor(t * 20) % 2 ? "run" : "idle" }); else { const s = seg(t, 0.3, 0.75); hero(x, wx - 10, b.hy - 22 + s * 22, { face: "x", sx: 0.5 + s * 0.5, sy: 1.1 }); if (t < 0.36) { txt(P, "!", wx - 2, b.hy - 40, "#ffc21a", 2); } stars(P, wx - 10, b.hy - 26 + s * 18, t, 3, 8); if (t > 0.75) ghost(x, wx - 12, b.hy - 22 - seg(t, 0.75, 1) * 20, 0.9); } },
    blast(x, t, b) { const P = pen(x); const k = seg(t, 0, 0.5); for (let i = 0; i < 4; i++) { const r = (k * 60 + i * 12) % 60; P.ring(96, 62, r, i % 2 ? "#fff" : "#ffc21a", 30); } const q = seg(t, 0.12, 1); hero(x, b.hx - q * 80, b.hy - q * 50 + q * q * 20, { face: "o", rot: -q * 16, sx: 1 - q * 0.5, sy: 1 - q * 0.5 }); for (let i = 0; i < 4; i++) P.r(b.hx - q * 80 + 6, b.hy - q * 50 - 14 + i * 4, 6, 1, "#fff"); txt(P, "!!", 90, 30, "#e5372b", 2); },
    trapdoor(x, t, b) { const P = pen(x); const open = seg(t, 0, 0.12); P.r(b.hx - 10, b.hy, 20, 20, "#000"); P.r(b.hx - 10, b.hy, 20 * (1 - open), 2, "#3a3aa8"); const hang = t < 0.5, drop = seg(t, 0.5, 0.85); if (hang) { hero(x, b.hx, b.hy - (t > 0.12 ? 2 : 0), { face: t > 0.2 ? "o" : "w", pose: t > 0.2 ? "up" : "idle" }); if (t > 0.25) { bubble(P, b.hx + 6, b.hy - 30, 10, 10, "l"); txt(P, "!", b.hx + 9, b.hy - 28, K); } } else if (drop < 1) { x.save(); x.beginPath(); x.rect(0, 0, W, b.hy + 20); x.clip(); hero(x, b.hx, b.hy + drop * drop * 30, { face: "o", pose: "up", sy: 1 + drop }); x.restore(); } if (t > 0.85) { P.r(b.hx - 10, b.hy, 20, 2, "#3a3aa8"); txt(P, "!", b.hx - 2, b.hy - 12, "#ffc21a"); } },
    scroll(x, t, b) { const P = pen(x); const k = seg(t, 0, 0.4); const ex = 130 - k * (130 - b.hx); P.r(ex, b.hy - 2, 130 - ex + 10, 3, "#f2ecd8"); for (let i = 0; i < 6; i++) P.r(ex + 4 + i * 8, b.hy - 1, 4, 1, "#9a9aa6"); if (t < 0.4) { hero(x, b.hx, b.hy, { face: "o" }); P.e(ex, b.hy - 4, 4, 4, "#f2ecd8"); P.ring(ex, b.hy - 4, 4, K, 16); } else { const q = seg(t, 0.4, 1); const X = b.hx + q * q * 110; P.e(X, b.hy - 9, 10, 9, K); P.e(X, b.hy - 9, 9, 8, "#f2ecd8"); for (let i = 0; i < 3; i++) P.ring(X, b.hy - 9, 3 + i * 2, "#c8b890", 20); x.save(); x.beginPath(); x.rect(0, 0, W, b.hy - 15); x.clip(); hero(x, X, b.hy - 8, { face: "x", sx: 0.8, sy: 0.8 }); x.restore(); for (let i = 0; i < 3; i++) P.r(X - 16 - i * 5, b.hy - 6 + i * 2, 4, 1, "#fff"); } },
    glitch(x, t, b) { const P = pen(x); const k = seg(t, 0.1, 1); if (t < 0.1) hero(x, b.hx, b.hy, { face: "o" }); else { const s = heroSprite("o"); const cols = ["#ffd7b0", "#2b2b33", "#f4f4f4", "#2f6fe0", "#3ff0ff", "#ff3fd8"]; for (let j = 0; j < 9; j++) for (let i = 0; i < 7; i++) { const sx = b.hx - 7 + i * 2, sy = b.hy - 17 + j * 2; const a = hash(i, j, 5) * Math.PI * 2, d = k * k * (20 + hash(i, j, 6) * 50); if (hash(i, j, 9) < k * 0.9) continue; P.r(sx + Math.cos(a) * d, sy + Math.sin(a) * d - k * 10, 2, 2, cols[(i + j) % cols.length]); } } for (let i = 0; i < 5; i++) P.r(0, hash(i, Math.floor(t * 20)) * HH, W, 1, i % 2 ? "rgba(63,240,255,0.5)" : "rgba(255,63,216,0.5)"); },
    ceiling(x, t, b) { const P = pen(x); const k = seg(t, 0, 0.3); const Y = b.hy - ease(k) * (b.hy - 26); P.r(0, 0, W, 8, "#3a0a0c"); P.r(0, 8, W, 1, "#ffc21a"); if (t < 0.3) hero(x, b.hx, Y, { face: "o", pose: "up" }); else { x.save(); x.beginPath(); x.rect(0, 9, W, HH); x.clip(); const w = Math.sin(t * 40) * 0.25; hero(x, b.hx, 26 + Math.sin(t * 20), { face: "x", pose: "up", rot: w }); x.restore(); for (let i = 0; i < 4; i++) P.r(b.hx - 12 + i * 8, 9, 3, 2, "#5a2a1a"); stars(P, b.hx, 12, t, 3, 10); } for (let i = 0; i < 5; i++) steam(P, b.hx - 10 + i * 5, b.hy, t + i * 0.2, "#ff9a3a"); },
    skeleton(x, t, b) { const P = pen(x); const k = seg(t, 0, 0.5); P.box(b.hx - 8, b.hy - 8, 16, 3, "#6a4a2a"); P.r(b.hx - 7, b.hy - 5, 2, 5, "#6a4a2a"); P.r(b.hx + 5, b.hy - 5, 2, 5, "#6a4a2a"); if (k < 0.6) hero(x, b.hx, b.hy - 6, { face: k > 0.3 ? "w" : "n", pal: k > 0.3 ? "old" : "n", sy: 0.85 }); else { const bb = "#f2ecd8"; skull(x, b.hx, b.hy - 20); P.r(b.hx - 1, b.hy - 15, 2, 8, bb); for (let i = 0; i < 3; i++) P.r(b.hx - 4, b.hy - 14 + i * 2, 8, 1, bb); P.line(b.hx - 4, b.hy - 13, b.hx - 7, b.hy - 7, bb); P.line(b.hx + 4, b.hy - 13, b.hx + 7, b.hy - 7, bb); P.line(b.hx - 2, b.hy - 7, b.hx - 3, b.hy, bb); P.line(b.hx + 2, b.hy - 7, b.hx + 3, b.hy, bb); if (t > 0.85) P.r(b.hx - 3, b.hy - 12 + (t - 0.85) * 40, 6, 2, bb); } const wb = seg(t, 0.4, 1); if (wb > 0) for (let i = 0; i < 5; i++) { const a = (i / 4) * Math.PI * 0.5; P.line(b.hx, b.hy - 40, b.hx + Math.cos(a) * 18 * wb, b.hy - 40 + Math.sin(a) * 18 * wb, "rgba(255,255,255,0.7)"); } if (wb > 0.5) { P.p(b.hx + 6, b.hy - 32, "#fff"); P.p(b.hx + 9, b.hy - 30, "#fff"); } txt(P, "Z", b.hx + 12, b.hy - 24 - (t * 10 % 6), "#fff"); },
    blush(x, t, b) { const P = pen(x); const k = seg(t, 0, 0.4), q = seg(t, 0.4, 1); if (q < 1) hero(x, b.hx, b.hy - q * 20, { face: "x", pal: k > 0.4 ? "red" : "n", a: 1 - q, sx: 1 + q * 0.4, sy: 1 - q * 0.3 }); for (let i = 0; i < 6; i++) { const s = (t * 2 + i / 6) % 1; if (k > 0.3) P.e(b.hx - 8 + (i % 3) * 8, b.hy - 24 - s * 24, 1 + s * 4 * (0.4 + q), 1 + s * 3 * (0.4 + q), "rgba(240,240,250," + (0.8 - s * 0.6) + ")"); } if (k > 0.2 && q < 0.5) txt(P, "!!", b.hx + 8, b.hy - 30, "#ff3a2a"); },
    splat(x, t, b) { const P = pen(x); const k = seg(t, 0, 0.25); for (let i = 0; i < 8; i++) { const y = 50 + hash(i, 81) * 50, xx = 140 - ((t * 400 + i * 30) % 140); if (t < 0.6) P.r(xx, y, 12, 1, "#e8f0ff"); } const X = b.hx - ease(k) * (b.hx - 12); if (t < 0.25) hero(x, X, b.hy - k * 20, { face: "o", rot: -k, sx: 1 + k * 0.3 }); else { const s = seg(t, 0.5, 1); hero(x, 12, b.hy - 20 + s * 20, { face: "x", sx: 0.25, sy: 1.6 - s * 0.4, pose: "up" }); if (t < 0.4) txt(P, "!", 22, 50, "#ffc21a", 2); stars(P, 14, b.hy - 40 + s * 20, t, 2, 6); } P.r(0, 0, 4, HH, "#3a0a0c"); },
    toss(x, t, b) { const P = pen(x); P.r(96, 100, 60, 20, "#140404"); for (let i = 0; i < 6; i++) flame(P, 100 + i * 10, 104, 5, t * 3, i); if (t < 0.25) { hero(x, b.hx, b.hy, { face: "o" }); if (Math.floor(t * 30) % 2) { P.e(104, 76, 4, 4, "#ff3a2a"); txt(P, "!", 102, 66, "#ff3a2a", 2); } } else { const q = seg(t, 0.25, 0.7); if (q < 1) hero(x, b.hx + q * 66, b.hy - Math.sin(q * Math.PI) * 50 + q * 6, { face: "o", rot: q * 10 }); else { const s = seg(t, 0.7, 1); puff(P, 126, 92 - s * 10, 4 + s * 4, "#6a6a74"); skull(x, 126, 98 + Math.sin(t * 30)); } } },
  };

  // ---------- 승리 연출 ----------
  function win(x, t, b) { const P = pen(x); const j = Math.sin(seg(t, 0, 0.6) * Math.PI) * 14; hero(x, b.hx, b.hy - j, { face: "h", pose: "up" }); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + t * 3, r = 8 + t * 20; P.p(b.hx + Math.cos(a) * r, b.hy - 14 - j + Math.sin(a) * r * 0.7, i % 2 ? "#ffe07a" : "#fff"); } }

  // ---------- 장면 그리기(공개 함수) ----------
  // mode: {kind:"idle"} | {kind:"win", t} | {kind:"death", t}
  function drawStage(x, st, t, mode = { kind: "idle" }) {
    x.imageSmoothingEnabled = false;
    const no = floorOf(st.n), scBg = SCENE_BG[st.scene] || {};
    const happy = mode.kind === "win" && no === 4;
    background(x, no, t, { ...scBg, mood: happy ? "smile" : mode.kind === "death" && no === 4 ? (st.scene === "sneeze" ? "sneeze" : "angry") : scBg.mood, noDancers: st.scene === "dance" });
    const b = SC[st.scene](x, t) || { hx: 60, hy: GY };
    if (b.hy == null) b.hy = GY;
    if (mode.kind === "death") { const d = st.death; (DEATH[d.anim] || DEATH.shrink)(x, clamp(mode.t, 0, 1), b, d); }
    else if (mode.kind === "win") win(x, mode.t, b);
    else {
      const bob = Math.floor(t * 4) % 2;
      if (b.glitch && Math.floor(t * 8) % 5 === 0) { hero(x, b.hx + 2, b.hy, { face: b.face, pal: "red", a: 0.5 }); }
      hero(x, b.hx, b.hy - (b.rot ? -bob : bob), { face: b.face, pose: b.pose, rot: b.rot });
    }
  }
  // 타이틀 그림
  function drawTitle(x, t) {
    x.imageSmoothingEnabled = false;
    background(x, 4, t, { mood: "stern" });
    const P = pen(x);
    for (let i = 0; i < 9; i++) flame(P, 8 + i * 18, 120, 8, t, i);
    devil(x, 30, 100, { t, trident: true });
    devil(x, 132, 100, { t, flip: true, dance: Math.sin(t * 6) > 0 });
    hero(x, 80, 100 - Math.abs(Math.sin(t * 5)) * 3, { face: "p", pose: Math.sin(t * 5) > 0 ? "up" : "idle" });
    skull(x, 56, 108 + Math.sin(t * 3) * 2); skull(x, 104, 110 + Math.sin(t * 3 + 2) * 2);
  }
  // 엔딩(환생 버튼)
  function drawEnding(x, t) {
    x.imageSmoothingEnabled = false;
    background(x, 4, t, { mood: "smile" });
    const P = pen(x);
    const k = clamp(t / 2.5, 0, 1);
    x.save(); x.globalAlpha = 0.35 + 0.15 * Math.sin(t * 6); P.tri(60, 0, 100, 0, 112, 100, "#fff6c0"); P.tri(60, 0, 48, 100, 112, 100, "#fff6c0"); x.restore();
    P.box(124, 86, 16, 14, "#8a8a96"); P.e(132, 84, 6, 3, K); P.e(132, 85 - (t > 0.4 ? 0 : 1), 5, 2, "#3fbf5a");
    const y = 100 - ease(k) * 70;
    hero(x, 80, y, { face: "h", pose: "up" });
    P.ring(80, y - 19, 5, "#ffc21a", 18);
    for (let i = 0; i < 24; i++) { const cx = hash(i, 91) * W, cy = ((t * 30 + hash(i, 92) * 120) % 130) - 10; P.r(cx, cy, 2, 2, ["#ff3fd8", "#3ff0ff", "#ffc21a", "#3fbf5a"][i % 4]); }
  }

  // ---------- 선택 카드 아이콘 (12x12 문자열 그림) ----------
  const IC = {
    tap: ["........KK..", "........KyK.", "........K...", "......KKK...", "......KKK...", "............", "............", "..ww........", "..wwwwww....", ".kkkkkkkk...", ".y..y...y...", "............"],
    run: ["........ss..", "........ss..", "...a.wwww...", "..a..wwwws..", "...a.www....", "..a..bbb....", ".....b..b...", "....b....b..", "...kk....kk."],
    sign: [".....nn.....", ".rrrrnnrrrr.", "rwwwwnnwwwwr", ".rrrrnnrrrr.", ".....nn.....", ".....nn.....", ".....nn.....", ".....nn.....", "....nnnn...."],
    arrow: ["...K........", "..KK........", ".KKKKKKKKK..", "KKKKKKKKKK..", ".KKKKKKKKK..", "..KK........", "...K........"],
    sauce: ["....yyyy....", "....rrrr....", "....rrrr....", "...rrrrrr...", "..rrrrrrrr..", "..rwwwwwwr..", "..rwoyowwr..", "..rwwowwwr..", "..rrrrrrrr..", "..rrrrrrrr..", "...rrrrrr..."],
    water: [".....b......", "....bbb.....", "...bbbbb....", "..bbbcbbb...", "..bbccbbb...", "..bbbbbbb...", "...bbbbb....", "....bbb....."],
    surf: ["....ss......", "....ss......", "..wwwwww....", "....ww......", "...b..b.....", "..b....b....", "yyyyyyyyyy..", ".kkkkkkkkkk.", "..k.....k...", "..k.....k..."],
    seat: ["..kkkkkk....", "..kddddk....", "..kddddk....", "..kddddk....", "..kddddkkkk.", "..kddddddddk", "..kkkkkkkkkk", "...k.....k..", "...k.....k.."],
    talk: ["..wwwwwwww..", ".wwwwwwwwww.", ".wwKwKwKwww.", ".wwwwwwwwww.", "..wwwwwwww..", "...ww.......", "..w........."],
    coin: ["...yyyyy....", "..yyyyyyy...", ".yyykyyyyy..", ".yykkkyyyy..", ".yyykyyyyy..", ".yykkkyyyy..", ".yyykyyyyy..", "..yyyyyyy...", "...yyyyy...."],
    hand: ["..s.s.s.....", "..s.s.s.s...", "..s.s.s.s...", "..sssssss...", "s.sssssss...", "ssssssss....", ".ssssss.....", "..ssss......", "y.......y...", ".y.....y...."],
    duck: [".wwwwwwww...", "wwhhhhhhww..", ".shhhhhhs...", "..ssssss....", ".wwwwwwww...", "wwwwwwwwww..", "kkkkkkkkkk.."],
    receipt: ["..wwwwwww...", "..wkkkkkw...", "..wwwwwww...", "..wkkkwww...", "..wwwwwww...", "..wkkkkkw...", "..wwwwwww...", "..wwwrrrw...", "..wwwrrrw...", "..w.w.w.w..."],
    camera: ["...kkk......", ".kkkkkkkkk..", ".kaaaaaaak..", ".kaakkkaak..", ".kakwwwkak..", ".kakwkwkak..", ".kaakkkaak..", ".kkkkkkkkk.."],
    bone: [".ww......ww.", "wwww....wwww", ".wwwwwwwwww.", ".wwwwwwwwww.", "wwww....wwww", ".ww......ww."],
    zzz: ["......kkkk..", "........k...", ".......k....", "......kkkk..", "..kkk.......", "....k.......", "...k........", "..kkk......."],
    heart: [".rr...rr....", "rrrr.rrrr...", "rrwrrrrrr...", "rrrrrrrrr...", ".rrrrrrr....", "..rrrrr.....", "...rrr......", "....r......."],
    two: ["..kkkkk.....", ".kk...kk....", "......kk....", ".....kk.....", "....kk......", "...kk.......", "..kk........", ".kkkkkkk...."],
    leaf: ["......ggg...", "....ggggg...", "...gggGggg..", "..ggGgggg...", "..gGggggg...", ".gGggggg....", ".Gggggg.....", "G..ggg......"],
    fire: ["....o.......", "...oo.......", "...ooo..o...", "..oooo.oo...", "..ooyooooo..", ".oooyyyooo..", ".ooyyyyyoo..", "..oyyyyyo...", "...ooooo...."],
    gum: ["...pppp.....", "..pppppp....", ".pppwpppp...", ".pppppppp...", "..pppppp....", "...pp.p.....", "...p..p.....", "......p....."],
    book: [".nnnnnnnnn..", ".nwwwwwwwn..", ".nwkkkkkwn..", ".nwwwwwwwn..", ".nwkkkkwwn..", ".nwwwwwwwn..", ".nwkkkkkwn..", ".nnnnnnnnn..", "..wwwwwwww.."],
    paper: ["..wwwwww....", "..wkkkkww...", "..wwwwwwww..", "..wkkkkkkw..", "..wwwwwwww..", "..wkkkkkkw..", "..wwwwwwww..", "..wwwwrrrw..", "..wwwwrrrw.."],
    think: ["...kkkkk....", "..kk...kk...", "......kk....", ".....kk.....", "....kk......", "....kk......", "............", "....kk......"],
    dance: ["....ss.....y", "....ss....y.", ".s.wwww.s...", "..swwwws....", "....ww......", "...b..b.....", "..b....b....", ".kk.....kk..", "y.........y."],
    no: [".rr.....rr..", "..rr...rr...", "...rr.rr....", "....rrr.....", "...rr.rr....", "..rr...rr...", ".rr.....rr.."],
    bath: ["............", "w..w..w.....", ".w..w..w....", "w..w..w.....", "kkkkkkkkkkk.", "kbbbbbbbbbk.", "kbbbbbbbbbk.", ".kbbbbbbbk..", "..k.....k..."],
    snow: [".....c......", "..c..c..c...", "...c.c.c....", ".cccccccc...", "...c.c.c....", "..c..c..c...", ".....c......"],
    feather: [".......www..", "......wwww..", ".....wwww...", "....wwww....", "...wwww.....", "..wwww......", "..kww.......", ".k..........", "k..........."],
    zip: ["..ssssssss..", ".ssssssssss.", ".sskssssks..", ".ssssssssss.", ".skkkkkkkks.", ".ssssssssss.", "..ssssssss.."],
    plane: ["..........w.", "........www.", "......wwwww.", "....wwwwwww.", "..wwwwwaww..", "wwwwwwaww...", "....waww....", "....aww.....", "....ww......"],
    ok: ["..ss........", ".s..s.......", ".s..s..sss..", "..ss..s...s.", "......s.s..", ".......ss...", "ggggggggggg.", ".ggggggggg.."],
    shoe: [".....kk.....", "....kwk.....", "...kkkkk....", "..kkkkkkkk..", ".kkkkkkkkkk.", ".aaaaaaaaaa.", "....s.......", "...sss......", "...sss......"],
    foot: ["...ssss.....", "..ssssss....", "..ssssss....", "..sssss.....", "..ssss......", ".sssss......", ".ssssss.....", "..ssssss....", "...s.s.s.s.."],
    flip: ["...kk..kk...", "...bb..bb...", "...bb..bb...", "...wwwwww...", "..wwwwwwww..", ".s.wwwwww.s.", ".s.ssssss.s.", "...ssssss...", "...hhhhhh..."],
    grab: ["............", "..s.s.s.s...", "..s.s.s.s...", "..sssssss...", "..sssssss...", "...sssss....", "aaaaaaaaaaaa", "dddddddddddd"],
    shake: ["v..mmmmmm..v", ".v.mccccm.v.", "v..mccccm..v", ".v.mccccm.v.", "v..mmmmmm..v", "...mrrrrm...", "...mmmmmm..."],
    button: ["............", "...rrrrrr...", "..rrwwrrrr..", "..rrrrrrrr..", "..rrrrrrrr..", "...rrrrrr...", ".aaaaaaaaaa.", ".dddddddddd."],
    doorD: ["k..........k", "kk.rrrrrr.kk", "..rRRRRRRr..", "..rRRRRRRr..", "..rRRRRyRr..", "..rRRRRRRr..", "..rRRRRRRr..", "..rRRRRRRr.."],
    doorH: ["...yyyyyy...", "..y......y..", "...wwwwww...", "...wcccw w..", "...wccccw...", "...wcccyw...", "...wccccw...", "...wccccw..."],
    duckq: ["....yyy.....", "...yyyyy....", "...ykyyy....", "ooyyyyyy....", "..yyyyyyyyy.", "..yyyyyyyyy.", "...yyyyyyy..", "....yyyyy..."],
    what: ["..kkkkk.....", ".kk...kk....", "......kk....", ".....kk.....", "....kk......", "....kk......", "............", "....kk......"],
    wrench: ["........aa..", ".......a..a.", ".......a....", "......aaaaa.", ".....aa.....", "....aa......", "...aa.......", "..aa........", ".aa........."],
    calendar: [".k..k..k..k.", "rrrrrrrrrrrr", "rwwwwwwwwwwr", "rwkwkwkwkwwr", "rwwwwwwwwwwr", "rwkwkwrrkwwr", "rwwwwwrrwwwr", "rrrrrrrrrrrr"],
    tear: ["wwwww.wwwww.", "wkkkw.wkkkw.", "wwwwww.wwww.", "wkkkw.wkkkw.", "wwwww.wwwww.", "wkkww.wkkww.", "wwwwww.wwww."],
    pen: ["..........kk", ".........kyk", "........kyk.", ".......kyk..", "......kyk...", ".....kyk....", "....kkk.....", "...kk.......", "..k........."],
    bug: ["..k....k....", "...k..k.....", "...gggg.....", "k.gGggGg.k..", ".kggggggk...", "k.gggggg.k..", "..gggggg....", "k..gggg..k.."],
    refresh: ["....bbbb....", "..bb....b.b.", ".b.......bb.", ".b......bbb.", ".b..........", ".b.......b..", "..bb...bb...", "....bbb....."],
    shoe2: ["...kk.......", "..kkkkk.....", ".kkkkkkkk...", ".aaaaaaaa...", "...nn.......", "..nnnnn.....", ".nnnnnnnn...", ".aaaaaaaa..."],
    crown: ["y...y...y...", "yy.yyy.yy...", "yyyyyyyyy...", "yyryyyryy...", "yyyyyyyyy...", "yyyyyyyyy..."],
    clock: ["...kkkkk....", "..kwwwwwk...", ".kwwwkwwwk..", ".kwwwkwwwk..", ".kwwwkkkwk..", ".kwwwwwwwk..", "..kwwwwwk...", "...kkkkk...."],
    thumb: ["....ss......", "....ss......", "...sss......", "..ssssss....", "bbsssssss...", "bbsssssss...", "bbssssss....", "bbsssss....."],
    tissue: ["....w.......", "...www......", "....w.......", "..cccccccc..", ".cccccccccc.", ".cwwwwwwwwc.", ".cccccccccc."],
    scissors: ["kk.....kk...", "k.k...k.k...", ".kk...kk....", "...a.a......", "....a.......", "...a.a......", "..a...a.....", ".a.....a...."],
    sparkle: [".....y......", ".....y......", "....yyy.....", "yyyyywyyyyy.", "....yyy.....", ".....y...y..", ".....y..yyy.", ".........y.."],
    halo: ["...yyyyyy...", "..y......y..", "...yyyyyy...", "....ssss....", "...ssssss...", "...sksksk...", "...ssssss...", "....ssss...."],
  };
  function icon(key) {
    const rows = IC[key] || IC.what;
    const pal = { ...C, K: K, k: K };
    const s = sprite("ic:" + key, rows.map((r) => r.padEnd(12, ".")), pal);
    return s;
  }

  // ---------- 사망 카드 미리보기(도감·공유용): 사망 장면 마지막 프레임 ----------
  function deathThumb(st, w = W, h = HH) {
    const c = cv(W, HH), x = c.getContext("2d");
    drawStage(x, st, 1.3, { kind: "death", t: 0.97 });
    if (w === W) return c;
    const o = cv(w, h), ox = o.getContext("2d"); ox.imageSmoothingEnabled = false; ox.drawImage(c, 0, 0, w, h); return o;
  }

  H.art = { W, H: HH, drawStage, drawTitle, drawEnding, icon, deathThumb, floorOf, background, hasScene: (k) => !!SC[k], hasAnim: (k) => !!DEATH[k], hasIcon: (k) => !!IC[k] };
})();
