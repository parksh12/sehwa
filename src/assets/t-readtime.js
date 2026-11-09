// P2-57 읽기 시간 계산기 화면. 계산식은 read-calc.js(READCALC). 입력한 글은 저장·전송하지 않음
(function () {
  const box = document.querySelector('[data-tool="readtime"]');
  if (!box || !window.READCALC) return;
  const R = window.READCALC;
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok; }
  };
  const toast = (m) => (window.NALGI && NALGI.toast ? NALGI.toast(m) : null);
  const fmt = (n, d = 0) => n.toLocaleString("ko-KR", { maximumFractionDigits: d });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (s) => box.querySelector(s);
  const ta = $("#rdt-in");
  const num = (n) => { const v = Number($(`[name="${n}"]`).value); return isFinite(v) && v > 0 ? v : R.DEFAULTS[n]; };
  const opts = () => ({ koRead: num("koRead"), enRead: num("enRead"), koSpeak: num("koSpeak"), enSpeak: num("enSpeak"), longLen: num("longLen"), topN: num("topN") });
  const out = (k, v) => { const el = $(`[data-out="${k}"]`); if (el) el.textContent = v; };
  const pages = (x) => `${fmt(x, 1)}매`;
  let last = null;
  const EXAMPLE = "읽기 시간 계산기는 글을 붙여 넣으면 읽는 데 걸리는 시간과 소리 내어 말하는 데 걸리는 시간을 함께 알려 줘요. 블로그 글을 올리기 전이나 발표 원고를 준비할 때 쓰면 좋아요.\n\n발표 원고는 보통 1분에 300자 안팎으로 잡지만 사람마다 말하는 속도가 다르니, 한 번 소리 내어 읽어 보고 기준값을 내 속도에 맞게 바꿔 보세요. 원고지 매수는 200자 원고지를 기준으로 세 가지 방식으로 계산해요.\n\n문장이 너무 길면 읽는 사람이 앞 내용을 잊어버리기 쉬워서, 이 계산기는 60자가 넘는 문장을 따로 모아 보여 주고 어디서 끊으면 좋을지 생각해 볼 수 있게 도와줘요. 자주 나온 키워드도 함께 보여 주니 블로그 글의 핵심 단어가 잘 드러나는지 확인해 보세요.";
  const run = () => {
    const r = R.analyze(ta.value, opts());
    last = r;
    out("read", R.fmtTime(r.readMin)); out("speak", R.fmtTime(r.speakMin)); out("ms", pages(r.ms.withSpace));
    out("chars", fmt(r.chars)); out("noSpace", fmt(r.noSpace)); out("ko", fmt(r.ko)); out("words", fmt(r.words));
    out("sentences", fmt(r.sentences)); out("paragraphs", fmt(r.paragraphs)); out("avg", `${fmt(r.avgSentence, 1)}자`); out("longN", `${fmt(r.long.length)}개`);
    out("msA", `${pages(r.ms.withSpace)} (올림 ${fmt(Math.ceil(r.ms.withSpace - 1e-9))}매)`);
    out("msB", `${pages(r.ms.noSpace)} (올림 ${fmt(Math.ceil(r.ms.noSpace - 1e-9))}매)`);
    out("msC", `${pages(r.ms.grid)} (${fmt(r.ms.gridLines)}줄, 올림 ${fmt(Math.ceil(r.ms.grid - 1e-9))}매)`);
    $("[data-long-n]").textContent = num("longLen");
    const lw = $(".rdt-long");
    lw.innerHTML = r.long.length
      ? r.long.slice(0, 30).map((x) => `<li><b>${fmt(x.len)}자</b> <span>${esc(x.text.length > 90 ? x.text.slice(0, 90) + "…" : x.text)}</span></li>`).join("") + (r.long.length > 30 ? `<li class="hint">… 외 ${fmt(r.long.length - 30)}개</li>` : "")
      : `<li class="hint">${ta.value.trim() ? `${num("longLen")}자 이상인 문장이 없어요.` : "글을 넣으면 긴 문장을 모아 보여 줘요."}</li>`;
    const kw = $(".rdt-kw");
    kw.innerHTML = r.keywords.length
      ? r.keywords.map(([w, n], i) => `<li><i>${i + 1}</i><b>${esc(w)}</b><small>${fmt(n)}번</small></li>`).join("")
      : `<li class="hint">${ta.value.trim() ? "두 번 이상 나온 낱말이 아직 없어요." : "글을 넣으면 자주 나온 낱말을 보여 줘요."}</li>`;
  };
  ta.addEventListener("input", run);
  box.querySelectorAll(".rdt-base input, [name=longLen], [name=topN]").forEach((el) => el.addEventListener("input", run));
  $("[data-reset]").addEventListener("click", () => { for (const k of ["koRead", "enRead", "koSpeak", "enSpeak"]) $(`[name="${k}"]`).value = R.DEFAULTS[k]; run(); toast("기준값을 처음 값으로 되돌렸어요"); });
  box.querySelectorAll("[data-speed]").forEach((b) => b.addEventListener("click", () => { const [k, e] = b.dataset.speed.split(","); $('[name="koSpeak"]').value = k; $('[name="enSpeak"]').value = e; run(); toast(`발표 속도: ${b.textContent.trim()}`); }));
  $("[data-example]").addEventListener("click", () => { ta.value = EXAMPLE; run(); });
  $("[data-clear]").addEventListener("click", () => { ta.value = ""; run(); ta.focus(); });
  $("[data-copy]").addEventListener("click", async () => {
    const r = last;
    if (!r || !r.chars) { toast("먼저 글을 넣어 주세요"); return; }
    const t = `읽기 약 ${R.fmtTime(r.readMin)} / 발표 약 ${R.fmtTime(r.speakMin)} / 200자 원고지 ${fmt(r.ms.withSpace, 1)}매(공백 포함) / 글자 ${fmt(r.chars)}자(공백 제외 ${fmt(r.noSpace)}자) / 문장 ${fmt(r.sentences)}개, 평균 ${fmt(r.avgSentence, 1)}자 / 문단 ${fmt(r.paragraphs)}개`;
    toast((await copy(t)) ? "결과를 복사했어요" : "복사에 실패했어요");
  });
  run();
})();
