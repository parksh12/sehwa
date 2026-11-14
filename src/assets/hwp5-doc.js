// P2-64d 한글(HWP 5.0 바이너리) 해석기 → P2-64 공통 문서 모델(hwp-doc.js 머리 주석 참고). 그리기·쪽 나눔·인쇄는 hwp-render.js가 그대로 합니다.
// 본 제품은 한컴의 HWP 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
// (한컴 「한글 문서 파일 형식 5.0」 revision 1.3 공개 문서를 보고 직접 작성. 외부 해석 라이브러리 없음)
// 의존: hwp-doc.js(HwpDoc.Error·register), vendor/fflate.min.js(inflateSync = 압축 해제만)
// 흐름: OLE 복합 파일(CFB) 읽기 → FileHeader(압축·암호·배포용) → DocInfo(글꼴·글자 모양·문단 모양·테두리/배경·그림 목록)
//      → BodyText/SectionN(문단·글자 모양 구간·컨트롤: 표·그림·글상자·각주·쪽 나눔) → 공통 모델
// 해석에 실패하면 PrvText(문서에 들어 있는 미리보기 글자)라도 보여 주고 doc.partial = true로 「일부만 표시」를 알립니다.
// 단위: 길이 HWPUNIT(1/7200인치) 그대로. 문단 여백·간격은 파일에 2배 값으로 저장돼 있어 ÷2(HWPX의 hp:default 값과 같은 규칙).
(function (G) {
  const HwpDoc = G.HwpDoc;
  if (!HwpDoc || !HwpDoc.Error) return;
  const HwpError = HwpDoc.Error;
  const END = 0xfffffffa; // 이 값 이상은 사슬 끝·빈 칸(FREESECT·ENDOFCHAIN 등)
  const MAX_STREAM = 200 * 1048576;

  // ---------- 바이트 읽기 도구(범위를 넘으면 0) ----------
  class Rd {
    constructor(u8) { this.u = u8; this.v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); this.n = u8.length; }
    u8(o) { return o + 1 <= this.n ? this.u[o] : 0; }
    u16(o) { return o + 2 <= this.n ? this.v.getUint16(o, true) : 0; }
    i16(o) { return o + 2 <= this.n ? this.v.getInt16(o, true) : 0; }
    u32(o) { return o + 4 <= this.n ? this.v.getUint32(o, true) : 0; }
    i32(o) { return o + 4 <= this.n ? this.v.getInt32(o, true) : 0; }
    str(o, len) { let s = ""; for (let i = 0; i < len && o + i * 2 + 2 <= this.n; i++) s += String.fromCharCode(this.u16(o + i * 2)); return s; }
  }

  // ---------- OLE 복합 파일(CFB) ----------
  function readCfb(u8) {
    if (u8.length < 1024) throw new HwpError("broken", "CFB 너무 작음");
    const r = new Rd(u8);
    const ssz = 1 << r.u16(0x1e), msz = 1 << r.u16(0x20);
    if ((ssz !== 512 && ssz !== 4096) || msz !== 64) throw new HwpError("broken", "CFB 머리");
    const nFat = r.u32(0x2c), dir0 = r.u32(0x30), cutoff = r.u32(0x38) || 4096, mfat0 = r.u32(0x3c), difat0 = r.u32(0x44);
    const secOff = (s) => ssz + s * ssz;
    const nSecs = Math.ceil((u8.length - ssz) / ssz);
    // FAT 섹터 목록(머리의 109개 + DIFAT 사슬)
    const fatSecs = [];
    for (let i = 0; i < 109 && fatSecs.length < nFat; i++) { const v = r.u32(0x4c + i * 4); if (v < END) fatSecs.push(v); }
    for (let d = difat0, guard = 0; d < END && fatSecs.length < nFat && guard < nSecs; guard++) {
      if (d >= nSecs) throw new HwpError("broken", "DIFAT");
      for (let j = 0; j < ssz / 4 - 1 && fatSecs.length < nFat; j++) { const v = r.u32(secOff(d) + j * 4); if (v < END) fatSecs.push(v); }
      d = r.u32(secOff(d) + ssz - 4);
    }
    const per = ssz / 4;
    const fat = new Uint32Array(fatSecs.length * per);
    fatSecs.forEach((s, k) => { if (s >= nSecs) throw new HwpError("broken", "FAT"); for (let j = 0; j < per; j++) fat[k * per + j] = r.u32(secOff(s) + j * 4); });
    const chain = (start, table) => {
      const out = [];
      for (let s = start; s < END; s = table[s]) {
        if (s >= table.length || out.length > table.length) throw new HwpError("broken", "섹터 사슬");
        out.push(s);
      }
      return out;
    };
    const readBig = (start, size) => {
      const secs = chain(start, fat);
      const len = size == null ? secs.length * ssz : Math.min(size, secs.length * ssz);
      const out = new Uint8Array(len);
      for (let k = 0, p = 0; k < secs.length && p < len; k++, p += ssz) {
        if (secs[k] >= nSecs) throw new HwpError("broken", "섹터 범위");
        const o = secOff(secs[k]);
        out.set(u8.subarray(o, Math.min(o + ssz, o + len - p, u8.length)), p);
      }
      return out;
    };
    // 디렉터리(항목 128바이트)
    const dir = readBig(dir0);
    const dr = new Rd(dir);
    const ents = [];
    for (let o = 0; o + 128 <= dir.length; o += 128) {
      const nl = Math.min(64, dr.u16(o + 64));
      ents.push({ name: dr.str(o, Math.max(0, nl / 2 - 1)), type: dir[o + 66], l: dr.u32(o + 68), rt: dr.u32(o + 72), c: dr.u32(o + 76), start: dr.u32(o + 116), size: dr.u32(o + 120) });
    }
    const root = ents[0];
    if (!root || root.type !== 5) throw new HwpError("broken", "CFB 뿌리");
    const mini = root.size ? readBig(root.start, root.size) : new Uint8Array(0);
    const mfat = mfat0 < END ? (() => { const b = readBig(mfat0); const rr = new Rd(b); const t = new Uint32Array(b.length / 4); for (let i = 0; i < t.length; i++) t[i] = rr.u32(i * 4); return t; })() : new Uint32Array(0);
    const readMini = (start, size) => {
      const secs = chain(start, mfat);
      const out = new Uint8Array(Math.min(size, secs.length * msz));
      for (let k = 0, p = 0; k < secs.length && p < out.length; k++, p += msz) {
        const o = secs[k] * msz;
        if (o >= mini.length) throw new HwpError("broken", "미니 섹터");
        out.set(mini.subarray(o, Math.min(o + msz, o + out.length - p)), p);
      }
      return out;
    };
    // 이름 트리(빨강-검정 트리: 왼쪽·오른쪽 형제, 저장소의 자식) → "BodyText/Section0" 같은 경로
    const map = {};
    const seen = new Set();
    const walk = (i, prefix) => {
      const stack = [i];
      while (stack.length) {
        const k = stack.pop();
        if (k >= ents.length || seen.has(k)) continue;
        seen.add(k);
        const e = ents[k];
        if (e.type === 1 || e.type === 2) {
          map[(prefix + e.name).toLowerCase()] = e;
          e.path = prefix + e.name;
          if (e.type === 1 && e.c < END) walk(e.c, prefix + e.name + "/");
        }
        if (e.l < END) stack.push(e.l);
        if (e.rt < END) stack.push(e.rt);
      }
    };
    if (root.c < END) walk(root.c, "");
    return {
      names: Object.values(map).map((e) => e.path),
      has: (p) => !!map[p.toLowerCase()],
      get(p) {
        const e = map[p.toLowerCase()];
        if (!e || e.type !== 2) return null;
        if (e.size > MAX_STREAM) throw new HwpError("broken", "스트림이 너무 큼");
        return e.size < cutoff ? readMini(e.start, e.size) : readBig(e.start, e.size);
      },
    };
  }

  // ---------- 압축 해제(raw deflate) ----------
  const inflate = (b) => {
    if (!G.fflate || !G.fflate.inflateSync) throw new HwpError("broken", "fflate 없음");
    return G.fflate.inflateSync(b);
  };

  // ---------- 레코드: 머리 32비트 = 태그 10 · 수준 10 · 크기 12(0xfff면 다음 DWORD) ----------
  const T = { DOC_PROPS: 16, ID_MAP: 17, BIN_DATA: 18, FACE: 19, BORDER_FILL: 20, CHAR_SHAPE: 21, NUMBERING: 23, BULLET: 24, PARA_SHAPE: 25,
    PARA_HEADER: 66, PARA_TEXT: 67, PARA_CHAR_SHAPE: 68, CTRL_HEADER: 71, LIST_HEADER: 72, PAGE_DEF: 73, SHAPE_COMPONENT: 76, TABLE: 77, PICTURE: 85, OLE: 84, EQEDIT: 88 };
  function records(u8) {
    const r = new Rd(u8), out = [];
    let p = 0;
    while (p + 4 <= u8.length) {
      const h = r.u32(p); p += 4;
      let size = h >>> 20;
      if (size === 0xfff) { if (p + 4 > u8.length) break; size = r.u32(p); p += 4; }
      const end = Math.min(u8.length, p + size);
      out.push({ tag: h & 0x3ff, level: (h >>> 10) & 0x3ff, d: u8.subarray(p, end), kids: [] });
      p = end;
    }
    return out;
  }
  // 수준으로 나무 만들기(다음 레코드의 수준이 더 깊으면 자식)
  function tree(recs) {
    const root = { level: -1, kids: [] }, st = [root];
    for (const rec of recs) {
      while (st.length > 1 && st[st.length - 1].level >= rec.level) st.pop();
      st[st.length - 1].kids.push(rec);
      st.push(rec);
    }
    return root.kids;
  }
  const ctrlId = (d) => { const v = new Rd(d).u32(0); return String.fromCharCode(v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); };
  const rgb = (v) => "#" + [v & 255, (v >>> 8) & 255, (v >>> 16) & 255].map((x) => x.toString(16).padStart(2, "0")).join(""); // COLORREF 0x00BBGGRR

  // ---------- DocInfo ----------
  const LINE = ["NONE", "SOLID", "DASH", "DOT", "DASH_DOT", "DASH_DOT_DOT", "LONG_DASH", "CIRCLE", "DOUBLE_SLIM", "SLIM_THICK", "THICK_SLIM", "SLIM_THICK_SLIM", "WAVE", "DOUBLE_WAVE", "SOLID", "SOLID", "SOLID", "SOLID"];
  const LW = ["0.1", "0.12", "0.15", "0.2", "0.25", "0.3", "0.4", "0.5", "0.6", "0.7", "1.0", "1.5", "2.0", "3.0", "4.0", "5.0"];
  const LS = ["PERCENT", "FIXED", "BETWEEN_LINES", "AT_LEAST"];
  const ALIGN = ["JUSTIFY", "LEFT", "RIGHT", "CENTER", "DISTRIBUTE", "DISTRIBUTE_SPACE"];
  const SERIF_RE = /바탕|명조|궁서|batang|myeongjo|gungsuh|serif|times/i;

  function readDocInfo(u8, skip) {
    const H = { sections: 0, faces: [], hangulN: 0, bins: [], borders: [], chars: [], paras: [], bullets: [], numberings: 0 };
    let idmap = [];
    for (const rec of records(u8)) {
      const r = new Rd(rec.d);
      switch (rec.tag) {
        case T.DOC_PROPS: H.sections = r.u16(0); break;
        case T.ID_MAP: idmap = Array.from({ length: Math.floor(rec.d.length / 4) }, (_, i) => r.i32(i * 4)); H.hangulN = idmap[1] || 0; break;
        case T.FACE: H.faces.push(r.str(3, r.u16(1))); break;
        case T.BIN_DATA: {
          const at = r.u16(0), type = at & 15;
          let o = 2;
          if (type === 0) { o += 2 + r.u16(o) * 2; o += 2 + r.u16(o) * 2; H.bins.push({ link: true }); break; }
          const id = r.u16(o); o += 2;
          const ext = type === 1 ? r.str(o + 2, r.u16(o)).toLowerCase() : "ole";
          H.bins.push({ id, ext, comp: (at >> 4) & 3 });
          break;
        }
        case T.BORDER_FILL: {
          // 네 방향 선이 「종류·굵기·색」 6바이트씩 이어서 저장됨(왼쪽·오른쪽·위·아래), 대각선 6바이트, 그다음 채우기 정보
          const side = (k) => { const o = 2 + k * 6; const t = r.u8(o); return { style: LINE[t] || "SOLID", width: (LW[r.u8(o + 1)] || "0.12") + " mm", color: rgb(r.u32(o + 2)) }; };
          let bg = "";
          const ft = r.u32(32);
          if (ft & 1) { const c = r.u32(36); if (c >>> 24 === 0 && c !== 0xffffff) bg = rgb(c); }
          H.borders.push({ l: side(0), r: side(1), t: side(2), b: side(3), bg });
          break;
        }
        case T.CHAR_SHAPE: {
          const face = H.faces[r.u16(0)] || "";
          const rel = r.u8(28) || 100;
          const at = r.u32(46);
          const shade = r.u32(60);
          H.chars.push({
            sz: Math.round((r.i32(42) * rel) / 100) / 100 || 10,
            color: rgb(r.u32(52)), b: !!(at & 2), i: !!(at & 1),
            u: ((at >> 2) & 3) === 1, s: ((at >> 18) & 7) !== 0,
            sup: !!(at & (1 << 15)), sub: !!(at & (1 << 16)),
            font: face, serif: SERIF_RE.test(face),
            bg: shade >>> 24 === 0 && shade !== 0xffffff ? rgb(shade) : "",
          });
          break;
        }
        case T.NUMBERING: H.numberings++; break;
        case T.BULLET: { const c = r.u16(12); H.bullets.push(c >= 0x20 && c !== 0xffff ? String.fromCharCode(c) : "•"); break; }
        case T.PARA_SHAPE: {
          const a1 = r.u32(0);
          const newLs = rec.d.length >= 54;
          const lt = newLs ? r.u32(46) & 31 : a1 & 3;
          const lv = newLs ? r.i32(50) : r.i32(24);
          const half = (o) => Math.round(r.i32(o) / 2);
          H.paras.push({
            align: ALIGN[(a1 >> 2) & 7] || "JUSTIFY",
            ml: half(4), mr: half(8), indent: half(12), before: half(16), after: half(20),
            lh: { type: LS[lt] || "PERCENT", v: lt === 0 ? lv || 160 : Math.round(lv / 2) },
            head: (a1 >> 23) & 3, headId: r.u16(30), level: (a1 >> 25) & 7, brkBefore: !!(a1 & (1 << 19)),
          });
          break;
        }
        default: break;
      }
    }
    void skip;
    return H;
  }

  // ---------- 본문 ----------
  const DEF_ST = { sz: 10, color: "#000000", b: false, i: false, u: false, s: false, sup: false, sub: false, font: "", serif: false, bg: "" };
  const DEF_PP = { align: "JUSTIFY", ml: 0, mr: 0, indent: 0, before: 0, after: 0, lh: { type: "PERCENT", v: 160 } };
  // 제어 문자 0~31: 글자 하나짜리(char) / 8글자 차지(inline·extended). extended만 컨트롤(CTRL_HEADER)을 가리킴
  const ONE = new Set([0, 10, 13, 24, 25, 26, 27, 28, 29, 30, 31]);
  const EXT = new Set([1, 2, 3, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23]);
  const IMG_SIG = (b) => {
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
    if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
    if (b[0] === 0x42 && b[1] === 0x4d) return "image/bmp";
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57) return "image/webp";
    return "";
  };

  function paraOf(node, ctx) {
    const r = new Rd(node.d);
    const pp = ctx.H.paras[r.u16(8)] || DEF_PP;
    const brk = r.u8(11);
    const para = { align: pp.align, ml: pp.ml, mr: pp.mr, indent: pp.indent, before: pp.before, after: pp.after, lh: pp.lh, brk: !!(brk & 0x05) || !!pp.brkBefore, items: [] };
    ctx.doc.stats.paras++;
    if (pp.head === 3) {
      const b = ctx.H.bullets[pp.headId - 1];
      if (b) para.label = { s: b + " ", st: null };
    } else if (pp.head === 1 || pp.head === 2) ctx.skip("문단 번호·개요 번호");
    let text = null, shapes = null;
    const ctrls = [];
    for (const k of node.kids) {
      if (k.tag === T.PARA_TEXT) text = k.d;
      else if (k.tag === T.PARA_CHAR_SHAPE) shapes = k.d;
      else if (k.tag === T.CTRL_HEADER) ctrls.push(k);
    }
    // 글자 모양 구간: [시작 위치(WCHAR 단위), 글자 모양 id]
    const runs = [];
    if (shapes) { const sr = new Rd(shapes); for (let o = 0; o + 8 <= shapes.length; o += 8) runs.push([sr.u32(o), sr.u32(o + 4)]); }
    if (!runs.length) runs.push([0, 0]);
    const stAt = (pos) => { let id = runs[0][1]; for (const [p, i] of runs) { if (p <= pos) id = i; else break; } return ctx.H.chars[id] || DEF_ST; };
    para.st = stAt(0);
    if (para.label) para.label.st = para.st;
    if (!text) return [para];
    const tr = new Rd(text), n = text.length >> 1;
    let buf = "", bufSt = null, ci = 0;
    const out = para.items;
    const flush = () => { if (buf) { out.push({ k: "t", s: buf, st: bufSt }); buf = ""; } };
    for (let i = 0; i < n; ) {
      const c = tr.u16(i * 2);
      const st = stAt(i);
      if (c >= 32) {
        if (bufSt !== st) { flush(); bufSt = st; }
        buf += String.fromCharCode(c);
        i++;
        continue;
      }
      if (ONE.has(c)) {
        if (c === 10) { flush(); out.push({ k: "br" }); }
        else if (c === 24) { if (bufSt !== st) { flush(); bufSt = st; } buf += "-"; }
        else if (c === 30 || c === 31) { if (bufSt !== st) { flush(); bufSt = st; } buf += c === 30 ? " " : " "; }
        i++;
        continue;
      }
      // 8글자 차지 제어 문자
      if (c === 9) { flush(); out.push({ k: "tab", st }); }
      else if (EXT.has(c)) {
        flush();
        const ctrl = ctrls[ci++];
        if (ctrl) ctrlOf(ctrl, st, out, ctx);
      }
      i += 8;
    }
    flush();
    // 글자 없이 표·글상자만 든 문단: 내어쓰기는 첫 줄(개체) 위치에 영향이 없음 → 왼쪽으로 밀리지 않게 0
    if (para.indent < 0 && !out.some((x) => x.k === "t" && x.s.trim()) && out.some((x) => x.k === "tbl" || x.k === "box")) para.indent = 0;
    return [para];
  }

  // 문단 목록(PARA_HEADER 형제들) → 모델 문단들
  const parasOf = (nodes, ctx) => nodes.filter((k) => k.tag === T.PARA_HEADER).flatMap((k) => paraOf(k, ctx));
  // LIST_HEADER 뒤에 오는 문단(같은 수준 형제 또는 자식)
  const listParas = (sibs, at, ctx) => {
    const list = [...sibs[at].kids];
    for (let j = at + 1; j < sibs.length && sibs[j].tag === T.PARA_HEADER; j++) list.push(sibs[j]);
    return parasOf(list, ctx);
  };

  function ctrlOf(node, st, out, ctx) {
    const id = ctrlId(node.d);
    const r = new Rd(node.d);
    switch (id) {
      case "secd": {
        const pd = node.kids.find((k) => k.tag === T.PAGE_DEF);
        if (pd && !ctx.sec.pageSet) {
          const p = new Rd(pd.d);
          let w = p.u32(0), hh = p.u32(4);
          if (p.u32(36) & 1 && w < hh) [w, hh] = [hh, w]; // 용지 방향: 넓게
          if (w > 1000 && hh > 1000) {
            ctx.sec.page = { w, h: hh, ml: p.u32(8) + p.u32(32), mr: p.u32(12), mt: p.u32(16) + p.u32(24), mb: p.u32(20) + p.u32(28) };
            ctx.sec.pageSet = true;
          }
        }
        return;
      }
      case "cold": { const cols = (r.u16(4) >> 2) & 0xff; if (cols > 1) ctx.skip("다단(한 단으로 표시)"); return; }
      case "tbl ": out.push(tableOf(node, ctx)); return;
      case "gso ": gsoOf(node, ctx, out); return;
      case "eqed": {
        const eq = node.kids.find((k) => k.tag === T.EQEDIT);
        const er = eq ? new Rd(eq.d) : null;
        out.push({ k: "eq", s: er ? er.str(6, er.u16(4)).trim() : "", st });
        ctx.skip("수식(글자로 표시)");
        return;
      }
      case "head": ctx.skip("머리말"); return;
      case "foot": ctx.skip("꼬리말"); return;
      case "fn  ": case "en  ": {
        const n = ctx.nextNote();
        out.push({ k: "note", n, st });
        const k = node.kids, li = k.findIndex((x) => x.tag === T.LIST_HEADER);
        ctx.sec.notes.push({ n, paras: li >= 0 ? listParas(k, li, ctx) : parasOf(k, ctx) });
        return;
      }
      case "pgnp": ctx.skip("쪽 번호"); return;
      case "tcmt": ctx.skip("숨은 설명"); return;
      default: return; // 필드(%…), 책갈피, 자동 번호, 새 번호, 감추기 등 화면 표시 없는 것
    }
  }

  // 개체 공통 속성: [0]컨트롤 id [4]속성 [8]세로 [12]가로 [16]폭 [20]높이
  const objOf = (d) => { const r = new Rd(d); const at = r.u32(4); return { at, inline: !!(at & 1), w: r.u32(16), h: r.u32(20), halign: ["LEFT", "CENTER", "RIGHT", "LEFT", "LEFT"][(at >> 10) & 7] || "LEFT" }; };

  function tableOf(node, ctx) {
    ctx.doc.stats.tables++;
    const o = objOf(node.d);
    const k = node.kids;
    const ti = k.findIndex((x) => x.tag === T.TABLE);
    const tr = ti >= 0 ? new Rd(k[ti].d) : null;
    const defPad = tr ? [tr.u16(10), tr.u16(12), tr.u16(14), tr.u16(16)] : [510, 510, 141, 141];
    const cells = [];
    for (let j = ti + 1; j < k.length; j++) {
      if (k[j].tag !== T.LIST_HEADER) continue;
      const d = k[j].d, r = new Rd(d);
      // 문단 리스트 헤더(실제 파일: 문단 수 4 + 속성 4 = 8바이트) 다음에 셀 속성 26바이트
      const b = d.length >= 34 ? 8 : 6;
      const at = b === 8 ? r.u32(4) : r.u32(2);
      const bfId = r.u16(b + 24);
      let pad = [r.u16(b + 16), r.u16(b + 18), r.u16(b + 20), r.u16(b + 22)];
      if (pad.some((x) => x > 20000)) pad = defPad; // 0xffff 등 = 표 기본 안쪽 여백을 따름
      cells.push({
        col: r.u16(b), row: r.u16(b + 2),
        cs: Math.max(1, r.u16(b + 4)), rs: Math.max(1, r.u16(b + 6)),
        w: r.u32(b + 8), h: r.u32(b + 12),
        va: ["TOP", "CENTER", "BOTTOM", "CENTER"][(at >> 5) & 3],
        bf: ctx.H.borders[bfId - 1] || null,
        pad: pad.some((x) => x) ? pad : defPad,
        paras: fitParas(listParas(k, j, ctx), r.u32(b + 8) - pad[0] - pad[1]),
      });
    }
    const nRows = Math.max(tr ? tr.u16(4) : 0, ...cells.map((c) => c.row + 1));
    const nCols = Math.max(tr ? tr.u16(6) : 0, ...cells.map((c) => c.col + c.cs));
    const rows = Array.from({ length: nRows }, () => []);
    cells.sort((a, b) => a.row - b.row || a.col - b.col).forEach((c) => { if (rows[c.row]) rows[c.row].push(c); });
    const cols = colWidths(cells, nCols);
    rows.forEach((row) => row.forEach((c) => { delete c.col; delete c.row; }));
    const t = { k: "tbl", w: o.w, align: o.halign, inline: o.inline, rows: rows.filter((x) => x.length) };
    if (cols) { t.cols = cols; t.w = cols.reduce((a, b) => a + b, 0); }
    return t;
  }

  // 칸·쪽 폭보다 큰 여백·들여쓰기/내어쓰기는 한글처럼 무시(서식 표에서 칸 밖으로 글자가 밀려나는 것 방지)
  function fitParas(paras, avail) {
    if (!(avail > 0)) return paras;
    for (const p of paras) {
      const room = avail - 1000; // 적어도 10pt는 글자 자리로 남김
      if (p.ml + p.mr > room) { p.ml = 0; p.mr = 0; }
      if (p.ml + p.mr + Math.abs(p.indent) > room) p.indent = 0;
      // 칸·쪽보다 넓은 표·그림은 그 폭에 맞게 줄임(안쪽 표가 바깥 칸 밖으로 삐져나오는 것 방지)
      const lim = avail - p.ml - p.mr;
      for (const it of p.items) {
        if (it.k === "tbl" && it.cols && it.w > lim && lim > 0) { const f = lim / it.w; it.cols = it.cols.map((x) => Math.floor(x * f)); it.w = it.cols.reduce((x, y) => x + y, 0); }
        else if (it.k === "img" && it.w > lim && lim > 0) { const f = lim / it.w; it.w = Math.floor(it.w * f); it.h = Math.floor(it.h * f); }
      }
    }
    return paras;
  }

  // 칸 주소·폭으로 열 경계(x)를 풀어 열 폭 목록을 만듦(병합이 많은 서식 표도 열이 어긋나지 않게). 못 풀면 null → 브라우저 자동 배치
  function colWidths(cells, n) {
    if (!n || n > 400) return null;
    const x = new Array(n + 1).fill(null);
    x[0] = 0;
    for (let pass = 0; pass < n + 2; pass++) {
      let changed = false;
      for (const c of cells) {
        const a = c.col, b = c.col + c.cs;
        if (b > n || !c.w) continue;
        if (x[a] != null && x[b] == null) { x[b] = x[a] + c.w; changed = true; }
        else if (x[b] != null && x[a] == null) { x[a] = x[b] - c.w; changed = true; }
      }
      if (!changed) break;
    }
    // 못 정한 경계는 앞뒤 아는 경계 사이를 고르게 나눔
    for (let i = 1; i <= n; i++) {
      if (x[i] != null) continue;
      let j = i + 1;
      while (j <= n && x[j] == null) j++;
      if (j > n) return null;
      for (let k = i; k < j; k++) x[k] = x[i - 1] + ((x[j] - x[i - 1]) * (k - i + 1)) / (j - i + 1);
    }
    const w = [];
    for (let i = 0; i < n; i++) { const v = x[i + 1] - x[i]; if (!(v > 0)) return null; w.push(Math.round(v)); }
    return w;
  }

  // 그리기 개체(gso): 그림, 묶음, 글상자 글자. 선·면 모양은 1차 범위 밖
  function gsoOf(node, ctx, out) {
    const o = objOf(node.d);
    const sc = node.kids.find((k) => k.tag === T.SHAPE_COMPONENT);
    if (!sc) { ctx.skip("도형 그림"); return; }
    shapeOf(sc, ctx, out, o, true);
  }
  function shapeOf(sc, ctx, out, o, top) {
    const r = new Rd(sc.d);
    const sid = ctrlId(sc.d);
    const b = top ? 8 : 4; // 맨 위 개체는 id가 두 번 기록됨
    const w = top && o.w ? o.w : r.u32(b + 20) || r.u32(b + 12);
    const hh = top && o.h ? o.h : r.u32(b + 24) || r.u32(b + 16);
    if (sid === "$pic") {
      const pic = sc.kids.find((k) => k.tag === T.PICTURE);
      const src = pic ? ctx.binUrl(new Rd(pic.d).u16(71)) : null;
      if (!src) { ctx.skip("표시할 수 없는 그림 형식"); out.push({ k: "miss", s: "[그림]" }); return; }
      ctx.doc.stats.images++;
      out.push({ k: "img", src, w, h: hh });
      return;
    }
    if (sid === "$con") {
      sc.kids.filter((k) => k.tag === T.SHAPE_COMPONENT).forEach((c) => shapeOf(c, ctx, out, null, false));
      return;
    }
    if (sid === "$ole") { ctx.skip("차트·OLE 개체"); out.push({ k: "miss", s: "[차트·개체]" }); return; }
    const li = sc.kids.findIndex((k) => k.tag === T.LIST_HEADER);
    if (li >= 0) out.push({ k: "box", w, h: hh, paras: fitParas(listParas(sc.kids, li, ctx), w) });
    else ctx.skip("도형 그림");
  }

  // ---------- 전체 ----------
  function header(cfb) {
    const fh = cfb.get("FileHeader");
    if (!fh || fh.length < 40) throw new HwpError("broken", "FileHeader");
    const sig = new TextDecoder("latin1").decode(fh.subarray(0, 17));
    if (sig !== "HWP Document File") throw new HwpError("notdoc");
    const r = new Rd(fh);
    const ver = r.u32(32), flags = r.u32(36);
    return { ver, major: ver >>> 24, compressed: !!(flags & 1), encrypted: !!(flags & 2), dist: !!(flags & 4), drm: !!(flags & 16) };
  }

  function prvText(cfb) {
    const b = cfb.get("PrvText");
    if (!b || b.length < 2) return "";
    return new Rd(b).str(0, b.length >> 1);
  }

  function parseHwp(u8, makeUrl) {
    const cfb = readCfb(u8);
    const fh = header(cfb);
    if (fh.major !== 5) throw new HwpError("hwp", "HWP " + fh.major);
    if (fh.encrypted || fh.drm) throw new HwpError("encrypted");
    if (fh.dist) throw new HwpError("dist");
    const doc = { format: "HWP", sections: [], stats: { paras: 0, tables: 0, images: 0 }, skipped: {}, urls: [] };
    try {
      const un = (b) => (fh.compressed ? inflate(b) : b);
      const di = cfb.get("DocInfo");
      if (!di) throw new HwpError("broken", "DocInfo 없음");
      const skip = (what) => { doc.skipped[what] = (doc.skipped[what] || 0) + 1; };
      const H = readDocInfo(un(di), skip);
      const binCache = {};
      const binUrl = (ref) => {
        if (ref in binCache) return binCache[ref];
        const bin = H.bins[ref - 1];
        let url = null;
        if (bin && !bin.link && bin.ext !== "ole") {
          const name = "BinData/BIN" + bin.id.toString(16).toUpperCase().padStart(4, "0") + "." + bin.ext;
          let raw = cfb.get(name);
          if (raw) {
            let bytes = raw;
            if (bin.comp !== 2 && (fh.compressed || bin.comp === 1)) { try { bytes = inflate(raw); } catch (e) { bytes = raw; } }
            const mime = IMG_SIG(bytes) || IMG_SIG(raw);
            if (mime) { if (!IMG_SIG(bytes)) bytes = raw; url = makeUrl(bytes, mime); doc.urls.push(url); }
          }
        }
        return (binCache[ref] = url);
      };
      const secNames = cfb.names.filter((x) => /^BodyText\/Section\d+$/i.test(x)).sort((a, b) => Number(a.match(/\d+$/)[0]) - Number(b.match(/\d+$/)[0]));
      if (!secNames.length) throw new HwpError("broken", "본문 없음");
      let noteNo = 0;
      for (const sn of secNames) {
        const sec = { page: { w: 59528, h: 84188, ml: 8504, mr: 8504, mt: 5668 + 4252, mb: 4252 + 4252 }, paras: [], notes: [] };
        const ctx = { H, doc, sec, skip, binUrl, nextNote: () => ++noteNo };
        const nodes = tree(records(un(cfb.get(sn))));
        sec.paras = fitParas(parasOf(nodes, ctx), sec.page.w - sec.page.ml - sec.page.mr);
        delete sec.pageSet;
        doc.sections.push(sec);
      }
      if (!doc.sections.some((s) => s.paras.length)) throw new HwpError("broken", "문단 없음");
      return doc;
    } catch (e) {
      // 해석 실패: 미리보기 글자라도
      (doc.urls || []).forEach((u) => { try { URL.revokeObjectURL(u); } catch (x) { /* 무시 */ } });
      let t = "";
      try { t = prvText(cfb); } catch (x) { t = ""; }
      if (!t.trim()) throw e instanceof HwpError ? e : new HwpError("broken", String(e && e.message));
      const st = DEF_ST;
      const paras = t.replace(/\r\n?/g, "\n").split("\n").map((line) => ({ ...DEF_PP, brk: false, st, items: line ? [{ k: "t", s: line, st }] : [] }));
      return { format: "HWP", partial: true, sections: [{ page: { w: 59528, h: 84188, ml: 8504, mr: 8504, mt: 9920, mb: 8504 }, paras, notes: [] }], stats: { paras: paras.length, tables: 0, images: 0 }, skipped: { "일부만 표시(미리보기 글자)": 1 }, urls: [] };
    }
  }

  // 등록: OLE 파일 안에 FileHeader 스트림이 있으면 HWP. 복합 파일이 깨져 목록을 못 읽어도 이름(UTF-16)이 보이면 HWP로 받아 「깨진 파일」 안내
  const cache = new WeakMap();
  const FH = [..."FileHeader"].flatMap((c) => [c.charCodeAt(0), 0]);
  const rawHas = (u8) => {
    const n = Math.min(u8.length, 8 * 1048576);
    outer: for (let i = 0; i + FH.length <= n; i++) {
      for (let j = 0; j < FH.length; j++) if (u8[i + j] !== FH[j]) continue outer;
      return true;
    }
    return false;
  };
  const isHwp = (u8) => {
    if (cache.has(u8)) return cache.get(u8);
    let ok = false;
    try { ok = readCfb(u8).has("FileHeader"); } catch (e) { ok = rawHas(u8); }
    cache.set(u8, ok);
    return ok;
  };
  const blobUrl = (bytes, mime) => URL.createObjectURL(new Blob([bytes], { type: mime }));
  HwpDoc.register({ name: "HWP", test: (u8, info) => info.kind === "cfb" && isHwp(u8), parse: (u8) => parseHwp(u8, blobUrl) });
  HwpDoc.hwp5 = { readCfb, records, tree, parse: parseHwp }; // 시험용
})(typeof window !== "undefined" ? window : globalThis);
