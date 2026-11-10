// P2-64 한글 파일 뷰어 · 한글 PDF 변환, P2-65 워드 PDF 변환, P2-64c 뷰어 화면(세 페이지 공통). 의존: tool-kit.js, hwp-doc.js(+docx-doc.js), hwp-render.js
// 흐름: 파일 넣기(여러 개) → HwpDoc.open(형식별 해석기 → 공통 모델) → HwpRender.render(쪽 나누기) → 뷰어(도구 막대·쪽 미리보기·A4 쪽) → 인쇄의 「PDF로 저장」
(function () {
  const box = document.querySelector('[data-tool="hwpview"],[data-tool="hwp2pdf"],[data-tool="docx2pdf"]');
  const hv = document.getElementById("hwpv");
  if (!box || !hv || !window.HwpDoc || !window.HwpRender) return;
  const $ = (s) => hv.querySelector(s);
  const $$ = (s) => [...hv.querySelectorAll(s)];
  const app = $(".hv-app"), empty = $(".hv-empty"), bar = $(".hv-bar"), work = $(".hv-work"), stage = $(".hv-pages");
  const side = $(".hv-side"), thumbs = $(".hv-thumbs"), info = $(".hv-info"), menu = $(".hv-menu");
  const pn = $(".hv-pn"), ptot = $(".hv-pt"), nameEl = $(".hv-name"), zsel = $(".hv-zsel"), file2 = $(".hv-file2");
  const help = box.querySelector(".hwpv-help"), hint = box.querySelector(".hv-hint"), next = box.querySelector(".tk-next");
  const HWP_MSG = "HWP(구형 바이너리) 지원을 준비 중이에요. 한글에서 '다른 이름으로 저장 → HWPX'로 저장하거나, 한컴 공식 뷰어를 이용해 주세요.";
  const DOC_MSG = "예전 워드 형식(.doc)은 지원하지 않아요. 워드에서 「다른 이름으로 저장 → Word 문서(*.docx)」로 저장한 뒤 넣어 주세요.";
  const isDocx = box.dataset.tool === "docx2pdf";
  const OPT = isDocx ? {
    exts: ["docx"], maxSize: 50 * PT.MB, maxCount: 10,
    reject: {
      doc: DOC_MSG, dot: DOC_MSG, docm: "매크로가 든 문서(.docm)는 지원하지 않아요. docx로 저장한 뒤 넣어 주세요.", rtf: "RTF 문서는 지원하지 않아요. 워드에서 docx로 저장한 뒤 넣어 주세요.", odt: "ODT 문서는 지원하지 않아요. docx로 저장한 뒤 넣어 주세요.",
      hwp: "한글 문서는 「한글 PDF 변환」을 이용해 주세요.", hwpx: "한글 문서는 「한글 PDF 변환」을 이용해 주세요.",
      pdf: "이미 PDF 파일이에요. PDF 합치기나 나누기를 이용해 보세요.",
    },
  } : {
    exts: ["hwpx"], maxSize: 50 * PT.MB, maxCount: 10,
    reject: {
      hwp: HWP_MSG, hwt: HWP_MSG, hml: "HML(한글 XML) 문서는 지원하지 않아요. 한글에서 HWPX로 저장한 뒤 넣어 주세요.",
      docx: "워드 문서는 「워드 PDF 변환」을 이용해 주세요.", doc: "워드 문서는 지원하지 않아요.",
      pdf: "이미 PDF 파일이에요. PDF 합치기나 나누기를 이용해 보세요.",
    },
  };
  const why = (e, name) => {
    const code = e && e.code;
    if (code === "hwp") return `「${name}」은(는) HWP(구형) 형식이에요. ${HWP_MSG}`;
    if (code === "doc") return `「${name}」은(는) 예전 워드 형식(.doc)이에요. ${DOC_MSG}`;
    if (isDocx) {
      if (code === "encrypted") return `「${name}」은(는) 암호가 걸린 문서라서 열 수 없어요. 워드에서 암호를 해제하고 다시 저장한 뒤 넣어 주세요.`;
      if (code === "notdoc" || code === "hwp") return `「${name}」은(는) 워드(DOCX) 문서가 아니거나 내용이 없어요.`;
      return `「${name}」을(를) 열지 못했어요. 파일이 깨졌거나 아직 지원하지 않는 구성일 수 있어요. 워드에서 「PDF로 저장」을 이용해 주세요.`;
    }
    if (code === "encrypted") return `「${name}」은(는) 암호가 걸렸거나 배포용으로 보호된 문서라서 열 수 없어요. 한컴 공식 뷰어를 이용해 주세요.`;
    if (code === "notdoc") return `「${name}」은(는) 한글(HWPX) 문서가 아니거나 내용이 없어요.`;
    return `「${name}」을(를) 열지 못했어요. 파일이 깨졌거나 아직 지원하지 않는 구성일 수 있어요. 한컴 공식 뷰어를 이용해 주세요.`;
  };

  let docs = []; // { name, base, doc, pages, print }
  let cur = -1, page = 0;
  let zoom = { mode: "width", z: 1 };
  const narrow = () => matchMedia("(max-width:760px)").matches;
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pages = () => (cur >= 0 ? docs[cur].sheets : []); // 화면의 쪽 자리(배율만큼 크기를 잡은 틀)
  const papers = () => (cur >= 0 ? docs[cur].pages : []); // 실제 종이(배율 1로 배치, 화면에서는 transform으로만 줄이고 키움 → 쪽 나눔이 배율과 무관)
  const hdr = document.querySelector(".site-header");
  const setHdr = () => hv.style.setProperty("--hdr", (hdr && getComputedStyle(hdr).position === "sticky" ? hdr.offsetHeight : 0) + "px"); // 고정 머리글 높이만큼 뷰어 높이를 줄임

  // ---------- 배율 ----------
  const PAD = () => (narrow() ? 8 : 20);
  const baseSize = () => { // 배율 1에서 가장 넓은 쪽 크기(px)
    let w = 0, h = 0;
    for (const p of papers()) { w = Math.max(w, parseFloat(p.style.width) * 4 / 3); h = Math.max(h, parseFloat(p.style.height) * 4 / 3); }
    return { w: w || 794, h: h || 1123 };
  };
  const zFor = (mode) => {
    const b = baseSize();
    const fw = (work.clientWidth - PAD() * 2 - 2) / b.w; // 2px: 반올림으로 가로 스크롤이 생기지 않게
    if (mode === "width") return fw;
    if (mode === "page") return Math.min(fw, (work.clientHeight - PAD() * 2 - 2) / b.h);
    return mode;
  };
  const clampZ = (z) => Math.max(0.25, Math.min(4, z));
  function applyZoom(mode, keep = true) {
    const anchor = keep ? anchorNow() : null;
    zoom = { mode: typeof mode === "number" ? "num" : mode, z: clampZ(typeof mode === "number" ? mode : zFor(mode)) };
    stage.style.setProperty("--z", zoom.z.toFixed(4));
    const pct = Math.round(zoom.z * 100) + "%";
    if (zsel) {
      const preset = zoom.mode === "num" && [...zsel.options].find((o) => o.value === String(Math.round(zoom.z * 100)));
      if (zoom.mode === "width" || zoom.mode === "page") zsel.value = zoom.mode;
      else if (preset) zsel.value = preset.value;
      else { const c = zsel.querySelector('option[value="custom"]'); c.textContent = pct; zsel.value = "custom"; }
      zsel.title = `배율 ${pct}`;
    }
    $$(".hv-zlabel").forEach((x) => { x.textContent = pct; });
    thumbsScale();
    if (anchor) restoreAnchor(anchor);
  }
  const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
  const zoomStep = (dir) => {
    const z = zoom.z;
    const nz = dir > 0 ? STEPS.find((s) => s > z + 0.005) || 4 : [...STEPS].reverse().find((s) => s < z - 0.005) || 0.25;
    applyZoom(nz);
  };
  // 배율을 바꿔도 보던 곳이 그대로 보이게: 지금 쪽과 쪽 안의 위치(비율)를 기억
  function anchorNow() {
    const ps = pages();
    if (!ps.length || app.hidden) return null;
    const p = ps[page], wr = work.getBoundingClientRect(), r = p.getBoundingClientRect();
    return { i: page, f: r.height ? (wr.top - r.top) / r.height : 0 };
  }
  function restoreAnchor(a) {
    const p = pages()[a.i];
    if (!p) return;
    const wr = work.getBoundingClientRect(), r = p.getBoundingClientRect();
    work.scrollTop += r.top - wr.top + a.f * r.height;
  }

  // ---------- 쪽 이동 ----------
  function go(i, smooth) {
    const ps = pages();
    if (!ps.length) return;
    i = Math.max(0, Math.min(ps.length - 1, i));
    const wr = work.getBoundingClientRect(), r = ps[i].getBoundingClientRect();
    work.scrollTo({ top: work.scrollTop + r.top - wr.top - PAD(), behavior: smooth && !reduce() ? "smooth" : "auto" });
    setPage(i);
  }
  function setPage(i) {
    page = i;
    if (document.activeElement !== pn) pn.value = String(i + 1);
    $$('[data-act="prev"]').forEach((b) => { b.disabled = i <= 0; });
    $$('[data-act="next"]').forEach((b) => { b.disabled = i >= pages().length - 1; });
    const on = thumbs.querySelector('[aria-current="page"]');
    if (on) on.removeAttribute("aria-current");
    const t = thumbs.children[i] && thumbs.children[i].firstElementChild;
    if (t) {
      t.setAttribute("aria-current", "page");
      if (!side.hidden && getComputedStyle(side).display !== "none") { // 미리보기 패널 안에서만 스크롤(창은 움직이지 않음)
        const sr = side.getBoundingClientRect(), tr = t.getBoundingClientRect();
        if (tr.top < sr.top || tr.bottom > sr.bottom) side.scrollTop += tr.top - sr.top - (sr.height - tr.height) / 2;
      }
    }
  }
  // 스크롤하면 작업 영역 위쪽 1/3 선에 걸친 쪽이 현재 쪽
  let raf = 0;
  work.addEventListener("scroll", () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const ps = pages();
      if (!ps.length) return;
      const wr = work.getBoundingClientRect(), line = wr.top + Math.min(wr.height / 3, 240);
      let lo = 0, hi = ps.length - 1;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ps[m].getBoundingClientRect().top <= line) lo = m; else hi = m - 1; }
      if (work.scrollTop + work.clientHeight >= work.scrollHeight - 2) lo = ps.length - 1; // 맨 아래면 마지막 쪽
      if (lo !== page) setPage(lo);
    });
  }, { passive: true });
  pn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); jump(); } });
  pn.addEventListener("change", jump);
  pn.addEventListener("focus", () => pn.select());
  function jump() {
    const n = parseInt(pn.value.replace(/[^0-9]/g, ""), 10);
    if (n >= 1) go(n - 1); else pn.value = String(page + 1);
  }

  // ---------- 쪽 미리보기(썸네일): 보일 때만 쪽을 복제해 작게 그림 ----------
  const TW = 112;
  let io = null;
  function buildThumbs() {
    if (io) io.disconnect();
    thumbs.textContent = "";
    const b = baseSize();
    papers().forEach((p, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "hv-th"; btn.dataset.i = i;
      btn.setAttribute("aria-label", `${i + 1}쪽으로 이동`);
      const paper = document.createElement("span");
      paper.className = "hv-th-paper";
      const w = parseFloat(p.style.width) * 4 / 3, h = parseFloat(p.style.height) * 4 / 3;
      const s = TW / b.w;
      paper.style.width = Math.round(w * s) + "px"; paper.style.height = Math.round(h * s) + "px";
      paper.dataset.s = s;
      const no = document.createElement("span"); no.className = "hv-th-no"; no.textContent = i + 1;
      btn.append(paper, no); li.appendChild(btn); thumbs.appendChild(li);
    });
    io = "IntersectionObserver" in window ? new IntersectionObserver((ents) => {
      for (const e of ents) {
        if (!e.isIntersecting) continue;
        const paper = e.target, i = Number(paper.parentElement.dataset.i), p = papers()[i];
        io.unobserve(paper);
        if (!p || paper.firstChild) continue;
        const c = p.cloneNode(true);
        c.removeAttribute("role"); c.removeAttribute("aria-label"); c.removeAttribute("data-n");
        c.setAttribute("aria-hidden", "true"); c.inert = true;
        c.style.transform = `scale(${paper.dataset.s})`;
        paper.appendChild(c);
      }
    }, { root: side, rootMargin: "300px 0px" }) : null;
    if (io) thumbs.querySelectorAll(".hv-th-paper").forEach((x) => io.observe(x));
  }
  function thumbsScale() { /* 썸네일 크기는 배율과 무관(고정 폭) */ }
  thumbs.addEventListener("click", (e) => { const b = e.target.closest(".hv-th"); if (b) go(Number(b.dataset.i)); });

  // ---------- 문서 열기·바꾸기 ----------
  function setNames() {
    const d = docs[cur];
    nameEl.textContent = d.name; nameEl.title = d.name;
    $$(".hv-files").forEach((sel) => {
      sel.hidden = docs.length < 2;
      if (sel.options.length !== docs.length) {
        sel.textContent = "";
        docs.forEach((x, i) => { const o = document.createElement("option"); o.value = i; o.textContent = x.name; sel.appendChild(o); });
      }
      sel.value = String(cur);
    });
    nameEl.hidden = docs.length > 1 && !narrow();
  }
  async function show(i) {
    cur = i;
    const d = docs[i];
    closePanels();
    if (!d.pages) {
      PT.busy(box, true, "쪽을 나누는 중…");
      await PT.tick();
      try { const r = await HwpRender.render(d.doc, null); d.pages = r.pages; d.print = r.print; }
      finally { PT.busy(box, false); }
    }
    if (!d.sheets) {
      d.sheets = d.pages.map((p) => {
        const sh = document.createElement("div");
        sh.className = "hv-sheet";
        sh.style.setProperty("--sw", (parseFloat(p.style.width) * 4 / 3).toFixed(2) + "px");
        sh.style.setProperty("--sh", (parseFloat(p.style.height) * 4 / 3).toFixed(2) + "px");
        sh.appendChild(p);
        return sh;
      });
    }
    stage.replaceChildren(...d.sheets);
    hv.dataset.state = "open";
    setHdr();
    empty.hidden = true; app.hidden = false; hint.hidden = false;
    if (next) next.hidden = false;
    setNames();
    ptot.textContent = `/ ${d.pages.length}`;
    pn.style.width = Math.max(2, String(d.pages.length).length) + 1 + "ch";
    const dot = Object.keys(d.doc.skipped).length > 0;
    $$(".hv-info-btn").forEach((b) => b.classList.toggle("has-dot", dot));
    d.sheets.forEach((sh, k) => { const p = d.pages[k]; if (p.classList.contains("is-over")) sh.style.setProperty("--sh", p.offsetHeight + "px"); }); // 넘친 쪽은 실제 높이
    buildThumbs();
    // 기본 배율: 휴대폰은 폭 맞춤, 넓은 화면은 100%를 넘지 않는 폭 맞춤
    applyZoom(narrow() ? "width" : Math.min(1, zFor("width")) < 1 ? "width" : 1, false);
    work.scrollTop = 0; work.scrollLeft = 0;
    setPage(0);
    fillInfo();
  }
  function clear() {
    docs.forEach((d) => HwpDoc.free(d.doc));
    docs = []; cur = -1;
    stage.textContent = ""; thumbs.textContent = "";
    if (io) io.disconnect();
    closePanels();
  }
  function toEmpty() {
    hv.dataset.state = "empty";
    app.hidden = true; empty.hidden = false; hint.hidden = true;
  }

  async function openFiles(files) {
    if (box.classList.contains("is-busy")) return;
    const { ok, errs } = PT.check(files, OPT);
    PT.hideResult(box);
    if (!ok.length) { PT.msg(box, errs.join(" ")); help.hidden = !errs.length; return; } // 열린 문서는 그대로 둠
    clear();
    PT.busy(box, true, "문서를 여는 중…");
    try {
      for (let i = 0; i < ok.length; i++) {
        const f = ok[i];
        PT.step(box, `문서를 여는 중… (${i + 1}/${ok.length}) ${f.name}`, i / ok.length);
        await PT.tick();
        try {
          const doc = await HwpDoc.open(await PT.readBuf(f), f.name);
          docs.push({ name: f.name, base: PT.base(f.name), doc });
        } catch (e) { errs.push(why(e, f.name)); }
      }
    } finally { PT.busy(box, false); }
    PT.msg(box, errs.join(" "));
    help.hidden = !errs.length;
    if (!docs.length) { toEmpty(); return; }
    await show(0);
    const top = app.getBoundingClientRect().top;
    if (top < 0 || top > innerHeight * 0.4) app.scrollIntoView({ block: "start", behavior: reduce() ? "auto" : "smooth" });
  }
  PT.dropzone(box, openFiles);
  file2.addEventListener("change", () => { const l = [...file2.files]; file2.value = ""; if (l.length) openFiles(l); });
  // 열린 뷰어 위로 끌어다 놓아도 열림
  ["dragenter", "dragover"].forEach((t) => app.addEventListener(t, (e) => { e.preventDefault(); app.classList.add("over"); }));
  ["dragleave", "drop"].forEach((t) => app.addEventListener(t, (e) => { if (t === "dragleave" && app.contains(e.relatedTarget)) return; app.classList.remove("over"); }));
  app.addEventListener("drop", (e) => { e.preventDefault(); const l = e.dataTransfer && e.dataTransfer.files; if (l && l.length) openFiles([...l]); });
  $$(".hv-files").forEach((sel) => sel.addEventListener("change", () => { const i = Number(sel.value); if (i !== cur) show(i); }));
  if (zsel) zsel.addEventListener("change", () => { const v = zsel.value; if (v !== "custom") applyZoom(v === "width" || v === "page" ? v : Number(v) / 100); });

  // ---------- 문서 정보(ⓘ) ----------
  function fillInfo() {
    const d = docs[cur], st = d.doc.stats, sk = Object.entries(d.doc.skipped);
    const body = info.querySelector(".hv-info-body");
    body.innerHTML = `<h3>문서 정보</h3><dl>
<dt>파일</dt><dd>${PT.esc(d.name)}</dd><dt>형식</dt><dd>${PT.esc(d.doc.format)}</dd>
<dt>쪽 수</dt><dd>${d.pages.length}쪽 (이 화면 기준)</dd><dt>표</dt><dd>${st.tables}개</dd><dt>그림</dt><dd>${st.images}개</dd><dt>문단</dt><dd>${st.paras}개</dd>
<dt>표시하지 못한 요소</dt><dd>${sk.length ? sk.map(([k, n]) => `${PT.esc(k)} ${n}`).join(", ") : "없음"}</dd></dl>
<p class="hv-info-note"><b>원본과 모양이 다를 수 있어요.</b> 줄 바꿈·쪽 나눔·글꼴은 ${isDocx ? "워드와" : "한글 프로그램과"} 다를 수 있어요. 파일은 서버로 보내지 않고 이 브라우저 안에서만 열었어요.</p>`;
  }
  function closePanels(except) {
    if (except !== "info") { info.hidden = true; $$('[data-act="info"]').forEach((b) => b.setAttribute("aria-expanded", "false")); }
    if (except !== "menu") { menu.hidden = true; $$('[data-act="more"]').forEach((b) => b.setAttribute("aria-expanded", "false")); }
  }
  const toggle = (el, name, btns) => {
    const open = el.hidden;
    closePanels(name);
    el.hidden = !open;
    $$(btns).forEach((b) => b.setAttribute("aria-expanded", String(open)));
  };
  document.addEventListener("click", (e) => { // 바깥을 누르면 패널 닫기
    if (info.hidden && menu.hidden) return;
    if (e.target.closest(".hv-info,.hv-menu,[data-act='info'],[data-act='more']")) return;
    closePanels();
  });

  // ---------- 전체 화면 ----------
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  function setFullUi(on) {
    app.classList.toggle("is-full", on);
    $$('[data-act="full"]').forEach((b) => { b.setAttribute("aria-pressed", String(on)); b.title = on ? "전체 화면 끝내기 (Esc)" : "전체 화면"; });
    requestAnimationFrame(() => { if (zoom.mode !== "num") applyZoom(zoom.mode); });
  }
  function toggleFull() {
    if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (app.classList.contains("is-max")) { app.classList.remove("is-max"); document.documentElement.classList.remove("hv-lock"); setFullUi(false); return; }
    const req = app.requestFullscreen || app.webkitRequestFullscreen;
    if (req) { const r = req.call(app); if (r && r.catch) r.catch(() => maxFallback()); }
    else maxFallback();
  }
  function maxFallback() { app.classList.add("is-max"); document.documentElement.classList.add("hv-lock"); setFullUi(true); }
  ["fullscreenchange", "webkitfullscreenchange"].forEach((t) => document.addEventListener(t, () => setFullUi(fsEl() === app)));

  // ---------- 도구 막대 단추 ----------
  hv.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b || cur < 0) return;
    const a = b.dataset.act;
    if (!/^(more|info|zin|zout|zwidth|zpage)$/.test(a) && b.closest(".hv-menu")) closePanels(); // 배율 단추는 여러 번 누를 수 있게 더보기를 열어 둠
    switch (a) {
      case "prev": go(page - 1); break;
      case "next": go(page + 1); break;
      case "zin": zoomStep(1); break;
      case "zout": zoomStep(-1); break;
      case "zwidth": applyZoom("width"); break;
      case "zpage": applyZoom("page"); break;
      case "print": printDoc(); break;
      case "open": file2.click(); break;
      case "full": toggleFull(); break;
      case "info": toggle(info, "info", '[data-act="info"]'); break;
      case "more": toggle(menu, "menu", '[data-act="more"]'); break;
      case "side": {
        const on = app.classList.toggle("no-side");
        b.setAttribute("aria-pressed", String(!on));
        if (zoom.mode !== "num") applyZoom(zoom.mode);
        break;
      }
    }
  });

  // ---------- 단축키 ----------
  const inView = () => { const r = app.getBoundingClientRect(); return !app.hidden && r.bottom > innerHeight * 0.3 && r.top < innerHeight * 0.7; };
  document.addEventListener("keydown", (e) => {
    if (cur < 0 || app.hidden) return;
    const k = e.key, mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && (k === "p" || k === "P")) { e.preventDefault(); printDoc(); return; }
    if (k === "Escape") { if (!info.hidden || !menu.hidden) { closePanels(); return; } if (app.classList.contains("is-max")) { toggleFull(); return; } }
    if (!inView() && !app.contains(document.activeElement)) return;
    if (mod && !e.altKey) {
      if (k === "+" || k === "=" ) zoomStep(1);
      else if (k === "-" || k === "_") zoomStep(-1);
      else if (k === "0") applyZoom("width");
      else return;
      e.preventDefault();
      return;
    }
    const t = e.target, field = t && (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable);
    if (field || e.altKey || mod || e.shiftKey) return;
    if (k === "ArrowRight" || k === "PageDown") { e.preventDefault(); go(page + 1); }
    else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); go(page - 1); }
    else if ((k === "Home" || k === "End") && app.contains(t)) { e.preventDefault(); go(k === "Home" ? 0 : pages().length - 1); }
  });
  // Ctrl+휠 = 확대·축소(작업 영역 안에서만)
  work.addEventListener("wheel", (e) => {
    if (!(e.ctrlKey || e.metaKey) || cur < 0) return;
    e.preventDefault();
    zoomStep(e.deltaY < 0 ? 1 : -1);
  }, { passive: false });

  // ---------- 손가락 확대(두 손가락) ----------
  let pinch = null;
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  work.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 2 || cur < 0) return;
    const wr = work.getBoundingClientRect();
    const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - wr.left, my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - wr.top;
    pinch = { d0: dist(e.touches), z0: zoom.z, mx, my, cx: work.scrollLeft + mx, cy: work.scrollTop + my, f: 1 };
    stage.style.transformOrigin = `${pinch.cx}px ${pinch.cy}px`;
  }, { passive: true });
  work.addEventListener("touchmove", (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    pinch.f = clampZ(pinch.z0 * dist(e.touches) / pinch.d0) / pinch.z0;
    stage.style.transform = `scale(${pinch.f.toFixed(4)})`;
  }, { passive: false });
  const endPinch = () => {
    if (!pinch) return;
    const p = pinch; pinch = null;
    stage.style.transform = ""; stage.style.transformOrigin = "";
    if (Math.abs(p.f - 1) < 0.02) return;
    applyZoom(p.z0 * p.f, false);
    const r = (p.z0 * p.f) / p.z0;
    work.scrollLeft = p.cx * r - p.mx;
    work.scrollTop = p.cy * r - p.my;
  };
  work.addEventListener("touchend", (e) => { if (e.touches.length < 2) endPinch(); });
  work.addEventListener("touchcancel", endPinch);

  let rt = 0;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (cur >= 0 && !app.hidden) { setHdr(); setNames(); if (zoom.mode !== "num") applyZoom(zoom.mode); } }, 120); });

  // ---------- PDF 저장 = 인쇄 창. @page(A4, 여백 0)를 넣고, 화면의 쪽 = 인쇄의 쪽. 끝나면 되돌림 ----------
  function printDoc() {
    if (cur < 0) return;
    const d = docs[cur];
    closePanels();
    const old = document.title;
    document.title = d.base;
    const css = document.createElement("style");
    css.textContent = d.print;
    document.head.appendChild(css);
    document.documentElement.classList.add("print-doc", "print-hwp");
    let done = false;
    const end = () => { if (done) return; done = true; document.documentElement.classList.remove("print-doc", "print-hwp"); css.remove(); document.title = old; removeEventListener("afterprint", end); };
    addEventListener("afterprint", end);
    window.print();
    setTimeout(() => { if (!matchMedia("print").matches) end(); }, 1000);
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-print]")) printDoc(); });
})();
