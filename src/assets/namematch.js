// P2-49 공유 주소 /love/name-match/ → /fun/name-match/
(function () {
  const form = document.getElementById("name-form");
  const out = document.getElementById("name-result");
  const D = NALGI.data, esc = NALGI.esc;
  // 획수표 (초성 19 / 중성 21 / 종성 28)
  const CHO = [1, 2, 1, 2, 4, 3, 3, 4, 8, 2, 4, 1, 3, 6, 4, 2, 3, 4, 3];
  const JUNG = [2, 3, 3, 4, 2, 3, 3, 4, 2, 4, 5, 3, 3, 2, 4, 5, 3, 3, 1, 2, 1];
  const JONG = [0, 1, 2, 3, 1, 4, 4, 2, 3, 4, 6, 7, 5, 6, 7, 6, 3, 4, 6, 2, 4, 1, 3, 4, 2, 3, 4, 3];
  const strokes = (ch) => { const c = ch.charCodeAt(0) - 0xac00; return CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + JONG[c % 28]; };
  const isHangul = (s) => /^[가-힣]{1,5}$/.test(s);
  const ELEM = { aries: "불", leo: "불", sagittarius: "불", taurus: "흙", virgo: "흙", capricorn: "흙", gemini: "공기", libra: "공기", aquarius: "공기", cancer: "물", scorpio: "물", pisces: "물" };
  const ORDER = ["불", "흙", "공기", "물"];
  const parseMD = (s) => { if (!/^\d{4}$/.test(s || "")) return null; const m = +s.slice(0, 2), d = +s.slice(2); return NALGI.validDate(2000, m, d) ? [m, d] : null; };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const a = form.a.value.trim(), b = form.b.value.trim();
    if (!isHangul(a) || !isHangul(b)) return NALGI.toast("이름은 완성된 한글 1~5글자로 넣어 주세요");
    // 번갈아 배치, 남는 글자는 뒤에 이어 붙임
    const letters = [];
    for (let k = 0; k < Math.max(a.length, b.length); k++) { if (a[k]) letters.push(a[k]); if (b[k]) letters.push(b[k]); }
    let row = letters.map(strokes);
    const rows = [row];
    while (row.length > 2) { const nx = []; for (let k = 0; k < row.length - 1; k++) nx.push((row[k] + row[k + 1]) % 10); row = nx; rows.push(row); }
    const score = row[0] * 10 + row[1];
    const band = D.bands.slice().sort((x, y) => y.min - x.min).find((x) => score >= x.min) || D.bands[D.bands.length - 1];
    // 별자리 원소(선택)
    let elemHtml = "";
    const ad = parseMD(form.ad.value.trim()), bd = parseMD(form.bd.value.trim());
    if (form.ad.value || form.bd.value) {
      if (ad && bd) {
        const ea = ELEM[NALGI.zodiacOf(ad[0], ad[1])], eb = ELEM[NALGI.zodiacOf(bd[0], bd[1])];
        const key = [ea, eb].sort((x, y) => ORDER.indexOf(x) - ORDER.indexOf(y)).join("-");
        elemHtml = `<div class="stat" style="margin-top:12px"><span>별자리 원소 조합</span><b>${ea} × ${eb}</b><span>${esc(D.elements[key] || "")}</span></div>`;
      } else elemHtml = `<p class="hint">생일은 월·일 4자리(예: 0315)로 넣어 주세요.</p>`;
    }
    out.innerHTML = `
<div class="result-card" data-card-title="이름 궁합 결과" data-card-main="두 사람의 궁합 ${score}%" data-card-sub="${esc(band.title)}">
  <div class="rc-emoji">💞</div>
  <div class="rc-score">${score}%</div>
  <div class="rc-main" style="font-size:22px;margin-top:6px">${esc(band.title)}</div>
  <p>${esc(band.text)}</p>
</div>
<div class="pyramid" aria-label="획수 계산 과정">
  <div class="letters">${letters.map(esc).join(" ")}</div>
  ${rows.map((r) => `<div>${r.join(" ")}</div>`).join("")}
</div>
<p class="hint center">이름 순서를 바꾸면 점수가 달라질 수 있어요. 대화 성향을 참고하는 재미용 결과예요.</p>
${elemHtml}
${NALGI.shareBar({ title: "이름 궁합 테스트", text: `우리 이름 궁합은 ${score}%! 너도 해 봐`, path: "/fun/name-match/" })}`;
    out.hidden = false;
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
