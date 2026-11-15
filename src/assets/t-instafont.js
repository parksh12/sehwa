// P2-68 인스타 폰트 변환기 화면. 변환식은 insta-font.js(INSTAFONT). 입력한 글은 저장·전송하지 않음
(function () {
  const box = document.querySelector('[data-tool="instafont"]');
  if (!box || !window.INSTAFONT) return;
  const F = window.INSTAFONT;
  const $ = (s) => box.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = (m) => (window.NALGI && NALGI.toast ? NALGI.toast(m) : null);
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok; }
  };
  const src = $("#if-src"), list = $(".if-list"), deco = $(".if-deco"), note = $(".if-note");
  const SAMPLE = "Penguin Tools 2026";
  const row = (kind, id, name, out) => `<button type="button" class="if-row" data-kind="${kind}" data-id="${id}" aria-label="${esc(name)} 복사"><span class="if-name">${esc(name)}</span><span class="if-out">${esc(out)}</span><span class="if-copy" aria-hidden="true">복사</span></button>`;
  let outs = {};
  const render = () => {
    const t = src.value || SAMPLE;
    outs = {};
    list.innerHTML = F.STYLES.map((s) => { const o = F.convert(s.id, t); outs[`s:${s.id}`] = o; return row("s", s.id, `${s.name} · ${s.en}`, o); }).join("");
    deco.innerHTML = [...F.WRAPS.map((w) => { const o = F.wrap(w.id, t); outs[`w:${w.id}`] = o; return row("w", w.id, w.name, o); }), ...F.BETWEEN.map((b) => { const o = F.between(b.id, t); outs[`b:${b.id}`] = o; return row("b", b.id, b.name, o); })].join("");
    const hasKo = /[ㄱ-ㆎ가-힣]/.test(t);
    note.hidden = !hasKo;
  };
  box.addEventListener("click", async (e) => {
    const b = e.target.closest(".if-row");
    if (!b) return;
    const o = outs[`${b.dataset.kind}:${b.dataset.id}`];
    if (!o) return;
    toast((await copy(o)) ? `${o.length > 24 ? [...o].slice(0, 20).join("") + "…" : o} 복사했어요` : "복사에 실패했어요");
  });
  src.addEventListener("input", render);
  $("[data-if-clear]").addEventListener("click", () => { src.value = ""; render(); src.focus(); });
  $("[data-if-example]").addEventListener("click", () => { src.value = "Good Vibes Only ♡ 오늘도 화이팅"; render(); });
  render();
})();
