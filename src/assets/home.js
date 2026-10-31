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

// 홈: 「아무거나 한 장 뽑기」 — 덱을 섞은 뒤 한 장을 뽑아 해당 테스트로 이동
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
