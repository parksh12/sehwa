(function () {
  const form = document.getElementById("fortune-form");
  const out = document.getElementById("fortune-result");
  const N = NALGI.data.names, esc = NALGI.esc, U = NALGI.url;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const y = +form.y.value, m = +form.m.value || 0, d = +form.d.value || 0;
    if (!y) return NALGI.toast("태어난 해를 골라 주세요");
    if (m && d && !NALGI.validDate(y, m, d)) return NALGI.toast(`${m}월에는 ${d}일이 없어요`);
    const k = NALGI.ttiOf(y, m || 6, d || 1);
    if (!m && y) {
      const prev = NALGI.ttiOf(y, 1, 1);
      out.innerHTML = `<p>${y}년생은 대부분 <strong>${esc(N[k])}</strong>예요. 다만 1월~2월 초(입춘 전)에 태어났다면 <strong>${esc(N[prev])}</strong>일 수 있어요.</p>
<div class="result-grid"><a class="btn" href="${U(`/luck/2027/${k}/`)}">${esc(N[k])} 운세 보기</a><a class="btn ghost" href="${U(`/luck/2027/${prev}/`)}">${esc(N[prev])} 운세 보기</a></div>`;
      out.hidden = false; return;
    }
    const near = NALGI.nearIpchun(m, d);
    if (near) {
      out.innerHTML = `<p>2월 3~5일생은 그해 입춘 시각에 따라 띠가 달라질 수 있어요. 2월 4일 기준으로는 <strong>${esc(N[k])}</strong>예요.</p><a class="btn big" href="${U(`/luck/2027/${k}/`)}">${esc(N[k])} 2027 운세 보기 →</a>`;
      out.hidden = false; return;
    }
    location.href = U(`/luck/2027/${k}/`);
  });
})();
