// HEIC 디코딩 작업자(Web Worker) — P2-47. 의존: vendor/libheif (libheif 1.23.5 + libde265 1.0.15, LGPL-3.0, 공식 배포본 그대로)
// 사진은 이 작업자 안에서만 풀고 어디에도 보내지 않습니다. 이 파일이 하는 네트워크 요청은 같은 사이트의 엔진 파일 2개를 받는 것뿐입니다.
// 작업자에서 돌리는 이유: ① 변환 중에도 화면이 멈추지 않음 ② 페이지 CSP를 넓히지 않고 wasm을 실행할 수 있음
"use strict";
const DIR = new URL("vendor/libheif/", self.location.href).href;
const V = new URL(self.location.href).searchParams.get("v") || "";
const q = (f) => DIR + f + (V ? "?v=" + V : "");
const WASM_SIZE = 1463506; // 진행률 계산용(서버가 Content-Length를 주지 않을 때)
const MAX_PIXELS = 50e6;
let mod = null, loading = null;

async function fetchWasm() {
  const res = await fetch(q("libheif.wasm"));
  if (!res.ok) throw new Error("엔진 파일을 받지 못했어요(" + res.status + ")");
  const total = Number(res.headers.get("content-length")) || WASM_SIZE;
  if (!res.body || !res.body.getReader) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader(), parts = [];
  let got = 0, last = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); got += value.length;
    const now = Date.now();
    if (now - last > 120) { last = now; self.postMessage({ type: "progress", loaded: Math.min(got, total), total }); }
  }
  self.postMessage({ type: "progress", loaded: total, total });
  const out = new Uint8Array(got);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function load() {
  if (mod) return Promise.resolve(mod);
  if (!loading) {
    loading = (async () => {
      const wasmBinary = await fetchWasm();
      importScripts(q("libheif.js"));
      let m = self.libheif({ wasmBinary, print: (s) => console.debug(s), printErr: (s) => console.debug(s) });
      if (m && typeof m.then === "function" && !m.HeifDecoder) m = await m;
      if (!m || !m.HeifDecoder) throw new Error("엔진을 시작하지 못했어요.");
      mod = m;
      return m;
    })().catch((e) => { loading = null; throw e; });
  }
  return loading;
}

async function decode(buf) {
  const m = await load();
  const dec = new m.HeifDecoder();
  let imgs = [];
  try {
    imgs = dec.decode(new Uint8Array(buf));
    if (!imgs.length) throw new Error("bad");
    const im = imgs.find((x) => x.is_primary()) || imgs[0];
    const w = im.get_width(), h = im.get_height();
    if (!w || !h) throw new Error("bad");
    if (w * h > MAX_PIXELS) throw Object.assign(new Error("big"), { w, h });
    const data = new Uint8ClampedArray(w * h * 4);
    const r = await new Promise((resolve) => im.display({ data, width: w, height: h }, resolve));
    if (!r) throw new Error("bad");
    return { w, h, data, alpha: im.has_alpha_channel() };
  } finally {
    imgs.forEach((x) => { try { x.free(); } catch (e) { /* 이미 해제됨 */ } });
    try { if (dec.decoder) m.heif_context_free(dec.decoder); } catch (e) { /* 무시 */ }
  }
}

self.onmessage = async (e) => {
  const { id, type, buf } = e.data || {};
  try {
    if (type === "init") { await load(); self.postMessage({ id, type: "ready" }); return; }
    if (type === "decode") {
      const r = await decode(buf);
      self.postMessage({ id, type: "image", w: r.w, h: r.h, alpha: r.alpha, data: r.data.buffer }, [r.data.buffer]);
    }
  } catch (err) {
    const msg = String((err && err.message) || err);
    self.postMessage({ id, type: "error", code: msg === "big" ? "big" : msg === "bad" ? "bad" : "engine", w: err && err.w, h: err && err.h, message: msg });
  }
};
