// P2-65 워드(DOCX) 해석기 → P2-64 공통 문서 모델(hwp-doc.js 머리 주석 참고). 그리기는 hwp-render.js가 그대로 합니다.
// 의존: vendor/fflate.min.js, hwp-doc.js(HwpDoc.util), 브라우저 DOMParser. 외부 라이브러리 없음.
// 단위: DOCX twip(1/20pt) × 5 = HWPUNIT(1/100pt), EMU ÷ 127 = HWPUNIT, 글자 크기 반 포인트(sz) ÷ 2 = pt
(function () {
  const HwpDoc = window.HwpDoc;
  if (!HwpDoc || !HwpDoc.util) return;
  const { kids, kid, all, num, attr, xml, unzip, IMG_MIME, HwpError } = HwpDoc.util;
  const TW = 5; // twip → HWPUNIT
  const W = (el, a, d = "") => attr(el, "w:" + a, attr(el, a, d)); // w:val 등(접두어 있는/없는 경우 모두)
  const hex = (v) => (/^[0-9a-f]{6}$/i.test(v || "") ? "#" + v.toLowerCase() : "");
  const on = (el) => { if (!el) return null; const v = W(el, "val", "true").toLowerCase(); return !(v === "0" || v === "false" || v === "off" || v === "none"); };
  const HL = { yellow: "#ffff00", green: "#00ff00", cyan: "#00ffff", magenta: "#ff00ff", blue: "#0000ff", red: "#ff0000", darkBlue: "#000080", darkCyan: "#008080", darkGreen: "#008000", darkMagenta: "#800080", darkRed: "#800000", darkYellow: "#808000", darkGray: "#808080", lightGray: "#c0c0c0", black: "#000000" };
  const JC = { left: "LEFT", start: "LEFT", center: "CENTER", right: "RIGHT", end: "RIGHT", both: "JUSTIFY", distribute: "DISTRIBUTE", lowKashida: "JUSTIFY", mediumKashida: "JUSTIFY", highKashida: "JUSTIFY", thaiDistribute: "DISTRIBUTE" };
  const BD = { single: "SOLID", thick: "SOLID", double: "DOUBLE_SLIM", triple: "DOUBLE_SLIM", dotted: "DOT", dashed: "DASH", dashSmallGap: "DASH", dotDash: "DASH_DOT", dotDotDash: "DASH_DOT_DOT", wave: "WAVE", doubleWave: "DOUBLE_WAVE", nil: "NONE", none: "NONE" };
  const SERIF_RE = /바탕|명조|궁서|batang|myeongjo|gungsuh|times|georgia|cambria|garamond|serif/i;

  // ---------- 글자·문단 속성 (docDefaults → 스타일(basedOn 사슬) → 번호 수준 → 직접 지정 순으로 덮어씀) ----------
  function readRPr(r, base) {
    const st = { ...base };
    if (!r) return st;
    const v = (ln) => kid(r, ln);
    const b = on(v("b")); if (b !== null) st.b = b;
    const i = on(v("i")); if (i !== null) st.i = i;
    const u = v("u"); if (u) st.u = !/^none$/i.test(W(u, "val", "single"));
    const sk = on(v("strike")); if (sk !== null) st.s = sk;
    const ds = on(v("dstrike")); if (ds) st.s = true;
    const va = v("vertAlign"); if (va) { const x = W(va, "val"); st.sup = x === "superscript"; st.sub = x === "subscript"; }
    const sz = v("sz"); if (sz) st.sz = num(W(sz, "val"), 20) / 2;
    const c = v("color"); if (c) { const x = W(c, "val"); st.color = x === "auto" ? "#000000" : hex(x) || st.color; }
    const hl = v("highlight"); if (hl) st.bg = HL[W(hl, "val")] || "";
    const shd = v("shd"); if (shd && !st.bg) { const f = hex(W(shd, "fill")); if (f && f !== "#ffffff") st.bg = f; }
    const rf = v("rFonts");
    if (rf) { const f = W(rf, "eastAsia") || W(rf, "ascii") || W(rf, "hAnsi"); if (f) { st.font = f; st.serif = SERIF_RE.test(f); } }
    const caps = on(v("caps")); if (caps !== null) st.caps = caps;
    const vanish = on(v("vanish")); if (vanish !== null) st.hidden = vanish;
    return st;
  }
  function readPPr(p, base) {
    const pp = { ...base, lh: { ...base.lh } };
    if (!p) return pp;
    const jc = kid(p, "jc"); if (jc) pp.align = JC[W(jc, "val")] || pp.align;
    const ind = kid(p, "ind");
    if (ind) {
      const g = (a, b) => (ind.hasAttribute("w:" + a) ? num(W(ind, a)) : ind.hasAttribute("w:" + b) ? num(W(ind, b)) : null);
      const l = g("left", "start"); if (l !== null) pp.left = l;
      const r = g("right", "end"); if (r !== null) pp.right = r;
      if (ind.hasAttribute("w:hanging")) { pp.first = -num(W(ind, "hanging")); }
      else if (ind.hasAttribute("w:firstLine")) pp.first = num(W(ind, "firstLine"));
    }
    const sp = kid(p, "spacing");
    if (sp) {
      if (sp.hasAttribute("w:before")) pp.before = num(W(sp, "before"));
      if (sp.hasAttribute("w:after")) pp.after = num(W(sp, "after"));
      if (sp.hasAttribute("w:line")) {
        const rule = W(sp, "lineRule", "auto"), line = num(W(sp, "line"), 240);
        pp.lh = rule === "auto" ? { type: "PERCENT", v: (line / 240) * 115 } : { type: rule === "exact" ? "FIXED" : "AT_LEAST", v: line * TW }; // 워드 「1줄」 ≈ 글자 크기의 1.15배
      }
    }
    const np = kid(p, "numPr");
    if (np) { const id = kid(np, "numId"), lv = kid(np, "ilvl"); if (id) pp.numId = W(id, "val"); if (lv) pp.ilvl = num(W(lv, "val")); }
    const pb = on(kid(p, "pageBreakBefore")); if (pb !== null) pp.brk = pb;
    const ps = kid(p, "pStyle"); if (ps) pp.pStyle = W(ps, "val");
    return pp;
  }

  // ---------- 번호 매기기 ----------
  const ROMAN = (n) => { const t = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]]; let s = ""; for (const [v, r] of t) while (n >= v) { s += r; n -= v; } return s; };
  const LETTER = (n) => { let s = ""; while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s; };
  const GANADA = "가나다라마바사아자차카타파하", CHOSUNG = "ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ", CIRCLE = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
  const BULLET_MAP = { "": "•", "": "▪", "": "➢", "": "✓", "": "❖", "": "◆", o: "◦", "§": "▪" };
  function fmtNum(n, fmt) {
    switch (fmt) {
      case "lowerLetter": return LETTER(n);
      case "upperLetter": return LETTER(n).toUpperCase();
      case "lowerRoman": return ROMAN(n);
      case "upperRoman": return ROMAN(n).toUpperCase();
      case "ganada": return GANADA[(n - 1) % GANADA.length];
      case "chosung": return CHOSUNG[(n - 1) % CHOSUNG.length];
      case "decimalEnclosedCircle": case "decimalEnclosedCircleChinese": return CIRCLE[n - 1] || String(n);
      case "decimalZero": return n < 10 ? "0" + n : String(n);
      case "none": return "";
      default: return String(n);
    }
  }
  function readNumbering(doc) {
    const abs = {}, nums = {};
    if (!doc) return { abs, nums };
    all(doc, "abstractNum").forEach((a) => {
      const lv = {};
      kids(a, "lvl").forEach((l) => {
        lv[num(W(l, "ilvl"))] = {
          start: num(W(kid(l, "start"), "val", "1"), 1), fmt: W(kid(l, "numFmt"), "val", "decimal"), text: W(kid(l, "lvlText"), "val", "%1."),
          pPr: kid(l, "pPr"), rPr: kid(l, "rPr"),
        };
      });
      abs[W(a, "abstractNumId")] = lv;
    });
    all(doc, "num").forEach((n) => {
      const over = {};
      kids(n, "lvlOverride").forEach((o) => { const s = kid(o, "startOverride"); if (s) over[num(W(o, "ilvl"))] = num(W(s, "val"), 1); });
      nums[W(n, "numId")] = { abs: W(kid(n, "abstractNumId"), "val"), over };
    });
    return { abs, nums };
  }

  // ---------- 본문 ----------
  function parseDocx(u8) {
    const files = unzip(u8);
    const names = Object.keys(files);
    const find = (n) => { const k = names.find((x) => x.toLowerCase() === n.toLowerCase()); return k ? files[k] : null; };
    const text = (n) => { const b = find(n); return b ? new TextDecoder("utf-8").decode(b) : null; };
    const docTxt = text("word/document.xml");
    if (!docTxt) throw new HwpError("notdoc");
    const out = { format: "DOCX", sections: [], stats: { paras: 0, tables: 0, images: 0 }, skipped: {}, urls: [] };
    const skip = (w) => { out.skipped[w] = (out.skipped[w] || 0) + 1; };

    // 관계(rId → 그림 경로)
    const rels = {};
    const relTxt = text("word/_rels/document.xml.rels");
    if (relTxt) all(xml(relTxt, "rels"), "Relationship").forEach((r) => { rels[attr(r, "Id")] = { t: attr(r, "Target"), ext: attr(r, "TargetMode") === "External" }; });
    const imgCache = {};
    const imgUrl = (rid) => {
      if (rid in imgCache) return imgCache[rid];
      const r = rels[rid];
      let url = null;
      if (r && !r.ext) {
        const p = r.t.startsWith("/") ? r.t.slice(1) : "word/" + r.t.replace(/^\.\//, "");
        const parts = []; p.split("/").forEach((s) => (s === ".." ? parts.pop() : parts.push(s)));
        const path = parts.join("/");
        const bytes = find(path), mime = IMG_MIME[path.split(".").pop().toLowerCase()];
        if (bytes && mime) { url = URL.createObjectURL(new Blob([bytes], { type: mime })); out.urls.push(url); }
      }
      return (imgCache[rid] = url);
    };

    // 스타일
    const DEF_ST = { sz: 10, color: "#000000", b: false, i: false, u: false, s: false, sup: false, sub: false, font: "", serif: false, bg: "" };
    const DEF_PP = { align: "LEFT", left: 0, right: 0, first: 0, before: 0, after: 0, lh: { type: "PERCENT", v: 115 }, brk: false };
    let baseSt = DEF_ST, basePP = DEF_PP;
    const styles = {};
    let defParaStyle = "", defTblStyle = "";
    const stTxt = text("word/styles.xml");
    if (stTxt) {
      const sd = xml(stTxt, "styles.xml");
      const dd = all(sd, "docDefaults")[0];
      if (dd) { baseSt = readRPr(all(dd, "rPr")[0], DEF_ST); basePP = readPPr(all(dd, "pPr")[0], DEF_PP); }
      kids(sd.documentElement, "style").forEach((s) => {
        const id = W(s, "styleId");
        styles[id] = { type: W(s, "type"), based: W(kid(s, "basedOn"), "val"), pPr: kid(s, "pPr"), rPr: kid(s, "rPr"), tblPr: kid(s, "tblPr") };
        if (W(s, "default") === "1" || W(s, "default") === "true") { if (W(s, "type") === "paragraph") defParaStyle = id; if (W(s, "type") === "table") defTblStyle = id; }
      });
    }
    const chain = (id) => { const c = []; let k = id, guard = 0; while (k && styles[k] && guard++ < 20) { c.unshift(styles[k]); k = styles[k].based; } return c; };
    const memoP = {}, memoR = {};
    const styleP = (id) => (memoP[id] ||= chain(id).reduce((a, s) => { const r = readPPr(s.pPr, a); delete r.pStyle; return r; }, basePP));
    const styleR = (id) => (memoR[id] ||= chain(id).reduce((a, s) => readRPr(s.rPr, a), baseSt));

    const numbering = readNumbering(text("word/numbering.xml") ? xml(text("word/numbering.xml"), "numbering.xml") : null);
    const counters = {}; // numId(추상 번호 기준) → [수준별 값]

    // 각주
    const notes = {};
    const fnTxt = text("word/footnotes.xml");
    const fnDoc = fnTxt ? xml(fnTxt, "footnotes.xml") : null;
    const noteList = [];
    let noteNo = 0;

    const body = all(xml(docTxt, "document.xml"), "body")[0];
    if (!body) throw new HwpError("broken");
    const sec = { page: { w: 11906 * TW, h: 16838 * TW, ml: 1440 * TW, mr: 1440 * TW, mt: 1440 * TW, mb: 1440 * TW }, paras: [], notes: noteList };
    const lastSect = kid(body, "sectPr");
    if (lastSect) {
      const sz = kid(lastSect, "pgSz"), m = kid(lastSect, "pgMar");
      if (sz) { sec.page.w = num(W(sz, "w"), 11906) * TW; sec.page.h = num(W(sz, "h"), 16838) * TW; }
      if (m) { sec.page.ml = num(W(m, "left"), 1440) * TW + num(W(m, "gutter")) * TW; sec.page.mr = num(W(m, "right"), 1440) * TW; sec.page.mt = Math.abs(num(W(m, "top"), 1440)) * TW; sec.page.mb = Math.abs(num(W(m, "bottom"), 1440)) * TW; }
      if (kid(lastSect, "headerReference")) skip("머리글");
      if (kid(lastSect, "footerReference")) skip("바닥글");
    }

    // 문단 1개 → 모델 문단
    function para(p, ctx) {
      out.stats.paras++;
      const pPr = kid(p, "pPr");
      const direct = readPPr(pPr, {});
      const sid = direct.pStyle || defParaStyle;
      let pp = styleP(sid);
      const numId = direct.numId != null ? direct.numId : pp.numId, ilvl = direct.ilvl != null ? direct.ilvl : pp.ilvl || 0;
      let label = null;
      const runBase = styleR(sid);
      if (numId && numId !== "0" && numbering.nums[numId]) {
        const n = numbering.nums[numId], lv = (numbering.abs[n.abs] || {})[ilvl];
        if (lv) {
          pp = readPPr(lv.pPr, pp);
          const key = n.abs;
          const c = (counters[key] ||= []);
          for (let k = 0; k < ilvl; k++) if (c[k] == null) c[k] = ((numbering.abs[key] || {})[k] || { start: 1 }).start;
          c[ilvl] = c[ilvl] == null ? (n.over[ilvl] != null ? n.over[ilvl] : lv.start) : c[ilvl] + 1;
          c.length = ilvl + 1; // 하위 수준은 다시 시작
          let s;
          if (lv.fmt === "bullet") s = [...lv.text].map((ch) => BULLET_MAP[ch] || (ch.charCodeAt(0) >= 0xf000 ? "•" : ch)).join("") || "•";
          else s = lv.text.replace(/%(\d)/g, (_, d) => { const k = Number(d) - 1; const l2 = (numbering.abs[key] || {})[k] || lv; return fmtNum(c[k] != null ? c[k] : l2.start, l2.fmt); });
          label = { s: s + " ", st: readRPr(lv.rPr, readRPr(kid(pPr, "rPr"), runBase)) };
        }
      }
      pp = readPPr(pPr, pp);
      const markSt = readRPr(kid(pPr, "rPr"), runBase);
      const m = {
        align: pp.align, ml: (pp.left + Math.min(0, pp.first)) * TW, mr: pp.right * TW, indent: pp.first * TW,
        before: pp.before * TW, after: pp.after * TW, lh: pp.lh, brk: !!pp.brk || !!ctx.brkNext, items: [], st: markSt,
      };
      ctx.brkNext = false;
      if (label && label.s.trim()) m.label = label;
      inline(p, runBase, m.items, ctx);
      const st0 = m.items.find((x) => x.st);
      if (st0) m.st = st0.st;
      if (pPr && kid(pPr, "sectPr")) { const t = W(kid(kid(pPr, "sectPr"), "type"), "val", "nextPage"); if (t !== "continuous") ctx.brkNext = true; }
      return m;
    }

    // 문단 안 요소(하이퍼링크·변경 내용·콘텐츠 컨트롤은 안쪽 run을 그대로 읽음)
    function inline(el, runBase, items, ctx) {
      for (const c of el.children) {
        switch (c.localName) {
          case "r": run(c, runBase, items, ctx); break;
          case "hyperlink": case "ins": case "smartTag": case "fldSimple": case "customXml": case "moveTo": case "bdo": case "dir": inline(c, runBase, items, ctx); break;
          case "sdt": inline(kid(c, "sdtContent") || c, runBase, items, ctx); break;
          case "oMath": case "oMathPara": items.push({ k: "eq", s: c.textContent.trim(), st: runBase }); skip("수식(글자로 표시)"); break;
          default: break; // pPr, del, bookmark, proofErr 등
        }
      }
    }

    function run(r, runBase, items, ctx) {
      const rPr = kid(r, "rPr");
      const rs = kid(rPr, "rStyle");
      const st = readRPr(rPr, rs ? readRPr(null, chain(W(rs, "val")).reduce((a, s) => readRPr(s.rPr, a), runBase)) : runBase);
      if (st.hidden) return;
      const caps = (s) => (st.caps ? s.toUpperCase() : s);
      for (const c of r.children) {
        switch (c.localName) {
          case "t": if (c.textContent) items.push({ k: "t", s: caps(c.textContent), st }); break;
          case "tab": case "ptab": items.push({ k: "tab", st }); break;
          case "br": items.push(W(c, "type") === "page" ? { k: "pbr" } : { k: "br" }); break;
          case "cr": items.push({ k: "br" }); break;
          case "noBreakHyphen": items.push({ k: "t", s: "-", st }); break;
          case "sym": { const ch = parseInt(W(c, "char"), 16); if (ch) items.push({ k: "t", s: BULLET_MAP[String.fromCharCode(ch)] || (ch >= 0xf000 ? "•" : String.fromCharCode(ch)), st }); break; }
          case "lastRenderedPageBreak": break;
          case "footnoteReference": case "endnoteReference": {
            const n = ++noteNo;
            items.push({ k: "note", n, st });
            const id = W(c, "id");
            const src = c.localName === "footnoteReference" ? fnDoc : null;
            const fn = src && all(src, "footnote").find((f) => W(f, "id") === id);
            if (fn) noteList.push({ n, paras: kids(fn, "p").map((p) => para(p, ctx)) });
            else skip("미주");
            break;
          }
          case "drawing": drawing(c, items, ctx); break;
          case "pict": case "object": {
            const im = all(c, "imagedata")[0];
            const src = im ? imgUrl(attr(im, "r:id")) : null;
            if (src) { out.stats.images++; items.push({ k: "img", src, w: 0, h: 0 }); }
            else { const tb = all(c, "txbxContent")[0]; if (tb) items.push({ k: "box", w: 0, h: 0, paras: blocks(tb, ctx) }); else { skip("도형·개체"); } }
            break;
          }
          case "AlternateContent": {
            const ch = kid(c, "Choice") || kid(c, "Fallback");
            if (ch) run(fakeRun(ch, rPr), runBase, items, ctx);
            break;
          }
          default: break; // rPr, fldChar, instrText, commentReference 등
        }
      }
    }
    // mc:AlternateContent 안쪽(drawing 등)을 같은 run 속성으로 읽기 위한 가짜 run
    const fakeRun = (holder, rPr) => ({ children: rPr ? [rPr, ...holder.children] : [...holder.children], localName: "r" });
    function drawing(d, items, ctx) {
      if (all(d, "chart").length) { skip("차트"); items.push({ k: "miss", s: "[차트]" }); return; }
      const ext = all(d, "extent")[0];
      const w = ext ? num(attr(ext, "cx")) / 127 : 0, h = ext ? num(attr(ext, "cy")) / 127 : 0;
      const blip = all(d, "blip")[0];
      if (blip) {
        const src = imgUrl(attr(blip, "r:embed") || attr(blip, "r:link"));
        if (src) { out.stats.images++; items.push({ k: "img", src, w, h }); }
        else { skip("표시할 수 없는 그림 형식"); items.push({ k: "miss", s: "[그림]" }); }
        return;
      }
      const tb = all(d, "txbxContent")[0];
      if (tb) { items.push({ k: "box", w, h: 0, paras: blocks(tb, ctx) }); return; }
      skip("도형 그림");
    }

    // 표
    const side = (e) => {
      if (!e) return null;
      const v = W(e, "val", "single");
      return { style: BD[v] || "SOLID", width: ((num(W(e, "sz"), 4) / 8) * 0.3528).toFixed(2) + " mm", color: hex(W(e, "color")) || "#000000" };
    };
    const borders = (el) => {
      const r = {};
      if (!el) return r;
      for (const c of el.children) {
        const k = { top: "t", bottom: "b", left: "l", start: "l", right: "r", end: "r", insideH: "h", insideV: "v" }[c.localName];
        if (k) r[k] = side(c);
      }
      return r;
    };
    function table(tbl, ctx) {
      out.stats.tables++;
      const tblPr = kid(tbl, "tblPr");
      const tsid = W(kid(tblPr, "tblStyle"), "val") || defTblStyle;
      const sb = chain(tsid).reduce((a, s) => ({ ...a, ...borders(kid(s.tblPr, "tblBorders")) }), {});
      const tb = { ...sb, ...borders(kid(tblPr, "tblBorders")) };
      const mar = kid(tblPr, "tblCellMar") || chain(tsid).map((s) => kid(s.tblPr, "tblCellMar")).filter(Boolean).pop();
      const mv = (ln, d) => { const e = mar && (kid(mar, ln) || kid(mar, ln === "left" ? "start" : ln === "right" ? "end" : ln)); return e ? num(W(e, "w"), d) : d; };
      const defPad = [mv("left", 108) * TW, mv("right", 108) * TW, mv("top", 0) * TW, mv("bottom", 0) * TW];
      const grid = kids(kid(tbl, "tblGrid"), "gridCol").map((g) => num(W(g, "w")));
      const trs = kids(tbl, "tr");
      const rows = [];
      const above = {}; // 열 위치 → 세로 병합 시작 칸
      trs.forEach((tr, ri) => {
        const row = [];
        let col = num(W(kid(kid(tr, "trPr"), "gridBefore"), "val"), 0);
        const trH = kid(kid(tr, "trPr"), "trHeight");
        kids(tr, "tc").concat(kids(tr, "sdt").flatMap((s) => kids(kid(s, "sdtContent"), "tc"))).forEach((tc) => {
          const tcPr = kid(tc, "tcPr");
          const cs = Math.max(1, num(W(kid(tcPr, "gridSpan"), "val"), 1));
          const vm = kid(tcPr, "vMerge");
          const vmv = vm ? W(vm, "val", "continue") : "";
          if (vm && vmv === "continue" && above[col]) { above[col].rs++; col += cs; return; }
          const own = borders(kid(tcPr, "tcBorders"));
          const lastRow = ri === trs.length - 1, lastCol = col + cs >= grid.length;
          const pick = (k, edge, inner) => (own[k] !== undefined ? own[k] : edge ? tb[k] : tb[inner]) || null;
          const shd = kid(tcPr, "shd");
          const fill = shd ? hex(W(shd, "fill")) : "";
          const cell = {
            cs, rs: 1, w: grid.slice(col, col + cs).reduce((a, b) => a + b, 0) * TW || num(W(kid(tcPr, "tcW"), "w")) * TW,
            h: trH ? num(W(trH, "val")) * TW : 0,
            va: { top: "TOP", center: "CENTER", bottom: "BOTTOM" }[W(kid(tcPr, "vAlign"), "val", "top")] || "TOP",
            bf: { t: pick("t", ri === 0, "h"), b: pick("b", lastRow, "h"), l: pick("l", col === 0, "v"), r: pick("r", lastCol, "v"), bg: fill && fill !== "#ffffff" ? fill : "" },
            pad: defPad, paras: blocks(tc, ctx),
          };
          above[col] = vm ? cell : null; // 세로 병합 시작(또는 이어질 칸)만 기억
          row.push(cell);
          col += cs;
        });
        rows.push(row);
      });
      const jc = W(kid(tblPr, "jc"), "val");
      return { k: "tbl", w: grid.reduce((a, b) => a + b, 0) * TW, align: jc === "center" ? "CENTER" : jc === "right" || jc === "end" ? "RIGHT" : "LEFT", inline: false, rows };
    }

    // 블록 목록(본문·표 칸·글상자): 문단과 표
    function blocks(el, ctx) {
      const res = [];
      for (const c of el.children) {
        if (c.localName === "p") res.push(para(c, ctx));
        else if (c.localName === "tbl") res.push({ ...DEF_BLOCK(), items: [table(c, ctx)] });
        else if (c.localName === "sdt") res.push(...blocks(kid(c, "sdtContent") || c, ctx));
        else if (c.localName === "customXml") res.push(...blocks(c, ctx));
      }
      return res;
    }
    const DEF_BLOCK = () => ({ align: "LEFT", ml: 0, mr: 0, indent: 0, before: 0, after: 0, lh: { type: "PERCENT", v: 100 }, brk: false, st: baseSt });

    const ctx = { brkNext: false };
    sec.paras = blocks(body, ctx);
    out.sections.push(sec);
    return out;
  }

  HwpDoc.register({ name: "DOCX", test: (u8, info) => info.kind === "zip" && info.names.some((n) => /^word\/document\.xml$/i.test(n)), parse: (u8) => parseDocx(u8) });
})();
