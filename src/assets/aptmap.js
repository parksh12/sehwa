// P2-63b 역세권 아파트 지도 화면: 카카오맵 + 클러스터, 가격대 칩·지역·노선·준공·도보 10분 필터, 지도 영역 목록, 단지 카드, 주소 공유
// 계산(필터·배지·가격 표기·주소)은 aptmap-core.js. 내 위치는 이 기기 안에서 지도를 옮길 때만 쓰고 저장·전송하지 않으며 주소(공유 링크)에도 넣지 않음
(function () {
  "use strict";
  const C = window.AptCore;
  const root = document.getElementById("tool");
  if (!root || !C || root.dataset.tool !== "aptmap") return;
  const $ = (s, el = root) => el.querySelector(s);
  const $$ = (s, el = root) => Array.from(el.querySelectorAll(s));
  const H = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const toast = (m) => (window.NALGI && NALGI.toast ? NALGI.toast(m) : null);
  const ga = (name, params) => { try { if (typeof window.gtag === "function") window.gtag("event", name, params); } catch (e) { /* 측정 실패는 무시 */ } };
  const BAND = Object.fromEntries(C.BANDS.map((b) => [b.k, b]));
  const SORT_SHORT = { price: "가격순", dist: "역 가까운 순", built: "최신 준공순" };
  const PAGE = 100;

  const S = C.parse(location.search);
  let all = [], byId = new Map(), filtered = [], inView = [], sidoName = {}, shown = PAGE;
  let map = null, overlays = [], focusOv = null, meOv = null;
  const onMap = new Set(); // 지금 지도에 올린 단지 마커(i)
  let clPool = [], clUsed = 0; // 묶음 숫자 오버레이 재사용
  let mapState = "loading"; // loading | ok | fail
  let userMoved = !!S.m, prog = false, locUsed = false, lastOpener = null, firstIdle = true;

  const el = {
    chips: $$(".am-chip"), sido: $('select[name="sido"]'), line: $('select[name="line"]'), built: $('select[name="built"]'),
    walk: $('input[name="walk10"]'), sort: $('select[name="sort"]'), rows: $("#am-rows"), count: $(".am-count"), empty: $(".am-empty"),
    more: $(".am-more"), card: $("#am-card"), loading: $(".am-loading"), sheet: $(".am-sheet"), list: $("#am-list"), mapEl: $("#am-map"),
  };
  const dlg = document.getElementById("am-info");

  // ───────── 컨트롤 ↔ 상태 ─────────
  function syncControls() {
    el.chips.forEach((b) => b.setAttribute("aria-pressed", S.p.has(b.dataset.band) ? "true" : "false"));
    el.sido.value = S.sido;
    el.built.value = S.built ? String(S.built) : "";
    el.walk.checked = S.walk10;
    el.sort.value = S.sort;
    fillLines();
  }
  function fillLines() {
    const cnt = new Map();
    for (const c of all) {
      if (S.sido && c.sido !== S.sido) continue;
      const seen = new Set();
      for (const s of c.st) for (const l of s.l) if (!seen.has(l)) { seen.add(l); cnt.set(l, (cnt.get(l) || 0) + 1); }
    }
    const names = Array.from(cnt.keys()).sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
    if (S.line && all.length && !cnt.has(S.line)) S.line = ""; // 데이터를 받기 전에는 주소의 노선을 지우지 않음
    if (S.line && !cnt.has(S.line)) cnt.set(S.line, 0);
    el.line.innerHTML = `<option value="">노선 전체</option>${names.map((n) => `<option value="${H(n)}">${H(n)} (${cnt.get(n)})</option>`).join("")}`;
    el.line.value = S.line;
  }
  function writeUrl() {
    const withMap = userMoved && !locUsed && !!S.m;
    const q = C.query(S, { withMap });
    const next = location.pathname + q + location.hash;
    if (next !== location.pathname + location.search + location.hash) history.replaceState(null, "", next);
  }
  const shareUrl = (opts) => location.origin + location.pathname + C.query(S, opts);

  // ───────── 필터 적용 ─────────
  function apply({ fit = false } = {}) {
    filtered = all.filter((c) => C.pass(c, S));
    if (map) { draw(); if (fit) fitSido(); }
    if (S.c && !filtered.some((c) => c.id === S.c)) closeCard(false);
    refreshView();
    writeUrl();
  }
  function refreshView() {
    if (map) {
      const b = map.getBounds(), sw = b.getSouthWest(), ne = b.getNorthEast();
      const s = sw.getLat(), w = sw.getLng(), n = ne.getLat(), e = ne.getLng();
      inView = filtered.filter((c) => c.lat >= s && c.lat <= n && c.lng >= w && c.lng <= e);
    } else inView = filtered.slice();
    renderList();
  }

  // ───────── 목록 ─────────
  function rowHtml(c) {
    const b = BAND[c.band], s = c.st[0];
    return `<li><button type="button" class="am-row${S.c === c.id ? " on" : ""}" data-i="${c.i}"><span class="am-bd am-${c.band}" aria-hidden="true"><i>${H(b.m)}</i></span><span class="am-row-b"><b>${H(c.name)}</b><small>${H(c.sgg)} ${H(c.dong)} · ${H(C.stName(s.n))} ${s.d}m${C.isWalk10(s.d) ? " · 도보 10분" : ""}</small></span><span class="am-row-p"><b>${H(C.fmtPrice(c.price))}</b><small>${c.hh.toLocaleString("ko-KR")}세대 · ${c.built}년</small></span></button></li>`;
  }
  function renderList() {
    const arr = inView.slice().sort(C.CMP[S.sort]);
    el.count.textContent = `${map ? "이 지역" : "조건에 맞는"} 단지 ${arr.length.toLocaleString("ko-KR")}곳 (${SORT_SHORT[S.sort]})`;
    el.rows.innerHTML = arr.slice(0, shown).map(rowHtml).join("");
    const rest = arr.length - shown;
    el.more.hidden = rest <= 0;
    if (rest > 0) el.more.textContent = `더 보기 (${Math.min(rest, PAGE)}곳 더 · 남은 ${rest.toLocaleString("ko-KR")}곳)`;
    renderEmpty(arr.length);
  }
  function renderEmpty(n) {
    if (n > 0 || !all.length) { el.empty.hidden = true; el.empty.innerHTML = ""; return; }
    let h = "";
    if (!filtered.length) {
      // 가격대를 하나씩 더했을 때 몇 곳이 나오는지 → 많이 나오는 3개 추천
      const tips = C.BANDS.filter((b) => !S.p.has(b.k)).map((b) => {
        const t = { ...S, p: new Set([b.k]) };
        return [b, all.filter((c) => C.pass(c, t)).length];
      }).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const relax = [];
      if (S.walk10) relax.push(["walk10", `도보 10분 이내만 끄기 (${all.filter((c) => C.pass(c, { ...S, walk10: false })).length}곳)`]);
      if (S.line) relax.push(["line", `노선 전체로 (${all.filter((c) => C.pass(c, { ...S, line: "" })).length}곳)`]);
      if (S.built) relax.push(["built", `준공 전체로 (${all.filter((c) => C.pass(c, { ...S, built: 0 })).length}곳)`]);
      h = `<p><b>조건에 맞는 단지가 없어요.</b> 조건을 넓혀 보세요.</p><div class="am-tips">${tips.map(([b, k]) => `<button type="button" class="chip" data-add-band="${b.k}">+ ${H(b.n)} (${k}곳)</button>`).join("")}${relax.filter((r) => !r[1].includes("(0곳)")).map(([k, t]) => `<button type="button" class="chip" data-relax="${k}">${H(t)}</button>`).join("")}</div>`;
    } else {
      h = `<p><b>지금 지도 화면에는 조건에 맞는 단지가 없어요.</b> 지도를 축소하거나 옮겨 보세요.</p><div class="am-tips"><button type="button" class="chip" data-fit-all>조건에 맞는 ${filtered.length.toLocaleString("ko-KR")}곳 모두 보기</button></div>`;
    }
    el.empty.innerHTML = h;
    el.empty.hidden = false;
  }

  // ───────── 카드 ─────────
  function cardHtml(c) {
    const b = BAND[c.band], s0 = c.st[0];
    const near = c.st.slice(1).map((s) => `${H(C.stName(s.n))} ${s.d}m`).join(", ");
    return `<button type="button" class="am-card-x" data-close aria-label="단지 카드 닫기">×</button>
<div class="am-card-top"><h2 id="am-card-h">${H(c.name)}</h2><span class="am-bd am-${c.band}"><i aria-hidden="true">${H(b.m)}</i>${H(b.n)}</span></div>
<p class="am-addr">${H(sidoName[c.sido] || "")} ${H(c.sgg)} ${H(c.dong)}</p>
<div class="am-price"><small>대표가격</small><b>${H(C.fmtPrice(c.price))}</b>${c.low ? '<span class="am-low">거래 적음</span>' : ""}</div>
<p class="am-sub">최근 ${c.basis}개월 ${c.n}건 · 전용 40~60㎡ 중개 거래 중위값</p>
${c.rc.length ? `<p class="am-k">최근 거래</p><ul class="am-recent">${c.rc.map((r) => `<li><span>${H(r.date)}</span><span>${r.floor}층</span><span>${r.area}㎡</span><b>${H(C.fmtShort(r.price))}</b></li>`).join("")}</ul>` : ""}
<div class="am-st"><p class="am-st-n"><b>${H(C.stName(s0.n))}</b> <small>(${H(s0.l.join("·"))})</small></p><p>직선 ${s0.d}m · 도보 약 ${C.walkMin(s0.d)}분(추정)</p><span class="am-badge${C.isWalk10(s0.d) ? " w10" : ""}">${H(C.badge(s0.d))}</span>${near ? `<p class="am-near">1km 안 다른 역: ${near}</p>` : ""}</div>
<p class="am-hh"><b>${c.hh.toLocaleString("ko-KR")}세대</b> · ${c.built}년 준공</p>
<p class="am-note">단지 좌표는 대표 주소 1점이라 동마다 역까지 실제 거리는 다를 수 있어요. 거래 완료 기록이라 현재 호가와 다를 수 있어요.</p>
<div class="am-acts"><a class="btn ghost" href="https://rt.molit.go.kr/" target="_blank" rel="noopener">국토부 실거래 원문 보기 ↗<span class="sr"> (새 창, 국토교통부 실거래가 공개시스템)</span></a><button type="button" class="btn" data-share-c>이 단지 링크 공유</button></div>`;
    // 정책대출 참고 문구 자리(P2-63b 보류: 주택도시기금·주택금융공사 원문 대조 뒤 이 아래에 넣음)
  }
  function openCard(c, from) {
    if (!c) return;
    S.c = c.id;
    el.card.innerHTML = cardHtml(c);
    el.card.hidden = false;
    root.classList.add("am-card-on");
    el.list.classList.remove("open"); el.sheet.setAttribute("aria-expanded", "false");
    focusAt(c, true);
    $$(".am-row.on", el.rows).forEach((x) => x.classList.remove("on"));
    const row = el.rows.querySelector(`[data-i="${c.i}"]`); if (row) row.classList.add("on");
    if (from !== "url") { ga("aptmap_card_open", { complex_id: c.id, complex_name: c.name, band: c.band, sido: c.sido, from }); el.card.querySelector(".am-card-x").focus({ preventScroll: true }); }
    writeUrl();
  }
  function closeCard(write = true) {
    if (el.card.hidden && !S.c) return;
    S.c = "";
    el.card.hidden = true; el.card.innerHTML = "";
    root.classList.remove("am-card-on");
    if (focusOv && !focusOv._hover) focusOv.setMap(null);
    $$(".am-row.on", el.rows).forEach((x) => x.classList.remove("on"));
    if (write) writeUrl();
    if (lastOpener && document.contains(lastOpener)) lastOpener.focus({ preventScroll: true });
    lastOpener = null;
  }
  function focusAt(c, keep) {
    if (!map) return;
    if (!focusOv) {
      const f = document.createElement("div"); f.className = "am-focus"; f.setAttribute("aria-hidden", "true");
      focusOv = new kakao.maps.CustomOverlay({ content: f, xAnchor: 0.5, yAnchor: 0.5, zIndex: 9 });
    }
    focusOv._hover = !keep;
    focusOv.setPosition(new kakao.maps.LatLng(c.lat, c.lng));
    focusOv.setMap(map);
  }

  // ───────── 공유 ─────────
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) { /* 복사 실패 */ }
      ta.remove(); return ok;
    }
  }
  async function shareComplex() {
    const c = byId.get(S.c); if (!c) return;
    const url = shareUrl({ withMap: false });
    ga("aptmap_share", { share_type: "complex", complex_id: c.id });
    const text = `${c.name} (${sidoName[c.sido] || ""} ${c.sgg}) 20평대 대표가격 ${C.fmtPrice(c.price)} · ${C.stName(c.st[0].n)} 직선 ${c.st[0].d}m`;
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try { await navigator.share({ title: c.name, text, url }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    (await copyText(url)) ? toast("이 단지 링크를 복사했어요") : toast("복사에 실패했어요");
  }
  async function copyFilter() {
    const url = shareUrl({ withCard: false, withMap: userMoved && !locUsed });
    ga("aptmap_share", { share_type: "filter", bands: Array.from(S.p).join(","), sido: S.sido, walk10: S.walk10 ? 1 : 0 });
    (await copyText(url)) ? toast("지금 조건의 링크를 복사했어요") : toast("복사에 실패했어요");
  }

  // ───────── 지도 ─────────
  function loadKakao(key) {
    return new Promise((res, rej) => {
      if (!key) return rej(new Error("nokey"));
      const to = setTimeout(() => rej(new Error("timeout")), 15000);
      const s = document.createElement("script");
      s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
      s.async = true;
      s.onerror = () => { clearTimeout(to); rej(new Error("sdk")); };
      s.onload = () => {
        if (!window.kakao || !kakao.maps || !kakao.maps.load) { clearTimeout(to); return rej(new Error("sdk")); }
        kakao.maps.load(() => { clearTimeout(to); res(); });
      };
      document.head.appendChild(s);
    });
  }
  const LL = (lat, lng) => new kakao.maps.LatLng(lat, lng);
  function boundsOf(list) {
    const b = new kakao.maps.LatLngBounds();
    list.forEach((c) => b.extend(LL(c.lat, c.lng)));
    return b;
  }
  function fitKorea() { prog = true; map.setBounds(new kakao.maps.LatLngBounds(LL(34.3, 126.1), LL(38.0, 129.6)), 8, 8, 8, 8); }
  function fitSido() {
    const list = S.sido ? all.filter((c) => c.sido === S.sido) : [];
    if (!list.length) return fitKorea();
    prog = true;
    map.setBounds(boundsOf(list), 30, 30, 30, 30);
  }
  // 묶음(클러스터): 카카오 MarkerClusterer는 전국 2천여 곳을 넣을 때 필터 한 번에 0.6~1.3초(CPU 4배 느린 휴대폰 가정) 멈춰서,
  // 지도 평면 좌표(pointFromCoords) 80px 격자로 직접 묶는다(같은 조건 10ms 안팎). 수준 7 이상에서 묶고, 칸에 1곳뿐이면 마커로 보여 줌
  const CL_LEVEL = 7, GRID = 80;
  function makeOverlay(c) {
    const b = BAND[c.band];
    const d = document.createElement("button");
    d.type = "button"; d.className = `am-mk am-${c.band}`; d.textContent = b.m;
    d.setAttribute("aria-label", `${c.name} ${b.n} ${C.fmtPrice(c.price)}`);
    d.addEventListener("click", (e) => { e.stopPropagation(); lastOpener = null; openCard(c, "marker"); });
    d.addEventListener("mouseenter", () => { d.parentElement && (d.parentElement.style.zIndex = "8"); });
    d.addEventListener("mouseleave", () => { d.parentElement && (d.parentElement.style.zIndex = ""); });
    return new kakao.maps.CustomOverlay({ position: c.ll, content: d, xAnchor: 0.5, yAnchor: 0.5, clickable: true, zIndex: 2 });
  }
  function clusterOverlay() {
    if (clUsed < clPool.length) return clPool[clUsed++];
    const d = document.createElement("button");
    d.type = "button"; d.className = "am-cl";
    const ov = new kakao.maps.CustomOverlay({ content: d, xAnchor: 0.5, yAnchor: 0.5, clickable: true, zIndex: 3 });
    d.addEventListener("click", (e) => {
      e.stopPropagation();
      const lv = map.getLevel();
      userMoved = true;
      map.setLevel(Math.max(1, lv - (lv > 9 ? 2 : 1)), { anchor: ov.getPosition(), animate: true });
    });
    ov._el = d; clPool.push(ov); clUsed++;
    return ov;
  }
  function draw() {
    if (!map) return;
    const lv = map.getLevel();
    const b = map.getBounds(), sw = b.getSouthWest(), ne = b.getNorthEast();
    const dy = (ne.getLat() - sw.getLat()) * 0.25, dx = (ne.getLng() - sw.getLng()) * 0.25; // 화면 밖 25%까지 미리 그림
    const s = sw.getLat() - dy, n = ne.getLat() + dy, w = sw.getLng() - dx, e = ne.getLng() + dx;
    const cand = filtered.filter((c) => c.lat >= s && c.lat <= n && c.lng >= w && c.lng <= e);
    const want = new Set();
    clUsed = 0;
    if (lv >= CL_LEVEL) {
      const proj = map.getProjection(), cells = new Map();
      for (const c of cand) {
        const p = proj.pointFromCoords(c.ll), k = `${Math.floor(p.x / GRID)},${Math.floor(p.y / GRID)}`;
        const cell = cells.get(k); cell ? cell.push(c) : cells.set(k, [c]);
      }
      for (const list of cells.values()) {
        if (list.length === 1) { want.add(list[0].i); continue; }
        let la = 0, ln = 0; for (const c of list) { la += c.lat; ln += c.lng; }
        const ov = clusterOverlay(), n = list.length;
        ov.setPosition(new kakao.maps.LatLng(la / n, ln / n));
        ov._el.textContent = n.toLocaleString("ko-KR");
        ov._el.className = `am-cl ${n >= 200 ? "s4" : n >= 50 ? "s3" : n >= 10 ? "s2" : "s1"}`;
        ov._el.setAttribute("aria-label", `단지 ${n}곳 묶음, 누르면 확대`);
        if (!ov.getMap()) ov.setMap(map);
      }
    } else for (const c of cand) want.add(c.i);
    for (let i = clUsed; i < clPool.length; i++) if (clPool[i].getMap()) clPool[i].setMap(null);
    for (const i of Array.from(onMap)) if (!want.has(i)) { overlays[i].setMap(null); onMap.delete(i); }
    for (const i of want) if (!onMap.has(i)) { (overlays[i] || (overlays[i] = makeOverlay(all[i]))).setMap(map); onMap.add(i); }
  }
  function initMap() {
    // 처음 위치는 지도를 만들 때 바로 넣음(setLevel이 idle을 곧바로 부르면 S.m이 덮어써지므로)
    const first = S.c && byId.get(S.c);
    const start = S.m ? [S.m.lat, S.m.lng, S.m.z] : first ? [first.lat, first.lng, 5] : [36.3, 127.8, 13];
    prog = true;
    map = new kakao.maps.Map(el.mapEl, { center: LL(start[0], start[1]), level: start[2] });
    map.setMaxLevel(13);
    all.forEach((c) => { c.ll = LL(c.lat, c.lng); });
    overlays = new Array(all.length); // 마커는 처음 보일 때 만듦
    // 이벤트를 먼저 걸어 둠(처음 위치를 정할 때 idle이 바로 올 수 있음)
    kakao.maps.event.addListener(map, "dragstart", () => { userMoved = true; });
    kakao.maps.event.addListener(map, "zoom_changed", () => { if (!prog) userMoved = true; });
    kakao.maps.event.addListener(map, "idle", onIdle);
    kakao.maps.event.addListener(map, "click", () => { if (!el.card.hidden) closeCard(); });
    mapState = "ok";
    if (!S.m && !first) { if (S.sido) fitSido(); else fitKorea(); }
    apply();
    setTimeout(() => { if (firstIdle) onIdle(); }, 1200); // 위치가 그대로라 idle이 오지 않을 때
    if (first && filtered.includes(first)) openCard(first, "url");
  }
  function onIdle() {
    prog = false;
    const c = map.getCenter();
    S.m = { lat: c.getLat(), lng: c.getLng(), z: map.getLevel() };
    draw();
    shown = PAGE;
    refreshView();
    writeUrl();
    if (firstIdle) {
      firstIdle = false;
      el.loading.hidden = true;
      root.dataset.ready = String(Math.round(performance.now())); // 첫 표시 시각(측정용)
    }
  }
  function mapFail(why) {
    mapState = "fail";
    el.loading.hidden = false;
    el.loading.classList.add("err");
    el.loading.textContent = why === "nokey" ? "지도를 준비하고 있어요. 아래 목록에서 단지를 볼 수 있어요." : "지도를 불러오지 못했어요. 아래 목록에서 단지를 볼 수 있어요.";
    root.classList.add("am-nomap");
    root.dataset.ready = String(Math.round(performance.now()));
    apply();
    const first = S.c && byId.get(S.c);
    if (first && filtered.includes(first)) openCard(first, "url");
  }

  // ───────── 내 위치(기기 안에서만) ─────────
  function locate() {
    if (!map) return;
    if (!navigator.geolocation) return toast("이 브라우저는 위치 기능을 지원하지 않아요");
    navigator.geolocation.getCurrentPosition((pos) => {
      locUsed = true; // 이후로는 공유 주소에 지도 위치를 넣지 않음(내 위치가 링크에 남지 않게)
      const p = LL(pos.coords.latitude, pos.coords.longitude);
      if (!meOv) {
        const m = document.createElement("div"); m.className = "am-me"; m.setAttribute("aria-hidden", "true");
        meOv = new kakao.maps.CustomOverlay({ content: m, xAnchor: 0.5, yAnchor: 0.5, zIndex: 7 });
      }
      meOv.setPosition(p); meOv.setMap(map);
      prog = true; map.setLevel(6); map.setCenter(p);
      writeUrl();
    }, () => toast("위치를 가져오지 못했어요. 브라우저의 위치 권한을 확인해 주세요"), { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }

  // ───────── 이벤트 ─────────
  let gaT = null;
  function track(type, value) {
    clearTimeout(gaT);
    gaT = setTimeout(() => ga("aptmap_filter", { filter_type: type, filter_value: String(value), bands: Array.from(S.p).join(","), sido: S.sido, line: S.line, built: S.built || 0, walk10: S.walk10 ? 1 : 0, result_count: filtered.length }), 600);
  }
  root.addEventListener("click", (e) => {
    const t = e.target.closest("button, a");
    if (!t || !root.contains(t)) return;
    if (t.classList.contains("am-chip")) {
      const k = t.dataset.band;
      S.p.has(k) ? S.p.delete(k) : S.p.add(k);
      t.setAttribute("aria-pressed", S.p.has(k) ? "true" : "false");
      apply(); track("band", k);
    } else if (t.hasAttribute("data-am-reset")) {
      const keep = S.m; Object.assign(S, C.DEFAULT(), { m: keep });
      closeCard(false); syncControls(); apply({ fit: !!map && !userMoved }); track("reset", "all");
    } else if (t.hasAttribute("data-add-band")) {
      S.p.add(t.dataset.addBand); syncControls(); apply(); track("band", t.dataset.addBand);
    } else if (t.hasAttribute("data-relax")) {
      const k = t.dataset.relax;
      if (k === "walk10") S.walk10 = false; else if (k === "line") S.line = ""; else if (k === "built") S.built = 0;
      syncControls(); apply(); track(k, "relax");
    } else if (t.hasAttribute("data-fit-all")) {
      if (map && filtered.length) { map.setBounds(boundsOf(filtered), 30, 30, 30, 30); }
    } else if (t.classList.contains("am-row")) {
      lastOpener = t; openCard(all[+t.dataset.i], "list");
    } else if (t.hasAttribute("data-close")) closeCard();
    else if (t.hasAttribute("data-share-c")) shareComplex();
    else if (t.hasAttribute("data-am-copy")) copyFilter();
    else if (t.hasAttribute("data-zoom")) { if (map) { userMoved = true; map.setLevel(map.getLevel() - +t.dataset.zoom, { animate: true }); } }
    else if (t.hasAttribute("data-locate")) locate();
    else if (t.hasAttribute("data-am-info")) { if (dlg && dlg.showModal) dlg.showModal(); else if (dlg) dlg.setAttribute("open", ""); }
    else if (t === el.sheet) {
      const open = !el.list.classList.contains("open");
      el.list.classList.toggle("open", open); t.setAttribute("aria-expanded", open ? "true" : "false");
    } else if (t === el.more) { shown += PAGE; renderList(); }
  });
  el.sido.addEventListener("change", () => { S.sido = el.sido.value; fillLines(); apply({ fit: true }); track("sido", S.sido || "all"); });
  el.line.addEventListener("change", () => { S.line = el.line.value; apply(); track("line", S.line || "all"); });
  el.built.addEventListener("change", () => { S.built = +el.built.value || 0; apply(); track("built", S.built || "all"); });
  el.walk.addEventListener("change", () => { S.walk10 = el.walk.checked; apply(); track("walk10", S.walk10 ? 1 : 0); });
  el.sort.addEventListener("change", () => { S.sort = el.sort.value; shown = PAGE; renderList(); writeUrl(); });
  el.rows.addEventListener("mouseover", (e) => { const r = e.target.closest(".am-row"); if (r && map) focusAt(all[+r.dataset.i], false); });
  el.rows.addEventListener("mouseleave", () => { if (focusOv && focusOv._hover) { const c = byId.get(S.c); c ? focusAt(c, true) : focusOv.setMap(null); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el.card.hidden && !(dlg && dlg.open)) closeCard(); });
  if (dlg) dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  // ───────── 시작 ─────────
  syncControls();
  fetch(root.dataset.src, { credentials: "same-origin" }).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }).then((d) => {
    sidoName = Object.fromEntries(d.sido.map(([k, n]) => [String(k), n]));
    all = C.inflate(d);
    byId = new Map(all.map((c) => [c.id, c]));
    if (S.sido && !sidoName[S.sido]) S.sido = "";
    syncControls();
    loadKakao(root.dataset.k).then(initMap, (e) => mapFail(e && e.message));
  }).catch(() => {
    el.loading.classList.add("err");
    el.loading.textContent = "실거래 데이터를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.";
    root.dataset.ready = "fail";
  });
})();
