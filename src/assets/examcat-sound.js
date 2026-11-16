// P2-74 커닝냥이(이름은 examcat-data.js NAME) — 효과음. 음원 파일 없이 WebAudio로 그 자리에서 합성(지옥에서 살아남기 hell-sound.js와 같은 원칙).
// hell-sound.js는 그 게임의 배경 음악 4곡을 미리 합성해 무거우므로, 짧은 효과음만 쓰는 이 게임은 가벼운 실시간 합성기를 따로 둠.
// 첫 터치(「시험 시작」)에서 AudioContext를 깨움. 탭을 숨기면 소리도 멈춤.
(function () {
  const S = (window.EXCAT = window.EXCAT || {});
  let ac = null, on = true, master = null, typing = null, broken = false, live = 0;
  const ctx = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ac) { ac = new AC(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination); try { ac.addEventListener("error", () => { broken = true; typingOn(false); }); } catch (e) {} } // 오디오 장치 오류가 나면 소리만 끔(게임은 계속)
    if (ac.state === "suspended") ac.resume().catch(() => {});
    return ac;
  };
  function tone(type, f, t0, dur, vol, slide) {
    const c = ac, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  function noise(t0, dur, vol, freq) {
    const c = ac, n = Math.ceil(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = "lowpass"; f.frequency.value = freq || 900; g.gain.value = vol;
    s.connect(f).connect(g).connect(master); s.start(t0);
  }
  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const SFX = {
    click: (t) => tone("triangle", 900, t, 0.06, 0.12, 1300),
    hmm: (t) => { tone("sine", N(67), t, 0.12, 0.18); tone("sine", N(72), t + 0.12, 0.16, 0.18); }, // 돌아보기 예고
    busted: (t) => { tone("square", N(88), t, 0.09, 0.14); tone("square", N(88), t + 0.12, 0.09, 0.14); tone("sawtooth", N(76), t + 0.24, 0.3, 0.12, N(64)); }, // 호루라기
    solve: (t) => { tone("triangle", N(79), t, 0.1, 0.2); tone("triangle", N(84), t + 0.08, 0.2, 0.2); },
    me: (t) => { [72, 76, 79, 84].forEach((n, i) => tone("triangle", N(n), t + i * 0.06, 0.16, 0.18)); },
    wrong: (t) => tone("sawtooth", N(52), t, 0.3, 0.12, N(45)),
    step: (t, v = 1) => { tone("sine", 90, t, 0.09, 0.35 * v, 60); noise(t, 0.05, 0.12 * v, 500); },
    alarm: (t) => { for (let i = 0; i < 4; i++) { tone("square", i % 2 ? N(81) : N(76), t + i * 0.22, 0.2, 0.1); } },
    stage: (t) => { [67, 72, 76, 79, 84].forEach((n, i) => tone("square", N(n), t + i * 0.09, i === 4 ? 0.4 : 0.1, 0.08)); },
    caught: (t) => { [67, 66, 65, 64].forEach((n, i) => tone("sawtooth", N(n - 12), t + i * 0.28, i === 3 ? 0.7 : 0.26, 0.1, i === 3 ? N(n - 14) : 0)); },
    end: (t) => { [72, 76, 79, 76, 79, 84].forEach((n, i) => tone("triangle", N(n), t + i * 0.12, i === 5 ? 0.6 : 0.12, 0.18)); },
    snap: (t) => { noise(t, 0.06, 0.35, 4000); tone("square", 2400, t, 0.04, 0.06); },
    ready: (t) => { tone("sine", N(84), t, 0.08, 0.12); tone("sine", N(91), t + 0.07, 0.12, 0.12); },
    tick: (t) => tone("square", 1800, t, 0.03, 0.05),
  };
  function play(k, v) {
    if (!on || broken || !SFX[k]) return;
    const c = ctx(); if (!c || c.state !== "running") return;
    if (live > 40) return; // 동시에 울리는 소리 상한(노드가 쌓이지 않게)
    live++; setTimeout(() => { live--; }, 900);
    try { SFX[k](c.currentTime + 0.01, v); } catch (e) {}
  }
  // AI가 답을 쓰는 동안 아주 작은 타자 소리
  function typingOn(v) {
    if (!on || !v) { if (typing) { clearInterval(typing); typing = null; } return; }
    if (typing) return;
    typing = setInterval(() => play("tick"), 90);
  }
  function setOn(v) { on = !!v; if (!on) typingOn(false); }
  document.addEventListener("visibilitychange", () => { if (document.hidden) { typingOn(false); if (ac && ac.state === "running") ac.suspend().catch(() => {}); } else if (ac && on) ac.resume().catch(() => {}); });
  S.sound = { unlock: () => ctx(), play, typingOn, setOn, get on() { return on; }, get state() { return ac ? ac.state : "none"; } };
})();
