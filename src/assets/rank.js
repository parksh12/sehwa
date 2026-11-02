// 게임 랭킹 (P2-39) — 랜덤7942와 같은 Firebase 프로젝트의 Realtime DB `pt/` 아래만 씀(랜덤7942 데이터와 분리)
// SDK 없이 REST로 동작: 익명 로그인(Identity Toolkit) → DB REST(PATCH 한 번에 기록 + 쓰기 간격 표시).
// 저장: Firebase에 닉네임·점수·익명 식별자(uid)·작성 시각. 이 기기에는 익명 로그인 토큰·닉네임·내 최고 기록(localStorage)만.
// 실패(오프라인·규칙 미반영 등)해도 게임은 그대로 진행되고, 순위표 자리에 「잠시 후 다시」 안내만 나옴.
(function () {
  const CFG = Object.assign({
    apiKey: "AIzaSyDJ8oVCKKvQ9icGd4-m88KVaLbr3ZHuSD8", // 공개 값(웹 앱 키). 접근 제한은 DB 보안 규칙으로 함
    db: "https://random-chat-f6c6b-default-rtdb.asia-southeast1.firebasedatabase.app",
    auth: "https://identitytoolkit.googleapis.com/v1",
    token: "https://securetoken.googleapis.com/v1",
  }, window.PT_RANK_CFG || {}); // 시험용 덮어쓰기(에뮬레이터)
  const NSQ = CFG.ns ? `ns=${encodeURIComponent(CFG.ns)}&` : ""; // 에뮬레이터 시험용
  const AUTH_KEY = "nalgi-rank-auth", NICK_KEY = "nalgi-rank-nick", MINE_KEY = "nalgi-rank-mine";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtWon = (m) => { const neg = m < 0, a = Math.abs(Math.round(m)), e = Math.floor(a / 10000), r = a % 10000; return (neg ? "-" : "") + (e ? `${e}억${r ? " " + r.toLocaleString("ko-KR") + "만" : ""}` : `${r.toLocaleString("ko-KR")}만`) + "원"; };
  // 게임별: 이름, 정렬(desc 높을수록 좋음 / asc 낮을수록), 이번 주 순위 여부, 점수 범위(규칙과 같음), 표시
  const GAMES = {
    stack: { name: "블록 쌓기", dir: "desc", week: true, ok: (s) => s >= 1 && s <= 2000, fmt: (s) => `${s}층` },
    reaction: { name: "반응속도", dir: "asc", week: true, ok: (s) => s >= 80 && s <= 2000, fmt: (s) => `${s}ms`, low: "80ms 미만 기록은 측정 오류일 수 있어 순위에 올리지 않아요." },
    hell: { name: "지옥에서 살아남기", dir: "desc", week: false, ok: (s) => (s >= 1 && s <= 31) || (s >= 900000 && s <= 1000000), fmt: (s) => (s >= 900000 ? `클리어 · 사망 ${1000000 - s}회` : `STAGE ${s}`) },
    chosun: { name: "헬조선에서 살아남기", dir: "desc", week: false, ok: (s) => s >= 0 && s <= 8100000000, fmt: (s) => `${Math.floor(s / 1e8)}세 · 자산 ${fmtWon((s % 1e8) - 5e7)}` },
    rpg: { name: "펭귄 RPG", dir: "asc", week: false, ok: (s) => s >= 900 && s <= 360000, fmt: (s) => `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분 ${s % 60}초`, low: "15분보다 짧은 기록은 순위에 올리지 않아요." },
  };
  // 점수 만들기(게임 코드에서 씀): 하나의 숫자로 순위를 매기도록 묶음
  const SCORE = {
    hell: ({ clear, deaths, stage }) => (clear ? 1000000 - Math.min(99999, Math.max(0, deaths | 0)) : Math.max(1, Math.min(31, stage | 0))),
    chosun: ({ age, money }) => Math.max(0, Math.min(81, age | 0)) * 1e8 + Math.max(0, Math.min(99999999, Math.round(money) + 5e7)),
  };
  // 이번 주 = 한국 시각 월요일 0시 시작, 키는 그 월요일 YYYYMMDD
  function weekKey(t = Date.now()) {
    const k = new Date(t + 9 * 3600e3), dow = (k.getUTCDay() + 6) % 7; // 월=0
    const mon = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() - dow));
    return mon.toISOString().slice(0, 10).replace(/-/g, "");
  }
  // 닉네임 거르기(목록 + 길이 1~10). 공백·기호를 빼고 비교
  const BAD = ["씨발", "시발", "ㅅㅂ", "ㅆㅂ", "씨8", "병신", "ㅂㅅ", "븅신", "좆", "존나", "개새", "새끼", "ㅅㄲ", "미친놈", "미친년", "ㅁㅊ", "니애미", "느금", "애미", "애비", "섹스", "보지", "자지", "한남", "김치녀", "틀딱", "장애인", "급식충", "맘충", "fuck", "shit", "bitch", "nigger", "sex", "관리자", "운영자", "admin", "펭귄툴즈"];
  const cleanNick = (s) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 10);
  const badNick = (s) => { const n = s.toLowerCase().replace(/[\s._\-~!@#$%^&*()+=|\\/?,'"`:;[\]{}]/g, ""); return BAD.some((w) => n.includes(w)); };

  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  async function req(url, opt = {}, ms = 7000) {
    const ac = typeof AbortController !== "undefined" ? new AbortController() : null;
    const to = setTimeout(() => ac && ac.abort(), ms);
    try {
      const r = await fetch(url, { ...opt, signal: ac && ac.signal, credentials: "omit", cache: "no-store" });
      const body = await r.json().catch(() => null);
      if (!r.ok) { const e = new Error((body && (body.error && (body.error.message || body.error))) || `HTTP ${r.status}`); e.status = r.status; throw e; }
      return body;
    } finally { clearTimeout(to); }
  }
  // 익명 로그인: 저장된 토큰이 살아 있으면 그대로, 만료면 갱신, 없으면 새로
  async function token() {
    let a = store.get(AUTH_KEY, null);
    if (a && a.id && a.exp > Date.now() + 60000) return a;
    if (a && a.rt) {
      try {
        const r = await req(`${CFG.token}/token?key=${CFG.apiKey}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(a.rt)}` });
        a = { uid: r.user_id, id: r.id_token, rt: r.refresh_token, exp: Date.now() + (+r.expires_in || 3600) * 1000 };
        store.set(AUTH_KEY, a); return a;
      } catch (e) { /* 갱신 실패 → 새로 */ }
    }
    const r = await req(`${CFG.auth}/accounts:signUp?key=${CFG.apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }) });
    a = { uid: r.localId, id: r.idToken, rt: r.refreshToken, exp: Date.now() + (+r.expiresIn || 3600) * 1000 };
    store.set(AUTH_KEY, a); return a;
  }
  const myUid = () => (store.get(AUTH_KEY, null) || {}).uid || "";

  // 순위표 읽기(공개). 30초 캐시
  const cache = {};
  async function board(game, kind) {
    const g = GAMES[game], path = kind === "week" ? `pt/board/${game}/week/${weekKey()}` : `pt/board/${game}/all`;
    const c = cache[path]; if (c && Date.now() - c.t < 30000) return c.rows;
    const q = `orderBy=${encodeURIComponent('"s"')}&${g.dir === "desc" ? "limitToLast" : "limitToFirst"}=10`;
    const obj = (await req(`${CFG.db}/${path}.json?${NSQ}${q}`)) || {};
    const rows = Object.entries(obj).map(([uid, v]) => ({ uid, n: v && v.n, s: v && v.s, ts: v && v.ts })).filter((r) => typeof r.s === "number")
      .sort((x, y) => (g.dir === "desc" ? y.s - x.s : x.s - y.s) || x.ts - y.ts).slice(0, 10);
    cache[path] = { t: Date.now(), rows }; return rows;
  }
  const better = (game, a, b) => (b == null ? true : GAMES[game].dir === "desc" ? a > b : a < b);
  const fits = (game, rows, s) => rows.length < 10 || better(game, s, rows[rows.length - 1].s);

  function listHtml(game, rows, label) {
    const g = GAMES[game], me = myUid();
    if (!rows.length) return `<p class="rank-empty">${label} 기록이 아직 없어요. 첫 기록의 주인공이 되어 보세요!</p>`;
    return `<ol class="rank-list">${rows.map((r, i) => `<li class="${r.uid === me ? "me" : ""}"><b class="rk">${i + 1}</b><span class="nm">${esc(r.n || "익명")}${r.uid === me ? " <em>나</em>" : ""}</span><span class="sc">${esc(g.fmt(r.s))}</span></li>`).join("")}</ol>`;
  }
  // 순위표 그리기: 이번 주 / 역대 탭
  async function render(el, game, prefer) {
    const g = GAMES[game]; if (!g || !el) return;
    const kinds = g.week ? ["week", "all"] : ["all"];
    let kind = el.dataset.kind || prefer || kinds[0];
    el.classList.add("rank-board");
    el.innerHTML = `<div class="rank-head"><b>${esc(g.name)} 순위</b>${kinds.length > 1 ? `<span class="rank-tabs" role="tablist">${kinds.map((k) => `<button type="button" role="tab" data-kind="${k}" aria-selected="${k === kind}">${k === "week" ? "이번 주" : "역대"}</button>`).join("")}</span>` : `<small>역대 TOP10</small>`}</div><div class="rank-body"><p class="rank-empty">불러오는 중…</p></div>`;
    el.querySelectorAll("[data-kind]").forEach((b) => b.addEventListener("click", () => { el.dataset.kind = b.dataset.kind; render(el, game); }));
    try {
      const rows = await board(game, kind);
      el.querySelector(".rank-body").innerHTML = listHtml(game, rows, kind === "week" ? "이번 주" : "역대");
      el.dataset.state = "ok";
    } catch (e) {
      el.querySelector(".rank-body").innerHTML = `<p class="rank-empty">순위표를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.</p>`;
      el.dataset.state = "error";
    }
  }
  // 기록 올리기: 더 좋은 기록일 때만, 같은 요청에서 last/uid(쓰기 간격 10초 제한)도 함께
  async function submit(game, s, nick) {
    const g = GAMES[game], a = await token(), wk = weekKey();
    const mine = store.get(MINE_KEY, {}), m = mine[game] || {};
    const ent = { n: nick, s, ts: { ".sv": "timestamp" } }, up = {};
    if (better(game, s, m.all)) up[`board/${game}/all/${a.uid}`] = ent;
    if (g.week && better(game, s, m.week && m.week[wk])) up[`board/${game}/week/${wk}/${a.uid}`] = ent;
    if (!Object.keys(up).length) return false;
    up[`last/${a.uid}`] = { ".sv": "timestamp" };
    await req(`${CFG.db}/pt.json?${NSQ}auth=${encodeURIComponent(a.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(up) });
    if (up[`board/${game}/all/${a.uid}`]) m.all = s;
    if (up[`board/${game}/week/${wk}/${a.uid}`]) m.week = { [wk]: s };
    mine[game] = m; store.set(MINE_KEY, mine);
    Object.keys(cache).forEach((k) => delete cache[k]);
    return true;
  }
  // 결과 화면에서 부름: TOP10 안이면 (처음 한 번) 닉네임을 받고 등록, 이미 등록한 기기는 더 좋은 기록일 때 자동 갱신
  async function report(game, s, el) {
    const g = GAMES[game]; if (!g || !el) return;
    s = Math.round(s);
    el.classList.add("rank-board"); el.innerHTML = `<p class="rank-empty">순위 확인 중…</p>`;
    if (!g.ok(s)) { await render(el, game); if (g.low) el.insertAdjacentHTML("afterbegin", `<p class="rank-note">${esc(g.low)}</p>`); return; }
    let rowsW = [], rowsA = [];
    try { rowsA = await board(game, "all"); if (g.week) rowsW = await board(game, "week"); }
    catch (e) { el.innerHTML = `<p class="rank-empty">순위표를 불러오지 못했어요. 잠시 후 다시 확인해 주세요. (기록은 이 기기에만 남아요)</p>`; el.dataset.state = "error"; return; }
    const m = store.get(MINE_KEY, {})[game] || {}, wk = weekKey();
    const inAll = fits(game, rowsA, s) && better(game, s, m.all), inWeek = g.week && fits(game, rowsW, s) && better(game, s, m.week && m.week[wk]);
    const prefer = inWeek && !inAll ? "week" : g.week ? "week" : "all";
    if (!inAll && !inWeek) return render(el, game, prefer);
    const nick = store.get(NICK_KEY, "");
    const done = async (n) => {
      try { await submit(game, s, n); await render(el, game, prefer); el.insertAdjacentHTML("afterbegin", `<p class="rank-note ok">${inAll ? "역대" : "이번 주"} TOP10에 올렸어요!</p>`); el.dataset.state = "saved"; }
      catch (e) { await render(el, game, prefer); el.insertAdjacentHTML("afterbegin", `<p class="rank-note">기록을 올리지 못했어요. 잠시 후 다시 해 주세요.${e && e.status === 401 ? "" : ""}</p>`); el.dataset.state = "error"; }
    };
    if (nick) return done(nick);
    el.innerHTML = `<form class="rank-form" autocomplete="off"><p><b>${inAll ? "역대" : "이번 주"} TOP10 안에 들었어요!</b> ${esc(g.fmt(s))}</p>
<label>닉네임(1~10자, 비우면 「익명」)<input name="n" maxlength="10" placeholder="익명"></label>
<p class="rank-hint">닉네임은 한 번만 정하고, 다음부터는 더 좋은 기록이 나오면 자동으로 바뀌어요. 이름·연락처 같은 개인정보는 적지 마세요.</p>
<p class="rank-err" hidden></p>
<div class="rank-btns"><button type="submit" class="btn">순위에 올리기</button><button type="button" class="btn ghost" data-skip>올리지 않기</button></div></form>`;
    const f = el.querySelector("form"), err = el.querySelector(".rank-err");
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const n = cleanNick(f.n.value) || "익명";
      if (badNick(n)) { err.hidden = false; err.textContent = "쓸 수 없는 말이 들어 있어요. 다른 닉네임을 적어 주세요."; return; }
      store.set(NICK_KEY, n);
      f.querySelector("[type=submit]").disabled = true;
      done(n);
    });
    f.querySelector("[data-skip]").addEventListener("click", () => render(el, game, prefer));
  }
  // 게임 페이지 하단의 순위표: <section data-rank-game="stack">
  function mountAll() { document.querySelectorAll("[data-rank-game]").forEach((el) => render(el, el.dataset.rankGame)); }
  window.PT_RANK = { report, render, score: SCORE, weekKey, games: GAMES, _badNick: badNick };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll); else mountAll();
})();
