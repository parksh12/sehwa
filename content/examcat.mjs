// P2-74c 「커닝냥이 — 감독관을 피해서 만점을 맞아라!」 페이지 — build.mjs가 빌드 도구를 넘겨 호출합니다.
// 게임 코드는 src/assets/examcat-data.js · examcat-art.js · examcat-sound.js · examcat.js(+ 순위 rank.js), 전용 CSS는 examcat-style.css (외부 에셋 0)
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
const N = DATA.NAME, SUB = DATA.SUB, EX = DATA.EXAM, SC = DATA.SCORE;

export const EXAMCAT_PAGE = {
  id: "examcat",
  path: "/arcade/cunning-nyang/",
  title: N,
  seo: `${N} — ${SUB} AI 시험 부정행위 풍자 게임`,
  h1: `${N} — ${SUB}`,
  desc: `꾹 누르면 치팅, 떼면 숨김. 고양이 수험생 ${N}가 펭귄 감독관의 눈을 피해 3분 동안 몰래 정답을 모으는 AI 부정행위 풍자 게임. 감독관이 볼 때 누르고 있으면 그대로 퇴장당해요. 오래 버틸수록 점수가 오르고, 순위는 이번 주와 역대로 따로 매겨요.`,
  hook: "꾹 누르면 치팅, 감독관이 보면 떼기. 3분 버티고 순위 도전!",
  meta: "꾹 누르기 하나 · 3분 · 순위",
};

const INTRO = [
  { h: "어떤 게임인가요", p: `선생님 몰래 과자 먹기처럼, 감독관 몰래 치팅하는 게임이에요. 조작은 하나예요. 화면 아래 큰 버튼(PC는 Space나 마우스)을 꾹 누르고 있으면 치팅, 떼면 숨김이에요. 누르고 있는 동안 게이지가 「찰칵 → 전송 → 정답 듣기」 순서로 차오르고, 끝까지 차면 정답 1개를 얻어요. 손을 떼도 게이지는 그대로 남아요.\n대신 감독관이 보고 있을 때 누르고 있으면 그 자리에서 퇴장이에요. 시험은 ${EX.T / 60}분 고정이고, 끝까지 버티면 완주 보너스를 받아요.` },
  { h: "감독관을 읽으면 이겨요", p: "감독관은 돌아보기 직전에 반드시 예고를 해요. 노란 점선 부채꼴이 「곧 볼 곳」, 빨간 부채꼴이 「지금 보는 곳」이에요. 조교 펭귄은 고개를 갸웃(?)하고, 부장 펭귄은 신문 모서리를 접어 눈을 내밀고, 안경 검사 펭귄은 뒤로 다가올수록 발자국 표시와 발소리가 커져요. CCTV는 정해진 폭으로 천천히 왔다 갔다 해요. 신호를 보고 손을 떼면 안 들켜요. 운보다 눈치로 하는 게임이죠." },
  { h: "시간이 갈수록 감시가 늘어요", p: "처음에는 조교 펭귄 한 명이에요. 40초부터 「감독관 4명 배치 완료」라고 써 붙였지만 두 명은 졸고 있고, 신문 보는 부장 펭귄이 진짜 감시를 맡아요. 80초부터 CCTV와 안경 검사 펭귄이, 130초부터는 오래 누르고 있으면 경보가 울리는 전파 탐지기가 등장해요. 시간이 갈수록 감독관이 더 자주 돌아보고, 예고만 하고 돌아보지 않는 가짜 동작도 늘어요." },
  { h: "점수와 순위", p: `점수는 하나의 정수예요. 누르고 있던 시간 0.01초마다 1점, 정답 1개마다 ${SC.answer}점, ${EX.T / 60}분 완주에 ${SC.finish.toLocaleString("ko-KR")}점을 더해요. 이론상 최고 점수는 ${SC.max.toLocaleString("ko-KR")}점이에요. 결과 화면에서 이번 주 순위와 역대 순위 TOP10에 들면 닉네임을 정해 순위에 올릴 수 있어요. 「순위에 올리기」를 고르지 않으면 아무것도 전송하지 않아요. 순위는 매주 월요일 0시(한국 시각)에 새로 시작해요.` },
  { h: "풍자 게임이에요", p: `${N}는 AI 시험 부정행위 논란을 풍자한 가상의 게임이며 실존 인물과 무관합니다. 시험에서 몰래 AI를 쓰는 일이 사회 문제로 떠오르면서, 그 모습을 과장해 웃어 보려고 만들었어요. 실제 부정행위를 권하지 않아요. 게임 속 단추 카메라·전송·꼬리 이어폰과 감시 장치는 작동 원리 없이 버튼을 누르면 나오는 우스운 연출로만 그렸어요. 실제 시험에서 부정행위는 시험 무효나 응시 제한 같은 무거운 불이익으로 이어질 수 있어요. 결과 화면의 말처럼, AI로 딴 점수는 내 실력이 아니니까요.` },
];
const CONTROLS = [
  ["치팅(게이지 채우기)", "Space 꾹 누르기 또는 그림·버튼을 마우스로 꾹", "화면 아래 큰 버튼 꾹 누르기(그림을 꾹 눌러도 됨)"],
  ["숨기기", "Space·마우스에서 손 떼기", "버튼에서 손 떼기"],
  ["일시정지", "Esc 또는 P, 오른쪽 위 버튼", "오른쪽 위 일시정지 버튼"],
  ["소리 끄기·켜기", "오른쪽 위 스피커 버튼", "오른쪽 위 스피커 버튼"],
];
const FAQ = [
  { q: "실제 시험에 써먹을 방법이 나와요?", a: "아니요. 이 게임은 AI 시험 부정행위 논란을 풍자한 가상의 게임이에요. 단추 카메라, 전송, 꼬리 이어폰 같은 도구와 펭귄 감독관, 전파 탐지기는 모두 지어낸 것이고 버튼을 누르면 나오는 연출일 뿐이에요. 실제 기기나 앱의 작동 원리, 시험 감독을 피하는 요령은 담지 않았어요. 실제 시험에서 부정행위는 시험 무효나 응시 제한으로 이어질 수 있으니 절대 하지 마세요." },
  { q: "실제 사건이나 인물 이야기예요?", a: `아니요. ${N}와 등장인물, 시험은 모두 지어낸 것이고 실존 인물과 무관합니다. 시험에서 AI를 몰래 쓰는 일이 논란이 되는 사회 현상을 과장해서 풍자했을 뿐, 특정 사람이나 사건을 그리지 않았어요.` },
  { q: "운이 나쁘면 그냥 들키는 거 아닌가요?", a: "감독관은 돌아보기 전에 항상 예고를 해요(노란 점선과 「?」, 신문 접기, 발소리). 예고는 처음 1초에서 마지막 0.7초로 짧아지지만 손을 떼기에는 충분해요. CCTV는 예고 대신 움직임이 늘 보이고, 냥이 쪽으로 다가오면 빨간 불이 빨리 깜박여요. 예고만 하고 돌아보지 않는 가짜 동작도 있는데, 떼고 기다리면 손해는 시간뿐이에요." },
  { q: "점수는 어떻게 계산해요?", a: `누르고 있던 시간 0.01초마다 1점, 정답 1개(게이지 한 바퀴, ${EX.fill}초)마다 ${SC.answer}점, ${EX.T / 60}분을 버티면 완주 보너스 ${SC.finish.toLocaleString("ko-KR")}점이에요. 퇴장해도 그때까지 모은 점수는 남지만 완주 보너스는 없어요. 이론상 최고 점수는 ${SC.max.toLocaleString("ko-KR")}점이에요.` },
  { q: "순위는 어떻게 올리나요?", a: "결과 화면에서 이번 주 또는 역대 TOP10 안에 들면 닉네임(1~10자)을 정해 「순위에 올리기」를 누를 수 있어요. 한 번 정한 닉네임은 이 기기에 기억되고, 다음부터는 더 좋은 기록이 나오면 자동으로 바뀌어요. 이번 주 순위는 매주 월요일 0시(한국 시각)에 새로 시작해요. 순위표를 불러오지 못하면 게임은 그대로 되고, 순위 자리에 「잠시 후 다시」 안내만 나와요." },
  { q: "기록은 어디에 남아요?", a: "이 기기의 브라우저 저장 공간(localStorage)에는 최고 점수, 플레이 횟수, 소리 설정만 남아요. 순위에 올리기를 고른 경우에만 닉네임·점수·익명 식별자·기록 시각이 순위표(Google Firebase)에 저장돼요. 자세한 내용은 개인정보처리방침에 있어요." },
  { q: "탭을 옮겼더니 게임이 멈췄어요.", a: "다른 탭으로 가거나, 창을 전환하거나, 화면 너비가 바뀌면 게임이 자동으로 일시정지되고 누르던 버튼도 떼어져요. 「계속하기」를 누르면 멈춘 곳부터 이어서 해요." },
  { q: "그림은 어떻게 만들었나요?", a: `이미지 파일 없이 브라우저 캔버스에 곡선과 면을 직접 그리는 벡터 일러스트 방식이에요. ${N}, 펭귄 감독관, 교실은 모두 이 게임을 위해 새로 그렸고, 효과음도 음원 파일 없이 브라우저에서 바로 합성해요. 다른 게임이나 캐릭터를 본뜨지 않았어요.` },
];

// 금지어(첫 두 개는 쓰지 않기로 한 옛 가칭이라 글자 그대로 두지 않음): 실존 AI 서비스·기기·메신저 이름, 실제 회피 요령으로 읽힐 표현, 실존 인물을 떠올리게 하는 표현(정책·명예 안전, P2-74)
const BANNED = [String.fromCharCode(0xC138, 0xBB34, 0xB0E5), "s" + "emunyang", "수석", "397", "ChatGPT", "챗GPT", "챗지피티", "GPT-4", "Gemini", "제미나이", "Claude", "클로드", "Copilot", "코파일럿", "갤럭시", "아이폰", "iPhone", "에어팟", "AirPods", "카카오톡", "카톡", "텔레그램", "스마트워치", "블루투스", "무선 이어폰", "커닝 페이퍼", "커닝페이퍼", "몰래 보는 법", "들키지 않는 법", "치팅 방법", "부정행위 방법", "자수", "경찰"];

function verify(warnings, assetsDir) {
  const D = DATA, err = [];
  if (D.EXAM.T !== 180) err.push(`시험 시간 ${D.EXAM.T}초(3분 고정)`);
  if (D.GAUGE.length !== 3) err.push("치팅 게이지는 찰칵·전송·정답 듣기 3칸");
  D.PHASES.forEach((p, i) => { if (p.tell < 0.6) err.push(`감시 ${i + 1} 예고 ${p.tell}초(0.6초 이상이어야 손을 뗄 수 있음)`); if (i && p.from <= D.PHASES[i - 1].from) err.push("감시 추가 순서 오류"); });
  // 점수 상한 = 이론상 최대(데이터 계산값) = rank.js·Firebase 규칙 상한
  const max = D.EXAM.T * D.SCORE.perSec + Math.floor(D.EXAM.T / D.EXAM.fill) * D.SCORE.answer + D.SCORE.finish;
  if (max !== D.SCORE.max) err.push("점수 상한 계산 불일치");
  const rank = fs.readFileSync(path.join(assetsDir, "rank.js"), "utf8");
  const m = /examcat:[^\n]*ok: \(s\) => s >= 1 && s <= (\d+)/.exec(rank);
  if (!m || +m[1] !== max) err.push(`rank.js examcat 상한(${m ? m[1] : "없음"})이 이론상 최대 ${max}와 다름`);
  ["teacher", "camera", "alarm", "finish"].forEach((k) => { if (!D.ENDS[k]) err.push(`결과 장면 ${k} 없음`); });
  if (!D.MSG.includes("AI로 딴 점수는 내 실력이 아니다")) err.push("풍자 메시지 없음");
  // 이름은 NAME 한 곳에서만: 게임 코드·그림·소리·CSS에 이름 문자열을 직접 쓰지 않음
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
  const phases = D.PHASES.map((p) => `<tr><th scope="row">${p.from}초부터</th><td>${esc(p.add.map((w) => WATCH_NAME[w]).join(", "))}</td><td>${p.tell}초</td></tr>`).join("");
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
  <p class="sm-warn"><b>풍자 게임이에요.</b> 게임 속 도구와 감시 장치는 모두 지어낸 것이에요. 실제 시험에서 부정행위는 시험 무효·응시 제한으로 이어질 수 있어요.</p>
  ${adSlot("examcat-below")}
  <section class="prose">
    ${INTRO.map((b) => `<h2>${t(b.h)}</h2>${b.p.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}`).join("")}
    <h2>감시가 늘어나는 순서</h2>
    <div class="table-wrap"><table><thead><tr><th scope="col">언제</th><th scope="col">새 감시</th><th scope="col">돌아보기 예고</th></tr></thead><tbody>${phases}</tbody></table></div>
    <h2>조작법</h2>
    <div class="table-wrap"><table><thead><tr><th scope="col">하는 일</th><th scope="col">PC</th><th scope="col">휴대폰</th></tr></thead><tbody>${CONTROLS.map(([a, b, c]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join("")}</tbody></table></div>
  </section>
  <section class="rank-page" data-rank-game="${DATA.SLUG}" aria-label="순위표"></section>
  ${reco}
  ${faqHtml(FAQ)}
  ${adSlot("examcat-faq")}
</article>`;
  const ld = [crumbs(items), faqLd(FAQ), { "@context": "https://schema.org", "@type": "VideoGame", name: R.h1, url: abs(R.path), description: R.desc, genre: ["Casual", "Comedy"], gamePlatform: "Web browser", applicationCategory: "Game", operatingSystem: "Any", inLanguage: "ko", isAccessibleForFree: true, publisher: { "@type": "Organization", name: cfg.operator } }];
  write(R.path, layout({ title: R.seo, desc: R.desc, path: R.path, body, scripts: ["examcat-data.js", "rank.js", "examcat-art.js", "examcat-sound.js", "examcat.js"], jsonld: ld, fullTitle: false }));
  return R;
}
