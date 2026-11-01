// 이미지 → PDF (JPG/PNG 여러 장, 순서 바꾸기, A4/원본 크기). 의존: vendor/pdf-lib.min.js, tool-kit.js
(function () {
  const box = document.querySelector('[data-tool="img2pdf"]');
  if (!box || !window.PDFLib) return;
  const OPT = { exts: ["jpg", "jpeg", "png"], maxSize: 20 * PT.MB, maxCount: 50, maxTotal: 200 * PT.MB, reject: { heic: "HEIC(아이폰 사진) 파일은 아직 지원하지 않아요. 사진 앱에서 JPG로 내보낸 뒤 넣어 주세요.", heif: "HEIF 파일은 아직 지원하지 않아요. JPG로 바꾼 뒤 넣어 주세요.", webp: "WEBP는 아직 지원하지 않아요. JPG나 PNG로 바꾼 뒤 넣어 주세요." } };
  const run = box.querySelector("[data-run]");
  const list = PT.fileList(box, { thumbs: true, onChange: (items) => { run.disabled = !items.length; box.querySelector(".tk-opts").hidden = !items.length; } });
  PT.dropzone(box, (files) => {
    const { ok, errs } = PT.check(files, OPT, list.files());
    PT.msg(box, errs.join(" "));
    PT.hideResult(box);
    list.add(ok);
  });

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
  async function redraw(file, type) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, type, 0.92));
      if (!blob) throw new Error("canvas");
      return new Uint8Array(await blob.arrayBuffer());
    } finally { URL.revokeObjectURL(url); }
  }
  async function embed(doc, file) {
    const buf = await PT.readBuf(file);
    const b = new Uint8Array(buf);
    const isJpg = b[0] === 0xff && b[1] === 0xd8, isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    if (!isJpg && !isPng) throw new Error(`「${file.name}」은(는) 확장자와 달리 JPG·PNG 이미지가 아니에요.`);
    try {
      if (isJpg) return orientation(buf) > 1 ? await doc.embedJpg(await redraw(file, "image/jpeg")) : await doc.embedJpg(b);
      return await doc.embedPng(b);
    } catch (e) {
      // 특이한 형식(16비트 PNG 등)은 브라우저로 다시 그려서 넣기
      try { return await doc.embedPng(await redraw(file, "image/png")); }
      catch (e2) { throw new Error(`「${file.name}」은(는) 깨졌거나 읽을 수 없는 이미지예요.`); }
    }
  }

  run.addEventListener("click", async () => {
    const files = list.files();
    if (!files.length) return;
    const paper = box.querySelector('[name="paper"]:checked').value;
    const margin = Number(box.querySelector('[name="margin"]').value);
    PT.msg(box, ""); PT.hideResult(box); PT.busy(box, true, "PDF를 만드는 중…");
    try {
      const doc = await PDFLib.PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        PT.step(box, `${i + 1} / ${files.length}장 넣는 중…`, i / files.length); await PT.tick();
        const img = await embed(doc, files[i]);
        if (paper === "fit") {
          const page = doc.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        } else {
          const land = img.width > img.height;
          const [pw, ph] = land ? [841.89, 595.28] : [595.28, 841.89];
          const s = Math.min((pw - margin * 2) / img.width, (ph - margin * 2) / img.height);
          const w = img.width * s, h = img.height * s;
          const page = doc.addPage([pw, ph]);
          page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
        }
      }
      PT.step(box, "파일로 저장하는 중…", 1); await PT.tick();
      doc.setTitle("이미지 PDF"); doc.setProducer("펭귄 툴즈"); doc.setCreator("펭귄 툴즈");
      const blob = await PT.pdfBlob(doc);
      const name = files.length === 1 ? PT.base(files[0].name) + ".pdf" : "이미지모음.pdf";
      PT.showResult(box, `<p class="tk-done"><b>PDF를 만들었어요.</b> ${doc.getPageCount()}쪽 · ${PT.size(blob.size)}</p><div class="tk-dl">${PT.link(blob, name, "PDF 내려받기", "btn big")}</div>`);
    } catch (e) {
      PT.msg(box, e.message || String(e));
    } finally { PT.busy(box, false); }
  });
})();
