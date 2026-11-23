// P2-77 펭귄 툴즈(옛 주소)에서 펭귄 오락실로 넘어올 때 이동 쪽이 주소 # 뒤에 실어 준 이 기기의 게임 기록을 받음.
// 다른 주소(origin)라 저장소가 따로라서. 이 기기 오락실 쪽에 아직 없는 값만 넣고(덮어쓰지 않음), 주소에서 # 뒤를 지움. 서버로는 아무것도 보내지 않음
(function () {
  const h = location.hash;
  if (h.indexOf("#pt-mig=") !== 0) return;
  const ok = /^(penguin-rpg-|hell31-|hellchosun-|nalgi-|examcat-|sehwa-mines|pt_theme$)/; // build.mjs MIG_RE와 같은 목록
  try {
    const o = JSON.parse(decodeURIComponent(h.slice(8)));
    for (const k of Object.keys(o)) if (ok.test(k) && typeof o[k] === "string" && localStorage.getItem(k) === null) localStorage.setItem(k, o[k]);
  } catch (e) {}
  try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
})();
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

  // P2-72 파일 이름: 저장 창이 있으면 창에서, 없으면(휴대폰·사파리·파이어폭스) 단추 아래 이름 칸에서 정함. 기본 이름은 사이트-결과 제목
  async function saveImage(info, btn) {
    const name = await NALGI.askName(btn, `${SITE}-${info.title || "결과"}`, "png");
    if (!name) return;
    const make = async () => { const c = await NALGI.makeCard(info); return new Promise((r) => c.toBlob(r, "image/png")); };
    if (!NALGI.canPick() && /Mobi|Android|iPhone/i.test(navigator.userAgent) && navigator.canShare && typeof File === "function") {
      const blob = await make();
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: info.title }); return; } catch (e) { if (e && e.name === "AbortError") return; }
      }
      NALGI.saveByLink(blob, name); NALGI.toast("결과 이미지를 저장했어요"); return;
    }
    if ((await NALGI.saveFile(make, name)) !== "cancel") NALGI.toast("결과 이미지를 저장했어요");
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
    } else if (act === "text") {
      // P2-69 C12: 결과 글(제목·결과·한 줄 풀이 + 주소) 복사. 이름·생년월일 같은 입력값은 카드 정보에 없으므로 들어가지 않음
      const i = cardInfoFor(bar);
      const lines = [...new Set([i.title, i.main, i.sub].map((x) => String(x || "").trim()).filter(Boolean))];
      (await copy(lines.join("\n") + "\n" + url)) ? NALGI.toast("결과를 복사했어요. 메신저에 붙여 넣어 보세요") : NALGI.toast("복사에 실패했어요");
    } else if (act === "image") {
      btn.disabled = true; try { await saveImage(cardInfoFor(bar), btn); } finally { btn.disabled = false; }
    }
  });

  NALGI.shareBar = ({ title, text, path }) => {
    const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    return `<div class="share" data-share-title="${esc(title)}" data-share-text="${esc(text)}" data-share-path="${esc(path || "")}">
<button type="button" class="btn" data-act="share">공유하기</button>
<button type="button" class="btn ghost" data-act="text">결과 복사</button>
<button type="button" class="btn ghost" data-act="copy">링크 복사</button>
<button type="button" class="btn ghost" data-act="image">결과 이미지 저장</button></div>`;
  };
  NALGI.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
})();

// P2-72 내려받기 파일 이름 직접 정하기 (모든 페이지 공통)
// (1) 이름 칸: 확장자는 칸 밖에 고정, 금지 문자·앞뒤 공백·점 정리, 비우면 기본 이름, 길이 상한
// (2) 저장 창: showSaveFilePicker가 있는 곳(크롬·엣지 데스크톱, https 최상위 창)에서만 「다른 이름으로 저장」 창을 연다.
//     사용자가 취소하면 아무것도 하지 않고, 그 밖의 오류·미지원 환경은 기존 방식(a[download])으로 받는다.
// 파일은 여전히 이 브라우저 안에서만 다룬다(서버로 보내지 않음).
(function () {
  const N = (window.NALGI = window.NALGI || {});
  const BAD = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
  const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
  const MAX_CH = 80, MAX_BYTES = 200; // 한글 80자 = 240바이트라서 바이트 상한도 둠(파일 이름 한계 255바이트, 확장자 자리 남김)
  const trimEdge = (s) => s.replace(/^[\s.]+|[\s.]+$/g, "");
  const u8 = (cp) => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4);
  // 확장자 없이 정리한 이름. 쓸 수 있는 글자가 없으면 ""
  N.cleanName = (raw, ext) => {
    let s = String(raw == null ? "" : raw);
    if (s.normalize) s = s.normalize("NFC");
    s = s.replace(BAD, "_").replace(/\s+/g, " ");
    s = trimEdge(s);
    const e = String(ext || "").replace(/[^a-z0-9]/gi, "");
    if (e) s = trimEdge(s.replace(new RegExp("\\." + e + "$", "i"), "")); // 확장자를 칸에 직접 써도 한 번만 붙게
    s = s.replace(/_{2,}/g, "_");
    let out = "", n = 0, b = 0;
    for (const ch of s) { const k = u8(ch.codePointAt(0)); if (n + 1 > MAX_CH || b + k > MAX_BYTES) break; out += ch; n++; b += k; }
    s = trimEdge(out);
    if (/^[_\s]*$/.test(s)) return "";
    if (RESERVED.test(s)) s += "_";
    return s;
  };
  // 칸 값 → 실제 파일 이름(확장자 포함). 비었거나 쓸 수 없으면 기본 이름
  N.fileName = (raw, fallback, ext) => {
    const e = String(ext || "").replace(/^\./, "").toLowerCase();
    const s = N.cleanName(raw, e) || N.cleanName(fallback, e) || "file";
    return e ? `${s}.${e}` : s;
  };
  N.extOf = (name) => (String(name || "").match(/\.([a-z0-9]+)$/i) || [, ""])[1].toLowerCase();

  // 저장 창을 쓸 수 있는가: 함수가 있고, 안전한 연결(https·localhost)이고, iframe 안이 아님
  N.canPick = () => {
    try { return typeof window.showSaveFilePicker === "function" && window.isSecureContext === true && window.self === window.top; }
    catch (e) { return false; }
  };
  const MIME = { pdf: "application/pdf", zip: "application/zip", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };
  const DESC = { pdf: "PDF 문서", zip: "ZIP 압축 파일", png: "PNG 이미지", jpg: "JPG 이미지", jpeg: "JPG 이미지", webp: "WEBP 이미지", svg: "SVG 이미지" };
  N.pickerOptions = (name) => {
    const ext = N.extOf(name), o = { suggestedName: name };
    if (MIME[ext]) o.types = [{ description: DESC[ext], accept: { [MIME[ext]]: ["." + ext] } }];
    return o;
  };
  // 기존 방식: 임시 링크를 눌러 내려받기
  N.saveByLink = (blob, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  };
  // src: Blob 또는 Blob을 돌려주는 함수(저장 창을 먼저 열고 그 뒤에 만들도록). 결과: "picker" | "link" | "cancel"
  // 저장 창은 사용자의 클릭 직후에만 열리므로, 클릭 처리에서 await 없이 바로 부를 것
  N.saveFile = async (src, name) => {
    const get = typeof src === "function" ? src : () => src;
    let made = null;
    const make = async () => {
      if (made) return made;
      const b = await get();
      if (!b) throw new Error("파일을 만들지 못했어요.");
      return (made = b);
    };
    if (N.canPick()) {
      let handle = null;
      try {
        handle = await window.showSaveFilePicker(N.pickerOptions(name));
      } catch (e) {
        if (e && e.name === "AbortError") return "cancel"; // 사용자가 창을 닫음: 아무것도 하지 않음
        handle = null; // SecurityError(클릭 뒤 너무 늦음)·TypeError 등 → 기존 방식
      }
      if (handle) {
        const blob = await make(); // 만들다 실패하면 오류를 그대로 부른 쪽에 넘김
        try {
          const w = await handle.createWritable();
          await w.write(blob); await w.close();
          return "picker";
        } catch (e) { /* 쓰기 실패 → 기존 방식 */ }
      }
    }
    N.saveByLink(await make(), name);
    return "link";
  };

  // 이름 칸 HTML. def: 기본 이름, ext: "pdf" 또는 ["png","svg"]
  let seq = 0;
  N.nameFieldHtml = ({ def, ext, id, label = "파일 이름" }) => {
    const esc = N.esc || ((s) => String(s));
    const exts = [].concat(ext || []);
    const i = id || `fname-${++seq}`;
    const d = N.cleanName(def, exts[0]) || "file";
    return `<div class="fname"><label for="${i}">${esc(label)}</label><span class="fname-row"><input id="${i}" class="fname-in" type="text" value="${esc(d)}" data-def="${esc(d)}" maxlength="${MAX_CH}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" aria-describedby="${i}-x"><span class="fname-ext" id="${i}-x">${esc(exts.map((x) => "." + x).join(" / "))}</span></span></div>`;
  };
  N.nameFieldId = (html) => (String(html).match(/ id="([^"]+)" class="fname-in"/) || [])[1];
  // 기본 이름 바꾸기(사용자가 칸을 고치지 않았을 때만 칸 값도 바꿈)
  N.setNameDefault = (input, def, ext) => {
    if (!input) return;
    const d = N.cleanName(def, ext) || "file";
    input.dataset.def = d;
    if (!input.dataset.touched) input.value = d;
  };
  N.setNameExt = (input, ext) => {
    const x = input && document.getElementById(input.id + "-x");
    if (x) x.textContent = "." + ext;
  };
  N.nameFrom = (input, ext, fallback) => N.fileName(input ? input.value : "", fallback || (input && input.dataset.def), ext);
  const isField = (t) => t && t.classList && t.classList.contains("fname-in");
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (isField(t)) { if (t.value.trim()) t.dataset.touched = "1"; else delete t.dataset.touched; }
  });
  // 칸에서 Enter = 같은 칸에 묶인 첫 내려받기 단추 누르기
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (e.key !== "Enter" || e.isComposing || !isField(t) || t.closest(".fname-pop")) return;
    const b = document.querySelector(`[data-dl-for="${t.id}"]`);
    if (b) { e.preventDefault(); b.click(); }
  });
  // 칸을 떠날 때 정리한 값으로 보여 주기. 비우면 기본 이름으로 되돌림
  document.addEventListener("focusout", (e) => {
    const t = e.target;
    if (!isField(t)) return;
    const c = N.cleanName(t.value);
    if (!c) { t.value = t.dataset.def || ""; delete t.dataset.touched; }
    else if (c !== t.value) t.value = c;
  });

  // 내려받기 링크 <a download data-dl ...>: 누르는 순간 칸 값으로 이름을 정하고, 저장 창이 되면 창을 연다.
  //   data-dl-for="칸 id"(없으면 download 속성 이름 그대로), Blob은 N.dlBlobs(주소→Blob) 또는 N.bindBlob(링크, Blob)
  N.dlBlobs = new Map();
  const elBlobs = new WeakMap();
  N.bindBlob = (a, blob) => { if (a && blob) elBlobs.set(a, blob); };
  N.dlStatus = (el, r, name) => {
    if (r === "cancel" || !el) return;
    const scope = el.closest(".tk-dl, .fname-scope");
    const st = scope && scope.querySelector(".fname-status");
    if (st) st.textContent = r === "picker" ? `「${name}」(으)로 저장했어요.` : `「${name}」(으)로 내려받았어요.`;
  };
  document.addEventListener("click", (e) => {
    const a = e.target && e.target.closest && e.target.closest("a[data-dl]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const inp = a.dataset.dlFor ? document.getElementById(a.dataset.dlFor) : null;
    const cur = a.getAttribute("download") || "";
    const ext = a.dataset.dlExt || N.extOf(cur);
    const name = inp ? N.nameFrom(inp, ext) : cur;
    a.setAttribute("download", name); // 기본 동작(a[download])이 이 이름을 씀
    const blob = elBlobs.get(a) || N.dlBlobs.get(a.href);
    if (!N.canPick() || !blob) { N.dlStatus(a, "link", name); return; }
    e.preventDefault();
    N.saveFile(blob, name).then((r) => N.dlStatus(a, r, name), () => {});
  });

  // 따로 만든 결과 이미지 저장(재미 콘텐츠 등): 저장 창이 없으면 단추 아래에 이름 칸을 띄워 이름을 받는다.
  // 저장 창이 있으면 창에서 이름을 정하므로 바로 기본 이름을 돌려준다. 취소하면 null
  N.askName = (afterEl, def, ext) => {
    if (N.canPick()) return Promise.resolve(N.fileName("", def, ext));
    document.querySelectorAll(".fname-pop").forEach((p) => p._cancel && p._cancel());
    return new Promise((resolve) => {
      const pop = document.createElement("div");
      pop.className = "fname-pop";
      pop.setAttribute("role", "group");
      pop.setAttribute("aria-label", "저장할 파일 이름");
      pop.innerHTML = `${N.nameFieldHtml({ def, ext })}<span class="fname-btns"><button type="button" class="btn" data-ok>저장</button><button type="button" class="btn ghost" data-no>취소</button></span>`;
      const inp = pop.querySelector(".fname-in");
      const end = (v) => { pop.remove(); resolve(v); if (!v) try { afterEl.focus({ preventScroll: true }); } catch (e) {} };
      pop._cancel = () => { pop.remove(); resolve(null); };
      pop.querySelector("[data-ok]").addEventListener("click", () => end(N.nameFrom(inp, ext)));
      pop.querySelector("[data-no]").addEventListener("click", () => end(null));
      pop.addEventListener("keydown", (e) => {
        if (e.isComposing) return;
        if (e.key === "Enter" && e.target === inp) { e.preventDefault(); pop.querySelector("[data-ok]").click(); }
        else if (e.key === "Escape") { e.preventDefault(); end(null); }
      });
      const host = afterEl.closest(".share, .hl-btns, .dr-share, .tr-share") || afterEl;
      host.insertAdjacentElement("afterend", pop);
      inp.focus({ preventScroll: true });
      inp.select();
      pop.scrollIntoView({ block: "nearest" });
    });
  };
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

// P2-66 전 툴 공통: (1) 고정 머리글 높이를 CSS 변수(--hdr-h)로 → 앵커·결과·초점 스크롤 때 머리글 밑으로
// (2) 툴 상자 안의 양식을 제출(계산하기·보기 등)했는데 결과가 화면 밖(아래)에 생기면 결과 머리로 스크롤
(function () {
  const root = document.documentElement;
  const hdr = document.querySelector(".site-header");
  const hdrH = () => (hdr && getComputedStyle(hdr).position === "sticky" ? hdr.offsetHeight : 0);
  const setH = () => root.style.setProperty("--hdr-h", hdrH() + "px");
  setH();
  if (hdr && "ResizeObserver" in window) new ResizeObserver(setH).observe(hdr);
  else addEventListener("resize", setH);

  const RES = '.result,.dd-result,[class*="-result"],output,[aria-live]';
  const shown = (el) => !!(el.offsetParent || el.getClientRects().length) && (el.innerText || "").trim().length > 0;
  document.addEventListener("submit", (e) => {
    const form = e.target;
    const box = form && form.closest && form.closest(".tool-box");
    if (!box || box.hasAttribute("data-no-autoscroll")) return;
    const y0 = scrollY;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (Math.abs(scrollY - y0) > 2) return; // 툴이 이미 스크롤함(운세·사주 등)
      const list = [...box.querySelectorAll(RES)].filter((el) => !form.contains(el) && shown(el) && !el.closest("[hidden]"));
      const out = list.find((el) => form.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) || list[0];
      if (!out) return;
      const r = out.getBoundingClientRect(), top = hdrH();
      if (r.top < innerHeight - 64 && r.bottom > top + 8) return; // 이미 보임
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      scrollTo({ top: Math.max(0, scrollY + r.top - top - 10), behavior: reduce ? "auto" : "smooth" });
    }));
  });
})();
