"use strict";
/* 무료 타로 (P2-58)
   흐름: 질문 고르기 → 스프레드(1장 「오늘의 카드」 / 3장 「과거·현재·미래」) → 카드 섞기 애니메이션 → 엎어 둔 22장 중 직접 고르기 → 뒤집기 → 해석
   - 섞기는 매번 새로(crypto.getRandomValues). 「오늘의 카드」도 날짜로 고정하지 않음(같은 날 다시 뽑으면 다른 카드가 나올 수 있음)
   - 결과 링크 = 주소 # 뒤에 질문 종류(q)와 카드 번호·방향(c)만 담음. 자유 질문 글은 넣지 않음. 아무것도 저장·전송하지 않음
   - 결과 이미지 = canvas → PNG (카드 그림은 tarot-art.js의 SVG를 그대로 그림) */
(function () {
  const root = document.getElementById("tr");
  const D = window.TAROTDATA, A = window.TAROTART;
  // 아래쪽 「22장 카드 한눈에」 그림 채우기(툴 상자가 없어도 동작)
  document.querySelectorAll("[data-tarot-art]").forEach((el) => {
    const v = el.dataset.tarotArt;
    el.innerHTML = v === "back" ? A.back() : A.card(+v);
  });
  if (!root || !D || !A) return;
  const $ = (s) => root.querySelector(s);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const QBY = Object.fromEntries(D.QUESTIONS.map((q) => [q.id, q]));
  const BACK = A.back();

  const el = {
    setup: $("#tr-setup"), free: $("#tr-free"), freeIn: $("#tr-free-in"), shuffle: $("#tr-shuffle"),
    table: $("#tr-table"), sum: $("#tr-sum"), guide: $("#tr-guide"), pile: $("#tr-pile"), deck: $("#tr-deck"), slots: $("#tr-slots"),
    flipAll: $("#tr-flipall"), result: $("#tr-result"), share: $("#tr-share"), note: $("#tr-note"), from: $("#tr-from"),
  };
  const state = { q: "d", spread: 1, freeText: "", deck: [], picks: [], flipped: new Set(), fromLink: false, busy: false };

  // ---- 난수 ----
  const rand = (n) => { const a = new Uint32Array(1); const lim = Math.floor(4294967296 / n) * n; let x; do { crypto.getRandomValues(a); x = a[0]; } while (x >= lim); return x % n; };
  function newDeck() {
    const d = Array.from({ length: 22 }, (_, n) => ({ n, r: rand(2) === 1 }));
    for (let i = d.length - 1; i > 0; i--) { const j = rand(i + 1); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }

  // ---- 주소(#) ↔ 결과 ----
  const chosen = () => state.picks.map((i) => state.deck[i]);
  const hashOf = () => `#q=${state.q}&c=${chosen().map((c) => c.n + (c.r ? "r" : "")).join("-")}`;
  function readHash() {
    const q = {};
    location.hash.slice(1).split("&").forEach((kv) => { const i = kv.indexOf("="); if (i > 0) q[kv.slice(0, i)] = kv.slice(i + 1); });
    if (!q.c) return null;
    const parts = q.c.split("-");
    if (parts.length !== 1 && parts.length !== 3) return null;
    const cards = [];
    for (const p of parts) {
      const m = /^(\d{1,2})(r?)$/.exec(p);
      if (!m || +m[1] > 21 || cards.some((c) => c.n === +m[1])) return null;
      cards.push({ n: +m[1], r: m[2] === "r" });
    }
    return { q: QBY[q.q] ? q.q : "d", cards };
  }
  const writeHash = () => { try { history.replaceState(null, "", hashOf()); } catch (e) {} };
  const clearHash = () => { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} };

  // ---- 화면 조각 ----
  const posOf = () => D.SPREADS[state.spread].pos;
  const front = (c) => `<span class="tr-face tr-front${c.r ? " rev" : ""}">${A.card(c.n)}</span>`;
  function renderSlots(open) {
    const pos = posOf();
    el.slots.className = `tr-slots n${pos.length}`;
    el.slots.innerHTML = pos.map((p, k) => {
      const c = state.picks[k] != null ? state.deck[state.picks[k]] : null;
      const lab = `<span class="tr-pos"><b>${esc(p.name)}</b><small>${esc(p.note)}</small></span>`;
      if (!c) return `<div class="tr-slot empty">${lab}<span class="tr-card ph" aria-hidden="true"></span></div>`;
      const on = open || state.flipped.has(k);
      return `<div class="tr-slot">${lab}<button type="button" class="tr-card${on ? " flipped" : ""}" data-slot="${k}" aria-label="${esc(p.name)} 카드${on ? `: ${esc(D.CARDS[c.n].name)} ${c.r ? "역방향" : "정방향"}` : " 뒤집기"}"${on ? ' aria-disabled="true"' : ""}><span class="tr-card-in"><span class="tr-face tr-backface">${BACK}</span>${front(c)}</span></button>${on ? `<span class="tr-cap">${esc(D.CARDS[c.n].name)} · ${c.r ? "역방향" : "정방향"}</span>` : ""}</div>`;
    }).join("");
  }
  function renderDeck() {
    el.deck.innerHTML = state.deck.map((_, i) => `<button type="button" class="tr-pick" data-i="${i}" style="--d:${i * 28}ms;--rot:${((i * 37) % 9) - 4}deg" aria-label="엎어 둔 카드 ${i + 1}번째">${BACK}</button>`).join("");
  }
  const qLine = () => {
    const q = QBY[state.q];
    if (q.id === "f") return state.freeText ? `자유 질문 · 「${state.freeText}」` : "자유 질문";
    return q.label;
  };
  const sumLine = () => `${esc(qLine())} · ${state.spread}장 「${esc(D.SPREADS[state.spread].name)}」`;
  function setGuide() {
    const need = state.spread - state.picks.length;
    if (need > 0) el.guide.textContent = state.picks.length ? `좋아요. ${need}장 더 골라 주세요.` : `마음을 가라앉히고, 끌리는 카드 ${state.spread}장을 골라 주세요.`;
    else if (state.flipped.size < state.spread) el.guide.textContent = state.spread > 1 ? "카드를 눌러 한 장씩 뒤집어 보세요. 왼쪽(과거)부터 뒤집는 걸 권해요." : "카드를 눌러 뒤집어 보세요.";
    else el.guide.textContent = "카드를 모두 뒤집었어요. 아래에서 해석을 읽어 보세요.";
  }

  // ---- 해석 ----
  function resultHtml() {
    const q = QBY[state.q], cards = chosen(), pos = posOf();
    const items = cards.map((c, k) => {
      const C = D.CARDS[c.n], R = c.r ? C.rev : C.up;
      return `<section class="tr-read">
  <div class="tr-read-art${c.r ? " rev" : ""}">${A.card(c.n)}</div>
  <div class="tr-read-body">
    <p class="tr-read-pos">${esc(pos[k].name)}</p>
    <h3>${D.ROMAN[c.n]}. ${esc(C.name)} <small>${c.r ? "역방향" : "정방향"} · ${esc(C.en)}</small></h3>
    <p class="tr-kw">${R.k.map((x) => `<span>${esc(x)}</span>`).join("")}</p>
    <p>${esc(R.t)}</p>
    ${q.key ? `<p class="tr-qline"><b>${esc(q.name)}</b> ${esc(R[q.key])}</p>` : ""}
  </div>
</section>`;
    }).join("");
    const rc = cards.filter((c) => c.r).length;
    const tone = cards.length === 3 ? `<p class="tr-tone">${esc(D.TONE3[rc])}</p>` : "";
    const freeNote = q.id === "f" ? `<p class="hint">자유 질문은 카드의 기본 해석을 내 질문에 비춰 읽어 보세요. 키워드 세 개 중 마음에 걸리는 낱말이 가장 큰 힌트예요.</p>` : "";
    return `<h2 class="tr-res-h">${esc(qLine())}</h2>${tone}${freeNote}${items}<p class="fun-badge">타로 해석은 재미로 보는 콘텐츠예요. 중요한 결정은 사실과 전문가의 조언을 바탕으로 내려 주세요.</p>`;
  }
  function showResult(scroll) {
    el.result.innerHTML = resultHtml();
    el.result.hidden = false; el.share.hidden = false;
    if (!state.fromLink) writeHash();
    if (scroll) el.result.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  // ---- 진행 ----
  function readSetup() {
    const qv = root.querySelector('input[name="tr-q"]:checked'), sv = root.querySelector('input[name="tr-s"]:checked');
    state.q = qv ? qv.value : "d";
    state.spread = sv && sv.value === "3" ? 3 : 1;
    state.freeText = state.q === "f" ? el.freeIn.value.trim().slice(0, 40) : "";
  }
  function startShuffle() {
    if (state.busy) return;
    readSetup();
    state.fromLink = false; el.from.hidden = true;
    state.deck = newDeck(); state.picks = []; state.flipped = new Set();
    el.result.hidden = true; el.share.hidden = true; el.note.textContent = "";
    clearHash();
    el.setup.hidden = true; el.table.hidden = false;
    el.sum.innerHTML = sumLine();
    renderSlots(false); el.flipAll.hidden = true;
    el.deck.innerHTML = ""; el.deck.hidden = true;
    el.guide.textContent = "카드를 섞고 있어요…";
    el.pile.hidden = false;
    el.pile.innerHTML = Array.from({ length: 7 }, (_, i) => `<span class="tr-pile-c" style="--i:${i}">${BACK}</span>`).join("");
    state.busy = true;
    el.table.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    setTimeout(() => {
      el.pile.hidden = true; el.pile.innerHTML = "";
      renderDeck(); el.deck.hidden = false; el.deck.classList.add("deal");
      state.busy = false; setGuide();
      setTimeout(() => el.deck.classList.remove("deal"), 1100);
    }, reduce ? 50 : 1500);
  }
  function pick(i) {
    if (state.busy || state.picks.length >= state.spread || state.picks.includes(i)) return;
    state.picks.push(i);
    const b = el.deck.querySelector(`[data-i="${i}"]`);
    if (b) { b.classList.add("taken"); b.disabled = true; }
    renderSlots(false);
    const last = el.slots.querySelector(`[data-slot="${state.picks.length - 1}"]`);
    if (last) last.classList.add("arrive");
    if (state.picks.length === state.spread) {
      el.deck.querySelectorAll(".tr-pick:not(.taken)").forEach((x) => { x.disabled = true; });
      el.deck.classList.add("done");
      el.flipAll.hidden = state.spread === 1;
      const f = el.slots.querySelector("[data-slot]"); if (f) f.focus({ preventScroll: true });
    }
    setGuide();
  }
  function flip(k) {
    if (state.picks.length < state.spread || state.flipped.has(k)) return;
    state.flipped.add(k);
    const b = el.slots.querySelector(`[data-slot="${k}"]`);
    if (b) {
      const c = state.deck[state.picks[k]], p = posOf()[k];
      b.classList.add("flipped"); b.setAttribute("aria-disabled", "true");
      b.setAttribute("aria-label", `${p.name} 카드: ${D.CARDS[c.n].name} ${c.r ? "역방향" : "정방향"}`);
      b.insertAdjacentHTML("afterend", `<span class="tr-cap">${esc(D.CARDS[c.n].name)} · ${c.r ? "역방향" : "정방향"}</span>`);
    }
    setGuide();
    if (state.flipped.size === state.spread) { el.flipAll.hidden = true; el.deck.hidden = true; setTimeout(() => showResult(true), reduce ? 0 : 650); }
  }
  function restart() {
    state.fromLink = false; el.from.hidden = true;
    state.deck = []; state.picks = []; state.flipped = new Set();
    el.table.hidden = true; el.result.hidden = true; el.share.hidden = true; el.note.textContent = "";
    el.setup.hidden = false; clearHash();
    el.setup.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
  function openFromLink(h) {
    state.fromLink = true; state.q = h.q; state.spread = h.cards.length; state.freeText = "";
    state.deck = h.cards.slice(); state.picks = h.cards.map((_, i) => i); state.flipped = new Set(state.picks);
    const qr = root.querySelector(`input[name="tr-q"][value="${h.q}"]`); if (qr) qr.checked = true;
    const sr = root.querySelector(`input[name="tr-s"][value="${state.spread}"]`); if (sr) sr.checked = true;
    syncFree();
    el.setup.hidden = true; el.table.hidden = false; el.pile.hidden = true; el.deck.hidden = true; el.flipAll.hidden = true;
    el.sum.innerHTML = sumLine();
    renderSlots(true); setGuide();
    el.from.hidden = false;
    showResult(false);
  }

  // ---- 결과 링크 ----
  async function copyLink() {
    if (!state.fromLink) writeHash();
    const url = location.href;
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch (e) {
      const t = document.createElement("textarea"); t.value = url; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select(); try { ok = document.execCommand("copy"); } catch (e2) {} t.remove();
    }
    el.note.textContent = ok ? "결과 링크를 복사했어요. 링크에는 카드 번호·방향과 질문 종류만 담겨요(자유 질문 글은 빠져요)." : "복사하지 못했어요. 주소창의 주소를 그대로 복사해 보내 주세요.";
  }

  // ---- 결과 이미지 (canvas → PNG) ----
  const loadImg = (svg) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
  function wrapText(g, text, maxW) {
    const out = []; let line = "";
    for (const w of String(text).split(/\s+/)) {
      const t = line ? line + " " + w : w;
      if (g.measureText(t).width <= maxW) { line = t; continue; }
      if (line) out.push(line);
      if (g.measureText(w).width <= maxW) { line = w; continue; }
      line = "";
      for (const ch of w) { if (g.measureText(line + ch).width > maxW) { out.push(line); line = ch; } else line += ch; }
    }
    if (line) out.push(line);
    return out;
  }
  async function saveImage() {
    if (state.picks.length < state.spread || state.flipped.size < state.spread) { el.note.textContent = "카드를 모두 뒤집은 뒤에 저장해 주세요."; return; }
    try { await document.fonts.ready; } catch (e) {}
    const cards = chosen(), q = QBY[state.q], pos = posOf();
    const W = 1080, P = 64, F = '"Pretendard Variable", system-ui, sans-serif';
    const n = cards.length, cw = n === 1 ? 330 : 280, ch = Math.round(cw * 5 / 3), gap = 44;
    let imgs;
    try { imgs = await Promise.all(cards.map((c) => loadImg(A.card(c.n, { w: cw * 2 })))); } catch (e) { el.note.textContent = "이미지를 만들지 못했어요."; return; }
    const g0 = document.createElement("canvas").getContext("2d");
    // 글 배치(높이 계산과 그리기에 같이 씀)
    const blocks = [];
    cards.forEach((c, k) => {
      const C = D.CARDS[c.n], R = c.r ? C.rev : C.up;
      blocks.push({ f: `800 34px ${F}`, c: "#141414", lines: [`${pos[k].name} · ${C.name} (${c.r ? "역방향" : "정방향"})`], lh: 48, gap: 6 });
      blocks.push({ f: `800 26px ${F}`, c: "#e5372b", lines: [R.k.join(" · ")], lh: 40, gap: 4 });
      g0.font = `500 28px ${F}`;
      const txt = q.key ? `${R.t} ${R[q.key]}` : R.t;
      blocks.push({ f: `500 28px ${F}`, c: "#3d3d3d", lines: wrapText(g0, txt, W - P * 2), lh: 42, gap: 30 });
    });
    if (n === 3) { g0.font = `700 28px ${F}`; blocks.unshift({ f: `700 28px ${F}`, c: "#141414", lines: wrapText(g0, D.TONE3[cards.filter((c) => c.r).length], W - P * 2), lh: 42, gap: 30 }); }
    const textH = blocks.reduce((h, b) => h + b.lines.length * b.lh + b.gap, 0);
    const top = 210, H = top + ch + 90 + textH + 130;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#141414"; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8);
    g.textBaseline = "alphabetic"; g.textAlign = "left"; g.fillStyle = "#141414";
    g.font = `800 54px ${F}`; g.fillText(`무료 타로 · ${D.SPREADS[state.spread].name}`, P, 104);
    g.font = `700 28px ${F}`; g.fillStyle = "#3d3d3d";
    const dt = new Date(), p2 = (x) => String(x).padStart(2, "0");
    const ql = wrapText(g, `${qLine()} · ${dt.getFullYear()}.${p2(dt.getMonth() + 1)}.${p2(dt.getDate())}`, W - P * 2)[0];
    g.fillText(ql, P, 152);
    const rowW = n * cw + (n - 1) * gap, x0 = (W - rowW) / 2;
    cards.forEach((c, k) => {
      const x = x0 + k * (cw + gap);
      g.fillStyle = "#141414"; g.fillRect(x + 8, top + 8, cw, ch); // 그림자
      if (c.r) { g.save(); g.translate(x + cw, top + ch); g.rotate(Math.PI); g.drawImage(imgs[k], 0, 0, cw, ch); g.restore(); }
      else g.drawImage(imgs[k], x, top, cw, ch);
      g.textAlign = "center"; g.fillStyle = "#141414"; g.font = `800 30px ${F}`;
      g.fillText(pos[k].name, x + cw / 2, top + ch + 50);
      g.font = `700 24px ${F}`; g.fillStyle = c.r ? "#e5372b" : "#1e9e5a";
      g.fillText(c.r ? "역방향" : "정방향", x + cw / 2, top + ch + 82);
    });
    let y = top + ch + 140;
    g.textAlign = "left";
    blocks.forEach((b) => { g.font = b.f; g.fillStyle = b.c; b.lines.forEach((l) => { g.fillText(l, P, y); y += b.lh; }); y += b.gap; });
    g.fillStyle = "#767676"; g.font = `700 24px ${F}`;
    g.fillText(`${document.documentElement.dataset.site || document.querySelector(".logo")?.textContent.trim() || ""} · 재미로 보는 콘텐츠예요`, P, H - 56);
    const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
    if (!blob) { el.note.textContent = "이미지를 만들지 못했어요."; return; }
    const name = `타로-${cards.map((c) => c.n + (c.r ? "r" : "")).join("-")}.png`;
    const file = typeof File === "function" ? new File([blob], name, { type: "image/png" }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] }) && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
      try { await navigator.share({ files: [file], title: "무료 타로 결과" }); el.note.textContent = "결과 이미지를 공유했어요."; return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    el.note.textContent = "결과 이미지를 저장했어요.";
  }

  // ---- 이벤트 ----
  const syncFree = () => { const v = root.querySelector('input[name="tr-q"]:checked'); el.free.hidden = !(v && v.value === "f"); };
  root.addEventListener("change", (e) => { if (e.target.name === "tr-q") syncFree(); });
  root.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !root.contains(t)) return;
    if (t === el.shuffle) startShuffle();
    else if (t.classList.contains("tr-pick")) pick(+t.dataset.i);
    else if (t.dataset.slot != null) flip(+t.dataset.slot);
    else if (t === el.flipAll) { for (let k = 0; k < state.spread; k++) flip(k); }
    else if (t.dataset.tr === "link") copyLink();
    else if (t.dataset.tr === "image") { t.disabled = true; saveImage().finally(() => { t.disabled = false; }); }
    else if (t.dataset.tr === "again") startShuffle();
    else if (t.dataset.tr === "restart") restart();
  });
  el.freeIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); startShuffle(); } });

  // ---- 시작 ----
  syncFree();
  const h = readHash();
  if (h) openFromLink(h);
  window.addEventListener("hashchange", () => { const x = readHash(); if (x && x.cards.map((c) => c.n + (c.r ? "r" : "")).join("-") !== chosen().map((c) => c.n + (c.r ? "r" : "")).join("-")) openFromLink(x); });
})();
