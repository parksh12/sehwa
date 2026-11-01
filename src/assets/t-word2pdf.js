// 워드 PDF 변환(간단, 베타): docx → mammoth로 HTML → 미리보기 → 인쇄의 「PDF로 저장」. 의존: vendor/mammoth.browser.min.js, tool-kit.js
(function () {
  const box = document.querySelector('[data-tool="word2pdf"]');
  if (!box || !window.mammoth) return;
  const OPT = {
    exts: ["docx"], maxSize: 20 * PT.MB, maxCount: 1,
    reject: {
      doc: "예전 워드 형식(.doc)은 지원하지 않아요. 워드에서 「다른 이름으로 저장 → Word 문서(*.docx)」로 바꾼 뒤 넣어 주세요.",
      hwp: "한글 문서(.hwp)는 지원하지 않아요. 한글 프로그램의 「PDF로 저장하기」를 이용해 주세요.",
      hwpx: "한글 문서(.hwpx)는 지원하지 않아요. 한글 프로그램의 「PDF로 저장하기」를 이용해 주세요.",
      rtf: "RTF 문서는 지원하지 않아요. 워드에서 docx로 저장한 뒤 넣어 주세요.",
      odt: "ODT 문서는 지원하지 않아요. docx로 저장한 뒤 넣어 주세요.",
      pdf: "이미 PDF 파일이에요. PDF 합치기나 나누기를 이용해 보세요.",
    },
  };
  const STYLE_MAP = [
    "p[style-name='Title'] => h1.doc-title:fresh",
    "p[style-name='Subtitle'] => p.doc-subtitle:fresh",
    "p[style-name='제목'] => h1.doc-title:fresh",
    "p[style-name='부제'] => p.doc-subtitle:fresh",
    "u => u",
    "p[style-name='Quote'] => blockquote > p:fresh",
    "p[style-name='Intense Quote'] => blockquote > p:fresh",
  ];
  const preview = document.getElementById("w2p-preview");
  const paper = preview.querySelector(".w2p-paper");
  let docName = "문서";

  // mammoth 결과는 글자를 이스케이프하지만, 링크 주소는 한 번 더 걸러 둡니다(javascript: 등 차단).
  function clean(html) {
    const t = document.createElement("template");
    t.innerHTML = html;
    t.content.querySelectorAll("script,style,iframe,object,embed").forEach((n) => n.remove());
    t.content.querySelectorAll("*").forEach((el) => {
      [...el.attributes].forEach((a) => { if (/^on/i.test(a.name)) el.removeAttribute(a.name); });
      if (el.tagName === "A") {
        const h = el.getAttribute("href") || "";
        if (!/^(https?:|mailto:|#)/i.test(h)) el.removeAttribute("href");
        else if (!h.startsWith("#")) { el.setAttribute("rel", "noopener noreferrer"); el.setAttribute("target", "_blank"); }
      }
      if (el.tagName === "IMG") {
        const s = el.getAttribute("src") || "";
        if (!/^data:image\//i.test(s)) el.removeAttribute("src");
        el.setAttribute("alt", el.getAttribute("alt") || "");
      }
    });
    return t.innerHTML;
  }

  PT.dropzone(box, async (files) => {
    const { ok, errs } = PT.check(files.slice(0, 1), OPT);
    PT.hideResult(box); preview.hidden = true; paper.innerHTML = "";
    PT.msg(box, errs.join(" "));
    if (!ok.length) return;
    const f = ok[0];
    PT.busy(box, true, "문서를 여는 중…");
    try {
      const buf = await PT.readBuf(f);
      const b = new Uint8Array(buf, 0, 4);
      if (!(b[0] === 0x50 && b[1] === 0x4b)) throw new Error(`「${f.name}」은(는) 올바른 docx 파일이 아니에요. 파일이 깨졌거나 확장자만 docx일 수 있어요.`);
      let res;
      try { res = await mammoth.convertToHtml({ arrayBuffer: buf }, { styleMap: STYLE_MAP }); }
      catch (e) { throw new Error(/encrypt|password/i.test(String(e && e.message)) ? `「${f.name}」은(는) 암호가 걸린 문서라 열 수 없어요.` : `「${f.name}」을(를) 열지 못했어요. 파일이 깨졌거나 암호가 걸린 문서일 수 있어요.`); }
      const html = clean(res.value || "");
      if (!html.trim()) throw new Error(`「${f.name}」에서 옮길 수 있는 내용을 찾지 못했어요.`);
      docName = PT.base(f.name);
      paper.innerHTML = html;
      preview.hidden = false;
      const warn = (res.messages || []).filter((m) => m.type === "warning");
      const stats = { table: paper.querySelectorAll("table").length, img: paper.querySelectorAll("img").length, list: paper.querySelectorAll("ul,ol").length };
      PT.showResult(box, `<p class="tk-done"><b>미리보기를 만들었어요.</b> ${PT.esc(f.name)} · 표 ${stats.table}개 · 그림 ${stats.img}개 · 목록 ${stats.list}개</p>
<p class="tk-warn" role="note"><b>꼭 확인하세요.</b> 표·머리글·각주·복잡한 서식은 깨질 수 있습니다. 아래 미리보기를 확인한 뒤 저장하세요.</p>
${warn.length ? `<p class="hint">옮기지 못한 서식 ${warn.length}건이 있어요(스타일·요소 이름 기준). 미리보기에서 빠진 부분이 없는지 확인해 주세요.</p>` : ""}
<div class="tk-dl"><button type="button" class="btn big" data-print>인쇄 → PDF로 저장</button></div>
<p class="hint">인쇄 창이 열리면 대상(프린터)을 「PDF로 저장」 또는 「Microsoft Print to PDF」로 고르세요. 휴대폰은 공유 → 인쇄에서 PDF로 저장할 수 있어요(기기마다 다름).</p>`);
      box.dataset.ready = "1";
    } catch (e) {
      PT.msg(box, e.message || String(e));
    } finally { PT.busy(box, false); }
  });

  box.addEventListener("click", (e) => {
    if (!e.target.closest("[data-print]")) return;
    const old = document.title;
    document.title = docName; // 인쇄 창의 기본 파일 이름
    document.documentElement.classList.add("print-doc");
    const done = () => { document.documentElement.classList.remove("print-doc"); document.title = old; removeEventListener("afterprint", done); };
    addEventListener("afterprint", done);
    window.print();
    setTimeout(() => { if (!matchMedia("print").matches) done(); }, 1000);
  });
})();
