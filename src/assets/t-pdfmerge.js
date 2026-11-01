// PDF 합치기 (순서 바꾸기). 의존: vendor/pdf-lib.min.js, tool-kit.js
(function () {
  const box = document.querySelector('[data-tool="pdfmerge"]');
  if (!box || !window.PDFLib) return;
  const OPT = { exts: ["pdf"], maxSize: 50 * PT.MB, maxCount: 30, maxTotal: 200 * PT.MB };
  const run = box.querySelector("[data-run]");
  const list = PT.fileList(box, { onChange: (items) => { run.disabled = items.length < 2; box.querySelector(".tk-hint-two").hidden = items.length !== 1; } });
  PT.dropzone(box, (files) => {
    const { ok, errs } = PT.check(files, OPT, list.files());
    PT.msg(box, errs.join(" "));
    PT.hideResult(box);
    list.add(ok);
  });

  run.addEventListener("click", async () => {
    const files = list.files();
    if (files.length < 2) return;
    PT.msg(box, ""); PT.hideResult(box); PT.busy(box, true, "PDF를 합치는 중…");
    try {
      const out = await PDFLib.PDFDocument.create();
      for (let i = 0; i < files.length; i++) {
        PT.step(box, `${i + 1} / ${files.length}번째 파일 합치는 중…`, i / files.length); await PT.tick();
        const src = await PT.loadPdf(files[i]);
        let pages;
        try { pages = await out.copyPages(src, src.getPageIndices()); } catch (e) { throw new Error(PT.pdfError(e, files[i].name)); }
        pages.forEach((p) => out.addPage(p));
      }
      PT.step(box, "파일로 저장하는 중…", 1); await PT.tick();
      out.setProducer("펭귄 툴즈"); out.setCreator("펭귄 툴즈");
      const blob = await PT.pdfBlob(out);
      PT.showResult(box, `<p class="tk-done"><b>${files.length}개 파일을 합쳤어요.</b> 모두 ${out.getPageCount()}쪽 · ${PT.size(blob.size)}</p><div class="tk-dl">${PT.link(blob, "합친파일.pdf", "PDF 내려받기", "btn big")}</div>`);
    } catch (e) {
      PT.msg(box, e.message || String(e));
    } finally { PT.busy(box, false); run.disabled = list.files().length < 2; }
  });
})();
