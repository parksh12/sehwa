// 펭귄 RPG 도트 그림 — 이미지 파일 없이 캔버스에 코드로 직접 그립니다(외부 에셋 0).
// 타일 16x16(테마 10종), 캐릭터 16x16(4방향·걷기 2프레임), 몬스터 20x20, 보스 36x36. 그린 뒤 자동 외곽선을 씌웁니다.
(function () {
  const RPG = (window.RPG = window.RPG || {});
  const OUT = "#141414";
  const cache = new Map();
  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const mix = (a, b, t) => {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const A = p(a), B = p(b);
    return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
  };
  const dk = (c, t = 0.22) => mix(c, "#10101a", t);
  const lt = (c, t = 0.3) => mix(c, "#ffffff", t);

  // 그리기 도구
  function pen(x) {
    const P = {
      x,
      r(X, Y, w, h, c) { x.fillStyle = c; x.fillRect(Math.round(X), Math.round(Y), w, h); return P; },
      p(X, Y, c) { return P.r(X, Y, 1, 1, c); },
      e(cx, cy, rx, ry, c, shade) {
        for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
          const v = (i * i) / ((rx + 0.4) * (rx + 0.4)) + (j * j) / ((ry + 0.4) * (ry + 0.4));
          if (v > 1) continue;
          let col = c;
          if (shade && (j > ry * 0.35 && v > 0.35)) col = dk(c, 0.2);
          if (shade && i < 0 && j < 0 && v > 0.25 && v < 0.6) col = lt(c, 0.25);
          P.p(cx + i, cy + j, col);
        }
        return P;
      },
      tri(x1, y1, x2, y2, x3, y3, c) { // 채운 삼각형
        const minY = Math.min(y1, y2, y3), maxY = Math.max(y1, y2, y3);
        for (let y = minY; y <= maxY; y++) {
          const xs = [];
          [[x1, y1, x2, y2], [x2, y2, x3, y3], [x3, y3, x1, y1]].forEach(([ax, ay, bx, by]) => {
            if ((y >= ay && y <= by) || (y >= by && y <= ay)) { if (ay === by) xs.push(ax, bx); else xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay)); }
          });
          if (xs.length) P.r(Math.min(...xs), y, Math.round(Math.max(...xs) - Math.min(...xs)) + 1, 1, c);
        }
        return P;
      },
      eye(X, Y, big) { P.r(X, Y, 2, big ? 3 : 2, "#fff"); P.p(X + 1, Y + (big ? 1 : 1), OUT); return P; },
      angry(X, Y) { P.r(X, Y, 2, 2, "#fff"); P.p(X + 1, Y + 1, OUT); P.p(X, Y - 1, OUT); P.p(X + 1, Y - 1, OUT); return P; },
      map(rows, pal, X = 0, Y = 0, flip = false) {
        const w = Math.max(...rows.map((r) => r.length));
        rows.forEach((row, j) => [...row].forEach((ch, i) => { const c = pal[ch]; if (c) P.p(X + (flip ? w - 1 - i : i), Y + j, c); }));
        return P;
      },
    };
    return P;
  }
  function outline(c, col = OUT) {
    const x = c.getContext("2d"), { width: w, height: h } = c;
    const d = x.getImageData(0, 0, w, h), a = d.data;
    const solid = (i, j) => i >= 0 && j >= 0 && i < w && j < h && a[(j * w + i) * 4 + 3] > 0;
    const pts = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!solid(i, j) && (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1))) pts.push([i, j]);
    x.fillStyle = col;
    pts.forEach(([i, j]) => x.fillRect(i, j, 1, 1));
    return c;
  }
  function mk(key, w, h, fn, line = true) {
    if (cache.has(key)) return cache.get(key);
    const c = canvas(w, h), x = c.getContext("2d");
    fn(pen(x), x);
    if (line) outline(c);
    cache.set(key, c);
    return c;
  }

  // ---------- 타일 테마 ----------
  const TH = {
    village: { g: "#eef3f8", g2: "#dce6f0", path: "#c7d1dc", wall: "#9fb0c2", tree: "#2f6b4f", liq: ["#9fd3ff", "#c6e6ff"], bridge: "#a0683a" },
    forest: { g: "#7ccf63", g2: "#62b84f", path: "#cfa66c", wall: "#7d8a7a", tree: "#2f8f3e", liq: ["#3f97dc", "#6cb6ec"], bridge: "#a0683a", flower: "#ffc21a" },
    maze: { g: "#4d8a43", g2: "#3f7a37", path: "#a98a55", wall: "#2b6a33", tree: "#2b7a36", liq: ["#3f97dc", "#6cb6ec"], bridge: "#a0683a", flower: "#e5372b" },
    volcano: { g: "#6b3a2e", g2: "#7f4838", path: "#a3734f", wall: "#3a2626", tree: "#2e2224", liq: ["#ff6a1f", "#ffb02e"], bridge: "#4a3a34", flower: "#ff8a3d" },
    kiln: { g: "#8a4a32", g2: "#7a3f2a", path: "#a3734f", wall: "#5a2a1e", tree: "#4a2218", liq: ["#ff6a1f", "#ffb02e"], bridge: "#4a3a34", flower: "#ffc21a" },
    snow: { g: "#f6f8fb", g2: "#e1e9f2", path: "#e9e1d0", wall: "#a9d6f5", tree: "#2f6b5f", liq: ["#2c6fb3", "#4a8ed0"], bridge: "#a0683a", flower: "#9fd3ff" },
    fort: { g: "#d8ecfa", g2: "#c4dff3", path: "#e9e1d0", wall: "#6fa8d4", tree: "#5a96c4", liq: ["#2c6fb3", "#4a8ed0"], bridge: "#a0683a", flower: "#ffffff" },
    sea: { g: "#3b3b4a", g2: "#47475a", path: "#5c5c72", wall: "#24242f", tree: "#1f3a33", liq: ["#14306b", "#1f4a96"], bridge: "#6b4226", flower: "#8a5cc8" },
    lib: { g: "#5a3a28", g2: "#4e3222", path: "#7a5236", wall: "#3a2418", tree: "#3a2418", liq: ["#14306b", "#1f4a96"], bridge: "#6b4226", flower: "#ffc21a" },
    tower: { g: "#e8b923", g2: "#d9a514", path: "#f2d46a", wall: "#8a8a90", tree: "#6e6e75", liq: ["#555", "#777"], bridge: "#6b4226", flower: "#fff3b0" },
  };
  RPG.themes = TH;

  function ground(P, t, x, y, deco) {
    P.r(0, 0, 16, 16, t.g);
    for (let i = 0; i < 6; i++) { const a = hash(x, y, i), b = hash(x, y, i + 9); P.p(Math.floor(a * 16), Math.floor(b * 16), t.g2); }
    if (deco) {
      const a = Math.floor(hash(x, y, 3) * 10) + 3, b = Math.floor(hash(x, y, 4) * 10) + 3;
      if (t.flower) { P.p(a, b, t.flower); P.p(a - 1, b, lt(t.flower, 0.3)); P.p(a + 1, b, lt(t.flower, 0.3)); P.p(a, b - 1, lt(t.flower, 0.3)); P.p(a, b + 1, dk(t.g, 0.3)); }
      else { P.r(a, b, 2, 1, t.g2); P.p(a + 1, b - 1, t.g2); }
    }
  }
  function treeT(P, theme, t, x, y, hidden) {
    const v = hash(x, y, 7);
    if (theme === "forest" || theme === "maze") { // 대나무
      P.r(0, 0, 16, 16, theme === "maze" ? "#2f5f2c" : dk(t.g, 0.25));
      const n = hidden ? 2 : 3;
      for (let k = 0; k < n; k++) {
        const X = 1 + k * 5 + Math.floor(v * 2), c = k % 2 ? t.tree : lt(t.tree, 0.12);
        P.r(X, 0, 3, 16, c); P.r(X, 0, 1, 16, lt(c, 0.25));
        for (let j = (k * 5) % 6; j < 16; j += 6) P.r(X, j, 3, 1, dk(c, 0.3));
        P.r(X + 3, 3 + k * 3, 2, 1, "#5fbf5a");
      }
      if (hidden) P.p(13, 12, "#ffc21a");
    } else if (theme === "village" || theme === "snow") { // 눈 덮인 소나무
      P.r(0, 0, 16, 16, t.g);
      P.tri(8, 1, 2, 9, 14, 9, t.tree); P.tri(8, 4, 1, 13, 15, 13, dk(t.tree, 0.1));
      P.r(7, 13, 2, 3, "#6b4226");
      P.tri(8, 1, 5, 5, 11, 5, "#ffffff"); P.r(3, 9, 4, 1, "#ffffff"); P.r(10, 12, 4, 1, "#ffffff");
      if (hidden) P.p(2, 14, "#9fd3ff");
    } else if (theme === "volcano" || theme === "kiln") { // 현무암 기둥
      P.r(0, 0, 16, 16, t.g);
      P.tri(8, 0, 2, 15, 14, 15, t.tree); P.tri(8, 0, 5, 15, 8, 15, lt(t.tree, 0.15));
      P.p(9, 6, "#ff6a1f"); P.p(7, 11, "#ff6a1f");
    } else if (theme === "sea") { // 해초 바위
      P.r(0, 0, 16, 16, t.g);
      P.e(8, 10, 7, 5, "#2a2a36", true);
      P.r(4, 2, 2, 8, t.tree); P.r(9, 0, 2, 9, "#2f6b4f"); P.r(12, 4, 2, 6, t.tree);
    } else if (theme === "fort") {
      P.r(0, 0, 16, 16, t.wall); P.tri(8, 0, 3, 15, 13, 15, lt(t.wall, 0.4)); P.r(7, 2, 1, 10, "#fff");
    } else if (theme === "lib") { bookshelf(P, x, y, true); }
    else { // tower: 잿빛 기둥
      P.r(0, 0, 16, 16, t.g); P.r(3, 0, 10, 16, t.tree); P.r(3, 0, 2, 16, lt(t.tree, 0.25)); P.r(3, 0, 10, 2, dk(t.tree, 0.2)); P.r(3, 14, 10, 2, dk(t.tree, 0.2));
    }
  }
  function bookshelf(P, x, y, alt) {
    P.r(0, 0, 16, 16, "#3a2418");
    const cols = ["#e5372b", "#2346d8", "#ffc21a", "#1e9e5a", "#f2f1ec", "#8a5cc8"];
    for (const row of [1, 8]) {
      P.r(0, row + 6, 16, 1, "#2a180e");
      let X = 1;
      while (X < 15) { const w = 1 + Math.floor(hash(x * 3 + X, y + row, alt ? 5 : 2) * 2), c = cols[Math.floor(hash(X, y * 7 + row, x) * cols.length)]; const h = 4 + Math.floor(hash(X, row, y) * 3); P.r(X, row + 6 - h, w, h, c); X += w + (hash(X, y, row) < 0.2 ? 1 : 0); }
    }
  }
  function wallT(P, theme, t, x, y) {
    if (theme === "lib") return bookshelf(P, x, y);
    if (theme === "maze") return treeT(P, "maze", t, x, y + 31);
    if (theme === "kiln" || theme === "fort" || theme === "tower") { // 벽돌
      P.r(0, 0, 16, 16, t.wall);
      const m = theme === "fort" ? lt(t.wall, 0.45) : dk(t.wall, 0.35);
      for (let j = 0; j < 16; j += 4) { P.r(0, j, 16, 1, m); for (let i = (j / 4) % 2 ? 4 : 0; i < 16; i += 8) P.r(i, j, 1, 4, m); }
      P.r(0, 1, 16, 1, lt(t.wall, 0.15));
      return;
    }
    // 바위
    P.r(0, 0, 16, 16, t.g);
    P.e(8, 9, 7, 6, t.wall, true);
    P.p(5, 6, lt(t.wall, 0.4)); P.p(6, 5, lt(t.wall, 0.4));
    if (theme === "forest") { P.r(4, 4, 5, 1, "#5fa34a"); P.r(3, 5, 3, 1, "#5fa34a"); }
    if (theme === "snow") { P.r(3, 3, 9, 2, "#ffffff"); }
  }
  function liquid(P, theme, t, x, y, f) {
    const [a, b] = t.liq;
    P.r(0, 0, 16, 16, a);
    for (let k = 0; k < 3; k++) {
      const X = Math.floor(hash(x, y, k) * 12), Y = (Math.floor(hash(x, y, k + 5) * 14) + f * 3) % 15;
      P.r(X, Y, 4, 1, b); P.r(X + 1, Y + 1, 2, 1, b);
    }
    if (theme === "volcano" || theme === "kiln") { if ((x + y + f) % 3 === 0) P.p(Math.floor(hash(x, y, 9) * 14) + 1, 4 + f * 4, "#fff3b0"); }
    if (theme === "village") { P.r(2 + f, 3, 3, 1, "#ffffff"); }
  }
  function tileCanvas(theme, ch, x, y, f) {
    const v = ch === "~" ? (x * 7 + y * 3) % 6 : ch === "." || ch === "," ? (x * 5 + y * 11) % 8 : (x * 3 + y * 5) % 4;
    const key = `t|${theme}|${ch}|${v}|${ch === "~" ? f : 0}`;
    return mk(key, 16, 16, (P) => {
      const t = TH[theme];
      const vx = v, vy = v * 3 + 1;
      switch (ch) {
        case ".": ground(P, t, vx, vy, false); break;
        case ",": ground(P, t, vx, vy, true); break;
        case ":": P.r(0, 0, 16, 16, t.path); for (let i = 0; i < 5; i++) P.p(Math.floor(hash(vx, vy, i) * 16), Math.floor(hash(vx, vy, i + 3) * 16), dk(t.path, 0.12)); break;
        case "T": treeT(P, theme, t, vx, vy, false); break;
        case "h": treeT(P, theme, t, vx, vy, true); break;
        case "#": wallT(P, theme, t, vx, vy); break;
        case "~": liquid(P, theme, t, vx, vy, f); break;
        case "=": P.r(0, 0, 16, 16, t.liq[0]); P.r(0, 1, 16, 14, t.bridge); for (let i = 0; i < 16; i += 4) P.r(i, 1, 1, 14, dk(t.bridge, 0.3)); P.r(0, 1, 16, 1, lt(t.bridge, 0.3)); P.r(0, 14, 16, 1, dk(t.bridge, 0.4)); break;
        case "R": { const c = (x >> 0) % 2 ? "#e5372b" : "#d4302a"; P.r(0, 0, 16, 16, c); for (let j = 3; j < 16; j += 4) P.r(0, j, 16, 1, dk(c, 0.3)); P.r(0, 0, 16, 1, lt(c, 0.3)); P.r(0, 2, 16, 2, "#ffffff"); break; }
        case "W": P.r(0, 0, 16, 16, "#f2d79e"); P.r(0, 0, 16, 2, "#a0683a"); P.r(0, 15, 16, 1, "#a0683a"); if (v % 2 === 0) { P.r(4, 5, 8, 6, "#6b4226"); P.r(5, 6, 6, 4, "#9fd3ff"); P.r(8, 6, 1, 4, "#6b4226"); P.r(5, 6, 2, 1, "#fff"); } break;
        case "D": P.r(0, 0, 16, 16, "#f2d79e"); P.r(0, 0, 16, 2, "#a0683a"); P.r(3, 3, 10, 13, "#6b4226"); P.r(4, 4, 8, 12, "#8a5a36"); P.r(10, 10, 1, 2, "#ffc21a"); P.r(3, 3, 10, 1, dk("#6b4226", 0.3)); break;
        case "f": ground(P, t, vx, vy, false); P.r(0, 6, 16, 2, "#a0683a"); P.r(0, 11, 16, 2, "#a0683a"); P.r(2, 4, 2, 12, "#8a5a36"); P.r(11, 4, 2, 12, "#8a5a36"); break;
        case "s": P.r(0, 0, 16, 16, dk(t.g, 0.4)); for (let j = 0; j < 4; j++) P.r(1 + j, 2 + j * 3, 14 - j * 2, 3, j % 2 ? t.g2 : t.g); P.r(1, 2, 14, 1, "#fff3b0"); break;
        default: ground(P, t, vx, vy, false);
      }
    }, false);
  }

  // ---------- 캐릭터(16x16) ----------
  const PEN = {
    down: ["................", ".....kkkkkk.....", "....kbbbbbbk....", "...kbbbbbbbbk...", "...kbwwbbwwbk...", "...kbwkbbkwbk...", "...kbbbyybbbk...", "...kbbyyyybbk...", "...krrrrrrrrk...", "..kbkwwwwwwkbk..", ".kbbkwwwwwwkbbk.", ".kbkwwwwwwwwkbk.", "..kkwwwwwwwwkk..", "...kbwwwwwwbk...", "....kkkkkkkk....", "....kyyk.kyyk..."],
    up: ["................", ".....kkkkkk.....", "....kbbbbbbk....", "...kbbbbbbbbk...", "...kbbbbbbbbk...", "...kbbbbbbbbk...", "...kbbbbbbbbk...", "...kbbbbbbbbk...", "...krrrrrrrrk...", "..kbkbbrrbbbkbk.", ".kbbkbbrrbbbkbbk", ".kbkbbbrbbbbbkbk", "..kkbbbbbbbbkk..", "...kbbbbbbbbk...", "....kkkkkkkk....", "....kyyk.kyyk..."],
    side: ["................", ".....kkkkk......", "....kbbbbbk.....", "...kbbbbbbbk....", "...kbbbbwwbk....", "...kbbbbwkbkk...", "...kbbbbbbbyyk..", "...kbbbbbbbkkk..", "...krrrrrrrk....", "...kbbwwwwwk....", "..kbbbkwwwwk....", "..kbbbkwwwwk....", "...kbbkwwwwk....", "...kbbbwwwbk....", "....kkkkkkk.....", ".....kyyyk......"],
  };
  const FEET = { down: ["....kyyk.kyyk...", ".....kyykkyyk..."], up: ["....kyyk.kyyk...", ".....kyykkyyk..."], side: [".....kyyyk......", "....kyyk.kyyk..."] };
  function penguin(o, dir, f) {
    const key = `pen|${o.scarf}|${o.hat || ""}|${o.body || ""}|${dir}|${f}`;
    return mk(key, 16, 16, (P) => {
      const base = dir === "left" || dir === "right" ? "side" : dir;
      const rows = PEN[base].slice();
      rows[15] = FEET[base][f % 2];
      const pal = { k: OUT, b: o.body || "#23232e", w: "#ffffff", y: "#ffc21a", r: o.scarf || "#e5372b" };
      const bob = f % 2 ? 1 : 0;
      P.map(rows.slice(0, 15), pal, 0, bob, dir === "left");
      P.map([rows[15]], pal, 0, 15, dir === "left");
      const fl = dir === "left";
      const X = (n) => (fl ? 15 - n : n);
      if (o.hat === "elder") { P.r(4, bob + 1, 8, 1, "#ffc21a"); P.p(5, bob, "#ffc21a"); P.p(8, bob, "#ffc21a"); P.p(10, bob, "#ffc21a"); if (base === "down") { P.r(4, bob + 4, 3, 1, "#fff"); P.r(9, bob + 4, 3, 1, "#fff"); } }
      if (o.hat === "glasses" && base === "down") { P.r(4, bob + 4, 3, 3, OUT); P.r(9, bob + 4, 3, 3, OUT); P.p(5, bob + 5, "#9fd3ff"); P.p(10, bob + 5, "#9fd3ff"); P.r(7, bob + 5, 2, 1, OUT); }
      if (o.hat === "glasses" && base === "side") { P.r(X(8), bob + 4, 3, 3, OUT); P.p(X(9), bob + 5, "#9fd3ff"); }
      if (o.hat === "cap") { P.r(4, bob + 1, 8, 2, "#2346d8"); if (base !== "up") P.r(base === "side" ? (fl ? 2 : 10) : 5, bob + 3, base === "side" ? 4 : 6, 1, "#16308f"); }
      if (o.hat === "bow") { P.r(10, bob + 1, 3, 2, "#f4a6b8"); P.p(11, bob + 1, "#e57a98"); }
      if (o.hat === "pack" && base !== "down") { P.r(fl ? 10 : 1, bob + 7, 5, 6, "#a0683a"); P.r(fl ? 10 : 1, bob + 7, 5, 1, "#6b4226"); }
      if (o.hat === "pack" && base === "down") { P.r(1, bob + 9, 2, 4, "#a0683a"); P.r(13, bob + 9, 2, 4, "#a0683a"); }
      if (o.hat === "yellow") { P.r(4, bob + 1, 8, 2, "#ffc21a"); P.p(8, bob, "#e5372b"); }
    }, false);
  }
  function chick(dir, f) {
    return mk(`chick|${dir}|${f}`, 16, 16, (P) => {
      const b = f % 2;
      P.e(8, 10 - b, 5, 4, "#b8bec8", true); P.e(8, 6 - b, 4, 3, "#9aa1ad");
      if (dir !== "up") { P.p(dir === "left" ? 6 : dir === "right" ? 9 : 6, 5 - b, OUT); if (dir === "down") P.p(9, 5 - b, OUT); P.r(dir === "left" ? 4 : dir === "right" ? 11 : 7, 7 - b, 2, 1, "#ffc21a"); }
      P.r(5, 14, 2, 1, "#ffc21a"); P.r(9, 14, 2, 1, "#ffc21a");
    });
  }
  function seal(dir, f) {
    return mk(`seal|${dir}|${f}`, 16, 16, (P) => {
      const b = f % 2, side = dir === "left" || dir === "right", fl = dir === "left";
      const X = (n) => (fl ? 15 - n : n);
      if (side) {
        P.e(7, 10, 6, 4, "#b7c0cc", true); P.e(X(11), 6 - b, 4, 4, "#c9d1db", true);
        P.r(X(12), 5 - b, 1, 1, OUT); P.p(X(14), 7 - b, OUT); P.r(fl ? 1 : 12, 13, 3, 2, "#8f99a6");
        P.r(X(9) - (fl ? 3 : 0), 2 - b, 4, 2, "#1e9e5a"); P.p(X(8), 3 - b, "#5fbf5a");
      } else {
        P.e(8, 10, 6, 5, "#b7c0cc", true); P.e(8, 6 - b, 5, 4, "#c9d1db", true);
        P.r(4, 2 - b, 9, 2, "#1e9e5a"); P.p(12, 3 - b, "#5fbf5a"); P.p(13, 4 - b, "#1e9e5a");
        if (dir === "down") { P.p(6, 6 - b, OUT); P.p(10, 6 - b, OUT); P.r(7, 8 - b, 3, 1, "#5a4a4a"); P.p(5, 8 - b, "#f4a6b8"); P.p(11, 8 - b, "#f4a6b8"); P.r(6, 11, 5, 3, "#e3e8ee"); }
        P.r(2, 11 + b, 2, 3, "#8f99a6"); P.r(12, 11 - b + 1, 2, 3, "#8f99a6");
      }
    });
  }
  function puffin(dir, f) {
    return mk(`puf|${dir}|${f}`, 16, 16, (P) => {
      const b = f % 2, side = dir === "left" || dir === "right", fl = dir === "left";
      const X = (n) => (fl ? 15 - n : n);
      P.e(8, 10 - b, 5, 4, "#23232e"); P.e(8, 5 - b, 4, 4, "#23232e");
      if (dir === "down") { P.e(8, 11 - b, 3, 3, "#ffffff"); P.r(5, 4 - b, 6, 3, "#e8e8ea"); P.p(6, 5 - b, OUT); P.p(9, 5 - b, OUT); P.r(7, 6 - b, 2, 3, "#ff7a1a"); P.p(7, 7 - b, "#e5372b"); }
      if (side) { P.r(X(8) - (fl ? 3 : 0), 3 - b, 4, 4, "#e8e8ea"); P.p(X(10), 4 - b, OUT); P.tri(X(12), 4 - b, X(12), 8 - b, X(15), 6 - b, "#ff7a1a"); P.p(X(12), 7 - b, "#e5372b"); P.e(X(8), 11 - b, 2, 2, "#ffffff"); }
      P.r(5, 14, 2, 2, "#ff7a1a"); P.r(9, 14, 2, 2, "#ff7a1a");
    });
  }
  const NPC = {
    hero: { scarf: "#e5372b" }, guard: { scarf: "#2346d8", hat: "cap" }, elder: { scarf: "#8a5cc8", hat: "elder" }, scholar: { scarf: "#1e9e5a", hat: "glasses" },
    merchant: { scarf: "#ffc21a", hat: "pack" }, mom: { scarf: "#f4a6b8", hat: "bow" }, kid: { scarf: "#2346d8", hat: "yellow" }, kid2: { scarf: "#1e9e5a" },
  };
  function actor(sp, dir = "down", f = 0) {
    if (NPC[sp]) return penguin(NPC[sp], dir, f);
    if (sp === "mong") return seal(dir, f);
    if (sp === "kkak") return puffin(dir, f);
    if (sp === "chick") return chick(dir, f);
    return obj(sp, f);
  }

  // ---------- 물건 ----------
  function obj(sp, f = 0) {
    const ff = sp === "fire" ? f % 2 : 0;
    return mk(`obj|${sp}|${ff}`, 16, 16, (P) => {
      switch (sp) {
        case "chest": P.r(2, 5, 12, 9, "#a0683a"); P.r(2, 5, 12, 3, "#c4874a"); P.r(2, 8, 12, 1, "#6b4226"); P.r(7, 7, 2, 3, "#ffc21a"); P.r(2, 5, 1, 9, "#ffc21a"); P.r(13, 5, 1, 9, "#ffc21a"); break;
        case "chestOpen": P.r(2, 3, 12, 3, "#6b4226"); P.r(2, 7, 12, 7, "#a0683a"); P.r(3, 7, 10, 2, "#3a2418"); P.r(2, 7, 1, 7, "#ffc21a"); P.r(13, 7, 1, 7, "#ffc21a"); break;
        case "pepper": P.r(7, 9, 2, 6, "#2f8f3e"); P.e(5, 11, 3, 2, "#3c9a46"); P.e(11, 10, 3, 2, "#3c9a46"); P.tri(8, 2, 5, 6, 9, 9, "#e5372b"); P.p(7, 3, "#ffb38a"); P.r(9, 2, 1, 2, "#2f8f3e"); P.p(12, 5, "#fff3b0"); P.p(3, 7, "#fff3b0"); break;
        case "pepperGone": P.r(7, 9, 2, 6, "#2f8f3e"); P.e(5, 11, 3, 2, "#3c9a46"); P.e(11, 10, 3, 2, "#3c9a46"); break;
        case "sign": P.r(7, 8, 2, 8, "#6b4226"); P.r(2, 2, 12, 7, "#c4874a"); P.r(2, 2, 12, 1, "#e0a868"); P.r(4, 4, 8, 1, "#6b4226"); P.r(4, 6, 6, 1, "#6b4226"); break;
        case "fire": P.r(3, 12, 10, 2, "#6b4226"); P.r(4, 11, 8, 1, "#8a5a36"); P.tri(8, ff ? 2 : 3, 4, 12, 12, 12, "#ff6a1f"); P.tri(8, ff ? 6 : 5, 6, 12, 10, 12, "#ffc21a"); P.p(ff ? 5 : 11, ff ? 5 : 4, "#ffb02e"); break;
        case "kite": P.r(7, 4, 2, 12, "#6b4226"); P.tri(8, 0, 2, 5, 8, 10, "#2346d8"); P.tri(8, 0, 14, 5, 8, 10, "#e5372b"); P.tri(2, 5, 8, 10, 8, 5, "#ffc21a"); P.tri(14, 5, 8, 10, 8, 5, "#f2f1ec"); P.r(7, 4, 2, 2, "#141414"); break;
        case "rock": P.e(8, 9, 7, 6, "#5a4a46", true); P.p(5, 6, "#8a7a74"); P.r(6, 9, 4, 1, "#3a2a26"); break;
        case "snowman": P.e(8, 11, 5, 4, "#ffffff", true); P.e(8, 5, 4, 3, "#ffffff", true); P.p(7, 4, OUT); P.p(9, 4, OUT); P.r(8, 5, 2, 1, "#ff8a3d"); P.r(5, 1, 6, 2, "#e5372b"); P.r(14, 4, 1, 6, "#6b4226"); break;
        case "rabbitnpc": P.e(8, 11, 4, 4, "#c4874a", true); P.e(8, 6, 3, 3, "#c4874a"); P.r(6, 1, 1, 4, "#c4874a"); P.r(9, 1, 1, 4, "#c4874a"); P.p(7, 6, OUT); P.p(9, 6, OUT); P.e(13, 9, 2, 4, "#a0683a"); break;
        default: P.r(4, 4, 8, 8, "#e5372b");
      }
    });
  }

  // ---------- 몬스터(20x20) ----------
  const MON = {
    rat: (P) => { P.r(4, 7, 9, 10, "#3c9a46"); P.r(4, 7, 2, 10, "#5fbf5a"); P.r(4, 11, 9, 1, "#2b6a33"); P.e(10, 6, 4, 3, "#a3a9b1", true); P.e(7, 3, 2, 2, "#c8ccd2"); P.e(13, 3, 2, 2, "#c8ccd2"); P.p(9, 6, OUT); P.p(12, 6, OUT); P.p(14, 7, "#f4a6b8"); P.r(13, 16, 5, 1, "#f4a6b8"); P.p(17, 15, "#f4a6b8"); },
    snail: (P) => { P.r(2, 14, 16, 4, "#9fd3a0"); P.r(14, 9, 3, 6, "#9fd3a0"); P.p(14, 7, "#9fd3a0"); P.p(16, 7, "#9fd3a0"); P.p(15, 10, OUT); P.e(8, 10, 6, 6, "#2f8f3e", true); P.e(8, 10, 3, 3, "#5fbf5a"); P.p(8, 10, "#2b6a33"); P.r(9, 2, 2, 3, "#9fd3ff"); P.p(9, 2, "#fff"); },
    shoot: (P) => { P.tri(10, 1, 3, 18, 17, 18, "#c4a24a"); P.tri(10, 4, 4, 18, 10, 18, "#8f7a3a"); P.tri(10, 1, 8, 6, 12, 6, "#5fbf5a"); P.r(4, 12, 13, 1, "#8f7a3a"); P.r(5, 15, 11, 1, "#8f7a3a"); P.angry(7, 9); P.angry(11, 9); P.r(8, 12, 4, 1, OUT); },
    newt: (P) => { P.e(9, 12, 6, 3, "#ff8a3d", true); P.e(14, 9, 4, 3, "#ff8a3d", true); P.p(15, 8, OUT); P.p(17, 10, OUT); P.r(5, 15, 2, 3, "#c95f1c"); P.r(11, 15, 2, 3, "#c95f1c"); P.r(1, 11, 4, 2, "#ff8a3d"); P.tri(1, 5, 0, 11, 4, 11, "#ffc21a"); P.p(1, 7, "#fff3b0"); for (let i = 6; i < 13; i += 3) P.p(i, 10, "#ffc21a"); },
    coal: (P) => { P.r(3, 4, 14, 14, "#2e2a2a"); P.r(3, 4, 14, 2, "#4a4444"); P.r(5, 8, 3, 2, "#ffb02e"); P.r(12, 8, 3, 2, "#ffb02e"); P.p(6, 8, "#fff3b0"); P.p(13, 8, "#fff3b0"); P.r(7, 13, 6, 1, "#ff6a1f"); P.p(4, 15, "#ff6a1f"); P.p(15, 11, "#ff6a1f"); P.r(1, 9, 2, 5, "#2e2a2a"); P.r(17, 9, 2, 5, "#2e2a2a"); },
    chili: (P) => { P.tri(1, 6, 6, 9, 3, 14, "#4a2a3a"); P.tri(19, 6, 14, 9, 17, 14, "#4a2a3a"); P.e(10, 11, 4, 6, "#e5372b", true); P.r(9, 3, 2, 3, "#2f8f3e"); P.r(8, 4, 4, 1, "#3c9a46"); P.angry(8, 9); P.angry(11, 9); P.p(10, 14, "#fff"); P.p(8, 17, "#ff8a3d"); },
    bunny: (P) => { P.e(10, 12, 7, 6, "#ffffff", true); P.r(6, 1, 3, 7, "#ffffff"); P.r(12, 1, 3, 7, "#ffffff"); P.r(7, 2, 1, 5, "#f4a6b8"); P.r(13, 2, 1, 5, "#f4a6b8"); P.eye(7, 10); P.eye(12, 10); P.p(10, 13, "#f4a6b8"); P.p(4, 14, "#c6e6ff"); P.p(15, 16, "#c6e6ff"); },
    fox: (P) => { P.e(9, 12, 6, 4, "#c6e6ff", true); P.e(14, 8, 4, 4, "#c6e6ff", true); P.tri(12, 2, 11, 6, 14, 5, "#9fd3ff"); P.tri(17, 2, 15, 5, 18, 6, "#9fd3ff"); P.p(14, 8, OUT); P.p(17, 8, OUT); P.p(18, 10, OUT); P.tri(0, 4, 2, 13, 6, 11, "#ffffff"); P.tri(0, 4, 1, 9, 3, 9, "#9fd3ff"); P.r(5, 15, 2, 3, "#9fd3ff"); P.r(11, 15, 2, 3, "#9fd3ff"); },
    crab: (P) => { P.e(10, 12, 7, 4, "#e9e1d0", true); P.e(3, 7, 3, 3, "#d8cdb6", true); P.e(17, 7, 3, 3, "#d8cdb6", true); P.r(2, 4, 2, 2, "#e9e1d0"); P.r(16, 4, 2, 2, "#e9e1d0"); P.r(7, 6, 1, 3, "#8a7a64"); P.r(12, 6, 1, 3, "#8a7a64"); P.eye(6, 5); P.eye(12, 5); for (let i = 4; i < 17; i += 4) P.r(i, 16, 1, 3, "#b8ad96"); P.p(8, 11, "#fff"); P.p(13, 12, "#fff"); },
    angler: (P) => { P.e(10, 12, 8, 6, "#2a2a40", true); P.r(13, 2, 1, 6, "#4a4a5c"); P.e(15, 2, 2, 2, "#fff3b0"); P.p(15, 2, "#ffffff"); P.eye(12, 9, true); P.r(4, 15, 12, 1, "#fff"); for (let i = 5; i < 16; i += 2) P.p(i, 14, "#fff"); P.tri(1, 8, 1, 16, 4, 12, "#3a3a50"); },
    urchin: (P) => { P.e(10, 11, 6, 6, "#6a3a9a", true); for (let a = 0; a < 12; a++) { const c = Math.cos((a / 12) * Math.PI * 2), s = Math.sin((a / 12) * Math.PI * 2); P.r(Math.round(10 + c * 8), Math.round(11 + s * 8), 1, 1, "#b48ae0"); P.r(Math.round(10 + c * 7), Math.round(11 + s * 7), 1, 1, "#8a5cc8"); } P.eye(7, 9); P.eye(11, 9); },
    squid: (P) => { P.tri(10, 1, 4, 10, 16, 10, "#3a3a50"); P.e(10, 11, 5, 3, "#3a3a50", true); for (let i = 5; i < 16; i += 2) P.r(i, 13, 1, 6 - (i % 4), "#4a4a64"); P.eye(7, 9); P.eye(11, 9); P.p(10, 5, "#6a6a8a"); },
    shade: (P) => { P.e(10, 9, 7, 7, "#7a7a82", true); P.r(3, 9, 15, 7, "#7a7a82"); for (let i = 3; i < 18; i += 3) P.r(i, 16, 2, 2, "#7a7a82"); P.r(6, 7, 3, 3, "#141414"); P.r(12, 7, 3, 3, "#141414"); P.p(7, 8, "#fff"); P.p(13, 8, "#fff"); P.r(8, 12, 5, 1, "#4a4a52"); },
    soldier: (P) => { P.r(6, 7, 9, 9, "#8a8a92"); P.r(6, 7, 9, 2, "#a8a8b0"); P.e(10, 5, 4, 4, "#9a9aa2", true); P.r(7, 4, 7, 2, "#141414"); P.p(8, 4, "#ddd"); P.p(12, 4, "#ddd"); P.r(16, 1, 1, 17, "#6e6e75"); P.tri(16, 0, 15, 3, 17, 3, "#cfcfd6"); P.r(2, 8, 4, 7, "#6e6e75"); P.r(7, 16, 3, 3, "#5a5a60"); P.r(11, 16, 3, 3, "#5a5a60"); },
    jar: (P) => { P.e(10, 12, 7, 7, "#a89a8a", true); P.r(6, 3, 8, 3, "#a89a8a"); P.r(5, 3, 10, 1, "#c4b8aa"); P.r(4, 11, 13, 1, "#8a7e70"); P.eye(7, 9); P.eye(12, 9); P.r(8, 14, 5, 2, "#3a3030"); P.p(5, 15, "#c4b8aa"); },
    tentacle: (P) => { for (let j = 2; j < 19; j++) { const X = 9 + Math.round(Math.sin(j / 3) * 3); P.r(X, j, 4 - Math.floor(j / 8), 1, "#3a3a50"); } for (let j = 5; j < 18; j += 3) P.p(10 + Math.round(Math.sin(j / 3) * 3), j, "#b48ae0"); },
  };
  const BOSS = {
    b_shoot: (P) => { P.tri(18, 2, 4, 34, 32, 34, "#c4a24a"); P.tri(18, 8, 6, 34, 18, 34, "#8f7a3a"); for (let j = 14; j < 34; j += 5) P.r(7 + (34 - j) / 3, j, 22 - (34 - j) / 1.6, 1, "#8f7a3a"); P.tri(18, 0, 14, 8, 22, 8, "#5fbf5a"); P.r(12, 6, 13, 3, "#ffc21a"); P.p(12, 5, "#ffc21a"); P.p(18, 4, "#ffc21a"); P.p(24, 5, "#ffc21a"); P.p(18, 7, "#2346d8"); P.angry(13, 17); P.angry(20, 17); P.r(14, 22, 8, 2, OUT); P.r(15, 22, 2, 1, "#fff"); P.r(19, 22, 2, 1, "#fff"); P.r(3, 26, 4, 2, "#8f7a3a"); P.r(29, 26, 4, 2, "#8f7a3a"); },
    b_toad: (P) => { P.e(18, 26, 15, 8, "#3a3a3a", true); P.r(3, 18, 30, 3, "#4a4a4a"); P.r(3, 18, 30, 1, "#6a6a6a"); P.e(18, 15, 11, 7, "#5fa34a", true); P.e(11, 9, 4, 4, "#5fa34a", true); P.e(25, 9, 4, 4, "#5fa34a", true); P.eye(10, 8, true); P.eye(24, 8, true); P.r(12, 17, 12, 2, "#e5372b"); P.r(14, 17, 2, 2, "#ffc21a"); P.p(20, 16, "#e5372b"); P.r(6, 31, 4, 3, "#ff6a1f"); P.r(16, 32, 4, 2, "#ffc21a"); P.r(26, 31, 4, 3, "#ff6a1f"); P.p(5, 14, "#c6e6ff"); P.p(31, 12, "#c6e6ff"); },
    b_owl: (P) => { P.e(18, 22, 12, 12, "#e9e9ee", true); P.e(18, 12, 10, 9, "#dcdce4", true); P.r(9, 2, 18, 5, "#6e6e75"); P.r(9, 2, 18, 1, "#a8a8b0"); P.tri(18, 0, 16, 3, 20, 3, "#e5372b"); P.e(13, 12, 4, 4, "#ffffff"); P.e(23, 12, 4, 4, "#ffffff"); P.e(13, 12, 2, 2, "#ffc21a"); P.e(23, 12, 2, 2, "#ffc21a"); P.p(13, 12, OUT); P.p(23, 12, OUT); P.tri(18, 15, 16, 18, 20, 18, "#ff8a3d"); P.tri(4, 16, 8, 32, 12, 18, "#c4c4cc"); P.tri(32, 16, 28, 32, 24, 18, "#c4c4cc"); for (let j = 22; j < 32; j += 3) P.r(14, j, 9, 1, "#c4c4cc"); P.r(33, 6, 2, 26, "#a8a8b0"); P.tri(34, 2, 32, 7, 35, 7, "#ffffff"); },
    b_octo: (P) => { P.e(18, 12, 12, 10, "#5a2a6a", true); for (let k = 0; k < 6; k++) { const X0 = 6 + k * 5; for (let j = 20; j < 35; j++) P.r(X0 + Math.round(Math.sin(j / 2.5 + k) * 2), j, 3 - Math.floor((j - 20) / 7), 1, "#5a2a6a"); } P.e(13, 12, 3, 3, "#fff"); P.e(23, 12, 3, 3, "#fff"); P.p(13, 12, OUT); P.p(23, 12, OUT); P.r(9, 10, 8, 1, OUT); P.r(19, 10, 8, 1, OUT); P.r(16, 11, 4, 1, OUT); P.r(15, 17, 6, 1, "#2a1030"); P.r(24, 22, 10, 8, "#e5372b"); P.r(25, 23, 8, 6, "#f2f1ec"); P.r(29, 22, 1, 8, "#b8261c"); P.p(10, 6, "#8a5cc8"); P.p(25, 5, "#8a5cc8"); },
    b_mu: (P) => { P.e(18, 18, 15, 14, "#8a8a90", true); P.e(9, 8, 6, 5, "#9a9aa0", true); P.e(27, 9, 6, 5, "#9a9aa0", true); P.e(18, 5, 6, 4, "#a4a4aa", true); P.e(12, 17, 4, 3, "#141414"); P.e(24, 17, 4, 3, "#141414"); P.r(11, 16, 2, 2, "#ffffff"); P.r(23, 16, 2, 2, "#ffffff"); P.r(13, 25, 10, 2, "#4a4a52"); for (let i = 4; i < 33; i += 4) P.r(i, 31, 3, 4, "#7a7a82"); P.p(5, 20, "#c4c4cc"); P.p(30, 14, "#c4c4cc"); },
    b_mu2: (P) => { P.e(18, 18, 16, 15, "#3a3a42", true); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; P.tri(18 + Math.round(Math.cos(a) * 12), 18 + Math.round(Math.sin(a) * 12), 18 + Math.round(Math.cos(a + 0.2) * 17), 18 + Math.round(Math.sin(a + 0.2) * 17), 18 + Math.round(Math.cos(a - 0.15) * 14), 18 + Math.round(Math.sin(a - 0.15) * 14), "#2a2a30"); } P.e(18, 18, 7, 7, "#141414"); P.e(18, 18, 3, 3, "#d8d8de"); P.p(18, 18, "#ffffff"); P.r(8, 10, 5, 2, "#d8d8de"); P.r(23, 10, 5, 2, "#d8d8de"); },
  };
  function monster(id, f = 0) {
    const big = !!BOSS[id];
    const fn = BOSS[id] || MON[id] || MON.shade;
    return mk(`mon|${id}`, big ? 36 : 20, big ? 36 : 20, (P) => fn(P));
  }
  // 하얗게 깜빡이는 피격용 실루엣
  function flash(src) {
    const key = src;
    if (flash.c.has(key)) return flash.c.get(key);
    const c = canvas(src.width, src.height), x = c.getContext("2d");
    x.drawImage(src, 0, 0); x.globalCompositeOperation = "source-atop"; x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height);
    flash.c.set(key, c);
    return c;
  }
  flash.c = new Map();

  // 3x5 숫자 글꼴(피해 숫자)
  const DIG = { 0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001111001111", 4: "101101111001001", 5: "111100111001111", 6: "111100111101111", 7: "111001010010010", 8: "111101111101111", 9: "111101111001111", "+": "000010111010000", "-": "000000111000000" };
  function num(x, s, X, Y, c) {
    [...String(s)].forEach((ch, k) => {
      const g = DIG[ch]; if (!g) return;
      for (let i = 0; i < 15; i++) if (g[i] === "1") { x.fillStyle = OUT; x.fillRect(X + k * 4 + (i % 3) - 1, Y + Math.floor(i / 3), 3, 1); x.fillRect(X + k * 4 + (i % 3), Y + Math.floor(i / 3) - 1, 1, 3); }
      for (let i = 0; i < 15; i++) if (g[i] === "1") { x.fillStyle = c; x.fillRect(X + k * 4 + (i % 3), Y + Math.floor(i / 3), 1, 1); }
    });
  }

  // 전투 배경
  function battleBg(x, theme, W, H) {
    const t = TH[theme] || TH.forest;
    const sky = { village: ["#bfe3ff", "#eef3f8"], forest: ["#9fd8a0", "#cfeec0"], maze: ["#3f7a37", "#6aa85c"], volcano: ["#5a1e1a", "#c4502a"], kiln: ["#3a1a12", "#8a3a22"], snow: ["#bcd8f0", "#f6f8fb"], fort: ["#8fbfe6", "#d8ecfa"], sea: ["#0a1430", "#1d3a70"], lib: ["#2a180e", "#5a3a28"], tower: ["#6e6e75", "#c4c4cc"] }[theme] || ["#9fd8a0", "#cfeec0"];
    const g = x.createLinearGradient(0, 0, 0, H * 0.62);
    g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 18; i++) { x.fillStyle = dk(sky[0], 0.15); x.fillRect(Math.floor(hash(i, 1, theme.length) * W), Math.floor(hash(i, 2, 3) * H * 0.5), 2, 1); }
    x.fillStyle = t.g; x.fillRect(0, Math.floor(H * 0.55), W, H);
    x.fillStyle = t.g2; for (let i = 0; i < 40; i++) x.fillRect(Math.floor(hash(i, 5) * W), Math.floor(H * 0.55 + hash(i, 6) * H * 0.45), 3, 1);
    x.fillStyle = dk(t.g, 0.25); x.fillRect(0, Math.floor(H * 0.55), W, 1);
    // 테마 장식
    if (theme === "forest" || theme === "maze") for (let k = 0; k < 7; k++) { const X = Math.floor(hash(k, 9) * W); x.fillStyle = k % 2 ? t.tree : lt(t.tree, 0.15); x.fillRect(X, 0, 4, Math.floor(H * 0.55)); x.fillStyle = dk(t.tree, 0.3); for (let j = 6; j < H * 0.55; j += 9) x.fillRect(X, j, 4, 1); }
    if (theme === "volcano" || theme === "kiln") { x.fillStyle = "#2e2224"; x.beginPath(); x.moveTo(0, H * 0.55); x.lineTo(W * 0.3, H * 0.15); x.lineTo(W * 0.55, H * 0.55); x.fill(); x.fillStyle = "#ff6a1f"; x.fillRect(W * 0.3 - 2, H * 0.15, 4, 3); }
    if (theme === "lib") for (let k = 0; k < W; k += 16) { const c = canvas(16, 16); const P = pen(c.getContext("2d")); bookshelf(P, k, 3); x.drawImage(c, k, 8); x.drawImage(c, k, 24); }
    if (theme === "sea") { x.fillStyle = "#1f4a96"; for (let i = 0; i < 6; i++) x.fillRect(Math.floor(hash(i, 4) * W), Math.floor(H * 0.25 + hash(i, 8) * 30), 10, 1); }
    if (theme === "tower") { x.fillStyle = "#8a8a90"; for (let k = 8; k < W; k += 40) { x.fillRect(k, 0, 10, H * 0.55); x.fillStyle = "#a8a8b0"; x.fillRect(k, 0, 3, H * 0.55); x.fillStyle = "#8a8a90"; } }
    if (theme === "snow" || theme === "fort" || theme === "village") { x.fillStyle = "#ffffff"; for (let i = 0; i < 25; i++) x.fillRect(Math.floor(hash(i, 11) * W), Math.floor(hash(i, 12) * H * 0.6), 1, 1); }
  }

  RPG.art = { tile: tileCanvas, actor, obj, monster, flash, num, battleBg, OUT, BIG: (id) => !!BOSS[id] };
})();
