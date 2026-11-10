// P2-64 한글 파일 뷰어 · 한글 PDF 변환, P2-65 워드 PDF 변환 화면(세 페이지 공통). 의존: tool-kit.js, hwp-doc.js(+docx-doc.js), hwp-render.js
// 흐름: 파일 넣기(여러 개) → HwpDoc.open(형식별 해석기 → 공통 모델) → HwpRender.render → 파일 이름 단추로 전환 → 인쇄의 「PDF로 저장」
(function () {
  const box = document.querySelector('[data-tool="hwpview"],[data-tool="hwp2pdf"],[data-tool="docx2pdf"]');
  const view = document.getElementById("hwpv");
  if (!box || !view || !window.HwpDoc || !window.HwpRender) return;
  const tabs = view.querySelector(".hwpv-tabs");
  const stage = view.querySelector(".hwpv-stage");
  const help = box.querySelector(".hwpv-help");
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

  let docs = []; // { name, base, doc, print }
  let cur = -1;
  const skipText = (sk) => Object.entries(sk).map(([k, n]) => `${k} ${n}`).join(", ");

  function show(i) {
    cur = i;
    const d = docs[i];
    const r = HwpRender.render(d.doc, stage);
    d.print = r.print;
    tabs.querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-pressed", String(j === i)));
    view.hidden = false;
    HwpRender.fit(stage);
    const st = d.doc.stats, sk = skipText(d.doc.skipped);
    PT.showResult(box, `<p class="tk-done"><b>문서를 열었어요.</b> ${PT.esc(d.name)} · 표 ${st.tables}개 · 그림 ${st.images}개 · 문단 ${st.paras}개</p>
${sk ? `<p class="hint">지금 표시하지 못한 요소: ${PT.esc(sk)}</p>` : ""}
<p class="tk-warn" role="note"><b>원본과 모양이 다를 수 있어요.</b> 줄 바꿈·쪽 나눔·글꼴은 ${isDocx ? "워드" : "한글 프로그램"}과 다를 수 있으니 아래 미리보기를 확인하세요.</p>
<div class="tk-dl"><button type="button" class="btn big" data-print>PDF로 저장</button></div>
<p class="hint">인쇄 창이 열리면 대상(프린터)을 「PDF로 저장」 또는 「Microsoft Print to PDF」로 고르세요. 글자가 선택되는 PDF가 만들어져요. 휴대폰은 공유 → 인쇄에서 PDF로 저장할 수 있어요(기기마다 다름).</p>`);
  }

  function clear() {
    docs.forEach((d) => HwpDoc.free(d.doc));
    docs = []; cur = -1;
    tabs.textContent = ""; stage.textContent = "";
    view.hidden = true;
  }

  PT.dropzone(box, async (files) => {
    const { ok, errs } = PT.check(files, OPT);
    PT.hideResult(box);
    clear();
    if (!ok.length) { PT.msg(box, errs.join(" ")); help.hidden = !errs.length; return; }
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
    if (!docs.length) return;
    docs.forEach((d, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip hwpv-tab"; b.textContent = d.name; b.dataset.i = i;
      b.setAttribute("aria-pressed", "false");
      tabs.appendChild(b);
    });
    show(0);
  });

  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]");
    if (b && Number(b.dataset.i) !== cur) show(Number(b.dataset.i));
  });

  let t = 0;
  addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => { if (!view.hidden) HwpRender.fit(stage); }, 120); });

  // PDF 저장 = 인쇄 창. 문서 쪽 크기·여백을 @page로 넣고, 인쇄가 끝나면 되돌림
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-print]") || cur < 0) return;
    const d = docs[cur];
    const old = document.title;
    document.title = d.base;
    const css = document.createElement("style");
    css.textContent = d.print;
    document.head.appendChild(css);
    document.documentElement.classList.add("print-doc", "print-hwp");
    const done = () => { document.documentElement.classList.remove("print-doc", "print-hwp"); css.remove(); document.title = old; removeEventListener("afterprint", done); HwpRender.fit(stage); };
    addEventListener("afterprint", done);
    window.print();
    setTimeout(() => { if (!matchMedia("print").matches) done(); }, 1000);
  });
})();
