// 1분 인생 도트 엔진 — 이미지 파일 없이 96x60 캔버스에 코드로 직접 그립니다(외부 에셋 0).
// 사람: 12x20(남/여/중립 × 아기·어린이·학생·어른·노인 × 서기·걷기·행동 2프레임), 배경 12종 × 낮·노을·밤.
(function () {
  const W = 96, H = 60;
  const OUT = "#2a1a14";
  const NALGI = (window.NALGI = window.NALGI || {});

  // ---------- 기본 붓 ----------
  const R = (x, c, X, Y, w = 1, h = 1) => { x.fillStyle = c; x.fillRect(Math.floor(X), Math.floor(Y), w, h); };
  const rng = (s) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const mix = (a, b, t) => {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const A = p(a), B = p(b);
    return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
  };
  const dark = (c, t = 0.25) => mix(c, "#1a1020", t);
  const light = (c, t = 0.3) => mix(c, "#ffffff", t);

  // 문자 지도 그리기 (팔레트 글자 → 색)
  const PAL = {
    k: OUT, w: "#ffffff", W: "#dfe3e8", r: "#e5372b", R: "#b8261c", y: "#ffc21a", Y: "#d99a00", b: "#2346d8", B: "#16308f",
    g: "#1e9e5a", G: "#13703f", l: "#7fd06b", c: "#9fd3ff", C: "#5aa6e0", n: "#a0683a", N: "#6b4226", p: "#f4a6b8", P: "#e57a98",
    o: "#ff8a3d", O: "#c95f1c", s: "#f7cfa6", a: "#a3a9b1", A: "#636973", d: "#3a3f47", m: "#c8f0e0", v: "#8a5cc8", t: "#f2d79e",
  };
  function spr(x, map, X, Y, flip = false) {
    const w = Math.max(...map.map((r) => r.length));
    map.forEach((row, j) => [...row].forEach((ch, i) => {
      const c = PAL[ch];
      if (c) R(x, c, X + (flip ? w - 1 - i : i), Y + j);
    }));
  }
  // 3x5 픽셀 글꼴 (간판용)
  const FONT = { G: "111100101101111", A: "010101111101101", T: "111010010010010", E: "111100110100111", 0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001111001111", 4: "101101111001001", 5: "111100111001111", 6: "111100111101111", 7: "111001010010010", 8: "111101111101111", 9: "111101111001111", ":": "000010000010000" };
  function text(x, s, X, Y, c) { [...s].forEach((ch, k) => { const g = FONT[ch]; if (g) [...g].forEach((v, i) => v === "1" && R(x, c, X + k * 4 + (i % 3), Y + Math.floor(i / 3))); }); }

  // ---------- 하늘 ----------
  const SKY = {
    day: ["#58b4f2", "#71c1f6", "#8fcff9", "#b0ddfb", "#d3edfd"],
    sunset: ["#3b3876", "#74468a", "#c2557c", "#ee735c", "#ff9f58", "#ffcf86"],
    night: ["#0a0e28", "#0f1636", "#151e46", "#1c2856", "#253366"],
  };
  function sky(x, tod, X, Y, w, h, seed = 7, deco = true) {
    const bands = SKY[tod], n = bands.length;
    for (let i = 0; i < n; i++) {
      const y0 = Y + Math.floor((h * i) / n), y1 = Y + Math.floor((h * (i + 1)) / n);
      R(x, bands[i], X, y0, w, y1 - y0);
      if (i) for (let k = X + (i % 2); k < X + w; k += 2) R(x, bands[i - 1], k, y0);
    }
    if (!deco) return;
    const r = rng(seed);
    if (tod === "night") for (let i = 0; i < (w * h) / 45; i++) R(x, r() < 0.25 ? "#fff3b0" : "#ffffff", X + r() * w, Y + r() * h * 0.75);
    if (tod === "day") for (let i = 0; i < Math.max(1, w / 40); i++) cloud(x, X + 2 + r() * (w - 18), Y + 2 + r() * h * 0.3, "#ffffff");
    if (tod === "sunset") for (let i = 0; i < Math.max(1, w / 50); i++) cloud(x, X + 2 + r() * (w - 18), Y + 4 + r() * h * 0.35, "#ffb38a");
  }
  function cloud(x, X, Y, c) { R(x, c, X + 4, Y, 5, 1); R(x, c, X + 2, Y + 1, 10, 1); R(x, c, X, Y + 2, 15, 2); R(x, dark(c, 0.08), X + 1, Y + 3, 13, 1); }
  function sun(x, tod, X, Y) {
    if (tod === "night") { // 초승달
      const m = "#fff3c4"; R(x, m, X + 1, Y, 3, 1); R(x, m, X, Y + 1, 2, 3); R(x, m, X + 1, Y + 4, 3, 1); R(x, m, X + 2, Y + 1, 1, 1); R(x, m, X + 2, Y + 3, 1, 1);
      return;
    }
    const c = tod === "sunset" ? "#ff6a3d" : "#ffd23a", e = tod === "sunset" ? "#ffb070" : "#fff0a0";
    R(x, c, X + 1, Y, 4, 1); R(x, c, X, Y + 1, 6, 4); R(x, c, X + 1, Y + 5, 4, 1); R(x, e, X + 1, Y + 1, 2, 1);
  }
  // 둥근 덤불·나무 머리 (밝은 윗면, 어두운 아랫면)
  function blob(x, cx, cy, rx, ry, c, hi, sh) {
    for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
      const v = (i * i) / (rx * rx) + (j * j) / (ry * ry);
      if (v > 1) continue;
      let col = c;
      if (sh && j > ry * 0.35 && v > 0.3) col = sh;
      if (hi && i < 0 && j < 0 && v > 0.2 && v < 0.75 && (i + j) % 2 === 0) col = hi;
      R(x, col, cx + i, cy + j);
    }
  }
  function windowGrid(x, X, Y, cols, rows, gw, gh, gx, gy, glass, frame, lit, r) {
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const px = X + i * gx, py = Y + j * gy;
      R(x, frame, px - 1, py - 1, gw + 2, gh + 2);
      R(x, glass, px, py, gw, gh);
      R(x, light(glass, 0.5), px, py, 1, 1);
      if (r() < 0.55) lit(px, py, gw, gh);
    }
  }

  // ---------- 배경 12종 ----------
  // draw(x, tod, o, lit) → 바닥(발) y.  lit(X,Y,w,h,c): 밤에 켜지는 불빛(c 없으면 원래 색 유지).  o.view: 집 창밖 풍경
  const BG = {
    // 학교 정문: 벽돌 기둥 + 세로 학교 간판 + 미닫이 철문 + 벚나무, 뒤로 시계탑 본관 (국기봉 없음)
    gate(x, tod, o, lit) {
      sky(x, tod, 0, 0, W, 42, 11);
      sun(x, tod, 82, 4);
      const r = rng(5);
      R(x, "#b9a98a", 14, 15, 68, 2); R(x, "#efe4c8", 14, 17, 68, 25); R(x, "#ddd0b0", 14, 40, 68, 2);
      R(x, "#b9a98a", 40, 5, 16, 2); R(x, "#efe4c8", 41, 7, 14, 10);
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (i * i + j * j <= 5) R(x, "#ffffff", 48 + i, 11 + j);
      R(x, OUT, 48, 9, 1, 3); R(x, OUT, 48, 11, 2, 1);
      windowGrid(x, 17, 20, 9, 3, 5, 4, 7, 6, "#8ec9ee", "#a89676", (X, Y, w, h) => lit(X, Y, w, h, "#ffe28a"), r);
      R(x, "#5a6a80", 44, 34, 8, 8); R(x, "#7d8ea8", 45, 35, 3, 7); R(x, "#7d8ea8", 49, 35, 2, 7);
      // 운동장 흙 + 보도
      R(x, "#dcc49a", 0, 42, W, 10); for (let i = 0; i < 40; i++) R(x, "#cdb487", r() * W, 42 + r() * 10);
      R(x, "#bdb6aa", 0, 52, W, 8); for (let i = 0; i < W; i += 6) R(x, "#a8a194", i, 52, 1, 8); R(x, "#a8a194", 0, 55, W, 1); R(x, "#8e877b", 0, 52, W, 1);
      // 벚나무
      [[6, 26], [90, 28]].forEach(([cx, cy]) => { R(x, "#7a4e2c", cx - 1, cy + 4, 3, 14); blob(x, cx, cy, 9, 7, "#f39ab3", "#ffd7e2", "#d9789a"); });
      // 담장 + 생울타리
      [[0, 15], [81, 15]].forEach(([X, w]) => { R(x, "#c9b9a0", X, 41, w, 11); for (let j = 43; j < 52; j += 3) for (let i = X + ((j / 3) % 2) * 2; i < X + w; i += 4) R(x, "#b3a286", i, j, 3, 1); R(x, "#4f9a50", X, 39, w, 3); for (let i = X; i < X + w; i += 3) R(x, "#3e8240", i, 41, 2, 1); });
      // 미닫이 철문 (오른쪽에서 반쯤 닫힘)
      R(x, "#3f4a58", 58, 40, 15, 1); R(x, "#3f4a58", 58, 51, 15, 1); for (let i = 58; i < 73; i += 2) R(x, "#56637a", i, 41, 1, 10); R(x, "#ffc21a", 58, 45, 15, 1); R(x, OUT, 60, 52, 2, 1); R(x, OUT, 69, 52, 2, 1);
      R(x, "#8e877b", 24, 53, 49, 1);
      // 벽돌 기둥 2개 + 갓돌
      [[15, 1], [72, 0]].forEach(([X, sign]) => {
        R(x, "#a8553a", X, 23, 10, 33); for (let j = 24; j < 56; j += 3) { R(x, "#8e432c", X, j, 10, 1); for (let i = X + ((j / 3) % 2 ? 1 : 3); i < X + 10; i += 4) R(x, "#8e432c", i, j - 2, 1, 2); }
        R(x, "#c4683f", X, 23, 1, 33); R(x, "#7a3a26", X + 9, 23, 1, 33);
        R(x, "#d9d2c4", X - 1, 20, 12, 3); R(x, "#b9b1a2", X - 1, 22, 12, 1); R(x, "#efe9dd", X - 1, 20, 12, 1);
        if (sign) { // 세로 학교 이름 간판
          R(x, OUT, X + 2, 26, 6, 24); R(x, "#f4f0e4", X + 3, 27, 4, 22);
          for (let k = 0; k < 5; k++) { const y = 28 + k * 4; R(x, "#2a2a2a", X + 3, y, 4, 1); R(x, "#2a2a2a", X + 4, y + 1, 1, 2); R(x, "#2a2a2a", X + 6, y + 1, 1, 1); }
        } else { // 문패 + 문등
          R(x, OUT, X + 2, 30, 6, 5); R(x, "#e8dfc8", X + 3, 31, 4, 3); R(x, "#6b4226", X + 4, 32, 2, 1);
          R(x, OUT, X + 3, 17, 4, 3); R(x, "#fff3b0", X + 4, 18, 2, 1); lit(X + 4, 18, 2, 1, "#ffe070");
        }
      });
      return 56;
    },
    // 교실: 칠판(분필 글씨·날짜 칸) + 급훈 액자 + 시계 + 창문 + 게시판 + 교탁 + 책상
    class(x, tod, o, lit) {
      R(x, "#f3ead6", 0, 0, W, 44); R(x, "#ddd0b4", 0, 0, W, 1);
      R(x, "#c9a273", 0, 38, W, 6); R(x, "#9c7148", 0, 38, W, 1);
      R(x, "#e8e8e8", 67, 5, 28, 31); sky(x, tod, 68, 6, 26, 29, 3); R(x, "#e8e8e8", 80, 6, 2, 29); R(x, "#e8e8e8", 68, 20, 26, 1); R(x, "#c5c5c5", 67, 35, 28, 1);
      for (const X of [65, 93]) { R(x, "#f6e3a6", X, 4, 3, 33); R(x, "#e2c97e", X + 1, 4, 1, 33); }
      // 칠판
      R(x, "#7a4e2c", 11, 9, 54, 25); R(x, "#2f6650", 12, 10, 52, 22);
      const r = rng(9); for (let i = 0; i < 50; i++) R(x, "#386f59", 12 + r() * 52, 10 + r() * 22);
      R(x, "#e9efe9", 15, 13, 14, 1); R(x, "#e9efe9", 15, 16, 8, 1); R(x, "#e9efe9", 25, 16, 10, 1); R(x, "#e9efe9", 15, 19, 11, 1);
      R(x, "#ffe27a", 38, 14, 1, 5); R(x, "#ffe27a", 36, 16, 5, 1); R(x, "#ffe27a", 37, 15, 3, 3);
      R(x, "#f4a6b8", 15, 24, 5, 1); R(x, "#e9efe9", 22, 24, 12, 1); R(x, "#e9efe9", 15, 27, 18, 1);
      R(x, "#9fbfb0", 56, 11, 1, 20); for (let j = 13; j < 30; j += 3) R(x, "#e9efe9", 58, j, 4, 1);
      R(x, "#9c7148", 11, 33, 54, 2); R(x, "#ffffff", 18, 33, 3, 1); R(x, "#ffe27a", 23, 33, 2, 1); R(x, "#f4a6b8", 27, 33, 2, 1); R(x, "#3a3f47", 44, 32, 5, 2); R(x, "#c9c9c9", 44, 33, 5, 1);
      // 급훈 액자 + 시계
      R(x, "#7a4e2c", 28, 2, 18, 6); R(x, "#fffaf0", 29, 3, 16, 4); for (let k = 0; k < 4; k++) R(x, "#3a3a3a", 31 + k * 4, 4, 2, 2);
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const v = i * i + j * j; if (v <= 10) R(x, v > 5 ? OUT : "#ffffff", 54 + i, 5 + j); }
      R(x, OUT, 54, 3, 1, 3); R(x, OUT, 55, 5, 1, 1);
      // 게시판
      R(x, "#8a5a3a", 1, 10, 9, 22); R(x, "#c99a5a", 2, 11, 7, 20); [["#ffffff", 3, 12], ["#ffc21a", 5, 18], ["#9fd3ff", 3, 24], ["#f4a6b8", 5, 27]].forEach(([c, X, Y]) => { R(x, c, X, Y, 3, 4); R(x, "#e5372b", X + 1, Y, 1, 1); });
      // 바닥
      R(x, "#c9955c", 0, 44, W, 16); for (let j = 47; j < 60; j += 4) { R(x, "#b07d48", 0, j, W, 1); for (let i = (j % 8) * 3; i < W; i += 24) R(x, "#b07d48", i, j - 3, 1, 3); }
      // 교탁
      R(x, "#8a5a3a", 32, 38, 18, 2); R(x, "#a8733f", 33, 40, 16, 10); R(x, "#8a5a3a", 33, 44, 16, 1); R(x, "#6b4226", 33, 49, 16, 1);
      // 책상 (양옆)
      for (const X of [2, 74]) for (const dx of [0, 11]) { R(x, "#e2bf86", X + dx, 46, 9, 2); R(x, "#b8925c", X + dx, 48, 9, 1); R(x, "#7a7f88", X + dx + 1, 49, 1, 7); R(x, "#7a7f88", X + dx + 7, 49, 1, 7); R(x, "#5f6a7a", X + dx + 2, 50, 5, 2); }
      return 56;
    },
    // 운동장: 붉은 트랙과 흰 레인 + 철봉 + 축구 골대 + 멀리 학교
    field(x, tod, o, lit) {
      sky(x, tod, 0, 0, W, 32, 21);
      sun(x, tod, 70, 5);
      R(x, "#b9a98a", 2, 14, 34, 2); R(x, "#efe4c8", 2, 16, 34, 14);
      windowGrid(x, 4, 18, 5, 2, 4, 3, 6, 5, "#8ec9ee", "#a89676", (X, Y, w, h) => lit(X, Y, w, h, "#ffe28a"), rng(4));
      for (let i = 36; i < W + 6; i += 9) blob(x, i, 26, 6, 5, "#3e8a4a", "#5aa85a", "#2f6f3c");
      for (let i = 0; i < W; i += 2) R(x, "#4a6f58", i, 29, 1, 3); R(x, "#4a6f58", 0, 29, W, 1);
      R(x, "#dcb87e", 0, 32, W, 28);
      const r = rng(8); for (let i = 0; i < 90; i++) R(x, r() < 0.5 ? "#cfa96c" : "#e6c690", r() * W, 32 + r() * 28);
      const cx = 52, cy = 47;
      for (let y = 32; y < 60; y++) for (let X = 0; X < W; X++) {
        const vo = ((X - cx) / 60) ** 2 + ((y - cy) / 14) ** 2, vi = ((X - cx) / 38) ** 2 + ((y - cy) / 6) ** 2;
        if (vo <= 1 && vi > 1) R(x, (X * 3 + y * 5) % 11 ? "#c2553b" : "#ad4630", X, y);
      }
      for (const [rx, ry] of [[38, 6], [49, 10], [60, 14]]) for (let a = 0; a < 6.283; a += 0.008) R(x, "#f6f1e6", cx + rx * Math.cos(a), cy + ry * Math.sin(a));
      R(x, "#f6f1e6", 50, 53, 1, 7); R(x, "#f6f1e6", 52, 53, 1, 7); // 출발선
      // 축구 골대
      R(x, "#ffffff", 78, 33, 16, 1); R(x, "#ffffff", 78, 33, 1, 10); R(x, "#ffffff", 93, 33, 1, 10);
      for (let j = 34; j < 43; j++) for (let i = 79 + (j % 2); i < 93; i += 2) R(x, "#e9e9e9", i, j);
      // 철봉 (높이 다른 3단)
      [[3, 40], [9, 43], [15, 46]].forEach(([X, Y]) => { R(x, "#8a8f99", X, Y, 1, 57 - Y); R(x, "#8a8f99", X + 6, Y, 1, 57 - Y); R(x, "#d6dae2", X, Y, 7, 1); R(x, "#5f646c", X, 56, 1, 1); });
      return 57;
    },
    // 회사: 통창 너머 도시 + 파티션 + 모니터 책상 + 정수기 + 화분
    office(x, tod, o, lit) {
      R(x, "#e3e7ee", 0, 0, W, 45);
      R(x, "#b8c0cc", 2, 2, 92, 27); sky(x, tod, 3, 3, 90, 25, 13);
      const city = tod === "night" ? "#1d2440" : tod === "sunset" ? "#6a5a7a" : "#9fb0c8";
      const r = rng(17);
      for (let X = 3; X < 93;) { const w = 5 + Math.floor(r() * 7), h = 6 + Math.floor(r() * 14); R(x, city, X, 28 - h, Math.min(w, 93 - X), h); for (let j = 28 - h + 2; j < 27; j += 3) for (let i = X + 1; i < Math.min(X + w, 93) - 1; i += 2) { R(x, dark(city, 0.15), i, j); if (r() < 0.5) lit(i, j, 1, 1, "#ffe28a"); } X += w + 1; }
      for (let X = 2; X < 96; X += 23) R(x, "#b8c0cc", X, 2, 2, 27);
      // 파티션
      R(x, "#8e9ab0", 0, 31, W, 14); R(x, "#6f7b92", 0, 31, W, 2); for (let X = 0; X < W; X += 24) R(x, "#7c88a0", X, 33, 1, 12);
      // 바닥
      R(x, "#8f97a6", 0, 45, W, 15); for (let j = 46; j < 60; j += 2) for (let i = j % 4; i < W; i += 4) R(x, "#858d9c", i, j);
      // 책상 + 모니터 (좌·우)
      [[3, 26], [66, 27]].forEach(([X, w], k) => {
        R(x, "#d9c4a0", X, 44, w, 2); R(x, "#b8a07a", X, 46, w, 1); R(x, "#5f646c", X + 1, 47, 1, 8); R(x, "#5f646c", X + w - 2, 47, 1, 8);
        R(x, "#2b2b2b", X + 6, 33, 13, 10); R(x, "#5aa0e0", X + 7, 34, 11, 8); R(x, "#ffffff", X + 8, 35, 6, 1); R(x, "#ffe27a", X + 8, 37, 4, 1); R(x, "#ffffff", X + 8, 39, 7, 1);
        lit(X + 7, 34, 11, 8, null); R(x, "#2b2b2b", X + 11, 43, 3, 1); R(x, "#3a3f47", X + 4, 43, 9, 1);
        if (k) { R(x, "#e5372b", X + 22, 41, 3, 3); R(x, "#ffffff", X + 23, 41, 1, 1); } else { R(x, OUT, X + 22, 36, 1, 7); R(x, OUT, X + 20, 35, 4, 2); R(x, "#ffc21a", X + 20, 37, 3, 1); }
      });
      // 정수기
      R(x, "#8ec9ee", 33, 32, 6, 8); R(x, "#b8e0fa", 34, 33, 2, 6); R(x, "#5aa6e0", 33, 39, 6, 1);
      R(x, "#f4f6f8", 32, 40, 8, 15); R(x, "#c8ced6", 32, 54, 8, 1); R(x, "#e5372b", 34, 44, 1, 2); R(x, "#2346d8", 37, 44, 1, 2); R(x, "#c8ced6", 33, 48, 6, 1);
      // 화분
      blob(x, 59, 41, 5, 6, "#1e9e5a", "#7fd06b", "#13703f"); R(x, "#c06a3a", 56, 47, 7, 8); R(x, "#a0552c", 56, 47, 7, 1);
      return 56;
    },
    // 결혼식장: 꽃 아치 + 샹들리에 + 버진로드 + 리본 의자
    wedding(x, tod, o, lit) {
      R(x, "#f8e6e0", 0, 0, W, 46);
      for (const X of [3, 87]) { R(x, "#fff4ef", X, 0, 6, 46); R(x, "#ead2ca", X + 5, 0, 1, 46); R(x, "#ead2ca", X - 1, 6, 8, 1); }
      R(x, "#ffffff", 33, 24, 30, 22); for (let i = 34; i < 62; i += 3) R(x, "#f6dfe4", i, 24, 1, 22);
      // 샹들리에
      R(x, "#c9a24a", 47, 0, 2, 3); R(x, "#e8b84a", 40, 3, 16, 1); R(x, "#e8b84a", 42, 6, 12, 1);
      for (const X of [40, 44, 48, 52, 55]) { R(x, "#fff6c8", X, 1, 1, 2); lit(X, 1, 1, 2, "#fff6a0"); }
      for (let i = 41; i < 56; i += 2) R(x, "#ffffff", i, 4 + (i % 4 ? 1 : 2), 1, 1);
      // 단상
      R(x, "#f2d7cf", 24, 44, 48, 4); R(x, "#e2c0b6", 24, 47, 48, 1);
      // 꽃 아치
      const fl = ["#f4a6b8", "#ffffff", "#e5577a", "#ffffff", "#ffc9a8"];
      const put = (X, Y, k) => { R(x, "#3f9a5a", X - 2, Y + 1, 1, 1); R(x, "#3f9a5a", X + 2, Y - 1, 1, 1); const c = fl[k % 5]; R(x, c, X, Y - 1, 2, 1); R(x, c, X - 1, Y, 4, 1); R(x, c, X, Y + 1, 2, 1); R(x, "#ffe27a", X, Y, 1, 1); };
      for (let k = 0, a = 0; a <= Math.PI + 0.01; a += Math.PI / 22, k++) { put(48 + Math.round(17 * Math.cos(a)), 42 - Math.round(18 * Math.sin(a)), k); put(48 + Math.round(15 * Math.cos(a + 0.07)), 42 - Math.round(16 * Math.sin(a + 0.07)), k + 2); }
      for (let y = 45, k = 0; y < 56; y += 3, k++) { put(31, y, k + 1); put(65, y, k + 2); }
      // 바닥 + 버진로드
      R(x, "#e9c9b6", 0, 48, W, 12);
      for (let y = 48; y < 60; y++) { const h = 7 + Math.floor((y - 48) * 0.9); R(x, "#ffffff", 48 - h, y, h * 2, 1); R(x, "#f0d8de", 48 - h, y, 1, 1); R(x, "#f0d8de", 48 + h - 1, y, 1, 1); }
      const r = rng(31); for (let i = 0; i < 14; i++) R(x, "#f4a6b8", 40 + r() * 16, 49 + r() * 11);
      // 의자 (리본)
      for (const X of [1, 71]) for (let k = 0; k < 3; k++) { const cx = X + k * 8; R(x, "#ffffff", cx, 45, 6, 6); R(x, "#e6e6e6", cx, 50, 6, 1); R(x, "#ffffff", cx, 51, 6, 2); R(x, "#c8c8c8", cx, 53, 1, 4); R(x, "#c8c8c8", cx + 5, 53, 1, 4); }
      for (const X of [21, 71]) { R(x, "#e5577a", X, 46, 4, 1); R(x, "#e5577a", X + 1, 47, 2, 2); }
      // 꽃 스탠드
      for (const X of [27, 69]) { R(x, "#e6e6e6", X, 40, 1, 8); R(x, "#e6e6e6", X - 1, 47, 3, 1); blob(x, X, 37, 3, 3, "#f4a6b8", "#ffffff", "#e5577a"); }
      return 57;
    },
    // 병원: 커튼 + 침대 + 링거 + 심전도 모니터 + 블라인드 창 (적십자 표시 없음)
    hosp(x, tod, o, lit) {
      R(x, "#e2f2ee", 0, 0, W, 44); R(x, "#b5ddd2", 0, 36, W, 8); R(x, "#8cc9b9", 0, 36, W, 1);
      R(x, "#e8e8e8", 63, 5, 30, 23); sky(x, tod, 64, 6, 28, 21, 23); for (let j = 6; j < 15; j += 2) R(x, "#f4f4f4", 64, j, 28, 1); R(x, "#c8c8c8", 64, 15, 28, 1); R(x, "#c8c8c8", 77, 6, 1, 21);
      R(x, "#b0b8b8", 0, 2, 30, 1);
      for (let i = 0; i < 17; i++) R(x, i % 3 === 0 ? "#86bfe0" : i % 3 === 1 ? "#a8d4ee" : "#9ccbe8", i, 3, 1, 41);
      R(x, "#7ab0d0", 0, 43, 17, 1);
      R(x, "#eef1f1", 0, 44, W, 16); for (let j = 44; j < 60; j += 5) R(x, "#d5dada", 0, j, W, 1); for (let i = 3; i < W; i += 8) R(x, "#d5dada", i, 44, 1, 16);
      // 침대
      R(x, "#c8ced6", 19, 30, 4, 18); R(x, "#a3a9b1", 19, 30, 4, 1);
      R(x, "#9aa3ad", 21, 44, 38, 3); R(x, "#ffffff", 22, 40, 36, 4);
      R(x, "#ffffff", 23, 36, 9, 4); R(x, "#d6dde4", 23, 39, 9, 1);
      R(x, "#a6d4f0", 31, 38, 27, 5); R(x, "#86bfe0", 31, 38, 27, 1); R(x, "#86bfe0", 38, 40, 1, 3); R(x, "#86bfe0", 47, 39, 1, 4);
      R(x, "#c8ced6", 34, 35, 23, 1); R(x, "#c8ced6", 34, 35, 1, 5); R(x, "#c8ced6", 56, 35, 1, 5);
      for (const X of [23, 55]) { R(x, "#9aa3ad", X, 47, 1, 4); R(x, OUT, X - 1, 51, 3, 2); }
      // 링거
      R(x, "#b8bec6", 62, 14, 1, 41); R(x, "#b8bec6", 59, 55, 7, 1); R(x, "#b8bec6", 60, 14, 5, 1);
      R(x, "#9ab0c0", 60, 15, 5, 7); R(x, "#e6f4ff", 61, 16, 3, 5); R(x, "#bfe0ff", 61, 19, 3, 2);
      for (let k = 0; k < 8; k++) R(x, "#d0d6dc", 61 - k, 22 + k * 2, 1, 2);
      // 심전도 모니터
      R(x, "#3a3f47", 70, 30, 20, 12); R(x, "#0f1f18", 71, 31, 18, 9); R(x, "#5f646c", 79, 42, 2, 13); R(x, "#5f646c", 76, 55, 8, 1);
      [0, 0, 0, 0, -1, 0, 0, 2, -5, 3, 0, 0, 0, -1, 0].forEach((d, i) => { R(x, "#4af07a", 71 + i, 36 + Math.min(d, 0), 1, Math.abs(d) || 1); });
      R(x, "#ffc21a", 86, 32, 2, 1); R(x, "#4af07a", 86, 34, 2, 1);
      lit(71, 31, 18, 9, null);
      return 56;
    },
    // 집 거실: 소파 + 가족사진 액자 + 스탠드 + 창(태어난 곳 풍경) + 러그 + 화분
    home(x, tod, o, lit) {
      R(x, "#f5e6c6", 0, 0, W, 44); for (let j = 3; j < 42; j += 6) for (let i = (j % 12 === 3 ? 3 : 0); i < W; i += 6) R(x, "#ead6ac", i, j);
      R(x, "#e0cca4", 0, 0, W, 1); R(x, "#b98a5a", 0, 42, W, 2);
      // 창 + 풍경
      R(x, "#ffffff", 59, 6, 33, 26); sky(x, tod, 60, 7, 31, 24, 41);
      const view = o.view || "city", vy = 7, r = rng(43);
      if (view === "sea") { R(x, "#3f8fd8", 60, vy + 15, 31, 9); for (let i = 61; i < 90; i += 5) R(x, "#b8e0fa", i + (i % 2), vy + 17 + (i % 3) * 2, 3, 1); R(x, "#4a7a6a", 78, vy + 13, 9, 2); R(x, "#4a7a6a", 80, vy + 12, 5, 1); }
      else if (view === "mountain") { for (let i = 60; i < 91; i++) { const h1 = 10 - Math.abs(((i - 60) % 20) - 10) * 0.8, h2 = 7 - Math.abs(((i - 52) % 16) - 8) * 0.7; R(x, "#7fa8c0", i, vy + 16 - h1, 1, h1 + 8); R(x, "#4a8a55", i, vy + 22 - h2, 1, h2 + 2); } }
      else { const c = tod === "night" ? "#202848" : "#a9b6c9"; for (let X = 60; X < 91;) { const w = 4 + Math.floor(r() * 5), h = 7 + Math.floor(r() * 11); R(x, c, X, vy + 24 - h, Math.min(w, 91 - X), h); for (let j = vy + 26 - h; j < vy + 23; j += 3) for (let i = X + 1; i < Math.min(X + w, 91) - 1; i += 2) { R(x, dark(c, 0.15), i, j); if (r() < 0.5) lit(i, j, 1, 1, "#ffe28a"); } X += w + 1; } }
      R(x, "#ffffff", 75, 7, 2, 24); R(x, "#ffffff", 60, 18, 31, 1); R(x, "#d8cdb5", 59, 32, 33, 1);
      R(x, "#8a5a3a", 55, 4, 41, 1); for (const X of [55, 90]) { R(x, "#ffcf4a", X, 5, 5, 30); R(x, "#e8b030", X + 1, 5, 1, 30); R(x, "#e8b030", X + 3, 5, 1, 30); }
      // 액자 (가족사진 · 풍경화)
      R(x, "#7a4e2c", 6, 11, 11, 10); R(x, "#fff6e0", 7, 12, 9, 8); R(x, "#e5372b", 8, 15, 2, 4); R(x, "#2346d8", 11, 14, 2, 5); R(x, "#ffc21a", 14, 16, 1, 3); R(x, "#f7cfa6", 8, 14, 2, 1); R(x, "#f7cfa6", 11, 13, 2, 1); R(x, "#f7cfa6", 14, 15, 1, 1);
      R(x, "#7a4e2c", 20, 14, 12, 8); R(x, "#9fd3ff", 21, 15, 10, 6); R(x, "#4a9a55", 21, 18, 10, 3); R(x, "#ffd23a", 28, 16, 2, 1);
      // 스탠드
      R(x, "#fff0c0", 39, 20, 6, 1); R(x, "#fff0c0", 38, 21, 8, 4); R(x, "#e8d7a0", 38, 24, 8, 1); lit(38, 20, 8, 5, "#fff2a0");
      R(x, "#3a3f47", 41, 25, 2, 25); R(x, "#3a3f47", 39, 49, 6, 1);
      // 바닥 + 러그
      R(x, "#c48a52", 0, 44, W, 16); for (let j = 47; j < 60; j += 4) { R(x, "#ad7442", 0, j, W, 1); for (let i = (j % 8) * 4; i < W; i += 28) R(x, "#ad7442", i, j - 3, 1, 3); }
      R(x, "#e5372b", 18, 51, 62, 7); R(x, "#ffc21a", 19, 52, 60, 5); R(x, "#e5372b", 21, 53, 56, 3); for (let i = 23; i < 76; i += 4) R(x, "#ffc21a", i, 54, 2, 1);
      // 소파
      R(x, "#2e52b8", 2, 33, 32, 9); R(x, "#3e64c8", 3, 34, 30, 7); R(x, "#5579d8", 2, 42, 32, 5); R(x, "#2e52b8", 2, 46, 32, 1);
      R(x, "#2e52b8", 1, 38, 4, 10); R(x, "#2e52b8", 31, 38, 4, 10); R(x, "#5579d8", 2, 38, 2, 1); R(x, "#5579d8", 32, 38, 2, 1);
      R(x, "#ffc21a", 7, 36, 6, 5); R(x, "#e8a800", 7, 40, 6, 1); R(x, "#e5372b", 23, 36, 6, 5); R(x, "#b8261c", 23, 40, 6, 1);
      R(x, OUT, 3, 48, 2, 2); R(x, OUT, 31, 48, 2, 2);
      // 화분
      blob(x, 89, 41, 5, 6, "#1e9e5a", "#7fd06b", "#13703f"); R(x, "#e8e0d0", 86, 47, 7, 8); R(x, "#c8c0b0", 86, 47, 7, 1);
      return 56;
    },
    // 공항: 통유리 너머 여객기(창문 줄·꼬리날개) + 탑승교 + 출국 게이트 표지 + 출발 안내판 + 대기 의자
    airport(x, tod, o, lit) {
      sky(x, tod, 0, 0, W, 30, 51);
      sun(x, tod, 34, 6);
      R(x, "#8e939a", 0, 30, W, 12); for (let i = 0; i < W; i += 6) R(x, "#ffc21a", i, 38, 3, 1); R(x, "#7a8088", 0, 30, W, 1);
      for (let i = 2; i < W; i += 8) lit(i, 31, 1, 1, "#ffd040");
      // 여객기
      R(x, "#e5372b", 15, 11, 3, 2); R(x, "#e5372b", 14, 13, 5, 2); R(x, "#e5372b", 13, 15, 7, 2); R(x, "#e5372b", 12, 17, 9, 2); R(x, "#e5372b", 12, 19, 10, 3); R(x, "#ffc21a", 13, 17, 7, 1);
      R(x, "#c8ced6", 8, 24, 14, 2); R(x, "#a3a9b1", 8, 25, 14, 1);
      R(x, "#f4f6f8", 14, 21, 58, 9); R(x, "#f4f6f8", 72, 22, 4, 7); R(x, "#f4f6f8", 76, 23, 3, 5); R(x, "#f4f6f8", 79, 24, 1, 3);
      R(x, "#d4d9e0", 14, 28, 64, 2); R(x, "#2346d8", 14, 26, 62, 1); R(x, "#ffc21a", 14, 27, 62, 1);
      for (let i = 22; i < 62; i += 3) R(x, "#3a4a6a", i, 23, 1, 2);
      R(x, "#3a4a6a", 73, 23, 4, 1); R(x, "#3a4a6a", 76, 24, 2, 1);
      R(x, "#a3a9b1", 64, 22, 3, 6); R(x, "#c8ced6", 65, 23, 1, 4);
      R(x, "#b8bfc8", 36, 30, 22, 2); R(x, "#b8bfc8", 40, 32, 14, 2); R(x, "#c8ced6", 44, 33, 8, 4); R(x, "#3a3f47", 51, 34, 1, 2);
      R(x, OUT, 30, 30, 1, 3); R(x, OUT, 70, 30, 1, 3); R(x, "#3a3f47", 29, 33, 3, 2); R(x, "#3a3f47", 69, 33, 3, 2);
      // 탑승교
      R(x, "#c9ccd2", 80, 20, 16, 12); R(x, "#9aa0a8", 80, 31, 16, 1); for (let i = 82; i < 96; i += 3) R(x, "#5f7a99", i, 23, 2, 2);
      R(x, "#7a8088", 86, 32, 2, 10);
      // 유리벽 멀리언
      for (const X of [0, 24, 48, 72, 95]) R(x, "#4a5160", X, 0, 1, 42);
      R(x, "#4a5160", 0, 41, W, 2);
      // 출국 게이트 표지 + 출발 안내판
      R(x, "#3a3f47", 14, 0, 1, 3); R(x, OUT, 3, 3, 27, 9); R(x, "#ffc21a", 4, 4, 25, 7); text(x, "GATE 7", 5, 5, OUT);
      R(x, "#3a3f47", 75, 0, 1, 3); R(x, OUT, 60, 3, 32, 15); R(x, "#1c2026", 61, 4, 30, 13);
      text(x, "10:30", 62, 5, "#ffc21a"); text(x, "11:45", 62, 11, "#ffc21a"); R(x, "#e8e8e8", 83, 6, 6, 1); R(x, "#e8e8e8", 83, 12, 6, 1); R(x, "#4af07a", 83, 8, 4, 1);
      lit(3, 3, 27, 9, null); lit(60, 3, 32, 15, null);
      // 바닥
      R(x, "#e6e8ec", 0, 43, W, 17); for (let j = 46; j < 60; j += 5) R(x, "#d5d8de", 0, j, W, 1); for (let i = 0; i < W; i += 12) R(x, "#f6f7f9", i + 3, 44, 4, 1);
      // 대기 의자
      for (const X0 of [1, 66]) for (let k = 0; k < 5; k++) { const X = X0 + k * 6; R(x, "#2346d8", X, 45, 5, 5); R(x, "#4a6fe8", X, 45, 5, 1); R(x, "#16308f", X, 50, 5, 2); }
      for (const X0 of [1, 66]) { R(x, "#a3a9b1", X0, 52, 29, 1); R(x, "#a3a9b1", X0 + 2, 53, 1, 4); R(x, "#a3a9b1", X0 + 26, 53, 1, 4); }
      return 57;
    },
    // 공원: 큰 나무 + 벤치 + 가로등 + 산책로 + 꽃밭
    park(x, tod, o, lit) {
      sky(x, tod, 0, 0, W, 40, 61);
      sun(x, tod, 60, 6);
      for (let i = -4; i < W + 6; i += 8) blob(x, i, 34, 6, 5, "#6aa86a", "#86c07a", "#5a9a5a");
      R(x, "#7cc46a", 0, 38, W, 22); const r = rng(62); for (let i = 0; i < 120; i++) R(x, "#6ab45a", r() * W, 38 + r() * 22);
      for (let y = 38; y < 60; y++) { const c = 48 + Math.round(Math.sin(y / 5) * 4), h = 3 + Math.floor((y - 38) * 0.7); R(x, "#e8d6a8", c - h, y, h * 2, 1); R(x, "#d6c08c", c - h, y, 1, 1); }
      // 큰 나무
      R(x, "#7a4e2c", 10, 22, 6, 30); R(x, "#5a3a22", 14, 22, 2, 30); R(x, "#9a6a3e", 11, 28, 1, 6); R(x, "#5a3a22", 8, 51, 10, 1);
      blob(x, 13, 16, 14, 11, "#3e8a4a", "#6cbc5e", "#2f6f3c"); blob(x, 4, 22, 6, 5, "#3e8a4a", "#6cbc5e", "#2f6f3c"); blob(x, 24, 21, 6, 5, "#3e8a4a", "#6cbc5e", "#2f6f3c");
      // 덤불 + 벤치
      blob(x, 74, 42, 12, 5, "#4f9a50", "#6cbc5e", "#3e8240");
      R(x, "#c8874a", 63, 41, 22, 2); R(x, "#c8874a", 63, 44, 22, 2); R(x, "#a86a34", 63, 46, 22, 1); R(x, "#d8975a", 62, 48, 24, 2); R(x, "#a86a34", 62, 50, 24, 1);
      for (const X of [64, 82]) { R(x, "#3a3a3a", X, 41, 2, 15); R(x, "#3a3a3a", X - 1, 47, 4, 1); }
      // 가로등
      R(x, "#2f3640", 91, 24, 2, 33); R(x, "#2f3640", 89, 56, 6, 1); R(x, "#2f3640", 89, 19, 6, 1); R(x, "#fff3b0", 89, 20, 6, 4); R(x, "#2f3640", 90, 24, 4, 1); lit(89, 20, 6, 4, "#ffe070");
      // 꽃밭
      for (let i = 0; i < 26; i++) { const X = 1 + r() * 26, Y = 54 + r() * 5; R(x, "#3e8240", X, Y + 1); R(x, ["#e5372b", "#ffc21a", "#f4a6b8", "#ffffff"][i % 4], X, Y); }
      return 57;
    },
    // 거리: 간판 달린 상가 건물 + 차양 + 보도블록 + 신호등 + 횡단보도
    street(x, tod, o, lit) {
      sky(x, tod, 0, 0, W, 34, 71);
      sun(x, tod, 66, 2);
      const r = rng(72);
      [[0, 8, 22, "#d8c8b0"], [22, 15, 22, "#c4cfd8"], [44, 4, 19, "#e8dcc8"], [63, 17, 18, "#b8a090"], [81, 10, 15, "#d0c0a8"]].forEach(([X, Y, w, c]) => {
        R(x, c, X, Y, w, 46 - Y); R(x, dark(c, 0.12), X + w - 1, Y, 1, 46 - Y); R(x, dark(c, 0.2), X, Y, w, 1);
        for (let j = Y + 3; j < 29; j += 6) for (let i = X + 2; i < X + w - 3; i += 5) { R(x, dark(c, 0.3), i - 1, j - 1, 5, 5); R(x, "#8ec9ee", i, j, 3, 3); R(x, "#c4e6fa", i, j, 1, 1); if (r() < 0.6) lit(i, j, 3, 3, "#ffe28a"); }
      });
      R(x, "#7a7f88", 50, 1, 1, 3); R(x, "#a3a9b1", 10, 5, 6, 3); R(x, "#7a7f88", 10, 7, 6, 1);
      // 1층 상점: 차양·간판·유리
      R(x, "#3a3f47", 0, 31, W, 1);
      for (let i = 1; i < 21; i += 2) R(x, i % 4 === 1 ? "#e5372b" : "#ffffff", i, 32, 2, 4); R(x, "#b8261c", 1, 36, 20, 1);
      R(x, "#1e9e5a", 22, 32, 22, 4); R(x, "#ffffff", 25, 33, 6, 2); R(x, "#ffffff", 33, 33, 8, 2); lit(22, 32, 22, 4, null);
      R(x, "#ffc21a", 44, 32, 19, 4); R(x, OUT, 47, 33, 3, 2); R(x, OUT, 52, 33, 3, 2); R(x, OUT, 57, 33, 3, 2); lit(44, 32, 19, 4, null);
      R(x, "#2346d8", 63, 32, 18, 4); R(x, "#ffffff", 66, 33, 12, 1); lit(63, 32, 18, 4, null);
      R(x, "#f4f0e4", 81, 32, 15, 4); R(x, "#e5372b", 84, 33, 9, 2);
      [[2, 18], [23, 20], [45, 17], [64, 16], [82, 13]].forEach(([X, w]) => { R(x, "#5a6a80", X, 37, w, 9); R(x, "#9fc4e0", X + 1, 38, w - 2, 7); R(x, "#c4e0f4", X + 1, 38, 2, 7); lit(X + 1, 38, w - 2, 7, "#ffe9a8"); });
      // 보도·차도
      R(x, "#c9c4bb", 0, 46, W, 11); for (let j = 46; j < 57; j += 3) { R(x, "#b3ada2", 0, j, W, 1); for (let i = (j % 2) * 3; i < W; i += 6) R(x, "#b3ada2", i, j, 1, 3); }
      R(x, "#9e9890", 0, 56, W, 1); R(x, "#5a5d63", 0, 57, W, 3); for (let i = 30; i < 66; i += 5) R(x, "#e8e8e8", i, 57, 3, 3);
      // 가로수 + 신호등
      R(x, "#7a4e2c", 8, 40, 2, 9); blob(x, 9, 37, 5, 5, "#3e8a4a", "#6cbc5e", "#2f6f3c"); R(x, "#8a8f99", 5, 48, 9, 2);
      R(x, "#3a3f47", 88, 22, 2, 35); R(x, "#2b2b2b", 86, 18, 6, 14);
      R(x, "#ff4a3a", 87, 19, 4, 3); R(x, "#5a4a20", 87, 23, 4, 3); R(x, "#1a4a2a", 87, 27, 4, 3); lit(87, 19, 4, 3, null);
      return 56;
    },
    // 바닷가: 수평선 + 파도 + 섬 + 돛단배 + 파라솔 + 갈매기
    beach(x, tod, o, lit) {
      sky(x, tod, 0, 0, W, 31, 81);
      sun(x, tod, 46, 14);
      R(x, "#2f86d6", 0, 31, W, 13); R(x, "#2a6fb8", 0, 31, W, 1);
      R(x, "#4a7a6a", 72, 28, 16, 3); R(x, "#4a7a6a", 76, 26, 8, 2);
      R(x, "#ffffff", 20, 24, 1, 6); R(x, "#ffffff", 21, 25, 3, 5); R(x, "#ffffff", 18, 27, 2, 3); R(x, "#7a4e2c", 16, 30, 9, 1);
      const r = rng(83); for (let i = 0; i < 26; i++) R(x, "#7fc0f0", r() * W, 33 + r() * 10, 3, 1);
      const glint = tod === "sunset" ? "#ffb070" : tod === "night" ? "#fff3c4" : "#ffffff"; for (let j = 32; j < 44; j += 2) R(x, glint, 46 + ((j * 7) % 5), j, 3 + (j % 3), 1);
      for (let i = 0; i < W; i++) R(x, "#ffffff", i, 43 + (Math.sin(i / 3) > 0.3 ? 0 : 1));
      R(x, "#f2d79e", 0, 45, W, 15); R(x, "#d8bc80", 0, 45, W, 2); for (let i = 0; i < 50; i++) R(x, r() < 0.5 ? "#e6c88a" : "#fbe6b8", r() * W, 47 + r() * 13);
      R(x, "#f4a6b8", 12, 55, 2, 1); R(x, "#ffffff", 30, 58, 2, 1);
      if (tod !== "night") { R(x, OUT, 30, 9, 2, 1); R(x, OUT, 32, 10, 1, 1); R(x, OUT, 33, 9, 2, 1); R(x, OUT, 38, 13, 2, 1); R(x, OUT, 40, 14, 1, 1); R(x, OUT, 41, 13, 2, 1); }
      // 파라솔 + 수건
      for (let j = 0; j < 7; j++) { const h = Math.round(Math.sqrt(49 - (6 - j) ** 2) * 1.6); for (let i = -h; i < h; i++) R(x, Math.floor((i + 20) / 4) % 2 ? "#ffffff" : "#e5372b", 78 + i, 30 + j); }
      R(x, "#ececec", 78, 37, 1, 20); R(x, "#2346d8", 68, 53, 20, 4); R(x, "#ffffff", 68, 54, 20, 1);
      return 57;
    },
    // 산골: 첩첩산 + 기와집(처마 곡선·창호지 문) + 돌담 + 감나무
    village(x, tod, o, lit) {
      sky(x, tod, 0, 0, W, 36, 91);
      sun(x, tod, 14, 6);
      for (let i = 0; i < W; i++) { const h = 12 + Math.sin(i / 9) * 5 + Math.sin(i / 4) * 1.5; R(x, "#8fb0cc", i, 34 - h, 1, h + 2); }
      for (let i = 0; i < W; i++) { const h = 8 + Math.sin(i / 7 + 2) * 4; R(x, "#5f9a6a", i, 38 - h, 1, h); if (i % 3 === 0) R(x, "#4f8a5a", i, 38 - h, 1, 1); }
      R(x, "#8fbf6a", 0, 36, W, 24); const r = rng(92); for (let i = 0; i < 60; i++) R(x, "#7aae58", r() * W, 37 + r() * 23);
      // 기와집
      R(x, "#a8a49a", 52, 45, 40, 4); for (let i = 53; i < 92; i += 5) R(x, "#8e8a80", i, 46, 1, 2); R(x, "#8e8a80", 52, 47, 40, 1);
      R(x, "#b88a52", 54, 43, 36, 2);
      for (const X of [55, 66, 77, 88]) R(x, "#7a4e2c", X, 30, 2, 13);
      [[57, 9], [68, 9], [79, 9]].forEach(([X, w]) => { R(x, "#f6efdc", X, 32, w, 10); for (let i = X + 1; i < X + w; i += 2) R(x, "#a07850", i, 32, 1, 10); for (let j = 33; j < 42; j += 2) R(x, "#a07850", X, j, w, 1); lit(X, 32, w, 10, "#ffd88a"); });
      R(x, "#4a5468", 50, 27, 44, 3); R(x, "#3a4254", 50, 29, 44, 1);
      for (let j = 0; j < 5; j++) R(x, "#4a5468", 54 + j, 22 + j, 36 - j * 2, 1);
      for (let i = 55; i < 90; i += 2) R(x, "#5a6680", i, 23, 1, 4);
      R(x, "#2f3646", 55, 21, 34, 1); R(x, "#2f3646", 52, 20, 3, 1); R(x, "#2f3646", 89, 20, 3, 1);
      R(x, "#4a5468", 48, 26, 3, 1); R(x, "#4a5468", 47, 25, 2, 1); R(x, "#4a5468", 93, 26, 3, 1); R(x, "#4a5468", 95, 25, 1, 1);
      // 감나무
      R(x, "#6b4226", 36, 28, 3, 18); blob(x, 37, 24, 10, 7, "#3e8a4a", "#6cbc5e", "#2f6f3c");
      for (let i = 0; i < 9; i++) { const X = 29 + r() * 16, Y = 19 + r() * 10; R(x, "#ff8a3d", X, Y, 2, 2); R(x, "#ffb070", X, Y, 1, 1); }
      // 돌담
      R(x, "#8a8478", 0, 43, 44, 10);
      for (let j = 43; j < 53; j += 3) for (let i = (j % 2) * 3; i < 44; i += 6) { R(x, ["#b8b2a4", "#a49e90", "#c4beb0"][(i + j) % 3], i, j, 5, 2); R(x, "#d4cec0", i, j, 2, 1); }
      R(x, "#4a5468", 0, 41, 45, 2); R(x, "#5a6680", 0, 41, 45, 1);
      // 흙길
      R(x, "#c9a874", 0, 53, W, 7); for (let i = 0; i < 30; i++) R(x, "#b8945e", r() * W, 54 + r() * 6);
      return 57;
    },
  };
  const BG_KEYS = Object.keys(BG);
  const INDOOR = { class: 1, office: 1, wedding: 1, hosp: 1, home: 1, airport: 0.5 };

  // 배경은 (종류·시간대·창밖) 조합마다 한 번만 그려 캐시. 밤에는 어둡게 덮은 뒤 불빛만 다시 켭니다.
  const bgCache = new Map(), floorOf = {};
  function bgCanvas(key, tod = "day", view = "city") {
    const id = key + tod + view;
    if (bgCache.has(id)) return bgCache.get(id);
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d"), lights = [];
    floorOf[key] = BG[key](x, tod, { view }, (X, Y, w, h, c) => lights.push([X, Y, w, h, c]));
    if (tod !== "day") {
      const keep = tod === "night" ? lights.filter((l) => !l[4]).map(([X, Y, w, h]) => [x.getImageData(X, Y, w, h), X, Y]) : [];
      const ind = INDOOR[key] || 0;
      x.fillStyle = tod === "night" ? `rgba(14,18,64,${0.48 - ind * 0.26})` : `rgba(255,110,60,${0.14 - ind * 0.07})`;
      x.fillRect(0, 0, W, H);
      if (tod === "night") { lights.forEach(([X, Y, w, h, c]) => c && R(x, c, X, Y, w, h)); keep.forEach(([d, X, Y]) => x.putImageData(d, X, Y)); }
    }
    bgCache.set(id, cv);
    return cv;
  }

  // ---------- 소품 ----------
  const PROPS = {
    heart: [".kk...kk.", "krrk.krrk", "krwrkrrrk", "krrrrrrrk", ".krrrrrk.", "..krrrk..", "...krk...", "....k...."],
    mic: [".kkk.", "kaAak", "kAaAk", ".kkk.", "..k..", "..A..", "..A..", "..A..", "..A..", "..A..", "..A..", "..A..", ".AAA.", "AAAAA"],
    note: ["...kk.", "...kyk", "...k.k", "...k..", ".kkk..", "kyyk..", ".kk..."],
    cat: [".k.....k.", "kok...kok", "koooooook", "kokoookok", "kooopoook", ".koooook.", ".kowwwok.", "koooooook", "kkkkkkkkk"],
    dog: [".kk....kk.", "kNNkkkkNNk", "kNwwwwwwNk", "kNwkwwkwNk", ".kwwkkwwk.", ".kwwwwwwk.", ".kwrrrrwk.", "kwwwwwwwwk", "kwwkwwkwwk", "kkkkkkkkkk"],
    milk: ["kkkk", "kwwk", "kbbk", "kwwk", "kkkk"],
    ball: [".kkk.", "kwkwk", "kkwkk", "kwkwk", ".kkk."],
    coins: [".kkkkk.", "kyyyyyk", "kYYYYYk", "kyyyyyk", "kYYYYYk", "kyyyyyk", ".kkkkk."],
    envelope: ["kkkkkkkkkk", "kwwwwwwwwk", "kWwwwwwwWk", "kwWwwwwWwk", "kwwWrrWwwk", "kwwwrrwwwk", "kkkkkkkkkk"],
    phone: ["kkkkk", "kccck", "kcwck", "kccck", "kcwck", "kccck", "kkwkk", "kkkkk"],
    books: ["krrrrrrrk.", "kwwwwwwwk.", ".kbbbbbbbk", ".kwwwwwwwk", "kyyyyyyyk.", "kwwwwwwwk.", "kkkkkkkkk."],
    lamp: ["kkkkk", "kyyyk", ".kyk.", "..k..", "..k..", ".kkk."],
    bulb: [".kkk.", "kyyyk", "kywyk", "kyyyk", ".kyk.", ".kak.", ".kkk."],
    pad: [".kkkkkkkk.", "kddwdddrdk", "kdwwwdrdyk", "kddwdddydk", ".kkk..kkk."],
    bouquet: [".prpw.", "pwrpwr", "rpwrpp", ".gGgG.", "..gG..", "..yy..", "..gg..", "..gg.."],
    box: ["kkkkkkkkkkk", "knnnnNnnnnk", "kkkkkkkkkkk", "knnnnnnnnnk", "knnnwwwnnnk", "knnnnnnnnnk", "kkkkkkkkkkk"],
    key: [".kkkk......", "kyyyyk.....", "kykkykkkkkk", "kyyyykyyyyk", ".kkkk.kykyk", "......k.k.k"],
    house: ["....kk....", "...krrk...", "..krrrrk..", ".krrrrrrk.", "kkkkkkkkkk", ".kwwkkwwk.", ".kwckkwck.", ".kwwkykwk.", ".kkkkkkkk."],
    suitcase: ["..kkk..", ".k...k.", "kkkkkkk", "kbbwbbk", "kbbwbbk", "kbbwbbk", "kbbwbbk", "kkkkkkk", ".k...k."],
    cake: ["..y.y.y..", "..r.r.r..", ".kkkkkkk.", "kwwwwwwwk", "kpppppppk", "kwwwwwwwk", "kppprpppk", "kkkkkkkkk"],
    bread: ["..kkkk..", ".koyyok.", "kooooook", "koyooyok", ".kkkkkk."],
    stone: ["...kkkkkk...", "..kaaaaaak..", ".kaWWWaaaAk.", ".kaWaaaaaAk.", ".kaaAAAAaAk.", ".kaaaaaaaAk.", ".kaaAAAaaAk.", ".kaaaaaaaAk.", ".kaaAAAAaAk.", ".kaaaaaaaAk.", ".kaaaaaaaAk.", "kkkkkkkkkkkk", "kaaaaaaaaaAk", "kkkkkkkkkkkk"],
    flowers: ["r.y.p.w.r", "g.g.g.g.g", "ggggggggg"],
    surf: [".kk.", "kyyk", "kyrk", "kyyk", "kyyk", "kyrk", "kyyk", "kyyk", "kyyk", "kyyk", ".kk."],
    bike: ["..........kk.", ".kkk....kkk..", "k...kkkk.k...", "k.k.k..k..kkk", "k...k.k.kk..k", ".kkk...k.k.kk", ".......kkk..."],
    umbrella: ["...kkk...", ".kbbbbbk.", "kbbbbbbbk", "kkkkkkkkk", "....k....", "....k....", "....k....", "....k....", "...kk...."],
    ballot: [".kkkkk.", ".kwwwk.", "kkkwkkk", "kbbbbbk", "kbwwwbk", "kbbbbbk", "kkkkkkk"],
    gift: ["..k.k..", ".krkrk.", "kkkrkkk", "kggrggk", "krrrrrk", "kggrggk", "kkkkkkk"],
    robot: [".kkkkk.", "kaaaaak", "kacaack", "kaaaaak", ".kkkkk.", "kbbbbbk", "kbybybk", "kbbbbbk", ".kk.kk."],
    snack: [".kkkkk.", "krrrrrk", "kryyyrk", "kryryrk", "kryyyrk", "krrrrrk", ".kkkkk."],
    tear: ["c", "c"],
    easel: ["kkkkkkkk", "kcccccck", "kcglgcck", "kgggggck", "kkkkkkkk", ".n....n.", ".n....n.", "n......n"],
    guitar: ["..kk.", "..kn.", "..kn.", "..kn.", ".kkkk", "koook", "kokok", "koook", ".kkk."],
    camera: [".kk...", "kkkkkk", "kdccdk", "kdcwdk", "kdccdk", "kkkkkk"],
    cup: ["kkkkk.", "kwwwkk", "knnnkk", "kwwwk.", ".kkk.."],
    neon: ["kkkkkkkkkkkkk", "kpppppppppppk", "kp...kk....pk", "kp...kyk...pk", "kp...k.....pk", "kp.kkk.....pk", "kp.kyk.....pk", "kpppppppppppk", "kkkkkkkkkkkkk"],
    bus: ["kkkkkkkkkkkkkkkkkkkkkk", "kggggggggggggggggggggk", "kgcccgcccgcccgcccgcckk", "kgcccgcccgcccgcccgccck", "kggggggggggggggggggggk", "kyyyyyyyyyyyyyyyyyyyyk", "kggggggggggggggggggggk", "kkkkkkkkkkkkkkkkkkkkkk", "...kkk..........kkk...", "...kak..........kak..."],
    car: ["......kkkkkkk.......", ".....kcccckccck.....", "....kccccckcccck....", "kkkkkkkkkkkkkkkkkkkk", "krrrrrrrrrrrrrrrrrrk", "kyrrrrrrrrrrrrrrrrrk", "krrrrrrrrrrrrrrrrrrk", "kkkkkkkkkkkkkkkkkkkk", "...kkk........kkk...", "...kak........kak..."],
    tent: ["......kk......", ".....kyyk.....", "....kyyyyk....", "...kyyyyyyk...", "..kyyykkyyyk..", ".kyyykddkyyyk.", "kyyyykddkyyyyk", "kkkkkkkkkkkkkk"],
    fire: ["...r...", "..ryr..", ".ryyor.", ".royyr.", "kNkNkNk", "NkNkNkN"],
    sprout: [".g...g.", "gGg.gGg", ".gGgGg.", "...G...", ".kkkkk.", ".knnnk.", ".kkkkk."],
    can: ["......k", ".kkkk.k", "kaaaakk", "kaaaak.", "kaaaak.", ".kkkk.."],
    trophy: ["kkkkkkk", "kyyyyyk", "kyywyyk", ".kyyyk.", "..kyk..", "..kyk..", ".kkkkk.", ".kYYYk."],
    star: ["..y..", ".yyy.", "yyyyy", ".y.y."],
    shoot: ["w........", ".c.......", "..c......", "...cw....", "....ww...", ".....wyy.", "......yyy", ".......y."],
    bundle: [".kkkkk.", "kwsssWk", "kwkskWk", "kwsrsWk", "kpwwwpk", "kppppPk", ".kkkkk."],
    paper: ["kkkkkk", "kwwwwk", "kwkkwk", "kwwwwk", "kwkkwk", "kkkkkk"],
    clock: [".kkk.", "kwkwk", "kwkkk", "kwwwk", ".kkk."],
    zz: ["kkk..", "..k..", ".k...", "kkk.k", "....k"],
    chute: [".rrwwrrwwrr.", "rrwwrrwwrrww", "k..........k", ".k........k.", "..k......k..", "...k....k...", "....kkkk....", ".....ss.....", ".....bb.....", ".....dd....."],
    pack: ["..kk..", ".kbbk.", "kbbbbk", "kbyybk", "kbbbbk", "kbbbbk", ".k..k."],
    rope: ["nNnNnNnNnNnNnNnNnNnNnNnNnNnNnNnNnNnNnNnN"],
    brief: [".kkk..", "kkkkkk", "kNNNNk", "kNyyNk", "kNNNNk", "kkkkkk"],
    ship: ["......k.......", "......kww.....", "......kwww....", "......kwwww...", "kkkkkkkkkkkkkk", "kwwcwwcwwcwwwk", ".kbbbbbbbbbbk.", "..kkkkkkkkkk.."],
  };
  // 그림이 아닌 효과 소품
  const FX = {
    rain(x, t) { for (let i = 0; i < 40; i++) { const X = ((i * 37 + t / 12) % (W + 10)) - 5, Y = (i * 23 + t / 6) % H; R(x, "rgba(190,220,255,.8)", X, Y, 1, 3); } },
    bunting(x) { for (let i = 0; i < W; i += 6) { const c = ["#e5372b", "#ffc21a", "#2346d8", "#1e9e5a", "#ffffff"][(i / 6) % 5]; const y = 3 + Math.round(Math.sin(i / 15) * 2); R(x, "#5a3a22", i, y, 6, 1); R(x, c, i + 1, y + 1, 4, 1); R(x, c, i + 2, y + 2, 2, 1); R(x, c, i + 2, y + 3, 1, 1); } },
    sparkle(x, t) { const f = Math.floor(t / 300) % 2; [[20, 12], [70, 8], [84, 20], [12, 26]].forEach(([X, Y], i) => { if ((i + f) % 2) { R(x, "#ffffff", X, Y - 1, 1, 3); R(x, "#ffffff", X - 1, Y, 3, 1); } else R(x, "#fff3b0", X, Y); }); },
  };

  // ---------- 사람 ----------
  const SKINS = ["#f7cfa6", "#f2c294", "#f9dcc0"];
  const HAIR_C = ["#241c18", "#2f2219", "#4a3020", "#6b4226", "#8a5a30"];
  const TOPS = ["#e5372b", "#2346d8", "#1e9e5a", "#ffc21a", "#ff8a3d", "#8a5cc8", "#f4a6b8", "#3fb8c8"];
  const BOTS = ["#2b3550", "#3a5a9a", "#b59a6a", "#3a3a3a", "#5a4a3a"];
  const STYLES = { m: ["short", "spiky", "side", "buzz"], f: ["long", "bob", "pony", "bun"], n: ["short", "spiky", "side", "bob", "pony", "long", "bun", "buzz"] };
  const pickOf = (a, r = Math.random) => a[Math.floor(r() * a.length)];
  let uid = 0;
  function newPerson(look = "n", r = Math.random) {
    const top = pickOf(TOPS, r);
    return { id: ++uid, look, hair: pickOf(STYLES[look] || STYLES.n, r), hairC: pickOf(HAIR_C, r), skin: pickOf(SKINS, r), top, top2: pickOf(TOPS.filter((c) => c !== top), r), bot: pickOf(BOTS, r), glasses: r() < 0.4, flip: r() < 0.5, gray: r() < 0.5 ? "#c9c9c9" : "#e6e6e6" };
  }
  const STAGE = (age) => (age < 4 ? "baby" : age < 13 ? "kid" : age < 20 ? "student" : age < 60 ? "adult" : "elder");
  // 단계별 뼈대: hy 머리 윗선, hip 엉덩이 줄. 그림판 14x23 (설계 좌표 0~11에 +1), 발은 맨 아래 줄 22
  const GEO = { kid: { hy: 6, hip: 19 }, student: { hy: 5, hip: 18 }, adult: { hy: 3, hip: 17 }, elder: { hy: 4, hip: 18 } };
  const BW = 14, BH = 23;

  const buf = () => new Array(BW * BH).fill(null);
  const set = (b, X, Y, c) => { X += 1; if (X >= 0 && X < BW && Y >= 0 && Y < BH) b[Y * BW + X] = c || null; };
  const get = (b, X, Y) => b[Y * BW + X + 1];
  const rect = (b, c, X, Y, w = 1, h = 1) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(b, X + i, Y + j, c); };
  function outline(b) {
    const o = b.slice();
    for (let Y = 0; Y < BH; Y++) for (let X = 0; X < BW; X++) {
      if (b[Y * BW + X]) continue;
      const n = (dx, dy) => { const a = X + dx, c = Y + dy; return a >= 0 && a < BW && c >= 0 && c < BH && b[c * BW + a]; };
      if (n(1, 0) || n(-1, 0) || n(0, -1) || n(0, 1)) o[Y * BW + X] = OUT;
    }
    return o;
  }
  const over = (a, b) => b.map((c, i) => c || a[i]);
  const mirror = (b) => b.map((_, i) => b[Math.floor(i / BW) * BW + (BW - 1 - (i % BW))]);

  // 사람 한 명 그리기 → 14x23 픽셀 배열
  function build(P, stage, pose, f) {
    if (stage === "baby") return buildBaby(P, pose, f);
    const sk = P.skin, skD = dark(sk, 0.14), hc = stage === "elder" ? P.gray : P.hairC, hH = light(hc, 0.3);
    const g = GEO[stage], bob = pose === "walk" && f ? 1 : 0, hy = g.hy + bob, hip = g.hip + bob;
    const ty = hy + 10, look = P.look;
    const back = buf(), body = buf(), head = buf(), arms = buf();
    // 옷 색: 학생은 교복, 노인은 차분한 카디건
    let T = P.top, Td = dark(T, 0.22), Bt = P.bot, Bd = dark(Bt, 0.22), shoe = "#3a2a24";
    if (stage === "student") { T = "#2b3a6b"; Td = "#1c2850"; Bt = "#5a6070"; Bd = dark(Bt, 0.22); shoe = "#2a2a2a"; }
    if (stage === "kid") shoe = P.id % 2 ? "#e5372b" : "#2346d8";
    if (stage === "elder") { T = mix(P.top, "#8a7a6a", 0.45); Td = dark(T, 0.22); }
    // 몸통 + 팔
    rect(body, T, 3, ty, 6, hip - ty);
    const armsUp = pose === "act";
    if (!armsUp || f) { rect(body, Td, 2, ty + 1, 1, hip - ty - 1); set(body, 2, hip, sk); }
    if (!armsUp) { rect(body, Td, 9, ty + 1, 1, hip - ty - 1); set(body, 9, hip, sk); }
    if (pose === "walk") { if (f) { set(body, 2, hip, null); set(body, 2, hip - 1, sk); } else { set(body, 9, hip, null); set(body, 9, hip - 1, sk); } }
    // 옷 디테일 (주름·깃·단추)
    set(body, 4, ty + 2, Td); set(body, 7, ty + 3, Td); rect(body, Td, 3, hip - 1, 6, 1);
    if (stage === "student") {
      rect(body, "#ffffff", 5, ty, 2, 2); set(body, 4, ty, "#ffffff"); set(body, 7, ty, "#ffffff");
      if (look === "f") { set(body, 5, ty + 1, "#e5372b"); set(body, 6, ty + 1, "#e5372b"); } else { set(body, 5, ty + 1, "#c8302a"); set(body, 5, ty + 2, "#c8302a"); set(body, 6, ty + 1, "#ffffff"); }
      set(body, 7, ty + 2, "#ffc21a"); // 명찰
    } else if (stage === "elder") { rect(body, "#f4f0e8", 5, ty, 2, 1); for (let k = 1; ty + k < hip - 1; k += 2) set(body, 5, ty + k, "#ffe27a"); rect(body, Td, 6, ty + 1, 1, hip - ty - 2); }
    else if (look === "m") { set(body, 4, ty, "#ffffff"); set(body, 7, ty, "#ffffff"); set(body, 5, ty, skD); set(body, 6, ty, skD); rect(body, Td, 5, ty + 1, 1, hip - ty - 2); for (let k = ty + 1; k < hip - 1; k += 2) set(body, 6, k, light(T, 0.5)); }
    else if (look === "f") { set(body, 5, ty, sk); set(body, 6, ty, sk); set(body, 4, ty, light(T, 0.45)); set(body, 7, ty, light(T, 0.45)); set(body, 4, ty + 1, light(T, 0.45)); set(body, 7, ty + 1, light(T, 0.45)); }
    else { set(body, 4, ty, "#ffffff"); set(body, 7, ty, "#ffffff"); set(body, 4, ty + 1, "#ffffff"); set(body, 7, ty + 1, "#ffffff"); if (hip - ty > 3) rect(body, Td, 4, hip - 2, 4, 1); }
    if (stage === "kid") { rect(body, light(T, 0.55), 3, ty + 1, 6, 1); }
    // 다리 (치마/바지)
    const skirt = look === "f" && (stage !== "elder" || P.id % 2);
    const legTop = hip + 1, legBot = BH - 2;
    const spread = pose === "walk" && !f;
    if (skirt) {
      const sc = stage === "student" ? "#34447a" : stage === "kid" ? T : P.top2;
      rect(body, sc, 3, hip, 6, 1); rect(body, sc, 2, hip + 1, 8, stage === "adult" ? 2 : 1);
      if (stage === "student") for (let i = 2; i < 10; i += 2) set(body, i, hip + 1, "#c8302a");
      set(body, 4, hip + 1, dark(sc, 0.22)); set(body, 7, hip + 1, dark(sc, 0.22));
      const st = hip + (stage === "adult" ? 3 : 2), leg = stage === "student" ? "#ffffff" : sk;
      for (let Y = st; Y <= legBot; Y++) { rect(body, leg, spread ? 2 : 3, Y, 2); rect(body, leg, spread ? 8 : 7, Y, 2); }
    } else {
      rect(body, Bt, 3, hip, 6, 1);
      if (stage === "kid") { rect(body, Bt, 3, legTop, 3, 1); rect(body, Bt, 6, legTop, 3, 1); set(body, 5, legTop, Bd); for (let Y = legTop + 1; Y <= legBot; Y++) { rect(body, sk, spread ? 2 : 3, Y, 2); rect(body, sk, spread ? 8 : 7, Y, 2); } }
      else for (let Y = legTop; Y <= legBot; Y++) { const s = spread && Y > legTop ? 1 : 0; rect(body, Bt, 3 - s, Y, 3); rect(body, Bt, 6 + s, Y, 3); set(body, 5 - s, Y, Bd); set(body, 6 + s, Y, light(Bt, 0.12)); }
      if (look === "m" && stage === "adult") { rect(body, "#3a2a24", 3, hip, 6, 1); set(body, 5, hip, "#c9a24a"); }
    }
    // 신발 (앞코 밝게)
    const sy = BH - 1, L = spread ? 1 : 2, Rr = spread ? 8 : 7;
    rect(body, shoe, L, sy, 3); rect(body, shoe, Rr, sy, 3); set(body, L, sy, light(shoe, 0.35)); set(body, Rr + 2, sy, light(shoe, 0.35));
    // 얼굴
    rect(head, sk, 2, hy + 1, 8, 8); [[2, hy + 1], [9, hy + 1], [2, hy + 8], [9, hy + 8]].forEach(([X, Y]) => set(head, X, Y, null));
    set(head, 1, hy + 5, sk); set(head, 10, hy + 5, sk); set(head, 1, hy + 6, skD); set(head, 10, hy + 6, skD);
    hair(P.hair, back, head, hy, hc, hH, stage);
    // 팔 올리기 (행동)
    if (armsUp) {
      const up = (s) => { const X = s ? 10 : 1, O = s ? 11 : 0; set(arms, X, ty, Td); set(arms, O, ty - 1, Td); set(arms, O, ty - 2, Td); set(arms, O, ty - 3, sk); };
      up(true); if (!f) up(false);
    }
    let out = outline(back);
    out = over(out, outline(body));
    out = over(out, outline(head));
    out = over(out, outline(arms));
    // 이목구비
    const blink = pose === "stand" && f;
    [4, 7].forEach((X) => { set(out, X, hy + 6, OUT); if (!blink) set(out, X, hy + 5, OUT); });
    if (!blink) { set(out, 4, hy + 5, "#1a1a2a"); set(out, 7, hy + 5, "#1a1a2a"); }
    set(out, 3, hy + 7, "#f59a9a"); set(out, 8, hy + 7, "#f59a9a");
    set(out, 5, hy + 7, "#b8473c"); set(out, 6, hy + 7, "#b8473c");
    if (pose === "act") { set(out, 5, hy + 8, "#e56a5a"); set(out, 6, hy + 8, "#e56a5a"); }
    if (stage === "elder") { set(out, 3, hy + 6, skD); set(out, 8, hy + 6, skD); if (P.glasses) [3, 5, 6, 8].forEach((X) => set(out, X, hy + 5, "#8a6a4a")); }
    // 노인 지팡이
    if (stage === "elder" && pose !== "act") { for (let Y = ty + 3; Y < BH; Y++) set(out, -1, Y, "#6b4226"); set(out, 0, ty + 3, "#6b4226"); set(out, 0, ty + 2, OUT); }
    return P.flip && (P.hair === "side" || P.hair === "pony") ? mirror(out) : out;
  }

  // 머리 모양 8종 (앞머리는 head, 뒷머리는 back)
  function hair(style, back, head, hy, hc, hH, stage) {
    const hd = dark(hc, 0.22);
    const cap = () => { rect(head, hc, 3, hy, 6, 1); rect(head, hc, 2, hy + 1, 8, 1); rect(head, hc, 1, hy + 2, 10, 2); set(head, 3, hy + 1, hH); set(head, 4, hy + 1, hH); set(head, 2, hy + 2, hH); };
    switch (style) {
      case "buzz": rect(head, hc, 3, hy + 1, 6, 1); rect(head, hc, 2, hy + 2, 8, 2); set(head, 4, hy + 1, hH); set(head, 3, hy + 2, hH); set(head, 2, hy + 3, hd); set(head, 9, hy + 3, hd); break;
      case "short": cap(); rect(head, hc, 2, hy + 4, 3, 1); rect(head, hc, 6, hy + 4, 4, 1); set(head, 1, hy + 4, hc); set(head, 10, hy + 4, hc); set(head, 7, hy + 4, hd); break;
      case "spiky": cap(); set(head, 3, hy - 1, hc); set(head, 6, hy - 1, hc); set(head, 2, hy, hc); set(head, 9, hy, hc); [2, 4, 6, 8].forEach((X) => set(head, X, hy + 4, hc)); set(head, 1, hy + 4, hc); set(head, 10, hy + 4, hc); set(head, 6, hy, hH); break;
      case "side": cap(); rect(head, hc, 2, hy + 4, 5, 1); set(head, 2, hy + 5, hc); set(head, 7, hy + 1, hd); set(head, 7, hy + 2, hd); set(head, 10, hy + 4, hc); set(head, 8, hy + 2, hH); break;
      case "bob": cap(); rect(head, hc, 2, hy + 4, 8, 1); rect(head, hc, 1, hy + 4, 1, 5); rect(head, hc, 10, hy + 4, 1, 5); set(head, 2, hy + 5, hc); set(head, 9, hy + 5, hc); set(head, 1, hy + 8, hd); set(head, 10, hy + 8, hd); set(head, 5, hy + 4, hd); break;
      case "long": cap(); rect(head, hc, 2, hy + 4, 3, 1); rect(head, hc, 7, hy + 4, 3, 1); rect(head, hc, 1, hy + 4, 1, 5); rect(head, hc, 10, hy + 4, 1, 5); rect(back, hc, 0, hy + 3, 12, stage === "kid" ? 9 : 12); for (let j = hy + 8; j < hy + (stage === "kid" ? 12 : 15); j++) { set(back, 0, j, hd); set(back, 11, j, hd); } break;
      case "pony": cap(); rect(head, hc, 2, hy + 4, 4, 1); set(head, 9, hy + 4, hc); set(head, 10, hy + 4, hc); rect(back, hc, 10, hy + 1, 3, 3); rect(back, hc, 11, hy + 4, 2, 5); set(back, 12, hy + 9, hc); set(back, 12, hy + 6, hd); set(back, 11, hy + 3, "#e5372b"); set(back, 12, hy + 3, "#e5372b"); break;
      case "bun": cap(); rect(head, hc, 4, hy - 2, 4, 2); set(head, 5, hy - 2, hH); set(head, 4, hy - 1, hd); rect(head, hc, 2, hy + 4, 3, 1); rect(head, hc, 8, hy + 4, 2, 1); set(head, 1, hy + 4, hc); set(head, 10, hy + 4, hc); break;
    }
  }

  // 아기: 앉기(서기) / 버둥(걷기) / 만세(행동)
  function buildBaby(P, pose, f) {
    const sk = P.skin, skD = dark(sk, 0.14), suit = ["#ffe27a", "#bfe9d9", "#ffd0dc", "#cfe0ff"][P.id % 4], sd = dark(suit, 0.15);
    const b = buf(), hd = buf(), hy = 11;
    rect(hd, sk, 3, hy + 1, 6, 6); [[3, hy + 1], [8, hy + 1], [3, hy + 6], [8, hy + 6]].forEach(([X, Y]) => set(hd, X, Y, null));
    set(hd, 2, hy + 4, sk); set(hd, 9, hy + 4, sk);
    set(hd, 5, hy, P.hairC); set(hd, 4, hy + 1, P.hairC); set(hd, 5, hy + 1, P.hairC); set(hd, 6, hy + 1, P.hairC);
    const by = hy + 7;
    rect(b, suit, 3, by, 6, 4); set(b, 5, by + 1, sd); set(b, 6, by + 1, "#ffffff"); rect(b, sd, 3, by + 3, 6, 1);
    if (pose === "act") { set(b, 2, by - 1, suit); set(b, 1, by - 2, sk); if (!f) { set(b, 9, by - 1, suit); set(b, 10, by - 2, sk); } else { set(b, 9, by, suit); set(b, 9, by + 1, sk); } }
    else { set(b, 2, by, suit); set(b, 2, by + 1, sk); set(b, 9, by, suit); set(b, 9, by + 1, sk); }
    const kick = pose === "walk" ? f : 0;
    rect(b, suit, 2, by + 4, 3, 1); rect(b, suit, 7, by + 4, 3, 1); set(b, 1, by + 4 - kick, sk); set(b, 10, by + 4, sk);
    let out = over(outline(b), outline(hd));
    set(out, 4, hy + 4, OUT); set(out, 7, hy + 4, OUT); set(out, 3, hy + 5, "#f59a9a"); set(out, 8, hy + 5, "#f59a9a");
    set(out, 5, hy + 5, pose === "act" ? "#b8473c" : skD); set(out, 6, hy + 5, pose === "act" ? "#b8473c" : skD);
    return out;
  }

  const spriteCache = new Map();
  function personCanvas(P, stage, pose, f) {
    const id = `${P.id}|${stage}|${pose}|${f}`;
    if (spriteCache.has(id)) return spriteCache.get(id);
    const cv = document.createElement("canvas"); cv.width = BW; cv.height = BH;
    const x = cv.getContext("2d");
    build(P, stage, pose, f).forEach((c, i) => c && R(x, c, i % BW, Math.floor(i / BW)));
    spriteCache.set(id, cv);
    return cv;
  }
  // X: 사람 왼쪽 끝(설계 좌표 0), floor: 발 y
  function drawPerson(x, P, age, X, floor, pose = "stand", t = 0, phase = 0) {
    const k = t + phase;
    const f = pose === "stand" ? (k % 3200 < 160 ? 1 : 0) : Math.floor(k / (pose === "walk" ? 260 : 340)) % 2;
    x.drawImage(personCanvas(P, typeof age === "string" ? age : STAGE(age), pose, f), Math.round(X) - 1, floor - BH + 1);
  }

  // ---------- 장면 그리기 ----------
  // scene: { bg, tod, pose, who: x | false, with: [[역할, x, 자세]], back/props: [[이름, x, y]], fx: [효과] }
  // cast: { me, mom, dad, friend, lover, kid, teacher, gran }
  const ROLE_AGE = { mom: 30, dad: 32, teacher: 35 };
  function roleAge(role, age) {
    if (role === "kid") return age < 45 ? 6 : 9;
    if (role === "baby") return 1;
    if (role === "gran") return 70;
    if (role in ROLE_AGE) return age + ROLE_AGE[role];
    return Math.max(age, role === "lover" ? 16 : 5);
  }
  function draw(canvas, scene, age, cast, t = 0, view = "city") {
    const x = canvas.getContext("2d");
    const tod = scene.tod || "day";
    x.drawImage(bgCanvas(scene.bg, tod, scene.bg === "home" ? view : "city"), 0, 0);
    const floor = floorOf[scene.bg];
    (scene.back || []).forEach(([name, X, Y]) => { const m = PROPS[name]; if (m) spr(x, m, X, Y == null ? floor - m.length + 1 : Y); });
    const people = [];
    (scene.with || []).forEach(([role, X, pose], i) => { const P = cast[role]; if (P) people.push([P, roleAge(role, age), X, pose || "stand", i * 170 + 90]); });
    if (scene.who !== false && cast.me) people.push([cast.me, age, scene.who ?? 42, scene.pose || "walk", 0]);
    (scene.extra || []).forEach(([a, X, pose]) => people.push([cast.me, a, X, pose || "stand", X * 13]));
    people.forEach(([P, a, X, pose, ph]) => drawPerson(x, P, a, X, floor, pose, t, ph));
    if (tod !== "day") { x.fillStyle = tod === "night" ? "rgba(14,18,64,.16)" : "rgba(255,110,60,.06)"; x.fillRect(0, 0, W, H); }
    (scene.props || []).forEach(([name, X, Y]) => { const m = PROPS[name]; if (m) spr(x, m, X, Y == null ? floor - m.length + 1 : Y); });
    (scene.fx || []).forEach((k) => FX[k] && FX[k](x, t));
  }

  NALGI.pixel = { W, H, BG_KEYS, PROPS, FX, draw, newPerson, STAGE, bgCanvas, floorOf, drawPerson, STYLES };
})();
