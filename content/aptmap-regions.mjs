// P2-63c 역세권 아파트 지도 시·도별 요약 페이지(/apt-map/<시도>/)의 「지역 해설」 — 사람이 쓰거나 검수한 문단만 넣는다(요청서 6장, AI 대량 생성 콘텐츠 정책 리스크).
// 비어 있으면 그 자리에 데이터 숫자로 만든 사실 요약 1~2문장만 나온다. 문단을 넣으면 사실 요약 아래에 「지역 해설」로 붙는다.
// 키는 시·도 주소(slug): seoul gyeonggi incheon busan daegu jeonnam-gwangju daejeon ulsan sejong gangwon chungbuk chungnam jeonbuk gyeongbuk gyeongnam jeju
// 형식 예:
//   gyeonggi: { by: "검수자 이름", date: "2026-11-20", paras: ["첫 문단", "둘째 문단"] },
// 숫자는 매달 데이터가 바뀌므로 문단에 단지 수·가격을 직접 적지 않는다(표와 사실 요약이 자동으로 바뀜).
export default {
};
