// 사주팔자 화면 (P2-22) · P2-49 공유 주소 /fun/saju/ — 계산은 saju-calc.js, 문장은 saju-read.js. 입력값은 저장·전송하지 않고 주소에도 넣지 않습니다.
(function () {
  const form = document.getElementById("saju-form");
  const out = document.getElementById("saju-result");
  if (!form || !out || !window.SAJU || !window.SAJU_READ) return;
  const S = window.SAJU, R = window.SAJU_READ;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CITIES = (window.NALGI && NALGI.data && NALGI.data.cities) || [];
  const EL_CLS = ["e0", "e1", "e2", "e3", "e4"];
  const two = (n) => String(n).padStart(2, "0");
  const kst = (ms) => { const d = new Date(ms + 9 * 3600000); return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`; };
  const offTxt = (o) => { const h = Math.floor(o / 60), m = Math.round(o - h * 60); return `UTC+${h}${m ? ":" + two(m) : ""}`; };
  const stars = (n) => `<span class="sj-stars" aria-label="5점 중 ${n}점">${"★".repeat(n)}${"☆".repeat(5 - n)}</span>`;
  const thisYear = () => new Date(Date.now() + 9 * 3600000).getUTCFullYear();

  // 양력/음력 전환 시 윤달 칸 켜고 끄기, 시각 모름이면 분·자시 옵션 끄기
  const sync = () => {
    const lunar = form.cal.value === "lunar";
    form.leap.disabled = !lunar; if (!lunar) form.leap.checked = false;
    form.querySelector(".sj-leap").classList.toggle("off", !lunar);
    const unknown = form.hh.value === "";
    form.mi.disabled = unknown;
  };
  form.addEventListener("change", sync);
  sync();

  function msg(text) { out.hidden = false; out.innerHTML = `<p class="tk-msg" role="alert">${esc(text)}</p>`; }

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const f = form;
    const y = +f.y.value, m = +f.m.value, d = +f.d.value;
    if (!y || !m || !d) return msg("생년월일을 모두 골라 주세요.");
    if (!f.gender.value) return msg("성별을 골라 주세요. 대운이 흐르는 방향을 정할 때만 써요.");
    const city = CITIES.find((c) => c.k === f.place.value);
    const time = f.hh.value === "" ? null : { h: +f.hh.value, mi: +f.mi.value || 0 };
    const input = { calendar: f.cal.value, y, m, d, leap: f.leap.checked, time, gender: f.gender.value, lon: city ? city.lon : null, eot: f.eot.checked, jasi: f.jasi.value };
    const res = S.calc(input);
    if (res.error) {
      const e = res.error, dt = res.detail || {};
      return msg(e === "noleap" ? `${y}년 음력에는 ${m}월 윤달이 없어요.${dt.leapMonth ? ` 이해의 윤달은 ${dt.leapMonth}월이에요.` : " 이해에는 윤달이 없어요."}` : e === "day" ? `그달은 ${dt.len}일까지 있어요.` : e === "range" ? "음력은 1900년 1월부터 2050년 11월까지 계산할 수 있어요." : "없는 날짜예요. 다시 확인해 주세요.");
    }
    render(res, city);
    out.hidden = false;
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function table(res) {
    const order = [3, 2, 1, 0]; // 시 일 월 연
    const names = ["연주", "월주", "일주", "시주"];
    const P = res.pillars;
    const head = order.map((i) => `<th scope="col">${names[i]}${i === 2 ? " <small>(나)</small>" : ""}</th>`).join("");
    const row = (label, fn, cls = "") => `<tr class="${cls}"><th scope="row">${label}</th>${order.map((i) => (P[i] ? `<td>${fn(P[i], i)}</td>` : `<td class="sj-none">—</td>`)).join("")}</tr>`;
    return `<div class="table-wrap"><table class="sj-table">
<caption class="sr">만세력 — 시주, 일주, 월주, 연주 순서</caption>
<thead><tr><th scope="col"><span class="sr">구분</span></th>${head}</tr></thead>
<tbody>
${row("십신", (p) => esc(p.stemGod.name), "sj-god")}
${row("천간", (p) => `<span class="sj-char ${EL_CLS[p.stemEl]}"><b>${p.name[0]}</b><small>${S.STEM_K[p.s]} · ${S.EL_K[p.stemEl]}</small></span>`, "sj-chars")}
${row("지지", (p) => `<span class="sj-char ${EL_CLS[p.brEl]}"><b>${p.name[1]}</b><small>${S.BR_K[p.b]} · ${S.EL_K[p.brEl]}</small></span>`, "sj-chars")}
${row("십신", (p) => esc(p.brGod.name), "sj-god")}
${row("지장간", (p) => p.hidden.map((h, k) => (h ? `<span class="${k === 2 ? "main" : ""}">${h.h}</span>` : "")).join(""), "sj-hidden")}
${row("12운성", (p) => esc(p.stage), "sj-stage")}
</tbody></table></div>
${res.notKnownTime ? '<p class="hint">출생 시각을 모르면 시주를 빼고 여섯 글자로 계산해요. 오행 분포와 신강 점수도 여섯 글자 기준이에요.</p>' : ""}`;
  }
  function elementsBar(res) {
    const e = res.elements, tot = e.reduce((a, b) => a + b, 0);
    return `<ul class="sj-bars">${e.map((v, i) => `<li><span class="sj-bl">${S.EL_K[i]}<small>${S.EL_H[i]}</small></span><span class="sj-bt"><i class="${EL_CLS[i]}" style="width:${(v / tot) * 100}%"></i></span><b>${v}</b></li>`).join("")}</ul>`;
  }
  function groupsBar(res) {
    const g = res.groups, tot = g.reduce((a, b) => a + b, 0) || 1;
    return `<ul class="sj-bars sj-gbars">${g.map((v, i) => `<li><span class="sj-bl">${R.GROUP[i]}</span><span class="sj-bt"><i style="width:${(v / tot) * 100}%"></i></span><b>${v}</b></li>`).join("")}</ul>`;
  }
  function basisBox(res, city) {
    const i = res.input, li = res.input.lunar;
    const rows = [];
    rows.push(["입력", `${i.calendar === "lunar" ? `음력 ${i.y}년 ${i.leap ? "윤" : ""}${i.m}월 ${i.d}일 → 양력 ${res.input.solar.y}-${two(res.input.solar.m)}-${two(res.input.solar.d)}` : `양력 ${i.y}-${two(i.m)}-${two(i.d)}${li ? ` (음력 ${li.y}년 ${li.leap ? "윤" : ""}${li.m}월 ${li.d}일)` : ""}`}${i.time ? ` ${two(i.time.h)}:${two(i.time.mi)}` : ", 시각 모름"}`]);
    if (i.time) rows.push(["당시 시계", `${offTxt(res.offset)}${res.dst ? " (서머타임 중 → 1시간 빼서 계산)" : ""}${res.status === "gap" ? " · 시계를 앞당긴 날이라 실제로는 없던 시각이에요. 바뀌기 전 시각으로 읽었어요." : ""}${res.status === "overlap" ? " · 시계를 되돌린 날이라 두 번 있던 시각이에요. 나중(표준시) 시각으로 읽었어요." : ""}`]);
    rows.push(["시각 보정", i.time ? (city ? `${esc(city.n)} ${res.corrNote}` : res.corrNote) : "시각을 모르면 보정하지 않아요"]);
    if (i.time) rows.push(["일·시주에 쓴 시각", `${res.local.y}-${two(res.local.m)}-${two(res.local.d)} ${two(res.local.h)}:${two(res.local.mi)}`]);
    rows.push(["자시 기준", { A: "23시에 날짜가 바뀜(기본)", B: "야자시·조자시 구분(23시대는 일주 유지, 시주만 다음 날)", C: "자정에 날짜가 바뀜" }[i.jasi]]);
    rows.push(["연·월주 기준", `입춘·12절 시각(태양 황경 계산). 직전 절 ${res.jeol.prev.name} ${kst(res.jeol.prev.ms)}, 다음 절 ${res.jeol.next.name} ${kst(res.jeol.next.ms)} (UTC+9 기준)`]);
    rows.push(["대운수", `${res.daeun.forward ? "순행: 다음 절까지" : "역행: 직전 절부터"} ${res.daeun.spanDays.toFixed(2)}일 ÷ 3 = ${res.daeun.exactYears.toFixed(2)} → 반올림 ${res.daeun.num} (0이면 1로 둠). 정밀 시작 시점은 출생 후 약 ${res.daeun.years}년 ${res.daeun.months}개월`]);
    const warn = res.nearBoundary ? `<p class="sj-warn" role="note">절기가 바뀌는 시각과 2분 이내에 태어났어요. 절기 시각의 오차(1분 안팎)나 출생 시각 기록에 따라 연주·월주가 달라질 수 있어요.</p>` : "";
    return `<details class="sj-basis" open><summary>계산 기준</summary><dl>${rows.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join("")}</dl>${warn}</details>`;
  }
  function daeunRow(res, rd) {
    const cur = rd.year.daeun;
    return `<div class="sj-daeun" role="list">${res.daeun.list.map((d) => `<div role="listitem" class="sj-dw${cur && cur.age === d.age ? " now" : ""}"><small>${d.age}세 · ${d.from}년~</small><span class="sj-char ${EL_CLS[S.stemEl(d.s)]}"><b>${d.name[0]}</b></span><span class="sj-char ${EL_CLS[S.BR_EL[d.b]]}"><b>${d.name[1]}</b></span><em>${esc(d.stemGod)}·${esc(d.brGod)}</em>${cur && cur.age === d.age ? "<strong>지금</strong>" : ""}</div>`).join("")}</div>
<p class="hint">${res.daeun.forward ? "순행" : "역행"} 대운이에요. 대운수 ${res.daeun.num}은 「출생 후 약 ${res.daeun.num}년부터 첫 대운이 시작된다」는 뜻이고, 표의 연도는 정밀 계산한 시작 시점이에요(만 나이 기준).</p>`;
  }
  function render(res, city) {
    const year = thisYear();
    const rd = R.read(res, year);
    const P = res.pillars, day = P[2];
    const rels = res.relations;
    const yr = rd.yearRead;
    const sub = `${rd.dayMaster.title.split(" · ")[1]} · ${res.strength.label} · ${year}년 ${rd.year.name}년 운세 ${"★".repeat(yr.stars)}`;
    out.innerHTML = `
<div class="sj-out">
  <p class="fun-badge">재미·참고용 결과예요. 과학적으로 검증된 예측이 아니에요.</p>
  <div class="result-card sj-card" data-card-title="나의 사주 일주" data-card-main="${esc(day.name)} 일주" data-card-sub="${esc(sub)}">
    <p class="sj-eyebrow">나의 사주팔자</p>
    <p class="sj-eight" aria-label="여덟 글자">${P.map((p) => (p ? `<span>${p.name}</span>` : "<span class='sj-q'>??</span>")).reverse().join("")}</p>
    <p class="sj-sub">일간 <b>${day.name[0]}</b>(${S.STEM_K[day.s]}${S.EL_K[day.stemEl]}) · ${S.BR_ANIMAL[P[0].b]}띠 · ${esc(res.strength.label)}</p>
  </div>
  ${basisBox(res, city)}
  <section class="sj-sec"><h2>만세력</h2>${table(res)}</section>
  <section class="sj-sec"><h2>오행과 십신</h2>
    <div class="sj-two"><div><h3>오행 분포</h3>${elementsBar(res)}</div><div><h3>십신 분포 <small>(일간 제외)</small></h3>${groupsBar(res)}</div></div>
    <h3>일간의 힘 <small>(간이 판정)</small></h3>
    <div class="sj-meter" role="img" aria-label="신강 점수 ${res.strength.score}점"><i style="width:${res.strength.score}%"></i><span style="left:35%"></span><span style="left:50%"></span><span style="left:65%"></span></div>
    <p><b>${esc(res.strength.label)} · ${res.strength.score}점</b> — ${esc(rd.strengthText)}</p>
    <p class="hint">돕는 자리 ${res.strength.parts.filter((x) => x.ok).map((x) => x.pos).join("·") || "없음"} (가중치 ${res.strength.help}/${res.strength.total}). 월지 3, 일지 1.5, 나머지 1로 매긴 이 사이트의 자체 점수예요.</p>
    ${rels.length ? `<h3>합과 충</h3><ul class="sj-rel">${rels.map((r) => `<li class="${r.good ? "good" : "bad"}">${esc(r.text)}</li>`).join("")}</ul>` : `<h3>합과 충</h3><p class="hint">원국에 주요 합·충이 없어요.</p>`}
  </section>
  <section class="sj-sec"><h2>일간으로 보는 나 — ${esc(rd.dayMaster.title)}</h2><p>${esc(rd.dayMaster.text)}</p><p class="sj-pc"><span><b>강점</b> ${esc(rd.dayMaster.plus)}</span><span><b>챙길 점</b> ${esc(rd.dayMaster.care)}</span></p></section>
  <section class="sj-sec"><h2>대운 흐름</h2>${daeunRow(res, rd)}</section>
  <section class="sj-sec sj-year"><h2>${year}년 ${esc(rd.year.name)}(${esc(rd.year.kor)})년 운세 ${stars(yr.stars)}</h2>${yr.lines.map((l) => `<p>${esc(l)}</p>`).join("")}<p class="sj-why">근거: ${esc(yr.basis)}</p></section>
  <section class="sj-sec"><h2>운세 6가지</h2><div class="sj-fortunes">${rd.fortunes.map((f) => `<article class="sj-f sj-f-${f.key}"><h3>${f.name} ${stars(f.stars)}</h3>${f.lines.map((l) => `<p>${esc(l)}</p>`).join("")}<p class="sj-why">근거: ${esc(f.basis)}</p></article>`).join("")}</div></section>
  ${NALGI.shareBar({ title: "무료 사주팔자 — 만세력과 운세 6가지", text: `나는 ${day.name} 일주! 내 사주팔자도 확인해 보세요`, path: "/fun/saju/" })}
  <p class="hint">공유 링크와 결과 이미지에는 생년월일과 출생 시각이 들어가지 않아요. 이미지에는 일주와 한 줄 요약만 담겨요.</p>
  <p class="legal">이 결과는 전통 명리학의 계산 규칙에 따라 자동으로 만든 재미·참고용 콘텐츠입니다. 과학적으로 검증된 예측이 아니며, 같은 생년월일시라도 해석 방식(자시·시간 보정 등)에 따라 결과가 달라질 수 있습니다. 건강·법률·재정·진로처럼 중요한 결정은 해당 분야 전문가와 상의하세요. 입력한 정보는 이 브라우저 안에서만 계산되며 저장하거나 전송하지 않습니다.</p>
</div>`;
  }
})();
