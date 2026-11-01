// 나알기 정적 사이트 빌더 — 외부 패키지 없이 Node 18+ 만으로 dist/ 를 생성합니다.
// 사용: node build.mjs   (환경변수 SITE_URL, SITE_NAME, CONTACT_EMAIL, ADSENSE_CLIENT, GA_ID 로 설정 덮어쓰기)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import cfg from "./config.mjs";
import questions from "./content/questions.mjs";
import { renderDay, kstDate } from "./src/assets/daily.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");
const load = async (n) => (await import(`./content/${n}.mjs`)).default;
const personality = await load("personality");
const tti = await load("tti");
const zodiac = await load("zodiac");
const guides = await load("guides");
const pages = await load("pages");

// ---------- 유틸 ----------
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fill = (s = "") => String(s).replaceAll("{{SITE}}", cfg.siteName).replaceAll("{{EMAIL}}", cfg.contactEmail);
const t = (s) => esc(fill(s));
const u = (p) => cfg.basePath + p; // 사이트 내부 경로
const abs = (p) => cfg.siteUrl + p;
const textLen = (blocks = []) => blocks.reduce((n, b) => n + fill(b.p || b.a || b.text || "").trim().length, 0); // 공백 포함 글자 수
const sitemap = [];
const warnings = [];

function write(p, html) {
  const file = path.join(DIST, p.endsWith("/") ? p + "index.html" : p);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

// ---------- 사이트 구조 ----------
const CATS = {
  me: { name: "나의 성격", icon: "🪞", desc: "생일과 성향으로 나를 들여다보는 공간이에요." },
  love: { name: "나의 관계", icon: "💞", desc: "나와 상대가 어떻게 어울리는지 가볍게 살펴봐요." },
  luck: { name: "나의 운", icon: "🍀", desc: "전통 상징을 바탕으로 한 해의 흐름을 재미로 읽어 봐요." },
  story: { name: "이야기 게임", icon: "", desc: "생각은 짧게, 여운은 길게. 한 판이면 끝나는 짧은 이야기 게임이에요." },
  arcade: { name: "순발력 게임", icon: "", desc: "머리보다 손이 먼저 움직이는 짧은 게임이에요." },
};
// hook: 홈·추천 카드에 쓰는 짧은 한 줄 / meta: 소요 시간·분량
// 노출 순위(RANK): 홈 「인기」 탭과 뽑기 덱 순서. 지금은 운영진 추정치이고, GA4·서치콘솔 데이터가 쌓이면 실측 노출 순으로 바꿉니다.
const RANK = ["today", "life", "personality", "birthday", "namematch", "reaction"];
const TOOLS = [
  { id: "birthday", cat: "me", path: "/me/birthday/", icon: "🎂", title: "생일로 보는 나", h1: "생일로 보는 나 — 만 나이·띠·별자리 한 번에", desc: "생년월일만 넣으면 만 나이, 띠, 별자리, 다음 생일 D-day까지 한 번에 알려 드려요.", hook: "만 나이, 띠, 별자리, 다음 생일까지 며칠 남았는지. 생일만 넣으면 끝.", meta: "10초" },
  { id: "personality", cat: "me", path: "/me/personality/", icon: "🧩", title: "16유형 성격 테스트", h1: "16유형 성격 테스트 — 20문항으로 보는 나의 성향", desc: "20개 문항에 답하면 4가지 축의 비율과 16유형 중 나와 가까운 유형을 알려 드려요.", hook: "20문항이면 네 가지 축이 몇 대 몇인지까지 나와요.", meta: "20문항 · 3분" },
  { id: "namematch", cat: "love", path: "/love/name-match/", icon: "💌", title: "이름 궁합 테스트", h1: "이름 궁합 테스트 — 획수로 보는 두 사람의 케미", desc: "두 사람의 이름 획수를 더해 가며 궁합 점수를 계산하는 추억의 이름 궁합 놀이예요.", hook: "공책 귀퉁이에 획수 적어 가며 하던 그 궁합, 기억나요?", meta: "이름 두 개" },
  { id: "today", cat: "luck", path: "/luck/today/", icon: "", title: "오늘의 띠별 운세", h1: "오늘의 띠별 운세 — 매일 자정에 바뀌는 12띠 하루 운세", desc: "열두 띠의 오늘 하루 흐름과 일·관계 팁, 행운의 색·숫자를 매일 새로 정리해요.", hook: "매일 자정에 바뀌어요. 내 띠의 오늘 하루는?", meta: "매일 업데이트" },
  { id: "reaction", cat: "arcade", path: "/arcade/reaction/", icon: "⚡", title: "반응속도 게임", h1: "반응속도 게임 — 초록색이 되는 순간 터치!", desc: "빨간 화면이 초록색으로 바뀌는 순간을 다섯 번 잡아 보세요. 평균 기록과 등급, 내 최고 기록을 알려 드려요.", hook: "초록색 되는 순간 누르기. 다섯 번 평균으로 등급이 매겨져요.", meta: "터치 5번" },
  { id: "life", cat: "story", path: "/story/life/", icon: "", title: "1분 인생", h1: "1분 인생 — 60초 동안 한 사람의 일생 살아 보기", desc: "한 사람이 되어 일생을 인생 시계 60초 동안 살아 보는 도트 이야기 게임. 성별·태어난 곳·띠를 고르고, 갈림길마다 5초 안에 고르면 마지막에 나만의 인생 연표와 묘비명이 나와요.", hook: "한 사람으로 60초 살기. 학교, 결혼식, 공항까지 장면이 바뀌어요.", meta: "1분 · 선택 10번" },
];
// 카드 그림(인라인 SVG). 이모지 대신 사이트 고유 그림을 씁니다.
const K = "#141414", W = "#fff", RED = "#e5372b", YEL = "#ffc21a", GRN = "#1e9e5a";
const sv = (inner) => `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">${inner}</svg>`;
const ART = {
  birthday: sv(`<rect x="18" y="24" width="84" height="80" rx="8" fill="${W}" stroke="${K}" stroke-width="4"/><path d="M18 32a8 8 0 0 1 8-8h68a8 8 0 0 1 8 8v14H18z" fill="${RED}" stroke="${K}" stroke-width="4"/><rect x="36" y="14" width="8" height="20" rx="4" fill="${K}"/><rect x="76" y="14" width="8" height="20" rx="4" fill="${K}"/><g fill="${K}">${[30, 48, 66, 84].flatMap((x) => [58, 74, 90].map((y) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" rx="2"/>`)).join("")}</g><circle cx="66" cy="74" r="11" fill="none" stroke="${RED}" stroke-width="4"/>`),
  personality: sv(`<rect x="18" y="18" width="40" height="40" rx="6" fill="${YEL}" stroke="${K}" stroke-width="4"/><circle cx="82" cy="38" r="20" fill="${W}" stroke="${K}" stroke-width="4"/><rect x="18" y="62" width="40" height="40" rx="6" fill="${K}" stroke="${K}" stroke-width="4"/><path d="M62 102 82 62l20 40z" fill="${RED}" stroke="${K}" stroke-width="4" stroke-linejoin="round"/>`),
  namematch: sv(`<circle cx="47" cy="60" r="28" fill="${W}"/><circle cx="73" cy="60" r="28" fill="${YEL}"/><path d="M60 35.2A28 28 0 0 1 60 84.8 28 28 0 0 1 60 35.2z" fill="${K}"/><circle cx="47" cy="60" r="28" fill="none" stroke="${K}" stroke-width="4"/><circle cx="73" cy="60" r="28" fill="none" stroke="${K}" stroke-width="4"/>`),
  today: sv(`<path d="M30 84a30 30 0 0 1 60 0z" fill="${YEL}" stroke="${K}" stroke-width="4"/><path d="M22.4 70.3 11.1 66.2M37.1 51.2l-6.9-9.8M60 44V32M82.9 51.2l6.9-9.8M97.6 70.3l11.3-4.1" stroke="${RED}" stroke-width="6" stroke-linecap="round"/><path d="M12 84h96M30 96h22M68 96h22M44 107h32" stroke="${K}" stroke-width="4" stroke-linecap="round"/>`),
  reaction: sv(`<rect x="51" y="10" width="18" height="10" rx="3" fill="${YEL}"/><rect x="57" y="18" width="6" height="10" fill="${W}"/><circle cx="60" cy="68" r="38" fill="${W}"/><path d="M60 68V38a30 30 0 0 1 21.2 8.8z" fill="${GRN}"/><circle cx="60" cy="68" r="30" fill="none" stroke="${K}" stroke-width="3" stroke-dasharray="2 13.7"/><path d="M60 68 78 50" stroke="${RED}" stroke-width="6" stroke-linecap="round"/><circle cx="60" cy="68" r="5" fill="${K}"/>`),
  life: sv(`<path d="M34 16h52M34 104h52" stroke="${K}" stroke-width="6" stroke-linecap="round"/><path d="M40 18h40c0 22-18 30-18 42s18 20 18 42H40c0-22 18-30 18-42S40 40 40 18z" fill="${W}" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><path d="M47 30h26q-6 14-13 21-7-7-13-21z" fill="${YEL}"/><path d="M60 54v40" stroke="${YEL}" stroke-width="3"/><path d="M45 101q15-20 30 0z" fill="${RED}"/>`),
};
const toolById = Object.fromEntries(TOOLS.map((x) => [x.id, x]));
const byRank = RANK.map((id) => toolById[id]).concat(TOOLS.filter((x) => !RANK.includes(x.id)));
const RECO = {
  birthday: ["today", "personality", "reaction"],
  personality: ["birthday", "namematch", "reaction"],
  namematch: ["birthday", "personality", "today"],
  today: ["life", "birthday", "personality"],
  reaction: ["life", "personality", "birthday"],
  life: ["today", "reaction", "personality"],
};
const TTI_KEYS = ["rat", "ox", "tiger", "rabbit", "dragon", "snake", "horse", "goat", "monkey", "rooster", "dog", "pig"];
const TTI_EMOJI = Object.fromEntries(TTI_KEYS.map((k) => [k, tti[k].hanja])); // 이모지 대신 지지 한자
const ZODIAC_KEYS = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"];
const TYPE_KEYS = ["ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP", "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ"];
const REACTION_KEYS = ["fastSteady", "fastVaried", "slowSteady", "slowVaried"];
const REACTION_SLUG = { fastSteady: "fast-steady", fastVaried: "fast-varied", slowSteady: "slow-steady", slowVaried: "slow-varied" };
const LIFE_KEYS = ["adventure", "love", "stable", "fun", "drift"];
const LIFE_SLUG = { adventure: "adventurer", love: "warm-heart", stable: "steady-tree", fun: "mood-maker", drift: "drifter" };

// ---------- 공통 조각 ----------
const DISCLAIMER = "이 사이트의 모든 테스트와 운세는 재미로 보는 콘텐츠이며, 의학·심리·재정·법률적 판단의 근거가 될 수 없어요.";
const adSlot = (name) =>
  cfg.adsenseClient
    ? `<div class="ad" aria-label="광고"><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(cfg.adsenseClient)}" data-ad-format="auto" data-full-width-responsive="true" data-slot-name="${name}"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`
    : "";

const blocks = (arr = [], hTag = "h3") => arr.map((b) => `<${hTag}>${t(b.h)}</${hTag}>${fill(b.p).split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}`).join("");

const faqHtml = (faq = []) =>
  faq.length
    ? `<section class="faq"><h2>자주 묻는 질문</h2>${faq.map((f) => `<details><summary>${t(f.q)}</summary><p>${t(f.a)}</p></details>`).join("")}</section>`
    : "";

const faqLd = (faq = []) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({ "@type": "Question", name: fill(f.q), acceptedAnswer: { "@type": "Answer", text: fill(f.a) } })),
});

const crumbs = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it[0], item: abs(it[1]) })),
});
const crumbHtml = (items) =>
  `<nav class="crumbs" aria-label="현재 위치">${items.map((it, i) => (i < items.length - 1 ? `<a href="${u(it[1])}">${esc(it[0])}</a>` : `<span>${esc(it[0])}</span>`)).join(" › ")}</nav>`;

const toolCard = (tool, rank) =>
  `<a class="card c-${tool.cat}" href="${u(tool.path)}">${rank ? `<span class="rank">${rank}</span>` : ""}<span class="card-art">${ART[tool.id]}</span><span class="card-body"><span class="card-cat">${esc(CATS[tool.cat].name)}</span><strong>${esc(tool.title)}</strong><small>${esc(tool.hook)}</small><span class="card-meta">${esc(tool.meta)}</span></span></a>`;

const recoHtml = (ids, heading = "이것도 해 보세요") =>
  `<section class="reco"><h2>${heading}</h2><div class="cards">${ids.map((id) => toolCard(toolById[id])).join("")}</div></section>`;

const shareBar = (opts = {}) =>
  `<div class="share" data-share-title="${esc(opts.title || "")}" data-share-text="${esc(opts.text || "")}" data-share-path="${esc(opts.path || "")}">
  <button type="button" class="btn" data-act="share">공유하기</button>
  <button type="button" class="btn ghost" data-act="copy">링크 복사</button>
  <button type="button" class="btn ghost" data-act="image">결과 이미지 저장</button>
</div>`;

function layout({ title, desc, path: p, body, scripts = [], jsonld = [], noindex = false, ogType = "website", fullTitle = false, wide = false }) {
  const pageTitle = fullTitle ? title : `${title} | ${cfg.siteName}`;
  if (!noindex) sitemap.push(p);
  const ld = [
    { "@context": "https://schema.org", "@type": "WebSite", name: cfg.siteName, url: abs("/") },
    ...jsonld,
  ];
  return `<!doctype html>
<html lang="ko" data-base="${esc(cfg.basePath)}" data-site="${esc(cfg.siteName)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${abs(p)}">
${noindex ? '<meta name="robots" content="noindex,follow">' : ""}
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${esc(cfg.siteName)}">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${abs(p)}">
<meta property="og:image" content="${abs("/assets/og.png")}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#ffffff">
${cfg.googleVerification ? `<meta name="google-site-verification" content="${esc(cfg.googleVerification)}">` : ""}
${cfg.naverVerification ? `<meta name="naver-site-verification" content="${esc(cfg.naverVerification)}">` : ""}
<link rel="icon" href="${u("/assets/favicon.svg")}" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(cfg.siteName)}" href="${abs("/rss.xml")}">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap">
<link rel="stylesheet" href="${u("/assets/style.css")}">
${cfg.adsenseClient ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(cfg.adsenseClient)}" crossorigin="anonymous"></script>` : ""}
${cfg.gaId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(cfg.gaId)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(cfg.gaId)}');</script>` : ""}
<script type="application/ld+json">${JSON.stringify(ld.length === 1 ? ld[0] : ld).replace(/</g, "\\u003c")}</script>
</head>
<body>
<a class="skip" href="#main">본문으로 건너뛰기</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="logo" href="${u("/")}"><span class="logo-mark" aria-hidden="true">나</span>${esc(cfg.siteName)}</a>
    <nav class="nav" aria-label="카테고리">
      ${Object.entries(CATS).map(([k, c]) => `<a href="${u(`/${k}/`)}">${esc(c.name)}</a>`).join("")}
    </nav>
  </div>
</header>
<main id="main" class="wrap${wide ? " wide" : ""}">
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p class="notice">${esc(DISCLAIMER)}</p>
    <nav class="foot-links" aria-label="사이트 정보">
      <a href="${u("/about/")}">소개</a><a href="${u("/editorial/")}">작성·검수 기준</a><a href="${u("/privacy/")}"><strong>개인정보처리방침</strong></a><a href="${u("/terms/")}">이용약관</a><a href="${u("/disclaimer/")}">면책고지</a><a href="${u("/contact/")}">문의</a>
    </nav>
    <p class="copy">© ${new Date().getFullYear()} ${esc(cfg.operator)} · ${esc(cfg.siteName)}</p>
  </div>
</footer>
<script src="${u("/assets/app.js")}" defer></script>
${scripts.map((s) => `<script src="${u(`/assets/${s}`)}" defer></script>`).join("\n")}
</body>
</html>`;
}

// 툴 페이지 공통 본문: 설명 → [툴] → 결과 → 공유 → 추천 → 해석 가이드 → 광고 → FAQ → 광고
function toolPage(tool, toolHtml, { scripts = [], extraBelow = "", dataJson = null } = {}) {
  const g = guides[tool.id];
  if (!g) throw new Error(`guides.${tool.id} 없음`);
  const cat = CATS[tool.cat];
  const items = [["홈", "/"], [cat.name, `/${tool.cat}/`], [tool.title, tool.path]];
  const body = `
${crumbHtml(items)}
<article class="tool">
  <header class="page-head">
    <span class="eyebrow">${esc(cat.name)}</span>
    <h1>${esc(tool.h1)}</h1>
    <p class="lead">${esc(tool.desc)}</p>
    <p class="fun-badge">재미로 보는 콘텐츠예요</p>
  </header>
  <section class="tool-box" id="tool">
    ${toolHtml}
  </section>
  ${recoHtml(RECO[tool.id])}
  ${adSlot("after-reco")}
  <section class="prose">
    <h2>${esc(tool.title)}, 이렇게 활용해 보세요</h2>
    <p>${t(g.intro)}</p>
    <h2>결과 해석 가이드</h2>
    ${blocks(g.guide)}
  </section>
  ${extraBelow}
  ${adSlot("mid")}
  ${faqHtml(g.faq)}
</article>
${dataJson ? `<script type="application/json" id="page-data">${JSON.stringify(dataJson).replace(/</g, "\\u003c")}</script>` : ""}`;
  write(
    tool.path,
    layout({ title: tool.title, desc: tool.desc, path: tool.path, body, scripts, jsonld: [faqLd(g.faq), crumbs(items)] })
  );
}

// ---------- 빌드 시작 ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.cpSync(path.join(ROOT, "src", "assets"), path.join(DIST, "assets"), { recursive: true });

// 홈 — 「한 장 뽑기」 카드 덱 + 테스트 카드 + 12띠 도장 + 16유형 판
{
  const fan = [-15, -7, 0, 7, 15];
  const deck = byRank.slice(0, 5).map((tool, i) => `<a class="deck-card c-${tool.cat}" href="${u(tool.path)}" style="--r:${fan[i]}deg;--x:${(i - 2) * 54}px;--i:${i}"><span class="card-art">${ART[tool.id]}</span><strong>${esc(tool.title)}</strong></a>`).join("");
  const GROUP = { NT: "me", NF: "love", SJ: "luck", SP: "arcade" };
  const groupOf = (k) => (k[1] === "N" ? (k[2] === "T" ? "NT" : "NF") : k[3] === "J" ? "SJ" : "SP");
  const body = `
<section class="hero">
  <div class="hero-text">
    <p class="hero-kicker">운세 · 성격 테스트 · 짧은 게임</p>
    <h1>생일 하나 넣었는데<br>이렇게까지 나온다고?</h1>
    <p class="lead">오늘의 운세, 16유형, 이름 궁합, 1분 인생까지. 가입은 필요 없고, 입력한 건 어디에도 저장하지 않아요.</p>
    <div class="hero-actions">
      <button class="btn big" type="button" data-act="draw">아무거나 한 장 뽑기</button>
      <a class="text-link" href="${u("/me/birthday/")}">생일부터 넣어 볼래요</a>
    </div>
  </div>
  <div class="deck" aria-label="테스트 카드">${deck}</div>
</section>

<section class="home-block">
  <div class="tabs" role="tablist" aria-label="테스트 목록">
    <button type="button" role="tab" id="tab-pop" aria-controls="panel-pop" aria-selected="true" data-tab="pop">인기</button>
    <button type="button" role="tab" id="tab-all" aria-controls="panel-all" aria-selected="false" tabindex="-1" data-tab="all">전체 <small>${TOOLS.length}</small></button>
  </div>
  <div class="tab-panel" role="tabpanel" id="panel-pop" aria-labelledby="tab-pop"><div class="cards cards-home">${byRank.slice(0, 6).map((x, i) => toolCard(x, i + 1)).join("")}</div></div>
  <div class="tab-panel" role="tabpanel" id="panel-all" aria-labelledby="tab-all" hidden>${Object.entries(CATS)
    .map(([k, c]) => {
      const list = TOOLS.filter((x) => x.cat === k);
      return list.length ? `<div class="tab-cat"><h3><a href="${u(`/${k}/`)}">${esc(c.name)}</a> <small>${list.length}</small></h3><div class="cards cards-home">${list.map((x) => toolCard(x)).join("")}</div></div>` : "";
    })
    .join("")}</div>
</section>

<section class="home-block home-about">
  <div class="about-head">
    <h2 class="home-h">${esc(cfg.siteName)}는 이런 곳이에요</h2>
    <ul class="about-points"><li><b>매일 자정</b>새 운세로 바뀌어요</li><li><b>저장 0건</b>입력값은 브라우저 안에서만</li><li><b>직접 쓴 글</b>계산 방식까지 공개해요</li></ul>
  </div>
  <div class="about-body">${fill(pages.home.intro).split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}</div>
</section>

<section class="home-block band band-red">
  <div class="band-head">
    <h2 class="home-h">오늘, 내 띠는?</h2>
    <p>매일 자정에 바뀌어요. 띠를 누르면 오늘 운세가 바로 열려요.</p>
  </div>
  <div class="stamps">${TTI_KEYS.map((k) => `<a class="stamp" href="${u(`/luck/today/#${k}`)}"><span class="stamp-hanja">${esc(tti[k].hanja)}</span><span class="stamp-name">${esc(tti[k].name)}</span></a>`).join("")}</div>
</section>

<section class="home-block">
  <div class="band-head">
    <h2 class="home-h">열여섯 가지 중에 나는 어디쯤</h2>
    <p>코드를 누르면 해설이 열려요. 모르겠으면 <a href="${u("/me/personality/")}">20문항 테스트</a>부터.</p>
  </div>
  <div class="types">${TYPE_KEYS.map((k) => `<a class="type c-${GROUP[groupOf(k)]}" href="${u(`/me/personality/${k.toLowerCase()}/`)}"><b>${k}</b><span>${esc(personality[k].name)}</span></a>`).join("")}</div>
</section>
${adSlot("home")}`;
  write("/", layout({ title: `${cfg.siteName} — ${cfg.tagline}`, fullTitle: true, wide: true, scripts: ["home.js"], desc: "오늘의 띠별 운세, 만 나이·띠·별자리 계산, 16유형 성격 테스트, 이름 궁합, 1분 인생과 반응속도 게임까지. 나를 알아보는 재미있는 테스트를 한곳에서 즐겨 보세요.", path: "/", body }));
}

// 카테고리 페이지
const CAT_EXTRA = {
  me: () => `<section class="cat-block"><div class="cat-head"><h2>띠별 성격</h2></div><div class="chips">${TTI_KEYS.map((k) => `<a class="chip" href="${u(`/me/tti/${k}/`)}">${TTI_EMOJI[k]} ${esc(tti[k].name)}</a>`).join("")}</div></section>
<section class="cat-block"><div class="cat-head"><h2>별자리별 성향</h2></div><div class="chips">${ZODIAC_KEYS.map((k) => `<a class="chip" href="${u(`/me/zodiac/${k}/`)}">${zodiac[k].symbol} ${esc(zodiac[k].name)}</a>`).join("")}</div></section>
<section class="cat-block"><div class="cat-head"><h2>16유형 해설</h2></div><div class="chips">${TYPE_KEYS.map((k) => `<a class="chip" href="${u(`/me/personality/${k.toLowerCase()}/`)}">${esc(personality[k].name)}</a>`).join("")}</div></section>`,
  luck: () => `<section class="cat-block"><div class="cat-head"><h2>띠별 오늘의 운세 바로가기</h2></div><div class="chips">${TTI_KEYS.map((k) => `<a class="chip" href="${u(`/luck/today/#${k}`)}">${TTI_EMOJI[k]} ${esc(tti[k].name)}</a>`).join("")}</div></section>`,
  story: () => `<section class="cat-block"><div class="cat-head"><h2>1분 인생 엔딩 5가지</h2></div><div class="chips">${LIFE_KEYS.map((k) => `<a class="chip" href="${u(`/story/life/${LIFE_SLUG[k]}/`)}">${esc(guides.lifeTypes[k].name)}</a>`).join("")}</div></section>`,
  arcade: () => "",
  love: () => "",
};
for (const [k, c] of Object.entries(CATS)) {
  const list = TOOLS.filter((x) => x.cat === k);
  const items = [["홈", "/"], [c.name, `/${k}/`]];
  const body = `${crumbHtml(items)}
<header class="page-head"><span class="eyebrow">카테고리</span><h1>${esc(c.name)}</h1><p class="lead">${esc(c.desc)}</p></header>
<div class="cards">${list.map(toolCard).join("")}</div>
${CAT_EXTRA[k]()}
${recoHtml(TOOLS.filter((x) => x.cat !== k).slice(0, 3).map((x) => x.id), "다른 카테고리도 둘러보세요")}`;
  write(`/${k}/`, layout({ title: c.name, desc: `${c.name} — ${c.desc} ${list.map((x) => x.title).join(", ")}`, path: `/${k}/`, body, jsonld: [crumbs(items)] }));
}

// ① 생일로 보는 나
{
  const years = [];
  for (let y = new Date().getFullYear(); y >= 1930; y--) years.push(y);
  const html = `
<form class="form" id="birthday-form" autocomplete="off">
  <fieldset class="row3">
    <legend>생년월일 (양력)</legend>
    <label><span class="sr">년</span><select name="y" required><option value="">년</option>${years.map((y) => `<option${y === 2000 ? " " : ""}>${y}</option>`).join("")}</select></label>
    <label><span class="sr">월</span><select name="m" required><option value="">월</option>${Array.from({ length: 12 }, (_, i) => `<option>${i + 1}</option>`).join("")}</select></label>
    <label><span class="sr">일</span><select name="d" required><option value="">일</option>${Array.from({ length: 31 }, (_, i) => `<option>${i + 1}</option>`).join("")}</select></label>
  </fieldset>
  <button class="btn big" type="submit">나 알아보기</button>
  <p class="hint">입력한 생년월일은 이 브라우저 안에서만 계산되고 어디에도 저장·전송되지 않아요.</p>
</form>
<div class="result" id="birthday-result" hidden aria-live="polite"></div>`;
  toolPage(toolById.birthday, html, {
    scripts: ["birthday.js"],
    dataJson: {
      tti: Object.fromEntries(TTI_KEYS.map((k) => [k, { name: tti[k].name, hanja: tti[k].hanja, summary: fill(tti[k].summary), emoji: TTI_EMOJI[k] }])),
      zodiac: Object.fromEntries(ZODIAC_KEYS.map((k) => [k, { name: zodiac[k].name, symbol: zodiac[k].symbol, dates: zodiac[k].dates, element: zodiac[k].element, summary: fill(zodiac[k].summary) }])),
    },
  });
}

// ② 오늘의 띠별 운세 — 빌드 시점(한국 시간) 운세를 미리 그려 두고, 브라우저에서 날짜가 바뀌었으면 다시 그림. 매일 자정 GitHub Actions가 다시 빌드.
{
  const years = [];
  for (let y = new Date().getFullYear(); y >= 1930; y--) years.push(y);
  const html = `
<form class="today-find" id="today-find" autocomplete="off">
  <label><span class="sr">출생 연도</span><select name="y" required><option value="">출생 연도로 내 띠 찾기</option>${years.map((y) => `<option>${y}</option>`).join("")}</select></label>
  <button class="btn" type="submit">내 띠로 이동</button>
</form>
<p class="hint">1월~2월 초에 태어났다면 앞 해의 띠일 수 있어요. 띠는 입춘을 기준으로 바뀌어요.</p>
<div id="today" aria-live="polite">${renderDay(kstDate())}</div>
<div class="share"><button type="button" class="btn" data-act="threads">오늘의 운세 이미지 저장</button></div>
${shareBar({ title: "오늘의 띠별 운세", text: "매일 자정에 바뀌는 12띠 오늘의 운세", path: "/luck/today/" })}
<script type="module" src="${u("/assets/today.js")}"></script>`;
  toolPage(toolById.today, html);
}

// 띠별 성격 페이지
TTI_KEYS.forEach((k) => {
  const d = tti[k];
  const p = `/me/tti/${k}/`;
  const items = [["홈", "/"], ["나의 성격", "/me/"], [`${d.name} 성격`, p]];
  const len = textLen(d.personality);
  const born = d.years.filter((y) => y >= 1936 && y <= 2031);
  const body = `${crumbHtml(items)}
<article class="result-page">
  <header class="page-head"><span class="eyebrow">띠별 성격</span><h1>${TTI_EMOJI[k]} ${esc(d.name)} 성격과 특징</h1><p class="lead">${t(d.summary)}</p><p class="fun-badge">재미로 보는 콘텐츠예요</p></header>
  <section class="prose">${blocks(d.personality, "h2")}
  <h2>${esc(d.name)} 출생연도</h2><p>${born.map((y) => `${y}년`).join(" · ")}생 (입춘 기준)</p></section>
  ${shareBar({ title: `${d.name} 성격`, text: fill(d.summary), path: p })}
  <section class="prose"><p><a href="${u(`/luck/today/#${k}`)}">${esc(d.name)} 오늘의 운세 보기</a></p></section>
  <div class="chips">${TTI_KEYS.filter((x) => x !== k).map((x) => `<a class="chip" href="${u(`/me/tti/${x}/`)}">${TTI_EMOJI[x]} ${esc(tti[x].name)}</a>`).join("")}</div>
  ${recoHtml(["birthday", "today", "personality"])}
</article>`;
  write(p, layout({ title: `${d.name} 성격과 특징`, desc: `${d.name} 성격: ${fill(d.summary)} ${d.name} 출생연도와 오늘의 운세까지 함께 확인해 보세요.`, path: p, body, ogType: "article", noindex: len < 300, jsonld: [crumbs(items)] }));
});

// 별자리 페이지
ZODIAC_KEYS.forEach((k, i) => {
  const d = zodiac[k];
  const p = `/me/zodiac/${k}/`;
  const items = [["홈", "/"], ["나의 성격", "/me/"], [`${d.name}`, p]];
  const len = textLen(d.body);
  const same = ZODIAC_KEYS.filter((x) => x !== k && zodiac[x].element === d.element);
  const body = `${crumbHtml(items)}
<article class="result-page">
  <header class="page-head"><span class="eyebrow">별자리별 성향</span><h1>${d.symbol} ${esc(d.name)} 성격과 특징 <small>(${esc(d.dates)})</small></h1><p class="lead">${t(d.summary)}</p><p class="fun-badge">재미로 보는 콘텐츠예요</p></header>
  <div class="result-card" data-card-title="나의 별자리" data-card-main="${esc(d.name)}" data-card-sub="${t(d.summary)}">
    <div class="rc-emoji">${d.symbol}</div><div class="rc-main">${esc(d.name)} <small>${esc(d.en)}</small></div><p>${t(d.summary)}</p>
    <dl class="rc-meta"><div><dt>기간</dt><dd>${esc(d.dates)}</dd></div><div><dt>원소</dt><dd>${esc(d.element)}</dd></div></dl>
    <div class="tags">${(d.keywords || []).map((x) => `<span>#${t(x)}</span>`).join("")}</div>
  </div>
  ${shareBar({ title: `${d.name} 성격`, text: fill(d.summary), path: p })}
  <section class="prose">${blocks(d.body, "h2")}
  <h2>같은 「${esc(d.element)}」 원소의 별자리</h2><p>${same.map((x) => `<a href="${u(`/me/zodiac/${x}/`)}">${esc(zodiac[x].name)}</a>`).join(", ")}는 ${esc(d.name)}와 같은 원소로 묶여요. 별자리 경계 날짜는 해마다 하루쯤 달라질 수 있어요.</p></section>
  <div class="chips">${ZODIAC_KEYS.filter((x) => x !== k).map((x) => `<a class="chip" href="${u(`/me/zodiac/${x}/`)}">${zodiac[x].symbol} ${esc(zodiac[x].name)}</a>`).join("")}</div>
  ${recoHtml(["birthday", "namematch", "personality"])}
</article>`;
  write(p, layout({ title: `${d.name} 성격과 특징 (${d.dates})`, desc: `${d.name}(${d.dates}) 성격: ${fill(d.summary)}`, path: p, body, ogType: "article", noindex: len < 300, jsonld: [crumbs(items)] }));
});

// ③ 16유형 테스트 + 16 결과 페이지
{
  const html = `
<div id="quiz" class="quiz">
  <div class="quiz-start">
    <p>총 <strong>${questions.length}문항</strong>, 2~3분이면 끝나요. 너무 오래 고민하지 말고 평소의 나에 가깝게 골라 주세요.</p>
    <button class="btn big" type="button" data-act="start">테스트 시작하기</button>
  </div>
</div>`;
  const typeGrid = `<section class="prose"><h2>16가지 유형 둘러보기</h2></section><div class="chips">${TYPE_KEYS.map((k) => `<a class="chip" href="${u(`/me/personality/${k.toLowerCase()}/`)}">${k} · ${esc(personality[k].name)}</a>`).join("")}</div>`;
  toolPage(toolById.personality, html, { scripts: ["personality.js"], extraBelow: typeGrid, dataJson: { questions } });

  const AXES = { E: "외향", I: "내향", S: "감각", N: "직관", T: "사고", F: "감정", J: "판단", P: "인식" };
  TYPE_KEYS.forEach((k) => {
    const d = personality[k];
    const p = `/me/personality/${k.toLowerCase()}/`;
    const items = [["홈", "/"], ["나의 성격", "/me/"], ["16유형 성격 테스트", "/me/personality/"], [d.name, p]];
    const len = textLen(d.body) + [...d.strengths, ...d.cautions, d.match?.note || ""].join(" ").length;
    if (len < 800) warnings.push(`${p} 본문 ${len}자 (<800, noindex)`);
    const g = d.match?.good;
    const body = `${crumbHtml(items)}
<article class="result-page">
  <header class="page-head"><span class="eyebrow">16유형 성격 해설</span><h1>${esc(d.name)} <small>(${k})</small></h1><p class="lead">${t(d.summary)}</p><p class="fun-badge">재미로 보는 콘텐츠예요</p></header>
  <div class="result-card" data-card-title="나의 16유형" data-card-main="${esc(d.name)}" data-card-sub="${k} · ${t(d.summary)}">
    <div class="rc-emoji">${ART.personality}</div><div class="rc-main">${esc(d.name)}</div><div class="rc-code">${k} · ${k.split("").map((c) => AXES[c]).join("·")}</div>
    <p>${t(d.summary)}</p>
    <div id="my-axes" class="axes" hidden></div>
    <div class="tags">${(d.keywords || []).map((x) => `<span>#${t(x)}</span>`).join("")}</div>
  </div>
  ${shareBar({ title: `나의 16유형: ${d.name}`, text: fill(d.summary), path: p })}
  <p class="center"><a class="btn ghost" href="${u("/me/personality/")}">테스트 다시 하기</a></p>
  <section class="prose">${blocks(d.body, "h2")}
  <div class="two-col"><div><h2>이런 점이 빛나요</h2><ul>${d.strengths.map((x) => `<li>${t(x)}</li>`).join("")}</ul></div><div><h2>이런 점은 챙겨 보세요</h2><ul>${d.cautions.map((x) => `<li>${t(x)}</li>`).join("")}</ul></div></div>
  ${g && personality[g] ? `<h2>잘 통한다고 알려진 유형</h2><p><a href="${u(`/me/personality/${g.toLowerCase()}/`)}">${esc(personality[g].name)} (${g})</a> — ${t(d.match.note)}</p>` : ""}
  </section>
  ${adSlot("mid")}
  <div class="chips">${TYPE_KEYS.filter((x) => x !== k).map((x) => `<a class="chip" href="${u(`/me/personality/${x.toLowerCase()}/`)}">${x} · ${esc(personality[x].name)}</a>`).join("")}</div>
  ${recoHtml(["birthday", "namematch", "reaction"])}
  <p class="legal">이 테스트는 칼 융의 심리 유형론에서 출발한 대중적인 4축 모델을 참고해 ${esc(cfg.siteName)}가 자체 제작한 간이 테스트입니다. 공식 MBTI® 검사가 아니며, MBTI 상표 권리자 및 국내 판권사와 관련이 없습니다.</p>
</article>`;
    write(p, layout({ title: `${d.name}(${k}) 성격 특징·장단점`, desc: `16유형 ${k} ${d.name}: ${fill(d.summary)} 일·관계·스트레스 상황에서의 모습과 성장 팁을 정리했어요.`, path: p, body, scripts: ["personality-result.js"], ogType: "article", noindex: len < 800, jsonld: [crumbs(items)] }));
  });
}

// ④ 이름 궁합
{
  const html = `
<form class="form" id="name-form" autocomplete="off">
  <div class="row2">
    <label>나의 이름<input name="a" maxlength="5" placeholder="예: 김하늘" required inputmode="text"></label>
    <label>상대 이름<input name="b" maxlength="5" placeholder="예: 이바다" required inputmode="text"></label>
  </div>
  <details class="opt"><summary>생일도 넣어 별자리 조합 보기 (선택)</summary>
    <div class="row2">
      <label>나의 생일<input name="ad" type="text" placeholder="예: 0315" maxlength="4" inputmode="numeric" pattern="[0-9]{4}"></label>
      <label>상대 생일<input name="bd" type="text" placeholder="예: 1102" maxlength="4" inputmode="numeric" pattern="[0-9]{4}"></label>
    </div>
  </details>
  <button class="btn big" type="submit">궁합 보기</button>
  <p class="hint">이름은 완성된 한글 1~5글자로 넣어 주세요. 입력값은 이 브라우저 안에서만 계산되고 저장·전송되지 않아요.</p>
</form>
<div class="result" id="name-result" hidden aria-live="polite"></div>`;
  toolPage(toolById.namematch, html, {
    scripts: ["namematch.js"],
    dataJson: { bands: guides.namematchBands.map((b) => ({ ...b, title: fill(b.title), text: fill(b.text) })), elements: guides.elementMatch },
  });
}

// ⑤ 반응속도 + 4 결과 페이지
{
  const html = `
<div id="rt" class="rt" role="button" tabindex="0" aria-live="polite">
  <div class="rt-inner"><strong>여기를 눌러 시작</strong><span>빨간 화면이 초록색으로 바뀌는 순간 최대한 빨리 터치하세요. 총 5번 측정해요.</span></div>
</div>
<div class="rt-progress" id="rt-progress" aria-hidden="true"></div>
<div class="result" id="rt-result" hidden aria-live="polite"></div>
<p class="hint">결과는 기기와 화면, 입력 방식에 따라 수십 ms까지 달라질 수 있어요. 같은 기기로 여러 번 해 보면 나만의 기록을 비교할 수 있어요.</p>`;
  toolPage(toolById.reaction, html, { scripts: ["reaction.js"] });


}

// 1분 인생 장면 검사: 갈림길·이정표의 장면 키, 배경, 소품이 모두 있고, 시기마다 배경이 3종 이상인지 (어기면 빌드 실패)
function checkLife() {
  const ctx = { window: {} };
  ctx.NALGI = ctx.window.NALGI = {};
  vm.createContext(ctx);
  for (const f of ["pixel.js", "life-data.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, "src", "assets", f), "utf8"), ctx, { filename: f });
  const { BG_KEYS, PROPS, FX } = ctx.NALGI.pixel, { SLOTS, SCENES, MILESTONES } = ctx.NALGI.lifeData;
  const err = [];
  const scene = (k, where) => {
    const s = SCENES[k];
    if (!s) return err.push(`${where}: 장면 ${k} 없음`);
    if (!BG_KEYS.includes(s.bg)) err.push(`${where}: 배경 ${s.bg} 없음`);
    [...(s.props || []), ...(s.back || [])].forEach(([p]) => PROPS[p] || err.push(`${where}: 소품 ${p} 없음`));
    (s.fx || []).forEach((p) => FX[p] || err.push(`${where}: 효과 ${p} 없음`));
    return s.bg;
  };
  let n = 0;
  SLOTS.forEach(([[lo, hi], list]) => {
    const bgs = new Set(list.map((e) => (n++, scene(e[5], `${lo}~${hi}세 「${e[0]}」`))));
    if (bgs.size < 3) err.push(`${lo}~${hi}세 시기의 배경이 ${bgs.size}종뿐 (3종 이상 필요)`);
  });
  if (n !== 100) err.push(`갈림길이 ${n}개 (100개여야 함)`);
  MILESTONES.forEach(([, , k]) => ["city", "sea", "mountain"].forEach((b) => scene(k.replace("{born}", b), `이정표 ${k}`)));
  scene("ending", "엔딩");
  const used = new Set(Object.values(SCENES).map((s) => s.bg));
  BG_KEYS.forEach((b) => used.has(b) || err.push(`배경 ${b}가 어느 장면에도 안 쓰임`));
  if (BG_KEYS.length !== 12) err.push(`배경이 ${BG_KEYS.length}종 (12종이어야 함)`);
  if (err.length) throw new Error("1분 인생 장면 검사 실패:\n  " + [...new Set(err)].join("\n  "));
}

// ⑥ 1분 인생 + 엔딩 5개
{
  const html = `
<div id="life" class="life">
  <div class="life-start">
    <canvas class="life-pix" id="life-intro" width="96" height="60" role="img" aria-label="태어날 사람 미리보기"></canvas>
    <p class="hint center">그림을 누르면 머리 모양과 옷이 바뀌어요.</p>
    <p>한 사람이 태어나요. 그 사람이 되어 일생을 <strong>인생 시계 60초</strong> 동안 살아 보세요.</p>
    <p>나이는 저절로 흘러가요. 갈림길이 나타나면 시계가 멈추고, <strong>5초 안에</strong> 고르면 돼요. 안 고르면 인생이 대신 골라요.</p>
    <form class="life-setup" id="life-setup" autocomplete="off">
      <fieldset class="seg"><legend>성별</legend>
        <label><input type="radio" name="look" value="m"><span>남</span></label><label><input type="radio" name="look" value="f"><span>여</span></label><label><input type="radio" name="look" value="n" checked><span>선택 안 함</span></label>
      </fieldset>
      <fieldset class="seg"><legend>태어난 곳</legend>
        <label><input type="radio" name="born" value="city" checked><span>도시</span></label><label><input type="radio" name="born" value="sea"><span>바닷가</span></label><label><input type="radio" name="born" value="mountain"><span>산골</span></label>
      </fieldset>
      <div class="life-row">
        <label>띠<select name="tti">${TTI_KEYS.map((k, i) => `<option value="${i}">${esc(tti[k].name)}</option>`).join("")}</select></label>
        <label>이름 (선택)<input name="name" maxlength="8" placeholder="비워 둬도 돼요"></label>
      </div>
      <p class="hint">성별은 그림의 옷차림에만 쓰여요. 이름은 결과 화면에만 보이고 저장하거나 보내지 않으며, 결과 이미지와 공유 문구에도 들어가지 않아요.</p>
      <div class="life-start-btns"><button type="button" class="btn ghost" data-act="random">랜덤 탄생</button><button class="btn big" type="submit">태어나기</button></div>
      <p class="hint life-done" id="life-done" hidden></p>
    </form>
  </div>
</div>`;
  const types = Object.fromEntries(LIFE_KEYS.map((k) => [k, { name: fill(guides.lifeTypes[k].name), epitaph: fill(guides.lifeTypes[k].epitaph) }]));
  toolPage(toolById.life, html, { scripts: ["pixel.js", "life-data.js", "life.js"], dataJson: { types, slugs: LIFE_SLUG, tti: TTI_KEYS.map((k) => ({ key: k, name: tti[k].name })) } });
  checkLife();

  LIFE_KEYS.forEach((k) => {
    const d = guides.lifeTypes[k];
    const p = `/story/life/${LIFE_SLUG[k]}/`;
    const items = [["홈", "/"], ["이야기 게임", "/story/"], ["1분 인생", "/story/life/"], [d.name, p]];
    const len = fill(d.text).trim().length;
    if (len < 300) warnings.push(`${p} 본문 ${len}자 (<300, noindex)`);
    const body = `${crumbHtml(items)}
<article class="result-page">
  <header class="page-head"><span class="eyebrow">1분 인생 엔딩</span><h1>${t(d.name)}</h1><p class="lead">${t(d.summary)}</p><p class="fun-badge">재미로 보는 콘텐츠예요</p></header>
  <div class="result-card life-card" data-card-title="1분 인생" data-card-main="${t(d.name)}" data-card-sub="${t(d.epitaph)}">
    <div class="rc-emoji">${ART.life}</div><div class="rc-main">${t(d.name)}</div><p>“${t(d.epitaph)}”</p>
  </div>
  ${shareBar({ title: `1분 인생: ${fill(d.name)}`, text: fill(d.epitaph), path: p })}
  <p class="center"><a class="btn ghost" href="${u("/story/life/")}">나도 1분 살아 보기</a></p>
  <section class="prose">${fill(d.text).split(/\n+/).map((x) => `<p>${esc(x)}</p>`).join("")}
  <h2>1분 인생의 다섯 가지 엔딩</h2><ul>${LIFE_KEYS.map((x) => `<li><a href="${u(`/story/life/${LIFE_SLUG[x]}/`)}">${t(guides.lifeTypes[x].name)}</a> — ${t(guides.lifeTypes[x].summary)}</li>`).join("")}</ul></section>
  ${recoHtml(["today", "reaction", "personality"])}
</article>`;
    write(p, layout({ title: `1분 인생 엔딩: ${fill(d.name)}`, desc: `1분 인생 결과 ${fill(d.name)}: ${fill(d.summary)}. “${fill(d.epitaph)}”`, path: p, body, ogType: "article", noindex: len < 300, jsonld: [crumbs(items)] }));
  });
}

// 옛 주소(/brain/…, 폐지된 반응 스타일 결과 페이지) → 새 주소로 이동 (색인 제외)
{
  const moved = [["/brain/", "/arcade/"], ["/brain/reaction/", "/arcade/reaction/"], ...REACTION_KEYS.flatMap((k) => [[`/brain/reaction/${REACTION_SLUG[k]}/`, "/arcade/reaction/"], [`/arcade/reaction/${REACTION_SLUG[k]}/`, "/arcade/reaction/"]])];
  for (const [from, to] of moved) {
    const file = path.join(DIST, from, "index.html");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><link rel="canonical" href="${abs(to)}"><meta http-equiv="refresh" content="0;url=${u(to)}"><a href="${u(to)}">이동했어요</a>`);
  }
}

// 정보 페이지
const INFO = ["about", "privacy", "terms", "disclaimer", "contact"];
for (const k of INFO) {
  const d = pages[k];
  const p = `/${k}/`;
  const extra = k === "contact" ? `<p class="contact-mail">📮 <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a></p>` : "";
  const body = `${crumbHtml([["홈", "/"], [d.title, p]])}<article class="prose doc"><h1>${t(d.title)}</h1>${extra}${blocks(d.body, "h2")}</article>`;
  write(p, layout({ title: fill(d.title), desc: `${cfg.siteName} ${fill(d.title)}`, path: p, body }));
}
// 작성·검수 기준
{
  const p = "/editorial/";
  const body = `${crumbHtml([["홈", "/"], ["작성·검수 기준", p]])}<article class="prose doc"><h1>작성·검수 기준</h1>
<p>${esc(cfg.siteName)}는 「가볍게 즐기되, 대충 만들지 않는다」를 원칙으로 콘텐츠를 만들어요. 모든 테스트와 해설은 아래 기준을 거쳐 공개합니다.</p>
<h2>1. 직접 쓰고 사람이 검수해요</h2><p>해설과 운세 문구는 다른 사이트의 문장을 옮기지 않고 직접 작성합니다. 초안 작성에 도구의 도움을 받더라도, 공개 전에 운영자가 한 문장씩 읽고 사실관계와 표현을 확인해요.</p>
<h2>2. 단정하지 않아요</h2><p>운세와 성격 해설은 「~할 수 있어요」, 「참고해 보세요」처럼 가능성으로 표현합니다. 건강이 좋아진다거나 돈이 들어온다는 식의 결과를 보장하는 문구, 특정 관계를 맺거나 끊으라고 권하는 문구는 쓰지 않아요.</p>
<h2>3. 계산은 투명하게 공개해요</h2><p>만 나이, 띠, 별자리, 이름 궁합, 반응속도처럼 계산이 들어가는 도구는 각 페이지의 「결과 해석 가이드」에 계산 방식을 적어 둡니다. 띠는 입춘 기준, 별자리는 일반적으로 쓰이는 날짜 구간을 따르며 경계 날짜는 해마다 하루쯤 달라질 수 있어요.</p>
<h2>4. 개인정보를 받지 않아요</h2><p>생년월일과 이름은 사용자의 브라우저 안에서만 계산하고 서버로 보내거나 저장하지 않습니다. 공유 링크와 공유 이미지에도 입력한 이름이나 생년월일은 들어가지 않아요.</p>
<h2>5. 권리를 존중해요</h2><p>실존 인물의 사진이나 다른 서비스의 이미지·게임 규칙·명칭을 가져다 쓰지 않습니다. 16유형 성격 테스트는 대중적인 4축 모델을 참고한 자체 제작 간이 테스트이며 공식 검사와 무관해요.</p>
<h2>6. 고칠 점은 바로 고쳐요</h2><p>잘못된 내용이나 불편한 표현을 발견하셨다면 <a href="${u("/contact/")}">문의</a>로 알려 주세요. 확인 후 빠르게 수정하겠습니다.</p>
<p class="hint">운영: ${esc(cfg.operator)}</p></article>`;
  write(p, layout({ title: "작성·검수 기준", desc: `${cfg.siteName}가 테스트와 해설을 만들고 검수하는 기준을 소개합니다.`, path: p, body }));
}

// 404
write("/404.html", layout({ title: "페이지를 찾을 수 없어요", desc: "요청하신 페이지를 찾을 수 없어요.", path: "/404.html", noindex: true, body: `<section class="hero"><h1>앗, 길을 잃었어요</h1><p class="lead">주소가 바뀌었거나 없는 페이지예요. 대신 이런 테스트는 어떠세요?</p></section>${recoHtml(["today", "birthday", "personality"], "인기 테스트")}` }));

// sitemap / robots / rss
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map((p) => `  <url><loc>${abs(p)}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${abs("/sitemap.xml")}\n`);
const rssItems = [...TOOLS.map((x) => [x.title, x.path, x.desc]), ...TYPE_KEYS.map((k) => [`${personality[k].name}(${k}) 성격 특징`, `/me/personality/${k.toLowerCase()}/`, fill(personality[k].summary)])];
fs.writeFileSync(path.join(DIST, "rss.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(cfg.siteName)}</title><link>${abs("/")}</link><description>${esc(cfg.tagline)}</description><language>ko</language>\n${rssItems.map(([ti, p, d]) => `<item><title>${esc(ti)}</title><link>${abs(p)}</link><guid>${abs(p)}</guid><description>${esc(d)}</description><pubDate>${new Date().toUTCString()}</pubDate></item>`).join("\n")}\n</channel></rss>\n`);
if (cfg.adsenseClient) fs.writeFileSync(path.join(DIST, "ads.txt"), `google.com, ${cfg.adsenseClient.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`);

console.log(`✔ 빌드 완료: ${sitemap.length}개 색인 페이지 → dist/  (SITE_URL=${cfg.siteUrl})`);
if (warnings.length) console.log("⚠ 확인 필요:\n  " + warnings.join("\n  "));
