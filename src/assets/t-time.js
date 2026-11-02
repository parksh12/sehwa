// 타이머 + 스톱워치. 경과 시간은 항상 Date.now() 기준(백그라운드 탭에서 setInterval이 느려져도 정확).
// P2-23: 알림음은 WAV를 직접 만들어 <audio>로 재생(모바일 무음·자동 재생 제한 대응), WebAudio는 보조.
//        전체 화면(지원 안 하면 가상 전체 화면), 화면 속 화면(Document PiP → 캔버스 영상 PiP). 저장·전송하는 값은 없습니다.
(function () {
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const toast = (m) => (window.NALGI && NALGI.toast ? NALGI.toast(m) : null);
  const baseTitle = document.title;

  // ---------- 공통: 화면 꺼짐 방지(Wake Lock) ----------
  let lock = null, wantLock = false;
  async function keepAwake(on) {
    wantLock = on;
    try {
      if (on && !lock && "wakeLock" in navigator && document.visibilityState === "visible") {
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener("release", () => { lock = null; });
      } else if (!on && lock) { await lock.release(); lock = null; }
    } catch (e) { lock = null; } // 지원하지 않거나 거절되면 조용히 넘어감
  }

  // ---------- 공통: 알림음 ----------
  // 1) WAV 직접 생성: 22.05kHz 16비트 모노, 「삐-삐-삐잉」 0.8초 + 쉼 0.4초 (반복 재생용)
  function makeWav() {
    const sr = 22050, len = Math.round(sr * 1.2), data = new Int16Array(len);
    const tones = [[0, 0.16, 880], [0.22, 0.38, 880], [0.44, 0.8, 1175]];
    for (const [a, b, hz] of tones) {
      for (let i = Math.round(a * sr); i < Math.round(b * sr); i++) {
        const t = i / sr - a, d = b - a, env = Math.min(1, t / 0.01, (d - t) / 0.03);
        const s = Math.sin(2 * Math.PI * hz * t) + 0.35 * Math.sin(2 * Math.PI * hz * 2 * t) + 0.15 * Math.sin(2 * Math.PI * hz * 3 * t);
        data[i] = Math.max(-32767, Math.min(32767, s * env * 0.55 * 32767));
      }
    }
    const buf = new ArrayBuffer(44 + len * 2), v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, "RIFF"); v.setUint32(4, 36 + len * 2, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, "data"); v.setUint32(40, len * 2, true);
    new Int16Array(buf, 44).set(data);
    return new Blob([buf], { type: "audio/wav" });
  }
  const alarm = new Audio();
  alarm.src = URL.createObjectURL(makeWav());
  alarm.preload = "auto";
  alarm.setAttribute("playsinline", "");
  let unlocked = false, ringStopT = 0, ringing = false;
  const mark = (k, v) => document.querySelectorAll('[data-tool="timer"]').forEach((b) => { b.dataset[k] = v; });
  alarm.addEventListener("playing", () => mark("audio", "playing"));
  alarm.addEventListener("pause", () => mark("audio", "paused"));
  // 2) WebAudio(보조): <audio> 재생이 막혔을 때만
  let ac = null;
  const audioCtx = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ac) ac = new AC();
    if (ac.state === "suspended") ac.resume().catch(() => {});
    return ac;
  };
  function beepWA() {
    const a = audioCtx();
    if (!a) return;
    const t0 = a.currentTime;
    [0, 0.18, 0.36].forEach((d, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = "square"; o.frequency.value = i === 2 ? 1175 : 880;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.15);
      o.connect(g).connect(a.destination); o.start(t0 + d); o.stop(t0 + d + 0.16);
    });
  }
  // 3) 잠금 해제: 사용자가 버튼을 누른 그 순간에 무음으로 한 번 재생했다 멈춤(iOS·Android 자동 재생 제한 대응)
  function unlockSound() {
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {} // iOS 17+ Safari: 무음 스위치와 상관없이 재생되는 '재생' 세션
    audioCtx();
    if (unlocked) return;
    alarm.muted = true;
    const p = alarm.play();
    const done = () => { if (ringing) { alarm.muted = false; return; } alarm.pause(); alarm.currentTime = 0; alarm.muted = false; }; // 그사이 알림이 시작됐으면 멈추지 않음
    if (p && p.then) p.then(() => { done(); unlocked = true; mark("unlocked", "1"); }).catch(() => { if (!ringing) alarm.muted = false; });
    else done();
  }
  function ring(box, { loop = true, ms = 10000 } = {}) {
    clearTimeout(ringStopT); ringing = true;
    box.dataset.plays = String((+box.dataset.plays || 0) + 1); // 확인용(화면에는 안 보임)
    alarm.loop = loop; alarm.muted = false;
    try { alarm.currentTime = 0; } catch (e) {}
    const p = alarm.play();
    if (p && p.catch) p.catch((e) => { if (ringing && e && e.name !== "AbortError") { beepWA(); box.dataset.fallback = "webaudio"; } }); // 재생이 막혔을 때만 WebAudio로
    try { if (navigator.vibrate) navigator.vibrate(loop ? [400, 200, 400, 200, 800] : 200); } catch (e) {}
    ringStopT = setTimeout(() => stopSound(), loop ? ms : 1300); // 반복은 약 10초, 미리 듣기는 한 번
  }
  function stopSound() { clearTimeout(ringStopT); ringing = false; alarm.loop = false; alarm.pause(); try { alarm.currentTime = 0; } catch (e) {} try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) {} }

  // ---------- 공통: 전체 화면 (Fullscreen API, 지원 안 하면 가상 전체 화면) ----------
  function setupFullscreen(box) {
    const btn = box.querySelector("[data-fullscreen]"), close = box.querySelector("[data-fs-close]");
    if (!btn) return;
    const real = !!(document.fullscreenEnabled && box.requestFullscreen);
    box.dataset.fsMode = real ? "real" : "virtual";
    const on = () => document.fullscreenElement === box || box.classList.contains("vfs");
    const sync = () => { btn.textContent = on() ? "전체 화면 닫기" : "전체 화면"; if (close) close.hidden = !on(); };
    const enterV = () => { box.classList.add("vfs"); document.documentElement.classList.add("vfs-lock"); sync(); close && close.focus(); };
    const exitV = () => { box.classList.remove("vfs"); document.documentElement.classList.remove("vfs-lock"); sync(); };
    const exit = () => (document.fullscreenElement ? document.exitFullscreen().catch(() => {}) : exitV());
    btn.addEventListener("click", () => {
      if (on()) return exit();
      if (real) box.requestFullscreen().then(sync, enterV); // 막히면 가상 전체 화면으로
      else enterV();
    });
    close && close.addEventListener("click", exit);
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && box.classList.contains("vfs")) exitV(); });
    sync();
  }

  // ---------- 공통: 화면 속 화면(PiP) ----------
  // 데스크톱 Chrome·Edge: Document Picture-in-Picture(작은 창에 남은 시간 + 버튼)
  // 그 밖: 캔버스에 시간을 그려 captureStream → <video> → requestPictureInPicture (iOS는 webkitSetPresentationMode)
  function setupPip(box, { text, sub, act, actLabel }) {
    const btn = box.querySelector("[data-pip]"), hint = box.querySelector(".pip-hint");
    if (!btn) return { update() {} };
    const probe = document.createElement("video");
    const docPip = "documentPictureInPicture" in window;
    const canCanvas = !!HTMLCanvasElement.prototype.captureStream;
    const vidPip = canCanvas && ((document.pictureInPictureEnabled && probe.requestPictureInPicture) || (probe.webkitSupportsPresentationMode && probe.webkitSupportsPresentationMode("picture-in-picture")));
    if (!docPip && !vidPip) {
      btn.hidden = true;
      if (hint) { hint.hidden = false; hint.textContent = "이 브라우저는 화면 속 화면(PiP)을 지원하지 않아요. 크게 보려면 「전체 화면」을 써 주세요."; }
      return { update() {} };
    }
    let win = null, video = null, canvas = null, ctx = null, keep = 0;
    const setMode = (m) => { box.dataset.pip = m; btn.textContent = m ? "화면 속 화면 닫기" : "화면 속 화면"; };
    function draw() {
      const W = canvas.width, H = canvas.height, done = box.dataset.state === "done";
      ctx.fillStyle = done ? "#e5372b" : "#ffffff"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = done ? "#ffffff" : "#141414"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `900 ${Math.round(H * 0.42)}px system-ui, sans-serif`; ctx.fillText(text(), W / 2, H * 0.46);
      ctx.font = `700 ${Math.round(H * 0.12)}px system-ui, sans-serif`; ctx.fillText(sub(), W / 2, H * 0.84);
      ctx.strokeStyle = "#141414"; ctx.lineWidth = 6; ctx.strokeRect(3, 3, W - 6, H - 6);
    }
    function update() {
      if (win && !win.closed) {
        const d = win.document, done = box.dataset.state === "done";
        d.querySelector(".t").textContent = text(); d.querySelector(".s").textContent = sub();
        d.body.classList.toggle("done", done);
        const b = d.querySelector("button"); b.textContent = actLabel(); b.hidden = !actLabel();
      }
      if (video && canvas) draw();
    }
    async function openDoc() {
      win = await documentPictureInPicture.requestWindow({ width: 280, height: 170 });
      const d = win.document;
      d.head.innerHTML = `<meta charset="utf-8"><style>body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-family:system-ui,sans-serif;background:#fff;color:#141414;border:5px solid #141414;box-sizing:border-box}
.t{font-size:min(30vw,52vh);font-weight:900;font-variant-numeric:tabular-nums;line-height:1}.s{font-size:13px;font-weight:700;color:#3d3d3d}
button{font:inherit;font-weight:800;padding:6px 16px;border:2.5px solid #141414;border-radius:10px;background:#141414;color:#fff;cursor:pointer}
body.done{background:#e5372b;color:#fff}body.done .s{color:#fff}</style>`;
      d.body.innerHTML = `<div class="t"></div><div class="s"></div><button type="button"></button>`;
      d.querySelector("button").addEventListener("click", () => { act(); update(); });
      win.addEventListener("pagehide", () => { win = null; setMode(""); });
      setMode("doc"); update();
    }
    async function openVideo() {
      canvas = document.createElement("canvas"); canvas.width = 480; canvas.height = 270; ctx = canvas.getContext("2d"); draw();
      video = document.createElement("video");
      video.muted = true; video.playsInline = true; video.setAttribute("playsinline", ""); video.className = "pip-video";
      box.appendChild(video); // iOS는 문서 안에 있어야 함(화면 밖으로 숨김)
      video.srcObject = canvas.captureStream(4);
      await video.play();
      const leave = () => { closeVideo(); };
      if (video.requestPictureInPicture && document.pictureInPictureEnabled) { await video.requestPictureInPicture(); video.addEventListener("leavepictureinpicture", leave); }
      else { video.webkitSetPresentationMode("picture-in-picture"); video.addEventListener("webkitpresentationmodechanged", () => { if (video && video.webkitPresentationMode !== "picture-in-picture") leave(); }); }
      keep = setInterval(update, 1000); // 1초마다 다시 그림(멈춰 있을 때도)
      setMode("video");
    }
    function closeVideo() {
      clearInterval(keep);
      if (video) { try { video.srcObject && video.srcObject.getTracks().forEach((t) => t.stop()); } catch (e) {} video.remove(); }
      video = canvas = ctx = null; setMode("");
    }
    async function open() {
      if (docPip) { try { await openDoc(); return; } catch (e) { win = null; } }
      if (vidPip) await openVideo();
    }
    function close() {
      if (win) { win.close(); win = null; }
      if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
      closeVideo();
    }
    btn.addEventListener("click", () => { if (box.dataset.pip) close(); else open().catch(() => { closeVideo(); toast("화면 속 화면을 열 수 없어요"); }); });
    setMode("");
    return { update };
  }

  // ---------- 타이머 ----------
  const tm = document.querySelector('[data-tool="timer"]');
  if (tm) {
    const disp = tm.querySelector(".clock"), state = tm.querySelector(".tm-state");
    const H = tm.querySelector('[name="h"]'), M = tm.querySelector('[name="m"]'), S = tm.querySelector('[name="s"]');
    const bStart = tm.querySelector("[data-start]"), bPause = tm.querySelector("[data-pause]"), bReset = tm.querySelector("[data-reset]"), bStop = tm.querySelector("[data-silence]");
    let total = 0, left = 0, endAt = 0, running = false, tick = null;
    const fmt = (ms) => { const sec = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`; };
    const inputMs = () => ((Math.max(0, +H.value || 0) * 3600) + (Math.max(0, +M.value || 0) * 60) + Math.max(0, +S.value || 0)) * 1000;
    const LABEL = { idle: "대기", run: "진행 중", pause: "일시정지", done: "끝!" };
    const pip = setupPip(tm, {
      text: () => (tm.dataset.state === "done" ? "끝!" : disp.textContent),
      sub: () => `타이머 · ${LABEL[tm.dataset.state] || ""}`,
      act: () => { const st = tm.dataset.state; if (st === "run") pause(); else if (st === "pause") start(); else if (st === "done") silence(); },
      actLabel: () => ({ run: "일시정지", pause: "다시 시작", done: "알림 끄기" }[tm.dataset.state] || ""),
    });
    const setMode = (m) => { tm.dataset.state = m; state.textContent = LABEL[m]; bStart.textContent = m === "pause" ? "다시 시작" : "시작"; bStart.disabled = m === "run"; bPause.disabled = m !== "run"; tm.querySelectorAll(".tm-inputs input,.tm-step,[data-quick]").forEach((el) => { el.disabled = m === "run" || m === "pause"; }); pip.update(); };
    const paint = () => {
      const ms = running ? endAt - Date.now() : left;
      disp.textContent = fmt(ms);
      const bar = tm.querySelector(".tm-bar i"); if (bar) bar.style.width = total ? `${Math.min(100, (1 - ms / total) * 100)}%` : "0";
      if (tm.dataset.state === "run" || tm.dataset.state === "pause") document.title = `${fmt(ms)} ${tm.dataset.state === "pause" ? "(멈춤) " : ""}— ${baseTitle}`;
      if (running && ms <= 0) finish(); else pip.update();
    };
    function start(ms) {
      stopRing();
      unlockSound(); // 「시작」을 누른 순간 소리 잠금 해제 — setTimeout 안에서 처음 재생하면 모바일에서 막히기 때문
      if (ms != null) { total = left = ms; }
      if (left <= 0) { toast("시간을 먼저 정해 주세요"); return; }
      endAt = Date.now() + left; running = true; setMode("run");
      clearInterval(tick); tick = setInterval(paint, 200);
      setTimeout(paint, left + 5); // 끝나는 순간에 한 번 더 확인
      keepAwake(true); paint();
    }
    function pause() { left = Math.max(0, endAt - Date.now()); running = false; clearInterval(tick); setMode("pause"); keepAwake(false); paint(); }
    function reset() { running = false; clearInterval(tick); stopRing(); left = total = inputMs(); setMode("idle"); keepAwake(false); document.title = baseTitle; paint(); }
    function finish() {
      running = false; clearInterval(tick); left = 0; setMode("done");
      disp.textContent = "00:00"; document.title = `끝! — ${baseTitle}`;
      tm.classList.add("ringing"); bStop.hidden = false;
      ring(tm);
      keepAwake(false); pip.update();
    }
    function stopRing(keepDone) { stopSound(); tm.classList.remove("ringing"); bStop.hidden = true; if (!keepDone && tm.dataset.state === "done") document.title = baseTitle; }
    function silence() { stopRing(); setMode("idle"); left = total = inputMs(); paint(); }
    // 화면이 꺼졌거나 다른 앱에 있다가 돌아오면 바로 다시 계산(그사이 끝났으면 지금 알림)
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { if (wantLock) keepAwake(true); if (running) paint(); } });
    bStart.addEventListener("click", () => { const st = tm.dataset.state; if (st === "run") return; if (st === "pause") start(); else start(inputMs()); });
    bPause.addEventListener("click", () => { if (tm.dataset.state === "run") pause(); });
    const fromInputs = () => { if (tm.dataset.state === "idle" || tm.dataset.state === "done") { stopRing(); setMode("idle"); left = total = inputMs(); paint(); } };
    tm.querySelectorAll(".tm-step").forEach((b) => b.addEventListener("click", () => {
      const unit = { h: 3600, m: 60, s: 1 }[b.dataset.step];
      const sec = Math.min(99 * 3600 + 59 * 60 + 59, Math.max(0, inputMs() / 1000 + unit * (+b.dataset.d))); // 자리 올림·내림 포함
      H.value = Math.floor(sec / 3600); M.value = Math.floor((sec % 3600) / 60); S.value = sec % 60;
      tm.querySelectorAll("[data-quick]").forEach((c) => c.classList.remove("on")); fromInputs();
    }));
    [H, M, S].forEach((el) => el.addEventListener("focus", () => el.select()));
    bReset.addEventListener("click", reset);
    bStop.addEventListener("click", silence);
    tm.querySelector("[data-preview]")?.addEventListener("click", () => { unlockSound(); ring(tm, { loop: false }); toast("알림음을 들려 드려요. 안 들리면 기기 음량과 무음 모드를 확인해 주세요"); });
    tm.querySelectorAll("[data-quick]").forEach((b) => b.addEventListener("click", () => {
      const min = +b.dataset.quick; H.value = Math.floor(min / 60); M.value = min % 60; S.value = 0; fromInputs(); tm.querySelectorAll("[data-quick]").forEach((c) => c.classList.toggle("on", c === b)); bStart.focus();
    }));
    [H, M, S].forEach((el) => el.addEventListener("input", () => { tm.querySelectorAll("[data-quick]").forEach((c) => c.classList.remove("on")); fromInputs(); }));
    tm.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); bStart.click(); });
    setupFullscreen(tm);
    setMode("idle"); left = total = inputMs(); paint();
  }

  // ---------- 스톱워치 ----------
  const sw = document.querySelector('[data-tool="stopwatch"]');
  if (sw) {
    const disp = sw.querySelector(".clock"), list = sw.querySelector(".laps tbody"), lapsBox = sw.querySelector(".laps");
    const bGo = sw.querySelector("[data-go]"), bLap = sw.querySelector("[data-lap]"), bReset = sw.querySelector("[data-reset]");
    let acc = 0, t0 = 0, running = false, raf = 0, laps = [], lastPip = 0;
    const now = () => acc + (running ? Date.now() - t0 : 0);
    const fmt = (ms) => { const cs = Math.floor(ms / 10), h = Math.floor(cs / 360000), m = Math.floor((cs % 360000) / 6000), s = Math.floor((cs % 6000) / 100), c = cs % 100; return `${h ? h + ":" : ""}${pad(m)}:${pad(s)}.${pad(c)}`; };
    const fmtS = (ms) => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600); return `${h ? h + ":" : ""}${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`; }; // PiP용(초 단위)
    const pip = setupPip(sw, {
      text: () => fmtS(now()),
      sub: () => `스톱워치 · ${running ? "재는 중" : now() ? "멈춤" : "대기"}${laps.length ? ` · 랩 ${laps.length}` : ""}`,
      act: () => toggle(),
      actLabel: () => (running ? "정지" : now() ? "계속" : "시작"),
    });
    const paint = () => {
      disp.textContent = fmt(now());
      const t = Date.now(); if (t - lastPip > 250) { lastPip = t; pip.update(); }
      if (running) raf = requestAnimationFrame(paint);
    };
    const sync = () => { sw.dataset.state = running ? "run" : now() ? "pause" : "idle"; bGo.textContent = running ? "정지" : now() ? "계속" : "시작"; bLap.disabled = !running; bReset.disabled = running || !now(); pip.update(); };
    const drawLaps = () => {
      lapsBox.hidden = !laps.length;
      const splits = laps.map((t, i) => t - (laps[i - 1] || 0));
      const best = laps.length > 1 ? Math.min(...splits) : -1, worst = laps.length > 1 ? Math.max(...splits) : -1;
      list.innerHTML = laps.map((t, i) => [i, t, splits[i]]).reverse()
        .map(([i, t, d]) => `<tr class="${d === best ? "best" : d === worst ? "worst" : ""}"><th scope="row">${i + 1}</th><td>${fmt(d)}${d === best ? ' <em>최고</em>' : d === worst ? ' <em>최저</em>' : ""}</td><td>${fmt(t)}</td></tr>`).join("");
    };
    function toggle() {
      if (running) { acc = now(); running = false; cancelAnimationFrame(raf); keepAwake(false); }
      else { t0 = Date.now(); running = true; keepAwake(true); raf = requestAnimationFrame(paint); }
      sync(); paint();
    }
    function lap() { if (!running) return; laps.push(now()); drawLaps(); pip.update(); }
    function reset() { if (running) { running = false; cancelAnimationFrame(raf); keepAwake(false); } acc = 0; laps = []; drawLaps(); sync(); paint(); }
    bGo.addEventListener("click", toggle); bLap.addEventListener("click", lap); bReset.addEventListener("click", reset);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && wantLock) keepAwake(true); });
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const tag = (e.target && e.target.tagName) || "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && e.target.isContentEditable)) return;
      if (e.code === "Space" || e.key === " ") {
        // 스톱워치 버튼에 초점이 있어도 Space는 항상 시작/정지(마우스로 랩을 누른 뒤 Space가 랩으로 눌리는 것 방지). 다른 곳의 버튼·링크는 그대로 둠
        if ((tag === "BUTTON" || tag === "A") && !sw.contains(e.target)) return;
        e.preventDefault(); toggle();
      }
      else if (e.key === "l" || e.key === "L" || e.key === "ㅣ") { lap(); }
      else if (e.key === "r" || e.key === "R" || e.key === "ㄱ") { reset(); }
    });
    document.addEventListener("keyup", (e) => { if ((e.code === "Space" || e.key === " ") && e.target && e.target.tagName === "BUTTON" && sw.contains(e.target)) e.preventDefault(); });
    setupFullscreen(sw);
    sync(); paint();
  }
})();
