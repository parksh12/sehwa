// 지옥에서 살아남기 — 소리 (P2-27). 외부 음원 파일 0.
// 1) WebAudio(OfflineAudioContext)로 칩튠 BGM 4곡과 효과음을 직접 합성 → 2) WAV로 바꿔 <audio> 요소로 재생(P2-23 방식: 모바일 무음·자동 재생 제한 대응)
// 3) 첫 터치(「시작」)에서 모든 <audio>를 무음으로 한 번 재생했다 멈춰 잠금 해제. <audio>가 막히면 WebAudio로 같은 소리를 대신 재생.
(function () {
  const H = (window.HELL = window.HELL || {});
  const SR = 22050;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI 번호 → 주파수
  const buffers = {}, urls = {}, els = {};
  let ready = false, unlocked = false, on = true, bgmKey = null, ac = null, waBgm = null;
  const status = { engine: "audio", plays: 0, fallback: 0 };

  // ---------- 합성 도구 ----------
  function tone(c, dest, type, f, t0, dur, vol, o = {}) {
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + dur);
    if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vibAmt || 8; l.connect(lg).connect(osc.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
    if (o.detune) osc.detune.value = o.detune;
    const a = o.a || 0.005, r = o.r == null ? Math.min(0.08, dur * 0.4) : o.r;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + a);
    g.gain.setValueAtTime(vol, Math.max(t0 + a, t0 + dur - r)); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(dest); osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  let noiseBuf = null;
  function noise(c, dest, t0, dur, vol, o = {}) {
    if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = o.type || "lowpass"; f.frequency.setValueAtTime(o.f || 2000, t0); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur); f.Q.value = o.q || 0.7;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(dest); s.start(t0); s.stop(t0 + dur + 0.02);
  }
  function shaper(c, amt) { const ws = c.createWaveShaper(), n = 1024, cur = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / n) * 2 - 1; cur[i] = ((1 + amt) * x) / (1 + amt * Math.abs(x)); } ws.curve = cur; return ws; }
  function laugh(c, d, t0, vol = 0.3) { [0, 0.16, 0.32, 0.5].forEach((dt, i) => { tone(c, d, "square", 260 - i * 22, t0 + dt, 0.11, vol, { slide: 200 - i * 20, vib: 30, vibAmt: 30 }); tone(c, d, "sawtooth", 130 - i * 11, t0 + dt, 0.11, vol * 0.5); }); }

  // ---------- 효과음 ----------
  const SFX = {
    fanfare: [0.8, (c, d) => { [72, 76, 79].forEach((n, i) => tone(c, d, "square", NOTE(n), i * 0.09, 0.09, 0.22)); tone(c, d, "square", NOTE(84), 0.27, 0.45, 0.22, { vib: 6, vibAmt: 6 }); tone(c, d, "triangle", NOTE(60), 0.27, 0.45, 0.3); tone(c, d, "square", NOTE(79), 0.27, 0.45, 0.12); }],
    death: [1.1, (c, d) => { // 개 짖는 소리 두 번 + 바람 빠지는 소리
      [0, 0.17].forEach((t) => { tone(c, d, "sawtooth", 520, t, 0.11, 0.3, { slide: 180 }); noise(c, d, t, 0.09, 0.25, { f: 1800, type: "bandpass", q: 1.5 }); });
      tone(c, d, "sawtooth", 700, 0.36, 0.7, 0.22, { slide: 70, vib: 18, vibAmt: 40 }); noise(c, d, 0.36, 0.7, 0.12, { f: 3000, f2: 300 });
    }],
    thud: [0.6, (c, d) => { tone(c, d, "sine", 120, 0, 0.5, 0.7, { slide: 35 }); noise(c, d, 0, 0.25, 0.5, { f: 400 }); }],
    shake: [0.9, (c, d) => { noise(c, d, 0, 0.9, 0.5, { f: 180 }); tone(c, d, "triangle", 55, 0, 0.9, 0.4, { vib: 9, vibAmt: 6 }); }],
    laugh: [0.8, (c, d) => laugh(c, d, 0, 0.32)],
    noise: [0.7, (c, d) => { const ws = shaper(c, 50); ws.connect(d); noise(c, ws, 0, 0.7, 0.4, { f: 6000, f2: 500, type: "bandpass", q: 0.6 }); [0, 0.1, 0.2, 0.3].forEach((t, i) => tone(c, ws, "square", 1200 - i * 250, t, 0.06, 0.15)); }],
    tear: [0.9, (c, d) => { noise(c, d, 0, 0.45, 0.5, { f: 7000, f2: 400, type: "highpass" }); [50, 57, 62].forEach((n) => { tone(c, d, "sine", NOTE(n), 0.35, 0.55, 0.18); tone(c, d, "square", NOTE(n + 12), 0.35, 0.55, 0.05); }); }],
    click: [0.08, (c, d) => tone(c, d, "square", 880, 0, 0.05, 0.15, { slide: 1320 })],
    clear: [1.8, (c, d) => { const m = [67, 72, 76, 79, 76, 79, 84]; m.forEach((n, i) => tone(c, d, "square", NOTE(n), i * 0.12, i === m.length - 1 ? 0.9 : 0.11, 0.2, { vib: i === m.length - 1 ? 6 : 0 })); [48, 55, 60].forEach((n) => tone(c, d, "triangle", NOTE(n), 0.72, 1.0, 0.25)); }],
  };
  // ---------- BGM 4곡(반복용) ----------
  function seq(c, d, bpm, bars, fn) { const beat = 60 / bpm; for (let b = 0; b < bars; b++) fn(b, b * 4 * beat, beat); }
  const BGM = {
    f1: [100, 4, (c, d) => { // 저음의 둠스데이 8비트(E 프리지안)
      const bass = [40, 40, 41, 40, 40, 43, 41, 40];
      const lead = [[64, 2], [65, 1], [64, 1], [67, 2], [65, 2], [64, 2], [62, 1], [64, 1], [65, 4], [64, 2], [71, 2], [70, 2], [65, 2], [64, 4]];
      seq(c, d, 100, 4, (b, t0, bt) => { for (let i = 0; i < 8; i++) tone(c, d, "triangle", NOTE(bass[(b * 8 + i) % 8] - (b === 3 && i > 3 ? 2 : 0)), t0 + i * bt * 0.5, bt * 0.45, 0.32); noise(c, d, t0, 0.15, 0.25, { f: 160 }); noise(c, d, t0 + bt * 2, 0.15, 0.25, { f: 160 }); });
      let t = 0; const bt = 60 / 100 / 2; lead.forEach(([n, l]) => { tone(c, d, "square", NOTE(n - 12), t, l * bt * 0.95, 0.07, { vib: 5, vibAmt: 4 }); t += l * bt; });
    }],
    f2: [120, 4, (c, d) => { // 고문 행진 + 악마 웃음
      const bass = [45, 45, 52, 45, 46, 46, 53, 46];
      seq(c, d, 120, 4, (b, t0, bt) => { for (let i = 0; i < 8; i++) tone(c, d, "square", NOTE(bass[i] - (b % 2 ? 0 : 0) - 12), t0 + i * bt * 0.5, bt * 0.3, 0.13); [0, 1, 2, 3].forEach((k) => noise(c, d, t0 + k * bt, 0.05, k % 2 ? 0.18 : 0.3, { f: k % 2 ? 6000 : 200, type: k % 2 ? "highpass" : "lowpass" })); const arp = b % 2 ? [57, 60, 64, 68] : [57, 60, 63, 66]; for (let i = 0; i < 8; i++) tone(c, d, "square", NOTE(arp[i % 4] + 12), t0 + i * bt * 0.5, bt * 0.2, 0.05); });
      laugh(c, d, (60 / 120) * 4 * 2.5, 0.12);
    }],
    f3: [140, 4, (c, d) => { // 디스토션 칩튠(물리법칙 붕괴)
      const ws = shaper(c, 30), g = c.createGain(); g.gain.value = 0.55; ws.connect(g).connect(d);
      seq(c, d, 140, 4, (b, t0, bt) => { const root = [38, 44, 37, 43][b]; for (let i = 0; i < 16; i++) { tone(c, ws, "sawtooth", NOTE(root + [0, 12, 6, 13][i % 4]), t0 + i * bt * 0.25, bt * 0.2, 0.1); } for (let k = 0; k < 4; k++) noise(c, d, t0 + k * bt, 0.06, 0.25, { f: k % 2 ? 5000 : 220, type: k % 2 ? "highpass" : "lowpass" }); tone(c, d, "square", NOTE(root + 36 + (b % 2 ? 1 : -1)), t0 + bt * 2, bt * 1.5, 0.04, { slide: NOTE(root + 30), vib: 11, vibAmt: 20 }); });
    }],
    f4: [76, 4, (c, d) => { // 웅장한 오르간(D단조)
      const ch = [[50, 53, 57, 62], [46, 50, 53, 58], [43, 46, 50, 55], [45, 49, 52, 57]];
      seq(c, d, 76, 4, (b, t0, bt) => { ch[b].forEach((n) => { [0, 12].forEach((o, k) => tone(c, d, k ? "square" : "sine", NOTE(n + o), t0, bt * 4 * 0.98, k ? 0.018 : 0.07, { a: 0.08, r: 0.15, vib: 5, vibAmt: 2 })); }); tone(c, d, "triangle", NOTE(ch[b][0] - 12), t0, bt * 4 * 0.98, 0.25, { a: 0.05 }); const mel = [ch[b][3] + 12, ch[b][2] + 12, ch[b][3] + 12, ch[b][1] + 24]; mel.forEach((n, i) => tone(c, d, "square", NOTE(n), t0 + i * bt, bt * 0.9, 0.035, { vib: 5, vibAmt: 3 })); });
    }],
  };

  // ---------- 렌더 → WAV ----------
  function render(dur, fn, gain = 1) {
    const len = Math.ceil(dur * SR);
    let c; try { c = new OAC(1, len, SR); } catch (e) { c = new OAC(1, Math.ceil(dur * 44100), 44100); }
    const master = c.createGain(); master.gain.value = gain; master.connect(c.destination);
    fn(c, master);
    return new Promise((res, rej) => { const p = c.startRendering(); if (p && p.then) p.then(res, rej); else c.oncomplete = (e) => res(e.renderedBuffer); });
  }
  function wav(buf) {
    const d = buf.getChannelData(0), sr = buf.sampleRate, len = d.length;
    const ab = new ArrayBuffer(44 + len * 2), v = new DataView(ab);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, "RIFF"); v.setUint32(4, 36 + len * 2, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, "data"); v.setUint32(40, len * 2, true);
    const out = new Int16Array(ab, 44); for (let i = 0; i < len; i++) out[i] = Math.max(-32767, Math.min(32767, d[i] * 32767));
    return new Blob([ab], { type: "audio/wav" });
  }
  function makeEl(key, url, loop) { const a = new Audio(); a.src = url; a.preload = "auto"; a.loop = !!loop; a.setAttribute("playsinline", ""); els[key] = a; return a; }
  async function build() {
    if (!OAC) { status.engine = "none"; return; }
    try {
      const jobs = [];
      for (const [k, [dur, fn]] of Object.entries(SFX)) jobs.push(render(dur, fn, 1).then((b) => { buffers[k] = b; urls[k] = URL.createObjectURL(wav(b)); makeEl(k, urls[k], false); }));
      for (const [k, [bpm, bars, fn]] of Object.entries(BGM)) jobs.push(render((60 / bpm) * 4 * bars, fn, 0.55).then((b) => { buffers[k] = b; urls[k] = URL.createObjectURL(wav(b)); }));
      await Promise.all(jobs);
      makeEl("bgm", urls.f1, true);
      ready = true;
      if (pending) { const p = pending; pending = null; bgm(p); }
    } catch (e) { status.engine = "none"; }
  }
  let pending = null;
  const audioCtx = () => { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; if (!ac) ac = new AC(); if (ac.state === "suspended") ac.resume().catch(() => {}); return ac; };
  function waPlay(key, loop) { const a = audioCtx(); if (!a || !buffers[key]) return null; const s = a.createBufferSource(); s.buffer = buffers[key]; s.loop = !!loop; s.connect(a.destination); s.start(); status.fallback++; return s; }

  // 잠금 해제: 사용자가 버튼을 누른 그 순간에 호출
  function unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    audioCtx();
    if (unlocked || !ready) return;
    unlocked = true;
    Object.values(els).forEach((a) => { a.muted = true; const p = a.play(); const done = () => { if (a === els.bgm && bgmKey && on) { a.muted = false; return; } a.pause(); try { a.currentTime = 0; } catch (e) {} a.muted = false; }; if (p && p.then) p.then(done).catch(() => { a.muted = false; }); else done(); });
  }
  function play(key) {
    if (!on || !ready) return;
    const a = els[key]; status.plays++; status.last = key;
    if (!a) return;
    try { a.currentTime = 0; } catch (e) {}
    a.muted = false;
    const p = a.play();
    if (p && p.catch) p.catch((e) => { if (e && e.name !== "AbortError") { waPlay(key); status.engine = "webaudio"; } });
  }
  function bgm(key) { // key: f1~f4 또는 null(정지)
    if (!ready) { pending = key; return; }
    const a = els.bgm;
    if (waBgm) { try { waBgm.stop(); } catch (e) {} waBgm = null; }
    if (!key || !on) { bgmKey = key; a.pause(); return; }
    if (bgmKey !== key || a.src !== urls[key]) { a.src = urls[key]; a.loop = true; }
    bgmKey = key; a.muted = false;
    const p = a.play();
    if (p && p.catch) p.catch((e) => { if (e && e.name !== "AbortError" && bgmKey === key) { waBgm = waPlay(key, true); status.engine = "webaudio"; } });
  }
  function setOn(v) { on = !!v; if (!on) { Object.values(els).forEach((a) => a.pause()); if (waBgm) { try { waBgm.stop(); } catch (e) {} waBgm = null; } } else if (bgmKey) { const k = bgmKey; bgmKey = null; bgm(k); } }
  document.addEventListener("visibilitychange", () => { if (!els.bgm) return; if (document.hidden) els.bgm.pause(); else if (on && bgmKey && unlocked) els.bgm.play().catch(() => {}); });
  build();
  H.sound = { unlock, play, bgm, setOn, get on() { return on; }, get ready() { return ready; }, status, els, current: () => bgmKey };
})();
