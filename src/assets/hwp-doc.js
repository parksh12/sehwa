// P2-64 한글 문서 해석 → 공통 문서 모델. 화면(hwp-render.js)은 이 모델만 보고 그립니다.
// 붙어 있는 해석기: HWPX(이 파일), DOCX(docx-doc.js, P2-65) — zip + XML(의존: vendor/fflate.min.js + 브라우저 DOMParser)
//                  HWP 5.0 바이너리(hwp5-doc.js, P2-64d) — OLE 복합 파일 + 레코드, 자체 해석기
// 해석기는 HwpDoc.register({ name, test(u8, info), parse(u8, name) })로 붙고, 화면 코드는 그대로 씁니다.
// info = { name, kind:"zip"|"cfb"|"hwp3"|"", names:[zip 안 경로] }
// 원칙: 파일은 이 브라우저 안에서만 읽습니다. 문서 글자는 textContent로만 그리고(hwp-render.js), 그림은 이미지 형식만 blob 주소로 씁니다.
//
// 공통 문서 모델 (길이 단위는 HWPUNIT = 1/7200인치, 글자 크기는 pt)
// doc  = { format, sections:[sec], stats:{ paras, tables, images }, skipped:{ 이름: 개수 }, urls:[blob 주소] }
// sec  = { page:{ w, h, ml, mr, mt, mb }, paras:[para], notes:[[para]] }
// para = { align, ml, mr, indent, before, after, lh:{ type:"PERCENT"|"FIXED"|..., v }, brk, label?:{ s, st }(목록 번호·글머리표), items:[item] }
//        (ml은 둘째 줄부터가 아니라 「첫 줄 기준」 왼쪽 여백. indent<0이면 내어쓰기)
// item = { k:"t", s, st } | { k:"br" } | { k:"tab", st } | { k:"img", src, w, h } | { k:"tbl", w, align, inline, rows:[[cell]] }
//      | { k:"box", w, h, paras } | { k:"eq", s, st } | { k:"note", n, st } | { k:"miss", s } | { k:"pbr" }(문단 안 쪽 나눔)
// cell = { cs, rs, w, h, va, bf, pad:[l, r, t, b], paras }
// st   = { sz, color, b, i, u, s, sup, sub, font, serif, bg }
// bf   = { l, r, t, b: { style, width, color }, bg }
(function () {
  const HwpDoc = (window.HwpDoc = window.HwpDoc || {});
  const PARSERS = [];

  class HwpError extends Error {
    constructor(code, message) { super(message || code); this.code = code; }
  }
  HwpDoc.Error = HwpError;
  HwpDoc.register = (p) => PARSERS.push(p);

  // 파일 머리 바이트로 형식 판별(확장자보다 우선)
  const sig = (u8, arr) => arr.every((b, i) => u8[i] === b);
  HwpDoc.sniff = (u8) => {
    if (sig(u8, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "cfb"; // OLE 복합 파일(HWP 5.0, 예전 .doc, 암호 걸린 docx)
    if (sig(u8, [0x48, 0x57, 0x50, 0x20, 0x44, 0x6f, 0x63])) return "hwp3"; // "HWP Doc…"(HWP 3.0 이하)
    if (sig(u8, [0x50, 0x4b, 0x03, 0x04])) return "zip";
    return "";
  };

  // OLE 복합 파일 안의 스트림 이름(UTF-16)으로 종류 구분: 암호 걸린 Office 문서 / 예전 워드 / HWP
  const u16 = (s) => [...s].flatMap((c) => [c.charCodeAt(0), 0]);
  const has = (u8, pat) => {
    const n = Math.min(u8.length, 8 * 1048576);
    outer: for (let i = 0; i + pat.length <= n; i++) {
      for (let j = 0; j < pat.length; j++) if (u8[i + j] !== pat[j]) continue outer;
      return true;
    }
    return false;
  };
  const cfbKind = (u8) => (has(u8, u16("EncryptedPackage")) ? "encrypted" : has(u8, u16("WordDocument")) ? "doc" : has(u8, u16("FileHeader")) || has(u8, u16("HwpSummary")) ? "hwp" : "notdoc");
  // zip 안 경로 목록(압축은 풀지 않음)
  const zipNames = (u8) => {
    const names = [];
    try { fflate.unzipSync(u8, { filter: (f) => { names.push(f.name); return false; } }); } catch (e) { return null; }
    return names;
  };

  // 여는 입구: 등록된 해석기 중 맞는 것을 고름
  HwpDoc.open = async (buf, name) => {
    const u8 = new Uint8Array(buf);
    const kind = HwpDoc.sniff(u8);
    const info = { name, kind, names: [] };
    if (kind === "zip") {
      const names = window.fflate ? zipNames(u8) : null;
      if (!names) throw new HwpError("broken");
      info.names = names;
    }
    for (const p of PARSERS) if (p.test(u8, info)) return p.parse(u8, name);
    if (kind === "cfb") throw new HwpError(cfbKind(u8));
    if (kind === "hwp3") throw new HwpError("hwp");
    throw new HwpError("notdoc");
  };

  // ---------- XML 도우미 (이름공간 접두어와 상관없이 localName으로 찾기) ----------
  const kids = (el, ln) => (el ? [...el.children].filter((c) => c.localName === ln) : []);
  const kid = (el, ln) => kids(el, ln)[0] || null;
  const all = (el, ln) => (el ? [...el.getElementsByTagNameNS("*", ln)] : []);
  // hp:switch: hp:case(HwpUnitChar, 실제 HWPUNIT 값)를 우선. hp:default는 옛 판독기용으로 여백 값이 두 배로 들어 있음
  const pick = (el, ln) => {
    const list = all(el, ln);
    return list.find((x) => x.parentElement && x.parentElement.localName === "case") || list[0] || null;
  };
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const attr = (el, a, d = "") => (el && el.hasAttribute(a) ? el.getAttribute(a) : d);
  const color = (v) => (/^#[0-9a-f]{6}$/i.test(v || "") ? v.toLowerCase() : "");

  function xml(text, what) {
    const d = new DOMParser().parseFromString(text, "application/xml");
    if (d.getElementsByTagName("parsererror").length) throw new HwpError("broken", what);
    return d;
  }

  // ---------- HWPX ----------
  const IMG_MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", webp: "image/webp" };
  const MAX_ENTRY = 200 * 1048576; // 압축을 풀었을 때 한 항목 200MB 넘으면 건너뜀(압축 폭탄 방지)
  const MAX_TOTAL = 400 * 1048576;

  function unzip(u8) {
    if (!window.fflate) throw new HwpError("broken", "fflate 없음");
    let total = 0;
    try {
      return fflate.unzipSync(u8, {
        filter: (f) => {
          if (/^Preview\//i.test(f.name)) return false; // 미리보기 그림은 쓰지 않음
          if (f.originalSize > MAX_ENTRY || total + f.originalSize > MAX_TOTAL) return false;
          total += f.originalSize;
          return true;
        },
      });
    } catch (e) {
      throw new HwpError(/encrypt/i.test(String(e && e.message)) ? "encrypted" : "broken");
    }
  }

  function parseHwpx(u8) {
    const files = unzip(u8);
    const names = Object.keys(files);
    const find = (n) => { const k = names.find((x) => x.toLowerCase() === n.toLowerCase()); return k ? files[k] : null; };
    const text = (n) => { const b = find(n); return b ? new TextDecoder("utf-8").decode(b) : null; };

    const manifestTxt = text("META-INF/manifest.xml") || "";
    if (/encryption-data|<[^>]*encrypt/i.test(manifestTxt)) throw new HwpError("encrypted");
    const headerTxt = text("Contents/header.xml");
    if (!headerTxt) throw new HwpError("notdoc");

    // content.hpf: 항목 id → 경로, 본문 순서(spine)
    const items = {};
    let order = [];
    const hpfTxt = text("Contents/content.hpf");
    if (hpfTxt) {
      const hpf = xml(hpfTxt, "content.hpf");
      all(hpf, "item").forEach((it) => { items[attr(it, "id")] = { href: attr(it, "href"), type: attr(it, "media-type") }; });
      order = all(hpf, "itemref").map((r) => items[attr(r, "idref")]).filter((x) => x && /section\d+\.xml$/i.test(x.href)).map((x) => x.href);
    }
    if (!order.length) order = names.filter((n) => /^Contents\/section\d+\.xml$/i.test(n)).sort((a, b) => num(a.match(/\d+/)[0]) - num(b.match(/\d+/)[0]));
    if (!order.length) throw new HwpError("notdoc");

    const doc = { format: "HWPX", sections: [], stats: { paras: 0, tables: 0, images: 0 }, skipped: {}, urls: [] };
    const skip = (what) => { doc.skipped[what] = (doc.skipped[what] || 0) + 1; };
    const H = readHeader(xml(headerTxt, "header.xml"));

    // 그림: binaryItemIDRef → content.hpf 경로 → zip 안의 바이트 → blob 주소
    const binCache = {};
    const binUrl = (id) => {
      if (id in binCache) return binCache[id];
      const it = items[id];
      // content.hpf에 없으면 BinData/<id>.<확장자>를 찾아봄
      const href = it ? it.href.replace(/^\.?\//, "") : names.find((n) => /^BinData\//i.test(n) && n.replace(/^BinData\//i, "").replace(/\.[^.]+$/, "") === id) || "";
      const bytes = href ? find(href) : null;
      const mime = IMG_MIME[href.split(".").pop().toLowerCase()] || "";
      let url = null;
      if (bytes && mime) { url = URL.createObjectURL(new Blob([bytes], { type: mime })); doc.urls.push(url); }
      return (binCache[id] = url);
    };

    let noteNo = 0;
    for (const href of order) {
      const t = text(href);
      if (t == null) continue;
      const sec = { page: { w: 59528, h: 84188, ml: 8504, mr: 8504, mt: 5668 + 4252, mb: 4252 + 4252 }, paras: [], notes: [] };
      const root = xml(t, href).documentElement;
      const ctx = { H, doc, sec, skip, binUrl, nextNote: () => ++noteNo };
      kids(root, "p").forEach((p) => sec.paras.push(...paraOf(p, ctx)));
      doc.sections.push(sec);
    }
    if (!doc.sections.length) throw new HwpError("broken");
    return doc;
  }

  function readHeader(hd) {
    const fonts = {};
    all(hd, "fontface").forEach((ff) => {
      if (attr(ff, "lang").toUpperCase() !== "HANGUL") return;
      kids(ff, "font").forEach((f) => { fonts[attr(f, "id")] = attr(f, "face"); });
    });
    const borders = {};
    all(hd, "borderFill").forEach((b) => {
      const side = (ln) => { const e = kid(b, ln); return e ? { style: attr(e, "type", "NONE"), width: attr(e, "width", "0.12 mm"), color: color(attr(e, "color")) || "#000000" } : null; };
      const brush = all(b, "winBrush")[0];
      const bg = brush ? color(attr(brush, "faceColor")) : "";
      borders[attr(b, "id")] = { l: side("leftBorder"), r: side("rightBorder"), t: side("topBorder"), b: side("bottomBorder"), bg };
    });
    const chars = {};
    all(hd, "charPr").forEach((c) => {
      const fr = kid(c, "fontRef");
      const face = fonts[attr(fr, "hangul", "0")] || "";
      const ul = kid(c, "underline"), so = kid(c, "strikeout");
      const shade = color(attr(c, "shadeColor"));
      chars[attr(c, "id")] = {
        sz: num(attr(c, "height", "1000"), 1000) / 100,
        color: color(attr(c, "textColor")) || "#000000",
        b: !!kid(c, "bold"), i: !!kid(c, "italic"),
        u: !!ul && !/^NONE$/i.test(attr(ul, "type", "NONE")),
        s: !!so && !/^NONE$/i.test(attr(so, "shape", "NONE")),
        sup: !!kid(c, "supscript"), sub: !!kid(c, "subscript"),
        font: face, serif: /바탕|명조|궁서|batang|myeongjo|serif|times/i.test(face),
        bg: shade && shade !== "#ffffff" ? shade : "",
      };
    });
    const paras = {};
    all(hd, "paraPr").forEach((p) => {
      const al = pick(p, "align");
      const mg = pick(p, "margin");
      const val = (ln) => { const e = kid(mg, ln); return e ? num(attr(e, "value")) : 0; };
      const ls = pick(p, "lineSpacing");
      paras[attr(p, "id")] = {
        align: attr(al, "horizontal", "JUSTIFY").toUpperCase(),
        ml: val("left"), mr: val("right"), indent: val("intent"), before: val("prev"), after: val("next"),
        lh: ls ? { type: attr(ls, "type", "PERCENT").toUpperCase(), v: num(attr(ls, "value"), 160) } : { type: "PERCENT", v: 160 },
      };
    });
    return { chars, paras, borders };
  }

  const DEF_ST = { sz: 10, color: "#000000", b: false, i: false, u: false, s: false, sup: false, sub: false, font: "", serif: false, bg: "" };
  const DEF_PP = { align: "JUSTIFY", ml: 0, mr: 0, indent: 0, before: 0, after: 0, lh: { type: "PERCENT", v: 160 } };

  // 문단 1개 → 모델 문단 1개(쪽 나눔 표시 포함)
  function paraOf(p, ctx) {
    const pp = ctx.H.paras[attr(p, "paraPrIDRef")] || DEF_PP;
    const para = { ...pp, brk: attr(p, "pageBreak") === "1", items: [] };
    ctx.doc.stats.paras++;
    let lastSt = null;
    for (const run of kids(p, "run")) {
      const st = ctx.H.chars[attr(run, "charPrIDRef")] || DEF_ST;
      lastSt = st;
      for (const el of run.children) runChild(el, st, para.items, ctx);
    }
    para.st = lastSt || DEF_ST; // 빈 문단의 줄 높이용
    return [para];
  }

  function runChild(el, st, out, ctx) {
    switch (el.localName) {
      case "t": {
        let buf = "";
        const flush = () => { if (buf) { out.push({ k: "t", s: buf, st }); buf = ""; } };
        for (const n of el.childNodes) {
          if (n.nodeType === 3) { buf += n.nodeValue; continue; }
          if (n.nodeType !== 1) continue;
          const ln = n.localName;
          if (ln === "tab") { flush(); out.push({ k: "tab", st }); }
          else if (ln === "lineBreak") { flush(); out.push({ k: "br" }); }
          else if (ln === "nbSpace") buf += " ";
          else if (ln === "fwSpace") buf += "　";
          else if (ln === "hyphen") buf += "-";
          else if (n.textContent) buf += n.textContent; // 형광펜 등 감싼 요소 안 글자
        }
        flush();
        return;
      }
      case "secPr": {
        const pg = all(el, "pagePr")[0];
        if (pg) {
          const m = kid(pg, "margin");
          ctx.sec.page = {
            w: num(attr(pg, "width"), 59528), h: num(attr(pg, "height"), 84188),
            ml: num(attr(m, "left"), 8504) + num(attr(m, "gutter")), mr: num(attr(m, "right"), 8504),
            mt: num(attr(m, "top"), 5668) + num(attr(m, "header"), 4252), mb: num(attr(m, "bottom"), 4252) + num(attr(m, "footer"), 4252),
          };
        }
        return;
      }
      case "ctrl": {
        for (const c of el.children) {
          const ln = c.localName;
          if (ln === "header") ctx.skip("머리말");
          else if (ln === "footer") ctx.skip("꼬리말");
          else if (ln === "footNote" || ln === "endNote") {
            const n = ctx.nextNote();
            out.push({ k: "note", n, st });
            ctx.sec.notes.push({ n, paras: subParas(kid(c, "subList"), ctx) });
          } else if (ln === "pageNum") ctx.skip("쪽 번호");
        }
        return;
      }
      case "tbl": out.push(tableOf(el, ctx)); return;
      case "pic": out.push(picOf(el, ctx)); return;
      case "equation": {
        const sc = kid(el, "script");
        out.push({ k: "eq", s: sc ? sc.textContent.trim() : "", st });
        ctx.skip("수식(글자로 표시)");
        return;
      }
      case "rect": case "ellipse": case "polygon": case "curve": case "arc": case "line": case "connectLine": case "container": {
        shapeOf(el, ctx, out);
        return;
      }
      case "ole": case "chart": ctx.skip("차트·OLE 개체"); out.push({ k: "miss", s: "[차트·개체]" }); return;
      case "textart": ctx.skip("글맵시"); return;
      case "video": ctx.skip("동영상"); return;
      default: return; // fieldBegin·bookmark 등 표시 없는 요소
    }
  }

  const subParas = (sub, ctx) => (sub ? kids(sub, "p").flatMap((p) => paraOf(p, ctx)) : []);
  const sizeOf = (el) => {
    const cs = kid(el, "curSz"), sz = kid(el, "sz");
    let w = num(attr(cs, "width")), h = num(attr(cs, "height"));
    if (!w || !h) { w = num(attr(sz, "width")); h = num(attr(sz, "height")); }
    if ((!w || !h) && kid(el, "orgSz")) { w = num(attr(kid(el, "orgSz"), "width")); h = num(attr(kid(el, "orgSz"), "height")); }
    return { w, h };
  };

  function tableOf(el, ctx) {
    ctx.doc.stats.tables++;
    const pos = kid(el, "pos");
    const inM = kid(el, "inMargin");
    const defPad = [num(attr(inM, "left"), 510), num(attr(inM, "right"), 510), num(attr(inM, "top"), 141), num(attr(inM, "bottom"), 141)];
    const rows = kids(el, "tr").map((tr) => kids(tr, "tc").map((tc) => {
      const span = kid(tc, "cellSpan"), sz = kid(tc, "cellSz"), sub = kid(tc, "subList"), cm = kid(tc, "cellMargin");
      const pad = attr(tc, "hasMargin") === "1" && cm ? [num(attr(cm, "left")), num(attr(cm, "right")), num(attr(cm, "top")), num(attr(cm, "bottom"))] : defPad;
      return {
        cs: Math.max(1, num(attr(span, "colSpan"), 1)), rs: Math.max(1, num(attr(span, "rowSpan"), 1)),
        w: num(attr(sz, "width")), h: num(attr(sz, "height")),
        va: attr(sub, "vertAlign", "CENTER").toUpperCase(),
        bf: ctx.H.borders[attr(tc, "borderFillIDRef")] || null, pad,
        paras: subParas(sub, ctx),
      };
    }));
    return { k: "tbl", w: sizeOf(el).w, align: attr(pos, "horzAlign", "LEFT").toUpperCase(), inline: attr(pos, "treatAsChar") === "1", rows };
  }

  function picOf(el, ctx) {
    const img = all(el, "img")[0];
    const { w, h } = sizeOf(el);
    const src = img ? ctx.binUrl(attr(img, "binaryItemIDRef")) : null;
    if (!src) { ctx.skip("표시할 수 없는 그림 형식"); return { k: "miss", s: "[그림]" }; }
    ctx.doc.stats.images++;
    return { k: "img", src, w, h };
  }

  // 도형: 글상자 글자와 안에 든 그림만 살림(선·면 모양은 1차 범위 밖)
  function shapeOf(el, ctx, out) {
    if (el.localName === "container") {
      for (const c of el.children) {
        if (c.localName === "pic") out.push(picOf(c, ctx));
        else if (["rect", "ellipse", "polygon", "curve", "arc", "line", "connectLine", "container"].includes(c.localName)) shapeOf(c, ctx, out);
      }
      return;
    }
    const dt = kid(el, "drawText");
    if (dt) {
      const { w, h } = sizeOf(el);
      out.push({ k: "box", w, h, paras: subParas(kid(dt, "subList"), ctx) });
    } else ctx.skip("도형 그림");
  }

  HwpDoc.register({ name: "HWPX", test: (u8, info) => info.kind === "zip" && info.names.some((n) => /^Contents\/(header\.xml|content\.hpf)$/i.test(n)), parse: (u8) => parseHwpx(u8) });

  // 다른 해석기(docx-doc.js 등)가 같이 쓰는 도구
  HwpDoc.util = { kids, kid, all, num, attr, color, xml, unzip, IMG_MIME, HwpError };

  // 다 쓴 문서의 그림 주소 해제
  HwpDoc.free = (doc) => { (doc && doc.urls || []).forEach((u) => URL.revokeObjectURL(u)); if (doc) doc.urls = []; };
})();
