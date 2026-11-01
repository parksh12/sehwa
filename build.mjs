// 펭귄 툴즈 정적 사이트 빌더 — 외부 패키지 없이 Node 18+ 만으로 dist/ 를 생성합니다. (툴 라이브러리는 src/assets/vendor/에 직접 둠)
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
const toolText = await load("tools");

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
// 노출 순위(RANK): 홈 놀이터 띠와 놀이터 순서 참고값. 지금은 운영진 추정치이고, GA4·서치콘솔 데이터가 쌓이면 실측 노출 순으로 바꿉니다.
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
  pdf2img: sv(`${doc(10, 14, 48, 64, RED)}<text x="34" y="54" font-size="15" font-weight="800" text-anchor="middle" fill="${W}" font-family="sans-serif">PDF</text><path d="M52 90h12" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M60 82l9 8-9 8" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="66" y="50" width="44" height="56" rx="6" fill="${W}" stroke="${K}" stroke-width="4"/><circle cx="80" cy="66" r="6" fill="${YEL}" stroke="${K}" stroke-width="3"/><path d="M70 100l12-14 8 6 8-10 8 18z" fill="${GRN}" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>`),
};
function doc(x, y, w, h, fill) {
  const f = Math.min(14, w / 3);
  return `<path d="M${x} ${y + 4}a4 4 0 0 1 4-4h${w - f - 4}l${f} ${f}v${h - f - 4}a4 4 0 0 1-4 4H${x + 4}a4 4 0 0 1-4-4z" fill="${fill}" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><path d="M${x + w - f} ${y}v${f}h${f}" fill="none" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>`;
}
// 로고: 코드로 그린 단순한 펭귄(둥근 사각 몸통 + 흰 배 + 점 눈 + 노란 부리). 실존 캐릭터·로고를 본뜨지 않음
const LOGO = (size = 34) => `<svg class="logo-mark" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M13 31l-6 12M51 31l6 12" stroke="${K}" stroke-width="5" stroke-linecap="round"/><rect x="13" y="5" width="38" height="52" rx="16" fill="${K}"/><path d="M20 34c0-8 5-12 12-12s12 4 12 12v8c0 7-5 11-12 11s-12-4-12-11z" fill="${W}"/><circle cx="25" cy="17" r="2.6" fill="${W}"/><circle cx="39" cy="17" r="2.6" fill="${W}"/><path d="M28 23h8l-4 5z" fill="${YEL}" stroke="${K}" stroke-width="1.5" stroke-linejoin="round"/><path d="M21 59h9M34 59h9" stroke="${YEL}" stroke-width="4" stroke-linecap="round"/></svg>`;
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

// ---------- 펭귄 툴즈: 실용 툴 카테고리·목록 ----------
// 기존 콘텐츠(CATS: me·love·luck·story·arcade)는 주소를 그대로 두고 「펭귄 놀이터」(/play/)로 묶습니다.
const PLAY = { name: "펭귄 놀이터", path: "/play/", desc: "운세, 성격 테스트, 이름 궁합, 1분 인생, 반응속도 게임처럼 잠깐 쉬어 가는 재미 콘텐츠를 모았어요." };
const UCATS = {
  pdf: { name: "PDF·문서", desc: "PDF를 합치고 나누고, 이미지와 워드 문서를 PDF로 바꾸는 툴이에요." },
  image: { name: "이미지", desc: "사진 용량을 줄이거나 여러 장을 PDF로 묶는 이미지 툴이에요." },
  text: { name: "글쓰기", desc: "자기소개서, 리포트, 블로그 글을 쓸 때 필요한 글쓰기 툴이에요." },
  calc: { name: "생활 계산", desc: "D-day처럼 생활에서 자주 찾는 계산을 바로 해 주는 툴이에요." },
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
  { id: "dday", cat: "calc", path: "/calc/d-day/", title: "디데이 계산기", seo: "디데이 계산기 (D-day 계산) — 무료", h1: "디데이 계산기 — D-day, 날짜 사이 일수, 기념일", desc: "목표일까지 남은 날(D-day)과 두 날짜 사이의 일수를 계산하고, 100일·1000일 같은 기념일 날짜를 한 번에 보여 드려요.", hook: "시험·전역·기념일까지 며칠? 100일·1000일도.", meta: "날짜 두 개", kw: "d-day 디데이 날짜 계산 기념일 100일 1000일 며칠 남았는지 일수" },
  { id: "age", cat: "calc", path: "/calc/age/", title: "만 나이 계산기", seo: "만 나이 계산기 — 무료, 연 나이·세는 나이까지", h1: "만 나이 계산기 — 만 나이, 연 나이, 다음 생일까지", desc: "생년월일을 넣으면 오늘 기준 만 나이와 연 나이, 한국식 세는 나이, 다음 생일까지 남은 날을 계산해 드려요. 2023년 만 나이 통일법 안내도 함께 정리했어요.", hook: "생년월일만 넣으면 만 나이·연 나이·세는 나이.", meta: "생년월일", kw: "만나이 만 나이 나이 계산 연나이 세는나이 한국나이 생일 몇살 통일법" },
  { id: "pyeong", cat: "calc", path: "/calc/pyeong/", title: "평수 계산기", seo: "평수 계산기 — 무료, ㎡ 평 변환", h1: "평수 계산기 — 제곱미터(㎡) ↔ 평 변환", desc: "제곱미터(㎡)와 평을 양방향으로 바꾸고, 59㎡·84㎡처럼 자주 찾는 면적을 표로 보여 드려요. 전용면적과 공급면적의 차이도 정리했어요.", hook: "㎡를 평으로, 평을 ㎡로. 84㎡는 몇 평?", meta: "1평 = 3.3058㎡", kw: "평수 평 제곱미터 m2 ㎡ 면적 변환 아파트 전용면적 공급면적 평형" },
  { id: "pdf2img", cat: "pdf", also: ["image"], path: "/pdf/pdf-to-jpg/", title: "PDF JPG 변환", seo: "PDF JPG 변환 — 무료, PDF를 이미지로", h1: "PDF JPG 변환 — PDF 페이지를 JPG·PNG 이미지로", desc: "PDF의 각 페이지를 JPG나 PNG 이미지로 바꾸고, 해상도를 고르고, zip으로 한 번에 받을 수 있어요. 파일은 서버로 전송하지 않습니다.", hook: "PDF 한 쪽씩 JPG·PNG 이미지로.", meta: "JPG·PNG · zip", kw: "pdf jpg 변환 pdf 이미지 png 그림 사진 페이지 캡처 pdf를 jpg로" },
];
const UTIL_RANK = ["pdfmerge", "img2pdf", "pdf2img", "charcount", "imgcompress", "pdfsplit", "age", "pyeong", "word2pdf", "dday"];
const NEXT = {
  pdfmerge: ["pdfsplit", "img2pdf", "imgcompress"],
  pdfsplit: ["pdfmerge", "pdf2img", "img2pdf"],
  img2pdf: ["pdfmerge", "imgcompress", "pdfsplit"],
  word2pdf: ["pdfmerge", "charcount", "pdfsplit"],
  imgcompress: ["img2pdf", "pdfmerge", "charcount"],
  charcount: ["word2pdf", "dday", "pdfmerge"],
  dday: ["age", "charcount", "today"],
  age: ["dday", "pyeong", "today"],
  pyeong: ["age", "dday", "charcount"],
  pdf2img: ["imgcompress", "img2pdf", "pdfsplit"],
};
const utilById = Object.fromEntries(UTILS.map((x) => [x.id, x]));
const anyById = { ...toolById, ...utilById };
const catName = (k) => (UCATS[k] || CATS[k]).name;

// ---------- 공통 조각 ----------
const DISCLAIMER = "툴로 만든 결과물은 원본과 함께 확인한 뒤 사용해 주세요. 펭귄 놀이터의 테스트와 운세는 재미로 보는 콘텐츠이며, 의학·심리·재정·법률적 판단의 근거가 될 수 없어요.";
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
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
const adSlot = (name) =>
  cfg.adsenseClient
    ? `<div class="ad" aria-label="광고"><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(cfg.adsenseClient)}" data-ad-format="auto" data-full-width-responsive="true" data-slot-name="${name}"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`
    : "";
// 툴 페이지용: 광고 높이를 미리 확보(CLS 방지). 광고 코드가 없으면 출력하지 않음
const adSlotFixed = (name) =>
  cfg.adsenseClient
    ? `<div class="ad ad-fixed" aria-label="광고"><ins class="adsbygoogle" style="display:block;min-height:250px" data-ad-client="${esc(cfg.adsenseClient)}" data-ad-format="auto" data-full-width-responsive="true" data-slot-name="${name}"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`
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

// 기존 콘텐츠(놀이터) 경로면 「홈 › 펭귄 놀이터 › …」로 위치를 보여 줌
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

// ---------- 서랍 시스템 (P2-14): 홈·카테고리·놀이터가 같은 부품을 씀 ----------
// 서랍(drawer) = 흰 바탕 상자 + 카테고리 색 손잡이·머리글. 안에는 툴 행(row: 아이콘 + 이름 + 한 줄 설명)
// 행 목록이라 툴이 몇 개든 빈칸이 생기지 않고, 서랍들은 CSS 다단(column)으로 높이를 맞춰 흘려 넣음
const rowHtml = (x) =>
  `<li><a class="row" href="${u(x.path)}"><span class="row-art">${ART[x.id]}</span><span class="row-body"><b>${esc(x.title)}${x.beta ? ' <em class="beta">베타</em>' : ""}</b><small>${esc(x.hook)}</small></span><span class="row-go" aria-hidden="true">›</span></a></li>`;
const drawerHtml = ({ tone, name, href = "", sub = "", tools, extra = "", tag = "h2" }) =>
  `<section class="drawer t-${tone}"><header class="drawer-head"><span class="drawer-pull" aria-hidden="true"></span><${tag} class="drawer-name">${href ? `<a href="${u(href)}">${esc(name)}</a>` : esc(name)}</${tag}><small>${tools.length}개</small>${sub ? `<p>${esc(sub)}</p>` : ""}</header><ul class="rows">${tools.map(rowHtml).join("")}</ul>${extra}</section>`;
const utilsIn = (k) => UTIL_RANK.map((id) => utilById[id]).filter((x) => x.cat === k || (x.also || []).includes(k));
const recoRows = (ids, heading) => `<section class="reco"><h2>${heading}</h2><ul class="rows rows-flow">${ids.map((id) => rowHtml(anyById[id])).join("")}</ul></section>`;

const shareBar = (opts = {}) =>
  `<div class="share" data-share-title="${esc(opts.title || "")}" data-share-text="${esc(opts.text || "")}" data-share-path="${esc(opts.path || "")}">
  <button type="button" class="btn" data-act="share">공유하기</button>
  <button type="button" class="btn ghost" data-act="copy">링크 복사</button>
  <button type="button" class="btn ghost" data-act="image">결과 이미지 저장</button>
</div>`;

function layout({ title, desc, path: p, body, scripts = [], jsonld = [], noindex = false, ogType = "website", fullTitle = false, wide = false, csp = false, vendor = [] }) {
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
    <a class="logo" href="${u("/")}">${LOGO(34)}${esc(cfg.siteName)}</a>
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
    <p class="copy">© ${new Date().getFullYear()} ${esc(cfg.operator)} · ${esc(cfg.siteName)}</p>
  </div>
</footer>
<script src="${u("/assets/app.js")}" defer></script>
${vendor.map((s) => `<script src="${u(`/assets/vendor/${s}`)}" defer></script>`).join("\n")}
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

// 홈 — 「펭귄 공구함」: 검색 + 카테고리 서랍(열)마다 툴 행. 툴이 늘면 행만 늘어남. 놀이터는 한 줄 띠(20% 이하)
const SEARCH_INDEX = [
  ...UTILS.map((x) => ({ t: x.title, p: u(x.path), c: catName(x.cat), k: `${x.kw} ${x.hook}`, b: x.beta ? 1 : 0 })),
  ...TOOLS.map((x) => ({ t: x.title, p: u(x.path), c: `${PLAY.name} · ${CATS[x.cat].name}`, k: x.hook })),
];
const byUtilRank = UTIL_RANK.map((id) => utilById[id]);
{
  const body = `
<section class="hero hero-tools">
  <div class="hero-text">
    <p class="hero-kicker">펭귄 공구함 · 툴 ${UTILS.length}개</p>
    <h1>자주 쓰는 툴, <br>설치 없이 바로</h1>
    <p class="lead">PDF·이미지·글쓰기·생활 계산 툴을 서랍별로 정리해 두었어요. 가입 없이 쓰고, 파일은 서버로 전송하지 않습니다.</p>
  </div>
  <form class="search" role="search" action="${u("/")}">
    <label for="tool-q">어떤 툴을 찾으세요?</label>
    <div class="search-row"><input id="tool-q" type="search" placeholder="예: pdf 합치기, 글자수, 만 나이" autocomplete="off" aria-controls="tool-hits" aria-describedby="tool-hits-n"><span class="search-ico" aria-hidden="true"></span></div>
    <p class="hint" id="tool-hits-n" aria-live="polite"></p>
    <ul class="hits" id="tool-hits" hidden></ul>
  </form>
</section>
<script type="application/json" id="tool-index">${JSON.stringify(SEARCH_INDEX).replace(/</g, String.fromCharCode(92) + "u003c")}</script>

<section class="toolbox" aria-labelledby="toolbox-h">
  <h2 class="sr" id="toolbox-h">툴 서랍</h2>
  <div class="drawers">${Object.entries(UCATS).map(([k, c]) => drawerHtml({ tone: k, name: c.name, href: `/${k}/`, tools: utilsIn(k), tag: "h3" })).join("")}</div>
</section>

<section class="home-block play-strip t-arcade" aria-labelledby="play-h">
  <header class="drawer-head"><span class="drawer-pull" aria-hidden="true"></span><h2 class="drawer-name" id="play-h"><a href="${u(PLAY.path)}">${esc(PLAY.name)}</a></h2><p>잠깐 쉬어 갈 때 · 오늘 / 테스트 / 게임</p><a class="more" href="${u(PLAY.path)}">전체 보기 ›</a></header>
  <ul class="rows rows-flow">${["today", "personality", "life"].map((id) => rowHtml(toolById[id])).join("")}</ul>
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

// 펭귄 놀이터 허브 — 같은 서랍 시스템으로 「오늘 / 테스트 / 게임」 3구역. 기존 주소는 그대로
const ZONES = [
  { tone: "luck", name: "오늘", sub: "매일 자정에 바뀌는 운세", ids: ["today"] },
  { tone: "me", name: "테스트", sub: "생일·성향·이름으로 보는 나", ids: ["birthday", "personality", "namematch"] },
  { tone: "story", name: "게임", sub: "한 판이면 끝나는 짧은 게임", ids: ["life", "reaction"] },
];
{
  const items = [["홈", "/"], [PLAY.name, PLAY.path]];
  const extra = {
    오늘: `<div class="drawer-extra"><p class="hint">띠를 누르면 오늘 운세로 바로 가요.</p><div class="mini-stamps">${TTI_KEYS.map((k) => `<a href="${u(`/luck/today/#${k}`)}" title="${esc(tti[k].name)} 오늘의 운세"><b>${esc(tti[k].hanja)}</b>${esc(tti[k].name.replace(/띠$/, ""))}</a>`).join("")}</div></div>`,
    테스트: `<details class="drawer-extra"><summary>해설 모아 보기 (띠별 성격 · 별자리 · 16유형)</summary><div class="chips">${TTI_KEYS.map((k) => `<a class="chip" href="${u(`/me/tti/${k}/`)}">${esc(tti[k].name)}</a>`).join("")}</div><div class="chips">${ZODIAC_KEYS.map((k) => `<a class="chip" href="${u(`/me/zodiac/${k}/`)}">${esc(zodiac[k].name)}</a>`).join("")}</div><div class="chips">${TYPE_KEYS.map((k) => `<a class="chip" href="${u(`/me/personality/${k.toLowerCase()}/`)}">${k}</a>`).join("")}</div></details>`,
    게임: `<details class="drawer-extra"><summary>1분 인생 엔딩 5가지</summary><div class="chips">${LIFE_KEYS.map((k) => `<a class="chip" href="${u(`/story/life/${LIFE_SLUG[k]}/`)}">${esc(guides.lifeTypes[k].name)}</a>`).join("")}</div></details>`,
  };
  const pool = ZONES.flatMap((z) => z.ids);
  const body = `${crumbHtml(items)}
<header class="page-head play-head">
  <span class="eyebrow">오늘 · 테스트 · 게임</span>
  <h1>${esc(PLAY.name)}</h1>
  <p class="lead">${esc(PLAY.desc)} 가입은 필요 없고, 입력한 건 어디에도 저장하지 않아요.</p>
  <div class="hero-actions"><button class="btn" type="button" data-act="draw">아무거나 한 판</button><span class="fun-badge">놀이터의 모든 테스트와 운세는 재미로 보는 콘텐츠예요</span></div>
  <ul hidden data-draw-pool>${pool.map((id) => `<li><a href="${u(toolById[id].path)}">${esc(toolById[id].title)}</a></li>`).join("")}</ul>
</header>
<div class="drawers drawers-3">${ZONES.map((z) => drawerHtml({ tone: z.tone, name: z.name, sub: z.sub, tools: z.ids.map((id) => toolById[id]), extra: extra[z.name] })).join("")}</div>
${recoRows(["charcount", "dday", "pdfmerge"], "쉬었다면, 일하러 갈 때 쓰는 툴")}
${adSlot("play")}`;
  write(PLAY.path, layout({ title: `${PLAY.name} — 운세·성격 테스트·짧은 게임`, wide: true, scripts: ["home.js"], desc: `${PLAY.desc} 오늘의 띠별 운세, 생일로 보는 나, 16유형 성격 테스트, 이름 궁합, 1분 인생, 반응속도 게임.`, path: PLAY.path, body, jsonld: [crumbs(items)] }));
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
<header class="page-head"><span class="eyebrow">${esc(PLAY.name)}</span><h1>${esc(c.name)}</h1><p class="lead">${esc(c.desc)}</p></header>
<div class="drawers drawers-1">${drawerHtml({ tone: k, name: c.name, tools: list })}</div>
${CAT_EXTRA[k]()}
${recoRows(TOOLS.filter((x) => x.cat !== k).map((x) => x.id), "놀이터의 다른 콘텐츠")}`;
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

// ---------- 펭귄 툴즈 실용 툴 ----------
// 실용 툴 카테고리 페이지 (/pdf/ /image/ /text/ /calc/)
for (const [k, c] of Object.entries(UCATS)) {
  const list = UTILS.filter((x) => x.cat === k || (x.also || []).includes(k));
  const items = [["홈", "/"], [c.name, `/${k}/`]];
  const body = `${crumbHtml(items)}
<header class="page-head"><span class="eyebrow">펭귄 공구함</span><h1>${esc(c.name)} 툴</h1><p class="lead">${esc(c.desc)} ${esc(SAFE)}</p></header>
<div class="drawers drawers-1 open">${drawerHtml({ tone: k, name: `${c.name} 서랍`, tools: utilsIn(k) })}</div>
<section class="reco"><h2>다른 서랍</h2><div class="drawers drawers-mini">${Object.entries(UCATS).filter(([kk]) => kk !== k).map(([kk, cc]) => drawerHtml({ tone: kk, name: cc.name, href: `/${kk}/`, tools: utilsIn(kk), tag: "h3" })).join("")}</div></section>`;
  write(`/${k}/`, layout({ title: `${c.name} 툴 — 무료`, desc: `${c.name} 툴 모음: ${list.map((x) => x.title).join(", ")}. ${c.desc}`, path: `/${k}/`, body, jsonld: [crumbs(items)] }));
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
const nextHtml = (id, hidden) => `<nav class="tk-next" aria-label="다음 툴"${hidden ? " hidden" : ""}><b>다음으로 많이 쓰는 툴</b>${NEXT[id].map((x) => `<a class="chip" href="${u(anyById[x].path)}">${esc(anyById[x].title)}</a>`).join("")}</nav>`;

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
    <h1>${esc(tool.h1)}</h1>
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

// 오픈소스 고지
{
  const p = "/licenses/";
  const libs = [
    ["pdf-lib", "1.17.1", "MIT", "https://github.com/Hopding/pdf-lib", "PDF 합치기 · PDF 나누기 · JPG PDF 변환"],
    ["mammoth", "1.13.0", "BSD-2-Clause", "https://github.com/mwilliamson/mammoth.js", "워드 PDF 변환(간단)"],
    ["fflate", "0.8.3", "MIT", "https://github.com/101arrowz/fflate", "PDF 나누기 · 이미지 용량 줄이기 · PDF JPG 변환의 zip 묶기"],
    ["pdf.js (pdfjs-dist, legacy build)", "6.4.299", "Apache-2.0", "https://github.com/mozilla/pdf.js", "PDF JPG 변환 (함께 둔 CMap: Adobe BSD-3, 이미지 디코더 wasm: OpenJPEG BSD-2·PDFium BSD-3·qcms MIT, ICC: CC0)"],
  ];
  const body = `${crumbHtml([["홈", "/"], ["오픈소스 고지", p]])}<article class="prose doc"><h1>오픈소스 고지</h1>
<p>${esc(cfg.siteName)}의 일부 툴은 아래 오픈소스 소프트웨어를 사용합니다. 라이브러리 파일은 공식 배포본(npm 패키지)을 고치지 않고 이 사이트에 직접 올려 두었고, 해당 툴 페이지에서만 불러옵니다. 외부 CDN에서 불러오지 않습니다.</p>
<div class="table-wrap"><table class="lic"><thead><tr><th scope="col">라이브러리</th><th scope="col">버전</th><th scope="col">라이선스</th><th scope="col">쓰는 곳</th></tr></thead><tbody>${libs.map(([n, v, l, url, where]) => `<tr><th scope="row"><a href="${url}" rel="noopener">${n}</a></th><td>${v}</td><td>${l}</td><td>${esc(where)}</td></tr>`).join("")}</tbody></table></div>
<p>각 라이브러리에 함께 묶여 있는 하위 라이브러리(pako, jszip, underscore 등)와 라이선스 전문은 <a href="${u("/assets/vendor/LICENSES.txt")}">라이선스 전문(LICENSES.txt)</a>에서 확인할 수 있어요. jszip은 MIT와 GPLv3 이중 라이선스이며, ${esc(cfg.siteName)}는 MIT 조건으로 사용합니다. GPL·AGPL 조건으로만 쓸 수 있는 코드는 사용하지 않습니다.</p>
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
  const body = `${crumbHtml([["홈", "/"], [d.title, p]])}<article class="prose doc"><h1>${t(d.title)}</h1>${extra}${blocks(d.body, "h2")}</article>`;
  write(p, layout({ title: fill(d.title), desc: `${cfg.siteName} ${fill(d.title)}`, path: p, body }));
}
// 작성·검수 기준
{
  const p = "/editorial/";
  const body = `${crumbHtml([["홈", "/"], ["작성·검수 기준", p]])}<article class="prose doc"><h1>작성·검수 기준</h1>
<p>${esc(cfg.siteName)}는 「필요한 일을 빨리 끝내되, 대충 만들지 않는다」를 원칙으로 툴과 콘텐츠를 만들어요. 모든 툴 설명과 놀이터 해설은 아래 기준을 거쳐 공개합니다.</p>
<h2>0. 툴은 실제 파일로 확인하고, 한계를 적어요</h2><p>툴은 공개 전에 실제 PDF·이미지·워드 파일로 끝까지 실행해 결과 파일이 열리는지, 쪽수와 이미지 크기가 맞는지 확인합니다. 툴마다 사용법, 예시, 자주 묻는 질문과 함께 할 수 없는 것(한계)을 적고, 원본 모양을 그대로 재현하지 못하는 툴에는 「베타」와 경고를 붙여요. 툴에 넣은 파일은 서버로 전송하지 않습니다.</p>
<h2>1. 직접 쓰고 사람이 검수해요</h2><p>툴 설명, 해설과 운세 문구는 다른 사이트의 문장을 옮기지 않고 직접 작성합니다. 초안 작성에 도구의 도움을 받더라도, 공개 전에 운영자가 한 문장씩 읽고 사실관계와 표현을 확인해요.</p>
<h2>2. 단정하지 않아요</h2><p>운세와 성격 해설은 「~할 수 있어요」, 「참고해 보세요」처럼 가능성으로 표현합니다. 건강이 좋아진다거나 돈이 들어온다는 식의 결과를 보장하는 문구, 특정 관계를 맺거나 끊으라고 권하는 문구는 쓰지 않아요.</p>
<h2>3. 계산은 투명하게 공개해요</h2><p>만 나이, 띠, 별자리, 이름 궁합, 반응속도처럼 계산이 들어가는 도구는 각 페이지의 「결과 해석 가이드」에 계산 방식을 적어 둡니다. 띠는 입춘 기준, 별자리는 일반적으로 쓰이는 날짜 구간을 따르며 경계 날짜는 해마다 하루쯤 달라질 수 있어요.</p>
<h2>4. 개인정보를 받지 않아요</h2><p>생년월일과 이름은 사용자의 브라우저 안에서만 계산하고 서버로 보내거나 저장하지 않습니다. 공유 링크와 공유 이미지에도 입력한 이름이나 생년월일은 들어가지 않아요.</p>
<h2>5. 권리를 존중해요</h2><p>실존 인물의 사진이나 다른 서비스의 이미지·게임 규칙·명칭을 가져다 쓰지 않습니다. 16유형 성격 테스트는 대중적인 4축 모델을 참고한 자체 제작 간이 테스트이며 공식 검사와 무관해요.</p>
<h2>6. 고칠 점은 바로 고쳐요</h2><p>잘못된 내용이나 불편한 표현을 발견하셨다면 <a href="${u("/contact/")}">문의</a>로 알려 주세요. 확인 후 빠르게 수정하겠습니다.</p>
<p class="hint">운영: ${esc(cfg.operator)}</p></article>`;
  write(p, layout({ title: "작성·검수 기준", desc: `${cfg.siteName}가 테스트와 해설을 만들고 검수하는 기준을 소개합니다.`, path: p, body }));
}

// 404
write("/404.html", layout({ title: "페이지를 찾을 수 없어요", desc: "요청하신 페이지를 찾을 수 없어요.", path: "/404.html", noindex: true, body: `<section class="hero"><h1>앗, 길을 잃었어요</h1><p class="lead">주소가 바뀌었거나 없는 페이지예요. 대신 많이 쓰는 툴로 가 보세요.</p></section>${recoHtml(["pdfmerge", "img2pdf", "charcount", "today"], "많이 쓰는 툴")}` }));

// sitemap / robots / rss
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap.map((p) => `  <url><loc>${abs(p)}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${abs("/sitemap.xml")}\n`);
const rssItems = [...UTILS.map((x) => [x.title, x.path, x.desc]), ...TOOLS.map((x) => [x.title, x.path, x.desc]), ...TYPE_KEYS.map((k) => [`${personality[k].name}(${k}) 성격 특징`, `/me/personality/${k.toLowerCase()}/`, fill(personality[k].summary)])];
fs.writeFileSync(path.join(DIST, "rss.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${esc(cfg.siteName)}</title><link>${abs("/")}</link><description>${esc(cfg.tagline)}</description><language>ko</language>\n${rssItems.map(([ti, p, d]) => `<item><title>${esc(ti)}</title><link>${abs(p)}</link><guid>${abs(p)}</guid><description>${esc(d)}</description><pubDate>${new Date().toUTCString()}</pubDate></item>`).join("\n")}\n</channel></rss>\n`);
if (cfg.adsenseClient) fs.writeFileSync(path.join(DIST, "ads.txt"), `google.com, ${cfg.adsenseClient.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`);

console.log(`✔ 빌드 완료: ${sitemap.length}개 색인 페이지 → dist/  (SITE_URL=${cfg.siteUrl})`);
if (warnings.length) console.log("⚠ 확인 필요:\n  " + warnings.join("\n  "));
