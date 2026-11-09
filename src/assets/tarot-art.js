"use strict";
// P2-58 무료 타로 카드 그림 — 22장 앞면 + 뒷면 1종을 SVG 코드로 직접 그림(사이트 톤: 굵은 검정 선, 노랑·빨강·초록·파랑, 단순한 기하 상징).
// 기존 타로 덱(라이더-웨이트 등)의 그림을 본뜨지 않음. 카드마다 이름의 일반적인 뜻을 도형 하나로 나타냄
// (예: 바보 = 낭떠러지 앞 점선 도약, 운명의 수레바퀴 = 8칸 바퀴, 죽음 = 지는 해와 새싹).
// 화면(tarot.js)·결과 이미지(canvas)·빌드 검사가 같은 파일을 씀. tarot-data.js(TAROTDATA)를 먼저 불러야 함
(function (root) {
  const K = "#141414", W = "#fff", RED = "#e5372b", YEL = "#ffc21a", GRN = "#1e9e5a", BLU = "#2346d8", SOFT = "#f2f1ec";
  const s = (w) => `stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const star = (cx, cy, ro, ri, n, fill, extra = "") => {
    const p = [];
    for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = (Math.PI * i) / n - Math.PI / 2; p.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`); }
    return `<polygon points="${p.join(" ")}" fill="${fill}" ${extra}/>`;
  };
  const heart = (cx, cy, r, fill, sw = 3) => `<path d="M${cx} ${cy + r * 1.1}L${cx - r * 1.05} ${cy}A${r * 0.55} ${r * 0.55} 0 0 1 ${cx} ${cy - r * 0.75}A${r * 0.55} ${r * 0.55} 0 0 1 ${cx + r * 1.05} ${cy}Z" fill="${fill}" ${s(sw)}/>`;
  const sectors = (cx, cy, r, cols) => cols.map((c, i) => {
    const a0 = (2 * Math.PI * i) / cols.length - Math.PI / 2, a1 = (2 * Math.PI * (i + 1)) / cols.length - Math.PI / 2;
    return `<path d="M${cx} ${cy}L${(cx + r * Math.cos(a0)).toFixed(1)} ${(cy + r * Math.sin(a0)).toFixed(1)}A${r} ${r} 0 0 1 ${(cx + r * Math.cos(a1)).toFixed(1)} ${(cy + r * Math.sin(a1)).toFixed(1)}Z" fill="${c}" ${s(3)}/>`;
  }).join("");
  const rays = (cx, cy, r0, r1, n, fill, w) => Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n, b = Math.PI / n * 0.45;
    const P = (r, t) => `${(cx + r * Math.cos(t)).toFixed(1)} ${(cy + r * Math.sin(t)).toFixed(1)}`;
    return `<path d="M${P(r0, a - b)}L${P(r1, a)}L${P(r0, a + b)}Z" fill="${fill}" ${s(w)}/>`;
  }).join("");

  // 그림 칸: x 12~108, y 34~154 (가운데 60, 94). [배경색, 그림]
  const ART = [
    /* 0 바보: 낭떠러지 끝에서 점선으로 뛰어오르는 공, 멀리 해 */ [SOFT, `<circle cx="88" cy="60" r="13" fill="${YEL}" ${s(3)}/><path d="M12 154V120H52V154" fill="${K}"/><path d="M44 110Q72 52 100 128" fill="none" stroke="${RED}" stroke-width="4" stroke-dasharray="1 9" stroke-linecap="round"/><circle cx="42" cy="110" r="8" fill="${RED}" ${s(3)}/>${star(98, 132, 7, 3, 4, BLU)}`],
    /* 1 마법사: 무한대 기호 + 지팡이 + 네 가지 도형(원·세모·네모·십자) */ [YEL, `<path d="M42 58c0-12 18-12 18 0s18 12 18 0-18-12-18 0-18 12-18 0z" fill="none" ${s(5)}/><path d="M60 76V144" ${s(6)}/><circle cx="60" cy="76" r="5" fill="${W}" ${s(3)}/><circle cx="32" cy="100" r="9" fill="${RED}" ${s(3)}/><path d="M88 90l10 18H78z" fill="${GRN}" ${s(3)}/><rect x="23" y="122" width="18" height="18" fill="${W}" ${s(3)}/><path d="M88 120v22M77 131h22" ${s(5)}/>`],
    /* 2 여사제: 닫힌 책 + 작은 초승달 + 휘장 선 */ [SOFT, `<path d="M12 34Q36 60 22 154M108 34Q84 60 98 154" fill="none" stroke="${BLU}" stroke-width="5"/><circle cx="60" cy="62" r="15" fill="${BLU}" ${s(3)}/><circle cx="67" cy="57" r="13" fill="${SOFT}"/><rect x="36" y="92" width="48" height="40" rx="3" fill="${W}" ${s(4)}/><path d="M60 92V132" ${s(3)}/><path d="M68 132v14l4-4 4 4v-14" fill="${RED}" ${s(2.5)}/>`],
    /* 3 여황제: 금성 기호 + 두 잎 */ [GRN, `<circle cx="60" cy="68" r="20" fill="${YEL}" ${s(4)}/><path d="M60 88V130M46 110H74" ${s(6)}/><path d="M60 142q-26-2-32-24q24 0 32 24z" fill="${W}" ${s(3)}/><path d="M60 142q26-2 32-24q-24 0-32 24z" fill="${W}" ${s(3)}/>${star(60, 68, 7, 3, 5, RED)}`],
    /* 4 황제: 네모 받침 + 왕관 */ [RED, `<path d="M34 88V64l13 12 13-18 13 18 13-12v24z" fill="${YEL}" ${s(4)}/><rect x="32" y="92" width="56" height="50" fill="${W}" ${s(4)}/><rect x="46" y="104" width="28" height="26" fill="${YEL}" ${s(3)}/><path d="M46 117h28M60 104v26" ${s(3)}/>`],
    /* 5 교황: 아치 문 + 열쇠 구멍 + 점 세 개 */ [SOFT, `<path d="M34 146V90a26 26 0 0 1 52 0V146z" fill="${BLU}" ${s(4)}/><circle cx="60" cy="100" r="8" fill="${YEL}" ${s(2.5)}/><path d="M55 106l-3 22h16l-3-22z" fill="${YEL}" ${s(2.5)}/><circle cx="42" cy="50" r="5" fill="${RED}" ${s(2.5)}/><circle cx="60" cy="44" r="5" fill="${RED}" ${s(2.5)}/><circle cx="78" cy="50" r="5" fill="${RED}" ${s(2.5)}/><path d="M24 146h72" ${s(4)}/>`],
    /* 6 연인: 겹친 두 원 + 하트 */ [YEL, `<circle cx="46" cy="82" r="24" fill="${RED}" ${s(4)}/><circle cx="74" cy="82" r="24" fill="${W}" fill-opacity=".85" ${s(4)}/>${heart(60, 128, 12, RED)}`],
    /* 7 전차: 수레 + 두 바퀴 + 위쪽 화살표 */ [BLU, `<path d="M40 60L60 44 80 60" fill="none" stroke="${W}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><rect x="30" y="74" width="60" height="38" rx="4" fill="${YEL}" ${s(4)}/>${star(60, 93, 9, 4, 5, RED, s(2))}<circle cx="42" cy="122" r="13" fill="${W}" ${s(4)}/><circle cx="78" cy="122" r="13" fill="${W}" ${s(4)}/><circle cx="42" cy="122" r="3.5" fill="${K}"/><circle cx="78" cy="122" r="3.5" fill="${K}"/>`],
    /* 8 힘: 꽃잎 갈기 + 가운데 하트(부드러운 힘) */ [YEL, `${Array.from({ length: 12 }, (_, i) => `<ellipse cx="60" cy="62" rx="7" ry="13" fill="${RED}" ${s(3)} transform="rotate(${i * 30} 60 94)"/>`).join("")}<circle cx="60" cy="94" r="22" fill="${W}" ${s(4)}/>${heart(60, 94, 9, RED)}`],
    /* 9 은둔자: 별이 든 등불 + 언덕 */ [K, `<path d="M60 44v12" stroke="${W}" stroke-width="3"/><path d="M47 58h26l-4 10H51z" fill="${W}"/><rect x="45" y="70" width="30" height="40" rx="4" fill="${YEL}" stroke="${W}" stroke-width="3"/>${star(60, 90, 9, 4, 5, RED)}<rect x="49" y="110" width="22" height="6" fill="${W}"/><path d="M30 84h-10M100 84H90M36 64l-7-6M84 64l7-6M36 106l-7 6M84 106l7 6" stroke="${YEL}" stroke-width="3" stroke-linecap="round"/><path d="M12 150q48-22 96 0" fill="none" stroke="${W}" stroke-width="3"/>`],
    /* 10 운명의 수레바퀴: 8칸 바퀴 */ [SOFT, `${sectors(60, 94, 40, [YEL, RED, BLU, GRN, YEL, RED, BLU, GRN])}<circle cx="60" cy="94" r="40" fill="none" ${s(5)}/><circle cx="60" cy="94" r="9" fill="${W}" ${s(3)}/><path d="M60 42l-6-8h12z" fill="${K}"/>`],
    /* 11 정의: 저울 */ [GRN, `<path d="M60 54V138M28 66H92" ${s(5)}/><rect x="42" y="136" width="36" height="9" fill="${K}"/><circle cx="60" cy="52" r="6" fill="${YEL}" ${s(3)}/><path d="M28 66l-10 34M28 66l10 34M92 66l-10 34M92 66l10 34" ${s(2.5)}/><path d="M14 100h28a14 9 0 0 1-28 0z" fill="${YEL}" ${s(3)}/><path d="M78 100h28a14 9 0 0 1-28 0z" fill="${YEL}" ${s(3)}/>`],
    /* 12 매달린 사람: 가로대에 매달린 역삼각형 + 둥근 빛 */ [SOFT, `<path d="M22 48H98" ${s(7)}/><path d="M60 48V66" ${s(3)}/><path d="M34 66H86L60 112z" fill="${BLU}" ${s(4)}/><circle cx="60" cy="128" r="13" fill="${YEL}" ${s(4)}/><path d="M42 128h-10M88 128H78M60 148v-4" ${s(3)}/>`],
    /* 13 죽음(변화): 지는 해 + 물결 + 새싹 */ [RED, `<rect x="12" y="118" width="96" height="36" fill="${BLU}"/><path d="M28 118a32 32 0 0 1 64 0z" fill="${YEL}" ${s(4)}/><path d="M12 118H108" ${s(4)}/><path d="M22 132q8-5 16 0t16 0 16 0 16 0 16 0" fill="none" stroke="${W}" stroke-width="3"/><path d="M60 72V50" stroke="${GRN}" stroke-width="5" stroke-linecap="round"/><path d="M60 58q-14-2-16-14q14 0 16 14zM60 54q14-2 16-14q-14 0-16 14z" fill="${GRN}" ${s(2.5)}/>`],
    /* 14 절제: 두 잔 사이를 흐르는 물 */ [BLU, `<path d="M22 54h30l-5 30H27z" fill="${YEL}" ${s(4)}/><path d="M68 104h30l-5 30H73z" fill="${YEL}" ${s(4)}/><path d="M50 64C70 70 58 94 80 104" fill="none" stroke="${W}" stroke-width="6" stroke-linecap="round"/><circle cx="66" cy="76" r="3" fill="${W}"/><circle cx="74" cy="90" r="3" fill="${W}"/><path d="M20 146h80" stroke="${W}" stroke-width="3" stroke-linecap="round"/>`],
    /* 15 악마: 이어진 사슬 세 고리 + 빨간 뿔 두 개 */ [K, `<path d="M36 70l8-24 8 24zM68 70l8-24 8 24z" fill="${RED}" stroke="${W}" stroke-width="3" stroke-linejoin="round"/><ellipse cx="36" cy="104" rx="15" ry="9" fill="none" stroke="${YEL}" stroke-width="6"/><ellipse cx="60" cy="104" rx="9" ry="15" fill="none" stroke="${W}" stroke-width="6"/><ellipse cx="84" cy="104" rx="15" ry="9" fill="none" stroke="${YEL}" stroke-width="6"/>`],
    /* 16 탑: 번개 맞은 탑 */ [BLU, `<path d="M42 74V60h8v7h6v-7h8v7h6v-7h8v14z" fill="${W}" ${s(4)}/><rect x="45" y="74" width="30" height="72" fill="${W}" ${s(4)}/><rect x="55" y="94" width="10" height="14" fill="${K}"/><path d="M62 74l-6 12 7 8-5 12" fill="none" ${s(3)}/><path d="M92 36L74 66h10L66 94l28-36H84l10-22z" fill="${YEL}" ${s(3)}/><path d="M18 146H102" stroke="${W}" stroke-width="3"/>`],
    /* 17 별: 큰 8각 별 + 작은 별 + 물결 */ [K, `${star(60, 84, 34, 13, 8, YEL, `stroke="${W}" stroke-width="2.5" stroke-linejoin="round"`)}${star(26, 50, 7, 2.5, 4, W)}${star(94, 48, 6, 2.2, 4, W)}${star(24, 116, 5, 2, 4, W)}${star(96, 114, 7, 2.5, 4, W)}<path d="M16 140q11-8 22 0t22 0 22 0 22 0" fill="none" stroke="${BLU}" stroke-width="5" stroke-linecap="round"/>`],
    /* 18 달: 큰 초승달 + 물방울 + 두 물결 */ [BLU, `<circle cx="58" cy="70" r="26" fill="${YEL}" ${s(3)}/><circle cx="70" cy="62" r="22" fill="${BLU}"/><path d="M40 104q4 8 0 10q-4-2 0-10zM60 108q4 8 0 10q-4-2 0-10zM80 104q4 8 0 10q-4-2 0-10z" fill="${W}"/><path d="M16 128q11-8 22 0t22 0 22 0 22 0M16 144q11-8 22 0t22 0 22 0 22 0" fill="none" stroke="${W}" stroke-width="4" stroke-linecap="round"/>`],
    /* 19 태양: 해 + 빛살 */ [SOFT, `${rays(60, 94, 28, 46, 12, RED, 3)}<circle cx="60" cy="94" r="27" fill="${YEL}" ${s(4)}/><circle cx="60" cy="94" r="10" fill="${W}" ${s(3)}/>`],
    /* 20 심판: 나팔 + 소리 물결 + 올라가는 화살표 */ [GRN, `<rect x="18" y="66" width="10" height="14" rx="2" fill="${W}" ${s(3)}/><path d="M28 70L80 54a6 19 0 0 1 0 38L28 76z" fill="${YEL}" ${s(4)}/><path d="M90 60q8 13 0 26M98 54q12 19 0 38" fill="none" stroke="${W}" stroke-width="4" stroke-linecap="round"/><path d="M36 146v-26m-8 8l8-8 8 8M60 146v-26m-8 8l8-8 8 8M84 146v-26m-8 8l8-8 8 8" fill="none" stroke="${W}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`],
    /* 21 세계: 초록 고리 + 가운데 4각 별 + 네 귀퉁이 점 */ [SOFT, `<circle cx="60" cy="94" r="34" fill="none" stroke="${K}" stroke-width="15"/><circle cx="60" cy="94" r="34" fill="none" stroke="${GRN}" stroke-width="9"/><circle cx="60" cy="94" r="34" fill="none" stroke="${W}" stroke-width="2" stroke-dasharray="4 7"/><path d="M60 70l6 18 18 6-18 6-6 18-6-18-18-6 18-6z" fill="${YEL}" ${s(3)}/><circle cx="22" cy="46" r="5" fill="${RED}" ${s(2.5)}/><circle cx="98" cy="46" r="5" fill="${BLU}" ${s(2.5)}/><circle cx="22" cy="142" r="5" fill="${YEL}" ${s(2.5)}/><circle cx="98" cy="142" r="5" fill="${GRN}" ${s(2.5)}/>`],
  ];
  const wrap = (inner, opt = {}) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 200"${opt.w ? ` width="${opt.w}" height="${Math.round(opt.w * 5 / 3)}"` : ""}${opt.label ? ` role="img" aria-label="${opt.label}"` : ' aria-hidden="true" focusable="false"'}>${inner}</svg>`;
  const FONT = `'Pretendard Variable','Malgun Gothic','Apple SD Gothic Neo',sans-serif`;
  function card(n, opt = {}) {
    const D = root.TAROTDATA, a = ART[n];
    if (!a || !D) return "";
    const name = D.CARDS[n].name, fs = name.length > 6 ? 12 : name.length > 4 ? 14 : 16;
    return wrap(`<rect x="2" y="2" width="116" height="196" rx="10" fill="${W}" ${s(4)}/><text x="60" y="25" text-anchor="middle" font-family="'Times New Roman',Times,serif" font-weight="700" font-size="16" fill="${K}">${D.ROMAN[n]}</text><rect x="12" y="34" width="96" height="120" rx="6" fill="${a[0]}"/>${a[1]}<rect x="12" y="34" width="96" height="120" rx="6" fill="none" ${s(3)}/><text x="60" y="181" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="${fs}" fill="${K}">${name}</text>`, opt);
  }
  // 뒷면: 위아래를 뒤집어도 같은 모양(정·역방향이 뒷면으로 드러나지 않게)
  function back(opt = {}) {
    let dots = ""; // 안쪽 칸에 작은 마름모 격자(clipPath·id 없이 → 한 페이지에 여러 장 넣어도 안전)
    for (let r = 0; r < 15; r++) for (let y = 16 + r * 12, x = r % 2 ? 18 : 24; x <= 102; x += 12) dots += `M${x} ${y - 2.5}l2.5 2.5-2.5 2.5-2.5-2.5z`;
    return wrap(`<rect x="2" y="2" width="116" height="196" rx="10" fill="${K}" ${s(4)}/><path d="${dots}" fill="#3a3a3a"/><rect x="10" y="10" width="100" height="180" rx="6" fill="none" stroke="${YEL}" stroke-width="3"/><path d="M60 58L92 100 60 142 28 100z" fill="${RED}" stroke="${YEL}" stroke-width="3" stroke-linejoin="round"/><circle cx="60" cy="100" r="13" fill="${YEL}" ${s(3)}/>${star(60, 100, 7, 3, 4, K)}${star(60, 32, 8, 3, 4, YEL)}${star(60, 168, 8, 3, 4, YEL)}<circle cx="22" cy="22" r="3" fill="${YEL}"/><circle cx="98" cy="22" r="3" fill="${YEL}"/><circle cx="22" cy="178" r="3" fill="${YEL}"/><circle cx="98" cy="178" r="3" fill="${YEL}"/>`, opt);
  }
  root.TAROTART = { card, back, count: ART.length };
})(typeof window !== "undefined" ? window : globalThis);
