// P2-57·P2-68 이모지 · 특수문자 복사 데이터와 검색·일괄 삽입 함수 한 벌. 화면(t-emoji.js)과 빌드 검사(build.mjs, vm)가 같은 파일을 씀.
// 데이터는 유니코드 표준 문자만 씀(이미지·외부 라이브러리 없음). 한글 이름·검색어는 직접 만든 짧은 사전.
// 형식: 항목은 「|」로 나누고, 항목 안은 「문자 이름 검색어…」(띄어쓰기로 나눔). 첫 낱말이 이름.
// emoji: true인 분류는 빌드 때 모든 문자가 유니코드 RGI 이모지인지 검사함
// P2-68: 이 파일(처음 받는 것)에는 「자주 찾는」과 유니코드 분류 7개만 둠. 상황별 탭·특수문자·텍스트 이모티콘·프리셋·의미·검색 별칭은
//        emoji-more.js에 두고 그 탭을 열거나 찾기를 할 때 늦게 받음(EMOJIDATA.addMore로 붙음)
(function (root) {
  const CATS = [
    { id: "frequent", name: "자주 찾는", emoji: false, s: "😂 웃겨 기쁨의눈물 ㅋㅋㅋ|🤣 폭소 데굴데굴|😊 미소 행복|🥰 사랑 하트얼굴|😍 하트눈 반함|😭 엉엉 오열 울음|😢 눈물 슬픔|🥲 웃프다 눈물웃음|🥹 감동 글썽|❤️ 빨간하트 하트 사랑|💕 두하트 하트|🫶 손하트 하트|♥ 하트기호 하트 특수문자|♡ 빈하트 하트 특수문자|🔥 불 인기 핫|✨ 반짝이 반짝|👏 박수 짝짝|👍 엄지척 좋아요|🙏 감사 부탁|🙌 만세 축하|💪 화이팅 힘|🚀 로켓 급등 출시|📈 상승차트 주식|💰 돈 돈주머니|💸 날아가는돈 지출|✅ 체크 완료|✔️ 체크|📌 압정 핀 고정|💡 전구 아이디어|🎯 과녁 목표|🏆 트로피 1위|🎉 축하 폭죽|💯 백점|🤔 생각 고민|😉 윙크|😎 선글라스 멋짐|🥳 파티 축하|😡 화남 분노|😱 비명 헉|👀 눈 관심|👉 가리킴 오른쪽|⭐ 별|★ 검은별 별 특수문자|☆ 빈별 별 특수문자|→ 오른쪽화살표 화살표|※ 당구장 참고|📢 확성기 공지|🌈 무지개|🍀 행운 네잎클로버" },
    { id: "face", name: "표정", emoji: true, s: "😀 활짝웃음 웃음 기쁨 스마일|😃 웃음 기쁨|😄 눈웃음 웃음|😁 히히 이웃음|😆 깔깔 빵터짐 웃음|😅 머쓱 땀 민망|🤣 데굴데굴 폭소 ㅋㅋ|😂 웃겨 기쁨의눈물 ㅋㅋㅋ|🙂 미소 살짝웃음|🙃 거꾸로 장난|😉 윙크|😊 수줍은미소 행복 미소|😇 천사 착함|🥰 사랑 하트 행복|😍 하트눈 반함 사랑|🤩 별눈 감탄 와|😘 뽀뽀 키스 하트|😗 뽀뽀|😚 뽀뽀 수줍|😋 냠냠 맛있다|😛 메롱|😜 메롱 윙크 장난|🤪 정신없음 장난|😝 메롱 눈감기|🤑 돈 부자|🤗 포옹 안아줘|🤭 킥킥 입가림|🤫 쉿 비밀 조용|🤔 생각 고민 흠|🤐 입다물기 비밀|🤨 의심 갸웃|😐 무표정|😑 무표정 짜증|😶 말없음 입없음|😏 능글 비웃음|😒 시큰둥 불만|🙄 어이없음 눈굴림|😬 어색 이빨|😌 안도 평온|😔 시무룩 우울|😪 졸림 콧물|🤤 군침 침|😴 쿨쿨 잠 zzz|😷 마스크 감기|🤒 아픔 열 체온계|🤕 다침 붕대|🤢 메스꺼움|🤮 우웩 구토|🥵 더위 덥다|🥶 추위 춥다|🥴 어질 취함|😵 기절 어지러움|🤯 머리폭발 충격 멘붕|🤠 카우보이|🥳 파티 축하 생일|😎 선글라스 멋짐 쿨|🤓 범생 안경 공부|🧐 분석 돋보기 외눈안경|😕 갸우뚱 혼란|😟 걱정|🙁 슬픔|😮 놀람 오|😯 놀람 헉|😲 깜짝 놀람|😳 당황 부끄|🥺 글썽 부탁 애원|😦 놀람 당황|😧 괴로움|😨 두려움 겁|😰 식은땀 불안|😥 실망 휴|😢 눈물 슬픔|😭 엉엉 오열 울음|😱 비명 공포 헉|😖 괴로움|😣 참음 끙|😞 실망|😓 난감 땀|😩 지침 피곤|😫 피곤 지침|🥱 하품 졸림|😤 씩씩 콧김|😡 화남 분노|😠 화남 짜증|🤬 욕 분노|😈 악마 장난|👿 악마 화남|💀 해골 죽음|☠️ 해골 독|💩 똥 응가|🤡 광대|👻 유령 귀신|👽 외계인|🤖 로봇|😺 고양이웃음 고양이|😹 고양이웃음눈물 고양이|😻 고양이하트 고양이 사랑|🙈 못본척 원숭이|🙉 안들림 원숭이|🙊 쉿 원숭이" },
    { id: "people", name: "사람·손", emoji: true, s: "👋 안녕 손인사 바이|🤚 손등 손|✋ 손바닥 하이파이브 멈춰|🖐️ 다섯 손|👌 오케이 좋아|🤏 조금 쪼금|✌️ 브이 승리 피스|🤞 행운 손가락|🤟 사랑해 손|🤘 락 메탈|🤙 전화해 샤카|👈 왼쪽 가리킴|👉 오른쪽 가리킴|👆 위 가리킴|👇 아래 가리킴|☝️ 하나 검지|👍 좋아요 최고 엄지척|👎 싫어요 별로|✊ 주먹|👊 펀치 주먹|👏 박수 짝짝|🙌 만세 축하|👐 두손 손|🤲 손모음 기도|🤝 악수 협력 계약|🙏 감사 부탁 기도 제발|✍️ 글쓰기 작성 필기|💪 힘 근육 화이팅 파이팅|👀 눈 보기 힐끔|👁️ 눈|👄 입 입술|🧠 뇌 생각|👶 아기|🧒 어린이 아이|👦 남자아이|👧 여자아이|🧑 사람|👨 남자|👩 여자|🧓 어르신|👴 할아버지|👵 할머니|👮 경찰|👷 공사 작업자|🕵️ 탐정|👩‍⚕️ 의사 간호사|👨‍🍳 요리사 셰프|👩‍🎓 졸업 학생|👨‍🏫 선생님 교사|👩‍💻 개발자 프로그래머 코딩|👨‍💼 직장인 회사원|👩‍🔬 과학자 연구|🧑‍🎨 화가 예술가|🧑‍🚀 우주인|👰 신부 결혼|🤵 신랑 결혼|🤰 임신 엄마|🎅 산타 크리스마스|🧙 마법사|🧚 요정|🙋 손들기 저요 질문|🙆 오케이 동그라미|🙅 안돼 엑스 금지|💁 안내 설명|🤷 몰라 글쎄|🤦 아이고 한숨|🙇 죄송 사과 절|🏃 달리기 뛰기|🚶 걷기 산책|💃 춤 댄스|🕺 춤 댄스|👯 친구 단짝|🧘 요가 명상|👫 커플 연인|👪 가족|👨‍👩‍👧‍👦 가족 네식구|👣 발자국" },
    { id: "animal", name: "동물·자연", emoji: true, s: "🐶 강아지 개 멍멍|🐱 고양이 냥이 야옹|🐭 쥐|🐹 햄스터|🐰 토끼|🦊 여우|🐻 곰|🐼 판다|🐨 코알라|🐯 호랑이|🦁 사자|🐮 소 젖소|🐷 돼지|🐸 개구리|🐵 원숭이|🐔 닭|🐧 펭귄|🐦 새|🐤 병아리|🦆 오리|🦅 독수리|🦉 부엉이 올빼미|🦇 박쥐|🐺 늑대|🐴 말|🦄 유니콘|🐝 꿀벌 벌|🐛 애벌레|🦋 나비|🐌 달팽이|🐞 무당벌레|🐜 개미|🐢 거북이|🐍 뱀|🦎 도마뱀|🐙 문어|🦑 오징어|🦐 새우|🦀 게 꽃게|🐠 열대어 물고기|🐟 물고기 생선|🐬 돌고래|🐳 고래|🦈 상어|🐊 악어|🐘 코끼리|🦒 기린|🐪 낙타|🦘 캥거루|🐑 양|🐐 염소|🦌 사슴|🐕 개 강아지|🐈 고양이|🦜 앵무새|🦢 백조|🦩 플라밍고|🐿️ 다람쥐|🦔 고슴도치|🐾 발바닥 발자국 동물|🌸 벚꽃 꽃 봄|🌹 장미 꽃|🌻 해바라기 꽃|🌷 튤립 꽃|🌼 꽃 데이지|💐 꽃다발|🍀 네잎클로버 행운|🌱 새싹|🌿 잎 허브|🍁 단풍 가을|🍂 낙엽 가을|🌵 선인장|🌲 나무 침엽수|🌳 나무|🌴 야자수 여름 휴가|☀️ 해 맑음 날씨|🌤️ 구름조금 날씨|☁️ 구름 흐림 날씨|🌧️ 비 날씨|⛈️ 천둥번개 날씨|❄️ 눈 겨울 눈송이|☃️ 눈사람 겨울|🌈 무지개|🌙 달 밤|⭐ 별|🌟 반짝별 별|✨ 반짝 반짝이|🔥 불 핫 열정|💧 물방울|🌊 파도 바다|🌍 지구 세계" },
    { id: "food", name: "음식", emoji: true, s: "🍎 사과|🍊 귤 오렌지|🍋 레몬|🍌 바나나|🍉 수박|🍇 포도|🍓 딸기|🍑 복숭아|🍒 체리|🥝 키위|🍍 파인애플|🥭 망고|🍅 토마토|🥑 아보카도|🥕 당근|🌽 옥수수|🌶️ 고추 매운|🥦 브로콜리|🍄 버섯|🥜 땅콩|🍞 빵 식빵|🥐 크루아상|🥨 프레첼|🧀 치즈|🥚 달걀 계란|🍳 계란후라이 요리|🥓 베이컨|🍗 치킨 닭다리|🍖 고기|🍔 햄버거|🍟 감자튀김|🍕 피자|🌭 핫도그|🥪 샌드위치|🌮 타코|🍝 파스타 스파게티|🍜 라면 국수|🍲 찌개 전골|🍛 카레|🍣 초밥 스시|🍱 도시락|🍚 밥|🍙 주먹밥 삼각김밥|🥟 만두|🍤 새우튀김|🍢 어묵 오뎅|🍡 경단 떡꼬치|🍦 소프트아이스크림 아이스크림|🍧 빙수|🍨 아이스크림|🍩 도넛|🍪 쿠키|🎂 생일케이크 케이크 생일|🍰 조각케이크 케이크|🧁 컵케이크|🍫 초콜릿|🍬 사탕|🍭 막대사탕|🍿 팝콘|☕ 커피 카페|🍵 녹차 차|🧋 버블티 밀크티|🥤 음료 테이크아웃|🧃 주스|🥛 우유|🍺 맥주|🍻 건배 맥주|🥂 건배 샴페인|🍷 와인|🍸 칵테일|🍶 사케 술|🥢 젓가락|🍴 포크 식사|🥄 숟가락" },
    { id: "object", name: "사물", emoji: true, s: "📱 휴대폰 스마트폰|💻 노트북 컴퓨터|🖥️ 모니터 컴퓨터|⌨️ 키보드|🖱️ 마우스|🖨️ 프린터|📷 카메라 사진|📸 사진찍기 카메라|🎥 영상 촬영|📺 텔레비전 TV|🎧 헤드폰 음악|🎤 마이크 노래|🎵 음표 음악|🎶 음악 노래|🎮 게임|🎲 주사위|🧩 퍼즐|🎨 그림 팔레트 미술|✏️ 연필|✒️ 펜|🖊️ 볼펜|📝 메모 작성 노트|📒 노트|📖 책 독서|📚 책 공부|📎 클립|📌 압정 고정 핀|📍 위치 핀|✂️ 가위|📏 자|📁 폴더|📅 달력 날짜|🗓️ 일정 달력|📊 막대그래프 통계|📈 상승 그래프 주식|📉 하락 그래프|📋 체크리스트 클립보드|📦 상자 택배|✉️ 편지 메일|📧 이메일|📮 우체통|🔔 알림 종|📢 공지 확성기|📣 응원 메가폰|💡 아이디어 전구 팁|🔋 배터리|🔌 충전 플러그|🔍 검색 돋보기|🔑 열쇠|🔒 잠금 자물쇠 보안|🔓 잠금해제|🔨 망치|🛠️ 도구 수리|⚙️ 설정 톱니|🧲 자석|💊 약|💉 주사|🩹 반창고 밴드|🧹 청소 빗자루|🛒 장바구니 쇼핑|🛍️ 쇼핑백|🎁 선물|🎀 리본|🎈 풍선|🎉 축하 폭죽 파티|🎊 축하 색종이|🏆 트로피 우승|🥇 금메달 1등|🥈 은메달 2등|🥉 동메달 3등|🏅 메달|⚽ 축구|⚾ 야구|🏀 농구|🎾 테니스|🏐 배구|⛳ 골프|🚗 자동차|🚕 택시|🚌 버스|🚇 지하철|🚄 기차 KTX|✈️ 비행기 여행|🚀 로켓 출시|🚲 자전거|🏠 집|🏢 회사 빌딩|🏫 학교|🏥 병원|⛺ 캠핑 텐트|💰 돈 돈주머니|💵 지폐 달러|💳 카드 결제|💎 보석 다이아몬드|⏰ 알람 시계|⌛ 모래시계|⏳ 대기 모래시계" },
    { id: "symbol", name: "기호", emoji: true, s: "✅ 체크 완료 확인|☑️ 체크박스|✔️ 체크|❌ 엑스 틀림 취소|❎ 엑스 버튼|⭕ 동그라미 정답|❗ 느낌표 중요|❓ 물음표 질문|‼️ 느낌표 강조|⁉️ 물음표느낌표|⚠️ 경고 주의|⛔ 금지 진입금지|🚫 금지 안돼|🔞 19금 성인|♻️ 재활용|💯 백점 100점|🆗 오케이 OK|🆕 새것 NEW|🆓 무료 FREE|🆙 업 UP|🔝 탑 TOP|🆘 SOS 도움|ℹ️ 정보 안내|💤 졸림 zzz|💢 화남 분노|💬 말풍선 대화|💭 생각풍선|🔴 빨간원 빨강|🟠 주황원 주황|🟡 노란원 노랑|🟢 초록원 초록|🔵 파란원 파랑|🟣 보라원 보라|⚫ 검은원 검정|⚪ 흰원 하양|🟥 빨간네모|🟧 주황네모|🟨 노란네모|🟩 초록네모|🟦 파란네모|🟪 보라네모|⬛ 검은네모|⬜ 흰네모|🔶 주황다이아|🔷 파란다이아|🔸 작은주황다이아|🔹 작은파란다이아|🔺 빨간삼각형 위|🔻 빨간삼각형 아래|➕ 더하기 플러스|➖ 빼기 마이너스|✖️ 곱하기|➗ 나누기|♾️ 무한|💲 달러|©️ 저작권|®️ 등록상표|™️ 상표|#️⃣ 샵 해시|*️⃣ 별표|0️⃣ 숫자0 영|1️⃣ 숫자1 하나 번호|2️⃣ 숫자2 둘 번호|3️⃣ 숫자3 셋 번호|4️⃣ 숫자4 넷 번호|5️⃣ 숫자5 다섯 번호|6️⃣ 숫자6 여섯 번호|7️⃣ 숫자7 일곱 번호|8️⃣ 숫자8 여덟 번호|9️⃣ 숫자9 아홉 번호|🔟 숫자10 열 번호|▶️ 재생|⏸️ 일시정지|⏹️ 정지|⏩ 빨리감기|🔁 반복|🔀 셔플|🔇 음소거|🔊 소리|📶 신호 와이파이|♀️ 여성|♂️ 남성|⚡ 번개 전기|🌀 소용돌이" },
    { id: "heart", name: "하트", emoji: false, s: "❤️ 빨간하트 하트 사랑|🧡 주황하트 하트|💛 노란하트 하트|💚 초록하트 하트|💙 파란하트 하트|💜 보라하트 하트|🖤 검은하트 하트|🤍 흰하트 하트|🤎 갈색하트 하트|💔 깨진하트 하트 이별 상처|❣️ 하트느낌표 하트|💕 두하트 하트|💞 회전하트 하트|💓 두근두근 하트|💗 설렘 커지는하트 하트|💖 반짝하트 하트|💘 큐피드 화살하트 하트|💝 리본하트 하트 선물|💟 하트장식 하트|❤️‍🔥 불타는하트 하트 열정|❤️‍🩹 회복하트 하트 치유|💌 러브레터 하트 편지|💋 입술 키스|💍 반지 결혼 프러포즈|💒 결혼식장|💑 커플 하트|♥ 하트 검은하트 특수문자|♡ 빈하트 하트 특수문자|❤ 하트 특수문자|❥ 꼬리하트 하트 특수문자|❦ 꽃하트 하트 특수문자|❧ 꽃하트 하트 특수문자|ღ 하트 기호 특수문자|♥︎ 하트 글자형 특수문자" },
  ];
  // 번호가 붙은 문자(원문자·괄호 숫자·로마 숫자 등)는 유니코드 구간으로 만들어 데이터 크기를 줄임(emoji-more.js에서도 씀)
  const range = (from, n, name) => Array.from({ length: n }, (_, i) => `${String.fromCodePoint(from + i)} ${name}${i + 1} ${name} 번호`).join("|");
  const rangeK = (from, labels, name) => labels.map((l, i) => `${String.fromCodePoint(from + i)} ${name}${l} ${name} 번호`).join("|");
  const GA = ["가", "나", "다", "라", "마", "바", "사", "아", "자", "차", "카", "타", "파", "하"];
  const JA = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

  // ---- P2-68 늦게 받는 데이터(emoji-more.js) ----
  // MORE.tabs: [{ id, name, gh?, groups: [{ id, name, e?(RGI 검사), s?(문자 목록) | t?([글, "이름 검색어…"]) | p?([이름, 글]) }] }]
  // MORE.mean: { 문자(FE0F 뺌): "이름 — 의미" }, MORE.alias: { 검색어: [문자…] } (앞에 둔 문자가 검색 결과 맨 앞)
  const MORE = { tabs: [], mean: {}, alias: {}, loaded: false };
  const bare = (c) => String(c).replace(/️/g, "");
  let extraK = new Map(); // 문자 → 별칭 검색어
  function addMore(def) {
    MORE.tabs = def.tabs || [];
    MORE.mean = {};
    for (const x of String(def.mean || "").split("|")) { const i = x.indexOf("="); if (i > 0) MORE.mean[bare(x.slice(0, i))] = x.slice(i + 1); }
    MORE.alias = {};
    extraK = new Map();
    for (const x of String(def.alias || "").split("|")) {
      const [key, chars] = x.split(":");
      if (!key || !chars) continue;
      const seg = typeof Intl !== "undefined" && Intl.Segmenter ? [...new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(chars)].map((s) => s.segment) : [...chars];
      MORE.alias[key] = seg;
      for (const c of seg) extraK.set(bare(c), `${extraK.get(bare(c)) || ""} ${key}`);
    }
    MORE.loaded = true;
    cache = null;
  }
  const kOf = (c, base) => `${base} ${extraK.get(bare(c)) || ""}`.toLowerCase();
  // 「문자 이름 검색어…」 → { c, n, k, g, ty }. 검색어(k)에는 분류 이름·별칭도 넣음. ty: c(문자) t(글 조합) p(프리셋) gh(깃허브 코드)
  const parse = (cat) => cat.s.split("|").map((x) => { const p = x.split(" "); return { c: p[0], n: p[1] || "", k: kOf(p[0], `${p.slice(1).join(" ")} ${cat.name}`), g: cat.name, ty: "c" }; });
  const parseGroup = (tab, g) => {
    const tag = `${g.name} ${tab.name}`;
    if (g.p) return g.p.map(([n, c]) => ({ c, n, k: `${n} ${tag} 프리셋 템플릿`.toLowerCase(), g: g.name, ty: "p" }));
    if (g.t) return g.t.map(([c, kw]) => ({ c, n: kw.split(" ")[0], k: `${kw} ${tag}`.toLowerCase(), g: g.name, ty: "t" }));
    if (tab.gh) return g.s.split("|").map((x) => { const p = x.split(" "); return { c: p[0], code: p[1], n: p[2] || "", k: `${p.slice(1).join(" ")} ${tag}`.toLowerCase(), g: g.name, ty: "gh" }; });
    return g.s.split("|").map((x) => { const p = x.split(" "); return { c: p[0], n: p[1] || "", k: kOf(p[0], `${p.slice(1).join(" ")} ${tag}`), g: g.name, ty: "c" }; });
  };
  // 탭 목록: 유니코드 분류는 뒤쪽(row: "uni")
  const tabs = () => [
    { id: "frequent", name: "자주 찾는", row: "main", core: true },
    { id: "recent", name: "최근", row: "main", core: true },
    ...MORE.tabs.map((t) => ({ id: t.id, name: t.name, row: "main", gh: !!t.gh, groups: t.groups.map((g) => ({ id: g.id, name: g.name })) })),
    ...CATS.filter((c) => c.id !== "frequent").map((c) => ({ id: c.id, name: c.name, row: "uni", core: true })),
  ];
  // 분류 목록(검색·빌드 검사용). 늦은 데이터의 소분류는 「탭id-소분류id」
  let cache = null;
  function items() {
    if (cache) return cache;
    cache = [
      ...CATS.map((c) => ({ id: c.id, tab: c.id, name: c.name, emoji: c.emoji, list: parse(c) })),
      ...MORE.tabs.flatMap((t) => t.groups.map((g) => ({ id: `${t.id}-${g.id}`, tab: t.id, sub: g.id, name: g.name, tabName: t.name, emoji: !!g.e, multi: !!(g.t || g.p), gh: !!t.gh, list: parseGroup(t, g) }))),
    ];
    return cache;
  }
  const meaning = (c) => MORE.mean[bare(c)] || "";

  // 검색: ① 「이모지·복사·모음」 같은 말은 뺌 ② 모든 낱말이 이름·검색어·별칭에 들어 있으면 맞음(낱말 끝 「하는·는·한…」은 떼어서도 봄)
  // ③ 하나도 없으면 띄어쓰기를 붙여서(「동그라미 숫자」→「동그라미숫자」), 그래도 없으면 낱말 하나만 맞아도 보여 줌
  // 같은 문자는 한 번만(가장 좋은 순위로). 깃허브 코드(:rocket:)는 영문·「:」로 찾을 때만 나옴
  const STOP = new Set(["이모지", "이모티콘", "이모지들", "특수문자", "특수기호", "기호", "복사", "복사하기", "모음", "종류", "종류별", "모양", "표시", "문자", "아이콘", "의미", "뜻", "추천", "모음집", "단축키", "얼굴", "표정", "사람", "예쁜", "emoji", "copy"]);
  const SUF = ["하는", "하기", "하고", "해서", "되는", "흘리는", "는", "은", "한", "된", "인", "의", "을", "를", "이", "가", "서", "요"];
  const stem = (w) => { for (const s of SUF) if (w.length > s.length && w.endsWith(s)) return w.slice(0, -s.length); return ""; };
  function run(words, all, mode) {
    const w0 = words[0];
    const latin = /^[:a-z0-9_+\-]+$/.test(w0);
    const al = MORE.alias[w0] || MORE.alias[stem(w0)] || [];
    const best = new Map();
    let i = 0;
    for (const cat of all) for (const it of cat.list) {
      i++;
      if (it.ty === "gh" && !latin) continue;
      const hit = (w) => it.k.includes(w) || it.c === w || (it.code && it.code.includes(w)) || (stem(w) && it.k.includes(stem(w)));
      if (!(mode === "or" ? words.some(hit) : words.every(hit))) continue;
      const ai = al.findIndex((x) => bare(x) === bare(it.c));
      const r = ai >= 0 ? -100 + ai : it.g.startsWith(w0) ? 0 : it.c === w0 || it.n.toLowerCase().startsWith(w0) ? 1 : it.k.split(" ").some((t) => t.startsWith(w0)) ? 2 : 3;
      const key = it.ty === "gh" ? `gh${it.code}` : it.c;
      const old = best.get(key);
      if (!old || r < old.r) best.set(key, { it, r, i: old ? old.i : i });
    }
    // 순서: 별칭 순서 → 분류 이름이 검색어로 시작(「하트」면 하트 분류 먼저) → 이름이 검색어로 시작 → 검색어 낱말이 검색어로 시작 → 그 밖(「별」을 찾을 때 「이별」은 뒤로)
    return [...best.values()].sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.it);
  }
  function search(q, all) {
    let words = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const core = words.filter((w) => !STOP.has(w));
    if (core.length) words = core;
    all = all || items();
    let r = run(words, all, "and");
    if (!r.length && words.length > 1) r = run([words.join("")], all, "and");
    if (!r.length && words.length > 1) r = run(words, all, "or");
    return r;
  }

  // ---- 번호 매기기 ----
  const KEYCAP = (d) => d + String.fromCodePoint(0xfe0f, 0x20e3); // 숫자 + 이모지 표시 선택자 + 키캡 테두리
  const NUMS = {
    keycap: { name: "1️⃣ 2️⃣ 3️⃣", f: (n) => (n === 10 ? "🔟" : String(n).split("").map(KEYCAP).join("")) },
    circle: { name: "① ② ③", f: (n) => (n <= 20 ? String.fromCodePoint(0x245f + n) : n <= 35 ? String.fromCodePoint(0x3250 + n - 20) : n <= 50 ? String.fromCodePoint(0x32b0 + n - 35) : null) },
    black: { name: "❶ ❷ ❸", f: (n) => (n <= 10 ? String.fromCodePoint(0x2775 + n) : n <= 20 ? String.fromCodePoint(0x24eb + n - 11) : null) },
    paren: { name: "⑴ ⑵ ⑶", f: (n) => (n <= 20 ? String.fromCodePoint(0x2473 + n) : `(${n})`) },
    dot: { name: "1. 2. 3.", f: (n) => `${n}.` },
    bracket: { name: "1) 2) 3)", f: (n) => `${n})` },
    ganada: { name: "가. 나. 다.", f: (n) => (n <= 14 ? `${GA[n - 1]}.` : null) },
    jamo: { name: "㉠ ㉡ ㉢", f: (n) => (n <= 14 ? String.fromCodePoint(0x325f + n) : null) },
    roman: { name: "Ⅰ Ⅱ Ⅲ", f: (n) => (n <= 12 ? String.fromCodePoint(0x215f + n) : null) },
  };
  const number = (style, n) => { const s = NUMS[style]; if (!s) return ""; const r = s.f(n); return r == null ? `${n}.` : r; }; // 문자 구간을 넘으면 「n.」

  // 일괄 삽입: 각 줄 앞(번호 → 기호)·뒤에 붙임. 줄 앞 들여쓰기는 그대로 두고 그 뒤에 넣음
  // o: { front, back, num(번호 모양 | ""), start(시작 번호), skipBlank(빈 줄 건너뛰기), space(기호와 글 사이 띄어쓰기) }
  function decorate(text, opt) {
    const o = Object.assign({ front: "", back: "", num: "", start: 1, skipBlank: true, space: true }, opt || {});
    const sp = o.space ? " " : "";
    let n = (Number(o.start) || 1) - 1;
    return String(text == null ? "" : text).replace(/\r\n?/g, "\n").split("\n").map((line) => {
      if (o.skipBlank && !line.trim()) return line;
      n++;
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(line);
      const head = [o.num ? number(o.num, n) : "", o.front].filter(Boolean).join(" ");
      return `${m[1]}${head ? head + sp : ""}${m[2]}${o.back ? sp + o.back : ""}`;
    }).join("\n");
  }

  root.EMOJIDATA = { CATS, items, tabs, search, decorate, number, NUMS, addMore, meaning, range, rangeK, GA, JA, MORE };
})(typeof window !== "undefined" ? window : globalThis);
