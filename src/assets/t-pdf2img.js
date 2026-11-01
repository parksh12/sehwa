// PDF → JPG/PNG (페이지별 이미지, 해상도 선택, zip). 의존: vendor/pdfjs(pdf.js, worker 직접 호스팅), vendor/fflate.min.js, tool-kit.js
// pdf.js는 파일을 올릴 때 처음 한 번만 불러옵니다(동적 import). PDF 해석은 같은 사이트의 worker 안에서 합니다.
(function () {
  const box = document.querySelector('[data-tool="pdf2img"]');
  if (!box) return;
  const VENDOR = new URL("vendor/pdfjs/", document.currentScript.src).href;
  const OPT = { exts: ["pdf"], maxSize: 100 * PT.MB, maxCount: 1 };
  const MAX_PAGES = 300, MAX_PIXELS = 40e6;
  const run = box.querySelector("[data-run]");
  const opts = box.querySelector(".tk-opts"), info = box.querySelector(".tk-info"), range = box.querySelector('[name="range"]');
  let lib = null, pdf = null, file = null, task = null;

  async function loadLib() {
    if (lib) return lib;
    lib = await import(VENDOR + "pdf.min.js");
    lib.GlobalWorkerOptions.workerSrc = VENDOR + "pdf.worker.min.js";
    return lib;
  }

  // "1-3, 5" → [1,2,3,5] (1부터, 적은 순서·중복 제거)
  function parse(text, total) {
    const t = String(text || "").trim();
    if (!t) return Array.from({ length: total }, (_, i) => i + 1);
    const out = [];
    for (const p of t.replace(/[~–—]/g, "-").split(/[,，\s]+/).filter(Boolean)) {
      const m = p.match(/^(\d+)(?:-(\d+))?$/);
      if (!m) throw new Error(`「${p}」은(는) 알아볼 수 없는 범위예요. 「1-3, 5」처럼 적어 주세요.`);
      const a = +m[1], b = m[2] ? +m[2] : a;
      if (a < 1 || b < 1 || a > total || b > total) throw new Error(`「${p}」에 전체 쪽수(${total}쪽)를 벗어난 번호가 있어요.`);
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (!out.includes(i)) out.push(i);
    }
    return out;
  }

  PT.dropzone(box, async (files) => {
    const { ok, errs } = PT.check(files.slice(0, 1), OPT);
    PT.hideResult(box);
    PT.msg(box, (files.length > 1 ? "한 번에 PDF 하나만 바꿀 수 있어요. 첫 번째 파일만 열었어요. " : "") + errs.join(" "), files.length > 1 && !errs.length ? "note" : "error");
    if (!ok.length) return;
    PT.busy(box, true, "PDF를 여는 중…");
    try {
      if (task) { try { await task.destroy(); } catch (e) {} task = null; pdf = null; } // 앞 파일 정리(worker 메모리)
      const L = await loadLib();
      const data = new Uint8Array(await PT.readBuf(ok[0]));
      try {
        task = L.getDocument({ data, isEvalSupported: false, enableXfa: false, useSystemFonts: true, cMapUrl: VENDOR + "cmaps/", cMapPacked: true, wasmUrl: VENDOR + "wasm/", iccUrl: VENDOR + "iccs/" });
        pdf = await task.promise;
      } catch (e) {
        const n = (e && e.name) || "";
        throw new Error(n === "PasswordException" ? `「${ok[0].name}」은(는) 암호가 걸린 PDF라서 열 수 없어요. 원래 프로그램에서 암호를 풀고 다시 저장한 뒤 넣어 주세요.` : `「${ok[0].name}」은(는) 깨졌거나 올바른 PDF가 아니어서 열 수 없어요.`);
      }
      file = ok[0];
      info.innerHTML = `<b>${PT.esc(file.name)}</b> · ${PT.size(file.size)} · 전체 <b>${pdf.numPages}쪽</b>`;
      range.placeholder = `비워 두면 전체 (1-${pdf.numPages})`;
      opts.hidden = false;
    } catch (e) {
      pdf = file = null; opts.hidden = true;
      PT.msg(box, e.message || String(e));
    } finally { PT.busy(box, false); run.disabled = !pdf; }
  });

  run.addEventListener("click", async () => {
    if (!pdf) return;
    PT.msg(box, ""); PT.hideResult(box);
    let pages;
    try { pages = parse(range.value, pdf.numPages); } catch (e) { PT.msg(box, e.message); range.focus(); return; }
    if (pages.length > MAX_PAGES) { PT.msg(box, `한 번에 ${MAX_PAGES}쪽까지 바꿀 수 있어요. 범위를 나눠서 해 주세요.`); return; }
    const fmt = box.querySelector('[name="format"]').value, type = fmt === "png" ? "image/png" : "image/jpeg";
    const dpi = Number(box.querySelector('[name="dpi"]').value) || 150;
    const base = PT.base(file.name), padN = Math.max(2, String(pdf.numPages).length);
    PT.busy(box, true, "이미지로 바꾸는 중…");
    const zipFiles = {}, rows = [];
    let total = 0, shrunk = 0;
    try {
      for (let k = 0; k < pages.length; k++) {
        const n = pages[k];
        PT.step(box, `${k + 1} / ${pages.length}쪽 그리는 중…`, k / pages.length); await PT.tick();
        const page = await pdf.getPage(n);
        let scale = dpi / 72;
        let vp = page.getViewport({ scale });
        if (vp.width * vp.height > MAX_PIXELS) { scale *= Math.sqrt(MAX_PIXELS / (vp.width * vp.height)); vp = page.getViewport({ scale }); shrunk++; }
        const c = document.createElement("canvas");
        c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvas: c, canvasContext: ctx, viewport: vp }).promise;
        const blob = await new Promise((r) => c.toBlob(r, type, 0.9));
        c.width = c.height = 0; page.cleanup();
        if (!blob) throw new Error(`${n}쪽을 이미지로 저장하지 못했어요. 해상도를 낮춰 보세요.`);
        const name = `${base}-${String(n).padStart(padN, "0")}.${fmt === "png" ? "png" : "jpg"}`;
        zipFiles[name] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
        total += blob.size;
        const url = PT.url(blob);
        rows.push(`<li><img src="${url}" alt="${n}쪽 미리보기" width="44" height="44" loading="lazy"><span class="fl-name">${n}쪽<small>${Math.round(vp.width)}×${Math.round(vp.height)} · ${PT.size(blob.size)}</small></span><a class="btn ghost" href="${url}" download="${PT.esc(name)}">받기</a></li>`);
      }
      PT.step(box, "zip으로 묶는 중…", 1); await PT.tick();
      const zip = new Blob([fflate.zipSync(zipFiles)], { type: "application/zip" });
      PT.showResult(box, `<p class="tk-done"><b>${pages.length}쪽을 ${fmt.toUpperCase()} 이미지로 바꿨어요.</b> 합계 ${PT.size(total)}</p>
${shrunk ? `<p class="hint">너무 큰 쪽 ${shrunk}개는 4천만 화소를 넘지 않게 해상도를 낮췄어요.</p>` : ""}
<div class="tk-dl">${PT.link(zip, `${base}-이미지.zip`, "zip으로 한 번에 내려받기", "btn big")}</div>
<details class="tk-each" open><summary>쪽별로 하나씩 내려받기</summary><ul class="flist done">${rows.join("")}</ul></details>`);
    } catch (e) {
      PT.msg(box, e.message || String(e));
    } finally { PT.busy(box, false); run.disabled = !pdf; }
  });
})();
