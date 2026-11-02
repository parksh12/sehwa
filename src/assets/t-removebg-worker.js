// 배경 지우기 작업자(Web Worker). 의존: vendor/mediapipe (Apache-2.0, 공식 배포본 그대로)
// 사진은 이 작업자 안에서만 처리하고 어디에도 보내지 않습니다. 이 파일이 하는 네트워크 요청은 같은 사이트의 엔진·모델 파일을 받는 것뿐입니다.
// 페이지 대신 작업자에서 돌리는 이유: ① 처리 중에도 화면이 멈추지 않음 ② 페이지 CSP를 넓히지 않고 wasm을 실행할 수 있음
"use strict";
const DIR = new URL("vendor/mediapipe/", self.location.href).href;
const V = new URL(self.location.href).searchParams.get("v") || "";
const q = (f) => DIR + f + (V ? "?v=" + V : "");
// 파일 크기(진행률 계산용, 서버가 Content-Length를 주지 않을 때 대비)
const FILES = [
  { name: "vision_wasm_internal.wasm", size: 11153617 },
  { name: "magic_touch.tflite", size: 6227884 },
];
let seg = null;
let image = null; // 지금 처리 중인 사진(ImageBitmap)
let loading = null;

// MediaPipe 내부 로그(INFO 등)는 오류가 아니므로 debug로만 남김
self.Module = { print: (s) => console.debug(s), printErr: (s) => console.debug(s) };

async function fetchAll() {
  const loaded = FILES.map(() => 0);
  const total = FILES.reduce((n, f) => n + f.size, 0);
  let last = 0;
  const report = (force) => {
    const now = Date.now();
    if (!force && now - last < 120) return;
    last = now;
    const got = loaded.reduce((a, b) => a + b, 0);
    self.postMessage({ type: "progress", loaded: Math.min(got, total), total });
  };
  return Promise.all(FILES.map(async (f, i) => {
    const res = await fetch(q(f.name), { credentials: "same-origin" });
    if (!res.ok) throw new Error(`엔진 파일을 받지 못했어요 (${res.status})`);
    if (!res.body || !res.body.getReader) { const b = new Uint8Array(await res.arrayBuffer()); loaded[i] = b.length; report(true); return b; }
    const reader = res.body.getReader();
    const parts = [];
    let n = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value); n += value.length; loaded[i] = n; report();
    }
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    report(true);
    return out;
  }));
}

async function init() {
  if (seg) return;
  if (!loading) loading = (async () => {
    if (typeof WebAssembly !== "object" || !WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]))) {
      throw new Error("이 브라우저는 배경 지우기 엔진(WebAssembly SIMD)을 지원하지 않아요. 최신 크롬·엣지·사파리·파이어폭스에서 열어 주세요.");
    }
    const [wasm, model] = await fetchAll();
    self.postMessage({ type: "stage", text: "엔진 준비 중…" });
    // 받은 파일을 같은 작업자 안의 blob 주소로 넘김(다시 내려받지 않음)
    const wasmUrl = URL.createObjectURL(new Blob([wasm], { type: "application/wasm" }));
    const modelUrl = URL.createObjectURL(new Blob([model], { type: "application/octet-stream" }));
    const vision = await import(q("vision_bundle.mjs"));
    seg = await vision.InteractiveSegmenter.createFromOptions(
      { wasmLoaderPath: q("vision_wasm_internal.js"), wasmBinaryPath: wasmUrl },
      { baseOptions: { modelAssetPath: modelUrl, delegate: "CPU" }, outputCategoryMask: false, outputConfidenceMasks: true }
    );
    URL.revokeObjectURL(wasmUrl); URL.revokeObjectURL(modelUrl);
  })();
  try { await loading; } catch (e) { loading = null; throw e; }
}

// 점 하나로 대상의 확률 지도(0~255)를 만듦
function maskAt(pt) {
  let out = null;
  seg.segment(image, { keypoint: { x: pt.x, y: pt.y } }, (r) => {
    const m = r.confidenceMasks && r.confidenceMasks[0];
    if (!m) return;
    const f = m.getAsFloat32Array();
    const b = new Uint8Array(f.length);
    for (let i = 0; i < f.length; i++) b[i] = f[i] <= 0 ? 0 : f[i] >= 1 ? 255 : (f[i] * 255 + 0.5) | 0;
    out = { w: m.width, h: m.height, data: b };
  });
  if (!out) throw new Error("대상을 찾지 못했어요.");
  return out;
}

self.onmessage = async (e) => {
  const m = e.data || {};
  try {
    if (m.type === "init") { await init(); self.postMessage({ type: "ready" }); return; }
    if (m.type === "image") { if (image && image.close) image.close(); image = m.bitmap; self.postMessage({ type: "image-ok", id: m.id }); return; }
    if (m.type === "segment") {
      await init();
      if (!image) throw new Error("사진이 없어요.");
      const t0 = performance.now();
      let acc = null;
      for (const pt of m.points) {
        const r = maskAt(pt);
        if (!acc) acc = r;
        else for (let i = 0; i < acc.data.length; i++) if (r.data[i] > acc.data[i]) acc.data[i] = r.data[i]; // 여러 대상: 합치기
      }
      self.postMessage({ type: "mask", id: m.id, w: acc.w, h: acc.h, data: acc.data, ms: Math.round(performance.now() - t0) }, [acc.data.buffer]);
    }
  } catch (err) {
    self.postMessage({ type: "error", id: m.id, message: String((err && err.message) || err) });
  }
};
