// 인생 게임(가칭, 주소 /story/life/) — P2-21 터닝포인트 선택형
// 시간 제한 없음: 장면은 플레이어가 「다음」을 눌러야 넘어가고, 「빨리 보기」를 켜면 고를 것이 없는 장면만 저절로 넘어갑니다(언제든 끌 수 있음).
// 진학·첫 직업·결혼·자녀·이직·이사·위기·은퇴는 플레이어가 직접 고르고, 고른 값(f)에 맞는 작은 사건·그림·동반 인물·복장·엔딩만 나옵니다.
(function () {
  const box = document.getElementById("life");
  if (!box) return;
  const D = NALGI.data, esc = NALGI.esc, PX = NALGI.pixel;
  const L = NALGI.lifeData, { SLOTS, MOMENTS, SCENES, MILESTONES, BORN, NEEDS, MOMENT_NEEDS, OUTFIT, JOB_NAME, HOME_VIEW, TURNS, CRISES, ENDINGS, SMALL_AGES, MOMENT_AGES } = L;
  const KIND = { a: "adventure", l: "love", s: "stable", f: "fun" };
  const DONE_KEY = "nalgi-life-done", FAST_MS = 1100;
  const DEBUG = /lifedebug/.test(location.hash);
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const LOOKS = ["m", "f", "n"], PLACES = ["city", "sea", "mountain"];
  const PLACE_BG = { city: "street", sea: "beach", mountain: "village" };
  const TTI = D.tti || [];
  const thisYear = new Date().getFullYear();
  const ttiOfYear = (y) => (((y - 4) % 12) + 12) % 12; // 0 = 쥐띠
  const birthYear = (i) => thisYear - ((((thisYear - 4 - i) % 12) + 12) % 12); // 고른 띠의 가장 최근 해
  const val = (v, f) => (typeof v === "function" ? v(f) : v);

  let done = 0;
  try { done = +localStorage.getItem(DONE_KEY) || 0; } catch (e) {}
  let raf = 0;

  // ---------- 시작 화면 (성별·태어난 곳·띠·이름) ----------
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
    const fd = new FormData(form);
    setup.look = fd.get("look") || "n"; setup.born = fd.get("born") || "city"; setup.tti = +fd.get("tti"); setup.name = String(fd.get("name") || "").trim().slice(0, 8);
  };
  const showDone = () => {
    const el = box.querySelector("#life-done");
    if (el && done) { el.hidden = false; el.textContent = `이 기기에서 ${done}번 완주했어요. 이번에는 다른 길을 골라 보세요.`; }
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
    $intro?.addEventListener("click", newCast);
    form.addEventListener("submit", (e) => { e.preventDefault(); readForm(); start(); });
  }
  readForm(); newCast(); updateLabel(); showDone();
  raf = requestAnimationFrame(preview);

  // ---------- 조건 검사 ----------
  const hasKids = (f) => f.kids === "bio" || f.kids === "adopt";
  const isEmployed = (f) => ["company", "public", "pro"].includes(f.job) && !f.quit;
  function ok(n, f) {
    if (!n) return true;
    if (n.skip) return false;
    if (n.married !== undefined && !!f.married !== n.married) return false;
    if (n.kids && !hasKids(f)) return false;
    if (n.employed && !isEmployed(f)) return false;
    if (n.edu && !n.edu.includes(f.edu)) return false;
    if (n.job && !n.job.includes(f.job)) return false;
    if (n.notJob && n.notJob.includes(f.job)) return false;
    if (n.notHome && n.notHome.includes(f.home)) return false;
    if (n.retired && !(f.retire && f.retire !== "work")) return false;
    return true;
  }

  // 장면 + 고른 값에 따른 동반 인물(family 장면: 배우자·자녀·반려동물)
  function sceneOf(key, f, age) {
    const s = SCENES[key];
    if (!s || !s.family) return s;
    const w = (s.with || []).slice(), props = (s.props || []).slice(), roles = w.map((x) => x[0]);
    if (f.married && !roles.includes("lover")) w.push(["lover", 62, "stand"]);
    if (hasKids(f) && !roles.includes("kid") && !roles.includes("child")) w.push([age >= 55 ? "child" : "kid", 24, "act"]);
    if (f.pet && !props.some((p) => p[0] === "dog")) props.push(["dog", 74]);
    return { ...s, with: w, props };
  }

  // ---------- 한 판 ----------
  function start() {
    cancelAnimationFrame(raf);
    const me = { ...setup };
    const f = { born: me.born };
    const kinds = { adventure: 0, love: 0, stable: 0, fun: 0 };
    const life = [], used = new Set(), trace = [];
    if (DEBUG) window.__life = { trace, flags: f, life };
    const death = 75 + rnd(0, 20);
    let age = 0, scene = SCENES.born, fast = false, timer = 0, lastBg = "";

    // 나이순 할 일 목록. 터닝포인트는 그 나이가 됐을 때 조건(when)을 다시 봄
    const agenda = [
      ...MILESTONES.map(([[lo], text, key]) => ({ age: lo, type: "mile", text: typeof text === "string" ? text : text[me.born], art: key.replace("{born}", me.born) })),
      ...SMALL_AGES.filter((a) => a < death).map((a) => ({ age: a, type: "small" })),
      ...MOMENT_AGES.filter((a) => a < death).map((a) => ({ age: a, type: "moment" })),
      ...TURNS.map((t) => ({ age: t.age, type: "turn", t })),
    ].sort((a, b) => a.age - b.age || (a.type === "turn" ? 1 : 0) - (b.type === "turn" ? 1 : 0));
    let ai = 0;

    box.innerHTML = `
<div class="life-run">
  <canvas class="life-pix" id="life-pix" width="${PX.W}" height="${PX.H}" role="img" aria-label="지금 장면" tabindex="0"></canvas>
  <div class="life-hud">
    <div class="life-age"><b id="life-age">0</b>세</div>
    <button type="button" class="life-fast" id="life-fast" aria-pressed="false">빨리 보기</button>
  </div>
  <div class="life-bar" aria-hidden="true"><i id="life-fill"></i></div>
  <div class="life-event" id="life-event"></div>
  <ul class="life-log" id="life-log" aria-live="polite"></ul>
</div>`;
    box.scrollIntoView({ block: "start" });
    const $ = (s) => box.querySelector(s);
    const $pix = $("#life-pix"), $age = $("#life-age"), $fill = $("#life-fill"), $log = $("#life-log"), $ev = $("#life-event"), $run = $(".life-run"), $fast = $("#life-fast");
    const view = () => (age < 20 ? me.born : HOME_VIEW[f.home] || "city");
    const paint = (now) => { PX.draw($pix, scene, age, cast, now, view()); raf = requestAnimationFrame(paint); };
    raf = requestAnimationFrame(paint);
    const setAge = (a) => { age = a; $age.textContent = a; $fill.style.width = Math.min(100, (a / death) * 100) + "%"; };
    const log = (text, cls = "") => { const li = document.createElement("li"); li.className = cls; li.innerHTML = `<b>${age}세</b> ${esc(text)}`; $log.prepend(li); while ($log.children.length > 4) $log.lastChild.remove(); };
    const show = (key, label, kind, text) => {
      const s = sceneOf(key, f, age);
      if (s) { scene = s; lastBg = s.bg; $pix.setAttribute("aria-label", label || text || "장면"); }
      if (DEBUG) trace.push({ age, kind, key, text: text || label || "", roles: (scene.with || []).map((w) => w[0]), props: (scene.props || []).map((p) => p[0]), f: JSON.parse(JSON.stringify(f)) });
    };
    const applyJob = () => {
      f.jobName = JOB_NAME[f.job] || "";
      const o = OUTFIT[f.job];
      if (o) { cast.me = { ...cast.me, top: o[0], top2: o[1], bot: o[2] }; }
    };
    // 「다음」 카드: 고를 것이 없는 장면. 빨리 보기면 저절로 넘어감
    const nextCard = (html) => {
      $ev.innerHTML = `${html}<div class="life-next-row"><button type="button" class="btn big" data-next>다음 ▶</button></div>`;
      const go = () => { clearTimeout(timer); $ev.innerHTML = ""; advance(); };
      $ev.querySelector("[data-next]").addEventListener("click", go);
      if (fast) timer = setTimeout(go, FAST_MS);
    };
    const choiceCard = (title, opts, onPick, cls = "") => {
      clearTimeout(timer);
      $ev.innerHTML = `<p class="life-scene">${age}세, ${esc(title)}</p><div class="life-choices ${cls}">${opts.map((o, i) => `<button type="button" class="btn big${i ? " ghost" : ""}" data-i="${i}">${esc(o)}</button>`).join("")}</div>`;
      $ev.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => { $ev.innerHTML = ""; onPick(+b.dataset.i); }));
      if ($ev.getBoundingClientRect().bottom > innerHeight) $ev.scrollIntoView({ block: "nearest" });
    };
    $fast.addEventListener("click", () => {
      fast = !fast; $fast.setAttribute("aria-pressed", String(fast)); $fast.textContent = fast ? "멈추기" : "빨리 보기";
      const nb = $ev.querySelector("[data-next]"); if (fast && nb) timer = setTimeout(() => nb.click(), FAST_MS / 2); else clearTimeout(timer);
    });
    $pix.addEventListener("click", () => $ev.querySelector("[data-next]")?.click()); // 그림을 눌러도 다음
    $pix.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $ev.querySelector("[data-next]")?.click(); } });

    function advance() {
      while (ai < agenda.length) {
        const it = agenda[ai++];
        if (it.age >= death) break;
        setAge(it.age);
        if (it.type === "mile") { show(it.art, it.text, "mile", it.text); log(it.text, "mile"); return nextCard(`<p class="life-scene">${age}세</p><p class="life-text">${esc(it.text)}</p>`); }
        if (it.type === "moment") {
          const list = (MOMENTS.find(([[lo, hi]]) => it.age >= lo && it.age <= hi) || [, []])[1].filter((t) => !used.has(t) && MOMENT_NEEDS.every(([re, n]) => !re.test(t) || ok(n, f)));
          if (list.length) { const t = list[rnd(0, list.length - 1)]; used.add(t); log(t); if (DEBUG) trace.push({ age, kind: "moment", key: "", text: t, roles: [], props: [], f: JSON.parse(JSON.stringify(f)) }); }
          continue;
        }
        if (it.type === "small") {
          const slot = SLOTS.find(([[lo, hi]]) => it.age >= lo && it.age <= hi);
          if (!slot) continue;
          const cand = shuffle(slot[1].filter((e) => !used.has(e[5]) && ok(NEEDS[e[5]], f)));
          if (!cand.length) continue;
          const e = cand.find((x) => SCENES[x[5]].bg !== lastBg) || cand[0];
          used.add(e[5]);
          show(e[5], e[0], "small", e[0]);
          return choiceCard(e[0], [e[1], e[3]], (i) => {
            const c = i ? [e[3], e[4]] : [e[1], e[2]];
            kinds[KIND[c[1]]]++;
            log(`${e[0]} → ${c[0]}`, "pick");
            advance();
          });
        }
        if (it.type === "turn") {
          const t = it.t;
          if (t.when && !t.when(f)) continue;
          let q = val(t.q, f), art = t.art, crisis = null;
          if (t.crisis) { const cs = CRISES.filter((c) => !c.when || c.when(f)); crisis = cs[rnd(0, cs.length - 1)]; q = crisis.q; art = crisis.art; }
          const opts = t.opts.filter((o) => !o.if || o.if(f));
          show(art, q, "turn-q", q);
          return choiceCard(q, opts.map((o) => o.label), (i) => {
            const o = opts[i];
            Object.assign(f, o.set);
            if (crisis) { f.crisis = crisis.id; if (crisis.after && crisis.after[f.crisisWay]) Object.assign(f, crisis.after[f.crisisWay]); }
            if ("job" in o.set || (crisis && crisis.after && crisis.after[f.crisisWay])) applyJob();
            kinds[o.kind]++;
            const text = crisis ? crisis.text[f.crisisWay] : val(o.text, f);
            life.push({ age, q, choice: o.label, id: t.id });
            show(o.art, text, "turn-a", text);
            log(`${q} → ${o.label}`, "pick");
            log(text, "mile");
            nextCard(`<p class="life-scene">${age}세 · 내가 고른 길: <b>${esc(o.label)}</b></p><p class="life-text">${esc(text)}</p>`);
          }, opts.length > 2 ? "many" : "");
        }
      }
      finish();
    }
    function finish() {
      cancelAnimationFrame(raf); clearTimeout(timer);
      setAge(death);
      done++;
      try { localStorage.setItem(DONE_KEY, String(done)); } catch (e) {} // 완주 횟수만 기기에 저장
      const end = ENDINGS.find((x) => x.if(f));
      // 성향(작은 선택·터닝포인트의 결): 가장 많은 결, 네 결이 고르게 섞였으면 「바람 따라」
      const vals = Object.values(kinds), top = Math.max(...vals);
      const typeKey = top - Math.min(...vals) <= 1 ? "drift" : Object.keys(kinds).find((k) => kinds[k] === top);
      const T = D.types[typeKey];
      if (DEBUG) { window.__life.end = end.key; window.__life.typeKey = typeKey; }
      const y = birthYear(me.tti), ttiName = (TTI[me.tti] || {}).name || "";
      const famLine = [f.married ? "배우자" : "", f.kids === "bio" ? "아이" : f.kids === "adopt" ? "입양한 아이" : "", f.pet ? "강아지" : ""].filter(Boolean).join(" · ") || "혼자";
      // 이름은 화면에만. 결과 이미지(data-card-*)·공유 문구에는 넣지 않음
      box.innerHTML = `
<div class="result">
  <div class="result-card life-card" data-card-title="인생 연표 · 향년 ${death}세" data-card-main="${esc(end.name)}" data-card-sub="${esc(end.epitaph)}" data-end="${esc(end.key)}">
    <canvas class="life-pix end" id="life-end" width="${PX.W}" height="${PX.H}" role="img" aria-label="마지막 장면"></canvas>
    ${me.name ? `<p class="life-name">${esc(me.name)}</p>` : ""}
    <p class="life-years">${esc(ttiName)} · ${y} – ${y + death} · ${esc(BORN[me.born])}에서 태어남</p>
    <div class="rc-main">${esc(end.name)}</div>
    <p>“${esc(end.epitaph)}”</p>
    <dl class="rc-meta"><div><dt>향년</dt><dd>${death}세</dd></div><div><dt>마지막 직업</dt><dd>${esc(f.quit && f.job !== "shop" ? "쉬는 중" : JOB_NAME[f.job] || "-")}</dd></div><div><dt>함께한 가족</dt><dd>${esc(famLine)}</dd></div></dl>
  </div>
  <p class="center hint">${esc(end.sum)} · 인생 성향: <a href="${NALGI.url(`/story/life/${D.slugs[typeKey]}/`)}">${esc(T.name)}</a></p>
  <h2 class="sub">내 인생 연표 (직접 고른 터닝포인트)</h2>
  <ol class="life-timeline">${life.map((p) => `<li><b>${p.age}세</b><span>${esc(p.q)}</span><strong>${esc(p.choice)}</strong></li>`).join("")}<li><b>${death}세</b><span>긴 여행을 마쳤다</span></li></ol>
  <div class="result-grid">
    <a class="btn" href="${NALGI.url(`/story/life/${D.slugs[typeKey]}/`)}">인생 성향 「${esc(T.name)}」 보기</a>
    <button type="button" class="btn ghost" data-act="again">다른 길로 다시 살아 보기</button>
  </div>
  ${NALGI.shareBar({ title: `내 인생 엔딩: ${end.name}`, text: `향년 ${death}세, “${end.epitaph}”`, path: "/story/life/" })}
</div>`;
      PX.draw(box.querySelector("#life-end"), SCENES[end.art] || SCENES.ending, death, cast, 0, view());
      box.querySelector('[data-act="again"]').addEventListener("click", () => { newCast(); start(); });
      box.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    advance();
  }
})();
