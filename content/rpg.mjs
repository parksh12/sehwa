// P2-15 펭귄 RPG 「뽀득이와 오색 연」 페이지 — build.mjs가 빌드 도구를 넘겨 호출합니다.
// 게임 코드는 src/assets/rpg-data.js · rpg-art.js · rpg-battle.js · rpg.js (외부 에셋 0, 서버 전송 0)
export const RPG_PAGE = {
  path: "/story/penguin-rpg/",
  title: "펭귄 RPG 뽀득이와 오색 연",
  seo: "펭귄 RPG — 무료 브라우저 도트 RPG, 설치 없이 1시간 모험",
  h1: "펭귄 RPG — 뽀득이와 오색 연",
  desc: "연 날리기 꼴찌 펭귄 뽀득이가 찢어진 오색 연의 실 네 가닥을 찾아 떠나는 약 1시간짜리 도트 RPG예요. 설치·가입 없이 브라우저에서 바로 하고, 진행은 자동 저장돼요.",
  hook: "꼴찌 펭귄의 오색 연 찾기 모험. 지역 4곳, 보스 5마리, 약 1시간.",
  meta: "약 1시간 · 자동 저장",
};

const INTRO = [
  { h: "어떤 게임인가요", p: "남쪽 얼음 군도 「누리빙」에서는 해마다 오방색 실로 짠 「오색 연」을 날리는 축제가 열려요. 그런데 축제 날 아침, 잿빛 존재 「무채」가 연을 찢어 버리고 세상은 조금씩 색을 잃어 갑니다. 낮잠을 자느라 혼자 색을 빼앗기지 않은 연 날리기 꼴찌 펭귄 「뽀득」이 청실·적실·백실·흑실을 찾아 푸른 대숲, 붉은 가마 화산, 하얀 소금 설원, 검은 바다 해안을 차례로 여행해요.\n길에서는 잔소리 많은 물범 약사 「몽실」과 걷는 게 더 빠르다고 우기는 바다오리 배달부 「깍새」가 동료로 합류합니다. 지역마다 던전 끝에 보스가 기다리고, 마지막에는 마을 한가운데 솟아오른 탑에서 무채와 마주하게 돼요." },
  { h: "이런 걸 할 수 있어요", p: "마을과 필드, 던전을 걸어 다니며 주민과 이야기하고 보물 상자를 열어요. 대나무나 얼음벽 사이에 숨은 길도 있어요. 전투는 턴제이고 공격, 스킬, 방어, 아이템, 도망 가운데 고릅니다. 몬스터마다 목·화·토·금·수 다섯 기운 가운데 하나를 갖고 있어서, 기운을 이기는 스킬(금은 목을, 목은 토를, 토는 수를, 수는 화를, 화는 금을 이겨요)을 쓰면 큰 피해를 줄 수 있어요.\n레벨이 오르면 능력치가 오르고 새 스킬을 배워요. 무기·옷·장신구 세 부위 장비를 바꿀 수 있고, 골드로 상점에서 물건을 사요. 메인 이야기와 함께 털실 찾기, 매운 고추 모으기, 길 잃은 아기 펭귄 찾기, 바다 편지 배달, 몬스터 수첩 채우기 같은 서브 퀘스트 다섯 개가 있어요." },
  { h: "플레이 시간과 저장", p: "처음 하는 분 기준으로 엔딩까지 약 1시간이 걸리도록 맞췄어요. 일반 몬스터를 따로 반복 사냥하지 않아도 길을 따라가며 만나는 전투만으로 보스를 이길 수 있게 난이도를 조정했어요. 전투에서 지면 마지막으로 쉰 모닥불이나 찜질방에서 다시 시작하고, 가진 골드의 10%만 잃어요.\n진행 상황은 지도를 옮길 때, 전투가 끝날 때, 모닥불에서 쉴 때 자동으로 저장돼요. 저장 데이터는 지금 쓰는 브라우저의 저장 공간(localStorage)에만 남고 서버로 보내지 않아요. 같은 브라우저로 다시 오면 「이어 하기」로 계속할 수 있어요. 브라우저 데이터를 지우거나 다른 기기에서 열면 처음부터 시작해야 해요." },
];
const CONTROLS = [
  ["이동", "방향키 또는 W·A·S·D", "화면 아래 방향 패드(손가락을 미끄러뜨려도 돼요)"],
  ["확인 · 말 걸기 · 상자 열기", "Enter, Space, Z", "A 버튼"],
  ["취소 · 메뉴 열기", "Esc, X, Backspace", "B 버튼"],
  ["메뉴 항목 고르기", "위·아래 방향키 후 Enter", "항목을 바로 눌러도 돼요"],
  ["대화 넘기기", "Enter 또는 Space", "A 버튼이나 대화창 터치"],
];
const TIPS = [
  "대숲 몬스터는 목 기운이라 「쇠부리 콕」(금)이 잘 들어요. 화산은 물 공격, 설원은 불 공격, 바다는 흙 공격이 효과적이에요.",
  "보스가 힘을 모으는 예고 문구가 나오면 「방어」를 고르세요. 그 턴에 받는 피해가 절반으로 줄어요.",
  "새 지역에 가기 전에 마을 상점에서 무기와 옷을 바꿔 보세요. 실을 하나 되찾을 때마다 상점 물건이 늘어나요.",
  "지도에는 주변과 생김새가 살짝 다른 나무나 벽이 있어요. 그쪽으로 걸어 들어가 보세요. 숨은 길일 수 있어요.",
];
const FAQ = [
  { q: "저장은 어떻게 하나요?", a: "따로 누르지 않아도 지도를 옮길 때, 전투가 끝날 때, 모닥불이나 찜질방에서 쉴 때 자동으로 저장돼요. 메뉴의 「저장」으로 직접 저장할 수도 있어요. 저장 데이터는 이 브라우저에만 남고 서버로 보내지 않아요." },
  { q: "휴대폰에서도 할 수 있나요?", a: "네. 화면 아래 방향 패드와 A·B 버튼으로 끝까지 플레이할 수 있어요. 세로 화면 기준으로 맞췄고, 메뉴 항목은 손가락으로 바로 눌러도 돼요." },
  { q: "전투에서 지면 어떻게 되나요?", a: "마지막으로 쉰 모닥불이나 마을 찜질방에서 HP와 MP가 모두 찬 상태로 다시 시작해요. 가진 골드의 10%만 잃고, 레벨과 아이템, 퀘스트 진행은 그대로예요." },
  { q: "막혔어요. 어디로 가야 하나요?", a: "메뉴의 「퀘스트」에 지금 해야 할 일이 적혀 있어요. 마을 촌장님 집에 가면 다음 목적지를 알려 줘요. 보스가 너무 세다면 상점에서 장비를 바꾸고, 그 지역 몬스터의 기운을 이기는 스킬을 써 보세요." },
  { q: "다른 게임을 따라 만든 건가요?", a: "아니에요. 세계관, 캐릭터, 지도, 대사, 그림, 효과음은 모두 펭귄 툴즈가 직접 만들었어요. 그림은 이미지 파일 없이 코드로 한 점씩 그리고, 효과음은 브라우저의 소리 합성 기능으로 짧게 만들어요. 턴제 전투, 레벨, 장비, 마을 같은 RPG의 일반적인 형식만 빌렸어요." },
  { q: "소리가 나나요?", a: "처음에는 소리가 꺼져 있어요. 사무실이나 도서관에서 갑자기 소리가 나지 않게 하려는 거예요. 타이틀 화면의 「소리」 버튼이나 게임 메뉴의 「소리」 항목으로 켜면 짧은 효과음이 나요. 설정은 이 브라우저에 기억돼요." },
];

export default function buildRpg(h) {
  const { cfg, write, layout, crumbHtml, crumbs, faqHtml, faqLd, adSlot, esc, t, u, abs, textLen, warnings } = h;
  const R = RPG_PAGE;
  const items = [["홈", "/"], ["이야기 게임", "/story/"], [R.title, R.path]];
  const words = textLen(INTRO) + TIPS.join("").length + FAQ.reduce((n, f) => n + f.a.length, 0);
  if (words < 300) warnings.push(`RPG 페이지 원고 ${words}자(300자 미만)`);
  const body = `
${crumbHtml(items)}
<article class="tool rpg-page">
  <header class="page-head">
    <span class="eyebrow">이야기 게임</span>
    <h1>${esc(R.h1)}</h1>
    <p class="lead">${esc(R.desc)}</p>
  </header>
  <link rel="stylesheet" href="${u("/assets/rpg-style.css")}?v=${Date.now().toString(36)}">
  <section class="tool-box rpg-box" aria-label="게임">
    <div id="rpg" class="rpg"><div class="rpg-screen rpg-loading"><p>게임을 불러오는 중이에요…</p></div><div class="rpg-pad" aria-hidden="true"></div><p class="rpg-keys">방향키·WASD 이동 · Enter/Space 확인 · Esc 메뉴</p></div>
    <noscript><p class="hint">이 게임은 자바스크립트가 켜져 있어야 실행돼요.</p></noscript>
  </section>
  ${adSlot("rpg-below")}
  <section class="prose">
    ${INTRO.map((b) => `<h2>${t(b.h)}</h2>${b.p.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}`).join("")}
    <h2>조작법</h2>
    <div class="table-wrap"><table class="rpg-ctl"><thead><tr><th scope="col">하는 일</th><th scope="col">PC 키보드</th><th scope="col">휴대폰</th></tr></thead><tbody>${CONTROLS.map(([a, b, c]) => `<tr><th scope="row">${esc(a)}</th><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join("")}</tbody></table></div>
    <h2>처음 하는 분을 위한 팁</h2>
    <ul>${TIPS.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
  </section>
  ${faqHtml(FAQ)}
  ${adSlot("rpg-faq")}
</article>`;
  const ld = [crumbs(items), faqLd(FAQ), { "@context": "https://schema.org", "@type": "VideoGame", name: "뽀득이와 오색 연", url: abs(R.path), description: R.desc, genre: "RPG", gamePlatform: "Web browser", applicationCategory: "Game", operatingSystem: "Any", inLanguage: "ko", isAccessibleForFree: true, publisher: { "@type": "Organization", name: cfg.operator } }];
  write(R.path, layout({ title: R.seo, desc: R.desc, path: R.path, body, scripts: ["rpg-data.js", "rpg-art.js", "rpg-battle.js", "rpg.js"], jsonld: ld, fullTitle: false }));
  return R;
}
