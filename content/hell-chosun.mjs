// P2-28 「헬조선에서 살아남기」 페이지 — build.mjs가 빌드 도구를 넘겨 호출합니다.
// 게임 코드: src/assets/hell-art.js·hell-sound.js(P2-27 엔진 재사용) + hell-chosun-data.js·hell-chosun-art.js·hell-chosun.js, 스타일: hell-style.css
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export const HC_PAGE = {
  path: "/story/hell-chosun/",
  title: "헬조선에서 살아남기",
  seo: "헬조선에서 살아남기 — 0세부터 80세까지 병맛 인생 생존 게임",
  h1: "헬조선에서 살아남기 — 0세부터 80세까지 40단계",
  desc: "자산·체력·멘탈·눈치 네 가지 스탯을 지키며 0세부터 80세까지 40단계를 버티는 병맛 인생 생존 게임. 상식대로 고르면 대개 죽어요. 사망 도감 44장, 엔딩 4종, 다음 생으로 넘어가는 유산 보너스까지.",
  hook: "자산·체력·멘탈·눈치 중 하나라도 바닥나면 끝. 80세까지 버티기.",
  meta: "40단계 · 15~30분 · 엔딩 4종",
};

const INTRO = [
  { h: "어떤 게임인가요", p: "태어나자마자 첫 울음소리부터 선택이 시작돼요. 0세부터 80세까지 40단계, 단계마다 A와 B 두 선택지 가운데 하나를 고릅니다. 한쪽은 스탯을 바꾸며 다음 나이로 넘어가고, 다른 한쪽은 대개 황당한 슬랩스틱 사망으로 이어져요. 수능 날 경찰 오토바이를 탔더니 배달 라이더였고, 정석대로 적립식 투자를 했더니 분석만 하다 탈모로 파산하는, 상식이 뒤집힌 블랙 유머 인생 게임입니다.\n한 회차는 처음 하는 분 기준으로 재도전을 포함해 15~30분 정도 걸리도록 만들었어요(내부 시험 플레이 기준 추정)." },
  { h: "4대 스탯과 눈치", p: "화면 위에는 자산, 체력, 멘탈, 눈치가 항상 보여요. 자산이 0원 아래로 내려가면 「채권자 추심사」, 체력이 0%가 되면 「과로사」(커피를 들이켠 뒤라면 「카페인 중독사」), 멘탈이 0%가 되면 「멘탈 분쇄 자연발화사」로 끝납니다. 19세가 되면 「빚 상환 의무」 패시브가 붙어 단계마다 생활비가 빠지고, 나이가 들수록 체력도 조금씩 줄어요.\n눈치는 이 게임의 생명줄이에요. 눈치가 40% 이상일 때 즉사 선택을 고르면 「쎄한 느낌」에 직전에 발을 빼고 살아남는 대신 눈치와 멘탈이 깎입니다. 장이 끝날 때마다 열리는 「정비 시간」에 헬스장, 혼자 노래방, 주말 알바, 눈치 학원 가운데 하나를 골라 가장 위험한 스탯을 챙기세요." },
  { h: "5개 장과 테크 트리", p: "1장 영유아·학창 시절(0~18세)은 아기자기한 방, 2장 대학·취업 낭인기(19~29세)는 곰팡이 핀 반지하, 3장 직장 노예·대출 잔혹사(30~49세)는 파티션에 둘러싸인 야근 오피스, 4장 중년 자영업(50~64세)은 치킨집 주방, 5장 황혼 은퇴·국민연금 쟁탈전(65~80세)은 노을 진 공원이 무대예요. 장이 바뀔 때마다 주인공 옷차림(교복, 후드티, 다크서클 양복, 앞치마, 백발과 지팡이), 배경, 화면 색, 배경 음악이 함께 바뀝니다.\n직업은 알바생에서 딸깍충, 중소기업 「영혼 맷집가」, 치킨집 사장을 거쳐 수상한 비둘기 교단 교주까지, 주거는 옥탑방 계단 밑에서 반지하 수중 보금자리, 깡통 전세 펜트하우스, 대출금 남은 5평 아파트로 이어져요." },
  { h: "80세 엔딩과 환생(유산)", p: "80세 관문을 넘기면 그때의 스탯에 따라 「국민연금 완전 고갈 전 수령 엔딩」, 「헬조선 사이보그 엔딩」, 「불사조 흙수저 엔딩」 가운데 하나를 보게 되고, 조건이 까다로운 숨은 엔딩도 하나 있어요. 죽거나 엔딩을 보면 장 처음부터 다시 하거나 0세로 환생할 수 있습니다. 오래 살수록, 엔딩을 많이 볼수록 다음 생은 눈치·멘탈·자산을 조금 더 가진 채로 시작해요(유산 보너스).\n사망 장면은 사망 도감에 모이고(스테이지 사망 40장 + 스탯 사망 4장), 마음에 드는 죽음이나 엔딩은 세로형(9:16) 공유 카드로 저장할 수 있어요." },
  { h: "Life Game과 무엇이 다른가요", p: "같은 오락실의 「Life Game」은 진학·결혼·직업 같은 갈림길을 고르며 한 사람의 일생을 차분하게 따라가는 이야기 게임이에요. 정답도 사망도 없고, 고른 길에 따라 다른 인생 유형이 나옵니다. 「헬조선에서 살아남기」는 반대로 스탯 관리형 생존 게임이에요. 네 가지 스탯을 0 위로 지키는 것이 목표이고, 상식을 비튼 선택지와 즉사, 눈치 회피, 정비 시간, 유산 보너스 같은 장치로 「이번 생은 망했지만 다음 생은 다르다」를 반복하게 만듭니다." },
];
const CONTROLS = [
  ["A 선택", "← 방향키, A, 1", "왼쪽(A) 카드 터치"],
  ["B 선택", "→ 방향키, B, 2", "오른쪽(B) 카드 터치"],
  ["소리 끄기·켜기", "오른쪽 위 스피커 버튼", "오른쪽 위 스피커 버튼"],
  ["사망 도감·엔딩", "오른쪽 위 책 버튼 (닫기: Esc)", "오른쪽 위 책 버튼"],
];
const FAQ = [
  { q: "게임 속 투자·건강 선택지는 진짜 조언인가요?", a: "아니요. 밈코인 레버리지, 영양제 30알, 담금주, 에너지 음료 같은 선택지는 모두 게임 속 병맛 설정이에요. 현실의 투자 조언이나 건강 조언이 아니고, 결과도 현실과 반대로 꾸며 놓았어요. 해당 단계 화면에도 같은 안내가 나옵니다." },
  { q: "죽으면 처음부터 해야 하나요?", a: "아니요. 죽으면 「장 처음부터 다시」와 「환생(0세부터)」 가운데 고를 수 있어요. 장 처음부터 하면 그 장을 시작할 때의 스탯으로 돌아가고, 환생하면 0세부터 다시 하는 대신 지난 생의 기록만큼 유산 보너스를 받아요." },
  { q: "눈치는 어떻게 쓰나요?", a: "눈치가 40% 이상이면 화면 위 눈치 칸 테두리가 하늘색으로 바뀌어요. 이때 즉사 선택을 고르면 한 번 피하고 다음 단계로 넘어가는 대신 눈치 35, 멘탈 10이 줄어요. 피했을 때는 살아남는 선택의 보상도 받지 못하니, 일부러 피하는 것도 전략이 될 수 있어요." },
  { q: "특정 지역이나 세대를 비꼬는 게임인가요?", a: "아니요. 비꼬는 대상은 학원비, 야근, 깡통 전세, 사기 문자, 끝없는 키오스크 메뉴 같은 「부조리한 상황」이에요. 특정 지역·성별·세대를 깎아내리는 표현과 실존 인물·기업·브랜드 이름은 넣지 않았어요. 불편한 표현을 발견하면 문의로 알려 주세요." },
  { q: "잔인한 장면이 나오나요?", a: "피나 잔혹한 장면은 나오지 않아요. 사망은 젖병에 맞아 납작해지거나, 숯검댕이 아프로 머리가 되거나, 비둘기 떼에 실려 날아가는 식의 만화 슬랩스틱으로만 표현했어요." },
  { q: "기록은 어디에 저장되나요?", a: "사망 도감, 엔딩, 장 체크포인트, 유산 기록, 소리 설정은 지금 쓰는 브라우저의 저장 공간(localStorage)에만 남고 서버로 보내지 않아요. 도감 화면의 「기록 초기화」로 지울 수 있어요. 순위표만 예외로, TOP10에 들어 「순위에 올리기」를 고른 경우에 한해 닉네임과 기록이 순위표(Google Firebase)에 저장돼요." },
  { q: "소리가 안 나요.", a: "「응애, 태어나기」를 누르는 순간부터 배경 음악과 효과음이 나요. 오른쪽 위 스피커 버튼과 기기 음량을 확인해 주세요. 아이폰은 무음 스위치나 iOS 버전에 따라 소리가 안 날 수 있어요. 모든 소리는 브라우저가 그 자리에서 합성해서 따로 내려받는 음원 파일이 없어요." },
];

function verify(root, warnings) {
  const ctx = { window: {}, document: { getElementById: () => null } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "src", "assets", "hell-chosun-data.js"), "utf8"), ctx, { filename: "hell-chosun-data.js" });
  const C = ctx.window.HELL.HC;
  const artSrc = ["hell-art.js", "hell-chosun-art.js"].map((f) => fs.readFileSync(path.join(root, "src", "assets", f), "utf8")).join("\n");
  const err = [];
  if (C.STAGES.length !== 40) err.push(`단계 ${C.STAGES.length}개(40개여야 함)`);
  C.STAGES.forEach((s, i) => {
    if (s.n !== i + 1) err.push(`단계 번호 ${s.n}`);
    if (!new RegExp(`\\b${s.scene}: \\{`).test(artSrc)) err.push(`${s.n}단계 장면 ${s.scene} 없음`);
    if (!new RegExp(`\\b${s.death.anim}\\(x, t, b`).test(artSrc)) err.push(`${s.n}단계 사망 연출 ${s.death.anim} 없음`);
    [s.ok.icon, s.ng.icon].forEach((k) => { if (!new RegExp(`\\b${k}: \\[`).test(artSrc)) err.push(`${s.n}단계 아이콘 ${k} 없음`); });
    [s.ok.t, s.ng.t].forEach((t) => { if (t.length > 22) warnings.push(`헬조선 ${s.n}단계 선택지 ${t.length}자: ${t}`); });
    if (!s.ok.msg || !s.death.name || !s.death.desc || !s.ok.fx) err.push(`${s.n}단계 문구·효과 빠짐`);
  });
  const names = new Set([...C.STAGES.map((s) => s.death.name), ...Object.values(C.STAT_DEATHS).map((d) => d.name)]);
  if (names.size !== 44) err.push(`사망 이름 중복(고유 ${names.size}개, 44개여야 함)`);
  if (C.ENDINGS.length < 4) err.push("엔딩 4종 미만");
  // 고지: 투자·건강 선택지에는 tag가 있어야 함
  const needTag = [7, 12, 16, 18, 19, 20, 21, 33, 34, 38];
  needTag.forEach((n) => { const s = C.STAGES[n - 1]; if (!["invest", "health"].includes(s.tag)) err.push(`${n}단계 투자·건강 고지 태그 없음`); });
  const all = JSON.stringify(C.STAGES) + JSON.stringify(C.STAT_DEATHS) + JSON.stringify(C.ENDINGS) + JSON.stringify(C.QUIPS) + JSON.stringify(C.CHAPTERS);
  ["피가", "피를", "피범벅", "유혈", "내장", "토막", "절단", "살해", "자살"].forEach((w) => { if (all.includes(w)) err.push(`표현 기준 위반 단어: ${w}`); });
  ["틱톡", "유튜브", "인스타", "카카오", "네이버", "배민", "쿠팡", "삼성", "현대", "스타벅스", "맥도날드", "비트코인", "도지", "편의점 GS", "CU", "서울대", "하버드"].forEach((w) => { if (all.includes(w)) err.push(`실존 브랜드·기관 이름: ${w}`); });
  ["한남", "김치녀", "된장녀", "틀딱", "급식충", "맘충", "홍어", "개저씨", "꼰대"].forEach((w) => { if (all.includes(w)) err.push(`혐오 표현: ${w}`); });
  if (err.length) throw new Error("헬조선에서 살아남기 데이터 검사 실패:\n  " + err.join("\n  "));
  return C;
}

export default function buildHellChosun(h) {
  const { cfg, write, layout, crumbHtml, crumbs, faqHtml, faqLd, adSlot, esc, t, u, abs, textLen, warnings, root } = h;
  const R = HC_PAGE;
  const C = verify(root, warnings);
  const items = [["홈", "/"], ["이야기 게임", "/story/"], [R.title, R.path]];
  const words = textLen(INTRO) + FAQ.reduce((n, f) => n + f.a.length, 0);
  if (words < 300) warnings.push(`헬조선 원고 ${words}자(300자 미만)`);
  const chapters = C.CHAPTERS.map((c) => `<tr><th scope="row">${c.no}장 (${esc(c.ages)})</th><td>${esc(c.name)}</td><td>${esc(c.sub)}</td><td>${c.from}~${c.to}단계</td></tr>`).join("");
  const body = `
${crumbHtml(items)}
<article class="tool hell-page">
  <header class="page-head">
    <span class="eyebrow">이야기 게임</span>
    <h1>${esc(R.h1)}</h1>
    <p class="lead">${esc(R.desc)}</p>
  </header>
  <link rel="stylesheet" href="${u("/assets/hell-style.css")}?v=${Date.now().toString(36)}">
  <link rel="preload" href="${u("/assets/vendor/galmuri/Galmuri11-Bold.woff2")}" as="font" type="font/woff2" crossorigin>
  <section class="tool-box hell-box" aria-label="게임">
    <div id="hc" class="hell hc"><div class="hl-screen"><div class="hl-stage"><p style="color:#fff;text-align:center;padding-top:30%">게임을 불러오는 중이에요…</p></div></div></div>
    <noscript><p class="hint">이 게임은 자바스크립트가 켜져 있어야 실행돼요.</p></noscript>
  </section>
  <p class="hl-warn"><b>게임 속 병맛 설정이에요. 현실 투자·건강 조언이 아니며, 따라 하지 마세요.</b> 밈코인 레버리지, 영양제 한 번에 30알, 담금주, 에너지 음료 같은 선택지의 결과는 현실과 반대로 꾸며 놓았어요. 사망 장면은 피 없는 만화식 연출입니다.</p>
  ${adSlot("hellchosun-below")}
  <section class="prose">
    ${INTRO.map((b) => `<h2>${t(b.h)}</h2>${b.p.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}`).join("")}
    <h2>장 구성</h2>
    <div class="table-wrap"><table><thead><tr><th scope="col">장</th><th scope="col">시기</th><th scope="col">주요 사건</th><th scope="col">단계</th></tr></thead><tbody>${chapters}</tbody></table></div>
    <h2>조작법</h2>
    <div class="table-wrap"><table><thead><tr><th scope="col">하는 일</th><th scope="col">PC 키보드</th><th scope="col">휴대폰</th></tr></thead><tbody>${CONTROLS.map(([a, b, c]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join("")}</tbody></table></div>
    <p>같은 오락실의 <a href="${u("/arcade/hell-31/")}">지옥에서 살아남기</a>는 3~5분짜리 31단계 버전이고, <a href="${u("/story/life/")}">Life Game</a>은 정답 없이 일생을 따라가는 차분한 인생 게임이에요.</p>
  </section>
  <section class="rank-page" data-rank-game="chosun" aria-label="순위표"></section>
  ${faqHtml(FAQ)}
  ${adSlot("hellchosun-faq")}
</article>`;
  const ld = [crumbs(items), faqLd(FAQ), { "@context": "https://schema.org", "@type": "VideoGame", name: "헬조선에서 살아남기", url: abs(R.path), description: R.desc, genre: ["Simulation", "Comedy"], gamePlatform: "Web browser", applicationCategory: "Game", operatingSystem: "Any", inLanguage: "ko", isAccessibleForFree: true, publisher: { "@type": "Organization", name: cfg.operator } }];
  write(R.path, layout({ title: R.seo, desc: R.desc, path: R.path, body, scripts: ["rank.js", "hell-art.js", "hell-chosun-data.js", "hell-chosun-art.js", "hell-sound.js", "hell-chosun.js"], jsonld: ld, fullTitle: false }));
  return R;
}
