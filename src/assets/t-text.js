// 글자수 세기 + D-day 계산 (파일 없음). 입력은 저장하지 않습니다.
(function () {
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok; }
  };
  const toast = (m) => (window.NALGI && NALGI.toast ? NALGI.toast(m) : null);
  const fmt = (n) => n.toLocaleString("ko-KR");

  // ---------- 글자수 세기 ----------
  const cc = document.querySelector('[data-tool="charcount"]');
  if (cc) {
    const ta = cc.querySelector("textarea");
    const out = (k, v) => { const el = cc.querySelector(`[data-out="${k}"]`); if (el) el.textContent = fmt(v); };
    const seg = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("ko", { granularity: "grapheme" }) : null;
    const graphemes = (s) => (seg ? [...seg.segment(s)].length : [...s].length);
    const enc = new TextEncoder();
    let last = {};
    const calc = () => {
      const s = ta.value.replace(/\r\n?/g, "\n");
      const all = graphemes(s);
      const noSpace = graphemes(s.replace(/\s+/g, ""));
      let kr2 = 0;
      for (const ch of s) kr2 += ch.codePointAt(0) <= 0x7f ? 1 : 2;
      const utf8 = enc.encode(s).length;
      const lines = s ? s.split("\n").length : 0;
      const paras = s.split(/\n\s*\n/).filter((p) => p.trim()).length;
      const words = (s.match(/\S+/g) || []).length;
      last = { all, noSpace, kr2, utf8, lines, paras, words };
      Object.entries(last).forEach(([k, v]) => out(k, v));
      const lim = Number(cc.querySelector('[name="limit"]').value) || 0;
      const bar = cc.querySelector(".cc-limit");
      if (lim > 0) {
        bar.hidden = false;
        const left = lim - all;
        bar.textContent = left >= 0 ? `목표 ${fmt(lim)}자까지 ${fmt(left)}자 남았어요 (공백 포함 기준)` : `목표 ${fmt(lim)}자보다 ${fmt(-left)}자 많아요 (공백 포함 기준)`;
        bar.classList.toggle("over", left < 0);
      } else bar.hidden = true;
    };
    ta.addEventListener("input", calc);
    cc.querySelector('[name="limit"]').addEventListener("input", calc);
    cc.querySelector("[data-clear]").addEventListener("click", () => { ta.value = ""; calc(); ta.focus(); });
    cc.querySelector("[data-copy]").addEventListener("click", async () => {
      const t = `글자수(공백 포함) ${fmt(last.all)}자 / 공백 제외 ${fmt(last.noSpace)}자 / 한글 2바이트 기준 ${fmt(last.kr2)}바이트 / UTF-8 ${fmt(last.utf8)}바이트 / ${fmt(last.lines)}줄 / ${fmt(last.paras)}단락`;
      toast((await copy(t)) ? "결과를 복사했어요" : "복사에 실패했어요");
    });
    calc();
  }

  // ---------- D-day ----------
  const dd = document.querySelector('[data-tool="dday"]');
  if (dd) {
    const DAY = 86400000;
    const pad = (n) => String(n).padStart(2, "0");
    const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const toUTC = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); if (!m) return NaN; const t = Date.UTC(+m[1], +m[2] - 1, +m[3]); const d = new Date(t); return d.getUTCDate() === +m[3] ? t : NaN; };
    const W = ["일", "월", "화", "수", "목", "금", "토"];
    const label = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${W[d.getUTCDay()]})`; };
    const dlabel = (n) => (n > 0 ? `D-${fmt(n)}` : n === 0 ? "D-DAY" : `D+${fmt(-n)}`);
    const addYears = (t, y) => { const d = new Date(t); const r = Date.UTC(d.getUTCFullYear() + y, d.getUTCMonth(), d.getUTCDate()); return new Date(r).getUTCDate() === d.getUTCDate() ? r : Date.UTC(d.getUTCFullYear() + y, d.getUTCMonth() + 1, 0); };
    const a = dd.querySelector('[name="from"]'), b = dd.querySelector('[name="to"]'), one = dd.querySelector('[name="countone"]');
    if (!a.value) a.value = todayStr();
    const res = dd.querySelector(".dd-result"), annBox = dd.querySelector(".dd-ann");
    let lastText = "";
    const calc = () => {
      const ta = toUTC(a.value), tb = toUTC(b.value), now = toUTC(todayStr());
      if (isNaN(ta)) { res.innerHTML = '<p class="hint">기준일을 넣어 주세요.</p>'; annBox.innerHTML = ""; return; }
      const plus = one.checked ? 1 : 0;
      let html = "";
      if (!isNaN(tb)) {
        const diff = Math.round((tb - ta) / DAY);
        const days = Math.abs(diff) + plus;
        html += `<div class="dd-big">${dlabel(diff)}</div><p><b>${label(ta)}</b>부터 <b>${label(tb)}</b>까지 ${diff >= 0 ? "" : "거꾸로 "}<b>${fmt(Math.abs(diff))}일</b>${one.checked ? ` (시작일을 1일로 세면 <b>${fmt(days)}일째</b>)` : ""}</p>`;
        lastText = `${label(tb)}: ${dlabel(diff)} (${label(ta)} 기준 ${fmt(Math.abs(diff))}일${one.checked ? `, 1일부터 세면 ${fmt(days)}일째` : ""})`;
      } else {
        html += `<p class="hint">목표일을 넣으면 D-day가 나와요. 아래는 기준일을 시작일로 본 기념일이에요.</p>`;
        lastText = "";
      }
      if (!isNaN(now) && now !== ta) {
        const since = Math.round((now - ta) / DAY);
        html += `<p class="hint">오늘은 기준일로부터 ${since >= 0 ? `${fmt(since + plus)}일${one.checked ? "째" : " 지났어요"}` : `${fmt(-since)}일 전이에요`}.</p>`;
      }
      res.innerHTML = html;
      // 기념일 목록: 기준일을 시작일로
      const rows = [];
      [100, 200, 300, 365, 500, 1000, 1500, 2000, 3000, 5000, 10000].forEach((n) => { if (n !== 365) rows.push([`${fmt(n)}일`, ta + (n - plus) * DAY]); });
      [1, 2, 3, 5, 10, 20].forEach((y) => rows.push([`${y}주년`, addYears(ta, y)]));
      rows.sort((x, y) => x[1] - y[1]);
      annBox.innerHTML = `<table class="dd-table"><thead><tr><th scope="col">기념일</th><th scope="col">날짜</th><th scope="col">오늘 기준</th></tr></thead><tbody>${rows.map(([n, t]) => `<tr${!isNaN(now) && t === now ? ' class="on"' : ""}><th scope="row">${n}</th><td>${label(t)}</td><td>${isNaN(now) ? "" : dlabel(Math.round((t - now) / DAY))}</td></tr>`).join("")}</tbody></table><p class="hint">${one.checked ? "시작일을 1일째로 셌어요(연애·육아 기념일 방식)." : "시작일 다음 날을 1일로 셌어요. 시작일을 1일째로 세려면 위의 「시작일을 1일로 세기」를 켜세요."} 주년은 같은 월·일 기준이에요.</p>`;
    };
    dd.querySelector("form").addEventListener("submit", (e) => e.preventDefault()); // 엔터로 페이지가 다시 열리며 날짜가 주소에 붙지 않게
    [a, b, one].forEach((el) => el.addEventListener("input", calc));
    one.addEventListener("change", calc);
    dd.querySelector("[data-today]").addEventListener("click", () => { a.value = todayStr(); calc(); });
    dd.querySelector("[data-copy]").addEventListener("click", async () => {
      if (!lastText) { toast("목표일을 먼저 넣어 주세요"); return; }
      toast((await copy(lastText)) ? "결과를 복사했어요" : "복사에 실패했어요");
    });
    calc();
  }
})();
