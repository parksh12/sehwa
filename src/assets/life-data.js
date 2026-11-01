// 인생 게임 데이터 — 터닝포인트(TURNS) + 그 사이 작은 사건(SLOTS 100개, NEEDS로 선택 결과와 맞는 것만) + 스쳐 가는 장면.
// 갈림길: [장면, 선택 A, 결 A, 선택 B, 결 B, 도트 장면 키]   결: a 모험 / l 사랑 / s 안정 / f 재미
// 장면 키는 시기마다 배경이 3종 이상이어야 하고, build.mjs가 빌드 때 검사합니다.
(function () {
  const SLOTS = [
    [[4, 7], [
      ["유치원 장기자랑 날", "무대 한가운데로", "f", "맨 뒷줄에서 율동", "s", "k-talent"],
      ["오락실에 처음 보는 아이가 있다", "같이 놀자고 한다", "l", "그네만 탄다", "s", "k-playground"],
      ["마트에서 과자를 하나만 고르라고 한다", "처음 보는 과자", "a", "늘 먹던 과자", "s", "k-snack"],
      ["크리스마스 선물을 고른다", "로봇 장난감", "f", "그림책 세트", "s", "k-gift"],
      ["소풍 날 비가 온다", "우비 입고 물웅덩이로", "f", "창가에서 구경", "s", "k-rain"],
      ["옆자리 친구가 울고 있다", "사탕을 나눠 준다", "l", "선생님을 부른다", "s", "k-cry"],
      ["자전거 보조 바퀴를 떼 보자고 한다", "당장 뗀다", "a", "조금만 더 탄다", "s", "k-bike"],
      ["할머니 댁에 놀러 갔다", "개울에서 가재 잡기", "a", "할머니 옆에서 낮잠", "l", "k-grandma"],
      ["처음으로 혼자 심부름을 간다", "씩씩하게 출발", "a", "동생 손 잡고 간다", "l", "k-errand"],
      ["그림 그리기 시간", "하늘을 초록색으로", "f", "보이는 그대로", "s", "k-paint"],
    ]],
    [[8, 11], [
      ["골목에서 아기 고양이를 만났다", "집에 데려가자고 조른다", "l", "몰래 우유만 두고 온다", "s", "c-cat"],
      ["반장 선거가 열렸다", "손을 번쩍 든다", "a", "친구를 추천한다", "l", "c-vote"],
      ["방학 탐구 과제를 정한다", "개미굴 관찰", "a", "교과서 실험 따라 하기", "s", "c-study"],
      ["용돈 만 원이 생겼다", "뽑기 기계에 전부", "f", "돼지 저금통에", "s", "c-money"],
      ["학예회 연극 배역을 정한다", "주인공 오디션", "f", "나무 3 역할", "s", "c-play"],
      ["친구 생일 파티에 초대받았다", "선물을 직접 만든다", "l", "문구점에서 산다", "s", "c-party"],
      ["수영을 배울 기회가 생겼다", "바로 물에 뛰어든다", "a", "발차기부터 천천히", "s", "c-swim"],
      ["전학 온 친구가 혼자 앉아 있다", "옆자리로 간다", "l", "쉬는 시간에 말 건다", "s", "c-newkid"],
      ["운동회 계주 선수를 뽑는다", "내가 뛰겠다고 한다", "a", "응원단장을 맡는다", "f", "c-relay"],
      ["비 오는 날 우산이 하나뿐이다", "친구와 같이 쓴다", "l", "뛰어서 간다", "f", "c-umbrella"],
    ]],
    [[12, 15], [
      ["방학 숙제가 산더미다", "마지막 날 밤샘", "f", "하루 한 장씩", "s", "t-homework"],
      ["처음으로 휴대폰이 생겼다", "게임부터 깐다", "f", "단어장 앱부터", "s", "t-phone"],
      ["동아리를 정해야 한다", "밴드부", "f", "과학 탐구반", "s", "t-club"],
      ["친구들이 노래방에 가자고 한다", "마이크를 잡는다", "f", "탬버린 담당", "l", "t-karaoke"],
      ["시험 전날 밤", "벼락치기", "f", "평소처럼 잔다", "s", "t-examnight"],
      ["친한 친구와 크게 다퉜다", "먼저 사과한다", "l", "시간을 둔다", "s", "t-fight"],
      ["수학여행 장기자랑", "춤 무대를 준비한다", "f", "무대 뒤 소품 담당", "s", "t-trip"],
      ["용돈을 모아 뭔가 사려 한다", "기타를 산다", "f", "운동화를 산다", "s", "t-shopping"],
      ["혼자 버스를 타고 시내에 가 본다", "모르는 동네까지", "a", "아는 곳까지만", "s", "t-bus"],
      ["가족 여행지를 골라 보라고 한다", "처음 가는 섬", "a", "작년에 간 계곡", "s", "t-island"],
    ]],
    [[16, 19], [
      ["짝사랑과 교실에 단둘이 남았다", "말을 건다", "l", "창밖만 본다", "s", "s-confess"],
      ["진로 상담 시간", "하고 싶은 일", "a", "안정적인 일", "s", "s-counsel"],
      ["시험이 끝난 날", "친구들과 밤새 논다", "f", "가족과 외식", "l", "s-free"],
      ["첫 아르바이트를 구한다", "카페", "f", "편의점", "s", "s-parttime"],
      ["졸업식 날", "교복에 친구들 사인 받기", "l", "사진만 찍고 집으로", "s", "s-grad"],
      ["친구가 같이 영상 채널을 해 보자고 한다", "당장 채널 개설", "a", "구독만 해 준다", "s", "s-channel"],
      ["고백 편지를 받았다", "답장을 쓴다", "l", "모른 척한다", "s", "s-letter"],
      ["반 대항 줄다리기", "맨 앞에서 끈다", "a", "맨 뒤에서 버틴다", "s", "s-tug"],
      ["오늘 밤 유성우가 온다는 뉴스", "옥상으로 올라간다", "a", "영상으로 본다", "s", "s-meteor"],
      ["대학 원서를 쓴다", "멀리 있는 학교", "a", "집 근처 학교", "l", "s-apply"],
    ]],
    [[20, 24], [
      ["첫 아르바이트 월급이 들어왔다", "혼자 배낭여행", "a", "적금 통장 개설", "s", "a-firstpay"],
      ["동아리 엠티 장기자랑", "사회를 본다", "f", "구석에서 박수", "s", "a-mt"],
      ["교환학생 공고가 떴다", "지원한다", "a", "이번엔 넘긴다", "s", "a-exchange"],
      ["소개팅 제안이 들어왔다", "나가 본다", "l", "다음에", "s", "a-blind"],
      ["자취를 할지 고민된다", "독립한다", "a", "집에서 다닌다", "l", "a-move"],
      ["부모님께 첫 선물을 한다", "안마 의자 예약", "l", "용돈 봉투", "s", "a-gift"],
      ["운전면허를 딸까", "당장 학원 등록", "a", "대중교통이면 충분", "s", "a-drive"],
      ["친구 밴드가 보컬을 구한다", "오디션을 본다", "f", "공연 보러만 간다", "s", "a-band"],
      ["새벽 세 시, 갑자기 바다가 보고 싶다", "첫차 타고 간다", "a", "사진으로 참는다", "s", "a-sea"],
      ["학기 첫날 옆자리 사람", "먼저 인사한다", "l", "이어폰을 꽂는다", "s", "a-campus"],
    ]],
    [[25, 29], [
      ["친구가 같이 창업하자고 한다", "같이 한다", "a", "응원만 한다", "s", "w-startup"],
      ["첫 직장 회식 노래방", "첫 곡을 부른다", "f", "분위기 맞추기", "s", "w-dinner"],
      ["아무 약속 없는 주말 아침", "새벽 등산", "a", "늦잠 자고 만화책", "f", "w-hike"],
      ["이직 제안이 왔다", "옮긴다", "a", "지금 회사에 남는다", "s", "w-offer"],
      ["연애 기념일이 다가온다", "깜짝 여행", "a", "집에서 요리", "l", "w-anniv"],
      ["적금이 만기됐다", "세계 일주", "a", "보증금에 보탠다", "s", "w-world"],
      ["입사 동기가 힘들어 보인다", "퇴근길에 밥 한 끼", "l", "메신저로 응원", "s", "w-colleague"],
      ["강아지 입양 공고를 봤다", "입양한다", "l", "봉사부터 해 본다", "s", "w-dog"],
      ["사내 장기자랑 공지가 떴다", "팀 대표로 나간다", "f", "촬영 담당", "s", "w-talent"],
      ["주말에 뭘 배워 볼까", "서핑", "a", "요리", "l", "w-surf"],
    ]],
    [[30, 39], [
      ["고백을 받았다", "좋아요", "l", "조금만 생각할게요", "s", "m-confess"],
      ["해외 발령 제안이 왔다", "간다", "a", "가족 곁에 남는다", "l", "m-abroad"],
      ["친구 결혼식 축가를 부탁받았다", "부른다", "f", "정중히 사양", "s", "m-song"],
      ["기쁜 소식이 생겼다", "동네방네 알린다", "f", "조용히 둘이 기뻐한다", "l", "m-news"],
      ["큰 프로젝트 리더 제안", "맡는다", "a", "팀원으로 남는다", "s", "m-leader"],
      ["내 집 마련 기회가 왔다", "과감하게 산다", "a", "좀 더 모은다", "s", "m-house"],
      ["대학 동창 모임 연락", "1차부터 간다", "l", "2차만 간다", "f", "m-reunion"],
      ["번아웃이 왔다", "한 달 휴직", "a", "주말만 푹 쉰다", "s", "m-burnout"],
      ["취미를 하나 시작한다", "보드게임 모임", "f", "새벽 러닝", "s", "m-hobby"],
      ["부모님이 여행 가자고 하신다", "휴가 내고 간다", "l", "다음 달로 미룬다", "s", "m-parents"],
    ]],
    [[40, 49], [
      ["갑자기 춤이 배우고 싶어졌다", "학원 등록", "f", "영상 보며 독학", "s", "f-dance"],
      ["연락 끊겼던 친구에게서 문자가 왔다", "당장 만나러 간다", "l", "다음에 보자고 한다", "s", "f-text"],
      ["아이 학교 운동회 학부모 계주", "뛴다", "a", "응원한다", "l", "f-relay"],
      ["건강검진에서 운동하라고 한다", "마라톤 신청", "a", "동네 산책부터", "s", "f-checkup"],
      ["승진 제안이 왔다", "받는다", "s", "현장에 남는다", "f", "f-promo"],
      ["캠핑 장비를 살까 말까", "풀세트 구매", "a", "빌려서 먼저", "s", "f-camp"],
      ["아파트 동 대표를 뽑는다", "맡는다", "l", "투표만 한다", "s", "f-rep"],
      ["옛 친구가 밴드를 다시 하자고 한다", "합주실 예약", "f", "추억만 이야기", "l", "f-band"],
      ["주말 농장 분양 공고", "신청한다", "a", "베란다 화분으로", "s", "f-farm"],
      ["가족사진을 찍을까", "사진관 예약", "l", "폰으로 셀카", "f", "f-photo"],
    ]],
    [[50, 59], [
      ["두 번째 직업을 고민 중이다", "빵집을 연다", "a", "하던 일을 마저", "s", "g-bakery"],
      ["아이가 독립한다고 한다", "박수 치며 보낸다", "a", "반찬을 잔뜩 싸 준다", "l", "g-leave"],
      ["오래 다닌 회사에서 퇴직 제안", "받아들인다", "a", "끝까지 다닌다", "s", "g-retire"],
      ["동창회에서 노래를 시킨다", "18번을 부른다", "f", "박수로 넘긴다", "s", "g-reunion"],
      ["버킷리스트를 쓰기 시작했다", "오로라 보기", "a", "가족 여행 매년 가기", "l", "g-bucket"],
      ["SNS를 해 보라고 권한다", "매일 사진 올리기", "f", "구경만 하기", "s", "g-sns"],
      ["부모님 댁이 멀다", "근처로 이사", "l", "주말마다 찾아가기", "s", "g-parents"],
      ["자격증 공부를 해 볼까", "도전한다", "a", "독서 모임으로", "s", "g-cert"],
      ["결혼기념일이 다가온다", "신혼여행지 다시 가기", "l", "집에서 조용히", "s", "g-anniv"],
      ["동네 탁구 대회가 열린다", "출전한다", "f", "관중석에서", "s", "g-pingpong"],
    ]],
    [[60, 78], [
      ["손주가 게임을 가르쳐 달란다", "밤새 같이 한다", "f", "산책 가자고 꼬신다", "l", "e-grandkid"],
      ["버킷리스트 마지막 줄", "스카이다이빙", "a", "고향 바다 보러 가기", "l", "e-skydive"],
      ["동네 노래자랑이 열렸다", "트로트 한 곡 뽑는다", "f", "맨 앞줄 박수 담당", "l", "e-singing"],
      ["은퇴 후 첫 월요일", "배낭 메고 기차역으로", "a", "실컷 늦잠", "s", "e-retire"],
      ["복지관 컴퓨터 교실 모집", "등록한다", "a", "손주에게 배운다", "l", "e-computer"],
      ["옛 연인 소식을 들었다", "안부 문자", "l", "좋은 추억으로 둔다", "s", "e-oldlove"],
      ["텃밭에 무엇을 심을까", "처음 보는 허브", "a", "상추와 고추", "s", "e-garden"],
      ["동네 아이가 길을 묻는다", "직접 데려다준다", "l", "자세히 알려 준다", "s", "e-guide"],
      ["여행을 떠나기로 했다", "크루즈 세계 일주", "a", "가족과 제주도", "l", "e-trip"],
      ["자서전을 써 볼까", "쓴다", "a", "사진첩만 정리", "l", "e-memoir"],
    ]],
  ];

  // 스쳐 가는 장면: [[나이 범위], [문장 5개]]  시기마다 2개씩 무작위
  const MOMENTS = [
    [[1, 3], ["까꿍 놀이에 푹 빠졌다", "첫 단어를 말했다", "이가 났다", "기저귀를 뗐다", "숟가락질을 배웠다"]],
    [[4, 7], ["편식을 시작했다", "자전거를 배웠다", "첫 젖니가 빠졌다", "받아쓰기 100점", "공룡 이름을 다 외웠다"]],
    [[8, 11], ["키가 한 뼘 컸다", "줄넘기 2단 뛰기 성공", "일기장을 샀다", "단짝 친구가 생겼다", "처음으로 혼자 잤다"]],
    [[12, 15], ["목소리가 변했다", "첫 여드름이 났다", "좋아하는 가수가 생겼다", "교복이 작아졌다", "밤새 만화책을 봤다"]],
    [[16, 19], ["신분증이 나왔다", "첫 콘서트에 갔다", "밤새 이야기할 친구가 생겼다", "라면 물 조절을 마스터했다", "키 성장이 멈췄다"]],
    [[20, 29], ["첫 이사를 했다", "단골 국밥집이 생겼다", "처음으로 정장을 샀다", "친구 결혼식에 갔다", "통장 잔고에 놀랐다"]],
    [[30, 39], ["흰머리 한 가닥을 발견했다", "화분을 키우기 시작했다", "허리가 아프기 시작했다", "국밥집 사장님이 얼굴을 외웠다", "새벽에 깨면 잠이 안 온다"]],
    [[40, 49], ["메뉴판 글씨가 작아 보인다", "건강검진 결과: 이상 없음", "등산복이 늘었다", "아이돌 이름이 헷갈린다", "동창 단톡방이 생겼다"]],
    [[50, 59], ["돋보기를 샀다", "트로트가 좋아졌다", "아침잠이 없어졌다", "옛날 사진을 자주 꺼내 본다", "인생 절반을 넘긴 것 같다"]],
    [[60, 79], ["화분이 열 개가 됐다", "손주 사진이 배경화면이 됐다", "산책 친구가 생겼다", "새벽 수영을 다닌다", "건강 비결을 묻는 사람이 생겼다"]],
    [[80, 99], ["여든 번째 봄을 맞았다", "동네 최고령 멤버가 됐다", "옛 노래를 흥얼거린다", "증손주를 안아 봤다", "다들 비결을 묻는다"]],
  ];

  // 도트 장면 (pixel.js 형식)  bg 배경 · tod 시간대(day/sunset/night) · pose 내 자세(stand/walk/act) · who 내 x 위치
  // with: [[역할, x, 자세]] 역할 = mom·dad·friend·friend2·lover·kid(아이·손주)·child(다 큰 자녀)·teacher·gran
  // props: 사람 앞 소품 [[이름, x, y]] (y 생략 = 바닥) · back: 사람 뒤 소품 · fx: rain/bunting/sparkle
  const S = (bg, o = {}) => ({ bg, ...o });
  const SCENES = {
    // 4~7세
    "k-talent": S("class", { pose: "act", with: [["friend", 22, "stand"], ["friend2", 62, "act"]], props: [["note", 30, 14], ["note", 60, 10]], fx: ["sparkle"] }),
    "k-playground": S("park", { with: [["friend", 56, "walk"]], props: [["ball", 34]] }),
    "k-snack": S("street", { pose: "stand", with: [["mom", 58, "stand"]], props: [["snack", 52, 44]] }),
    "k-gift": S("home", { tod: "night", pose: "act", props: [["gift", 28], ["robot", 56]], fx: ["sparkle"] }),
    "k-rain": S("park", { pose: "walk", props: [["umbrella", 43, 31]], fx: ["rain"] }),
    "k-cry": S("class", { pose: "stand", with: [["friend", 56, "stand"]], props: [["tear", 60, 47], ["star", 53, 40]] }),
    "k-bike": S("street", { pose: "walk", with: [["dad", 22, "act"]], back: [["bike", 50]] }),
    "k-grandma": S("village", { pose: "stand", with: [["gran", 58, "stand"]] }),
    "k-errand": S("street", { pose: "walk", props: [["snack", 53, 45]] }),
    "k-paint": S("class", { pose: "stand", back: [["easel", 56]] }),
    // 8~11세
    "c-cat": S("street", { pose: "stand", props: [["cat", 56], ["milk", 52]] }),
    "c-vote": S("class", { pose: "act", with: [["friend", 24, "stand"]], props: [["ballot", 58]] }),
    "c-study": S("home", { tod: "night", pose: "stand", props: [["books", 54], ["lamp", 30, 45]] }),
    "c-money": S("street", { pose: "act", props: [["coins", 55]], fx: ["sparkle"] }),
    "c-play": S("class", { pose: "act", with: [["friend", 58, "stand"]], props: [["note", 30, 12]], fx: ["sparkle"] }),
    "c-party": S("home", { pose: "act", with: [["friend", 58, "act"]], props: [["cake", 28]] }),
    "c-swim": S("beach", { pose: "act", with: [["friend", 58, "act"]] }),
    "c-newkid": S("class", { pose: "stand", with: [["friend", 58, "stand"]], props: [["heart", 52, 30]] }),
    "c-relay": S("field", { pose: "walk", with: [["friend", 62, "walk"], ["friend2", 22, "act"]], fx: ["bunting"] }), // 운동회
    "c-umbrella": S("street", { pose: "walk", with: [["friend", 52, "walk"]], props: [["umbrella", 47, 30]], fx: ["rain"] }),
    // 12~15세
    "t-homework": S("home", { tod: "night", pose: "stand", props: [["books", 54], ["books", 54, 42], ["zz", 56, 30]] }),
    "t-phone": S("home", { pose: "stand", props: [["phone", 53, 41]], fx: ["sparkle"] }),
    "t-club": S("class", { pose: "stand", with: [["friend", 62, "act"]], props: [["guitar", 54], ["note", 28, 12]] }),
    "t-karaoke": S("street", { tod: "night", pose: "act", with: [["friend", 24, "act"]], back: [["neon", 60, 12]], props: [["mic", 55]] }),
    "t-examnight": S("home", { tod: "night", pose: "stand", props: [["books", 28], ["clock", 54, 30], ["lamp", 56, 44]] }),
    "t-fight": S("gate", { tod: "sunset", pose: "stand", with: [["friend", 60, "stand"]] }),
    "t-trip": S("village", { tod: "night", pose: "act", with: [["friend", 22, "act"], ["friend2", 64, "stand"]], props: [["mic", 55], ["fire", 34]] }), // 수학여행
    "t-shopping": S("street", { pose: "act", props: [["guitar", 55], ["coins", 30]] }),
    "t-bus": S("street", { pose: "walk", back: [["bus", 58, 36]] }),
    "t-island": S("beach", { pose: "act", with: [["mom", 22, "stand"], ["dad", 60, "act"]] }),
    // 16~19세
    "s-confess": S("class", { tod: "sunset", pose: "stand", with: [["lover", 56, "stand"]], props: [["heart", 50, 24]] }), // 첫사랑 고백
    "s-counsel": S("class", { pose: "stand", with: [["teacher", 58, "stand"]], props: [["paper", 53, 42]] }),
    "s-free": S("street", { tod: "night", pose: "act", with: [["friend", 58, "act"]], fx: ["sparkle"] }),
    "s-parttime": S("street", { pose: "stand", props: [["cup", 53, 43]] }),
    "s-grad": S("gate", { pose: "act", with: [["mom", 22, "stand"], ["dad", 62, "stand"]], props: [["bouquet", 51, 40]] }), // 졸업식
    "s-channel": S("home", { pose: "act", props: [["camera", 54, 40], ["phone", 30, 40]] }),
    "s-letter": S("gate", { tod: "sunset", pose: "stand", with: [["lover", 58, "stand"]], props: [["envelope", 50, 44], ["heart", 52, 28]] }),
    "s-tug": S("field", { pose: "act", with: [["friend", 58, "act"], ["friend2", 26, "act"]], props: [["rope", 20, 48]], fx: ["bunting"] }),
    "s-meteor": S("village", { tod: "night", pose: "act", props: [["shoot", 60, 4], ["star", 22, 8]] }),
    "s-apply": S("home", { tod: "night", pose: "stand", props: [["books", 54], ["paper", 30, 40]] }),
    // 20~24세
    "a-firstpay": S("home", { pose: "act", props: [["envelope", 52, 34], ["coins", 28]], fx: ["sparkle"] }), // 첫 월급
    "a-mt": S("beach", { tod: "night", pose: "act", with: [["friend", 22, "act"], ["friend2", 64, "stand"]], props: [["fire", 34], ["mic", 56]] }),
    "a-exchange": S("airport", { pose: "walk", props: [["suitcase", 55]] }),
    "a-blind": S("street", { tod: "sunset", pose: "stand", with: [["lover", 58, "stand"]], props: [["cup", 52, 44], ["heart", 50, 24]] }),
    "a-move": S("home", { pose: "walk", props: [["box", 56], ["box", 24]] }),
    "a-gift": S("home", { pose: "stand", with: [["mom", 22, "act"], ["dad", 62, "stand"]], props: [["gift", 54]] }),
    "a-drive": S("street", { pose: "act", back: [["car", 56]] }),
    "a-band": S("street", { tod: "night", pose: "act", with: [["friend", 62, "stand"]], props: [["guitar", 56], ["mic", 34]] }),
    "a-sea": S("beach", { tod: "sunset", pose: "stand" }),
    "a-campus": S("class", { pose: "stand", with: [["friend", 58, "stand"]] }),
    // 25~29세
    "w-startup": S("office", { pose: "act", with: [["friend", 58, "stand"]], props: [["bulb", 46, 22]], fx: ["sparkle"] }), // 창업
    "w-dinner": S("street", { tod: "night", pose: "act", with: [["friend", 24, "act"]], back: [["neon", 60, 12]], props: [["mic", 55]] }),
    "w-hike": S("village", { pose: "walk", props: [["pack", 52, 42]] }),
    "w-offer": S("office", { pose: "stand", props: [["phone", 53, 41], ["envelope", 22, 40]] }),
    "w-anniv": S("park", { tod: "sunset", pose: "stand", with: [["lover", 56, "stand"]], props: [["heart", 50, 24], ["cake", 30]] }),
    "w-world": S("airport", { pose: "walk", props: [["suitcase", 55]], fx: ["sparkle"] }), // 해외여행
    "w-colleague": S("office", { tod: "night", pose: "stand", with: [["friend", 58, "stand"]], props: [["cup", 53, 44]] }),
    "w-dog": S("park", { pose: "act", props: [["dog", 56]] }), // 반려동물
    "w-talent": S("office", { pose: "act", props: [["mic", 56], ["note", 30, 10]], fx: ["sparkle"] }),
    "w-surf": S("beach", { pose: "stand", props: [["surf", 56]] }),
    // 30~39세
    "m-confess": S("park", { tod: "sunset", pose: "stand", with: [["lover", 56, "stand"]], props: [["bouquet", 51, 41], ["heart", 50, 24]] }),
    "m-abroad": S("airport", { pose: "walk", with: [["lover", 62, "act"]], props: [["suitcase", 54]] }),
    "m-song": S("wedding", { pose: "act", with: [["friend", 22, "stand"], ["friend2", 64, "stand"]], props: [["mic", 55]] }),
    "m-news": S("home", { pose: "act", with: [["lover", 58, "act"]], props: [["heart", 50, 24]], fx: ["sparkle"] }),
    "m-leader": S("office", { pose: "act", with: [["friend", 22, "stand"], ["friend2", 62, "stand"]], props: [["bulb", 46, 22]] }),
    "m-house": S("home", { pose: "act", with: [["lover", 58, "act"]], props: [["key", 28, 34], ["house", 46, 20]], fx: ["sparkle"] }), // 내 집 마련
    "m-reunion": S("street", { tod: "night", pose: "act", with: [["friend", 24, "act"], ["friend2", 60, "stand"]] }),
    "m-burnout": S("home", { tod: "night", pose: "stand", props: [["zz", 55, 30]] }),
    "m-hobby": S("home", { pose: "act", with: [["friend", 60, "stand"]], props: [["pad", 52, 43]] }),
    "m-parents": S("village", { pose: "stand", with: [["mom", 22, "stand"], ["dad", 60, "stand"]] }),
    // 40~49세
    "f-dance": S("street", { tod: "night", pose: "act", props: [["note", 30, 14], ["note", 60, 12]], fx: ["sparkle"] }),
    "f-text": S("home", { pose: "stand", props: [["phone", 53, 41]] }),
    "f-relay": S("field", { pose: "walk", with: [["kid", 24, "act"]], fx: ["bunting"] }),
    "f-checkup": S("hosp", { pose: "stand", with: [["teacher", 60, "stand"]], props: [["paper", 55, 42]] }),
    "f-promo": S("office", { pose: "act", props: [["trophy", 56], ["envelope", 22, 40]] }),
    "f-camp": S("village", { tod: "sunset", pose: "stand", back: [["tent", 58]], props: [["fire", 30]] }),
    "f-rep": S("street", { pose: "act", props: [["ballot", 56]] }),
    "f-band": S("home", { pose: "act", with: [["friend", 62, "stand"]], props: [["guitar", 56]] }),
    "f-farm": S("park", { pose: "stand", props: [["sprout", 56], ["can", 30]] }),
    "f-photo": S("home", { pose: "act", with: [["lover", 58, "act"], ["kid", 26, "act"]], props: [["camera", 46, 26]], fx: ["sparkle"] }),
    // 50~59세
    "g-bakery": S("street", { pose: "act", props: [["bread", 54, 42], ["bread", 28]] }),
    "g-leave": S("home", { pose: "stand", with: [["child", 58, "walk"]], props: [["box", 72]] }),
    "g-retire": S("office", { tod: "sunset", pose: "walk", props: [["box", 50, 44]] }), // 퇴사
    "g-reunion": S("street", { tod: "night", pose: "act", with: [["friend", 24, "act"]], props: [["mic", 55]] }),
    "g-bucket": S("home", { tod: "night", pose: "stand", props: [["books", 54], ["star", 66, 10]] }),
    "g-sns": S("home", { pose: "act", props: [["camera", 54, 40], ["phone", 30, 40]] }),
    "g-parents": S("village", { pose: "stand", with: [["mom", 58, "stand"], ["dad", 22, "stand"]] }),
    "g-cert": S("class", { pose: "stand", props: [["books", 54], ["paper", 28, 40]] }),
    "g-anniv": S("beach", { tod: "sunset", pose: "stand", with: [["lover", 58, "stand"]], props: [["heart", 50, 24]] }),
    "g-pingpong": S("park", { pose: "act", props: [["trophy", 56]], fx: ["sparkle"] }),
    // 60세 이후
    "e-grandkid": S("home", { pose: "act", with: [["kid", 58, "act"]], props: [["pad", 50, 44]] }), // 손주
    "e-skydive": S("beach", { who: false, props: [["chute", 40, 8]] }),
    "e-singing": S("park", { pose: "act", props: [["mic", 55], ["note", 30, 12]], fx: ["sparkle"] }),
    "e-retire": S("street", { pose: "walk", props: [["pack", 52, 41]] }), // 은퇴
    "e-computer": S("office", { pose: "stand", with: [["teacher", 60, "stand"]] }),
    "e-oldlove": S("home", { tod: "sunset", pose: "stand", props: [["phone", 53, 41]] }),
    "e-garden": S("village", { pose: "stand", props: [["sprout", 56], ["can", 28]] }),
    "e-guide": S("street", { pose: "stand", with: [["kid", 58, "stand"]] }),
    "e-trip": S("airport", { pose: "walk", with: [["lover", 58, "walk"]], props: [["suitcase", 30]] }),
    "e-memoir": S("home", { tod: "night", pose: "stand", props: [["books", 54], ["lamp", 30, 45]] }),
    // 스쳐 가는 장면(인생 이정표)
    born: S("hosp", { who: false, with: [["mom", 32, "stand"], ["dad", 52, "act"]], props: [["bundle", 36, 46]] }), // 탄생
    "step-city": S("home", { pose: "walk", with: [["mom", 24, "act"], ["dad", 62, "act"]] }), // 첫걸음
    "step-sea": S("home", { pose: "walk", with: [["mom", 24, "act"], ["dad", 62, "act"]] }),
    "step-mountain": S("home", { pose: "walk", with: [["mom", 24, "act"], ["dad", 62, "act"]] }),
    "town-city": S("street", { pose: "walk", with: [["friend", 58, "walk"]] }),
    "town-sea": S("beach", { pose: "walk", with: [["friend", 58, "act"]] }),
    "town-mountain": S("village", { pose: "walk", with: [["friend", 58, "walk"]] }),
    enter: S("gate", { pose: "act", with: [["mom", 24, "stand"], ["dad", 60, "stand"]], props: [["pack", 52, 46]] }), // 입학식
    exam: S("class", { pose: "stand", with: [["friend", 22, "stand"]], props: [["paper", 53, 44], ["clock", 54, 24]] }), // 수능
    work: S("office", { pose: "walk", props: [["brief", 52, 47]] }), // 첫 출근
    wedding: S("wedding", { pose: "act", with: [["lover", 54, "act"]], props: [["bouquet", 66, 40]], fx: ["sparkle"] }), // 결혼식
    baby: S("hosp", { pose: "stand", with: [["lover", 58, "act"]], props: [["bundle", 48, 45]], fx: ["sparkle"] }), // 출산
    ending: S("village", { tod: "sunset", who: false, props: [["stone", 42], ["flowers", 32], ["flowers", 55]] }), // 마지막 날
  };

  // 인생 이정표(어린 시절만): [[나이 범위], 문장(또는 태어난 곳별 문장), 장면 키]  {born} → city/sea/mountain
  // 수능·첫 출근·결혼·출산은 이제 플레이어가 고르는 터닝포인트(TURNS)가 맡습니다.
  const MILESTONES = [
    [[0, 0], "응애. 세상에 나왔다", "born", 1],
    [[1, 1], "처음으로 두 발로 섰다", "step-{born}", 1],
    [[5, 5], { city: "골목길이 오락실였다", sea: "바닷가 모래밭이 오락실였다", mountain: "뒷산 개울이 오락실였다" }, "town-{born}", 1],
    [[7, 7], "초등학교 입학식. 교문 앞에서 사진을 찍었다", "enter", 1],
  ];
  const BORN = { city: "도시", sea: "바닷가", mountain: "산골" };

  // ===================== P2-21 터닝포인트 선택형 =====================
  // 작은 사건(SLOTS)이 나오려면 맞아야 하는 조건. 키 = 장면 키. 조건이 없는 사건은 누구에게나 나옴
  //   married true/false · kids(아이를 낳았거나 입양) · employed(회사원·공무원·전문직으로 일하는 중) · edu/job/notJob/notHome 목록 · retired(제2의 일을 고르지 않은 은퇴)
  //   skip: 터닝포인트와 겹쳐 더는 쓰지 않음 / stranger: 그림 속 아이가 내 아이가 아님(동네 아이)
  const NEEDS = {
    "s-apply": { skip: true },                                    // 대학 원서 → 진학 터닝포인트가 대신함
    "a-exchange": { edu: ["univ"] }, "a-mt": { edu: ["univ"] }, "a-campus": { edu: ["univ", "abroad"] },
    "w-startup": { notJob: ["startup"] },
    "w-dinner": { employed: true }, "w-offer": { employed: true }, "w-colleague": { employed: true }, "w-talent": { employed: true },
    "m-confess": { married: false },
    "m-abroad": { employed: true, married: true }, "m-news": { married: true }, "m-house": { married: true },
    "m-leader": { employed: true }, "m-burnout": { employed: true },
    "f-relay": { kids: true }, "f-promo": { employed: true }, "f-photo": { married: true, kids: true }, "f-rep": { notHome: ["country", "sea"] },
    "g-leave": { kids: true }, "g-retire": { employed: true, job: ["company", "public", "pro"] }, "g-anniv": { married: true },
    "e-grandkid": { kids: true }, "e-trip": { married: true }, "e-retire": { retired: true }, "e-guide": { stranger: true },
  };
  // 스쳐 가는 장면 중 조건이 필요한 문장
  const MOMENT_NEEDS = [[/손주|증손주/, { kids: true }], [/정장/, { notJob: ["art"] }]];

  // 직업 복장(어른 단계 옷 색). pixel.js 사람 그림의 top·top2·bot을 바꿔 그림
  const OUTFIT = {
    company: ["#2b3a6b", "#ffffff", "#2a2f3a"], public: ["#4a5560", "#e9eef2", "#30363d"], startup: ["#1e9e5a", "#141414", "#3a4a5a"],
    art: ["#e5372b", "#ffc21a", "#2a2a2a"], pro: ["#f4f4f4", "#7aa0d8", "#3a3f4a"], craft: ["#8a5a2b", "#d9b38c", "#3a2a1a"], shop: ["#ffc21a", "#e5372b", "#4a3a2a"],
  };
  const JOB_NAME = { company: "회사원", public: "공무원", startup: "창업가", art: "예술가", pro: "전문직", craft: "기술자", shop: "가게 사장" };
  const HOME_VIEW = { city: "city", sea: "sea", country: "mountain", abroad: "city" };

  // 터닝포인트 장면(새로 그림)
  Object.assign(SCENES, {
    "tp-counsel": S("class", { pose: "stand", with: [["teacher", 60, "stand"]], props: [["paper", 52, 42], ["books", 26]] }),
    "tp-univ": S("gate", { pose: "act", with: [["friend", 24, "act"], ["friend2", 62, "stand"]], fx: ["bunting"] }),
    "tp-earlywork": S("street", { pose: "walk", props: [["brief", 52, 47]] }),
    "tp-skill": S("street", { pose: "act", props: [["box", 56], ["bulb", 30, 22]] }),
    "tp-jobboard": S("street", { pose: "stand", props: [["paper", 53, 40], ["phone", 30, 41]] }),
    "tp-public": S("office", { pose: "stand", props: [["ballot", 56], ["paper", 28, 40]] }),
    "tp-art": S("home", { pose: "act", back: [["easel", 58]], props: [["note", 28, 12], ["guitar", 22]] }),
    "tp-pro": S("hosp", { pose: "stand", props: [["paper", 54, 42], ["books", 26]] }),
    "tp-craft": S("street", { pose: "act", props: [["box", 56], ["box", 24], ["key", 46, 30]] }),
    "tp-propose": S("park", { tod: "sunset", pose: "stand", with: [["lover", 56, "stand"]], props: [["heart", 50, 24]] }),
    "tp-alone": S("home", { pose: "act", props: [["cup", 52, 44], ["flowers", 26]] }),
    "tp-later": S("street", { tod: "sunset", pose: "walk", props: [["brief", 52, 47]] }),
    "tp-family": S("home", { tod: "sunset", pose: "stand", props: [["heart", 50, 22]], family: true }),
    "tp-nokids": S("park", { tod: "sunset", pose: "walk", family: true }),
    "tp-adopt": S("home", { pose: "act", with: [["kid", 30, "act"]], props: [["heart", 46, 20]], fx: ["sparkle"], family: true }),
    "tp-pet": S("park", { pose: "act", props: [["dog", 56]], family: true }),
    "tp-career": S("office", { tod: "sunset", pose: "stand", props: [["envelope", 54, 40], ["clock", 26, 24]] }),
    "tp-rest": S("beach", { tod: "sunset", pose: "stand", props: [["cup", 54, 44]] }),
    "tp-grow": S("office", { pose: "act", with: [["friend", 22, "stand"], ["friend2", 64, "stand"]], props: [["trophy", 46, 18]], fx: ["sparkle"] }),
    "tp-move": S("home", { pose: "walk", props: [["box", 56], ["box", 24], ["house", 42, 18]], family: true }),
    "tp-city": S("street", { tod: "night", pose: "walk", back: [["neon", 60, 12]], family: true }),
    "tp-sea": S("beach", { tod: "sunset", pose: "walk", family: true }),
    "tp-country": S("village", { pose: "walk", props: [["sprout", 30]], family: true }),
    "tp-abroad": S("airport", { pose: "walk", props: [["suitcase", 30]], family: true }),
    "tp-sick": S("hosp", { pose: "stand", with: [["teacher", 60, "stand"]], props: [["paper", 54, 42]] }),
    "tp-jobloss": S("office", { tod: "night", pose: "walk", props: [["box", 50, 44]] }),
    "tp-bizdown": S("office", { tod: "night", pose: "stand", props: [["coins", 54], ["zz", 30, 30]] }),
    "tp-accident": S("street", { tod: "night", pose: "stand", back: [["car", 56]] }),
    "tp-endure": S("home", { tod: "night", pose: "stand", props: [["lamp", 30, 45], ["clock", 54, 26]] }),
    "tp-help": S("home", { pose: "act", with: [["friend", 22, "stand"]], props: [["cup", 50, 44]], family: true }),
    "tp-newstart": S("street", { pose: "walk", props: [["pack", 52, 41]], fx: ["sparkle"] }),
    "tp-shop": S("street", { pose: "act", props: [["bread", 54, 42], ["coins", 26]], fx: ["sparkle"] }),
    "tp-retire": S("office", { tod: "sunset", pose: "stand", props: [["bouquet", 52, 40], ["trophy", 26]] }),
    "tp-travel": S("airport", { tod: "sunset", pose: "walk", props: [["suitcase", 30]], family: true }),
    "tp-garden": S("village", { pose: "act", props: [["sprout", 56], ["can", 28]], family: true }),
    "tp-learn": S("class", { pose: "stand", props: [["books", 54], ["heart", 30, 24]] }),
    "tp-work2": S("street", { pose: "act", props: [["bread", 54, 42], ["cup", 28, 44]] }),
    // 엔딩 장면
    "end-world": S("airport", { tod: "sunset", who: false, props: [["suitcase", 40], ["flowers", 60]] }),
    "end-sea": S("beach", { tod: "sunset", who: false, props: [["stone", 42], ["flowers", 32], ["flowers", 55]] }),
    "end-city": S("street", { tod: "sunset", who: false, props: [["stone", 42], ["flowers", 32], ["flowers", 55]] }),
    "end-park": S("park", { tod: "sunset", who: false, props: [["stone", 42], ["flowers", 32], ["dog", 60]] }),
  });

  // 터닝포인트: id, 나이, 조건(when), 질문, 질문 장면, 선택지 [이름, 바뀌는 값(set), 결과 문장, 결과 장면, 결, 선택지 조건(if)]
  // 문장·장면은 함수로 줄 수 있음(f = 지금까지 고른 값). family: true 장면에는 배우자·자녀·반려동물이 고른 대로 함께 그려짐
  const T = (label, set, text, art, kind, cond) => ({ label, set, text, art, kind, if: cond });
  const employed = (f) => ["company", "public", "pro"].includes(f.job) && !f.quit;
  const TURNS = [
    { id: "edu", age: 19, q: "고등학교 졸업을 앞두고 진로를 정한다", art: "tp-counsel", opts: [
      T("대학에 간다", { edu: "univ" }, "대학 입학식. 새 학생증을 받았다", "tp-univ", "stable"),
      T("바로 취업한다", { edu: "work" }, "열아홉 살, 남들보다 먼저 일을 시작했다", "tp-earlywork", "adventure"),
      T("기술을 배운다", { edu: "skill" }, "기술 학원에 등록해 손에 익을 때까지 연습했다", "tp-skill", "stable"),
      T("유학을 떠난다", { edu: "abroad" }, "비행기를 타고 낯선 나라로 공부하러 떠났다", "a-exchange", "adventure"),
    ] },
    { id: "job", age: 25, q: "첫 직업을 정할 때가 왔다", art: "tp-jobboard", opts: [
      T("회사원", { job: "company" }, "사원증을 목에 걸고 첫 출근을 했다", "work", "stable"),
      T("공무원", { job: "public" }, "시험에 붙어 구청으로 첫 출근을 했다", "tp-public", "stable"),
      T("창업", { job: "startup" }, "작은 사무실을 얻어 내 회사를 차렸다", "w-startup", "adventure"),
      T("예술가(그림·음악)", { job: "art" }, "그림과 노래로 먹고살아 보기로 했다", "tp-art", "fun"),
      T("전문직(긴 공부 끝 자격증)", { job: "pro" }, "자격증을 따고 전문직으로 일을 시작했다", "tp-pro", "stable", (f) => f.edu === "univ" || f.edu === "abroad"),
      T("기술자(배운 기술로)", { job: "craft" }, "작업장에서 기술자로 일을 시작했다", "tp-craft", "stable", (f) => f.edu === "skill"),
    ] },
    { id: "marry", age: 30, q: "오래 만난 사람이 결혼 이야기를 꺼냈다", art: "tp-propose", opts: [
      T("결혼한다", { married: true }, "꽃 아치 아래에서 결혼식을 올렸다", "wedding", "love"),
      T("결혼하지 않는다", { married: false, single: true }, "결혼 대신 각자의 길을 걷기로 했다. 혼자 사는 집을 꾸몄다", "tp-alone", "adventure"),
      T("나중에 생각한다", { married: false, later: true }, "지금은 일이 먼저. 결혼은 나중에 다시 생각하기로 했다", "tp-later", "stable"),
    ] },
    { id: "marry2", age: 37, when: (f) => f.later, q: "다시 결혼 이야기가 나왔다", art: "tp-propose", opts: [
      T("결혼한다", { married: true, later: false }, "조금 늦게, 그래서 더 단단하게 결혼했다", "wedding", "love"),
      T("혼자의 삶을 택한다", { married: false, later: false, single: true }, "혼자의 삶이 잘 맞는다는 걸 알았다", "tp-alone", "adventure"),
    ] },
    { id: "kids", age: 38, q: (f) => (f.married ? "둘이서 아이 이야기를 할 때가 됐다" : "가족을 꾸리는 방법을 생각해 본다"), art: "tp-family", opts: [
      T("아이를 낳는다", { kids: "bio" }, "아이가 태어났다", "baby", "love", (f) => f.married),
      T("아이를 낳지 않는다", { kids: "none" }, (f) => (f.married ? "아이 없이 둘이서 살기로 했다" : "지금의 생활을 지키기로 했다"), "tp-nokids", "stable"),
      T("입양한다", { kids: "adopt" }, "입양으로 새 가족을 맞았다", "tp-adopt", "love"),
      T("반려동물과 산다", { kids: "none", pet: true }, "강아지 한 마리가 가족이 됐다", "tp-pet", "fun"),
    ] },
    { id: "career", age: 42, q: (f) => `${f.jobName}로 일한 지 십수 년, 다음 길을 정한다`, art: "tp-career", opts: [
      T("더 맞는 곳으로 옮긴다", {}, "더 맞는 곳으로 자리를 옮겼다", "w-offer", "adventure", employed),
      T("창업한다", { job: "startup", quit: false }, "모아 둔 돈으로 내 회사를 차렸다", "w-startup", "adventure", (f) => f.job !== "startup"),
      T("회사를 키운다", { grew: true }, "직원이 열 명이 넘는 회사가 됐다", "tp-grow", "adventure", (f) => f.job === "startup"),
      T("그만두고 쉰다", { quit: true }, "일을 내려놓고 한동안 푹 쉬었다", "tp-rest", "fun"),
      T("지금 자리를 지킨다", { stay: true }, "하던 일을 계속했다. 어느새 후배들이 따르는 자리가 됐다", "f-promo", "stable"),
    ] },
    { id: "move", age: 46, q: "이제 어디에서 살까", art: "tp-move", opts: [
      T("도시", { home: "city" }, "도시 한가운데로 이사했다", "tp-city", "fun"),
      T("바닷가", { home: "sea" }, "파도 소리가 들리는 바닷가 마을로 이사했다", "tp-sea", "love"),
      T("시골", { home: "country" }, "마당 있는 시골집으로 이사했다", "tp-country", "stable"),
      T("해외", { home: "abroad" }, "짐을 싸서 다른 나라로 이사했다", "tp-abroad", "adventure"),
    ] },
    { id: "crisis", age: 53, crisis: true, opts: [
      T("버틴다", { crisisWay: "endure" }, null, "tp-endure", "stable"),
      T("도움을 청한다", { crisisWay: "help" }, null, "tp-help", "love"),
      T("새로 출발한다", { crisisWay: "new" }, null, "tp-newstart", "adventure"),
    ] },
    { id: "retire", age: 63, q: "일에서 한 걸음 물러날 나이가 됐다. 이제 무엇을 할까", art: "tp-retire", opts: [
      T("여행을 다닌다", { retire: "travel" }, "지도에 가 보고 싶던 곳을 표시하고 하나씩 떠났다", "tp-travel", "adventure"),
      T("텃밭을 가꾼다", { retire: "garden" }, "텃밭에 상추와 고추를 심었다", "tp-garden", "stable"),
      T("배우고 봉사한다", { retire: "learn" }, "평생 학습관에 등록하고 주말마다 봉사를 다녔다", "tp-learn", "love"),
      T("제2의 일을 시작한다", { retire: "work" }, "작은 가게를 열어 제2의 일을 시작했다", "tp-work2", "fun"),
    ] },
  ];
  // 위기(53세 무렵 무작위). 조건에 맞는 것만 나옴. text[way] = 고른 대응의 결과
  const CRISES = [
    { id: "sick", q: "건강검진에서 큰 병이 발견됐다", art: "tp-sick", text: { endure: "길고 힘든 치료를 끝까지 버텨 냈다", help: "가족과 친구들의 도움으로 치료를 마쳤다", new: "병을 이겨 낸 뒤 생활을 통째로 바꿨다" } },
    { id: "jobloss", q: "다니던 직장에서 갑자기 일자리를 잃었다", art: "tp-jobloss", when: employed, text: { endure: "몇 달을 버틴 끝에 새 직장을 구했다", help: "옛 동료의 소개로 다시 일을 시작했다", new: "평생 하고 싶던 가게를 열었다" }, after: { new: { job: "shop", quit: false } } },
    { id: "bizdown", q: "회사가 크게 흔들렸다", art: "tp-bizdown", when: (f) => f.job === "startup" && !f.quit, text: { endure: "허리띠를 졸라매고 회사를 지켜 냈다", help: "투자자와 직원들의 도움으로 위기를 넘겼다", new: "회사를 정리하고 작은 가게로 새로 시작했다" }, after: { new: { job: "shop" } } },
    { id: "accident", q: "큰 교통사고를 당했다", art: "tp-accident", text: { endure: "재활 운동을 하루도 빼먹지 않았다", help: "주변의 도움으로 천천히 일상을 되찾았다", new: "다시 걸을 수 있게 된 날, 하고 싶던 일을 하기로 했다" } },
  ];

  // 엔딩: 위에서부터 처음 맞는 것. key·이름·묘비명·한 줄 요약·장면
  const ENDINGS = [
    { key: "world", name: "세계를 집으로 삼은 사람", epitaph: "지도에 꽂은 핀이 별처럼 많았다", sum: "해외에서 살거나 공부하며 세상을 넓게 쓴 인생", art: "end-world", if: (f) => f.home === "abroad" || (f.edu === "abroad" && f.retire === "travel") },
    { key: "phoenix", name: "다시 일어선 사람", epitaph: "넘어진 자리에서 새로 시작했다", sum: "위기에서 새 출발을 고른 인생", art: "ending", if: (f) => f.crisisWay === "new" },
    { key: "boss", name: "작은 회사의 큰 사장", epitaph: "남의 꿈 대신 내 꿈에 출근했다", sum: "내 회사를 차리고 끝까지 꾸린 인생", art: "end-city", if: (f) => f.job === "startup" },
    { key: "artist", name: "무대 위의 평생", epitaph: "그리고 노래하다 보니 한평생이었다", sum: "그림과 음악으로 살아간 인생", art: "end-city", if: (f) => f.job === "art" },
    { key: "craft", name: "손끝의 장인", epitaph: "손이 기억하는 일을 평생 했다", sum: "배운 기술로 한 우물을 판 인생", art: "ending", if: (f) => f.job === "craft" },
    { key: "public", name: "동네의 든든한 일꾼", epitaph: "누군가의 하루를 묵묵히 지켰다", sum: "공무원으로 마을 살림을 챙긴 인생", art: "end-city", if: (f) => f.job === "public" && !f.quit },
    { key: "sea", name: "바닷가 오두막지기", epitaph: "파도 소리를 자장가 삼았다", sum: "바닷가에 자리 잡고 느긋하게 산 인생", art: "end-sea", if: (f) => f.home === "sea" },
    { key: "farm", name: "시골 텃밭 박사", epitaph: "심은 대로 거두며 살았다", sum: "시골과 텃밭에서 계절을 즐긴 인생", art: "ending", if: (f) => f.home === "country" || f.retire === "garden" },
    { key: "student", name: "평생 학생", epitaph: "배울 것이 있어서 늘 설렜다", sum: "나이 들어서도 배우고 나눈 인생", art: "end-city", if: (f) => f.retire === "learn" },
    { key: "family", name: "대가족의 중심", epitaph: "식탁이 늘 북적였다", sum: "결혼해 아이를 키우며 집을 채운 인생", art: "ending", if: (f) => f.married && (f.kids === "bio" || f.kids === "adopt") },
    { key: "couple", name: "오래된 연인", epitaph: "둘이서 오래오래 걸었다", sum: "결혼해 둘이서 서로를 지킨 인생", art: "end-park", if: (f) => f.married },
    { key: "petpal", name: "강아지와 산책하는 사람", epitaph: "산책길의 모든 이웃과 친구였다", sum: "반려동물과 함께 나이 든 인생", art: "end-park", if: (f) => f.pet },
    { key: "solo", name: "자유로운 1인 가구", epitaph: "내 방식대로, 끝까지 즐겁게", sum: "혼자의 삶을 단단하게 꾸린 인생", art: "end-city", if: () => true },
  ];
  // 작은 사건이 나오는 나이(터닝포인트 사이). 나이마다 SLOTS에서 그 나이를 포함하는 시기의 사건 중 조건에 맞는 것을 고름
  const SMALL_AGES = [5, 9, 13, 17, 22, 27, 33, 40, 44, 50, 57, 66, 72];
  const MOMENT_AGES = [2, 11, 15, 20, 28, 35, 48, 55, 61, 70, 80];

  NALGI.lifeData = { SLOTS, MOMENTS, SCENES, MILESTONES, BORN, NEEDS, MOMENT_NEEDS, OUTFIT, JOB_NAME, HOME_VIEW, TURNS, CRISES, ENDINGS, SMALL_AGES, MOMENT_AGES };
})();
