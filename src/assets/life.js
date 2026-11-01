// 1분 인생 — 한 사람의 일생을 인생 시계 60초 동안 살아 보는 이야기 게임
// 시작 화면에서 성별(외형)·태어난 곳·띠·이름을 고르고, 시기마다 갈림길 1개 + 인생 이정표 장면이 도트 그림(pixel.js)으로 나옵니다.
// 갈림길에서는 시계가 멈추고 5초 안에 고릅니다. 한 판에서 같은 배경은 2번까지만 나옵니다.
(function () {
  const box = document.getElementById("life");
  if (!box) return;
  const D = NALGI.data, esc = NALGI.esc, PX = NALGI.pixel, { SLOTS, MOMENTS, SCENES, MILESTONES, BORN } = NALGI.lifeData;
  const KIND = { a: "adventure", l: "love", s: "stable", f: "fun" };
  const CLOCK_MS = 60000, PICK_MS = 5000, MAX_BG = 2, DONE_KEY = "nalgi-life-done";
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (arr, n) => shuffle(arr).slice(0, n);
  const LOOKS = ["m", "f", "n"], PLACES = ["city", "sea", "mountain"];
  const PLACE_BG = { city: "street", sea: "beach", mountain: "village" };
  const TTI = D.tti || [];
  const thisYear = new Date().getFullYear();
  const ttiOfYear = (y) => (((y - 4) % 12) + 12) % 12; // 0 = 쥐띠
  const birthYear = (i) => thisYear - ((((thisYear - 4 - i) % 12) + 12) % 12); // 고른 띠의 가장 최근 해

  let done = 0;
  try { done = +localStorage.getItem(DONE_KEY) || 0; } catch (e) {}
  let runs = 0, raf = 0, speed = 1;

  // ---------- 시작 화면 ----------
  const form = box.querySelector("#life-setup");
  const $intro = box.querySelector("#life-intro");
  const setup = { look: "n", born: "city", tti: ttiOfYear(thisYear), name: "" };
  let cast = null;
  const newCast = () => {
    const P = PX.newPerson, any = () => LOOKS[rnd(0, 2)];
    cast = { me: P(setup.look), mom: P("f"), dad: P("m"), friend: P(any()), friend2: P(any()), lover: P(any()), kid: P(any()), teacher: P(any()), gran: P("f") };
    cast.child = cast.kid;
  };
  const readForm = () => {
    if (!form) return;
    const f = new FormData(form);
    setup.look = f.get("look") || "n"; setup.born = f.get("born") || "city"; setup.tti = +f.get("tti"); setup.name = String(f.get("name") || "").trim().slice(0, 8);
  };
  const showDone = () => {
    const el = box.querySelector("#life-done");
    if (el && done) { el.hidden = false; el.textContent = `이 기기에서 ${done}번 완주했어요. 이번 판부터 2배속 버튼을 쓸 수 있어요.`; }
  };
  const preview = (now) => {
    if (!$intro || !$intro.isConnected) return;
    PX.draw($intro, { bg: PLACE_BG[setup.born], who: false, extra: [[6, 18, "walk"], [16, 41, "stand"], [30, 64, "act"]] }, 30, cast, now);
    raf = requestAnimationFrame(preview);
  };
  const updateLabel = () => { if ($intro) $intro.setAttribute("aria-label", `${BORN[setup.born]}에서 태어날 사람이 어린이·학생·어른으로 자라는 모습 미리보기`); };

  if (form) {
    const sel = form.querySelector('[name="tti"]');
    if (sel) sel.value = String(setup.tti);
    form.addEventListener("change", (e) => { const prev = setup.look; readForm(); if (e.target.name === "look" && prev !== setup.look) newCast(); updateLabel(); });
    form.querySelector('[data-act="random"]')?.addEventListener("click", () => {
      form.querySelector(`[name="look"][value="${LOOKS[rnd(0, 2)]}"]`).checked = true;
      form.querySelector(`[name="born"][value="${PLACES[rnd(0, 2)]}"]`).checked = true;
      if (sel) sel.value = String(rnd(0, 11));
      readForm(); newCast(); updateLabel();
    });
    $intro?.addEventListener("click", newCast); // 미리보기를 누르면 머리 모양·옷이 바뀜
    form.addEventListener("submit", (e) => { e.preventDefault(); readForm(); start(); });
  }
  readForm(); newCast(); updateLabel(); showDone();
  raf = requestAnimationFrame(preview);

  // ---------- 한 판 짜기: 이정표 + 갈림길, 같은 배경은 최대 2번 ----------
  function plan() {
    const born = setup.born;
    for (let tries = 0; tries < 20; tries++) {
      const had = {}, ms = [];
      MILESTONES.forEach(([[lo, hi], text, key, prob, need]) => {
        if (need && !had[need]) return;
        if (prob < 1 && (tries > 10 || Math.random() >= prob)) return; // 계속 막히면 선택 이정표를 뺌
        had[key] = 1;
        ms.push({ age: rnd(lo, hi), text: typeof text === "string" ? text : text[born], art: key.replace("{born}", born) });
      });
      const count = {};
      ms.forEach((m) => { const b = SCENES[m.art].bg; count[b] = (count[b] || 0) + 1; });
      // 나이를 먼저 정해 이정표와 한 줄로 세운 뒤, 바로 앞뒤 장면과 배경이 겹치지 않는 쪽을 먼저 고름
      const ages = SLOTS.map(([[lo, hi]]) => rnd(lo, hi));
      const line = [...ms.map((m) => ({ age: m.age, bg: SCENES[m.art].bg, m: 1 })), ...ages.map((age, ev) => ({ age, ev }))].sort((a, b) => a.age - b.age || (b.m || 0) - (a.m || 0));
      const pos = []; line.forEach((it, k) => { if (it.ev != null) pos[it.ev] = k; });
      const lists = SLOTS.map(([, list]) => shuffle(list)), chosen = [];
      const dfs = (i) => {
        if (i === lists.length) return true;
        const k = pos[i], prev = k ? line[k - 1].bg : "", next = line[k + 1] && line[k + 1].m ? line[k + 1].bg : "";
        const pen = (e) => (SCENES[e[5]].bg === prev) + (SCENES[e[5]].bg === next);
        for (const e of lists[i].slice().sort((a, b) => pen(a) - pen(b))) {
          const bg = SCENES[e[5]].bg;
          if ((count[bg] || 0) >= MAX_BG) continue;
          count[bg] = (count[bg] || 0) + 1; chosen[i] = e; line[k].bg = bg;
          if (dfs(i + 1)) return true;
          count[bg]--;
        }
        return false;
      };
      if (!dfs(0)) continue;
      const events = SLOTS.map((_, i) => { const e = chosen[i]; return { age: ages[i], scene: e[0], A: [e[1], KIND[e[2]]], B: [e[3], KIND[e[4]]], art: e[5] }; });
      return { ms, events };
    }
    throw new Error("1분 인생: 장면 배치 실패");
  }

  // ---------- 진행 ----------
  function start() {
    cancelAnimationFrame(raf);
    runs++;
    const me = { ...setup };
    const { ms, events } = plan();
    const lastAge = Math.max(events[events.length - 1].age, ...ms.map((m) => m.age));
    const death = Math.max(lastAge + 4, 74 + rnd(0, 22));
    const moments = MOMENTS.flatMap(([[lo, hi], list]) => pick(list, 2).map((t) => ({ age: rnd(lo, Math.min(hi, death - 1)), text: t }))).filter((m) => m.age >= 1 && m.age < death);
    // 이정표(그림 바뀜)와 글 장면을 나이순 한 줄로
    const flow = [...ms.map((m) => ({ ...m, pic: true })), ...moments].sort((a, b) => a.age - b.age || (b.pic ? 1 : 0) - (a.pic ? 1 : 0));
    const shown = [], picks = [];
    let age = 0, clock = 0, last = performance.now(), ei = 0, fi = 0, paused = false, scene = SCENES.born;
    const canFast = runs > 1 || done > 0;
    speed = 1;

    box.innerHTML = `
<div class="life-run">
  <canvas class="life-pix" id="life-pix" width="${PX.W}" height="${PX.H}" role="img" aria-label="지금 장면"></canvas>
  <div class="life-hud">
    <div class="life-age"><b id="life-age">0</b>세</div>
    <div class="life-clock" id="life-clock"><span>인생 시계</span> <b id="life-sec">60</b>초</div>
    ${canFast ? `<button type="button" class="life-fast" id="life-fast" aria-pressed="false">2배속</button>` : ""}
  </div>
  <div class="life-bar" aria-hidden="true"><i id="life-fill"></i></div>
  <div class="life-event" id="life-event" hidden></div>
  <ul class="life-log" id="life-log" aria-live="polite"></ul>
</div>`;
    box.scrollIntoView({ block: "start" }); // 그림·시계·갈림길이 한 화면에 보이게
    const $ = (s) => box.querySelector(s);
    const $pix = $("#life-pix"), $age = $("#life-age"), $sec = $("#life-sec"), $clock = $("#life-clock"), $fill = $("#life-fill"), $log = $("#life-log"), $ev = $("#life-event"), $run = $(".life-run");
    $("#life-fast")?.addEventListener("click", (e) => { speed = speed === 1 ? 2 : 1; e.currentTarget.setAttribute("aria-pressed", String(speed === 2)); e.currentTarget.textContent = speed === 2 ? "1배속" : "2배속"; });
    const log = (text, cls = "") => {
      const li = document.createElement("li"); li.className = cls; li.innerHTML = `<b>${Math.floor(age)}세</b> ${esc(text)}`;
      $log.prepend(li); while ($log.children.length > 4) $log.lastChild.remove();
    };
    const setScene = (key, label) => {
      scene = SCENES[key]; shown.push(scene.bg); $run.dataset.bgs = shown.join(",");
      $pix.setAttribute("aria-label", label);
    };
    const paint = (now) => { PX.draw($pix, scene, age, cast, now, age < 20 ? me.born : "city"); raf = requestAnimationFrame(paint); };
    setScene(flow[0].art, "병원에서 막 태어난 아기와 부모");
    log(flow[0].text, "mile"); fi = 1;
    raf = requestAnimationFrame(paint);

    const ask = (e) => {
      paused = true;
      setScene(e.art, e.scene);
      $clock.classList.add("stop");
      $ev.hidden = false;
      $ev.innerHTML = `<p class="life-scene">${e.age}세, ${esc(e.scene)}</p>
<div class="life-choices"><button type="button" class="btn big" data-i="0">${esc(e.A[0])}</button><button type="button" class="btn big ghost" data-i="1">${esc(e.B[0])}</button></div>
<div class="life-timer" aria-hidden="true"><i></i></div><p class="life-wait">시계가 멈췄어요. 5초 안에 고르세요</p>`;
      const timer = $ev.querySelector(".life-timer i");
      requestAnimationFrame(() => requestAnimationFrame(() => { timer.style.transition = `width ${PICK_MS}ms linear`; timer.style.width = "0%"; }));
      let fin = false;
      const choose = (i, drift) => {
        if (fin) return; fin = true; clearTimeout(to);
        const c = [e.A, e.B][i];
        picks.push({ age: e.age, scene: e.scene, choice: c[0], kind: c[1], drift });
        $ev.hidden = true; $ev.innerHTML = "";
        if ($pix.getBoundingClientRect().top < 90) box.scrollIntoView({ behavior: "smooth", block: "start" }); // 버튼까지 내려갔다면 그림을 다시 보이게
        log(`${e.scene} → ${c[0]}${drift ? " (흘러가는 대로)" : ""}`, "pick");
        setTimeout(() => { $clock.classList.remove("stop"); paused = false; last = performance.now(); requestAnimationFrame(tick); }, 600);
      };
      const to = setTimeout(() => choose(Math.random() < 0.5 ? 0 : 1, true), PICK_MS); // 선택 시간은 배속하지 않음
      $ev.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => choose(+b.dataset.i, false)));
    };

    const tick = (now) => {
      if (paused) return;
      const dt = Math.min(100, now - last) * speed;
      last = now;
      clock = Math.min(CLOCK_MS, clock + dt);
      age = (clock / CLOCK_MS) * death;
      $age.textContent = Math.floor(age);
      $sec.textContent = Math.max(0, Math.ceil((CLOCK_MS - clock) / 1000));
      $fill.style.width = (clock / CLOCK_MS) * 100 + "%";
      const nextEv = ei < events.length ? events[ei].age : Infinity;
      while (fi < flow.length && flow[fi].age <= age && flow[fi].age <= nextEv) {
        const m = flow[fi++];
        if (m.pic) { setScene(m.art, m.text); log(m.text, "mile"); } else log(m.text);
      }
      if (nextEv <= age) { age = nextEv; clock = (age / death) * CLOCK_MS; $age.textContent = age; return ask(events[ei++]); }
      if (clock >= CLOCK_MS) return finish(death, picks, me, shown);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function finish(death, picks, me, shown) {
    cancelAnimationFrame(raf);
    done++;
    try { localStorage.setItem(DONE_KEY, String(done)); } catch (e) {} // 완주 횟수만 기기에 저장
    const score = { adventure: 0, love: 0, stable: 0, fun: 0 };
    let lastKind = "stable";
    picks.forEach((p) => { score[p.kind]++; lastKind = p.kind; });
    const drifts = picks.filter((p) => p.drift).length;
    const top = Math.max(...Object.values(score));
    const tied = Object.keys(score).filter((k) => score[k] === top);
    const key = drifts >= 4 ? "drift" : tied.includes(lastKind) ? lastKind : tied[0];
    const T = D.types[key];
    const y = birthYear(me.tti), ttiName = (TTI[me.tti] || {}).name || "";
    // 이름은 화면에만 그리고, 결과 이미지(data-card-*)·공유 문구에는 넣지 않음
    box.innerHTML = `
<div class="result">
  <div class="result-card life-card" data-card-title="1분 인생 · 향년 ${death}세" data-card-main="${esc(T.name)}" data-card-sub="${esc(T.epitaph)}">
    <canvas class="life-pix end" id="life-end" width="${PX.W}" height="${PX.H}" role="img" aria-label="노을 진 산골 언덕의 묘비"></canvas>
    ${me.name ? `<p class="life-name">${esc(me.name)}</p>` : ""}
    <p class="life-years">${esc(ttiName)} · ${y} – ${y + death} · ${esc(BORN[me.born])}에서 태어남</p>
    <div class="rc-main">${esc(T.name)}</div>
    <p>“${esc(T.epitaph)}”</p>
    <dl class="rc-meta"><div><dt>향년</dt><dd>${death}세</dd></div><div><dt>직접 고른 순간</dt><dd>${picks.length - drifts}번</dd></div><div><dt>흘려보낸 순간</dt><dd>${drifts}번</dd></div></dl>
  </div>
  <h2 class="sub">내가 고른 인생</h2>
  <ol class="life-timeline" data-bgs="${esc(shown.join(","))}">${picks.map((p) => `<li><b>${p.age}세</b><span>${esc(p.scene)}</span><strong>${esc(p.choice)}${p.drift ? " <em>흘러가는 대로</em>" : ""}</strong></li>`).join("")}<li><b>${death}세</b><span>긴 여행을 마쳤다</span></li></ol>
  <div class="result-grid">
    <a class="btn" href="${NALGI.url(`/story/life/${D.slugs[key]}/`)}">${esc(T.name)} 자세히 보기</a>
    <button type="button" class="btn ghost" data-act="again">한 번 더 살아 보기</button>
  </div>
  ${NALGI.shareBar({ title: `1분 인생: 나는 ${T.name}`, text: `향년 ${death}세, “${T.epitaph}”`, path: "/story/life/" })}
</div>`;
    PX.draw(box.querySelector("#life-end"), SCENES.ending, death, cast, 0);
    box.querySelector('[data-act="again"]').addEventListener("click", () => { newCast(); start(); });
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }
})();
