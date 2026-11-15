// PDF 합치기 (순서 바꾸기). 의존: vendor/pdf-lib.min.js(P2-69: 파일을 넣을 때 받음), tool-kit.js
(function () {
  const box = document.querySelector('[data-tool="pdfmerge"]');
  if (!box) return;
  const OPT = { exts: ["pdf"], maxSize: 50 * PT.MB, maxCount: 30, maxTotal: 200 * PT.MB };
  const run = box.querySelector("[data-run]");
  ["pointerdown", "dragenter", "focusin"].forEach((t) => box.querySelector(".drop").addEventListener(t, () => PT.needPdf().catch(() => {}), { once: true })); // P2-69 파일을 고르는 동안 PDF 엔진을 미리 받음
  const list = PT.fileList(box, { onChange: (items) => { run.disabled = items.length < 2; box.querySelector(".tk-hint-two").hidden = items.length !== 1; } });
  PT.dropzone(box, (files) => {
    const { ok, errs } = PT.check(files, OPT, list.files());
    PT.msg(box, errs.join(" "));
    PT.hideResult(box);
    list.add(ok);
    if (ok.length) PT.needPdf().catch(() => {}); // 미리 받아 두기
  });

  run.addEventListener("click", async () => {
    const files = list.files();
    if (files.length < 2) return;
    PT.msg(box, ""); PT.hideResult(box); PT.busy(box, true, "PDF를 합치는 중…");
    try {
      await PT.needPdf();
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
      PT.showResult(box, `<p class="tk-done"><b>${files.length}개 파일을 합쳤어요.</b> 모두 ${out.getPageCount()}쪽 · ${PT.size(blob.size)}</p><div class="tk-dl">${PT.dl(blob, `${PT.base(files[0].name)}-합침`, "pdf", "PDF 내려받기")}</div>`);
    } catch (e) {
      PT.msg(box, e.message || String(e));
    } finally { PT.busy(box, false); run.disabled = list.files().length < 2; }
  });
})();
