(function () {
  const box = document.getElementById("quiz");
  const Q = NALGI.data.questions, esc = NALGI.esc;
  const SCALE = [["매우 그렇다", 2], ["그렇다", 1], ["보통이다", 0], ["아니다", -1], ["전혀 아니다", -2]];
  const ans = new Array(Q.length).fill(null);
  let i = 0;
  function render() {
    const q = Q[i];
    box.innerHTML = `
<div class="q-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${Q.length}" aria-valuenow="${i}"><i style="width:${(i / Q.length) * 100}%"></i></div>
<p class="q-count">${i + 1} / ${Q.length}</p>
<p class="q-text">${esc(q.t)}</p>
<div class="q-scale">${SCALE.map(([l, v]) => `<button type="button" data-v="${v}" class="${ans[i] === v ? "sel" : ""}">${l}</button>`).join("")}</div>
<div class="q-nav"><button type="button" data-act="prev" ${i === 0 ? "disabled style=visibility:hidden" : ""}>← 이전 문항</button><span></span></div>`;
  }
  function finish() {
    const s = { EI: 0, SN: 0, TF: 0, JP: 0 };
    Q.forEach((q, k) => { const first = q.axis[0]; s[q.axis] += (q.dir === first ? 1 : -1) * ans[k]; });
    const per = {}; for (const ax in s) { const n = Q.filter((q) => q.axis === ax).length * 2; per[ax] = Math.round(((s[ax] + n) / (2 * n)) * 100); }
    const code = (per.EI >= 50 ? "E" : "I") + (per.SN >= 50 ? "S" : "N") + (per.TF >= 50 ? "T" : "F") + (per.JP >= 50 ? "J" : "P");
    const r = `E${per.EI}S${per.SN}T${per.TF}J${per.JP}`;
    box.innerHTML = `<p class="center">결과를 정리하고 있어요…</p>`;
    location.href = NALGI.url(`/me/personality/${code.toLowerCase()}/`) + `?r=${r}`;
  }
  box.addEventListener("click", (e) => {
    if (e.target.closest("[data-act=start]")) { render(); box.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (e.target.closest("[data-act=prev]")) { if (i > 0) { i--; render(); } return; }
    const b = e.target.closest("[data-v]"); if (!b) return;
    ans[i] = +b.dataset.v;
    b.classList.add("sel");
    setTimeout(() => { if (i < Q.length - 1) { i++; render(); } else finish(); }, 160);
  });
})();
