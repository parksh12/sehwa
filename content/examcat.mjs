// P2-74·74b 「커닝냥이 — 감독관을 피해서 만점을 맞아라!」 페이지 — build.mjs가 빌드 도구를 넘겨 호출합니다.
// 게임 코드는 src/assets/examcat-data.js · examcat-art.js · examcat-sound.js · examcat.js, 전용 CSS는 examcat-style.css (외부 에셋 0, 서버 전송 0)
// ★ 게임 이름은 src/assets/examcat-data.js의 NAME 한 곳에서만 정함. 이 원고·메타·TOOLS 항목은 모두 그 값을 가져다 씀.
// AI 시험 부정행위 논란을 풍자한 가상의 게임이며 실존 인물과 무관. 실제 부정행위 방법(실존 기기·앱 사용법, 시험 회피 요령)은 넣지 않고, 빌드 때 금지어 검사를 함.
// 문제 은행(세법)의 근거 조문 대조는 scripts/examcat-law-verify.py(국가법령정보센터 현행 조문)로 하고, 빌드는 형식·근거 필드만 검사함.
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
const N = DATA.NAME, SUB = DATA.SUB, EX = DATA.EXAM, SU = DATA.SUSP;

export const EXAMCAT_PAGE = {
  id: "examcat",
  path: "/arcade/cunning-nyang/",
  title: N,
  seo: `${N} — ${SUB} AI 시험 부정행위 풍자 게임`,
  h1: `${N} — ${SUB}`,
  desc: `고양이 수험생 ${N}가 펭귄 감독관의 눈을 피해 세법 시험 ${EX.Q}문제에 도전하는 AI 부정행위 풍자 게임. 문제마다 화면에 나온 키를 눌러 찍기·전송·정답 듣기·답 쓰기를 해요. ${EX.Q}문제 모두 정답에 의심 ${EX.limit}초 미만이면 성공, 너무 잘 보면 사후 조사까지. 한 판 5분 이내.`,
  hook: `찍고, 보내고, 듣고, 쓰고. 세법 ${EX.Q}문제를 의심 ${EX.limit}초 안에 만점?`,
  meta: `세법 ${EX.Q}문제 · 5분 이내 · 엔딩 ${DATA.ENDINGS.length}개`,
};

const INTRO = [
  { h: "어떤 게임인가요", p: `고양이 수험생 「${N}」가 냥국 세법 자격시험을 봅니다. 문제는 사법시험·세무사 2차 수준의 세법 법리 ${EX.Q}문제. 혼자서는 도저히 풀 수 없어서, 냥이는 가상의 AI에 기대기로 합니다. 한 문제마다 ① 단추 카메라로 시험지 찍기 → ② 전송 → ③ 꼬리 이어폰으로 정답 듣기 → ④ 들은 번호로 답 쓰기, 네 단계를 거쳐야 해요. 단계마다 화면에 누를 키가 나오고, 키는 문제와 단계마다 바뀝니다(휴대폰은 화면의 키 버튼 5개 중에서 고르기).\n성공 조건은 두 가지예요. ${EX.Q}문제를 모두 맞히고, 의심받은 시간이 모두 합쳐 ${EX.limit}초 미만이어야 합니다. 화면 위에 「의심 n.n초 / ${EX.limit}초」가 계속 보여요.` },
  { h: "감독관을 읽으면 이겨요", p: `감독관은 돌아보기 직전에 반드시 예고를 해요. 노란 점선 부채꼴이 「곧 볼 곳」, 빨간 부채꼴이 「지금 보는 곳」이에요. 빨간 부채꼴 안에서 찍기·전송·듣기를 하면 들킨 것으로 처리되어 의심이 ${SU.bust}초 늘고, 그 단계를 다시 해야 해요. 틀린 키를 누르면 감시 밖에서는 ${SU.keyOut}초, 감시 안에서는 ${SU.keyIn}초가 늘어요. 조교 펭귄은 고개를 갸웃(?)하고, 부장 펭귄은 신문 모서리를 접어 눈을 내밀고, 안경 검사 펭귄은 뒤로 다가올수록 발자국 표시와 발소리가 커져요. 운이 아니라 관찰과 타이밍으로 푸는 게임이에요.` },
  { h: "문제가 진행될수록 감시가 늘어요", p: "처음에는 조교 펭귄 한 명이 일정하게 돌아봐요. 3번 문제부터는 「감독관 4명 배치 완료」라고 써 붙였지만 두 명은 졸고 있고, 아무 때나 신문을 내리며 가짜 동작도 하는 부장 펭귄이 진짜 감시를 맡아요. 5번 문제부터는 「CCTV 없는 시험장」이라는 말이 무색하게 CCTV가 새로 달리고 안경 검사 펭귄이 뒤를 돌아요. 8번 문제부터는 찍기·전송·듣기를 할 때마다, AI가 답을 만드는 동안에도 눈금이 차는 전파 탐지기까지 등장합니다. 등장하는 도구는 모두 과장된 가상의 물건이에요." },
  { h: "만점을 맞으면 끝일까요?", p: `${EX.Q}문제를 모두 맞히고 의심 ${EX.limit}초를 넘기지 않으면 시험은 성공이에요. 그런데 점수가 너무 좋으면 「너무 잘 봤는데?」 사후 조사가 열려요. 시험 때 AI로 푼 문제가 많을수록 조사 게이지가 높게 시작하고, 조사관은 시험에 나왔던 조문을 AI 없이 다시 물어봐요. 설명을 못 하면 들통나서 합격이 취소됩니다. 정답 공개 때 보여 주는 근거 조문과 해설을 잘 읽어 두면 통과할 수 있어요. 실패에도 이유별 엔딩이 있어서(감시 종류별 퇴장, 틀린 키, 오답, 시간 초과) 모두 ${DATA.ENDINGS.length}가지 엔딩을 엔딩 도감에 모을 수 있어요.` },
  { h: "시험 문제는 실제 세법이에요", p: `문제 은행은 국세기본법·소득세법·법인세법·부가가치세법·상속세 및 증여세법의 법리·요건·예외 ${DATA.BANK.length}문항이고, 한 판에 ${EX.Q}문제를 무작위로 뽑아요. 경정청구·수정신고 기한, 부과제척기간, 납세의무 성립·확정 시기, 실질과세, 제2차 납세의무, 불복 절차, 거주자·과세기간, 손익 귀속, 재화 공급의 특례, 사전증여재산 합산처럼 오래 유지되는 내용을 골랐고, 해마다 바뀌는 금액·세율은 피했어요. 문항마다 근거 조문(법·조·항)을 달고 국가법령정보센터의 현행 조문과 한 문장씩 대조했어요. 다만 게임용 요약이라 예외와 단서를 다 담지는 못하니, 실제 신고·불복은 법령 원문과 전문가의 확인을 받으세요.` },
  { h: "풍자 게임이에요", p: `${N}는 AI 시험 부정행위 논란을 풍자한 가상의 게임이며 실존 인물과 무관합니다. 최근 시험에서 몰래 AI를 쓰는 일이 사회 문제로 떠오르자, 그 모습을 과장해서 웃어 보자는 뜻으로 만들었어요. 실제 부정행위를 권하지 않으며, 게임 속 도구와 감시 장치는 작동 원리 없이 키를 누르면 나오는 우스운 연출로만 그렸어요. 실제 시험에서 부정행위는 시험 무효나 응시 제한 같은 무거운 불이익으로 이어질 수 있어요. 게임의 결말처럼, AI로 딴 점수는 내 실력이 아니니까요.` },
];
const CONTROLS = [
  ["① 찍기 · ② 전송 · ③ 듣기", "화면에 나온 영문 키(예: F) 누르기", "화면 아래 키 버튼 5개 중 같은 글자 누르기"],
  ["④ 답 쓰기", "들은 번호 1 · 2 · 3", "보기 버튼 누르기"],
  ["답을 직접 고르기(AI 없이)", "아무 단계에서나 1 · 2 · 3", "보기 버튼 누르기"],
  ["일시정지", "Esc, 오른쪽 위 버튼", "오른쪽 위 일시정지 버튼"],
  ["소리 끄기·켜기", "오른쪽 위 스피커 버튼", "오른쪽 위 스피커 버튼"],
];
const FAQ = [
  { q: "실제 시험에서 쓸 수 있는 방법이 나오나요?", a: "아니요. 이 게임은 AI 시험 부정행위 논란을 풍자한 가상의 게임이에요. 단추 카메라, 전송, 꼬리 이어폰 같은 도구와 펭귄 감독관, 전파 탐지기는 모두 지어낸 것이고 키를 누르면 나오는 연출일 뿐이에요. 실제 기기나 앱의 작동 원리, 시험 감독을 피하는 요령은 담지 않았어요. 실제 시험에서 부정행위는 시험 무효나 응시 제한으로 이어질 수 있으니 절대 하지 마세요." },
  { q: "실제 사건이나 인물을 다룬 게임인가요?", a: `아니요. ${N}와 등장인물, 시험, 점수는 모두 지어낸 것이고 실존 인물과 무관합니다. 시험에서 AI를 몰래 쓰는 일이 논란이 되는 사회 현상을 과장해서 풍자했을 뿐, 특정 사람이나 사건을 그리지 않았어요.` },
  { q: "성공 조건이 정확히 뭔가요?", a: `${EX.Q}문제를 모두 맞히고, 의심받은 시간의 합계가 ${EX.limit}초 미만이면 성공이에요. 감시 안에서 찍기·전송·듣기를 하면 한 번에 ${SU.bust}초, 틀린 키는 감시 밖 ${SU.keyOut}초·감시 안 ${SU.keyIn}초, 전파 탐지기 경보는 1초가 더해져요. 한 문제라도 틀리거나 제한 시간 ${EX.T}초가 지나면 실패예요.` },
  { q: "운이 나쁘면 그냥 들키는 거 아닌가요?", a: "감독관은 돌아보기 전에 항상 예고를 해요. 노란 점선 부채꼴이 나타나면 곧 그쪽을 본다는 뜻이고, 빨간 부채꼴 안에서 찍기·전송·듣기를 할 때만 들켜요. AI가 답을 만드는 동안이나 키를 누르지 않는 동안에는 들키지 않아요. 예고는 처음 1초에서 마지막 0.75초로 짧아지지만, 언제나 가장 긴 동작보다 길어요. 「?」가 보이지 않을 때 누른 동작은 감독관이 돌아보기 전에 끝나요. 부장 펭귄의 가짜 동작은 점선이 어디를 가리키는지 보면 구분할 수 있어요." },
  { q: "키를 외우면 되나요?", a: "누를 키는 문제와 단계마다 무작위로 바뀌어요. 화면에 나온 키를 보고 누르세요. 휴대폰에서는 키 버튼 5개의 자리도 매번 섞여요. 한글 입력 상태여도 키보드 자판 위치로 알아들어요." },
  { q: "만점을 맞았는데 왜 들통났어요?", a: "성공하면 「너무 잘 봤는데?」 사후 조사가 열려요. 시험 때 AI로 푼 비율이 높을수록 조사 게이지가 높게 시작하고, 조사관이 시험 문제를 다시 물어볼 때 맞히면 내려가고 틀리면 올라가요. 틀렸을 때나 마지막에 70% 이상이면 들통이에요. 정답 공개 때 나오는 근거 조문과 해설을 잘 읽어 두면 통과할 수 있어요." },
  { q: "AI 없이 풀 수도 있나요?", a: "답을 정말 안다면 어느 단계에서든 보기(숫자 키)를 직접 눌러 바로 답할 수 있어요. 다만 세법 법리 문제라 틀리면 그 자리에서 실패예요. AI를 거의 쓰지 않고 성공한 뒤 사후 조사까지 넘기면 진짜 엔딩을 볼 수 있어요." },
  { q: "한 판에 얼마나 걸려요?", a: `시험 제한 시간은 ${EX.T}초이고(정답 공개와 감시 안내 화면에서는 시계가 멈춰요), 안내와 사후 조사까지 합쳐도 5분 안에 끝나요.` },
  { q: "시험 문제의 세법 내용은 정확한가요?", a: `문항마다 근거 조문을 달고 국가법령정보센터의 현행 법령 원문과 대조했어요. 금액·세율처럼 자주 바뀌는 내용은 피했지만, 법이 개정되면 달라질 수 있어요. 게임용으로 줄인 문장이라 예외와 단서를 다 담지 못했으니 실제 신고·불복은 법령 원문과 전문가의 확인을 받으세요.` },
  { q: "기록은 어디에 저장되나요?", a: "최고 기록, 모은 엔딩, 소리 설정은 지금 쓰는 브라우저의 저장 공간(localStorage)에만 남고 서버로 보내지 않아요. 이 게임에는 순위표가 없어요. 엔딩 도감의 「기록 지우기」나 브라우저의 사이트 데이터 삭제로 지울 수 있어요. 결과 카드 이미지에도 이름 같은 개인정보는 들어가지 않아요." },
  { q: "탭을 옮겼더니 게임이 멈췄어요.", a: "다른 탭으로 가거나, 창을 전환하거나, 화면 너비가 바뀌면 시험 중이던 게임이 자동으로 일시정지돼요. 「계속하기」를 누르면 멈춘 곳부터 이어서 해요." },
  { q: "그림은 어떻게 만들었나요?", a: `이미지 파일 없이 브라우저 캔버스에 곡선과 면을 직접 그리는 벡터 일러스트 방식이에요. ${N}, 펭귄 감독관, 교실은 모두 이 게임을 위해 새로 그렸고, 효과음도 음원 파일 없이 브라우저에서 바로 합성해요. 다른 게임이나 캐릭터를 본뜨지 않았어요.` },
];

// 금지어(첫 두 개는 쓰지 않기로 한 옛 가칭이라 글자 그대로 두지 않음): 실존 AI 서비스·기기·메신저 이름, 실제 회피 요령으로 읽힐 표현, 실존 인물을 떠올리게 하는 표현(정책·명예 안전, P2-74)
const BANNED = [String.fromCharCode(0xC138, 0xBB34, 0xB0E5), "s" + "emunyang", "수석", "397", "ChatGPT", "챗GPT", "챗지피티", "GPT-4", "Gemini", "제미나이", "Claude", "클로드", "Copilot", "코파일럿", "갤럭시", "아이폰", "iPhone", "에어팟", "AirPods", "카카오톡", "카톡", "텔레그램", "스마트워치", "블루투스", "무선 이어폰", "커닝 페이퍼", "커닝페이퍼", "몰래 보는 법", "들키지 않는 법", "치팅 방법", "부정행위 방법", "자수", "경찰"];
const LAWS = ["국세기본법", "소득세법", "법인세법", "부가가치세법", "상속세 및 증여세법"];

function verify(warnings, assetsDir) {
  const D = DATA, err = [];
  // 한 판 5분 이내: 시험 제한 + 감시 안내(4장) + 정답 공개(문제당 최대 2.4초, 시계 멈춤) + 사후 조사(문항당 약 15초) + 타이틀·결과 여유 30초
  const budget = D.EXAM.T + D.PHASES.length * 8 + D.EXAM.Q * 2.4 + D.PROBE.n * 15 + 30;
  if (budget > 300) err.push(`한 판 예상 ${Math.round(budget)}초(300초 이하여야 함)`);
  if (D.EXAM.Q !== 10) err.push(`문제 수 ${D.EXAM.Q}(10이어야 함)`);
  if (D.BANK.length < 30) err.push(`문제 은행 ${D.BANK.length}문항(30 이상)`);
  if (D.STEPS.length !== 4) err.push("한 문제 4단계가 아님");
  const longest = Math.max(...D.STEPS.filter((x) => x.dur).map((x) => x.dur));
  D.PHASES.forEach((p) => { if (p.tell < longest + 0.15) err.push(`문제 ${p.from}~ 예고 ${p.tell}초가 가장 긴 동작 ${longest}초 + 0.15초보다 짧음(피할 수 없는 들킴)`); });
  if (D.KEYS.count < 4 || D.KEYS.count > 6) err.push(`키 버튼 ${D.KEYS.count}개(4~6개)`);
  if (D.PHASES[0].from !== 1 || D.PHASES.some((p, i) => i && p.from <= D.PHASES[i - 1].from) || D.PHASES[D.PHASES.length - 1].from > D.EXAM.Q) err.push("감시 추가 순서 오류");
  const seen = new Set();
  D.BANK.forEach((q, i) => {
    const id = `#${i + 1}`;
    if (!q.q || !q.x || !Array.isArray(q.a) || q.a.length !== 3) err.push(`${id} 문항 형식`);
    if (new Set(q.a).size !== 3) err.push(`${id} 보기 중복`);
    if (!LAWS.includes(q.law)) err.push(`${id} 근거 법령 이름: ${q.law}`);
    if (!/^제\d+조(의\d+)?( 제\d+항)?( 제\d+호)?$/.test(q.jo || "")) err.push(`${id} 근거 조문 형식: ${q.jo}`);
    if (!Array.isArray(q.quote) || !q.quote.length || q.quote.some((s) => s.length < 6)) err.push(`${id} 대조 문장 없음`);
    if (seen.has(q.q)) err.push(`${id} 질문 중복`); seen.add(q.q);
    if (/\d+(만|억|천)?원|\d+(\.\d+)?%/.test(q.a.join(" ") + q.q)) warnings.push(`${N} ${id} 금액·세율이 들어 있음(해마다 바뀔 수 있음)`);
    q.a.forEach((o) => { if (o.length > 26) warnings.push(`${N} ${id} 보기 길이 ${o.length}자: ${o}`); });
    if (q.q.length > 48) warnings.push(`${N} ${id} 질문 길이 ${q.q.length}자`);
  });
  const ends = D.ENDINGS;
  if (new Set(ends.map((e) => e.id)).size !== ends.length) err.push("엔딩 id 중복");
  ["ta", "paper", "cctv", "patrol", "detector"].forEach((k) => { if (!ends.some((e) => e.kind === "out" && e.by === k)) err.push(`퇴장 엔딩(${k}) 없음`); });
  ["fumble", "wrong", "timeout", "probe", "true", "hollow"].forEach((id) => { if (!ends.some((e) => e.id === id)) err.push(`엔딩 ${id} 없음`); });
  if (!ends.find((e) => e.id === "true").msg.includes("AI로 딴 점수는 내 실력이 아니다")) err.push("진짜 엔딩 메시지 없음");
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
  const phases = D.PHASES.map((p, i) => `<tr><th scope="row">${p.from}번 문제부터</th><td>${esc(p.add.map((w) => WATCH_NAME[w]).join(", "))}</td><td>${p.tell}초</td></tr>`).join("");
  const lawCount = {}; D.BANK.forEach((q) => { lawCount[q.law] = (lawCount[q.law] || 0) + 1; });
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
    <h2>문제 은행</h2>
    <div class="table-wrap"><table><thead><tr><th scope="col">법령</th><th scope="col">문항 수</th></tr></thead><tbody>${Object.entries(lawCount).map(([k, n]) => `<tr><th scope="row">${esc(k)}</th><td>${n}</td></tr>`).join("")}</tbody></table></div>
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
