// P2-27 「지옥에서 살아남기 (Hell Survival 31)」 페이지 — build.mjs가 빌드 도구를 넘겨 호출합니다.
// 게임 코드는 src/assets/hell-data.js · hell-art.js · hell-sound.js · hell.js, 전용 CSS는 hell-style.css (외부 에셋 0, 서버 전송 0)
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export const HELL_PAGE = {
  path: "/arcade/hell-31/",
  title: "지옥에서 살아남기",
  seo: "지옥에서 살아남기 — 31단계 병맛 생존 게임, 무료 브라우저 도트 게임",
  h1: "지옥에서 살아남기 — Hell Survival 31",
  desc: "A와 B 중 하나는 살고 하나는 죽는 31단계 병맛 선택 게임. 상식대로 고르면 대개 죽어요. 슬랩스틱 사망 31종을 모으는 사망 도감과 「가장 억울한 죽음」 공유 카드까지, 설치 없이 브라우저에서 3~5분.",
  hook: "A/B 중 하나는 즉사. 상식대로 고르면 대개 죽는 31단계.",
  meta: "31단계 · 3~5분 · 사망 도감",
};

const INTRO = [
  { h: "어떤 게임인가요", p: "눈을 떠 보니 펄펄 끓는 용암 도로 위. 주인공은 지옥 입구에서 염라대왕의 알현실까지 31단계를 통과해 환생해야 해요. 단계마다 선택지는 A와 B 두 개뿐이고, 하나를 고르면 살고 다른 하나를 고르면 0.5~1초짜리 슬랩스틱 사망 연출과 함께 체크포인트로 돌아갑니다.\n문제는 상식이 통하지 않는다는 거예요. 목마를 때 맑은 물을 마시면 죽고, 핫소스를 들이키면 삽니다. 악마 경비병이 1 더하기 1을 물어보면 2라고 답하는 순간 삼지창이 날아와요. 「아니 진짜 이게 말이 돼?」 하고 웃으면서 다시 누르게 되는 부조리 블랙 유머 게임입니다." },
  { h: "4개 지옥 층과 체크포인트", p: "31단계는 네 개 층으로 나뉘어요. 1~8단계 「초입: 이승과 저승 사이」는 붉은 하늘 아래 용암 도로, 9~17단계 「중층: 고문과 가스라이팅」은 통구이 불길과 톱날 기계, 18~25단계 「심층: 극악의 부조리 지옥」은 물리법칙이 무너진 네온 공간, 26~31단계 「최종: 염라대왕의 알현실」은 화면을 가득 채운 염라대왕 얼굴 앞에서 진행돼요. 층마다 배경 그림, 배경 음악, 들어갈 때의 화면 연출(흔들림, 붉은 화면, 노이즈, 찢어지는 화면)이 바뀝니다.\n층이 시작되는 9·18·26단계가 체크포인트예요. 죽으면 지금 층의 첫 단계부터 다시 하고, 브라우저를 닫았다가 와도 타이틀에서 「이어 하기」로 이어서 할 수 있어요." },
  { h: "외워도 끝나지 않아요", p: "정답이 A인지 B인지는 판마다 무작위로 섞여요. 「3단계는 왼쪽」처럼 위치를 외우는 대신 어떤 행동이 살아남는지를 기억해야 합니다. 한 판은 처음 하는 분 기준으로 3~5분 정도 걸리도록 만들었어요." },
  { h: "사망 도감과 「가장 억울한 죽음」 카드", p: "31단계마다 서로 다른 죽음이 하나씩, 모두 31장의 사망 카드가 있어요. 처음 보는 죽음에는 NEW 표시가 붙고, 모은 카드는 오른쪽 위 책 아이콘의 「사망 도감」에서 사망 장면 그림과 함께 다시 볼 수 있어요. 죽을 때마다 「당신의 IQ는 지옥 암석 수준입니다」 같은 비꼼 멘트가 따라옵니다.\n마음에 드는(?) 죽음은 세로형(9:16) 「가장 억울한 죽음」 카드 이미지로 저장하거나 공유할 수 있어요. 숏폼이나 메신저에 올리기 좋은 크기예요. 카드와 주소에는 이름 같은 개인정보가 들어가지 않습니다." },
];
const CONTROLS = [
  ["A 선택", "← 방향키, A, 1", "왼쪽(A) 카드 터치"],
  ["B 선택", "→ 방향키, B, 2", "오른쪽(B) 카드 터치"],
  ["소리 끄기·켜기", "오른쪽 위 스피커 버튼", "오른쪽 위 스피커 버튼"],
  ["사망 도감", "오른쪽 위 책 버튼 (닫기: Esc)", "오른쪽 위 책 버튼"],
];
const FAQ = [
  { q: "정답이 있긴 한가요? 그냥 운인가요?", a: "단계마다 정답은 정해져 있어요. 다만 이 게임의 논리는 「상식의 반대」에 가까워서 처음에는 운처럼 느껴질 수 있어요. 한 번 죽은 단계는 무엇을 고르면 죽는지 알게 되니, 다음 판에서는 반대쪽 행동을 고르면 됩니다. A와 B 위치는 판마다 바뀌니 글을 읽고 골라 주세요." },
  { q: "죽으면 처음부터 다시 해야 하나요?", a: "아니요. 9·18·26단계가 체크포인트라서 지금 있는 층의 첫 단계부터 다시 시작해요. 체크포인트는 이 브라우저에 저장돼서 나중에 「이어 하기」로 이어서 할 수 있어요." },
  { q: "잔인한 장면이 나오나요?", a: "피나 잔혹한 장면은 나오지 않아요. 사망 연출은 해골이 용암에 둥둥 뜨거나, 운석에 납작해지거나, 숯검댕이 아프로 머리가 되는 식의 만화 슬랩스틱으로만 만들었어요. 특정 인물이나 종교, 집단을 비하하는 내용도 넣지 않았습니다. 염라대왕과 악마는 옛이야기 속 캐릭터를 바탕으로 새로 그린 가상의 캐릭터예요." },
  { q: "게임 속 행동을 현실에서 해도 되나요?", a: "절대 안 돼요. 핫소스를 들이키거나, 자판기를 흔들거나, 냉탕에 뛰어드는 식의 선택지는 모두 게임 속 병맛 설정이에요. 현실에서는 다칠 수 있으니 따라 하지 마세요." },
  { q: "소리가 안 나요.", a: "이 게임은 기본으로 소리가 켜져 있고, 「지옥 입장」을 누르는 순간부터 배경 음악과 효과음이 나요. 소리가 안 나면 오른쪽 위 스피커 버튼이 켜져 있는지, 기기 음량이 올라가 있는지 확인해 주세요. 아이폰은 무음 모드 스위치나 iOS 버전에 따라 소리가 안 날 수 있어요. 모든 소리는 브라우저가 그 자리에서 합성해서 따로 내려받는 음원 파일이 없어요." },
  { q: "도감 기록은 어디에 저장되나요?", a: "모은 사망 카드와 체크포인트, 소리 설정은 지금 쓰는 브라우저의 저장 공간(localStorage)에만 남고 서버로 보내지 않아요. 다른 기기나 다른 브라우저와는 이어지지 않고, 브라우저 기록을 지우면 함께 사라집니다. 도감 화면의 「도감 초기화」로 직접 지울 수도 있어요." },
  { q: "다른 게임을 따라 만든 건가요?", a: "아니요. 단계, 선택지, 사망 장면, 그림, 음악은 모두 직접 만들었어요. 그림은 이미지 파일 없이 코드로 한 점씩 그리고, 음악과 효과음은 브라우저의 소리 합성 기능으로 만들어요. 글꼴은 SIL 오픈 폰트 라이선스로 공개된 갈무리(Galmuri11 Bold)를 이 사이트에 직접 올려 씁니다." },
];

// 빌드 때 데이터 검사: 31단계·사망 31종·그림/아이콘/애니메이션 키가 모두 있는지
function verify(root, warnings) {
  const ctx = { window: {}, document: { createElement: () => ({ getContext: () => null }) } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "src", "assets", "hell-data.js"), "utf8"), ctx, { filename: "hell-data.js" });
  const H = ctx.window.HELL;
  const art = fs.readFileSync(path.join(root, "src", "assets", "hell-art.js"), "utf8");
  const err = [];
  if (H.STAGES.length !== 31) err.push(`단계 ${H.STAGES.length}개(31개여야 함)`);
  H.STAGES.forEach((s, i) => {
    if (s.n !== i + 1) err.push(`단계 번호 ${s.n}`);
    if (!new RegExp(`\\b${s.scene}\\(x, t\\)`).test(art)) err.push(`${s.n}단계 장면 그림 ${s.scene} 없음`);
    if (!new RegExp(`\\b${s.death.anim}\\(x, t, b`).test(art)) err.push(`${s.n}단계 사망 애니메이션 ${s.death.anim} 없음`);
    [s.ok.icon, s.ng.icon].forEach((k) => { if (!new RegExp(`\\b${k}: \\[`).test(art)) err.push(`${s.n}단계 아이콘 ${k} 없음`); });
    [s.ok.t, s.ng.t].forEach((t) => { if (t.length > 22) warnings.push(`지옥 ${s.n}단계 선택지 길이 ${t.length}자: ${t}`); });
    if (!s.ok.msg || !s.death.name || !s.death.desc) err.push(`${s.n}단계 문구 빠짐`);
  });
  const names = new Set(H.STAGES.map((s) => s.death.name));
  if (names.size !== 31) err.push(`사망 이름 중복(고유 ${names.size}개)`);
  // 표현 기준: 잔혹 표현 금지어
  const banned = ["피가", "피를", "피범벅", "유혈", "내장", "선혈", "토막", "절단", "참수", "살해"];
  const all = JSON.stringify(H.STAGES) + JSON.stringify(H.QUIPS);
  banned.forEach((w) => { if (all.includes(w)) err.push(`표현 기준 위반 단어: ${w}`); });
  if (err.length) throw new Error("지옥에서 살아남기 데이터 검사 실패:\n  " + err.join("\n  "));
  return H;
}

export default function buildHell(h) {
  const { cfg, write, layout, crumbHtml, crumbs, faqHtml, faqLd, adSlot, esc, t, u, abs, textLen, warnings, root } = h;
  const R = HELL_PAGE;
  const H = verify(root, warnings);
  const items = [["홈", "/"], ["순발력 게임", "/arcade/"], [R.title, R.path]];
  const words = textLen(INTRO) + FAQ.reduce((n, f) => n + f.a.length, 0);
  if (words < 300) warnings.push(`지옥에서 살아남기 원고 ${words}자(300자 미만)`);
  const floors = H.FLOORS.map((f) => `<tr><th scope="row">${f.no}층 ${esc(f.name)}</th><td>${esc(f.sub)}</td><td>${f.from}~${f.to}단계</td></tr>`).join("");
  const body = `
${crumbHtml(items)}
<article class="tool hell-page">
  <header class="page-head">
    <span class="eyebrow">오락실 게임</span>
    <h1>${esc(R.h1)}</h1>
    <p class="lead">${esc(R.desc)}</p>
  </header>
  <link rel="stylesheet" href="${u("/assets/hell-style.css")}?v=${Date.now().toString(36)}">
  <link rel="preload" href="${u("/assets/vendor/galmuri/Galmuri11-Bold.woff2")}" as="font" type="font/woff2" crossorigin>
  <section class="tool-box hell-box" aria-label="게임">
    <div id="hell" class="hell"><div class="hl-screen"><div class="hl-stage"><p style="color:#fff;text-align:center;padding-top:30%">게임을 불러오는 중이에요…</p></div></div></div>
    <noscript><p class="hint">이 게임은 자바스크립트가 켜져 있어야 실행돼요.</p></noscript>
  </section>
  <p class="hl-warn"><b>현실에서 따라 하지 마세요.</b> 핫소스 들이키기, 자판기 흔들기, 냉탕 다이빙 같은 선택지는 모두 게임 속 병맛 설정이에요. 사망 장면은 피 없는 만화식 연출입니다.</p>
  ${adSlot("hell-below")}
  <section class="prose">
    ${INTRO.map((b) => `<h2>${t(b.h)}</h2>${b.p.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}`).join("")}
    <h2>층 구성</h2>
    <div class="table-wrap"><table><thead><tr><th scope="col">층</th><th scope="col">테마</th><th scope="col">단계</th></tr></thead><tbody>${floors}</tbody></table></div>
    <h2>조작법</h2>
    <div class="table-wrap"><table><thead><tr><th scope="col">하는 일</th><th scope="col">PC 키보드</th><th scope="col">휴대폰</th></tr></thead><tbody>${CONTROLS.map(([a, b, c]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join("")}</tbody></table></div>
  </section>
  ${faqHtml(FAQ)}
  ${adSlot("hell-faq")}
</article>`;
  const ld = [crumbs(items), faqLd(FAQ), { "@context": "https://schema.org", "@type": "VideoGame", name: "지옥에서 살아남기 (Hell Survival 31)", url: abs(R.path), description: R.desc, genre: ["Casual", "Comedy"], gamePlatform: "Web browser", applicationCategory: "Game", operatingSystem: "Any", inLanguage: "ko", isAccessibleForFree: true, publisher: { "@type": "Organization", name: cfg.operator } }];
  write(R.path, layout({ title: R.seo, desc: R.desc, path: R.path, body, scripts: ["hell-data.js", "hell-art.js", "hell-sound.js", "hell.js"], jsonld: ld, fullTitle: false }));
  return R;
}
