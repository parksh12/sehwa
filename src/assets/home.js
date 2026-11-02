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
      ? cur.map((x) => `<li><a href="${esc(x.p)}"${x.x ? ' target="_blank" rel="noopener"' : ""}><b>${esc(x.t)}</b>${x.b ? ' <em class="beta">베타</em>' : ""}<small>${esc(x.c)}</small></a></li>`).join("")
      : `<li class="none">「${esc(raw)}」에 맞는 툴이 아직 없어요. 다른 말로 찾아보세요.</li>`;
    hits.hidden = false;
    count.textContent = cur.length ? `${cur.length}개 찾았어요. 엔터를 누르면 첫 번째 툴로 가요.` : "";
  };
  input.addEventListener("input", run);
  input.closest("form").addEventListener("submit", (e) => { e.preventDefault(); if (cur[0]) { if (cur[0].x) window.open(cur[0].p, "_blank", "noopener"); else location.href = cur[0].p; } });
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") { input.value = ""; run(); } });
  run();
})();

// 오락실: 「아무거나 한 판」 — 숨겨 둔 목록([data-draw-pool])에서 하나를 골라 이동
(function () {
  const btn = document.querySelector('[data-act="draw"]');
  const links = [...document.querySelectorAll("[data-draw-pool] a")];
  if (!btn || !links.length) return;
  btn.addEventListener("click", () => {
    const pick = links[Math.floor(Math.random() * links.length)];
    btn.disabled = true;
    btn.textContent = `${pick.textContent}(으)로 갈게요…`;
    setTimeout(() => { location.href = pick.href; }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450);
  });
  addEventListener("pageshow", () => { btn.disabled = false; btn.textContent = "아무거나 한 판"; });
})();
