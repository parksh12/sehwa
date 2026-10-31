(function () {
  const pad = document.getElementById("rt");
  const prog = document.getElementById("rt-progress");
  const D = NALGI.data;
  const ROUNDS = 5;
  let state = "idle", times = [], timer = 0, t0 = 0;
  prog.innerHTML = Array.from({ length: ROUNDS }, () => "<i></i>").join("");
  const set = (cls, title, sub) => { pad.className = "rt " + cls; pad.innerHTML = `<div class="rt-inner"><strong>${title}</strong><span>${sub || ""}</span></div>`; };
  const mark = () => prog.querySelectorAll("i").forEach((el, k) => el.classList.toggle("done", k < times.length));
  function arm() {
    state = "wait"; set("wait", "기다리세요…", "초록색이 되면 바로 터치!");
    timer = setTimeout(() => { state = "go"; t0 = performance.now(); set("go", "지금!", ""); }, 1200 + Math.random() * 2600);
  }
  function finish() {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const sd = Math.sqrt(times.reduce((a, b) => a + (b - avg) ** 2, 0) / times.length);
    const best = Math.min(...times);
    const key = (avg < 300 ? "fast" : "slow") + (sd < 40 ? "Steady" : "Varied");
    set("", `평균 ${Math.round(avg)}ms`, `${D.names[key]} — 결과 페이지로 이동해요`);
    state = "done";
    setTimeout(() => { location.href = NALGI.url(`/arcade/reaction/${D.slugs[key]}/`) + `?a=${Math.round(avg)}&s=${Math.round(sd)}&b=${Math.round(best)}`; }, 900);
  }
  function hit(e) {
    if (e) e.preventDefault();
    if (state === "idle" || state === "early") { arm(); return; }
    if (state === "wait") { clearTimeout(timer); state = "early"; set("early", "앗, 너무 빨라요!", "초록색이 된 다음에 눌러 주세요. 다시 하려면 터치"); return; }
    if (state === "go") {
      const ms = performance.now() - t0; times.push(ms); mark();
      if (times.length >= ROUNDS) return finish();
      state = "between"; set("", `${Math.round(ms)}ms`, `${times.length}/${ROUNDS} · 터치하면 다음 측정`);
      setTimeout(() => { if (state === "between") state = "idle"; }, 250);
      return;
    }
  }
  pad.addEventListener("pointerdown", hit);
  pad.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") hit(e); });
})();
