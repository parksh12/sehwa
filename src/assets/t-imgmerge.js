// 사진 이어붙이기 (P2-46): 여러 장을 세로·가로·격자로 한 장에. 툴바 자동 자르기(행 비교), 긴 캡처(겹침 빼기), 캔버스 한계 자동 축소.
// 의존: tool-kit.js. 사진은 브라우저 안에서만 읽고 그립니다(서버 전송 없음).
(function () {
  const box = document.querySelector('[data-tool="imgmerge"]');
  if (!box) return;
  const OPT = { exts: ["jpg", "jpeg", "png", "webp"], maxSize: 30 * PT.MB, maxCount: 30, maxTotal: 300 * PT.MB, reject: { heic: "HEIC(아이폰 사진) 파일은 아직 지원하지 않아요. 사진 앱에서 JPG로 내보내거나 캡처(PNG)를 넣어 주세요.", gif: "GIF는 지원하지 않아요." } };
  const MAX_PIXELS = 50e6; // 한 장 5천만 화소까지
  const MAX_AREA = 16777216, MAX_SIDE = 16384; // 결과 캔버스 한계: iOS 사파리 약 1,677만 화소(가장 엄격한 브라우저 기준)
  const SW = 192; // 행 비교용 축소 폭(px)
  const DIFF = 28, ROW_TOL = 0.12; // 화소 밝기 차 28 넘는 칸이 한 줄의 12% 이하면 「같은 줄」(JPG 잡음·상태바 시각 허용)
  const $ = (s) => box.querySelector(s);
  const ui = $(".im"), thumbs = $(".im-thumbs"), cv = $(".im-canvas"), info = $(".im-info"), note = $(".im-note");
  const trimBox = $(".im-trim"), trimNote = $(".im-trim-note"), longNote = $(".im-long-note");
  const f = (n) => box.querySelector(`[name="${n}"]`);
  const val = (n) => { const c = box.querySelector(`[name="${n}"]:checked`); return c ? c.value : f(n).value; };

  let items = [], seq = 0, manual = null, trimTouched = false, mainRef = null, ovCache = { key: "", r: null };

  // ---------- 파일 넣기: 선택 · 끌어 놓기 · 붙여 넣기 ----------
  PT.dropzone(box, (files) => add(files));
  document.addEventListener("paste", (e) => {
    const fs = [...((e.clipboardData && e.clipboardData.files) || [])].filter((x) => /^image\//.test(x.type));
    if (!fs.length || box.classList.contains("is-busy")) return;
    e.preventDefault();
    add(fs.map((x, i) => new File([x], `붙여넣기-${seq + i + 1}.${(x.type.split("/")[1] || "png").replace("jpeg", "jpg")}`, { type: x.type })));
  });

  async function add(files) {
    const { ok, errs } = PT.check(files, OPT, items.map((x) => x.file));
    PT.msg(box, "");
    const fresh = [];
    if (ok.length) {
      PT.busy(box, true, "사진을 읽는 중…");
      try {
        for (let i = 0; i < ok.length; i++) {
          const file = ok[i];
          PT.step(box, `${i + 1} / ${ok.length}장 읽는 중…`, i / ok.length); await PT.tick();
          const url = URL.createObjectURL(file);
          const img = new Image(); img.src = url;
          try { await img.decode(); } catch (e) { URL.revokeObjectURL(url); errs.push(`「${file.name}」은(는) 깨졌거나 읽을 수 없는 이미지예요.`); continue; }
          const w = img.naturalWidth, h = img.naturalHeight;
          if (w * h > MAX_PIXELS) { URL.revokeObjectURL(url); errs.push(`「${file.name}」은(는) ${w}×${h}로 너무 커요(한 장 5천만 화소까지).`); continue; }
          fresh.push({ id: ++seq, file, url, img, w, h });
        }
      } finally { PT.busy(box, false); }
    }
    items.push(...fresh); // 다 읽은 뒤 한꺼번에 추가(읽는 도중 미리보기가 그려지지 않게)
    if (errs.length) PT.msg(box, errs.join(" "));
    changed(true);
  }

  // ---------- 행 비교용 회색 축소본(+ 줄마다 평균 밝기·무늬 정도) ----------
  function grayOf(it) {
    if (it.gray) return it.gray;
    const gw = Math.min(SW, it.w), gh = Math.min(it.h, 4096);
    const c = document.createElement("canvas"); c.width = gw; c.height = gh;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(it.img, 0, 0, gw, gh);
    const d = x.getImageData(0, 0, gw, gh).data, g = new Uint8Array(gw * gh);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
    c.width = c.height = 0;
    const mean = new Float32Array(gh), mad = new Float32Array(gh);
    for (let y = 0; y < gh; y++) {
      let s = 0; const o = y * gw;
      for (let k = 0; k < gw; k++) s += g[o + k];
      const m = s / gw; let v = 0;
      for (let k = 0; k < gw; k++) v += Math.abs(g[o + k] - m);
      mean[y] = m; mad[y] = v / gw;
    }
    it.gray = g; it.gw = gw; it.gh = gh; it.ry = it.h / gh; it.mean = mean; it.mad = mad;
    return g;
  }
  const rowDiff = (a, ra, b, rb, w) => { let n = 0; const oa = ra * w, ob = rb * w; for (let x = 0; x < w; x++) if (Math.abs(a[oa + x] - b[ob + x]) > DIFF) n++; return n; };
  // 두 사진의 같은 줄 비교: 2 = 밝기까지 같음, 1 = 무늬만 같음(다크·라이트 모드처럼 툴바 바탕 밝기만 다름) 또는 둘 다 단색, 0 = 다름
  function rowState(A, B, y, w, tol) {
    if (rowDiff(A.gray, y, B.gray, y, w) <= tol) return 2;
    if (A.mad[y] <= 6 && B.mad[y] <= 6) return 1;
    const a = A.gray, b = B.gray, o = y * w, ma = A.mean[y], mb = B.mean[y];
    let n = 0; for (let x = 0; x < w; x++) if (Math.abs(a[o + x] - ma - b[o + x] + mb) > DIFF) n++;
    return n <= tol ? 1 : 0;
  }

  // 같은 크기 사진들의 위(또는 아래)부터 공통 줄이 이어지는 길이(축소본 줄 수).
  // 아래쪽은 다수(60%)가 같으면 공통 → 키보드 사진 몇 장이 섞여도 됨. 경계는 「밝기까지 같은」 마지막 줄
  function commonRun(group, fromBottom) {
    // 위쪽(상태바·주소창)은 거의 모든 사진(90%)이 같아야, 아래쪽은 키보드 사진이 섞일 수 있어 60%
    const n = group.length, need = n <= 2 ? n : fromBottom ? Math.max(2, Math.ceil(n * 0.6)) : n - Math.floor(n * 0.1);
    const w = group[0].gw, H = group[0].gh, lim = Math.floor(H * 0.45), maxGap = Math.max(3, Math.round(H * 0.02)), tol = Math.floor(w * ROW_TOL);
    let lastAbs = -1, gap = 0;
    const c1 = new Int16Array(n), c2 = new Int16Array(n);
    for (let k = 0; k < lim; k++) {
      const y = fromBottom ? H - 1 - k : k;
      c1.fill(1); c2.fill(1);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const st = rowState(group[i], group[j], y, w, tol);
        if (st) { c1[i]++; c1[j]++; } if (st === 2) { c2[i]++; c2[j]++; }
      }
      let b1 = 0, b2 = 0; for (let i = 0; i < n; i++) { if (c1[i] > b1) b1 = c1[i]; if (c2[i] > b2) b2 = c2[i]; }
      if (b1 >= need) { gap = 0; if (b2 >= need) lastAbs = k; } else if (++gap > maxGap) break;
    }
    return lastAbs + 1;
  }
  // 여러 장 평균 가로 경계 세기(y-1 줄과 y 줄의 밝기 차)
  const edgeAt = (group, y) => { let s = 0; for (const it of group) { const g = it.gray, w = it.gw, o = y * w; for (let x = 0; x < w; x++) s += Math.abs(g[o + x] - g[o - w + x]); } return s / (group.length * group[0].gw); };
  function strongest(group, lo, hi) { let by = -1, be = 0; for (let y = Math.max(1, lo); y <= hi; y++) { const e = edgeAt(group, y); if (e > be) { be = e; by = y; } } return { y: by, e: be }; }
  const CAP_T = 0.16, CAP_B = 0.13; // 휴대폰 툴바(상태바+주소창 / 하단 바)는 보통 화면 높이의 16% / 13% 이내(또는 폭의 26% / 20% 이내)

  // 경계 다듬기: 공통 부분이 너무 길면(같은 앱 같은 화면이라 내용까지 같음) 툴바 범위 안의 가장 뚜렷한 가로 경계로, 아니면 근처(3%) 경계로 맞춤
  function settle(group, t, b) {
    const H = group[0].gh, Wr = group[0].w / group[0].ry; // 폭(축소본 줄 단위)
    const cT = Math.floor(Math.max(H * CAP_T, Wr * 0.26)), cB = Math.floor(Math.max(H * CAP_B, Wr * 0.2)), w3 = Math.round(H * 0.03);
    let snapped = false;
    if (t > cT) { const r = strongest(group, Math.round(H * 0.02), cT); t = r.e >= 18 ? r.y : Math.round(H * 0.04); snapped = true; }
    else if (t > 0) { const r = strongest(group, t - w3, t); if (r.e >= 30) t = r.y; }
    if (b > cB) { const r = strongest(group, H - cB, Math.floor(H * 0.985)); b = r.e >= 18 ? H - r.y : Math.round(H * 0.035); snapped = true; }
    else if (b > 0) { const r = strongest(group, H - b, Math.min(H - 1, H - b + w3)); if (r.e >= 30) b = H - r.y; }
    return { t, b, snapped };
  }

  function detect() {
    const groups = new Map();
    items.forEach((it) => { const k = it.w + "x" + it.h; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); });
    mainRef = null;
    for (const g of groups.values()) {
      if (!mainRef || g.length > groups.get(mainRef.w + "x" + mainRef.h).length) mainRef = g[0];
      g.forEach(grayOf);
      const H = g[0].gh, phone = g[0].h / g[0].w >= 1.55;
      let r = null, how = "none";
      if (g.length >= 2 && phone) {
        const t = commonRun(g, false), b = commonRun(g, true);
        if (t > 0 || b > 0) { r = settle(g, t, b); how = r.snapped ? "snap" : "common"; }
      }
      // 휴대폰 캡처 비율(세로/가로 1.55 이상)만 자동으로 자름. 1장이거나 공통 부분이 없으면: 휴대폰 화면 비율이면 툴바 범위 안의 가장 뚜렷한 경계로 추정
      if (!r && phone) { r = settle(g, H, H); how = "est"; }
      if (!r) r = { t: 0, b: 0 };
      g.forEach((it) => { it.auto = { t: Math.round(r.t * it.ry), b: Math.round(r.b * it.ry), how, n: g.length }; });
    }
  }

  const trimOn = () => f("trim").checked;
  function cropOf(it) {
    if (!trimOn()) return { t: 0, b: 0 };
    let t, b;
    if (manual && mainRef) { const s = it.h / mainRef.h; t = Math.round(manual.t * s); b = Math.round(manual.b * s); }
    else { t = it.auto ? it.auto.t : 0; b = it.auto ? it.auto.b : 0; }
    if (t + b > it.h - 8) { const k = (it.h - 8) / (t + b); t = Math.floor(t * k); b = Math.floor(b * k); }
    return { t, b };
  }

  // ---------- 긴 캡처: 다음 사진(B) 위쪽의 무늬 띠를 앞 사진(A)에서 찾아 겹친 부분을 뺌(행 비교) ----------
  // 겹침 크기를 모르므로 B 위쪽부터 8% 구간마다 무늬가 가장 많은 띠를 골라 차례로 시험하고, 처음 확실히 맞는 띠를 씀
  function findOverlap(A, ca, topA, B, cb) {
    const w = A.gw, ga = A.gray, gb = B.gray, tol = Math.floor(w * ROW_TOL);
    const a0 = Math.ceil((ca.t + topA) / A.ry), a1 = Math.floor((A.h - ca.b) / A.ry);
    const b0 = Math.ceil(cb.t / B.ry), b1 = Math.floor((B.h - cb.b) / B.ry);
    const LA = a1 - a0, LB = b1 - b0, T = Math.max(16, Math.min(64, Math.round(B.gh * 0.03)));
    if (LA < T * 2 || LB < T * 2) return null;
    const tex = (y) => { let v = 0; for (let r = y; r < y + T; r += 2) { const o = r * w; for (let x = 1; x < w; x += 2) v += Math.abs(gb[o + x] - gb[o + x - 1]) + Math.abs(gb[o + x] - gb[o + x - w]); } return v / ((T / 2) * (w / 2)); };
    const band = Math.max(T, Math.floor(LB * 0.08)), sEnd = Math.min(b0 + Math.floor(LB * 0.75), b1 - T);
    for (let lo = b0 + 1; lo <= sEnd; lo += band) {
      let s = -1, sv = 0;
      for (let y = lo; y <= Math.min(lo + band - 1, sEnd); y += 3) { const v = tex(y); if (v > sv) { sv = v; s = y; } }
      if (s < 0 || sv < 3) continue; // 무늬 없는 단색 띠로는 위치를 정할 수 없음
      const r = matchAt(s);
      if (r) return r;
    }
    return null;
    function matchAt(s) {
      // A에서 띠와 가장 비슷한 위치(거친 비교 → 근처 정밀 비교). B가 A보다 아래로 스크롤된 경우만
      const pMin = a0 + (s - b0) + 1, pMax = a1 - T;
      if (pMax < pMin) return null;
      const score = (p, step, xs) => { let d = 0, n = 0; for (let r = 0; r < T; r += step) { const oa = (p + r) * w, ob = (s + r) * w; for (let x = 0; x < w; x += xs) { d += Math.abs(ga[oa + x] - gb[ob + x]); n++; } } return d / n; };
      const coarse = new Float32Array(pMax - pMin + 1);
      let bp = -1, bv = 1e9;
      for (let p = pMin; p <= pMax; p++) { const v = score(p, 4, 2); coarse[p - pMin] = v; if (v < bv) { bv = v; bp = p; } }
      let second = 1e9;
      for (let p = pMin; p <= pMax; p++) if (Math.abs(p - bp) > T / 2 && coarse[p - pMin] < second) second = coarse[p - pMin];
      let fp = bp, fv = 1e9;
      for (let p = Math.max(pMin, bp - 3); p <= Math.min(pMax, bp + 3); p++) { const v = score(p, 1, 1); if (v < fv) { fv = v; fp = p; } }
      if (fv > 10 || (second < 1e9 && second < fv * 1.5 + 2)) return null; // 덜 닮았거나 비슷한 곳이 여러 군데(반복 무늬)
      // 겹친 나머지 줄도 대체로 같은지 확인: 무늬 있는 줄의 70% 이상이 같아야 함(고정 하단 바 등 일부 차이는 허용)
      let same = 0, all = 0;
      for (let r = fp; r < a1 && s + (r - fp) < b1; r++) {
        const rb = s + (r - fp);
        if (A.mad[r] <= 6 && B.mad[rb] <= 6) continue; // 둘 다 단색 줄은 판단에서 뺌
        all++; if (rowDiff(ga, r, gb, rb, w) <= tol) same++;
      }
      if (!all || same / all < 0.7) return null;
      return { cutA: (A.h - ca.b) - Math.round(fp * A.ry), cutB: Math.round(s * B.ry) - cb.t };
    }
  }
  function overlaps(list, crops) {
    const key = list.map((it, i) => `${it.id}:${crops[i].t}:${crops[i].b}`).join(",");
    if (ovCache.key === key) return ovCache.r;
    const ex = list.map(() => ({ t: 0, b: 0 }));
    let ok = 0, fail = 0;
    for (let i = 1; i < list.length; i++) {
      const A = list[i - 1], B = list[i];
      grayOf(A); grayOf(B);
      const r = A.w === B.w && A.gw === B.gw ? findOverlap(A, crops[i - 1], ex[i - 1].t, B, crops[i]) : null;
      const restA = A.h - crops[i - 1].t - crops[i - 1].b - ex[i - 1].t;
      if (!r || r.cutA < 0 || r.cutA >= restA - 4 || r.cutB < 0) { fail++; continue; }
      ex[i - 1].b = r.cutA; ex[i].t = r.cutB; ok++;
    }
    ovCache = { key, r: { ex, ok, fail } };
    return ovCache.r;
  }

  // ---------- 배치 계산 ----------
  const SIZES = { orig: 0, mid: 1080, small: 720 };
  function plan() {
    const mode = val("mode"), long = mode === "v" && f("long").checked;
    const crops = items.map(cropOf);
    let ov = null;
    if (long && items.length > 1) {
      ov = overlaps(items, crops);
      crops.forEach((c, i) => { c.t += ov.ex[i].t; c.b += ov.ex[i].b; });
    }
    const parts = items.map((it, i) => ({ it, sy: crops[i].t, sw: it.w, sh: Math.max(1, it.h - crops[i].t - crops[i].b) }));
    const U = mode === "h" ? Math.max(...parts.map((p) => p.sh)) : Math.max(...parts.map((p) => p.sw));
    const target = SIZES[val("size")] ? Math.min(U, SIZES[val("size")]) : U;
    const k = target / U; // 저장 크기 배율
    const G = long ? 0 : Math.round(Number(f("gap").value) * target / 1080) / k; // 간격(결과 px 기준) → 기준 단위로
    const draws = [];
    let W = 0, H = 0;
    if (mode === "v") {
      let y = G;
      parts.forEach((p) => { const dh = p.sh * U / p.sw; draws.push({ ...p, dx: G, dy: y, dw: U, dh }); y += dh + G; });
      W = U + 2 * G; H = y;
    } else if (mode === "h") {
      let x = G;
      parts.forEach((p) => { const dw = p.sw * U / p.sh; draws.push({ ...p, dx: x, dy: G, dw, dh: U }); x += dw + G; });
      W = x; H = U + 2 * G;
    } else {
      const c = Math.max(1, Math.min(Number(f("cols").value) || 2, parts.length));
      let y = G;
      for (let r = 0; r < parts.length; r += c) {
        const row = parts.slice(r, r + c).map((p) => ({ ...p, dh: p.sh * U / p.sw }));
        const rh = Math.max(...row.map((p) => p.dh));
        row.forEach((p, i) => draws.push({ ...p, dx: G + i * (U + G), dy: y + (rh - p.dh) / 2, dw: U }));
        y += rh + G;
      }
      W = c * U + (c + 1) * G; H = y;
    }
    // 브라우저 캔버스 한계를 넘으면 자동 축소
    let s = k;
    const lim = Math.min(1, Math.sqrt(MAX_AREA * 0.98 / (W * H * k * k)), MAX_SIDE / (Math.max(W, H) * k));
    s = k * lim;
    return { mode, long, ov, draws, W, H, s, shrunk: lim < 1 ? lim : 0, border: !long && f("border").checked, U };
  }

  function draw(pl, s, canvas) {
    const cw = Math.max(1, Math.round(pl.W * s)), ch = Math.max(1, Math.round(pl.H * s));
    canvas.width = cw; canvas.height = ch;
    const x = canvas.getContext("2d");
    x.fillStyle = f("bg").value || "#ffffff"; x.fillRect(0, 0, cw, ch);
    x.imageSmoothingQuality = "high";
    const lw = Math.max(1, Math.round(2 * pl.U * s / 1080));
    pl.draws.forEach((d) => {
      const dx = Math.round(d.dx * s), dy = Math.round(d.dy * s), dw = Math.round((d.dx + d.dw) * s) - dx, dh = Math.round((d.dy + d.dh) * s) - dy;
      if (dw < 1 || dh < 1) return;
      x.drawImage(d.it.img, 0, d.sy, d.sw, d.sh, dx, dy, dw, dh);
      if (pl.border) { x.strokeStyle = "#000"; x.lineWidth = lw; x.strokeRect(dx + lw / 2, dy + lw / 2, dw - lw, dh - lw); }
    });
    return { cw, ch };
  }

  // ---------- 화면 ----------
  let timer = 0;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(preview, 80); };
  function preview() {
    if (!items.length) return;
    const pl = plan();
    const outW = Math.round(pl.W * pl.s), outH = Math.round(pl.H * pl.s);
    const ps = Math.min(pl.s, 900 / pl.W, 12000 / pl.H, Math.sqrt(8e6 / (pl.W * pl.H)));
    draw(pl, ps, cv);
    cv.setAttribute("aria-label", `미리보기: 사진 ${items.length}장을 합친 결과 ${outW}×${outH}px`);
    info.textContent = `결과 크기 ${outW.toLocaleString("ko-KR")} × ${outH.toLocaleString("ko-KR")}px · 사진 ${items.length}장`;
    const notes = [];
    if (pl.shrunk) notes.push(`결과가 브라우저가 한 번에 만들 수 있는 크기(약 1,677만 화소)를 넘어서 ${Math.round(pl.shrunk * 100)}%로 줄여 저장해요. 장수를 나눠 합치면 더 크게 저장할 수 있어요.`);
    note.textContent = notes.join(" "); note.hidden = !notes.length;
    longNote.hidden = !pl.long;
    if (pl.long) {
      if (items.length < 2) longNote.textContent = "긴 캡처는 2장 이상일 때 겹치는 부분을 찾아요.";
      else if (pl.ov.fail === 0) longNote.textContent = `이음새 ${pl.ov.ok}곳 모두 겹치는 부분을 찾아 빼고 이었어요.`;
      else longNote.textContent = `이음새 ${items.length - 1}곳 중 ${pl.ov.fail}곳은 겹치는 부분을 찾지 못해 그대로 이어 붙였어요. 연속으로 스크롤한 캡처인지, 순서가 맞는지 확인해 주세요.`;
    }
    const nx = box.querySelector(".tk-next"); if (nx) nx.hidden = false;
  }

  function trimUi() {
    const on = trimOn();
    trimBox.hidden = !on;
    if (!mainRef) return;
    const t = f("trimTop"), b = f("trimBot"), max = Math.round(mainRef.h * 0.45);
    t.max = b.max = String(max);
    const v = manual || mainRef.auto;
    t.value = v.t; b.value = v.b;
    $(".im-t-out").textContent = `${v.t}px`; $(".im-b-out").textContent = `${v.b}px`;
    const a = mainRef.auto;
    trimNote.textContent = manual ? "직접 맞춘 값으로 잘라요. 사진 크기가 다르면 높이 비율에 맞춰 같이 잘라요."
      : a.how === "common" ? `같은 크기 사진 ${a.n}장을 줄마다 비교해 공통 부분을 찾았어요: 위 ${a.t}px · 아래 ${a.b}px.`
      : a.how === "snap" ? `같은 크기 사진 ${a.n}장의 공통 부분이 툴바보다 길어서(화면 내용까지 같음), 툴바 범위 안의 뚜렷한 경계에서 잘랐어요: 위 ${a.t}px · 아래 ${a.b}px. 슬라이더로 확인해 주세요.`
      : a.how === "est" ? `${items.length < 2 ? "사진이 1장이라" : "공통 부분을 찾지 못해"} 휴대폰 화면 비율로 추정했어요: 위 ${a.t}px · 아래 ${a.b}px. 슬라이더로 맞춰 주세요.`
      : "휴대폰 캡처 비율이 아니라 자르지 않았어요. 필요하면 슬라이더로 잘라 주세요.";
  }

  function renderThumbs() {
    thumbs.innerHTML = items.map((it, i) => `<li class="im-th" data-id="${it.id}"><img src="${it.url}" alt="" width="84" height="112" draggable="false"><span class="im-no">${i + 1}</span><span class="im-btns"><button type="button" data-mv="-1" aria-label="${i + 1}번 앞으로" ${i === 0 ? "disabled" : ""}>◀</button><button type="button" data-mv="1" aria-label="${i + 1}번 뒤로" ${i === items.length - 1 ? "disabled" : ""}>▶</button><button type="button" data-rm aria-label="${i + 1}번 빼기">✕</button></span></li>`).join("");
  }

  function changed(redetect) {
    ui.hidden = !items.length;
    if (!items.length) { box.querySelector(".tk-next").hidden = true; return; }
    if (redetect) {
      detect();
      if (!trimTouched) f("trim").checked = !!mainRef && mainRef.auto.how !== "none";
    }
    $(".im-long-row").hidden = val("mode") !== "v";
    $(".im-cols").hidden = val("mode") !== "g";
    $(".im-gaps").classList.toggle("off", val("mode") === "v" && f("long").checked);
    renderThumbs(); trimUi(); schedule();
  }

  thumbs.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || box.classList.contains("is-busy")) return;
    const i = items.findIndex((x) => x.id === Number(b.closest("li").dataset.id));
    if (b.dataset.rm != null) { const [it] = items.splice(i, 1); URL.revokeObjectURL(it.url); changed(true); }
    else { const j = i + Number(b.dataset.mv); if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; changed(false); }
    const li = thumbs.children[Math.min(i, items.length - 1)];
    const again = li && li.querySelector(b.dataset.rm != null ? "[data-rm]" : `[data-mv="${b.dataset.mv}"]`);
    again && !again.disabled && again.focus();
  });

  // 끌어서 순서 바꾸기: 마우스는 바로, 터치는 살짝 길게 누른 뒤(스크롤과 구분)
  let drag = null;
  thumbs.addEventListener("pointerdown", (e) => {
    const li = e.target.closest("li");
    if (!li || e.target.closest("button") || e.button > 0 || box.classList.contains("is-busy")) return;
    drag = { li, x0: e.clientX, y0: e.clientY, pid: e.pointerId, on: false, touch: e.pointerType !== "mouse", target: -1 };
    if (drag.touch) drag.tm = setTimeout(() => start(), 250);
  });
  function start() {
    if (!drag || drag.on) return;
    drag.on = true;
    drag.rects = [...thumbs.children].map((el) => el.getBoundingClientRect());
    drag.from = [...thumbs.children].indexOf(drag.li);
    drag.li.classList.add("dragging");
    try { drag.li.setPointerCapture(drag.pid); } catch (e) { /* 무시 */ }
    if (navigator.vibrate && drag.touch) try { navigator.vibrate(15); } catch (e) { /* 무시 */ }
  }
  window.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.on) {
      if (Math.hypot(dx, dy) > (drag.touch ? 10 : 5)) { if (drag.touch) { clearTimeout(drag.tm); drag = null; } else start(); }
      if (!drag || !drag.on) return;
    }
    drag.li.style.transform = `translate(${dx}px,${dy}px)`;
    let t = -1;
    drag.rects.forEach((r, i) => { if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) t = i; });
    if (t !== drag.target) {
      [...thumbs.children].forEach((el, i) => el.classList.toggle("im-target", i === t && t !== drag.from));
      drag.target = t;
    }
  });
  const end = (e) => {
    if (!drag || (e && e.pointerId !== drag.pid)) return;
    clearTimeout(drag.tm);
    const d = drag; drag = null;
    if (!d.on) return;
    d.li.classList.remove("dragging"); d.li.style.transform = "";
    if (e.type === "pointerup" && d.target >= 0 && d.target !== d.from) {
      const [it] = items.splice(d.from, 1); items.splice(d.target, 0, it);
      changed(false);
    } else [...thumbs.children].forEach((el) => el.classList.remove("im-target"));
  };
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
  thumbs.addEventListener("touchmove", (e) => { if (drag && drag.on) e.preventDefault(); }, { passive: false });
  thumbs.addEventListener("contextmenu", (e) => { if (drag) e.preventDefault(); });

  // ---------- 옵션 ----------
  box.querySelectorAll(".im-opts input, .im-opts select").forEach((el) => el.addEventListener(el.type === "range" || el.type === "color" ? "input" : "change", () => {
    if (el.name === "trim") { trimTouched = true; trimUi(); }
    if (el.name === "trimTop" || el.name === "trimBot") {
      manual = { t: Number(f("trimTop").value), b: Number(f("trimBot").value) };
      trimUi();
    }
    if (el.name === "gap") $(".im-gap-out").textContent = `${el.value}px`;
    if (el.name === "mode" || el.name === "long") { changed(false); return; }
    schedule();
  }));
  $("[data-auto]").addEventListener("click", () => { manual = null; trimUi(); schedule(); });
  $("[data-clear]").addEventListener("click", () => { items.forEach((it) => URL.revokeObjectURL(it.url)); items = []; manual = null; trimTouched = false; PT.msg(box, ""); changed(true); });

  // ---------- 저장 ----------
  $("[data-save]").addEventListener("click", async () => {
    if (!items.length) return;
    const png = val("fmt") === "png", type = png ? "image/png" : "image/jpeg";
    PT.msg(box, ""); PT.busy(box, true, "이미지를 만드는 중…"); await PT.tick();
    const c = document.createElement("canvas");
    try {
      const pl = plan();
      let s = pl.s, blob = null;
      for (let tries = 0; tries < 3 && !blob; tries++) {
        draw(pl, s, c);
        blob = await new Promise((r) => c.toBlob(r, type, 0.92));
        if (!blob) s *= 0.7; // 메모리가 모자란 기기: 더 줄여서 다시
      }
      if (!blob) throw new Error("이미지를 만들지 못했어요. 장수를 줄이거나 저장 크기를 「작게」로 바꿔 보세요.");
      PT.save(blob, `사진이어붙이기_${items.length}장_${c.width}x${c.height}.${png ? "png" : "jpg"}`);
      PT.msg(box, `${c.width.toLocaleString("ko-KR")} × ${c.height.toLocaleString("ko-KR")}px ${png ? "PNG" : "JPG"} (${PT.size(blob.size)})로 저장했어요.${s < pl.s ? " 기기 메모리가 부족해 조금 더 줄였어요." : ""}`, "note");
    } catch (e) { PT.msg(box, e.message || String(e)); }
    finally { c.width = c.height = 0; PT.busy(box, false); }
  });
})();
