// P2-22 사주팔자 페이지 /luck/saju/ — build.mjs가 빌드 도구를 넘겨 호출합니다.
// 계산: src/assets/saju-calc.js (+ vendor/saju-vsop87d-earth.js, vendor/saju-kr-lunar.js), 문장: src/assets/saju-read.js, 화면: src/assets/saju.js
// 빌드할 때마다 verifySaju()로 검증표(content/saju-cases.mjs)를 브라우저와 같은 파일로 돌려 보고, 하나라도 어긋나면 빌드를 멈춥니다.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { CASES, HIDDEN_WIKI, STAGE_6TAIL, KASI_TERMS, USNO_SEASONS, KASI_NEWYEAR, KASI_LEAP } from "./saju-cases.mjs";

export const SAJU_PAGE = {
  id: "saju",
  path: "/luck/saju/",
  title: "무료 사주팔자",
  seo: "무료 사주팔자 — 만세력·대운·연애운·재물운·취업운까지, 사주 보는 법",
  h1: "무료 사주팔자 — 만세력부터 올해 운세까지",
  desc: "생년월일과 태어난 시각으로 사주팔자 여덟 글자를 계산하고 오행, 십신, 대운, 올해 운세와 연애운·재물운·직업운 등 6가지 운을 풀어 드려요. 절기와 출생지 경도를 반영하고, 입력한 정보는 저장하거나 전송하지 않아요.",
};

// ---------- 공용: 브라우저와 같은 파일을 Node에서 불러오기 ----------
const FILES = ["vendor/saju-vsop87d-earth.js", "vendor/saju-kr-lunar.js", "saju-calc.js", "saju-read.js"];
export function loadSaju(root) {
  const ctx = vm.createContext({});
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(root, "src", "assets", f), "utf8"), ctx, { filename: f });
  return { S: ctx.SAJU, R: ctx.SAJU_READ };
}
const SEOUL = 126.98;
function caseInput(c) {
  const [date, time] = c.in.split(" ");
  const [y, m, d] = date.split("-").map(Number);
  const t = time ? { h: +time.slice(0, 2), mi: +time.slice(3, 5) } : null;
  return { calendar: c.cal || "solar", y, m, d, leap: !!c.leap, time: t, gender: c.gender || "m", lon: c.seoul ? SEOUL : null, eot: false, jasi: c.jasi || "A" };
}
const BANNED = ["질병", "치료", "처방", "진단", "수술", "당뇨", "100%", "적중", "용한", "반드시 ", "부적", "굿을"];

export function verifySaju(root) {
  const { S, R } = loadSaju(root);
  const errors = [];
  const rows = CASES.map((c) => {
    const input = caseInput(c);
    const r = S.calc(input);
    if (r.error) { errors.push(`#${c.id} 계산 오류 ${r.error}`); return { ...c, got: `오류 ${r.error}`, ok: false }; }
    const got = r.pillars.filter(Boolean).map((p) => p.name).join(" ");
    const fails = [];
    if (got !== c.want) fails.push(`8자 ${got} ≠ ${c.want}`);
    if (c.status && r.status !== c.status) fails.push(`시각 상태 ${r.status} ≠ ${c.status}`);
    const sol = `${r.input.solar.y}-${String(r.input.solar.m).padStart(2, "0")}-${String(r.input.solar.d).padStart(2, "0")}`;
    if (c.solar && sol !== c.solar) fails.push(`양력 ${sol} ≠ ${c.solar}`);
    let dw = "";
    if (c.daeun) {
      dw = `${r.daeun.forward ? "순행" : "역행"} ${r.daeun.num} ${r.daeun.list[0].name}`;
      if (r.daeun.forward !== c.daeun.forward || r.daeun.num !== c.daeun.num || r.daeun.list[0].name !== c.daeun.first) fails.push(`대운 ${dw} ≠ ${c.daeun.forward ? "순행" : "역행"} ${c.daeun.num} ${c.daeun.first}`);
    }
    if (fails.length) errors.push(`#${c.id} ${c.in}: ${fails.join(", ")}`);
    return { ...c, got, dw, gotStatus: r.status, ok: !fails.length };
  });

  // 절기 시각: KASI 달력자료(2021~2028, 24절기 × 8년)와 ±60초 이내
  const kasi = { n: 0, max: 0, worst: "" };
  for (const [y, list] of Object.entries(KASI_TERMS)) for (const item of list.split(",")) {
    const [name, md, hm] = item.split(" ");
    const k = S.TERM_NAMES.indexOf(name);
    const ms = S.termMs(+y, (285 + 15 * k) % 360);
    const want = Date.UTC(+y, +md.slice(0, 2) - 1, +md.slice(2), +hm.slice(0, 2), +hm.slice(2)) - 9 * 3600000;
    const diff = (ms - want) / 1000;
    kasi.n++;
    if (Math.abs(diff) > Math.abs(kasi.max)) { kasi.max = diff; kasi.worst = `${y} ${name}`; }
    if (Math.abs(diff) > 60) errors.push(`KASI 절기 ${y} ${name}: ${diff.toFixed(0)}초 차이`);
  }
  // 춘분·하지·추분·동지: USNO(1911~2050, 15개 연도)와 ±60초 이내
  const usno = { n: 0, max: 0, worst: "", years: Object.keys(USNO_SEASONS).length };
  for (const [y, list] of Object.entries(USNO_SEASONS)) list.split(",").forEach((item, i) => {
    const [md, hm] = item.split(" ");
    const ms = S.termMs(+y, i * 90);
    const want = Date.UTC(+y, +md.slice(0, 2) - 1, +md.slice(2), +hm.slice(0, 2), +hm.slice(2));
    const diff = (ms - want) / 1000;
    usno.n++;
    if (Math.abs(diff) > Math.abs(usno.max)) { usno.max = diff; usno.worst = `${y} ${["춘분", "하지", "추분", "동지"][i]}`; }
    if (Math.abs(diff) > 60) errors.push(`USNO ${y} ${i * 90}°: ${diff.toFixed(0)}초 차이`);
  });
  // 음력 설날·윤달 초하루: KASI 음양력 변환과 양력일·일진 대조
  let lunarN = 0;
  for (const line of KASI_NEWYEAR) {
    const [y, date, iljin] = line.split(" ");
    const r = S.lunarToSolar(+y, 1, 1, false);
    const got = `${r.y}-${String(r.m).padStart(2, "0")}-${String(r.d).padStart(2, "0")}`;
    const g = S.gzName(S.dayGz(r.jdn));
    lunarN++;
    if (got !== date || g !== iljin) errors.push(`음력 ${y}-01-01: ${got} ${g} ≠ KASI ${date} ${iljin}`);
  }
  for (const line of KASI_LEAP) {
    const [ym, date, len, iljin] = line.split(" ");
    const [y, m] = ym.split("-").map(Number);
    const r = S.lunarToSolar(y, m, 1, true);
    const got = r.error ? r.error : `${r.y}-${String(r.m).padStart(2, "0")}-${String(r.d).padStart(2, "0")}`;
    const L = S.lunarYear(y).months.find((x) => x.m === m && x.leap);
    lunarN++;
    if (got !== date || !L || L.len !== +len || S.gzName(S.dayGz(r.jdn)) !== iljin) errors.push(`음력 ${y} 윤${m}월: ${got} ≠ KASI ${date}`);
  }
  // 지장간(위키백과)·12운성(6tail) 두 번째 출처 대조
  HIDDEN_WIKI.split(" ").forEach((w, b) => {
    const mine = S.HIDDEN[b].map((s) => (s == null ? "-" : S.STEM_H[s])).join("");
    if (mine !== w) errors.push(`지장간 ${S.BR_H[b]}: ${mine} ≠ ${w}`);
  });
  for (let s = 0; s < 10; s++) for (let b = 0; b < 12; b++) {
    const idx = (((STAGE_6TAIL[s] + (s % 2 === 0 ? b : -b)) % 12) + 12) % 12;
    if (S.STAGE[idx] !== S.stage(s, b)) errors.push(`12운성 ${S.STEM_H[s]}${S.BR_H[b]}: ${S.stage(s, b)} ≠ ${S.STAGE[idx]}`);
  }
  // 해석: 같은 입력 → 같은 결과, 근거 문장 존재, 금지 표현 0. 1920~2030년 600개 입력을 훑어 예외도 확인
  let sweep = 0;
  const texts = [];
  const sweepInputs = CASES.map(caseInput);
  for (let i = 0; i < 600; i++) {
    const y = 1920 + (i * 37) % 111, m = 1 + (i * 7) % 12, d = 1 + (i * 11) % 28;
    sweepInputs.push({ calendar: "solar", y, m, d, time: i % 5 === 0 ? null : { h: (i * 5) % 24, mi: (i * 13) % 60 }, gender: i % 2 ? "f" : "m", lon: i % 3 ? SEOUL : null, eot: i % 7 === 0, jasi: "ABC"[i % 3] });
  }
  for (const inp of sweepInputs) {
    let a, b;
    try { a = R.read(S.calc(inp), 2026); b = R.read(S.calc(inp), 2026); } catch (e) { errors.push(`해석 예외 ${JSON.stringify(inp)}: ${e.message}`); continue; }
    sweep++;
    if (JSON.stringify(a) !== JSON.stringify(b)) errors.push(`같은 입력인데 결과가 다름 ${JSON.stringify(inp)}`);
    if (a.fortunes.length !== 6 || a.fortunes.some((f) => !f.basis || f.stars < 1 || f.stars > 5 || !f.lines.length)) errors.push(`운세 형식 오류 ${JSON.stringify(inp)}`);
    texts.push(...a.fortunes.flatMap((f) => f.lines), ...a.yearRead.lines, a.dayMaster.text, a.strengthText);
  }
  const all = [...new Set(texts)].join("\n");
  BANNED.forEach((w) => { if (all.includes(w)) errors.push(`금지 표현 「${w}」이 운세 문장에 있음`); });

  return { rows, errors, kasi, usno, lunarN, sweep, uniqueTexts: new Set(texts).size, S };
}

// ---------- 원고 (자체 작성) ----------
const CITIES = [
  ["seoul", "서울", 126.98], ["incheon", "인천", 126.71], ["suwon", "수원", 127.03], ["chuncheon", "춘천", 127.73], ["gangneung", "강릉", 128.88],
  ["daejeon", "대전", 127.38], ["sejong", "세종", 127.29], ["cheongju", "청주", 127.49], ["jeonju", "전주", 127.15], ["gwangju", "광주", 126.85],
  ["daegu", "대구", 128.6], ["pohang", "포항", 129.34], ["ulsan", "울산", 129.31], ["busan", "부산", 129.08], ["changwon", "창원", 128.68], ["jeju", "제주", 126.53],
].map(([k, n, lon]) => ({ k, n, lon }));

const HOWTO = [
  { h: "사주팔자는 네 기둥, 여덟 글자예요", p: "사주(四柱)는 태어난 해·달·날·시를 네 개의 기둥으로 세운 것이고, 기둥마다 위에 천간 한 글자, 아래에 지지 한 글자가 있어 모두 여덟 글자(팔자)가 돼요. 천간은 갑·을·병·정·무·기·경·신·임·계의 열 개, 지지는 자·축·인·묘·진·사·오·미·신·유·술·해의 열두 개이고, 둘을 차례로 짝지은 60가지 조합(60갑자)이 해와 달과 날과 시마다 돌아가며 붙어요.\n이 가운데 태어난 날의 천간을 「일간」이라고 부르고, 사주에서는 일간을 「나」로 보고 나머지 일곱 글자와의 관계를 읽어요." },
  { h: "해와 달은 양력 1월 1일이 아니라 절기로 바뀌어요", p: "사주의 한 해는 설날이나 1월 1일이 아니라 입춘(태양이 황경 315°에 오는 순간)에 시작돼요. 그래서 1월이나 2월 초에 태어난 분은 앞 해의 연주를 쓰는 경우가 많아요. 달도 마찬가지로 입춘·경칩·청명·입하·망종·소서·입추·백로·한로·입동·대설·소한의 12절 시각에 바뀌어요.\n펭귄 툴즈는 절기 시각을 표에서 베껴 오지 않고 태양의 위치를 직접 계산해요. 이렇게 계산한 2021~2028년 절기 192개를 한국천문연구원 발표 시각과 비교했더니 모두 1분 안쪽으로 맞았어요." },
  { h: "날과 시는 태어난 곳의 시각으로 정해요", p: "일주는 60갑자가 하루에 하나씩 끊기지 않고 이어지기 때문에 날짜만 알면 정해져요. 시주는 하루를 두 시간씩 열둘로 나눈 시진(자시 23~1시, 축시 1~3시 …)으로 정하고, 시주의 천간은 일간에 따라 정해져요.\n그런데 우리나라 표준시는 동경 135°를 기준으로 하고, 서울은 동경 127°쯤이라 해가 실제로 가장 높이 뜨는 시각이 시계보다 30분 정도 늦어요. 그래서 많은 만세력이 출생지 경도만큼 시각을 보정해요. 이 페이지도 기본으로 출생지 경도 보정을 켜 두었고, 「보정 안 함」을 고르면 당시 표준시를 그대로 써요." },
  { h: "옛날 시계는 지금과 달랐어요", p: "우리나라는 1954년 3월 21일부터 1961년 8월 9일까지 표준시를 30분 늦춘 UTC+8:30으로 썼고, 1908~1911년에도 같은 기준을 썼어요. 1948~1951년, 1955~1960년, 1987~1988년 여름에는 시계를 1시간 앞당기는 서머타임도 했어요. 이 기간에 태어난 분의 출생 시각은 그때 시계 기준이라, 서머타임이면 1시간을 빼고, 1950년대 출생은 30분 다른 기준을 반영해야 시주가 맞아요. 이 계산기는 국제 표준 시간대 데이터베이스(IANA tz)의 기록대로 자동으로 반영해요." },
  { h: "오행과 십신으로 읽어요", p: "여덟 글자는 저마다 목·화·토·금·수 다섯 기운(오행) 가운데 하나에 속해요. 어느 기운이 많고 적은지가 오행 분포예요. 일간과 다른 글자의 오행이 서로 돕는지(생), 누르는지(극), 같은지에 따라 비견·겁재·식신·상관·편재·정재·편관·정관·편인·정인의 열 가지 이름(십신)을 붙여요.\n십신은 다섯 묶음으로 보면 쉬워요. 비겁은 나와 같은 힘(동료·경쟁), 식상은 내가 내보내는 힘(표현·기술), 재성은 내가 다루는 것(재물·성과), 관성은 나를 다스리는 것(직장·책임), 인성은 나를 돕는 것(배움·후원)이에요. 이 페이지의 연애운·재물운 같은 풀이는 이 다섯 묶음이 원국과 올해, 대운에 얼마나 있는지를 규칙으로 정리한 결과예요." },
  { h: "대운과 세운", p: "대운은 10년마다 바뀌는 큰 흐름이에요. 월주에서 시작해 60갑자를 차례로 앞으로(순행) 또는 뒤로(역행) 짚어 가는데, 연간이 양(갑·병·무·경·임)인 남자와 음인 여자는 순행, 그 반대는 역행해요. 첫 대운이 시작되는 나이(대운수)는 태어난 순간부터 다음 절기(역행이면 직전 절기)까지의 날수를 3으로 나눈 값이에요. 이 페이지는 나머지를 반올림하고, 정밀하게 계산한 시작 시점도 함께 보여 드려요.\n세운은 그해의 간지예요. 2026년은 병오(丙午)년이고, 입춘(2월 4일 05:02) 이후부터 병오년의 기운으로 봐요." },
];
const BASIS = [
  "연주·월주: 출생 순간과 입춘·12절의 순간을 비교해 정해요. 절기 시각은 VSOP87 행성 이론으로 태양의 시황경을 계산하고(장동·광행차 반영), 한국천문연구원 달력자료(2021~2028년 192개)와 미국 해군천문대 자료(1911~2050년 중 15개 연도의 춘분·하지·추분·동지)와 모두 1분 안쪽으로 맞는지 빌드할 때마다 확인해요.",
  "일주: 율리우스 적일에서 60갑자 번호를 구해요. 1900~2050년 음력 초하루 1,867일의 일진을 한국천문연구원 자료와 대조해 모두 일치했어요.",
  "시주: 두 시간 단위 시진과 일간으로 정해요. 출생지를 고르면 경도만큼 보정하고(서울 약 −32분, 1954~1961년생은 약 −2분), 고급 옵션에서 균시차까지 더한 진태양시도 쓸 수 있어요.",
  "자시: 기본은 「23시에 날짜가 바뀜」이에요. 고급 옵션에서 야자시·조자시 구분(23시대는 날짜를 그대로 두고 시주만 다음 날 기준)과 자정 기준을 고를 수 있어요.",
  "음력: 한국천문연구원 음양력 자료로 만든 1900~2050년 변환표를 써요. 윤달이면 「윤달」에 체크해 주세요.",
  "해석: 오행 분포, 십신, 일간의 힘(간이 점수), 12운성, 지장간, 주요 합·충, 대운과 올해 세운을 규칙에 넣어 문장을 골라요. 같은 입력이면 언제나 같은 결과가 나와요.",
];
const LIMITS = "사주명리학은 과학적으로 검증된 이론이 아니고, 학파마다 자시 처리, 시각 보정, 대운수 계산, 지장간과 12운성 표가 조금씩 달라요. 그래서 같은 생년월일시라도 사이트마다 시주나 대운수가 다르게 나올 수 있어요. 이 페이지는 위의 「계산 기준」을 결과 화면에 모두 적어 두었으니 다른 만세력과 비교할 때 참고해 주세요. 절기 시각과 1~2분 차이로 태어난 경우에는 연주나 월주가 달라질 수 있어 따로 안내해요. 1950~1951년 서머타임은 전쟁 중 실제로 시행됐는지 기록이 엇갈리는데, 이 계산기는 국제 표준 시간대 데이터베이스(IANA tz)의 기록을 따라요. 운세 문장은 십신과 오행의 일반적인 의미를 바탕으로 펭귄 툴즈가 직접 쓴 규칙 기반 문장이며, 건강운은 생활 습관 이야기일 뿐 의학적 판단이 아니에요.";
const FAQ = [
  { q: "생년월일을 입력하면 어디에 저장되나요?", a: "저장하지 않아요. 계산은 지금 쓰는 브라우저 안에서만 하고 서버로 보내지 않아요. 결과 공유 링크에도 생년월일이 들어가지 않고, 결과 이미지에는 일주와 한 줄 요약만 담겨요." },
  { q: "태어난 시각을 모르면 어떻게 하나요?", a: "출생 시각에서 「모름」을 고르면 시주를 빼고 연주·월주·일주 여섯 글자로 계산해요. 오행 분포와 일간의 힘도 여섯 글자 기준으로 보여 드려요. 시주는 자녀운이나 말년의 흐름을 볼 때 쓰지만, 일간과 월주만으로도 기본 성향과 대운은 볼 수 있어요." },
  { q: "다른 사이트와 시주가 달라요. 왜 그런가요?", a: "가장 흔한 이유는 출생지 경도 보정이에요. 서울에서 태어났다면 보정할 때와 안 할 때 시각이 32분쯤 달라져 시주가 바뀔 수 있어요. 그다음은 자시(23시~1시) 처리 방식, 1950년대 표준시와 서머타임 반영 여부예요. 결과 화면의 「계산 기준」에 적용한 방식이 모두 적혀 있으니 출생지와 고급 옵션을 바꿔 비교해 보세요." },
  { q: "1월이나 2월 초에 태어났는데 띠가 달라요.", a: "사주의 한 해는 입춘에 바뀌어요. 예를 들어 2026년 2월 4일 05:02 이전에 태어났다면 2025년 을사년생으로 봐요. 그래서 1월생과 입춘 전 2월생은 흔히 아는 띠와 다르게 나올 수 있어요." },
  { q: "음력 생일은 어떻게 넣나요?", a: "「음력」을 고르고 음력 날짜를 그대로 넣으세요. 그해 윤달에 태어났다면 「윤달」에도 체크하세요. 변환은 한국천문연구원 자료로 만든 1900년~2050년 11월 표를 써요. 해당 연도에 그 달의 윤달이 없으면 알려 드려요." },
  { q: "1950년대나 1987~1988년생은 무엇을 조심해야 하나요?", a: "그때는 표준시가 지금과 30분 달랐거나(1954~1961년) 서머타임이 있었어요(1955~1960년, 1987~1988년 여름 등). 출생 시각은 당시 시계에 적힌 그대로 넣으면 계산기가 자동으로 반영해요. 직접 1시간을 빼서 넣으면 두 번 빼는 셈이 되니 주의하세요." },
  { q: "성별은 왜 묻나요?", a: "대운이 앞으로 흐를지(순행) 뒤로 흐를지(역행)를 정할 때만 써요. 연애운에서는 전통 해석에 따라 남성은 재성, 여성은 관성을 인연의 별로 봐요." },
  { q: "운세가 좋지 않게 나왔어요.", a: "사주 풀이는 경향을 읽는 재미·참고용 콘텐츠예요. 별이 적게 나온 운은 「그 분야에 조금 더 신경을 쓰면 좋다」는 정도로 받아들여 주세요. 펭귄 툴즈는 나쁜 운을 막으려면 돈을 내야 한다는 식의 안내를 하지 않아요." },
];

export default function buildSaju(h) {
  const { cfg, write, layout, crumbHtml, crumbs, faqHtml, faqLd, adSlot, esc, t, u, abs, textLen, warnings, root } = h;
  // 1) 검증표 대조 — 하나라도 어긋나면 빌드 실패
  const v = verifySaju(root);
  if (v.errors.length) throw new Error("사주 검증 실패 (content/saju-cases.mjs):\n  " + v.errors.join("\n  "));

  const P = SAJU_PAGE;
  const items = [["홈", "/"], ["나의 운", "/luck/"], [P.title, P.path]];
  const words = textLen(HOWTO) + BASIS.join("").length + LIMITS.length + FAQ.reduce((n, f) => n + f.a.length, 0);
  if (words < 1500) warnings.push(`사주 페이지 원고 ${words}자(1500자 미만)`);
  const nowY = new Date().getFullYear();
  const years = [];
  for (let y = Math.max(nowY, 2026); y >= 1920; y--) years.push(y);
  const opt = (v, label, sel) => `<option value="${v}"${sel ? " selected" : ""}>${label}</option>`;
  const html = `
<form class="form sj-form" id="saju-form" autocomplete="off" novalidate>
  <fieldset class="seg"><legend>달력</legend>
    <label><input type="radio" name="cal" value="solar" checked><span>양력</span></label><label><input type="radio" name="cal" value="lunar"><span>음력</span></label>
    <label class="check sj-leap off"><input type="checkbox" name="leap" disabled> 윤달</label>
  </fieldset>
  <fieldset class="row3"><legend>생년월일</legend>
    <label><span class="sr">년</span><select name="y" required><option value="">년</option>${years.map((y) => opt(y, `${y}년`)).join("")}</select></label>
    <label><span class="sr">월</span><select name="m" required><option value="">월</option>${Array.from({ length: 12 }, (_, i) => opt(i + 1, `${i + 1}월`)).join("")}</select></label>
    <label><span class="sr">일</span><select name="d" required><option value="">일</option>${Array.from({ length: 31 }, (_, i) => opt(i + 1, `${i + 1}일`)).join("")}</select></label>
  </fieldset>
  <fieldset class="row3 sj-time"><legend>태어난 시각 <small>(당시 시계 그대로)</small></legend>
    <label><span class="sr">시</span><select name="hh">${opt("", "시각 모름", true)}${Array.from({ length: 24 }, (_, i) => opt(i, `${i}시`)).join("")}</select></label>
    <label><span class="sr">분</span><select name="mi">${Array.from({ length: 60 }, (_, i) => opt(i, `${i}분`)).join("")}</select></label>
  </fieldset>
  <fieldset class="seg"><legend>성별 <small>(대운 방향용)</small></legend>
    <label><input type="radio" name="gender" value="m"><span>남</span></label><label><input type="radio" name="gender" value="f"><span>여</span></label>
  </fieldset>
  <label class="sj-place">태어난 곳 <small>(경도 보정용)</small><select name="place">${CITIES.map((c) => opt(c.k, `${c.n} (동경 ${c.lon.toFixed(2)}°)`, c.k === "seoul")).join("")}${opt("none", "보정 안 함 · 해외 · 모름")}</select></label>
  <details class="sj-adv"><summary>고급 옵션 (자시 처리 · 균시차)</summary>
    <fieldset class="seg sj-jasi"><legend>자시(23시~1시) 처리</legend>
      <label><input type="radio" name="jasi" value="A" checked><span>23시에 날짜 바뀜 (기본)</span></label>
      <label><input type="radio" name="jasi" value="B"><span>야자시·조자시 구분</span></label>
      <label><input type="radio" name="jasi" value="C"><span>자정에 날짜 바뀜</span></label>
    </fieldset>
    <label class="check"><input type="checkbox" name="eot"> 균시차까지 더한 진태양시로 보정 (출생지를 고른 경우)</label>
  </details>
  <button class="btn big" type="submit">사주 보기</button>
  <p class="safe">입력한 정보는 이 브라우저 안에서만 계산하고 저장하거나 전송하지 않아요. 주소(URL)에도 넣지 않아요.</p>
</form>
<div class="result" id="saju-result" hidden aria-live="polite"></div>`;

  const body = `
${crumbHtml(items)}
<article class="tool saju-page">
  <header class="page-head">
    <span class="eyebrow">나의 운</span>
    <h1>${esc(P.h1)}</h1>
    <p class="lead">${esc(P.desc)}</p>
    <p class="fun-badge">재미·참고용 콘텐츠예요</p>
  </header>
  <p class="legal sj-top-note">이 결과는 전통 명리학의 계산 규칙에 따라 자동으로 만든 재미·참고용 콘텐츠입니다. 과학적으로 검증된 예측이 아니며, 같은 생년월일시라도 해석 방식에 따라 결과가 달라질 수 있습니다.</p>
  <section class="tool-box" id="tool">${html}</section>
  ${adSlot("saju-below")}
  <section class="prose">
    <h2>사주 보는 법</h2>
    ${HOWTO.map((b) => `<h3>${t(b.h)}</h3>${b.p.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}`).join("")}
    <h2>이 계산기의 계산 기준</h2>
    <ul>${BASIS.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    <p>검증표: 공개 만세력과 한국천문연구원 자료로 정답을 확인한 ${v.rows.length}개 사례(절기 직전·직후, 자시, 1950년대 표준시, 서머타임, 음력 윤달, 대운수 포함)를 빌드할 때마다 이 페이지의 계산 코드로 다시 돌려 모두 일치하는지 확인해요.</p>
    <h2>알아 두세요 (한계)</h2>
    <p>${esc(LIMITS)}</p>
  </section>
  ${faqHtml(FAQ)}
  ${adSlot("saju-faq")}
  <p class="legal">이 결과는 전통 명리학의 계산 규칙에 따라 자동으로 만든 재미·참고용 콘텐츠입니다. 건강·법률·재정·진로처럼 중요한 결정은 해당 분야 전문가와 상의하세요. 입력한 정보는 이 브라우저 안에서만 계산되며 저장하거나 전송하지 않습니다. 운세 문장은 ${esc(cfg.siteName)}가 직접 작성했습니다.</p>
</article>
<script type="application/json" id="page-data">${JSON.stringify({ cities: CITIES }).replace(/</g, "\\u003c")}</script>`;
  const ld = [crumbs(items), faqLd(FAQ), { "@context": "https://schema.org", "@type": "WebApplication", name: P.title, url: abs(P.path), description: P.desc, applicationCategory: "LifestyleApplication", operatingSystem: "Any", inLanguage: "ko", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" } }];
  write(P.path, layout({ title: P.seo, desc: P.desc, path: P.path, body, csp: true, vendor: ["saju-vsop87d-earth.js", "saju-kr-lunar.js"], scripts: ["saju-calc.js", "saju-read.js", "saju.js"], jsonld: ld, fullTitle: false }));
  console.log(`✔ 사주 검증: 사례 ${v.rows.length}건 일치, KASI 절기 ${v.kasi.n}개(최대 ${v.kasi.max.toFixed(0)}초), USNO ${v.usno.n}개(최대 ${v.usno.max.toFixed(0)}초), 음력 ${v.lunarN}건, 해석 ${v.sweep}개 입력`);
  return P;
}
