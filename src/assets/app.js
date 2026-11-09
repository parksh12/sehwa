// P2-62 다크/라이트 모드(랜덤7942 app.js와 같은 규칙). 첫 적용은 <head> 인라인 스크립트가 하고, 여기서는 버튼·시스템 변경만 처리
(function () {
  const THEME_KEY = "pt_theme"; // "dark" | "light" | 없음(시스템 설정 따름)
  const root = document.documentElement;
  const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const saved = () => { try { const t = localStorage.getItem(THEME_KEY); return t === "dark" || t === "light" ? t : null; } catch (e) { return null; } };
  const currentDark = () => root.getAttribute("data-theme") === "dark";
  function applyTheme(theme) {
    root.setAttribute("data-theme", theme || (mq && mq.matches ? "dark" : "light"));
    const dark = currentDark();
    // 버튼 글자(다크/라이트)는 CSS가 data-theme으로 바꿔 보여 줌. 여기서는 스크린리더용 이름과 브라우저 상단 색만
    document.querySelectorAll("[data-theme-toggle]").forEach((b) => b.setAttribute("aria-label", dark ? "라이트 모드로 바꾸기" : "다크 모드로 바꾸기"));
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", dark ? "#121212" : "#ffffff");
  }
  function toggleTheme() {
    const next = currentDark() ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyTheme(next);
  }
  applyTheme(saved());
  document.addEventListener("click", (ev) => { if (ev.target.closest("[data-theme-toggle]")) toggleTheme(); });
  // 저장값이 없으면 OS 설정이 바뀔 때 따라감
  if (mq) { const on = () => { if (!saved()) applyTheme(null); }; mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener && mq.addListener(on); }
})();

// 공통: 공유(링크/네이티브), 결과 이미지 저장, 토스트, 페이지 데이터
(function () {
  const root = document.documentElement;
  const BASE = root.dataset.base || "";
  const SITE = root.dataset.site || "";
  window.NALGI = window.NALGI || {};
  NALGI.base = BASE;
  NALGI.site = SITE;
  NALGI.url = (p) => BASE + p;
  NALGI.data = (() => {
    const el = document.getElementById("page-data");
    try { return el ? JSON.parse(el.textContent) : {}; } catch (e) { return {}; }
  })();

  let toastEl;
  NALGI.toast = (msg) => {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("on");
    clearTimeout(toastEl._t); toastEl._t = setTimeout(() => toastEl.classList.remove("on"), 1800);
  };

  const absUrl = (p) => (p ? new URL(BASE + p, location.origin).href : location.href.split("?")[0]);

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {}
      ta.remove(); return ok;
    }
  }

  // 결과 이미지(1080x1080) 생성 — 이름·생년월일 같은 입력값은 넣지 않습니다.
  function wrap(ctx, text, maxW) {
    const out = []; let line = "";
    for (const ch of String(text)) {
      if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; } else line += ch;
    }
    if (line) out.push(line); return out;
  }
  NALGI.makeCard = async ({ title, main, sub }) => {
    try { await document.fonts.ready; } catch (e) {}
    const S = 1080, c = document.createElement("canvas"); c.width = S; c.height = S;
    const ctx = c.getContext("2d");
    // 카드 한 장 느낌: 흰 바탕 + 검은 테두리 + 청색 면 + 붉은 도장
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = "#141414"; ctx.fillRect(84, 84, S - 140, S - 140);
    ctx.fillStyle = "#2346d8"; ctx.fillRect(60, 60, S - 140, S - 140);
    ctx.lineWidth = 8; ctx.strokeStyle = "#141414"; ctx.strokeRect(60, 60, S - 140, S - 140);
    ctx.fillStyle = "#e5372b"; ctx.beginPath(); ctx.arc(S - 170, 190, 62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = `700 64px "Black Han Sans", sans-serif`; ctx.textAlign = "center"; ctx.fillText("나", S - 170, 212);
    const font = getComputedStyle(document.body).fontFamily;
    ctx.fillStyle = "#fff"; ctx.textAlign = "center";
    ctx.font = `700 44px ${font}`; ctx.globalAlpha = 0.9; ctx.fillText(title || "", S / 2, 250); ctx.globalAlpha = 1;
    ctx.font = `800 104px ${font}`;
    const mainLines = wrap(ctx, main || "", S - 160).slice(0, 2);
    mainLines.forEach((l, i) => ctx.fillText(l, S / 2, 420 + i * 120));
    ctx.font = `500 42px ${font}`;
    const subLines = wrap(ctx, sub || "", S - 200).slice(0, 4);
    const y0 = 420 + mainLines.length * 120 + 40;
    subLines.forEach((l, i) => ctx.fillText(l, S / 2, y0 + i * 60));
    ctx.font = `800 46px ${font}`; ctx.fillText(SITE, S / 2, S - 130);
    ctx.font = `500 30px ${font}`; ctx.globalAlpha = 0.85; ctx.fillText("재미로 보는 콘텐츠예요", S / 2, S - 80);
    return c;
  };

  async function saveImage(info) {
    const c = await NALGI.makeCard(info);
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    const file = new File([blob], "result.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
      try { await navigator.share({ files: [file], title: info.title }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${SITE}-결과.png`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    NALGI.toast("결과 이미지를 저장했어요");
  }

  function cardInfoFor(bar) {
    const scope = bar.closest(".result, article") || document;
    const card = scope.querySelector("[data-card-main]") || document.querySelector("[data-card-main]");
    if (card) return { title: card.dataset.cardTitle, main: card.dataset.cardMain, sub: card.dataset.cardSub };
    return { title: bar.dataset.shareTitle, main: bar.dataset.shareTitle, sub: bar.dataset.shareText };
  }

  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest(".share [data-act]");
    if (!btn) return;
    const bar = btn.closest(".share");
    const url = absUrl(bar.dataset.sharePath);
    const title = bar.dataset.shareTitle || document.title;
    const text = bar.dataset.shareText || "";
    const act = btn.dataset.act;
    if (act === "share") {
      if (navigator.share) { try { await navigator.share({ title, text, url }); } catch (e) {} }
      else { (await copy(`${title}\n${url}`)) ? NALGI.toast("링크를 복사했어요. 친구에게 붙여 넣어 보세요!") : NALGI.toast("복사에 실패했어요"); }
    } else if (act === "copy") {
      (await copy(url)) ? NALGI.toast("링크를 복사했어요") : NALGI.toast("복사에 실패했어요");
    } else if (act === "image") {
      btn.disabled = true; try { await saveImage(cardInfoFor(bar)); } finally { btn.disabled = false; }
    }
  });

  NALGI.shareBar = ({ title, text, path }) => {
    const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    return `<div class="share" data-share-title="${esc(title)}" data-share-text="${esc(text)}" data-share-path="${esc(path || "")}">
<button type="button" class="btn" data-act="share">공유하기</button>
<button type="button" class="btn ghost" data-act="copy">링크 복사</button>
<button type="button" class="btn ghost" data-act="image">결과 이미지 저장</button></div>`;
  };
  NALGI.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
})();

// 공통 계산: 띠(입춘 2월 4일 기준), 별자리
(function () {
  const TTI = ["rat", "ox", "tiger", "rabbit", "dragon", "snake", "horse", "goat", "monkey", "rooster", "dog", "pig"];
  NALGI.ttiOf = (y, m, d) => {
    let yy = y;
    if (m && (m < 2 || (m === 2 && (d || 1) < 4))) yy = y - 1;
    return TTI[(((yy - 4) % 12) + 12) % 12];
  };
  NALGI.nearIpchun = (m, d) => m === 2 && d >= 3 && d <= 5;
  // [키, 시작 월, 시작 일]
  const Z = [["capricorn", 1, 1], ["aquarius", 1, 20], ["pisces", 2, 19], ["aries", 3, 21], ["taurus", 4, 20], ["gemini", 5, 21], ["cancer", 6, 22], ["leo", 7, 23], ["virgo", 8, 23], ["libra", 9, 23], ["scorpio", 10, 23], ["sagittarius", 11, 23], ["capricorn", 12, 22]];
  NALGI.zodiacOf = (m, d) => { let k = "capricorn"; for (const [key, mm, dd] of Z) if (m > mm || (m === mm && d >= dd)) k = key; return k; };
  NALGI.validDate = (y, m, d) => { const dt = new Date(y, m - 1, d); return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d; };
})();
