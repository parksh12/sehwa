// PDF 합치기 (순서 바꾸기). 의존: vendor/pdf-lib.min.js(P2-69: 파일을 넣을 때 받음), tool-kit.js
// P2-82 2단계 미리보기: 넣는 즉시 pdf-lib로 파일별 쪽수를 셈(합치기와 같은 엔진이라 암호·손상 판정이 받을 때와 같음).
// 결과 순서대로 쪽 그림 띠를 그림(PT.preview, 파일 첫 쪽에 이름표·경계선). 순서를 바꾸거나 빼면 바로 다시 그림(그린 그림은 재사용)
(function () {
  const box = document.querySelector('[data-tool="pdfmerge"]');
  if (!box) return;
  const OPT = { exts: ["pdf"], maxSize: 50 * PT.MB, maxCount: 30, maxTotal: 200 * PT.MB };
  const run = box.querySelector("[data-run]");
  ["pointerdown", "dragenter", "focusin"].forEach((t) => box.querySelector(".drop").addEventListener(t, () => PT.needPdf().catch(() => {}), { once: true })); // P2-69 파일을 고르는 동안 PDF 엔진을 미리 받음
  const pv = PT.preview(box);
  const res = new Map(); // file → { n, sizes:[[w,h]] } 또는 { err, enc }
  const ids = new WeakMap(); let idN = 0;
  const fid = (f) => { if (!ids.has(f)) ids.set(f, ++idN); return ids.get(f); };
  let shown = new Set(), badShown = false, chain = Promise.resolve();

  const bad = () => list.items.filter((it) => (res.get(it.file) || {}).err);
  const canRun = () => list.items.length >= 2 && !bad().length;
  const list = PT.fileList(box, {
    onChange: (items) => {
      run.disabled = !canRun();
      box.querySelector(".tk-hint-two").hidden = items.length !== 1;
      const now = new Set(items.map((x) => x.file));
      shown.forEach((f) => { if (!now.has(f)) { res.delete(f); PT.pdfClose(f); } }); // 뺀 파일은 그림 엔진에서도 닫음
      shown = now;
      showPreview();
      items.forEach((it) => { if (!res.has(it.file)) inspect(it.file); });
    },
  });
  PT.dropzone(box, (files) => {
    const { ok, errs } = PT.check(files, OPT, list.files());
    PT.msg(box, errs.join(" ")); badShown = false;
    PT.hideResult(box);
    list.add(ok);
  });

  // 파일을 하나씩 차례로 열어 쪽수·쪽 크기만 읽고 문서는 바로 버림(큰 파일 여럿을 한꺼번에 풀지 않게)
  function inspect(file) {
    chain = chain.then(async () => {
      if (res.has(file) || !shown.has(file)) return;
      let r;
      try {
        const doc = await PT.loadPdf(file);
        r = { n: doc.getPageCount(), sizes: doc.getPages().map((p) => {
          const { width, height } = p.getSize(), a = (((p.getRotation().angle || 0) % 360) + 360) % 360;
          return a === 90 || a === 270 ? [height, width] : [width, height];
        }) };
      } catch (e) {
        const m = e.message || String(e);
        if (/엔진을 받지 못했어요/.test(m)) { PT.msg(box, m); return; } // 인터넷 문제: 파일을 다시 넣으면 다시 시도
        r = { err: m, enc: /암호/.test(m) };
      }
      if (!shown.has(file)) return;
      res.set(file, r);
      showPreview();
    });
  }

  function showPreview() {
    if (!pv) return;
    const items = list.items, rows = box.querySelectorAll(".flist li");
    if (!items.length) { pv.clear(); if (badShown) { PT.msg(box, ""); badShown = false; } return; }
    const out = [], parts = [], errs = [], enc = [], broken = [];
    let total = 0, wait = 0, good = 0, big = false;
    items.forEach((it, fi) => {
      const r = res.get(it.file), li = rows[fi];
      it.note = !r ? "쪽수 세는 중…" : r.err ? (r.enc ? "암호가 걸려 합칠 수 없음" : "열 수 없는 파일") : `${r.n}쪽`;
      if (li) { li.classList.toggle("is-bad", !!(r && r.err)); const sm = li.querySelector("small"); if (sm) sm.textContent = `${PT.size(it.file.size)} · ${it.note}`; }
      if (!r) { wait++; return; }
      if (r.err) { (r.enc ? enc : broken).push(`「${it.file.name}」`); errs.push(1); return; }
      if (!good++) big = it.file.size > PT.PV_HEAVY;
      parts.push(r.n);
      r.sizes.forEach(([w, h], p) => out.push({
        key: `${fid(it.file)}|${p + 1}`, w, h, g: fi, start: p === 0, head: p === 0 ? `${fi + 1}. ${it.file.name}` : "",
        label: `${total + p + 1}쪽`, note: `${fi + 1}번 파일 ${p + 1}쪽`,
        draw: (W) => PT.pdfThumb(it.file, p + 1, W),
      }));
      total += r.n;
    });
    let sum = total ? `합친 PDF ${total}쪽 · 파일 ${parts.length}개${parts.length > 1 && parts.length <= 10 ? ` (${parts.join(" + ")}쪽)` : ""}` : "";
    if (wait) sum += `${sum ? " · " : ""}쪽수 세는 중 (${items.length - wait}/${items.length})`;
    if (errs.length) sum += `${sum ? " · " : ""}합칠 수 없는 파일 ${errs.length}개`;
    pv.set(out, { sum, big });
    if (errs.length) {
      const why = [enc.length ? `${enc.join(", ")}은(는) 암호가 걸렸거나 편집이 막힌 PDF예요. 원래 프로그램에서 암호를 풀고 다시 저장하면 넣을 수 있어요.` : "", broken.length ? `${broken.join(", ")}은(는) 깨졌거나 PDF가 아니라서 열리지 않아요.` : ""].filter(Boolean).join(" ");
      PT.msg(box, `${why} 목록에서 그 파일을 「빼기」로 빼면 나머지는 합칠 수 있어요.`); badShown = true;
    }
    else if (badShown) { PT.msg(box, ""); badShown = false; }
    run.disabled = !canRun() || box.classList.contains("is-busy");
  }

  run.addEventListener("click", async () => {
    const files = list.files();
    if (!canRun()) return;
    PT.msg(box, ""); badShown = false; PT.hideResult(box); PT.busy(box, true, "PDF를 합치는 중…");
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
    } finally { PT.busy(box, false); run.disabled = !canRun(); }
  });
})();
