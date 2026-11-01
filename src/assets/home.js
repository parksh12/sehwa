// 홈 탭: 인기 / 전체
(function () {
  const tabs = [...document.querySelectorAll('[role="tab"][data-tab]')];
  const show = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => show(t));
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      show(n); n.focus();
    });
  });
})();

// 홈: 툴 검색 — 빌드 때 만든 툴 목록(#tool-index)을 브라우저에서 거릅니다. 검색어는 어디에도 보내지 않습니다.
(function () {
  const input = document.getElementById("tool-q");
  const data = document.getElementById("tool-index");
  if (!input || !data) return;
  let list = [];
  try { list = JSON.parse(data.textContent); } catch (e) { return; }
  const hits = document.getElementById("tool-hits");
  const count = document.getElementById("tool-hits-n");
  const norm = (s) => String(s || "").toLowerCase().replace(/[\s·\-_()]/g, "");
  list.forEach((x) => { x._t = norm(x.t); x._all = norm(`${x.t} ${x.c} ${x.k}`); });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let cur = [];
  const run = () => {
    const raw = input.value.trim();
    if (!raw) { hits.hidden = true; hits.innerHTML = ""; count.textContent = ""; cur = []; return; }
    const words = raw.toLowerCase().split(/\s+/).map(norm).filter(Boolean);
    cur = list
      .map((x) => ({ x, s: words.every((w) => x._all.includes(w)) ? (x._t.includes(words.join("")) ? 3 : words.some((w) => x._t.includes(w)) ? 2 : 1) : 0 })) // 3: 적은 순서 그대로 제목에 있음
      .filter((r) => r.s)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.x);
    hits.innerHTML = cur.length
      ? cur.map((x) => `<li><a href="${esc(x.p)}"><b>${esc(x.t)}</b>${x.b ? ' <em class="beta">베타</em>' : ""}<small>${esc(x.c)}</small></a></li>`).join("")
      : `<li class="none">「${esc(raw)}」에 맞는 툴이 아직 없어요. 다른 말로 찾아보세요.</li>`;
    hits.hidden = false;
    count.textContent = cur.length ? `${cur.length}개 찾았어요. 엔터를 누르면 첫 번째 툴로 가요.` : "";
  };
  input.addEventListener("input", run);
  input.closest("form").addEventListener("submit", (e) => { e.preventDefault(); if (cur[0]) location.href = cur[0].p; });
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") { input.value = ""; run(); } });
  run();
})();

// 놀이터: 「아무거나 한 장 뽑기」 — 덱을 섞은 뒤 한 장을 뽑아 해당 콘텐츠로 이동
(function () {
  const deck = document.querySelector(".deck");
  const btn = document.querySelector('[data-act="draw"]');
  if (!deck || !btn) return;
  const cards = [...deck.querySelectorAll(".deck-card")];
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  btn.addEventListener("click", () => {
    if (deck.classList.contains("shuffling")) return;
    const pick = cards[Math.floor(Math.random() * cards.length)];
    if (still) { location.href = pick.href; return; }
    btn.disabled = true;
    deck.classList.add("shuffling");
    setTimeout(() => {
      deck.classList.remove("shuffling");
      deck.classList.add("drawn");
      pick.classList.add("picked");
      setTimeout(() => { location.href = pick.href; }, 750);
    }, 650);
  });

  // 뒤로 가기로 돌아왔을 때(bfcache) 덱 원상복구
  addEventListener("pageshow", () => {
    btn.disabled = false;
    deck.classList.remove("shuffling", "drawn");
    cards.forEach((c) => c.classList.remove("picked"));
  });
})();
