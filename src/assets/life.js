// 1분 인생 — 오늘 태어난 한 사람의 일생을 약 1분 동안 살아 보는 이야기 게임
(function () {
  const box = document.getElementById("life");
  if (!box) return;
  const D = NALGI.data, esc = NALGI.esc;

  // 갈림길: [나이, 장면, [선택 A, 결], [선택 B, 결]]  결: adventure / love / stable / fun
  const EVENTS = [
    [5, "유치원 장기자랑 날", ["무대 한가운데로", "fun"], ["맨 뒷줄에서 율동", "stable"]],
    [8, "골목에서 아기 고양이를 만났다", ["집에 데려가자고 조른다", "love"], ["몰래 우유만 두고 온다", "stable"]],
    [13, "방학 숙제가 산더미다", ["마지막 날 밤샘", "fun"], ["하루 한 장씩", "stable"]],
    [17, "짝사랑과 교실에 단둘이 남았다", ["말을 건다", "love"], ["창밖만 본다", "stable"]],
    [20, "첫 아르바이트 월급이 들어왔다", ["혼자 배낭여행", "adventure"], ["적금 통장 개설", "stable"]],
    [24, "친구가 같이 창업하자고 한다", ["같이 한다", "adventure"], ["응원만 한다", "stable"]],
    [28, "아무 약속 없는 주말 아침", ["새벽 등산", "adventure"], ["늦잠 자고 만화책", "fun"]],
    [31, "고백을 받았다", ["좋아요", "love"], ["조금만 생각할게요", "stable"]],
    [35, "해외 발령 제안이 왔다", ["간다", "adventure"], ["가족 곁에 남는다", "love"]],
    [41, "갑자기 춤이 배우고 싶어졌다", ["학원 등록", "fun"], ["영상 보며 독학", "stable"]],
    [48, "연락 끊겼던 친구에게서 문자가 왔다", ["당장 만나러 간다", "love"], ["다음에 보자고 한다", "stable"]],
    [55, "두 번째 직업을 고민 중이다", ["빵집을 연다", "adventure"], ["하던 일을 마저", "stable"]],
    [63, "손주가 게임을 가르쳐 달란다", ["밤새 같이 한다", "fun"], ["산책 가자고 꼬신다", "love"]],
    [70, "버킷리스트 마지막 줄", ["스카이다이빙", "adventure"], ["고향 바다 보러 가기", "love"]],
    [76, "동네 노래자랑이 열렸다", ["트로트 한 곡 뽑는다", "fun"], ["맨 앞줄 박수 담당", "love"]],
  ];
  // 누구에게나 지나가는 장면
  const MOMENTS = [
    [0, "응애. 세상에 나왔다"], [1, "처음으로 두 발로 섰다"], [3, "편식을 시작했다"], [7, "자전거를 배웠다"], [10, "두 자릿수 나이가 됐다"],
    [12, "첫 휴대폰이 생겼다"], [15, "키가 훌쩍 컸다"], [19, "시험이 끝났다"], [22, "밤새 이야기할 친구가 생겼다"], [26, "첫 이사를 했다"],
    [30, "앞자리가 바뀌었다"], [33, "단골 국밥집이 생겼다"], [39, "흰머리 한 가닥을 발견했다"], [44, "허리가 아프기 시작했다"], [50, "반백 년을 살았다"],
    [52, "건강검진 결과: 이상 없음"], [58, "돋보기를 샀다"], [60, "환갑잔치를 했다"], [66, "화분을 열 개쯤 키운다"], [72, "아침잠이 없어졌다"],
    [80, "여든 번째 봄을 맞았다"], [85, "옛날 사진을 자주 꺼내 본다"], [90, "동네 최고령 멤버가 됐다"], [95, "다들 비결을 묻는다"],
  ];
  const RUN_MS = 40000, PICK_MS = 3000;

  const start = () => {
    const events = EVENTS.slice().sort(() => Math.random() - 0.5).slice(0, 10).sort((a, b) => a[0] - b[0]);
    const death = Math.max(events[events.length - 1][0] + 4, 74 + Math.floor(Math.random() * 23));
    const moments = MOMENTS.filter((m) => m[0] < death);
    const picks = [];
    let age = 0, last = performance.now(), ei = 0, mi = 0, paused = false;

    box.innerHTML = `
<div class="life-run">
  <div class="life-age"><b id="life-age">0</b>세</div>
  <div class="life-bar" aria-hidden="true"><i id="life-fill"></i></div>
  <ul class="life-log" id="life-log" aria-live="polite"></ul>
  <div class="life-event" id="life-event" hidden></div>
</div>`;
    const $age = box.querySelector("#life-age"), $fill = box.querySelector("#life-fill"), $log = box.querySelector("#life-log"), $ev = box.querySelector("#life-event");
    const log = (text, cls = "") => {
      const li = document.createElement("li"); li.className = cls; li.innerHTML = `<b>${Math.floor(age)}세</b> ${esc(text)}`;
      $log.prepend(li); while ($log.children.length > 4) $log.lastChild.remove();
    };

    const ask = (e) => {
      paused = true;
      const [a, scene, A, B] = e;
      $ev.hidden = false;
      $ev.innerHTML = `<p class="life-scene">${a}세, ${esc(scene)}</p>
<div class="life-choices"><button type="button" class="btn big" data-i="0">${esc(A[0])}</button><button type="button" class="btn big ghost" data-i="1">${esc(B[0])}</button></div>
<div class="life-timer"><i></i></div>`;
      const timer = $ev.querySelector(".life-timer i");
      requestAnimationFrame(() => { timer.style.transition = `width ${PICK_MS}ms linear`; timer.style.width = "0%"; });
      let done = false;
      const choose = (i, drift) => {
        if (done) return; done = true; clearTimeout(to);
        const c = [A, B][i];
        picks.push({ age: a, scene, choice: c[0], kind: c[1], drift });
        $ev.hidden = true; $ev.innerHTML = "";
        log(`${scene} → ${c[0]}${drift ? " (흘러가는 대로)" : ""}`, "pick");
        paused = false; last = performance.now(); requestAnimationFrame(tick);
      };
      const to = setTimeout(() => choose(Math.random() < 0.5 ? 0 : 1, true), PICK_MS);
      $ev.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => choose(+b.dataset.i, false)));
      $ev.querySelector("button").focus({ preventScroll: true });
    };

    const tick = (now) => {
      if (paused) return;
      age = Math.min(death, age + ((now - last) / RUN_MS) * death);
      last = now;
      $age.textContent = Math.floor(age);
      $fill.style.width = Math.min(100, age) + "%";
      while (mi < moments.length && moments[mi][0] <= age) log(moments[mi++][1]);
      if (ei < events.length && events[ei][0] <= age) { age = events[ei][0]; $age.textContent = age; return ask(events[ei++]); }
      if (age >= death) return finish(death, picks);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const finish = (death, picks) => {
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
    box.querySelector('[data-act="again"]').addEventListener("click", start);
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  box.querySelector('[data-act="start"]')?.addEventListener("click", start);
})();
