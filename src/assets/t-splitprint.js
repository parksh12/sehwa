// 이미지 분할 인쇄 (P2-73): 그림 한 장 → 용지·방향·배열·여백·겹침 → 종이 미리보기(종이로 보기·붙였을 때·한 장씩) → PDF·바로 인쇄·조각 이미지(zip)
// 계산식: split-calc.js(SPLITCALC, 빌드 대조 시험과 같은 파일). PDF: vendor/pdf-lib(PT.needPdf, 늦게 받기) — 원본 그림을 한 번만 넣고 쪽마다 잘라(클리핑) 보여 줌.
// zip: vendor/fflate(PT.need, 늦게 받기, 무압축). 그림은 이 브라우저 안에서만 읽고 처리합니다(서버 전송 없음, 설정도 저장하지 않음).
(function () {
  const box = document.querySelector('[data-tool="splitprint"]');
  if (!box || !window.SPLITCALC) return;
  const SC = window.SPLITCALC;
  const OPT = { exts: ["jpg", "jpeg", "png", "webp", "heic", "heif"], maxSize: 50 * PT.MB, maxCount: 1, reject: { gif: "GIF는 지원하지 않아요. JPG·PNG로 바꿔 넣어 주세요.", pdf: "PDF는 그림 파일이 아니에요. 「PDF JPG 변환」으로 그림으로 바꾼 뒤 넣어 주세요.", svg: "SVG는 지원하지 않아요. PNG로 저장해 넣어 주세요." } };
  const MAX_PIXELS = 150e6;
  const EDGE = 4; // 프린터가 못 찍는 가장자리(어림, mm)
  const $ = (s) => box.querySelector(s);
  const f = (n) => box.querySelector(`[name="${n}"]`);
  const val = (n) => { const c = box.querySelector(`[name="${n}"]:checked`); return c ? c.value : f(n) && f(n).value; };
  const ui = $(".sp"), cv = $(".sp-canvas"), stage = $(".sp-stage"), one = $(".sp-one"), alerts = $(".sp-alerts");
  const fmt1 = (n) => (Math.round(n * 10) / 10).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const num = (s) => { const v = parseFloat(String(s || "").replace(/,/g, ".").replace(/[^0-9.]/g, "")); return isFinite(v) ? v : NaN; };
  const PAPER_SHORT = { a4: "A4", a3: "A3", a5: "A5", b4: "B4", b5: "B5", letter: "레터" };
  const ORI = { p: "세로", l: "가로" };
  const coarse = matchMedia("(pointer: coarse)").matches;

  let src = null; // { file, base, img, w, h, kind, bytes, orient, bmp, emb }
  let L = null, adj = { zoom: 1, ox: 0, oy: 0 }, view = "paper", cur = 0, skipBlank = false, sizeBy = "w";
  let pdfCache = { key: "", blob: null, pages: 0, note: "" };

  // ---------- 그림 넣기: 선택 · 끌어 놓기 · 붙여 넣기 ----------
  PT.dropzone(box, (files) => add(files), { paste: true }); // P2-82 붙여넣기는 공통 부품(PT.paste: 글자 입력칸에서는 손대지 않음)
  ["pointerdown", "dragenter", "focusin"].forEach((t) => box.querySelector(".drop").addEventListener(t, () => PT.needPdf().catch(() => {}), { once: true }));

  // JPEG EXIF 방향(1~8). 읽지 못하면 1
  function orientation(buf) {
    try {
      const v = new DataView(buf);
      if (v.getUint16(0) !== 0xffd8) return 1;
      let off = 2;
      while (off + 4 < v.byteLength) {
        const marker = v.getUint16(off); off += 2;
        if (marker === 0xffe1) {
          if (v.getUint32(off + 2) !== 0x45786966) return 1;
          const tiff = off + 8, le = v.getUint16(tiff) === 0x4949;
          const ifd = tiff + v.getUint32(tiff + 4, le), n = v.getUint16(ifd, le);
          for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (v.getUint16(e, le) === 0x0112) return v.getUint16(e + 8, le); }
          return 1;
        }
        if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
        off += v.getUint16(off);
      }
    } catch (e) {}
    return 1;
  }

  async function add(files) {
    const { ok, errs } = PT.check(files.slice(0, 1), OPT, []);
    PT.msg(box, errs.join(" "));
    if (!ok.length) return;
    const file = ok[0];
    PT.busy(box, true, "그림을 읽는 중…"); await PT.tick();
    try {
      const url = URL.createObjectURL(file);
      const img = new Image(); img.decoding = "async"; img.src = url;
      try { await img.decode(); }
      catch (e) {
        URL.revokeObjectURL(url);
        const ext = PT.ext(file.name);
        throw new Error(ext === "heic" || ext === "heif" ? "이 브라우저는 HEIC 사진을 직접 열지 못해요. 이 사이트의 「HEIC JPG 변환」에서 JPG로 바꾼 뒤 넣어 주세요(아이폰·맥 사파리에서는 바로 넣을 수 있어요)." : `「${file.name}」은(는) 깨졌거나 읽을 수 없는 그림이에요.`);
      }
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) throw new Error(`「${file.name}」에서 그림 크기를 읽지 못했어요.`);
      if (w * h > MAX_PIXELS) { URL.revokeObjectURL(url); throw new Error(`그림이 ${(w * h / 1e6).toFixed(0)}백만 화소라 너무 커요. 1억 5천만 화소까지 넣을 수 있어요.`); }
      const buf = await PT.readBuf(file), b = new Uint8Array(buf);
      const kind = b[0] === 0xff && b[1] === 0xd8 ? "jpg" : b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 ? "png" : "other";
      // 미리보기용 축소본(긴 변 2400px): 손으로 옮길 때도 빠르게 다시 그리기
      const k = Math.min(1, 2400 / Math.max(w, h));
      const bmp = document.createElement("canvas"); bmp.width = Math.max(1, Math.round(w * k)); bmp.height = Math.max(1, Math.round(h * k));
      bmp.getContext("2d").drawImage(img, 0, 0, bmp.width, bmp.height);
      // 단계별 축소본(반씩, 긴 변 300px까지): 미리보기에 보이는 크기에 맞는 것을 골라 그려 조작 중에도 가볍게(P2-73b)
      const mips = [bmp];
      for (let m = bmp; Math.max(m.width, m.height) > 600;) { const n = document.createElement("canvas"); n.width = Math.max(1, Math.round(m.width / 2)); n.height = Math.max(1, Math.round(m.height / 2)); const g = n.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(m, 0, 0, n.width, n.height); mips.push(n); m = n; }
      if (src && src.url) URL.revokeObjectURL(src.url);
      src = { file, url, base: PT.base(file.name), img, w, h, kind, bytes: b, orient: kind === "jpg" ? orientation(buf) : 1, bmp, mips, emb: null };
      adj = { zoom: 1, ox: 0, oy: 0 }; cur = 0; skipBlank = false; pdfCache = { key: "" };
      $(".sp-fname").innerHTML = `<b>${PT.esc(file.name)}</b> · ${w.toLocaleString("ko-KR")} × ${h.toLocaleString("ko-KR")}px · ${PT.size(file.size)}`;
      ui.hidden = false;
      box.querySelector(".drop").hidden = true; box.querySelector(".safe") && (box.querySelector(".safe").hidden = true);
      box.querySelector(".tk-next").hidden = false;
      update();
      PT.needPdf().catch(() => {});
    } catch (e) { PT.msg(box, e.message || String(e)); }
    finally { PT.busy(box, false); }
  }
  $("[data-other]").addEventListener("click", () => box.querySelector(".drop input").click());
  // 다른 그림을 고를 때 넣는 칸이 숨겨져 있어도 파일 선택 창은 열림(PT.dropzone이 change를 받음)

  // ---------- 설정 읽기 ----------
  function opts() {
    const mg = val("mg");
    let margin = mg === "c" ? num(f("mmm").value) : Number(mg);
    if (!isFinite(margin)) margin = 0;
    margin = Math.max(0, Math.min(30, margin));
    const o = { paper: val("paper"), orient: val("orient"), mode: val("mode"), cols: Number(val("cols")), rows: Number(val("rows")), count: Math.max(1, Math.min(SC.MAXCOUNT, Math.floor(num(f("count").value)) || 1)), fit: val("fit"), margin, overlap: Number(val("overlap")), marks: f("marks").checked, labels: f("labels").checked, guide: f("guide").checked };
    if (o.mode === "size") { const wv = num(f("wcm").value), hv = num(f("hcm").value); if (sizeBy === "h" && hv > 0) o.hCm = hv; else if (wv > 0) o.wCm = wv; else if (hv > 0) o.hCm = hv; }
    return o;
  }
  const ERR = {
    tooMany: (r) => `그 크기는 가로 ${r.cols}장 × 세로 ${r.rows}장이 필요해요. 가로·세로는 10장까지 나눌 수 있어요. 크기를 줄이거나 더 큰 용지(A3)를 골라 주세요.`,
    overlap: () => "겹침이 인쇄 칸에 비해 너무 커요. 겹침을 줄여 주세요.",
    margin: () => "여백이 너무 커요. 30mm 이하로 줄여 주세요.",
    size: () => "완성 가로나 세로를 cm로 넣어 주세요. 예: 60",
    count: () => "총 매수를 1~100 사이로 넣어 주세요.",
  };

  // ---------- 다시 계산하고 그리기 ----------
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); };
  function update() {
    if (!src) return;
    const o = opts();
    $(".sp-fit").hidden = o.mode === "size";
    box.querySelectorAll("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== o.mode));
    $(".sp-mcustom").hidden = val("mg") !== "c";
    const r = SC.layout({ ...o, iw: src.w, ih: src.h, adj });
    const okL = !r.err;
    $(".sp-err").hidden = okL;
    if (!okL) { $(".sp-err").textContent = (ERR[r.err] || (() => "설정을 확인해 주세요."))(r); setDisabled(true); hbox.hidden = true; return; }
    setDisabled(false);
    L = r; L.o = o;
    adj = { zoom: L.adj.zoom, ox: L.adj.ox, oy: L.adj.oy };
    if (o.mode === "size") { // 다른 쪽 칸에 비율대로 계산한 값을 보여 줌
      const other = sizeBy === "h" ? f("wcm") : f("hcm");
      if (document.activeElement !== other) other.value = fmt1((sizeBy === "h" ? L.img.w : L.img.h) / 10).replace(/,/g, "");
    }
    if (cur >= L.tiles.length) cur = 0;
    $(".sp-dlg-paper").textContent = `${PAPER_SHORT[o.paper]} (${ORI[L.orient]})`;
    summary(); drawScale(); drawMain(); placeBox(); readout(); hints(); if (view === "one") drawOne(); drawOrder(); names();
  }
  function setDisabled(on) { box.querySelectorAll("[data-save],[data-print],[data-zip],[data-tile]").forEach((b) => (b.disabled = on)); }
  const usedTiles = () => L.tiles.filter((t) => !(skipBlank && t.blank));
  const blankN = () => L.tiles.filter((t) => t.blank).length;

  function summary() {
    const o = L.o, n = skipBlank ? L.sheets : L.total;
    $(".sp-cm").textContent = `${fmt1(L.view.w / 10)} × ${fmt1(L.view.h / 10)} cm`;
    $(".sp-line").textContent = `${PAPER_SHORT[o.paper]} ${ORI[L.orient]} ${n}장 · ${L.cols}열 × ${L.rows}행`;
    const dpi = Math.round(L.dpi);
    let s = `한 장의 인쇄 칸 ${fmt1(L.tw / 10)} × ${fmt1(L.th / 10)}cm · 인쇄 해상도 약 ${dpi} DPI${dpi >= 300 ? " (또렷해요)" : dpi >= 150 ? " (포스터로 충분해요)" : ""}`;
    if (o.orient === "auto" && L.alt) s += L.alt.over ? ` · 자동: ${ORI[L.alt.orient]} 방향은 10장을 넘어서 ${ORI[L.orient]} 방향을 골랐어요` : ` · 자동: ${ORI[L.orient]} 방향을 골랐어요(${ORI[L.alt.orient]} 방향은 ${L.alt.cols}열 × ${L.alt.rows}행 ${L.alt.sheets}장)`;
    if (o.fit === "fill" && o.mode !== "size") s += " · 넘치는 가장자리는 잘려요";
    $(".sp-sum").textContent = s;
    // 알림: 해상도·빈 장·프린터 가장자리
    const a = [];
    if (dpi < 150) a.push(`<p class="sp-al warn"><b>흐릴 수 있어요.</b> 인쇄 해상도가 약 ${dpi} DPI${dpi < 100 ? "로 낮아서 가까이서 보면 많이 흐려요" : "예요. 멀리서 보는 포스터는 괜찮지만 가까이서 보면 흐릴 수 있어요"}. 장 수를 줄이거나 더 큰 원본을 쓰면 또렷해져요. 미리보기에서 노란 ! 표시가 붙은 장이에요.</p>`);
    const bn = blankN();
    if (bn) a.push(skipBlank ? `<p class="sp-al">빈 장 ${bn}장을 PDF와 조각 이미지에서 뺐어요. <button type="button" class="btn ghost sp-al-btn" data-blank="0">빈 장 다시 넣기</button></p>` : `<p class="sp-al">아무것도 찍히지 않는 빈 장이 ${bn}장 있어요. <button type="button" class="btn sp-al-btn" data-blank="1">빈 장 ${bn}장 빼기</button>${o.mode !== "size" && o.fit === "fit" ? ` <button type="button" class="btn ghost sp-al-btn" data-fill>꽉 채우기로 바꾸기</button>` : ""}</p>`);
    if (o.margin < EDGE) a.push(`<p class="sp-al">여백이 ${o.margin}mm라 가정용 프린터에서는 가장자리 약 3~5mm가 안 찍힐 수 있어요. ${f("edge").checked ? "미리보기의 회색 띠가 그 자리예요." : `<button type="button" class="btn ghost sp-al-btn" data-edge>안 찍히는 곳 보기</button>`}</p>`);
    alerts.innerHTML = a.join("");
  }
  alerts.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.blank != null) skipBlank = b.dataset.blank === "1";
    if (b.dataset.fill != null) { const r = box.querySelector('[name="fit"][value="fill"]'); r.checked = true; }
    if (b.dataset.edge != null) f("edge").checked = true;
    update();
    const again = alerts.querySelector("button"); again && again.focus();
  });

  // ---------- 그리기 도구 ----------
  const dpr = () => Math.min(3, window.devicePixelRatio || 1);
  function sizeCanvas(c, w, h) {
    const d = dpr();
    c.style.width = w + "px"; c.style.height = h + "px";
    const W = Math.max(1, Math.round(w * d)), H = Math.max(1, Math.round(h * d));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext("2d"); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, w, h);
    return ctx;
  }
  const innerW = (el) => { const cs = getComputedStyle(el); return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); }; // 안쪽 폭(넘침 방지)
  const css = (name, fb) => (getComputedStyle(box).getPropertyValue(name) || "").trim() || fb;
  let hatchPat = null;
  function hatch(ctx) {
    if (hatchPat) return hatchPat;
    const p = document.createElement("canvas"); p.width = p.height = 8;
    const g = p.getContext("2d"); g.strokeStyle = "rgba(229,55,43,.75)"; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-2, 10); g.lineTo(10, -2); g.moveTo(-2, 2); g.lineTo(2, -2); g.moveTo(6, 10); g.lineTo(10, 6); g.stroke();
    return (hatchPat = ctx.createPattern(p, "repeat"));
  }
  // 겹치는 띠(장 안 좌표, mm): 이웃한 장과 같은 그림이 찍히는 곳
  function bands(t) {
    const o = L.overlap, out = [];
    if (o <= 0) return out;
    if (t.c > 0) out.push([0, 0, o, L.th]);
    if (t.c < L.cols - 1) out.push([L.tw - o, 0, o, L.th]);
    if (t.r > 0) out.push([0, 0, L.tw, o]);
    if (t.r < L.rows - 1) out.push([0, L.th - o, L.tw, o]);
    return out;
  }
  // 종이 한 장 그리기. (X, Y) 종이 왼쪽 위(css px), s = px/mm
  function drawSheet(ctx, t, X, Y, s, opt = {}) {
    const m = L.margin, pw = L.pw * s, ph = L.ph * s, skipped = skipBlank && t.blank;
    if (opt.shadow !== false) { ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fillRect(X + 3, Y + 3, pw, ph); }
    ctx.fillStyle = skipped ? "#ecebe6" : "#fff"; ctx.fillRect(X, Y, pw, ph);
    ctx.strokeStyle = "#a9a9a9"; ctx.lineWidth = 1; ctx.strokeRect(X + 0.5, Y + 0.5, pw - 1, ph - 1);
    const cx = X + m * s, cy = Y + m * s, cw = L.tw * s, ch = L.th * s;
    if (!t.blank) {
      ctx.save(); ctx.beginPath(); ctx.rect(cx, cy, cw, ch); ctx.clip();
      ctx.imageSmoothingQuality = opt.live ? "medium" : "high";
      ctx.drawImage(opt.pic || src.bmp, cx + (L.img.x - t.x0) * s, cy + (L.img.y - t.y0) * s, L.img.w * s, L.img.h * s);
      if (opt.hatch !== false) for (const [bx, by, bw, bh] of bands(t)) { ctx.fillStyle = hatch(ctx); ctx.fillRect(cx + bx * s, cy + by * s, bw * s, bh * s); }
      ctx.restore();
    }
    if (m > 0 && opt.frame !== false) { ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(20,20,20,.35)"; ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1); ctx.setLineDash([]); }
    if (opt.marks) pdfMarks(ctx, t, X, Y, s);
    if (f("edge").checked) { // 프린터가 못 찍는 가장자리(어림)
      const e = EDGE * s; ctx.fillStyle = "rgba(95,95,95,.62)";
      ctx.fillRect(X, Y, pw, e); ctx.fillRect(X, Y + ph - e, pw, e); ctx.fillRect(X, Y + e, e, ph - 2 * e); ctx.fillRect(X + pw - e, Y + e, e, ph - 2 * e);
    }
    if (t.blank) {
      ctx.strokeStyle = "rgba(20,20,20,.25)"; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + cw, cy + ch); ctx.moveTo(cx + cw, cy); ctx.lineTo(cx, cy + ch); ctx.stroke();
      pill(ctx, X + pw / 2, Y + ph / 2, skipped ? "빼요" : "빈 장", Math.max(10, Math.min(16, pw / 6)), "#6b6b6b");
    } else if (L.dpi < 150 && opt.warn !== false) { // 흐릴 수 있는 장: 노란 ! 표시
      const z = Math.max(12, Math.min(22, pw / 5));
      ctx.fillStyle = "#ffc21a"; ctx.strokeStyle = "#141414"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(X + 4, Y + 4 + z); ctx.lineTo(X + 4 + z / 2, Y + 4); ctx.lineTo(X + 4 + z, Y + 4 + z); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#141414"; ctx.font = `800 ${Math.round(z * 0.62)}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText("!", X + 4 + z / 2, Y + 4 + z * 0.9);
    }
    if (opt.badge !== false && !t.blank) pill(ctx, X + pw / 2, Y + ph / 2, opt.badgeText || `${order(t)} · ${t.label}`, Math.max(10, Math.min(17, pw / 6)), "#141414");
    if (opt.current) { ctx.strokeStyle = "#e5372b"; ctx.lineWidth = 3; ctx.strokeRect(X - 1.5, Y - 1.5, pw + 3, ph + 3); }
  }
  const order = (t) => usedTiles().indexOf(t) + 1 || "-";
  function pill(ctx, x, y, text, size, color) {
    ctx.font = `800 ${size}px "Pretendard Variable", sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const w = ctx.measureText(text).width + size * 0.9, h = size * 1.6;
    ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); else ctx.rect(x - w / 2, y - h / 2, w, h); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.fillText(text, x, y + 0.5);
  }
  // PDF에 들어가는 표시(자르는 선·겹침 선·위치 표시)를 화면에 같은 자리로
  function pdfMarks(ctx, t, X, Y, s) {
    const o = L.o, m = L.margin;
    ctx.save(); ctx.strokeStyle = "#777"; ctx.lineWidth = 1;
    if (o.marks) {
      for (const g of cropMarks(t)) { ctx.beginPath(); ctx.moveTo(X + g[0] * s, Y + g[1] * s); ctx.lineTo(X + g[2] * s, Y + g[3] * s); ctx.stroke(); }
      ctx.setLineDash([4, 3]);
      for (const g of seamLines(t)) { ctx.beginPath(); ctx.moveTo(X + g[0] * s, Y + g[1] * s); ctx.lineTo(X + g[2] * s, Y + g[3] * s); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    if (o.labels && !t.blank) { const p = labelSpot(t); ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.fillRect(X + p.x * s, Y + p.y * s, p.w * s, p.h * s); ctx.fillStyle = "#555"; ctx.font = `700 ${Math.max(7, p.h * s * 0.72)}px sans-serif`; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(labelText(t), X + (p.x + p.w - 0.6) * s, Y + (p.y + p.h / 2) * s); }
    ctx.restore();
  }
  // 종이 좌표(mm, 왼쪽 위 원점) 선 목록 — PDF·조각 이미지·화면이 같은 값을 씀
  function cropMarks(t) {
    const m = L.margin; if (m < 2.5) return [];
    const len = Math.min(m - 1.2, 5), x0 = m, y0 = m, x1 = m + L.tw, y1 = m + L.th, g = 1;
    return [[x0 - g, y0, x0 - g - len, y0], [x0, y0 - g, x0, y0 - g - len], [x1 + g, y0, x1 + g + len, y0], [x1, y0 - g, x1, y0 - g - len], [x0 - g, y1, x0 - g - len, y1], [x0, y1 + g, x0, y1 + g + len], [x1 + g, y1, x1 + g + len, y1], [x1, y1 + g, x1, y1 + g + len]];
  }
  function seamLines(t) {
    const m = L.margin, o = L.overlap, out = []; if (o <= 0) return out;
    if (t.c < L.cols - 1) out.push([m + L.tw - o, m, m + L.tw - o, m + L.th]);
    if (t.r < L.rows - 1) out.push([m, m + L.th - o, m + L.tw, m + L.th - o]);
    return out;
  }
  const labelText = (t) => `${t.label} · ${t.r + 1}행 ${t.c + 1}열 · ${order(t)}/${usedTiles().length}`;
  // 위치 표시 자리(mm): 아래 여백이 넉넉하면 여백에, 아니면 인쇄 칸 오른쪽 아래(겹침이 있으면 다음 장에 덮이는 곳)
  function labelSpot(t) {
    const m = L.margin, h = 3.2, w = 34;
    if (m >= 4.5) return { x: m + L.tw - w, y: m + L.th + (m - h) / 2, w, h };
    return { x: m + L.tw - w - 1.5, y: m + L.th - h - 1.5, w, h };
  }

  // ---------- 큰 미리보기: 종이로 보기 · 붙였을 때 ----------
  let hits = [], geo = null;
  function availH() { return coarse || innerWidth < 700 ? Math.max(260, innerHeight * 0.5) : Math.max(320, Math.min(640, innerHeight * 0.66)); }
  // 보이는 크기(기기 화소)보다 크거나 같은 것 중 가장 작은 축소본
  function pick(needW) { const m = src.mips || [src.bmp]; for (let i = m.length - 1; i >= 0; i--) if (m[i].width >= needW) return m[i]; return m[0]; }
  // live = 손으로 조작하는 동안(가벼운 미리보기만, 요약·조립도·썸네일은 손을 뗀 뒤)
  function drawMain(live) {
    if (view === "one") return;
    const W0 = Math.max(200, Math.floor(innerW(stage))), pad = 12;
    hits = [];
    if (!src.warm) { // 축소본을 처음 그릴 때 생기는 멈칫(그래픽 메모리로 올리기)을 조작 전에 미리 한 번
      src.warm = true;
      const c = cv.getContext("2d"); for (const m of src.mips || []) c.drawImage(m, 0, 0, 1, 1);
    }
    if (view === "paper") {
      const g = innerWidth < 500 ? 6 : 10;
      const s = Math.min((W0 - 2 * pad - (L.cols - 1) * g) / (L.cols * L.pw), (availH() - 2 * pad - (L.rows - 1) * g) / (L.rows * L.ph));
      const tw = L.cols * L.pw * s + (L.cols - 1) * g, th = L.rows * L.ph * s + (L.rows - 1) * g;
      const ctx = sizeCanvas(cv, W0, th + 2 * pad);
      const ox = (W0 - tw) / 2, pic = { live, pic: pick(L.img.w * s * dpr()) };
      for (const t of L.tiles) {
        const X = ox + t.c * (L.pw * s + g), Y = pad + t.r * (L.ph * s + g);
        drawSheet(ctx, t, X, Y, s, pic);
        hits.push({ t, x: X, y: Y, w: L.pw * s, h: L.ph * s });
      }
      geo = { view, s, W0, H0: th + 2 * pad, area: { x: ox, y: pad, w: tw, h: th }, bx: ox, by: pad, sx: L.pw * s + g, sy: L.ph * s + g };
    } else {
      const s = Math.min((W0 - 2 * pad) / L.W, (availH() - 2 * pad) / L.H);
      const w = L.W * s, h = L.H * s, ctx = sizeCanvas(cv, W0, h + 2 * pad), X = (W0 - w) / 2, Y = pad;
      ctx.fillStyle = "rgba(0,0,0,.22)"; ctx.fillRect(X + 3, Y + 3, w, h);
      ctx.fillStyle = "#fff"; ctx.fillRect(X, Y, w, h);
      ctx.save(); ctx.beginPath(); ctx.rect(X, Y, w, h); ctx.clip();
      ctx.imageSmoothingQuality = live ? "medium" : "high";
      ctx.drawImage(pick(L.img.w * s * dpr()), X + L.img.x * s, Y + L.img.y * s, L.img.w * s, L.img.h * s);
      ctx.restore();
      // 이음선: 다음 장의 가장자리가 놓이는 곳(장 c의 시작 x = c × (인쇄 칸 − 겹침))
      ctx.save(); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(229,55,43,.95)";
      for (let c = 1; c < L.cols; c++) { const x = X + c * (L.tw - L.overlap) * s; ctx.beginPath(); ctx.moveTo(x, Y); ctx.lineTo(x, Y + h); ctx.stroke(); }
      for (let r = 1; r < L.rows; r++) { const y = Y + r * (L.th - L.overlap) * s; ctx.beginPath(); ctx.moveTo(X, y); ctx.lineTo(X + w, y); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = "#141414"; ctx.lineWidth = 1.5; ctx.strokeRect(X, Y, w, h);
      for (const t of L.tiles) {
        const x0 = X + t.x0 * s, y0 = Y + t.y0 * s, x1 = X + (t.c < L.cols - 1 ? (t.c + 1) * (L.tw - L.overlap) : L.W) * s, y1 = Y + (t.r < L.rows - 1 ? (t.r + 1) * (L.th - L.overlap) : L.H) * s;
        if (!t.blank) pill(ctx, (x0 + x1) / 2, (y0 + y1) / 2, t.label, Math.max(10, Math.min(15, (x1 - x0) / 5)), "#141414");
        hits.push({ t, x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      }
      geo = { view, s, W0, H0: h + 2 * pad, area: { x: X, y: Y, w, h }, bx: X, by: Y };
    }
    if (!live) cv.setAttribute("aria-label", `${view === "paper" ? "종이로 보기" : "붙였을 때"} 미리보기: ${$(".sp-line").textContent}, 완성 ${$(".sp-cm").textContent}. 화살표 키로 그림을 1mm(Shift는 10mm)씩 옮기고 + − 키로 크기를 1%씩 바꿔요. C 키는 크기를 그대로 두고 가운데로 맞춰요. Enter를 누르면 한 장씩 보기로 열려요.`);
  }
  // 판 좌표(mm) ↔ 미리보기 화소. 「종이로 보기」는 장 사이 틈·여백이 있어 장마다 따로 계산(side 1 = 끝 모서리는 앞 장에 붙임)
  function axPx(v, side, n, t, o, base, step) {
    if (geo.view !== "paper") return base + v * geo.s;
    const p = t - o; let c = side ? Math.ceil(v / p - 1e-9) - 1 : Math.floor(v / p + 1e-9);
    c = Math.max(0, Math.min(n - 1, c));
    return base + c * step + (L.margin + v - c * p) * geo.s;
  }
  function axMm(px, n, t, o, base, step) {
    if (geo.view !== "paper") return (px - base) / geo.s;
    const c = Math.max(0, Math.min(n - 1, Math.floor((px - base) / step)));
    return c * (t - o) + (px - base - c * step) / geo.s - L.margin;
  }
  const pxX = (v, side) => axPx(v, side, L.cols, L.tw, L.overlap, geo.bx, geo.sx);
  const pxY = (v, side) => axPx(v, side, L.rows, L.th, L.overlap, geo.by, geo.sy);
  function toMm(clientX, clientY) { const r = cv.getBoundingClientRect(); return { x: axMm(clientX - r.left, L.cols, L.tw, L.overlap, geo.bx, geo.sx), y: axMm(clientY - r.top, L.rows, L.th, L.overlap, geo.by, geo.sy) }; }

  // ---------- 한 장씩 보기 ----------
  function drawOne() {
    const t = L.tiles[cur];
    const W0 = Math.max(200, Math.floor(innerW(one.querySelector(".sp-one-body"))) - (innerWidth < 600 ? 0 : 150));
    const maxH = availH();
    const s = Math.min((W0 - 16) / L.pw, (maxH - 16) / L.ph);
    const ctx = sizeCanvas($(".sp-sheet"), L.pw * s + 16, L.ph * s + 16);
    drawSheet(ctx, t, 8, 8, s, { marks: true, badge: false });
    $(".sp-sheet").setAttribute("aria-label", `${t.label} 장 (${t.r + 1}행 ${t.c + 1}열)${t.blank ? ", 빈 장" : ""}. 실제로 찍히는 모양`);
    $(".sp-one-name").textContent = `${t.label} · ${t.r + 1}행 ${t.c + 1}열 · ${t.blank ? (skipBlank ? "빈 장(뺌)" : "빈 장") : `${order(t)} / ${usedTiles().length}쪽`}`;
    // 작은 지도: 전체에서 이 장이 어디인지
    const mw = 130, ms = Math.min(mw / L.W, 110 / L.H), mctx = sizeCanvas($(".sp-map"), L.W * ms + 8, L.H * ms + 8);
    mctx.fillStyle = "#fff"; mctx.fillRect(4, 4, L.W * ms, L.H * ms);
    mctx.save(); mctx.beginPath(); mctx.rect(4, 4, L.W * ms, L.H * ms); mctx.clip(); mctx.globalAlpha = 0.55; mctx.drawImage(src.bmp, 4 + L.img.x * ms, 4 + L.img.y * ms, L.img.w * ms, L.img.h * ms); mctx.restore();
    mctx.strokeStyle = "#141414"; mctx.lineWidth = 1; mctx.strokeRect(4.5, 4.5, L.W * ms - 1, L.H * ms - 1);
    mctx.fillStyle = "rgba(229,55,43,.35)"; mctx.fillRect(4 + t.x0 * ms, 4 + t.y0 * ms, L.tw * ms, L.th * ms);
    mctx.strokeStyle = "#e5372b"; mctx.lineWidth = 2; mctx.strokeRect(4 + t.x0 * ms, 4 + t.y0 * ms, L.tw * ms, L.th * ms);
    $(".sp-map").setAttribute("aria-label", `전체 ${L.cols}열 × ${L.rows}행 중 ${t.r + 1}행 ${t.c + 1}열`);
    $("[data-prev]").disabled = cur === 0; $("[data-next]").disabled = cur === L.tiles.length - 1;
    $("[data-tile]").disabled = t.blank;
    drawThumbs();
  }
  let thumbKey = "";
  function drawThumbs() {
    const ol = $(".sp-thumbs");
    const key = `${L.tiles.length}|${L.cols}`;
    if (thumbKey !== key) {
      ol.innerHTML = L.tiles.map((t, i) => `<li><button type="button" data-i="${i}" aria-label="${t.label} 장 보기 (${t.r + 1}행 ${t.c + 1}열)"><canvas width="1" height="1" aria-hidden="true"></canvas><span>${t.label}</span></button></li>`).join("");
      ol.style.setProperty("--cols", L.cols);
      thumbKey = key;
    }
    const tw = Math.max(34, Math.min(64, (ol.clientWidth - (L.cols - 1) * 6) / L.cols - 8));
    const s = tw / L.pw;
    ol.querySelectorAll("button").forEach((b, i) => {
      const t = L.tiles[i];
      const ctx = sizeCanvas(b.querySelector("canvas"), L.pw * s + 4, L.ph * s + 4);
      drawSheet(ctx, t, 1, 1, s, { shadow: false, badge: false, hatch: false, frame: false, warn: false, pic: pick(L.img.w * s * dpr()) });
      b.setAttribute("aria-current", i === cur ? "true" : "false");
      b.classList.toggle("blank", t.blank);
    });
  }
  $(".sp-thumbs").addEventListener("click", (e) => { const b = e.target.closest("button[data-i]"); if (!b) return; cur = Number(b.dataset.i); drawOne(); names(); });
  $("[data-prev]").addEventListener("click", () => { if (cur > 0) { cur--; drawOne(); names(); } });
  $("[data-next]").addEventListener("click", () => { if (cur < L.tiles.length - 1) { cur++; drawOne(); names(); } });
  one.addEventListener("keydown", (e) => {
    if (e.target.closest("input,select")) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const d = e.key === "ArrowRight" ? 1 : -1; const n = Math.max(0, Math.min(L.tiles.length - 1, cur + d)); if (n !== cur) { cur = n; drawOne(); names(); const b = $(`.sp-thumbs button[data-i="${cur}"]`); if (e.target.closest(".sp-thumbs") && b) b.focus(); } }
  });
  function setView(v) {
    view = v;
    const r = box.querySelector(`[name="view"][value="${v}"]`); if (r) r.checked = true;
    stage.hidden = v === "one"; one.hidden = v !== "one";
    if (v === "one") { hbox.hidden = true; drawOne(); } else { drawMain(); placeBox(); }
  }
  box.querySelectorAll('[name="view"]').forEach((r) => r.addEventListener("change", () => setView(r.value)));

  // ---------- 크기 비교 그림: 사람(170cm)·A4 한 장·완성 크기 ----------
  function drawScale() {
    const c = $(".sp-scale"), W = 170, H = 128, ctx = sizeCanvas(c, W, H);
    const ink = css("--ink", "#141414"), soft = css("--ink-3", "#6b6b6b");
    const pw = L.view.w / 10, ph = L.view.h / 10, person = 170;
    const k = Math.min((H - 22) / Math.max(person, ph, 29.7), (W - 24) / (40 + pw + 21));
    const base = H - 30;
    // 사람
    const px = 8, pW = 40 * k, hh = person * k;
    ctx.fillStyle = soft;
    ctx.beginPath(); ctx.arc(px + pW / 2, base - hh + hh * 0.07, hh * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(px + pW / 2 - hh * 0.09, base - hh + hh * 0.15, hh * 0.18, hh * 0.42);
    ctx.fillRect(px + pW / 2 - hh * 0.08, base - hh * 0.44, hh * 0.07, hh * 0.44); ctx.fillRect(px + pW / 2 + hh * 0.01, base - hh * 0.44, hh * 0.07, hh * 0.44);
    // 완성 포스터(바닥에서 띄우지 않고 나란히)
    const qx = px + pW + 6;
    ctx.fillStyle = "#fff"; ctx.fillRect(qx, base - ph * k, pw * k, ph * k);
    ctx.save(); ctx.beginPath(); ctx.rect(qx, base - ph * k, pw * k, ph * k); ctx.clip();
    const vx = Math.max(0, L.img.x), vy = Math.max(0, L.img.y), sk = (pw * k) / L.view.w;
    ctx.drawImage(src.bmp, qx + (L.img.x - vx) * sk, base - ph * k + (L.img.y - vy) * sk, L.img.w * sk, L.img.h * sk); ctx.restore();
    ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.strokeRect(qx, base - ph * k, pw * k, ph * k);
    // A4 한 장
    const ax = qx + pw * k + 6;
    ctx.fillStyle = "#fff"; ctx.fillRect(ax, base - 29.7 * k, 21 * k, 29.7 * k); ctx.strokeRect(ax, base - 29.7 * k, 21 * k, 29.7 * k);
    ctx.strokeStyle = soft; ctx.beginPath(); ctx.moveTo(2, base + 0.5); ctx.lineTo(W - 2, base + 0.5); ctx.stroke();
    ctx.fillStyle = ink; ctx.font = "700 11px sans-serif"; ctx.textBaseline = "top"; ctx.textAlign = "center";
    // 이름표: 겹치면 아랫줄로
    let lastR = -1e9, row = 0;
    for (const [tx, x] of [["사람 170cm", px + pW / 2], ["완성", qx + (pw * k) / 2], ["A4", ax + (21 * k) / 2]]) {
      const w = ctx.measureText(tx).width, l = Math.max(2 + w / 2, Math.min(W - 2 - w / 2, x));
      row = l - w / 2 < lastR + 4 ? row + 1 : 0;
      ctx.fillText(tx, l, base + 3 + row * 13);
      lastR = l + w / 2;
    }
    c.setAttribute("aria-label", `크기 비교: 키 170cm 사람, 완성 ${fmt1(pw)} × ${fmt1(ph)}cm, A4 한 장 21 × 29.7cm`);
  }

  // ---------- 조립도(붙이는 순서) ----------
  function orderPaint(ctx, W, H, big) {
    const pad = big ? 60 : 8, top = big ? 150 : 8;
    const s = Math.min((W - 2 * pad) / L.W, (H - top - pad - (big ? 260 : 0)) / L.H);
    const X = (W - L.W * s) / 2, Y = top;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    if (big) {
      ctx.fillStyle = "#141414"; ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.font = `800 ${Math.round(W / 26)}px "Pretendard Variable", sans-serif`; ctx.fillText("조립 안내", pad, pad * 0.8);
      ctx.font = `600 ${Math.round(W / 50)}px "Pretendard Variable", sans-serif`;
      ctx.fillText(`${$(".sp-line").textContent} · 완성 ${$(".sp-cm").textContent}`, pad, pad * 0.8 + W / 20);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(X, Y, L.W * s, L.H * s); ctx.clip(); ctx.globalAlpha = 0.45; ctx.drawImage(src.bmp, X + L.img.x * s, Y + L.img.y * s, L.img.w * s, L.img.h * s); ctx.restore();
    ctx.strokeStyle = "#141414"; ctx.lineWidth = big ? 3 : 1.2;
    for (const t of L.tiles) {
      const x0 = X + t.x0 * s, y0 = Y + t.y0 * s, x1 = X + (t.c < L.cols - 1 ? (t.c + 1) * (L.tw - L.overlap) : L.W) * s, y1 = Y + (t.r < L.rows - 1 ? (t.r + 1) * (L.th - L.overlap) : L.H) * s;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      const n = order(t);
      pill(ctx, (x0 + x1) / 2, (y0 + y1) / 2, t.blank && skipBlank ? `${t.label} (뺌)` : `${n}. ${t.label}`, Math.max(big ? 22 : 10, Math.min(big ? 44 : 14, (x1 - x0) / 5)), "#141414");
    }
    if (big) {
      ctx.fillStyle = "#141414"; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.font = `500 ${Math.round(W / 56)}px "Pretendard Variable", sans-serif`;
      const lines = orderSteps();
      let y = Y + L.H * s + 40;
      for (const ln of lines) { ctx.fillText(ln, pad, y); y += W / 38; }
    }
  }
  function orderSteps() {
    const o = L.o;
    return [
      `1. 첫째 줄(가)부터 왼쪽에서 오른쪽으로 가1 → 가${L.cols} 순서로 놓아요. 둘째 줄은 「나」예요.`,
      L.margin >= 2.5 ? "2. 구석의 자르는 선을 따라 흰 여백을 잘라요(오른쪽·아래에 붙일 장은 왼쪽·위만 잘라도 돼요)." : "2. 여백이 없으니 자르지 않고 가장자리끼리 맞춰요.",
      L.overlap > 0 ? `3. 다음 장을 앞 장의 점선(겹침 ${L.overlap}mm)에 맞춰 올리고 풀·테이프로 붙여요.` : "3. 그림 가장자리를 맞대고 뒤에서 테이프로 붙여요.",
      "4. 한 줄씩 먼저 붙인 뒤 줄끼리 이어 붙이면 덜 틀어져요.",
      "인쇄는 꼭 「실제 크기」(배율 100%)로 해 주세요.",
    ];
  }
  function drawOrder() {
    const c = $(".sp-order-cv"), wrap = c.parentElement;
    const W = Math.min(360, Math.max(180, Math.floor(innerW(wrap)) || 300)), s = (W - 16) / L.W, H = Math.min(320, L.H * s + 16);
    const ctx = sizeCanvas(c, W, H);
    orderPaint(ctx, W, H, false);
    $(".sp-order-list").innerHTML = orderSteps().slice(0, 4).map((x) => `<li>${PT.esc(x.replace(/^\d\. /, ""))}</li>`).join("");
    c.setAttribute("aria-label", `조립도: ${L.cols}열 × ${L.rows}행, 가1부터 순서대로`);
  }

  // ---------- 손으로 맞추기 (P2-73b) ----------
  // 그림 위(점선 상자): 한 손가락·마우스로 끌어 옮김. 네 모서리 손잡이(44px): 반대편 모서리를 고정하고 비율대로 키우고 줄임.
  // 두 손가락: 늘 확대·축소(가운데 고정) + 옮김. 휠·트랙패드 핀치: 커서 자리 고정. 그림 밖(종이 여백·틀)에서 시작한 한 손가락은 화면 스크롤.
  // 조작하는 동안에는 계산(SC.layout, 가벼움) + 다음 프레임에 큰 미리보기만 그리고, 요약·크기 비교·조립도·한 장 보기는 손을 뗀 뒤 다시 그림.
  const wrap = $(".sp-cvwrap"), hbox = $(".sp-box"), zr = f("zr"), zn = f("zn"), zoomUi = $(".sp-zoom");
  const hdl = [...hbox.querySelectorAll("[data-h]")];
  const canZoom = () => L && L.o.mode !== "size";
  const round1 = (n) => Math.round(n * 10) / 10;
  let g = null, pinch = null, liveRaf = 0, commitT = 0, lastScroll = -1e9, downType = "", downOnBox = false, slSrc = false, znEdit = false;
  function setAdj(a) {
    if (!L || !src) return;
    const r = SC.layout({ ...L.o, iw: src.w, ih: src.h, adj: a });
    if (r.err) return;
    r.o = L.o; L = r; adj = { zoom: L.adj.zoom, ox: L.adj.ox, oy: L.adj.oy };
    if (!liveRaf) liveRaf = requestAnimationFrame(() => { liveRaf = 0; if (!L || view === "one") return; drawMain(true); placeBox(); readout(); });
  }
  const commit = () => { clearTimeout(commitT); commitT = 0; schedule(); };
  const commitSoon = (ms = 200) => { clearTimeout(commitT); commitT = setTimeout(commit, ms); };
  // 점선 상자·손잡이 자리: 그림 자리를 보이는 판 안으로 자르고, 손잡이(44px)는 미리보기 밖으로 나가지 않게
  function placeBox() {
    if (!L || !geo || view === "one" || stage.hidden) { hbox.hidden = true; return; }
    const I = L.img, A = geo.area;
    const x0 = Math.max(A.x, pxX(I.x, 0)), x1 = Math.min(A.x + A.w, pxX(I.x + I.w, 1)), y0 = Math.max(A.y, pxY(I.y, 0)), y1 = Math.min(A.y + A.h, pxY(I.y + I.h, 1));
    if (!(x1 - x0 >= 1 && y1 - y0 >= 1)) { hbox.hidden = true; return; }
    hbox.hidden = false;
    hbox.style.transform = `translate(${x0}px,${y0}px)`; hbox.style.width = `${x1 - x0}px`; hbox.style.height = `${y1 - y0}px`;
    const H = 22, cx = (x) => Math.max(H, Math.min(geo.W0 - H, x)), cy = (y) => Math.max(H, Math.min(geo.H0 - H, y));
    for (const e of hdl) { const c = e.dataset.h; e.style.transform = `translate(${cx(c[1] === "e" ? x1 : x0) - x0 - H}px,${cy(c[0] === "s" ? y1 : y0) - y0 - H}px)`; }
    hbox.classList.toggle("no-h", !canZoom());
  }
  // 「배율 132.5% · 완성 52.3 × 74.0cm · 가운데에서 오른쪽 12.0 · 아래 3.0mm」
  const toSl = (pct) => Math.round((1000 * Math.log(pct / 20)) / Math.log(40));
  const fromSl = (v) => 20 * Math.pow(40, v / 1000); // 슬라이더는 로그 눈금(20~800%, 한 칸 약 0.37%): 자주 쓰는 50~200%를 넓게
  function readout() {
    if (!L) return;
    const z = round1(L.adj.zoom * 100), a = L.adj, pos = [];
    if (Math.abs(a.ox) >= 0.05) pos.push(`${a.ox > 0 ? "오른쪽" : "왼쪽"} ${fmt1(Math.abs(a.ox))}`);
    if (Math.abs(a.oy) >= 0.05) pos.push(`${a.oy > 0 ? "아래" : "위"} ${fmt1(Math.abs(a.oy))}`);
    const cm = `${fmt1(L.view.w / 10)} × ${fmt1(L.view.h / 10)}cm`;
    // 두 줄로 나눠 글자 수가 바뀌어도 높이가 그대로(조작 중에 미리보기가 위아래로 밀리지 않게)
    const rl = $(".sp-read").children;
    rl[0].textContent = `${canZoom() ? `배율 ${z.toFixed(1)}% · ` : ""}완성 ${cm}`;
    rl[1].textContent = pos.length ? `가운데에서 ${pos.join(" · ")}mm` : "가운데";
    $(".sp-cm").textContent = cm.replace("cm", " cm");
    if (!slSrc) zr.value = String(toSl(z));
    slSrc = false;
    zr.setAttribute("aria-valuetext", `${z.toFixed(1)}%`);
    if (!znEdit) zn.value = z.toFixed(1); // 숫자 칸은 사람이 고치는 중일 때만 그대로 둠
  }
  function hints() {
    zoomUi.hidden = !canZoom();
    $(".sp-move-hint").textContent = !canZoom() ? "완성 크기로 나눌 때는 크기가 정해져 있어 모서리 손잡이를 숨겼어요. 그림을 끌어 위치만 옮길 수 있어요."
      : coarse ? "그림을 끌어 옮기고, 모서리 □를 끌거나 두 손가락으로 벌려 크기를 바꿔요. 그림 밖을 끌면 화면이 움직여요."
      : "그림을 끌어 옮기고, 모서리 □를 끌거나 휠로 크기를 바꿔요(커서 자리 기준). 화살표 1mm · Shift+화살표 10mm · C 중앙 맞추기.";
  }
  // 보이는 부분의 가운데를 고정하고 배율(%)을 정함(슬라이더·숫자 칸·−+)
  function setPct(pct) {
    if (!canZoom()) return;
    const p = Math.max(SC.ZMIN * 100, Math.min(SC.ZMAX * 100, round1(pct))), I = L.img;
    const vx = (Math.max(0, I.x) + Math.min(L.W, I.x + I.w)) / 2, vy = (Math.max(0, I.y) + Math.min(L.H, I.y + I.h)) / 2;
    setAdj(SC.zoomAt(L, p / 100 / L.adj.zoom, vx, vy));
  }
  function openAt(clientX, clientY) {
    if (!hits.length) return;
    const r = cv.getBoundingClientRect(), x = clientX - r.left, y = clientY - r.top;
    const h = hits.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
    if (h) { cur = L.tiles.indexOf(h.t); setView("one"); names(); }
  }
  // 한 손가락·마우스·펜
  wrap.addEventListener("pointerdown", (e) => {
    downType = e.pointerType; downOnBox = !!e.target.closest(".sp-box");
    if (!L || !geo || view === "one" || g || pinch || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (e.pointerType === "touch" && !downOnBox) return; // 그림 밖: 화면 스크롤(누르면 그 장 크게 보기는 click에서)
    const h = e.target.closest("[data-h]");
    e.preventDefault();
    if (e.pointerType !== "touch") cv.focus({ preventScroll: true });
    try { e.target.setPointerCapture(e.pointerId); } catch (er) {}
    g = { id: e.pointerId, kind: h && canZoom() ? "resize" : "move", corner: h && h.dataset.h, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, L0: L, a0: { ...adj } };
    if (g.kind === "resize") { const I = L.img, c = g.corner, p = toMm(e.clientX, e.clientY); g.off = { x: (c[1] === "e" ? I.x + I.w : I.x) - p.x, y: (c[0] === "s" ? I.y + I.h : I.y) - p.y }; }
    hbox.classList.add("is-on");
  });
  wrap.addEventListener("pointermove", (e) => {
    if (!g || e.pointerId !== g.id || pinch) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.moved && Math.hypot(dx, dy) > 3) g.moved = true;
    if (g.kind === "resize") { const p = toMm(e.clientX, e.clientY); setAdj(SC.resizeCorner(g.L0, g.corner, p.x + g.off.x, p.y + g.off.y)); }
    else setAdj({ zoom: g.a0.zoom, ox: g.a0.ox + dx / geo.s, oy: g.a0.oy + dy / geo.s }); // 한 장 안에서는 손가락 밑의 그림이 그대로 따라옴
  });
  const pend = (e) => {
    if (!g || e.pointerId !== g.id) return;
    const G = g; g = null; hbox.classList.remove("is-on");
    if (!G.moved && G.kind === "move" && e.type === "pointerup" && performance.now() - G.t0 < 500) { adj = G.a0; update(); openAt(e.clientX, e.clientY); return; } // 누르기 = 그 장 크게
    commit();
  };
  wrap.addEventListener("pointerup", pend); wrap.addEventListener("pointercancel", pend); wrap.addEventListener("lostpointercapture", pend);
  cv.addEventListener("click", (e) => { if (downType === "touch" && !downOnBox && L) openAt(e.clientX, e.clientY); });
  // 두 손가락(토글 없이 늘): 어디에서 시작해도 화면 확대·스크롤 대신 그림을 키우고 옮김. 한 손가락이 이미 화면을 스크롤하는 중이면(취소 불가) 건드리지 않음
  const touchIn = (e) => [...e.touches].filter((t) => wrap.contains(t.target));
  const byId = (list, id) => [...list].find((t) => t.identifier === id);
  wrap.addEventListener("touchstart", (e) => {
    if (!L || !geo || view === "one" || pinch) return;
    const ts = touchIn(e);
    if (ts.length < 2 || !e.cancelable) return;
    e.preventDefault();
    g = null;
    const [a, b] = ts;
    pinch = { ia: a.identifier, ib: b.identifier, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2 };
    hbox.classList.add("is-on");
  }, { passive: false });
  wrap.addEventListener("touchmove", (e) => {
    if (!pinch) return;
    if (e.cancelable) e.preventDefault();
    const a = byId(e.touches, pinch.ia), b = byId(e.touches, pinch.ib);
    if (!a || !b) return;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2;
    let A = adj;
    if (canZoom() && pinch.d > 0 && d > 0) { const p = toMm(pinch.mx, pinch.my); A = SC.zoomAt(L, d / pinch.d, p.x, p.y); }
    A = { zoom: A.zoom, ox: A.ox + (mx - pinch.mx) / geo.s, oy: A.oy + (my - pinch.my) / geo.s };
    pinch.d = d; pinch.mx = mx; pinch.my = my;
    setAdj(A);
  }, { passive: false });
  const tend = (e) => {
    if (!pinch || (byId(e.touches, pinch.ia) && byId(e.touches, pinch.ib))) return;
    pinch = null; hbox.classList.remove("is-on"); commit();
  };
  wrap.addEventListener("touchend", tend); wrap.addEventListener("touchcancel", tend);
  wrap.addEventListener("gesturestart", (e) => { if (L && view !== "one") e.preventDefault(); }); // 아이폰 사파리: 미리보기 위 두 손가락이 화면 확대로 새지 않게
  // 휠·트랙패드: 미리보기 위에 커서가 있을 때만 커서 자리를 고정하고 확대·축소(Ctrl+휠 = 트랙패드 핀치는 더 섬세하게)
  // 화면을 휠로 내리다가 미리보기가 커서 밑으로 들어온 경우(0.35초 안)에는 계속 화면을 내림
  addEventListener("scroll", () => { lastScroll = performance.now(); }, { passive: true });
  wrap.addEventListener("wheel", (e) => {
    if (!L || !geo || view === "one" || !canZoom()) return;
    if (!e.ctrlKey && performance.now() - lastScroll < 350) return;
    e.preventDefault();
    const dy = Math.max(-300, Math.min(300, e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1)));
    const p = toMm(e.clientX, e.clientY);
    setAdj(SC.zoomAt(L, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.001)), p.x, p.y));
    commitSoon();
  }, { passive: false });
  // 키보드: 화살표 1mm, Shift+화살표 10mm, + − 1%, 0 처음 위치, Enter 한 장씩
  cv.addEventListener("keydown", (e) => {
    if (!L) return;
    const st = e.shiftKey ? 10 : 1;
    const k = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
    if (k) { e.preventDefault(); setAdj({ zoom: adj.zoom, ox: adj.ox + k[0], oy: adj.oy + k[1] }); commitSoon(300); return; }
    if (e.key === "+" || e.key === "=") { e.preventDefault(); if (canZoom()) { setPct(L.adj.zoom * 100 + 1); commitSoon(300); } }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); if (canZoom()) { setPct(L.adj.zoom * 100 - 1); commitSoon(300); } }
    else if (e.key === "0") { e.preventDefault(); adj = { zoom: 1, ox: 0, oy: 0 }; update(); }
    else if ((e.key === "c" || e.key === "C" || e.code === "KeyC") && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); centerTo(); } // C 중앙 맞추기(한글 입력 상태 「ㅊ」도 KeyC)
    else if (e.key === "Enter") { e.preventDefault(); setView("one"); }
  });
  // − + : 1%씩, 길게 누르면 계속(1.5초가 지나면 3%씩)
  function hold(btn, d) {
    let t1 = 0, t2 = 0, n = 0;
    const step = () => setPct(round1(L.adj.zoom * 100) + d * (n > 22 ? 3 : 1));
    const stop = () => { clearTimeout(t1); clearInterval(t2); if (n) { n = 0; commit(); } };
    btn.addEventListener("pointerdown", (e) => {
      if (!L || btn.disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
      e.preventDefault(); stop(); n = 1; step();
      try { btn.setPointerCapture(e.pointerId); } catch (er) {}
      t1 = setTimeout(() => { t2 = setInterval(() => { n++; step(); }, 60); }, 420);
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((t) => btn.addEventListener(t, stop));
    btn.addEventListener("click", (e) => { if (e.detail === 0 && L) { setPct(round1(L.adj.zoom * 100) + d); commit(); } }); // 키보드 Enter·Space
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  hold($("[data-zout]"), -1); hold($("[data-zin]"), 1);
  zr.addEventListener("input", () => { slSrc = true; setPct(fromSl(Number(zr.value))); });
  zr.addEventListener("change", commit);
  function applyZn() {
    if (!znEdit) return;
    znEdit = false;
    const v = num(zn.value), okv = isFinite(v) && v > 0;
    if (okv) setPct(v);
    zn.value = round1(Math.max(20, Math.min(800, okv ? v : L.adj.zoom * 100))).toFixed(1);
    commit();
  }
  zn.addEventListener("input", () => { znEdit = true; });
  zn.addEventListener("change", applyZn);
  zn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); applyZn(); return; }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") { // 숫자 칸: 화살표 0.1%, Shift 1%
      e.preventDefault();
      const v = (isFinite(num(zn.value)) ? num(zn.value) : L.adj.zoom * 100) + (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 1 : 0.1);
      znEdit = false; setPct(v); zn.value = round1(Math.max(20, Math.min(800, v))).toFixed(1); commitSoon(300);
    }
  });
  $("[data-center]").addEventListener("click", () => { adj = { zoom: 1, ox: 0, oy: 0 }; update(); });
  // 중앙 맞추기(P2-73c): 배율은 그대로 두고 그림을 완성 영역 가운데로. 가로만·세로만은 작은 아이콘 단추
  function centerTo(axis) { if (!L || !src) return; adj = SC.centerAdj(adj, axis); update(); }
  box.querySelectorAll("[data-mid]").forEach((b) => b.addEventListener("click", () => centerTo(b.dataset.mid || undefined)));

  // ---------- 설정이 바뀌면 바로 다시 그리기 ----------
  box.querySelector(".sp-opts").addEventListener("input", (e) => {
    if (e.target.name === "wcm") sizeBy = "w";
    if (e.target.name === "hcm") sizeBy = "h";
    schedule();
  });
  box.querySelector(".sp-opts").addEventListener("change", schedule);
  f("guide").addEventListener("change", schedule);
  f("edge").addEventListener("change", schedule);
  new MutationObserver(() => { if (src && L) { drawScale(); drawMain(); placeBox(); if (view === "one") drawOne(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); // 다크·라이트 바꾸면 그림 색 다시
  let rz = 0;
  addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { thumbKey = ""; if (src && L) { drawMain(); placeBox(); if (view === "one") drawOne(); drawOrder(); } }, 120); });

  // ---------- 파일 이름 (P2-72 칸) ----------
  const fmtT = () => (val("tfmt") === "jpg" ? "jpg" : "png");
  const pad2 = (n, max) => String(n).padStart(max >= 10 ? 2 : 1, "0");
  const tileName = (t) => `${src.base}-r${pad2(t.r + 1, L.rows)}c${pad2(t.c + 1, L.cols)}`;
  function names() {
    if (!src || !L) return;
    NALGI.setNameDefault($("#sp-fname"), `${src.base}-분할-${PAPER_SHORT[L.o.paper]}-${L.cols}x${L.rows}`, "pdf");
    NALGI.setNameDefault($("#sp-zname"), `${src.base}-분할-${L.cols}x${L.rows}`, "zip");
    const ti = $("#sp-tname");
    NALGI.setNameExt(ti, fmtT());
    const t = L.tiles[cur];
    if (t) { const k = tileName(t); if (ti.dataset.for !== k) { delete ti.dataset.touched; ti.dataset.for = k; } NALGI.setNameDefault(ti, k, fmtT()); }
  }
  box.querySelectorAll('[name="tfmt"]').forEach((r) => r.addEventListener("change", names));

  // ---------- PDF 만들기 ----------
  const labelPng = async (text) => {
    const c = document.createElement("canvas"), g = c.getContext("2d"), fs = 44;
    g.font = `700 ${fs}px "Pretendard Variable", sans-serif`;
    const w = Math.ceil(g.measureText(text).width) + 16;
    c.width = w; c.height = Math.round(fs * 1.4);
    g.fillStyle = "rgba(255,255,255,0.9)"; g.fillRect(0, 0, c.width, c.height);
    g.font = `700 ${fs}px "Pretendard Variable", sans-serif`; g.fillStyle = "#555"; g.textBaseline = "middle"; g.textAlign = "right"; g.fillText(text, w - 8, c.height / 2 + 1);
    const b = await new Promise((r) => c.toBlob(r, "image/png"));
    return { bytes: new Uint8Array(await b.arrayBuffer()), ratio: c.width / c.height };
  };
  async function embedSource(doc) {
    // JPG·PNG는 원본 바이트 그대로(화질 그대로). 그 밖(WEBP·HEIC)이나 읽지 못하는 PNG는 브라우저로 JPG·PNG를 다시 만들어 넣음(한 번만 만들어 둠)
    const reencode = async (type) => {
      if (src.emb && src.emb.type === type) return src.emb;
      const r = await PT.canvasBlob(src.w, src.h, (ctx, w, h) => { if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); } ctx.drawImage(src.img, 0, 0, w, h); }, type, 0.93);
      if (!r) throw new Error("그림을 PDF에 넣을 형식으로 바꾸지 못했어요. 기기 메모리가 부족할 수 있어요. 더 작은 그림으로 해 보세요.");
      return (src.emb = { type, bytes: new Uint8Array(await r.blob.arrayBuffer()), shrunk: r.shrunk });
    };
    let orient = 1, note = "";
    try {
      if (src.kind === "jpg") {
        const im = await doc.embedJpg(src.bytes);
        orient = src.orient;
        // 브라우저가 EXIF 방향을 반영했는지(보이는 가로·세로가 저장 화소와 뒤바뀌었는지) 확인해 미리보기와 같게
        if (orient >= 5 && !(im.width === src.h && im.height === src.w)) orient = 1;
        if (orient > 1 && orient < 5 && !(im.width === src.w && im.height === src.h)) orient = 1;
        return { im, orient, note };
      }
      if (src.kind === "png") return { im: await doc.embedPng(src.bytes), orient, note };
    } catch (e) { /* 아래에서 다시 만들어 넣기 */ }
    const r = await reencode(src.kind === "png" ? "image/png" : "image/jpeg");
    if (r.shrunk) note = "기기(브라우저) 한계 때문에 그림 해상도를 조금 줄여 넣었어요. 쪽 크기와 배치는 그대로예요.";
    return { im: r.type === "image/png" ? await doc.embedPng(r.bytes) : await doc.embedJpg(r.bytes), orient: 1, note };
  }
  const pdfKey = () => JSON.stringify([L.o, adj, skipBlank, src.file.name, src.file.size, src.file.lastModified]);
  async function buildPdf() {
    const key = pdfKey();
    if (pdfCache.key === key && pdfCache.blob) return pdfCache;
    const P = await PT.needPdf();
    PT.step(box, "그림을 PDF에 넣는 중…", 0.05); await PT.tick();
    const doc = await P.PDFDocument.create();
    const { im, orient, note } = await embedSource(doc);
    const tiles = usedTiles(), K = SC.PT;
    if (L.o.guide) { // 조립 안내 쪽(그림 한 장으로)
      const c = document.createElement("canvas"); c.width = 1600; c.height = Math.round((1600 * L.ph) / L.pw);
      orderPaint(c.getContext("2d"), c.width, c.height, true);
      const b = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9)); c.width = c.height = 0;
      const gi = await doc.embedJpg(new Uint8Array(await b.arrayBuffer()));
      const pg = doc.addPage([L.pw * K, L.ph * K]); pg.drawImage(gi, { x: 0, y: 0, width: L.pw * K, height: L.ph * K });
    }
    const grey = P.rgb(0.47, 0.47, 0.47);
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      PT.step(box, `${i + 1} / ${tiles.length}쪽 만드는 중…`, 0.1 + (0.8 * i) / tiles.length);
      if (i % 4 === 0) await PT.tick();
      const R = SC.pageRects(L, t);
      const page = doc.addPage([R.pageW, R.pageH]);
      if (!t.blank) {
        const name = page.node.newXObject("Image", im.ref);
        page.pushOperators(P.pushGraphicsState(), P.rectangle(R.clip.x, R.clip.y, R.clip.w, R.clip.h), P.clip(), P.endPath(), P.concatTransformationMatrix(...SC.orientMatrix(orient, R.img)), P.drawObject(name), P.popGraphicsState());
      }
      const Y = (mm) => R.pageH - mm * K;
      if (L.o.marks) {
        for (const g of cropMarks(t)) page.drawLine({ start: { x: g[0] * K, y: Y(g[1]) }, end: { x: g[2] * K, y: Y(g[3]) }, thickness: 0.4, color: grey });
        for (const g of seamLines(t)) page.drawLine({ start: { x: g[0] * K, y: Y(g[1]) }, end: { x: g[2] * K, y: Y(g[3]) }, thickness: 0.5, color: grey, dashArray: [3, 2] });
      }
      if (L.o.labels && !t.blank) {
        const lp = await labelPng(labelText(t)), sp = labelSpot(t);
        const h = sp.h, w = Math.min(sp.w + 20, h * lp.ratio);
        const li = await doc.embedPng(lp.bytes);
        page.drawImage(li, { x: (sp.x + sp.w - w) * K, y: Y(sp.y + h), width: w * K, height: h * K });
      }
    }
    doc.setTitle(`${src.base} 분할 인쇄 (${PAPER_SHORT[L.o.paper]} ${L.cols}x${L.rows})`); doc.setProducer("펭귄 툴즈"); doc.setCreator("펭귄 툴즈 이미지 분할 인쇄");
    try { doc.catalog.getOrCreateViewerPreferences().setPrintScaling(P.PrintScaling.None); } catch (e) {} // 인쇄 배율 조정 안 함(실제 크기)
    PT.step(box, "PDF 파일로 저장하는 중…", 0.95); await PT.tick();
    const blob = new Blob([await doc.save()], { type: "application/pdf" });
    return (pdfCache = { key, blob, pages: doc.getPageCount(), note });
  }
  const busy = (on, text) => { PT.busy(box, on, text); box.querySelectorAll(".sp button").forEach((b) => { if (on) { b.dataset.wasDis = b.disabled ? "1" : ""; b.disabled = true; } else if (b.dataset.wasDis != null) { b.disabled = b.dataset.wasDis === "1"; delete b.dataset.wasDis; } }); };
  const done = (t) => PT.msg(box, t, "note");

  $("[data-save]").addEventListener("click", async () => {
    if (!L || box.classList.contains("is-busy")) return;
    const name = NALGI.nameFrom($("#sp-fname"), "pdf");
    PT.msg(box, "");
    let info = null;
    try {
      const r = await PT.save(async () => { busy(true, "PDF를 만드는 중…"); await PT.tick(); info = await buildPdf(); return info.blob; }, name);
      if (r !== "cancel" && info) done(`「${name}」 ${info.pages}쪽 PDF(${PT.size(info.blob.size)})로 저장했어요. 인쇄 창에서 배율을 「실제 크기」(100%)로 두세요.${info.note ? " " + info.note : ""}`);
    } catch (e) { PT.msg(box, e.message || String(e)); }
    finally { busy(false); }
  });

  // 바로 인쇄: PC는 숨은 틀에 PDF를 열어 인쇄 창을 띄우고, 휴대폰은 새 탭에 PDF를 엶(휴대폰 브라우저는 틀 안 PDF 인쇄를 못 함)
  let frame = null, frameUrl = "";
  $("[data-print]").addEventListener("click", async () => {
    if (!L || box.classList.contains("is-busy")) return;
    PT.msg(box, "");
    const mobile = coarse || PT.IOS;
    const win = mobile ? window.open("", "_blank") : null; // 클릭 직후에 열어야 막히지 않음
    try {
      busy(true, "인쇄할 PDF를 만드는 중…"); await PT.tick();
      const info = await buildPdf();
      if (frameUrl) URL.revokeObjectURL(frameUrl);
      frameUrl = URL.createObjectURL(info.blob);
      if (mobile) {
        if (win) { win.location.href = frameUrl; done("새 탭에 PDF를 열었어요. 공유 또는 인쇄 메뉴에서 프린터를 고르고, 배율은 「실제 크기」(100%)로 두세요."); }
        else PT.msg(box, "새 탭이 막혔어요. 「PDF 내려받기」로 받은 뒤 파일 앱에서 인쇄해 주세요.");
        return;
      }
      if (frame) frame.remove();
      frame = document.createElement("iframe");
      frame.className = "sp-frame"; frame.title = "인쇄할 PDF"; frame.setAttribute("aria-hidden", "true"); frame.tabIndex = -1;
      const opened = await new Promise((resolve) => {
        const to = setTimeout(() => resolve(false), 8000);
        frame.onload = () => { clearTimeout(to); setTimeout(() => { try { frame.contentWindow.focus(); frame.contentWindow.print(); resolve(true); } catch (e) { resolve(false); } }, 400); };
        frame.src = frameUrl;
        document.body.appendChild(frame);
      });
      if (opened) done(`인쇄 창을 열었어요(${info.pages}쪽). 「배율」을 「실제 크기」(100%)로, 용지를 ${PAPER_SHORT[L.o.paper]}로 고르세요.`);
      else {
        const m = $(".tk-msg");
        m.className = "tk-msg note"; m.hidden = false;
        m.innerHTML = `인쇄 창을 바로 열지 못했어요. <a href="${frameUrl}" target="_blank" rel="noopener">PDF 열기(새 탭)</a>에서 Ctrl+P로 인쇄해 주세요.`;
      }
    } catch (e) { if (win) win.close(); PT.msg(box, e.message || String(e)); }
    finally { busy(false); }
  });

  // ---------- 조각 이미지: 원본 화소를 그대로 잘라 담기 ----------
  // 화소/mm = 원본 가로 화소 ÷ 그림 가로 mm. 경계는 같은 식으로 반올림하므로 이웃한 조각끼리 빈틈·겹침 없이 맞음(겹침 0일 때)
  function tileCrop(t) {
    const P = src.w / L.img.w;
    const px = (mm, n) => Math.max(0, Math.min(n, Math.round(mm * P)));
    const sx0 = px(Math.max(t.x0, L.img.x) - L.img.x, src.w), sx1 = px(Math.min(t.x0 + L.tw, L.img.x + L.img.w) - L.img.x, src.w);
    const sy0 = px(Math.max(t.y0, L.img.y) - L.img.y, src.h), sy1 = px(Math.min(t.y0 + L.th, L.img.y + L.img.h) - L.img.y, src.h);
    return { P, sx0, sy0, w: sx1 - sx0, h: sy1 - sy0 };
  }
  async function tileBlob(t, kind, fmtx) {
    const type = fmtx === "jpg" ? "image/jpeg" : "image/png";
    const cr = tileCrop(t);
    if (cr.w < 1 || cr.h < 1) return null;
    let W, H, draw;
    if (kind === "piece") {
      W = cr.w; H = cr.h;
      draw = (ctx, w, h) => { if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); } ctx.imageSmoothingEnabled = w !== W; ctx.drawImage(src.img, cr.sx0, cr.sy0, cr.w, cr.h, 0, 0, w, h); };
    } else {
      // 인쇄용: 종이 크기 그대로(원본 화소 1:1), 여백·표시 포함
      const P = cr.P, m = L.margin;
      W = Math.round(L.pw * P); H = Math.round(L.ph * P);
      const cx0 = Math.round(m * P), cy0 = Math.round(m * P), cx1 = Math.round((m + L.tw) * P), cy1 = Math.round((m + L.th) * P);
      const dx = Math.round((m + L.img.x - t.x0) * P), dy = Math.round((m + L.img.y - t.y0) * P); // 그림 왼쪽 위가 놓일 종이 화소
      draw = (ctx, w, h) => {
        const k = w / W; ctx.setTransform(k, 0, 0, h / H, 0, 0); ctx.imageSmoothingEnabled = k !== 1;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
        const x0 = Math.max(cx0, dx), y0 = Math.max(cy0, dy), x1 = Math.min(cx1, dx + src.w), y1 = Math.min(cy1, dy + src.h);
        if (x1 > x0 && y1 > y0) ctx.drawImage(src.img, x0 - dx, y0 - dy, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
        const s = P; ctx.strokeStyle = "#777"; ctx.lineWidth = Math.max(1, 0.15 * s);
        if (L.o.marks) {
          for (const g of cropMarks(t)) { ctx.beginPath(); ctx.moveTo(g[0] * s, g[1] * s); ctx.lineTo(g[2] * s, g[3] * s); ctx.stroke(); }
          ctx.setLineDash([1.1 * s, 0.7 * s]);
          for (const g of seamLines(t)) { ctx.beginPath(); ctx.moveTo(g[0] * s, g[1] * s); ctx.lineTo(g[2] * s, g[3] * s); ctx.stroke(); }
          ctx.setLineDash([]);
        }
        if (L.o.labels) { const p = labelSpot(t); ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.fillRect(p.x * s, p.y * s, p.w * s, p.h * s); ctx.fillStyle = "#555"; ctx.font = `700 ${Math.max(6, p.h * s * 0.72)}px sans-serif`; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(labelText(t), (p.x + p.w - 0.6) * s, (p.y + p.h / 2) * s); }
      };
    }
    const r = await PT.canvasBlob(W, H, draw, type, 0.92);
    if (!r) throw new Error("조각 이미지를 만들지 못했어요. 기기 메모리가 부족할 수 있어요.");
    const dpi = kind === "print" ? (cr.P * 25.4 * r.w) / W : 0;
    const bytes = await withDpi(new Uint8Array(await r.blob.arrayBuffer()), type, dpi);
    return { bytes, type, w: r.w, h: r.h, shrunk: r.shrunk, dpi };
  }
  // 해상도(DPI) 기록: PNG는 pHYs 덩어리, JPG는 JFIF 밀도. 인쇄용 조각만(조각만은 기록하지 않음)
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  async function withDpi(u8, type, dpi) {
    if (!dpi) return u8;
    try {
      if (type === "image/png") {
        const ppm = Math.round(dpi / 0.0254);
        const chunk = new Uint8Array(21), dv = new DataView(chunk.buffer);
        dv.setUint32(0, 9); chunk.set([0x70, 0x48, 0x59, 0x73], 4); dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;
        dv.setUint32(17, crc32(chunk.subarray(4, 17)));
        const at = 8 + 25; // 서명 8 + IHDR(4+4+13+4)
        const out = new Uint8Array(u8.length + 21); out.set(u8.subarray(0, at)); out.set(chunk, at); out.set(u8.subarray(at), at + 21);
        return out;
      }
      if (u8[2] === 0xff && u8[3] === 0xe0 && u8[6] === 0x4a && u8[7] === 0x46 && u8[8] === 0x49 && u8[9] === 0x46) {
        const d = Math.min(65535, Math.round(dpi)); u8[13] = 1; u8[14] = d >> 8; u8[15] = d & 255; u8[16] = d >> 8; u8[17] = d & 255;
      }
    } catch (e) {}
    return u8;
  }
  const tKind = () => (val("tkind") === "print" ? "print" : "piece");
  $("[data-zip]").addEventListener("click", async () => {
    if (!L || box.classList.contains("is-busy")) return;
    const name = NALGI.nameFrom($("#sp-zname"), "zip"), kind = tKind(), fx = fmtT();
    PT.msg(box, "");
    let n = 0, shr = 0, total = 0;
    try {
      const r = await PT.save(async () => {
        busy(true, "조각 이미지를 만드는 중…"); await PT.tick();
        const fl = await PT.need("fflate.min.js", "fflate").catch(() => { throw new Error("압축 엔진을 받지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요."); });
        const tiles = L.tiles.filter((t) => !t.blank), files = {};
        for (let i = 0; i < tiles.length; i++) {
          PT.step(box, `${i + 1} / ${tiles.length}장 만드는 중…`, i / tiles.length); await PT.tick();
          const b = await tileBlob(tiles[i], kind, fx); // 한 장씩 만들고 캔버스는 바로 비움(메모리 아끼기)
          if (!b) continue;
          files[`${tileName(tiles[i])}.${fx}`] = [b.bytes, { level: 0 }];
          n++; total += b.bytes.length; if (b.shrunk) shr++;
        }
        PT.step(box, "zip으로 묶는 중…", 1); await PT.tick();
        return new Blob([fl.zipSync(files)], { type: "application/zip" });
      }, name);
      if (r !== "cancel") done(`「${name}」에 조각 ${n}장(${fx.toUpperCase()}, ${kind === "print" ? "인쇄용" : "조각만"}, ${PT.size(total)})을 담았어요.${shr ? ` ${shr}장은 휴대폰 브라우저 한계(약 1,677만 화소) 때문에 줄여서 담았어요.` : ""}`);
    } catch (e) { PT.msg(box, e.message || String(e)); }
    finally { busy(false); }
  });
  $("[data-tile]").addEventListener("click", async () => {
    if (!L || box.classList.contains("is-busy")) return;
    const t = L.tiles[cur]; if (!t || t.blank) return;
    const fx = fmtT(), name = NALGI.nameFrom($("#sp-tname"), fx), kind = tKind();
    PT.msg(box, "");
    let info = null;
    try {
      const r = await PT.save(async () => { busy(true, "이 장을 만드는 중…"); await PT.tick(); info = await tileBlob(t, kind, fx); return new Blob([info.bytes], { type: info.type }); }, name);
      if (r !== "cancel" && info) done(`「${name}」 ${info.w.toLocaleString("ko-KR")} × ${info.h.toLocaleString("ko-KR")}px로 저장했어요${info.dpi ? ` (${Math.round(info.dpi)} DPI)` : ""}.${info.shrunk ? " 휴대폰 브라우저 한계 때문에 줄여서 저장했어요." : ""}`);
    } catch (e) { PT.msg(box, e.message || String(e)); }
    finally { busy(false); }
  });

  // 시험용 훅 없음. 화면 상태는 저장하지 않음(새로 고치면 처음부터)
})();
