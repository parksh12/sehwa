// P2-57·P2-68 이모지 · 특수문자 복사 화면. 데이터·검색·일괄 삽입은 emoji-data.js(EMOJIDATA), 상황별 탭·특수문자·텍스트 이모티콘·프리셋·의미는 emoji-more.js(늦게 받음).
// 최근 사용한 문자만 이 기기의 localStorage(pt-emoji-recent)에 저장하고, 입력한 글은 저장·전송하지 않음
// 주소: ?tab=탭id(&sub=소분류id)로 바로 열리고, 탭을 바꾸면 주소도 바뀜(공유용). 정규 주소(canonical)는 탭 없는 주소 하나
(function () {
  const box = document.querySelector('[data-tool="emoji"]');
  if (!box || !window.EMOJIDATA) return;
  const E = window.EMOJIDATA;
  let ALL = E.items();
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok; }
  };
  const toast = (m) => (window.NALGI && NALGI.toast ? NALGI.toast(m) : null);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (s) => box.querySelector(s);
  const KEY = "pt-emoji-recent", MAX = 30;
  let nameOf = new Map();
  const index = () => { nameOf = new Map(); for (const c of ALL) for (const it of c.list) if (!nameOf.has(it.c) && it.ty !== "p" && it.ty !== "gh") nameOf.set(it.c, it); };
  index();
  const loadRecent = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a.filter((x) => typeof x === "string" && x.length <= 40).slice(0, MAX) : []; } catch (e) { return []; } };
  const saveRecent = (c) => { const a = [c, ...loadRecent().filter((x) => x !== c)].slice(0, MAX); try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} };

  // ---- 늦게 받는 데이터 ----
  let moreP = null;
  const loadMore = () => moreP || (moreP = new Promise((res, rej) => {
    if (E.MORE.loaded) return res();
    const me = document.querySelector('script[src*="t-emoji.js"]');
    const s = document.createElement("script");
    s.src = me ? me.src.replace("t-emoji.js", "emoji-more.js") : "emoji-more.js";
    s.onload = () => { ALL = E.items(); index(); res(); };
    s.onerror = () => { moreP = null; rej(new Error("load")); };
    document.head.appendChild(s);
  }));

  const grid = $(".emj-grid"), info = $(".emj-info"), q = $("#emj-q"), bag = $("#emj-bag"), subs = $(".emj-subs"), mean = $(".emj-mean"), ghBar = $(".emj-ghmode");
  const OLD = { arrow: ["special", "arrow"], bracket: ["special", "bracket"] }; // P2-57 때 있던 탭 주소
  const tabInfo = (id) => E.tabs().find((t) => t.id === id);
  const valid = new Set([...box.querySelectorAll(".emj-tab")].map((t) => t.dataset.cat));
  let cur = "frequent", sub = "", shown = [];
  {
    const sp = new URLSearchParams(location.search);
    let t = sp.get("tab") || "", s = sp.get("sub") || "";
    if (OLD[t]) { [t, s] = OLD[t]; setTimeout(() => syncUrl(), 0); }
    if (valid.has(t)) { cur = t; sub = s; }
  }
  const syncUrl = () => {
    try {
      const sp = new URLSearchParams(location.search);
      sp.delete("tab"); sp.delete("sub");
      if (cur !== "frequent") sp.set("tab", cur);
      if (sub) sp.set("sub", sub);
      const qs = sp.toString();
      history.replaceState(history.state, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
    } catch (e) {}
  };

  const btn = (it, i) => {
    if (it.ty === "p") return `<div class="emj-p"><b>${esc(it.n)}</b><pre>${esc(it.c)}</pre><button type="button" class="btn emj-pc" data-i="${i}">복사</button></div>`;
    const emo = /\p{Extended_Pictographic}|⃣/u.test(it.c);
    if (it.ty === "gh") return `<button type="button" class="emj-b gh" data-i="${i}" data-c="${esc(it.code)}" title="${esc(it.n)}" aria-label="${esc(it.n)} ${esc(it.code)}"><span class="gh-e">${esc(it.c)}</span><code>${esc(it.code)}</code></button>`;
    if (it.ty === "t") return `<button type="button" class="emj-b txt" data-i="${i}" data-c="${esc(it.c)}" title="${esc(it.n)}" aria-label="${esc(it.n)}">${esc(it.c)}</button>`;
    return `<button type="button" class="emj-b${emo ? " is-emoji" : ""}" data-i="${i}" data-c="${esc(it.c)}" title="${esc(it.n)}" aria-label="${esc(it.n)} ${esc(it.c)}">${esc(it.c)}</button>`;
  };
  const head = (name) => `<p class="emj-gh">${esc(name)}</p>`;
  const renderSubs = (t) => {
    if (!t || !t.groups || t.groups.length < 2) { subs.hidden = true; subs.innerHTML = ""; return; }
    subs.hidden = false;
    subs.innerHTML = [["", "전체"], ...t.groups.map((g) => [g.id, g.name])].map(([id, n]) => `<button type="button" class="chip emj-sub" data-sub="${id}" aria-pressed="${sub === id}">${esc(n)}</button>`).join("");
  };
  let ver = 0;
  const render = async () => {
    const my = ++ver;
    const query = q.value.trim();
    const t = tabInfo(cur);
    box.querySelectorAll(".emj-tab").forEach((b) => b.setAttribute("aria-pressed", String(!query && b.dataset.cat === cur)));
    const on = box.querySelector(`.emj-tab[data-cat="${cur}"]`), row = on && on.parentElement;
    if (row && row.scrollWidth > row.clientWidth) { const x = on.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft; if (x < row.scrollLeft || x + on.offsetWidth > row.scrollLeft + row.clientWidth - 28) row.scrollLeft = x - 8; }
    ghBar.hidden = !(cur === "github" && !query);
    if ((query || !t || !t.core) && !E.MORE.loaded) {
      info.textContent = "불러오는 중…";
      try { await loadMore(); } catch (e) { if (my === ver) info.textContent = "목록을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요."; return; }
      if (my === ver) render();
      return;
    }
    let html = "", list = [], msg;
    if (query) {
      list = E.search(query, ALL);
      msg = list.length ? `「${query}」 검색 결과 ${list.length}개` : `「${query}」에 맞는 문자가 없어요. 하트, 별, 돈, 로켓, 체크처럼 짧게 찾아 보세요.`;
      if (list.length > 400) list = list.slice(0, 400);
      html = list.map(btn).join("");
      renderSubs(null);
    } else if (cur === "recent") {
      list = loadRecent().map((c) => nameOf.get(c) || { c, n: c, ty: [...c].length > 4 ? "t" : "c" });
      msg = list.length ? `최근 사용 ${list.length}개 (이 기기에만 저장)` : "아직 최근에 쓴 문자가 없어요. 문자를 누르면 여기에 모여요.";
      html = list.map(btn).join("");
      renderSubs(null);
    } else {
      const cats = ALL.filter((c) => c.tab === cur);
      const groups = t && t.groups ? cats.filter((c) => !sub || c.sub === sub) : cats;
      if (!groups.length) { sub = ""; syncUrl(); render(); return; }
      const multi = t && t.groups && t.groups.length > 1 && !sub;
      for (const g of groups) { if (multi) html += head(g.name); for (const it of g.list) { html += btn(it, list.length); list.push(it); } }
      const tip = cur === "github" ? "누르면 위에서 고른 방식으로 복사돼요" : cur === "preset" ? "「복사」를 누르고 ○○ 자리만 바꿔 쓰세요" : "누르면 바로 복사돼요";
      msg = `${sub ? groups[0].name : t ? t.name : cats[0].name} ${list.length}개 · ${tip}`;
      renderSubs(t);
    }
    shown = list;
    info.textContent = msg;
    grid.innerHTML = html;
    grid.classList.toggle("is-preset", !query && cur === "preset");
    grid.scrollTop = 0;
  };
  box.querySelector(".emj-tabs-wrap").addEventListener("click", (e) => {
    const b = e.target.closest(".emj-tab");
    if (!b) return;
    cur = b.dataset.cat; sub = ""; q.value = ""; mean.hidden = true; syncUrl(); render();
  });
  subs.addEventListener("click", (e) => { const b = e.target.closest(".emj-sub"); if (!b) return; sub = b.dataset.sub; syncUrl(); render(); });
  q.addEventListener("input", render);
  q.addEventListener("focus", () => { loadMore().catch(() => {}); }, { once: true });
  $("[data-tab-link]").addEventListener("click", async () => { syncUrl(); toast((await copy(location.href)) ? "이 탭으로 바로 열리는 주소를 복사했어요" : "복사에 실패했어요"); });

  // 의미 칸: 누른 문자의 한국어 이름과 의미·쓰임
  const showMean = (it) => {
    const m = E.meaning(it.c);
    mean.hidden = false;
    mean.dataset.c = it.c;
    mean.innerHTML = `<span class="emj-mc">${esc(it.ty === "gh" ? it.c + " " + it.code : it.c)}</span> <span>${esc(m || it.n || "")}</span>`;
    if (!E.MORE.loaded) loadMore().then(() => { if (mean.dataset.c === it.c && E.meaning(it.c)) showMean(it); }).catch(() => {});
  };

  // 문자 누르기: 「누르면」 설정에 따라 복사(+모음 칸에 담기) / 앞 기호로 / 뒤 기호로
  const front = $("#emj-front"), back = $("#emj-back");
  grid.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-i]");
    if (!b) return;
    const it = shown[Number(b.dataset.i)];
    if (!it) return;
    if (it.ty === "p") { toast((await copy(it.c)) ? `「${it.n}」 템플릿을 복사했어요` : "복사에 실패했어요"); return; }
    showMean(it);
    let c = it.c;
    if (it.ty === "gh") { const m = (box.querySelector('[name="ghmode"]:checked') || {}).value || "code"; c = m === "emoji" ? it.c : m === "both" ? `${it.c} \`${it.code}\`` : it.code; }
    const mode = (box.querySelector('[name="pick"]:checked') || {}).value || "copy";
    if (it.ty !== "gh") saveRecent(it.c);
    if (mode === "front" || mode === "back") {
      (mode === "front" ? front : back).value = c; deco();
      toast(`${c} 를 ${mode === "front" ? "앞" : "뒤"}에 붙일 기호로 골랐어요`);
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
