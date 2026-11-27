// PDF → JPG/PNG (페이지별 이미지, 해상도 선택, zip). 의존: vendor/pdfjs(pdf.js, worker 직접 호스팅), vendor/fflate.min.js, tool-kit.js
// pdf.js는 파일을 올릴 때 처음 한 번만 불러옵니다(tool-kit.js PT.pdfjs, 동적 import). PDF 해석은 같은 사이트의 worker 안에서 합니다.
// P2-82 넣자마자 결과 이미지 미리보기(PT.preview): 바꿀 쪽 순서 띠 + 쪽 그림 + 고른 해상도의 화소 크기
(function () {
  const box = document.querySelector('[data-tool="pdf2img"]');
  if (!box) return;
  const OPT = { exts: ["pdf"], maxSize: 100 * PT.MB, maxCount: 1 };
  const MAX_PAGES = 300, MAX_PIXELS = PT.IOS ? PT.SAFE_AREA * 0.98 : 40e6; // P2-69: iOS 사파리 캔버스 한계(약 1,677만 화소) 안으로
  const COARSE = matchMedia("(pointer:coarse)").matches; // P2-69 T13: 휴대폰에서 큰 PDF·많은 쪽은 미리 알림
  const run = box.querySelector("[data-run]");
  const opts = box.querySelector(".tk-opts"), info = box.querySelector(".tk-info"), range = box.querySelector('[name="range"]');
  const pv = PT.preview(box);
  let pdf = null, file = null;

  // 결과 이미지 화소 크기(받기와 같은 계산). vp1 = 배율 1 크기
  function outSize(vp1, dpi) {
    let scale = dpi / 72, shrunk = false;
    const a = vp1.width * vp1.height * scale * scale;
    if (a > MAX_PIXELS) { scale *= Math.sqrt(MAX_PIXELS / a); shrunk = true; }
    return { scale, w: Math.round(vp1.width * scale), h: Math.round(vp1.height * scale), shrunk };
  }
  const sizes = new Map(); // 쪽 번호 → 배율 1 크기(그린 쪽만)
  const dpiNow = () => Number(box.querySelector('[name="dpi"]').value) || 150;
  const fmtNow = () => box.querySelector('[name="format"]').value.toUpperCase();
  const px = (n) => { const s = outSize(sizes.get(n), dpiNow()); return `${s.w}×${s.h}`; };
  let shown = [], first = null;
  function summary() {
    if (!shown.length) return;
    const s = outSize(first.vp, dpiNow());
    pv.sum(`${fmtNow()} 이미지 ${shown.length}장 · ${first.n}쪽 ${s.w}×${s.h}px (${dpiNow()}dpi)${s.shrunk ? " · 너무 커서 해상도를 낮춤" : ""}`);
    shown.forEach((n, i) => { if (sizes.has(n)) pv.note(i, px(n)); });
  }
  let pvGen = 0;
  async function showPreview() {
    if (!pv || !pdf) return;
    let pages;
    try { pages = parse(range.value, pdf.numPages); }
    catch (e) { shown = []; pv.set([], { sum: e.message }); return; }
    const g = ++pvGen, doc = pdf;
    const p1 = await doc.getPage(pages[0]);
    if (g !== pvGen || doc !== pdf) return;
    first = { n: pages[0], vp: p1.getViewport({ scale: 1 }) };
    sizes.set(pages[0], first.vp);
    shown = pages;
    pv.set(pages.map((n) => ({
      key: String(n), w: first.vp.width, h: first.vp.height, label: `${n}쪽`, note: sizes.has(n) ? px(n) : "",
      draw: async (w) => {
        const pg = await doc.getPage(n);
        sizes.set(n, pg.getViewport({ scale: 1 }));
        const i = shown.indexOf(n);
        if (doc === pdf && i >= 0) pv.note(i, px(n));
        return PT.pdfThumb(doc, n, w);
      },
    })), { big: file.size > PT.PV_HEAVY });
    summary();
    if (pages.length > MAX_PAGES) pv.sum(`${pages.length}쪽을 골랐어요. 한 번에 ${MAX_PAGES}쪽까지 바꿀 수 있으니 범위를 나눠 주세요.`);
  }
  let rangeT = 0;
  range.addEventListener("input", () => { clearTimeout(rangeT); rangeT = setTimeout(() => { PT.hideResult(box); showPreview(); }, 350); });
  box.querySelectorAll('[name="dpi"],[name="format"]').forEach((x) => x.addEventListener("change", () => { PT.hideResult(box); summary(); }));

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
    PT.busy(box, true, COARSE && ok[0].size > 30 * PT.MB ? `PDF를 여는 중… 큰 파일(${Math.round(ok[0].size / PT.MB)}MB)이라 휴대폰에서는 시간이 걸릴 수 있어요` : "PDF를 여는 중…");
    try {
      if (file) { const old = file; pdf = file = null; pv && pv.clear(); sizes.clear(); await PT.pdfClose(old); } // 앞 파일 정리(worker 메모리)
      pdf = await PT.pdfOpen(ok[0]); // 암호·손상 안내 문장은 PT.pdfOpen이 만듦
      file = ok[0];
      info.innerHTML = `<b>${PT.esc(file.name)}</b> · ${PT.size(file.size)} · 전체 <b>${pdf.numPages}쪽</b>`;
      range.placeholder = `비워 두면 전체 (1-${pdf.numPages})`;
      opts.hidden = false;
      await showPreview();
      if (COARSE && pdf.numPages > 50) PT.msg(box, `${pdf.numPages}쪽짜리 PDF예요. 휴대폰은 메모리가 적어 한 번에 많은 쪽을 바꾸면 멈출 수 있어요. 범위를 50쪽 안팎으로 나눠 바꾸는 것을 권해요.`, "note");
    } catch (e) {
      PT.pdfClose(ok[0]);
      pdf = file = null; opts.hidden = true; pv && pv.clear();
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
        const vp1 = page.getViewport({ scale: 1 }), o = outSize(vp1, dpi); // P2-82 미리보기에 적은 화소 크기와 같은 계산
        const vp = page.getViewport({ scale: o.scale });
        if (o.shrunk) shrunk++;
        const c = document.createElement("canvas");
        c.width = o.w; c.height = o.h;
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
        rows.push(`<li><img src="${url}" alt="${n}쪽 미리보기" width="44" height="44" loading="lazy"><span class="fl-name">${n}쪽<small>${o.w}×${o.h} · ${PT.size(blob.size)}</small></span><a class="btn ghost" href="${url}" download="${PT.esc(name)}" data-dl>받기</a></li>`);
      }
      PT.step(box, "zip으로 묶는 중…", 1); await PT.tick();
      const zip = new Blob([fflate.zipSync(zipFiles)], { type: "application/zip" });
      PT.showResult(box, `<p class="tk-done"><b>${pages.length}쪽을 ${fmt.toUpperCase()} 이미지로 바꿨어요.</b> 합계 ${PT.size(total)}</p>
${shrunk ? `<p class="hint">너무 큰 쪽 ${shrunk}개는 ${PT.IOS ? "아이폰·아이패드 브라우저 한계(약 1,600만 화소)" : "4천만 화소"}를 넘지 않게 해상도를 낮췄어요.</p>` : ""}
<div class="tk-dl">${PT.dl(zip, `${base}-이미지`, "zip", "zip으로 한 번에 내려받기")}</div>
<details class="tk-each" open><summary>쪽별로 하나씩 내려받기</summary><ul class="flist done">${rows.join("")}</ul></details>`);
    } catch (e) {
      PT.msg(box, e.message || String(e));
    } finally { PT.busy(box, false); run.disabled = !pdf; }
  });
})();
