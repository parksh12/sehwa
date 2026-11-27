// PDF 나누기 (페이지 범위 추출 / 한 쪽씩 나누기 → zip 또는 개별). 의존: vendor/pdf-lib.min.js(P2-69: 파일을 넣을 때 받음), vendor/fflate.min.js, tool-kit.js
// P2-82 2단계 미리보기: 고른 방식·범위대로 「결과 파일 n개, 각 파일 몇 쪽」과 결과 쪽 그림 띠(PT.preview). 범위가 틀리면 받기 전에 칸 바로 밑에 알림
(function () {
  const box = document.querySelector('[data-tool="pdfsplit"]');
  if (!box) return;
  const OPT = { exts: ["pdf"], maxSize: 100 * PT.MB, maxCount: 1 };
  const MAX_EACH = 500;
  const run = box.querySelector("[data-run]");
  ["pointerdown", "dragenter", "focusin"].forEach((t) => box.querySelector(".drop").addEventListener(t, () => PT.needPdf().catch(() => {}), { once: true })); // P2-69 파일을 고르는 동안 PDF 엔진을 미리 받음
  const opts = box.querySelector(".tk-opts");
  const info = box.querySelector(".tk-info");
  const range = box.querySelector('[name="range"]');
  const rangeErr = box.querySelector(".range-err");
  const pv = PT.preview(box);
  let file = null, src = null, sizes = [], fno = 0, tooMany = false;

  const mode = () => box.querySelector('[name="mode"]:checked').value;
  const sync = () => { box.querySelector(".range-row").hidden = mode() !== "range"; run.textContent = mode() === "range" ? "범위 추출하기" : "한 쪽씩 나누기"; };
  box.querySelectorAll('[name="mode"]').forEach((r) => r.addEventListener("change", () => { sync(); PT.hideResult(box); showPreview(); }));
  sync();
  let tmr = 0;
  range.addEventListener("input", () => { PT.hideResult(box); clearTimeout(tmr); tmr = setTimeout(showPreview, 250); });

  PT.dropzone(box, async (files) => {
    const { ok, errs } = PT.check(files.slice(0, 1), OPT);
    PT.hideResult(box);
    PT.msg(box, (files.length > 1 ? "한 번에 PDF 하나만 나눌 수 있어요. 첫 번째 파일만 열었어요. " : "") + errs.join(" "), files.length > 1 && !errs.length ? "note" : "error");
    if (!ok.length) return;
    PT.busy(box, true, "PDF를 여는 중…");
    const old = file;
    try {
      src = await PT.loadPdf(ok[0]); file = ok[0]; fno++;
      sizes = src.getPages().map((p) => {
        const { width, height } = p.getSize(), a = (((p.getRotation().angle || 0) % 360) + 360) % 360;
        return a === 90 || a === 270 ? [height, width] : [width, height];
      });
      info.innerHTML = `<b>${PT.esc(file.name)}</b> · ${PT.size(file.size)} · 전체 <b>${src.getPageCount()}쪽</b>`;
      range.placeholder = `예: 1-3, 5 (전체 1-${src.getPageCount()})`;
      opts.hidden = false;
    } catch (e) {
      src = file = null; sizes = []; opts.hidden = true;
      PT.msg(box, e.message || String(e));
    } finally {
      PT.busy(box, false);
      if (old && old !== file) PT.pdfClose(old);
      if (pv) pv.clear();
      showPreview();
    }
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
  const setErr = (text) => {
    rangeErr.textContent = text; rangeErr.hidden = !text;
    if (text) range.setAttribute("aria-invalid", "true"); else range.removeAttribute("aria-invalid");
  };
  const setNote = (text) => { // 한 쪽씩 나누기 쪽수 한도 안내(파일을 열 때 나온 안내와 겹치지 않게 따로 관리)
    if (text) { PT.msg(box, text); tooMany = true; } else if (tooMany) { PT.msg(box, ""); tooMany = false; }
  };
  const busy = () => box.classList.contains("is-busy");
  const pad = (n) => Math.max(2, String(n).length);
  const thumb = (p) => { const [w, h] = sizes[p], f = file; return { key: `${fno}|${p + 1}`, w, h, draw: (W) => PT.pdfThumb(f, p + 1, W) }; };

  // 결과 미리보기: 범위 추출 = 결과 파일 1개(적은 순서대로 쪽), 한 쪽씩 = 결과 파일 n개(각 1쪽)
  function showPreview() {
    if (!pv) return;
    setErr(""); setNote("");
    if (!src) { pv.clear(); run.disabled = true; return; }
    const total = sizes.length, base = PT.base(file.name), big = file.size > PT.PV_HEAVY;
    if (mode() === "range") {
      if (!range.value.trim()) { pv.set([], { sum: "뽑을 쪽 번호를 적으면 결과가 여기 나와요." }); run.disabled = busy(); return; }
      let idx;
      try { idx = parse(range.value, total); }
      catch (e) { setErr(e.message); pv.set([], { sum: "범위를 고치면 미리보기가 다시 나와요." }); run.disabled = busy(); return; } // 단추는 켜 둠: 입력 직후 바로 눌러도 칸 밑 안내가 다시 뜸
      pv.set(idx.map((p, k) => ({ ...thumb(p), g: 0, start: k === 0, head: k === 0 ? `${base}-추출.pdf` : "", label: `${k + 1}쪽`, note: `원래 ${p + 1}쪽` })), { sum: `결과 파일 1개 · ${base}-추출.pdf ${idx.length}쪽`, big });
    } else {
      if (total > MAX_EACH) { setNote(`한 쪽씩 나누기는 ${MAX_EACH}쪽까지 지원해요. 범위 추출로 나눠서 해 주세요.`); pv.set([], { sum: `전체 ${total}쪽이라 한 쪽씩 나눌 수 없어요.` }); run.disabled = true; return; }
      const n = pad(total);
      pv.set(sizes.map((s, p) => ({ ...thumb(p), g: p, start: true, label: `파일 ${p + 1}`, note: `1쪽 · 원래 ${p + 1}쪽` })), { sum: `결과 파일 ${total}개 · 각 1쪽 · ${base}-${"1".padStart(n, "0")}.pdf부터`, big });
    }
    run.disabled = busy();
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
    PT.msg(box, ""); tooMany = false; PT.hideResult(box);
    let idx;
    clearTimeout(tmr); showPreview(); // 입력 직후 바로 누른 경우: 미리보기를 지금 값으로 맞춤(칸을 떠날 때 다시 그리면 단추가 밀려 클릭이 빗나가서, 누른 뒤에 맞춤)
    if (mode() === "range") { try { idx = parse(range.value, total); } catch (e) { setErr(e.message); range.focus(); return; } }
    else if (total > MAX_EACH) { PT.msg(box, `한 쪽씩 나누기는 ${MAX_EACH}쪽까지 지원해요. 범위 추출로 나눠서 해 주세요.`); return; }
    PT.busy(box, true, "PDF를 나누는 중…");
    try {
      if (mode() === "range") {
        const doc = await pick(idx);
        const blob = await PT.pdfBlob(doc);
        PT.showResult(box, `<p class="tk-done"><b>${idx.length}쪽을 뽑았어요.</b> ${PT.size(blob.size)}</p><div class="tk-dl">${PT.dl(blob, `${base}-추출`, "pdf", "PDF 내려받기")}</div>`);
      } else {
        const n = pad(total);
        const files = {}, links = [];
        for (let i = 0; i < total; i++) {
          PT.step(box, `${i + 1} / ${total}쪽 나누는 중…`, i / total); if (i % 5 === 0) await PT.tick();
          const bytes = await (await pick([i])).save();
          const name = `${base}-${String(i + 1).padStart(n, "0")}.pdf`;
          files[name] = [bytes, { level: 0 }];
          links.push(`<li>${PT.link(new Blob([bytes], { type: "application/pdf" }), name, `${i + 1}쪽`, "chip")}</li>`);
        }
        PT.step(box, "zip으로 묶는 중…", 1); await PT.tick();
        const zip = new Blob([fflate.zipSync(files)], { type: "application/zip" });
        PT.showResult(box, `<p class="tk-done"><b>${total}개 파일로 나눴어요.</b> zip ${PT.size(zip.size)}</p><div class="tk-dl">${PT.dl(zip, `${base}-쪽별`, "zip", "zip으로 한 번에 내려받기")}</div><details class="tk-each"><summary>페이지별로 하나씩 내려받기</summary><ul class="chips">${links.join("")}</ul></details>`);
      }
    } catch (e) {
      PT.msg(box, e.message || String(e));
    } finally { PT.busy(box, false); run.disabled = !src; }
  });
})();
