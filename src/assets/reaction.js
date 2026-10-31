// 반응속도 게임 — 다섯 번 측정한 평균으로 등급을 매기고, 내 최고 평균을 이 브라우저에 저장
(function () {
  const pad = document.getElementById("rt");
  const prog = document.getElementById("rt-progress");
  const out = document.getElementById("rt-result");
  const ROUNDS = 5;
  const GRADES = [[200, "번개"], [240, "치타"], [280, "매"], [330, "토끼"], [400, "고양이"], [500, "거북이"], [Infinity, "나무늘보"]];
  const KEY = "nalgi-reaction-best";
  let state = "idle", times = [], timer = 0, t0 = 0;
  prog.innerHTML = Array.from({ length: ROUNDS }, () => "<i></i>").join("");
  const set = (cls, title, sub) => { pad.className = "rt " + cls; pad.innerHTML = `<div class="rt-inner"><strong>${title}</strong><span>${sub || ""}</span></div>`; };
  const mark = () => prog.querySelectorAll("i").forEach((el, k) => el.classList.toggle("done", k < times.length));
  function arm() {
    if (!times.length) out.hidden = true;
    state = "wait"; set("wait", "기다리세요…", "초록색이 되면 바로 터치!");
    timer = setTimeout(() => { state = "go"; t0 = performance.now(); set("go", "지금!", ""); }, 1200 + Math.random() * 2600);
  }
  function finish() {
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const best = Math.round(Math.min(...times));
    const max = Math.max(...times);
    const grade = GRADES.find(([ms]) => avg <= ms)[1];
    let prev = 0;
    try { prev = +localStorage.getItem(KEY) || 0; } catch (e) {}
    const isNew = !prev || avg < prev;
    if (isNew) try { localStorage.setItem(KEY, avg); } catch (e) {}
    out.innerHTML = `
<div class="result-card" data-card-title="반응속도 게임" data-card-main="${grade} 등급 · ${avg}ms" data-card-sub="다섯 번 평균 ${avg}ms, 가장 빨랐던 한 번 ${best}ms">
  <div class="rc-main">${grade} 등급</div>
  <div class="rc-score">${avg}<small style="font-size:.35em">ms</small></div>
  <dl class="rc-meta"><div><dt>가장 빨랐던 한 번</dt><dd>${best}ms</dd></div><div><dt>내 최고 평균</dt><dd>${isNew ? avg : prev}ms${isNew ? '<span class="rt-new">신기록</span>' : ""}</dd></div></dl>
</div>
<div class="rt-bars">${times.map((ms, i) => `<div class="${Math.round(ms) === best ? "best" : ""}"><span>${i + 1}회</span><i style="width:${Math.max(8, (ms / max) * 100)}%"></i><span>${Math.round(ms)}ms</span></div>`).join("")}</div>
${NALGI.shareBar({ title: `반응속도 게임: ${grade} 등급 ${avg}ms`, text: `내 평균은 ${avg}ms. 너는 몇 ms?`, path: "/arcade/reaction/" })}`;
    out.hidden = false;
    out.scrollIntoView({ behavior: "smooth", block: "nearest" });
    set("", `평균 ${avg}ms · ${grade}`, "한 번 더 하려면 터치");
    times = []; mark();
    state = "idle";
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
    }
  }
  pad.addEventListener("pointerdown", hit);
  pad.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") hit(e); });
})();
