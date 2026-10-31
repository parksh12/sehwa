(function () {
  const q = new URLSearchParams(location.search);
  const a = +q.get("a"), s = +q.get("s"), b = +q.get("b");
  const el = document.getElementById("my-rt");
  if (!el || !(a > 0 && a < 5000) || !(s >= 0 && s < 5000) || !(b > 0 && b < 5000)) return;
  el.innerHTML = `<div><dt>나의 평균</dt><dd>${a}ms</dd></div><div><dt>최고 기록</dt><dd>${b}ms</dd></div><div><dt>흩어짐(편차)</dt><dd>${s}ms</dd></div>`;
  el.hidden = false;
  const card = document.querySelector("[data-card-main]");
  if (card) card.dataset.cardSub = `평균 ${a}ms · 최고 ${b}ms — ` + card.dataset.cardSub;
})();
