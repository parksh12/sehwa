// 타이머 + 스톱워치. 경과 시간은 항상 Date.now() 기준(백그라운드 탭에서 setInterval이 느려져도 정확).
// 소리는 WebAudio로 직접 만들고, 저장·전송하는 값은 없습니다.
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
  document.addEventListener("visibilitychange", () => { if (wantLock && document.visibilityState === "visible") keepAwake(true); });

  // ---------- 공통: 전체 화면 ----------
  document.querySelectorAll("[data-fullscreen]").forEach((btn) => {
    const target = btn.closest(".tk");
    if (!document.fullscreenEnabled || !target) { btn.hidden = true; return; }
    btn.addEventListener("click", () => (document.fullscreenElement ? document.exitFullscreen() : target.requestFullscreen()).catch(() => toast("전체 화면을 열 수 없어요")));
    document.addEventListener("fullscreenchange", () => { btn.textContent = document.fullscreenElement ? "전체 화면 닫기" : "전체 화면"; });
  });

  // ---------- 공통: 알림음 (WebAudio로 직접 생성) ----------
  let ac = null;
  const audio = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ac) ac = new AC();
    if (ac.state === "suspended") ac.resume();
    return ac;
  };
  function beep(box) {
    const a = audio();
    box.dataset.beeps = String((+box.dataset.beeps || 0) + 1); // 확인용 횟수(화면에는 안 보임)
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

  // ---------- 타이머 ----------
  const tm = document.querySelector('[data-tool="timer"]');
  if (tm) {
    const disp = tm.querySelector(".clock"), state = tm.querySelector(".tm-state");
    const H = tm.querySelector('[name="h"]'), M = tm.querySelector('[name="m"]'), S = tm.querySelector('[name="s"]');
    const bStart = tm.querySelector("[data-start]"), bPause = tm.querySelector("[data-pause]"), bReset = tm.querySelector("[data-reset]"), bStop = tm.querySelector("[data-silence]");
    let total = 0, left = 0, endAt = 0, running = false, tick = null, ring = null, ringCount = 0;
    const fmt = (ms) => { const sec = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`; };
    const inputMs = () => ((Math.max(0, +H.value || 0) * 3600) + (Math.max(0, +M.value || 0) * 60) + Math.max(0, +S.value || 0)) * 1000;
    const setMode = (m) => { tm.dataset.state = m; state.textContent = { idle: "대기", run: "진행 중", pause: "일시정지", done: "끝!" }[m]; bStart.textContent = m === "pause" ? "다시 시작" : "시작"; bStart.disabled = m === "run"; bPause.disabled = m !== "run"; tm.querySelectorAll(".tm-inputs input,.tm-step,[data-quick]").forEach((el) => { el.disabled = m === "run" || m === "pause"; }); };
    const paint = () => {
      const ms = running ? endAt - Date.now() : left;
      disp.textContent = fmt(ms);
      const bar = tm.querySelector(".tm-bar i"); if (bar) bar.style.width = total ? `${Math.min(100, (1 - ms / total) * 100)}%` : "0";
      if (tm.dataset.state === "run" || tm.dataset.state === "pause") document.title = `${fmt(ms)} ${tm.dataset.state === "pause" ? "(멈춤) " : ""}— ${baseTitle}`;
      if (running && ms <= 0) finish();
    };
    function start(ms) {
      stopRing();
      if (ms != null) { total = left = ms; }
      if (left <= 0) { toast("시간을 먼저 정해 주세요"); return; }
      audio(); // 사용자가 누른 순간에 소리 장치를 깨워 둠(모바일 자동 재생 제한 대응)
      endAt = Date.now() + left; running = true; setMode("run");
      clearInterval(tick); tick = setInterval(paint, 200);
      setTimeout(paint, left + 5); // 백그라운드에서도 끝나는 순간에 한 번 더 확인
      keepAwake(true); paint();
    }
    function pause() { left = Math.max(0, endAt - Date.now()); running = false; clearInterval(tick); setMode("pause"); keepAwake(false); paint(); }
    function reset() { running = false; clearInterval(tick); stopRing(); left = total = inputMs(); setMode("idle"); keepAwake(false); document.title = baseTitle; paint(); }
    function finish() {
      running = false; clearInterval(tick); left = 0; setMode("done");
      disp.textContent = "00:00"; document.title = `끝! — ${baseTitle}`;
      tm.classList.add("ringing"); bStop.hidden = false; ringCount = 0;
      beep(tm); ring = setInterval(() => { beep(tm); if (++ringCount >= 9) stopRing(true); }, 1000); // 약 10초 울리고 멈춤
      keepAwake(false);
    }
    function stopRing(keepDone) { clearInterval(ring); ring = null; tm.classList.remove("ringing"); bStop.hidden = true; if (!keepDone && tm.dataset.state === "done") document.title = baseTitle; }
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
    bStop.addEventListener("click", () => { stopRing(); setMode("idle"); left = total = inputMs(); paint(); });
    tm.querySelectorAll("[data-quick]").forEach((b) => b.addEventListener("click", () => {
      const min = +b.dataset.quick; H.value = Math.floor(min / 60); M.value = min % 60; S.value = 0; fromInputs(); tm.querySelectorAll("[data-quick]").forEach((c) => c.classList.toggle("on", c === b)); bStart.focus();
    }));
    [H, M, S].forEach((el) => el.addEventListener("input", () => { tm.querySelectorAll("[data-quick]").forEach((c) => c.classList.remove("on")); fromInputs(); }));
    tm.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); bStart.click(); });
    setMode("idle"); left = total = inputMs(); paint();
  }

  // ---------- 스톱워치 ----------
  const sw = document.querySelector('[data-tool="stopwatch"]');
  if (sw) {
    const disp = sw.querySelector(".clock"), list = sw.querySelector(".laps tbody"), lapsBox = sw.querySelector(".laps");
    const bGo = sw.querySelector("[data-go]"), bLap = sw.querySelector("[data-lap]"), bReset = sw.querySelector("[data-reset]");
    let acc = 0, t0 = 0, running = false, raf = 0, laps = [];
    const now = () => acc + (running ? Date.now() - t0 : 0);
    const fmt = (ms) => { const cs = Math.floor(ms / 10), h = Math.floor(cs / 360000), m = Math.floor((cs % 360000) / 6000), s = Math.floor((cs % 6000) / 100), c = cs % 100; return `${h ? h + ":" : ""}${pad(m)}:${pad(s)}.${pad(c)}`; };
    const paint = () => { disp.textContent = fmt(now()); if (running) raf = requestAnimationFrame(paint); };
    const sync = () => { sw.dataset.state = running ? "run" : now() ? "pause" : "idle"; bGo.textContent = running ? "정지" : now() ? "계속" : "시작"; bLap.disabled = !running; bReset.disabled = running || !now(); };
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
    function lap() { if (!running) return; laps.push(now()); drawLaps(); }
    function reset() { if (running) { running = false; cancelAnimationFrame(raf); keepAwake(false); } acc = 0; laps = []; drawLaps(); sync(); paint(); }
    bGo.addEventListener("click", toggle); bLap.addEventListener("click", lap); bReset.addEventListener("click", reset);
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
    sync(); paint();
  }
})();
