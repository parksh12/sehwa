// 펭귄 툴즈 공통 틀: 파일 넣기(끌어다 놓기·선택) → 처리(진행 표시) → 내려받기 → 다음 툴 추천
// 원칙: 파일은 이 브라우저 안에서만 읽고 처리합니다. fetch·XHR·sendBeacon 등으로 파일 데이터를 보내지 않습니다.
(function () {
  const PT = (window.PT = window.PT || {});
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  PT.esc = esc;
  PT.size = (n) => (n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB" : (n / 1048576).toFixed(1) + " MB");
  PT.MB = 1048576;
  PT.base = (name) => String(name || "file").replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80) || "file";
  PT.ext = (name) => (String(name).match(/\.([^.]+)$/) || [, ""])[1].toLowerCase();

  // 오류·안내 메시지 (툴 상자 안 .tk-msg)
  PT.msg = (box, text, kind = "error") => {
    const el = box.querySelector(".tk-msg");
    if (!el) return;
    if (!text) { el.hidden = true; el.textContent = ""; return; }
    el.className = "tk-msg " + kind;
    el.textContent = text;
    el.hidden = false;
  };

  // 진행 중 표시
  PT.busy = (box, on, text) => {
    const el = box.querySelector(".tk-progress");
    if (!el) return;
    el.hidden = !on;
    if (text) el.querySelector(".tk-progress-text").textContent = text;
    box.querySelectorAll("[data-run], .drop input, .drop").forEach((b) => {
      if ("disabled" in b && b.tagName !== "DIV") b.disabled = on;
    });
    box.classList.toggle("is-busy", on);
  };
  PT.step = (box, text, ratio) => {
    const el = box.querySelector(".tk-progress");
    if (!el) return;
    el.querySelector(".tk-progress-text").textContent = text;
    const bar = el.querySelector(".tk-bar i");
    if (bar) bar.style.width = Math.round(Math.max(0, Math.min(1, ratio || 0)) * 100) + "%";
  };
  PT.tick = () => new Promise((r) => setTimeout(r, 0)); // 진행 표시가 그려질 틈

  // 결과 영역 열기 + 다음 툴 추천 보이기
  PT.showResult = (box, html) => {
    const res = box.querySelector(".tk-result");
    res.querySelector(".tk-result-body").innerHTML = html;
    res.hidden = false;
    const next = box.querySelector(".tk-next");
    if (next) next.hidden = false;
    res.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  };
  PT.hideResult = (box) => {
    const res = box.querySelector(".tk-result");
    if (res) { res.hidden = true; res.querySelector(".tk-result-body").innerHTML = ""; }
    PT.revokeAll();
  };

  // 내려받기: Blob → 객체 URL. 만든 URL은 다음 작업 때 해제합니다.
  const urls = [];
  PT.url = (blob) => { const u = URL.createObjectURL(blob); urls.push(u); return u; };
  PT.revokeAll = () => { while (urls.length) URL.revokeObjectURL(urls.pop()); };
  PT.link = (blob, name, label, cls = "btn") => `<a class="${cls}" href="${PT.url(blob)}" download="${esc(name)}">${esc(label || name)}</a>`;
  PT.save = (blob, name) => {
    const a = document.createElement("a");
    a.href = PT.url(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  };
  PT.readBuf = (file) => (file.arrayBuffer ? file.arrayBuffer() : new Response(file).arrayBuffer());

  // 파일 검사: 형식·크기·개수
  // opt: { exts:["pdf"], maxSize, maxCount, maxTotal, reject:{doc:"안내문"} }
  PT.check = (files, opt, already = []) => {
    const ok = [], errs = [];
    let total = already.reduce((n, f) => n + f.size, 0);
    for (const f of files) {
      const ext = PT.ext(f.name);
      if (opt.reject && opt.reject[ext]) { errs.push(opt.reject[ext]); continue; }
      if (!opt.exts.includes(ext)) { errs.push(`「${f.name}」은(는) 지원하지 않는 형식이에요. ${opt.exts.map((x) => x.toUpperCase()).join("·")} 파일만 넣을 수 있어요.`); continue; }
      if (f.size === 0) { errs.push(`「${f.name}」은(는) 빈 파일이에요.`); continue; }
      if (f.size > opt.maxSize) { errs.push(`「${f.name}」은(는) ${PT.size(f.size)}라서 너무 커요. 파일 하나는 ${PT.size(opt.maxSize)}까지예요.`); continue; }
      if (already.length + ok.length >= (opt.maxCount || 1)) { errs.push(`한 번에 ${opt.maxCount || 1}개까지 넣을 수 있어요. 나머지는 빼고 넣었어요.`); break; }
      if (opt.maxTotal && total + f.size > opt.maxTotal) { errs.push(`합계 ${PT.size(opt.maxTotal)}까지 넣을 수 있어요. 「${f.name}」부터는 빼고 넣었어요.`); break; }
      total += f.size;
      ok.push(f);
    }
    return { ok, errs: [...new Set(errs)] };
  };

  // 파일 넣는 칸: 끌어다 놓기 + 클릭/키보드로 선택
  PT.dropzone = (box, onFiles) => {
    const zone = box.querySelector(".drop");
    const input = zone.querySelector("input[type=file]");
    const pick = (list) => { if (list && list.length && !box.classList.contains("is-busy")) onFiles([...list]); };
    input.addEventListener("change", () => { pick(input.files); input.value = ""; });
    zone.addEventListener("keydown", (e) => { if (e.target === zone && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); input.click(); } });
    ["dragenter", "dragover"].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.add("over"); }));
    ["dragleave", "dragend"].forEach((t) => zone.addEventListener(t, () => zone.classList.remove("over")));
    zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("over"); pick(e.dataTransfer && e.dataTransfer.files); });
    // 칸 밖에 떨어뜨렸을 때 브라우저가 파일을 열어 버리지 않게
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("drop", (e) => { if (!zone.contains(e.target)) e.preventDefault(); });
  };

  // 순서 바꾸기가 되는 파일 목록
  PT.fileList = (box, { onChange, thumbs = false } = {}) => {
    const ul = box.querySelector(".flist");
    let items = [];
    const render = () => {
      ul.innerHTML = items
        .map((it, i) => `<li data-i="${i}">${thumbs && it.thumb ? `<img src="${it.thumb}" alt="" width="44" height="44">` : `<span class="fl-no">${i + 1}</span>`}<span class="fl-name">${esc(it.file.name)}<small>${PT.size(it.file.size)}${it.note ? " · " + esc(it.note) : ""}</small></span>
<span class="fl-btns"><button type="button" class="fl-b" data-mv="-1" aria-label="${i + 1}번 위로" ${i === 0 ? "disabled" : ""}>▲</button><button type="button" class="fl-b" data-mv="1" aria-label="${i + 1}번 아래로" ${i === items.length - 1 ? "disabled" : ""}>▼</button><button type="button" class="fl-b fl-x" data-rm aria-label="${i + 1}번 빼기">빼기</button></span></li>`)
        .join("");
      ul.hidden = !items.length;
      onChange && onChange(items);
    };
    ul.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || box.classList.contains("is-busy")) return;
      const i = Number(b.closest("li").dataset.i);
      if (b.dataset.rm != null) { const [it] = items.splice(i, 1); if (it.thumb) URL.revokeObjectURL(it.thumb); }
      else { const j = i + Number(b.dataset.mv); if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; }
      PT.hideResult(box);
      render();
      const again = ul.querySelector(`li[data-i="${Math.min(i, items.length - 1)}"] [data-${b.dataset.rm != null ? "rm" : "mv"}]`);
      again && again.focus();
    });
    return {
      add(files) { files.forEach((f) => items.push({ file: f, thumb: thumbs ? URL.createObjectURL(f) : "" })); render(); },
      clear() { items.forEach((it) => it.thumb && URL.revokeObjectURL(it.thumb)); items = []; render(); },
      get items() { return items; },
      files() { return items.map((x) => x.file); },
      render,
    };
  };

  // PDF 읽기 오류를 사람이 읽을 수 있는 문장으로
  PT.pdfError = (err, name) => {
    const m = String((err && (err.message || err)) || "");
    if (/encrypt/i.test(m)) return `「${name}」은(는) 암호가 걸렸거나 보호된 PDF라서 처리할 수 없어요. 원래 프로그램에서 암호를 풀고 다시 저장한 뒤 넣어 주세요.`;
    return `「${name}」은(는) 깨졌거나 올바른 PDF가 아니어서 열 수 없어요.`; // 읽는 도중 생긴 오류는 모두 손상으로 안내
  };
  PT.loadPdf = async (file) => {
    const bytes = await PT.readBuf(file);
    let doc, n;
    try { doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false }); n = doc.getPageCount(); doc.getPages(); }
    catch (e) { throw new Error(PT.pdfError(e, file.name)); }
    if (!n) throw new Error(`「${file.name}」에서 페이지를 찾지 못했어요. 깨졌거나 올바른 PDF가 아닐 수 있어요.`);
    return doc;
  };
  PT.pdfBlob = async (doc) => new Blob([await doc.save()], { type: "application/pdf" });
})();
