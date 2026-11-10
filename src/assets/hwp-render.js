// P2-64 공통 문서 모델(hwp-doc.js) → 화면 DOM. 형식(HWPX·HWP)과 상관없이 같은 그리기 코드를 씁니다.
// 문서 글자는 모두 textContent로 넣습니다(innerHTML 안 씀). 색은 #rrggbb만, 그림은 blob 주소만 씁니다.
(function () {
  const R = (window.HwpRender = window.HwpRender || {});
  const pt = (hu) => Math.round(hu) / 100 + "pt"; // HWPUNIT → pt (1pt = 100 HWPUNIT)
  const mm = (hu) => (hu / 7200 * 25.4).toFixed(2) + "mm";
  const ALIGN = { LEFT: "left", RIGHT: "right", CENTER: "center", JUSTIFY: "justify", DISTRIBUTE: "justify", DISTRIBUTE_SPACE: "justify" };
  const BORDER = { NONE: "none", SOLID: "solid", DASH: "dashed", DOT: "dotted", DASH_DOT: "dashed", DASH_DOT_DOT: "dashed", LONG_DASH: "dashed", CIRCLE: "dotted", DOUBLE_SLIM: "double", SLIM_THICK: "double", THICK_SLIM: "double", SLIM_THICK_SLIM: "double", WAVE: "solid", DOUBLE_WAVE: "double" };
  const VA = { TOP: "top", CENTER: "middle", BOTTOM: "bottom" };
  const SANS = '"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  const SERIF = '"Batang","바탕","AppleMyungjo","Noto Serif KR",serif';
  const h = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const fontCss = (st) => {
    const face = String(st.font || "").replace(/["\\;{}<>]/g, "").trim();
    return (face ? `"${face}",` : "") + (st.serif ? SERIF : SANS);
  };

  function styleRun(el, st) {
    const s = el.style;
    s.fontSize = st.sz + "pt";
    if (st.color && st.color !== "#000000") s.color = st.color;
    if (st.b) s.fontWeight = "700";
    if (st.i) s.fontStyle = "italic";
    const dec = [st.u && "underline", st.s && "line-through"].filter(Boolean).join(" ");
    if (dec) s.textDecoration = dec;
    if (st.bg) s.backgroundColor = st.bg;
    if (st.sup || st.sub) { s.verticalAlign = st.sup ? "super" : "sub"; s.fontSize = st.sz * 0.7 + "pt"; }
    s.fontFamily = fontCss(st);
  }

  function lineHeight(p) {
    const lh = p.lh || {};
    if (lh.type === "PERCENT") return Math.max(0.8, Math.min(4, lh.v / 100)) * 1.0 + ""; // 한글 160% ≈ CSS 1.6
    if (lh.type === "FIXED" || lh.type === "AT_LEAST") return pt(lh.v);
    return "1.6";
  }

  function para(p, ctx) {
    const d = h("div", "hp");
    const s = d.style;
    s.textAlign = ALIGN[p.align] || "justify";
    // 한글의 내어쓰기(음수 들여쓰기)는 첫 줄은 왼쪽 여백에서, 둘째 줄부터 |indent|만큼 안쪽
    const ml = p.ml + (p.indent < 0 ? -p.indent : 0);
    if (ml) s.marginLeft = pt(ml);
    if (p.mr) s.marginRight = pt(p.mr);
    if (p.indent) s.textIndent = pt(p.indent);
    if (p.before) s.marginTop = pt(p.before);
    if (p.after) s.marginBottom = pt(p.after);
    s.lineHeight = lineHeight(p);
    if (p.brk) d.classList.add("hp-brk");
    const st = p.st || {};
    s.fontSize = (st.sz || 10) + "pt";
    s.fontFamily = fontCss(st);
    let hasText = false;
    for (const it of p.items) {
      const el = item(it, ctx);
      if (el) d.appendChild(el);
      if (it.k === "t" && it.s.trim()) hasText = true;
    }
    if (!p.items.length) d.appendChild(document.createTextNode("\u200b")); // 빈 줄도 한 줄 높이
    if (!hasText && p.items.some((x) => x.k === "tbl" || x.k === "img" || x.k === "box")) d.classList.add("hp-obj");
    return d;
  }

  function item(it, ctx) {
    switch (it.k) {
      case "t": { const sp = h("span"); sp.textContent = it.s; styleRun(sp, it.st); return sp; }
      case "tab": { const sp = h("span", "h-tab"); sp.textContent = "\t"; styleRun(sp, it.st); return sp; }
      case "br": return h("br");
      case "img": {
        const im = h("img", "h-img");
        im.src = it.src; im.alt = "문서 그림"; im.decoding = "async";
        if (it.w) im.style.width = pt(it.w);
        if (it.h) im.style.height = pt(it.h);
        return im;
      }
      case "tbl": return table(it, ctx);
      case "box": {
        const b = h("div", "h-box");
        if (it.w) b.style.width = pt(it.w);
        it.paras.forEach((p) => b.appendChild(para(p, ctx)));
        return b;
      }
      case "eq": { const sp = h("span", "h-eq"); sp.textContent = it.s || "수식"; sp.title = "수식(글자로 표시)"; return sp; }
      case "note": { const sp = h("sup", "h-note"); sp.textContent = `${it.n})`; return sp; }
      case "miss": { const sp = h("span", "h-miss"); sp.textContent = it.s; return sp; }
      default: return null;
    }
  }

  function side(b) {
    if (!b || BORDER[b.style] === "none" || !BORDER[b.style]) return "none";
    const w = parseFloat(b.width) || 0.12;
    return `${Math.max(w, 0.1)}mm ${BORDER[b.style]} ${b.color || "#000"}`;
  }

  function table(t, ctx) {
    const wrap = h("div", "h-tblw");
    if (t.align === "CENTER") wrap.classList.add("is-c");
    else if (t.align === "RIGHT") wrap.classList.add("is-r");
    const tb = h("table", "h-tbl");
    if (t.w) tb.style.width = pt(t.w);
    const body = h("tbody");
    for (const row of t.rows) {
      const tr = h("tr");
      for (const c of row) {
        const td = h("td");
        if (c.cs > 1) td.colSpan = c.cs;
        if (c.rs > 1) td.rowSpan = c.rs;
        const s = td.style;
        if (c.w) s.width = pt(c.w);
        if (c.h) s.height = pt(c.h);
        s.verticalAlign = VA[c.va] || "middle";
        s.padding = c.pad.map((v, i) => c.pad[[2, 1, 3, 0][i]]).map(pt).join(" "); // [l,r,t,b] → 위 오른쪽 아래 왼쪽
        if (c.bf) {
          s.borderLeft = side(c.bf.l); s.borderRight = side(c.bf.r); s.borderTop = side(c.bf.t); s.borderBottom = side(c.bf.b);
          if (c.bf.bg) s.backgroundColor = c.bf.bg;
        }
        c.paras.forEach((p) => td.appendChild(para(p, ctx)));
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
    tb.appendChild(body);
    wrap.appendChild(tb);
    return wrap;
  }

  // 문서 전체 → 구역(section)마다 종이 한 장. 반환: 종이 요소 목록과 인쇄용 @page 규칙
  R.render = (doc, into) => {
    into.textContent = "";
    const pages = [];
    doc.sections.forEach((sec, i) => {
      const pg = sec.page;
      const paper = h("div", "hwp-page");
      paper.setAttribute("role", "document");
      paper.setAttribute("aria-label", doc.sections.length > 1 ? `문서 ${i + 1}구역` : "문서");
      paper.style.width = pt(pg.w);
      paper.style.minHeight = pt(pg.h);
      paper.style.padding = `${pt(pg.mt)} ${pt(pg.mr)} ${pt(pg.mb)} ${pt(pg.ml)}`;
      const ctx = {};
      sec.paras.forEach((p) => paper.appendChild(para(p, ctx)));
      if (sec.notes.length) {
        const nb = h("div", "h-notes");
        sec.notes.forEach((n) => {
          const row = h("div", "h-note-row");
          const no = h("span", "h-note-no"); no.textContent = `${n.n})`;
          row.appendChild(no);
          n.paras.forEach((p) => row.appendChild(para(p, ctx)));
          nb.appendChild(row);
        });
        paper.appendChild(nb);
      }
      into.appendChild(paper);
      pages.push(paper);
    });
    const p0 = doc.sections[0].page;
    // 인쇄 용지는 A4(문서가 가로면 A4 가로), 여백은 문서 첫 구역 값
    const print = `@page{size:A4 ${p0.w > p0.h ? "landscape" : "portrait"};margin:${mm(p0.mt)} ${mm(p0.mr)} ${mm(p0.mb)} ${mm(p0.ml)}}`;
    return { pages, print };
  };

  // 화면 폭에 맞춰 종이를 줄여 보이기(인쇄 때는 CSS가 원래 크기로 되돌림)
  R.fit = (stage) => {
    const avail = stage.clientWidth;
    stage.querySelectorAll(".hwp-page").forEach((pg) => {
      pg.style.zoom = "";
      const w = pg.offsetWidth;
      pg.style.zoom = w > avail && avail > 0 ? (avail / w).toFixed(4) : "";
    });
  };
})();
