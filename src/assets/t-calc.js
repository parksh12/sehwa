// 만 나이 계산 + 평수 계산 (파일 없음). 입력은 저장하지 않습니다.
(function () {
  const fmt = (n, d = 0) => Number(n).toLocaleString("ko-KR", { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const toast = (m) => (window.NALGI && NALGI.toast ? NALGI.toast(m) : null);
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok; }
  };
  const pad = (n) => String(n).padStart(2, "0");
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const parse = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); if (!m) return null; const y = +m[1], mo = +m[2], d = +m[3]; const t = new Date(Date.UTC(y, mo - 1, d)); return t.getUTCDate() === d ? { y, m: mo, d, t: t.getTime() } : null; };
  const DAY = 86400000;
  const W = ["일", "월", "화", "수", "목", "금", "토"];
  const label = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${W[d.getUTCDay()]})`; };
  const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  // 그해의 생일(UTC ms). 2월 29일생은 평년에 3월 1일로 봄
  const bdayIn = (b, y) => (b.m === 2 && b.d === 29 && !leap(y) ? Date.UTC(y, 2, 1) : Date.UTC(y, b.m - 1, b.d));

  // ---------- 만 나이 ----------
  const ag = document.querySelector('[data-tool="age"]');
  if (ag) {
    const bi = ag.querySelector('[name="birth"]'), bs = ag.querySelector('[name="base"]');
    if (!bs.value) bs.value = todayStr();
    const res = ag.querySelector(".age-result");
    let lastText = "";
    const calc = () => {
      const b = parse(bi.value), s = parse(bs.value);
      lastText = "";
      if (!b) { res.innerHTML = '<p class="hint">생년월일을 넣어 주세요.</p>'; return; }
      if (!s) { res.innerHTML = '<p class="hint">기준일을 넣어 주세요.</p>'; return; }
      if (b.t > s.t) { res.innerHTML = '<p class="tk-msg">생년월일이 기준일보다 늦어요. 날짜를 확인해 주세요.</p>'; return; }
      let age = s.y - b.y;
      if (s.t < bdayIn(b, s.y)) age -= 1;
      // 마지막 생일부터 개월·일
      const lastB = bdayIn(b, b.y + age);
      const lb = new Date(lastB);
      let months = (s.y - lb.getUTCFullYear()) * 12 + (s.m - 1 - lb.getUTCMonth());
      if (s.d < lb.getUTCDate()) months -= 1;
      const mAnchor = Date.UTC(lb.getUTCFullYear(), lb.getUTCMonth() + months, Math.min(lb.getUTCDate(), new Date(Date.UTC(lb.getUTCFullYear(), lb.getUTCMonth() + months + 1, 0)).getUTCDate()));
      const days = Math.round((s.t - mAnchor) / DAY);
      const yearAge = s.y - b.y;
      let next = bdayIn(b, s.y); if (next <= s.t) next = bdayIn(b, s.y + 1);
      const left = Math.round((next - s.t) / DAY);
      const isToday = bdayIn(b, s.y) === s.t;
      const lived = Math.round((s.t - b.t) / DAY);
      res.innerHTML = `<div class="age-big"><span>만</span> <b>${fmt(age)}</b><span>세</span></div>
<p class="hint">${fmt(age)}년 ${fmt(months)}개월 ${fmt(days)}일 · 태어난 날부터 ${fmt(lived)}일째${isToday ? " · <b>오늘이 생일이에요</b>" : ""}</p>
<dl class="cc-stats age-stats">
  <div class="main"><dt>만 나이</dt><dd><b>${fmt(age)}</b>세</dd></div>
  <div><dt>연 나이 (기준 연도 − 출생 연도)</dt><dd><b>${fmt(yearAge)}</b>세</dd></div>
  <div><dt>세는 나이 (한국식)</dt><dd><b>${fmt(yearAge + 1)}</b>세</dd></div>
  <div><dt>다음 생일까지</dt><dd><b>${fmt(left)}</b>일</dd></div>
</dl>
<p>다음 생일은 <b>${label(next)}</b>이고, 그날 만 <b>${fmt(age + 1)}세</b>가 돼요.${b.m === 2 && b.d === 29 ? " 2월 29일생이라 평년에는 3월 1일을 생일로 보고 계산했어요." : ""}</p>`;
      lastText = `만 ${age}세 (연 나이 ${yearAge}세, 세는 나이 ${yearAge + 1}세) · ${label(s.t)} 기준 · 다음 생일까지 ${left}일`;
    };
    ag.querySelector("form").addEventListener("submit", (e) => e.preventDefault());
    [bi, bs].forEach((el) => el.addEventListener("input", calc));
    ag.querySelector("[data-today]").addEventListener("click", () => { bs.value = todayStr(); calc(); });
    ag.querySelector("[data-copy]").addEventListener("click", async () => {
      if (!lastText) { toast("생년월일을 먼저 넣어 주세요"); return; }
      toast((await copy(lastText)) ? "결과를 복사했어요" : "복사에 실패했어요");
    });
    calc();
  }

  // ---------- 평수 ----------
  const py = document.querySelector('[data-tool="pyeong"]');
  if (py) {
    const R = 400 / 121; // 1평 = 400/121 ㎡ ≈ 3.3058㎡
    const m2 = py.querySelector('[name="m2"]'), pg = py.querySelector('[name="py"]');
    const out = py.querySelector(".py-result");
    const num = (v) => { const n = parseFloat(String(v).replace(/,/g, "")); return isFinite(n) && n >= 0 ? n : null; };
    const show = (a, p) => {
      out.innerHTML = a == null ? '<p class="hint">면적을 넣으면 바로 바뀌어요.</p>'
        : `<div class="age-big"><b>${fmt(a, 2)}</b><span>㎡</span> <span class="eq">=</span> <b>${fmt(p, 2)}</b><span>평</span></div>`;
    };
    m2.addEventListener("input", () => { const a = num(m2.value); if (a == null) { pg.value = ""; show(null); return; } const p = a / R; pg.value = +p.toFixed(2); show(a, p); });
    pg.addEventListener("input", () => { const p = num(pg.value); if (p == null) { m2.value = ""; show(null); return; } const a = p * R; m2.value = +a.toFixed(2); show(a, p); });
    py.querySelector("form").addEventListener("submit", (e) => e.preventDefault());
    py.querySelectorAll("[data-m2]").forEach((b) => b.addEventListener("click", () => { m2.value = b.dataset.m2; m2.dispatchEvent(new Event("input")); m2.focus(); }));
    py.querySelector("[data-copy]").addEventListener("click", async () => {
      const a = num(m2.value), p = num(pg.value);
      if (a == null) { toast("면적을 먼저 넣어 주세요"); return; }
      toast((await copy(`${fmt(a, 2)}㎡ = ${fmt(p, 2)}평 (1평 = 400/121㎡ ≈ 3.3058㎡)`)) ? "결과를 복사했어요" : "복사에 실패했어요");
    });
    show(null);
  }
})();
