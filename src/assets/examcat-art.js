// P2-74c 커닝냥이(이름은 examcat-data.js NAME) — 벡터 일러스트 그리기. 이미지 파일 없이 캔버스 도형(곡선·면·그라데이션)으로만 그림. 도트(픽셀) 아님.
// 좌표는 논리 크기 360×320 기준. 게임(examcat.js)이 캔버스 배율을 맞춰 부름.
(function () {
  const S = (window.EXCAT = window.EXCAT || {});
  const W = 360, H = 320;
  const OL = "#2a2633"; // 외곽선
  const CAT = { x: 180, y: 252, r: 24 }; // 고양이 머리(시선 판정 기준점)
  const ROW1 = [60, 180, 300], ROW1_Y = 146, ROW2_Y = 250;
  const TAU = Math.PI * 2;
  const deg = (d) => (d * Math.PI) / 180;

  // ---------- 기본 도구 ----------
  function rr(x, X, Y, w, h, r) {
    x.beginPath();
    r = Math.min(r, w / 2, h / 2);
    x.moveTo(X + r, Y); x.lineTo(X + w - r, Y); x.quadraticCurveTo(X + w, Y, X + w, Y + r);
    x.lineTo(X + w, Y + h - r); x.quadraticCurveTo(X + w, Y + h, X + w - r, Y + h);
    x.lineTo(X + r, Y + h); x.quadraticCurveTo(X, Y + h, X, Y + h - r);
    x.lineTo(X, Y + r); x.quadraticCurveTo(X, Y, X + r, Y); x.closePath();
  }
  function ell(x, cx, cy, rx, ry, rot = 0) { x.beginPath(); x.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }
  function fillStroke(x, fill, lw = 2, stroke = OL) { if (fill) { x.fillStyle = fill; x.fill(); } if (lw) { x.lineWidth = lw; x.strokeStyle = stroke; x.lineJoin = "round"; x.lineCap = "round"; x.stroke(); } }
  function txt(x, s, X, Y, size, col, { align = "center", weight = 800, base = "middle", font, stroke } = {}) {
    x.font = `${weight} ${size}px ${font || S.FONT || "sans-serif"}`; x.textAlign = align; x.textBaseline = base;
    if (stroke) { x.lineWidth = stroke[1]; x.strokeStyle = stroke[0]; x.lineJoin = "round"; x.strokeText(s, X, Y); }
    x.fillStyle = col; x.fillText(s, X, Y);
  }

  // ---------- 교실 ----------
  const THEMES = {
    day: { wall: ["#fff4df", "#ffe9c4"], floor: ["#f0cf9f", "#e2b47c"], win: ["#bfe6ff", "#e8f7ff"], board: "#2f6153" },
    noon: { wall: ["#eaf4ff", "#d6e8fb"], floor: ["#e9d2ad", "#d9b98a"], win: ["#9fd7ff", "#dff3ff"], board: "#2c5a4e" },
    dusk: { wall: ["#ffe6d2", "#f9cfae"], floor: ["#dcb48a", "#c99868"], win: ["#ff9a6b", "#ffd28a"], board: "#284f45" },
    hall: { wall: ["#e3e7f5", "#cdd4ec"], floor: ["#c9cfe0", "#b2b9d1"], win: ["#a8b8ff", "#dfe5ff"], board: "#23463d" },
  };
  function room(x, st) {
    const th = THEMES[st.theme] || THEMES.day;
    let g = x.createLinearGradient(0, 0, 0, 108); g.addColorStop(0, th.wall[0]); g.addColorStop(1, th.wall[1]);
    x.fillStyle = g; x.fillRect(0, 0, W, 108);
    g = x.createLinearGradient(0, 104, 0, H); g.addColorStop(0, th.floor[0]); g.addColorStop(1, th.floor[1]);
    x.fillStyle = g; x.fillRect(0, 104, W, H - 104);
    // 마루 줄(원근)
    x.strokeStyle = "rgba(120,80,40,.14)"; x.lineWidth = 1.5;
    for (let i = -6; i <= 6; i++) { x.beginPath(); x.moveTo(W / 2 + i * 34, 104); x.lineTo(W / 2 + i * 92, H); x.stroke(); }
    x.fillStyle = "rgba(90,60,30,.18)"; x.fillRect(0, 102, W, 4);
    // 칠판
    rr(x, 78, 12, 204, 56, 8); fillStroke(x, "#b98a55", 2);
    rr(x, 84, 17, 192, 46, 5); x.fillStyle = th.board; x.fill();
    x.globalAlpha = 0.1; ell(x, 140, 30, 40, 9, -0.1); x.fillStyle = "#fff"; x.fill(); x.globalAlpha = 1;
    txt(x, st.boardTitle || "시험 중", 180, 33, 15, "#f6f3e8", { font: S.FONT });
    txt(x, st.boardSub || "휴대폰은 가방에", 180, 52, 11, "rgba(246,243,232,.8)", { weight: 700 });
    if (st.chalk) { x.strokeStyle = "rgba(246,243,232,.75)"; x.lineWidth = 1.6; x.beginPath(); const L = 30 * st.chalk; x.moveTo(214, 52); x.lineTo(214 + L, 52); x.stroke(); }
    rr(x, 150, 66, 60, 5, 2); fillStroke(x, "#9c7244", 1.5);
    // 시계(남은 시간 고리)
    const cx = 36, cy = 34;
    ell(x, cx, cy, 19, 19); fillStroke(x, "#fff", 2.5);
    const fr = Math.max(0, Math.min(1, st.timeFrac == null ? 1 : st.timeFrac));
    x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, 15, -Math.PI / 2, -Math.PI / 2 + TAU * fr); x.closePath();
    x.fillStyle = fr < 0.25 ? "rgba(229,55,43,.55)" : "rgba(255,194,26,.6)"; x.fill();
    x.strokeStyle = OL; x.lineWidth = 2.2; x.beginPath(); x.moveTo(cx, cy); const ha = -Math.PI / 2 + TAU * fr; x.lineTo(cx + Math.cos(ha) * 12, cy + Math.sin(ha) * 12); x.stroke();
    ell(x, cx, cy, 2.2, 2.2); x.fillStyle = OL; x.fill();
    // 오른쪽 창문 또는 현수막
    if (st.theme === "hall") { // 자격시험장: 창 없는 벽 + 국기 대신 시험장 표지
      rr(x, 300, 30, 50, 18, 4); fillStroke(x, "#2346d8", 1.5);
      txt(x, "시험장", 325, 39.5, 9.5, "#fff", { weight: 800 });
    } else {
      rr(x, 300, 18, 50, 46, 5); fillStroke(x, "#fff", 2);
      g = x.createLinearGradient(0, 22, 0, 60); g.addColorStop(0, th.win[0]); g.addColorStop(1, th.win[1]);
      rr(x, 304, 22, 42, 38, 3); x.fillStyle = g; x.fill();
      x.strokeStyle = "#fff"; x.lineWidth = 2; x.beginPath(); x.moveTo(325, 22); x.lineTo(325, 60); x.moveTo(304, 41); x.lineTo(346, 41); x.stroke();
      if (st.theme === "dusk") { ell(x, 316, 52, 6, 6); x.fillStyle = "#fff2a8"; x.fill(); }
    }
  }
  function desk(x, cx, topY, w, s = 1) {
    const h = 22 * s;
    rr(x, cx - w / 2, topY, w, h, 5 * s); fillStroke(x, "#f7e3c3", 2);
    x.fillStyle = "rgba(150,100,50,.18)"; x.fillRect(cx - w / 2 + 3, topY + h - 5 * s, w - 6, 3 * s);
    x.strokeStyle = OL; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - w / 2 + 8 * s, topY + h); x.lineTo(cx - w / 2 + 8 * s, topY + h + 16 * s); x.moveTo(cx + w / 2 - 8 * s, topY + h); x.lineTo(cx + w / 2 - 8 * s, topY + h + 16 * s); x.stroke();
  }
  function paper(x, X, Y, s, rot = 0) {
    x.save(); x.translate(X, Y); x.rotate(rot);
    rr(x, -12 * s, -8 * s, 24 * s, 16 * s, 2); fillStroke(x, "#fff", 1.2);
    x.strokeStyle = "#9aa3b5"; x.lineWidth = 1; x.beginPath(); for (let i = 0; i < 3; i++) { x.moveTo(-8 * s, (-3 + i * 4) * s); x.lineTo(8 * s, (-3 + i * 4) * s); } x.stroke();
    x.restore();
  }

  // ---------- 다른 수험생(뒷모습) ----------
  const STUDENTS = { rabbit: "#f4f1f6", dog: "#c98d5a", bear: "#9a6b4a", duck: "#ffd65a", fox: "#ef8b45" };
  function student(x, cx, cy, s, kind, t, k = 0) {
    const col = STUDENTS[kind] || "#ddd";
    const bob = Math.sin(t * 1.3 + k) * 0.8;
    x.save(); x.translate(cx, cy + bob); x.scale(s, s);
    // 몸
    x.beginPath(); x.moveTo(-20, 40); x.quadraticCurveTo(-22, 14, 0, 12); x.quadraticCurveTo(22, 14, 20, 40); x.closePath(); fillStroke(x, col, 2);
    // 귀
    if (kind === "rabbit") { ell(x, -8, -26, 5.5, 16, -0.15); fillStroke(x, col, 2); ell(x, 8, -26, 5.5, 16, 0.15); fillStroke(x, col, 2); ell(x, -8, -26, 2.5, 11, -0.15); x.fillStyle = "#f7c6d4"; x.fill(); ell(x, 8, -26, 2.5, 11, 0.15); x.fill(); }
    else if (kind === "dog") { ell(x, -15, -2, 6, 12, 0.35); fillStroke(x, "#8a5a33", 2); ell(x, 15, -2, 6, 12, -0.35); fillStroke(x, "#8a5a33", 2); }
    else if (kind === "bear") { ell(x, -12, -12, 6, 6); fillStroke(x, col, 2); ell(x, 12, -12, 6, 6); fillStroke(x, col, 2); }
    else if (kind === "fox") { x.beginPath(); x.moveTo(-15, -6); x.lineTo(-11, -22); x.lineTo(-3, -11); x.closePath(); fillStroke(x, col, 2); x.beginPath(); x.moveTo(15, -6); x.lineTo(11, -22); x.lineTo(3, -11); x.closePath(); fillStroke(x, col, 2); }
    // 머리
    ell(x, 0, 0, kind === "duck" ? 14 : 15, 14); fillStroke(x, col, 2);
    if (kind === "duck") { x.beginPath(); x.moveTo(-2, -14); x.quadraticCurveTo(0, -20, 3, -14); fillStroke(x, null, 2); }
    x.restore();
  }

  // ---------- 고양이 수험생(뒷모습) ----------
  const FUR = "#f5a85c", FUR2 = "#e58a3a", PINK = "#f6b8c2";
  function cat(x, o) {
    const { t = 0, pose = "write", tool = "phone", exposed = false, using = false, busted = 0, sweat = 0, snap = 0, say = "" } = o;
    const cx = CAT.x, cy = CAT.y;
    const lean = pose === "ai" ? 1 : 0;
    const shake = busted > 0 ? Math.sin(t * 60) * 2.2 * busted : 0;
    x.save(); x.translate(cx + shake, cy + lean * 5);
    // 꼬리
    const sw = Math.sin(t * (using ? 7 : 2.2)) * (using ? 10 : 6);
    x.beginPath(); x.moveTo(20, 56); x.bezierCurveTo(52, 60, 48 + sw, 24, 40 + sw, 14);
    x.lineWidth = 11; x.strokeStyle = OL; x.lineCap = "round"; x.stroke(); x.lineWidth = 7; x.strokeStyle = FUR; x.stroke();
    if (tool === "earbud" && exposed) { ell(x, 40 + sw, 14, 4, 4); fillStroke(x, "#ffffff", 1.5); ell(x, 40 + sw, 14, 1.6, 1.6); x.fillStyle = "#26d7ff"; x.fill(); }
    // 몸(등)
    x.beginPath(); x.moveTo(-30, 80); x.quadraticCurveTo(-34, 24, 0, 20); x.quadraticCurveTo(34, 24, 30, 80); x.closePath(); fillStroke(x, FUR, 2.2);
    x.strokeStyle = FUR2; x.lineWidth = 3.2; x.lineCap = "round";
    [[-14, 34, -8, 44], [0, 30, 0, 44], [14, 34, 8, 44]].forEach(([a, b, c, d]) => { x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); });
    // 털 곤두섬(들켰을 때)
    if (busted > 0) { x.strokeStyle = OL; x.lineWidth = 2; for (let i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(i * 8, 22); x.lineTo(i * 9, 14 - Math.abs(i)); x.stroke(); } }
    // 오른팔(쓰기)
    const wr = pose === "write" ? Math.sin(t * 14) * 3 : 0;
    x.save(); x.translate(24, 30);
    x.rotate(pose === "ai" ? 0.9 : -0.7 + wr * 0.03);
    rr(x, -5, -4, 10, 24, 5); fillStroke(x, FUR, 2);
    x.restore();
    if (pose === "write") { x.save(); x.translate(30 + wr, 4); x.rotate(0.5); rr(x, -1.5, -10, 3, 14, 1); fillStroke(x, "#ffd34d", 1.2); x.restore(); }
    // 머리
    const hy = -2 + lean * 3;
    x.beginPath(); x.moveTo(-19, hy - 12); x.lineTo(-16, hy - 34); x.lineTo(-3, hy - 20); x.closePath(); fillStroke(x, FUR, 2.2);
    x.beginPath(); x.moveTo(19, hy - 12); x.lineTo(16, hy - 34); x.lineTo(3, hy - 20); x.closePath(); fillStroke(x, FUR, 2.2);
    x.beginPath(); x.moveTo(-15, hy - 17); x.lineTo(-14.5, hy - 28); x.lineTo(-7, hy - 20); x.closePath(); x.fillStyle = PINK; x.fill();
    x.beginPath(); x.moveTo(15, hy - 17); x.lineTo(14.5, hy - 28); x.lineTo(7, hy - 20); x.closePath(); x.fill();
    ell(x, 0, hy, 24, 21); fillStroke(x, FUR, 2.2);
    x.strokeStyle = FUR2; x.lineWidth = 3; [-8, 0, 8].forEach((d) => { x.beginPath(); x.moveTo(d, hy - 19); x.lineTo(d * 0.8, hy - 11); x.stroke(); });
    // 머리띠
    x.save(); x.beginPath(); ell(x, 0, hy, 24, 21); x.clip();
    x.fillStyle = "#fff"; x.fillRect(-26, hy - 4, 52, 8);
    x.restore();
    x.beginPath(); x.moveTo(-24, hy - 4); x.lineTo(24, hy - 4); x.moveTo(-24, hy + 4); x.lineTo(24, hy + 4); x.strokeStyle = "rgba(0,0,0,.12)"; x.lineWidth = 1; x.stroke();
    ell(x, 0, hy, 24, 21); fillStroke(x, null, 2.2);
    x.beginPath(); x.moveTo(22, hy); x.lineTo(32, hy + 6); x.lineTo(30, hy - 3); x.closePath(); fillStroke(x, "#fff", 1.4);
    // AI 도구(플레이어만 보이는 쪽)
    if (exposed) {
      const glow = using ? 0.85 + Math.sin(t * 18) * 0.15 : 0.45;
      if (tool === "phone") {
        x.save(); x.translate(-30, 42); x.rotate(-0.25);
        x.globalAlpha = 0.35 * glow; ell(x, 0, -6, 22, 16); x.fillStyle = "#7fe3ff"; x.fill(); x.globalAlpha = 1;
        rr(x, -9, -13, 18, 26, 4); fillStroke(x, "#222837", 2);
        rr(x, -6.5, -10, 13, 19, 2); x.fillStyle = using ? "#9ff0ff" : "#4a6c86"; x.fill();
        txt(x, "AI", 0, -1, 8, "#163049", { weight: 900 });
        x.restore();
        ell(x, -22, 34, 7, 6); fillStroke(x, FUR, 2); // 앞발
      } else if (tool === "glasses") {
        x.strokeStyle = OL; x.lineWidth = 2.4; x.beginPath(); x.moveTo(-24, hy - 2); x.lineTo(-27, hy + 4); x.moveTo(24, hy - 2); x.lineTo(27, hy + 4); x.stroke();
        x.globalAlpha = 0.5 * glow; ell(x, -27, hy + 2, 9, 7); x.fillStyle = "#b28bff"; x.fill(); ell(x, 27, hy + 2, 9, 7); x.fill(); x.globalAlpha = 1;
        ell(x, -27, hy + 2, 3, 3); x.fillStyle = "#e7dcff"; x.fill(); ell(x, 27, hy + 2, 3, 3); x.fill();
      } else if (tool === "earbud") {
        ell(x, 17, hy - 20, 4.5, 4.5); fillStroke(x, "#fff", 1.6); ell(x, 17, hy - 20, 1.8, 1.8); x.fillStyle = "#26d7ff"; x.fill();
        if (using) { x.strokeStyle = "rgba(38,215,255,.8)"; x.lineWidth = 1.6; [7, 11].forEach((r) => { x.beginPath(); x.arc(17, hy - 20, r, -1.2, -0.2); x.stroke(); }); }
      } else if (tool === "pen") {
        x.save(); x.translate(-34, 6); x.rotate(-0.5);
        x.globalAlpha = 0.4 * glow; ell(x, 0, -10, 10, 16); x.fillStyle = "#ffe066"; x.fill(); x.globalAlpha = 1;
        rr(x, -3, -20, 6, 26, 2); fillStroke(x, "#5b6bff", 1.6); rr(x, -3, -20, 6, 6, 2); x.fillStyle = using ? "#fff6a8" : "#c9d0ff"; x.fill();
        x.restore();
        ell(x, -26, 14, 6.5, 6); fillStroke(x, FUR, 2);
      }
    }
    // 식은땀
    if (sweat > 0) { x.globalAlpha = Math.min(1, sweat); for (let i = 0; i < 2; i++) { const dy = ((t * 30 + i * 9) % 18); x.beginPath(); x.moveTo(-30 - i * 5, hy - 14 + dy); x.quadraticCurveTo(-34 - i * 5, hy - 6 + dy, -30 - i * 5, hy - 4 + dy); x.quadraticCurveTo(-26 - i * 5, hy - 6 + dy, -30 - i * 5, hy - 14 + dy); x.fillStyle = "#7cc8ff"; x.fill(); } x.globalAlpha = 1; }
    x.restore();
    // 찰칵(찍는 중): 가슴 단추 카메라 + 번쩍
    if (snap > 0) {
      const fx = cx - 6, fy = cy + 34;
      ell(x, fx, fy, 4, 4); fillStroke(x, "#222837", 1.5); ell(x, fx, fy, 1.6, 1.6); x.fillStyle = "#7fe3ff"; x.fill();
      x.strokeStyle = "rgba(255,255,255,.95)"; x.lineWidth = 2;
      x.beginPath(); x.arc(fx, fy, 7 + snap * 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * snap); x.strokeStyle = "#ffc21a"; x.lineWidth = 3; x.stroke();
      if (snap > 0.92) { x.save(); x.globalAlpha = 0.9; x.fillStyle = "#fff"; x.beginPath(); for (let j = 0; j < 8; j++) { const a = (j * Math.PI) / 4, r2 = j % 2 ? 5 : 16; x.lineTo(fx + Math.cos(a) * r2, fy + Math.sin(a) * r2); } x.closePath(); x.fill(); x.restore(); txt(x, "찰칵", fx - 26, fy - 8, 10, "#2a2633", { weight: 900 }); }
    }
    // 이어폰 자막(정답 듣기·전송 연출, 플레이어만 보임)
    if (say) {
      x.font = `900 11px ${S.FONT || "sans-serif"}`;
      const tw = x.measureText(say).width + 18, bx = Math.min(W - tw - 4, cx + 26), by = cy - 92;
      rr(x, bx, by, tw, 22, 11); fillStroke(x, "#fff6c8", 1.8, "#6b4ce6");
      x.beginPath(); x.moveTo(bx + 10, by + 22); x.lineTo(cx + 18, cy - 46); x.lineTo(bx + 22, by + 22); x.closePath(); x.fillStyle = "#fff6c8"; x.fill();
      txt(x, say, bx + tw / 2, by + 11.5, 11, "#3b2a8f", { weight: 900 });
    }
    // AI 말풍선(쓰는 중)
    if (using && !say) {
      const bx = cx - 62, by = cy - 52;
      rr(x, bx - 22, by - 11, 44, 22, 10); fillStroke(x, "#efe6ff", 1.6, "#6b4ce6");
      x.beginPath(); x.moveTo(bx + 10, by + 10); x.lineTo(bx + 20, by + 20); x.lineTo(bx + 16, by + 8); x.closePath(); x.fillStyle = "#efe6ff"; x.fill();
      for (let i = 0; i < 3; i++) { const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 9 - i * 0.9)); x.globalAlpha = a; ell(x, bx - 9 + i * 9, by, 2.6, 2.6); x.fillStyle = "#6b4ce6"; x.fill(); }
      x.globalAlpha = 1;
    }
  }

  // ---------- 펭귄 감독관 ----------
  // o: { x, y(발), s, face: back|side|front, dir(-1|1), look(라디안, 눈동자 방향), role: ta|boss|patrol, paper: null|read|fold|down|rustle, walk, t }
  function penguin(x, o) {
    const s = o.s || 1, t = o.t || 0;
    const bob = o.walk ? Math.abs(Math.sin(t * 9)) * 2.5 : 0;
    x.save(); x.translate(o.x, o.y - bob); x.scale(s, s);
    const big = o.role === "boss" ? 1.12 : 1;
    x.scale(big, big);
    // 발
    x.fillStyle = "#ff9f1c";
    const st = o.walk ? Math.sin(t * 9) * 3 : 0;
    ell(x, -8 + st, 0, 7, 3.5); fillStroke(x, "#ff9f1c", 1.6); ell(x, 8 - st, 0, 7, 3.5); fillStroke(x, "#ff9f1c", 1.6);
    // 몸
    x.beginPath(); x.moveTo(-20, -6); x.bezierCurveTo(-26, -40, -16, -64, 0, -64); x.bezierCurveTo(16, -64, 26, -40, 20, -6); x.quadraticCurveTo(0, 2, -20, -6); x.closePath();
    fillStroke(x, "#2b3040", 2.2);
    const face = o.face || "front", dir = o.dir || 1;
    if (face !== "back") {
      // 배
      x.beginPath();
      if (face === "front") { x.moveTo(-13, -6); x.bezierCurveTo(-18, -30, -12, -44, 0, -44); x.bezierCurveTo(12, -44, 18, -30, 13, -6); x.quadraticCurveTo(0, -1, -13, -6); }
      else { const b = dir * 5; x.moveTo(-9 + b, -6); x.bezierCurveTo(-13 + b, -30, -8 + b, -42, 2 + b, -42); x.bezierCurveTo(12 + b, -42, 16 + b, -28, 12 + b, -6); x.quadraticCurveTo(2 + b, -1, -9 + b, -6); }
      x.closePath(); x.fillStyle = "#fbfaf7"; x.fill();
      // 얼굴 흰 부분
      if (face === "front") { ell(x, -7, -50, 7, 6); x.fillStyle = "#fbfaf7"; x.fill(); ell(x, 7, -50, 7, 6); x.fill(); }
      else { ell(x, dir * 8, -50, 7, 6); x.fillStyle = "#fbfaf7"; x.fill(); }
      // 눈
      const lx = Math.cos(o.look || Math.PI / 2) * 1.8, ly = Math.sin(o.look || Math.PI / 2) * 1.6;
      const eyes = face === "front" ? [-7, 7] : [dir * 9];
      if (o.sleep) { x.strokeStyle = OL; x.lineWidth = 1.8; eyes.forEach((ex) => { x.beginPath(); x.arc(ex, -51, 3, 0.2, Math.PI - 0.2); x.stroke(); }); }
      else eyes.forEach((ex) => { ell(x, ex + lx, -50 + ly, 2.6, 2.9); x.fillStyle = OL; x.fill(); ell(x, ex + lx + 0.8, -51 + ly, 0.9, 0.9); x.fillStyle = "#fff"; x.fill(); });
      // 안경(조교)
      if (o.role === "ta") { x.strokeStyle = OL; x.lineWidth = 1.6; eyes.forEach((ex) => { x.beginPath(); x.arc(ex, -50, 5.5, 0, TAU); x.stroke(); }); if (eyes.length === 2) { x.beginPath(); x.moveTo(-1.5, -50); x.lineTo(1.5, -50); x.stroke(); } }
      // 부리
      x.beginPath();
      if (face === "front") { x.moveTo(-5, -43); x.lineTo(5, -43); x.lineTo(0, -36); }
      else { x.moveTo(dir * 12, -46); x.lineTo(dir * 22, -42); x.lineTo(dir * 12, -39); }
      x.closePath(); fillStroke(x, "#ffb020", 1.6);
      // 콧수염(부장)
      if (o.role === "boss" && face === "front") { x.beginPath(); x.moveTo(0, -40); x.quadraticCurveTo(-8, -36, -12, -40); x.moveTo(0, -40); x.quadraticCurveTo(8, -36, 12, -40); x.strokeStyle = "#c9ccd6"; x.lineWidth = 3; x.stroke(); }
      // 넥타이(부장)
      if (o.role === "boss") { x.beginPath(); x.moveTo(-3, -33); x.lineTo(3, -33); x.lineTo(4, -20); x.lineTo(0, -16); x.lineTo(-4, -20); x.closePath(); fillStroke(x, "#e5372b", 1.4); }
    }
    // 날개 + 완장
    const flap = o.walk ? Math.sin(t * 9) * 0.15 : 0;
    [-1, 1].forEach((side) => {
      x.save(); x.translate(side * 19, -36); x.rotate(side * (0.25 + flap));
      x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(side * 9, 14, side * 3, 28); x.quadraticCurveTo(-side * 2, 14, 0, 0); x.closePath(); fillStroke(x, "#2b3040", 2);
      if (side === -1) { x.fillStyle = "#e5372b"; x.fillRect(-7, 6, 9, 6); }
      x.restore();
    });
    // 모자(순찰)
    if (o.role === "patrol") { x.beginPath(); x.moveTo(-14, -60); x.quadraticCurveTo(0, -74, 14, -60); x.closePath(); fillStroke(x, "#2346d8", 2); x.beginPath(); x.moveTo(-16, -60); x.lineTo(face === "back" ? 16 : 16 + (face === "side" ? dir * 6 : 4), -59); x.strokeStyle = "#1b2f8f"; x.lineWidth = 3; x.stroke(); ell(x, 0, -66, 2.5, 2.5); x.fillStyle = "#ffc21a"; x.fill(); }
    // 돋보기(안경 검사 펭귄)
    if (o.role === "patrol" && face !== "back") { const mx = (face === "side" ? dir : 1) * 26, my = -26; x.strokeStyle = "#8a5a33"; x.lineWidth = 3; x.beginPath(); x.moveTo(mx - 4, my + 8); x.lineTo(mx - 9, my + 16); x.stroke(); ell(x, mx, my, 7, 7); fillStroke(x, "rgba(190,230,255,.7)", 2); }
    // 신문(부장)
    if (o.paper && o.paper !== "down") {
      const rs = o.paper === "rustle" ? Math.sin(t * 40) * 2 : 0;
      x.save(); x.translate(0, -48 + rs * 0.3); x.rotate(rs * 0.02);
      x.beginPath(); x.moveTo(-24, -14); x.lineTo(24, -14); x.lineTo(24, 12); if (o.paper === "fold") { x.lineTo(10, 12); x.lineTo(24, -2); x.moveTo(10, 12); } x.lineTo(-24, 12); x.closePath();
      fillStroke(x, "#f4f1e8", 1.8);
      x.fillStyle = "#3d3d3d"; x.fillRect(-20, -10, 18, 4); x.fillStyle = "#9aa"; for (let i = 0; i < 4; i++) x.fillRect(-20, -3 + i * 3.5, 18, 1.5); x.fillRect(2, -10, 16, 1.5); x.fillRect(2, -6, 16, 1.5);
      if (o.paper === "fold") { x.beginPath(); x.moveTo(24, -2); x.lineTo(10, 12); x.lineTo(16, 0); x.closePath(); fillStroke(x, "#dcd6c4", 1.4); ell(x, 17, 6, 2.4, 2.6); x.fillStyle = OL; x.fill(); }
      if (o.paper === "rustle") { x.strokeStyle = OL; x.lineWidth = 1.6; [-1, 1].forEach((sd) => { x.beginPath(); x.moveTo(sd * 30, -8); x.lineTo(sd * 36, -12); x.moveTo(sd * 30, 0); x.lineTo(sd * 37, 0); x.stroke(); }); }
      x.restore();
    }
    x.restore();
  }
  function bubble(x, X, Y, kind, t) {
    const pop = 1 + Math.max(0, Math.sin(t * 10)) * 0.06;
    x.save(); x.translate(X, Y); x.scale(pop, pop);
    if (kind === "!") { ell(x, 0, 0, 11, 11); fillStroke(x, "#e5372b", 2); txt(x, "!", 0, 1, 16, "#fff", { weight: 900 }); }
    else if (kind === "?") { ell(x, 0, 0, 10, 10); fillStroke(x, "#ffc21a", 2); txt(x, "?", 0, 1, 14, OL, { weight: 900 }); }
    else if (kind === "zz") { txt(x, "…", 0, 0, 14, OL, { weight: 900 }); }
    x.restore();
  }

  // ---------- 시선(부채꼴) ----------
  function cone(x, c, t) {
    const a0 = c.ang - c.half, a1 = c.ang + c.half;
    x.save();
    x.beginPath(); x.moveTo(c.x, c.y); x.arc(c.x, c.y, c.range, a0, a1); x.closePath();
    if (c.kind === "preview") {
      x.fillStyle = "rgba(255,207,51,.16)"; x.fill();
      x.setLineDash([6, 5]); x.lineDashOffset = -t * 30; x.lineWidth = 2; x.strokeStyle = "rgba(230,150,0,.9)"; x.stroke();
    } else {
      const g = x.createRadialGradient(c.x, c.y, 4, c.x, c.y, c.range);
      const hot = c.hot ? 0.52 : 0.34;
      g.addColorStop(0, `rgba(255,60,50,${hot})`); g.addColorStop(1, "rgba(255,60,50,0.04)");
      x.fillStyle = g; x.fill();
      x.lineWidth = c.hot ? 2.5 : 1.5; x.strokeStyle = c.hot ? "rgba(229,30,20,.95)" : "rgba(229,55,43,.55)"; x.stroke();
    }
    x.restore();
  }
  function cctv(x, cx, cy, ang, t, warn) {
    x.save(); x.translate(cx, cy);
    rr(x, -4, -12, 8, 10, 2); fillStroke(x, "#8a90a2", 1.5);
    x.rotate(ang);
    rr(x, -6, -7, 26, 14, 4); fillStroke(x, "#eef0f6", 2);
    rr(x, 18, -5, 6, 10, 2); fillStroke(x, "#2b3040", 1.5);
    const on = Math.sin(t * (warn ? 18 : 5)) > 0;
    ell(x, 2, -2, 2.4, 2.4); x.fillStyle = on ? "#ff3b30" : "#7a1d18"; x.fill();
    x.restore();
  }
  function detector(x, v, alarm, t) {
    const X = 6, Y = 58, w = 62, h = 30;
    rr(x, X, Y, w, h, 6); fillStroke(x, alarm && Math.sin(t * 20) > 0 ? "#ffd0cc" : "#fff", 2);
    txt(x, "전파 탐지기", X + w / 2, Y + 8, 9, OL, { weight: 900 });
    rr(x, X + 6, Y + 15, w - 12, 10, 4); fillStroke(x, "#eceff5", 1.5);
    const f = Math.max(0, Math.min(1, v / 100));
    if (f > 0) { rr(x, X + 7, Y + 16, (w - 14) * f, 8, 3); x.fillStyle = f > 0.7 ? (Math.sin(t * 16) > 0 ? "#e5372b" : "#ff7a6e") : f > 0.45 ? "#ffb020" : "#1e9e5a"; x.fill(); }
    x.strokeStyle = OL; x.lineWidth = 1.2; x.beginPath(); x.moveTo(X + 6 + (w - 12) * 0.45, Y + 13); x.lineTo(X + 6 + (w - 12) * 0.45, Y + 27); x.stroke();
    if (alarm) { const a = Math.sin(t * 14) > 0; ell(x, X + w - 6, Y + 4, 6, 6); fillStroke(x, a ? "#ff3b30" : "#ffc21a", 1.5); }
  }
  function steps(x, info, t) {
    if (!info || info.near <= 0) return;
    const a = Math.min(1, info.near);
    x.save(); x.globalAlpha = 0.25 + a * 0.75;
    const X = Math.max(26, Math.min(W - 26, info.x)), Y = H - 16;
    const ph = Math.floor(t * 3) % 2;
    for (let i = 0; i < 2; i++) {
      const fx = X + (i ? 8 : -8), fy = Y - (i === ph ? 6 : 0);
      ell(x, fx, fy, 4.2 + a * 1.5, 6 + a * 2); x.fillStyle = "#2b3040"; x.fill();
    }
    rr(x, X - 26, Y - 34, 52, 16, 8); x.fillStyle = "rgba(255,255,255,.92)"; x.fill();
    txt(x, a > 0.66 ? "저벅!!" : "저벅…", X, Y - 26, 10, "#2b3040", { weight: 900 });
    x.restore();
  }

  // ---------- 장면 합치기 ----------
  // st: { theme, boardTitle, boardSub, chalk, timeFrac, t, watchers[], cones[], cat{}, detector{v,alarm}|null, steps{}, cctv{} }
  function scene(x, st) {
    const t = st.t || 0;
    room(x, st);
    if (st.cctv) cctv(x, st.cctv.x, st.cctv.y, st.cctv.ang, t, st.cctv.warn);
    if (st.detector) detector(x, st.detector.v, st.detector.alarm, t);
    const items = [];
    (st.watchers || []).forEach((w) => items.push({ y: w.y, f: () => penguin(x, w) }));
    if (st.sleepy) [[30, 138], [62, 136]].forEach(([sx, sy], i) => items.push({ y: sy, f: () => { penguin(x, { x: sx, y: sy, s: 0.62, face: "front", sleep: true, role: "ta", t }); txt(x, "Zz", sx + 12, sy - 48 - Math.sin(t * 2 + i) * 3, 10, "#4a2fc0", { weight: 900 }); } }));
    const kinds = st.students || ["rabbit", "dog", "bear", "duck", "fox"];
    ROW1.forEach((sx, i) => items.push({ y: ROW1_Y + 10, f: () => { desk(x, sx, ROW1_Y - 22, 70, 0.8); paper(x, sx - 18, ROW1_Y - 12, 0.6, -0.1); student(x, sx, ROW1_Y, 0.85, kinds[i], t, i); } }));
    [60, 300].forEach((sx, i) => items.push({ y: ROW2_Y + 10, f: () => { desk(x, sx, ROW2_Y - 32, 86, 1); student(x, sx, ROW2_Y + 4, 1.1, kinds[3 + i], t, 3 + i); } }));
    items.push({ y: ROW2_Y + 11, f: () => { desk(x, CAT.x, ROW2_Y - 34, 104, 1); paper(x, CAT.x + 36, ROW2_Y - 24, 0.9, 0.12); cat(x, Object.assign({ t }, st.cat)); } });
    items.sort((a, b) => a.y - b.y).forEach((it) => it.f());
    (st.cones || []).forEach((c) => cone(x, c, t));
    (st.watchers || []).forEach((w) => { if (w.bubble) bubble(x, w.x + 16 * (w.s || 1), w.y - 74 * (w.s || 1), w.bubble, t); });
    if (st.steps) steps(x, st.steps, t);
    if (st.flash) { x.fillStyle = `rgba(255,40,30,${0.28 * st.flash})`; x.fillRect(0, 0, W, H); }
    if (st.alarm) { x.fillStyle = `rgba(255,40,30,${0.12 + 0.1 * Math.sin(t * 16)})`; x.fillRect(0, 0, W, H); }
  }

  // ---------- 고양이 수험생 앞모습(타이틀·엔딩·공유 카드) ----------
  // expr: smile|proud|cry|shock|sweat|dizzy|blank
  function catFace(x, cx, cy, r, expr, t = 0) {
    x.save(); x.translate(cx, cy); const k = r / 50; x.scale(k, k);
    // 귀
    [-1, 1].forEach((s) => { x.beginPath(); x.moveTo(s * 40, -18); x.lineTo(s * 36, -62); x.lineTo(s * 8, -40); x.closePath(); fillStroke(x, FUR, 3.5); x.beginPath(); x.moveTo(s * 33, -26); x.lineTo(s * 32, -50); x.lineTo(s * 16, -38); x.closePath(); x.fillStyle = PINK; x.fill(); });
    ell(x, 0, 0, 52, 44); fillStroke(x, FUR, 3.5);
    x.strokeStyle = FUR2; x.lineWidth = 5; x.lineCap = "round"; [-12, 0, 12].forEach((d) => { x.beginPath(); x.moveTo(d, -42); x.lineTo(d * 0.8, -28); x.stroke(); });
    // 머리띠
    x.save(); ell(x, 0, 0, 52, 44); x.clip(); x.fillStyle = "#fff"; x.fillRect(-60, -30, 120, 14); x.restore();
    txt(x, "필승", 0, -22.5, 11, "#e5372b", { weight: 900 });
    ell(x, 0, 0, 52, 44); fillStroke(x, null, 3.5);
    // 볼
    x.globalAlpha = 0.55; ell(x, -30, 16, 9, 6); x.fillStyle = "#ff9aa8"; x.fill(); ell(x, 30, 16, 9, 6); x.fill(); x.globalAlpha = 1;
    // 눈
    x.strokeStyle = OL; x.fillStyle = OL; x.lineWidth = 4; x.lineCap = "round";
    const eye = (ex) => {
      if (expr === "smile" || expr === "proud") { x.beginPath(); x.arc(ex, 4, 8, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); }
      else if (expr === "cry") { x.beginPath(); x.moveTo(ex - 8, 0); x.lineTo(ex + 8, 4); x.stroke(); }
      else if (expr === "dizzy") { x.beginPath(); x.moveTo(ex - 6, -4); x.lineTo(ex + 6, 8); x.moveTo(ex + 6, -4); x.lineTo(ex - 6, 8); x.stroke(); }
      else if (expr === "blank") { ell(x, ex, 2, 3, 3); x.fill(); }
      else { ell(x, ex, 2, 7, expr === "shock" ? 9 : 8); x.fill(); ell(x, ex + 2.5, -1, 2.4, 2.4); x.fillStyle = "#fff"; x.fill(); x.fillStyle = OL; }
    };
    eye(-20); eye(20);
    // 코·입
    x.beginPath(); x.moveTo(-4, 12); x.lineTo(4, 12); x.lineTo(0, 16); x.closePath(); x.fillStyle = "#f07a8a"; x.fill();
    x.lineWidth = 3; x.beginPath();
    if (expr === "shock") { ell(x, 0, 26, 6, 7); x.fillStyle = "#7a2b33"; x.fill(); }
    else if (expr === "cry" || expr === "sweat" || expr === "dizzy") { x.moveTo(-8, 26); x.quadraticCurveTo(0, 20, 8, 26); x.stroke(); }
    else if (expr === "blank") { x.moveTo(-6, 24); x.lineTo(6, 24); x.stroke(); }
    else { x.moveTo(0, 16); x.quadraticCurveTo(-6, 24, -12, 20); x.moveTo(0, 16); x.quadraticCurveTo(6, 24, 12, 20); x.stroke(); }
    // 수염
    x.strokeStyle = "rgba(42,38,51,.7)"; x.lineWidth = 2; [-1, 1].forEach((s) => { [8, 15].forEach((dy) => { x.beginPath(); x.moveTo(s * 22, dy); x.lineTo(s * 50, dy - 6 + (dy - 8)); x.stroke(); }); });
    // 효과
    if (expr === "cry") { [-20, 20].forEach((ex) => { x.beginPath(); x.moveTo(ex, 8); x.quadraticCurveTo(ex - 4, 22 + Math.sin(t * 6) * 2, ex, 30); x.quadraticCurveTo(ex + 4, 22, ex, 8); x.fillStyle = "#7cc8ff"; x.fill(); }); }
    if (expr === "sweat") { x.beginPath(); x.moveTo(42, -20); x.quadraticCurveTo(34, -6, 42, -2); x.quadraticCurveTo(50, -6, 42, -20); x.fillStyle = "#7cc8ff"; x.fill(); }
    if (expr === "dizzy") { x.strokeStyle = "#ffc21a"; x.lineWidth = 3; for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1; ell(x, Math.cos(a) * 40, -54 + Math.sin(a) * 8, 4, 4); x.fillStyle = "#ffc21a"; x.fill(); } }
    if (expr === "proud") { x.fillStyle = "#ffc21a"; [[-46, -46], [48, -40]].forEach(([sx, sy], i) => { const p = 1 + Math.sin(t * 4 + i) * 0.2; x.save(); x.translate(sx, sy); x.scale(p, p); x.beginPath(); for (let j = 0; j < 8; j++) { const a = (j * Math.PI) / 4, rr2 = j % 2 ? 3 : 9; x.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } x.closePath(); x.fill(); x.restore(); }); }
    x.restore();
  }

  // 타이틀 그림: 앞모습 고양이 수험생 + 뒤에서 지켜보는 펭귄 + 책상 밑 냥폰
  function title(x, t) {
    let g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#fff4df"); g.addColorStop(1, "#ffd9a8"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.globalAlpha = 0.5; for (let i = 0; i < 9; i++) { ell(x, (i * 53 + 20) % W, (i * 71 + 30) % 180, 2.5, 2.5); x.fillStyle = "#ffc21a"; x.fill(); } x.globalAlpha = 1;
    // 감독관 펭귄(오른쪽 위에서 빼꼼)
    const peek = Math.sin(t * 1.4) > 0.2 ? 1 : 0.6;
    x.save(); x.beginPath(); x.rect(220, 0, 140, 170); x.clip();
    penguin(x, { x: 300, y: 150 + (1 - peek) * 30, s: 1.25, face: "front", look: deg(150), role: "ta", t });
    x.restore();
    cone(x, { x: 290, y: 90 + (1 - peek) * 30, ang: deg(150), half: deg(14), range: 180, hot: false }, t);
    if (peek === 1) bubble(x, 318, 54, "?", t);
    // 책상
    rr(x, 30, 232, 300, 30, 8); fillStroke(x, "#f7e3c3", 2.5);
    paper(x, 110, 246, 1.4, -0.08);
    catFace(x, 150, 170, 58, Math.sin(t * 1.4) > 0.2 ? "sweat" : "smile", t);
    // 책상 밑 냥폰
    x.save(); x.translate(250, 278); x.rotate(0.15);
    x.globalAlpha = 0.4 + Math.sin(t * 6) * 0.15; ell(x, 0, 0, 30, 18); x.fillStyle = "#7fe3ff"; x.fill(); x.globalAlpha = 1;
    rr(x, -12, -18, 24, 36, 5); fillStroke(x, "#222837", 2.2); rr(x, -9, -14, 18, 26, 3); x.fillStyle = "#9ff0ff"; x.fill();
    txt(x, "AI", 0, -1, 10, "#163049", { weight: 900 });
    x.restore();
    ell(x, 236, 286, 10, 8); fillStroke(x, FUR, 2.5);
  }

  // 엔딩 장면(그림 영역 w×h, 가운데 정렬)
  const ENDING_BG = { out: ["#ffe0dc", "#ffb4aa"], end: ["#fff5c8", "#ffd86b"] };
  function ending(x, e, t, w = W, h = H) {
    const bg = ENDING_BG[e.kind] || ENDING_BG.out;
    let g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.52;
    // 소품
    x.save();
    if (e.scene === "phone") { penguin(x, { x: cx + 96, y: cy + 70, s: 1.1, face: "side", dir: -1, role: "ta", t }); x.save(); x.translate(cx + 66, cy - 6); x.rotate(-0.3); rr(x, -10, -16, 20, 32, 4); fillStroke(x, "#222837", 2); rr(x, -7, -12, 14, 23, 2); x.fillStyle = "#4a6c86"; x.fill(); x.restore(); bubble(x, cx + 110, cy - 30, "!", t); }
    else if (e.scene === "cctv") { rr(x, cx + 50, cy - 70, 90, 66, 8); fillStroke(x, "#2b3040", 2.5); rr(x, cx + 56, cy - 64, 78, 54, 4); x.fillStyle = "#506080"; x.fill(); txt(x, "REC ●", cx + 100, cy - 56, 9, "#ff6b60", { weight: 900 }); ell(x, cx + 95, cy - 30, 14, 12); x.fillStyle = FUR; x.fill(); cctv(x, cx - 110, cy - 90, deg(40), t, true); }
    else if (e.scene === "alarm") { for (let i = 0; i < 2; i++) { const X = i ? cx + 110 : cx - 110; ell(x, X, cy - 70, 18, 18); fillStroke(x, Math.sin(t * 12 + i * 3) > 0 ? "#ff3b30" : "#ffc21a", 2.5); rr(x, X - 22, cy - 56, 44, 10, 3); fillStroke(x, "#8a90a2", 2); } }
    else if (e.scene === "battery") { const X = cx + 100, Y = cy - 10; rr(x, X - 18, Y - 30, 36, 60, 6); fillStroke(x, "#222837", 2.5); rr(x, X - 13, Y - 25, 26, 50, 3); x.fillStyle = "#38404f"; x.fill(); rr(x, X - 10, Y - 6, 20, 26, 3); fillStroke(x, null, 2, "#ff6b60"); x.fillStyle = "#ff6b60"; x.fillRect(X - 8, Y + 15, 16, 3); txt(x, "0%", X, Y - 14, 10, "#ff6b60", { weight: 900 }); }
    x.restore();
    catFace(x, cx - 30, cy, Math.min(w, h) * 0.26, e.face, t);
  }

  S.art = { W, H, CAT, ROW1, ROW1_Y, ROW2_Y, scene, cone, catFace, penguin, title, ending, rr, txt, ell, fillStroke, deg, OL };
})();
