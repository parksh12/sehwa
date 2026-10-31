(function () {
  const form = document.getElementById("birthday-form");
  const out = document.getElementById("birthday-result");
  const D = NALGI.data, esc = NALGI.esc, U = NALGI.url;
  const DAY = 86400000;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const y = +form.y.value, m = +form.m.value, d = +form.d.value;
    if (!y || !m || !d) return NALGI.toast("생년월일을 모두 골라 주세요");
    if (!NALGI.validDate(y, m, d)) return NALGI.toast(`${m}월에는 ${d}일이 없어요`);
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const birth = new Date(y, m - 1, d);
    if (birth > today) return NALGI.toast("미래 날짜는 계산할 수 없어요");
    // 만 나이
    let age = today.getFullYear() - y;
    if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
    const yearAge = today.getFullYear() - y;
    // 다음 생일 (2월 29일생은 평년에 2월 28일로 계산)
    const bdayIn = (yr) => (m === 2 && d === 29 && !NALGI.validDate(yr, 2, 29) ? new Date(yr, 1, 28) : new Date(yr, m - 1, d));
    let next = bdayIn(today.getFullYear()); if (next < today) next = bdayIn(today.getFullYear() + 1);
    const dday = Math.round((next - today) / DAY);
    const lived = Math.round((today - birth) / DAY) + 1;
    const tk = NALGI.ttiOf(y, m, d), zk = NALGI.zodiacOf(m, d);
    const t = D.tti[tk], z = D.zodiac[zk];
    const ipchun = NALGI.nearIpchun(m, d) ? `<p class="hint">⚠ 2월 3~5일생은 태어난 해의 입춘 날짜·시각에 따라 띠가 ${esc(D.tti[NALGI.ttiOf(y, 3, 1)].name)} 또는 ${esc(D.tti[NALGI.ttiOf(y, 1, 1)].name)}일 수 있어요. 여기서는 2월 4일을 기준으로 계산했어요.</p>` : "";
    out.innerHTML = `
<div class="result-card" data-card-title="생일로 보는 나" data-card-main="${esc(t.name)} · ${esc(z.name)}" data-card-sub="${esc(t.summary)}">
  <div class="rc-emoji">${t.emoji} ${z.symbol}</div>
  <div class="rc-main">${esc(t.name)} · ${esc(z.name)}</div>
  <p>${esc(t.summary)}</p>
  <dl class="rc-meta">
    <div><dt>만 나이</dt><dd>${age}세</dd></div>
    <div><dt>연 나이</dt><dd>${yearAge}세</dd></div>
    <div><dt>다음 생일</dt><dd>${dday === 0 ? "오늘! 🎉" : "D-" + dday}</dd></div>
  </dl>
</div>
${ipchun}
<div class="result-grid">
  <div class="stat"><span>나의 띠</span><b>${t.emoji} ${esc(t.name)} (${esc(t.hanja)})</b><a href="${U(`/me/tti/${tk}/`)}">띠 성격 보기 →</a></div>
  <div class="stat"><span>나의 별자리</span><b>${z.symbol} ${esc(z.name)}</b><a href="${U(`/me/zodiac/${zk}/`)}">별자리 성향 보기 →</a></div>
  <div class="stat"><span>태어난 지</span><b>${lived.toLocaleString()}일째</b><span>${lived >= 10000 ? "1만 일을 넘겼어요!" : `1만 일까지 ${(10000 - lived).toLocaleString()}일`}</span></div>
  <div class="stat"><span>${esc(t.name)}의 2027년</span><b>정미년 운세</b><a href="${U(`/luck/2027/${tk}/`)}">2027 운세 보기 →</a></div>
</div>
${NALGI.shareBar({ title: "생일로 보는 나 — 만 나이·띠·별자리", text: "생일만 넣으면 만 나이, 띠, 별자리를 한 번에!", path: "/me/birthday/" })}`;
    out.hidden = false;
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
