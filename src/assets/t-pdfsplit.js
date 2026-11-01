// PDF 나누기 (페이지 범위 추출 / 한 쪽씩 나누기 → zip 또는 개별). 의존: vendor/pdf-lib.min.js, vendor/fflate.min.js, tool-kit.js
(function () {
  const box = document.querySelector('[data-tool="pdfsplit"]');
  if (!box || !window.PDFLib) return;
  const OPT = { exts: ["pdf"], maxSize: 100 * PT.MB, maxCount: 1 };
  const MAX_EACH = 500;
  const run = box.querySelector("[data-run]");
  const opts = box.querySelector(".tk-opts");
  const info = box.querySelector(".tk-info");
  const range = box.querySelector('[name="range"]');
  let file = null, src = null;

  const mode = () => box.querySelector('[name="mode"]:checked').value;
  const sync = () => { box.querySelector(".range-row").hidden = mode() !== "range"; run.textContent = mode() === "range" ? "범위 추출하기" : "한 쪽씩 나누기"; };
  box.querySelectorAll('[name="mode"]').forEach((r) => r.addEventListener("change", () => { sync(); PT.hideResult(box); }));
  sync();

  PT.dropzone(box, async (files) => {
    const { ok, errs } = PT.check(files.slice(0, 1), OPT);
    PT.hideResult(box);
    PT.msg(box, (files.length > 1 ? "한 번에 PDF 하나만 나눌 수 있어요. 첫 번째 파일만 열었어요. " : "") + errs.join(" "), files.length > 1 && !errs.length ? "note" : "error");
    if (!ok.length) return;
    PT.busy(box, true, "PDF를 여는 중…");
    try {
      src = await PT.loadPdf(ok[0]); file = ok[0];
      info.innerHTML = `<b>${PT.esc(file.name)}</b> · ${PT.size(file.size)} · 전체 <b>${src.getPageCount()}쪽</b>`;
      range.placeholder = `예: 1-3, 5 (전체 1-${src.getPageCount()})`;
      opts.hidden = false; run.disabled = false;
    } catch (e) {
      src = file = null; opts.hidden = true; run.disabled = true;
      PT.msg(box, e.message || String(e));
    } finally { PT.busy(box, false); run.disabled = !src; }
  });

  // "1-3, 5, 8-10" → [0,1,2,4,7,8,9] (적은 순서 유지)
  function parse(text, total) {
    const out = [];
    const parts = String(text).replace(/[~–—]/g, "-").split(/[,，\s]+/).filter(Boolean);
    if (!parts.length) throw new Error("뽑을 페이지 번호를 적어 주세요. 예: 1-3, 5");
    for (const p of parts) {
      const m = p.match(/^(\d+)(?:-(\d+))?$/);
      if (!m) throw new Error(`「${p}」은(는) 알아볼 수 없는 범위예요. 「1-3, 5」처럼 숫자와 하이픈, 쉼표로 적어 주세요.`);
      const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
      if (a < 1 || b < 1 || a > total || b > total) throw new Error(`「${p}」에 전체 쪽수(${total}쪽)를 벗어난 번호가 있어요.`);
      const step = a <= b ? 1 : -1;
      for (let i = a; step > 0 ? i <= b : i >= b; i += step) out.push(i - 1);
    }
    if (out.length > 2000) throw new Error("한 번에 2000쪽까지 뽑을 수 있어요.");
    return out;
  }

  async function pick(indices) {
    const doc = await PDFLib.PDFDocument.create();
    let pages;
    try { pages = await doc.copyPages(src, indices); } catch (e) { throw new Error(PT.pdfError(e, file.name)); }
    pages.forEach((p) => doc.addPage(p));
    doc.setProducer("펭귄 툴즈"); doc.setCreator("펭귄 툴즈");
    return doc;
  }

  run.addEventListener("click", async () => {
    if (!src) return;
    const total = src.getPageCount(), base = PT.base(file.name);
    PT.msg(box, ""); PT.hideResult(box);
    let idx;
    if (mode() === "range") { try { idx = parse(range.value, total); } catch (e) { PT.msg(box, e.message); range.focus(); return; } }
    else if (total > MAX_EACH) { PT.msg(box, `한 쪽씩 나누기는 ${MAX_EACH}쪽까지 지원해요. 범위 추출로 나눠서 해 주세요.`); return; }
    PT.busy(box, true, "PDF를 나누는 중…");
    try {
      if (mode() === "range") {
        const doc = await pick(idx);
        const blob = await PT.pdfBlob(doc);
        PT.showResult(box, `<p class="tk-done"><b>${idx.length}쪽을 뽑았어요.</b> ${PT.size(blob.size)}</p><div class="tk-dl">${PT.link(blob, `${base}-추출.pdf`, "PDF 내려받기", "btn big")}</div>`);
      } else {
        const pad = String(total).length < 2 ? 2 : String(total).length;
        const files = {}, links = [];
        for (let i = 0; i < total; i++) {
          PT.step(box, `${i + 1} / ${total}쪽 나누는 중…`, i / total); if (i % 5 === 0) await PT.tick();
          const bytes = await (await pick([i])).save();
          const name = `${base}-${String(i + 1).padStart(pad, "0")}.pdf`;
          files[name] = [bytes, { level: 0 }];
          links.push(`<li>${PT.link(new Blob([bytes], { type: "application/pdf" }), name, `${i + 1}쪽`, "chip")}</li>`);
        }
        PT.step(box, "zip으로 묶는 중…", 1); await PT.tick();
        const zip = new Blob([fflate.zipSync(files)], { type: "application/zip" });
        PT.showResult(box, `<p class="tk-done"><b>${total}개 파일로 나눴어요.</b> zip ${PT.size(zip.size)}</p><div class="tk-dl">${PT.link(zip, `${base}-쪽별.zip`, "zip으로 한 번에 내려받기", "btn big")}</div><details class="tk-each"><summary>페이지별로 하나씩 내려받기</summary><ul class="chips">${links.join("")}</ul></details>`);
      }
    } catch (e) {
      PT.msg(box, e.message || String(e));
    } finally { PT.busy(box, false); run.disabled = !src; }
  });
})();
