// 이미지 용량 줄이기 (canvas 재인코딩, 품질·최대 너비, 줄어든 비율). 의존: vendor/fflate.min.js, tool-kit.js
(function () {
  const box = document.querySelector('[data-tool="imgcompress"]');
  if (!box) return;
  const OPT = { exts: ["jpg", "jpeg", "png", "webp"], maxSize: 30 * PT.MB, maxCount: 30, maxTotal: 300 * PT.MB, reject: { heic: "HEIC(아이폰 사진) 파일은 아직 지원하지 않아요. 사진 앱에서 JPG로 내보낸 뒤 넣어 주세요.", gif: "GIF는 지원하지 않아요. 움직이는 그림이 멈춘 그림으로 바뀌기 때문이에요." } };
  const MAX_PIXELS = 50e6; // 5천만 화소 넘는 이미지는 브라우저 메모리 문제로 거절
  const run = box.querySelector("[data-run]");
  const q = box.querySelector('[name="quality"]'), qOut = box.querySelector(".q-out");
  q.addEventListener("input", () => { qOut.textContent = q.value; });
  const list = PT.fileList(box, { thumbs: true, onChange: (items) => { run.disabled = !items.length; box.querySelector(".tk-opts").hidden = !items.length; } });
  PT.dropzone(box, (files) => {
    const { ok, errs } = PT.check(files, OPT, list.files());
    PT.msg(box, errs.join(" "));
    PT.hideResult(box);
    list.add(ok);
  });
  // WEBP 저장을 못 하는 브라우저(옛 사파리 등)면 선택지에서 숨김
  (function () {
    const c = document.createElement("canvas"); c.width = c.height = 1;
    if (!c.toDataURL("image/webp").startsWith("data:image/webp")) { const o = box.querySelector('[name="format"] option[value="webp"]'); o && o.remove(); }
  })();

  async function shrink(file, quality, maxW, type) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url;
      try { await img.decode(); } catch (e) { throw new Error(`「${file.name}」은(는) 깨졌거나 읽을 수 없는 이미지예요.`); }
      const w0 = img.naturalWidth, h0 = img.naturalHeight;
      if (w0 * h0 > MAX_PIXELS) throw new Error(`「${file.name}」은(는) ${w0}×${h0}로 너무 커서 처리할 수 없어요(5천만 화소까지).`);
      const s = maxW && w0 > maxW ? maxW / w0 : 1;
      const w = Math.max(1, Math.round(w0 * s)), h = Math.max(1, Math.round(h0 * s));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);
      const blob = await new Promise((r) => c.toBlob(r, type, quality));
      if (!blob) throw new Error(`「${file.name}」을(를) 저장하지 못했어요.`);
      return { blob, w, h, w0, h0 };
    } finally { URL.revokeObjectURL(url); }
  }

  run.addEventListener("click", async () => {
    const files = list.files();
    if (!files.length) return;
    const quality = Number(q.value) / 100, maxW = Number(box.querySelector('[name="maxw"]').value) || 0;
    const fmt = box.querySelector('[name="format"]').value, type = fmt === "webp" ? "image/webp" : "image/jpeg";
    PT.msg(box, ""); PT.hideResult(box); PT.busy(box, true, "용량을 줄이는 중…");
    const rows = [], zipFiles = {}, errs = [];
    let before = 0, after = 0;
    try {
      const used = new Set();
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        PT.step(box, `${i + 1} / ${files.length}장 줄이는 중…`, i / files.length); await PT.tick();
        try {
          const r = await shrink(f, quality, maxW, type);
          const keep = r.blob.size >= f.size && r.w === r.w0; // 줄지 않았고 크기도 그대로면 원본 유지
          const out = keep ? f : r.blob;
          let name = keep ? f.name : `${PT.base(f.name)}-small.${fmt === "webp" ? "webp" : "jpg"}`;
          while (used.has(name)) name = name.replace(/(\.[^.]+)$/, "_$1");
          used.add(name);
          before += f.size; after += out.size;
          zipFiles[name] = [new Uint8Array(await out.arrayBuffer()), { level: 0 }];
          const pct = Math.round((1 - out.size / f.size) * 100);
          rows.push(`<li><span class="fl-name">${PT.esc(f.name)}<small>${r.w0}×${r.h0} → ${keep ? "원본 유지" : `${r.w}×${r.h}`} · ${PT.size(f.size)} → ${PT.size(out.size)}</small></span><b class="pct">${keep ? "그대로" : `-${pct}%`}</b>${PT.link(out, name, "받기", "btn ghost")}</li>`);
        } catch (e) { errs.push(e.message || String(e)); }
      }
      if (errs.length) PT.msg(box, errs.join(" "));
      if (!rows.length) return;
      const pct = Math.round((1 - after / before) * 100);
      const zip = rows.length > 1 ? new Blob([fflate.zipSync(zipFiles)], { type: "application/zip" }) : null;
      PT.showResult(box, `<p class="tk-done"><b>${PT.size(before)} → ${PT.size(after)}</b> (${pct > 0 ? `${pct}% 줄었어요` : "더 줄지 않았어요"})</p>
${pct <= 0 ? '<p class="hint">이미 충분히 압축된 이미지라 원본을 그대로 드려요. 품질이나 최대 너비를 더 낮춰 보세요.</p>' : ""}
<ul class="flist done">${rows.join("")}</ul>${zip ? `<div class="tk-dl">${PT.link(zip, "용량줄인이미지.zip", "zip으로 한 번에 내려받기", "btn big")}</div>` : ""}`);
    } finally { PT.busy(box, false); run.disabled = !list.files().length; }
  });
})();
