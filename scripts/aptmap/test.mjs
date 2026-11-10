// P2-63a 자동 시험: 계산 로직을 손계산 값과 대조한다. 네트워크·키 필요 없음.
// 사용: node scripts/aptmap/test.mjs   (하나라도 틀리면 종료 코드 1)
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as L from "./logic.mjs";
import { buildStations, korailCheck } from "./stations.mjs";
import { readXlsx } from "./xlsx.mjs";
import { parseApi, redact, encKey } from "./net.mjs";
import { assemble, mergeGeo } from "./make-data.mjs";
import { runSlow, classify, SLOW, EXIT } from "./slow.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const groups = {};
function eq(group, name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  (groups[group] ??= [0, 0])[ok ? 0 : 1]++;
  ok ? pass++ : (fail++, console.log(`  X [${group}] ${name}\n      기대 ${JSON.stringify(want)}\n      결과 ${JSON.stringify(got)}`));
}
const near = (group, name, got, want, tol) => eq(group, `${name} (${got} ≈ ${want} ±${tol})`, Math.abs(got - want) <= tol, true);

// ───────── 1. 중위값 ─────────
eq("중위값", "홀수 [5,1,3]", L.median([5, 1, 3]), 3);
eq("중위값", "짝수 [1,3]", L.median([1, 3]), 2);
eq("중위값", "짝수 반올림 [29999,30000] → 29999.5 → 30000", L.median([30000, 29999]), 30000);
eq("중위값", "1건", L.median([41000]), 41000);
eq("중위값", "0건", L.median([]), null);

// ───────── 2. 대표가격 (기준: 2026-10 계약분까지) ─────────
// API 원본 형식 그대로 만든다(dealAmount 쉼표, 공백 포함)
const T = (ym, price, o = {}) => ({ aptSeq: "41410-0001", aptNm: "율곡주공3단지", sggCd: "41410", umdCd: "10100", umdNm: "금정동", jibun: "845",
  excluUseAr: String(o.area ?? 49.9), dealYear: ym.slice(0, 4), dealMonth: String(+ym.slice(5)), dealDay: String(o.day ?? 15), dealAmount: price.toLocaleString("en-US"),
  floor: "5", buildYear: "1994", cdealType: o.cancel ? "O" : " ", cdealDay: o.cancelDay || "", dealingGbn: o.gbn ?? "중개거래" });
const parse = (arr) => arr.map(L.parseTrade);
eq("거래 정리", "dealAmount '37,500' → 37500", L.parseTrade(T("2026-10", 37500)).price, 37500);
eq("거래 정리", "해제여부 O → 해제", L.parseTrade(T("2026-10", 1, { cancel: true })).cancelled, true);
eq("거래 정리", "해제여부 빈칸·해제사유발생일만 있음 → 해제", L.parseTrade(T("2026-10", 1, { cancelDay: "26.10.20" })).cancelled, true);
eq("거래 정리", "해제여부 공백 → 정상", L.parseTrade(T("2026-10", 1)).cancelled, false);
eq("거래 정리", "직거래 → 중개 아님", L.parseTrade(T("2026-10", 1, { gbn: "직거래" })).brokered, false);
eq("거래 정리", "거래유형 빈칸 → 중개 아님(안 씀)", L.parseTrade(T("2026-10", 1, { gbn: "" })).brokered, false);
eq("거래 정리", "계약일 → 2026-10-05", L.parseTrade(T("2026-10", 1, { day: 5 })).date, "2026-10-05");
eq("기간", "monthsBack(2026-10, 5) = 2026-05 (6개월 시작)", L.monthsBack("2026-10", 5), "2026-05");
eq("기간", "monthsBack(2026-10, 11) = 2025-11 (12개월 시작)", L.monthsBack("2026-10", 11), "2025-11");
eq("기간", "monthsBack(2026-01, 1) = 2025-12 (해 넘김)", L.monthsBack("2026-01", 1), "2025-12");

// A. 6개월 5건 유효 → 중위값. 손계산: 35000, 36200, 37500, 38000(60.00㎡ 경계 포함), 39500 → 가운데 37500
const A = parse([
  T("2026-10", 39500), T("2026-09", 37500), T("2026-07", 36200), T("2026-05", 35000, { day: 1 }), T("2026-06", 38000, { area: 60.0 }),
  T("2026-08", 20000, { cancel: true }),       // 해제 → 제외
  T("2026-08", 10000, { gbn: "직거래" }),       // 직거래 → 제외
  T("2026-08", 99000, { area: 60.01 }),        // 60㎡ 초과 → 제외
  T("2026-08", 15000, { area: 39.99 }),        // 40㎡ 미만 → 제외
  T("2026-04", 50000),                          // 6개월 밖(2026-04) → 제외
  T("2026-11", 90000),                          // 기준월 이후 → 제외
]);
const rA = L.representativePrice(A, "2026-10");
eq("대표가격", "A 6개월 5건 → 37500, 6m, 거래 적음 아님", [rA.price, rA.basis, rA.tradeCount, rA.lowTrades], [37500, "6m", 5, false]);
// B. 6개월 2건 → 12개월로 확장. 손계산: 2025-11 38000, 2026-06 40000, 2026-09 42000 → 40000. 2025-10은 12개월 밖
const B = parse([T("2026-09", 42000), T("2026-06", 40000), T("2025-11", 38000), T("2025-10", 10000)]);
const rB = L.representativePrice(B, "2026-10");
eq("대표가격", "B 6개월 2건 → 12개월 3건 중위 40000, 거래 적음", [rB.price, rB.basis, rB.tradeCount, rB.lowTrades], [40000, "12m", 3, true]);
// C. 6개월 정확히 3건 → 6개월 그대로. 손계산: 30000, 31000, 45000 → 31000
const rC = L.representativePrice(parse([T("2026-05", 30000), T("2026-10", 45000), T("2026-07", 31000), T("2025-12", 1000)]), "2026-10");
eq("대표가격", "C 6개월 3건 → 6m 31000", [rC.price, rC.basis, rC.tradeCount, rC.lowTrades], [31000, "6m", 3, false]);
// D. 12개월에 해제·직거래뿐 → 제외(null)
eq("대표가격", "D 해제·직거래만 → 지도에서 뺌", L.representativePrice(parse([T("2026-09", 30000, { cancel: true }), T("2026-03", 30000, { gbn: "직거래" })]), "2026-10"), null);
// E. 6개월 0건, 12개월 1건 → 그 1건, 거래 적음
const rE = L.representativePrice(parse([T("2025-11", 28800)]), "2026-10");
eq("대표가격", "E 12개월 1건 → 28800, 12m, 거래 적음", [rE.price, rE.basis, rE.tradeCount, rE.lowTrades], [28800, "12m", 1, true]);
// F. 짝수 4건: 29000, 29999, 30001, 31000 → (29999+30001)/2 = 30000 → 3억대
const rF = L.representativePrice(parse([T("2026-10", 29000), T("2026-10", 29999), T("2026-10", 30001), T("2026-10", 31000)]), "2026-10");
eq("대표가격", "F 짝수 4건 → 30000 → p3", [rF.price, L.priceBand(rF.price)], [30000, "p3"]);
eq("대표가격", "아무 거래 없음 → null", L.representativePrice([], "2026-10"), null);

// ───────── 3. 가격대 경계 ─────────
for (const [p, b] of [[1, "p1"], [19999, "p1"], [20000, "p2"], [29999, "p2"], [30000, "p3"], [39999, "p3"], [40000, "p4"], [59999, "p5"], [60000, "p6"], [70000, "p7"], [80000, "p8"], [89999, "p8"], [90000, null], [95000, null], [0, null], [NaN, null]])
  eq("가격대", `${p}만원 → ${b}`, L.priceBand(p), b);

// ───────── 4. 거리·도보 ─────────
const R = 6371008.8, mPerDegLat = (R * Math.PI) / 180; // 손계산: 111,195.08m
near("거리", "위도 1도 = 111,195m", L.haversine(37, 127, 38, 127), 111195.08, 0.01);
near("거리", "적도 경도 1도 = 111,195m", L.haversine(0, 0, 0, 1), 111195.08, 0.01);
const north = (m) => 37.36 + m / mPerDegLat; // 산본 부근에서 정북으로 m 미터
eq("거리", "정북 500m → 500", L.distM(37.36, 126.93, north(500), 126.93), 500);
eq("거리", "정북 835m → 835", L.distM(37.36, 126.93, north(835), 126.93), 835);
near("거리", "경도 방향(위도 37.36°) 1km", L.haversine(37.36, 126.93, 37.36, 126.93 + 1000 / (mPerDegLat * Math.cos((37.36 * Math.PI) / 180))), 1000, 0.05);
eq("도보", "835m → 16분 (835×1.3÷67=16.2, 요청서 예시)", L.walkMin(835), 16);
eq("도보", "401m → 8분 (7.78)", L.walkMin(401), 8);
eq("도보", "500m → 10분 (9.70)", L.walkMin(500), 10);
eq("도보", "1000m → 19분 (19.40)", L.walkMin(1000), 19);
eq("도보", "520m → 10분 (요청서 표시 예 「직선 520m · 도보 약 9분」은 반올림 시 10분)", L.walkMin(520), 10);
eq("배지", "500m 정확히 → 도보 10분 역세권(포함)", [L.isWalk10(500), L.walkBadge(500)], [true, "도보 10분 역세권"]);
// 배지 규칙 변경(대표님 승인 2026-11-10): 500m 초과~1km는 「역까지 도보 약 N분」, N = 반올림(거리×1.3÷67)
eq("배지", "501m → 약 10분 (501×1.3÷67=9.72)", [L.isWalk10(501), L.walkBadge(501)], [false, "역까지 도보 약 10분"]);
eq("배지", "636m(벽적골8단지 시드) → 약 12분 (12.34)", L.walkBadge(636), "역까지 도보 약 12분");
eq("배지", "835m → 약 16분 (16.20)", L.walkBadge(835), "역까지 도보 약 16분");
eq("배지", "850m → 약 16분 (16.49, 반올림 내림)", L.walkBadge(850), "역까지 도보 약 16분");
eq("배지", "851m → 약 17분 (16.51, 반올림 올림)", L.walkBadge(851), "역까지 도보 약 17분");
eq("배지", "배지의 N은 카드 도보 분(walkMin)과 같은 값", [600, 700, 999].every((d) => L.walkBadge(d) === `역까지 도보 약 ${L.walkMin(d)}분`), true);
eq("배지", "401m 율곡주공3단지 → 토글 켜도 남음", L.isWalk10(401), true);
eq("배지", "835m 벽적골8단지 → 토글 켜면 사라짐", L.isWalk10(835), false);
eq("배지", "1000m 정확히 → 포함, 약 19분 (19.40)", L.walkBadge(1000), "역까지 도보 약 19분");
eq("배지", "1001m → 역세권 아님", L.walkBadge(1001), null);
const ST = [
  { id: "a", name: "산본", lines: ["4호선"], points: [{ lat: north(401), lng: 126.93 }] },
  { id: "b", name: "환승", lines: ["1호선", "4호선"], points: [{ lat: north(3000), lng: 126.93 }, { lat: north(900), lng: 126.93 }] },
  { id: "c", name: "먼역", lines: ["9호선"], points: [{ lat: north(1001), lng: 126.93 }] },
];
eq("역 찾기", "1km 안 역을 가까운 순으로, 환승역은 가까운 출입 좌표 기준", L.stationsWithin(37.36, 126.93, ST).map((s) => [s.name, s.dist, s.walkMin]), [["산본", 401, 8], ["환승", 900, 17]]);

// ───────── 5. 단지명 정규화와 2단계 매칭 ─────────
eq("정규화", "공백·아파트 제거", L.normalizeName(" 율곡주공 3단지 아파트 "), "율곡주공3단지");
eq("정규화", "괄호 기호 제거(안 글자는 남김)", L.normalizeName("반달마을(건영)"), "반달마을건영");
eq("정규화", "괄호째 제거 키", L.nameKeys("반달마을(건영)").drop, "반달마을");
eq("정규화", "전각·영문 대소문자·APT", L.normalizeName("ＳＫ뷰 APT"), "sk뷰");
eq("정규화", "같은 이름: '반달건영' = '반달(건영)'", L.sameName("반달건영", "반달(건영)"), true);
eq("정규화", "다른 이름: '율곡주공2단지' ≠ '율곡주공3단지'", L.sameName("율곡주공2단지", "율곡주공3단지"), false);
eq("정규화", "빈 이름은 같다고 보지 않음", L.sameName("", "()"), false);
eq("지번", "0845-0000 → 845", L.normJibun("0845-0000"), "845");
eq("지번", "845-12 → 845-12", L.normJibun("845-12"), "845-12");
eq("지번", "산 12-03번지 → 산12-3", L.normJibun("산 12-03번지"), "산12-3");
eq("지번", "K-apt 주소에서 지번", L.jibunFromAddr("경기도 군포시 금정동 845 율곡주공3단지아파트"), "845");
eq("지번", "구가 있는 주소", L.jibunFromAddr("경기도 수원시 영통구 영통동 1000-2 벽적골8단지"), "1000-2");
eq("지번", "○가 동", L.jibunFromAddr("서울특별시 종로구 종로6가 1-2 동대문아파트"), "1-2");
eq("지번", "리·산 지번", L.jibunFromAddr("강원특별자치도 춘천시 동면 장학리 산 12 어느아파트"), "산12");
eq("지번", "끝에 「-」만 붙은 지번 73- → 73 (K-apt 파일 실제 표기)", [L.normJibun("73-"), L.jibunFromAddr("서울특별시 종로구 내수동 73- 경희궁의아침4단지")], ["73", "73"]);
eq("지번", "카카오 주소 정리도 73- 처리", L.cleanAddr("서울특별시 종로구 내수동 73- 경희궁의아침4단지"), "서울특별시 종로구 내수동 73");
eq("지번", "단지명 속 숫자에 속지 않음", L.jibunFromAddr("경기도 군포시 금정동 율곡 3단지"), "");
const K = [
  { kaptCode: "k1", kaptName: "율곡주공3단지", bjdCode: "4141010100", jibun: "845" },
  { kaptCode: "k2", kaptName: "율곡주공2단지", bjdCode: "4141010100", jibun: "846" },
  { kaptCode: "k3", kaptName: "반달마을건영", bjdCode: "4119010500", jibun: "300" },
  { kaptCode: "k4", kaptName: "반달마을동아", bjdCode: "4119010500", jibun: "300" },
  { kaptCode: "k5", kaptName: "한라주공", bjdCode: "4119010800", jibun: "" },
  { kaptCode: "k6", kaptName: "한라 주공", bjdCode: "4119010800", jibun: "" },
];
const M = (bjdCode, jibun, name) => L.matchComplex({ bjdCode, jibun, name }, K);
eq("매칭", "1순위 지번 일치(0845 → 845)", M("4141010100", "0845", "엉뚱한이름"), { kaptCode: "k1", stage: 1 });
eq("매칭", "지번 불일치 → 2순위 이름", M("4141010100", "999", "율곡 주공 2단지 아파트"), { kaptCode: "k2", stage: 2 });
eq("매칭", "같은 지번 두 단지 → 이름으로 하나 고름", M("4119010500", "300", "반달마을(건영)"), { kaptCode: "k3", stage: 1 });
eq("매칭", "같은 지번 두 단지·이름도 안 맞음 → 실패", M("4119010500", "300", "반달마을").kaptCode, null);
eq("매칭", "같은 이름 둘 → 실패(사유)", M("4119010800", "1", "한라주공"), { kaptCode: null, stage: 0, reason: "이름 같은 단지 여러 개" });
// 보조 규칙(P2-63a-2): 본번+이름 일부 / 부번 없는 지번의 본번 / 이름 일부(3글자 이상, 하나뿐)
const K2 = [
  { kaptCode: "n1", kaptName: "남산타운", bjdCode: "1114016200", jibun: "844-1" },
  { kaptCode: "n2", kaptName: "신당동삼성", bjdCode: "1114016200", jibun: "300" },
  { kaptCode: "n3", kaptName: "현대동아", bjdCode: "1114016200", jibun: "500" },
  { kaptCode: "n4", kaptName: "동아그린", bjdCode: "1114016200", jibun: "700" },
];
const M2 = (jibun, name) => L.matchComplex({ bjdCode: "1114016200", jibun, name }, K2);
eq("매칭", "본번만 같고 이름이 다르면 연결 안 함(실데이터 「오화 ↔ 삼두아파트」 사례로 규칙 뺌)", M2("844", "오화").kaptCode, null);
eq("매칭", "보조: 본번+이름 일부 844-7 「신당남산타운」 ↔ 남산타운(844-1)", M2("844-7", "신당남산타운"), { kaptCode: "n1", stage: 1, rule: "본번+이름 일부" });
eq("매칭", "보조 막음: 부번 있는 빌라 844-7 「하늘빌라」는 본번만 같아도 연결 안 함", M2("844-7", "하늘빌라").kaptCode, null);
eq("매칭", "보조: 이름 일부(3글자 이상, 하나뿐) 「신당삼성」X / 「신당동삼성래미안」 → 신당동삼성", M2("999", "신당동삼성래미안"), { kaptCode: "n2", stage: 2, rule: "이름 일부" });
eq("매칭", "보조 막음: 2글자 이름 「동아」는 이름 일부로 연결 안 함(현대동아·동아그린)", M2("999", "동아").kaptCode, null);
const K3 = [{ kaptCode: "h1", kaptName: "안양센트럴 헤센 1차", bjdCode: "4117110100", jibun: "433-5" }, { kaptCode: "h2", kaptName: "e편한세상서울대입구아파트", bjdCode: "4117110100", jibun: "1555-1" }, { kaptCode: "h3", kaptName: "모충주공1단지아파트", bjdCode: "4117110100", jibun: "452-4" }];
const M3 = (jibun, name) => L.matchComplex({ bjdCode: "4117110100", jibun, name }, K3);
eq("매칭", "번호 보호: 「헤센2차」는 같은 본번이어도 「헤센 1차」에 붙지 않음", M3("433", "안양센트럴헤센2차").kaptCode, null);
eq("매칭", "번호 보호: 「서울대입구2단지」는 번호 없는 「서울대입구아파트」에 붙지 않음", M3("1730-1", "e편한세상서울대입구2단지").kaptCode, null);
eq("매칭", "번호 같으면 연결: 「주공1」(452) ↔ 모충주공1단지", M3("452", "주공1"), { kaptCode: "h3", stage: 1, rule: "본번+이름 일부" });
// 같은 지번 여러 단지에서 고르기(실데이터 시드: 부천 상동 397, 중동 1028, 영통동 972-2)
const K4 = [
  { kaptCode: "b1", kaptName: "상동반달마을건영", bjdCode: "4119210900", jibun: "397" }, { kaptCode: "b2", kaptName: "반달마을선경아파트", bjdCode: "4119210900", jibun: "397" }, { kaptCode: "b3", kaptName: "반달마을동아아파트", bjdCode: "4119210900", jibun: "397" },
  { kaptCode: "h1", kaptName: "한라뜨란채2단지", bjdCode: "4119210800", jibun: "1028" }, { kaptCode: "h2", kaptName: "중동한라1(공단)", bjdCode: "4119210800", jibun: "1028" },
  { kaptCode: "w1", kaptName: "벽적골2단지주공아파트", bjdCode: "4111710500", jibun: "972-2" }, { kaptCode: "w2", kaptName: "수원영통벽적골주공1아파트", bjdCode: "4111710500", jibun: "972-2" },
];
const M4 = (b, jibun, name) => L.matchComplex({ bjdCode: b, jibun, name }, K4);
eq("매칭", "같은 지번: 「반달마을(건영)」 → 상동반달마을건영 (괄호 글자 살린 이름 포함)", M4("4119210900", "397", "반달마을(건영)"), { kaptCode: "b1", stage: 1, rule: "같은 지번+이름 일부" });
eq("매칭", "같은 지번: 「한라마을(주공2)」 → 한라뜨란채2단지 (번호 2가 같은 단지 하나)", M4("4119210800", "1028", "한라마을(주공2)"), { kaptCode: "h1", stage: 1, rule: "같은 지번+번호" });
eq("매칭", "같은 지번에 8단지가 없으면 1·2단지에 붙이지 않음(벽적골주공휴먼시아8단지)", M4("4111710500", "972-2", "벽적골주공휴먼시아8단지").kaptCode, null);
eq("매칭", "다른 법정동이면 지번·이름 같아도 연결 안 함", M("4141010200", "845", "율곡주공3단지"), { kaptCode: null, stage: 0, reason: "같은 법정동에 K-apt 단지 없음" });

// ───────── 6. UTM-K → WGS84 ─────────
const o = L.utmkToWgs84(1000000, 2000000);
eq("좌표", "UTM-K 원점 (1,000,000, 2,000,000) → 38°N 127.5°E", [+o.lat.toFixed(9), +o.lng.toFixed(9)], [38, 127.5]);
// 독립 검증: EPSG Guidance Note 7-2의 횡메르카토르 계산 예(OSGB 1936 / British National Grid, Airy 1830)
// E 577274.99, N 69740.50 → 50°30'N, 0°30'E. 같은 역변환 함수에 다른 매개변수를 넣어 식 자체를 검증한다.
const g = L.tmInverse(577274.99, 69740.50, { a: 6377563.396, f: 1 / 299.3249646, lat0: 49, lon0: -2, k0: 0.9996012717, x0: 400000, y0: -100000 });
near("좌표", "EPSG 예제 위도 50.5°", g.lat, 50.5, 2e-6);
near("좌표", "EPSG 예제 경도 0.5°", g.lng, 0.5, 2e-6);
// 왕복 검증: 독립 구현한 정변환(Snyder 식 8-9~8-10)으로 UTM-K를 만든 뒤 되돌린다(전국 끝점 포함)
function tmForward(lat, lng, P) {
  const e2 = P.f * (2 - P.f), ep2 = e2 / (1 - e2), r = Math.PI / 180, phi = lat * r;
  const Mf = (p) => P.a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * p - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * p) + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * p) - (35 * e2 ** 3 / 3072) * Math.sin(6 * p));
  const N = P.a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2), Tt = Math.tan(phi) ** 2, C = ep2 * Math.cos(phi) ** 2, A = (lng - P.lon0) * r * Math.cos(phi);
  const x = P.x0 + P.k0 * N * (A + (1 - Tt + C) * A ** 3 / 6 + (5 - 18 * Tt + Tt * Tt + 72 * C - 58 * ep2) * A ** 5 / 120);
  const y = P.y0 + P.k0 * (Mf(phi) - Mf(P.lat0 * r) + N * Math.tan(phi) * (A * A / 2 + (5 - Tt + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * Tt + Tt * Tt + 600 * C - 330 * ep2) * A ** 6 / 720));
  return { x, y };
}
const gf = tmForward(50.5, 0.5, { a: 6377563.396, f: 1 / 299.3249646, lat0: 49, lon0: -2, k0: 0.9996012717, x0: 400000, y0: -100000 });
near("좌표", "정변환 자체도 EPSG 예제 E 577274.99", gf.x, 577274.99, 0.02);
near("좌표", "정변환 자체도 EPSG 예제 N 69740.50", gf.y, 69740.50, 0.02);
for (const [lat, lng, nm] of [[37.3617, 126.9352, "산본"], [37.2510, 127.0710, "영통"], [33.25, 126.56, "서귀포"], [38.5, 128.4, "고성"], [35.1, 129.04, "부산"], [37.5, 124.7, "백령도"]]) {
  const f = tmForward(lat, lng, L.UTMK), b = L.utmkToWgs84(f.x, f.y);
  near("좌표", `왕복 ${nm} 위도`, b.lat, lat, 1e-7);
  near("좌표", `왕복 ${nm} 경도`, b.lng, lng, 1e-7);
}

// ───────── 7. 최종 판정 ─────────
const rep = { price: 37500, basis: "6m", tradeCount: 5, lowTrades: false };
eq("판정", "299세대 → 탈락", L.qualify({ households: 299, rep, stations: [{}] }).ok, false);
eq("판정", "300세대 → 통과 p3", L.qualify({ households: 300, rep, stations: [{}] }), { ok: true, band: "p3" });
eq("판정", "정확히 9억 → 탈락", L.qualify({ households: 500, rep: { ...rep, price: 90000 }, stations: [{}] }).ok, false);
eq("판정", "8억9,999만 → p8", L.qualify({ households: 500, rep: { ...rep, price: 89999 }, stations: [{}] }), { ok: true, band: "p8" });
eq("판정", "1km 안 역 없음 → 탈락", L.qualify({ households: 500, rep, stations: [] }).ok, false);
eq("판정", "대표가격 없음 → 탈락", L.qualify({ households: 500, rep: null, stations: [{}] }).ok, false);

// ───────── 8. 응답 해석 ─────────
const xml = `<?xml version="1.0" encoding="UTF-8"?><response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items><item><aptNm>율곡주공3단지</aptNm><dealAmount>    37,500</dealAmount><cdealType> </cdealType><dealingGbn>중개거래</dealingGbn></item><item><aptNm>A&amp;B</aptNm><dealAmount>1</dealAmount></item></items><numOfRows>1000</numOfRows><pageNo>1</pageNo><totalCount>2</totalCount></body></response>`;
const px = parseApi(xml);
eq("응답", "XML 2건·정상코드·& 해석", [px.code, px.total, px.items.length, px.items[1].aptNm, L.parseTrade(px.items[0]).price], ["000", 2, 2, "A&B", 37500]);
const pj = parseApi(JSON.stringify({ response: { header: { resultCode: "00", resultMsg: "NORMAL SERVICE." }, body: { items: [{ kaptCode: "A1" }], totalCount: 1 } } }));
eq("응답", "JSON items 배열형(단지 목록)", [pj.code, pj.items[0].kaptCode], ["00", "A1"]);
const pj2 = parseApi(JSON.stringify({ response: { header: { resultCode: "00" }, body: { item: {}, items: { item: { kaptCode: "B" } }, totalCount: 1 } } }));
eq("응답", "JSON items.item 객체 1개", pj2.items.map((x) => x.kaptCode), ["B"]);
// K-apt 기본정보 V5 실제 응답 모양(2026-11-10 호출로 확인): body.item 에 단건 객체
const pv5 = parseApi(JSON.stringify({ response: { header: { resultCode: "00", resultMsg: "NORMAL SERVICE." }, body: { item: { kaptCode: "A43575706", kaptName: "군포율곡", kaptAddr: "경기도 군포시 금정동 876 군포율곡", kaptdaCnt: 2042, doroJuso: "경기도 군포시 오금로 43" } } } }));
eq("응답", "기본정보 V5 단건(body.item) → 세대수·주소 읽음", [pv5.code, pv5.items.length, pv5.items[0].kaptdaCnt, pv5.items[0].kaptAddr], ["00", 1, 2042, "경기도 군포시 금정동 876 군포율곡"]);
const pgw = parseApi('<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>HTTP_ERROR</returnAuthMsg><returnReasonCode>04</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>');
eq("응답", "HTTP 200 + OpenAPI_ServiceResponse(HTTP_ERROR 04) → 오류(GW), 항목 0", [pgw.code, pgw.reason, pgw.items.length, /HTTP_ERROR/.test(pgw.msg)], ["GW", "04", 0, true]);
const pgj = parseApi(JSON.stringify({ OpenAPI_ServiceResponse: { cmmMsgHeader: { errMsg: "HTTP_ERROR", returnAuthMsg: "HTTP 에러", returnReasonCode: "04" } } }));
eq("응답", "JSON 모양 OpenAPI_ServiceResponse(HTTP_ERROR 04) → 오류(GW)", [pgj.code, pgj.reason, pgj.items.length], ["GW", "04", 0]);
const px1 = parseApi("<response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header><body><item><kaptCode>A1</kaptCode><kaptdaCnt>2042</kaptdaCnt></item></body></response>");
eq("응답", "XML 단건 item → 읽음", [px1.code, px1.items[0].kaptdaCnt], ["00", "2042"]);
eq("응답", "게이트웨이 인증 오류 인식", parseApi("<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>").code, "GW");

// ───────── 8-1. 카카오 주소 검색 (P2-63a-2) ─────────
eq("카카오", "지번 주소 뒤 단지명 자르기", L.cleanAddr("경기도 군포시 금정동 876 군포율곡"), "경기도 군포시 금정동 876");
eq("카카오", "도로명 주소 괄호·단지명 자르기", L.cleanAddr("경기도 군포시 오금로 43 (금정동, 군포율곡)"), "경기도 군포시 오금로 43");
eq("카카오", "산 지번", L.cleanAddr("강원특별자치도 춘천시 동면 만천리 산 12-3 어느아파트"), "강원특별자치도 춘천시 동면 만천리 산 12-3");
eq("카카오", "번지 표기 제거", L.cleanAddr("서울특별시 종로구 내수동 72번지 경희궁의아침"), "서울특별시 종로구 내수동 72");
eq("카카오", "읍 아래 리 지번", L.cleanAddr("경기도 파주시 문산읍 문산리 100-1 문산율곡"), "경기도 파주시 문산읍 문산리 100-1");
eq("카카오", "번호 없는 주소는 그대로", L.cleanAddr("  경기도 군포시 금정동  "), "경기도 군포시 금정동");
eq("카카오", "빈 주소", L.cleanAddr(""), "");
eq("카카오", "쉼표로 이어진 여러 지번 주소 → 첫 주소만(카카오 400 방지)", L.cleanAddr("경기도 남양주시 오남읍 오남리 632,경기도 남양주시 오남읍 오남리 683-40,경기도 남양주시 오남읍 오남리 683-25"), "경기도 남양주시 오남읍 오남리 632");
{ // 호출 집계: 서비스별 파일, 예전 합본 파일 값이 크면 이어서 셈, 깨진 파일이면 0으로 되돌리지 않고 멈춤
  const N = await import("./net.mjs");
  const d = "1999-01-01", dir = path.join(HERE, ".cache");
  const lf = path.join(dir, `calls-${d}.json`), sf = path.join(dir, `calls-${d}.testsvc.json`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(lf, JSON.stringify({ testsvc: 7 })); fs.writeFileSync(sf, JSON.stringify({ count: 3 }));
  eq("호출 집계", "예전 합본 7 vs 서비스 파일 3 → 7부터", N.callsToday("testsvc", d), 7);
  fs.writeFileSync(sf, JSON.stringify({ count: 12 }));
  eq("호출 집계", "서비스 파일이 더 크면 그 값", N.callsToday("testsvc", d), 12);
  fs.writeFileSync(sf, "{\"count\": 1");
  eq("호출 집계", "깨진 집계 파일 → 0으로 되돌리지 않고 멈춤(예외)", (() => { try { N.callsToday("testsvc", d); return "통과"; } catch (e) { return /되돌리지 않으려고 멈춥니다/.test(e.message); } })(), true);
  fs.unlinkSync(lf); fs.unlinkSync(sf);
}
// 카카오 응답 예(공식 문서 형식: x=경도, y=위도 문자열). 변환 없이 그대로 위경도
const kj = { meta: { total_count: 1 }, documents: [{ address_name: "경기 군포시 금정동 876", x: "126.9430001", y: "37.3612349", address: { address_name: "경기 군포시 금정동 876" }, road_address: { address_name: "경기 군포시 오금로 43" } }] };
eq("카카오", "x=경도, y=위도, 도로명 우선, 소수 6자리", L.pickKakao(kj), { lat: 37.361235, lng: 126.943, addr: "경기 군포시 오금로 43" });
eq("카카오", "도로명 없으면 지번 주소", L.pickKakao({ documents: [{ ...kj.documents[0], road_address: null }] }).addr, "경기 군포시 금정동 876");
eq("카카오", "결과 0건 → null", L.pickKakao({ meta: { total_count: 0 }, documents: [] }), null);
eq("카카오", "한국 밖 좌표는 건너뛰고 다음 결과", L.pickKakao({ documents: [{ x: "0", y: "0" }, { x: "127.1", y: "37.5", address_name: "b" }] }), { lat: 37.5, lng: 127.1, addr: "b" });
eq("카카오", "x·y 바뀐 값(위도가 127)은 거름", L.pickKakao({ documents: [{ x: "37.5", y: "127.1" }] }), null);

// ───────── 9. 키 보호 ─────────
eq("키 보호", "주소의 serviceKey 가림", redact("https://x/y?serviceKey=AbC%2B1&LAWD_CD=41410"), "https://x/y?serviceKey=***&LAWD_CD=41410");
eq("키 보호", "주소의 confmKey 가림", redact("a?confmKey=devU01TX0&b=1"), "a?confmKey=***&b=1");
eq("키 보호", "Decoding 키는 인코딩", encKey("a+b/c=="), "a%2Bb%2Fc%3D%3D");
eq("키 보호", "Encoding 키는 그대로", encKey("a%2Bb%2Fc%3D%3D"), "a%2Bb%2Fc%3D%3D");
eq("키 보호", "카카오 헤더 키 가림", redact("요청 실패 Authorization: KakaoAK 0123abcdEF4567"), "요청 실패 Authorization: KakaoAK ***");
const env = { ...process.env }; delete env.DATA_GO_KR_KEY; delete env.JUSO_KEY; delete env.JUSO_COORD_KEY; delete env.KAKAO_REST_KEY;
{ // JUSO 키가 있어도 카카오 키가 없으면 카카오 안내를 띄우고 코드 2로 끝난다(키 확인이 먼저라 네트워크 호출 없음)
  const r = spawnSync(process.execPath, [path.join(HERE, "geocode.mjs")], { env: { ...env, JUSO_KEY: "dummy-not-a-key" }, encoding: "utf8", timeout: 20000 });
  eq("키 보호", "geocode.mjs: KAKAO_REST_KEY 없으면 카카오 안내 후 코드 2", [r.status, /KAKAO_REST_KEY/.test(r.stdout), /developers\.kakao\.com/.test(r.stdout)], [2, true, true]);
}
for (const s of ["fetch-trades.mjs", "fetch-kapt.mjs", "geocode.mjs"]) {
  const r = spawnSync(process.execPath, [path.join(HERE, s), ...(s === "fetch-kapt.mjs" ? ["list"] : [])], { env, encoding: "utf8", timeout: 20000 });
  eq("키 보호", `${s}: 키 없으면 안내 후 종료(코드 2)`, [r.status, /환경변수가 비어 있습니다/.test(r.stdout)], [2, true]);
}
const src = fs.readdirSync(HERE).filter((f) => f.endsWith(".mjs") && f !== "test.mjs").map((f) => fs.readFileSync(path.join(HERE, f), "utf8")).join("\n");
eq("키 보호", "코드에 키 값 하드코딩 없음(serviceKey=/confmKey= 뒤에 글자 키 없음)", /(serviceKey|confmKey)=(?!\$\{)[A-Za-z0-9%]{8,}/.test(src), false);
eq("키 보호", "코드에 카카오 키 하드코딩 없음(KakaoAK 뒤에 글자 키 없음)", /KakaoAK (?!\$\{)[A-Za-z0-9]{8,}/.test(src), false);
eq("키 보호", "console 출력에 process.env 직접 사용 없음", /console\.\w+\([^)]*process\.env\[?["'A-Z_]*KEY/.test(src), false);

// ───────── 9-3. 좌표 고르기 (COO 6차: 지번 1순위) ─────────
{
  const J = { a: { lat: 37.36, lng: 126.93, query: "금정동 876" }, b: { fail: "없음" }, d: { lat: 37.0, lng: 127.0 } };
  const D = { a: { lat: 37.36 + 400 / 111195, lng: 126.93, addr: "오금로 43" }, b: { lat: 37.1, lng: 127.1 }, c: { lat: 37.2, lng: 127.2 }, d: { lat: 37.0 + 100 / 111195, lng: 127.0 } };
  const { geo, geoMeta } = mergeGeo(J, D);
  eq("좌표 고르기", "지번 성공 → 지번 / 지번 실패 → 도로명 / 지번 아직 → 도로명 임시", [geo.a.basis, geo.a.lat, geo.b.basis, geo.c.basis, geo.d.basis], ["jibun", 37.36, "doro", "doro-temp", "jibun"]);
  eq("좌표 고르기", "집계: 지번 2, 도로명 1, 임시 1, 비교 2곳 중 300m 넘게 차이 1곳(400m)", [geoMeta.jibun, geoMeta.doroFallback, geoMeta.doroTemp, geoMeta.compared, geoMeta.over300, geoMeta.overList[0].dist], [2, 1, 1, 2, 1, 400]);
  eq("좌표 고르기", "둘 다 실패 → 실패 기록 유지", mergeGeo({ x: { fail: "j" } }, { x: { fail: "d" } }).geo.x.fail, "j");
}

// ───────── 9-2. K-apt 단지 기본정보 파일 (COO 5차 지시) ─────────
{
  const { parseKaptFile, asOfFromName } = await import("./kapt-file.mjs");
  eq("K-apt 파일", "파일 이름 날짜 → 데이터 기준일", [asOfFromName("C:/x/20261106_단지_기본정보.xlsx"), asOfFromName("단지.xlsx")], ["2026-11-06", null]);
  const head = ["시도", "시군구", "읍면", "동리", "단지코드", "단지명", "단지분류", "법정동주소", "우편번호", "도로명주소", "분양형태", "사용승인일", "가입일", "동수", "세대수"];
  const fr = [["안내 문구"], head,
    ["경기도", "군포시", "", "금정동", "A43575706", "군포율곡", "아파트", "경기도 군포시 금정동 876 군포율곡", "15864", "경기도 군포시 오금로 43", "분양", "19940502", "", "21", "2042.0"],
    ["서울특별시", "종로구", "", "내수동", "A10021295", "경희궁의아침4단지", "주상복합", "서울특별시 종로구 내수동 73- 경희궁의아침4단지", "", "서울특별시 종로구 새문안로3길 23", "분양", "20040517", "", "1", "120.0"],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]];
  const pf = parseKaptFile(fr, { list: [{ kaptCode: "A43575706", bjdCode: "4141010500" }], asOf: "2026-11-06" });
  eq("K-apt 파일", "2행 열 이름 찾기, 단지 2곳, 빈 줄 무시", [pf.headerRow, pf.stats.rows, Object.keys(pf.basic)], [2, 2, ["A43575706", "A10021295"]]);
  eq("K-apt 파일", "세대수 「2042.0」 → 2042, 사용승인일·주소·법정동코드(목록에서)", pf.basic.A43575706, { kaptName: "군포율곡", kaptAddr: "경기도 군포시 금정동 876 군포율곡", doroJuso: "경기도 군포시 오금로 43", kaptdaCnt: 2042, kaptUsedate: "19940502", bjdCode: "4141010500", src: "file" });
  eq("K-apt 파일", "목록에 없는 단지는 법정동코드 없음으로 집계", [pf.basic.A10021295.bjdCode, pf.stats.noBjd], ["", 1]);
  eq("K-apt 파일", "필요한 열이 없으면 멈춤", (() => { try { parseKaptFile([["단지코드", "세대수"]]); return "통과"; } catch (e) { return /필요한 열이 없음/.test(e.message); } })(), true);
}

// ───────── 9-1. 느린 수집 모드 (basic --slow, COO 4차 지시) ─────────
eq("느린 수집", "설정값: 2초 · 10분 · 연속 6 · 4,500 · 30분", [SLOW.intervalMs, SLOW.backoffMs, SLOW.maxConsecErr, SLOW.dailyCap, SLOW.progressMs], [2000, 600000, 6, 4500, 1800000]);
eq("느린 수집", "종료 코드 구분", [EXIT.done, EXIT.fatal, EXIT.cap, EXIT.errors], [0, 1, 3, 4]);
eq("느린 수집", "분류: HTTP_ERROR 04 → 쉬고 이어 받기", classify(new Error("게이트웨이 오류: HTTP_ERROR, HTTP 에러, returnReasonCode 04")), "backoff");
eq("느린 수집", "분류: 429 → 쉬고 이어 받기", classify(new Error("일일 호출 한도 초과(HTTP 429)")), "backoff");
eq("느린 수집", "분류: 504 → 쉬고 이어 받기", classify(new Error("호출 실패: https://x?serviceKey=*** (HTTP 504)")), "backoff");
eq("느린 수집", "분류: SERVICETIMEOUT_ERROR → 쉬고 이어 받기", classify(new Error("게이트웨이 오류: SERVICETIMEOUT_ERROR")), "backoff");
eq("느린 수집", "분류: 하루 상한 도달(spend) → cap", classify(new Error("kaptBasic 오늘 호출 4500회 → 한도(4500) 도달. 내일 다시 실행하면 캐시에 이어서 받습니다.")), "cap");
eq("느린 수집", "분류: 서버 한도(LIMITED_NUMBER) → cap", classify(new Error("게이트웨이 오류: LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR, returnReasonCode 22")), "cap");
eq("느린 수집", "분류: 인증 거부 → 즉시 중단", classify(new Error("인증 거부(HTTP 401)")), "fatal");
eq("느린 수집", "분류: 키 미등록 → 즉시 중단", classify(new Error("게이트웨이 오류: SERVICE_KEY_IS_NOT_REGISTERED_ERROR")), "fatal");
eq("느린 수집", "분류: 알 수 없는 응답 코드 → 즉시 중단", classify(new Error("기본정보 응답 오류(코드 「99」 X)")), "fatal");
// 가짜 시계로 돌린다: sleep 이 시계를 앞으로 민다
async function sim(items, script, opts = {}) {
  let t = 0; const sleeps = [], saved = [], lines = [], flushes = [], calls = [];
  let k = 0;
  const res = await runSlow({
    items, opts,
    fetchOne: async (it) => { calls.push(it); const s = script[k++]; if (s instanceof Error) throw s; return s === undefined ? { v: it } : s; },
    save: (it, rec) => saved.push(it), flush: (st) => flushes.push(st.state),
    progress: (st, line, c) => { if (c) lines.push(line); },
    sleep: async (ms) => { sleeps.push(ms); t += ms; }, now: () => t,
  }).catch((e) => ({ thrown: e.message }));
  return { res, sleeps, saved, lines, flushes, calls, t };
}
const E04 = () => new Error("게이트웨이 오류: HTTP_ERROR, HTTP 에러, returnReasonCode 04");
{
  const r = await sim(["a", "b", "c"], []);
  eq("느린 수집", "전부 성공 → 코드 0, 3곳 저장, 2초 간격 3번", [r.res.code, r.saved, r.sleeps], [0, ["a", "b", "c"], [2000, 2000, 2000]]);
  eq("느린 수집", "끝나면 상태 done, 남음 0", [r.res.state, r.res.remaining], ["done", 0]);
}
{
  const r = await sim(["a", "b"], [E04(), E04(), undefined, null]);
  eq("느린 수집", "04 두 번 → 10분씩 쉬고 같은 단지(a)부터 이어 받음", [r.res.code, r.calls, r.saved, r.sleeps], [0, ["a", "a", "a", "b"], ["a"], [2000, 600000, 2000, 600000, 2000, 2000]]);
  eq("느린 수집", "빈 응답(null)은 건너뜀, 오류 2·연속 0으로 끝", [r.res.skipped, r.res.errors, r.res.consecutiveErrors], [1, 2, 0]);
}
{
  const r = await sim(["a", "b"], [undefined, E04(), E04(), E04(), E04(), E04(), E04(), undefined]);
  eq("느린 수집", "연속 6번 오류 → 코드 4, 6번째 뒤에는 쉬지 않고 종료", [r.res.code, r.res.state, r.calls.length, r.sleeps.filter((x) => x === 600000).length], [4, "errors", 7, 5]);
  eq("느린 수집", "연속 오류 종료 때 받은 것 저장(flush), 남음 1, 마지막 오류 기록", [r.flushes.at(-1), r.res.remaining, r.res.lastError.kind], ["errors", 1, "backoff"]);
}
{
  const r = await sim(["a", "b"], [E04(), undefined, E04(), undefined]);
  eq("느린 수집", "성공하면 연속 오류 0으로 돌아감(띄엄띄엄 오류는 계속)", [r.res.code, r.res.errors, r.res.consecutiveErrors, r.saved], [0, 2, 0, ["a", "b"]]);
}
{
  const r = await sim(["a", "b", "c"], [undefined, new Error("kaptBasic 오늘 호출 4500회 → 한도(4500) 도달.")]);
  eq("느린 수집", "하루 상한 → 코드 3, 받은 것 저장, 쉬지 않음", [r.res.code, r.res.state, r.saved, r.flushes.at(-1), r.sleeps.includes(600000)], [3, "cap", ["a"], "cap", false]);
}
{
  const r = await sim(["a", "b"], [new Error("인증 거부(HTTP 401)")]);
  eq("느린 수집", "인증 오류 → 즉시 중단(예외, 쉬지 않음)", [!!r.res.thrown, r.sleeps], [true, [2000]]);
}
{
  const r = await sim(Array.from({ length: 2000 }, (_, i) => i), []); // 2,000곳 × 2초 = 4,000초 ≈ 66분
  eq("느린 수집", "진행 한 줄: 시작 + 30분마다 2번 + 끝 = 4줄", r.lines.length, 4);
  eq("느린 수집", "진행 줄에 받은 수·남은 수·마지막 오류", /받음 \d+ · 건너뜀 \d+ · 남음 \d+ · 오류 \d+\(연속 \d+\) · 마지막 오류 없음/.test(r.lines[1]), true);
}
{
  const r = await sim(["a", "b"], [E04(), undefined, undefined]);
  eq("느린 수집", "오류가 나면 그 즉시 진행 한 줄(30분 기다리지 않음)", r.lines.some((l) => /마지막 오류 게이트웨이 오류: HTTP_ERROR/.test(l)), true);
}
const fk = fs.readFileSync(path.join(HERE, "fetch-kapt.mjs"), "utf8");
eq("느린 수집", "느린 모드 기본정보 호출: _type 없음, 재시도 1회(tries:1), 상한 4,500 연결", [/getAphusBassInfoV5[^\n]*_type/.test(fk) || /kaptCode\)\}&_type/.test(fk), /"kaptBasic", \{ tries: 1 \}/.test(fk), /APTMAP_BUDGET_kaptBasic = String\(SLOW\.dailyCap\)/.test(fk)], [false, true, true]);

// ───────── 10. 역 데이터 ─────────
const H = ["역번호", "역사명", "노선번호", "노선명", "영문역사명", "한자역사명", "환승역구분", "환승노선번호", "환승노선명", "역위도", "역경도", "운영기관명", "역사도로명주소", "역사전화번호", "데이터기준일자"];
const row = (name, line, lat, lng, op = "x") => { const r = Array(15).fill(""); r[1] = name; r[3] = line; r[9] = String(lat); r[10] = String(lng); r[11] = op; return r; };
const bs = buildStations([H,
  row("금정역", "경부선", 37.3721, 126.9435), row("금정역", "안산과천선", 37.3723, 126.9437), // 환승 합치기
  row("서울역", "1호선", 37.5558, 126.9721), row("서울역(경의선)", "경의중앙선", 37.5567, 126.9714), row("서울", "인천국제공항선", 37.5530, 126.9698),
  row("용산역", "경원선", 37.5299, 126.9648), row("회기역", "경원선", 37.5896, 127.0579), // 용산 → 경의중앙, 회기 → 1호선
  row("양평", "5호선", 37.5256, 126.8862), row("양평역", "경의중앙선", 37.4927, 127.4918), // 같은 이름, 다른 도시 → 따로
  row("용유역", "자기부상철도", 37.44, 126.40), row("좌표없음", "2호선", "", ""),
]);
const find = (n) => bs.stations.filter((s) => s.name === n).map((s) => s.lines.join("/"));
eq("역", "금정: 1호선+4호선 한 역", find("금정"), ["1호선/4호선"]);
eq("역", "서울역 3개 노선 합침(괄호·「역」 무시)", find("서울"), ["1호선/경의중앙/공항철도"]);
eq("역", "경원선 용산 → 경의중앙, 회기 → 1호선", [find("용산"), find("회기")], [["경의중앙"], ["1호선"]]);
eq("역", "양평 두 곳 따로", find("양평").length, 2);
eq("역", "자기부상·좌표 없는 행 제외", bs.dropped.length, 2);
const xlsxPath = path.join(HERE, ".cache", "stations-src.xlsx");
if (fs.existsSync(xlsxPath)) {
  const real = buildStations(readXlsx(fs.readFileSync(xlsxPath)));
  eq("역(실자료)", "대응표에 없는 노선 0", real.unknownLines, []);
  eq("역(실자료)", "역 900곳 이상", real.stations.length >= 900, true);
  eq("역(실자료)", "코레일 광역전철 점검표 누락 0", korailCheck(real.stations), []);
  const pick = (n, line) => real.stations.find((s) => s.name === n && s.lines.includes(line));
  for (const [n, line] of [["영통", "수인분당"], ["상갈", "수인분당"], ["매탄권선", "수인분당"], ["수리산", "4호선"], ["산본", "4호선"], ["당정", "1호선"], ["신중동", "7호선"], ["상동", "7호선"]])
    eq("역(실자료)", `시드 관련 역 ${n}(${line}) 있음`, !!pick(n, line), true);
} else console.log("  (실자료 역 시험 건너뜀: 먼저 node scripts/aptmap/stations.mjs 실행)");

// ───────── 11. 조립(가짜 데이터로 전체 흐름) ─────────
// 산본역에서 정북 401m 율곡주공3단지(1,600세대), 835m 단지, 1,200m 단지, 250세대 단지, 9억 단지
const sb = { lat: 37.36, lng: 126.93 };
const stations = [{ id: "s1", name: "산본", lines: ["4호선"], points: [sb] }];
const mk = (seq, name, jibun, prices, o = {}) => prices.map((p, i) => ({ ...T("2026-0" + (5 + i), p), aptSeq: seq, aptNm: name, jibun, umdCd: o.umd || "10100" }));
const tradeItems = [
  ...mk("41410-0001", "율곡주공3단지", "845", [36000, 37000, 38000]),
  ...mk("41410-0002", "먼단지", "900", [30000, 30000, 30000]),
  ...mk("41410-0003", "아주먼단지", "901", [25000, 25000, 25000]),
  ...mk("41410-0004", "작은단지", "902", [25000, 25000, 25000]),
  ...mk("41410-0005", "비싼단지", "903", [90000, 91000, 92000]),
  ...mk("41410-0006", "연결안됨", "999", [20000, 20000, 20000]),
];
const kaptList = ["k1", "k2", "k3", "k4", "k5"].map((c, i) => ({ kaptCode: c, kaptName: ["율곡주공3단지", "먼단지", "아주먼단지", "작은단지", "비싼단지"][i], bjdCode: "4141010100", as1: "경기도", as2: "군포시", as3: "금정동" }));
const basic = Object.fromEntries(kaptList.map((k, i) => [k.kaptCode, { kaptName: k.kaptName, kaptAddr: `경기도 군포시 금정동 ${845 + (i ? 54 + i : 0)} ${k.kaptName}`, doroJuso: "", kaptdaCnt: i === 3 ? 250 : 1600, kaptUsedate: "19941201", bjdCode: "4141010100" }]));
const geo = { k1: { lat: north(401), lng: sb.lng }, k2: { lat: north(835), lng: sb.lng }, k3: { lat: north(1200), lng: sb.lng } };
const as = assemble({ stations, kaptList, basic, tradeItems, geo, through: "2026-10" });
eq("조립", "통과 단지: 먼단지(30000, 835m), 율곡주공3단지(37000, 401m) 가격순", as.complexes.map((c) => [c.name, c.price, c.band, c.station.dist, c.station.walkMin]), [["먼단지", 30000, "p3", 835, 16], ["율곡주공3단지", 37000, "p3", 401, 8]]);
eq("조립", "도보 10분 토글: 율곡 남고 먼단지 사라짐", as.complexes.filter((c) => L.isWalk10(c.station.dist)).map((c) => c.name), ["율곡주공3단지"]);
const why = Object.fromEntries(as.rows.filter((r) => !r.band).map((r) => [r.name, r.reason]).sort((a, b) => ["아주먼단지", "작은단지", "비싼단지", "연결안됨"].indexOf(a[0]) - ["아주먼단지", "작은단지", "비싼단지", "연결안됨"].indexOf(b[0])));
eq("조립", "탈락 사유", why, { "아주먼단지": "직선 1km 안에 운행 중인 역 없음", "작은단지": "세대수 250 (300 미만)", "비싼단지": "대표가격 91000만원 (9억 이상)", "연결안됨": "K-apt 연결 실패: 같은 법정동에 지번·이름 일치 없음" });
eq("조립", "좌표 요청 대상은 조건 통과한 단지만(없음)", as.needGeo, []);
eq("조립", "일치율 집계(경기 6곳 중 5곳)", as.match["경기"], { total: 6, stage1: 5, stage2: 0, none: 1 });
eq("조립", "출력 형식(요청서 4-3) 필드 + kaptCode·aptSeqs(COO 7차, 추가만)", Object.keys(as.complexes[1]).filter((k) => k !== "stationsNear"), ["id", "kaptCode", "aptSeqs", "name", "sido", "sgg", "dong", "lat", "lng", "households", "built", "price", "band", "priceBasis", "tradeCount", "lowTrades", "station", "recent"]);
eq("조립", "최근 거래 최신순 3건", as.complexes[1].recent.map((r) => r.date), ["2026-07-15", "2026-06-15", "2026-05-15"]);

// ───────── 조립: 같은 K-apt 단지에 연결된 aptSeq 합치기 (COO 7차) ─────────
{
  // 같은 지번 973-3의 실거래 단지 3개(두산·한신·우성) → K-apt 「벽적골두산한신우성」 하나
  const mkp = (seq, name, prices) => prices.map((p, i) => ({ ...T("2026-" + String(5 + i).padStart(2, "0"), p), aptSeq: seq, aptNm: name, jibun: "973-3", sggCd: "41117", umdCd: "10500", umdNm: "영통동" }));
  const ti = [
    ...mkp("41117-36", "벽적골두산", [40000, 41000]),          // 2건
    ...mkp("41117-39", "벽적골한신", [42000, 43000, 44000]),   // 3건(가장 많음 → 대표 aptSeq). 단독이면 중위값 43,000
    ...mkp("41117-37", "벽적골우성", [39000]),                 // 1건
  ];
  const kl = [{ kaptCode: "A44347025", kaptName: "벽적골두산한신우성", bjdCode: "4111710500", as1: "경기도", as2: "수원영통구", as3: "영통동" }];
  const bs = { A44347025: { kaptName: "벽적골두산한신우성", kaptAddr: "경기도 수원영통구 영통동 973-3 벽적골두산한신우성", doroJuso: "", kaptdaCnt: 1842, kaptUsedate: "19970801", bjdCode: "4111710500" } };
  const st1 = [{ id: "s1", name: "망포", lines: ["수인분당"], points: [{ lat: 37.2455, lng: 127.0573 }] }];
  const am = assemble({ stations: st1, kaptList: kl, basic: bs, tradeItems: ti, geo: { A44347025: { lat: 37.2455 + 600 / 111195, lng: 127.0573 } }, through: "2026-10" });
  eq("단지 합치기", "aptSeq 3개 → 지도 단지 1곳(K-apt 단지코드 하나)", [am.complexes.length, am.complexes[0].kaptCode, am.complexes[0].name, am.complexes[0].households], [1, "A44347025", "벽적골두산한신우성", 1842]);
  eq("단지 합치기", "대표 aptSeq = 거래 가장 많은 한신, aptSeqs는 거래 많은 순", [am.complexes[0].id, am.complexes[0].aptSeqs], ["41117-39", ["41117-39", "41117-36", "41117-37"]]);
  // 합친 6건 정렬 [39000,40000,41000,42000,43000,44000] → 짝수 → (41000+42000)/2 = 41,500 (손계산)
  eq("단지 합치기", "대표가격은 합친 거래 6건 중위값 41,500(손계산), 6개월, p4", [am.complexes[0].price, am.complexes[0].tradeCount, am.complexes[0].priceBasis, am.complexes[0].band], [41500, 6, "6m", "p4"]);
  eq("단지 합치기", "최근 거래도 합쳐서 최신 3건(7월 한신 44,000 · 6월 한신 43,000·두산 41,000 중 6월 2건)", am.complexes[0].recent.length, 3);
  eq("단지 합치기", "일치율은 aptSeq 단위로 셈(3곳 모두 연결)", [am.match["경기"].total, am.match["경기"].none], [3, 0]);
  eq("단지 합치기", "좌표 대상도 하나만(카카오 호출 중복 없음)", am.geoTargets.map((g) => g.kaptCode), ["A44347025"]);
  eq("단지 합치기", "결과에 K-apt 단지코드 중복 없음", am.complexes.length === new Set(am.complexes.map((c) => c.kaptCode)).size, true);
}

console.log("\n| 시험 묶음 | 통과 | 실패 |\n|---|---|---|");
for (const [g, [p, f]] of Object.entries(groups)) console.log(`| ${g} | ${p} | ${f} |`);
console.log(`\n합계: ${pass + fail}건 중 통과 ${pass}, 실패 ${fail}`);
process.exit(fail ? 1 : 0);
