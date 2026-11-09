// 펭귄 툴즈 정적 사이트 빌더 — 외부 패키지 없이 Node 18+ 만으로 dist/ 를 생성합니다. (툴 라이브러리는 src/assets/vendor/에 직접 둠)
// 사용: node build.mjs   (환경변수 SITE_URL, SITE_NAME, CONTACT_EMAIL, ADSENSE_CLIENT, GA_ID 로 설정 덮어쓰기)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import cfg from "./config.mjs";
const BUILD_V = Date.now().toString(36); // 자원 주소 버전(배포마다 바뀜) → 캐시된 옛 CSS·JS가 새 HTML과 섞이지 않음
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
const toolText = await load("tools");
const PAY = await load("pay-rates-2026"); // P2-45 직장인 돈 계산기 요율(한 파일)
const OST = await load("tax-overseas-2026"); // P2-53 해외주식 양도소득세 요율·규칙(한 파일)

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
  pageHtml.set(p, html); // P2-35 sitemap lastmod 계산용
}
const pageHtml = new Map();

// ---------- 사이트 구조 ----------
// P2-49 펭귄 오락실 = 게임만. 옛 오락실 카테고리 me(나의 성격)·love(나의 관계)·luck(나의 운)은 툴 카테고리 「운세·재미」(UCATS.fun, /fun/)로 합침
const CATS = {
  story: { name: "이야기 게임", icon: "", desc: "생각은 짧게, 여운은 길게. 한 판이면 끝나는 짧은 이야기 게임이에요." },
  arcade: { name: "순발력 게임", icon: "", desc: "머리보다 손이 먼저 움직이는 짧은 게임이에요." },
};
// hook: 홈·추천 카드에 쓰는 짧은 한 줄 / meta: 소요 시간·분량
// 노출 순위(RANK): 홈 오락실 띠와 오락실 순서 참고값. 지금은 운영진 추정치이고, GA4·서치콘솔 데이터가 쌓이면 실측 노출 순으로 바꿉니다.
const TOOLS = [
  { id: "birthday", cat: "fun", path: "/fun/birthday/", icon: "🎂", title: "생일로 보는 나", h1: "생일로 보는 나 — 만 나이·띠·별자리 한 번에", desc: "생년월일만 넣으면 만 나이, 띠, 별자리, 다음 생일 D-day까지 한 번에 알려 드려요.", hook: "만 나이, 띠, 별자리, 다음 생일까지 며칠 남았는지. 생일만 넣으면 끝.", meta: "10초" },
  { id: "personality", cat: "fun", path: "/fun/personality/", icon: "🧩", title: "16유형 성격 테스트", h1: "16유형 성격 테스트 — 20문항으로 보는 나의 성향", desc: "20개 문항에 답하면 4가지 축의 비율과 16유형 중 나와 가까운 유형을 알려 드려요.", hook: "20문항이면 네 가지 축이 몇 대 몇인지까지 나와요.", meta: "20문항 · 3분" },
  { id: "namematch", cat: "fun", path: "/fun/name-match/", icon: "💌", title: "이름 궁합 테스트", h1: "이름 궁합 테스트 — 획수로 보는 두 사람의 케미", desc: "두 사람의 이름 획수를 더해 가며 궁합 점수를 계산하는 추억의 이름 궁합 놀이예요.", hook: "공책 귀퉁이에 획수 적어 가며 하던 그 궁합, 기억나요?", meta: "이름 두 개" },
  { id: "today", cat: "fun", path: "/fun/today/", icon: "", title: "오늘의 띠별 운세", h1: "오늘의 띠별 운세 — 매일 자정에 바뀌는 12띠 하루 운세", desc: "열두 띠의 오늘 하루 흐름과 일·관계 팁, 행운의 색·숫자를 매일 새로 정리해요.", hook: "매일 자정에 바뀌어요. 내 띠의 오늘 하루는?", meta: "매일 업데이트" },
  { id: "saju", cat: "fun", path: "/fun/saju/", icon: "", title: "무료 사주팔자", h1: "무료 사주팔자 — 만세력부터 올해 운세까지", desc: "생년월일시로 사주 여덟 글자를 계산하고 오행·십신·대운과 연애운·재물운·직업운 등 6가지 운, 올해 운세를 풀어 드려요.", hook: "절기·출생지 경도까지 반영한 만세력. 연애운·재물운·취업운까지.", meta: "생년월일시 · 1분" }, // P2-22
  { id: "reaction", cat: "arcade", path: "/arcade/reaction/", icon: "⚡", title: "반응속도 게임", h1: "반응속도 게임 — 초록색이 되는 순간 터치!", desc: "빨간 화면이 초록색으로 바뀌는 순간을 다섯 번 잡아 보세요. 평균 기록과 등급, 내 최고 기록을 알려 드려요.", hook: "초록색 되는 순간 누르기. 다섯 번 평균으로 등급이 매겨져요.", meta: "터치 5번" },
  { id: "rpg", cat: "story", path: "/story/penguin-rpg/", icon: "", title: "펭귄 RPG 뽀득이와 오색 연", h1: "펭귄 RPG — 뽀득이와 오색 연", desc: "색을 잃은 얼음 군도에서 펭귄 뽀득이가 오색 실 네 가닥을 찾아 떠나는 약 1시간짜리 턴제 RPG. 지역 4곳과 보스 5마리, 동료 2명, 자동 저장.", hook: "색을 잃은 얼음 군도, 오색 실을 찾아 떠나는 1시간 모험.", meta: "턴제 RPG · 약 1시간 · 자동 저장" },
  { id: "stack", cat: "arcade", path: "/arcade/stack/", icon: "", title: "블록 쌓기 게임", h1: "블록 쌓기 게임 — 탭 한 번으로 높이 쌓기", desc: "좌우로 움직이는 블록을 탭해서 멈추고, 아래 블록과 겹친 만큼만 남겨 높이 쌓는 게임이에요. 딱 맞추면 PERFECT, 이 기기의 최고 기록을 남겨 다시 도전할 수 있어요.", hook: "탭 한 번에 한 층. 딱 맞추면 PERFECT.", meta: "탭 · Space" },
  { id: "life", cat: "story", path: "/story/life/", icon: "", title: "Life Game", seo: "Life Game — 인생 시뮬레이션 게임, 진학·결혼·직업을 직접 고르기", h1: "Life Game — 진학·결혼·직업, 갈림길을 직접 고르는 인생 게임", desc: "한 사람이 되어 일생을 살아 보는 도트 이야기 게임. 진학, 첫 직업, 결혼, 자녀, 이직, 이사, 위기, 은퇴 같은 인생의 터닝포인트를 시간 제한 없이 직접 고르면, 고른 길에 맞는 장면과 엔딩, 내 인생 연표가 나와요.", hook: "결혼할까, 창업할까? 터닝포인트를 직접 고르는 인생.", meta: "5~10분 · 터닝포인트 9번" },
  { id: "hell", cat: "arcade", path: "/arcade/hell-31/", icon: "", title: "지옥에서 살아남기", h1: "지옥에서 살아남기 — Hell Survival 31", desc: "A와 B 중 하나는 살고 하나는 죽는 31단계 병맛 선택 게임. 슬랩스틱 사망 31종을 모으는 사망 도감과 「가장 억울한 죽음」 공유 카드까지, 3~5분이면 한 판.", hook: "A/B 중 하나는 즉사. 상식대로 고르면 대개 죽는 31단계.", meta: "31단계 · 3~5분" }, // P2-27
  { id: "hellchosun", cat: "story", path: "/story/hell-chosun/", icon: "", title: "헬조선에서 살아남기", h1: "헬조선에서 살아남기 — 0세부터 80세까지 40단계", desc: "자산·체력·멘탈·눈치를 지키며 0세부터 80세까지 40단계를 버티는 병맛 인생 생존 게임. 사망 도감 44장, 엔딩 4종, 다음 생 유산 보너스.", hook: "자산·체력·멘탈·눈치 중 하나라도 바닥나면 끝. 80세까지 버티기.", meta: "40단계 · 15~30분" }, // P2-28
  { id: "draw", cat: "fun", path: "/fun/ladder/", icon: "", title: "사다리타기 · 돌림판 · 제비뽑기", seo: "사다리타기 · 돌림판 · 제비뽑기 — 무료 온라인 뽑기", h1: "사다리타기 · 돌림판 · 제비뽑기 — 커피 내기, 점심 메뉴 정하기", desc: "참가자와 결과 항목을 넣고 사다리타기, 돌림판, 제비뽑기 중 하나로 정해요. 같은 결과가 그대로 재생되는 공정성 링크와 결과 이미지 저장을 지원해요.", hook: "커피 내기·점심 메뉴·청소 당번. 공정성 링크로 같은 결과 재생.", meta: "사다리 · 돌림판 · 제비", kw: "사다리타기 사다리 게임 돌림판 룰렛 돌리기 제비뽑기 랜덤 뽑기 추첨 커피 내기 점심 메뉴 정하기 청소 당번 발표 순서 복불복" }, // P2-44
];
// 카드 그림(인라인 SVG). 이모지 대신 사이트 고유 그림을 씁니다.
const K = "#141414", W = "#fff", RED = "#e5372b", YEL = "#ffc21a", GRN = "#1e9e5a";
const sv = (inner) => `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">${inner}</svg>`;
const ART = {
  birthday: sv(`<rect x="18" y="24" width="84" height="80" rx="8" fill="${W}" stroke="${K}" stroke-width="4"/><path d="M18 32a8 8 0 0 1 8-8h68a8 8 0 0 1 8 8v14H18z" fill="${RED}" stroke="${K}" stroke-width="4"/><rect x="36" y="14" width="8" height="20" rx="4" fill="${K}"/><rect x="76" y="14" width="8" height="20" rx="4" fill="${K}"/><g fill="${K}">${[30, 48, 66, 84].flatMap((x) => [58, 74, 90].map((y) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" rx="2"/>`)).join("")}</g><circle cx="66" cy="74" r="11" fill="none" stroke="${RED}" stroke-width="4"/>`),
  personality: sv(`<rect x="18" y="18" width="40" height="40" rx="6" fill="${YEL}" stroke="${K}" stroke-width="4"/><circle cx="82" cy="38" r="20" fill="${W}" stroke="${K}" stroke-width="4"/><rect x="18" y="62" width="40" height="40" rx="6" fill="${K}" stroke="${K}" stroke-width="4"/><path d="M62 102 82 62l20 40z" fill="${RED}" stroke="${K}" stroke-width="4" stroke-linejoin="round"/>`),
  namematch: sv(`<circle cx="47" cy="60" r="28" fill="${W}"/><circle cx="73" cy="60" r="28" fill="${YEL}"/><path d="M60 35.2A28 28 0 0 1 60 84.8 28 28 0 0 1 60 35.2z" fill="${K}"/><circle cx="47" cy="60" r="28" fill="none" stroke="${K}" stroke-width="4"/><circle cx="73" cy="60" r="28" fill="none" stroke="${K}" stroke-width="4"/>`),
  saju: sv(`<rect x="14" y="16" width="92" height="88" rx="8" fill="${W}" stroke="${K}" stroke-width="4"/><path d="M37 16v88M60 16v88M83 16v88M14 60h92" stroke="${K}" stroke-width="3"/><text x="25.5" y="49" font-size="20" font-weight="800" text-anchor="middle" fill="${GRN}" font-family="serif">甲</text><text x="48.5" y="49" font-size="20" font-weight="800" text-anchor="middle" fill="${RED}" font-family="serif">丙</text><text x="71.5" y="49" font-size="20" font-weight="800" text-anchor="middle" fill="${K}" font-family="serif">戊</text><text x="94.5" y="49" font-size="20" font-weight="800" text-anchor="middle" fill="${YEL}" font-family="serif">庚</text><text x="25.5" y="92" font-size="20" font-weight="800" text-anchor="middle" fill="${K}" font-family="serif">子</text><text x="48.5" y="92" font-size="20" font-weight="800" text-anchor="middle" fill="${RED}" font-family="serif">午</text><text x="71.5" y="92" font-size="20" font-weight="800" text-anchor="middle" fill="${GRN}" font-family="serif">寅</text><text x="94.5" y="92" font-size="20" font-weight="800" text-anchor="middle" fill="${K}" font-family="serif">申</text>`), // P2-22
  today: sv(`<path d="M30 84a30 30 0 0 1 60 0z" fill="${YEL}" stroke="${K}" stroke-width="4"/><path d="M22.4 70.3 11.1 66.2M37.1 51.2l-6.9-9.8M60 44V32M82.9 51.2l6.9-9.8M97.6 70.3l11.3-4.1" stroke="${RED}" stroke-width="6" stroke-linecap="round"/><path d="M12 84h96M30 96h22M68 96h22M44 107h32" stroke="${K}" stroke-width="4" stroke-linecap="round"/>`),
  rpg: sv(`<path d="M60 10l38 38-38 38-38-38z" fill="${YEL}" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><path d="M60 10v76M22 48h76" stroke="${K}" stroke-width="3"/><path d="M60 86c-6 8 4 12-2 20" fill="none" stroke="${RED}" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="48" r="13" fill="${K}"/><path d="M60 42c-2-3-8-3-9 2-1 5 3 10 9 10s10-5 9-10c-1-5-7-5-9-2z" fill="${W}"/><path d="M58 50h4l-2 2.5z" fill="${YEL}"/>`),
  stack: sv(`<rect x="22" y="84" width="76" height="18" rx="4" fill="${RED}" stroke="${K}" stroke-width="4"/><rect x="30" y="64" width="62" height="18" rx="4" fill="${YEL}" stroke="${K}" stroke-width="4"/><rect x="36" y="44" width="50" height="18" rx="4" fill="${W}" stroke="${K}" stroke-width="4"/><rect x="50" y="18" width="50" height="18" rx="4" fill="${GRN}" stroke="${K}" stroke-width="4"/><path d="M16 27h22M24 20l-8 7 8 7" fill="none" stroke="${K}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),
  reaction: sv(`<rect x="51" y="10" width="18" height="10" rx="3" fill="${YEL}"/><rect x="57" y="18" width="6" height="10" fill="${W}"/><circle cx="60" cy="68" r="38" fill="${W}"/><path d="M60 68V38a30 30 0 0 1 21.2 8.8z" fill="${GRN}"/><circle cx="60" cy="68" r="30" fill="none" stroke="${K}" stroke-width="3" stroke-dasharray="2 13.7"/><path d="M60 68 78 50" stroke="${RED}" stroke-width="6" stroke-linecap="round"/><circle cx="60" cy="68" r="5" fill="${K}"/>`),
  life: sv(`<path d="M34 16h52M34 104h52" stroke="${K}" stroke-width="6" stroke-linecap="round"/><path d="M40 18h40c0 22-18 30-18 42s18 20 18 42H40c0-22 18-30 18-42S40 40 40 18z" fill="${W}" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><path d="M47 30h26q-6 14-13 21-7-7-13-21z" fill="${YEL}"/><path d="M60 54v40" stroke="${YEL}" stroke-width="3"/><path d="M45 101q15-20 30 0z" fill="${RED}"/>`),
  hell: sv(`<path d="M60 8c8 18 30 26 30 52a30 30 0 0 1-60 0c0-14 8-20 12-30 4 8 8 10 10 10-2-12 2-22 8-32z" fill="${RED}" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><path d="M42 64a18 18 0 0 1 36 0v10l-6 4v8H48v-8l-6-4z" fill="${W}" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><circle cx="52" cy="66" r="5" fill="${K}"/><circle cx="68" cy="66" r="5" fill="${K}"/><path d="M60 72l-3 5h6z" fill="${K}"/><path d="M54 86v-6M60 86v-6M66 86v-6" stroke="${K}" stroke-width="3"/><rect x="74" y="88" width="38" height="24" rx="5" fill="${YEL}" stroke="${K}" stroke-width="4"/><text x="93" y="107" font-size="18" font-weight="800" text-anchor="middle" fill="${K}" font-family="sans-serif">31</text>`), // P2-27
  hellchosun: sv(`<rect x="14" y="70" width="92" height="36" rx="4" fill="${W}" stroke="${K}" stroke-width="4"/><path d="M14 70l46-40 46 40" fill="${RED}" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><rect x="30" y="80" width="18" height="16" fill="${YEL}" stroke="${K}" stroke-width="3"/><rect x="72" y="80" width="18" height="26" fill="${K}"/><path d="M20 26h22M31 16v20" stroke="${K}" stroke-width="5" stroke-linecap="round"/><text x="90" y="36" font-size="18" font-weight="800" text-anchor="middle" fill="${K}" font-family="sans-serif">80</text>`), // P2-28
  // 실용 툴 그림: 접힌 귀퉁이가 있는 문서(doc) 조합
  pdfmerge: sv(`${doc(14, 14, 40, 52, W)}${doc(30, 26, 40, 52, YEL)}<path d="M74 60h14" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M84 52l9 8-9 8" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>${doc(66, 52, 40, 54, RED)}<text x="86" y="90" font-size="15" font-weight="800" text-anchor="middle" fill="${W}" font-family="sans-serif">PDF</text>`),
  pdfsplit: sv(`${doc(16, 16, 54, 72, RED)}<text x="43" y="60" font-size="16" font-weight="800" text-anchor="middle" fill="${W}" font-family="sans-serif">PDF</text><path d="M8 96h104" stroke="${K}" stroke-width="4" stroke-dasharray="7 6"/>${doc(56, 58, 30, 40, W)}${doc(80, 66, 30, 40, YEL)}`),
  img2pdf: sv(`<rect x="12" y="20" width="56" height="48" rx="6" fill="${W}" stroke="${K}" stroke-width="4"/><circle cx="28" cy="36" r="6" fill="${YEL}" stroke="${K}" stroke-width="3"/><path d="M16 64l16-14 10 8 12-12 12 18z" fill="${GRN}" stroke="${K}" stroke-width="3" stroke-linejoin="round"/><path d="M40 82h16" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M52 74l9 8-9 8" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>${doc(64, 46, 44, 60, RED)}<text x="86" y="84" font-size="15" font-weight="800" text-anchor="middle" fill="${W}" font-family="sans-serif">PDF</text>`),
  word2pdf: sv(`${doc(10, 18, 46, 62, W)}<path d="M20 40h26M20 50h26M20 60h18" stroke="${K}" stroke-width="4" stroke-linecap="round"/><path d="M56 88h12" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M64 80l9 8-9 8" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>${doc(66, 40, 44, 66, RED)}<text x="88" y="80" font-size="15" font-weight="800" text-anchor="middle" fill="${W}" font-family="sans-serif">PDF</text>`),
  imgcompress: sv(`<rect x="22" y="22" width="76" height="76" rx="8" fill="${W}" stroke="${K}" stroke-width="4"/><circle cx="44" cy="46" r="8" fill="${YEL}" stroke="${K}" stroke-width="3"/><path d="M28 92l22-22 14 12 14-16 16 26z" fill="${GRN}" stroke="${K}" stroke-width="3" stroke-linejoin="round"/><g fill="none" stroke="${RED}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 8l14 14M22 10v12H10"/><path d="M112 8 98 22M98 10v12h12"/><path d="M8 112l14-14M22 110V98H10"/><path d="M112 112 98 98M98 110V98h12"/></g>`),
  charcount: sv(`<rect x="16" y="14" width="66" height="88" rx="6" fill="${W}" stroke="${K}" stroke-width="4"/><path d="M28 34h42M28 48h42M28 62h30M28 76h38" stroke="${K}" stroke-width="4" stroke-linecap="round"/><rect x="58" y="70" width="50" height="34" rx="8" fill="${YEL}" stroke="${K}" stroke-width="4"/><text x="83" y="94" font-size="17" font-weight="800" text-anchor="middle" fill="${K}" font-family="sans-serif">123</text>`),
  dday: sv(`<rect x="14" y="22" width="92" height="82" rx="8" fill="${W}" stroke="${K}" stroke-width="4"/><path d="M14 30a8 8 0 0 1 8-8h76a8 8 0 0 1 8 8v16H14z" fill="${GRN}" stroke="${K}" stroke-width="4"/><rect x="34" y="12" width="8" height="20" rx="4" fill="${K}"/><rect x="78" y="12" width="8" height="20" rx="4" fill="${K}"/><text x="60" y="90" font-size="30" font-weight="800" text-anchor="middle" fill="${K}" font-family="sans-serif">D-7</text>`),
  age: sv(`<rect x="22" y="44" width="76" height="60" rx="8" fill="${W}" stroke="${K}" stroke-width="4"/><path d="M22 66c10 8 19 8 25 0s16-8 25 0 17 8 26 0" fill="none" stroke="${RED}" stroke-width="5"/><path d="M40 44V30M60 44V26M80 44V30" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M40 22q4 5 0 8-4-3 0-8zM60 18q4 5 0 8-4-3 0-8zM80 22q4 5 0 8-4-3 0-8z" fill="${YEL}" stroke="${K}" stroke-width="2"/><text x="60" y="96" font-size="20" font-weight="800" text-anchor="middle" fill="${K}" font-family="sans-serif">만 30</text>`),
  pyeong: sv(`<path d="M18 52 60 18l42 34v52H18z" fill="${W}" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><rect x="34" y="60" width="52" height="32" fill="${YEL}" stroke="${K}" stroke-width="3"/><path d="M34 100h52M34 96v8M86 96v8" stroke="${RED}" stroke-width="4"/><text x="60" y="82" font-size="15" font-weight="800" text-anchor="middle" fill="${K}" font-family="sans-serif">㎡↔평</text>`),
  timer: sv(`<circle cx="60" cy="66" r="40" fill="${W}" stroke="${K}" stroke-width="4"/><path d="M60 66V36A30 30 0 0 1 86 51z" fill="${YEL}" stroke="${K}" stroke-width="3" stroke-linejoin="round"/><path d="M50 14h20M60 14v12M92 30l8-8" stroke="${K}" stroke-width="6" stroke-linecap="round"/><path d="M60 66 74 82" stroke="${RED}" stroke-width="6" stroke-linecap="round"/><circle cx="60" cy="66" r="5" fill="${K}"/>`),
  stopwatch: sv(`<circle cx="60" cy="68" r="38" fill="${W}" stroke="${K}" stroke-width="4"/><path d="M52 14h16M60 14v16" stroke="${K}" stroke-width="6" stroke-linecap="round"/><path d="M60 68V42" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M60 68 80 78" stroke="${GRN}" stroke-width="5" stroke-linecap="round"/><circle cx="60" cy="68" r="5" fill="${RED}"/><path d="M34 58h-8M34 78h-8M94 58h-6" stroke="${K}" stroke-width="3" stroke-linecap="round"/><text x="60" y="104" font-size="12" font-weight="800" text-anchor="middle" fill="${K}" font-family="sans-serif">LAP</text>`),
  family: sv(`<path d="M14 24h56a8 8 0 0 1 8 8v26a8 8 0 0 1-8 8H38l-14 12V66h-10a8 8 0 0 1-8-8V32a8 8 0 0 1 8-8z" fill="${YEL}" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><path d="M50 52h56a8 8 0 0 1 8 8v26a8 8 0 0 1-8 8h-10v12L82 94H50a8 8 0 0 1-8-8V60a8 8 0 0 1 8-8z" fill="${W}" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><text x="78" y="80" font-size="15" font-weight="800" text-anchor="middle" fill="${K}" font-family="sans-serif">7942</text><path d="M22 40h40M22 50h26" stroke="${K}" stroke-width="4" stroke-linecap="round"/>`),
  pdf2img: sv(`${doc(10, 14, 48, 64, RED)}<text x="34" y="54" font-size="15" font-weight="800" text-anchor="middle" fill="${W}" font-family="sans-serif">PDF</text><path d="M52 90h12" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M60 82l9 8-9 8" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="66" y="50" width="44" height="56" rx="6" fill="${W}" stroke="${K}" stroke-width="4"/><circle cx="80" cy="66" r="6" fill="${YEL}" stroke="${K}" stroke-width="3"/><path d="M70 100l12-14 8 6 8-10 8 18z" fill="${GRN}" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>`),
  removebg: sv(`<rect x="14" y="14" width="92" height="92" rx="8" fill="${W}"/><g fill="#d6d6d6">${[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].filter((c) => (r + c) % 2).map((c) => `<rect x="${14 + c * 23}" y="${14 + r * 23}" width="23" height="23"/>`)).join("")}</g><rect x="14" y="14" width="92" height="92" rx="8" fill="none" stroke="${K}" stroke-width="4"/><path d="M60 30c-13 0-22 10-22 24 0 9 4 15 9 19l-5 21h36l-5-21c5-4 9-10 9-19 0-14-9-24-22-24z" fill="${YEL}" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><path d="M60 22c-19 0-30 14-30 32 0 10 4 17 9 22l-6 24h54l-6-24c5-5 9-12 9-22 0-18-11-32-30-32z" fill="none" stroke="${RED}" stroke-width="4" stroke-dasharray="7 6" stroke-linejoin="round"/>`), // P2-26
  draw: sv(`<path d="M18 14v92M48 14v92" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M18 34h30M18 60h30M18 86h30" stroke="${RED}" stroke-width="5" stroke-linecap="round"/><circle cx="84" cy="72" r="28" fill="${W}"/><path d="M84 72V44a28 28 0 0 1 24.2 14z" fill="${YEL}"/><path d="M84 72l24.2 14A28 28 0 0 1 84 100z" fill="${GRN}"/><path d="M84 72 59.8 86A28 28 0 0 1 59.8 58z" fill="${RED}"/><circle cx="84" cy="72" r="28" fill="none" stroke="${K}" stroke-width="4"/><circle cx="84" cy="72" r="4" fill="${K}"/><path d="M78 32h12l-6 11z" fill="${K}"/>`), // P2-44
  imgmerge: sv(`<rect x="30" y="10" width="60" height="32" rx="5" fill="${YEL}" stroke="${K}" stroke-width="4"/><rect x="30" y="44" width="60" height="32" rx="5" fill="${GRN}" stroke="${K}" stroke-width="4"/><rect x="30" y="78" width="60" height="32" rx="5" fill="${W}" stroke="${K}" stroke-width="4"/><circle cx="46" cy="94" r="6" fill="${RED}"/><path d="M8 26v68M2 34l6-8 6 8M2 86l6 8 6-8" fill="none" stroke="${RED}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M98 60h18" stroke="${K}" stroke-width="4" stroke-linecap="round" stroke-dasharray="4 5"/>`), // P2-46
  heic: sv(`<rect x="10" y="12" width="56" height="74" rx="10" fill="${W}" stroke="${K}" stroke-width="4"/><circle cx="28" cy="34" r="6" fill="${YEL}" stroke="${K}" stroke-width="3"/><path d="M16 66l14-14 10 8 10-10 12 16z" fill="${GRN}" stroke="${K}" stroke-width="3" stroke-linejoin="round"/><text x="38" y="80" font-size="12" font-weight="800" text-anchor="middle" fill="${K}" font-family="sans-serif">HEIC</text><path d="M62 96h14" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M72 88l9 8-9 8" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="74" y="44" width="38" height="44" rx="6" fill="${RED}" stroke="${K}" stroke-width="4"/><text x="93" y="71" font-size="13" font-weight="800" text-anchor="middle" fill="${W}" font-family="sans-serif">JPG</text>`), // P2-47
  qr: sv(`<rect x="10" y="10" width="100" height="100" rx="10" fill="${W}" stroke="${K}" stroke-width="4"/>${[[20, 20], [74, 20], [20, 74]].map(([x, y]) => `<rect x="${x}" y="${y}" width="26" height="26" rx="3" fill="none" stroke="${K}" stroke-width="5"/><rect x="${x + 8}" y="${y + 8}" width="10" height="10" fill="${K}"/>`).join("")}<path d="M54 20h10v10H54zM54 40h10v10H54zM20 54h10v10H20zM40 54h10v10H40zM64 54h10v10H64zM84 54h16v10H84zM74 74h10v10H74zM90 74h10v10H90zM74 90h10v10H74zM54 84h10v16H54z" fill="${K}"/><rect x="48" y="48" width="24" height="24" rx="5" fill="${RED}" stroke="${K}" stroke-width="3"/><path d="M90 90h10v10H90z" fill="${GRN}"/>`), // P2-48
  salary: sv(`<rect x="12" y="30" width="96" height="60" rx="8" fill="${GRN}" stroke="${K}" stroke-width="4"/><circle cx="60" cy="60" r="17" fill="${W}" stroke="${K}" stroke-width="4"/><text x="60" y="67" font-size="20" font-weight="800" text-anchor="middle" fill="${K}" font-family="sans-serif">₩</text><path d="M24 44h10M86 76h10" stroke="${K}" stroke-width="4" stroke-linecap="round"/>`), // P2-45
  severance: sv(`<rect x="22" y="36" width="76" height="62" rx="8" fill="${YEL}" stroke="${K}" stroke-width="4"/><path d="M44 36v-8a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v8" fill="none" stroke="${K}" stroke-width="4"/><path d="M22 60h76" stroke="${K}" stroke-width="4"/><rect x="52" y="54" width="16" height="12" rx="3" fill="${W}" stroke="${K}" stroke-width="3"/>`), // P2-45
  unemp: sv(`<path d="M60 16a36 36 0 0 1 36 36H24a36 36 0 0 1 36-36z" fill="${RED}" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><path d="M60 52v40a8 8 0 0 1-16 0" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round"/><circle cx="88" cy="88" r="14" fill="${YEL}" stroke="${K}" stroke-width="4"/><text x="88" y="94" font-size="15" font-weight="800" text-anchor="middle" fill="${K}" font-family="sans-serif">₩</text>`), // P2-45
  juhyu: sv(`<rect x="14" y="22" width="92" height="76" rx="8" fill="${W}" stroke="${K}" stroke-width="4"/><path d="M14 40h92" stroke="${K}" stroke-width="4"/>${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${20 + i * 12}" y="50" width="9" height="9" rx="2" fill="${i === 6 ? RED : i < 5 ? GRN : "#d6d6d6"}"/>`).join("")}<text x="60" y="88" font-size="18" font-weight="800" text-anchor="middle" fill="${K}" font-family="sans-serif">+주휴</text>`), // P2-45
  stockquiz: sv(`<rect x="10" y="14" width="100" height="92" rx="10" fill="${W}" stroke="${K}" stroke-width="4"/><path d="M22 84 40 66l14 10 22-30 12 10" fill="none" stroke="${K}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="88" cy="56" r="7" fill="${YEL}" stroke="${K}" stroke-width="4"/><path d="M90 36c0-6 4-9 8-9s8 3 8 8c0 6-8 6-8 12" fill="none" stroke="${RED}" stroke-width="5" stroke-linecap="round"/>`), // P2-50
  dca: sv(`<path d="M10 104h100" stroke="${K}" stroke-width="4" stroke-linecap="round"/>${[[16, 1], [42, 2], [68, 3], [94, 4]].map(([x, h]) => Array.from({ length: h }, (_, k) => `<rect x="${x - 12}" y="${92 - k * 13}" width="24" height="11" rx="5" fill="${YEL}" stroke="${K}" stroke-width="3"/>`).join("")).join("")}<path d="M12 62 40 48l26 6 40-38" fill="none" stroke="#2346d8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M90 14h17v17" fill="none" stroke="#2346d8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`), // P2-52 적립식 백테스트(매달 쌓이는 동전 + 자산 곡선)
  avgdown: sv(`<path d="M60 10C60 10 26 48 26 72a34 34 0 0 0 68 0C94 48 60 10 60 10z" fill="#2346d8" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><path d="M40 62h40" stroke="${W}" stroke-width="5" stroke-dasharray="7 5" stroke-linecap="round"/><path d="M40 88h40" stroke="${YEL}" stroke-width="6" stroke-linecap="round"/><path d="M60 66v14m-7-7 7 7 7-7" fill="none" stroke="${W}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`), // P2-51 물타기(물방울 + 평단 내려감)
  compound: sv(`<path d="M12 104h96" stroke="${K}" stroke-width="4" stroke-linecap="round"/>${[[22, 14], [44, 24], [66, 40], [88, 64]].map(([x, h]) => `<rect x="${x - 9}" y="${100 - h}" width="18" height="${h}" rx="4" fill="${YEL}" stroke="${K}" stroke-width="3"/>`).join("")}<path d="M14 72C40 70 64 58 100 18" fill="none" stroke="#2346d8" stroke-width="6" stroke-linecap="round"/><path d="M84 16h17v17" fill="none" stroke="#2346d8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="30" cy="34" r="14" fill="${W}" stroke="${K}" stroke-width="4"/><text x="30" y="40" font-size="16" font-weight="900" text-anchor="middle" fill="${K}" font-family="sans-serif">%</text>`), // P2-55 복리·배당(점점 커지는 막대 + 위로 휘는 곡선 + %)
  possize: sv(`<rect x="10" y="10" width="100" height="100" rx="10" fill="${W}" stroke="${K}" stroke-width="4"/><rect x="22" y="22" width="62" height="34" fill="${GRN}" stroke="${K}" stroke-width="3"/><rect x="22" y="56" width="62" height="24" fill="${RED}" stroke="${K}" stroke-width="3"/><path d="M16 22h72M16 80h72" stroke="${K}" stroke-width="3" stroke-dasharray="6 5"/><path d="M14 56h80" stroke="${K}" stroke-width="6" stroke-linecap="round"/><circle cx="96" cy="56" r="8" fill="${YEL}" stroke="${K}" stroke-width="3"/><text x="53" y="99" font-size="15" font-weight="900" text-anchor="middle" fill="${K}" font-family="sans-serif">1:3</text>`), // P2-56 손절·익절(진입선 + 위 이익 구간·아래 손실 구간 + 손익비)
  rsibt: sv(`<rect x="8" y="10" width="104" height="100" rx="10" fill="${W}" stroke="${K}" stroke-width="4"/><path d="M8 78h104" stroke="${K}" stroke-width="3"/><rect x="12" y="84" width="96" height="16" fill="${YEL}" opacity=".55"/><path d="M14 86h92M14 100h92" stroke="${K}" stroke-width="2" stroke-dasharray="4 4"/><path d="M16 46 32 58 46 36 62 60 78 30 94 44 104 26" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M62 64l-8 11h16z" fill="${GRN}" stroke="${K}" stroke-width="3" stroke-linejoin="round"/><path d="M78 26l-8-11h16z" fill="${RED}" stroke="${K}" stroke-width="3" stroke-linejoin="round"/><path d="M16 96 34 88 50 102 66 86 84 98 104 90" fill="none" stroke="${K}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`), // P2-54 RSI 매매 백테스트(가격선 + 매수▲·매도▼ + RSI 30·70 띠)
  ostax: sv(`<path d="M24 10h72v92l-12-8-12 8-12-8-12 8-12-8-12 8z" fill="${W}" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><circle cx="60" cy="38" r="17" fill="${YEL}" stroke="${K}" stroke-width="4"/><text x="60" y="45.5" font-size="21" font-weight="800" text-anchor="middle" fill="${K}" font-family="sans-serif">$</text><text x="60" y="80" font-size="21" font-weight="900" text-anchor="middle" fill="${RED}" font-family="sans-serif">22%</text>`), // P2-53 해외주식 양도세(영수증 + 달러 + 22%)
};
function doc(x, y, w, h, fill) {
  const f = Math.min(14, w / 3);
  return `<path d="M${x} ${y + 4}a4 4 0 0 1 4-4h${w - f - 4}l${f} ${f}v${h - f - 4}a4 4 0 0 1-4 4H${x + 4}a4 4 0 0 1-4-4z" fill="${fill}" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><path d="M${x + w - f} ${y}v${f}h${f}" fill="none" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>`;
}
// 로고: 코드로 그린 단순한 펭귄(둥근 사각 몸통 + 흰 배 + 점 눈 + 노란 부리). 실존 캐릭터·로고를 본뜨지 않음
const LOGO = (size = 34) => `<svg class="logo-mark" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="28" fill="#141414"/><path d="M32 20.5c-4-7-19-7-20.5 6C10 40 18.5 53 32 53s22-13 20.5-26.5C51 13.5 36 13.5 32 20.5z" fill="#fff"/><ellipse cx="23.5" cy="33" rx="3.2" ry="4" fill="#141414"/><ellipse cx="40.5" cy="33" rx="3.2" ry="4" fill="#141414"/><circle cx="24.6" cy="31.6" r="1.1" fill="#fff"/><circle cx="41.6" cy="31.6" r="1.1" fill="#fff"/><path d="M28.6 39.5h6.8l-3.4 4.4z" fill="#ffc21a" stroke="#141414" stroke-width="1.6" stroke-linejoin="round"/><circle cx="18" cy="41" r="2.8" fill="#e5372b" opacity=".4"/><circle cx="46" cy="41" r="2.8" fill="#e5372b" opacity=".4"/></svg>`;
const toolById = Object.fromEntries(TOOLS.map((x) => [x.id, x]));
// P2-49 TOOLS는 toolPage(해설 원고 guides) 틀을 쓰는 항목 묶음. cat이 CATS(story·arcade)면 오락실 게임, "fun"이면 「운세·재미」 툴. id는 그대로(즐겨찾기·랭킹·GA)
const GAMES = TOOLS.filter((x) => CATS[x.cat]);
const FUN_RANK = ["today", "saju", "personality", "birthday", "namematch", "draw"]; // P2-49 「운세·재미」 서랍 순서
const FUN_PATH = { today: "/fun/today/", tti: (k) => `/fun/tti/${k}/`, zodiac: (k) => `/fun/zodiac/${k}/`, type: (k) => `/fun/personality/${k.toLowerCase()}/` }; // P2-49 하위 페이지 주소 한 곳
// P2-49 옛 주소 → 새 주소(리디렉트 도우미가 사용). 옛 오락실 카테고리 3곳 + 툴 6개 + 하위 해설(띠 12·별자리 12·16유형 16)
const FUN_MOVED = [
  ["/me/", "/fun/"], ["/love/", "/fun/"], ["/luck/", "/fun/"],
  ["/me/birthday/", "/fun/birthday/"], ["/me/personality/", "/fun/personality/"], ["/love/name-match/", "/fun/name-match/"],
  ["/luck/today/", "/fun/today/"], ["/luck/saju/", "/fun/saju/"], ["/arcade/ladder/", "/fun/ladder/"],
  ...["rat", "ox", "tiger", "rabbit", "dragon", "snake", "horse", "goat", "monkey", "rooster", "dog", "pig"].map((k) => [`/me/tti/${k}/`, `/fun/tti/${k}/`]),
  ...["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"].map((k) => [`/me/zodiac/${k}/`, `/fun/zodiac/${k}/`]),
  ...["ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP", "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ"].map((k) => [`/me/personality/${k.toLowerCase()}/`, `/fun/personality/${k.toLowerCase()}/`]),
];
const RECO = {
  birthday: ["today", "personality", "reaction"],
  personality: ["birthday", "namematch", "reaction"],
  namematch: ["birthday", "personality", "today"],
  today: ["life", "birthday", "personality"],
  reaction: ["stack", "life", "personality"],
  stack: ["reaction", "life", "today"],
  rpg: ["life", "stack", "reaction"],
  life: ["today", "reaction", "personality"],
  draw: ["reaction", "stack", "today"], // P2-44
};
const TTI_KEYS = ["rat", "ox", "tiger", "rabbit", "dragon", "snake", "horse", "goat", "monkey", "rooster", "dog", "pig"];
const TTI_EMOJI = Object.fromEntries(TTI_KEYS.map((k) => [k, tti[k].hanja])); // 이모지 대신 지지 한자
const ZODIAC_KEYS = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"];
const TYPE_KEYS = ["ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP", "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ"];
const REACTION_KEYS = ["fastSteady", "fastVaried", "slowSteady", "slowVaried"];
const REACTION_SLUG = { fastSteady: "fast-steady", fastVaried: "fast-varied", slowSteady: "slow-steady", slowVaried: "slow-varied" };
const LIFE_KEYS = ["adventure", "love", "stable", "fun", "drift"];
const LIFE_SLUG = { adventure: "adventurer", love: "warm-heart", stable: "steady-tree", fun: "mood-maker", drift: "drifter" };

// ---------- 펭귄 툴즈: 실용 툴 카테고리·목록 ----------
// 기존 콘텐츠(CATS: me·love·luck·story·arcade)는 주소를 그대로 두고 「펭귄 오락실」(/play/)로 묶습니다.
const PLAY = { name: "펭귄 오락실", tagline: "RPG·생존 게임·순발력 게임, 잠깐 쉬어 가는 한 판", path: "/play/", desc: "펭귄 RPG, 지옥에서 살아남기, 헬조선에서 살아남기, Life Game, 블록 쌓기, 반응속도 게임처럼 잠깐 쉬어 가는 게임을 모았어요." }; // P2-49 게임만
const UCATS = {
  pdf: { name: "PDF·문서", desc: "PDF를 합치고 나누고, 이미지와 워드 문서를 PDF로 바꾸는 툴이에요." },
  image: { name: "이미지", desc: "사진 용량을 줄이고, 아이폰 HEIC 사진을 JPG로 바꾸고, 여러 장을 한 장으로 이어 붙이거나 PDF로 묶고, QR코드를 만드는 이미지 툴이에요." }, // P2-46 desc, P2-47 HEIC, P2-48 QR
  text: { name: "글쓰기", desc: "자기소개서, 리포트, 블로그 글을 쓸 때 필요한 글쓰기 툴이에요." },
  calc: { name: "생활 계산", desc: "D-day, 연봉 실수령액, 퇴직금처럼 생활에서 자주 찾는 계산을 바로 해 주는 툴이에요." }, // P2-45 desc
  time: { name: "시간", desc: "타이머와 스톱워치처럼 시간을 재고 알려 주는 툴이에요." },
  fun: { name: "운세·재미", seo: "운세·재미 — 무료 사주·띠별 운세·성격 테스트·사다리타기", desc: "오늘의 띠별 운세, 무료 사주팔자, 16유형 성격 테스트, 생일로 보는 나, 이름 궁합, 사다리타기·돌림판처럼 재미로 보고 가볍게 정하는 툴이에요." }, // P2-49 옛 오락실 운세·테스트·사다리
  invest: { name: "투자", seo: "투자 툴 — 손절·익절·포지션 계산기, 복리 계산기·배당 계산기, RSI 백테스트, 해외주식 양도세 계산기, 적립식 백테스트, 물타기 계산기, SOXL·TQQQ·KORU 주가 예측", desc: "손절가·익절가와 감당할 손실로 몇 주를 사야 하는지와 손익비를 계산하는 손절·익절·포지션 계산기, 적립식 복리로 몇 년 뒤 얼마가 되는지, 월 배당 100만 원을 받으려면 얼마가 필요한지 계산하는 복리·배당 계산기, 미국주식 양도소득세 계산, SOXL·TQQQ·KORU를 매달 샀다면 지금 얼마인지 보는 적립식 백테스트, RSI 30에 사고 70에 팔았다면 얼마인지 보는 RSI 매매 백테스트, 물타기 평단가 계산처럼 주식 투자에서 자주 하는 계산과, 레버리지 ETF의 실제 과거 차트로 오를까 내릴까를 맞혀 보는 투자 툴이에요. 투자 권유가 아니에요." }, // P2-50 새 툴 카테고리(앞으로 주식투자 툴을 여기에 모음) // P2-51 seo·desc에 물타기 계산기 // P2-52 적립식 백테스트 // P2-53 해외주식 양도세 // P2-54 RSI 백테스트 // P2-55 복리·배당 계산기 // P2-56 손절·익절·포지션 계산기
};
const NAV = [...Object.entries(UCATS).map(([k, c]) => [c.name, `/${k}/`]), [PLAY.name, PLAY.path]];
// seo: <title> 앞부분(검색어 그대로) / also: 다른 카테고리 페이지에도 함께 노출 / beta: 베타 표시 / kw: 홈 검색용 동의어
const UTILS = [
  { id: "pdfmerge", cat: "pdf", path: "/pdf/merge/", title: "PDF 합치기", seo: "PDF 합치기 — 무료", h1: "PDF 합치기 — 여러 PDF를 순서대로 한 파일로", desc: "여러 개의 PDF를 원하는 순서대로 한 파일로 합쳐요. 파일은 서버로 전송하지 않고 브라우저 안에서 처리합니다.", hook: "PDF 여러 개를 순서 정해서 한 파일로.", meta: "PDF 30개까지", kw: "pdf 병합 합치기 묶기 merge 하나로" },
  { id: "pdfsplit", cat: "pdf", path: "/pdf/split/", title: "PDF 나누기", seo: "PDF 나누기 — 무료, 페이지 추출", h1: "PDF 나누기 — 페이지 추출, 한 쪽씩 나누기", desc: "PDF에서 원하는 페이지만 뽑거나 한 쪽씩 나눠 zip으로 받아요. 파일은 서버로 전송하지 않고 브라우저 안에서 처리합니다.", hook: "필요한 쪽만 뽑거나 한 쪽씩 쪼개기.", meta: "범위 추출 · zip", kw: "pdf 분할 자르기 추출 페이지 split 쪼개기" },
  { id: "img2pdf", cat: "pdf", also: ["image"], path: "/pdf/image-to-pdf/", title: "JPG PDF 변환", seo: "JPG PDF 변환 — 무료, 이미지 여러 장을 PDF로", h1: "JPG PDF 변환 — 이미지 여러 장을 PDF 한 파일로", desc: "JPG·PNG 이미지 여러 장을 순서대로 PDF 한 파일로 만들어요. A4 또는 원본 크기를 고를 수 있고, 파일은 서버로 전송하지 않습니다.", hook: "사진·스캔 이미지 여러 장을 PDF 하나로.", meta: "JPG·PNG · A4", kw: "이미지 pdf 사진 png jpeg 변환 스캔 영수증" },
  { id: "word2pdf", cat: "pdf", beta: true, path: "/pdf/word-to-pdf/", title: "워드 PDF 변환(간단)", seo: "워드 PDF 변환(간단) — 무료, docx를 PDF로", h1: "워드 PDF 변환(간단) — docx 미리보고 PDF로 저장", desc: "워드(docx) 문서를 브라우저에서 미리 보고 인쇄의 「PDF로 저장」으로 PDF를 만들어요. 표·머리글·각주·복잡한 서식은 깨질 수 있는 간단 변환(베타)입니다.", hook: "docx를 열어 보고 PDF로 저장. 글 위주 문서용.", meta: "docx · 베타", kw: "word docx 워드 문서 pdf 변환 docs" },
  { id: "imgcompress", cat: "image", path: "/image/compress/", title: "이미지 용량 줄이기", seo: "이미지 용량 줄이기 — 무료, 사진 압축", h1: "이미지 용량 줄이기 — 품질과 크기를 골라 사진 압축", desc: "JPG·PNG·WEBP 사진의 품질과 최대 너비를 조절해 용량을 줄이고, 얼마나 줄었는지 보여 드려요. 파일은 서버로 전송하지 않습니다.", hook: "품질·너비 조절해서 사진 용량 줄이기.", meta: "JPG·WEBP 저장", kw: "사진 압축 용량 줄이기 리사이즈 크기 jpg png webp 이미지 압축" },
  { id: "charcount", cat: "text", path: "/text/char-count/", title: "글자수 세기", seo: "글자수 세기 — 무료, 공백 포함·제외·바이트", h1: "글자수 세기 — 공백 포함·제외, 바이트까지", desc: "자기소개서와 리포트 글자수를 공백 포함·제외, 바이트(UTF-8·한글 2바이트), 줄·단락 수로 바로 세어 드려요. 입력한 글은 저장하지 않습니다.", hook: "자소서 글자수, 공백 포함·제외, 바이트까지.", meta: "실시간 계산", kw: "글자 수 글자수 자소서 자기소개서 바이트 공백 단어 세기 카운터" },
  { id: "dday", cat: "calc", also: ["time"], path: "/calc/d-day/", title: "디데이 계산기", seo: "디데이 계산기 (D-day 계산) — 무료", h1: "디데이 계산기 — D-day, 날짜 사이 일수, 기념일", desc: "목표일까지 남은 날(D-day)과 두 날짜 사이의 일수를 계산하고, 100일·1000일 같은 기념일 날짜를 한 번에 보여 드려요.", hook: "시험·전역·기념일까지 며칠? 100일·1000일도.", meta: "날짜 두 개", kw: "d-day 디데이 날짜 계산 기념일 100일 1000일 며칠 남았는지 일수" },
  { id: "age", cat: "calc", path: "/calc/age/", title: "만 나이 계산기", seo: "만 나이 계산기 — 무료, 연 나이·세는 나이까지", h1: "만 나이 계산기 — 만 나이, 연 나이, 다음 생일까지", desc: "생년월일을 넣으면 오늘 기준 만 나이와 연 나이, 한국식 세는 나이, 다음 생일까지 남은 날을 계산해 드려요. 2023년 만 나이 통일법 안내도 함께 정리했어요.", hook: "생년월일만 넣으면 만 나이·연 나이·세는 나이.", meta: "생년월일", kw: "만나이 만 나이 나이 계산 연나이 세는나이 한국나이 생일 몇살 통일법" },
  { id: "pyeong", cat: "calc", path: "/calc/pyeong/", title: "평수 계산기", seo: "평수 계산기 — 무료, ㎡ 평 변환", h1: "평수 계산기 — 제곱미터(㎡) ↔ 평 변환", desc: "제곱미터(㎡)와 평을 양방향으로 바꾸고, 59㎡·84㎡처럼 자주 찾는 면적을 표로 보여 드려요. 전용면적과 공급면적의 차이도 정리했어요.", hook: "㎡를 평으로, 평을 ㎡로. 84㎡는 몇 평?", meta: "1평 = 3.3058㎡", kw: "평수 평 제곱미터 m2 ㎡ 면적 변환 아파트 전용면적 공급면적 평형" },
  { id: "pdf2img", cat: "pdf", also: ["image"], path: "/pdf/pdf-to-jpg/", title: "PDF JPG 변환", seo: "PDF JPG 변환 — 무료, PDF를 이미지로", h1: "PDF JPG 변환 — PDF 페이지를 JPG·PNG 이미지로", desc: "PDF의 각 페이지를 JPG나 PNG 이미지로 바꾸고, 해상도를 고르고, zip으로 한 번에 받을 수 있어요. 파일은 서버로 전송하지 않습니다.", hook: "PDF 한 쪽씩 JPG·PNG 이미지로.", meta: "JPG·PNG · zip", kw: "pdf jpg 변환 pdf 이미지 png 그림 사진 페이지 캡처 pdf를 jpg로" },
  { id: "timer", cat: "time", path: "/time/timer/", title: "타이머", seo: "온라인 타이머 — 무료, 알람 소리·전체 화면", h1: "온라인 타이머 — 시간이 되면 소리로 알려 줘요", desc: "시·분·초를 직접 넣거나 1·3·5·10·15·30·60분 버튼으로 맞춰 시작하는 온라인 타이머예요. 끝나면 알림음과 화면 깜빡임으로 알려 주고, 탭 제목에 남은 시간을 보여 줘요.", hook: "라면 3분, 공부 30분. 끝나면 소리로 알려 줘요.", meta: "알림음 · 전체 화면", kw: "타이머 알람 카운트다운 초시계 뽀모도로 라면 3분 15분 30분 1시간 공부 시간 재기 인터벌" },
  { id: "stopwatch", cat: "time", path: "/time/stopwatch/", title: "스톱워치", seo: "온라인 스톱워치 — 무료, 랩 기록·1/100초", h1: "온라인 스톱워치 — 랩 기록과 1/100초 표시", desc: "시작·정지·랩·초기화를 지원하는 온라인 스톱워치예요. 1/100초까지 보여 주고, 랩마다 구간·누적 시간과 최고·최저 구간을 표시해요. Space·L·R 단축키도 쓸 수 있어요.", hook: "1/100초까지. 랩마다 구간·누적 기록.", meta: "랩 · 단축키", kw: "스톱워치 초시계 랩 타임 기록 시간 측정 달리기 1/100초" },
  { id: "salary", cat: "calc", path: "/calc/salary/", title: "연봉 실수령액 계산기", seo: `연봉 실수령액 계산기 ${PAY.year} — 4대보험·소득세 공제 후 월급`, h1: `연봉 실수령액 계산기 ${PAY.year} — 세금 떼고 월급 얼마?`, desc: `연봉이나 월급을 넣으면 ${PAY.year}년 국민연금·건강보험·장기요양·고용보험 요율과 국세청 근로소득 간이세액표로 공제액과 월 실수령액을 계산해요. 부양가족·자녀 수와 비과세 식대도 반영해요.`, hook: "연봉 넣으면 4대보험·소득세 떼고 월급이 얼마인지.", meta: `${PAY.year} 요율 · 간이세액표`, kw: "연봉 실수령액 월급 실수령액 연봉 계산기 세후 월급 4대보험 계산 소득세 원천징수 간이세액표 연봉표 월급 계산 세금" }, // P2-45
  { id: "juhyu", cat: "calc", path: "/calc/weekly-holiday-pay/", title: "주휴수당 계산기", seo: `주휴수당 계산기 ${PAY.year} — 알바 월급, 최저시급 ${PAY.minWage[PAY.year].toLocaleString("ko-KR")}원`, h1: `주휴수당 계산기 ${PAY.year} — 알바 주급·월급까지`, desc: `시급과 일주일 근무시간을 넣으면 주휴수당과 주급, 4.345주로 환산한 알바 월급을 계산해요. 주 15시간 미만 여부와 ${PAY.year}년 최저임금(시급 ${PAY.minWage[PAY.year].toLocaleString("ko-KR")}원)보다 낮은지도 알려 줘요.`, hook: "시급·주 근무시간으로 주휴수당과 알바 월급.", meta: `최저시급 ${PAY.minWage[PAY.year].toLocaleString("ko-KR")}원`, kw: "주휴수당 주휴수당 계산 알바 월급 알바비 계산 시급 계산 최저시급 최저임금 주급 월급 환산 시급 환산 아르바이트 단시간" }, // P2-45
  { id: "severance", cat: "calc", path: "/calc/severance/", title: "퇴직금 계산기", seo: "퇴직금 계산기 — 평균임금으로 예상 퇴직금(세전)", h1: "퇴직금 계산기 — 입사일·퇴사일·월급으로 예상 퇴직금", desc: "입사일, 마지막 근무일, 퇴직 전 3개월 임금과 상여금·연차수당을 넣으면 1일 평균임금과 법정 퇴직금(세전)을 계산해요. 재직 1년 미만이면 대상이 아니라고 알려 줘요.", hook: "입사일·퇴사일·월급으로 예상 퇴직금(세전).", meta: "평균임금 × 30일", kw: "퇴직금 퇴직금 계산 퇴직금 계산기 평균임금 퇴직금 계산법 퇴사 퇴직 1년 상여금 연차수당 퇴직급여" }, // P2-45
  { id: "unemp", cat: "calc", path: "/calc/unemployment/", title: "실업급여 계산기", seo: `실업급여 계산기 ${PAY.year} — 구직급여 하루 금액·받는 기간`, h1: `실업급여 계산기 ${PAY.year} — 하루 얼마, 며칠 받을까`, desc: `퇴직 전 평균임금, 나이, 고용보험 가입기간을 넣으면 ${PAY.year}년 상한(하루 ${PAY.unemp.dayCap[PAY.year].toLocaleString("ko-KR")}원)·하한을 적용한 구직급여 하루 금액과 소정급여일수, 총 예상 수급액을 계산해요.`, hook: "하루 얼마, 며칠 동안? 구직급여 예상액.", meta: `상한 ${PAY.unemp.dayCap[PAY.year].toLocaleString("ko-KR")}원/일`, kw: "실업급여 실업급여 계산 실업급여 계산기 구직급여 실업급여 금액 실업급여 기간 실업급여 조건 소정급여일수 권고사직 계약만료 고용보험" }, // P2-45
  { id: "removebg", cat: "image", path: "/image/remove-bg/", title: "배경 지우기", seo: "배경 지우기 — 무료 누끼 따기", h1: "배경 지우기 — 무료 누끼 따기, 투명 PNG로 저장", desc: "사진을 넣으면 사람·물건·동물만 남기고 배경을 지워 투명 PNG나 흰 배경 사진으로 저장해요. 누른 대상만 남기고, 브러시로 다듬을 수 있어요. 사진은 서버로 전송하지 않습니다.", hook: "누끼 따기, 사진 배경을 투명하게.", meta: "투명 PNG · 흰 배경", kw: "배경 지우기 배경 제거 누끼 누끼따기 투명 png 배경 투명 remove bg 배경 삭제 흰 배경 상품 사진" }, // P2-26
  { id: "imgmerge", cat: "image", path: "/image/merge/", title: "사진 이어붙이기", seo: "사진 이어붙이기 — 사진 합치기·캡처 합치기·긴 캡처 만들기", h1: "사진 이어붙이기 — 여러 장을 세로·가로·격자로 한 장에", desc: "사진과 휴대폰 캡처 여러 장을 세로·가로·격자로 한 장에 이어 붙여요. 캡처의 상태바·주소창·하단 바를 자동으로 잘라 내고, 연속 캡처는 겹친 부분을 빼서 긴 캡처로 만들어요. 사진은 서버로 전송하지 않습니다.", hook: "캡처 여러 장을 한 장으로, 툴바는 자동으로 잘라요.", meta: "세로·가로·격자 · JPG·PNG", kw: "사진 합치기 사진 이어붙이기 사진 붙이기 이미지 합치기 이미지 붙이기 이미지 이어붙이기 캡처 합치기 캡처 이어붙이기 스크린샷 합치기 긴 캡처 스크롤 캡처 긴 스크린샷 사진 연결 콜라주 격자 사진 세로로 붙이기 가로로 붙이기" }, // P2-46
  { id: "heic", cat: "image", path: "/image/heic-to-jpg/", title: "HEIC JPG 변환", seo: "HEIC JPG 변환 — 아이폰 사진 JPG로, 여러 장 한꺼번에", h1: "HEIC JPG 변환 — 아이폰 사진을 여러 장 한꺼번에 JPG로", desc: "아이폰 HEIC·HEIF 사진을 여러 장 한꺼번에 JPG로 바꿔요. 화질과 크기를 고르고, 하나씩 또는 zip으로 받아요. 위치 정보(GPS)는 기본으로 지워요. 사진은 서버로 전송하지 않습니다.", hook: "아이폰 사진(HEIC)을 JPG로, 여러 장 한꺼번에.", meta: "HEIC·HEIF → JPG · zip", kw: "heic jpg 변환 heic jpg heic 변환 heic to jpg heic 파일 열기 heic 열기 heif 변환 heif jpg 아이폰 사진 jpg 아이폰 사진 변환 아이폰 사진 안 열림 아이폰 사진 윈도우 아이폰 사진 컴퓨터 heic 뷰어 사진 확장자 변환 jpg 변환 위치 정보 지우기 gps 삭제" }, // P2-47
  { id: "qr", cat: "image", path: "/image/qr-code/", title: "QR코드 생성기", seo: "QR코드 생성기 — 무료 QR코드 만들기, 와이파이·링크·명함 QR", h1: "QR코드 생성기 — 링크·와이파이·명함 QR코드 무료로 만들기", desc: "링크, 글, 와이파이, 연락처(명함), 문자를 QR코드로 만들어요. 색과 여백을 바꾸고 가운데에 로고를 넣고, PNG·SVG로 저장해요. 와이파이 안내 카드는 A6로 바로 인쇄해요. 입력한 내용은 서버로 보내지 않습니다.", hook: "링크·와이파이·명함을 QR코드로, 로고도 넣어요.", meta: "PNG·SVG · 와이파이 카드", kw: "qr코드 만들기 qr코드 생성기 qr 코드 만들기 qr 생성 qr 생성기 qr코드 생성 qr 만들기 큐알코드 만들기 큐알 코드 큐알 만들기 무료 qr 무료 qr코드 와이파이 qr 와이파이 qr코드 wifi qr 와이파이 비밀번호 qr 링크 qr url qr 주소 qr 명함 qr 연락처 qr vcard 문자 qr 로고 qr qr코드 로고 qr 색 qr svg qr png qr 인쇄 qr code generator" }, // P2-48
  { id: "stockquiz", cat: "invest", path: "/invest/soxl-tqqq-koru/", title: "SOXL·TQQQ·KORU 주가 예측", seo: "SOXL·TQQQ·KORU 주가 예측 — 날짜 가린 실제 차트, 오를까 내릴까", h1: "SOXL·TQQQ·KORU 주가 예측 — 날짜를 가린 실제 차트로 오를까 내릴까", desc: "SOXL·TQQQ·KORU의 상장 이후 실제 일봉 종가에서 날짜를 가린 1개월·3개월·1년 차트를 보여 드려요. 다음 거래일·일주일 뒤·한 달 뒤 종가가 오를지, 기준가 이상일지 맞히면 실제 결과와 날짜를 공개하고, 10문제 뒤 백테스팅 요약을 보여 줘요. 교육·재미용이며 투자 권유가 아니에요.", hook: "날짜를 가린 실제 차트. 내일 종가는 오를까 내릴까?", meta: "10문제 · 3분", kw: "soxl tqqq koru 주가 예측 주식 차트 맞히기 레버리지 etf 3배 반도체 나스닥 한국 백테스팅 투자 연습 오를까 내릴까 미국 주식" }, // P2-50
  { id: "dca", cat: "invest", path: "/invest/dca-backtest/", title: "SOXL·TQQQ·KORU 적립식 백테스트", seo: "SOXL·TQQQ·KORU 적립식 백테스트 — 매달 사면 지금 얼마? 적립식 투자 계산", h1: "SOXL·TQQQ·KORU 적립식 백테스트 — 매달 샀다면 지금 얼마일까", desc: "SOXL·TQQQ·KORU를 시작 연월부터 매달 첫 거래일 종가에 같은 금액씩 샀다면 지금 평가액, 총 투자금, 수익률, 연환산 수익률, 최대 낙폭(MDD)이 얼마인지 실제 과거 가격으로 계산해요. 같은 돈을 처음에 한 번에 넣은 거치식과 비교하고 연도별 표와 자산 곡선을 보여 줘요. 원·달러, 3종목 비교. 투자 권유가 아니에요.", hook: "매달 30만 원씩 TQQQ를 샀다면 지금 얼마?", meta: "실제 가격 · 3종목 비교", kw: "적립식 백테스트 적립식 투자 계산 적립식 계산기 적립식 투자 수익률 tqqq 적립식 soxl 적립식 koru 적립식 레버리지 etf 적립 매달 사면 매달 투자 매월 적립 dca 정액 적립 분할 매수 백테스트 백테스팅 거치식 비교 mdd 최대 낙폭 연환산 수익률 미국 주식 3배 나스닥 반도체 한국" }, // P2-52
  { id: "avgdown", cat: "invest", path: "/invest/average-down/", title: "물타기 계산기", seo: "물타기 계산기 — 평단가 계산, 평균단가·추가매수 수량 역계산", h1: "물타기 계산기 — 주식 평단가 계산과 목표 평단 역계산", desc: "지금 평단과 보유 수량에 추가 매수 가격·수량을 여러 줄 넣으면 새 평단(평균단가), 총 수량, 총 투자금과 현재가 기준 수익률을 계산해요. 「평단을 얼마로 낮추려면 몇 주를 사야 하나」 역계산도 돼요. 원화·달러, 소수점 수량을 지원해요. 투자 권유가 아니에요.", hook: "추가 매수하면 평단이 얼마? 목표 평단까지 몇 주?", meta: "원화·달러 · 역계산", kw: "물타기 계산기 물타기 평단가 계산기 평단가 계산 평균단가 계산 평균 단가 평단 낮추기 평단 계산 추가매수 계산 추가 매수 주식 평단 주식 평균단가 불타기 분할매수 소수점 주식 미국 주식 국내 주식 목표 평단 역계산" }, // P2-51
  { id: "ostax", cat: "invest", path: "/invest/overseas-stock-tax/", title: "해외주식 양도소득세 계산기", seo: `해외주식 양도소득세 계산기 ${OST.defaultYear} — 미국주식 양도세, 250만원 공제·22% 계산`, h1: "해외주식 양도소득세 계산기 — 미국주식 양도세, 250만 원 공제 뒤 22%", desc: "해외주식을 판 종목별 매수·매도 금액(원, 또는 달러와 매수·매도 결제일 환율)을 넣으면 손익을 통산하고 기본공제 250만 원을 뺀 뒤 양도소득세 20%와 지방소득세 2%를 계산해요. 과세 연도별 신고·납부 기한(다음 해 5월)도 알려 줘요. 참고용 추정치이고 투자 권유가 아니에요.", hook: "미국주식 팔았는데 세금 얼마? 250만 원 공제 뒤 22%", meta: "손익 통산 · 환율 반영", kw: "해외주식 양도세 해외주식 양도소득세 미국주식 세금 미국주식 양도세 미국 주식 양도세 계산기 양도소득세 계산 양도세 계산기 250만원 공제 기본공제 해외주식 세금 신고 해외주식 세금 계산 해외 주식 세금 22% 손익통산 손익 통산 환차익 환율 결제일 기준환율 5월 신고 홈택스 양도세 신고 절세 서학개미 나스닥 미장 해외 etf 세금 soxl tqqq 세금" }, // P2-53
  { id: "compound", cat: "invest", path: "/invest/compound-dividend/", title: "복리 계산기 · 배당 계산기", seo: "복리 계산기 · 배당 계산기 — 적립식 월복리·연복리, 월배당 100만원 필요 투자금, 배당세 15.4%", h1: "복리 계산기 · 배당 계산기 — 적립식 복리와 월 배당 역계산", desc: "초기 원금, 매달 적립금, 연 수익률, 기간을 넣으면 월복리·연복리로 몇 년 뒤 자산이 얼마인지, 넣은 돈과 수익, 연도별 표와 원금 대비 자산 그래프를 보여 줘요. 72의 법칙과 물가 반영 실질 가치도 계산해요. 배당 탭에서는 투자금과 배당률로 연·월 배당(세전·세후 15.4%)을, 「월 배당 100만 원 받으려면 얼마?」 필요 투자금을 역계산하고 배당 재투자 뒤 월 배당까지 계산해요. 투자 권유가 아니에요.", hook: "매달 50만 원씩 20년 모으면? 월 배당 100만 원엔 얼마?", meta: "월복리·연복리 · 배당세 15.4%", kw: "복리 계산기 복리계산기 적립식 복리 적립식 복리 계산기 월복리 연복리 월복리 계산기 연복리 계산 복리 이자 계산 복리 수익률 복리의 마법 72의 법칙 미래 가치 fv 엑셀 fv 함수 적금 복리 투자 복리 매달 적립 매월 적립 원금 수익 물가 상승률 실질 가치 배당 계산기 배당금 계산기 배당금 계산 월배당 계산 월배당 계산기 배당 수익률 배당률 시가배당률 배당으로 월 100만원 월 100만원 배당 배당 생활 배당 투자 필요 투자금 배당세 배당소득세 15.4% 배당 세금 세후 배당 미국 배당 15% 배당 재투자 고배당 etf schd 금융소득 종합과세 2천만원" }, // P2-55
  { id: "rsibt", cat: "invest", path: "/invest/rsi-backtest/", title: "RSI 매매 백테스트", seo: "RSI 매매 백테스트 — SOXL·TQQQ·KORU RSI 30 매수·70 매도 수익률", h1: "RSI 매매 백테스트 (SOXL·TQQQ·KORU) — RSI 30에 사고 70에 팔았다면", desc: "SOXL·TQQQ·KORU를 RSI가 30 이하일 때 사고 70 이상일 때 팔았다면 수익률이 얼마인지 실제 과거 가격으로 계산해요. 일봉·주봉, 기간, RSI 기간(기본 14), 매수·매도 기준, 손절 %, 수수료를 고르면 매매 횟수, 승률, 누적 수익률, 그냥 보유했을 때 수익률, 최대 낙폭(MDD), 평균 보유 기간과 자산 곡선, 매수·매도 표시 차트, 거래 목록을 보여 줘요. 투자 권유가 아니에요.", hook: "RSI 30에 사고 70에 팔았다면 TQQQ는?", meta: "실제 가격 · 일봉·주봉", kw: "rsi 백테스트 rsi 매매 rsi 30 매수 rsi 70 매도 rsi 전략 rsi 매매법 과매도 매수 과매수 매도 과매도 과매수 tqqq rsi soxl rsi koru rsi 보조지표 백테스트 기술적 지표 백테스팅 와일더 rsi 14 상대강도지수 손절 승률 mdd 최대 낙폭 레버리지 etf 미국 주식 3배 매매 전략 수익률" }, // P2-54
  { id: "possize", cat: "invest", path: "/invest/stop-loss-position-size/", title: "손절·익절·포지션 계산기", seo: "손절·익절·포지션 계산기 — 손절가 계산, 몇 주 사야 하나, 손익비(R:R)·포지션 사이즈", h1: "손절·익절·포지션 계산기 — 손절가와 감당할 손실로 몇 주 살지, 손익비까지", desc: "진입가, 손절가(또는 손절 %), 익절가(또는 목표 %·R 배수), 계좌 금액과 감당할 손실(계좌의 % 또는 금액)을 넣으면 몇 주를 사야 하는지(포지션 사이즈), 포지션 금액과 계좌 대비 비중, 손절 시 손실, 익절 시 이익, 손익비(R:R), 본전 승률을 계산하고 가격 사다리 그림으로 보여 줘요. 롱·숏, 원·달러(환율), 소수 주식, 수수료를 지원해요. 투자 권유가 아니에요.", hook: "계좌 1%만 잃으려면 몇 주? 손익비는?", meta: "롱·숏 · R:R · 본전 승률", kw: "손절 계산기 손절가 계산기 손절가 계산 손절 몇 퍼센트 손절 기준 손절 라인 익절 계산 익절 계산기 익절가 목표가 계산 포지션 사이즈 계산기 포지션 사이즈 포지션 계산기 포지션 크기 몇 주 사야 몇 주 살까 매수 수량 계산 리스크 관리 위험 관리 자금 관리 1% 규칙 2% 규칙 손익비 손익비 계산 손익비 계산기 r:r rr 리스크 리워드 risk reward 본전 승률 손익분기 승률 기대값 롱 숏 공매도 레버리지 마진 소수 주식 미국 주식 수수료 트레이딩 단타 스윙" }, // P2-56
];
const UTIL_RANK = ["pdfmerge", "img2pdf", "pdf2img", "charcount", "imgcompress", "removebg", "imgmerge", "heic", "qr", "timer", "pdfsplit", "salary", "juhyu", "severance", "unemp", "age", "pyeong", "stopwatch", "word2pdf", "dday", "stockquiz", "avgdown", "dca", "ostax", "rsibt", "compound", "possize"]; // P2-56 possize // P2-55 compound // P2-50 stockquiz(투자) // P2-51 avgdown // P2-52 dca // P2-53 ostax // P2-54 rsibt // P2-45 돈 계산기 4종, P2-46 imgmerge, P2-47 heic, P2-48 qr
const NEXT = {
  pdfmerge: ["pdfsplit", "img2pdf", "imgcompress"],
  pdfsplit: ["pdfmerge", "pdf2img", "img2pdf"],
  img2pdf: ["pdfmerge", "imgcompress", "pdfsplit"],
  word2pdf: ["pdfmerge", "charcount", "pdfsplit"],
  imgcompress: ["img2pdf", "pdfmerge", "charcount"],
  charcount: ["word2pdf", "dday", "pdfmerge"],
  dday: ["age", "timer", "charcount"],
  timer: ["stopwatch", "dday", "charcount"],
  stopwatch: ["timer", "dday", "reaction"],
  age: ["dday", "pyeong", "today"],
  pyeong: ["age", "dday", "charcount"],
  pdf2img: ["imgcompress", "img2pdf", "pdfsplit"],
  removebg: ["imgcompress", "img2pdf", "pdf2img"], // P2-26
  imgmerge: ["imgcompress", "img2pdf", "removebg"], // P2-46
  heic: ["imgcompress", "imgmerge", "img2pdf"], // P2-47
  qr: ["removebg", "imgcompress", "img2pdf"], // P2-48 로고 배경 지우기 → QR
  salary: ["juhyu", "severance", "unemp"], // P2-45
  juhyu: ["salary", "unemp", "severance"], // P2-45
  severance: ["unemp", "salary", "juhyu"], // P2-45
  unemp: ["severance", "salary", "juhyu"], // P2-45
  stockquiz: ["rsibt", "dca", "possize"], // P2-50 // P2-56 투자 툴끼리 잇기: 같은 데이터 RSI 백테스트·적립식 → 매매 수량
  avgdown: ["possize", "dca", "ostax"], // P2-51 // P2-56 물타기 대신 손절 기준 → 분할 매수(적립식) → 팔 때 세금
  dca: ["compound", "rsibt", "avgdown"], // P2-52 // P2-56 가정 수익률 복리와 비교 → 같은 데이터 RSI 전략 → 평단
  ostax: ["avgdown", "compound", "possize"], // P2-53 // P2-56 평단(취득가) → 배당세 → 익절 이익
  rsibt: ["possize", "stockquiz", "dca"], // P2-54 // P2-56 RSI 손절 → 수량 계산, 같은 데이터 주가 예측·적립식
  compound: ["dca", "ostax", "avgdown"], // P2-55 복리로 본 적립 → 실제 가격 적립식 백테스트 → 세금
  possize: ["avgdown", "rsibt", "stockquiz"], // P2-56 손절 대신 물타기? 평단 비교 → 손절 넣은 RSI 백테스트 → 차트 연습
};
const utilById = Object.fromEntries(UTILS.map((x) => [x.id, x]));
const anyById = { ...toolById, ...utilById };
const TOOL_RANK = [...UTIL_RANK, ...FUN_RANK]; // P2-49 툴 전체(실용 + 운세·재미) 노출 순서
const catName = (k) => (UCATS[k] || CATS[k]).name;

// ---------- 공통 조각 ----------
// P2-49 운세·재미 툴 / 오락실 게임으로 문구 분리
const DISCLAIMER = "툴로 만든 결과물은 원본과 함께 확인한 뒤 사용해 주세요. 운세·재미 툴의 테스트와 운세, 펭귄 오락실의 게임 결과는 재미로 보는 콘텐츠이며, 의학·심리·재정·법률적 판단의 근거가 될 수 없어요. 투자 툴은 과거 가격으로 하는 교육·재미용이며 투자 권유가 아니에요."; // P2-50 투자 툴 문구
const SAFE = "파일은 서버로 전송하지 않습니다. 지금 쓰는 브라우저 안에서 처리해요.";
// 툴 페이지 CSP: 스크립트는 자체 파일 + 애드센스·GA 도메인만. 파일 데이터를 보낼 수 있는 connect-src도 자체·Google 광고/통계로 한정
const GDOM = "https://*.google.com https://*.google.co.kr https://*.googlesyndication.com https://*.doubleclick.net https://*.googleadservices.com https://*.adtrafficquality.google https://*.gstatic.com https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${GDOM}`, // 'unsafe-inline': 애드센스 push·GA 초기화 인라인 코드용
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
  "font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${GDOM}`,
  `frame-src ${GDOM}`,
  "worker-src 'self' blob:",
  "media-src 'self' blob: data:", // P2-23 타이머 알림음(직접 만든 WAV)·PiP 영상
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
const adSlot = (name) =>
  cfg.adsenseClient && cfg.adsenseSlot
    ? `<div class="ad" aria-label="광고"><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(cfg.adsenseClient)}" data-ad-format="auto" data-full-width-responsive="true" data-ad-slot="${esc(cfg.adsenseSlot)}" data-slot-name="${name}"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`
    : "";
// 툴 페이지용: 광고 높이를 미리 확보(CLS 방지). 광고 코드가 없으면 출력하지 않음
const adSlotFixed = (name) =>
  cfg.adsenseClient && cfg.adsenseSlot
    ? `<div class="ad ad-fixed" aria-label="광고"><ins class="adsbygoogle" style="display:block;min-height:250px" data-ad-client="${esc(cfg.adsenseClient)}" data-ad-format="auto" data-full-width-responsive="true" data-ad-slot="${esc(cfg.adsenseSlot)}" data-slot-name="${name}"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`
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

// 기존 콘텐츠(오락실) 경로면 「홈 › 펭귄 오락실 › …」로 위치를 보여 줌
const withPlay = (items) => (items.length > 1 && Object.keys(CATS).some((k) => items[1][1] === `/${k}/`) ? [items[0], [PLAY.name, PLAY.path], ...items.slice(1)] : items);
const crumbs = (items0) => { const items = withPlay(items0); return {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it[0], item: abs(it[1]) })),
}; };
const crumbHtml = (items0, items = withPlay(items0)) =>
  `<nav class="crumbs" aria-label="현재 위치">${items.map((it, i) => (i < items.length - 1 ? `<a href="${u(it[1])}">${esc(it[0])}</a>` : `<span>${esc(it[0])}</span>`)).join(" › ")}</nav>`;

const toolCard = (tool, rank) =>
  `<a class="card c-${tool.cat}" href="${u(tool.path)}">${rank ? `<span class="rank">${rank}</span>` : ""}<span class="card-art">${ART[tool.id]}</span><span class="card-body"><span class="card-cat">${esc(catName(tool.cat))}${tool.beta ? ' <em class="beta">베타</em>' : ""}</span><strong>${esc(tool.title)}</strong><small>${esc(tool.hook)}</small><span class="card-meta">${esc(tool.meta)}</span></span></a>`;

const recoHtml = (ids, heading = "이것도 해 보세요") =>
  `<section class="reco"><h2>${heading}</h2><div class="cards">${ids.map((id) => toolCard(anyById[id])).join("")}</div></section>`;

// ---------- 서랍 시스템 (P2-14): 홈·카테고리·오락실이 같은 부품을 씀 ----------
// 서랍(drawer) = 흰 바탕 상자 + 카테고리 색 손잡이·머리글. 안에는 툴 행(row: 아이콘 + 이름 + 한 줄 설명)
// 행 목록이라 툴이 몇 개든 빈칸이 생기지 않고, 서랍들은 CSS 다단(column)으로 높이를 맞춰 흘려 넣음
// P2-25 즐겨찾기 별 버튼(SVG). 상태(aria-pressed)는 favs.js가 이 기기의 저장값으로 맞춤
const STAR_SVG = '<svg class="fav-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.2l-5.8 3.2 1.2-6.5L2.6 9.4l6.5-.8z"/></svg>';
const favBtn = (x, cls = "") => `<button type="button" class="fav${cls ? " " + cls : ""}" data-fav="${esc(x.id)}" aria-pressed="false" aria-label="${esc(x.title)} 즐겨찾기에 추가">${STAR_SVG}</button>`;
// P2-49 새 툴(NEW_ITEMS 30일 이내)은 행 제목 옆에 NEW
const rowHtml = (x) =>
  `<li class="has-fav">${favBtn(x, "fav-row")}<a class="row" href="${u(x.path)}"><span class="row-art">${ART[x.id]}</span><span class="row-body"><b>${esc(x.title)}${x.beta ? ' <em class="beta">베타</em>' : ""}${isNew(x.id) ? ' <span class="new-tag">NEW</span>' : ""}</b><small>${esc(x.hook)}</small></span><span class="row-go" aria-hidden="true">›</span></a></li>`;
const drawerHtml = ({ tone, name, href = "", sub = "", tools, ext = [], extra = "", tag = "h2" }) =>
  `<section class="drawer t-${tone}"><header class="drawer-head"><span class="drawer-pull" aria-hidden="true"></span><${tag} class="drawer-name">${href ? `<a href="${u(href)}">${esc(name)}</a>` : esc(name)}</${tag}><small>${tools.length + ext.length}개</small>${sub ? `<p>${esc(sub)}</p>` : ""}</header><ul class="rows">${tools.map(rowHtml).join("")}${ext.map(extRowHtml).join("")}</ul>${extra}</section>`;
const utilsIn = (k) => TOOL_RANK.map((id) => anyById[id]).filter((x) => x.cat === k || (x.also || []).includes(k)); // P2-49 운세·재미 포함
// 세화산업의 다른 서비스(외부 사이트, 새 창). iframe·코드 가져오기 없이 링크만 검
const FAMILY = { name: "랜덤7942", url: "https://www.random7942.com/", hook: "가입 없이 낯선 사람과 아이디어 나누기 · 익명 브레인스토밍" };
const extRowHtml = (f) =>
  `<li><a class="row ext" href="${f.url}" target="_blank" rel="noopener"><span class="row-art">${ART.family}</span><span class="row-body"><b>${esc(f.name)} <em class="ext-tag">새 창 ↗</em></b><small>${esc(f.hook)}</small></span><span class="row-go" aria-hidden="true">↗</span></a></li>`;
const recoRows = (ids, heading) => `<section class="reco"><h2>${heading}</h2><ul class="rows rows-flow">${ids.map((id) => rowHtml(anyById[id])).join("")}</ul></section>`;

const shareBar = (opts = {}) =>
  `<div class="share" data-share-title="${esc(opts.title || "")}" data-share-text="${esc(opts.text || "")}" data-share-path="${esc(opts.path || "")}">
  <button type="button" class="btn" data-act="share">공유하기</button>
  <button type="button" class="btn ghost" data-act="copy">링크 복사</button>
  <button type="button" class="btn ghost" data-act="image">결과 이미지 저장</button>
</div>`;

// ---------- P2-35 기술 SEO: 검색 결과 제목·설명 보정 + 사이트 전체 구조화 데이터 ----------
// 짧거나 검색어가 빠진 제목·설명만 여기서 보정(원고는 그대로). 주소 기준이라 호출부를 고치지 않아도 됨
const SEO_DESC = {
  "/about/": () => `${cfg.siteName} 소개: PDF·이미지·글쓰기·생활 계산 툴과 펭귄 오락실을 어떤 원칙(브라우저 안에서 처리, 한계까지 적는 설명)으로 운영하는지, 운영자 ${cfg.operator} 안내.`,
  "/privacy/": () => `${cfg.siteName} 개인정보처리방침: 툴에 넣은 파일과 입력값을 서버로 보내지 않는 원칙, Google AdSense 광고 쿠키${cfg.gaId ? "와 Google Analytics 방문 통계" : ""}, 국외 이전, 문의처 안내.`,
  "/terms/": () => `${cfg.siteName} 이용약관: 서비스 내용, 서비스 변경·중단, 이용자의 의무, 저작권, 책임의 제한, 준거법과 분쟁 해결 안내.`,
  "/disclaimer/": () => `${cfg.siteName} 면책고지: 툴 결과물은 원본과 함께 확인해 주세요. 운세·재미 툴의 운세·테스트는 재미로 보는 콘텐츠이며 의학·법률·재정·심리 진단을 대신하지 않아요.`,
  "/contact/": () => `${cfg.siteName} 문의: 오류 제보, 의견, 제휴 문의는 이메일 ${cfg.contactEmail}로 보내 주세요. 문의할 때 알려 주시면 좋은 내용과 답변 안내.`,
  "/licenses/": () => `${cfg.siteName}가 쓰는 오픈소스 라이브러리(pdf-lib, pdf.js, mammoth, fflate, libheif, qrcode-generator 등)와 글꼴(Pretendard, Black Han Sans)의 버전·라이선스 안내.`, // P2-47 libheif, P2-48 qrcode-generator
  "/editorial/": () => `${cfg.siteName}가 툴 설명과 오락실 해설을 만들고 검수하는 기준: 실제 파일로 확인, 직접 작성과 사람 검수, 단정하지 않는 표현, 계산 방식 공개.`,
};
// 제목 보정: ① 오락실 카테고리(나의 성격 등)는 이름만 있으면 안에 든 콘텐츠 이름을 붙임 ② 오락실 툴에 seo 제목이 없으면 h1(검색어가 든 긴 제목)을 씀
function seoTitle(p, title) {
  const k = Object.keys(CATS).find((c) => p === `/${c}/`);
  if (k && title === CATS[k].name) {
    const names = []; let len = title.length + 3;
    for (const x of TOOLS.filter((x) => x.cat === k)) { if (len + x.title.length > 30 && names.length) break; names.push(x.title); len += x.title.length + 1; }
    return names.length ? `${title} — ${names.join("·")}` : title;
  }
  const tool = TOOLS.find((x) => x.path === p);
  if (tool && !tool.seo && title === tool.title && tool.h1) return tool.h1;
  return title;
}
// 사이트 전체 Organization·WebSite. 실제 주소 검색 기능이 없어서 SearchAction은 넣지 않음(홈 검색은 화면 안에서만 동작)
const ORG_ID = () => abs("/#organization");
const siteLd = () => [
  { "@context": "https://schema.org", "@type": "Organization", "@id": ORG_ID(), name: cfg.operator, url: abs("/"), email: cfg.contactEmail },
  { "@context": "https://schema.org", "@type": "WebSite", "@id": abs("/#website"), name: cfg.siteName, url: abs("/"), inLanguage: "ko", publisher: { "@id": ORG_ID() } },
];
// 페이지별 구조화 데이터 정리: Google 소프트웨어 앱 리치 결과는 평점(aggregateRating)이나 리뷰(review)가 필수 → 실제 평점이 없는 WebApplication은
// 서치 콘솔에 「잘못된 항목」으로 잡히므로 빼고(평점을 지어내지 않음), 운영자 Organization에는 주소(@id·url)를 채움
function cleanLd(list) {
  return list.filter((o) => !(o && o["@type"] === "WebApplication" && !o.aggregateRating && !o.review)).map((o) => {
    if (o && o.publisher && o.publisher["@type"] === "Organization" && o.publisher.name === cfg.operator && !o.publisher.url) return { ...o, publisher: { ...o.publisher, "@id": ORG_ID(), url: abs("/") } };
    return o;
  });
}

function layout({ title: title0, desc: desc0, path: p, body, scripts = [], jsonld = [], noindex = false, ogType = "website", fullTitle = false, wide = false, csp = false, vendor = [] }) {
  const title = fullTitle ? title0 : seoTitle(p, title0);
  const desc = SEO_DESC[p] ? SEO_DESC[p]() : desc0;
  // 제목이 길면(사이트 이름 포함 40자 초과) 「| 펭귄 툴즈」를 빼서 검색어가 잘리지 않게 함. 사이트 이름은 WebSite 구조화 데이터로 따로 알림
  const pageTitle = fullTitle || `${title} | ${cfg.siteName}`.length > 40 ? title : `${title} | ${cfg.siteName}`;
  if (!noindex) sitemap.push(p);
  const ld = [...siteLd(), ...cleanLd(jsonld)];
  return `<!doctype html>
<html lang="ko" data-base="${esc(cfg.basePath)}" data-site="${esc(cfg.siteName)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${csp ? `<meta http-equiv="Content-Security-Policy" content="${CSP}">` : ""}
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
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(cfg.siteName)} — 자주 쓰는 툴, 설치 없이 바로. PDF 합치기, JPG→PDF, 용량 줄이기, 글자수 세기, 타이머">
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
<link rel="stylesheet" href="${u("/assets/style.css")}?v=${BUILD_V}">
${cfg.adsenseClient ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(cfg.adsenseClient)}" crossorigin="anonymous"></script>` : ""}
${cfg.gaId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(cfg.gaId)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(cfg.gaId)}');</script>` : ""}
<script type="application/ld+json">${JSON.stringify(ld.length === 1 ? ld[0] : ld).replace(/</g, "\\u003c")}</script>
</head>
<body>
<a class="skip" href="#main">본문으로 건너뛰기</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="logo" href="${u("/")}">${LOGO(34)}${esc(cfg.siteName)}</a>
    <button type="button" class="fav-menu" data-fav-menu aria-haspopup="dialog" aria-expanded="false" aria-controls="fav-pop" aria-label="내 즐겨찾기">${STAR_SVG}<span class="fav-count" hidden>0</span></button>
    <nav class="nav" aria-label="카테고리">
      ${NAV.map(([n, h]) => `<a href="${u(h)}"${p.startsWith(h) || (h === PLAY.path && Object.keys(CATS).some((k) => p.startsWith(`/${k}/`))) ? ' aria-current="true"' : ""}>${esc(n)}</a>`).join("")}
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
      <a href="${u("/about/")}">소개</a><a href="${u("/editorial/")}">작성·검수 기준</a><a href="${u("/privacy/")}"><strong>개인정보처리방침</strong></a><a href="${u("/terms/")}">이용약관</a><a href="${u("/disclaimer/")}">면책고지</a><a href="${u("/licenses/")}">오픈소스 고지</a><a href="${u("/contact/")}">문의</a>
    </nav>
    <p class="family">세화산업의 다른 서비스: <a href="${FAMILY.url}" target="_blank" rel="noopener">${esc(FAMILY.name)} · 익명 브레인스토밍 ↗<span class="sr"> (새 창, 외부 사이트)</span></a></p>
    <p class="copy">© ${new Date().getFullYear()} ${esc(cfg.operator)} · ${esc(cfg.siteName)}</p>
  </div>
</footer>
<script src="${u("/assets/app.js")}?v=${BUILD_V}" defer></script>
<script src="${u("/assets/fav-index.js")}?v=${BUILD_V}" defer></script>
<script src="${u("/assets/favs.js")}?v=${BUILD_V}" defer></script>
${vendor.map((s) => `<script src="${u(`/assets/vendor/${s}`)}?v=${BUILD_V}" defer></script>`).join("\n")}
${scripts.map((s) => `<script src="${u(`/assets/${s}`)}?v=${BUILD_V}" defer></script>`).join("\n")}
</body>
</html>`;
}

// 툴 페이지 공통 본문: 설명 → [툴] → 결과 → 공유 → 추천 → 해석 가이드 → 광고 → FAQ → 광고
function toolPage(tool, toolHtml, { scripts = [], extraBelow = "", dataJson = null } = {}) {
  const g = guides[tool.id];
  if (!g) throw new Error(`guides.${tool.id} 없음`);
  const cat = CATS[tool.cat] || UCATS[tool.cat]; // P2-49 운세·재미(UCATS.fun) 항목도 같은 틀
  const items = [["홈", "/"], [cat.name, `/${tool.cat}/`], [tool.title, tool.path]];
  const body = `
${crumbHtml(items)}
<article class="tool">
  <header class="page-head">
    <span class="eyebrow">${esc(cat.name)}</span>
    <h1>${esc(tool.h1)} ${favBtn(tool, "fav-title")}</h1>
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
    layout({ title: tool.seo || tool.title, desc: tool.desc, path: tool.path, body, scripts, jsonld: [faqLd(g.faq), crumbs(items)] })
  );
}

// ---------- 빌드 시작 ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.cpSync(path.join(ROOT, "src", "assets"), path.join(DIST, "assets"), { recursive: true });

// 홈 배치(COO 개편): 툴은 홈에서 대표 서랍 한 곳에만 보임(also가 있으면 also[0]) → 중복 행 없음
const homeIn = (k) => TOOL_RANK.map((id) => anyById[id]).filter((x) => ((x.also || [])[0] || x.cat) === k); // P2-49 운세·재미 포함
// 서랍 순서: 툴이 많은 서랍부터(같으면 UCATS 순서). 위 3개는 윗줄, 나머지는 아랫줄
const homeOrder = () => Object.entries(UCATS).map((e, i) => [e, homeIn(e[0]).length, i]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).map((x) => x[0]);
// P2-49 데스크톱 줄 배치: 윗줄 3개(넓이 1/3). 아랫줄이 2개면 반씩, 그 밖에는 1/3씩
const cabCls = (i, n) => (n > 6 && i === n - 1 && (n - 3) % 3 === 1 ? "cab-full" : i < 3 || n - 3 !== 2 ? "cab-big" : "cab-wide"); // P2-50 서랍 7개면 마지막에 혼자 남는 서랍은 한 줄 전체
// 오락실 타일: 홈에서 놀이 콘텐츠를 한눈에(4×2)
// ★ 새 툴·게임을 만들면 여기에 { id, d: "출시일" }을 맨 위에 추가(대표님 지시: 새 콘텐츠는 메인에 잘 보이게).
// 출시 30일 이내 항목 중 최신 4개가 홈 맨 위 「NEW」 띠에 나오고, 해당 행·타일에 NEW 표시가 붙음
const NEW_ITEMS = [
  { id: "possize", d: "2026-11-10" }, // P2-56
  { id: "compound", d: "2026-11-10" }, // P2-55
  { id: "rsibt", d: "2026-11-10" }, // P2-54
  { id: "ostax", d: "2026-11-10" }, // P2-53
  { id: "dca", d: "2026-11-10" }, // P2-52
  { id: "avgdown", d: "2026-11-10" }, // P2-51
  { id: "stockquiz", d: "2026-11-10" }, // P2-50
  { id: "qr", d: "2026-11-09" }, // P2-48
  { id: "heic", d: "2026-11-09" }, // P2-47
  { id: "imgmerge", d: "2026-11-09" }, // P2-46
  { id: "salary", d: "2026-11-09" }, // P2-45
  { id: "juhyu", d: "2026-11-09" }, // P2-45
  { id: "severance", d: "2026-11-09" }, // P2-45
  { id: "unemp", d: "2026-11-09" }, // P2-45
  { id: "draw", d: "2026-11-09" }, // P2-44
  { id: "hellchosun", d: "2026-11-02" },
  { id: "hell", d: "2026-11-02" },
  { id: "removebg", d: "2026-11-02" },
  { id: "saju", d: "2026-11-02" },
  { id: "rpg", d: "2026-11-02" },
  { id: "stack", d: "2026-11-02" },
  { id: "timer", d: "2026-11-02" },
];
// ★ 체류시간이 긴 게임은 홈 맨 위 큰 카드로(대표님 지시). 새 장편 게임을 만들면 여기에도 추가
const LONG_GAMES = [
  { id: "rpg", t: "약 1시간 · 자동 저장" },
  { id: "hellchosun", t: "한 판 15~30분" },
  { id: "life", t: "한 판 5~10분" },
];
const NEW_DAYS = 30;
const newList = (() => {
  const now = Date.parse(kstDate());
  return NEW_ITEMS.filter((x) => anyById[x.id] && now - Date.parse(x.d) <= NEW_DAYS * 864e5);
})();
const isNew = (id) => newList.some((x) => x.id === id);
const newCard = (id) => {
  const x = anyById[id], util = !!utilById[id];
  return `<li class="has-fav">${favBtn(x, "fav-tile")}<a class="new-card" href="${u(x.path)}"><span class="new-tag">NEW</span><span class="fun-art">${ART[x.id]}</span><b>${esc(x.title)}</b><span>${esc(x.hook)}</span><small>${util ? esc(catName(x.cat)) : esc(PLAY.name)}</small></a></li>`;
};
const FUN_TILES = ["hell", "stack", "reaction", "family"]; // P2-49 게임만(rpg·hellchosun·life는 바로 위 「오래 즐기는 게임」에 있음)
const funTile = (id) => {
  if (id === "family") return `<li class="has-fav">${favBtn({ id: "family", title: FAMILY.name }, "fav-tile")}<a class="fun-tile t-love" href="${FAMILY.url}" target="_blank" rel="noopener"><span class="fun-art">${ART.family || ""}</span><b>${esc(FAMILY.name)} <small class="ext">새 창 ↗</small></b><span>${esc(FAMILY.hook)}</span></a></li>`;
  const x = toolById[id];
  return `<li class="has-fav">${favBtn(x, "fav-tile")}<a class="fun-tile t-${x.cat}" href="${u(x.path)}"><span class="fun-art">${ART[x.id]}</span><b>${esc(x.title)}</b><span>${esc(x.hook)}</span></a></li>`;
};
// 홈 — 「펭귄 공구함」: 검색 + 카테고리 서랍(열)마다 툴 행. 툴이 늘면 행만 늘어남. 오락실은 한 줄 띠(20% 이하)
const playCat = (x) => (CATS[x.cat] ? `${PLAY.name} · ${CATS[x.cat].name}` : catName(x.cat)); // P2-49 게임은 「오락실 · 분류」, 운세·재미는 툴 분류 이름
const SEARCH_INDEX = [
  ...UTILS.map((x) => ({ t: x.title, p: u(x.path), c: catName(x.cat), k: `${x.kw} ${x.hook}`, b: x.beta ? 1 : 0 })),
  ...TOOLS.map((x) => ({ t: x.title, p: u(x.path), c: playCat(x), k: x.kw ? `${x.kw} ${x.hook}` : x.hook })), // P2-44 kw 있으면 검색어 추가, P2-49 분류 이름
  { t: FAMILY.name, p: FAMILY.url, c: "세화산업 다른 서비스 · 새 창", k: `랜덤7942 랜덤 채팅 익명 채팅 브레인스토밍 random7942 ${FAMILY.hook}`, x: 1 }, // 외부 사이트(대표님 지시)
];
const byUtilRank = UTIL_RANK.map((id) => utilById[id]);
{
  const body = `
<section class="hero hero-tools">
  <div class="hero-text">
    <p class="hero-kicker">펭귄 공구함 · 툴 ${TOOL_RANK.length}개</p>
    <h1>자주 쓰는 툴, <br>설치 없이 바로</h1>
    <p class="lead">PDF·이미지·글쓰기·생활 계산·운세·투자 툴을 서랍별로 정리해 두었어요. 가입 없이 쓰고, 파일은 서버로 전송하지 않습니다.</p>
  </div>
  <form class="search" role="search" action="${u("/")}">
    <label for="tool-q">어떤 툴을 찾으세요?</label>
    <div class="search-row"><input id="tool-q" type="search" placeholder="예: pdf 합치기, 글자수, 만 나이" autocomplete="off" aria-controls="tool-hits" aria-describedby="tool-hits-n"><span class="search-ico" aria-hidden="true"></span></div>
    <p class="hint" id="tool-hits-n" aria-live="polite"></p>
    <ul class="hits" id="tool-hits" hidden></ul>
    <div class="fav-bar" id="fav-bar" aria-label="내 즐겨찾기"><span class="fav-bar-h">${STAR_SVG}내 즐겨찾기</span><div class="fav-bar-list"><span class="fav-empty">☆를 눌러 자주 쓰는 툴을 모아 두세요</span></div></div>
  </form>
</section>
<script type="application/json" id="tool-index">${JSON.stringify(SEARCH_INDEX).replace(/</g, String.fromCharCode(92) + "u003c")}</script>

<!-- P2-49 툴이 주인공: 검색·즐겨찾기 바로 아래에 모든 툴을 서랍별로 펼침 → 그 아래 NEW 띠 → 오래 즐기는 게임 → 오락실(게임만) -->
<section class="toolbox" aria-labelledby="toolbox-h">
  <div class="toolbox-head"><h2 id="toolbox-h">모든 툴 <small>${TOOL_RANK.length}개 · 서랍별</small></h2><nav class="cab-jump" aria-label="툴 서랍 바로 가기">${homeOrder().map(([k, c]) => `<a class="chip" href="#cab-${k}"><i class="dot t-${k}" aria-hidden="true"></i>${esc(c.name)} <small>${homeIn(k).length}</small></a>`).join("")}</nav></div>
  <div class="cabinet">${homeOrder().map(([k, c], i, all) => `<div class="cab ${cabCls(i, all.length)}" id="cab-${k}">${drawerHtml({ tone: k, name: c.name, href: `/${k}/`, tools: homeIn(k), tag: "h3" })}</div>`).join("")}</div>
</section>
${newList.filter((x) => !LONG_GAMES.some((g) => g.id === x.id)).length ? `<section class="new-band" aria-labelledby="new-h"><h2 id="new-h"><span class="new-tag">NEW</span> 새로 나왔어요</h2><ul class="new-grid">${newList.filter((x) => !LONG_GAMES.some((g) => g.id === x.id)).slice(0, 4).map((x) => newCard(x.id)).join("")}</ul></section>` : ""}
<section class="long-band" aria-labelledby="long-h"><h2 id="long-h">오래 즐기는 게임 <small>${esc(PLAY.name)}의 대표 게임</small></h2><ul class="long-grid">${LONG_GAMES.map(({ id, t }) => { const x = toolById[id]; return `<li class="has-fav">${favBtn(x, "fav-tile")}<a class="long-card t-${x.cat}" href="${u(x.path)}"><span class="long-art">${ART[x.id]}</span><span class="long-body">${isNew(id) ? '<span class="new-tag">NEW</span> ' : ""}<em>${esc(t)}</em><b>${esc(x.title)}</b><span>${esc(x.hook)}</span></span><span class="ff-go">플레이 ›</span></a></li>`; }).join("")}</ul></section>

<section class="fun-band" aria-labelledby="play-h">
  <div class="fun-head"><h2 id="play-h"><a href="${u(PLAY.path)}">${esc(PLAY.name)}</a></h2><p>${esc(PLAY.tagline)}</p><a class="more" href="${u(PLAY.path)}">게임 전체 보기 ›</a></div>
  <ul class="fun-grid">${FUN_TILES.map((id) => funTile(id)).join("")}</ul>
</section>

<section class="home-block home-about">
  <div class="about-head">
    <h2 class="home-h">${esc(cfg.siteName)}는 이런 곳이에요</h2>
    <ul class="about-points"><li><b>설치·가입 없음</b>주소만 열면 바로 써요</li><li><b>브라우저 처리</b>파일은 서버로 전송하지 않습니다</li><li><b>쓰는 법 공개</b>툴마다 사용법과 한계를 적어 둬요</li></ul>
  </div>
  <div class="about-body">${fill(pages.home.intro).split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}</div>
</section>
${adSlotFixed("home")}`;
  write("/", layout({ title: `${cfg.siteName} — ${cfg.tagline}`, fullTitle: true, wide: true, scripts: ["home.js"], desc: "PDF 합치기·나누기, JPG PDF 변환, PDF JPG 변환, 이미지 용량 줄이기, 글자수 세기, 만 나이·평수·디데이 계산기까지. 자주 쓰는 툴을 설치·가입 없이 브라우저에서 바로 써 보세요.", path: "/", body }));
}

// 펭귄 오락실 허브 — 같은 서랍 시스템으로 「오늘 / 테스트 / 게임」 3구역. 기존 주소는 그대로
// P2-49 오락실 = 게임만. 운세·사주·테스트·사다리는 툴 「운세·재미」(/fun/)로 옮기고 허브에는 안내 한 줄만 남김
const ZONES = [
  { tone: "story", name: "게임", sub: "한 판이면 끝나는 짧은 게임", ids: ["rpg", "hell", "hellchosun", "life", "stack", "reaction"] },
  { tone: "love", name: "같이", sub: "세화산업이 운영하는 다른 서비스(외부 사이트)", ids: [], ext: [FAMILY] },
];
{
  const items = [["홈", "/"], [PLAY.name, PLAY.path]];
  const extra = {
    게임: `<details class="drawer-extra"><summary>Life Game 엔딩 5가지</summary><div class="chips">${LIFE_KEYS.map((k) => `<a class="chip" href="${u(`/story/life/${LIFE_SLUG[k]}/`)}">${esc(guides.lifeTypes[k].name)}</a>`).join("")}</div></details>`,
  };
  const pool = ZONES.flatMap((z) => z.ids);
  const body = `${crumbHtml(items)}
<header class="page-head play-head">
  <span class="eyebrow">게임</span>
  <h1>${esc(PLAY.name)}</h1>
  <p class="lead">${esc(PLAY.desc)} 가입은 필요 없고, 입력한 건 어디에도 저장하지 않아요.</p>
  <div class="hero-actions"><button class="btn" type="button" data-act="draw">아무거나 한 판</button><span class="fun-badge">가입 없이 바로 한 판</span></div>
  <ul hidden data-draw-pool>${pool.map((id) => `<li><a href="${u(toolById[id].path)}">${esc(toolById[id].title)}</a></li>`).join("")}</ul>
</header>
${(() => {
  // ZONES는 그대로 두고(다른 작업자가 게임 id를 추가함) 화면 배치만 새로: 게임 구역의 앞 2개는 특집 카드
  const z = Object.fromEntries(ZONES.map((x) => [x.name, x]));
  const games = z["게임"].ids, feat = games.slice(0, 2), mini = games.slice(2);
  const tile = (id) => funTile(id);
  const featCard = (id) => { const x = toolById[id]; return `<li class="has-fav">${favBtn(x, "fav-tile")}<a class="arc-feat t-${x.cat}" href="${u(x.path)}"><span class="fun-art">${ART[x.id]}</span><span class="ff-body"><em>${esc(x.meta || "게임")}</em><b>${esc(x.title)}</b><span>${esc(x.hook)}</span></span><span class="ff-go">플레이 ›</span></a></li>`; };
  return `<section class="arcade" aria-label="${esc(PLAY.name)} 콘텐츠">
  <div class="arc-sec"><h2 class="arc-h"><span class="dot t-story"></span>게임 <small>한 판이면 끝나는 짧은 게임부터 1시간 RPG까지</small></h2>
    <ul class="arc-feats">${feat.map(featCard).join("")}</ul>
    <ul class="fun-grid arc-grid">${mini.map(tile).join("")}</ul>${extra["게임"]}</div>
  <p class="arc-moved"><span class="dot t-fun" aria-hidden="true"></span>오늘의 운세·사주·성격 테스트·이름 궁합·사다리타기는 툴로 옮겼어요. <a href="${u("/fun/")}">운세·재미 툴 보기 ›</a></p>
  <div class="arc-sec"><h2 class="arc-h"><span class="dot t-love"></span>같이 <small>세화산업이 운영하는 다른 서비스</small></h2>
    <ul class="fun-grid arc-grid arc-1">${tile("family")}</ul></div>
</section>`;
})()}
${recoRows(["charcount", "dday", "pdfmerge"], "쉬었다면, 일하러 갈 때 쓰는 툴")}
${adSlot("play")}`;
  write(PLAY.path, layout({ title: `${PLAY.name} — 무료 RPG·생존 게임·짧은 게임`, wide: true, scripts: ["home.js"], desc: `${PLAY.desc} 가입 없이 브라우저에서 바로 한 판.`, path: PLAY.path, body, jsonld: [crumbs(items)] }));
}

// 카테고리 페이지
// P2-49 me·luck 하위 칩은 「운세·재미」(/fun/) 페이지로 옮김(FUN_EXTRA)
const FUN_EXTRA = () => `<section class="cat-block"><div class="cat-head"><h2>띠별 성격</h2></div><div class="chips">${TTI_KEYS.map((k) => `<a class="chip" href="${u(FUN_PATH.tti(k))}">${TTI_EMOJI[k]} ${esc(tti[k].name)}</a>`).join("")}</div></section>
<section class="cat-block"><div class="cat-head"><h2>별자리별 성향</h2></div><div class="chips">${ZODIAC_KEYS.map((k) => `<a class="chip" href="${u(FUN_PATH.zodiac(k))}">${zodiac[k].symbol} ${esc(zodiac[k].name)}</a>`).join("")}</div></section>
<section class="cat-block"><div class="cat-head"><h2>16유형 해설</h2></div><div class="chips">${TYPE_KEYS.map((k) => `<a class="chip" href="${u(FUN_PATH.type(k))}">${esc(personality[k].name)}</a>`).join("")}</div></section>
<section class="cat-block"><div class="cat-head"><h2>띠별 오늘의 운세 바로가기</h2></div><div class="chips">${TTI_KEYS.map((k) => `<a class="chip" href="${u(`${FUN_PATH.today}#${k}`)}">${TTI_EMOJI[k]} ${esc(tti[k].name)}</a>`).join("")}</div></section>`;
const CAT_EXTRA = {
  story: () => `<section class="cat-block"><div class="cat-head"><h2>Life Game 엔딩 5가지</h2></div><div class="chips">${LIFE_KEYS.map((k) => `<a class="chip" href="${u(`/story/life/${LIFE_SLUG[k]}/`)}">${esc(guides.lifeTypes[k].name)}</a>`).join("")}</div></section>`,
  arcade: () => "",
};
for (const [k, c] of Object.entries(CATS)) {
  const list = TOOLS.filter((x) => x.cat === k);
  const items = [["홈", "/"], [c.name, `/${k}/`]];
  const body = `${crumbHtml(items)}
<header class="page-head"><span class="eyebrow">${esc(PLAY.name)}</span><h1>${esc(c.name)}</h1><p class="lead">${esc(c.desc)}</p></header>
<div class="drawers drawers-1">${drawerHtml({ tone: k, name: c.name, tools: list })}</div>
${CAT_EXTRA[k]()}
${recoRows(GAMES.filter((x) => x.cat !== k).map((x) => x.id), "오락실의 다른 게임")}`;
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
${shareBar({ title: "오늘의 띠별 운세", text: "매일 자정에 바뀌는 12띠 오늘의 운세", path: toolById.today.path })}
<script type="module" src="${u("/assets/today.js")}?v=${BUILD_V}"></script>`;
  toolPage(toolById.today, html);
}

// 띠별 성격 페이지
TTI_KEYS.forEach((k) => {
  const d = tti[k];
  const p = FUN_PATH.tti(k);
  const items = [["홈", "/"], ["운세·재미", "/fun/"], [`${d.name} 성격`, p]];
  const len = textLen(d.personality);
  const born = d.years.filter((y) => y >= 1936 && y <= 2031);
  const body = `${crumbHtml(items)}
<article class="result-page">
  <header class="page-head"><span class="eyebrow">띠별 성격</span><h1>${TTI_EMOJI[k]} ${esc(d.name)} 성격과 특징</h1><p class="lead">${t(d.summary)}</p><p class="fun-badge">재미로 보는 콘텐츠예요</p></header>
  <section class="prose">${blocks(d.personality, "h2")}
  <h2>${esc(d.name)} 출생연도</h2><p>${born.map((y) => `${y}년`).join(" · ")}생 (입춘 기준)</p></section>
  ${shareBar({ title: `${d.name} 성격`, text: fill(d.summary), path: p })}
  <section class="prose"><p><a href="${u(`${FUN_PATH.today}#${k}`)}">${esc(d.name)} 오늘의 운세 보기</a></p></section>
  <div class="chips">${TTI_KEYS.filter((x) => x !== k).map((x) => `<a class="chip" href="${u(FUN_PATH.tti(x))}">${TTI_EMOJI[x]} ${esc(tti[x].name)}</a>`).join("")}</div>
  ${recoHtml(["birthday", "today", "personality"])}
</article>`;
  write(p, layout({ title: `${d.name} 성격과 특징`, desc: `${d.name} 성격: ${fill(d.summary)} ${d.name} 출생연도와 오늘의 운세까지 함께 확인해 보세요.`, path: p, body, ogType: "article", noindex: len < 300, jsonld: [crumbs(items)] }));
});

// 별자리 페이지
ZODIAC_KEYS.forEach((k, i) => {
  const d = zodiac[k];
  const p = FUN_PATH.zodiac(k);
  const items = [["홈", "/"], ["운세·재미", "/fun/"], [`${d.name}`, p]];
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
  <h2>같은 「${esc(d.element)}」 원소의 별자리</h2><p>${same.map((x) => `<a href="${u(FUN_PATH.zodiac(x))}">${esc(zodiac[x].name)}</a>`).join(", ")}는 ${esc(d.name)}와 같은 원소로 묶여요. 별자리 경계 날짜는 해마다 하루쯤 달라질 수 있어요.</p></section>
  <div class="chips">${ZODIAC_KEYS.filter((x) => x !== k).map((x) => `<a class="chip" href="${u(FUN_PATH.zodiac(x))}">${zodiac[x].symbol} ${esc(zodiac[x].name)}</a>`).join("")}</div>
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
  const typeGrid = `<section class="prose"><h2>16가지 유형 둘러보기</h2></section><div class="chips">${TYPE_KEYS.map((k) => `<a class="chip" href="${u(FUN_PATH.type(k))}">${k} · ${esc(personality[k].name)}</a>`).join("")}</div>`;
  toolPage(toolById.personality, html, { scripts: ["personality.js"], extraBelow: typeGrid, dataJson: { questions } });

  const AXES = { E: "외향", I: "내향", S: "감각", N: "직관", T: "사고", F: "감정", J: "판단", P: "인식" };
  TYPE_KEYS.forEach((k) => {
    const d = personality[k];
    const p = FUN_PATH.type(k);
    const items = [["홈", "/"], ["운세·재미", "/fun/"], ["16유형 성격 테스트", toolById.personality.path], [d.name, p]];
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
  <p class="center"><a class="btn ghost" href="${u(toolById.personality.path)}">테스트 다시 하기</a></p>
  <section class="prose">${blocks(d.body, "h2")}
  <div class="two-col"><div><h2>이런 점이 빛나요</h2><ul>${d.strengths.map((x) => `<li>${t(x)}</li>`).join("")}</ul></div><div><h2>이런 점은 챙겨 보세요</h2><ul>${d.cautions.map((x) => `<li>${t(x)}</li>`).join("")}</ul></div></div>
  ${g && personality[g] ? `<h2>잘 통한다고 알려진 유형</h2><p><a href="${u(FUN_PATH.type(g))}">${esc(personality[g].name)} (${g})</a> — ${t(d.match.note)}</p>` : ""}
  </section>
  ${adSlot("mid")}
  <div class="chips">${TYPE_KEYS.filter((x) => x !== k).map((x) => `<a class="chip" href="${u(FUN_PATH.type(x))}">${x} · ${esc(personality[x].name)}</a>`).join("")}</div>
  ${recoHtml(["birthday", "namematch", "reaction"])}
  <p class="legal">이 테스트는 칼 융의 심리 유형론에서 출발한 대중적인 4축 모델을 참고해 ${esc(cfg.siteName)}가 자체 제작한 간이 테스트입니다. 공식 성격유형 검사가 아니며, 해당 검사의 상표 권리자 및 국내 판권사와 관련이 없습니다.</p>
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

// 블록 쌓기 게임 (P2-20, 랜덤7942 대기 화면 게임 이식. Firebase 없음, 최고 기록만 이 기기에)
{
  const html = `
<div class="stack-wrap">
  <div id="stack-stage" class="stack-stage" tabindex="0" role="application" aria-label="블록 쌓기 게임 화면. 탭하거나 Space를 눌러 블록을 멈추세요" data-state="ready">
    <canvas id="stack-canvas"></canvas>
    <div id="stack-score" class="stack-score" aria-live="polite">0</div>
    <div id="stack-pop" class="stack-pop" aria-hidden="true"></div>
    <div id="stack-overlay" class="stack-overlay"></div>
  </div>
</div>
<p class="hint">PC는 클릭이나 Space, 휴대폰은 화면을 탭하세요. 최고 기록은 이 기기의 브라우저에 남고, TOP10에 들어 「순위에 올리기」를 고른 경우에만 닉네임과 점수가 순위표로 전송돼요.</p>
<p class="hint">랜덤7942의 대기 화면에서 하던 그 블록 쌓기와 같은 게임이에요. <a href="${FAMILY.url}" target="_blank" rel="noopener">랜덤7942 · 익명 브레인스토밍 ↗<span class="sr"> (새 창, 외부 사이트)</span></a></p>`;
  toolPage(toolById.stack, html, { scripts: ["rank.js", "stack.js"], extraBelow: `<section class="rank-page" data-rank-game="stack" aria-label="순위표"></section>` });
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
  toolPage(toolById.reaction, html, { scripts: ["rank.js", "reaction.js"], extraBelow: `<section class="rank-page" data-rank-game="reaction" aria-label="순위표"></section>` });


}

// P2-44 사다리타기 · 돌림판 · 제비뽑기 (src/assets/draw.js). 결과는 추첨 번호(시드) 하나로 정해지고 주소 # 뒤에 담김
{
  const html = `
<div class="dr" id="dr">
  <p class="dr-from-link" id="dr-from-link" hidden>공유받은 링크로 열었어요. 추첨 번호 <b></b>로 만든 결과를 그대로 다시 볼 수 있어요.</p>
  <div class="dr-presets" role="group" aria-label="빠른 시작"><span class="hint">빠른 시작</span>${[["coffee", "커피 내기"], ["lunch", "점심 메뉴"], ["clean", "청소 당번"], ["order", "발표 순서"]].map(([k, n]) => `<button type="button" class="chip" data-preset="${k}">${n}</button>`).join("")}</div>
  <div class="row2 dr-inputs">
    <label for="dr-p">참가자 <small>한 줄에 하나 · 최대 12명</small><textarea id="dr-p" rows="5" autocomplete="off" spellcheck="false" placeholder="민수&#10;지영&#10;현우"></textarea></label>
    <label for="dr-r">결과 항목 <small>한 줄에 하나 · 최대 12개</small><textarea id="dr-r" rows="5" autocomplete="off" spellcheck="false" placeholder="커피 쏘기&#10;통과"></textarea></label>
  </div>
  <p class="hint dr-note" id="dr-note" aria-live="polite"></p>
  <div class="dr-seedrow"><span>추첨 번호 <b id="dr-seed"></b></span><button type="button" class="btn ghost" data-dr="reseed">새로 섞기</button></div>
  <div class="tabs dr-tabs" role="tablist" aria-label="뽑는 방법">
    <button type="button" role="tab" id="dr-tab-ladder" data-mode="ladder" aria-controls="dr-ladder" aria-selected="true">사다리</button>
    <button type="button" role="tab" id="dr-tab-wheel" data-mode="wheel" aria-controls="dr-wheel" aria-selected="false" tabindex="-1">돌림판</button>
    <button type="button" role="tab" id="dr-tab-cards" data-mode="cards" aria-controls="dr-cards" aria-selected="false" tabindex="-1">제비뽑기</button>
  </div>
  <section class="dr-panel" id="dr-ladder" role="tabpanel" aria-labelledby="dr-tab-ladder">
    <div class="dr-scroll"><div class="dr-ladder"><div class="dr-names"></div><canvas id="dr-ladder-cv" aria-label="사다리 그림" role="img"></canvas><div class="dr-ends"></div></div></div>
    <div class="dr-btns"><button type="button" class="btn" data-dr="all">전체 공개</button><span class="hint">이름을 누르면 한 명씩 열려요.</span></div>
  </section>
  <section class="dr-panel" id="dr-wheel" role="tabpanel" aria-labelledby="dr-tab-wheel" hidden>
    <fieldset class="seg dr-wsrc"><legend>돌림판 칸</legend><label><input type="radio" name="dr-w" value="r"><span>결과 항목</span></label><label><input type="radio" name="dr-w" value="p"><span>참가자 이름</span></label></fieldset>
    <div class="dr-wheel-box"><span class="dr-pin" aria-hidden="true"></span><canvas id="dr-wheel-cv" aria-label="돌림판" role="img"></canvas></div>
    <button type="button" class="btn big dr-spin" id="dr-spin">길게 누를수록 세게 돌려요</button>
    <div class="dr-gauge" aria-hidden="true"><i></i></div>
  </section>
  <section class="dr-panel" id="dr-cards" role="tabpanel" aria-labelledby="dr-tab-cards" hidden>
    <div class="dr-cards"></div>
    <div class="dr-btns"><button type="button" class="btn" data-dr="flipall">모두 뒤집기</button><span class="hint">카드를 누르면 한 장씩 뒤집혀요.</span></div>
  </section>
  <div class="dr-result" id="dr-result" aria-live="polite"></div>
  <div class="dr-btns dr-share"><button type="button" class="btn" data-dr="link">공정성 링크 복사</button><button type="button" class="btn ghost" data-dr="image">결과 이미지 저장</button></div>
  <p class="hint" id="dr-link-note" aria-live="polite"></p>
  <p class="safe">입력한 이름과 항목은 저장하거나 서버로 보내지 않아요. 공정성 링크에는 이름과 항목이 들어가니, 실명 대신 별명을 써도 돼요.</p>
</div>`;
  toolPage(toolById.draw, html, { scripts: ["draw.js"] });
}

// 인생 게임 장면·선택 검사 (어기면 빌드 실패) — P2-21 터닝포인트 구조
// 1) 모든 장면 키·배경·소품·효과가 있음 2) 터닝포인트 필수 8종 3) 엔딩 10종 이상 4) 배경 12종을 모두 씀
// 5) 모순 방지: 30세 이후 작은 사건에 배우자가 그려지면 married 조건 필수, 내 아이가 그려지면 kids 조건 필수, 터닝포인트와 겹치는 사건은 skip
function checkLife() {
  const ctx = { window: {} };
  ctx.NALGI = ctx.window.NALGI = {};
  vm.createContext(ctx);
  for (const f of ["pixel.js", "life-data.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, "src", "assets", f), "utf8"), ctx, { filename: f });
  const { BG_KEYS, PROPS, FX } = ctx.NALGI.pixel, { SLOTS, SCENES, MILESTONES, NEEDS, TURNS, CRISES, ENDINGS, SMALL_AGES } = ctx.NALGI.lifeData;
  const err = [];
  const scene = (k, where) => {
    const s = SCENES[k];
    if (!s) return err.push(`${where}: 장면 ${k} 없음`);
    if (!BG_KEYS.includes(s.bg)) err.push(`${where}: 배경 ${s.bg} 없음`);
    [...(s.props || []), ...(s.back || [])].forEach(([p]) => PROPS[p] || err.push(`${where}: 소품 ${p} 없음`));
    (s.fx || []).forEach((p) => FX[p] || err.push(`${where}: 효과 ${p} 없음`));
    return s;
  };
  const NEED_KEYS = ["skip", "married", "kids", "employed", "edu", "job", "notJob", "notHome", "retired", "stranger"];
  let n = 0;
  SLOTS.forEach(([[lo, hi], list]) => list.forEach((e) => {
    n++;
    const s = scene(e[5], `${lo}~${hi}세 「${e[0]}」`), need = NEEDS[e[5]] || {};
    Object.keys(need).forEach((k) => NEED_KEYS.includes(k) || err.push(`${e[5]}: 모르는 조건 ${k}`));
    if (!s || need.skip) return;
    const roles = (s.with || []).map((w) => w[0]);
    if (lo >= 30 && roles.includes("lover") && need.married === undefined) err.push(`${e[5]}(${lo}세~): 배우자가 그려지는데 married 조건이 없음`);
    if ((roles.includes("kid") || roles.includes("child")) && lo >= 20 && !need.kids && !need.stranger) err.push(`${e[5]}: 내 아이가 그려지는데 kids 조건이 없음`);
  }));
  if (n !== 100) err.push(`작은 사건이 ${n}개 (100개여야 함)`);
  SMALL_AGES.forEach((a) => SLOTS.some(([[lo, hi]]) => a >= lo && a <= hi) || err.push(`작은 사건 나이 ${a}세에 맞는 시기가 없음`));
  MILESTONES.forEach(([, , k]) => ["city", "sea", "mountain"].forEach((b) => scene(k.replace("{born}", b), `이정표 ${k}`)));
  ["edu", "job", "marry", "kids", "career", "move", "crisis", "retire"].forEach((id) => TURNS.some((t) => t.id === id) || err.push(`터닝포인트 ${id} 없음`));
  TURNS.forEach((t) => { if (t.art) scene(t.art, `터닝포인트 ${t.id}`); if (t.opts.length < 2) err.push(`터닝포인트 ${t.id}: 선택지 2개 미만`); t.opts.forEach((o) => scene(o.art, `터닝포인트 ${t.id} 「${o.label}」`)); });
  CRISES.forEach((c) => { scene(c.art, `위기 ${c.id}`); ["endure", "help", "new"].forEach((w) => c.text[w] || err.push(`위기 ${c.id}: ${w} 결과 문장 없음`)); });
  if (ENDINGS.length < 10) err.push(`엔딩이 ${ENDINGS.length}종 (10종 이상 필요)`);
  ENDINGS.forEach((e) => scene(e.art, `엔딩 ${e.key}`));
  if (!ENDINGS[ENDINGS.length - 1].if({})) err.push("마지막 엔딩은 어떤 경우에도 맞아야 함(빈 인생 대비)");
  scene("ending", "엔딩");
  const used = new Set(Object.values(SCENES).map((s) => s.bg));
  BG_KEYS.forEach((b) => used.has(b) || err.push(`배경 ${b}가 어느 장면에도 안 쓰임`));
  if (BG_KEYS.length !== 12) err.push(`배경이 ${BG_KEYS.length}종 (12종이어야 함)`);
  if (err.length) throw new Error("인생 게임 장면 검사 실패:\n  " + [...new Set(err)].join("\n  "));
}

// ⑥ Life Game + 엔딩 5개
{
  const html = `
<div id="life" class="life">
  <div class="life-start">
    <canvas class="life-pix" id="life-intro" width="96" height="60" role="img" aria-label="태어날 사람 미리보기"></canvas>
    <p class="hint center">그림을 누르면 머리 모양과 옷이 바뀌어요.</p>
    <p>한 사람이 태어나요. 그 사람이 되어 일생을 살아 보세요. <strong>시간 제한은 없어요.</strong> 장면은 「다음」을 눌러야 넘어가요.</p>
    <p>진학, 첫 직업, 결혼, 자녀, 이직, 이사, 위기, 은퇴 같은 <strong>인생의 터닝포인트를 직접 고르면</strong> 그 뒤의 사건과 그림, 함께 사는 사람, 엔딩이 고른 대로 바뀌어요. 한 판은 5~10분쯤 걸려요.</p>
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
      <p class="hint">성별은 그림의 옷차림에만 쓰여요. 이름은 결과 화면에만 보이고 저장하거나 보내지 않으며, 결과 이미지와 공유 문구에도 들어가지 않아요. 고른 길도 저장하지 않아요.</p>
      <div class="life-start-btns"><button type="button" class="btn ghost" data-act="random">랜덤 탄생</button><button class="btn big" type="submit">태어나기</button></div>
      <p class="hint life-done" id="life-done" hidden></p>
    </form>
  </div>
</div>`;
  const types = Object.fromEntries(LIFE_KEYS.map((k) => [k, { name: fill(guides.lifeTypes[k].name), epitaph: fill(guides.lifeTypes[k].epitaph) }]));
  checkLife(); // 페이지를 쓰기 전에 검사
  toolPage(toolById.life, html, { scripts: ["pixel.js", "life-data.js", "life.js"], dataJson: { types, slugs: LIFE_SLUG, tti: TTI_KEYS.map((k) => ({ key: k, name: tti[k].name })) } });

  LIFE_KEYS.forEach((k) => {
    const d = guides.lifeTypes[k];
    const p = `/story/life/${LIFE_SLUG[k]}/`;
    const items = [["홈", "/"], ["이야기 게임", "/story/"], ["Life Game", "/story/life/"], [d.name, p]];
    const len = fill(d.text).trim().length;
    if (len < 300) warnings.push(`${p} 본문 ${len}자 (<300, noindex)`);
    const body = `${crumbHtml(items)}
<article class="result-page">
  <header class="page-head"><span class="eyebrow">Life Game · 인생 성향</span><h1>${t(d.name)}</h1><p class="lead">${t(d.summary)}</p><p class="fun-badge">재미로 보는 콘텐츠예요</p></header>
  <div class="result-card life-card" data-card-title="Life Game" data-card-main="${t(d.name)}" data-card-sub="${t(d.epitaph)}">
    <div class="rc-emoji">${ART.life}</div><div class="rc-main">${t(d.name)}</div><p>“${t(d.epitaph)}”</p>
  </div>
  ${shareBar({ title: `Life Game: ${fill(d.name)}`, text: fill(d.epitaph), path: p })}
  <p class="center"><a class="btn ghost" href="${u("/story/life/")}">나도 한 번 살아 보기</a></p>
  <section class="prose">${fill(d.text).split(/\n+/).map((x) => `<p>${esc(x)}</p>`).join("")}
  <h2>Life Game의 다섯 가지 인생 성향</h2><ul>${LIFE_KEYS.map((x) => `<li><a href="${u(`/story/life/${LIFE_SLUG[x]}/`)}">${t(guides.lifeTypes[x].name)}</a> — ${t(guides.lifeTypes[x].summary)}</li>`).join("")}</ul></section>
  ${recoHtml(["today", "reaction", "personality"])}
</article>`;
    write(p, layout({ title: `Life Game 엔딩: ${fill(d.name)}`, desc: `Life Game 결과 ${fill(d.name)}: ${fill(d.summary)}. “${fill(d.epitaph)}”`, path: p, body, ogType: "article", noindex: len < 300, jsonld: [crumbs(items)] }));
  });
}

// 옛 주소(/brain/…, 폐지된 반응 스타일 결과 페이지) → 새 주소로 이동 (색인 제외)
{
  const moved = [["/brain/", "/arcade/"], ["/brain/reaction/", "/arcade/reaction/"], ...REACTION_KEYS.flatMap((k) => [[`/brain/reaction/${REACTION_SLUG[k]}/`, "/arcade/reaction/"], [`/arcade/reaction/${REACTION_SLUG[k]}/`, "/arcade/reaction/"]])];
  moved.push(...FUN_MOVED); // P2-49 운세·재미 이동
  if (moved.some(([f]) => pageHtml.has(f))) throw new Error("P2-49 리디렉트가 실제 페이지를 덮어씀");
  for (const [from, to] of moved) {
    const file = path.join(DIST, from, "index.html");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // P2-49 쿼리·# 뒤(사주·사다리 공유 링크, 16유형 #r= 점수, 띠 앵커)를 그대로 붙여 이동. 스크립트가 꺼져 있으면 meta refresh로 주소만 이동
    fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><link rel="canonical" href="${abs(to)}"><script>location.replace(${JSON.stringify(u(to))}+location.search+location.hash)</script><meta http-equiv="refresh" content="0;url=${u(to)}"><a href="${u(to)}">이동했어요</a>`);
  }
}

// P2-50 투자 툴 안내 문구(시작·결과 화면·카테고리 페이지 공통)
const STOCK_WARN = "교육·재미용이에요. 투자 권유가 아니에요. SOXL·TQQQ·KORU는 하루 수익률의 3배를 따라가는 레버리지 ETF라 위험이 매우 크고, 오래 들고 있으면 기초 지수보다 손실이 커질 수 있어요.";
// ---------- 펭귄 툴즈 실용 툴 ----------
// 실용 툴 카테고리 페이지 (/pdf/ /image/ /text/ /calc/)
for (const [k, c] of Object.entries(UCATS)) {
  const list = utilsIn(k); // P2-49 운세·재미 포함
  const items = [["홈", "/"], [c.name, `/${k}/`]];
  const inv = k === "invest"; // P2-50 투자: 파일 안내 대신 교육·재미용·투자 권유 아님 안내
  const fun = k === "fun"; // P2-49 운세·재미: 파일 안내 대신 입력값 안내 + 띠·별자리·16유형·띠별 운세 바로가기
  const body = `${crumbHtml(items)}
<header class="page-head"><span class="eyebrow">펭귄 공구함</span><h1>${esc(c.name)} 툴</h1><p class="lead">${esc(c.desc)} ${esc(fun ? "입력한 생년월일과 이름은 브라우저 안에서만 계산하고 저장하지 않아요." : inv ? "넣은 숫자와 고른 답은 브라우저 안에서만 계산하고 저장하지 않아요." /* P2-51 계산기 추가로 문구 일반화 */ : SAFE)}</p>${fun ? '<p class="fun-badge">운세와 테스트는 재미로 보는 콘텐츠예요</p>' : ""}${inv ? `<p class="sq-warn">${esc(STOCK_WARN)}</p>` : ""}</header>
<div class="drawers drawers-1 open">${drawerHtml({ tone: k, name: `${c.name} 서랍`, tools: utilsIn(k) })}</div>
${fun ? FUN_EXTRA() : ""}
<section class="reco"><h2>다른 서랍</h2><div class="drawers drawers-mini">${Object.entries(UCATS).filter(([kk]) => kk !== k).map(([kk, cc]) => drawerHtml({ tone: kk, name: cc.name, href: `/${kk}/`, tools: utilsIn(kk), tag: "h3" })).join("")}</div></section>`;
  write(`/${k}/`, layout({ title: c.seo || `${c.name} 툴 — 무료` /* P2-49 seo */, desc: `${c.name} 툴 모음: ${list.map((x) => x.title).join(", ")}. ${c.desc}`, path: `/${k}/`, body, jsonld: [crumbs(items)] }));
}

// 파일 넣는 칸(공통). input이 칸 전체를 덮어서 누르거나 끌어다 놓으면 파일이 들어감
const dropHtml = ({ accept, multiple = false, label, limit }) => `
<div class="drop">
  <input type="file" accept="${accept}"${multiple ? " multiple" : ""} aria-label="${esc(label)} — 파일 선택" aria-describedby="drop-limit">
  <span class="drop-art" aria-hidden="true">${sv(`<path d="M60 84V34M40 52l20-20 20 20" fill="none" stroke="${K}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 80v16a6 6 0 0 0 6 6h64a6 6 0 0 0 6-6V80" fill="none" stroke="${K}" stroke-width="8" stroke-linecap="round"/>`)}</span>
  <strong>${esc(label)}</strong>
  <span class="drop-or">여기로 끌어다 놓거나 <span class="btn ghost drop-btn">파일 선택</span></span>
  <small id="drop-limit">${esc(limit)}</small>
</div>
<p class="safe">${esc(SAFE)}</p>`;
const tkTail = (runLabel, { disabled = true } = {}) => `
<div class="tk-msg" role="alert" hidden></div>
${runLabel ? `<button class="btn big tk-run" type="button" data-run${disabled ? " disabled" : ""}>${esc(runLabel)}</button>` : ""}
<div class="tk-progress" role="status" hidden><span class="spin" aria-hidden="true"></span><span class="tk-progress-text">처리 중…</span><span class="tk-bar" aria-hidden="true"><i></i></span></div>
<div class="tk-result" hidden><div class="tk-result-body" aria-live="polite"></div></div>`;
// 툴 페이지에 항상 보이는 「잠깐 쉬어 가기」 게임 카드: 체류시간 긴 게임으로 안내(대표님 지시)
const REST_GAMES = ["rpg", "hellchosun", "hell", "life"];
const restCard = (id) => {
  const g = toolById[REST_GAMES[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % REST_GAMES.length]];
  const lg = LONG_GAMES.find((x) => x.id === g.id);
  return `<a class="rest-card t-${g.cat}" href="${u(g.path)}"><span class="fun-art">${ART[g.id]}</span><span class="ff-body"><em>잠깐 쉬어 가기${lg ? ` · ${esc(lg.t)}` : ""}</em><b>${esc(g.title)}</b><span>${esc(g.hook)}</span></span><span class="ff-go">한 판 ›</span></a>`;
};
const nextHtml = (id, hidden) => `<nav class="tk-next" aria-label="다음 툴"${hidden ? " hidden" : ""}><b>다음으로 많이 쓰는 툴</b>${NEXT[id].map((x) => `<a class="chip" href="${u(anyById[x].path)}">${esc(anyById[x].title)}</a>`).join("")}</nav>${restCard(id)}`; // 쉬어 가기 카드는 결과 전에도 항상 보임(대표님 지시)

// 실용 툴 페이지 공통 본문: 제목 → [툴 상자: 넣기 → 처리 → 내려받기 → 다음 툴] → 광고(높이 확보) → 사용법·예시·한계 → FAQ → 추천
// fileTool: 파일 툴이면 결과가 나온 뒤에 「다음 툴」을 보이고, 입력형 툴(글자수·D-day)은 처음부터 보임
function utilPage(tool, toolHtml, { scripts = [], vendor = [], after = "", fileTool = true } = {}) {
  const g = toolText[tool.id];
  if (!g) throw new Error(`tools.${tool.id} 원고 없음`);
  const len = [...g.howto, g.example, g.limits, ...g.faq.map((f) => f.a)].reduce((n, x) => n + fill(x).trim().length, 0);
  if (len < 300) warnings.push(`${tool.path} 툴 원고 ${len}자 (<300, noindex)`);
  const items = [["홈", "/"], [UCATS[tool.cat].name, `/${tool.cat}/`], [tool.title, tool.path]];
  const body = `
${crumbHtml(items)}
<article class="tool util">
  <header class="page-head">
    <span class="eyebrow">${esc(UCATS[tool.cat].name)}</span>${tool.beta ? ' <span class="eyebrow beta-tag">베타</span>' : ""}
    <h1>${esc(tool.h1)} ${favBtn(tool, "fav-title")}</h1>
    <p class="lead">${esc(tool.desc)}</p>
  </header>
  <section class="tool-box tk" id="tool" data-tool="${tool.id}">
    ${toolHtml}
    ${nextHtml(tool.id, fileTool)}
  </section>
  ${after}
  ${adSlotFixed("below-tool")}
  <section class="prose">
    <p>${t(g.intro)}</p>
    <h2>사용법</h2>
    <ol>${g.howto.map((x) => `<li>${t(x)}</li>`).join("")}</ol>
    <h2>예시</h2>
    <p>${t(g.example)}</p>
    <h2>알아 두세요 (한계)</h2>
    <p>${t(g.limits)}</p>
  </section>
  ${faqHtml(g.faq)}
  ${recoRows(NEXT[tool.id].filter((x) => utilById[x]).concat(UTIL_RANK.filter((x) => x !== tool.id && !NEXT[tool.id].includes(x))).slice(0, 4), "다른 툴도 써 보세요")}
</article>`;
  write(tool.path, layout({ title: tool.seo, desc: tool.desc, path: tool.path, body, csp: true, vendor, scripts: ["tool-kit.js", ...scripts], noindex: len < 300 || g.noindex === true, jsonld: [faqLd(g.faq), crumbs(items), { "@context": "https://schema.org", "@type": "WebApplication", name: tool.title, url: abs(tool.path), applicationCategory: "UtilitiesApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" } }] }));
}

// PDF 합치기
utilPage(utilById.pdfmerge, `${dropHtml({ accept: ".pdf,application/pdf", multiple: true, label: "합칠 PDF 파일을 넣어 주세요", limit: "PDF · 파일당 50MB · 30개 · 합계 200MB까지" })}
<ul class="flist" hidden></ul>
<p class="hint tk-hint-two" hidden>PDF를 하나 더 넣어 주세요. 두 개 이상이어야 합칠 수 있어요.</p>
${tkTail("PDF 합치기")}`, { vendor: ["pdf-lib.min.js"], scripts: ["t-pdfmerge.js"] });

// PDF 나누기
utilPage(utilById.pdfsplit, `${dropHtml({ accept: ".pdf,application/pdf", label: "나눌 PDF 파일을 넣어 주세요", limit: "PDF 1개 · 100MB까지 · 한 쪽씩 나누기는 500쪽까지" })}
<div class="tk-opts" hidden>
  <p class="tk-info"></p>
  <fieldset class="seg"><legend>나누는 방식</legend>
    <label><input type="radio" name="mode" value="range" checked><span>페이지 범위 추출</span></label><label><input type="radio" name="mode" value="each"><span>한 쪽씩 나누기</span></label>
  </fieldset>
  <label class="range-row">뽑을 페이지<input name="range" inputmode="text" autocomplete="off" placeholder="예: 1-3, 5"></label>
</div>
${tkTail("범위 추출하기")}`, { vendor: ["pdf-lib.min.js", "fflate.min.js"], scripts: ["t-pdfsplit.js"] });

// JPG PDF 변환
utilPage(utilById.img2pdf, `${dropHtml({ accept: ".jpg,.jpeg,.png,image/jpeg,image/png", multiple: true, label: "PDF로 만들 이미지를 넣어 주세요", limit: "JPG·PNG · 장당 20MB · 50장 · 합계 200MB까지" })}
<ul class="flist thumbs" hidden></ul>
<div class="tk-opts" hidden>
  <fieldset class="seg"><legend>용지</legend>
    <label><input type="radio" name="paper" value="a4" checked><span>A4 (자동 방향)</span></label><label><input type="radio" name="paper" value="fit"><span>원본 크기</span></label>
  </fieldset>
  <label>A4 여백<select name="margin"><option value="0">없음</option><option value="24" selected>좁게</option><option value="48">보통</option></select></label>
</div>
${tkTail("PDF 만들기")}`, { vendor: ["pdf-lib.min.js"], scripts: ["t-img2pdf.js"] });

// 워드 PDF 변환(간단, 베타)
utilPage(utilById.word2pdf, `<p class="tk-warn" role="note"><b>베타 · 간단 변환</b> 표·머리글·각주·복잡한 서식은 깨질 수 있습니다. docx만 지원하며 .doc와 .hwp(한글)는 지원하지 않아요.</p>
${dropHtml({ accept: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "PDF로 바꿀 워드(docx) 파일을 넣어 주세요", limit: "docx 1개 · 20MB까지 (.doc·.hwp 미지원)" })}
${tkTail("")}`, { vendor: ["mammoth.browser.min.js"], scripts: ["t-word2pdf.js"], after: `<section class="w2p" id="w2p-preview" hidden aria-label="문서 미리보기"><p class="w2p-note">미리보기 · 표·머리글·각주·복잡한 서식은 깨질 수 있습니다</p><div class="w2p-paper"></div></section>` });

// 이미지 용량 줄이기
utilPage(utilById.imgcompress, `${dropHtml({ accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp", multiple: true, label: "용량을 줄일 이미지를 넣어 주세요", limit: "JPG·PNG·WEBP · 장당 30MB · 30장까지" })}
<ul class="flist thumbs" hidden></ul>
<div class="tk-opts" hidden>
  <label>품질 <output class="q-out">75</output><input type="range" name="quality" min="10" max="95" step="5" value="75"></label>
  <div class="row2">
    <label>최대 너비<select name="maxw"><option value="0">원본 그대로</option><option value="3840">3840px</option><option value="2560">2560px</option><option value="1920" selected>1920px</option><option value="1280">1280px</option><option value="1024">1024px</option><option value="800">800px</option></select></label>
    <label>저장 형식<select name="format"><option value="jpg" selected>JPG</option><option value="webp">WEBP</option></select></label>
  </div>
</div>
${tkTail("용량 줄이기")}`, { vendor: ["fflate.min.js"], scripts: ["t-imgcompress.js"] });

// 배경 지우기(누끼) — P2-26. 엔진(MediaPipe, Apache-2.0)은 사진을 넣을 때 작업자(t-removebg-worker.js)가 받음
utilPage(utilById.removebg, `${dropHtml({ accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp", label: "배경을 지울 사진을 넣어 주세요", limit: "JPG·PNG·WEBP 1장 · 30MB까지 · 긴 변 2048px에 맞춰 처리" })}
<p class="hint rb-first">처음 한 번은 배경 지우기 엔진(약 17MB)을 받아요. 페이지를 열 때가 아니라 사진을 넣을 때 받고, 다음부터는 브라우저에 저장된 파일을 써요.</p>
${tkTail("")}
<div class="rb" hidden>
  <p class="rb-hint" aria-live="polite"></p>
  <div class="rb-view" data-mode="pick"><canvas class="rb-before" aria-hidden="true"></canvas><canvas class="rb-after" role="img" aria-label="배경을 지운 결과"></canvas><span class="rb-line" aria-hidden="true"></span><span class="rb-tag rb-tag-b" aria-hidden="true">원본</span><span class="rb-tag rb-tag-a" aria-hidden="true">결과</span></div>
  <label class="rb-cmp-row">전후 비교<input type="range" class="rb-cmp" min="0" max="100" value="50" aria-label="전후 비교: 왼쪽은 원본, 오른쪽은 결과"></label>
  <fieldset class="seg rb-modes"><legend>사진을 누르면</legend>
    <label><input type="radio" name="rb-mode" value="pick" checked><span>대상 바꾸기</span></label><label><input type="radio" name="rb-mode" value="add"><span>대상 더하기</span></label><label><input type="radio" name="rb-mode" value="erase"><span>지우기 브러시</span></label><label><input type="radio" name="rb-mode" value="restore"><span>되살리기 브러시</span></label>
  </fieldset>
  <label class="rb-brush-row" hidden>브러시 크기 <output class="rb-brush-out">30</output><input type="range" name="rb-brush" min="6" max="90" step="2" value="30"></label>
  <label>가장자리 부드럽게 <output class="rb-soft-out">1</output><input type="range" name="rb-soft" min="0" max="8" step="1" value="1"></label>
  <fieldset class="seg rb-bgs"><legend>배경</legend>
    <label><input type="radio" name="rb-bg" value="none" checked><span>투명</span></label><label><input type="radio" name="rb-bg" value="#ffffff"><span>흰색</span></label><label><input type="radio" name="rb-bg" value="#000000"><span>검정</span></label><label class="rb-custom"><input type="radio" name="rb-bg" value="custom"><span>직접 고르기</span><input type="color" name="rb-color" value="#ffc21a" aria-label="배경색 고르기"></label>
  </fieldset>
  <div class="rb-actions"><button type="button" class="btn big" data-save>PNG 내려받기</button><button type="button" class="btn ghost" data-undo disabled>되돌리기</button><button type="button" class="btn ghost" data-again>처음 결과로</button><button type="button" class="btn ghost" data-new>다른 사진</button></div>
  <p class="rb-stat hint"></p>
</div>`, { scripts: ["t-removebg.js"] });

// P2-46 사진 이어붙이기(캡처 정리): 넣기(선택·끌어 놓기·붙여 넣기) → 순서(끌기) → 배치·자르기 → 미리보기 → 저장
utilPage(utilById.imgmerge, `${dropHtml({ accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp", multiple: true, label: "이어 붙일 사진을 넣어 주세요", limit: "JPG·PNG·WEBP · 장당 30MB · 30장까지 · Ctrl+V로 붙여 넣기" })}
${tkTail("")}
<div class="im" hidden>
  <ol class="im-thumbs" aria-label="사진 순서"></ol>
  <p class="hint im-drag-hint">사진을 끌어서 순서를 바꿔요. 휴대폰에서는 살짝 길게 누른 뒤 끌어요. ◀ ▶로도 옮길 수 있어요.</p>
  <div class="tk-opts im-opts">
    <fieldset class="seg"><legend>붙이는 방향</legend>
      <label><input type="radio" name="mode" value="v" checked><span>세로</span></label><label><input type="radio" name="mode" value="h"><span>가로</span></label><label><input type="radio" name="mode" value="g"><span>격자</span></label>
    </fieldset>
    <label class="im-cols" hidden>열 수<select name="cols"><option value="2" selected>2열</option><option value="3">3열</option><option value="4">4열</option><option value="5">5열</option></select></label>
    <div class="im-long-row"><label class="check"><input type="checkbox" name="long"> 긴 캡처 만들기 (연속 캡처의 겹치는 부분 빼기)</label><p class="hint im-long-note" aria-live="polite" hidden></p></div>
    <div class="im-trimrow"><label class="check"><input type="checkbox" name="trim"> 툴바 자동 자르기 (상태바·주소창·하단 바)</label>
      <div class="im-trim" hidden>
        <p class="hint im-trim-note" aria-live="polite"></p>
        <label>위에서 자르기 <output class="im-t-out">0px</output><input type="range" name="trimTop" min="0" max="900" step="1" value="0"></label>
        <label>아래에서 자르기 <output class="im-b-out">0px</output><input type="range" name="trimBot" min="0" max="900" step="1" value="0"></label>
        <button type="button" class="btn ghost im-auto" data-auto>자동으로 다시 찾기</button>
      </div>
    </div>
    <div class="im-gaps">
      <label>간격 <output class="im-gap-out">0px</output><input type="range" name="gap" min="0" max="60" step="2" value="0"></label>
      <div class="im-row"><label class="im-color">배경색<input type="color" name="bg" value="#ffffff"></label><label class="check"><input type="checkbox" name="border"> 얇은 검정 테두리</label></div>
    </div>
    <fieldset class="seg"><legend>저장 크기</legend>
      <label><input type="radio" name="size" value="orig" checked><span>원본</span></label><label><input type="radio" name="size" value="mid"><span>보통 (1080px)</span></label><label><input type="radio" name="size" value="small"><span>작게 (720px)</span></label>
    </fieldset>
    <fieldset class="seg"><legend>형식</legend>
      <label><input type="radio" name="fmt" value="jpg" checked><span>JPG</span></label><label><input type="radio" name="fmt" value="png"><span>PNG</span></label>
    </fieldset>
  </div>
  <div class="im-preview"><canvas class="im-canvas" role="img" aria-label="미리보기" width="1" height="1"></canvas></div>
  <p class="im-info hint" aria-live="polite"></p>
  <p class="tk-msg note im-note" hidden></p>
  <div class="im-actions"><button type="button" class="btn big" data-save>이미지 저장</button><button type="button" class="btn ghost" data-clear>모두 지우기</button></div>
</div>`, { scripts: ["t-imgmerge.js"] });

// P2-47 HEIC JPG 변환: 여러 장 넣기 → 화질·크기·사진 정보 고르기 → 한꺼번에 변환(진행률) → 하나씩 받기 + zip
// 엔진(libheif, LGPL-3.0)은 브라우저가 HEIC를 직접 못 열 때만 첫 변환 순간에 작업자(t-heic-worker.js)가 받음. zip은 fflate(MIT) 무압축
utilPage(utilById.heic, `${dropHtml({ accept: ".heic,.heif,.hif,.jpg,.jpeg,image/heic,image/heif,image/heic-sequence,image/heif-sequence,image/jpeg", multiple: true, label: "JPG로 바꿀 HEIC 사진을 넣어 주세요", limit: "HEIC·HEIF · 장당 50MB · 50장까지 · 여러 장을 한꺼번에" })}
<p class="hint hc-first">처음 한 번은 HEIC 변환 엔진(약 1.6MB)을 받아요. 페이지를 열 때가 아니라 변환을 시작할 때 받고, HEIC를 직접 여는 브라우저(아이폰·맥 사파리 등)에서는 받지 않아요.</p>
<ul class="flist" hidden></ul>
<div class="tk-opts hc-opts" hidden>
  <fieldset class="seg"><legend>화질</legend>
    <label><input type="radio" name="q" value="high" checked><span>높음</span></label><label><input type="radio" name="q" value="mid"><span>보통</span></label><label><input type="radio" name="q" value="low"><span>작게</span></label>
  </fieldset>
  <label>긴 변 크기 제한<select name="maxside"><option value="0" selected>원본 그대로</option><option value="4032">4032px</option><option value="3000">3000px</option><option value="2048">2048px</option><option value="1600">1600px</option><option value="1280">1280px</option></select></label>
  <div class="hc-meta"><label class="check"><input type="checkbox" name="nogps" checked> 위치 정보(GPS) 지우기</label><label class="check"><input type="checkbox" name="keepinfo"> 촬영 날짜·기기 정보 남기기</label><p class="hint hc-meta-hint" aria-live="polite"></p></div>
</div>
${tkTail("JPG로 바꾸기")}
<p class="hint hc-lic">HEIC 변환 엔진: libheif · libde265 (LGPL-3.0, 고치지 않은 공식 배포본) · <a href="${u("/licenses/")}#libheif">오픈소스 고지·소스 코드</a></p>`, { vendor: ["fflate.min.js"], scripts: ["t-heic.js"] });

// P2-48 QR코드 생성기: 종류 고르기 → 내용 넣기 → 바로 미리보기 → 꾸미기(색·여백·로고) → PNG·SVG 저장·이미지 복사 → (와이파이) A6 안내 카드 인쇄
// 부호화는 qrcode-generator(MIT)를 vendor에 그대로 둠. 입력값·로고는 브라우저 안에서만 씀
// P2-50 SOXL·TQQQ·KORU 주가 예측: 데이터(src/assets/data/stock-*.json, scripts/update-prices.mjs)를 빌드 때 읽어 범위·기준일만 표기. 문제의 날짜는 답한 뒤 t-stock.js가 공개
const STOCK = ["SOXL", "TQQQ", "KORU"].map((t) => {
  const f = path.join(ROOT, "src", "assets", "data", `stock-${t.toLowerCase()}.json`);
  if (!fs.existsSync(f)) throw new Error(`P2-50 ${f} 없음 — node scripts/update-prices.mjs`);
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  // P2-50c 정수 열 형식(v2): 종가 차분·시가/고가/저가 오프셋을 풀어 모두 양수인지, 고가 ≥ 시가·종가 ≥ 저가인지 확인
  if (j.v !== 2 || ["c", "o", "h", "l"].some((x) => j[x].length !== j.g.length + 1) || j.h.some((x) => x < 0) || j.l.some((x) => x < 0)) throw new Error(`P2-50 ${t} 데이터 형식 이상`);
  { let ci = 0; for (let i = 0; i < j.c.length; i++) { ci += j.c[i]; if (!(ci > 0) || !(ci + j.o[i] > 0) || !(Math.min(ci, ci + j.o[i]) - j.l[i] > 0)) throw new Error(`P2-50 ${t} ${i}번째 가격 이상`); } }
  return { t, n: j.c.length, d0: j.d0, asOf: j.asOf, src: j.src, basis: j.basis };
});
const STOCK_NAME = { SOXL: "반도체 3배", TQQQ: "나스닥100 3배", KORU: "한국 3배" };
// P2-50b 차트를 canvas → 사이트 스타일 SVG(.sq-svg)로 바꾸고, 결과 도장(.sq-stamp) 자리를 둠
// P2-50d .sq-chips는 차트 위 일반 줄(겹침 없음), 공개 결과 칩도 여기에
// P2-50f 시작 화면에 「±5% 이상 변동만 출제」 안내(.sq-rule)
// P2-50e 차트 아래 색 범례 한 줄(.sq-legend): 종가(파랑)·최고(빨강)·최저(초록)·기준가(검정)
// P2-50c 봉 종류·RSI 칩(.sq-chips)과 RSI(14) 패널(.sq-rsi) 자리 추가, 모드 「3개월 → 일주일(5거래일) 뒤」(w1) 추가
utilPage(utilById.stockquiz, `<div class="sq">
  <div class="sq-start">
    <p class="sq-warn" role="note">${esc(STOCK_WARN)}</p>
    <fieldset class="seg"><legend>종목</legend>${STOCK.map((x, i) => `<label><input type="radio" name="tk" value="${x.t}"${i ? "" : " checked"}><span>${x.t} <small>${STOCK_NAME[x.t]}</small></span></label>`).join("")}<label><input type="radio" name="tk" value="MIX"><span>섞어서</span></label></fieldset>
    <fieldset class="seg"><legend>보여 줄 차트 → 맞힐 때</legend><label><input type="radio" name="mode" value="m1" checked><span>1개월 → 다음 거래일</span></label><label><input type="radio" name="mode" value="m3"><span>3개월 → 다음 거래일</span></label><label><input type="radio" name="mode" value="w1"><span>3개월 → 일주일 뒤</span></label><label><input type="radio" name="mode" value="y1"><span>1년 → 한 달 뒤</span></label></fieldset>
    <fieldset class="seg"><legend>질문</legend><label><input type="radio" name="kind" value="ud" checked><span>오를까 내릴까</span></label><label><input type="radio" name="kind" value="th"><span>$○○ 이상일까</span></label></fieldset>
    <p class="hint sq-rule">정답이 뚜렷하도록 정답 시점 종가가 마지막 날 종가보다 <b>±5% 이상</b> 움직인 경우만 문제로 나와요. 오르는 문제와 내리는 문제가 고르게 섞여 나와요.</p>
    <button class="btn big" type="button" data-start>10문제 시작</button>
    <p class="tk-msg sq-msg" role="alert" hidden></p>
    <p class="hint sq-src">가격: ${esc(STOCK[0].src)} 일봉 ${esc(STOCK[0].basis)} · 기준일 ${esc(STOCK.map((x) => x.asOf).sort()[0])} · ${STOCK.map((x) => `${x.t} ${x.d0.slice(0, 4)}년 상장 이후 ${x.n.toLocaleString("ko-KR")}거래일`).join(", ")}. 문제의 실제 날짜는 답한 뒤에 공개해요.</p>
  </div>
  <div class="sq-play" hidden>
    <div class="sq-top"><span class="sq-no">1 / 10</span><b class="sq-tk">SOXL</b><span class="sq-score">맞힌 개수 0</span></div>
    <p class="sq-look hint"></p>
    <div class="sq-chart"><div class="sq-chips"></div><svg class="sq-svg" role="img" aria-label="종가 차트" xmlns="http://www.w3.org/2000/svg"></svg><div class="sq-legend" aria-hidden="true"></div><svg class="sq-rsi" role="img" aria-label="RSI(14)" xmlns="http://www.w3.org/2000/svg"></svg><div class="sq-stamp" aria-hidden="true" hidden></div></div>
    <p class="sq-q" aria-live="polite"></p>
    <div class="sq-ans"></div>
    <div class="sq-reveal" aria-live="polite" hidden></div>
    <div class="sq-nav"><button type="button" class="btn big" data-next hidden>다음 문제 ›</button><button type="button" class="btn ghost sq-quit" data-quit>그만하기</button></div>
  </div>
  <div class="sq-result" hidden>
    <div class="sq-res-head"></div>
    <p class="sq-warn" role="note">${esc(STOCK_WARN)}</p>
    <div class="sq-bt"></div>
    <div class="sq-tablewrap"><table class="sq-table"><caption>문제별 실제 날짜와 결과</caption><thead><tr><th>#</th><th>종목</th><th>실제 날짜</th><th>내 답</th><th>정답</th><th>사서 팔았다면</th><th>구간 보유</th></tr></thead><tbody></tbody></table></div>
    <div class="sq-again"><button type="button" class="btn big" data-again>같은 설정으로 10문제 더</button><button type="button" class="btn ghost" data-setup>설정 바꾸기</button><button type="button" class="btn ghost" data-copy>결과 복사</button></div>
  </div>
</div>`, { scripts: ["t-stock.js"], fileTool: false });

// P2-51 물타기 계산기(평단가 계산): 계산식은 src/assets/avg-calc.js 한 벌(화면 t-avg.js와 아래 예시 표가 같은 파일을 vm으로 씀)
// 흐름: 보유(평단·수량) + 추가 매수 여러 줄 → 새 평단·총 수량·총 투자금·평가손익 → 한 줄 복사 → 다음 툴 / 역계산 탭: 목표 평단·현재가 → 필요 수량·금액
// 예시 표의 값은 손계산 값과 빌드 때 대조하고, 다르면 빌드를 멈춤
{
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "src", "assets", "avg-calc.js"), "utf8"), ctx);
  const AC = ctx.AVGCALC;
  const nf = (n, a, b) => Math.abs(n).toLocaleString("ko-KR", { minimumFractionDigits: a, maximumFractionDigits: b });
  const sg = (n, plus) => (n < 0 ? "−" : plus && n > 0 ? "+" : "");
  const usdP = (n) => `$${nf(n, 2, 4)}`, usdM = (n, p) => `${sg(n, p)}$${nf(n, 2, 2)}`;
  const krwP = (n) => `${nf(n, 0, 2)}원`, krwM = (n, p) => `${sg(n, p)}${nf(Math.round(n), 0, 0)}원`;
  const pc = (r) => `${sg(r, true)}${nf(r * 100, 2, 2)}%`;
  const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const chk = (name, got, want) => { if (!near(got, want)) throw new Error(`P2-51 예시 「${name}」 계산 불일치: ${got} ≠ 손계산 ${want}`); };
  // 손계산 값(want)은 업무보고 P2-51 대조 표와 같음
  const f1 = AC.forward({ avg: 50, qty: 10, buys: [{ p: 30, q: 10 }], cur: 35 });
  chk("예시1 평단", f1.avg, 40); chk("예시1 손익", f1.pnl, -100); chk("예시1 수익률", f1.rate, -0.125);
  const f2 = AC.forward({ avg: 70000, qty: 30, buys: [{ p: 60000, q: 20 }, { p: 50000, q: 30 }], cur: 55000 });
  chk("예시2 평단", f2.avg, 60000); chk("예시2 투자금", f2.cost, 4800000); chk("예시2 손익", f2.pnl, -400000);
  const f3 = AC.forward({ avg: 60.25, qty: 2.5, buys: [{ p: 45.1, q: 1.2345 }], cur: 50 });
  chk("예시3 투자금", f3.cost, 206.30095); chk("예시3 평단", f3.avg, 206.30095 / 3.7345);
  const r1 = AC.reverse({ avg: 50, qty: 10, target: 40, cur: 30 });
  chk("역계산1 수량", r1.n, 10); chk("역계산1 금액", r1.amt, 300); chk("역계산1 평단", r1.avg, 40);
  const r2 = AC.reverse({ avg: 80000, qty: 15, target: 70000, cur: 62000 });
  chk("역계산2 계산값", r2.exact, 18.75); chk("역계산2 수량", r2.n, 19); chk("역계산2 금액", r2.amt, 1178000); chk("역계산2 평단", r2.avg, 2378000 / 34);
  const r2f = AC.reverse({ avg: 80000, qty: 15, target: 70000, cur: 62000, frac: true });
  chk("역계산2 소수 수량", r2f.n, 18.75); chk("역계산2 소수 평단", r2f.avg, 70000);
  const r3 = AC.reverse({ avg: 80000, qty: 15, target: 70000, cur: 72000 });
  if (r3.err !== "impossible") throw new Error("P2-51 예시 「역계산3 불가」 판정 불일치");
  const EXR = [
    ["달러 · 1번 물타기", "$50 × 10주 + $30 × 10주, 현재가 $35", `(500 + 300) ÷ 20 = <b>${usdP(f1.avg)}</b>`, `총 20주 · ${usdM(f1.cost)} · 현재가 기준 ${usdM(f1.pnl, true)} (${pc(f1.rate)})`],
    ["원화 · 2번 물타기", "70,000원 × 30주 + 60,000원 × 20주 + 50,000원 × 30주, 현재가 55,000원", `4,800,000 ÷ 80 = <b>${krwP(f2.avg)}</b>`, `총 80주 · ${krwM(f2.cost)} · 현재가 기준 ${krwM(f2.pnl, true)} (${pc(f2.rate)})`],
    ["달러 · 소수 주식", "$60.25 × 2.5주 + $45.10 × 1.2345주, 현재가 $50", `206.30095 ÷ 3.7345 = <b>${usdP(f3.avg)}</b>`, `총 3.7345주 · ${usdM(f3.cost)} · 현재가 기준 ${usdM(f3.pnl, true)} (${pc(f3.rate)})`],
    ["역계산 · 달러", "평단 $50 × 10주 → 목표 평단 $40, 현재가 $30", `10 × (50 − 40) ÷ (40 − 30) = <b>${nf(r1.n, 0, 4)}주</b>`, `필요 금액 ${usdM(r1.amt)} · 산 뒤 평단 ${usdP(r1.avg)}`],
    ["역계산 · 원화", "평단 80,000원 × 15주 → 목표 평단 70,000원, 현재가 62,000원", `15 × 10,000 ÷ 8,000 = 18.75주 → 정수로 올려 <b>${r2.n}주</b>`, `필요 금액 ${krwM(r2.amt)} · 산 뒤 평단 ${krwP(r2.avg)} (소수 주식이면 18.75주 · ${krwM(r2f.amt)} · 평단 ${krwP(r2f.avg)})`],
    ["역계산 · 불가능", "평단 80,000원 × 15주 → 목표 평단 70,000원, 현재가 72,000원", "<b>불가능</b>", "현재가가 목표 평단보다 높으면 아무리 사도 평단이 목표까지 내려가지 않아요"],
  ];
  const AVG_WARN = "계산 결과는 참고용이에요. 투자 권유나 매수 추천이 아니에요. 물타기는 손실을 없애는 방법이 아니라 같은 종목에 돈을 더 넣는 일이라, 주가가 더 내리면 손실 금액도 커져요. 레버리지 ETF는 특히 위험이 커요.";
  utilPage(utilById.avgdown, `<div class="avg">
<form class="dd-form pay-form avg-form" autocomplete="off" novalidate>
  <fieldset class="seg avg-mode"><legend>무엇을 계산할까요?</legend><label><input type="radio" name="mode" value="fwd" checked><span>물타기 평단 계산</span></label><label><input type="radio" name="mode" value="rev"><span>목표 평단 역계산</span></label></fieldset>
  <div class="avg-opts"><fieldset class="seg avg-unit"><legend>단위</legend><label><input type="radio" name="unit" value="krw" checked><span>원 (₩)</span></label><label><input type="radio" name="unit" value="usd"><span>달러 ($)</span></label></fieldset>
  <label class="check avg-frac"><input type="checkbox" name="frac"> 소수점 수량 허용 (소수 주식)</label></div>
  <div class="row2 avg-hold">
    <label><span>지금 평단 <i data-u></i></span><input name="avg" type="text" inputmode="decimal" autocomplete="off" data-ph="70,000|50.00"></label>
    <label><span>보유 수량</span><input name="qty" type="text" inputmode="numeric" autocomplete="off" data-qty></label>
  </div>
  <div data-pane="fwd">
    <p class="avg-sub"><b>추가 매수</b> <small class="hint">가격과 수량을 줄마다 넣으세요</small></p>
    <ol class="avg-rows"></ol>
    <button type="button" class="btn ghost avg-add" data-add>+ 매수 줄 추가</button>
  </div>
  <div class="row2" data-pane="rev" hidden>
    <label><span>목표 평단 <i data-u></i></span><input name="target" type="text" inputmode="decimal" autocomplete="off" data-ph="65,000|40.00"></label>
    <label><span>현재가 (살 가격) <i data-u></i></span><input name="rcur" type="text" inputmode="decimal" autocomplete="off" data-ph="55,000|30.00"></label>
  </div>
  <label class="avg-cur-label"><span>현재가 <i data-u></i> <small class="hint">(선택) 넣으면 평가손익·수익률까지</small></span><input name="cur" type="text" inputmode="decimal" autocomplete="off" data-ph="55,000|35.00"></label>
  <div class="dd-opts pay-acts"><button type="submit" class="btn">계산하기</button><button type="button" class="btn ghost" data-copy>결과 한 줄 복사</button><button type="button" class="chip" data-example>예시 넣기</button><button type="button" class="chip" data-reset>모두 지우기</button></div>
</form>
<div class="dd-result pay-result avg-result" aria-live="polite"></div>
<div class="avg-chart" hidden><svg class="avg-svg" role="img" aria-label="가격 비교" xmlns="http://www.w3.org/2000/svg"></svg></div>
<p class="sq-warn" role="note">${esc(AVG_WARN)}</p>
</div>`, {
    scripts: ["avg-calc.js", "t-avg.js"], fileTool: false,
    after: `<h2 class="dd-h">평단가 계산 예시 (손계산과 대조)</h2>
<div class="table-wrap"><table class="dd-table avg-ex"><thead><tr><th scope="col">경우</th><th scope="col">입력</th><th scope="col">계산</th><th scope="col">결과</th></tr></thead><tbody>${EXR.map((r) => `<tr><th scope="row">${r[0]}</th><td>${esc(r[1])}</td><td>${r[2]}</td><td>${esc(r[3])}</td></tr>`).join("")}</tbody></table></div>
<p class="hint">새 평단 = (지금 평단 × 보유 수량 + Σ 추가 매수 가격 × 수량) ÷ 총 수량. 필요 수량 = 보유 수량 × (지금 평단 − 목표 평단) ÷ (목표 평단 − 현재가). 수수료·세금·환율은 넣지 않았어요.</p>`
  });
}

// P2-52 SOXL·TQQQ·KORU 적립식 백테스트: 계산식은 src/assets/dca-calc.js 한 벌(화면 t-dca.js와 아래 대조가 같은 파일을 vm으로 씀). 가격은 P2-50 데이터(STOCK)
// 흐름: 종목(하나·3개 비교)·시작/끝 연월·매달 투자금(원은 고정 환율 1개) → 평가액·투자금·수익률·연환산(XIRR)·MDD → 자산 곡선 vs 누적 투자금 → 거치식 비교 → 연도별 표 → 한 줄 복사
// 빌드 때 ① 손계산 2건 ② 실제 데이터 5건을 파이썬 독립 계산(scripts/dca-verify.py) 값과 대조하고, 다르면 빌드를 멈춤.
// 실제 데이터 구간은 모두 기준일보다 앞이라 데이터를 갱신해도 값이 그대로(분할이 새로 생겨도 비율·금액은 그대로)
{
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "src", "assets", "dca-calc.js"), "utf8"), ctx);
  const DC = ctx.DCACALC;
  const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const chk = (name, got, want) => { if (!(got === want || near(got, want))) throw new Error(`P2-52 「${name}」 계산 불일치: ${got} ≠ ${want}`); };
  const mk = (rows) => ({ d: rows.map((r) => r[0]), c: rows.map((r) => r[1]), dn: rows.map((r) => Date.parse(r[0] + "T00:00:00Z") / 864e5) });
  // 손계산 1: 1~3월 매달 $100, 첫 거래일 종가 $10·$5·$10 → 10 + 20 + 10 = 40주, 마지막 날 $12 → $480(+60%). 평가액 100→80(−20%), 150→120(−20%) → MDD −20%, 가장 나빴을 때 120÷200 = −40%. 거치식 $300÷$10 = 30주 → $360(+20%), 바닥 $120 → MDD −60%
  const h1 = DC.run(mk([["2020-01-02", 10], ["2020-01-15", 8], ["2020-02-03", 5], ["2020-02-20", 4], ["2020-03-02", 10], ["2020-03-31", 12]]), { start: "2020-01", end: "2020-03", amt: 100 });
  chk("손계산1 매수 횟수", h1.n, 3); chk("손계산1 주식 수", h1.shares, 40); chk("손계산1 평가액", h1.value, 480); chk("손계산1 수익률", h1.rate, 0.6); chk("손계산1 MDD", h1.mdd, -0.2); chk("손계산1 최저", h1.low, -0.4);
  chk("손계산1 거치식 평가액", h1.lump.value, 360); chk("손계산1 거치식 MDD", h1.lump.mdd, -0.6);
  if (h1.irr !== null) throw new Error("P2-52 손계산1: 1년 미만인데 연환산 값이 나옴");
  // 손계산 2: 2021-01-04 $10, 2023-01-04 $14.4(730일)에 $100씩 → (10 + 6.9444주) × 14.4 = $244(+22%). 현금흐름 −100(0일), −100(730일), +244(730일) → (1+r)² = 1.44 → 연환산 20%. 거치식 $200 → $288, CAGR 1.44^(1/2) − 1 = 20%
  const h2 = DC.run(mk([["2021-01-04", 10], ["2023-01-04", 14.4]]), { start: "2021-01", end: "2023-01", amt: 100 });
  chk("손계산2 평가액", h2.value, 244); chk("손계산2 수익률", h2.rate, 0.22); chk("손계산2 연환산", h2.irr, 0.2); chk("손계산2 거치식", h2.lump.value, 288); chk("손계산2 CAGR", h2.lump.cagr, 0.2);
  // 실제 데이터: 파이썬 독립 계산 값(scripts/dca-verify.py 출력, 2026-11-10)
  const PY = [
    ["TQQQ", "2016-01", "2020-12", 100, { first: "2016-01-04", last: "2020-12-31", n: 60, inv: 6000, value: 29101.445504751246, rate: 3.8502409174585406, irr: 0.6771386748772813, mdd: -0.6969203542179192, low: -0.28062244186625507, lval: 61023.093447905485, lrate: 9.170515574650913, cagr: 0.5910712326945822, lmdd: -0.6992241233271218 }],
    ["SOXL", "2020-01", "2024-12", 500, { first: "2020-01-02", last: "2024-12-31", n: 60, inv: 30000, value: 39885.80387646176, rate: 0.3295267958820587, irr: 0.11330404706105085, mdd: -0.8675807313949816, low: -0.7480896810035591, lval: 42093.094944512944, lrate: 0.4031031648170982, cagr: 0.0700841240607275, lmdd: -0.905055487053021 }],
    ["KORU", "2013-04", "2025-12", 100, { first: "2013-04-10", last: "2025-12-31", n: 153, inv: 15300, value: 18223.323126480198, rate: 0.19106687101177755, irr: 0.026853021580189006, mdd: -0.9009503138975044, low: -0.8547706735315592, lval: 6516.493902439025, lrate: -0.5740853658536584, cagr: -0.06482843274210237, lmdd: -0.9614413177762525 }],
    ["SOXL", "2015-01", "2025-12", 100, { first: "2015-01-02", last: "2025-12-31", n: 132, inv: 13200, value: 84437.08083416882, rate: 5.396748548043092, irr: 0.31241374485396883, mdd: -0.9024623688810212, low: -0.48501727655615834, lval: 246883.23246707013, lrate: 17.70327518689925, cagr: 0.3049686739761972, lmdd: -0.905055487053021 }],
    ["KORU", "2015-01", "2025-12", 100, { first: "2015-01-02", last: "2025-12-31", n: 132, inv: 13200, value: 17376.139981472883, rate: 0.3163742410206729, irr: 0.04868144620328642, mdd: -0.8873722471166522, low: -0.8405697874023583, lval: 7433.339534883721, lrate: -0.4368682170542636, cagr: -0.05085223204063816, lmdd: -0.9614413177762525 }],
  ];
  const DD = {};
  const dec = (t) => (DD[t] = DD[t] || DC.decode(JSON.parse(fs.readFileSync(path.join(ROOT, "src", "assets", "data", `stock-${t.toLowerCase()}.json`), "utf8"))));
  const REAL = PY.map(([t, s, e, amt, w]) => {
    const r = DC.run(dec(t), { start: s, end: e, amt }), k = `${t} ${s}~${e}`;
    chk(`${k} 첫 매수일`, r.first, w.first); chk(`${k} 마지막 날`, r.last, w.last); chk(`${k} 매수 횟수`, r.n, w.n); chk(`${k} 투자금`, r.inv, w.inv);
    chk(`${k} 평가액`, r.value, w.value); chk(`${k} 수익률`, r.rate, w.rate); chk(`${k} 연환산`, r.irr, w.irr); chk(`${k} MDD`, r.mdd, w.mdd); chk(`${k} 최저`, r.low, w.low);
    chk(`${k} 거치식 평가액`, r.lump.value, w.lval); chk(`${k} 거치식 수익률`, r.lump.rate, w.lrate); chk(`${k} 거치식 CAGR`, r.lump.cagr, w.cagr); chk(`${k} 거치식 MDD`, r.lump.mdd, w.lmdd);
    return { t, s, e, amt, r };
  });
  const nf = (n, a, b) => Math.abs(n).toLocaleString("ko-KR", { minimumFractionDigits: a, maximumFractionDigits: b });
  const sg = (n) => (n < 0 ? "−" : n > 0 ? "+" : "");
  const usdM = (n) => `$${nf(n, 2, 2)}`, pc = (r) => `${sg(r)}${nf(r * 100, 2, 2)}%`;
  const ymK = (m) => `${m.slice(0, 4)}.${m.slice(5)}`;
  const EXR = [
    ["손계산 1", "1~3월 매달 $100, 첫 거래일 종가 $10 · $5 · $10, 마지막 날 $12", "10 + 20 + 10 = 40주 × $12", `<b>${usdM(h1.value)}</b> (${pc(h1.rate)}) · MDD ${pc(h1.mdd)} · 거치식 ${usdM(h1.lump.value)} (${pc(h1.lump.rate)})`],
    ["손계산 2", "2021.01.04 $10, 730일 뒤 $14.4에 $100씩", "(10 + 6.9444주) × $14.4, (1 + r)² = 1.44", `<b>${usdM(h2.value)}</b> (${pc(h2.rate)}) · 연환산 ${pc(h2.irr)} · 거치식 CAGR ${pc(h2.lump.cagr)}`],
    ...REAL.filter((x, i) => i < 3).map(({ t, s, e, amt, r }) => [`${t} 실제 가격`, `${ymK(s)} ~ ${ymK(e)} 매달 $${amt}`, `${r.n}번 · 투자금 ${usdM(r.inv)}`, `<b>${usdM(r.value)}</b> (${pc(r.rate)}) · 연환산 ${pc(r.irr)} · MDD ${pc(r.mdd)} · 거치식 ${usdM(r.lump.value)} (${pc(r.lump.rate)})`]),
  ];
  const DCA_WARN = "과거 가격으로 계산한 참고용이에요. 투자 권유가 아니에요. SOXL·TQQQ·KORU는 하루 수익률의 3배를 따라가는 레버리지 ETF라 위험이 매우 크고, 평가액이 고점에서 80~90% 넘게 줄었던 때도 있어요. 과거에 올랐다고 앞으로도 오른다는 뜻이 아니에요.";
  const META = { asOf: STOCK.map((x) => x.asOf).sort()[0], list: Object.fromEntries(STOCK.map((x) => [x.t, x.d0.slice(0, 7)])) };
  utilPage(utilById.dca, `<div class="dca" data-meta="${esc(JSON.stringify(META))}">
<form class="dd-form pay-form dca-form" autocomplete="off" novalidate>
  <fieldset class="seg dca-tk"><legend>종목</legend>${STOCK.map((x) => `<label><input type="radio" name="tk" value="${x.t}"><span>${x.t} <small>${STOCK_NAME[x.t]}</small></span></label>`).join("")}<label><input type="radio" name="tk" value="ALL"><span>3개 비교</span></label></fieldset>
  <div class="dca-period">
    <div class="dca-ym"><span class="dca-lab">시작</span><select name="sy" aria-label="시작 연도"></select><select name="sm" aria-label="시작 월"></select></div>
    <div class="dca-ym"><span class="dca-lab">끝</span><select name="ey" aria-label="끝 연도"></select><select name="em" aria-label="끝 월"></select></div>
  </div>
  <div class="dca-quick" role="group" aria-label="기간 빠르게 고르기"><button type="button" class="chip" data-range="1">최근 1년</button><button type="button" class="chip" data-range="3">3년</button><button type="button" class="chip" data-range="5">5년</button><button type="button" class="chip" data-range="10">10년</button><button type="button" class="chip" data-range="list">상장 이후</button></div>
  <fieldset class="seg dca-unit"><legend>매달 투자금 단위</legend><label><input type="radio" name="unit" value="krw" checked><span>원 (₩)</span></label><label><input type="radio" name="unit" value="usd"><span>달러 ($)</span></label></fieldset>
  <div class="row2 dca-money">
    <label><span>매달 투자금 <i data-u></i></span><input name="amt" type="text" inputmode="decimal" autocomplete="off"></label>
    <label data-krw><span>환율 <small class="hint">1달러 = 원, 고정</small></span><input name="fx" type="text" inputmode="decimal" autocomplete="off"></label>
  </div>
  <p class="hint dca-fxnote" data-krw>원으로 넣으면 이 환율 하나로 달러로 바꿔 사고, 결과도 같은 환율로 원으로 보여 줘요(환율 변동 미반영). 기본값 1,400원은 예시예요.</p>
  <label class="check"><input type="checkbox" name="lumpline"> 차트에 거치식(처음에 한 번에)도 그리기</label>
  <div class="dd-opts pay-acts"><button type="submit" class="btn">계산하기</button><button type="button" class="btn ghost" data-copy>결과 한 줄 복사</button><button type="button" class="chip" data-reset>처음 값으로</button></div>
</form>
<div class="dd-result pay-result dca-result" aria-live="polite"></div>
<div class="dca-chart" hidden><div class="sq-chips dca-chips"></div><svg class="dca-svg" role="img" aria-label="적립식 자산 곡선" xmlns="http://www.w3.org/2000/svg"></svg><div class="sq-legend dca-legend" aria-hidden="true"></div></div>
<p class="hint sq-src">가격: ${esc(STOCK[0].src)} 일봉 종가(${esc(STOCK[0].basis)}) · 기준일 ${esc(META.asOf)} · 매수일 = 매달 첫 거래일 종가 · ${STOCK.map((x) => `${x.t} ${x.d0.slice(0, 4)}년 ${+x.d0.slice(5, 7)}월 상장`).join(", ")}. 수수료·세금·배당·환율 변동은 반영하지 않았어요.</p>
<p class="sq-warn" role="note">${esc(DCA_WARN)}</p>
</div>`, {
    scripts: ["dca-calc.js", "t-dca.js"], fileTool: false,
    after: `<h2 class="dd-h">계산 검증 (손계산·독립 계산과 대조)</h2>
<div class="table-wrap"><table class="dd-table avg-ex dca-ex"><thead><tr><th scope="col">경우</th><th scope="col">입력</th><th scope="col">계산</th><th scope="col">결과</th></tr></thead><tbody>${EXR.map((r) => `<tr><th scope="row">${r[0]}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${r[3]}</td></tr>`).join("")}</tbody></table></div>
<p class="hint">손계산 2건과, 실제 가격 구간 5건을 이 계산기와 따로 만든 계산(파이썬)으로 다시 계산한 값이 같은지 사이트를 만들 때마다 자동으로 확인해요(표에는 3건). 실제 가격 구간 표는 달러 기준이에요.</p>`
  });
}

// P2-54 RSI 매매 백테스트(SOXL·TQQQ·KORU): 계산식은 src/assets/rsi-bt-calc.js 한 벌(화면 t-rsibt.js와 아래 대조가 같은 파일을 vm으로 씀). 가격은 P2-50 데이터(STOCK)
// 흐름: 종목·일봉/주봉·기간·RSI 기간·매수/매도 기준·손절·수수료·초기 자금 → 매매 횟수·승률·누적 수익률·그냥 보유·MDD·평균 보유 → 가격 차트(매수▲·매도▼) + RSI 패널 → 자산 곡선(전략 vs 보유) → 거래 목록 → 한 줄 복사
// 빌드 때 ① 손계산 2건 ② 실제 데이터 6건을 파이썬 독립 계산(scripts/rsi-bt-verify.py) 값과 대조 ③ 미래 정보 미사용(뒤 가격을 잘라 내도 앞 결과가 같은지) 확인, 다르면 빌드를 멈춤
// 실제 데이터 구간은 모두 기준일보다 앞이라 데이터를 갱신해도 값이 그대로
{
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "src", "assets", "rsi-bt-calc.js"), "utf8"), ctx);
  const RB = ctx.RSIBT;
  const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const chk = (name, got, want) => { if (!(got === want || (typeof got === "number" && typeof want === "number" && near(got, want)))) throw new Error(`P2-54 「${name}」 계산 불일치: ${got} ≠ ${want}`); };
  const mk = (cs) => ({ d: cs.map((_, i) => `2020-01-${String(i + 1).padStart(2, "0")}`), dn: cs.map((_, i) => 18262 + i), c: cs, o: cs, h: cs, l: cs });
  // 손계산 1: RSI(2), 종가 10·9·8·10·12·8·6·7(1월 1~8일), 매수 ≤ 30·매도 ≥ 70, $10,000
  // 3일: 변화 −1·−1 → 평균 상승 0·하락 1 → RSI 0 → $8 매수(1,250주). 4일: +2 → 상승 (0+2)/2 = 1, 하락 (1+0)/2 = 0.5 → RSI 66.67(보유)
  // 5일: +2 → 1.5·0.25 → RS 6 → RSI 85.71 → $12 매도 = $15,000(+50%, 2일). 6일: −4 → 0.75·2.125 → RSI 26.09 → $8 매수(1,875주)
  // 7일 $6(RSI 15.38), 8일 $7(RSI 40) → 미청산, 1,875 × $7 = $13,125(+31.25%). 최고 $15,000 → 7일 $11,250 → MDD −25%. 그냥 보유 1,000주 × $7 = $7,000(−30%), $12 → $6 MDD −50%
  const h1 = RB.run(mk([10, 9, 8, 10, 12, 8, 6, 7]), { start: "2020-01", end: "2020-01", n: 2 });
  chk("손계산1 거래 수", h1.trades.length, 2); chk("손계산1 첫 매수일", h1.trades[0].ed, "2020-01-03"); chk("손계산1 첫 매도일", h1.trades[0].xd, "2020-01-05"); chk("손계산1 첫 거래 수익률", h1.trades[0].ret, 0.5);
  chk("손계산1 미청산", h1.trades[1].why, "open"); chk("손계산1 둘째 매수 RSI", h1.trades[1].rin, 100 - 100 / (1 + 0.75 / 2.125));
  chk("손계산1 최종 자산", h1.value, 13125); chk("손계산1 누적 수익률", h1.rate, 0.3125); chk("손계산1 보유", h1.hvalue, 7000); chk("손계산1 MDD", h1.mdd, -0.25); chk("손계산1 보유 MDD", h1.hmdd, -0.5);
  chk("손계산1 승률", h1.winRate, 1); chk("손계산1 평균 보유", h1.avgDays, 2);
  // 손계산 2: 같은 가격에 손절 20% → 7일 $6 ≤ $8 × 0.8 = $6.4 → 손절 매도 $15,000 × 0.75 = $11,250(−25%). 8일 RSI 40이라 다시 안 삼 → +12.5%, 승률 1/2
  const h2 = RB.run(mk([10, 9, 8, 10, 12, 8, 6, 7]), { start: "2020-01", end: "2020-01", n: 2, stop: 0.2 });
  chk("손계산2 손절", h2.trades[1].why, "stop"); chk("손계산2 손절일", h2.trades[1].xd, "2020-01-07"); chk("손계산2 최종 자산", h2.value, 11250); chk("손계산2 수익률", h2.rate, 0.125); chk("손계산2 승률", h2.winRate, 0.5);
  // 실제 데이터: 파이썬 독립 계산 값(scripts/rsi-bt-verify.py 출력, 2026-11-10). 기본: 일봉, RSI(14), 30/70, 손절 없음, 수수료 0, $10,000
  const PY = [
    ["TQQQ", "2015-01", "2024-12", {}, { first: "2015-01-02", last: "2024-12-31", bars: 2516, trades: 11, closed: 11, wins: 10, stops: 0, value: 75879.36439401661, rate: 6.587936439401661, hvalue: 196498.6342190216, hrate: 18.64986342190216, mdd: -0.7494573643410853, hmdd: -0.8175454442813594, avgDays: 115.72727272727273, firstBuy: "2015-08-21", lastRet: 0.7398358821335322 }],
    ["SOXL", "2012-01", "2025-12", { weekly: true }, { first: "2012-01-06", last: "2025-12-31", bars: 731, trades: 3, closed: 3, wins: 3, stops: 0, value: 643884.4619405764, rate: 63.38844619405765, hvalue: 891032.4358702565, hrate: 88.10324358702564, mdd: -0.4608156638953117, hmdd: -0.8989943156974202, avgDays: 263.6666666666667, firstBuy: "2015-08-21", lastRet: 3.3791523482245127 }],
    ["KORU", "2016-01", "2025-06", { stop: 0.15, fee: 0.001 }, { first: "2016-01-04", last: "2025-06-30", bars: 2386, trades: 25, closed: 25, wins: 8, stops: 17, value: 15226.024229712444, rate: 0.5226024229712445, hvalue: 3894.847637415622, hrate: -0.6105152362584378, mdd: -0.7564991399723906, hmdd: -0.9614413177762525, avgDays: 59.6, firstBuy: "2016-01-15", lastRet: 0.6899017887368755 }],
    ["SOXL", "2018-01", "2025-12", { buy: 25, sell: 75, n: 10 }, { first: "2018-01-02", last: "2025-12-31", bars: 2011, trades: 6, closed: 6, wins: 6, stops: 0, value: 124838.11533202055, rate: 11.483811533202054, hvalue: 42235.687799583975, hrate: 3.2235687799583976, mdd: -0.6096811639740602, hmdd: -0.905055487053021, avgDays: 104.83333333333333, firstBuy: "2018-06-27", lastRet: 0.6301489921121826 }],
    ["TQQQ", "2011-01", "2025-12", { weekly: true, buy: 35, sell: 65, stop: 0.2 }, { first: "2011-01-07", last: "2025-12-31", bars: 783, trades: 7, closed: 7, wins: 4, stops: 3, value: 128771.83203319788, rate: 11.877183203319788, hvalue: 1271587.0718765075, hrate: 126.15870718765075, mdd: -0.6189169925479618, hmdd: -0.8046742689398216, avgDays: 131, firstBuy: "2011-08-19", lastRet: 1.50620588951083 }],
    ["SOXL", "2021-06", "2022-12", {}, { first: "2021-06-01", last: "2022-12-30", bars: 401, trades: 1, closed: 0, wins: 0, stops: 0, value: 2659.515951595159, rate: -0.7340484048404841, hvalue: 2522.170057381325, hrate: -0.7477829942618675, mdd: -0.864170913367307, hmdd: -0.905055487053021, avgDays: null, firstBuy: "2022-01-27", lastRet: -0.7340484048404841 }],
  ];
  const DD = {};
  const dec = (t) => (DD[t] = DD[t] || RB.decode(JSON.parse(fs.readFileSync(path.join(ROOT, "src", "assets", "data", `stock-${t.toLowerCase()}.json`), "utf8"))));
  const REAL = PY.map(([t, s, e, o, w]) => {
    const r = RB.run(dec(t), { start: s, end: e, ...o }), k = `${t} ${s}~${e}${o.weekly ? " 주봉" : ""}`;
    if (r.err) throw new Error(`P2-54 ${k} 계산 실패`);
    chk(`${k} 첫 봉`, r.first, w.first); chk(`${k} 마지막 봉`, r.last, w.last); chk(`${k} 봉 수`, r.bars, w.bars); chk(`${k} 거래 수`, r.trades.length, w.trades); chk(`${k} 청산`, r.closed, w.closed);
    chk(`${k} 수익 거래`, r.wins, w.wins); chk(`${k} 손절`, r.trades.filter((x) => x.why === "stop").length, w.stops); chk(`${k} 최종 자산`, r.value, w.value); chk(`${k} 누적 수익률`, r.rate, w.rate);
    chk(`${k} 보유 자산`, r.hvalue, w.hvalue); chk(`${k} 보유 수익률`, r.hrate, w.hrate); chk(`${k} MDD`, r.mdd, w.mdd); chk(`${k} 보유 MDD`, r.hmdd, w.hmdd); chk(`${k} 평균 보유`, r.avgDays, w.avgDays);
    chk(`${k} 첫 매수일`, r.trades.length ? r.trades[0].ed : null, w.firstBuy); chk(`${k} 마지막 거래 수익률`, r.trades.length ? r.trades[r.trades.length - 1].ret : null, w.lastRet);
    return { t, s, e, o, r };
  });
  // 미래 정보 미사용: 가격 데이터를 중간 날짜에서 잘라 낸 뒤 같은 설정으로 다시 계산 → 자른 날 앞의 RSI·자산·보유 여부·매매가 모두 같아야 함(자른 주의 주봉은 덜 찬 주라 제외)
  const cut = (D, i) => Object.fromEntries(Object.entries(D).map(([k, v]) => [k, v.slice(0, i)]));
  for (const [t, s, e, o, at] of [["TQQQ", "2015-01", "2024-12", {}, "2020-03-16"], ["SOXL", "2012-01", "2025-12", { weekly: true }, "2022-10-12"], ["KORU", "2016-01", "2025-06", { stop: 0.15, fee: 0.001 }, "2020-03-19"]]) {
    const D = dec(t), ci = D.d.findIndex((d) => d >= at), full = RB.run(D, { start: s, end: e, ...o }), part = RB.run(cut(D, ci + 1), { start: s, end: e, ...o });
    const m = part.series.B.length - (o.weekly ? 1 : 0), k = `${t} ${at}에서 자름`;
    if (!(m > 100)) throw new Error(`P2-54 ${k}: 비교할 봉이 적음`);
    for (let j = 0; j < m; j++) {
      if (full.series.B[j].e !== part.series.B[j].e || full.series.rsi[j] !== part.series.rsi[j] || full.series.eq[j] !== part.series.eq[j] || full.series.pos[j] !== part.series.pos[j]) throw new Error(`P2-54 미래 정보 사용 의심: ${k}, ${j}번째 봉(${D.d[part.series.B[j].e]})이 뒤 가격에 따라 달라짐`);
    }
    const ft = full.trades.filter((x) => x.ek < m), pt = part.trades.filter((x) => x.ek < m);
    if (ft.length !== pt.length || ft.some((x, j) => x.ed !== pt[j].ed || x.pin !== pt[j].pin || (x.xk != null && x.xk < m && x.xd !== pt[j].xd))) throw new Error(`P2-54 미래 정보 사용 의심: ${k}, 거래 목록이 다름`);
  }
  const nf = (n, a, b) => Math.abs(n).toLocaleString("ko-KR", { minimumFractionDigits: a, maximumFractionDigits: b });
  const sg = (n) => (n < 0 ? "−" : n > 0 ? "+" : "");
  const usdM = (n) => `$${nf(n, 0, 0)}`, pc = (r) => `${sg(r)}${nf(r * 100, 1, 1)}%`;
  const ymK = (m) => `${m.slice(0, 4)}.${m.slice(5)}`;
  const optK = (o) => [o.weekly ? "주봉" : "일봉", `RSI(${o.n || 14}) ≤ ${o.buy ?? 30} 매수 · ≥ ${o.sell ?? 70} 매도`, o.stop ? `손절 ${o.stop * 100}%` : "", o.fee ? `수수료 ${o.fee * 100}%` : ""].filter(Boolean).join(" · ");
  const EXR = [
    ["손계산 1", "RSI(2), 종가 $10·9·8·10·12·8·6·7, 30/70, $10,000", "RSI 0에 $8 매수 → RSI 85.7에 $12 매도(+50%) → RSI 26.1에 $8 매수 → 미청산 $7", `<b>${usdM(h1.value)}</b> (${pc(h1.rate)}) · MDD ${pc(h1.mdd)} · 보유 ${usdM(h1.hvalue)} (${pc(h1.hrate)})`],
    ["손계산 2", "손계산 1 + 손절 20%", "$6 ≤ $8 × 0.8 → 손절(−25%)", `<b>${usdM(h2.value)}</b> (${pc(h2.rate)}) · 승률 ${nf(h2.winRate * 100, 0, 0)}%`],
    ...REAL.filter((x, i) => [0, 1, 2, 5].includes(i)).map(({ t, s, e, o, r }) => [`${t} 실제 가격`, `${ymK(s)} ~ ${ymK(e)} · ${optK(o)}`, `매매 ${r.trades.length}번${r.open ? "(미청산 1)" : ""} · 승률 ${r.winRate == null ? "–" : nf(r.winRate * 100, 0, 0) + "%"}`, `<b>${pc(r.rate)}</b> · MDD ${pc(r.mdd)} · 그냥 보유 ${pc(r.hrate)} (MDD ${pc(r.hmdd)})`]),
  ];
  const RSB_WARN = "과거 가격으로 계산한 참고용이에요. 투자 권유가 아니에요. 과거에 잘 맞은 RSI 기준이 앞으로도 맞는다는 보장은 없어요. SOXL·TQQQ·KORU는 하루 수익률의 3배를 따라가는 레버리지 ETF라 위험이 매우 크고, 과매도(RSI 30 이하)에서 사도 더 떨어져 70~90% 넘게 잃은 때가 있어요.";
  const META = { asOf: STOCK.map((x) => x.asOf).sort()[0], list: Object.fromEntries(STOCK.map((x) => [x.t, x.d0.slice(0, 7)])) };
  utilPage(utilById.rsibt, `<div class="rsb dca" data-meta="${esc(JSON.stringify(META))}">
<form class="dd-form pay-form dca-form rsb-form" autocomplete="off" novalidate>
  <fieldset class="seg dca-tk"><legend>종목</legend>${STOCK.map((x) => `<label><input type="radio" name="tk" value="${x.t}"><span>${x.t} <small>${STOCK_NAME[x.t]}</small></span></label>`).join("")}</fieldset>
  <fieldset class="seg rsb-tf"><legend>봉</legend><label><input type="radio" name="tf" value="d" checked><span>일봉 <small>하루 1개</small></span></label><label><input type="radio" name="tf" value="w"><span>주봉 <small>한 주 1개</small></span></label></fieldset>
  <div class="dca-period">
    <div class="dca-ym"><span class="dca-lab">시작</span><select name="sy" aria-label="시작 연도"></select><select name="sm" aria-label="시작 월"></select></div>
    <div class="dca-ym"><span class="dca-lab">끝</span><select name="ey" aria-label="끝 연도"></select><select name="em" aria-label="끝 월"></select></div>
  </div>
  <div class="dca-quick" role="group" aria-label="기간 빠르게 고르기"><button type="button" class="chip" data-range="1">최근 1년</button><button type="button" class="chip" data-range="3">3년</button><button type="button" class="chip" data-range="5">5년</button><button type="button" class="chip" data-range="10">10년</button><button type="button" class="chip" data-range="list">상장 이후</button></div>
  <div class="rsb-rule">
    <label><span>RSI 기간</span><input name="n" type="text" inputmode="numeric" autocomplete="off"></label>
    <label><span>매수 RSI ≤</span><input name="buy" type="text" inputmode="decimal" autocomplete="off"></label>
    <label><span>매도 RSI ≥</span><input name="sell" type="text" inputmode="decimal" autocomplete="off"></label>
  </div>
  <div class="dca-quick rsb-preset" role="group" aria-label="매수·매도 기준 빠르게 고르기"><button type="button" class="chip" data-rule="30,70">30 / 70 (기본)</button><button type="button" class="chip" data-rule="25,75">25 / 75</button><button type="button" class="chip" data-rule="20,80">20 / 80</button><button type="button" class="chip" data-rule="40,60">40 / 60</button></div>
  <div class="rsb-rule rsb-opt">
    <label><span>손절 % <small class="hint">비우면 끔</small></span><input name="stop" type="text" inputmode="decimal" autocomplete="off" placeholder="예: 15"></label>
    <label><span>수수료 % <small class="hint">거래마다</small></span><input name="fee" type="text" inputmode="decimal" autocomplete="off"></label>
    <label><span>초기 자금 ($)</span><input name="cap" type="text" inputmode="decimal" autocomplete="off"></label>
  </div>
  <p class="hint rsb-assume">가정: 신호는 그 봉 <b>종가로 계산한 RSI</b>, 체결도 <b>그 봉 종가</b>예요. 전액 매수·전량 매도, 보유 중 매수 신호는 무시해요. 손절은 종가가 매수가보다 그 % 이상 떨어진 봉의 종가에 팔아요.</p>
  <div class="dd-opts pay-acts"><button type="submit" class="btn">계산하기</button><button type="button" class="btn ghost" data-copy>결과 한 줄 복사</button><button type="button" class="chip" data-reset>처음 값으로</button></div>
</form>
<div class="dd-result pay-result dca-result rsb-result" aria-live="polite"></div>
<div class="dca-chart rsb-pchart" hidden><div class="sq-chips rsb-pchips"></div><svg class="rsb-psvg" role="img" aria-label="가격 차트와 매수·매도 표시" xmlns="http://www.w3.org/2000/svg"></svg><svg class="sq-rsi rsb-rsvg" role="img" aria-label="RSI" xmlns="http://www.w3.org/2000/svg"></svg><div class="sq-legend rsb-plegend" aria-hidden="true"></div></div>
<div class="dca-chart rsb-echart" hidden><div class="sq-chips dca-chips rsb-echips"></div><svg class="dca-svg rsb-esvg" role="img" aria-label="자산 곡선" xmlns="http://www.w3.org/2000/svg"></svg><div class="sq-legend dca-legend rsb-elegend" aria-hidden="true"></div></div>
<p class="hint sq-src">가격: ${esc(STOCK[0].src)} 일봉(${esc(STOCK[0].basis)}) · 기준일 ${esc(META.asOf)} · 주봉 = 월~금 한 주를 묶은 봉(종가 = 그 주 마지막 거래일 종가) · ${STOCK.map((x) => `${x.t} ${x.d0.slice(0, 4)}년 ${+x.d0.slice(5, 7)}월 상장`).join(", ")}. RSI는 상장일부터의 가격으로 계산해요. 세금·배당·환율은 반영하지 않았어요.</p>
<p class="sq-warn" role="note">${esc(RSB_WARN)}</p>
</div>`, {
    scripts: ["rsi-bt-calc.js", "t-rsibt.js"], fileTool: false,
    after: `<h2 class="dd-h">계산 검증 (손계산·독립 계산과 대조)</h2>
<div class="table-wrap"><table class="dd-table avg-ex dca-ex rsb-ex"><thead><tr><th scope="col">경우</th><th scope="col">설정</th><th scope="col">매매</th><th scope="col">누적 수익률</th></tr></thead><tbody>${EXR.map((r) => `<tr><th scope="row">${r[0]}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${r[3]}</td></tr>`).join("")}</tbody></table></div>
<p class="hint">손계산 2건과, 실제 가격 구간 6건을 이 계산기와 따로 만든 계산(파이썬)으로 다시 계산한 값이 같은지, 그리고 뒤 가격을 잘라 내도 앞 결과가 똑같은지(미래 가격을 쓰지 않는지) 사이트를 만들 때마다 자동으로 확인해요(표에는 실제 구간 4건). 초기 자금 $10,000 기준이에요.</p>`
  });
}

// P2-53 해외주식 양도소득세 계산기: 요율은 content/tax-overseas-2026.mjs(OST) 한 곳, 계산식은 src/assets/ostax-calc.js 한 벌(화면 t-ostax.js와 아래 대조가 같은 파일을 vm으로 씀)
// 흐름: 과세 연도 → 종목 줄(원 또는 달러 + 매수·매도 결제일 환율) → 수수료(선택) → 통산 → 기본공제 → 과세표준 × 20% → 지방소득세 10% → 한 줄 복사 → 다음 툴
// 빌드 때 ① 국세청 안내서 사례 2건 ② 증권사(삼성증권) 안내 사례 3건 ③ 손계산 2건과 대조하고, 다르면 빌드를 멈춤
{
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "src", "assets", "ostax-calc.js"), "utf8"), ctx);
  const OC = ctx.OSTAX;
  const Y = OST.defaultYear;
  if (!OST.years[Y]) throw new Error(`P2-53 요율 파일에 ${Y}년 값이 없음`);
  const chk = (name, got, want) => { if (Math.abs(got - want) > 1e-6) throw new Error(`P2-53 「${name}」 계산 불일치: ${got} ≠ ${want}`); };
  const K = (buy, sell, name = "") => ({ name, cur: "krw", buy, sell });
  const D = (buy, sell, bfx, sfx, name = "") => ({ name, cur: "usd", buy, sell, bfx, sfx });
  const run = (rows, o = {}) => OC.calc(OST, { year: Y, rows, ...o });
  // 국세청 「2025년 해외주식과 세금」 p.13 사례 2: 국외주식(일반법인) 양도소득금액 1억원, 기본공제는 국내 주식 예정신고에서 이미 받음 → 과세표준 1억원 × 20% = 2,000만원
  const n1 = run([K(100000000, 200000000)], { dedUsed: true });
  chk("국세청 사례2 과세표준", n1.base, 100000000); chk("국세청 사례2 산출세액", n1.tax, 20000000); chk("국세청 사례2 기본공제", n1.ded, 0);
  // 국세청 같은 쪽 사례 1: 국내 주식 1억1천만원 + 국외 주식 −6,700만원 통산 = 4,300만원 − 기본공제 250만원 = 과세표준 4,050만원(사례 세율은 국내 중소기업 주식 10%라 세율은 대조하지 않음)
  const n2 = run([K(200000000, 310000000, "국내"), K(100000000, 33000000, "국외")]);
  chk("국세청 사례1 통산", n2.net, 43000000); chk("국세청 사례1 기본공제", n2.ded, 2500000); chk("국세청 사례1 과세표준", n2.base, 40500000);
  // 삼성증권 안내 사례 1: 양도가액 7,000만원 − 취득가액 6,000만원 − 수수료 등 100만원 = 900만원 − 250만원 = 650만원 × 20% = 130만원, 지방소득세 13만원
  const s1 = run([K(60000000, 70000000)], { fee: { mode: "krw", krw: 1000000 } });
  chk("증권사 사례1 양도차익", s1.net, 9000000); chk("증권사 사례1 과세표준", s1.base, 6500000); chk("증권사 사례1 세액", s1.tax, 1300000); chk("증권사 사례1 지방소득세", s1.local, 130000);
  // 삼성증권 사례 2·3: 주가 100 → 120 × 1,000주, 환율 170 → 187(상승)이면 양도차익 544만원, 170 → 153(하락)이면 136만원
  const s2 = run([D(100000, 120000, 170, 187)]), s3 = run([D(100000, 120000, 170, 153)]);
  chk("증권사 사례2 환율 상승", s2.net, 5440000); chk("증권사 사례3 환율 하락", s3.net, 1360000); chk("증권사 사례3 세금", s3.total, 0);
  // 손계산 1(화면 「예시 넣기」와 같음): 엔비디아 $10,000×1,350 → $14,000×1,420 = +6,380,000 / 테슬라 $8,000×1,300 → $6,500×1,400 = −1,300,000 / 애플(원) 300만 → 390만 = +900,000
  // 통산 5,980,000 − 2,500,000 = 3,480,000 × 20% = 696,000, 지방 69,600, 합계 765,600
  const h1 = run([D(10000, 14000, 1350, 1420, "엔비디아"), D(8000, 6500, 1300, 1400, "테슬라"), K(3000000, 3900000, "애플")]);
  chk("손계산1 이익 합", h1.gains, 7280000); chk("손계산1 손실 합", h1.losses, -1300000); chk("손계산1 통산", h1.net, 5980000);
  chk("손계산1 과세표준", h1.base, 3480000); chk("손계산1 양도세", h1.tax, 696000); chk("손계산1 지방세", h1.local, 69600); chk("손계산1 합계", h1.total, 765600);
  // 손계산 2(수수료율·원 미만 버림): $20,000×1,300 = 26,000,000 → $25,000×1,450 = 36,250,000, 수수료 0.25% × 62,250,000 = 155,625
  // 손익 10,094,375 − 2,500,000 = 7,594,375 × 20% = 1,518,875, 지방 151,887.5 → 151,887, 합계 1,670,762
  const h2 = run([D(20000, 25000, 1300, 1450)], { fee: { mode: "rate", rate: 0.0025 } });
  chk("손계산2 수수료", h2.fees, 155625); chk("손계산2 통산", h2.net, 10094375); chk("손계산2 과세표준", h2.base, 7594375); chk("손계산2 양도세", h2.tax, 1518875); chk("손계산2 지방세", h2.local, 151887); chk("손계산2 합계", h2.total, 1670762);
  // 신고 기한: 2025년 양도 → 2026.5.31.이 일요일이라 6.1.까지, 2026년 양도 → 2027.5.1.~5.31.
  const d25 = OC.deadline(OST, 2025), d26 = OC.deadline(OST, 2026);
  if (d25.to !== "2026-06-01" || d26.from !== "2027-05-01" || d26.to !== "2027-05-31") throw new Error(`P2-53 신고 기한 불일치: ${d25.to} / ${d26.from}~${d26.to}`);
  const wn = (n) => `${n < 0 ? "−" : ""}${Math.abs(Math.round(n)).toLocaleString("ko-KR")}원`;
  const EXR = [
    ["국세청 사례 (국외주식, 공제 이미 사용)", "국외주식 양도소득금액 100,000,000원, 기본공제는 국내 주식 예정신고에서 받음", "100,000,000 × 20%", `과세표준 ${wn(n1.base)} · 양도세 <b>${wn(n1.tax)}</b> (안내서 20,000천원과 같음)`],
    ["국세청 사례 (국내·국외 통산)", "국내 주식 +110,000,000원, 국외 주식 −67,000,000원", "110,000,000 − 67,000,000 − 2,500,000", `통산 ${wn(n2.net)} · 과세표준 <b>${wn(n2.base)}</b> (안내서 40,500천원과 같음, 사례 세율 10%는 대조 제외)`],
    ["증권사 사례 (수수료)", "양도가액 70,000,000원, 취득가액 60,000,000원, 수수료 등 1,000,000원", "(9,000,000 − 2,500,000) × 20%", `과세표준 ${wn(s1.base)} · 양도세 <b>${wn(s1.tax)}</b> · 지방세 ${wn(s1.local)} (안내 130만·13만원과 같음)`],
    ["증권사 사례 (환율)", "외화 100 → 120 × 1,000주, 환율 170 → 187 / 170 → 153", "120,000 × 187 − 100,000 × 170", `환율 상승 양도차익 <b>${wn(s2.net)}</b> · 하락 ${wn(s3.net)} (안내 544만·136만원과 같음)`],
    ["손계산 1 (예시 넣기)", "엔비디아 $10,000(1,350원) → $14,000(1,420원), 테슬라 $8,000(1,300원) → $6,500(1,400원), 애플 3,000,000원 → 3,900,000원", "6,380,000 − 1,300,000 + 900,000 − 2,500,000", `과세표준 ${wn(h1.base)} · 양도세 ${wn(h1.tax)} + 지방세 ${wn(h1.local)} = <b>${wn(h1.total)}</b>`],
    ["손계산 2 (수수료율 0.25%)", "$20,000(1,300원) → $25,000(1,450원), 수수료율 0.25%", "10,250,000 − 155,625 − 2,500,000", `과세표준 ${wn(h2.base)} · 양도세 ${wn(h2.tax)} + 지방세 ${wn(h2.local)} = <b>${wn(h2.total)}</b>`],
  ];
  const OST_WARN = "참고용 추정치예요. 실제 신고는 홈택스(국세청)나 세무사에게 확인하세요. 투자 권유나 매도 추천이 아니에요. 국내시장 복귀계좌(RIA) 공제, 외국납부세액공제, 중소기업 주식 10% 세율 같은 특례는 넣지 않았어요.";
  const y0 = OST.years[Y];
  const due = OC.deadline(OST, Y);
  const rates = `<script type="application/json" id="ostax-rates">${JSON.stringify(OST).replace(/</g, "\\u003c")}</script>`;
  utilPage(utilById.ostax, `<div class="ost">
<form class="dd-form pay-form avg-form ost-form" autocomplete="off" novalidate>
  <label class="ost-year"><span>과세 연도 (판 해)</span><select name="year"></select></label>
  <p class="ost-sub"><b>판 종목</b> <small class="hint">그해 판 종목을 줄마다 넣으세요. 손실 난 종목도 함께 넣어야 통산돼요.</small></p>
  <ol class="ost-rows"></ol>
  <button type="button" class="btn ghost avg-add" data-add>+ 종목 줄 추가</button>
  <p class="hint ost-fxnote">달러 종목은 <b>매수·매도 결제일의 기준환율</b>을 넣어요. 증권사 「해외주식 양도소득세 계산 자료」의 원화 금액이 있으면 통화를 원으로 바꿔 그 금액을 넣는 게 가장 정확해요.</p>
  <fieldset class="seg ost-fee"><legend>수수료 (필요경비, 선택)</legend><label><input type="radio" name="feemode" value="none" checked><span>안 넣음</span></label><label><input type="radio" name="feemode" value="rate"><span>수수료율 %</span></label><label><input type="radio" name="feemode" value="krw"><span>합계 금액(원)</span></label></fieldset>
  <label data-fee="rate" hidden><span>매매 수수료율 (%) <small class="hint">매수·매도 금액에 각각 적용</small></span><input name="feerate" type="text" inputmode="decimal" autocomplete="off" placeholder="예: 0.25"></label>
  <label data-fee="krw" hidden><span>그해 수수료 등 합계 (원)</span><input name="feekrw" type="text" inputmode="numeric" autocomplete="off" placeholder="예: 150,000"></label>
  <label class="check"><input type="checkbox" name="dedused"> 기본공제 250만 원을 이미 받았어요 (같은 해 국내 대주주·비상장 주식 양도 신고 등)</label>
  <div class="dd-opts pay-acts"><button type="submit" class="btn">계산하기</button><button type="button" class="btn ghost" data-copy>결과 한 줄 복사</button><button type="button" class="chip" data-example>예시 넣기</button><button type="button" class="chip" data-reset>모두 지우기</button></div>
</form>
<div class="dd-result pay-result avg-result ost-result" aria-live="polite"></div>
<p class="sq-warn" role="note">${esc(OST_WARN)}</p>
</div>${rates}`, {
    scripts: ["ostax-calc.js", "t-ostax.js"], fileTool: false,
    after: `<h2 class="dd-h">계산 검증 (국세청·증권사 안내 사례, 손계산과 대조)</h2>
<div class="table-wrap"><table class="dd-table avg-ex ost-ex"><thead><tr><th scope="col">경우</th><th scope="col">입력</th><th scope="col">계산</th><th scope="col">결과</th></tr></thead><tbody>${EXR.map((r) => `<tr><th scope="row">${esc(r[0])}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${r[3]}</td></tr>`).join("")}</tbody></table></div>
<p class="hint">세금 = (통산 손익 − 기본공제 ${(y0.deduction / 1e4).toLocaleString("ko-KR")}만 원) × ${Math.round(y0.rate * 100)}% + 그 세액의 ${Math.round(y0.localRatio * 100)}%(지방소득세). 위 사례는 사이트를 만들 때마다 이 계산기로 다시 계산해 같은지 자동으로 확인해요. 과세표준과 세액은 원 미만을 버렸어요(가정). ${Y}년에 판 주식은 ${due.from.slice(0, 4)}년 5월 ${+due.from.slice(8)}일 ~ ${+due.to.slice(5, 7)}월 ${+due.to.slice(8)}일에 신고·납부해요.</p>
<section class="prose pay-src" aria-labelledby="ost-src-h"><h2 id="ost-src-h">기준·출처 (확인일 ${esc(OST.checked)})</h2>
<ul>${OST.sources.map((x) => `<li><b>${esc(x.name)}</b> — <a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.by)}<span class="sr"> (새 창, 외부 사이트)</span></a> · ${esc(x.date)}${x.check === "2차" ? " · <small>법령 원문 대신 증권사·언론 안내로 확인</small>" : ""}</li>`).join("")}</ul>
<p class="hint">이 계산기에 넣지 않은 것: ${OST.notIncluded.map((x) => esc(x)).join(" / ")}.</p>
<p class="hint">세법은 해마다 바뀔 수 있어요. 이 계산기는 ${Object.keys(OST.years).join("·")}년 양도분 기준으로 계산하는 <b>참고용 추정치</b>이고, 실제 신고 금액은 국세청 홈택스(국번 없이 126)나 세무사에게 확인하세요.</p></section>`
  });
}

// P2-55 복리 계산기 · 배당 계산기: 계산식·세율은 src/assets/compound-calc.js 한 벌(화면 t-cmp.js와 아래 대조가 같은 파일을 vm으로 씀)
// 흐름: 탭(복리 | 배당) → 원금·적립금·수익률·기간·주기·적립 시점(·물가) → 최종 자산·납입·수익·72의 법칙 → 원금 vs 자산 그래프 → 연도별 표 → 한 줄 복사
//       배당: 투자금 → 연·월 배당(세전·세후) / 목표 월 배당 → 필요 투자금, (선택) 배당 재투자 n년 뒤 월 배당
// 빌드 때 ① 손계산 ② 엑셀 FV 공식(닫힌 식, 아래 fvX) ③ 파이썬 독립 계산(scripts/compound-verify.py, Decimal 40자리)과 대조하고, 다르면 빌드를 멈춤
{
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "src", "assets", "compound-calc.js"), "utf8"), ctx);
  const CC = ctx.CMPCALC, RU = CC.RULES;
  const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const chk = (name, got, want) => { if (!(got === want || (typeof got === "number" && typeof want === "number" && near(got, want)))) throw new Error(`P2-55 「${name}」 계산 불일치: ${got} ≠ ${want}`); };
  const cp = (o) => { const r = CC.compound(o); if (r.err) throw new Error(`P2-55 계산 실패 ${JSON.stringify(o)}`); return r; };
  // 엑셀 =FV(i, n, −pmt, −pv, type) 닫힌 식. 계산기는 달마다 굴리는 방식이라 서로 다른 방법으로 같은 값이 나와야 함
  const fvX = (i, n, pmt, pv, type = 0) => (i === 0 ? pv + pmt * n : pv * (1 + i) ** n + (pmt * ((1 + i) ** n - 1) / i) * (1 + i * type));
  // 연복리(그해 적립금은 연말까지 단리) = 1년치 적립 효과 C = pmt × (12 + r × (월초 78 | 월말 66) ÷ 12)를 연 단위 FV에 넣은 것
  const fvY = (p0, pmt, r, y, begin) => fvX(r, y, pmt * (12 + (r * (begin ? 78 : 66)) / 12), p0);
  if (RU.kr !== 0.154 || RU.us !== 0.15 || RU.gross !== 20000000) throw new Error("P2-55 세율·기준 값이 출처 확인 값과 다름(RULES)");
  // 손계산 1: 매달 10만 원, 연 12% 연복리, 1년. 월말 적립이면 적립금마다 이자 11·10·…·0개월 → 100,000 × 12% × 66 ÷ 12 = 66,000 → 1,266,000원. 월초면 12·…·1개월(78) → 1,278,000원
  //          2년(월말): 1,266,000 × 1.12 + 1,266,000 = 2,683,920원
  const h1e = cp({ pmt: 100000, rate: 0.12, years: 1, freq: "y" }), h1b = cp({ pmt: 100000, rate: 0.12, years: 1, freq: "y", timing: "begin" }), h1y = cp({ pmt: 100000, rate: 0.12, years: 2, freq: "y" });
  chk("손계산1 월말", h1e.fv, 1266000); chk("손계산1 월초", h1b.fv, 1278000); chk("손계산1 2년", h1y.fv, 2683920); chk("손계산1 2년 납입", h1y.paid, 2400000); chk("손계산1 2년차 수익", h1y.rows[1].gain, 2683920 - 1266000 - 1200000);
  // 손계산 2: 1,000만 원 연 7% 연복리 10년 거치 = 10,000,000 × 1.07¹⁰ = 19,671,513.57원. 72의 법칙 6% → 12년, 정확히 ln2 ÷ ln1.06 = 11.90년
  const h2 = cp({ p0: 10000000, rate: 0.07, years: 10, freq: "y" }), h72 = cp({ p0: 1, rate: 0.06, years: 1, freq: "y" });
  chk("손계산2 거치", h2.fv, 19671513.572895654); chk("손계산2 72의 법칙", h72.r72, 12); chk("손계산2 정확한 두 배", h72.dbl, 11.895661045941875);
  // 손계산 3: 수익률 0% → 원금 + 적립금 × 개월 수, 이자 0
  const h3 = cp({ p0: 1000000, pmt: 100000, rate: 0, years: 3 });
  chk("손계산3 0%", h3.fv, 4600000); chk("손계산3 0% 이자", h3.interest, 0);
  // 배당 손계산: 1억 × 5% = 연 500만(세전) − 15.4% 77만 = 423만(세후), 월 352,500원. 월 세후 100만 ÷ 0.846 × 12 ÷ 5% = 283,687,943원. 미국 15%: 1억 × 4% × 0.85 ÷ 12 = 283,333원
  const d1 = CC.dividend({ amt: 100000000, yld: 0.05, tax: RU.kr }), d2 = CC.need({ target: 1000000, basis: "post", yld: 0.05, tax: RU.kr }), d3 = CC.need({ target: 1000000, basis: "pre", yld: 0.04, tax: RU.kr }), d4 = CC.dividend({ amt: 100000000, yld: 0.04, tax: RU.us });
  chk("배당 세전 연", d1.yPre, 5000000); chk("배당 세금 연", d1.yTax, 770000); chk("배당 세후 연", d1.yPost, 4230000); chk("배당 세후 월", d1.mPost, 352500);
  chk("역계산 세후 100만", d2.amt, 283687943.26241136); chk("역계산 세후 확인", d2.mPost, 1000000); chk("역계산 세전 100만 4%", d3.amt, 300000000); chk("미국 15% 월", d4.mPost, 283333.3333333333);
  if (d1.gross || !CC.dividend({ amt: 400000001, yld: 0.05, tax: RU.kr }).gross) throw new Error("P2-55 금융소득 2천만 원 초과 판정 불일치");
  // 파이썬 독립 계산(scripts/compound-verify.py 출력, 2026-11-10) — 엑셀 FV와 같은 닫힌 식을 Decimal로
  const PY = [
    ["월복리 월말", { p0: 10000000, pmt: 500000, rate: 0.06, years: 10 }, 100133640.74355446, () => fvX(0.005, 120, 500000, 10000000)],
    ["월복리 월초", { p0: 10000000, pmt: 500000, rate: 0.06, years: 10, timing: "begin" }, 100543339.11057061, () => fvX(0.005, 120, 500000, 10000000, 1)],
    ["연복리 월초 30년", { p0: 5000000, pmt: 300000, rate: 0.08, years: 30, freq: "y", timing: "begin" }, 475805025.3873647, () => fvY(5000000, 300000, 0.08, 30, true)],
    ["처음 값(7% 20년)", { p0: 10000000, pmt: 500000, rate: 0.07, years: 20 }, 300850718.40257853, () => fvX(0.07 / 12, 240, 500000, 10000000)],
  ];
  const PYR = PY.map(([k, o, py, xl]) => { const r = cp(o); chk(`${k} 파이썬`, r.fv, py); chk(`${k} 엑셀 FV`, r.fv, xl()); return { k, o, r }; });
  const re1 = CC.reinvest({ amt: 100000000, yld: 0.04, tax: RU.kr, years: 10 }), re2 = CC.reinvest({ amt: 50000000, yld: 0.05, tax: RU.kr, years: 15, pmt: 1000000 });
  chk("재투자1 파이썬", re1.fv, 140203359.58630905); chk("재투자1 월 배당", re1.after.mPost, (140203359.58630905 * 0.04 * 0.846) / 12); chk("재투자2 파이썬", re2.fv, 344972056.399092);
  const ex = cp({ p0: 10000000, pmt: 500000, rate: 0.06, years: 10, infl: 0.025 }), dflt = PYR[3].r, rl = cp({ p0: 10000000, pmt: 500000, rate: 0.07, years: 20, infl: 0.025 });
  chk("실질 가치(파이썬)", rl.real, 183600451.5792979); chk("실효 연 수익률 7% 월복리", rl.eff, 0.0722900808562359);
  // 엑셀 FV와 격자 대조: 원금 3 × 적립 3 × 수익률 5 × 기간 4 × 주기 2 × 시점 2(원금·적립 모두 0인 경우 제외), 연도별 표 마지막 줄·그래프 끝값도 같은지
  let grid = 0;
  for (const p0 of [0, 1000000, 37000000]) for (const pmt of [0, 250000, 1234567]) for (const rate of [0, 0.01, 0.055, 0.12, 0.3]) for (const years of [1, 7, 25, 60]) for (const freq of ["m", "y"]) for (const timing of ["end", "begin"]) {
    if (!(p0 + pmt > 0)) continue;
    const r = cp({ p0, pmt, rate, years, freq, timing }), b = timing === "begin";
    const want = freq === "m" ? fvX(rate / 12, years * 12, pmt, p0, b ? 1 : 0) : fvY(p0, pmt, rate, years, b);
    chk(`격자 ${p0}/${pmt}/${rate}/${years}/${freq}/${timing}`, r.fv, want); chk("격자 표", r.rows[years - 1].value, r.fv); chk("격자 그래프", r.series.bal[years * 12], r.fv); chk("격자 납입", r.paid, p0 + pmt * years * 12);
    grid++;
  }
  const wn = (n) => `${Math.round(n).toLocaleString("ko-KR")}원`;
  const EXR = [
    ["손계산 · 연복리 적립", "매달 100,000원, 연 12% 연복리, 1년 (월말 / 월초), 2년", "100,000 × 12 + 100,000 × 12% × 66 ÷ 12", `월말 <b>${wn(h1e.fv)}</b> · 월초 ${wn(h1b.fv)} · 2년 ${wn(h1y.fv)}`],
    ["손계산 · 연복리 거치", "10,000,000원, 연 7%, 10년", "10,000,000 × 1.07¹⁰", `<b>${wn(h2.fv)}</b> · 72의 법칙 6% → ${h72.r72}년 (정확히 ${h72.dbl.toFixed(2)}년)`],
    ["엑셀 FV · 월복리 월말", "처음 10,000,000원 + 매달 500,000원, 연 6%, 10년", "=FV(6%/12, 120, −500000, −10000000, 0)", `<b>${wn(PYR[0].r.fv)}</b> · 넣은 돈 ${wn(PYR[0].r.paid)}`],
    ["엑셀 FV · 월복리 월초", "같은 조건, 월초 적립", "=FV(6%/12, 120, −500000, −10000000, 1)", `<b>${wn(PYR[1].r.fv)}</b> · 월말 적립에 물가 2.5%면 실질 ${wn(ex.real)}`],
    ["처음 값", "처음 10,000,000원 + 매달 500,000원, 연 7% 월복리, 20년", "=FV(7%/12, 240, −500000, −10000000, 0)", `<b>${wn(dflt.fv)}</b> · 수익 ${wn(dflt.interest)}`],
    ["배당 · 투자금 → 월 배당", "100,000,000원, 배당률 5%, 배당세 15.4%", "5,000,000 × (1 − 0.154) ÷ 12", `연 세후 ${wn(d1.yPost)} · 월 세후 <b>${wn(d1.mPost)}</b>`],
    ["배당 · 월 100만 원 역계산", "월 세후 1,000,000원, 배당률 5%, 15.4%", "1,000,000 ÷ 0.846 × 12 ÷ 5%", `필요 투자금 <b>${wn(d2.amt)}</b>`],
    ["배당 재투자", "100,000,000원, 배당률 4%, 15.4%, 10년 월복리 재투자", "=FV(4% × 0.846 / 12, 120, 0, −100000000)", `자산 <b>${wn(re1.fv)}</b> · 월 배당(세후) ${wn(re1.after.mPost)}`],
  ];
  const CMP_WARN = "계산 결과는 참고용이에요. 투자 권유가 아니에요. 실제 수익률은 해마다 오르내리고 원금 손실이 날 수 있어요. 배당은 회사·ETF 사정에 따라 줄거나 끊길 수 있어요.";
  const pane = (v) => `data-pane="${v}"`;
  utilPage(utilById.compound, `<div class="cmp">
<fieldset class="seg cmp-tab"><legend>무엇을 계산할까요?</legend><label><input type="radio" name="tab" value="cmp" checked><span>복리 계산기</span></label><label><input type="radio" name="tab" value="div"><span>배당 계산기</span></label></fieldset>
<form class="dd-form pay-form avg-form cmp-form" ${pane("cmp")} autocomplete="off" novalidate>
  <div class="row2">
    <label><span>초기 원금 (원)</span><input name="p0" type="text" inputmode="numeric" autocomplete="off" placeholder="예: 10,000,000"><small class="cmp-kr" data-kr="p0"></small></label>
    <label><span>매달 적립금 (원)</span><input name="pmt" type="text" inputmode="numeric" autocomplete="off" placeholder="예: 500,000"><small class="cmp-kr" data-kr="pmt"></small></label>
  </div>
  <div class="row2">
    <label><span>연 수익률 (%)</span><input name="rate" type="text" inputmode="decimal" autocomplete="off" placeholder="예: 7"></label>
    <label><span>기간 (년)</span><input name="years" type="text" inputmode="numeric" autocomplete="off" placeholder="예: 20"></label>
  </div>
  <div class="dca-quick" role="group" aria-label="기간 빠르게 고르기">${[5, 10, 20, 30].map((y) => `<button type="button" class="chip" data-years="${y}">${y}년</button>`).join("")}</div>
  <div class="cmp-segs"><fieldset class="seg"><legend>복리 주기</legend><label><input type="radio" name="freq" value="m" checked><span>월복리</span></label><label><input type="radio" name="freq" value="y"><span>연복리</span></label></fieldset>
  <fieldset class="seg"><legend>적립 시점</legend><label><input type="radio" name="timing" value="end" checked><span>월말</span></label><label><input type="radio" name="timing" value="begin"><span>월초</span></label></fieldset></div>
  <label><span>물가상승률 (%) <small class="hint">(선택) 넣으면 지금 돈 가치로 바꾼 실질 가치까지</small></span><input name="infl" type="text" inputmode="decimal" autocomplete="off" placeholder="예: 2.5"></label>
  <div class="dd-opts pay-acts"><button type="submit" class="btn">계산하기</button><button type="button" class="btn ghost" data-copy>결과 한 줄 복사</button><button type="button" class="chip" data-example>예시 넣기</button><button type="button" class="chip" data-reset>처음 값으로</button></div>
</form>
<div class="dd-result pay-result cmp-result" ${pane("cmp")} aria-live="polite"></div>
<form class="dd-form pay-form avg-form div-form" ${pane("div")} hidden autocomplete="off" novalidate>
  <fieldset class="seg"><legend>무엇을 알고 싶나요?</legend><label><input type="radio" name="dmode" value="fwd" checked><span>투자금 → 월 배당</span></label><label><input type="radio" name="dmode" value="need"><span>월 배당 목표 → 필요 투자금</span></label></fieldset>
  <label data-dm="fwd"><span>투자금 (원)</span><input name="amt" type="text" inputmode="numeric" autocomplete="off" placeholder="예: 100,000,000"><small class="cmp-kr" data-kr="amt"></small></label>
  <div class="div-need" data-dm="need" hidden>
    <label><span>받고 싶은 월 배당 (원)</span><input name="target" type="text" inputmode="numeric" autocomplete="off" placeholder="예: 1,000,000"><small class="cmp-kr" data-kr="target"></small></label>
    <fieldset class="seg"><legend>이 금액은</legend><label><input type="radio" name="basis" value="post" checked><span>세후 (통장에 들어오는 돈)</span></label><label><input type="radio" name="basis" value="pre"><span>세전</span></label></fieldset>
  </div>
  <label><span>배당률 (연 %) <small class="hint">1년 배당금 ÷ 주가</small></span><input name="yld" type="text" inputmode="decimal" autocomplete="off" placeholder="예: 5"></label>
  <div class="dca-quick" role="group" aria-label="배당률 빠르게 고르기">${[3, 4, 5, 6, 8, 10].map((y) => `<button type="button" class="chip" data-yld="${y}">${y}%</button>`).join("")}</div>
  <fieldset class="seg"><legend>배당 세금</legend><label><input type="radio" name="tax" value="kr" checked><span>15.4% (국내 주식·ETF)</span></label><label><input type="radio" name="tax" value="us"><span>15% (미국 주식)</span></label><label><input type="radio" name="tax" value="none"><span>세전으로 보기</span></label></fieldset>
  <label class="check"><input type="checkbox" name="reinv"> 받은 배당을 다시 투자(재투자)하면 몇 년 뒤 월 배당은?</label>
  <div class="row2" data-reinv hidden>
    <label><span>재투자 기간 (년)</span><input name="ryears" type="text" inputmode="numeric" autocomplete="off" placeholder="예: 10"></label>
    <label><span>매달 추가 투자 (원, 선택)</span><input name="radd" type="text" inputmode="numeric" autocomplete="off" placeholder="예: 500,000"><small class="cmp-kr" data-kr="radd"></small></label>
  </div>
  <div class="dd-opts pay-acts"><button type="submit" class="btn">계산하기</button><button type="button" class="btn ghost" data-copy>결과 한 줄 복사</button><button type="button" class="chip" data-example>예시 넣기</button><button type="button" class="chip" data-reset>처음 값으로</button></div>
</form>
<div class="dd-result pay-result div-result" ${pane("div")} hidden aria-live="polite"></div>
<div class="dca-chart cmp-chart" hidden><div class="sq-chips dca-chips cmp-chips"></div><svg class="dca-svg cmp-svg" role="img" aria-label="원금 대비 자산 그래프" xmlns="http://www.w3.org/2000/svg"></svg><div class="sq-legend dca-legend cmp-legend" aria-hidden="true"></div></div>
<p class="sq-warn" role="note">${esc(CMP_WARN)}</p>
</div>`, {
    scripts: ["compound-calc.js", "t-cmp.js"], fileTool: false,
    after: `<h2 class="dd-h">계산 검증 (손계산·엑셀 FV와 대조)</h2>
<div class="table-wrap"><table class="dd-table avg-ex cmp-ex"><thead><tr><th scope="col">경우</th><th scope="col">입력</th><th scope="col">계산</th><th scope="col">결과</th></tr></thead><tbody>${EXR.map((r) => `<tr><th scope="row">${esc(r[0])}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${r[3]}</td></tr>`).join("")}</tbody></table></div>
<p class="hint">이 계산기는 달마다 이자를 붙여 가며 굴리는 방식으로 계산해요. 사이트를 만들 때마다 위 손계산·엑셀 FV 공식·따로 만든 계산(파이썬)과 같은지, 원금·적립금·수익률·기간·복리 주기·적립 시점을 바꾼 ${grid}가지 조합이 엑셀 FV 공식과 같은지 자동으로 확인해요.</p>
<section class="prose pay-src" aria-labelledby="cmp-src-h"><h2 id="cmp-src-h">배당 세금 기준·출처 (확인일 ${esc(RU.checked)})</h2>
<ul>${RU.sources.map((x) => `<li><b>${esc(x.name)}</b> — <a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.by)}<span class="sr"> (새 창, 외부 사이트)</span></a> · ${esc(x.date)}${x.check === "2차" ? " · <small>공식 원문 대신 언론 안내로 확인</small>" : ""}</li>`).join("")}</ul>
<p class="hint">이 계산기에 넣지 않은 것: 금융소득 종합과세(연 2천만 원 초과분), 2026년부터 생긴 고배당기업 배당소득 분리과세 특례, ISA·연금계좌 비과세·과세이연, 건강보험료, 배당 성장과 주가 변동. 실제 세금은 증권사 배당 명세서나 국세청 홈택스(국번 없이 126)에서 확인하세요.</p></section>`
  });
}

// P2-56 손절·익절·포지션 계산기: 계산식은 src/assets/pos-calc.js 한 벌(화면 t-pos.js와 아래 대조가 같은 파일을 vm으로 씀)
// 흐름: 방향(롱|숏)·단위 → 진입가·손절(가격|%)·익절(가격|%|R) → 계좌·감당할 손실(%|금액)·환율·수수료 → 수량·포지션·손익·R:R·본전 승률 → 가격 사다리 → 한 줄 복사 → 다음 툴
// 빌드 때 ① 손계산 7건(롱·숏·소수 주식·수수료·레버리지·오류) ② 성질 격자(수량이 손실 한도를 넘지 않고 1단위 더 사면 넘는지, 본전 승률 × (1 + R) = 1 등)와 대조하고, 다르면 빌드를 멈춤
{
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "src", "assets", "pos-calc.js"), "utf8"), ctx);
  const PC = ctx.POSCALC;
  const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const chk = (name, got, want) => { if (!(got === want || (typeof got === "number" && typeof want === "number" && near(got, want)))) throw new Error(`P2-56 「${name}」 계산 불일치: ${got} ≠ ${want}`); };
  const pc = (o) => { const r = PC.calc(o); if (r.err) throw new Error(`P2-56 계산 실패 ${r.err} ${JSON.stringify(o)}`); return r; };
  // 손계산 1 (롱·원): 진입 50,000 손절 47,500 익절 57,500, 계좌 1,000만 원 × 1% = 100,000원 ÷ 1주 손실 2,500원 = 40주
  //   포지션 2,000,000원(20%), 손절 −100,000원, 익절 7,500 × 40 = +300,000원, R = 7,500 ÷ 2,500 = 3, 본전 승률 1 ÷ 4 = 25%
  const h1 = pc({ dir: "long", entry: 50000, stop: 47500, target: 57500, account: 10000000, riskPct: 0.01 });
  chk("손계산1 수량", h1.n, 40); chk("손계산1 포지션", h1.pos, 2000000); chk("손계산1 비중", h1.weight, 0.2); chk("손계산1 손실", h1.loss, 100000); chk("손계산1 이익", h1.gain, 300000); chk("손계산1 R", h1.rr, 3); chk("손계산1 본전 승률", h1.be, 0.25); chk("손계산1 손절 %", h1.stopPct, -0.05);
  // 손계산 2 (숏·달러): 진입 $100 손절 $105, 목표 2R → $100 − 2 × $5 = $90. 계좌 $20,000 × 2% = $400 ÷ $5 = 80주
  //   포지션 $8,000(40%), 손절 −$400, 익절 $10 × 80 = +$800, R 2, 본전 승률 1 ÷ 3 = 33.33%
  const h2 = pc({ dir: "short", entry: 100, stop: 105, targetR: 2, account: 20000, riskPct: 0.02 });
  chk("손계산2 익절가", h2.target, 90); chk("손계산2 수량", h2.n, 80); chk("손계산2 포지션", h2.pos, 8000); chk("손계산2 손실", h2.loss, 400); chk("손계산2 이익", h2.gain, 800); chk("손계산2 R", h2.rr, 2); chk("손계산2 본전 승률", h2.be, 1 / 3);
  // 손계산 3 (숏·원·정수 내림): 진입 30,000 손절 5% → 31,500, 목표 2R → 27,000. 2,000만 원 × 1% = 200,000 ÷ 1,500 = 133.33 → 133주
  //   포지션 3,990,000원(19.95%), 손절 −199,500원, 익절 3,000 × 133 = +399,000원
  const h3 = pc({ dir: "short", entry: 30000, stopPct: 0.05, targetR: 2, account: 20000000, riskPct: 0.01 });
  chk("손계산3 손절가", h3.stop, 31500); chk("손계산3 익절가", h3.target, 27000); chk("손계산3 계산값", h3.exact, 400 / 3); chk("손계산3 수량", h3.n, 133); chk("손계산3 포지션", h3.pos, 3990000); chk("손계산3 비중", h3.weight, 0.1995); chk("손계산3 손실", h3.loss, 199500); chk("손계산3 이익", h3.gain, 399000);
  // 손계산 4 (소수 주식·달러, 계좌는 원): 진입 $250, 손절 4% → $240, 목표 10% → $275. 계좌 5,000,000원 ÷ 1,400 = $3,571.43, 감당할 손실 49,000원 ÷ 1,400 = $35
  //   $35 ÷ $10 = 3.5주(정수면 3주), 포지션 $875 = 1,225,000원(24.5%), 손절 −$35(−49,000원), 익절 $25 × 3.5 = +$87.5(122,500원), R 2.5, 본전 승률 1 ÷ 3.5 = 28.57%
  const o4 = { dir: "long", entry: 250, stopPct: 0.04, targetPct: 0.1, account: 5000000, acctKrw: true, fx: 1400, riskAmt: 49000, frac: true };
  const h4 = pc(o4), h4i = pc({ ...o4, frac: false });
  chk("손계산4 손절가", h4.stop, 240); chk("손계산4 익절가", h4.target, 275); chk("손계산4 손실 한도", h4.budget, 35); chk("손계산4 소수 수량", h4.n, 3.5); chk("손계산4 포지션", h4.pos, 875); chk("손계산4 포지션 원", h4.pos * 1400, 1225000); chk("손계산4 비중", h4.weight, 0.245);
  chk("손계산4 손실", h4.loss, 35); chk("손계산4 이익", h4.gain, 87.5); chk("손계산4 이익 원", h4.gain * 1400, 122500); chk("손계산4 R", h4.rr, 2.5); chk("손계산4 본전 승률", h4.be, 1 / 3.5); chk("손계산4 정수 수량", h4i.n, 3); chk("손계산4 정수 손실", h4i.loss, 30);
  // 손계산 5 (수수료 0.1%, 사고 팔 때 각각): 진입 10,000 손절 9,500 익절 11,000, 1,000만 원 × 1% = 100,000원
  //   1주 손절 손실 = 500 + 0.001 × (10,000 + 9,500) = 519.5원 → 100,000 ÷ 519.5 = 192.49 → 192주, 손절 −192 × 519.5 = −99,744원
  //   1주 익절 이익 = 1,000 − 0.001 × (10,000 + 11,000) = 979원 → +187,968원, R = 979 ÷ 519.5 = 1.8845, 본전 승률 519.5 ÷ 1,498.5 = 34.67% (수수료 없으면 200주, R 2)
  const h5 = pc({ dir: "long", entry: 10000, stop: 9500, target: 11000, account: 10000000, riskPct: 0.01, fee: 0.001 }), h5n = pc({ dir: "long", entry: 10000, stop: 9500, target: 11000, account: 10000000, riskPct: 0.01 });
  chk("손계산5 1주 손실", h5.loss1, 519.5); chk("손계산5 수량", h5.n, 192); chk("손계산5 손실", h5.loss, 99744); chk("손계산5 1주 이익", h5.gain1, 979); chk("손계산5 이익", h5.gain, 187968); chk("손계산5 R", h5.rr, 979 / 519.5); chk("손계산5 본전 승률", h5.be, 519.5 / 1498.5); chk("손계산5 수수료 없을 때 수량", h5n.n, 200); chk("손계산5 가격 R", h5.rrGross, 2);
  // 손계산 6 (레버리지 경고): 진입 $50 손절 $49.8(소수 오차로 0.2000…03), $10,000 × 1% = $100 ÷ $0.2 = 500주 → $25,000(250%) > 계좌. 현금으로는 $10,000 ÷ $50 = 200주
  const h6 = pc({ dir: "long", entry: 50, stop: 49.8, target: 51, account: 10000, riskPct: 0.01 });
  chk("손계산6 수량", h6.n, 500); chk("손계산6 비중", h6.weight, 2.5); chk("손계산6 레버리지", h6.lev, true); chk("손계산6 현금 한도", h6.cashMax, 200); chk("손계산1 레버리지 아님", h1.lev, false);
  // 손계산 7 (오류 안내): 숏인데 손절가 < 진입가, 롱·숏 익절 방향, 감당할 손실 100원 < 1주 손실 2,500원, 계좌가 원인데 환율 없음, 숏 목표가 0 이하
  chk("오류 숏 손절 방향", PC.calc({ dir: "short", entry: 100, stop: 95, target: 90, account: 10000, riskPct: 0.01 }).err, "stopSide");
  chk("오류 숏 익절 방향", PC.calc({ dir: "short", entry: 100, stop: 105, target: 110, account: 10000, riskPct: 0.01 }).err, "targetSide");
  chk("오류 롱 익절 방향", PC.calc({ dir: "long", entry: 100, stop: 95, target: 99, account: 10000, riskPct: 0.01 }).err, "targetSide");
  chk("오류 1주도 못 삼", PC.calc({ dir: "long", entry: 50000, stop: 47500, account: 10000000, riskAmt: 100 }).err, "zero");
  chk("오류 환율 없음", PC.calc({ ...o4, fx: null }).err, "fx");
  chk("오류 숏 목표가 0 이하", PC.calc({ dir: "short", entry: 100, stop: 150, targetR: 3, account: 10000, riskPct: 0.01 }).err, "targetNeg");
  // 성질 격자: 방향 2 × 진입가 4 × 손절 % 4 × 목표 R 3 × 위험 % 3 × 수수료 3 × 소수 주식 2
  let grid = 0;
  for (const dir of ["long", "short"]) for (const entry of [3.17, 48.5, 731.25, 61800]) for (const sp of [0.003, 0.02, 0.075, 0.3]) for (const tR of [0.5, 2, 3.7]) for (const rp of [0.005, 0.01, 0.02]) for (const fee of [0, 0.00015, 0.0025]) for (const frac of [false, true]) {
    const d = dir === "long" ? 1 : -1;
    if (d < 0 && sp * tR >= 1) continue;
    const r = PC.calc({ dir, entry, stopPct: sp, targetR: tR, account: 25000000, riskPct: rp, fee, frac });
    const tag = `격자 ${dir}/${entry}/${sp}/${tR}/${rp}/${fee}/${frac}`;
    if (r.err === "zero") { if (!(r.loss1 * (frac ? 1e-6 : 1) > r.budget)) throw new Error(`P2-56 ${tag} 0주 판정 불일치`); grid++; continue; }
    if (r.err) throw new Error(`P2-56 ${tag} 계산 실패 ${r.err}`);
    const step = frac ? 1e-6 : 1;
    chk(`${tag} 손절가`, r.stop, entry * (1 - d * sp)); chk(`${tag} 익절가`, r.target, entry + d * tR * entry * sp);
    if (!(r.loss <= r.budget * (1 + 1e-9))) throw new Error(`P2-56 ${tag} 손실이 한도를 넘음`);
    if (!((r.n + step) * r.loss1 > r.budget * (1 - 1e-9))) throw new Error(`P2-56 ${tag} 한 단위 더 살 수 있는데 내림`);
    if (fee === 0) chk(`${tag} R`, r.rr, tR);
    if (r.be != null) chk(`${tag} 본전 승률`, r.be * (1 + r.rr), 1);
    chk(`${tag} 포지션`, r.pos, r.n * entry); chk(`${tag} 이익`, r.gain, r.n * (entry * sp * tR - fee * (2 * entry + d * entry * sp * tR)));
    grid++;
  }
  const wn = (n) => `${Math.round(n).toLocaleString("ko-KR")}원`, dl = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const q = (n) => `${n.toLocaleString("ko-KR", { maximumFractionDigits: 6 })}주`, pp = (r) => `${(r * 100).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`, rr = (r) => `1 : ${r.toFixed(2)}`;
  const EXR = [
    ["롱 · 원", "진입 50,000원, 손절 47,500원, 익절 57,500원, 계좌 10,000,000원, 감당할 손실 1%", "100,000 ÷ 2,500", `<b>${q(h1.n)}</b> · 포지션 ${wn(h1.pos)}(${pp(h1.weight)}) · 손절 −${wn(h1.loss)} · 익절 +${wn(h1.gain)} · 손익비 ${rr(h1.rr)} · 본전 승률 ${pp(h1.be)}`],
    ["숏 · 달러 · 목표 R", "진입 $100, 손절 $105, 목표 2R, 계좌 $20,000, 감당할 손실 2%", "$400 ÷ $5, 익절가 100 − 2 × 5", `<b>${q(h2.n)}</b> · 익절가 ${dl(h2.target)} · 포지션 ${dl(h2.pos)}(${pp(h2.weight)}) · 손절 −${dl(h2.loss)} · 익절 +${dl(h2.gain)} · 본전 승률 ${pp(h2.be)}`],
    ["숏 · 원 · 정수 내림", "진입 30,000원, 손절 5%, 목표 2R, 계좌 20,000,000원, 감당할 손실 1%", "200,000 ÷ 1,500 = 133.33 → 내림", `<b>${q(h3.n)}</b> · 손절가 ${wn(h3.stop)} · 익절가 ${wn(h3.target)} · 포지션 ${wn(h3.pos)}(${pp(h3.weight)}) · 손절 −${wn(h3.loss)} · 익절 +${wn(h3.gain)}`],
    ["소수 주식 · 달러 · 계좌 원", "진입 $250, 손절 4%, 목표 10%, 계좌 5,000,000원, 감당할 손실 49,000원, 환율 1,400원", "49,000 ÷ 1,400 = $35 → $35 ÷ $10", `<b>${q(h4.n)}</b> (정수면 ${q(h4i.n)}) · 포지션 ${dl(h4.pos)} = ${wn(h4.pos * 1400)}(${pp(h4.weight)}) · 손절 −${wn(h4.loss * 1400)} · 익절 +${wn(h4.gain * 1400)} · 손익비 ${rr(h4.rr)}`],
    ["수수료 0.1%", "진입 10,000원, 손절 9,500원, 익절 11,000원, 계좌 10,000,000원, 1%, 수수료 사고 팔 때 0.1%씩", "1주 손실 500 + 0.001 × 19,500 = 519.5 → 100,000 ÷ 519.5", `<b>${q(h5.n)}</b> (수수료 없으면 ${q(h5n.n)}) · 손절 −${wn(h5.loss)} · 익절 +${wn(h5.gain)} · 손익비 ${rr(h5.rr)} · 본전 승률 ${pp(h5.be)}`],
    ["레버리지 경고", "진입 $50, 손절 $49.80, 계좌 $10,000, 감당할 손실 1%", "$100 ÷ $0.20", `<b>${q(h6.n)}</b> · 포지션 ${dl(h6.pos)} = 계좌의 ${pp(h6.weight)} → 레버리지 필요 경고, 현금으로는 ${q(h6.cashMax)}`],
    ["방향 오류", "숏인데 진입 $100, 손절 $95", "숏은 오르면 손해", "<b>오류 안내</b> · 숏은 손절가가 진입가보다 높아야 해요"],
  ];
  const POS_WARN = "계산 결과는 참고용이에요. 투자 권유나 매매 추천이 아니에요. 손절가를 정해도 갭 하락·상승, 거래 정지, 급변동 때는 손절가보다 훨씬 불리한 가격에 체결될 수 있어요. 레버리지(신용·미수·마진)와 공매도는 원금보다 큰 손실이 날 수 있어요.";
  utilPage(utilById.possize, `<div class="pos">
<form class="dd-form pay-form avg-form pos-form" autocomplete="off" novalidate>
  <fieldset class="seg pos-dir"><legend>방향</legend><label><input type="radio" name="dir" value="long" checked><span>롱 (매수 · 오르면 이익)</span></label><label><input type="radio" name="dir" value="short"><span>숏 (공매도 · 내리면 이익)</span></label></fieldset>
  <p class="hint pos-side" data-side></p>
  <div class="avg-opts"><fieldset class="seg"><legend>가격 단위</legend><label><input type="radio" name="unit" value="krw" checked><span>원 (₩)</span></label><label><input type="radio" name="unit" value="usd"><span>달러 ($)</span></label></fieldset>
  <label class="check avg-frac"><input type="checkbox" name="frac"> 소수 주식 허용 (소수점 수량)</label></div>
  <label><span>진입가 <i data-u></i> <small class="hint">사는(숏이면 파는) 가격</small></span><input name="entry" type="text" inputmode="decimal" autocomplete="off"></label>
  <div class="row2 pos-lv2">
    <div class="pos-in"><fieldset class="seg pos-mini"><legend>손절 <i data-su></i></legend><label><input type="radio" name="smode" value="price" checked><span>가격</span></label><label><input type="radio" name="smode" value="pct"><span>%</span></label></fieldset><input name="stop" type="text" inputmode="decimal" autocomplete="off" aria-label="손절가 또는 손절 %"></div>
    <div class="pos-in"><fieldset class="seg pos-mini"><legend>익절 <i data-tu></i> <small class="hint">(선택)</small></legend><label><input type="radio" name="tmode" value="price" checked><span>가격</span></label><label><input type="radio" name="tmode" value="pct"><span>%</span></label><label><input type="radio" name="tmode" value="r"><span>R</span></label></fieldset><input name="target" type="text" inputmode="decimal" autocomplete="off" aria-label="익절가, 목표 % 또는 목표 R 배수"></div>
  </div>
  <div class="dca-quick" role="group" aria-label="목표 손익비(R 배수) 빠르게 고르기">${[1, 1.5, 2, 3].map((x) => `<button type="button" class="chip" data-tq="${x}">목표 ${x}R</button>`).join("")}</div>
  <div class="avg-opts" data-usd hidden><fieldset class="seg"><legend>계좌 금액 단위</legend><label><input type="radio" name="acur" value="usd" checked><span>달러</span></label><label><input type="radio" name="acur" value="krw"><span>원</span></label></fieldset></div>
  <div class="row2">
    <label><span>계좌 금액 <i data-acct-u></i></span><input name="acct" type="text" inputmode="decimal" autocomplete="off"></label>
    <label data-usd hidden><span>환율 (원/달러) <small class="hint" data-fx-hint></small></span><input name="fx" type="text" inputmode="decimal" autocomplete="off" placeholder="예: 1,400"></label>
  </div>
  <div class="pos-in"><fieldset class="seg pos-mini"><legend>감당할 손실 <i data-risk-u></i></legend><label><input type="radio" name="rmode" value="pct" checked><span>계좌의 %</span></label><label><input type="radio" name="rmode" value="amt"><span>금액</span></label></fieldset><input name="risk" type="text" inputmode="decimal" autocomplete="off" aria-label="감당할 손실"></div>
  <div class="dca-quick" role="group" aria-label="감당할 손실 빠르게 고르기">${[0.5, 1, 2].map((x) => `<button type="button" class="chip" data-rq="${x}">계좌의 ${x}%</button>`).join("")}</div>
  <label><span>수수료 (%) <small class="hint">(선택) 사고 팔 때 각각 드는 비율</small></span><input name="fee" type="text" inputmode="decimal" autocomplete="off" placeholder="예: 0.25"></label>
  <div class="dd-opts pay-acts"><button type="submit" class="btn">계산하기</button><button type="button" class="btn ghost" data-copy>결과 한 줄 복사</button><button type="button" class="chip" data-example>예시 넣기</button><button type="button" class="chip" data-reset>모두 지우기</button></div>
</form>
<div class="dd-result pay-result avg-result pos-result" aria-live="polite"></div>
<div class="avg-chart pos-chart" hidden><svg class="avg-svg pos-svg" role="img" aria-label="가격 사다리" xmlns="http://www.w3.org/2000/svg"></svg></div>
<p class="sq-warn" role="note">${esc(POS_WARN)}</p>
</div>`, {
    scripts: ["pos-calc.js", "t-pos.js"], fileTool: false,
    after: `<h2 class="dd-h">계산 예시 (손계산과 대조)</h2>
<div class="table-wrap"><table class="dd-table avg-ex pos-ex"><thead><tr><th scope="col">경우</th><th scope="col">입력</th><th scope="col">계산</th><th scope="col">결과</th></tr></thead><tbody>${EXR.map((r) => `<tr><th scope="row">${esc(r[0])}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${r[3]}</td></tr>`).join("")}</tbody></table></div>
<p class="hint">수량 = 감당할 손실 ÷ 1주 손절 손실(|진입가 − 손절가| + 수수료), 정수 주는 내림, 소수 주식은 소수 6자리에서 내림. 손익비(R:R) = 1주 익절 이익 ÷ 1주 손절 손실, 본전 승률 = 1 ÷ (1 + R). 사이트를 만들 때마다 위 손계산과, 방향·가격·손절 %·목표 R·위험 %·수수료·소수 주식을 바꾼 ${grid}가지 조합에서 「손실이 한도를 넘지 않고, 한 단위 더 사면 넘는지」를 자동으로 확인해요.</p>`
  });
}

utilPage(utilById.qr, `<div class="qr">
  <fieldset class="seg qr-types"><legend>무엇을 담을까요?</legend>
    <label><input type="radio" name="type" value="link" checked><span>링크</span></label><label><input type="radio" name="type" value="text"><span>글</span></label><label><input type="radio" name="type" value="wifi"><span>와이파이</span></label><label><input type="radio" name="type" value="vcard"><span>연락처</span></label><label><input type="radio" name="type" value="sms"><span>문자</span></label>
  </fieldset>
  <div class="qr-main">
    <div class="qr-form">
      <div class="qr-pane" data-pane="link"><label>링크 주소<input name="url" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="예: www.example.com/menu"></label><p class="hint">https://를 빼고 넣으면 자동으로 붙여요.</p></div>
      <div class="qr-pane" data-pane="text" hidden><label>담을 글<textarea name="text" class="qr-ta" rows="4" maxlength="3000" placeholder="예: 3층 회의실은 엘리베이터에서 내려 오른쪽이에요."></textarea></label><p class="hint">글은 QR코드를 찍은 휴대폰 화면에 그대로 보여요. 한글은 한 글자에 3바이트를 써요.</p></div>
      <div class="qr-pane" data-pane="wifi" hidden>
        <label>와이파이 이름 (SSID)<input name="ssid" autocomplete="off" spellcheck="false" placeholder="예: cafe_5G"></label>
        <label>보안 방식<select name="wsec"><option value="WPA" selected>WPA·WPA2·WPA3 (대부분의 공유기)</option><option value="WEP">WEP (아주 오래된 공유기)</option><option value="nopass">비밀번호 없음</option></select></label>
        <label class="qr-pwrow">비밀번호<span class="qr-pw"><input name="wpass" type="password" autocomplete="off" spellcheck="false"><button type="button" class="btn ghost" data-pwtoggle aria-pressed="false">보기</button></span></label>
        <label class="check"><input type="checkbox" name="whidden"> 숨긴 네트워크 (와이파이 목록에 이름이 안 보여요)</label>
        <p class="hint">대소문자와 띄어쓰기까지 공유기에 적힌 것과 똑같이 넣어 주세요. 세미콜론(;)이나 쉼표 같은 특수문자도 그대로 넣으면 알아서 처리해요.</p>
      </div>
      <div class="qr-pane" data-pane="vcard" hidden>
        <div class="row2"><label>성<input name="vlast" autocomplete="off" placeholder="홍"></label><label>이름<input name="vfirst" autocomplete="off" placeholder="길동"></label></div>
        <div class="row2"><label>휴대폰<input name="vtel" type="tel" inputmode="tel" autocomplete="off" placeholder="010-1234-5678"></label><label>회사 전화<input name="vwork" type="tel" inputmode="tel" autocomplete="off" placeholder="02-123-4567"></label></div>
        <label>이메일<input name="vmail" type="email" inputmode="email" autocomplete="off" spellcheck="false" placeholder="name@example.com"></label>
        <div class="row2"><label>회사<input name="vorg" autocomplete="off" placeholder="세화산업"></label><label>직책·부서<input name="vtitle" autocomplete="off" placeholder="영업팀 과장"></label></div>
        <label>웹사이트<input name="vurl" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="www.example.com"></label>
        <label>주소<input name="vadr" autocomplete="off" placeholder="서울시 중구 세종대로 110"></label>
        <p class="hint">명함 QR(vCard 3.0)이에요. 찍으면 휴대폰이 「연락처에 추가」를 띄워요. 비운 칸은 넣지 않아요.</p>
      </div>
      <div class="qr-pane" data-pane="sms" hidden>
        <label>받는 번호<input name="snum" type="tel" inputmode="tel" autocomplete="off" placeholder="010-1234-5678"></label>
        <label>문자 내용 (선택)<textarea name="smsg" class="qr-ta" rows="3" maxlength="1000" placeholder="예: 예약 문의합니다."></textarea></label>
        <p class="hint">찍으면 문자 앱이 이 번호와 내용으로 열려요. 보내기는 찍은 사람이 직접 눌러요.</p>
      </div>
      <details class="qr-style">
        <summary>꾸미기 · 색 · 로고 · 오류 정정</summary>
        <div class="tk-opts">
          <div class="qr-colors"><label class="qr-color">QR 색<input type="color" name="fg" value="#000000"></label><label class="qr-color">배경색<input type="color" name="bg" value="#ffffff"></label><button type="button" class="btn ghost qr-sbtn" data-swap-color>색 맞바꾸기</button><button type="button" class="btn ghost qr-sbtn" data-reset-color>검정·흰색으로</button></div>
          <p class="tk-warn qr-cwarn" role="status" hidden></p>
          <label>여백 <output class="qr-m-out">4칸</output><input type="range" name="margin" min="0" max="8" step="1" value="4"></label>
          <div class="qr-logo"><span class="qr-logo-h">가운데 로고</span>
            <div class="qr-logo-row"><label class="btn ghost qr-sbtn qr-logo-btn">내 이미지 넣기<input type="file" name="logo" class="sr" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label><span class="qr-logo-name hint">없음</span><button type="button" class="btn ghost qr-sbtn" data-logo-rm hidden>로고 빼기</button></div>
            <div class="qr-logo-opts" hidden>
              <label>로고 크기 <output class="qr-l-out">18%</output><input type="range" name="logosize" min="10" max="24" step="1" value="18"></label>
              <label class="check"><input type="checkbox" name="plate" checked> 로고 뒤를 배경색으로 비우기 (권장)</label>
            </div>
            <p class="hint">PNG·JPG·WEBP·SVG · 10MB까지. 로고는 QR 너비의 24%까지만 키울 수 있어요. 로고가 가린 부분은 오류 정정으로 복구해요.</p>
          </div>
          <fieldset class="seg"><legend>오류 정정 (가려지거나 더러워져도 읽히는 정도)</legend>
            <label><input type="radio" name="ecl" value="L"><span>L 7%</span></label><label><input type="radio" name="ecl" value="M" checked><span>M 15%</span></label><label><input type="radio" name="ecl" value="Q"><span>Q 25%</span></label><label><input type="radio" name="ecl" value="H"><span>H 30%</span></label>
          </fieldset>
          <p class="hint qr-ecl-note" hidden>로고가 있어서 가장 높은 H로 맞췄어요. 로고를 빼면 원래대로 돌아가요.</p>
        </div>
      </details>
    </div>
    <div class="qr-out">
      <div class="qr-preview"><canvas class="qr-canvas" width="640" height="640" role="img" aria-label="QR코드 미리보기" hidden></canvas><p class="qr-empty">링크 주소를 넣으면 QR코드가 바로 만들어져요.</p></div>
      <p class="qr-info hint" aria-live="polite"></p>
      <p class="tk-msg qr-err" role="alert" hidden></p>
      <p class="tk-msg note qr-warn" hidden></p>
      <div class="qr-actions">
        <label class="qr-size">PNG 크기<select name="pngsize"><option value="256">256px (메신저)</option><option value="512">512px</option><option value="1024" selected>1024px (보통)</option><option value="2048">2048px (인쇄)</option></select></label>
        <button type="button" class="btn" data-png disabled>PNG 저장</button><button type="button" class="btn ghost" data-svg disabled>SVG 저장</button><button type="button" class="btn ghost" data-copy disabled>이미지 복사</button>
      </div>
      <p class="hint">저장하기 전에 휴대폰 카메라로 화면의 QR을 한 번 찍어 보세요. SVG는 크기를 키워도 깨지지 않아 인쇄소·디자인 프로그램에 좋아요.</p>
    </div>
  </div>
  <section class="qr-cardsec" hidden aria-labelledby="qr-card-h">
    <h2 id="qr-card-h" class="qr-card-h">와이파이 안내 카드 (A6 인쇄)</h2>
    <p class="hint">가게·사무실·숙소 벽이나 테이블에 붙일 카드예요. A6(105×148mm, 엽서 크기)에 맞춰 인쇄해요.</p>
    <div class="qr-cardopts">
      <label>가게 이름 (선택)<input name="cshop" autocomplete="off" maxlength="30" placeholder="예: 세화 카페"></label>
      <label>안내 문구<input name="cguide" autocomplete="off" maxlength="60" value="휴대폰 카메라로 QR코드를 비추고, 뜨는 알림을 누르면 바로 연결돼요."></label>
      <label class="check"><input type="checkbox" name="cshowpw" checked> 카드에 비밀번호 글자도 보이기</label>
    </div>
    <div class="qr-card" aria-label="와이파이 안내 카드 미리보기"></div>
    <button type="button" class="btn big" data-print disabled>인쇄하기</button>
    <p class="hint">인쇄 창에서 용지를 A6로 고르세요. A6가 없으면 A4에 「실제 크기(100%)」로 인쇄한 뒤 잘라 쓰면 돼요. 비밀번호 글자를 숨겨도 QR코드에는 비밀번호가 들어 있어요.</p>
  </section>
  <p class="safe">입력한 내용과 로고 이미지는 서버로 보내지 않습니다. 지금 쓰는 브라우저 안에서만 QR코드를 만들어요.</p>
  <p class="hint qr-lic">QR코드 부호화: qrcode-generator (MIT) · <a href="${u("/licenses/")}">오픈소스 고지</a> · QR Code는 DENSO WAVE의 등록상표예요.</p>
</div>
<div class="tk-msg" role="alert" hidden></div>`, { vendor: ["qrcode-generator/qrcode.js"], scripts: ["t-qr.js"], fileTool: false });

// 글자수 세기 (입력 → 결과 → 결과 복사 → 다음 툴)
utilPage(utilById.charcount, `<label for="cc-text" class="sr">글자수를 셀 글</label>
<textarea id="cc-text" class="cc-text" rows="10" placeholder="여기에 글을 붙여 넣거나 입력하세요. 입력한 글은 저장하지 않아요." autocomplete="off" spellcheck="false"></textarea>
<dl class="cc-stats" aria-live="polite">
  <div class="main"><dt>공백 포함</dt><dd><b data-out="all">0</b>자</dd></div>
  <div class="main"><dt>공백 제외</dt><dd><b data-out="noSpace">0</b>자</dd></div>
  <div><dt>한글 2바이트 기준</dt><dd><b data-out="kr2">0</b>바이트</dd></div>
  <div><dt>UTF-8</dt><dd><b data-out="utf8">0</b>바이트</dd></div>
  <div><dt>줄</dt><dd><b data-out="lines">0</b></dd></div>
  <div><dt>단락</dt><dd><b data-out="paras">0</b></dd></div>
  <div><dt>단어(띄어쓰기 기준)</dt><dd><b data-out="words">0</b></dd></div>
</dl>
<div class="cc-tools"><label>목표 글자수(선택)<input name="limit" type="number" min="0" max="1000000" inputmode="numeric" placeholder="예: 1000"></label><button type="button" class="btn" data-copy>결과 복사</button><button type="button" class="btn ghost" data-clear>글 지우기</button></div>
<p class="cc-limit" hidden></p>
<p class="safe">입력한 글은 서버로 전송하지 않고, 저장하지도 않습니다.</p>`, { scripts: ["t-text.js"], fileTool: false });

// 디데이 계산기
utilPage(utilById.dday, `<form class="dd-form" autocomplete="off">
  <div class="row2">
    <label>기준일 (시작일)<input type="date" name="from" min="1900-01-01" max="2200-12-31"></label>
    <label>목표일<input type="date" name="to" min="1900-01-01" max="2200-12-31"></label>
  </div>
  <div class="dd-opts"><label class="check"><input type="checkbox" name="countone"> 시작일을 1일로 세기</label><button type="button" class="btn ghost" data-today>기준일을 오늘로</button><button type="button" class="btn" data-copy>결과 복사</button></div>
</form>
<div class="dd-result" aria-live="polite"></div>
<h2 class="dd-h">기념일 목록</h2>
<div class="dd-ann"></div>`, { scripts: ["t-text.js"], fileTool: false });

// 만 나이 계산기
utilPage(utilById.age, `<form class="dd-form" autocomplete="off">
  <div class="row2">
    <label>생년월일 (양력)<input type="date" name="birth" min="1900-01-01" max="2200-12-31"></label>
    <label>기준일<input type="date" name="base" min="1900-01-01" max="2200-12-31"></label>
  </div>
  <div class="dd-opts"><button type="button" class="btn ghost" data-today>기준일을 오늘로</button><button type="button" class="btn" data-copy>결과 복사</button></div>
</form>
<div class="dd-result age-result" aria-live="polite"></div>
<p class="hint">2023년 6월 28일부터 법령·계약·공문서의 나이는 특별한 규정이 없으면 <b>만 나이</b>로 셉니다(행정기본법·민법 개정). 병역·청소년 보호처럼 법에 따로 정한 경우는 연 나이를 써요.</p>`, { scripts: ["t-calc.js"], fileTool: false });

// 평수 계산기
{
  const R = 400 / 121;
  const COMMON = [33, 49, 59, 74, 84, 99, 114, 135];
  utilPage(utilById.pyeong, `<form class="dd-form py-form" autocomplete="off">
  <div class="row2">
    <label>제곱미터 (㎡)<input type="number" name="m2" min="0" step="any" inputmode="decimal" placeholder="예: 84"></label>
    <label>평<input type="number" name="py" min="0" step="any" inputmode="decimal" placeholder="예: 25.4"></label>
  </div>
  <div class="dd-opts"><span class="hint">자주 찾는 면적</span>${COMMON.map((m) => `<button type="button" class="chip" data-m2="${m}">${m}㎡</button>`).join("")}<button type="button" class="btn" data-copy>결과 복사</button></div>
</form>
<div class="dd-result py-result" aria-live="polite"></div>
<h2 class="dd-h">자주 찾는 면적 표</h2>
<div class="table-wrap"><table class="dd-table"><thead><tr><th scope="col">㎡</th><th scope="col">평</th><th scope="col">흔히 부르는 말(전용면적 기준)</th></tr></thead><tbody>${COMMON.map((m) => `<tr><th scope="row">${m}㎡</th><td>${(m / R).toFixed(2)}평</td><td>${{ 59: "「국민 평형」 아래 소형(공급 24~25평형 안팎)", 84: "「국민 평형」(공급 33~35평형 안팎)", 114: "중대형(공급 43평형 안팎)" }[m] || ""}</td></tr>`).join("")}</tbody></table></div>
<p class="hint">1평 = 400/121㎡ ≈ 3.3058㎡. 「OO평형」은 보통 공급면적 기준이라 단지마다 달라요. 정확한 값은 분양 공고나 건축물대장을 확인하세요.</p>`, { scripts: ["t-calc.js"], fileTool: false });
}

// P2-45 직장인 돈 계산기 4종(연봉 실수령액 · 주휴수당 · 퇴직금 · 실업급여). 요율은 content/pay-rates-2026.mjs 한 곳,
// 계산식은 src/assets/pay-calc.js 한 벌(빌드의 연봉표도 같은 파일을 vm으로 불러 계산). 흐름: 입력 → 결과 → 한 줄 복사 → 다음 계산기
{
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "src", "assets", "pay-calc.js"), "utf8"), ctx);
  const PC = ctx.PAYCALC;
  const wn = (n) => `${Math.round(n).toLocaleString("ko-KR")}원`;
  const rates = `<script type="application/json" id="pay-rates">${JSON.stringify(PAY).replace(/</g, "\\u003c")}</script>`;
  const srcHtml = (keys) => `<section class="prose pay-src" aria-labelledby="pay-src-h"><h2 id="pay-src-h">기준·출처 (확인일 ${esc(PAY.checked)})</h2>
<ul>${PAY.sources.filter((x) => keys.includes(x.k)).map((x) => `<li><b>${esc(x.name)}</b> — <a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.by)}<span class="sr"> (새 창, 외부 사이트)</span></a> · ${esc(x.date)}${x.check === "보도" ? " · <small>고시 원문 대신 공개 보도로 확인</small>" : ""}</li>`).join("")}</ul>
<p class="hint">요율은 해마다 바뀌어요. 이 계산기는 ${PAY.year}년 값으로 계산하는 <b>참고용 추정치</b>이고, 정확한 금액은 회사 급여 담당자나 해당 기관(국민연금공단·국민건강보험공단·국세청 홈택스·고용24)에서 확인하세요.</p></section>`;
  const tail = `<div class="dd-opts pay-acts"><button type="submit" class="btn">계산하기</button><button type="button" class="btn ghost" data-copy>결과 한 줄 복사</button></div>`;
  const money = (name, label, ph, { value = "", kor = true, help = "" } = {}) => `<label${name === "amt" ? ' class="pay-amt-label"' : name === "wv" ? ' class="pay-wv-label"' : ""}>${label}<input name="${name}" type="text" inputmode="numeric" autocomplete="off" placeholder="${ph}"${value !== "" ? ` value="${value}"` : ""}${kor ? " data-kor" : ""}>${help ? `<small class="hint">${help}</small>` : ""}</label>`;
  const box = (id, form) => `<div class="pay" data-pay="${id}"><form class="dd-form pay-form" autocomplete="off" novalidate>${form}${tail}</form><div class="dd-result pay-result" aria-live="polite"></div></div>${rates}`;
  const opts = { scripts: ["pay-calc.js", "t-pay.js"], fileTool: false };

  // 연봉 실수령액
  {
    const ANN = [24, 28, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100].map((x) => x * 1e6);
    const rowsY = ANN.map((a) => { const r = PC.salary(PAY, { annual: a, nontax: 200000, family: 1, kids: 0, ratio: 1, date: PAY.checked }); return `<tr><th scope="row">${(a / 1e4).toLocaleString("ko-KR")}만원</th><td>${wn(r.gross)}</td><td>${wn(r.pension + r.health + r.ltc + r.employ)}</td><td>${wn(r.tax + r.local)}</td><td><b>${wn(r.net)}</b></td></tr>`; }).join("");
    utilPage(utilById.salary, box("salary", `
<fieldset class="seg"><legend>무엇을 넣을까요?</legend><label><input type="radio" name="mode" value="year" checked><span>연봉</span></label><label><input type="radio" name="mode" value="month"><span>월급</span></label></fieldset>
${money("amt", "연봉 (세전)", "예: 40,000,000")}
<div class="dd-opts pay-quick"><span class="hint">빠르게</span>${[30, 40, 50, 60].map((m) => `<button type="button" class="chip pay-quick-y" data-fill="amt=${m * 1e6}">${m.toLocaleString("ko-KR")}00만</button>`).join("")}${[2.2, 2.5, 3, 4].map((m) => `<button type="button" class="chip pay-quick-m" data-fill="amt=${m * 1e6}" hidden>월 ${m * 100}만</button>`).join("")}</div>
<div class="row2">
  ${money("nontax", "비과세 (월)", "예: 200,000", { value: "200000", kor: false, help: "식대는 월 20만원까지 비과세" })}
  <label>원천징수 비율<select name="ratio"><option value="80">80%</option><option value="100" selected>100% (기본)</option><option value="120">120%</option></select></label>
</div>
<div class="row2">
  <label>부양가족 수 (본인 포함)<input name="family" type="number" min="1" max="20" value="1" inputmode="numeric"></label>
  <label>8세~20세 자녀 수<input name="kids" type="number" min="0" max="10" value="0" inputmode="numeric"></label>
</div>
<label class="check pay-sev"><input type="checkbox" name="sev"> 연봉에 퇴직금이 들어 있어요 (13으로 나누기)</label>`), {
      ...opts,
      after: `<h2 class="dd-h">연봉별 실수령액 표 (${PAY.year}년, 본인 1명 · 비과세 식대 월 20만원)</h2>
<div class="table-wrap"><table class="dd-table pay-ytable"><thead><tr><th scope="col">연봉</th><th scope="col">세전 월급</th><th scope="col">4대보험</th><th scope="col">소득세+지방세</th><th scope="col">월 실수령액</th></tr></thead><tbody>${rowsY}</tbody></table></div>
<p class="hint">국민연금 기준소득월액 상한은 ${PAY.pension.periods[1].from.slice(0, 7).replace("-", "년 ")}월부터 ${PAY.pension.periods[1].max.toLocaleString("ko-KR")}원이에요. 간이세액표는 ${esc(PAY.sources.find((x) => x.k === "tax").date)} 기준이에요.</p>
${srcHtml(["pension", "health", "employ", "tax", "wage"])}`
    });
  }

  // 주휴수당
  utilPage(utilById.juhyu, box("juhyu", `
<div class="row2">
  ${money("wage", "시급", "예: 10,320", { value: String(PAY.minWage[PAY.year]), kor: false, help: `${PAY.year}년 최저임금 ${PAY.minWage[PAY.year].toLocaleString("ko-KR")}원` })}
  <label>일주일 근무시간<input name="hours" type="number" min="0" max="80" step="0.5" value="20" inputmode="decimal"></label>
</div>
<div class="dd-opts pay-quick"><span class="hint">주 근무시간</span>${[15, 20, 25, 30, 40].map((h) => `<button type="button" class="chip" data-fill="hours=${h}">${h}시간</button>`).join("")}</div>
<details class="pay-more"><summary>하루 시간 × 일수로 넣기</summary><div class="row2"><label>하루 근무시간<input name="dh" type="number" min="0" max="24" step="0.5" inputmode="decimal" placeholder="예: 5"></label><label>일주일 근무일수<input name="dn" type="number" min="0" max="7" step="1" inputmode="numeric" placeholder="예: 4"></label></div><p class="hint">휴게시간(4시간에 30분 이상)은 빼고 넣으세요.</p></details>`), { ...opts, after: srcHtml(["wage", "weekly"]) });

  // 퇴직금
  utilPage(utilById.severance, box("severance", `
<div class="row2">
  <label>입사일<input type="date" name="start" min="1970-01-01" max="2100-12-31"></label>
  <label>마지막 근무일<input type="date" name="last" min="1970-01-01" max="2100-12-31"></label>
</div>
${money("wage", "월급 (세전, 기본급 + 고정 수당)", "예: 3,000,000")}
${money("wage3", "퇴직 전 3개월 임금 총액 (세전)", "월급을 넣으면 × 3이 들어가요", { help: "달마다 다르면 실제 3개월 합계로 고쳐 넣으세요" })}
<div class="row2">
  ${money("bonus", "1년 동안 받은 상여금", "예: 4,000,000", { help: "3/12만 반영" })}
  ${money("leave", "연차수당 (전년도 미사용분)", "예: 300,000", { help: "3/12만 반영" })}
</div>
<details class="pay-more"><summary>1일 통상임금도 넣기 (선택)</summary>${money("ord", "1일 통상임금", "예: 110,000", { kor: false, help: "평균임금이 통상임금보다 적으면 통상임금으로 계산해요(근로기준법 제2조②)" })}</details>`), {
    ...opts,
    after: srcHtml(["severance"])
  });

  // 실업급여
  {
    const D = PAY.unemp.days, H = ["1년 미만", "1년 이상 3년 미만", "3년 이상 5년 미만", "5년 이상 10년 미만", "10년 이상"];
    utilPage(utilById.unemp, box("unemp", `
<fieldset class="seg"><legend>퇴사(이직)한 해</legend>${Object.keys(PAY.unemp.dayCap).map((y) => `<label><input type="radio" name="year" value="${y}"${+y === PAY.year ? " checked" : ""}><span>${y}년</span></label>`).join("")}</fieldset>
<fieldset class="seg"><legend>평균임금 넣는 방법</legend><label><input type="radio" name="wmode" value="month" checked><span>월 평균 임금</span></label><label><input type="radio" name="wmode" value="day"><span>1일 평균임금</span></label></fieldset>
${money("wv", "퇴직 전 월 평균 임금 (세전)", "예: 3,000,000")}
<div class="row2">
  <label>퇴사일 기준 나이 (만)<input name="age" type="number" min="15" max="99" value="35" inputmode="numeric"></label>
  <label>고용보험 가입기간<select name="period">${H.map((h, i) => `<option value="${i}"${i === 1 ? " selected" : ""}>${h}</option>`).join("")}</select></label>
</div>
<div class="row2">
  <label>1일 소정근로시간<input name="hours" type="number" min="1" max="8" step="0.5" value="8" inputmode="decimal"><small class="hint">하한액 계산에 써요(최대 8시간)</small></label>
  <label class="check pay-dis"><input type="checkbox" name="dis"> 장애인이에요 (50세 이상 표 적용)</label>
</div>`), {
      ...opts,
      after: `<h2 class="dd-h">소정급여일수 표 (고용보험법 별표 1)</h2>
<div class="table-wrap"><table class="dd-table"><thead><tr><th scope="col">고용보험 가입기간</th><th scope="col">50세 미만</th><th scope="col">50세 이상·장애인</th></tr></thead><tbody>${H.map((h, i) => `<tr><th scope="row">${h}</th><td>${D.under50[i]}일</td><td>${D.over50[i]}일</td></tr>`).join("")}</tbody></table></div>
<p class="hint">${PAY.year}년 1월 1일 이후 이직자는 하루 상한 ${wn(PAY.unemp.dayCap[PAY.year])}, 하한 ${wn(PAY.minWage[PAY.year] * PAY.unemp.minRatio * 8)}(1일 8시간 기준)이에요. 상한은 이직일 기준이라 ${PAY.year - 1}년에 그만뒀다면 ${wn(PAY.unemp.dayCap[PAY.year - 1])}이에요.</p>
${srcHtml(["unemp", "wage"])}`
    });
  }
}

// PDF JPG 변환 (pdf.js + worker 직접 호스팅)
utilPage(utilById.pdf2img, `${dropHtml({ accept: ".pdf,application/pdf", label: "이미지로 바꿀 PDF 파일을 넣어 주세요", limit: "PDF 1개 · 100MB까지 · 한 번에 300쪽까지" })}
<div class="tk-opts" hidden>
  <p class="tk-info"></p>
  <div class="row2">
    <label>형식<select name="format"><option value="jpg" selected>JPG</option><option value="png">PNG</option></select></label>
    <label>해상도<select name="dpi"><option value="72">72dpi (작게)</option><option value="96">96dpi</option><option value="150" selected>150dpi (화면용)</option><option value="200">200dpi</option><option value="300">300dpi (인쇄용)</option></select></label>
  </div>
  <label>바꿀 페이지 (선택)<input name="range" inputmode="text" autocomplete="off" placeholder="비워 두면 전체"></label>
</div>
${tkTail("이미지로 바꾸기")}`, { vendor: ["fflate.min.js"], scripts: ["t-pdf2img.js"] });

// 타이머
utilPage(utilById.timer, `<button type="button" class="tm-fs-close" data-fs-close hidden>전체 화면 닫기 ✕</button><div class="tm-face" aria-live="off"><span class="tm-state">대기</span><div class="clock" role="timer" aria-label="남은 시간">00:00</div><div class="tm-bar" aria-hidden="true"><i></i></div></div>
<form class="tm-form" autocomplete="off">
  <p class="tm-head">시간 직접 정하기</p>
  <div class="tm-inputs"><div class="tm-field"><span class="tm-lab">시</span><button type="button" class="tm-step" data-step="h" data-d="1" aria-label="시 늘리기">▲</button><input type="number" name="h" min="0" max="99" value="0" inputmode="numeric" aria-label="시"><button type="button" class="tm-step" data-step="h" data-d="-1" aria-label="시 줄이기">▼</button></div><div class="tm-field"><span class="tm-lab">분</span><button type="button" class="tm-step" data-step="m" data-d="1" aria-label="분 늘리기">▲</button><input type="number" name="m" min="0" max="59" value="5" inputmode="numeric" aria-label="분"><button type="button" class="tm-step" data-step="m" data-d="-1" aria-label="분 줄이기">▼</button></div><div class="tm-field"><span class="tm-lab">초</span><button type="button" class="tm-step" data-step="s" data-d="1" aria-label="초 늘리기">▲</button><input type="number" name="s" min="0" max="59" value="0" inputmode="numeric" aria-label="초"><button type="button" class="tm-step" data-step="s" data-d="-1" aria-label="초 줄이기">▼</button></div></div>
  <div class="tm-quick" aria-label="빠르게 정하기"><span class="tm-qlab">빠르게</span>${[1, 3, 5, 10, 15, 30, 60].map((m) => `<button type="button" class="chip" data-quick="${m}">${m}분</button>`).join("")}</div>
  <div class="tm-btns"><button type="button" class="btn big" data-start>시작</button><button type="button" class="btn big ghost" data-pause disabled>일시정지</button><button type="button" class="btn ghost" data-reset>초기화</button></div>
  <div class="tm-btns tm-view"><button type="button" class="btn ghost" data-fullscreen>전체 화면</button><button type="button" class="btn ghost" data-pip>PiP 모드</button><button type="button" class="btn ghost" data-preview>소리 미리 듣기</button></div>
  <p class="hint pip-hint" hidden></p>
  <button type="button" class="btn big tm-silence" data-silence hidden>알림 끄기</button>
</form>
<p class="safe">설정한 시간은 저장하거나 전송하지 않습니다. 시작 전에 「소리 미리 듣기」로 소리가 나는지 확인해 주세요. 휴대폰은 화면이 꺼지면 알림이 늦거나 울리지 않을 수 있어요.</p>`, { scripts: ["t-time.js"], fileTool: false });

// 스톱워치
utilPage(utilById.stopwatch, `<button type="button" class="tm-fs-close" data-fs-close hidden>전체 화면 닫기 ✕</button><div class="tm-face"><span class="tm-state">Space 시작·정지 · L 랩 · R 초기화</span><div class="clock" role="timer" aria-label="경과 시간">00:00.00</div></div>
<div class="tm-btns"><button type="button" class="btn big" data-go>시작</button><button type="button" class="btn ghost" data-lap disabled>랩</button><button type="button" class="btn ghost" data-reset disabled>초기화</button></div>
<div class="tm-btns tm-view"><button type="button" class="btn ghost" data-fullscreen>전체 화면</button><button type="button" class="btn ghost" data-pip>PiP 모드</button></div>
<p class="hint pip-hint" hidden></p>
<div class="laps table-wrap" hidden><table class="dd-table"><thead><tr><th scope="col">랩</th><th scope="col">구간</th><th scope="col">누적</th></tr></thead><tbody></tbody></table></div>
<p class="safe">기록은 저장하거나 전송하지 않습니다. 페이지를 닫으면 사라져요.</p>`, { scripts: ["t-time.js"], fileTool: false });

// 오픈소스 고지
{
  const p = "/licenses/";
  const libs = [
    ["pdf-lib", "1.17.1", "MIT", "https://github.com/Hopding/pdf-lib", "PDF 합치기 · PDF 나누기 · JPG PDF 변환"],
    ["mammoth", "1.13.0", "BSD-2-Clause", "https://github.com/mwilliamson/mammoth.js", "워드 PDF 변환(간단)"],
    ["fflate", "0.8.3", "MIT", "https://github.com/101arrowz/fflate", "PDF 나누기 · 이미지 용량 줄이기 · PDF JPG 변환의 zip 묶기"],
    ["pdf.js (pdfjs-dist, legacy build)", "6.4.299", "Apache-2.0", "https://github.com/mozilla/pdf.js", "PDF JPG 변환 (함께 둔 CMap: Adobe BSD-3, 이미지 디코더 wasm: OpenJPEG BSD-2·PDFium BSD-3·qcms MIT, ICC: CC0)"],
    ["korean-lunar-calendar", "0.4.0", "MIT", "https://github.com/usingsky/korean_lunar_calendar_js", "사주팔자 음력 변환표 대조 (변환표 자체는 한국천문연구원 음양력 자료로 만듦)"], // P2-22
    ["astronomia (VSOP87D 지구 계수)", "4.2.0", "MIT", "https://github.com/commenthol/astronomia", "사주팔자 절기 시각 계산에 쓰는 VSOP87 계수 (계수 일부를 덜어 내 직접 둠)"], // P2-22
    ["Galmuri (Galmuri11 Bold 글꼴)", "2.40.3", "SIL OFL 1.1", "https://github.com/quiple/galmuri", "지옥에서 살아남기 게임 화면 글꼴 (이 사이트에 직접 둠, 라이선스 전문: /assets/vendor/galmuri/OFL.txt)"], // P2-27
    ["libheif", "1.23.5", "LGPL-3.0", "https://github.com/strukturag/libheif", "HEIC JPG 변환 (HEIF 파일 해석, Emscripten wasm 빌드 libheif-emscripten v1.23.5)"], // P2-47
    ["qrcode-generator", "2.0.4", "MIT", "https://github.com/kazuhikoarase/qrcode-generator", "QR코드 생성기 (QR코드 부호화. 라이선스 전문: /assets/vendor/qrcode-generator/LICENSE. QR Code는 DENSO WAVE의 등록상표)"], // P2-48
    ["libde265", "1.0.15", "LGPL-3.0", "https://github.com/strukturag/libde265", "HEIC JPG 변환 (HEVC 영상 디코더, libheif.wasm 안에 함께 묶여 있음)"], // P2-47
    ["MediaPipe Tasks Vision (@mediapipe/tasks-vision) + MagicTouch 모델(Google)", "0.10.35", "Apache-2.0", "https://github.com/google-ai-edge/mediapipe", "배경 지우기 (모델 카드: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MagicTouch.pdf, 전문: /assets/vendor/mediapipe/LICENSE)"], // P2-26
  ];
  // P2-47: 본문에 「HEIC 변환 엔진(LGPL-3.0) 소스 코드」 절(#libheif) 추가
  const body = `${crumbHtml([["홈", "/"], ["오픈소스 고지", p]])}<article class="prose doc"><h1>오픈소스 고지</h1>
<p>${esc(cfg.siteName)}의 일부 툴은 아래 오픈소스 소프트웨어를 사용합니다. 라이브러리 파일은 공식 배포본(npm 패키지)을 고치지 않고 이 사이트에 직접 올려 두었고, 해당 툴 페이지에서만 불러옵니다. 외부 CDN에서 불러오지 않습니다.</p>
<div class="table-wrap"><table class="lic"><thead><tr><th scope="col">라이브러리</th><th scope="col">버전</th><th scope="col">라이선스</th><th scope="col">쓰는 곳</th></tr></thead><tbody>${libs.map(([n, v, l, url, where]) => `<tr><th scope="row"><a href="${url}" rel="noopener">${n}</a></th><td>${v}</td><td>${l}</td><td>${esc(where)}</td></tr>`).join("")}</tbody></table></div>
<p>각 라이브러리에 함께 묶여 있는 하위 라이브러리(pako, jszip, underscore 등)와 라이선스 전문은 <a href="${u("/assets/vendor/LICENSES.txt")}">라이선스 전문(LICENSES.txt)</a>에서 확인할 수 있어요. jszip은 MIT와 GPLv3 이중 라이선스이며, ${esc(cfg.siteName)}는 MIT 조건으로 사용합니다. GPL·AGPL 조건으로만 쓸 수 있는 코드는 사용하지 않습니다.</p>
<h2 id="libheif">HEIC 변환 엔진(LGPL-3.0) 소스 코드</h2>
<p>「HEIC JPG 변환」은 브라우저가 HEIC를 직접 열지 못할 때 libheif 1.23.5와 libde265 1.0.15를 Emscripten으로 빌드한 공식 배포본(<a href="https://github.com/catdad-experiments/libheif-emscripten/releases/tag/v1.23.5" rel="noopener">libheif-emscripten v1.23.5</a>)을 고치지 않고 그대로 씁니다. 두 라이브러리는 GNU LGPL v3로 배포되며, 이 사이트의 변환 코드와는 별도 파일(libheif.js, libheif.wasm)로 불러오므로 같은 인터페이스의 다른 버전으로 바꿔 넣을 수 있습니다.</p>
<ul>
<li>고지와 빌드 정보(버전·SHA-256): <a href="${u("/assets/vendor/libheif/NOTICE.txt")}">NOTICE.txt</a></li>
<li>라이선스 전문(LGPL v3·GPL v3): <a href="${u("/assets/vendor/libheif/LICENSE-libheif.txt")}">libheif</a> · <a href="${u("/assets/vendor/libheif/LICENSE-libde265.txt")}">libde265</a></li>
<li>소스 코드(이 사이트 사본): <a href="${u("/assets/vendor/libheif/source/libheif-1.23.5.tar.gz")}">libheif-1.23.5.tar.gz</a> · <a href="${u("/assets/vendor/libheif/source/libde265-1.0.15.tar.gz")}">libde265-1.0.15.tar.gz</a> · 빌드 설정 <a href="${u("/assets/vendor/libheif/source/libheif-emscripten-v1.23.5_emscripten.yml")}">emscripten.yml</a>, <a href="${u("/assets/vendor/libheif/source/libheif-emscripten-v1.23.5_dist-prep.sh")}">dist-prep.sh</a></li>
<li>원본 저장소: <a href="https://github.com/strukturag/libheif/releases/tag/v1.23.5" rel="noopener">libheif v1.23.5</a> · <a href="https://github.com/strukturag/libde265/releases/tag/v1.0.15" rel="noopener">libde265 v1.0.15</a></li>
</ul>
<h2>글꼴</h2><p>본문 글꼴 Pretendard와 제목 글꼴 Black Han Sans는 SIL Open Font License 1.1 글꼴입니다. 두 글꼴은 각각 jsDelivr와 Google Fonts에서 불러오며, 이 요청에는 파일이나 입력한 글이 포함되지 않습니다.</p>
<p class="hint">고지에 빠진 내용이 있다면 <a href="${u("/contact/")}">문의</a>로 알려 주세요.</p></article>`;
  write(p, layout({ title: "오픈소스 고지", desc: `${cfg.siteName}가 사용하는 오픈소스 라이브러리와 라이선스 안내`, path: p, body }));
}

// 정보 페이지
const INFO = ["about", "privacy", "terms", "disclaimer", "contact"];
for (const k of INFO) {
  const d = pages[k];
  const p = `/${k}/`;
  const extra = k === "contact" ? `<p class="contact-mail">📮 <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a></p>` : "";
  const body = `${crumbHtml([["홈", "/"], [d.title, p]])}<article class="prose doc"><h1>${t(d.title)}</h1>${extra}${blocks(d.body.filter((b) => !b.when || (b.when === "ga") === !!cfg.gaId), "h2")}</article>`; // when: "ga" 항목은 GA_ID가 있을 때만, "noGa"는 없을 때만
  write(p, layout({ title: fill(d.title), desc: `${cfg.siteName} ${fill(d.title)}`, path: p, body }));
}
// 작성·검수 기준
{
  const p = "/editorial/";
  const body = `${crumbHtml([["홈", "/"], ["작성·검수 기준", p]])}<article class="prose doc"><h1>작성·검수 기준</h1>
<p>${esc(cfg.siteName)}는 「필요한 일을 빨리 끝내되, 대충 만들지 않는다」를 원칙으로 툴과 콘텐츠를 만들어요. 모든 툴 설명과 오락실 해설은 아래 기준을 거쳐 공개합니다.</p>
<h2>0. 툴은 실제 파일로 확인하고, 한계를 적어요</h2><p>툴은 공개 전에 실제 PDF·이미지·워드 파일로 끝까지 실행해 결과 파일이 열리는지, 쪽수와 이미지 크기가 맞는지 확인합니다. 툴마다 사용법, 예시, 자주 묻는 질문과 함께 할 수 없는 것(한계)을 적고, 원본 모양을 그대로 재현하지 못하는 툴에는 「베타」와 경고를 붙여요. 툴에 넣은 파일은 서버로 전송하지 않습니다.</p>
<h2>1. 직접 쓰고 사람이 검수해요</h2><p>툴 설명, 해설과 운세 문구는 다른 사이트의 문장을 옮기지 않고 직접 작성합니다. 초안 작성에 도구의 도움을 받더라도, 공개 전에 운영자가 한 문장씩 읽고 사실관계와 표현을 확인해요.</p>
<h2>2. 단정하지 않아요</h2><p>운세와 성격 해설은 「~할 수 있어요」, 「참고해 보세요」처럼 가능성으로 표현합니다. 건강이 좋아진다거나 돈이 들어온다는 식의 결과를 보장하는 문구, 특정 관계를 맺거나 끊으라고 권하는 문구는 쓰지 않아요.</p>
<h2>3. 계산은 투명하게 공개해요</h2><p>만 나이, 띠, 별자리, 이름 궁합, 반응속도처럼 계산이 들어가는 도구는 각 페이지의 「결과 해석 가이드」에 계산 방식을 적어 둡니다. 띠는 입춘 기준, 별자리는 일반적으로 쓰이는 날짜 구간을 따르며 경계 날짜는 해마다 하루쯤 달라질 수 있어요.</p>
<h2>4. 개인정보를 받지 않아요</h2><p>생년월일과 이름은 사용자의 브라우저 안에서만 계산하고 서버로 보내거나 저장하지 않습니다. 운세·궁합 결과의 공유 링크와 공유 이미지에도 입력한 이름이나 생년월일은 들어가지 않아요. 다만 사다리타기·돌림판의 「공정성 링크」는 같은 결과를 다시 보여 주기 위해 입력한 이름과 항목을 링크에 담으니, 실명 대신 별명을 써도 돼요.</p>
<h2>5. 권리를 존중해요</h2><p>실존 인물의 사진이나 다른 서비스의 이미지·게임 규칙·명칭을 가져다 쓰지 않습니다. 16유형 성격 테스트는 대중적인 4축 모델을 참고한 자체 제작 간이 테스트이며 공식 검사와 무관해요.</p>
<h2>6. 고칠 점은 바로 고쳐요</h2><p>잘못된 내용이나 불편한 표현을 발견하셨다면 <a href="${u("/contact/")}">문의</a>로 알려 주세요. 확인 후 빠르게 수정하겠습니다.</p>
<p class="hint">운영: ${esc(cfg.operator)}</p></article>`;
  write(p, layout({ title: "작성·검수 기준", desc: `${cfg.siteName}가 테스트와 해설을 만들고 검수하는 기준을 소개합니다.`, path: p, body }));
}

// P2-15 펭귄 RPG (본문은 content/rpg.mjs, 게임은 src/assets/rpg-*.js)
(await import("./content/rpg.mjs")).default({ cfg, write, layout, crumbHtml, crumbs, faqHtml, faqLd, adSlot, esc, t, u, abs, textLen, warnings });
// P2-22 사주팔자 (본문·검증은 content/saju.mjs, 계산은 src/assets/saju-*.js). 검증표가 하나라도 어긋나면 빌드 실패
(await import("./content/saju.mjs")).default({ cfg, write, layout, crumbHtml, crumbs, faqHtml, faqLd, adSlot, esc, t, u, abs, textLen, warnings, root: ROOT });
// P2-27 지옥에서 살아남기 (본문·데이터 검사는 content/hell.mjs, 게임은 src/assets/hell-*.js)
(await import("./content/hell.mjs")).default({ cfg, write, layout, crumbHtml, crumbs, faqHtml, faqLd, adSlot, esc, t, u, abs, textLen, warnings, root: ROOT });
// P2-28 헬조선에서 살아남기 (본문·데이터 검사는 content/hell-chosun.mjs, 게임은 src/assets/hell-chosun-*.js + P2-27 엔진)
(await import("./content/hell-chosun.mjs")).default({ cfg, write, layout, crumbHtml, crumbs, faqHtml, faqLd, adSlot, esc, t, u, abs, textLen, warnings, root: ROOT });

// 404
write("/404.html", layout({ title: "페이지를 찾을 수 없어요", desc: "요청하신 페이지를 찾을 수 없어요.", path: "/404.html", noindex: true, body: `<section class="hero"><h1>앗, 길을 잃었어요</h1><p class="lead">주소가 바뀌었거나 없는 페이지예요. 대신 많이 쓰는 툴로 가 보세요.</p></section>${recoHtml(["pdfmerge", "img2pdf", "charcount", "today"], "많이 쓰는 툴")}` }));

// P2-25 즐겨찾기 색인: favs.js가 쓰는 { id: { t, p, c } } (외부 링크·준비 중 항목 제외)
{
  const favIdx = {};
  UTILS.forEach((x) => { favIdx[x.id] = { t: x.title, p: u(x.path), c: catName(x.cat) }; });
  TOOLS.forEach((x) => { favIdx[x.id] = { t: x.title, p: u(x.path), c: playCat(x) }; }); // P2-49 id는 그대로, 주소·분류만 새로
  favIdx.family = { t: FAMILY.name, p: FAMILY.url, c: "세화산업 다른 서비스 · 새 창", x: 1 }; // 외부 사이트
  fs.writeFileSync(path.join(DIST, "assets", "fav-index.js"), `window.FAV_INDEX=${JSON.stringify(favIdx).replace(/</g, String.fromCharCode(92) + "u003c")};\n`);
}

// sitemap / robots / rss
const today = kstDate(); // 한국 날짜(YYYY-MM-DD)
// P2-35 lastmod: 매일 자정 재빌드 때 모든 페이지가 「오늘 수정」으로 나오면 Google이 lastmod를 믿지 않음 → 페이지 내용이 실제로 바뀐 날만 기록.
// seo-lastmod.json = { 경로: [내용 지문, 날짜] }. 지문은 주소(SITE_URL)·빌드 버전·연도를 지운 HTML로 만들어 로컬·배포 빌드가 같은 값을 냄.
// 로컬 빌드가 이 파일을 갱신하고(커밋에 포함), 배포(CI) 빌드는 읽기만 함. 지문이 다르면 그날 날짜를 씀(오늘의 운세처럼 매일 바뀌는 페이지).
const LASTMOD_FILE = path.join(ROOT, "seo-lastmod.json");
const lastmodDb = fs.existsSync(LASTMOD_FILE) ? JSON.parse(fs.readFileSync(LASTMOD_FILE, "utf8")) : {};
const fingerprint = (html) => {
  let h = html.split(cfg.siteUrl).join("@SITE");
  if (cfg.basePath) h = h.split(`${cfg.basePath}/`).join("/").split(`data-base="${cfg.basePath}"`).join('data-base=""');
  h = h.replace(/\?v=[a-z0-9]+/g, "").replace(/© \d{4}/g, "©").replace(/<meta name="(google|naver)-site-verification"[^>]*>/g, ""); // 소유 확인 값은 배포 변수에만 있음
  let x = 2166136261; for (let i = 0; i < h.length; i++) { x ^= h.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } // FNV-1a 32bit
  return x.toString(36) + "." + h.length.toString(36);
};
const lastmod = {};
for (const p of sitemap) {
  const fp = fingerprint(pageHtml.get(p) || "");
  const prev = lastmodDb[p];
  lastmod[p] = prev && prev[0] === fp ? prev[1] : today;
  lastmodDb[p] = [fp, lastmod[p]];
}
if (!process.env.CI) fs.writeFileSync(LASTMOD_FILE, "{\n" + sitemap.map((p) => `${JSON.stringify(p)}: ${JSON.stringify(lastmodDb[p])}`).join(",\n") + "\n}\n");
fs.writeFileSync(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map((p) => `  <url><loc>${abs(p)}</loc><lastmod>${lastmod[p]}</lastmod></url>`).join("\n")}\n</urlset>\n`);
fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${abs("/sitemap.xml")}\n`);
const rssItems = [...UTILS.map((x) => [x.title, x.path, x.desc]), ...TOOLS.map((x) => [x.title, x.path, x.desc]), ...TYPE_KEYS.map((k) => [`${personality[k].name}(${k}) 성격 특징`, FUN_PATH.type(k), fill(personality[k].summary)])];
fs.writeFileSync(path.join(DIST, "rss.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(cfg.siteName)}</title><link>${abs("/")}</link><description>${esc(cfg.tagline)}</description><language>ko</language>\n${rssItems.map(([ti, p, d]) => `<item><title>${esc(ti)}</title><link>${abs(p)}</link><guid>${abs(p)}</guid><description>${esc(d)}</description><pubDate>${new Date(`${lastmod[p] || today}T00:00:00+09:00`).toUTCString()}</pubDate></item>`).join("\n")}\n</channel></rss>\n`);
// 자체 도메인(basePath "")이면 CNAME도 만들어 둠. GitHub Actions로 배포할 때는 이 파일이 쓰이지 않고 저장소 Settings → Pages의 Custom domain 값이 기준(문서 확인)
{ const host = new URL(cfg.siteUrl).hostname; if (cfg.basePath === "" && !host.endsWith(".github.io")) fs.writeFileSync(path.join(DIST, "CNAME"), host + "\n"); }
if (cfg.adsenseClient) fs.writeFileSync(path.join(DIST, "ads.txt"), `google.com, ${cfg.adsenseClient.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`);

console.log(`✔ 빌드 완료: ${sitemap.length}개 색인 페이지 → dist/  (SITE_URL=${cfg.siteUrl})`);
if (warnings.length) console.log("⚠ 확인 필요:\n  " + warnings.join("\n  "));
