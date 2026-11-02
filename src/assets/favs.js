// 즐겨찾기 (P2-25) — 모든 페이지 공통. 저장은 이 기기의 localStorage(`nalgi-favs`, 툴 id 목록, 최대 12개)에만, 서버 전송 없음.
// 별 버튼: [data-fav="툴 id"] (제목 옆·홈 서랍 행·오락실 타일). 목록: 상단 메뉴 별(개수 배지) 팝오버, 홈 검색창 아래 「내 즐겨찾기」 줄.
(function () {
  const KEY = "nalgi-favs", MAX = 12;
  const IDX = window.FAV_INDEX || {}; // fav-index.js(빌드 때 생성): { id: { t: 이름, p: 주소, c: 분류 } }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = (m) => (window.NALGI && NALGI.toast ? NALGI.toast(m) : null);
  const STAR = '<svg class="fav-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.2l-5.8 3.2 1.2-6.5L2.6 9.4l6.5-.8z"/></svg>';

  const read = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a.filter((id) => typeof id === "string" && IDX[id]).slice(0, MAX) : []; } catch (e) { return []; } };
  const write = (a) => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { toast("이 브라우저에서는 즐겨찾기를 저장할 수 없어요"); } };
  let favs = read();

  function toggle(id) {
    if (!IDX[id]) return;
    const i = favs.indexOf(id);
    if (i >= 0) { favs.splice(i, 1); toast(`「${IDX[id].t}」을(를) 즐겨찾기에서 뺐어요`); }
    else if (favs.length >= MAX) { toast(`즐겨찾기는 ${MAX}개까지예요. 하나를 빼고 다시 눌러 주세요`); return; }
    else { favs.push(id); toast(`「${IDX[id].t}」을(를) 즐겨찾기에 담았어요`); }
    write(favs); sync();
  }

  // 별 버튼이 없는 콘텐츠 페이지(따로 만든 페이지 등)는 제목 옆에 하나 붙여 줌
  (function addTitleStar() {
    const here = location.pathname.replace(/index\.html$/, "");
    const id = Object.keys(IDX).find((k) => IDX[k].p === here);
    if (!id || document.querySelector(`.page-head [data-fav], h1 [data-fav]`)) return;
    const h1 = document.querySelector(".page-head h1") || document.querySelector("main h1");
    if (h1) h1.insertAdjacentHTML("beforeend", ` <button type="button" class="fav fav-title" data-fav="${esc(id)}" aria-pressed="false">${STAR}</button>`);
  })();

  // 상단 메뉴 별 + 팝오버
  const menuBtn = document.querySelector("[data-fav-menu]");
  const badge = menuBtn && menuBtn.querySelector(".fav-count");
  let pop = null;
  function listHtml() {
    if (!favs.length) return `<p class="fav-empty">☆를 눌러 자주 쓰는 툴을 모아 두세요.</p>`;
    return `<ol class="fav-list">${favs.map((id) => `<li><a href="${esc(IDX[id].p)}"${IDX[id].x ? ' target="_blank" rel="noopener"' : ""}><b>${esc(IDX[id].t)}</b><small>${esc(IDX[id].c)}</small></a><button type="button" class="fav-x" data-fav="${esc(id)}" aria-label="${esc(IDX[id].t)} 즐겨찾기에서 빼기">빼기</button></li>`).join("")}</ol>`;
  }
  function renderPop() { if (pop) pop.querySelector(".fav-pop-body").innerHTML = listHtml(); }
  function openPop() {
    if (!pop) {
      pop = document.createElement("div");
      pop.className = "fav-pop"; pop.id = "fav-pop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "내 즐겨찾기");
      pop.innerHTML = `<div class="fav-pop-head"><b>내 즐겨찾기</b><small>이 기기에만 저장 · 최대 ${MAX}개</small></div><div class="fav-pop-body"></div>`;
      document.body.appendChild(pop);
    }
    renderPop();
    const r = menuBtn.getBoundingClientRect();
    pop.style.top = `${Math.round(r.bottom + 8)}px`;
    pop.hidden = false; menuBtn.setAttribute("aria-expanded", "true");
  }
  function closePop() { if (pop) pop.hidden = true; if (menuBtn) menuBtn.setAttribute("aria-expanded", "false"); }
  if (menuBtn) {
    menuBtn.addEventListener("click", (e) => { e.stopPropagation(); pop && !pop.hidden ? closePop() : openPop(); });
    document.addEventListener("click", (e) => { if (pop && !pop.hidden && !pop.contains(e.target) && !menuBtn.contains(e.target)) closePop(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pop && !pop.hidden) { closePop(); menuBtn.focus(); } });
    addEventListener("resize", () => { if (pop && !pop.hidden) openPop(); });
  }

  // 홈 검색창 아래 「내 즐겨찾기」 줄 (자리는 HTML에서 미리 잡아 둠 → 레이아웃 밀림 없음)
  const bar = document.getElementById("fav-bar");
  function renderBar() {
    if (!bar) return;
    const box = bar.querySelector(".fav-bar-list");
    box.innerHTML = favs.length
      ? favs.map((id) => `<a class="fav-chip" href="${esc(IDX[id].p)}"${IDX[id].x ? ' target="_blank" rel="noopener"' : ""}>${STAR}<span>${esc(IDX[id].t)}</span></a>`).join("")
      : `<span class="fav-empty">☆를 눌러 자주 쓰는 툴을 모아 두세요</span>`;
    bar.dataset.count = favs.length;
  }

  function sync() {
    document.querySelectorAll("[data-fav]").forEach((b) => {
      if (b.classList.contains("fav-x")) return;
      const id = b.dataset.fav, on = favs.includes(id), name = (IDX[id] || {}).t || "";
      b.setAttribute("aria-pressed", String(on));
      b.setAttribute("aria-label", on ? `${name} 즐겨찾기에서 빼기` : `${name} 즐겨찾기에 추가`);
      b.title = on ? "즐겨찾기에서 빼기" : "즐겨찾기에 추가";
    });
    if (badge) { badge.textContent = favs.length; badge.hidden = !favs.length; }
    if (menuBtn) menuBtn.setAttribute("aria-label", `내 즐겨찾기 ${favs.length}개`);
    renderBar(); renderPop();
  }

  // 별 누르기(행·타일 안의 링크로 이동하지 않게 막음)
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fav]");
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    toggle(b.dataset.fav);
  }, true);
  // 다른 탭에서 바꾸면 따라 바뀜
  addEventListener("storage", (e) => { if (e.key === KEY) { favs = read(); sync(); } });
  sync();
})();
