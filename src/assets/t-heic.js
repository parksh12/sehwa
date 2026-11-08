// HEIC JPG 변환 (P2-47): 여러 장 넣기 → 한꺼번에 변환(진행률) → 하나씩 저장 + zip.
// 디코딩: 브라우저가 HEIC를 직접 열면(사파리 등) 그것을 쓰고, 못 열면 t-heic-worker.js(+ vendor/libheif, LGPL-3.0)를 첫 변환 때만 불러옴.
// 메타데이터: 캔버스로 다시 그려 저장하므로 JPG에는 EXIF가 없음. 사용자가 고른 항목(촬영 날짜·기기 / 위치)만 새로 써 넣음. 방향 정보는 넣지 않음(픽셀을 이미 돌려 놓음).
// 의존: tool-kit.js, vendor/fflate.min.js(zip, 무압축). 사진은 서버로 보내지 않습니다.
(function () {
  const box = document.querySelector('[data-tool="heic"]');
  if (!box) return;
  const OPT = { exts: ["heic", "heif", "hif", "jpg", "jpeg"], maxSize: 50 * PT.MB, maxCount: 50, maxTotal: 600 * PT.MB, reject: { png: "PNG·WEBP를 JPG로 바꾸려면 「이미지 용량 줄이기」를 써 주세요.", webp: "PNG·WEBP를 JPG로 바꾸려면 「이미지 용량 줄이기」를 써 주세요.", avif: "AVIF는 아직 지원하지 않아요. HEIC·HEIF 파일을 넣어 주세요.", gif: "GIF는 지원하지 않아요." } };
  const MAX_PIXELS = 50e6;
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const MAX_AREA = IOS ? 16777216 : MAX_PIXELS; // iOS 사파리 캔버스 한계(약 1,677만 화소)
  const QUAL = { high: 0.92, mid: 0.8, low: 0.65 };
  const $ = (s) => box.querySelector(s);
  const run = $("[data-run]"), opts = $(".tk-opts"), first = $(".hc-first");
  const nogps = $('[name="nogps"]'), keepinfo = $('[name="keepinfo"]'), metaHint = $(".hc-meta-hint");
  const ver = (document.currentScript && new URL(document.currentScript.src).searchParams.get("v")) || "";
  const base = document.documentElement.dataset.base || "";

  const list = PT.fileList(box, { onChange: (items) => { run.disabled = !items.length; opts.hidden = !items.length; } });
  PT.dropzone(box, (files) => {
    const { ok, errs } = PT.check(files, OPT, list.files());
    PT.msg(box, errs.join(" "));
    PT.hideResult(box);
    list.add(ok);
  });
  const showMeta = () => {
    const parts = [];
    if (keepinfo.checked) parts.push("촬영 날짜·시각과 기기 이름");
    if (!nogps.checked) parts.push("촬영 위치(GPS)");
    metaHint.textContent = parts.length ? `JPG에 ${parts.join("와 ")}만 남겨요. 그 밖의 사진 정보는 넣지 않아요.` : "JPG에 위치·날짜 같은 사진 정보(EXIF)를 넣지 않아요.";
    metaHint.classList.toggle("warn", !nogps.checked);
  };
  nogps.addEventListener("change", showMeta); keepinfo.addEventListener("change", showMeta); showMeta();

  // ---------- 작업자(libheif) ----------
  let worker = null, seq = 0, nativeHeic = null; // nativeHeic: 이 브라우저가 HEIC를 직접 여는지(null=아직 모름)
  const waits = new Map();
  function getWorker() {
    if (worker) return worker;
    worker = new Worker(`${base}/assets/t-heic-worker.js${ver ? "?v=" + ver : ""}`);
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "progress") { PT.step(box, `HEIC 변환 엔진 받는 중… ${(m.loaded / PT.MB).toFixed(1)} / ${(m.total / PT.MB).toFixed(1)}MB (처음 한 번만)`, m.loaded / m.total); return; }
      const w = waits.get(m.id);
      if (!w) return;
      waits.delete(m.id);
      m.type === "error" ? w.reject(m) : w.resolve(m);
    };
    worker.onerror = (e) => {
      e.preventDefault && e.preventDefault();
      for (const w of waits.values()) w.reject({ code: "engine" });
      waits.clear(); worker = null;
    };
    return worker;
  }
  const call = (msg, transfer) => new Promise((resolve, reject) => { const id = ++seq; waits.set(id, { resolve, reject }); getWorker().postMessage({ ...msg, id }, transfer || []); });

  // ---------- HEIF 상자(ISOBMFF) 읽기: Exif 항목, 색 프로필(ICC) ----------
  const HEIF_BRANDS = ["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1", "mif2", "heif"];
  const fourcc = (u8, p) => String.fromCharCode(u8[p], u8[p + 1], u8[p + 2], u8[p + 3]);
  function isHeif(u8) {
    if (u8.length < 16 || fourcc(u8, 4) !== "ftyp") return false;
    const size = Math.min(u8.length, new DataView(u8.buffer, u8.byteOffset).getUint32(0));
    for (let p = 8; p + 4 <= size; p += 4) if (p !== 12 && HEIF_BRANDS.includes(fourcc(u8, p))) return true;
    return false;
  }
  function boxes(u8, dv, s, e) {
    const out = [];
    let p = s;
    while (p + 8 <= e) {
      let size = dv.getUint32(p), hdr = 8;
      const type = fourcc(u8, p + 4);
      if (size === 1) { if (p + 16 > e) break; size = dv.getUint32(p + 8) * 4294967296 + dv.getUint32(p + 12); hdr = 16; }
      else if (size === 0) size = e - p;
      if (size < hdr || p + size > e) break;
      out.push({ type, s: p + hdr, e: p + size });
      p += size;
    }
    return out;
  }
  function readHeifMeta(u8) {
    const res = { tiff: null, icc: null };
    try {
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      const meta = boxes(u8, dv, 0, u8.length).find((b) => b.type === "meta");
      if (!meta) return res;
      const kids = boxes(u8, dv, meta.s + 4, meta.e);
      const get = (t) => kids.find((b) => b.type === t);
      const rd = (p, n) => (n === 0 ? 0 : n === 4 ? dv.getUint32(p) : n === 8 ? dv.getUint32(p) * 4294967296 + dv.getUint32(p + 4) : n === 2 ? dv.getUint16(p) : 0);
      // 색 프로필: iprp > ipco > colr(prof|rICC)
      const iprp = get("iprp"), ipco = iprp && boxes(u8, dv, iprp.s, iprp.e).find((b) => b.type === "ipco");
      if (ipco) {
        for (const c of boxes(u8, dv, ipco.s, ipco.e)) {
          if (c.type !== "colr" || c.e - c.s < 132) continue;
          const kind = fourcc(u8, c.s);
          if (kind !== "prof" && kind !== "rICC") continue;
          const icc = u8.subarray(c.s + 4, c.e);
          if (fourcc(icc, 36) === "acsp" && fourcc(icc, 16) === "RGB ") { res.icc = icc.slice(); break; }
        }
      }
      // Exif 항목 번호: iinf > infe(item_type "Exif")
      const iinf = get("iinf"), iloc = get("iloc"), idat = get("idat");
      if (!iinf || !iloc) return res;
      const iv = u8[iinf.s];
      const ids = [];
      for (const b of boxes(u8, dv, iinf.s + 4 + (iv === 0 ? 2 : 4), iinf.e)) {
        if (b.type !== "infe") continue;
        const v = u8[b.s];
        if (v < 2) continue;
        const id = v === 2 ? dv.getUint16(b.s + 4) : dv.getUint32(b.s + 4);
        const tp = fourcc(u8, b.s + 4 + (v === 2 ? 2 : 4) + 2);
        if (tp === "Exif") ids.push(id);
      }
      if (!ids.length) return res;
      // 위치: iloc
      const lv = u8[iloc.s];
      let p = iloc.s + 4;
      const offSize = u8[p] >> 4, lenSize = u8[p] & 15, baseSize = u8[p + 1] >> 4, idxSize = lv === 1 || lv === 2 ? u8[p + 1] & 15 : 0;
      p += 2;
      const count = lv < 2 ? dv.getUint16(p) : dv.getUint32(p);
      p += lv < 2 ? 2 : 4;
      for (let i = 0; i < count && p < iloc.e; i++) {
        const id = lv < 2 ? dv.getUint16(p) : dv.getUint32(p);
        p += lv < 2 ? 2 : 4;
        let method = 0;
        if (lv === 1 || lv === 2) { method = dv.getUint16(p) & 15; p += 2; }
        p += 2; // data_reference_index
        const baseOff = rd(p, baseSize); p += baseSize;
        const ext = dv.getUint16(p); p += 2;
        const parts = [];
        for (let k = 0; k < ext; k++) {
          p += idxSize;
          const off = rd(p, offSize); p += offSize;
          const len = rd(p, lenSize); p += lenSize;
          parts.push([off, len]);
        }
        if (!ids.includes(id) || res.tiff) continue;
        const origin = method === 0 ? 0 : method === 1 && idat ? idat.s : -1;
        if (origin < 0) continue;
        const chunks = parts.map(([off, len]) => { const a = origin + baseOff + off; return u8.subarray(a, len ? a + len : (method === 1 ? idat.e : u8.length)); });
        const data = chunks.length === 1 ? chunks[0] : (() => { const t = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0)); let o = 0; for (const c of chunks) { t.set(c, o); o += c.length; } return t; })();
        if (data.length < 12) continue;
        const tiff = data.subarray(4 + new DataView(data.buffer, data.byteOffset).getUint32(0));
        if (tiff.length >= 8 && ((tiff[0] === 0x49 && tiff[1] === 0x49 && tiff[2] === 42) || (tiff[0] === 0x4d && tiff[1] === 0x4d && tiff[3] === 42))) res.tiff = tiff.slice();
      }
    } catch (e) { /* 상자가 깨졌으면 사진 정보 없이 저장 */ }
    return res;
  }

  // ---------- EXIF: 고른 항목만 새 TIFF로 다시 쓰기(바이트 순서는 원본 그대로, 값 바이트를 그대로 옮김) ----------
  const SZ = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
  const INFO0 = [0x010f, 0x0110, 0x0132]; // 제조사, 모델, 수정 일시
  const INFOX = [0x9003, 0x9004, 0x9010, 0x9011, 0x9012, 0x9290, 0x9291, 0x9292]; // 촬영·디지털화 일시, 시간대, 1/100초
  function pickExif(tiff, keepInfo, keepGps) {
    if (!tiff || (!keepInfo && !keepGps)) return null;
    const le = tiff[0] === 0x49, dv = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength), L = tiff.length;
    const ifd = (off) => {
      const m = new Map();
      if (!off || off + 2 > L) return m;
      const n = dv.getUint16(off, le);
      for (let i = 0; i < n; i++) {
        const e = off + 2 + i * 12;
        if (e + 12 > L) break;
        const tag = dv.getUint16(e, le), type = dv.getUint16(e + 2, le), count = dv.getUint32(e + 4, le);
        if (!SZ[type]) continue;
        const size = SZ[type] * count;
        const vo = size <= 4 ? e + 8 : dv.getUint32(e + 8, le);
        if (vo + size > L) continue;
        m.set(tag, { tag, type, count, bytes: tiff.slice(vo, vo + size), ptr: dv.getUint32(e + 8, le) });
      }
      return m;
    };
    const i0 = ifd(dv.getUint32(4, le));
    const ex = i0.has(0x8769) ? ifd(i0.get(0x8769).ptr) : new Map();
    const gp = i0.has(0x8825) ? ifd(i0.get(0x8825).ptr) : new Map();
    const e0 = keepInfo ? INFO0.filter((t) => i0.has(t)).map((t) => i0.get(t)) : [];
    const eX = keepInfo ? INFOX.filter((t) => ex.has(t)).map((t) => ex.get(t)) : [];
    const eG = keepGps ? [...gp.values()].filter((x) => x.tag <= 0x1f) : [];
    if (!e0.length && !eX.length && !eG.length) return null;
    const ptr = (tag) => ({ tag, type: 4, count: 1, bytes: new Uint8Array(4), isPtr: true });
    if (eX.length) e0.push(ptr(0x8769));
    if (eG.length) e0.push(ptr(0x8825));
    const blocks = [e0, eX, eG].map((b) => b.sort((a, c) => a.tag - c.tag));
    const at = [];
    let pos = 8;
    for (const b of blocks) {
      if (!b.length) { at.push(0); continue; }
      at.push(pos);
      pos += 2 + 12 * b.length + 4;
      for (const x of b) if (x.bytes.length > 4) pos += x.bytes.length + (x.bytes.length & 1);
    }
    const out = new Uint8Array(pos), w = new DataView(out.buffer);
    out[0] = out[1] = le ? 0x49 : 0x4d; w.setUint16(2, 42, le); w.setUint32(4, 8, le);
    blocks.forEach((b, k) => {
      if (!b.length) return;
      const o = at[k];
      let d = o + 2 + 12 * b.length + 4;
      w.setUint16(o, b.length, le);
      b.forEach((x, i) => {
        const e = o + 2 + i * 12;
        w.setUint16(e, x.tag, le); w.setUint16(e + 2, x.type, le); w.setUint32(e + 4, x.count, le);
        if (x.isPtr) w.setUint32(e + 8, at[x.tag === 0x8769 ? 1 : 2], le);
        else if (x.bytes.length <= 4) out.set(x.bytes, e + 8);
        else { w.setUint32(e + 8, d, le); out.set(x.bytes, d); d += x.bytes.length + (x.bytes.length & 1); }
      });
      w.setUint32(o + 2 + 12 * b.length, 0, le);
    });
    return out;
  }
  // JPEG에 APP1(Exif)·APP2(ICC) 끼워 넣기: JFIF APP0 바로 뒤
  function segment(marker, head, body) {
    const s = new Uint8Array(4 + head.length + body.length);
    s[0] = 0xff; s[1] = marker; s[2] = (s.length - 2) >> 8; s[3] = (s.length - 2) & 255;
    s.set(head, 4); s.set(body, 4 + head.length);
    return s;
  }
  const ascii = (str) => Uint8Array.from(str, (c) => c.charCodeAt(0));
  function withSegments(jpg, tiff, icc) {
    const segs = [];
    if (tiff) segs.push(segment(0xe1, ascii("Exif\0\0"), tiff));
    if (icc) {
      const CH = 65519, n = Math.ceil(icc.length / CH);
      if (n <= 255) for (let i = 0; i < n; i++) segs.push(segment(0xe2, [...ascii("ICC_PROFILE\0"), i + 1, n], icc.subarray(i * CH, (i + 1) * CH)));
    }
    if (!segs.length || jpg[0] !== 0xff || jpg[1] !== 0xd8) return jpg;
    // 머리 구간(SOI ~ SOS 앞)을 훑어, 브라우저가 넣은 sRGB 색 프로필(APP2 ICC_PROFILE)은 원본 프로필을 넣을 때만 빼고 나머지는 그대로 둠
    const keep = [jpg.subarray(0, 2)];
    let p = 2, app0 = 0;
    while (p + 4 <= jpg.length && jpg[p] === 0xff && jpg[p + 1] !== 0xda) {
      const len = (jpg[p + 2] << 8) | jpg[p + 3];
      if (len < 2 || p + 2 + len > jpg.length) break;
      const seg = jpg.subarray(p, p + 2 + len);
      const isIcc = jpg[p + 1] === 0xe2 && String.fromCharCode(...seg.subarray(4, 16)) === "ICC_PROFILE\0";
      if (!(icc && isIcc)) { keep.push(seg); if (jpg[p + 1] === 0xe0 && keep.length === 2) app0 = 1; }
      p += 2 + len;
    }
    const parts = [...keep.slice(0, 1 + app0), ...segs, ...keep.slice(1 + app0), jpg.subarray(p)];
    const out = new Uint8Array(parts.reduce((n, s) => n + s.length, 0));
    let o = 0;
    for (const s of parts) { out.set(s, o); o += s.length; }
    return out;
  }

  // ---------- 한 장 변환 ----------
  async function nativeDecode(blob) {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    try { await img.decode(); } catch (e) { URL.revokeObjectURL(url); return null; }
    if (!img.naturalWidth) { URL.revokeObjectURL(url); return null; }
    return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  }
  async function convert(file, { quality, maxSide, keepInfo, keepGps }) {
    const buf = await PT.readBuf(file);
    const u8 = new Uint8Array(buf);
    const heif = isHeif(u8);
    const meta = heif ? readHeifMeta(u8) : { tiff: null, icc: null };
    const tiff = pickExif(meta.tiff, keepInfo, keepGps);
    let pic = null, viaWasm = false;
    if (!heif || nativeHeic !== false) {
      pic = await nativeDecode(new Blob([buf], { type: heif ? "image/heic" : "image/jpeg" }));
      if (heif) nativeHeic = !!pic;
    }
    if (!pic && heif) {
      let r;
      try { r = await call({ type: "decode", buf }, [buf]); }
      catch (m) {
        if (m && m.code === "big") throw new Error(`「${file.name}」은(는) ${m.w}×${m.h}로 너무 커서 바꿀 수 없어요(5천만 화소까지).`);
        if (m && m.code === "bad") throw new Error(`「${file.name}」은(는) 깨졌거나 이 도구가 열 수 없는 HEIC예요.`);
        throw Object.assign(new Error("HEIC 변환 엔진을 받지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요."), { fatal: true });
      }
      const c = document.createElement("canvas");
      c.width = r.w; c.height = r.h;
      c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
      pic = { src: c, w: r.w, h: r.h, alpha: r.alpha, done: () => { c.width = c.height = 0; } };
      viaWasm = true;
    }
    if (!pic) throw new Error(heif ? `「${file.name}」은(는) 깨졌거나 이 도구가 열 수 없는 HEIC예요.` : `「${file.name}」은(는) 깨졌거나 읽을 수 없는 이미지예요.`);
    try {
      const { w: w0, h: h0 } = pic;
      if (w0 * h0 > MAX_PIXELS) throw new Error(`「${file.name}」은(는) ${w0}×${h0}로 너무 커서 바꿀 수 없어요(5천만 화소까지).`);
      let s = maxSide && Math.max(w0, h0) > maxSide ? maxSide / Math.max(w0, h0) : 1;
      const capped = w0 * h0 * s * s > MAX_AREA;
      if (capped) s = Math.sqrt((MAX_AREA * 0.98) / (w0 * h0));
      const w = Math.max(1, Math.round(w0 * s)), h = Math.max(1, Math.round(h0 * s));
      let c;
      if (viaWasm && s === 1 && !pic.alpha) c = pic.src; // 그대로 쓰면 캔버스를 하나 덜 만듦
      else {
        c = document.createElement("canvas"); c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); // 투명한 부분은 흰색
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(pic.src, 0, 0, w, h);
      }
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", quality));
      if (c !== pic.src) { c.width = c.height = 0; }
      if (!blob) throw new Error(`「${file.name}」을(를) 저장하지 못했어요. 「긴 변 크기 제한」을 낮춰 다시 해 보세요.`);
      // 엔진으로 푼 픽셀은 원본 색 공간 값 그대로라 원본 색 프로필(예: Display P3)을 함께 넣어야 색이 맞음. 브라우저가 연 경우는 이미 sRGB로 바뀜
      const icc = viaWasm ? meta.icc : null;
      const out = tiff || icc ? new Blob([withSegments(new Uint8Array(await blob.arrayBuffer()), tiff, icc)], { type: "image/jpeg" }) : blob;
      return { blob: out, w, h, w0, h0, capped, viaWasm, kept: !!tiff };
    } finally { pic.done(); }
  }

  run.addEventListener("click", async () => {
    const files = list.files();
    if (!files.length) return;
    const o = {
      quality: QUAL[(box.querySelector('[name="q"]:checked') || {}).value] || QUAL.high,
      maxSide: Number($('[name="maxside"]').value) || 0,
      keepInfo: keepinfo.checked, keepGps: !nogps.checked,
    };
    PT.msg(box, ""); PT.hideResult(box); PT.busy(box, true, "변환 준비 중…");
    const rows = [], zipFiles = {}, errs = [], used = new Set();
    let before = 0, after = 0, capped = 0, wasm = 0, kept = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        PT.step(box, `${i + 1} / ${files.length}장 JPG로 바꾸는 중…`, i / files.length); await PT.tick();
        try {
          const r = await convert(f, o);
          PT.step(box, `${i + 1} / ${files.length}장 JPG로 바꾸는 중…`, (i + 1) / files.length);
          let name = `${PT.base(f.name)}.jpg`;
          while (used.has(name.toLowerCase())) name = name.replace(/(\.jpg)$/, "_$1");
          used.add(name.toLowerCase());
          before += f.size; after += r.blob.size;
          if (r.capped) capped++;
          if (r.viaWasm) wasm++;
          if (r.kept) kept++;
          zipFiles[name] = [new Uint8Array(await r.blob.arrayBuffer()), { level: 0 }]; // 무압축(STORE): JPG는 더 줄지 않음
          const href = PT.url(r.blob);
          rows.push(`<li><img src="${href}" alt="" width="44" height="44" loading="lazy"><span class="fl-name">${PT.esc(name)}<small>${r.w0}×${r.h0}${r.w !== r.w0 ? ` → ${r.w}×${r.h}` : ""} · ${PT.size(f.size)} → ${PT.size(r.blob.size)}</small></span><a class="btn ghost" href="${href}" download="${PT.esc(name)}">받기</a></li>`);
        } catch (e) {
          errs.push(e.message || String(e));
          if (e.fatal) break;
        }
      }
      if (errs.length) PT.msg(box, [...new Set(errs)].join(" "));
      if (!rows.length) return;
      const zip = rows.length > 1 ? new Blob([fflate.zipSync(zipFiles)], { type: "application/zip" }) : null;
      const metaLine = kept ? `${kept}장에 고른 사진 정보만 남겼어요${o.keepGps ? "(위치 포함)" : ""}.` : "사진 정보(위치·날짜 등)는 넣지 않았어요.";
      PT.showResult(box, `<p class="tk-done"><b>${rows.length}장을 JPG로 바꿨어요</b> (${PT.size(before)} → ${PT.size(after)})</p>
<p class="hint hc-done-meta">${metaLine}${capped ? ` 아이폰·아이패드 브라우저의 한계 때문에 ${capped}장은 약 1,600만 화소로 줄여 저장했어요.` : ""}</p>
<ul class="flist done hc-done">${rows.join("")}</ul>${zip ? `<div class="tk-dl">${PT.link(zip, "HEIC_JPG변환.zip", `zip으로 한 번에 내려받기 (${rows.length}장)`, "btn big")}</div>` : ""}`);
      if (wasm && first) first.hidden = true;
    } finally { PT.busy(box, false); run.disabled = !list.files().length; }
  });
})();
