// P2-74 「커닝냥이 — 감독관을 피해서 만점을 맞아라!」 페이지 — build.mjs가 빌드 도구를 넘겨 호출합니다.
// 게임 코드는 src/assets/examcat-data.js · examcat-art.js · examcat-sound.js · examcat.js, 전용 CSS는 examcat-style.css (외부 에셋 0, 서버 전송 0)
// ★ 게임 이름은 src/assets/examcat-data.js의 NAME 한 곳에서만 정함. 이 원고·메타·TOOLS 항목은 모두 그 값을 가져다 씀.
// AI 시험 부정행위 논란을 풍자한 가상의 게임이며 실존 인물과 무관. 실제 부정행위 방법(실존 기기·앱 사용법, 시험 회피 요령)은 넣지 않고, 빌드 때 금지어 검사를 함.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function loadData() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "src", "assets", "examcat-data.js"), "utf8"), ctx, { filename: "examcat-data.js" });
  return ctx.window.EXCAT;
}
const DATA = loadData();
const N = DATA.NAME, SUB = DATA.SUB;

export const EXAMCAT_PAGE = {
  id: "examcat",
  path: "/arcade/cunning-nyang/",
  title: N,
  seo: `${N} — ${SUB} AI 시험 부정행위 풍자 게임`,
  h1: `${N} — ${SUB}`,
  desc: `고양이 수험생 ${N}가 펭귄 감독관의 눈을 피해 시험을 보는 AI 부정행위 풍자 게임. 시험지를 찰칵 찍고, AI 답을 기다렸다가, 몰래 힐끔! 쪽지시험부터 자격시험까지 4단계, 너무 잘 보면 사후 조사까지. 엔딩 11가지, 한 판 5분 이내.`,
  hook: "찰칵 찍고, 기다리고, 힐끔. 감독관만 피하면… 만점?",
  meta: "4단계 · 5분 이내 · 엔딩 11개",
};

const INTRO = [
  { h: "어떤 게임인가요", p: `고양이 수험생 「${N}」가 시험을 봅니다. 가만히 있으면 냥이가 스스로 문제를 천천히 풀어요. 느리지만 들킬 일이 없어요. 몰래 숨겨 둔 AI를 쓰면 훨씬 빨라지는데, AI는 세 단계를 거쳐야 해요. 버튼(PC는 Space)을 꾹 눌러 시험지를 「찰칵」, 손을 떼고 AI가 답을 만들 때까지 기다렸다가, 다시 꾹 눌러 답을 「힐끔」. 찰칵하거나 힐끔하는 순간 펭귄 감독관의 시선에 걸리면 의심 게이지가 오르고, 가득 차면 부정행위로 퇴장입니다.\n제한 시간 안에 스스로만 풀면 절반쯤밖에 못 풀어요. 그래서 「언제 찍고 언제 볼지」를 감독관 눈치와 맞춰 고르는 긴장이 이 게임의 재미예요. 답을 아는 문제는 보기를 직접 눌러 바로 맞힐 수도 있어요.` },
  { h: "감독관을 읽으면 이겨요", p: "감독관은 돌아보기 직전에 반드시 예고를 해요. 노란 점선 부채꼴이 「곧 볼 곳」, 빨간 부채꼴이 「지금 보는 곳」이에요. 조교 펭귄은 고개를 갸웃(?)하고, 부장 펭귄은 신문 모서리를 접어 눈을 내밀고, 안경 검사 펭귄은 뒤로 다가올수록 발자국 표시와 발소리가 커져요. 예고를 보고 버튼에서 손을 떼면 들키지 않습니다. 운이 아니라 관찰과 타이밍으로 푸는 게임이에요." },
  { h: "단계마다 새 감시, 새 AI", p: "쪽지시험에서는 조교 펭귄 한 명이 일정하게 돌아봐요. 중간고사에는 「감독관 4명 배치 완료」라고 써 붙였지만 두 명은 졸고 있고, 아무 때나 신문을 내리며 가짜 동작도 하는 부장 펭귄이 진짜 감시를 맡아요. 기말고사에는 「CCTV 없는 시험장」이라는 말이 무색하게 CCTV가 새로 달리고 안경 검사 펭귄이 뒤를 돌아요. 마지막 자격시험 본고사에는 AI가 답을 만드는 동안에도 눈금이 차는 전파 탐지기까지 등장합니다. 그 대신 냥이의 AI 도구도 단추 카메라와 냥폰 → 스마트 안경 냥경 → 꼬리 이어폰 → 만능 AI 볼펜으로 점점 빨라져요. 모두 과장된 가상의 물건이에요." },
  { h: "만점을 맞으면 끝일까요?", p: "점수가 너무 좋으면 시험이 끝난 뒤 「너무 잘 봤는데?」 사후 조사가 열려요. 시험 때 AI로 푼 문제가 많을수록 조사 게이지가 높게 시작하고, 조사관은 시험에 나왔던 문제를 AI 없이 다시 물어봐요. 시험장에서는 아무도 못 봤어도, 설명을 못 하면 들통나서 합격이 취소됩니다. 반대로 스스로 푼 문제가 많으면 술술 답해서 「진짜 만점」 엔딩을 볼 수 있어요. 점수가 평범해서 조사를 피하는 「스스로 풀어 합격」 엔딩도 있어요. 단계별 퇴장 엔딩까지 모두 11가지 엔딩을 엔딩 도감에 모을 수 있어요." },
  { h: "풍자 게임이에요", p: `${N}는 AI 시험 부정행위 논란을 풍자한 가상의 게임이며 실존 인물과 무관합니다. 최근 시험에서 몰래 AI를 쓰는 일이 사회 문제로 떠오르자, 그 모습을 과장해서 웃어 보자는 뜻으로 만들었어요. 실제 부정행위를 권하지 않으며, 게임 속 AI 도구와 감시 장치는 동작 원리 없이 우스운 연출로만 그렸어요. 실제 시험에서 부정행위는 시험 무효나 응시 제한 같은 무거운 불이익으로 이어질 수 있어요. 게임의 결말처럼, AI로 딴 점수는 내 실력이 아니니까요.` },
];
const CONTROLS = [
  ["① 찰칵 / ③ 힐끔", "Space 꾹 누르기 또는 그림·버튼을 마우스로 꾹", "아래 버튼 꾹 누르기(그림을 꾹 눌러도 됨)"],
  ["② 기다리기·숨기기", "Space에서 손 떼기", "버튼에서 손 떼기"],
  ["답 직접 고르기", "1 · 2 · 3", "보기 누르기"],
  ["일시정지", "P 또는 Esc, 오른쪽 위 버튼", "오른쪽 위 일시정지 버튼"],
  ["소리 끄기·켜기", "오른쪽 위 스피커 버튼", "오른쪽 위 스피커 버튼"],
];
const FAQ = [
  { q: "실제 시험에서 쓸 수 있는 방법이 나오나요?", a: "아니요. 이 게임은 AI 시험 부정행위 논란을 풍자한 가상의 게임이에요. 단추 카메라, 냥폰, 냥경, 꼬리 이어폰, 만능 AI 볼펜 같은 도구와 펭귄 감독관, 전파 탐지기는 모두 지어낸 것이고, 실제 기기나 앱의 사용법, 시험 감독을 피하는 요령은 담지 않았어요. 실제 시험에서 부정행위는 시험 무효나 응시 제한으로 이어질 수 있으니 절대 하지 마세요." },
  { q: "실제 사건이나 인물을 다룬 게임인가요?", a: `아니요. ${N}와 등장인물, 시험, 점수는 모두 지어낸 것이고 실존 인물과 무관합니다. 시험에서 AI를 몰래 쓰는 일이 논란이 되는 사회 현상을 과장해서 풍자했을 뿐, 특정 사람이나 사건을 그리지 않았어요.` },
  { q: "운이 나쁘면 그냥 들키는 거 아닌가요?", a: "감독관은 돌아보기 전에 항상 예고를 해요. 노란 점선 부채꼴이 나타나면 곧 그쪽을 본다는 뜻이고, 빨간 부채꼴 안에서 찰칵하거나 힐끔할 때만 들켜요. AI가 답을 만드는 동안(손을 뗀 동안)에는 들키지 않아요. 예고는 쪽지시험에서 1초, 자격시험에서 0.55초로 짧아지지만 손을 떼기에는 충분한 시간이에요. 부장 펭귄은 다른 수험생을 보거나 신문만 펄럭이는 가짜 동작도 하는데, 점선이 어디를 가리키는지 보면 구분할 수 있어요." },
  { q: "만점을 맞았는데 왜 들통났어요?", a: "총점이 85점 이상이면 「너무 잘 봤는데?」 사후 조사가 열려요. 시험 때 AI로 푼 비율이 높을수록 조사 게이지가 높게 시작하고, 시험 문제를 다시 물어볼 때 맞히면 내려가고 틀리면 올라가요. 틀렸을 때나 마지막에 70% 이상이면 들통이에요. 스스로 푼 문제를 늘리거나, AI가 보여 준 해설을 잘 읽어 두면 통과할 수 있어요." },
  { q: "AI를 안 쓰고도 깰 수 있나요?", a: "네. 버튼을 한 번도 누르지 않아도 냥이가 스스로 풀어서 끝까지 갈 수 있어요. 시간 안에 절반쯤 풀게 되고, 답을 아는 문제를 직접 맞히면 점수가 더 올라가요. AI를 거의 안 쓰고 60점을 넘기면 진짜 엔딩인 「스스로 풀어 합격」을 볼 수 있어요." },
  { q: "한 판에 얼마나 걸려요?", a: "4단계의 제한 시간을 모두 더하면 3분 25초(40·50·55·60초)이고, 단계 사이 안내와 사후 조사까지 합쳐도 5분 안에 끝나요. 문제를 다 풀면 시간이 남아도 바로 제출돼서 더 빨리 끝날 수도 있어요." },
  { q: "시험 문제의 세무 상식은 정확한가요?", a: "부가가치세 기본 세율, 종합소득세 신고 달, 국세와 지방세 구분처럼 국세청이 널리 안내하는 일반 상식 수준만 넣었어요. 실제 세금 신고나 계산은 개인 상황에 따라 달라지니 국세청 안내나 세무 전문가에게 확인해 주세요." },
  { q: "기록은 어디에 저장되나요?", a: "최고 기록, 모은 엔딩, 소리 설정은 지금 쓰는 브라우저의 저장 공간(localStorage)에만 남고 서버로 보내지 않아요. 이 게임에는 순위표가 없어요. 엔딩 도감의 「기록 지우기」나 브라우저의 사이트 데이터 삭제로 지울 수 있어요. 결과 카드 이미지에도 이름 같은 개인정보는 들어가지 않아요." },
  { q: "탭을 옮겼더니 게임이 멈췄어요.", a: "다른 탭으로 가거나, 창을 전환하거나, 화면 너비가 바뀌면 시험 중이던 게임이 자동으로 일시정지돼요. 누르고 있던 버튼도 자동으로 떼어져요. 「계속하기」를 누르면 멈춘 곳부터 이어서 해요." },
  { q: "그림은 어떻게 만들었나요?", a: `이미지 파일 없이 브라우저 캔버스에 곡선과 면을 직접 그리는 벡터 일러스트 방식이에요. ${N}, 펭귄 감독관, 교실은 모두 이 게임을 위해 새로 그렸고, 효과음도 음원 파일 없이 브라우저에서 바로 합성해요. 다른 게임이나 캐릭터를 본뜨지 않았어요.` },
];

// 금지어(첫 두 개는 쓰지 않기로 한 옛 가칭이라 글자 그대로 두지 않음): 실존 AI 서비스·기기·메신저 이름, 실제 회피 요령으로 읽힐 표현, 실존 인물을 떠올리게 하는 표현(정책·명예 안전, P2-74)
const BANNED = [String.fromCharCode(0xC138, 0xBB34, 0xB0E5), "s" + "emunyang", "수석", "397", "ChatGPT", "챗GPT", "챗지피티", "GPT-4", "Gemini", "제미나이", "Claude", "클로드", "Copilot", "코파일럿", "갤럭시", "아이폰", "iPhone", "에어팟", "AirPods", "카카오톡", "카톡", "텔레그램", "스마트워치", "블루투스", "무선 이어폰", "커닝 페이퍼", "커닝페이퍼", "몰래 보는 법", "들키지 않는 법", "치팅 방법", "부정행위 방법", "자수", "경찰"];

function verify(warnings, assetsDir) {
  const D = DATA, err = [];
  if (D.STAGES.length < 4) err.push(`단계 ${D.STAGES.length}개(4개 이상이어야 함)`);
  const totalT = D.STAGES.reduce((n, s) => n + s.T, 0);
  if (totalT > 240) err.push(`제한 시간 합계 ${totalT}초(240초 이하여야 5분 안에 끝남)`);
  const tools = new Set(), watch = new Set();
  D.STAGES.forEach((s, i) => {
    if (s.n !== i + 1) err.push(`단계 번호 ${s.n}`);
    if (s.T < 40 || s.T > 70) err.push(`${s.n}단계 시간 ${s.T}초(40~70초)`);
    const pool = D.POOL[s.pool] || [];
    if (pool.length < s.Q) err.push(`${s.n}단계 문제 은행 ${pool.length}개 < ${s.Q}문제`);
    if (tools.has(s.tool.id)) err.push(`${s.n}단계 AI 도구 중복 ${s.tool.id}`); tools.add(s.tool.id);
    if (!(s.tool.snap > 0 && s.tool.wait > 0 && s.tool.rate > 0)) err.push(`${s.n}단계 AI 3단계 값 없음`);
    const fresh = s.watch.filter((w) => !watch.has(w)); s.watch.forEach((w) => watch.add(w));
    if (!fresh.length) err.push(`${s.n}단계에 새 감시 장치가 없음`);
    if (s.self * s.T >= s.Q * 100) err.push(`${s.n}단계: 스스로만 풀어도 다 풀림(AI 쓸 이유 없음)`);
  });
  Object.entries(D.POOL).forEach(([k, arr]) => arr.forEach((q, i) => {
    if (!q.q || !q.x || q.a.length !== 3) err.push(`${k}#${i + 1} 문항 형식`);
    if (new Set(q.a).size !== 3) err.push(`${k}#${i + 1} 보기 중복`);
    q.a.forEach((o) => { if (o.length > 16) warnings.push(`${N} ${k}#${i + 1} 보기 길이 ${o.length}자: ${o}`); });
    if (q.q.length > 30) warnings.push(`${N} ${k}#${i + 1} 질문 길이 ${q.q.length}자`);
  }));
  const ends = D.ENDINGS;
  if (ends.length < 3) err.push(`엔딩 ${ends.length}개(3개 이상)`);
  if (new Set(ends.map((e) => e.id)).size !== ends.length) err.push("엔딩 id 중복");
  D.STAGES.forEach((s) => { if (!ends.some((e) => e.kind === "out" && e.stage === s.n)) err.push(`${s.n}단계 퇴장 엔딩 없음`); });
  ["probe", "true", "hollow", "self", "retry", "pass", "nerve"].forEach((id) => { if (!ends.some((e) => e.id === id)) err.push(`엔딩 ${id} 없음`); });
  // 이름은 NAME 한 곳에서만: 게임 코드·그림·소리·원고에 이름 문자열을 직접 쓰지 않음
  ["examcat.js", "examcat-art.js", "examcat-sound.js", "examcat-style.css"].forEach((f) => { if (fs.readFileSync(path.join(assetsDir, f), "utf8").replace(/^\s*(\/\/|\/\*).*$/gm, "").includes(N)) err.push(`${f}에 이름 「${N}」을 직접 씀(NAME 상수를 쓸 것)`); });
  const all = fs.readFileSync(path.join(assetsDir, "examcat-data.js"), "utf8") + ["examcat.js", "examcat-art.js", "examcat-sound.js"].map((f) => fs.readFileSync(path.join(assetsDir, f), "utf8")).join("") + JSON.stringify(INTRO) + JSON.stringify(FAQ) + JSON.stringify(EXAMCAT_PAGE);
  BANNED.forEach((w) => { if (all.includes(w)) err.push(`정책 금지어: ${w}`); });
  if (!JSON.stringify(INTRO).includes("AI 시험 부정행위 논란을 풍자한 가상의 게임이며 실존 인물과 무관합니다")) err.push("해설에 풍자·실존 인물 무관 고지 없음");
  if (err.length) throw new Error(`${N} 데이터 검사 실패 (src/assets/examcat-data.js):\n  ` + err.join("\n  "));
  return D;
}

export default function buildExamcat(h) {
  const { cfg, write, layout, crumbHtml, crumbs, faqHtml, faqLd, adSlot, esc, t, u, abs, textLen, warnings, root, reco = "", fav = "" } = h;
  const R = EXAMCAT_PAGE;
  const D = verify(warnings, path.join(root, "src", "assets"));
  const items = [["홈", "/"], ["순발력 게임", "/arcade/"], [R.title, R.path]];
  const words = textLen(INTRO) + FAQ.reduce((n, f) => n + f.a.length, 0);
  if (words < 300) warnings.push(`${N} 원고 ${words}자(300자 미만)`);
  const WATCH_NAME = { ta: "조교 펭귄", paper: "신문 보는 부장 펭귄", sleepy: "조는 감독관 2명", patrol: "안경 검사 펭귄", cctv: "CCTV", detector: "전파 탐지기" };
  const stages = D.STAGES.map((s) => `<tr><th scope="row">${s.n}. ${esc(s.name)}</th><td>${s.Q}문제 · ${s.T}초</td><td>${esc(s.watch.map((w) => WATCH_NAME[w]).join(", "))}</td><td>${esc(s.tool.name)}</td></tr>`).join("");
  const v = Date.now().toString(36);
  const body = `
${crumbHtml(items)}
<article class="tool examcat-page">
  <header class="page-head">
    <span class="eyebrow">오락실 게임</span>
    <h1>${esc(R.h1)} ${fav}</h1>
    <p class="lead">${esc(R.desc)}</p>
    <p class="fun-badge">AI 시험 부정행위 논란을 풍자한 가상의 게임이며 실존 인물과 무관해요</p>
  </header>
  <link rel="stylesheet" href="${u("/assets/examcat-style.css")}?v=${v}">
  <section class="tool-box sm-box" aria-label="게임">
    <div id="examcat" class="examcat"><div class="sm-screen"><p style="text-align:center;padding:30% 0">게임을 불러오는 중이에요…</p></div></div>
    <noscript><p class="hint">이 게임은 자바스크립트가 켜져 있어야 실행돼요.</p></noscript>
  </section>
  <p class="sm-warn"><b>풍자 게임이에요.</b> 게임 속 AI 도구와 감시 장치는 모두 지어낸 것이에요. 실제 시험에서 부정행위는 시험 무효·응시 제한으로 이어질 수 있어요.</p>
  ${adSlot("examcat-below")}
  <section class="prose">
    ${INTRO.map((b) => `<h2>${t(b.h)}</h2>${b.p.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}`).join("")}
    <h2>단계 구성</h2>
    <div class="table-wrap"><table><thead><tr><th scope="col">단계</th><th scope="col">문제·시간</th><th scope="col">감시</th><th scope="col">AI 도구</th></tr></thead><tbody>${stages}</tbody></table></div>
    <h2>조작법</h2>
    <div class="table-wrap"><table><thead><tr><th scope="col">하는 일</th><th scope="col">PC</th><th scope="col">휴대폰</th></tr></thead><tbody>${CONTROLS.map(([a, b, c]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join("")}</tbody></table></div>
  </section>
  ${reco}
  ${faqHtml(FAQ)}
  ${adSlot("examcat-faq")}
</article>`;
  const ld = [crumbs(items), faqLd(FAQ), { "@context": "https://schema.org", "@type": "VideoGame", name: R.h1, url: abs(R.path), description: R.desc, genre: ["Casual", "Comedy"], gamePlatform: "Web browser", applicationCategory: "Game", operatingSystem: "Any", inLanguage: "ko", isAccessibleForFree: true, publisher: { "@type": "Organization", name: cfg.operator } }];
  write(R.path, layout({ title: R.seo, desc: R.desc, path: R.path, body, scripts: ["examcat-data.js", "examcat-art.js", "examcat-sound.js", "examcat.js"], jsonld: ld, fullTitle: false }));
  return R;
}
