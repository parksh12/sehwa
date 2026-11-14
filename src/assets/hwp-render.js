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
    if (p.label) { // 목록 번호·글머리표: 내어쓰기 폭만큼 자리를 잡아 둠
      const lb = h("span", "h-label");
      lb.textContent = p.label.s;
      styleRun(lb, p.label.st || st);
      if (p.indent < 0) lb.style.minWidth = pt(-p.indent);
      d.appendChild(lb);
      hasText = true;
    }
    for (const it of p.items) {
      const el = item(it, ctx);
      if (el) d.appendChild(el);
      if (it.k === "t" && it.s.trim()) hasText = true;
    }
    if (!p.items.length && !p.label) d.appendChild(document.createTextNode("\u200b")); // 빈 줄도 한 줄 높이
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
      case "pbr": return h("span", "h-pbr");
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
    if (t.cols) { // P2-64d 열 폭을 아는 표(HWP): 열 묶음 + 고정 배치(병합이 많은 서식 표의 열 어긋남 방지)
      const cg = h("colgroup");
      t.cols.forEach((w) => { const c = h("col"); c.style.width = pt(w); cg.appendChild(c); });
      tb.appendChild(cg);
      tb.style.tableLayout = "fixed";
    }
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


  // ---------- P2-64c 쪽 나누기: 구역 내용을 한 줄로 흘려 놓고 잰 뒤, 쪽 높이에 맞춰 A4 종이 여러 장으로 나눔 ----------
  // 화면 쪽 = 인쇄 쪽(인쇄는 @page 여백 0 + 종이 한 장 = 인쇄 한 쪽). 긴 표는 행 단위로, 긴 문단은 줄 단위로 나눔
  const PX = (hu) => hu / 100 * 4 / 3; // HWPUNIT → CSS px
  const A4 = { w: 59528, h: 84188 }; // 210×297mm (HWPUNIT)
  const OBJ = "img,table,.h-box,.h-eq";

  // 문단 안의 쪽 나눔(DOCX 줄 단위 나눔)은 미리 문단을 둘로 갈라 「쪽 나눔 앞」 표시
  function splitAtBreaks(flow) {
    for (const pb of [...flow.querySelectorAll(":scope > .hp > .h-pbr")]) {
      const p = pb.parentElement;
      const r = document.createRange();
      r.setStartAfter(pb);
      r.setEndAfter(p.lastChild);
      const frag = r.extractContents();
      pb.remove();
      const q = p.cloneNode(false);
      q.appendChild(frag);
      q.style.textIndent = "0";
      q.classList.add("hp-brk");
      if (!q.firstChild) q.appendChild(document.createTextNode("​"));
      if (!p.firstChild) p.appendChild(document.createTextNode("​"));
      p.after(q);
    }
    flow.querySelectorAll(".h-pbr").forEach((x) => x.remove()); // 표 칸 안의 쪽 나눔은 무시
  }

  // 글자 문단을 줄 단위로 가름. avail = 문단 위쪽 테두리에서 쪽 아래까지(px). 남은 부분(새 문단) 또는 null
  function splitText(el, avail) {
    if (el.querySelector(OBJ)) return null;
    const limit = el.getBoundingClientRect().top + avail;
    const nodes = [], ends = [];
    let n = 0;
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let t = tw.nextNode(); t; t = tw.nextNode()) { if (!t.length) continue; nodes.push(t); n += t.length; ends.push(n); }
    if (n < 2) return null;
    const rg = document.createRange();
    const at = (k) => { let i = 0; while (ends[i] <= k) i++; return [nodes[i], k - (i ? ends[i - 1] : 0)]; };
    const rect = (k) => { const [t, o] = at(k); rg.setStart(t, o); rg.setEnd(t, o + 1); const rs = rg.getClientRects(); return rs.length ? rs[rs.length - 1] : rg.getBoundingClientRect(); };
    let lo = 0, hi = n - 1;
    if (rect(hi).bottom <= limit) return null; // 다 들어감
    while (lo < hi) { const m = (lo + hi) >> 1; if (rect(m).bottom > limit) hi = m; else lo = m + 1; }
    // 같은 줄(세로로 겹치는 글자)의 맨 앞으로
    let k = lo;
    const top = rect(k).top;
    while (k > 0) { const r = rect(k - 1); if (r.height && r.bottom > top + 1 && r.top < rect(k).bottom - 1) k--; else break; }
    if (k <= 0) return null;
    const [t, o] = at(k);
    rg.setStart(t, o);
    rg.setEndAfter(el.lastChild);
    const frag = rg.extractContents();
    const b = el.cloneNode(false);
    b.appendChild(frag);
    b.style.textIndent = "0";
    b.style.marginTop = "0";
    el.style.marginBottom = "0";
    b.classList.remove("hp-brk");
    return b;
  }

  // 표 문단(표만 든 문단)을 행 단위로 가름. 세로 병합이 걸친 곳에서는 자르지 않음
  function splitTable(el, avail, atTop) {
    const wraps = el.querySelectorAll(":scope > .h-tblw");
    if (wraps.length !== 1 || el.textContent.replace(/[\s​]/g, "") !== wraps[0].textContent.replace(/[\s​]/g, "")) return null;
    if ([...el.children].some((c) => c !== wraps[0])) return null;
    const wrap = wraps[0], tb = wrap.querySelector(":scope > table"), body = tb && tb.tBodies[0];
    if (!body || body.rows.length < 1) return null;
    const rows = [...body.rows];
    const top = el.getBoundingClientRect().top;
    // 행 r 뒤에서 자를 수 있나: r 이하 행에서 시작한 칸이 r 아래로 내려가지 않아야 함
    const reach = [];
    let far = -1;
    rows.forEach((tr, r) => { for (const td of tr.cells) far = Math.max(far, r + (td.rowSpan || 1) - 1); reach.push(far); });
    let cut = -1;
    for (let r = 0; r < rows.length - 1; r++) {
      if (rows[r].getBoundingClientRect().bottom - top > avail) break;
      if (reach[r] === r) cut = r;
    }
    let rest = null;
    if (cut < 0) {
      // 첫 행부터 안 들어감: 쪽 맨 위이거나 첫 행이 쪽보다 크면 그 행 안을 가름
      const r0 = rows[0];
      const fitsAlone = reach[0] === 0 && r0.getBoundingClientRect().height <= avail;
      if (!atTop && fitsAlone) return null;
      rest = reach[0] === 0 ? splitRow(r0, top + avail) : null;
      if (!rest) {
        if (!atTop) return null;
        cut = reach.findIndex((x, r) => x === r && r < rows.length - 1); // 넘치더라도 자를 수 있는 첫 곳
        if (cut < 0) return null;
      }
    }
    const b = el.cloneNode(false), wb = wrap.cloneNode(false), tb2 = tb.cloneNode(false), body2 = body.cloneNode(false);
    const cg = tb.querySelector(":scope > colgroup");
    if (cg) tb2.appendChild(cg.cloneNode(true)); // P2-64d 나뉜 뒤쪽 표도 같은 열 폭
    if (rest) body2.appendChild(rest);
    rows.slice(rest ? 1 : cut + 1).forEach((tr) => body2.appendChild(tr));
    tb2.appendChild(body2); wb.appendChild(tb2); b.appendChild(wb);
    b.style.marginTop = "0";
    el.style.marginBottom = "0";
    b.classList.remove("hp-brk");
    return b.querySelector("tr") ? b : null;
  }

  // 쪽보다 긴 표 행 하나를 칸마다 가름(한 칸짜리 큰 틀 표 등). limit = 화면 좌표의 쪽 아래. 아래쪽 새 행 또는 null
  function splitRow(tr, limit) {
    if ([...tr.cells].some((td) => td.rowSpan > 1)) return null;
    const plan = [];
    let progress = false;
    for (const td of tr.cells) {
      const kids = [...td.children];
      let i = 0, part = null;
      for (; i < kids.length; i++) {
        const r = kids[i].getBoundingClientRect();
        if (r.bottom <= limit) continue;
        if (r.top < limit - 4) part = splitText(kids[i], limit - r.top) || (kids[i].classList.contains("hp") ? splitTable(kids[i], limit - r.top, false) : null);
        break;
      }
      if (i > 0 || part) progress = true;
      plan.push({ td, kids, i, part });
    }
    if (!progress) return null; // 어느 칸도 위쪽에 남길 것이 없음 → 행을 통째로 다음 쪽으로
    const nt = tr.cloneNode(false);
    for (const { td, kids, i, part } of plan) {
      const nd = td.cloneNode(false);
      if (part) nd.appendChild(part);
      kids.slice(part ? i + 1 : i).forEach((k) => nd.appendChild(k));
      td.style.height = ""; nd.style.height = "";
      nt.appendChild(nd);
    }
    return nt;
  }

  // 그림 크기가 정해지지 않은 그림은 불러온 뒤에 재야 함(최대 4초 기다림)
  const imgsReady = (root) => {
    const list = [...root.querySelectorAll("img")].filter((im) => !im.complete);
    if (!list.length) return Promise.resolve();
    return Promise.race([Promise.all(list.map((im) => (im.decode ? im.decode() : Promise.resolve()).catch(() => {}))), new Promise((r) => setTimeout(r, 4000))]);
  };

  function makePage(pg) {
    const paper = h("div", "hwp-page");
    paper.style.width = pt(pg.w);
    paper.style.height = pt(pg.h);
    paper.style.padding = `${pt(pg.mt)} ${pt(pg.mr)} ${pt(pg.mb)} ${pt(pg.ml)}`;
    paper.style.setProperty("--ch", pt(Math.max(1000, pg.h - pg.mt - pg.mb)));
    paper.style.setProperty("--ph", pt(pg.h));
    const land = pg.w > pg.h;
    const fit = Math.min(1, (land ? A4.h : A4.w) / pg.w, (land ? A4.w : A4.h) / pg.h); // 인쇄: A4보다 큰 쪽은 줄임
    if (fit < 0.999) paper.style.setProperty("--pz", fit.toFixed(4));
    return paper;
  }

  // 구역 하나 → 종이 여러 장
  async function paginate(sec, host) {
    const pg = sec.page;
    const H = Math.floor(PX(Math.max(1000, pg.h - pg.mt - pg.mb))) - 1; // 본문 높이(px, 반올림 여유 1px)
    const flow = makePage(pg);
    flow.classList.add("hv-flow");
    flow.style.height = "auto";
    flow.style.paddingTop = flow.style.paddingBottom = "0";
    const scratch = makePage(pg);
    scratch.classList.add("hv-flow");
    scratch.style.height = "auto";
    scratch.style.paddingTop = scratch.style.paddingBottom = "0";
    host.append(flow, scratch);
    const ctx = {};
    sec.paras.forEach((p) => flow.appendChild(para(p, ctx)));
    sec.notes.forEach((n, i) => {
      const row = h("div", "h-note-row" + (i ? "" : " h-notes-first"));
      const no = h("span", "h-note-no"); no.textContent = `${n.n})`;
      row.appendChild(no);
      n.paras.forEach((p) => row.appendChild(para(p, ctx)));
      flow.appendChild(row);
    });
    splitAtBreaks(flow);
    await imgsReady(flow);
    const blocks = [...flow.children];
    const m = blocks.map((b) => { const mt = parseFloat(getComputedStyle(b).marginTop) || 0; return { top: b.offsetTop - mt, end: b.offsetTop + b.offsetHeight, bt: b.offsetTop }; });

    const pages = [];
    let cur = null, used = 0, prevEnd = 0, over = false;
    const open = () => { cur = makePage(pg); pages.push(cur); used = 0; over = false; };
    // 나눌 수 없는데 한 쪽보다 큰 덩어리(표지 그림 묶음, 글상자 등)는 쪽에 맞게 줄임. 너무 작아지면(25% 미만) 넘치게 둠
    const shrink = (el, hb) => { const s = (H - 1) / hb; if (s < 0.25) { cur.classList.add("is-over"); over = true; return; } el.style.zoom = s.toFixed(4); el.classList.add("h-fit"); };
    const put = (el) => { el.classList.remove("hp-brk"); cur.appendChild(el); };
    open();
    for (let i = 0; i < blocks.length; i++) {
      let el = blocks[i];
      const g = m[i];
      if (el.classList.contains("hp-brk") && cur.firstChild) open();
      const empty = !cur.firstChild;
      const delta = empty ? g.end - g.top : g.end - prevEnd;
      if (used + delta <= H) { put(el); used += delta; prevEnd = g.end; continue; }
      // 안 들어감: 나눌 수 있으면 나누고, 아니면 다음 쪽으로
      let avail = H - used - (empty ? g.bt - g.top : g.bt - prevEnd);
      let rest = avail > 8 ? (splitText(el, avail) || splitTable(el, avail, empty)) : null;
      if (!rest && !empty) {
        open();
        if (g.end - g.top <= H) { put(el); used = g.end - g.top; prevEnd = g.end; continue; }
        avail = H - (g.bt - g.top);
        rest = splitText(el, avail) || splitTable(el, avail, true);
      }
      put(el);
      if (!rest) { shrink(el, g.end - g.top); used = H + 1; prevEnd = g.end; continue; }
      // 남은 부분: 따로 재서 다음 쪽(들)에
      while (rest) {
        open();
        scratch.textContent = "";
        scratch.appendChild(rest);
        const hh = rest.offsetHeight;
        if (hh <= H) { put(rest); used = hh; break; }
        const more = splitText(rest, H) || splitTable(rest, H, true);
        put(rest);
        if (!more) { shrink(rest, hh); used = H + 1; break; }
        rest = more;
      }
      prevEnd = g.end;
    }
    void over;
    flow.remove(); scratch.remove();
    return pages.filter((p, i) => p.firstChild || i === 0);
  }

  // 문서 전체 → 쪽(종이) 목록. 반환: { pages, print(@page 규칙) }
  R.render = async (doc, into) => {
    const host = h("div", "hv-measure");
    host.setAttribute("aria-hidden", "true");
    document.body.appendChild(host);
    const pages = [];
    try {
      for (const sec of doc.sections) pages.push(...(await paginate(sec, host)));
    } finally { host.remove(); }
    pages.forEach((p, i) => { p.setAttribute("role", "document"); p.setAttribute("aria-label", `${i + 1}쪽`); p.dataset.n = i + 1; });
    if (into) into.replaceChildren(...pages);
    const p0 = doc.sections[0].page;
    // 인쇄: A4(문서가 가로면 A4 가로), 여백 0 — 종이(쪽) 안의 여백이 문서 여백
    const print = `@page{size:A4 ${p0.w > p0.h ? "landscape" : "portrait"};margin:0}`;
    return { pages, print };
  };
  R.PX = PX;
})();
