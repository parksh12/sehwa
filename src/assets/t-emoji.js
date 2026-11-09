// P2-57 이모지 · 특수문자 복사 화면. 데이터·일괄 삽입은 emoji-data.js(EMOJIDATA).
// 최근 사용한 문자만 이 기기의 localStorage(pt-emoji-recent)에 저장하고, 입력한 글은 저장·전송하지 않음
(function () {
  const box = document.querySelector('[data-tool="emoji"]');
  if (!box || !window.EMOJIDATA) return;
  const E = window.EMOJIDATA;
  const ALL = E.items();
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok; }
  };
  const toast = (m) => (window.NALGI && NALGI.toast ? NALGI.toast(m) : null);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (s) => box.querySelector(s);
  const KEY = "pt-emoji-recent", MAX = 30;
  const nameOf = new Map();
  for (const c of ALL) for (const it of c.list) if (!nameOf.has(it.c)) nameOf.set(it.c, it.n);
  const loadRecent = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a.filter((x) => typeof x === "string" && x.length <= 16).slice(0, MAX) : []; } catch (e) { return []; } };
  const saveRecent = (c) => { const a = [c, ...loadRecent().filter((x) => x !== c)].slice(0, MAX); try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} };

  const grid = $(".emj-grid"), info = $(".emj-info"), q = $("#emj-q"), bag = $("#emj-bag");
  let cur = "face";
  const btn = (it) => `<button type="button" class="emj-b${/\p{Extended_Pictographic}|⃣/u.test(it.c) ? " is-emoji" : ""}" data-c="${esc(it.c)}" title="${esc(it.n)}" aria-label="${esc(it.n)} ${esc(it.c)}">${esc(it.c)}</button>`;
  const render = () => {
    const query = q.value.trim();
    let list, head;
    if (query) {
      list = E.search(query, ALL);
      head = list.length ? `「${query}」 검색 결과 ${list.length}개` : `「${query}」에 맞는 문자가 없어요. 하트, 별, 화살표, 체크처럼 짧게 찾아 보세요.`;
    } else if (cur === "recent") {
      list = loadRecent().map((c) => ({ c, n: nameOf.get(c) || c }));
      head = list.length ? `최근 사용 ${list.length}개 (이 기기에만 저장)` : "아직 최근에 쓴 문자가 없어요. 문자를 누르면 여기에 모여요.";
    } else {
      const cat = ALL.find((c) => c.id === cur);
      list = cat.list; head = `${cat.name} ${list.length}개 · 누르면 바로 복사돼요`;
    }
    info.textContent = head;
    grid.innerHTML = list.map(btn).join("");
    box.querySelectorAll(".emj-tab").forEach((t) => t.setAttribute("aria-pressed", String(!query && t.dataset.cat === cur)));
  };
  box.querySelectorAll(".emj-tab").forEach((t) => t.addEventListener("click", () => { cur = t.dataset.cat; q.value = ""; render(); }));
  q.addEventListener("input", render);

  // 문자 누르기: 「누르면」 설정에 따라 복사(+모음 칸에 담기) / 앞 기호로 / 뒤 기호로
  const front = $("#emj-front"), back = $("#emj-back");
  grid.addEventListener("click", async (e) => {
    const b = e.target.closest(".emj-b");
    if (!b) return;
    const c = b.dataset.c;
    const mode = (box.querySelector('[name="pick"]:checked') || {}).value || "copy";
    saveRecent(c);
    if (mode === "front" || mode === "back") {
      (mode === "front" ? front : back).value = c; deco();
      toast(`${c} 를 ${mode === "front" ? "앞" : "뒤"}에 붙일 기호로 골랐어요`);
      if (cur === "recent" && !q.value.trim()) render();
      return;
    }
    bag.value += c;
    const ok = await copy(c);
    toast(ok ? `${c} 복사했어요 · 아래 모음 칸에도 담았어요` : "복사에 실패했어요. 모음 칸에서 복사해 주세요");
    if (cur === "recent" && !q.value.trim()) render();
  });
  $("[data-bag-copy]").addEventListener("click", async () => { if (!bag.value) { toast("모음 칸이 비어 있어요"); return; } toast((await copy(bag.value)) ? "모음 칸 문자를 모두 복사했어요" : "복사에 실패했어요"); });
  $("[data-bag-clear]").addEventListener("click", () => { bag.value = ""; });
  $("[data-recent-clear]").addEventListener("click", () => { try { localStorage.removeItem(KEY); } catch (e) {} if (cur === "recent") render(); toast("최근 사용 목록을 지웠어요"); });

  // ---- 일괄 삽입 ----
  const src = $("#emj-src"), out = $("#emj-out");
  const opts = () => ({ front: front.value.trim(), back: back.value.trim(), num: $('[name="num"]').value, start: Number($('[name="start"]').value) || 1, skipBlank: $('[name="skipBlank"]').checked, space: $('[name="space"]').checked });
  const deco = () => { out.value = E.decorate(src.value, opts()); };
  [src, front, back, $('[name="num"]'), $('[name="start"]'), $('[name="skipBlank"]'), $('[name="space"]')].forEach((el) => el.addEventListener("input", deco));
  [$('[name="skipBlank"]'), $('[name="space"]'), $('[name="num"]')].forEach((el) => el.addEventListener("change", deco));
  box.querySelectorAll("[data-front]").forEach((b) => b.addEventListener("click", () => { front.value = b.dataset.front; deco(); }));
  $("[data-deco-example]").addEventListener("click", () => { src.value = "아침 7시 기상\n물 한 잔 마시기\n\n스트레칭 10분\n출근 전 책 읽기"; $('[name="num"]').value = "keycap"; front.value = ""; deco(); });
  $("[data-deco-copy]").addEventListener("click", async () => { if (!out.value) { toast("꾸밀 글을 먼저 넣어 주세요"); return; } toast((await copy(out.value)) ? "꾸민 목록을 복사했어요" : "복사에 실패했어요"); });
  $("[data-deco-clear]").addEventListener("click", () => { src.value = ""; deco(); src.focus(); });
  render(); deco();
})();
