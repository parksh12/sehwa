// 1분 인생 — 오늘 태어난 한 사람의 일생을 약 1분 동안 살아 보는 이야기 게임
// 시기 10개마다 장면 10개 중 하나가 무작위로 나오고(life-data.js), 도트 그림(pixel.js)으로 상황을 보여 줍니다.
(function () {
  const box = document.getElementById("life");
  if (!box) return;
  const D = NALGI.data, esc = NALGI.esc, PX = NALGI.pixel, { SLOTS, MOMENTS, SCENES } = NALGI.lifeData;
  const KIND = { a: "adventure", l: "love", s: "stable", f: "fun" };
  const RUN_MS = 40000, PICK_MS = 3000;
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr, n) => arr.slice().sort(() => Math.random() - 0.5).slice(0, n);

  let raf = 0;
  const start = () => {
    cancelAnimationFrame(raf);
    const person = PX.newPerson();
    const events = SLOTS.map(([[lo, hi], list]) => { const e = pick(list, 1)[0]; return { age: rnd(lo, hi), scene: e[0], A: [e[1], KIND[e[2]]], B: [e[3], KIND[e[4]]], art: e[5] }; });
    const death = Math.max(events[events.length - 1].age + 4, 74 + rnd(0, 22));
    const moments = [[0, "응애. 세상에 나왔다"], ...MOMENTS.flatMap(([[lo, hi], list]) => pick(list, 2).map((t) => [rnd(lo, Math.min(hi, death - 1)), t]))]
      .filter((m) => m[0] < death).sort((a, b) => a[0] - b[0]);
    const picks = [];
    let age = 0, last = performance.now(), ei = 0, mi = 0, paused = false, scene = null;

    box.innerHTML = `
<div class="life-run">
  <canvas class="life-pix" id="life-pix" width="${PX.W}" height="${PX.H}" role="img" aria-label="지금 장면"></canvas>
  <div class="life-age"><b id="life-age">0</b>세</div>
  <div class="life-bar" aria-hidden="true"><i id="life-fill"></i></div>
  <div class="life-event" id="life-event" hidden></div>
  <ul class="life-log" id="life-log" aria-live="polite"></ul>
</div>`;
    const $pix = box.querySelector("#life-pix"), $age = box.querySelector("#life-age"), $fill = box.querySelector("#life-fill"), $log = box.querySelector("#life-log"), $ev = box.querySelector("#life-event");
    const log = (text, cls = "") => {
      const li = document.createElement("li"); li.className = cls; li.innerHTML = `<b>${Math.floor(age)}세</b> ${esc(text)}`;
      $log.prepend(li); while ($log.children.length > 4) $log.lastChild.remove();
    };
    const paint = (now) => {
      PX.draw($pix, scene || { bg: PX.IDLE(age), who: 24 }, age, person, now);
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);

    const ask = (e) => {
      paused = true;
      scene = SCENES[e.art];
      $ev.hidden = false;
      $ev.innerHTML = `<p class="life-scene">${e.age}세, ${esc(e.scene)}</p>
<div class="life-choices"><button type="button" class="btn big" data-i="0">${esc(e.A[0])}</button><button type="button" class="btn big ghost" data-i="1">${esc(e.B[0])}</button></div>
<div class="life-timer"><i></i></div>`;
      const timer = $ev.querySelector(".life-timer i");
      requestAnimationFrame(() => { timer.style.transition = `width ${PICK_MS}ms linear`; timer.style.width = "0%"; });
      let done = false;
      const choose = (i, drift) => {
        if (done) return; done = true; clearTimeout(to);
        const c = [e.A, e.B][i];
        picks.push({ age: e.age, scene: e.scene, choice: c[0], kind: c[1], drift });
        $ev.hidden = true; $ev.innerHTML = "";
        log(`${e.scene} → ${c[0]}${drift ? " (흘러가는 대로)" : ""}`, "pick");
        setTimeout(() => { scene = null; paused = false; last = performance.now(); requestAnimationFrame(tick); }, 500);
      };
      const to = setTimeout(() => choose(Math.random() < 0.5 ? 0 : 1, true), PICK_MS);
      $ev.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => choose(+b.dataset.i, false)));
    };

    const tick = (now) => {
      if (paused) return;
      age = Math.min(death, age + ((now - last) / RUN_MS) * death);
      last = now;
      $age.textContent = Math.floor(age);
      $fill.style.width = Math.min(100, age) + "%";
      while (mi < moments.length && moments[mi][0] <= age) log(moments[mi++][1]);
      if (ei < events.length && events[ei].age <= age) { age = events[ei].age; $age.textContent = age; return ask(events[ei++]); }
      if (age >= death) return finish(death, picks, person);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const finish = (death, picks, person) => {
    cancelAnimationFrame(raf);
    const score = { adventure: 0, love: 0, stable: 0, fun: 0 };
    let lastKind = "stable";
    picks.forEach((p) => { score[p.kind]++; lastKind = p.kind; });
    const drifts = picks.filter((p) => p.drift).length;
    const top = Math.max(...Object.values(score));
    const tied = Object.keys(score).filter((k) => score[k] === top);
    const key = drifts >= 4 ? "drift" : tied.includes(lastKind) ? lastKind : tied[0];
    const T = D.types[key];
    const y = new Date().getFullYear();
    box.innerHTML = `
<div class="result">
  <div class="result-card life-card" data-card-title="1분 인생 · 향년 ${death}세" data-card-main="${esc(T.name)}" data-card-sub="${esc(T.epitaph)}">
    <canvas class="life-pix end" id="life-end" width="${PX.W}" height="${PX.H}" role="img" aria-label="노을 진 언덕의 묘비"></canvas>
    <p class="life-years">${y} – ${y + death}</p>
    <div class="rc-main">${esc(T.name)}</div>
    <p>“${esc(T.epitaph)}”</p>
    <dl class="rc-meta"><div><dt>향년</dt><dd>${death}세</dd></div><div><dt>직접 고른 순간</dt><dd>${picks.length - drifts}번</dd></div><div><dt>흘려보낸 순간</dt><dd>${drifts}번</dd></div></dl>
  </div>
  <h2 class="sub">내가 고른 인생</h2>
  <ol class="life-timeline">${picks.map((p) => `<li><b>${p.age}세</b><span>${esc(p.scene)}</span><strong>${esc(p.choice)}${p.drift ? " <em>흘러가는 대로</em>" : ""}</strong></li>`).join("")}<li><b>${death}세</b><span>긴 여행을 마쳤다</span></li></ol>
  <div class="result-grid">
    <a class="btn" href="${NALGI.url(`/story/life/${D.slugs[key]}/`)}">${esc(T.name)} 자세히 보기</a>
    <button type="button" class="btn ghost" data-act="again">한 번 더 살아 보기</button>
  </div>
  ${NALGI.shareBar({ title: `1분 인생: 나는 ${T.name}`, text: `향년 ${death}세, “${T.epitaph}”`, path: "/story/life/" })}
</div>`;
    PX.draw(box.querySelector("#life-end"), SCENES.ending, death, person, 0);
    box.querySelector('[data-act="again"]').addEventListener("click", start);
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 시작 화면에도 요람 장면을 미리 보여 줌
  const intro = box.querySelector("#life-intro");
  if (intro) PX.draw(intro, { bg: "home", who: 28 }, 0, { shirt: "b", hair: "k" }, 0);
  box.querySelector('[data-act="start"]')?.addEventListener("click", start);
})();
