// 배경 지우기(누끼) — 사진 넣기 → 대상 자동 선택(가운데) → 누르기로 대상 바꾸기·더하기 → 브러시 보정 → 전후 비교 → PNG
// 의존: tool-kit.js, t-removebg-worker.js(+ vendor/mediapipe, Apache-2.0). 사진은 서버로 보내지 않습니다.
(function () {
  const box = document.querySelector('[data-tool="removebg"]');
  if (!box) return;
  const OPT = { exts: ["jpg", "jpeg", "png", "webp"], maxSize: 30 * PT.MB, maxCount: 1, reject: { heic: "HEIC(아이폰 사진)는 이 사이트의 「HEIC JPG 변환」에서 JPG로 바꾼 뒤 넣어 주세요.", gif: "GIF는 지원하지 않아요. JPG·PNG·WEBP로 넣어 주세요." } };
  const MAX_SIDE = 2048; // 처리·저장 해상도 상한(긴 변)
  const MODEL_SIDE = 1024; // 엔진에 넘기는 사진 크기(긴 변). 엔진 내부는 512로 줄여서 봄
  const MAX_PIXELS = 50e6;
  const $ = (s) => box.querySelector(s);
  const ui = $(".rb");
  const view = $(".rb-view"), cvB = $(".rb-before"), cvA = $(".rb-after"), cmp = $(".rb-cmp"), line = $(".rb-line"), tagB = $(".rb-tag-b"), tagA = $(".rb-tag-a");
  const hint = $(".rb-hint"), stat = $(".rb-stat");
  const brushIn = $('[name="rb-brush"]'), softIn = $('[name="rb-soft"]'), colorIn = $('[name="rb-color"]');
  const ver = (document.currentScript && new URL(document.currentScript.src).searchParams.get("v")) || "";
  const base = document.documentElement.dataset.base || "";

  let worker = null, ready = false, seq = 0;
  const waits = new Map();
  let st = null; // { name, W, H, rgba(Uint8ClampedArray), model(Uint8Array W*H), edit(Int8Array W*H), alpha(Uint8ClampedArray), points:[] }
  const undo = [];

  // ---------- 작업자 ----------
  function getWorker() {
    if (worker) return worker;
    worker = new Worker(`${base}/assets/t-removebg-worker.js${ver ? "?v=" + ver : ""}`);
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "progress") {
        PT.step(box, `배경 지우기 엔진 내려받는 중… ${(m.loaded / PT.MB).toFixed(1)} / ${(m.total / PT.MB).toFixed(1)}MB (처음 한 번만)`, m.loaded / m.total);
      } else if (m.type === "stage") {
        PT.step(box, m.text, 1);
      } else if (m.type === "ready") {
        ready = true; resolveAll("init", m);
      } else if (m.type === "error" && m.id == null) {
        rejectAll(new Error(m.message));
      } else if (waits.has(m.id)) {
        const w = waits.get(m.id); waits.delete(m.id);
        m.type === "error" ? w.reject(new Error(m.message)) : w.resolve(m);
      }
    };
    worker.onerror = (e) => { e.preventDefault && e.preventDefault(); rejectAll(new Error("배경 지우기 엔진을 시작하지 못했어요. 페이지를 새로 고친 뒤 다시 해 주세요.")); };
    return worker;
  }
  function call(msg, transfer) {
    const id = ++seq;
    return new Promise((resolve, reject) => { waits.set(id, { resolve, reject }); getWorker().postMessage({ ...msg, id }, transfer || []); });
  }
  function resolveAll(kind, m) { const w = waits.get(kind); if (w) { waits.delete(kind); w.resolve(m); } }
  function rejectAll(err) { for (const [k, w] of waits) { waits.delete(k); w.reject(err); } }
  function initEngine() {
    if (ready) return Promise.resolve();
    return new Promise((resolve, reject) => { waits.set("init", { resolve, reject }); getWorker().postMessage({ type: "init" }); });
  }

  // ---------- 사진 읽기 ----------
  async function loadImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url;
      try { await img.decode(); } catch (e) { throw new Error(`「${file.name}」은(는) 깨졌거나 읽을 수 없는 이미지예요.`); }
      const w0 = img.naturalWidth, h0 = img.naturalHeight;
      if (w0 * h0 > MAX_PIXELS) throw new Error(`「${file.name}」은(는) ${w0}×${h0}로 너무 커서 처리할 수 없어요(5천만 화소까지).`);
      const s = Math.min(1, MAX_SIDE / Math.max(w0, h0));
      const W = Math.max(1, Math.round(w0 * s)), H = Math.max(1, Math.round(h0 * s));
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, W, H);
      const rgba = ctx.getImageData(0, 0, W, H).data;
      const s2 = Math.min(1, MODEL_SIDE / Math.max(W, H));
      const bitmap = await createImageBitmap(c, { resizeWidth: Math.max(1, Math.round(W * s2)), resizeHeight: Math.max(1, Math.round(H * s2)), resizeQuality: "high" });
      return { W, H, w0, h0, rgba, canvas: c, bitmap };
    } finally { URL.revokeObjectURL(url); }
  }

  // 엔진 결과(작은 확률 지도) → 작업 해상도로 키우고 경계를 또렷하게
  function upscale(m, W, H) {
    const small = document.createElement("canvas"); small.width = m.w; small.height = m.h;
    const sctx = small.getContext("2d");
    const id = sctx.createImageData(m.w, m.h);
    for (let i = 0, j = 0; i < m.data.length; i++, j += 4) { id.data[j] = m.data[i]; id.data[j + 3] = 255; }
    sctx.putImageData(id, 0, 0);
    const big = document.createElement("canvas"); big.width = W; big.height = H;
    const bctx = big.getContext("2d", { willReadFrequently: true });
    bctx.imageSmoothingEnabled = true; bctx.imageSmoothingQuality = "high";
    bctx.drawImage(small, 0, 0, W, H);
    const d = bctx.getImageData(0, 0, W, H).data;
    const out = new Uint8Array(W * H);
    // 0.3~0.7 사이를 0~1로 늘려 반투명 띠를 줄임
    for (let i = 0, j = 0; i < out.length; i++, j += 4) { const v = (d[j] - 77) * 2.5; out[i] = v <= 0 ? 0 : v >= 255 ? 255 : v; }
    return out;
  }

  // 가로·세로 상자 흐림(2번 반복 ≈ 가우시안). 가장자리 부드럽게
  function blur(src, W, H, r) {
    if (r <= 0) return src;
    const a = new Float32Array(src), b = new Float32Array(src.length);
    const pass = (from, to, horiz) => {
      const n = horiz ? W : H, m = horiz ? H : W, win = 2 * r + 1;
      for (let k = 0; k < m; k++) {
        const idx = (t) => (horiz ? k * W + t : t * W + k);
        let sum = 0;
        for (let t = -r; t <= r; t++) sum += from[idx(Math.min(n - 1, Math.max(0, t)))];
        for (let t = 0; t < n; t++) {
          to[idx(t)] = sum / win;
          sum += from[idx(Math.min(n - 1, t + r + 1))] - from[idx(Math.max(0, t - r))];
        }
      }
    };
    for (let it = 0; it < 2; it++) { pass(a, b, true); pass(b, a, false); }
    return a;
  }

  function computeAlpha() {
    const { W, H, model, edit } = st;
    const m = new Uint8Array(model.length);
    for (let i = 0; i < m.length; i++) m[i] = edit[i] > 0 ? 255 : edit[i] < 0 ? 0 : model[i];
    const r = Number(softIn.value) || 0;
    const res = r ? blur(m, W, H, Math.round(r * Math.max(W, H) / 1024)) : m;
    const alpha = new Uint8ClampedArray(W * H);
    for (let i = 0; i < alpha.length; i++) alpha[i] = res[i];
    st.alpha = alpha;
  }

  function bgColor() {
    const v = (box.querySelector('[name="rb-bg"]:checked') || {}).value || "none";
    return v === "none" ? null : v === "custom" ? colorIn.value : v;
  }

  // 결과 그리기(전체 해상도)
  function render() {
    const { W, H, rgba, alpha } = st;
    const ctx = cvA.getContext("2d");
    const out = ctx.createImageData(W, H);
    const o = out.data;
    const bg = bgColor();
    if (bg) {
      const n = parseInt(bg.slice(1), 16), br = (n >> 16) & 255, bgG = (n >> 8) & 255, bb = n & 255;
      for (let i = 0, j = 0; i < alpha.length; i++, j += 4) {
        const a = alpha[i] / 255;
        o[j] = rgba[j] * a + br * (1 - a); o[j + 1] = rgba[j + 1] * a + bgG * (1 - a); o[j + 2] = rgba[j + 2] * a + bb * (1 - a); o[j + 3] = 255;
      }
    } else {
      for (let i = 0, j = 0; i < alpha.length; i++, j += 4) { o[j] = rgba[j]; o[j + 1] = rgba[j + 1]; o[j + 2] = rgba[j + 2]; o[j + 3] = alpha[i]; }
    }
    ctx.putImageData(out, 0, 0);
    view.classList.toggle("rb-solid", !!bg);
  }
  const refresh = () => { computeAlpha(); render(); };

  function setCompare(v) {
    cmp.value = v;
    cvA.style.clipPath = `inset(0 0 0 ${v}%)`; // 오른쪽: 결과
    cvB.style.clipPath = `inset(0 ${100 - v}% 0 0)`; // 왼쪽: 원본(결과의 투명한 곳 아래로 비치지 않게)
    line.style.left = v + "%";
    line.hidden = v <= 0 || v >= 100;
    tagB.hidden = v <= 0; tagA.hidden = v >= 100; // 보이는 쪽 이름표만
  }

  // ---------- 엔진 호출 ----------
  async function runSegment(points, label) {
    const cur = st;
    PT.msg(box, "");
    PT.busy(box, true, label || "배경 지우는 중…");
    try {
      if (!ready) { PT.step(box, "배경 지우기 엔진 내려받는 중…", 0); const t0 = performance.now(); await initEngine(); st.loadMs = Math.round(performance.now() - t0); }
      PT.step(box, label || "배경 지우는 중…", 1);
      const r = await call({ type: "segment", points });
      if (st !== cur) return false; // 그사이 다른 사진으로 바뀜
      st.model = upscale(r, st.W, st.H);
      st.points = points;
      st.lastMs = r.ms;
      refresh();
      return true;
    } catch (e) {
      PT.msg(box, (e && e.message) || "배경을 지우지 못했어요. 다시 시도해 주세요.");
      return false;
    } finally { PT.busy(box, false); }
  }

  function pushUndo() {
    undo.push({ model: st.model, edit: st.edit.slice(), points: st.points });
    if (undo.length > 8) undo.shift();
    $("[data-undo]").disabled = false;
  }

  // ---------- 파일 넣기 ----------
  PT.dropzone(box, async (files) => {
    const { ok, errs } = PT.check(files.slice(0, 1), OPT);
    PT.msg(box, errs.join(" "));
    if (!ok.length) return;
    const file = ok[0];
    stat.textContent = "";
    PT.busy(box, true, "사진 읽는 중…");
    let img;
    try { img = await loadImage(file); }
    catch (e) { PT.busy(box, false); PT.msg(box, e.message); return; }
    PT.busy(box, false);
    st = { name: file.name, W: img.W, H: img.H, rgba: img.rgba, model: new Uint8Array(img.W * img.H).fill(255), edit: new Int8Array(img.W * img.H), points: [] };
    undo.length = 0; $("[data-undo]").disabled = true;
    for (const c of [cvB, cvA]) { c.width = img.W; c.height = img.H; }
    cvB.getContext("2d").drawImage(img.canvas, 0, 0);
    view.style.setProperty("--ar", String(img.W / img.H));
    try { await call({ type: "image", bitmap: img.bitmap }, [img.bitmap]); }
    catch (e) { PT.msg(box, e.message); return; }
    box.querySelector(".drop").hidden = true;
    ui.hidden = false;
    setMode("pick");
    const okSeg = await runSegment([{ x: 0.5, y: 0.5 }]);
    if (!okSeg) { box.querySelector(".drop").hidden = false; ui.hidden = true; return; }
    setCompare(50);
    const shrunk = img.W !== img.w0 ? ` 원본 ${img.w0}×${img.h0}을 긴 변 ${MAX_SIDE}px에 맞췄어요.` : "";
    stat.textContent = `${img.W}×${img.H}px · 배경 지우기 ${(st.lastMs / 1000).toFixed(1)}초${st.loadMs ? ` · 엔진 준비 ${(st.loadMs / 1000).toFixed(1)}초` : ""}.${shrunk}`;
    const next = box.querySelector(".tk-next"); if (next) next.hidden = false;
    ui.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  });

  // ---------- 모드: 대상 바꾸기 / 더하기 / 지우기 / 되살리기 ----------
  const HINTS = {
    pick: "남기고 싶은 대상(사람·물건·동물)을 사진에서 눌러 주세요. 누른 대상만 남기고 배경을 지워요.",
    add: "같이 남길 대상을 더 눌러 주세요. 누를 때마다 대상이 더해져요.",
    erase: "덜 지워진 배경을 문질러서 지우세요.",
    restore: "잘못 지워진 부분을 문질러서 되살리세요.",
  };
  let mode = "pick";
  function setMode(m) {
    mode = m;
    const r = box.querySelector(`[name="rb-mode"][value="${m}"]`); if (r) r.checked = true;
    hint.textContent = HINTS[m];
    view.dataset.mode = m;
    $(".rb-brush-row").hidden = !(m === "erase" || m === "restore");
    if ((m === "erase" || m === "restore") && Number(cmp.value) > 0) setCompare(0); // 보정할 때는 결과 전체를 보이게
  }
  box.querySelectorAll('[name="rb-mode"]').forEach((r) => r.addEventListener("change", () => setMode(r.value)));

  const toImg = (e) => {
    const rc = cvA.getBoundingClientRect();
    return { x: ((e.clientX - rc.left) / rc.width) * st.W, y: ((e.clientY - rc.top) / rc.height) * st.H, scale: st.W / rc.width };
  };

  // 브러시: 원 안의 편집값을 바꾸고 그 부분만 바로 다시 그림. 손을 떼면 전체를 다시 계산(부드럽게 적용)
  let drawing = null;
  function dab(p, prev) {
    const { W, H, edit, rgba } = st;
    const r = Math.max(2, (Number(brushIn.value) / 2) * p.scale);
    const val = mode === "erase" ? -1 : 1;
    const steps = prev ? Math.max(1, Math.ceil(Math.hypot(p.x - prev.x, p.y - prev.y) / (r / 3))) : 1;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let s = 1; s <= steps; s++) {
      const cx = prev ? prev.x + ((p.x - prev.x) * s) / steps : p.x, cy = prev ? prev.y + ((p.y - prev.y) * s) / steps : p.y;
      const ax = Math.max(0, Math.floor(cx - r)), bx = Math.min(W - 1, Math.ceil(cx + r)), ay = Math.max(0, Math.floor(cy - r)), by = Math.min(H - 1, Math.ceil(cy + r));
      for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) edit[y * W + x] = val;
      x0 = Math.min(x0, ax); y0 = Math.min(y0, ay); x1 = Math.max(x1, bx); y1 = Math.max(y1, by);
    }
    if (x1 < x0) return;
    // 미리보기: 해당 영역만 즉시 반영(부드럽게는 손을 뗀 뒤)
    const ctx = cvA.getContext("2d");
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const part = ctx.getImageData(x0, y0, w, h), d = part.data;
    const bg = bgColor();
    const n = bg ? parseInt(bg.slice(1), 16) : 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y0 + y) * W + x0 + x;
      if (!edit[i]) continue;
      const a = edit[i] > 0 ? 1 : 0, j = (y * w + x) * 4, k = i * 4;
      if (bg) { d[j] = a ? rgba[k] : (n >> 16) & 255; d[j + 1] = a ? rgba[k + 1] : (n >> 8) & 255; d[j + 2] = a ? rgba[k + 2] : n & 255; d[j + 3] = 255; }
      else { d[j] = rgba[k]; d[j + 1] = rgba[k + 1]; d[j + 2] = rgba[k + 2]; d[j + 3] = a * 255; }
    }
    ctx.putImageData(part, x0, y0);
  }
  view.addEventListener("pointerdown", async (e) => {
    if (!st || box.classList.contains("is-busy") || (e.pointerType === "mouse" && e.button !== 0)) return;
    const p = toImg(e);
    if (p.x < 0 || p.y < 0 || p.x > st.W || p.y > st.H) return;
    if (mode === "erase" || mode === "restore") {
      e.preventDefault();
      pushUndo();
      view.setPointerCapture(e.pointerId);
      drawing = p; dab(p);
      return;
    }
    const pt = { x: Math.min(1, Math.max(0, p.x / st.W)), y: Math.min(1, Math.max(0, p.y / st.H)) };
    pushUndo();
    const pts = mode === "add" ? st.points.concat([pt]) : [pt];
    if (mode === "pick") st.edit.fill(0); // 대상을 바꾸면 손 보정도 처음부터
    const okSeg = await runSegment(pts, mode === "add" ? "대상 더하는 중…" : "대상 다시 찾는 중…");
    if (okSeg && Number(cmp.value) > 0) setCompare(0);
  });
  view.addEventListener("pointermove", (e) => { if (!drawing) return; e.preventDefault(); const p = toImg(e); dab(p, drawing); drawing = p; });
  const endDraw = () => { if (!drawing) return; drawing = null; refresh(); };
  view.addEventListener("pointerup", endDraw);
  view.addEventListener("pointercancel", endDraw);

  // ---------- 옵션 ----------
  cmp.addEventListener("input", () => setCompare(Number(cmp.value)));
  const bOut = $(".rb-brush-out"), sOut = $(".rb-soft-out");
  brushIn.addEventListener("input", () => { bOut.textContent = brushIn.value; });
  let softT = 0;
  softIn.addEventListener("input", () => { sOut.textContent = softIn.value; clearTimeout(softT); softT = setTimeout(() => st && refresh(), 60); });
  box.querySelectorAll('[name="rb-bg"]').forEach((r) => r.addEventListener("change", () => st && render()));
  colorIn.addEventListener("input", () => { const c = box.querySelector('[name="rb-bg"][value="custom"]'); c.checked = true; st && render(); });

  const busy = () => box.classList.contains("is-busy");
  $("[data-undo]").addEventListener("click", () => {
    if (busy()) return;
    const u = undo.pop(); if (!u || !st) return;
    st.model = u.model; st.edit = u.edit; st.points = u.points;
    refresh();
    $("[data-undo]").disabled = !undo.length;
  });
  $("[data-again]").addEventListener("click", async () => {
    if (!st || busy()) return;
    pushUndo(); st.edit.fill(0);
    await runSegment([{ x: 0.5, y: 0.5 }], "처음 결과로 되돌리는 중…");
    setMode("pick");
  });
  $("[data-new]").addEventListener("click", () => {
    if (busy()) return;
    st = null; undo.length = 0; ui.hidden = true; PT.msg(box, "");
    const d = box.querySelector(".drop"); d.hidden = false;
    d.querySelector("input").click();
  });
  $("[data-save]").addEventListener("click", () => {
    if (!st || busy()) return;
    const btn = $("[data-save]");
    btn.disabled = true;
    cvA.toBlob((blob) => {
      btn.disabled = false;
      if (!blob) { PT.msg(box, "PNG로 저장하지 못했어요. 사진 크기를 줄여 다시 해 주세요."); return; }
      PT.save(blob, `${PT.base(st.name)}-${bgColor() ? "bg" : "nobg"}.png`);
    }, "image/png");
  });
})();
