// QR코드 생성기 (P2-48): 링크·글·와이파이·연락처(vCard 3.0)·문자 → 색·여백·가운데 로고 → PNG·SVG 저장, 이미지 복사, 와이파이 안내 카드(A6 인쇄)
// 의존: vendor/qrcode-generator/qrcode.js (MIT, Kazuhiko Arase), tool-kit.js. 입력값과 로고 이미지는 브라우저 안에서만 쓰고 서버로 보내지 않습니다.
(function () {
  const box = document.querySelector('[data-tool="qr"]');
  if (!box || typeof qrcode !== "function") return;
  qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"]; // 한글 등은 UTF-8 바이트로
  document.documentElement.classList.add("qr-doc");
  // 이 페이지에서 인쇄하면 A6 한 장(와이파이 안내 카드). 사이트 기본 @page(A4)보다 뒤에 넣어 덮어씀
  // 크롬·엣지는 size 키워드 A6을 모르므로(A5까지만) 105mm 148mm를 먼저 쓰고, A6을 아는 브라우저는 뒤의 A6을 씀
  const ps = document.createElement("style");
  ps.textContent = "@media print{@page{size:105mm 148mm;size:A6;margin:0}}";
  document.head.appendChild(ps);

  const $ = (s) => box.querySelector(s);
  const f = (n) => box.querySelector(`[name="${n}"]`);
  const val = (n) => { const c = box.querySelector(`[name="${n}"]:checked`); return c ? c.value : f(n) ? f(n).value : ""; };
  const cv = $(".qr-canvas"), empty = $(".qr-empty"), info = $(".qr-info"), warn = $(".qr-warn"), err = $(".qr-err");
  const cardSec = $(".qr-cardsec"), card = $(".qr-card");
  const CAP = { L: 2953, M: 2331, Q: 1663, H: 1273 }; // 바이트 모드 최대(40버전)
  const ECL_TXT = { L: "약 7%", M: "약 15%", Q: "약 25%", H: "약 30%" };
  const LOGO_MAX = 10 * PT.MB;

  let cur = null; // { q, payload, ecl }
  let logo = null; // { canvas, url, w, h, name }
  let prevEcl = "M"; // 로고를 빼면 돌아갈 오류 정정 단계

  // ---------- 내용 만들기 ----------
  const wifiEsc = (s) => String(s).replace(/([\\;,:"])/g, "\\$1");
  const vEsc = (s) => String(s).trim().replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
  const phone = (s) => String(s).replace(/[^\d+*#]/g, "");

  function payload() {
    const t = val("type");
    if (t === "link") {
      let v = f("url").value.trim();
      if (!v) return { need: "링크 주소를 넣으면 QR코드가 바로 만들어져요." };
      const notes = [];
      if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) { v = "https://" + v; notes.push("주소 앞에 https://를 붙였어요."); }
      if (/\s/.test(v)) notes.push("주소에 띄어쓰기가 들어 있어요. 주소가 맞는지 확인해 주세요.");
      return { text: v, notes };
    }
    if (t === "text") {
      const v = f("text").value;
      if (!v.trim()) return { need: "QR코드에 담을 글을 넣어 주세요." };
      return { text: v, notes: [] };
    }
    if (t === "wifi") {
      const ssid = f("ssid").value, pw = f("wpass").value, sec = val("wsec"), hid = f("whidden").checked;
      if (!ssid) return { need: "와이파이 이름(SSID)을 넣어 주세요. 휴대폰의 와이파이 목록에 보이는 이름 그대로예요." };
      const notes = [];
      if (sec !== "nopass" && !pw) return { need: "비밀번호를 넣어 주세요. 비밀번호가 없는 와이파이라면 보안 방식을 「비밀번호 없음」으로 고르세요." };
      if (sec === "WPA" && (pw.length < 8 || pw.length > 63)) notes.push("WPA 비밀번호는 보통 8~63자예요. 공유기에 적힌 비밀번호와 같은지 확인해 주세요.");
      if (ssid !== ssid.trim() || pw !== pw.trim()) notes.push("이름이나 비밀번호 앞뒤에 띄어쓰기가 있어요. 실제로 띄어쓰기가 있는 게 아니라면 지워 주세요.");
      let s = `WIFI:T:${sec};S:${wifiEsc(ssid)};`;
      if (sec !== "nopass") s += `P:${wifiEsc(pw)};`;
      if (hid) s += "H:true;";
      return { text: s + ";", notes };
    }
    if (t === "vcard") {
      const g = (n) => f(n).value.trim();
      const last = g("vlast"), first = g("vfirst"), tel = g("vtel"), work = g("vwork"), mail = g("vmail"), org = g("vorg"), title = g("vtitle"), url = g("vurl"), adr = g("vadr");
      if (!last && !first && !org) return { need: "이름(또는 회사 이름)을 넣어 주세요." };
      const fn = /[\u3131-\uD7A3]/.test(last + first) ? last + first : [first, last].filter(Boolean).join(" ");
      const L = ["BEGIN:VCARD", "VERSION:3.0", `N:${vEsc(last)};${vEsc(first)};;;`, `FN:${vEsc(fn || org)}`];
      if (org) L.push(`ORG:${vEsc(org)}`);
      if (title) L.push(`TITLE:${vEsc(title)}`);
      if (tel) L.push(`TEL;TYPE=CELL:${phone(tel)}`);
      if (work) L.push(`TEL;TYPE=WORK,VOICE:${phone(work)}`);
      if (mail) L.push(`EMAIL;TYPE=INTERNET:${vEsc(mail)}`);
      if (url) L.push(`URL:${vEsc(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : "https://" + url)}`);
      if (adr) L.push(`ADR;TYPE=WORK:;;${vEsc(adr)};;;;`);
      L.push("END:VCARD");
      return { text: L.join("\r\n"), notes: [] };
    }
    // 문자
    const num = phone(f("snum").value), msg = f("smsg").value;
    if (!num) return { need: "문자를 받을 전화번호를 넣어 주세요." };
    return { text: `SMSTO:${num}:${msg}`, notes: [] };
  }

  // ---------- QR 만들기 ----------
  function make(text, ecl) {
    const q = qrcode(0, ecl);
    q.addData(text, "Byte");
    q.make();
    return q;
  }
  const bytesOf = (s) => qrcode.stringToBytes(s).length;

  function opts() {
    return {
      fg: f("fg").value, bg: f("bg").value,
      margin: Number(f("margin").value),
      logoRatio: Number(f("logosize").value) / 100,
      plate: f("plate").checked,
    };
  }

  // 로고 자리: 모듈 단위 정사각형(가운데). plate가 켜지면 그 안의 모듈은 그리지 않음
  function logoBox(n, o) {
    if (!logo) return null;
    const side = n * o.logoRatio; // 로고 이미지 한 변(모듈 단위)
    const pad = o.plate ? 0.6 : 0;
    const half = side / 2 + pad;
    return { side, half, c: n / 2 };
  }
  const hidden = (lb, r, c) => lb && lb.half && Math.abs(c + 0.5 - lb.c) < lb.half && Math.abs(r + 0.5 - lb.c) < lb.half;

  function draw(ctx, size, q, o) {
    const n = q.getModuleCount(), m = o.margin, s = size / (n + 2 * m);
    const lb = logoBox(n, o), clear = lb && o.plate;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = o.bg; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = o.fg;
    const P = (k) => Math.round((k + m) * s);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!q.isDark(r, c) || (clear && hidden(lb, r, c))) continue;
        let c2 = c; while (c2 + 1 < n && q.isDark(r, c2 + 1) && !(clear && hidden(lb, r, c2 + 1))) c2++; // 가로로 이어진 칸은 한 번에
        ctx.fillRect(P(c), P(r), P(c2 + 1) - P(c), P(r + 1) - P(r));
        c = c2;
      }
    }
    if (lb) {
      const cx = (lb.c + m) * s;
      if (o.plate) {
        const h = lb.half * s;
        ctx.fillStyle = o.bg;
        roundRect(ctx, cx - h, cx - h, 2 * h, 2 * h, h * 0.18); ctx.fill();
      }
      const side = lb.side * s, k = Math.min(side / logo.w, side / logo.h), w = logo.w * k, h = logo.h * k;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(logo.canvas, cx - w / 2, cx - h / 2, w, h);
    }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function svgText(q, o) {
    const n = q.getModuleCount(), m = o.margin, T = n + 2 * m;
    const lb = logoBox(n, o), clear = lb && o.plate;
    let d = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!q.isDark(r, c) || (clear && hidden(lb, r, c))) continue;
        let c2 = c; while (c2 + 1 < n && q.isDark(r, c2 + 1) && !(clear && hidden(lb, r, c2 + 1))) c2++;
        d += `M${c + m} ${r + m}h${c2 - c + 1}v1h-${c2 - c + 1}z`;
        c = c2;
      }
    }
    let lg = "";
    if (lb) {
      const cx = lb.c + m, r3 = (x) => Math.round(x * 1000) / 1000;
      if (o.plate) { const h = lb.half; lg += `<rect x="${r3(cx - h)}" y="${r3(cx - h)}" width="${r3(2 * h)}" height="${r3(2 * h)}" rx="${r3(h * 0.18)}" fill="${o.bg}"/>`; }
      const k = Math.min(lb.side / logo.w, lb.side / logo.h), w = logo.w * k, h = logo.h * k;
      lg += `<image x="${r3(cx - w / 2)}" y="${r3(cx - h / 2)}" width="${r3(w)}" height="${r3(h)}" preserveAspectRatio="xMidYMid meet" xlink:href="${logo.url}"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${T} ${T}" width="${T * 10}" height="${T * 10}" shape-rendering="crispEdges"><rect width="${T}" height="${T}" fill="${o.bg}"/><path fill="${o.fg}" d="${d}"/>${lg}</svg>`;
  }

  // ---------- 색 대비 ----------
  const lum = (hex) => {
    const v = parseInt(hex.slice(1), 16), ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };

  // ---------- 화면 갱신 ----------
  function update() {
    const t = val("type");
    box.querySelectorAll(".qr-pane").forEach((p) => (p.hidden = p.dataset.pane !== t));
    document.documentElement.classList.toggle("qr-wifi", t === "wifi");
    cardSec.hidden = t !== "wifi";
    // 로고가 있으면 오류 정정 H 고정
    const eclIn = box.querySelectorAll('[name="ecl"]');
    eclIn.forEach((x) => (x.disabled = !!logo));
    $(".qr-ecl-note").hidden = !logo;
    const ecl = logo ? "H" : val("ecl");
    const o = opts();
    $(".qr-m-out").textContent = o.margin + "칸";
    $(".qr-l-out").textContent = Math.round(o.logoRatio * 100) + "%";

    const p = payload();
    const notes = [...(p.notes || [])];
    err.hidden = true; err.textContent = "";
    cur = null;
    if (p.need) {
      showEmpty(p.need);
    } else {
      try { cur = { q: make(p.text, ecl), payload: p.text, ecl }; }
      catch (e) {
        const n = bytesOf(p.text);
        err.textContent = `내용이 너무 길어요(${n.toLocaleString("ko-KR")}바이트). 오류 정정 ${ecl}에서는 ${CAP[ecl].toLocaleString("ko-KR")}바이트까지 담을 수 있어요. 한글은 한 글자에 3바이트예요.${ecl !== "L" && !logo ? " 오류 정정을 낮추거나 내용을 줄여 주세요." : " 내용을 줄여 주세요."}`;
        err.hidden = false;
        showEmpty("");
      }
    }
    if (cur) {
      const n = cur.q.getModuleCount(), ver = (n - 17) / 4;
      empty.hidden = true; cv.hidden = false;
      draw(cv.getContext("2d"), cv.width, cur.q, o);
      cv.setAttribute("aria-label", `QR코드 미리보기: ${t === "wifi" ? "와이파이 " + f("ssid").value : cur.payload.slice(0, 80)}`);
      info.textContent = `버전 ${ver} · ${n}×${n}칸 · 오류 정정 ${ecl}(${ECL_TXT[ecl]} 복구) · ${bytesOf(cur.payload).toLocaleString("ko-KR")}바이트`;
      if (ver >= 15) notes.push("칸이 촘촘해요. 작게 인쇄하면 잘 안 읽힐 수 있으니 3cm보다 크게 인쇄하거나 내용을 줄여 주세요.");
    } else info.textContent = "";
    // 꾸미기 경고
    const lf = lum(o.fg), lbg = lum(o.bg), ratio = (Math.max(lf, lbg) + 0.05) / (Math.min(lf, lbg) + 0.05);
    const cw = [];
    if (ratio < 4) cw.push(`색 대비가 낮아요(${ratio.toFixed(1)} : 1). 못 읽는 휴대폰이 있을 수 있어서 4 : 1 이상을 권해요. QR 색은 진하게, 배경은 밝게 해 주세요.`);
    if (lf > lbg) cw.push("QR 색이 배경보다 밝아요(반전). 반전된 QR을 못 읽는 카메라 앱이 많아요.");
    if (o.margin < 2) cw.push("여백이 좁으면 주변 그림과 섞여 안 읽힐 수 있어요. 4칸을 권해요.");
    $(".qr-cwarn").hidden = !cw.length; $(".qr-cwarn").textContent = cw.join(" ");
    warn.hidden = !notes.length; warn.textContent = notes.join(" ");
    box.querySelectorAll("[data-png],[data-svg],[data-copy]").forEach((b) => (b.disabled = !cur));
    if (t === "wifi") renderCard();
  }
  function showEmpty(text) {
    cv.hidden = true; empty.hidden = !text; empty.textContent = text;
  }

  // ---------- 와이파이 안내 카드 ----------
  function renderCard() {
    const shop = f("cshop").value.trim(), guide = f("cguide").value.trim(), showPw = f("cshowpw").checked;
    const ssid = f("ssid").value, pw = f("wpass").value, sec = val("wsec");
    const q = cur && val("type") === "wifi" ? cur.q : null;
    const pwLine = sec === "nopass" ? "비밀번호 없음" : showPw ? pw : "QR코드로 연결해 주세요";
    card.innerHTML = `<p class="qc-top"><span class="qc-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="19.5" r="1.6" fill="currentColor"/></svg></span>${PT.esc(shop || "무료 와이파이")}</p>
<p class="qc-sub">${shop ? "무료 와이파이" : "Wi-Fi"}</p>
<div class="qc-qr">${q ? svgText(q, opts()) : '<span class="qc-ph">와이파이 이름과 비밀번호를 넣으면 QR코드가 나와요</span>'}</div>
<dl class="qc-info"><div><dt>와이파이 이름</dt><dd>${PT.esc(ssid || "-")}</dd></div><div><dt>비밀번호</dt><dd class="${showPw && sec !== "nopass" ? "qc-pw" : "qc-pw-off"}">${PT.esc(pwLine || "-")}</dd></div></dl>
<p class="qc-guide">${PT.esc(guide || "휴대폰 카메라로 QR코드를 비추고, 뜨는 알림을 누르면 바로 연결돼요.")}</p>`;
    $("[data-print]").disabled = !q;
  }

  // ---------- 저장 · 복사 ----------
  function pngBlob(size) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    draw(c.getContext("2d"), size, cur.q, opts());
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));
  }
  const fname = () => {
    const t = val("type");
    const base = t === "wifi" ? "wifi-" + f("ssid").value : t === "vcard" ? "명함-" + (f("vlast").value + f("vfirst").value || f("vorg").value) : t === "sms" ? "문자" : t === "text" ? "글" : (cur.payload.replace(/^[a-z]+:\/\//i, "").split(/[/?#]/)[0] || "링크");
    return "qr-" + PT.base(base).slice(0, 40);
  };
  $("[data-png]").addEventListener("click", async () => {
    if (!cur) return;
    try { PT.save(await pngBlob(Number(f("pngsize").value)), fname() + ".png"); }
    catch (e) { err.textContent = "PNG를 만들지 못했어요. 크기를 줄여서 다시 해 주세요."; err.hidden = false; }
  });
  $("[data-svg]").addEventListener("click", () => {
    if (!cur) return;
    PT.save(new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + svgText(cur.q, opts())], { type: "image/svg+xml" }), fname() + ".svg");
  });
  $("[data-copy]").addEventListener("click", async () => {
    if (!cur) return;
    const toast = (m) => (window.NALGI && NALGI.toast ? NALGI.toast(m) : alert(m));
    if (!(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem)) { toast("이 브라우저는 이미지 복사를 지원하지 않아요. 「PNG 저장」을 써 주세요."); return; }
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob(512) })]); // 사파리: 클릭 직후 Promise를 넘겨야 함
      toast("QR코드 이미지를 복사했어요. 붙여 넣기 하세요.");
    } catch (e) { toast("이미지를 복사하지 못했어요. 「PNG 저장」을 써 주세요."); }
  });
  $("[data-print]").addEventListener("click", () => { renderCard(); window.print(); });

  // ---------- 로고 ----------
  const logoIn = f("logo"), logoName = $(".qr-logo-name"), logoRm = $("[data-logo-rm]");
  logoIn.addEventListener("change", async () => {
    const file = logoIn.files && logoIn.files[0];
    logoIn.value = "";
    if (!file) return;
    err.hidden = true;
    if (!/^image\/(png|jpeg|webp|svg\+xml|gif)$/.test(file.type)) { err.textContent = "로고는 PNG·JPG·WEBP·SVG 이미지만 넣을 수 있어요."; err.hidden = false; return; }
    if (file.size > LOGO_MAX) { err.textContent = `로고 이미지가 너무 커요(${PT.size(file.size)}). 10MB까지 넣을 수 있어요.`; err.hidden = false; return; }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      let w = img.naturalWidth || 512, h = img.naturalHeight || 512;
      const k = Math.min(1, 512 / Math.max(w, h)); w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      if (!logo) { prevEcl = val("ecl"); box.querySelector('[name="ecl"][value="H"]').checked = true; }
      logo = { canvas: c, url: c.toDataURL("image/png"), w, h, name: file.name };
      logoName.textContent = file.name; logoRm.hidden = false;
      $(".qr-logo-opts").hidden = false;
    } catch (e) { err.textContent = `「${file.name}」은(는) 깨졌거나 읽을 수 없는 이미지예요.`; err.hidden = false; }
    finally { URL.revokeObjectURL(url); }
    update();
  });
  logoRm.addEventListener("click", () => {
    logo = null; box.querySelector(`[name="ecl"][value="${prevEcl}"]`).checked = true; logoName.textContent = "없음"; logoRm.hidden = true; $(".qr-logo-opts").hidden = true; update();
  });

  // ---------- 비밀번호 보기 ----------
  $("[data-pwtoggle]").addEventListener("click", (e) => {
    const on = f("wpass").type === "password";
    f("wpass").type = on ? "text" : "password";
    e.currentTarget.textContent = on ? "숨기기" : "보기";
    e.currentTarget.setAttribute("aria-pressed", String(on));
  });
  f("wsec").addEventListener("change", () => { $(".qr-pwrow").hidden = val("wsec") === "nopass"; });

  $("[data-reset-color]").addEventListener("click", () => { f("fg").value = "#000000"; f("bg").value = "#ffffff"; update(); });
  $("[data-swap-color]").addEventListener("click", () => { const a = f("fg").value; f("fg").value = f("bg").value; f("bg").value = a; update(); });

  let timer = 0;
  const later = () => { clearTimeout(timer); timer = setTimeout(update, 120); };
  box.addEventListener("input", (e) => { if (e.target.type !== "file") later(); });
  box.addEventListener("change", (e) => { if (e.target.type !== "file") update(); });
  window.addEventListener("beforeprint", () => { if (val("type") === "wifi") renderCard(); });
  update();
})();
