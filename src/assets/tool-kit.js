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
    PT.flow(box, 3); // P2-82 단계 표시
    res.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  };
  PT.hideResult = (box) => {
    const res = box.querySelector(".tk-result");
    if (res) { res.hidden = true; res.querySelector(".tk-result-body").innerHTML = ""; }
    const pv = box.querySelector(".pv");
    PT.flow(box, pv && !pv.hidden ? 2 : 1);
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

  // P2-82 Ctrl+V 붙여넣기: 클립보드 그림을 파일 넣기와 같은 흐름(onFiles)으로 넘김.
  // 글자 입력칸·선택 칸에 커서가 있으면 손대지 않음(글자 붙여넣기는 브라우저가 그대로 처리). 클립보드에 그림이 없어도 손대지 않음
  let pasteN = 0;
  const EDIT = 'input:not([type=file]):not([type=radio]):not([type=checkbox]):not([type=button]):not([type=submit]):not([type=range]), textarea, select, [contenteditable]:not([contenteditable="false"])';
  PT.paste = (box, onFiles) => {
    document.addEventListener("paste", (e) => {
      const t = e.target;
      if (t && t.closest && t.closest(EDIT)) return;
      if (box.classList.contains("is-busy") || !box.isConnected) return;
      const fs = [...((e.clipboardData && e.clipboardData.files) || [])].filter((x) => /^image\//.test(x.type));
      if (!fs.length) return;
      e.preventDefault();
      onFiles(fs.map((x) => {
        if (x.name && !/^image\.\w+$/i.test(x.name)) return x; // 탐색기에서 복사한 파일은 원래 이름 그대로
        const ext = (x.type.split("/")[1] || "png").replace("jpeg", "jpg").replace(/\+.*$/, "");
        return new File([x], `붙여넣기-${++pasteN}.${ext}`, { type: x.type, lastModified: Date.now() });
      }));
    });
  };

  // 파일 넣는 칸: 끌어다 놓기 + 클릭/키보드로 선택 (+ paste: true면 Ctrl+V 붙여넣기)
  PT.dropzone = (box, onFiles, { paste = false } = {}) => {
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
    if (paste) PT.paste(box, (files) => { if (!box.classList.contains("is-busy")) onFiles(files); });
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

  // ---------- P2-82 결과 미리보기(공통): 올리기 → 미리보기 → 받기 ----------
  // pdf.js(vendor/pdfjs, 직접 호스팅·CDN 없음)는 PDF를 넣을 때 처음 한 번만 받는다. 주소에 사이트 빌드 번호 대신 라이브러리 버전을 붙여
  // 사이트를 다시 빌드해도 주소가 같음 → 브라우저 캐시를 그대로 씀(라이브러리를 올릴 때만 바뀜).
  const PDFJS_V = "6.4.299";
  PT.pdfjsBase = () => {
    const me = document.querySelector('script[src*="/tool-kit.js"]');
    return new URL("vendor/pdfjs/", me ? me.src : location.href).href;
  };
  let pdfjsP = null;
  PT.pdfjs = () => pdfjsP || (pdfjsP = import(PT.pdfjsBase() + "pdf.min.js?v=" + PDFJS_V).then((L) => {
    L.GlobalWorkerOptions.workerSrc = PT.pdfjsBase() + "pdf.worker.min.js?v=" + PDFJS_V;
    return L;
  }).catch(() => { pdfjsP = null; throw new Error("PDF 그림 엔진을 받지 못했어요. 인터넷 연결을 확인하고 다시 넣어 주세요."); }));
  // 파일 하나를 pdf.js로 열기(같은 파일은 한 번만 엶). 다 쓰면 PT.pdfClose(file)
  const opened = new WeakMap();
  PT.pdfOpen = (file) => {
    if (opened.has(file)) return opened.get(file).promise;
    const entry = {};
    opened.set(file, entry);
    entry.promise = (async () => {
      const L = await PT.pdfjs(), base = PT.pdfjsBase();
      const data = new Uint8Array(await PT.readBuf(file));
      entry.task = L.getDocument({ data, isEvalSupported: false, enableXfa: false, useSystemFonts: true, cMapUrl: base + "cmaps/", cMapPacked: true, wasmUrl: base + "wasm/", iccUrl: base + "iccs/" });
      try { return await entry.task.promise; }
      catch (e) {
        throw new Error((e && e.name) === "PasswordException" ? `「${file.name}」은(는) 암호가 걸린 PDF라서 열 수 없어요. 원래 프로그램에서 암호를 풀고 다시 저장한 뒤 넣어 주세요.` : `「${file.name}」은(는) 깨졌거나 올바른 PDF가 아니어서 열 수 없어요.`);
      }
    })();
    entry.promise.catch(() => { if (opened.get(file) === entry) opened.delete(file); if (entry.task) entry.task.destroy().catch(() => {}); });
    return entry.promise;
  };
  PT.pdfClose = async (file) => {
    const e = file && opened.get(file);
    if (!e) return;
    opened.delete(file);
    try { await e.promise; } catch (x) {}
    try { if (e.task) await e.task.destroy(); } catch (x) {}
  };
  // PDF 한 쪽을 폭 width(CSS px)의 캔버스로. src는 File 또는 PT.pdfOpen이 돌려준 문서. 받기(PDF→JPG)와 같은 그리기 호출을 씀
  PT.pdfThumb = async (src, n = 1, width = PT.PV_W) => {
    const doc = src && src.numPages ? src : await PT.pdfOpen(src);
    const page = await doc.getPage(n);
    const w1 = page.getViewport({ scale: 1 }).width;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const vp = page.getViewport({ scale: (width * dpr) / w1 });
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(vp.width)); c.height = Math.max(1, Math.round(vp.height));
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    try { await page.render({ canvas: c, canvasContext: ctx, viewport: vp }).promise; }
    finally { page.cleanup(); }
    return c;
  };

  // 화면 폭 760px 초과 = PC: 쪽 그림을 모두 자동으로. 휴대폰은 첫 쪽만 자동, 나머지는 「쪽 그림 모두 보기」
  PT.wide = () => matchMedia("(min-width: 761px)").matches;
  PT.PV_W = 120; // 쪽 그림 폭(px)
  PT.PV_HEAVY = 30 * 1048576; // 이보다 큰 파일은 휴대폰에서 첫 쪽도 단추를 눌러야 그림
  // 단계 표시(.tk-steps): 1 올리기 · 2 미리보기 · 3 받기
  PT.flow = (box, n) => {
    box.querySelectorAll(".tk-steps li").forEach((li, i) => {
      li.classList.toggle("is-done", i + 1 < n);
      if (i + 1 === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
  };
  // 미리보기 띠(.pv). set(items)로 결과 쪽 목록을 넣으면 번호 칸(쪽수·순서)을 바로 만들고, 그림은 화면에 보이는 칸만 하나씩 그린다.
  // items: [{ key, w, h(쪽 비율), label, note, draw(width) → Promise<canvas> }]. 같은 key 그림은 다시 그리지 않음(설정만 바뀐 경우)
  // 파일이 여럿인 결과(합치기·나누기): g(파일 번호, 칸 바탕 번갈아), start(파일 첫 쪽 = 경계선), head(첫 쪽 위 파일 이름표)
  PT.preview = (box) => {
    const el = box.querySelector(".pv");
    if (!el) return null;
    const strip = el.querySelector(".pv-strip"), sumEl = el.querySelector(".pv-sum"), allBtn = el.querySelector(".pv-all");
    const cache = new Map(); // key → 그림 주소(JPEG 객체 URL)
    let list = [], gen = 0, all = false, heavy = false, io = null, queue = Promise.resolve();
    const fit = (w, h) => {
      const W = PT.PV_W, H = Math.round(PT.PV_W * 1.5);
      let tw = W, th = Math.round((W * h) / w);
      if (!(th > 0)) th = Math.round(W * 1.414);
      if (th > H) { th = H; tw = Math.max(24, Math.round((H * w) / h)); }
      return { tw, th };
    };
    const allowed = (i) => PT.wide() || all || (i === 0 && !heavy);
    const showImg = (li, url) => {
      const paper = li.querySelector(".pv-paper");
      const img = new Image();
      img.alt = ""; img.decoding = "async";
      img.onload = () => { // 실제 그림 비율로 칸을 맞춤(쪽마다 크기가 다른 PDF)
        const f = fit(img.naturalWidth, img.naturalHeight);
        paper.style.width = f.tw + "px"; paper.style.height = f.th + "px";
      };
      img.src = url;
      paper.replaceChildren(img);
      li.classList.add("is-drawn");
    };
    const drawOne = (li) => {
      const i = Number(li.dataset.i), it = list[i], g = gen;
      if (!it || li.classList.contains("is-drawn") || li.classList.contains("is-wait")) return;
      if (cache.has(it.key)) { showImg(li, cache.get(it.key)); return; }
      li.classList.add("is-wait");
      queue = queue.then(async () => {
        if (g !== gen) return;
        try {
          const c = await it.draw(fit(it.w, it.h).tw);
          const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
          c.width = c.height = 0;
          if (!blob) throw new Error("thumb");
          const url = URL.createObjectURL(blob);
          cache.set(it.key, url);
          if (g === gen && li.isConnected) showImg(li, url);
        } catch (e) {
          if (g === gen) li.querySelector(".pv-paper").textContent = "그림 없음";
        } finally { li.classList.remove("is-wait"); }
      });
    };
    const watch = () => {
      if (io) io.disconnect();
      const lis = [...strip.children];
      if (!("IntersectionObserver" in window)) { lis.forEach((li, i) => allowed(i) && drawOne(li)); return; }
      io = new IntersectionObserver((ents) => {
        for (const e of ents) if (e.isIntersecting && allowed(Number(e.target.dataset.i))) drawOne(e.target);
      }, { root: strip, rootMargin: "0px 240px" });
      lis.forEach((li) => io.observe(li));
    };
    const syncBtn = () => {
      const off = all || PT.wide() || (list.length < 2 && !heavy);
      allBtn.hidden = off;
      if (!off) allBtn.textContent = list.length > 1 ? `쪽 그림 모두 보기 (${list.length}쪽)` : "쪽 그림 보기";
    };
    allBtn.addEventListener("click", () => { all = true; syncBtn(); watch(); });
    matchMedia("(min-width: 761px)").addEventListener("change", () => { if (list.length) { syncBtn(); watch(); } });
    return {
      set(items, { sum = "", big = false } = {}) {
        gen++; list = items; heavy = big;
        strip.innerHTML = items.map((it, i) => {
          const f = fit(it.w, it.h);
          const cls = (it.g != null ? (it.g % 2 ? " pv-gb" : " pv-ga") : "") + (it.start ? " pv-start" : "");
          return `<li data-i="${i}"${cls ? ` class="${cls.trim()}"` : ""}>${it.head ? `<span class="pv-head" title="${esc(it.head)}">${esc(it.head)}</span>` : ""}<span class="pv-paper" style="width:${f.tw}px;height:${f.th}px"></span><span class="pv-no">${esc(it.label || i + 1 + "쪽")}</span>${it.note != null ? `<small class="pv-note">${esc(it.note)}</small>` : ""}</li>`;
        }).join("");
        strip.hidden = !items.length;
        sumEl.textContent = sum;
        el.hidden = !items.length && !sum;
        PT.flow(box, el.hidden ? 1 : 2);
        syncBtn(); watch();
      },
      sum(text) { sumEl.textContent = text; },
      note(i, text) { const n = strip.children[i] && strip.children[i].querySelector(".pv-note"); if (n) n.textContent = text; },
      clear() {
        gen++; list = []; all = false; heavy = false;
        if (io) io.disconnect();
        strip.textContent = ""; sumEl.textContent = "";
        cache.forEach((u) => URL.revokeObjectURL(u)); cache.clear();
        el.hidden = true; allBtn.hidden = true;
        PT.flow(box, 1);
      },
      get open() { return !el.hidden; },
    };
  };
})();
