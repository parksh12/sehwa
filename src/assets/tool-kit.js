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
  // P2-72 파일 이름 직접 정하기: 이름 칸·저장 창·이름 정리는 app.js(NALGI) 공통 부품을 씀(모든 페이지에 실림)
  const N = () => window.NALGI || {};
  const urls = [];
  PT.url = (blob) => { const u = URL.createObjectURL(blob); urls.push(u); N().dlBlobs && N().dlBlobs.set(u, blob); return u; };
  PT.revokeAll = () => { while (urls.length) { const u = urls.pop(); URL.revokeObjectURL(u); N().dlBlobs && N().dlBlobs.delete(u); } };
  // 작은 링크(쪽별·장별 받기): 칸 없이 기본 이름. 저장 창이 되는 PC에서는 창에서 이름을 정함
  PT.link = (blob, name, label, cls = "btn") => `<a class="${cls}" href="${PT.url(blob)}" download="${esc(name)}" data-dl>${esc(label || name)}</a>`;
  // 주 내려받기: 「파일 이름」 칸(기본 이름 미리 채움, 확장자는 칸 밖) + 단추 + 결과 안내. base는 확장자 없는 기본 이름
  PT.nameField = (base, ext, id) => N().nameFieldHtml({ def: base, ext, id });
  PT.dl = (blob, base, ext, label, cls = "btn big") => {
    const field = PT.nameField(base, ext);
    const id = N().nameFieldId(field);
    const name = N().fileName("", base, ext);
    return `${field}<a class="${cls}" href="${PT.url(blob)}" download="${esc(name)}" data-dl data-dl-for="${id}" data-dl-ext="${esc(ext)}">${esc(label || name)}</a><p class="fname-status hint" aria-live="polite"></p>`;
  };
  PT.nameFrom = (input, ext) => N().nameFrom(input, ext);
  // 단추로 바로 저장: src는 Blob 또는 Blob을 만드는 함수. 저장 창이 되면 창을 먼저 열고 만든다. "picker"|"link"|"cancel"
  PT.save = (src, name) => {
    if (N().saveFile) return N().saveFile(src, name);
    return Promise.resolve(typeof src === "function" ? src() : src).then((blob) => {
      const a = document.createElement("a");
      a.href = PT.url(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      return "link";
    });
  };
  PT.readBuf = (file) => (file.arrayBuffer ? file.arrayBuffer() : new Response(file).arrayBuffer());

  // P2-69 브라우저 캔버스 한계: iOS 사파리는 캔버스 한 장이 약 1,677만 화소(4096×4096)를 넘으면 그리지 못하고 빈 결과를 냄.
  // 아이폰·아이패드면 미리 그 안으로 줄이고, 다른 브라우저도 저장(toBlob)이 실패하면 같은 한계로 한 번 더 시도한다.
  PT.IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  PT.SAFE_AREA = 16777216;
  PT.fitArea = (w, h, max) => {
    if (!max || w * h <= max) return { w, h, s: 1 };
    const s = Math.sqrt((max * 0.98) / (w * h));
    return { w: Math.max(1, Math.floor(w * s)), h: Math.max(1, Math.floor(h * s)), s };
  };
  // 그리기 함수 draw(ctx, w, h)를 받아 w×h 캔버스로 저장. 한계에 걸리면 줄여서 다시 저장. { blob, w, h, shrunk } 또는 null
  PT.canvasBlob = async (w0, h0, draw, type, quality) => {
    const tryOnce = async (w, h) => {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      draw(ctx, w, h);
      const blob = await new Promise((r) => { try { c.toBlob(r, type, quality); } catch (e) { r(null); } });
      c.width = c.height = 0; // 메모리 바로 돌려주기(iOS는 캔버스 메모리 합계에도 한계가 있음)
      return blob;
    };
    let f = PT.fitArea(w0, h0, PT.IOS ? PT.SAFE_AREA : 0);
    let blob = await tryOnce(f.w, f.h);
    if (!blob && f.s === 1 && w0 * h0 > PT.SAFE_AREA) { f = PT.fitArea(w0, h0, PT.SAFE_AREA); blob = await tryOnce(f.w, f.h); }
    return blob ? { blob, w: f.w, h: f.h, shrunk: f.s < 1 } : null;
  };

  // P2-69 PDF 엔진(pdf-lib, gzip 약 200KB)은 페이지를 열 때 받지 않고, 파일을 넣거나 처리할 때 받는다.
  const libs = {};
  PT.need = (file, globalName) => {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    if (!libs[file]) {
      const me = document.querySelector('script[src*="/tool-kit.js"]');
      const ver = me ? new URL(me.src, location.href).searchParams.get("v") || "" : "";
      const base = document.documentElement.dataset.base || "";
      libs[file] = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = `${base}/assets/vendor/${file}${ver ? "?v=" + ver : ""}`;
        s.async = true;
        s.onload = () => (window[globalName] ? resolve(window[globalName]) : reject(new Error("lib")));
        s.onerror = () => { s.remove(); reject(new Error("lib")); };
        document.head.appendChild(s);
      }).catch(() => { delete libs[file]; throw new Error("PDF 처리 엔진을 받지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요."); });
    }
    return libs[file];
  };
  PT.needPdf = () => PT.need("pdf-lib.min.js", "PDFLib");

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
    await PT.needPdf();
    const bytes = await PT.readBuf(file);
    let doc, n;
    try { doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false }); n = doc.getPageCount(); doc.getPages(); }
    catch (e) { throw new Error(PT.pdfError(e, file.name)); }
    if (!n) throw new Error(`「${file.name}」에서 페이지를 찾지 못했어요. 깨졌거나 올바른 PDF가 아닐 수 있어요.`);
    return doc;
  };
  PT.pdfBlob = async (doc) => new Blob([await doc.save()], { type: "application/pdf" });
})();
