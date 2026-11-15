// P2-73 이미지 분할 인쇄 계산식 한 벌. 화면(t-splitprint.js)과 빌드의 대조 시험(build.mjs, vm)이 같은 파일을 씀.
// 단위: 용지·여백·겹침·그림 위치는 mm, PDF 좌표는 pt(1mm = 72/25.4pt). 그림 크기는 화소(px).
// 모델: 용지에서 여백(사방 같은 값)을 뺀 「인쇄 칸」(tw×th) 여러 장이 겹침(o)만큼 포개져 큰 판(W×H)이 됨.
//   W = 가로 장 수 × tw − (가로 장 수 − 1) × o. (c, r)번 장은 판의 x = c × (tw − o), y = r × (th − o)부터 tw×th를 보여 줌.
// 입력값은 저장하거나 전송하지 않음.
(function (root) {
  const PAPERS = {
    a4: { name: "A4", w: 210, h: 297 },
    a3: { name: "A3", w: 297, h: 420 },
    a5: { name: "A5", w: 148, h: 210 },
    b4: { name: "B4 (JIS)", w: 257, h: 364 },
    b5: { name: "B5 (JIS)", w: 182, h: 257 },
    letter: { name: "레터", w: 215.9, h: 279.4 },
  };
  const ORDER = ["a4", "a3", "a5", "b4", "b5", "letter"];
  const PT = 72 / 25.4; // 1mm → pt
  const MAXN = 10; // 가로·세로 장 수 상한
  const MAXCOUNT = MAXN * MAXN;
  const EPS = 1e-9;
  const ROWS = "가나다라마바사아자차";
  const ok = (n) => typeof n === "number" && isFinite(n);
  // 길이 L(mm)을 덮는 데 드는 장 수: 한 장 t, 이웃끼리 o만큼 겹침
  const need = (L, t, o) => (L <= t + 1e-6 ? 1 : Math.ceil((L - o) / (t - o) - 1e-6));
  const span = (n, t, o) => n * t - (n - 1) * o; // n장으로 덮는 길이
  const label = (c, r) => `${ROWS[r] || r + 1}${c + 1}`;

  // 용지 + 방향 + 여백 → 인쇄 칸
  function sheet(paper, orient, margin) {
    const P = PAPERS[paper];
    if (!P) return null;
    const pw = orient === "l" ? P.h : P.w, ph = orient === "l" ? P.w : P.h;
    return { pw, ph, tw: pw - 2 * margin, th: ph - 2 * margin };
  }

  // 정해진 배열(cols×rows)에 그림 놓기
  // adj: 사용자가 미리보기에서 옮기고 키운 값 { zoom(배), ox, oy(가운데에서 mm) }. 완성 크기 모드는 크기 고정(zoom 무시)
  function place(s, cols, rows, o, iw, ih, fit, exact, adj) {
    const W = span(cols, s.tw, o), H = span(rows, s.th, o);
    const z = !exact && adj && ok(adj.zoom) && adj.zoom > 0 ? adj.zoom : 1;
    let w, h;
    if (exact) { w = exact.w; h = exact.h; }
    else {
      const k = (fit === "fill" ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih)) * z;
      w = iw * k; h = ih * k;
    }
    // 옮긴 값은 그림이 판에서 완전히 벗어나지 않게 줄임(그림 가운데가 판 안)
    const ox = adj && ok(adj.ox) ? Math.max(-W / 2, Math.min(W / 2, adj.ox)) : 0, oy = adj && ok(adj.oy) ? Math.max(-H / 2, Math.min(H / 2, adj.oy)) : 0;
    const img = { x: (W - w) / 2 + ox, y: (H - h) / 2 + oy, w, h };
    const tiles = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x0 = c * (s.tw - o), y0 = r * (s.th - o);
      const ix = Math.min(x0 + s.tw, img.x + img.w) - Math.max(x0, img.x), iy = Math.min(y0 + s.th, img.y + img.h) - Math.max(y0, img.y);
      tiles.push({ c, r, x0, y0, label: label(c, r), blank: !(ix > 0.05 && iy > 0.05) });
    }
    const vw = Math.min(W, img.x + img.w) - Math.max(0, img.x), vh = Math.min(H, img.y + img.h) - Math.max(0, img.y);
    const sheets = tiles.filter((t) => !t.blank).length;
    return { cols, rows, W, H, img, view: { w: Math.max(0, vw), h: Math.max(0, vh) }, tiles, sheets, total: cols * rows, dpi: iw / (w / 25.4), fitK: Math.min(W / iw, H / ih), adj: { zoom: z, ox, oy } };
  }

  // o: { adj: { zoom, ox, oy } (선택), paper, orient: "auto"|"p"|"l", margin, overlap, mode: "grid"|"size"|"count", cols, rows, wCm | hCm, count, fit: "fit"|"fill", iw, ih }
  // 결과: { err } 또는 { orient, paper, pw, ph, tw, th, margin, overlap, cols, rows, W, H, img, view, tiles, sheets, total, dpi, alt }
  function layout(o) {
    const iw = o.iw, ih = o.ih;
    if (!(ok(iw) && ok(ih) && iw > 0 && ih > 0)) return { err: "image" };
    if (!PAPERS[o.paper]) return { err: "paper" };
    const m = ok(o.margin) ? o.margin : 0, ov = ok(o.overlap) ? o.overlap : 0;
    if (m < 0 || ov < 0) return { err: "negative" };
    const P = PAPERS[o.paper];
    if (m * 2 >= Math.min(P.w, P.h) - 40) return { err: "margin" }; // 인쇄 칸이 4cm보다 좁아지면 막음
    const orients = o.orient === "p" || o.orient === "l" ? [o.orient] : ["p", "l"];
    const cands = [];
    for (const or of orients) {
      const s = sheet(o.paper, or, m);
      if (ov * 2 > Math.min(s.tw, s.th) + EPS) return { err: "overlap" }; // 겹침은 인쇄 칸 짧은 변의 절반까지
      let L = null;
      if (o.mode === "size") {
        let w, h;
        if (ok(o.wCm) && o.wCm > 0) { w = o.wCm * 10; h = (w * ih) / iw; }
        else if (ok(o.hCm) && o.hCm > 0) { h = o.hCm * 10; w = (h * iw) / ih; }
        else return { err: "size" };
        const cols = need(w, s.tw, ov), rows = need(h, s.th, ov);
        if (cols > MAXN || rows > MAXN) { cands.push({ or, s, over: { cols, rows } }); continue; }
        L = place(s, cols, rows, ov, iw, ih, "fit", { w, h }, o.adj);
      } else if (o.mode === "count") {
        const N = Math.floor(o.count);
        if (!(N >= 1)) return { err: "count" };
        let best = null;
        for (let r = 1; r <= MAXN; r++) for (let c = 1; c <= MAXN; c++) {
          if (c * r > N) continue;
          const k = Math.min(span(c, s.tw, ov) / iw, span(r, s.th, ov) / ih);
          if (!best || k > best.k + 1e-9 || (Math.abs(k - best.k) <= 1e-9 && c * r < best.c * best.r)) best = { k, c, r };
        }
        L = place(s, best.c, best.r, ov, iw, ih, o.fit, null, o.adj);
      } else {
        const cols = Math.min(MAXN, Math.max(1, Math.floor(o.cols) || 1)), rows = Math.min(MAXN, Math.max(1, Math.floor(o.rows) || 1));
        L = place(s, cols, rows, ov, iw, ih, o.fit, null, o.adj);
      }
      cands.push({ or, s, L });
    }
    const good = cands.filter((x) => x.L);
    if (!good.length) { const x = cands[0].over; return { err: "tooMany", cols: x.cols, rows: x.rows }; }
    // 자동 방향: 크기 지정 → 장 수가 적은 쪽(같으면 판이 작은 쪽). 총 매수 → 그림이 큰 쪽(같으면 장 수 적은 쪽).
    // 배열 직접 → 맞춤은 그림이 큰 쪽, 채움은 잘리는 부분이 적은 쪽. 모두 같으면 세로.
    const score = (x) => {
      const L = x.L;
      if (o.mode === "size") return [-L.sheets, -L.W * L.H];
      if (o.mode === "count") return [L.fitK, -L.sheets];
      if (o.fit === "fill") return [(L.view.w * L.view.h) / (L.img.w * L.img.h), -L.sheets];
      return [L.fitK, -L.sheets];
    };
    const better = (a, b) => { const A = score(a), B = score(b); for (let i = 0; i < A.length; i++) { const d = A[i] - B[i]; if (Math.abs(d) > 1e-9 * Math.max(1, Math.abs(B[i]))) return d > 0; } return false; };
    let pick = good[0];
    for (const x of good.slice(1)) if (better(x, pick)) pick = x;
    const other = cands.find((x) => x !== pick);
    const alt = other ? (other.L ? { orient: other.or, cols: other.L.cols, rows: other.L.rows, sheets: other.L.sheets, dpi: other.L.dpi, view: other.L.view } : { orient: other.or, over: other.over }) : null;
    return { orient: pick.or, paper: o.paper, pw: pick.s.pw, ph: pick.s.ph, tw: pick.s.tw, th: pick.s.th, margin: m, overlap: ov, ...pick.L, alt };
  }

  // 한 장(tile)의 PDF 좌표(pt, 왼쪽 아래 원점): 쪽 크기, 자르기 칸(인쇄 칸), 그림 자리, 겹침 선
  function pageRects(L, t) {
    const pageW = L.pw * PT, pageH = L.ph * PT;
    const m = L.margin;
    const clip = { x: m * PT, y: (L.ph - m - L.th) * PT, w: L.tw * PT, h: L.th * PT };
    const xmm = m + L.img.x - t.x0, ytd = m + L.img.y - t.y0;
    const img = { x: xmm * PT, y: (L.ph - ytd - L.img.h) * PT, w: L.img.w * PT, h: L.img.h * PT };
    // 겹침 선: 다음 장(오른쪽·아래)이 덮을 자리의 시작. 그 장의 인쇄 칸 가장자리를 이 선에 맞춰 붙임
    const seams = [];
    if (L.overlap > 0 && t.c < L.cols - 1) { const x = (m + L.tw - L.overlap) * PT; seams.push({ x1: x, y1: clip.y, x2: x, y2: clip.y + clip.h, side: "right" }); }
    if (L.overlap > 0 && t.r < L.rows - 1) { const y = (L.ph - m - L.th + L.overlap) * PT; seams.push({ x1: clip.x, y1: y, x2: clip.x + clip.w, y2: y, side: "bottom" }); }
    return { pageW, pageH, clip, img, seams };
  }

  // JPEG EXIF 방향(1~8): 저장된 화소(단위 정사각형 u,v, 위가 v=1) → 보이는 방향 그림 자리(x, y, w, h)의 PDF 변환 행렬 [a b c d e f]
  const OR = { 1: [1, 0, 0, 1, 0, 0], 2: [-1, 0, 0, 1, 1, 0], 3: [-1, 0, 0, -1, 1, 1], 4: [1, 0, 0, -1, 0, 1], 5: [0, -1, -1, 0, 1, 1], 6: [0, -1, 1, 0, 0, 1], 7: [0, 1, 1, 0, 0, 0], 8: [0, 1, -1, 0, 1, 0] };
  function orientMatrix(orientation, r) {
    const [a, b, c, d, e, f] = OR[orientation] || OR[1];
    return [r.w * a, r.h * b, r.w * c, r.h * d, r.x + r.w * e, r.y + r.h * f];
  }

  // ---------- P2-73b 손으로 맞추기: 그림 자리(판 mm) ↔ adj ----------
  // 배율(zoom) 1 = 맞춤·채움 기준 크기. 그림 가로 mm = 기준 가로(L.img.w ÷ L.adj.zoom) × zoom. 배율은 20~800%
  const ZMIN = 0.2, ZMAX = 8;
  const clampZ = (z) => Math.max(ZMIN, Math.min(ZMAX, z));
  // 그림 자리 { x, y, w } → adj. 세로는 그림 비율로 정해짐
  function adjFromImg(L, img) {
    const unit = L.img.w / L.adj.zoom, h = (img.w * L.img.h) / L.img.w;
    return { zoom: img.w / unit, ox: img.x - (L.W - img.w) / 2, oy: img.y - (L.H - h) / 2 };
  }
  // 판의 한 점(px, py mm)을 그 자리에 둔 채 k배로 키우거나 줄임(두 손가락 가운데·휠 커서·슬라이더는 그림 가운데)
  function zoomAt(L, k, px, py) {
    const z = clampZ(L.adj.zoom * k), q = z / L.adj.zoom;
    return adjFromImg(L, { x: px - (px - L.img.x) * q, y: py - (py - L.img.y) * q, w: L.img.w * q });
  }
  // 모서리 손잡이(nw·ne·sw·se)를 판의 (tx, ty mm)로 끔. 반대편 모서리는 그대로, 비율 유지(끈 점을 대각선에 투영)
  // L0 = 끌기 시작할 때의 배치(시작 그림 자리 기준으로 계산해 손을 되돌리면 그대로 돌아옴)
  function resizeCorner(L0, corner, tx, ty) {
    const I = L0.img, sx = corner[1] === "e" ? 1 : -1, sy = corner[0] === "s" ? 1 : -1;
    const ax = sx > 0 ? I.x : I.x + I.w, ay = sy > 0 ? I.y : I.y + I.h;
    const vx = (tx - ax) * sx, vy = (ty - ay) * sy;
    let k = (vx * I.w + vy * I.h) / (I.w * I.w + I.h * I.h);
    k = clampZ(L0.adj.zoom * k) / L0.adj.zoom;
    const w = I.w * k, h = I.h * k;
    return adjFromImg(L0, { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w });
  }

  // P2-73c 중앙 맞추기: 배율은 그대로, 그림 가운데를 완성 영역(판 W×H) 가운데로. axis "x" = 가로만, "y" = 세로만, 없으면 둘 다
  // (「처음 위치로」는 배율까지 1로 되돌림. 이 함수는 옮긴 값만 0으로)
  function centerAdj(a, axis) {
    const z = a && ok(a.zoom) && a.zoom > 0 ? a.zoom : 1, ox = a && ok(a.ox) ? a.ox : 0, oy = a && ok(a.oy) ? a.oy : 0;
    return { zoom: z, ox: axis === "y" ? ox : 0, oy: axis === "x" ? oy : 0 };
  }

  root.SPLITCALC = { PAPERS, ORDER, PT, MAXN, MAXCOUNT, ZMIN, ZMAX, need, span, sheet, layout, pageRects, orientMatrix, label, adjFromImg, zoomAt, resizeCorner, centerAdj };
})(typeof window !== "undefined" ? window : globalThis);
