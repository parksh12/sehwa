// P2-57 줄바꿈 제거 · 공백 정리 화면. 변환식은 text-clean.js(TEXTCLEAN). 입력한 글은 저장·전송하지 않음
(function () {
  const box = document.querySelector('[data-tool="linebreak"]');
  if (!box || !window.TEXTCLEAN) return;
  const TC = window.TEXTCLEAN;
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok; }
  };
  const toast = (m) => (window.NALGI && NALGI.toast ? NALGI.toast(m) : null);
  const fmt = (n) => n.toLocaleString("ko-KR");
  const $ = (s) => box.querySelector(s);
  const inp = $("#lb-in"), out = $("#lb-out"), form = $(".lb-opts");
  const val = (n) => (form.querySelector(`[name="${n}"]:checked`) || {}).value;
  const on = (n) => form.querySelector(`[name="${n}"]`).checked;
  const opts = () => ({ join: val("join"), blank: val("blank"), collapse: on("collapse"), trim: on("trim"), tabs: on("tabs"), oddSpace: on("oddSpace"), invisible: on("invisible"), hyphen: on("hyphen"), krNoSpace: on("krNoSpace") });
  const PRESET = {
    pdf: { join: "pdf", blank: "one", collapse: true, trim: true, tabs: true, oddSpace: true, invisible: true, hyphen: true, krNoSpace: false },
    line: { join: "space", blank: "one", collapse: true, trim: true, tabs: true, oddSpace: true, invisible: true, hyphen: true, krNoSpace: false },
    space: { join: "none", blank: "one", collapse: true, trim: true, tabs: true, oddSpace: true, invisible: true, hyphen: true, krNoSpace: false },
  };
  const setOpts = (p) => {
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === "boolean") form.querySelector(`[name="${k}"]`).checked = v;
      else { const r = form.querySelector(`[name="${k}"][value="${v}"]`); if (r) r.checked = true; }
    }
  };
  const EXAMPLE = "개인정보 처리방침은 이용자의 개인정보를\n어떻게 수집하고 이용하는지 설명합니다.\n이 문서는 2026년 11월부터\n적용됩니다.\n\n\n\n관계형 데이터베이-\n스는 표 형태로 자료를 저장하고\u00A0\u00A0SQL로\n조회합니다.\n\nReading speed varies with the type of infor-\nmation and the reader's purpose.\n\n준비물:\n• 신분증 사본\n•\t통장 사본 1부와\n재직 증명서";
  const sync = () => {
    const pdf = val("join") === "pdf";
    form.querySelectorAll("[data-pdf]").forEach((el) => el.classList.toggle("off", !pdf));
    const oneLine = val("join") === "space" || val("join") === "remove";
    form.querySelector(".lb-blank").classList.toggle("off", oneLine);
  };
  const row = (k, a, b) => { const tr = $(`[data-st="${k}"]`); tr.children[1].textContent = fmt(a); tr.children[2].textContent = fmt(b); const d = b - a; tr.children[3].textContent = d === 0 ? "0" : (d > 0 ? "+" : "−") + fmt(Math.abs(d)); };
  const run = () => {
    sync();
    const r = TC.clean(inp.value, opts());
    out.value = r;
    const a = TC.stats(inp.value), b = TC.stats(r);
    row("all", a.all, b.all); row("noSpace", a.noSpace, b.noSpace); row("lines", a.lines, b.lines); row("invisible", a.invisible, b.invisible);
    $("[data-empty]").hidden = !!inp.value;
  };
  inp.addEventListener("input", run);
  form.addEventListener("change", run);
  box.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { setOpts(PRESET[b.dataset.preset]); run(); toast(`「${b.textContent.trim()}」 설정으로 바꿨어요`); }));
  $("[data-example]").addEventListener("click", () => { inp.value = EXAMPLE; setOpts(PRESET.pdf); run(); });
  $("[data-clear]").addEventListener("click", () => { inp.value = ""; run(); inp.focus(); });
  $("[data-swap]").addEventListener("click", () => { inp.value = out.value; run(); toast("정리한 글을 입력 칸으로 옮겼어요"); });
  $("[data-copy]").addEventListener("click", async () => {
    if (!out.value) { toast("복사할 결과가 없어요"); return; }
    toast((await copy(out.value)) ? `정리한 글 ${fmt(TC.stats(out.value).all)}자를 복사했어요` : "복사에 실패했어요. 결과 칸을 길게 눌러 복사해 주세요");
  });
  run();
})();
