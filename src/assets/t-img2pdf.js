// 이미지 → PDF (JPG/PNG 여러 장, 순서 바꾸기, A4/원본 크기). 의존: vendor/pdf-lib.min.js(P2-69: 파일을 넣을 때 받음), tool-kit.js
(function () {
  const box = document.querySelector('[data-tool="img2pdf"]');
  if (!box) return;
  const OPT = { exts: ["jpg", "jpeg", "png"], maxSize: 20 * PT.MB, maxCount: 50, maxTotal: 200 * PT.MB, reject: { heic: "HEIC(아이폰 사진) 파일은 아직 지원하지 않아요. 이 사이트의 「HEIC JPG 변환」으로 먼저 JPG로 바꾸거나, 사진 앱에서 JPG로 내보낸 뒤 넣어 주세요.", heif: "HEIF 파일은 아직 지원하지 않아요. JPG로 바꾼 뒤 넣어 주세요.", webp: "WEBP는 아직 지원하지 않아요. JPG나 PNG로 바꾼 뒤 넣어 주세요." } };
  const run = box.querySelector("[data-run]");
  ["pointerdown", "dragenter", "focusin"].forEach((t) => box.querySelector(".drop").addEventListener(t, () => PT.needPdf().catch(() => {}), { once: true })); // P2-69 파일을 고르는 동안 PDF 엔진을 미리 받음
  const pv = PT.preview(box);
  const list = PT.fileList(box, { thumbs: true, onChange: (items) => { run.disabled = !items.length; box.querySelector(".tk-opts").hidden = !items.length; showPreview(); } });
  PT.dropzone(box, (files) => {
    const { ok, errs } = PT.check(files, OPT, list.files());
    PT.msg(box, errs.join(" "));
    PT.hideResult(box);
    list.add(ok);
    if (ok.length) PT.needPdf().catch(() => {}); // 미리 받아 두기(실패하면 「PDF 만들기」 때 다시 시도·안내)
  }, { paste: true }); // P2-82 Ctrl+V로 붙인 그림도 같은 흐름

  // 쪽 배치(미리보기와 PDF 만들기가 같은 계산을 씀). iw·ih = 사진 화소(회전 반영), 단위 pt
  const A4 = [595.28, 841.89];
  function place(iw, ih, paper, margin) {
    if (paper === "fit") return { pw: iw, ph: ih, x: 0, y: 0, w: iw, h: ih };
    const [pw, ph] = iw > ih ? [A4[1], A4[0]] : A4;
    const s = Math.min((pw - margin * 2) / iw, (ph - margin * 2) / ih);
    const w = iw * s, h = ih * s;
    return { pw, ph, x: (pw - w) / 2, y: (ph - h) / 2, w, h };
  }
  const opt = () => ({ paper: box.querySelector('[name="paper"]:checked').value, margin: Number(box.querySelector('[name="margin"]').value) });

  // P2-82 사진 크기는 파일 앞부분(머리)만 읽어서 알아냄(사진 전체를 풀지 않음). JPG는 회전값 5~8이면 가로·세로를 바꿈
  const dimCache = new WeakMap();
  async function dims(file) {
    if (dimCache.has(file)) return dimCache.get(file);
    let d = null;
    try {
      const buf = await PT.readBuf(file.slice(0, 262144));
      const v = new DataView(buf);
      if (v.getUint32(0) === 0x89504e47) d = { w: v.getUint32(16), h: v.getUint32(20) };
      else if (v.getUint16(0) === 0xffd8) {
        let off = 2;
        while (off + 9 < v.byteLength) {
          const m = v.getUint16(off);
          if ((m & 0xff00) !== 0xff00) break;
          if (m >= 0xffc0 && m <= 0xffcf && m !== 0xffc4 && m !== 0xffc8 && m !== 0xffcc) { d = { w: v.getUint16(off + 7), h: v.getUint16(off + 5) }; break; }
          off += 2 + v.getUint16(off + 2);
        }
        if (d && orientation(buf) >= 5) d = { w: d.h, h: d.w };
      }
    } catch (e) { d = null; }
    if (!d || !d.w || !d.h) { // 머리에서 못 찾으면 브라우저로 풀어서 잼
      const url = URL.createObjectURL(file);
      try { const img = new Image(); img.src = url; await img.decode(); d = { w: img.naturalWidth, h: img.naturalHeight }; }
      catch (e) { d = { w: 1, h: 1.414 }; }
      finally { URL.revokeObjectURL(url); }
    }
    dimCache.set(file, d);
    return d;
  }
  // 쪽 그림: 흰 종이 + PDF와 같은 자리·크기로 사진(브라우저가 회전을 반영해 그림)
  async function drawPage(file, d, o, width) {
    const p = place(d.w, d.h, o.paper, o.margin);
    const dpr = Math.min(2, window.devicePixelRatio || 1), k = (width * dpr) / p.pw;
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(p.pw * k)); c.height = Math.max(1, Math.round(p.ph * k));
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, p.x * k, p.y * k, p.w * k, p.h * k);
    } finally { URL.revokeObjectURL(url); }
    return c;
  }
  const ids = new WeakMap(); let idN = 0;
  const fid = (f) => { if (!ids.has(f)) ids.set(f, ++idN); return ids.get(f); };
  let pvGen = 0;
  async function showPreview() {
    if (!pv) return;
    const files = list.files(), g = ++pvGen;
    if (!files.length) { pv.clear(); return; }
    const o = opt();
    const ds = await Promise.all(files.map(dims));
    if (g !== pvGen) return;
    let land = 0;
    const items = files.map((f, i) => {
      const d = ds[i], p = place(d.w, d.h, o.paper, o.margin);
      if (p.pw > p.ph) land++;
      return { key: `${fid(f)}|${o.paper}|${o.margin}`, w: p.pw, h: p.ph, label: `${i + 1}쪽`, draw: (w) => drawPage(f, d, o, w) };
    });
    const n = files.length;
    const sum = o.paper === "fit" ? `PDF ${n}쪽 · 쪽마다 사진 크기 그대로` : `PDF ${n}쪽 · A4 ${land && land < n ? `세로 ${n - land}쪽, 가로 ${land}쪽` : land ? "가로" : "세로"}${o.margin ? "" : " · 여백 없음"}`;
    pv.set(items, { sum });
  }
  box.querySelectorAll('[name="paper"],[name="margin"]').forEach((x) => x.addEventListener("change", () => { PT.hideResult(box); showPreview(); }));

  // JPEG의 EXIF 회전값(1~8). 읽지 못하면 1
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
  // 브라우저가 그린 그대로(회전 반영) 다시 저장
  // P2-69 캔버스 한계(iOS 약 1,677만 화소)를 넘는 사진은 그 안으로 줄여 그림. 쪽 크기는 원래 화소 크기(w·h)를 그대로 씀
  let capped = 0;
  async function redraw(file, type) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      const w = img.naturalWidth, h = img.naturalHeight;
      const r = await PT.canvasBlob(w, h, (ctx, cw, ch) => {
        if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cw, ch); }
        ctx.drawImage(img, 0, 0, cw, ch);
      }, type, 0.92);
      if (!r) throw new Error("canvas");
      if (r.shrunk) capped++;
      return { bytes: new Uint8Array(await r.blob.arrayBuffer()), w, h };
    } finally { URL.revokeObjectURL(url); }
  }
  // 넣은 그림 + 쪽 크기 계산에 쓸 원래 크기
  const sized = (img, w, h) => ({ img, width: w || img.width, height: h || img.height });
  async function embed(doc, file) {
    const buf = await PT.readBuf(file);
    const b = new Uint8Array(buf);
    const isJpg = b[0] === 0xff && b[1] === 0xd8, isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    if (!isJpg && !isPng) throw new Error(`「${file.name}」은(는) 확장자와 달리 JPG·PNG 이미지가 아니에요.`);
    try {
      if (isJpg && orientation(buf) > 1) { const r = await redraw(file, "image/jpeg"); return sized(await doc.embedJpg(r.bytes), r.w, r.h); }
      return sized(isJpg ? await doc.embedJpg(b) : await doc.embedPng(b));
    } catch (e) {
      // 특이한 형식(16비트 PNG 등)은 브라우저로 다시 그려서 넣기
      try { const r = await redraw(file, "image/png"); return sized(await doc.embedPng(r.bytes), r.w, r.h); }
      catch (e2) { throw new Error(`「${file.name}」은(는) 깨졌거나 읽을 수 없는 이미지예요. 사진이 아주 크면 휴대폰 메모리가 부족할 수 있어요.`); }
    }
  }

  run.addEventListener("click", async () => {
    const files = list.files();
    if (!files.length) return;
    const { paper, margin } = opt();
    PT.msg(box, ""); PT.hideResult(box); PT.busy(box, true, "PDF를 만드는 중…");
    capped = 0;
    try {
      await PT.needPdf();
      const doc = await PDFLib.PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        PT.step(box, `${i + 1} / ${files.length}장 넣는 중…`, i / files.length); await PT.tick();
        const { img, width: iw, height: ih } = await embed(doc, files[i]);
        const p = place(iw, ih, paper, margin); // P2-82 미리보기와 같은 계산
        const page = doc.addPage([p.pw, p.ph]);
        page.drawImage(img, { x: p.x, y: p.y, width: p.w, height: p.h });
      }
      PT.step(box, "파일로 저장하는 중…", 1); await PT.tick();
      doc.setTitle("이미지 PDF"); doc.setProducer("펭귄 툴즈"); doc.setCreator("펭귄 툴즈");
      const blob = await PT.pdfBlob(doc);
      const name = files.length === 1 ? PT.base(files[0].name) : `${PT.base(files[0].name)}-외${files.length - 1}장`; // P2-72 원래 이름 기반
      PT.showResult(box, `<p class="tk-done"><b>PDF를 만들었어요.</b> ${doc.getPageCount()}쪽 · ${PT.size(blob.size)}</p>${capped ? `<p class="hint">아주 큰 사진 ${capped}장은 휴대폰 브라우저 한계 때문에 해상도를 줄여 넣었어요(쪽 크기는 그대로).</p>` : ""}<div class="tk-dl">${PT.dl(blob, name, "pdf", "PDF 내려받기")}</div>`);
    } catch (e) {
      PT.msg(box, e.message || String(e));
    } finally { PT.busy(box, false); }
  });
})();
