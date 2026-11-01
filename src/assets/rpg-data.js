// 펭귄 RPG 「뽀득이와 오색 연」 — 데이터(맵·적·아이템·스킬·대사·퀘스트). 외부 에셋 0, 모든 이름·대사는 자체 창작입니다.
// 세계관: 남쪽 얼음 군도 「누리빙」. 오방색(청·적·백·흑·황) 실로 짠 「오색 연」이 하늘의 색을 붙잡고 있다는 전설이 있습니다.
(function () {
  const RPG = (window.RPG = window.RPG || {});

  // ---------- 오행(五行) 상극: 공격 속성 → 약점이 되는 방어 속성 ----------
  // 금(金)은 목(木)을, 목은 토(土)를, 토는 수(水)를, 수는 화(火)를, 화는 금을 이긴다.
  const BEATS = { metal: "wood", wood: "earth", earth: "water", water: "fire", fire: "metal" };
  const EL_NAME = { wood: "목", fire: "화", earth: "토", metal: "금", water: "수" };

  // ---------- 동료 ----------
  const MEMBERS = {
    ppo: { name: "뽀득", kind: "penguin", desc: "얼음골 마을 연 날리기 대회 3년 연속 꼴찌. 낮잠 실력만큼은 군도 최강.", base: { hp: 34, mp: 10, atk: 9, def: 5, spd: 6 }, grow: { hp: 7, mp: 2, atk: 2.2, def: 1.6, spd: 1 }, skills: [[1, "peck"], [3, "slide"], [6, "breath"], [9, "cheer"], [11, "roll"]] },
    mong: { name: "몽실", kind: "seal", desc: "대숲에서 약초 가게를 하는 물범. 다정하지만 잔소리가 길다.", base: { hp: 30, mp: 16, atk: 6, def: 5, spd: 4 }, grow: { hp: 6.2, mp: 3, atk: 1.6, def: 1.6, spd: 0.9 }, skills: [[1, "pat"], [1, "bubble"], [5, "clean"], [8, "patall"], [10, "wave"], [12, "revive"]] },
    kkak: { name: "깍새", kind: "puffin", desc: "화산 온천 배달부 바다오리. 날 수 있지만 걷는 게 더 빠르다고 우긴다.", base: { hp: 28, mp: 12, atk: 10, def: 4, spd: 9 }, grow: { hp: 6, mp: 2, atk: 2.4, def: 1.3, spd: 1.4 }, skills: [[1, "ember"], [1, "combo"], [10, "dive"], [12, "leaf"]] },
  };

  // ---------- 스킬 ----------
  // tg: one(적 1) / all(적 전체) / ally(아군 1) / allies(아군 전체) / dead(쓰러진 아군) / self
  const SKILLS = {
    peck: { name: "쇠부리 콕", mp: 3, tg: "one", pow: 1.5, el: "metal", desc: "단단한 부리로 콕. 금 속성." },
    slide: { name: "배치기 슬라이드", mp: 5, tg: "all", pow: 0.85, desc: "배로 미끄러져 적 전체를 쓸어 버린다." },
    breath: { name: "얼음 숨결", mp: 7, tg: "all", pow: 1.05, el: "water", desc: "차가운 입김. 적 전체, 수 속성." },
    cheer: { name: "힘내 펭!", mp: 6, tg: "allies", buff: "atk", desc: "아군 전체 공격력 3턴 상승." },
    roll: { name: "흙먼지 구르기", mp: 8, tg: "one", pow: 2.1, el: "earth", desc: "흙투성이로 굴러 들이받는다. 토 속성." },
    rainbow: { name: "오색 일격", mp: 12, tg: "one", pow: 2.6, rainbow: true, desc: "오색 실의 힘. 무채에게 두 배 피해." },
    pat: { name: "토닥토닥", mp: 4, tg: "ally", heal: 1, desc: "아군 1명 HP 회복." },
    bubble: { name: "물방울 톡", mp: 3, tg: "one", pow: 1.35, el: "water", desc: "물방울을 톡 쏜다. 수 속성." },
    clean: { name: "말끔 수건", mp: 3, tg: "ally", cure: true, heal: 0.4, desc: "상태 이상을 닦아 내고 조금 회복." },
    patall: { name: "모두 토닥", mp: 10, tg: "allies", heal: 0.7, desc: "아군 전체 HP 회복." },
    wave: { name: "밀물", mp: 9, tg: "all", pow: 1.2, el: "water", desc: "밀물이 덮친다. 적 전체, 수 속성." },
    revive: { name: "일어나 물범", mp: 12, tg: "dead", revive: true, desc: "쓰러진 아군을 절반 HP로 일으킨다." },
    ember: { name: "불씨 부리", mp: 4, tg: "one", pow: 1.6, el: "fire", desc: "온천 불씨를 머금고 쪼기. 화 속성." },
    combo: { name: "콕콕콕", mp: 5, tg: "rand3", pow: 0.65, desc: "아무 적이나 세 번 쪼기." },
    dive: { name: "급강하", mp: 7, tg: "one", pow: 2.3, desc: "높이 날아올랐다가 내리꽂기." },
    leaf: { name: "대잎 회오리", mp: 8, tg: "all", pow: 1.15, el: "wood", desc: "대숲 바람을 부른다. 적 전체, 목 속성." },
  };

  // ---------- 아이템 ----------
  // t: use(소모품) / w(무기) / a(옷) / c(장신구) / key(중요)
  const ITEMS = {
    fish: { name: "생선 꼬치", t: "use", price: 15, heal: 45, desc: "HP 45 회복. 겉은 바삭, 속은 촉촉." },
    bigfish: { name: "큰 생선 꼬치", t: "use", price: 45, heal: 140, desc: "HP 140 회복. 두 손으로 들어야 한다." },
    tteok: { name: "매운 떡볶이", t: "use", price: 0, heal: 9999, desc: "HP 완전 회복. 혀가 얼얼하다." },
    candy: { name: "얼음 사탕", t: "use", price: 25, mp: 20, desc: "MP 20 회복. 머리가 띵-" },
    bigcandy: { name: "왕 얼음 사탕", t: "use", price: 70, mp: 60, desc: "MP 60 회복." },
    herb: { name: "해독 쑥", t: "use", price: 10, cure: true, desc: "독·먹물·화상·봉인을 씻어 낸다." },
    tea: { name: "따끈 보리차", t: "use", price: 60, revive: 0.5, desc: "쓰러진 동료를 HP 절반으로 깨운다." },
    // 무기
    ladle: { name: "나무 국자", t: "w", price: 0, atk: 2, desc: "부엌에서 들고 나왔다." },
    stick: { name: "대나무 막대", t: "w", price: 60, atk: 5 },
    tongs: { name: "불꽃 집게", t: "w", price: 220, atk: 10 },
    silverbeak: { name: "은빛 부리", t: "w", price: 0, atk: 15, spd: 2, desc: "콩떡 엄마가 준 가보. 반짝반짝." },
    icicle: { name: "고드름 창", t: "w", price: 480, atk: 16 },
    harpoon: { name: "심해 작살", t: "w", price: 900, atk: 24 },
    rainbowpole: { name: "오색 깃대", t: "w", price: 0, atk: 32, desc: "탑 꼭대기 상자에서 나온 깃대." },
    // 옷
    vest: { name: "털조끼", t: "a", price: 0, def: 2 },
    bamboo: { name: "대나무 갑옷", t: "a", price: 70, def: 5 },
    apron: { name: "내열 앞치마", t: "a", price: 240, def: 9 },
    snowcoat: { name: "눈꽃 외투", t: "a", price: 500, def: 14 },
    scale: { name: "비늘 갑옷", t: "a", price: 950, def: 20 },
    // 장신구
    shell: { name: "조개 목걸이", t: "c", price: 50, spd: 2, def: 1 },
    scarf: { name: "뜨개 목도리", t: "c", price: 0, def: 4, hp: 25, desc: "뜨개 할머니의 정성. 따뜻하다." },
    charm: { name: "매운 부적", t: "c", price: 300, atk: 5 },
    scope: { name: "등대 망원경", t: "c", price: 0, spd: 6, atk: 2, desc: "멀리 보면 먼저 움직인다." },
    pearl: { name: "검은 진주", t: "c", price: 0, mp: 20, def: 4, desc: "심해 비밀 방에서 찾았다." },
    bell: { name: "행운 방울", t: "c", price: 700, spd: 6, atk: 4 },
    feather: { name: "오색 깃털", t: "c", price: 0, atk: 6, def: 6, spd: 6, hp: 40, desc: "도감 수집 보상. 모든 능력치 상승." },
    // 중요
    yarn: { name: "털실 뭉치", t: "key", desc: "뜨개 할머니가 잃어버린 털실." },
    pepper: { name: "불꽃 고추", t: "key", desc: "분식집 사장님이 찾는 고추. 3개 필요." },
    letter: { name: "바다 편지", t: "key", desc: "등대지기에게 전할 편지." },
    th_blue: { name: "청실", t: "key", desc: "푸른 대숲의 실." },
    th_red: { name: "적실", t: "key", desc: "붉은 가마 화산의 실." },
    th_white: { name: "백실", t: "key", desc: "하얀 소금 설원의 실." },
    th_black: { name: "흑실", t: "key", desc: "검은 바다 도서관의 실." },
  };

  // ---------- 적 ----------
  // ai: [가중치, 행동] / 행동 k: atk(일반) · sk(스킬) · guard(방어)
  const ENEMIES = {
    // 청 — 푸른 대숲 (목)
    rat: { name: "대롱쥐", el: "wood", hp: 15, atk: 7, def: 3, spd: 7, exp: 7, gold: 7, ai: [[3, { k: "atk" }], [1, { k: "sk", name: "갉작갉작", pow: 1.3 }]] },
    snail: { name: "이슬 달팽이", el: "wood", hp: 20, atk: 6, def: 6, spd: 2, exp: 8, gold: 6, drop: ["fish", 0.15], ai: [[3, { k: "atk" }], [1, { k: "guard", name: "껍질 숨기" }]] },
    shoot: { name: "성난 죽순", el: "wood", hp: 18, atk: 8, def: 4, spd: 4, exp: 9, gold: 8, ai: [[2, { k: "atk" }], [1, { k: "sk", name: "죽순 찌르기", pow: 1.4 }]] },
    // 적 — 붉은 가마 화산 (화)
    newt: { name: "불씨 도롱뇽", el: "fire", hp: 34, atk: 17, def: 7, spd: 9, exp: 18, gold: 10, ai: [[2, { k: "atk" }], [1, { k: "sk", name: "불침 뱉기", pow: 1.2, st: ["burn", 0.3] }]] },
    coal: { name: "숯돌이", el: "fire", hp: 48, atk: 18, def: 13, spd: 3, exp: 20, gold: 14, drop: ["candy", 0.12], ai: [[2, { k: "atk" }], [1, { k: "sk", name: "몸통 박치기", pow: 1.5 }]] },
    chili: { name: "고추 박쥐", el: "fire", hp: 28, atk: 16, def: 6, spd: 13, exp: 17, gold: 9, ai: [[2, { k: "atk" }], [1, { k: "sk", name: "매운 가루", pow: 0.8, all: true, st: ["poison", 0.35] }]] },
    // 백 — 하얀 소금 설원 (금)
    bunny: { name: "눈덩이 토끼", el: "metal", hp: 52, atk: 24, def: 11, spd: 15, exp: 38, gold: 14, ai: [[3, { k: "atk" }], [1, { k: "sk", name: "눈덩이 굴리기", pow: 1.3 }]] },
    fox: { name: "고드름 여우", el: "metal", hp: 58, atk: 27, def: 12, spd: 14, exp: 42, gold: 16, drop: ["fish", 0.2], ai: [[2, { k: "atk" }], [1, { k: "sk", name: "고드름 던지기", pow: 1.45 }]] },
    crab: { name: "소금 게", el: "metal", hp: 70, atk: 25, def: 20, spd: 5, exp: 44, gold: 20, ai: [[2, { k: "atk" }], [1, { k: "sk", name: "왕집게", pow: 1.6 }], [1, { k: "guard", name: "소금 껍질" }]] },
    // 흑 — 검은 바다 (수)
    angler: { name: "등불 아귀", el: "water", hp: 78, atk: 32, def: 16, spd: 10, exp: 70, gold: 22, ai: [[2, { k: "atk" }], [1, { k: "sk", name: "홀리는 불빛", pow: 0.9, drain: true }]] },
    urchin: { name: "성게 굴림이", el: "water", hp: 82, atk: 30, def: 24, spd: 6, exp: 72, gold: 24, drop: ["candy", 0.2], ai: [[2, { k: "atk" }], [1, { k: "sk", name: "가시 굴리기", pow: 0.85, all: true }]] },
    squid: { name: "먹물 오징어", el: "water", hp: 70, atk: 33, def: 15, spd: 16, exp: 68, gold: 20, ai: [[2, { k: "atk" }], [1, { k: "sk", name: "먹물 찍", pow: 1.0, st: ["ink", 0.5] }]] },
    // 황 — 무채의 탑 (토)
    shade: { name: "회색 그림자", el: "earth", hp: 105, atk: 40, def: 22, spd: 15, exp: 115, gold: 30, ai: [[2, { k: "atk" }], [1, { k: "sk", name: "그림자 할퀴기", pow: 1.4 }]] },
    soldier: { name: "무채 병정", el: "earth", hp: 125, atk: 42, def: 30, spd: 9, exp: 122, gold: 34, ai: [[2, { k: "atk" }], [1, { k: "sk", name: "잿빛 창", pow: 1.5 }], [1, { k: "guard", name: "방패 세우기" }]] },
    jar: { name: "빛바랜 항아리", el: "earth", hp: 115, atk: 36, def: 34, spd: 5, exp: 118, gold: 40, drop: ["bigcandy", 0.25], ai: [[2, { k: "atk" }], [1, { k: "sk", name: "색 빨아들이기", pow: 0.9, drain: true }]] },
    // 소환수
    tentacle: { name: "촉수", el: "water", hp: 70, atk: 30, def: 14, spd: 8, exp: 10, gold: 0, summon: true, ai: [[1, { k: "atk" }]] },
    // 보스
    b_shoot: { name: "죽순 대왕", el: "wood", hp: 120, atk: 10, def: 5, spd: 5, exp: 70, gold: 90, boss: "shoot", big: true },
    b_toad: { name: "가마솥 두꺼비", el: "fire", hp: 540, atk: 21, def: 11, spd: 6, exp: 250, gold: 200, boss: "toad", big: true },
    b_owl: { name: "부엉 장군", el: "metal", hp: 840, atk: 31, def: 17, spd: 14, exp: 550, gold: 350, boss: "owl", big: true },
    b_octo: { name: "먹물 문어 사서", el: "water", hp: 1350, atk: 34, def: 21, spd: 10, exp: 1000, gold: 500, boss: "octo", big: true },
    b_mu: { name: "무채", el: "earth", hp: 1700, atk: 44, def: 26, spd: 12, exp: 0, gold: 0, boss: "mu", big: true },
    b_mu2: { name: "무채 — 잿빛 본모습", el: null, hp: 1300, atk: 47, def: 26, spd: 13, exp: 0, gold: 0, boss: "mu2", big: true },
  };
  const NORMAL_KINDS = ["rat", "snail", "shoot", "newt", "coal", "chili", "bunny", "fox", "crab", "angler", "urchin", "squid", "shade", "soldier", "jar"];

  // ---------- 맵 ----------
  // 타일: . 땅  , 땅(꽃·자갈)  : 길  # 벽  T 나무·기둥  ~ 물·용암(못 지나감)  = 다리  h 숨은 길(T처럼 보이지만 지나감)
  //       R 지붕  W 벽면  D 문  f 울타리  s 계단
  const MAPS = {};
  MAPS.village = {
    name: "얼음골 마을", theme: "village", safe: true,
    rows: [
      "TTTTTTTTTTTTT:TTTTTTTTTTTTT",
      "T..,.........:........,...T",
      "T.RRRRR......:..RRRRR.....T",
      "T.RRRRR..T...:..RRRRR...T.T",
      "T.WWDWW......:..WWDWW.....T",
      "T...:...RRRR.:....:..RRRR.T",
      "T...:...RRRR.:....:..RRRR.T",
      "T...:...WDWW.:....:..WDWW.T",
      "T...:....:...:....:....:..T",
      "T...:::::::::::::::::::::.T",
      ":::::::::::::.:::::::::::::",
      "T............:............T",
      "T.RRRR....T..:.......RRRRRT",
      "T.RRRR.......:..T....RRRRRT",
      "T.WDWW..,....:.......WWDWWT",
      "T..::::::::::::::::::::::.T",
      "T............:............T",
      "T..~~~~~~....:...ffffff...T",
      "T.,~~~~~~..T.:....,.......T",
      "T............:............T",
      "TTTTTTTTTTTTT:TTTTTTTTTTTTT",
    ],
  };
  MAPS.forest = {
    name: "푸른 대숲", theme: "forest", enc: "forest", rate: 1,
    rows: [
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
      "TTT......,..TT~~TT.......TT....T",
      "TT..RRRR.....T~~T....,....T....T",
      "T...RRRR......~~......TT..TThTTT",
      "T...WWDW..,...~~..T...TT.......T",
      "T.....:.......~~......T........T",
      "T..,..:...TT..~~...........:::::",
      "TT....:...TT..~~....T.....:...TT",
      "T.....::::....~~....TT....:....T",
      "T........:..T.~~..........:..,.T",
      "T..T.....:....~~...,......:....T",
      ":::::::::::::::==::::::::::....T",
      "T........,....~~.....:.........T",
      "T..TT.........~~.....:...T.....T",
      "T..TT....T....~~.....:.........T",
      "T.............~~..T..::::......T",
      "T.,......T....~~.........:..T..T",
      "T....TT.......~~...,.....:.....T",
      "T....TT..,....~~.......TT:.....T",
      "T.............~~.......TT......T",
      "TTT.....TTT...~~..,.........TTTT",
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
    ],
  };
  MAPS.volcano = {
    name: "붉은 가마 화산", theme: "volcano", enc: "volcano", rate: 1,
    rows: [
      "TTTTTTTTTTTTTTTT:TTTTTTTTTTTTTTT",
      "T...............:..............T",
      "T..TT....,......:....TT.....,..T",
      "T..TT...........:....TT........T",
      "T.......~~~~~~~~=~~~~~~~.......T",
      "T.......~~~~~~~~=~~~~~~~~......T",
      "T...,...........:........~~....T",
      "T.......T.......:.........~~...T",
      "T......TTT......:::::::....~~..T",
      "T.......T.............:.....~..T",
      "T~~~~.......,.........:.....~..T",
      "T~~~~~~~..............:..,..=..T",
      "T.....~~~~~~~=~~~~~~~~~~~~~~~..T",
      "T............:.................T",
      "T..TT........:.......TT........T",
      "T..TT..,.....::::::..TT....,...T",
      "T.................:............T",
      "T.....,...TT......:.......TT...T",
      "T..........TT.....:.......TT...T",
      "T..............::::............T",
      "T..#h#.........:...............T",
      "T..#.#TTTTTTTTT:TTTTTTTTTTTTTTTT",
    ],
  };
  MAPS.snow = {
    name: "하얀 소금 설원", theme: "snow", enc: "snow", rate: 1,
    rows: [
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
      "T....TT.......,......TT........T",
      "T....TT..###.........TT...,....T",
      "T........###....TT.............T",
      "TT..............TT.....~~~~....T",
      "::::::::.............~~~~~~~...T",
      "T......::::::.......~~~~~~~~...T",
      "T....,......:........~~~~~~....T",
      "T...TT......:..TT.....~~~~.....T",
      "T...TT......:..TT..............T",
      "T...........:..........,.......T",
      "T...........:::::::::::::::::::.",
      "T.....###.........:............T",
      "T.....###.........:....TT......T",
      "T.................:....TT...,..T",
      "T##h####...,......:............T",
      "T#....##..........:.....###....T",
      "T#....##....TT....:.....###....T",
      "T#....##....TT.....:...........T",
      "T######...........::::.........T",
      "T..........,...................T",
      "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
    ],
  };
  MAPS.sea = {
    name: "검은 바다 해안", theme: "sea", enc: "sea", rate: 1,
    rows: [
      "TTTTTT:TTTTTTTTTTTTTTTTTTTTTTTTT",
      "T~~~~~:~~~~~~~~~~~~~~~~~~~~~~~~T",
      "T~~~~~=~~~~~~~~~~~~~~~~~~RRRR~~T",
      "T~~~~~=~~~~~~~~~~~~~~~~~~RRRR~~T",
      "T.....:.......~~~~~~~~~..WDWW..T",
      "T.....:.........~~~~~~.....:...T",
      "T..TT.:...,.......~~.......:...T",
      "T..TT.::::::::.............:...T",
      "T............:.....###.....:...T",
      "T...,........:.....###...,.:...T",
      "T.....TT.....::::::::::::::::..T",
      "T.....TT.............:.........T",
      "T.........#####......:....TT...T",
      "T.........#...#......:....TT...T",
      "T.........#...#......:.........T",
      "T...,.....##h##......:.....,...T",
      "T..TT................:.........T",
      "T..TT.......,.....:::::........T",
      "T.................:............T",
      "T....TT.........:::.....TT.....T",
      "T....TT.........:.......TT.....T",
      "TTTTTTTTTTTTTTTT:TTTTTTTTTTTTTTT",
    ],
  };
  MAPS.tower1 = {
    name: "무채의 탑 1층", theme: "tower", enc: "tower", rate: 1.2,
    rows: [
      "#####################",
      "#.........s.........#",
      "#.###.###...###.###.#",
      "#.#.......#.......#.#",
      "#.#.#####...#####.#.#",
      "#...#...........#...#",
      "###.#.###...###.#.###",
      "#.....#.......#.....#",
      "#.###.#.#####.#.###.#",
      "#...#...#...#...#...#",
      "#.#.###.#...#.###.#.#",
      "#.#.....#...#.....#.#",
      "#.#######...#######.#",
      "#.........:.........#",
      "##########:##########",
    ],
  };
  MAPS.tower2 = {
    name: "무채의 탑 꼭대기", theme: "tower", safe: true,
    rows: [
      "###############",
      "#.............#",
      "#.#.........#.#",
      "#.............#",
      "#.............#",
      "#.#.........#.#",
      "#.............#",
      "#.............#",
      "#.#.........#.#",
      "#......:......#",
      "#######:#######",
    ],
  };
  // 던전은 고정 시드로 생성(매번 같은 미로). 입구는 왼쪽, 보스 방은 오른쪽.
  const DUNGEONS = {
    maze: { name: "대나무 미로", theme: "maze", enc: "maze", seed: 11, braid: 0.35, back: ["forest", 30, 6, "left"] },
    kiln: { name: "가마 동굴", theme: "kiln", enc: "kiln", seed: 23, braid: 0.4, pools: 6, back: ["volcano", 16, 20, "up"] },
    fort: { name: "눈보라 성채", theme: "fort", enc: "fort", seed: 37, braid: 0.3, back: ["snow", 1, 5, "right"] },
    lib: { name: "심해 도서관", theme: "lib", enc: "lib", seed: 41, braid: 0.45, pools: 4, back: ["sea", 6, 1, "down"] },
  };
  function genDungeon(spec) {
    const W = 27, H = 21;
    let s = spec.seed * 9973 + 7;
    const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    const g = Array.from({ length: H }, () => Array(W).fill("#"));
    const ey = 9;
    const cells = [];
    const seen = new Set();
    const stack = [[1, ey]];
    seen.add(1 + "," + ey);
    for (let y = 7; y <= 13; y++) for (let x = 19; x <= 25; x++) seen.add(x + "," + y); // 보스 방 자리는 미로에서 제외
    g[ey][1] = ".";
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const nb = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(([dx, dy]) => [x + dx, y + dy, dx, dy]).filter(([nx, ny]) => nx > 0 && ny > 0 && nx < W - 1 && ny < H - 1 && !seen.has(nx + "," + ny));
      if (!nb.length) { stack.pop(); continue; }
      const [nx, ny, dx, dy] = nb[Math.floor(rnd() * nb.length)];
      g[y + dy / 2][x + dx / 2] = ".";
      g[ny][nx] = ".";
      seen.add(nx + "," + ny);
      cells.push([nx, ny]);
      stack.push([nx, ny]);
    }
    // 막다른 길 일부를 뚫어 고리 만들기
    const deadEnds = () => {
      const out = [];
      for (let y = 1; y < H - 1; y += 2) for (let x = 1; x < W - 1; x += 2) {
        if (g[y][x] !== ".") continue;
        const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => g[y + dy][x + dx] === ".").length;
        if (open === 1) out.push([x, y]);
      }
      return out;
    };
    for (const [x, y] of deadEnds()) {
      if (rnd() > spec.braid) continue;
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => g[y + dy][x + dx] === "#" && x + dx * 2 > 0 && x + dx * 2 < W - 1 && y + dy * 2 > 0 && y + dy * 2 < H - 1);
      if (opts.length) { const [dx, dy] = opts[Math.floor(rnd() * opts.length)]; g[y + dy][x + dx] = "."; }
    }
    // 입구 앞 쉼터(3x3)와 보스 방(7x7)
    for (let y = ey - 1; y <= ey + 1; y++) for (let x = 1; x <= 3; x++) g[y][x] = ".";
    g[ey][0] = ":";
    for (let y = 7; y <= 13; y++) for (let x = 19; x <= 25; x++) g[y][x] = y === 7 || y === 13 || x === 25 ? "#" : ".";
    for (let y = 8; y <= 12; y++) g[y][19] = y === 10 ? "." : "#";
    g[10][18] = "."; g[10][17] = ".";
    // 용암·물 웅덩이(장식 장애물): 통로를 막지 않도록 벽에 둘러싸인 칸에만
    let pools = spec.pools || 0, tries = 0;
    while (pools > 0 && tries++ < 400) {
      const x = 1 + Math.floor(rnd() * 17), y = 1 + Math.floor(rnd() * (H - 2));
      if (g[y][x] !== "#") continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => g[y + dy] && g[y + dy][x + dx] === ".").length;
      if (n >= 1 && n <= 2) { g[y][x] = "~"; pools--; }
    }
    // 보물 위치: 입구에서 먼 막다른 길
    const dist = bfs(g, 0, ey);
    const ends = deadEnds().filter(([x, y]) => x < 18 && dist[y][x] < Infinity).sort((a, b) => dist[b[1]][b[0]] - dist[a[1]][a[0]]);
    // 장식 땅
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (g[y][x] === "." && rnd() < 0.08) g[y][x] = ",";
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === "#" && rnd() < 0.25) g[y][x] = "T";
    return { rows: g.map((r) => r.join("")), entry: [0, ey], chests: ends.slice(0, 3), boss: [22, 10], fire: [2, ey - 1] };
  }
  function bfs(g, sx, sy, pass = (c) => ".,:=hs".includes(c)) {
    const H = g.length, W = g[0].length;
    const d = Array.from({ length: H }, () => Array(W).fill(Infinity));
    d[sy][sx] = 0;
    const q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || d[ny][nx] !== Infinity) continue;
        if (!pass(g[ny][nx])) continue;
        d[ny][nx] = d[y][x] + 1;
        q.push([nx, ny]);
      }
    }
    return d;
  }
  for (const [id, spec] of Object.entries(DUNGEONS)) {
    const d = genDungeon(spec);
    MAPS[id] = { name: spec.name, theme: spec.theme, enc: spec.enc, rate: 1, rows: d.rows, gen: d };
  }

  // ---------- 인카운터 ----------
  const ENC = {
    forest: [[3, ["rat"]], [3, ["snail"]], [2, ["rat", "rat"]], [2, ["shoot"]], [1, ["rat", "snail"]]],
    maze: [[2, ["shoot", "rat"]], [2, ["snail", "rat"]], [2, ["shoot"]], [1, ["rat", "rat", "rat"]], [1, ["shoot", "snail"]]],
    volcano: [[3, ["newt"]], [2, ["chili", "chili"]], [2, ["coal"]], [2, ["newt", "chili"]]],
    kiln: [[2, ["coal", "newt"]], [2, ["chili", "chili", "newt"]], [2, ["coal"]], [1, ["newt", "newt"]]],
    snow: [[3, ["bunny"]], [2, ["fox"]], [2, ["bunny", "bunny"]], [2, ["crab"]]],
    fort: [[2, ["fox", "bunny"]], [2, ["crab", "fox"]], [1, ["bunny", "bunny", "bunny"]], [2, ["fox"]]],
    sea: [[3, ["angler"]], [2, ["squid", "squid"]], [2, ["urchin"]], [2, ["angler", "squid"]]],
    lib: [[2, ["urchin", "squid"]], [2, ["angler", "angler"]], [2, ["squid", "squid", "angler"]], [1, ["urchin"]]],
    tower: [[2, ["shade", "shade"]], [2, ["soldier"]], [2, ["jar", "shade"]], [1, ["soldier", "jar"]]],
  };

  // ---------- 상점 ----------
  const SHOPS = {
    village: (f) => ["fish", "candy", "herb", "tea", "stick", "bamboo", "shell"].concat(f.boss1 ? ["bigfish", "tongs", "apron"] : [], f.boss2 ? ["charm", "icicle", "snowcoat", "bigcandy"] : [], f.boss3 ? ["harpoon", "scale", "bell"] : []),
    camp: (f) => ["fish", "candy", "herb", "tea"].concat(f.boss1 ? ["bigfish"] : [], f.boss2 ? ["bigcandy"] : []),
  };

  // ---------- 퀘스트 ----------
  const QUESTS = [
    { id: "main", name: "오색 연을 되찾아라", main: true, step: (f) => (f.cleared ? "완료! 축제의 하늘에 연이 떴다." : f.tower ? "무채의 탑 꼭대기로 올라가 무채를 만나자." : f.boss4 ? "마을 한가운데 연 언덕으로 돌아가자." : f.boss3 ? "북쪽 「검은 바다 해안」의 심해 도서관에서 흑실을 찾자." : f.boss2 ? "서쪽 「하얀 소금 설원」의 눈보라 성채에서 백실을 찾자." : f.boss1 ? "남쪽 「붉은 가마 화산」의 가마 동굴에서 적실을 찾자." : f.intro ? "동쪽 「푸른 대숲」의 대나무 미로에서 청실을 찾자." : "촌장님 이야기를 듣자.") },
    { id: "q1", name: "할머니의 털실", step: (f, g) => (f.q1done ? "완료 — 뜨개 목도리를 받았다." : g.has("yarn") ? "털실을 찾았다! 뜨개 할머니께 가져가자." : "푸른 대숲 어딘가에 털실 뭉치가 있다. 대나무 사이 수상한 틈을 살펴보자.") , on: "q1" },
    { id: "q2", name: "매운맛 삼총사", step: (f, g) => (f.q2done ? "완료 — 매운 떡볶이를 받았다." : `붉은 가마 화산에서 불꽃 고추를 모으자. (${g.count("pepper")}/3)`), on: "q2" },
    { id: "q3", name: "길 잃은 콩떡", step: (f) => (f.q3done ? "완료 — 은빛 부리를 받았다." : f.chick ? "콩떡을 데리고 마을 연못가 엄마에게 가자." : "하얀 소금 설원에서 아기 펭귄 콩떡을 찾자. 얼음벽 사이 틈이 수상하다."), on: "q3" },
    { id: "q4", name: "바다 편지", step: (f) => (f.q4done ? "완료 — 등대 망원경을 받았다." : "검은 바다 해안의 등대지기에게 편지를 전하자."), on: "q4" },
    { id: "q5", name: "몬스터 수첩", step: (f, g) => (f.q5done ? "완료 — 오색 깃털을 받았다." : `서로 다른 몬스터 12종을 물리치고 학자에게 보여 주자. (${g.kinds()}/12)`), on: "q5" },
  ];

  // ---------- 이벤트(맵별 좌표) ----------
  // type: npc(말 걸기) / door / chest / sign / fire(회복·저장) / warp(밟으면 이동) / boss / obj
  // if·unless: 플래그 조건. sp: 스프라이트 키.
  const EV = {
    village: [
      { x: 13, y: 0, type: "warp", to: ["sea", 16, 20, "up"] },
      { x: 26, y: 10, type: "warp", to: ["forest", 1, 11, "right"] },
      { x: 13, y: 20, type: "warp", to: ["volcano", 16, 1, "down"] },
      { x: 0, y: 10, type: "warp", to: ["snow", 30, 11, "left"] },
      { x: 25, y: 10, type: "npc", sp: "guard", unless: "intro", run: "gateE" },
      { x: 13, y: 19, type: "npc", sp: "rock", unless: "boss1", run: "gateS" },
      { x: 1, y: 10, type: "npc", sp: "rock", unless: "boss2", run: "gateW" },
      { x: 13, y: 1, type: "npc", sp: "rock", unless: "boss3", run: "gateN" },
      { x: 4, y: 4, type: "door", run: "chief" },
      { x: 18, y: 4, type: "door", run: "inn" },
      { x: 9, y: 7, type: "door", run: "shop" },
      { x: 22, y: 7, type: "door", run: "snack" },
      { x: 3, y: 14, type: "door", run: "granny" },
      { x: 23, y: 14, type: "door", run: "post" },
      { x: 13, y: 10, type: "obj", sp: "kite", run: "kite" },
      { x: 16, y: 11, type: "npc", sp: "scholar", run: "scholar", name: "학자 펭" },
      { x: 9, y: 16, type: "npc", sp: "mom", run: "mom", name: "콩떡 엄마" },
      { x: 20, y: 8, type: "npc", sp: "kid", run: "kid1", name: "꼬마 펭" },
      { x: 7, y: 11, type: "npc", sp: "kid2", run: "kid2", name: "꼬마 뒤뚱" },
      { x: 10, y: 16, type: "npc", sp: "chick", if: "q3done", run: "chick2", name: "콩떡" },
      { x: 19, y: 18, type: "npc", sp: "elder", run: "fisher", name: "얼음낚시 할배" },
      { x: 12, y: 8, type: "sign", text: ["↑ 검은 바다 해안   → 푸른 대숲", "↓ 붉은 가마 화산   ← 하얀 소금 설원", "가운데: 연 날리기 언덕"] },
    ],
    forest: [
      { x: 0, y: 11, type: "warp", to: ["village", 25, 10, "left"] },
      { x: 31, y: 6, type: "warp", to: ["maze", 1, 9, "right"] },
      { x: 2, y: 10, type: "sign", text: ["← 얼음골 마을", "→ 대나무 미로 (죽순 조심)"] },
      { x: 6, y: 4, type: "door", run: "mongHut" },
      { x: 8, y: 5, type: "npc", sp: "mong", unless: "boss1", run: "mong", name: "몽실" },
      { x: 20, y: 3, type: "chest", id: "f1", item: ["fish", 3] },
      { x: 3, y: 18, type: "chest", id: "f2", gold: 60 },
      { x: 29, y: 1, type: "chest", id: "f3", item: ["yarn", 1] },
      { x: 23, y: 13, type: "fire" },
      { x: 24, y: 14, type: "npc", sp: "merchant", run: "merchant", name: "보따리 펭" },
      { x: 18, y: 18, type: "npc", sp: "rabbitnpc", run: "forestNpc", name: "대숲 다람이" },
    ],
    volcano: [
      { x: 16, y: 0, type: "warp", to: ["village", 13, 19, "up"] },
      { x: 15, y: 21, type: "warp", to: ["kiln", 1, 9, "right"] },
      { x: 5, y: 2, type: "chest", id: "p1", sp: "pepper", item: ["pepper", 1] },
      { x: 29, y: 9, type: "chest", id: "p2", sp: "pepper", item: ["pepper", 1] },
      { x: 4, y: 21, type: "chest", id: "p3", sp: "pepper", item: ["pepper", 1] },
      { x: 2, y: 2, type: "chest", id: "v1", item: ["bigfish", 1] },
      { x: 29, y: 17, type: "chest", id: "v2", gold: 150 },
      { x: 13, y: 17, type: "fire" },
      { x: 12, y: 17, type: "npc", sp: "merchant", run: "merchant", name: "보따리 펭" },
      { x: 24, y: 13, type: "npc", sp: "kkak", unless: "boss2", run: "kkak", name: "깍새" },
      { x: 17, y: 2, type: "sign", text: ["여기서부터 붉은 가마 화산.", "용암에 발 담그지 마시오. (진짜로)"] },
    ],
    snow: [
      { x: 31, y: 11, type: "warp", to: ["village", 1, 10, "right"] },
      { x: 0, y: 5, type: "warp", to: ["fort", 1, 9, "right"] },
      { x: 4, y: 17, type: "npc", sp: "chick", unless: "chick", run: "chick", name: "콩떡" },
      { x: 5, y: 4, type: "fire" },
      { x: 6, y: 3, type: "npc", sp: "merchant", run: "merchant", name: "보따리 펭" },
      { x: 26, y: 2, type: "chest", id: "s1", item: ["bigcandy", 1] },
      { x: 28, y: 16, type: "chest", id: "s2", gold: 300 },
      { x: 10, y: 17, type: "chest", id: "s3", item: ["tea", 2] },
      { x: 28, y: 10, type: "npc", sp: "snowman", run: "snowman", name: "눈사람" },
    ],
    sea: [
      { x: 16, y: 21, type: "warp", to: ["village", 13, 1, "down"] },
      { x: 6, y: 0, type: "warp", to: ["lib", 1, 9, "right"] },
      { x: 26, y: 4, type: "door", run: "keeper" },
      { x: 8, y: 5, type: "fire" },
      { x: 9, y: 4, type: "npc", sp: "merchant", run: "merchant", name: "보따리 펭" },
      { x: 12, y: 13, type: "chest", id: "e1", item: ["pearl", 1] },
      { x: 29, y: 18, type: "chest", id: "e2", gold: 500 },
      { x: 2, y: 9, type: "chest", id: "e3", item: ["bigfish", 2] },
      { x: 20, y: 16, type: "npc", sp: "elder", run: "seaNpc", name: "조개 줍는 할멈" },
    ],
    tower1: [
      { x: 10, y: 14, type: "warp", to: ["village", 13, 11, "down"] },
      { x: 10, y: 1, type: "warp", to: ["tower2", 7, 9, "up"] },
      { x: 1, y: 13, type: "fire" },
      { x: 1, y: 1, type: "chest", id: "t1", item: ["rainbowpole", 1] },
      { x: 19, y: 1, type: "chest", id: "t2", item: ["tteok", 1] },
      { x: 3, y: 9, type: "chest", id: "t3", item: ["bigcandy", 2] },
    ],
    tower2: [
      { x: 7, y: 10, type: "warp", to: ["tower1", 10, 2, "down"] },
      { x: 7, y: 2, type: "boss", sp: "b_mu", unless: "cleared", run: "bossMu" },
    ],
  };
  // 던전 이벤트(생성 결과 좌표 사용)
  const DBOSS = { maze: ["b_shoot", "boss1", "bossShoot"], kiln: ["b_toad", "boss2", "bossToad"], fort: ["b_owl", "boss3", "bossOwl"], lib: ["b_octo", "boss4", "bossOcto"] };
  const DCHEST = { maze: [["bamboo", 1], ["candy", 2], ["gold", 80]], kiln: [["apron", 1], ["bigfish", 1], ["gold", 200]], fort: [["snowcoat", 1], ["bigcandy", 1], ["gold", 350]], lib: [["harpoon", 1], ["tteok", 1], ["gold", 500]] };
  for (const id of Object.keys(DUNGEONS)) {
    const d = MAPS[id].gen, spec = DUNGEONS[id];
    const list = [
      { x: 0, y: d.entry[1], type: "warp", to: spec.back },
      { x: d.fire[0], y: d.fire[1], type: "fire" },
      { x: d.boss[0], y: d.boss[1], type: "boss", sp: DBOSS[id][0], unless: DBOSS[id][1], run: DBOSS[id][2] },
    ];
    d.chests.forEach(([x, y], i) => {
      const c = DCHEST[id][i];
      if (!c) return;
      list.push(c[0] === "gold" ? { x, y, type: "chest", id: id + i, gold: c[1] } : { x, y, type: "chest", id: id + i, item: c });
    });
    EV[id] = list;
  }

  // ---------- 대사·스크립트 ----------
  // g: 엔진 API (say, ask, flag, set, has, give, take, gold, battle, join, shop, heal, warp, fade, toast, quest)
  const S = {};
  S.intro = async (g) => {
    await g.say(null, ["남쪽 얼음 군도 「누리빙」.", "해마다 오늘은 「오색 연 날리기 축제」가 열리는 날이다.", "…그런데 하늘에 연이 없다. 세상이 조금씩 잿빛으로 바래고 있다."]);
    await g.say("왕눈 촌장", ["뽀득아! 일어났느냐! 낮잠 자다 축제를 통째로 놓친 펭귄은 너밖에 없을 게다.", "간밤에 「무채」라는 잿빛 녀석이 나타나 오색 연을 찢어 갔단다.", "연을 짠 다섯 실 가운데 네 가닥이 사방으로 흩어졌지. 실이 없으니 하늘이 색을 잃는 게야.", "다들 색이 빠져 기운이 없는데, 이불 속에서 자던 너만 멀쩡하구나.", "동쪽 푸른 대숲부터 가 보거라. 청실이 그쪽으로 날아갔단다."]);
    await g.say("뽀득", ["(연 날리기 꼴찌한테 연을 맡기다니… 마을이 정말 급하긴 급하구나.)"]);
    await g.say(null, ["조작: 방향키·WASD로 이동, Enter·Space(A)로 말 걸기, Esc(B)로 메뉴.", "휴대폰은 화면 아래 방향 패드와 A·B 버튼을 쓰세요. 진행은 자동 저장됩니다."]);
    g.set("intro");
    g.give("fish", 3);
    g.toast("생선 꼬치 3개를 받았다");
  };
  S.chief = async (g, f) => {
    const hint = { 0: "동쪽 푸른 대숲으로 가거라. 대나무 미로 끝에 무언가 커다란 게 산단다.", 1: "청실을 찾았구나! 다음은 남쪽 붉은 가마 화산이다. 뜨거우니 내열 앞치마를 챙기거라.", 2: "적실까지! 서쪽 하얀 소금 설원은 눈보라가 매섭다. 불 속성 공격이 잘 들 게다.", 3: "백실이로구나. 북쪽 검은 바다 해안 너머 심해 도서관… 그곳은 조용히 해야 한단다.", 4: "네 가닥이 모였구나! 마을 한가운데 연 언덕으로 가 보거라." };
    const n = ["boss1", "boss2", "boss3", "boss4"].filter((k) => f[k]).length;
    if (f.cleared) return g.say("왕눈 촌장", ["하늘 좀 보거라. 여섯 빛깔이구나. 내년 축제엔 네가 연을 날려 보거라.", "…꼴찌만 면하면 된단다."]);
    await g.say("왕눈 촌장", [hint[n], "길이 막히면 상점에서 장비를 바꾸고, 찜질방에서 푹 쉬거라. 둘 다 마을에 있단다."]);
  };
  S.inn = async (g) => {
    await g.say("찜질방 주인", ["어서 와요, 얼음골 찜질방이에요. 펭귄은 공짜, 땀은 셀프!"]);
    await g.heal();
    await g.say(null, ["뜨끈한 바닥에 누웠더니 온몸이 사르르 풀렸다. (HP·MP 회복, 저장 완료)"]);
  };
  S.shop = async (g) => { await g.say("상점 펭", ["골라 봐요. 실이 하나 돌아올 때마다 물건이 늘어나요."]); await g.shop("village"); };
  S.merchant = async (g) => { await g.say("보따리 펭", ["어디든 가는 보따리 펭이올시다. 비싸다고? 배송비요, 배송비."]); await g.shop("camp"); };
  S.gateE = async (g) => g.say("경비 펭", ["촌장님 얘기는 듣고 가야지. 바로 위 집이야."]);
  S.gateS = async (g) => g.say(null, ["굳은 용암 덩어리가 길을 막고 있다. 청실의 기운이 있으면 녹을 것 같다."]);
  S.gateW = async (g) => g.say(null, ["두꺼운 소금 얼음이 길을 막고 있다. 적실의 열기가 있으면 녹을 것 같다."]);
  S.gateN = async (g) => g.say(null, ["새카만 파도 바위가 길을 막고 있다. 백실이 있으면 비켜 줄 것 같다."]);
  S.kid1 = async (g, f) => g.say("꼬마 펭", [f.boss2 ? "깍새 형 날 수 있대! 근데 왜 맨날 걸어?" : f.boss1 ? "몽실 언니 잔소리 길지? 그래도 약은 진짜 잘 들어." : "형, 몬스터랑 싸울 때 「방어」 쓰면 큰 공격도 버틸 수 있대!"]);
  S.kid2 = async (g, f) => g.say("꼬마 뒤뚱", [f.boss3 ? "적한테 맞는 속성이 있대. 금은 나무, 나무는 흙, 흙은 물, 물은 불, 불은 쇠를 이긴대!" : "몬스터마다 속성이 있대. 대숲 애들은 나무라서 쇠부리 콕이 아프대."]);
  S.fisher = async (g, f) => g.say("얼음낚시 할배", [f.cleared ? "물고기도 색을 되찾았구먼. 빨강 붕어, 파랑 붕어…" : "요새 잡히는 물고기가 죄다 회색이여. 맛도 회색 맛이 나."]);
  S.scholar = async (g, f) => {
    if (f.q5done) return g.say("학자 펭", ["도감 덕분에 논문을 썼다네. 제목은 「몬스터는 왜 우리를 때리는가」."]);
    if (!f.q5) { await g.say("학자 펭", ["자네, 모험을 떠난다고? 서로 다른 몬스터 12종을 물리치면 기록해 주겠네.", "다 모으면 귀한 깃털을 주지."]); g.set("q5"); g.toast("서브 퀘스트 「몬스터 수첩」 시작"); return; }
    if (g.kinds() >= 12) { await g.say("학자 펭", ["열두 종! 훌륭해! 약속한 오색 깃털일세."]); g.give("feather", 1); g.set("q5done"); g.toast("오색 깃털을 받았다"); return; }
    await g.say("학자 펭", [`지금까지 ${g.kinds()}종일세. 열두 종까지 힘내게.`]);
  };
  S.granny = async (g, f) => {
    if (f.q1done) return g.say("뜨개 할머니", ["목도리 잘 두르고 다니니? 펭귄도 목은 따뜻해야 해."]);
    if (g.has("yarn")) { await g.say("뜨개 할머니", ["어머, 내 털실! 대숲에 놀러 갔다가 바람에 날아갔지 뭐니.", "잠깐만… (뜨개뜨개) 자, 목도리 하나 떠 주마."]); g.take("yarn", 1); g.give("scarf", 1); g.set("q1done"); g.toast("뜨개 목도리를 받았다"); return; }
    await g.say("뜨개 할머니", ["털실 뭉치가 바람에 날려 푸른 대숲으로 갔단다. 대나무 사이 수상한 틈에 걸렸을 게야.", "찾아 주면 목도리를 떠 주마."]);
    if (!f.q1) { g.set("q1"); g.toast("서브 퀘스트 「할머니의 털실」 시작"); }
  };
  S.snack = async (g, f) => {
    if (!f.boss1) return g.say("떡볶 사장", ["오늘은 영업 안 해요. 색이 빠져서 떡볶이가 하얘졌거든요. 그건 그냥 떡이에요."]);
    if (f.q2done) return g.say("떡볶 사장", ["매운맛이 돌아왔어요! 손님들이 울면서 먹어요. 기쁨의 눈물이래요."]);
    if (g.count("pepper") >= 3) { await g.say("떡볶 사장", ["불꽃 고추 세 개! 이거면 군도 최강 떡볶이를 만들 수 있어요.", "첫 판은 손님 거예요. 포장해 가세요!"]); g.take("pepper", 3); g.give("tteok", 3); g.gold(150); g.set("q2done"); g.toast("매운 떡볶이 3개와 150골드를 받았다"); return; }
    await g.say("떡볶 사장", ["남쪽 화산에 「불꽃 고추」가 자라요. 세 개만 따다 주면 특별 메뉴를 드릴게요.", `지금 ${g.count("pepper")}개 있네요.`]);
    if (!f.q2) { g.set("q2"); g.toast("서브 퀘스트 「매운맛 삼총사」 시작"); }
  };
  S.mom = async (g, f) => {
    if (f.q3done) return g.say("콩떡 엄마", ["콩떡이가 이제 연못 근처에서만 놀아요. 정말 고마워요."]);
    if (f.chick) { await g.say("콩떡 엄마", ["콩떡아!! 어디 갔었어!", "정말 고마워요. 우리 집 가보인데… 이 부리 장식, 모험에 쓰세요."]); g.give("silverbeak", 1); g.set("q3done"); g.toast("은빛 부리를 받았다"); return; }
    if (!f.boss2) return g.say("콩떡 엄마", ["우리 콩떡이 못 봤어요? 눈 구경 간다더니… 서쪽 길은 아직 막혀 있는데."]);
    await g.say("콩떡 엄마", ["우리 콩떡이가 서쪽 설원에 갔다가 안 돌아와요. 얼음벽 사이로 잘 숨는 애예요.", "찾아 주시면 꼭 사례할게요."]);
    if (!f.q3) { g.set("q3"); g.toast("서브 퀘스트 「길 잃은 콩떡」 시작"); }
  };
  S.chick = async (g, f) => {
    await g.say("콩떡", ["삐약! 숨바꼭질하다가 아무도 안 찾아서 여기서 잤어.", "형 펭귄이 찾았으니까 형이 술래 이긴 거야. 집에 데려다줘!"]);
    g.set("chick"); if (!f.q3) g.set("q3");
    g.toast("콩떡이 따라온다. 마을 엄마에게 데려가자");
  };
  S.chick2 = async (g) => g.say("콩떡", ["다음엔 형이 숨어! 백까지 셀게. 하나, 둘, 셋… 백!"]);
  S.post = async (g, f) => {
    if (!f.boss3) return g.say("우체부 펭", ["북쪽 바다 쪽 길이 막혀서 편지가 쌓였어요. 길 열리면 부탁할게요."]);
    if (f.q4done) return g.say("우체부 펭", ["등대지기 할아버지가 답장을 보냈어요. 글씨가 너무 커서 봉투가 세 장이에요."]);
    if (f.q4) return g.say("우체부 펭", ["검은 바다 해안 오른쪽 위 등대예요. 부탁해요!"]);
    await g.say("우체부 펭", ["마침 잘 왔어요! 이 편지를 북쪽 검은 바다 해안 등대지기에게 전해 주세요.", "손녀가 보낸 편지인데, 몇 달째 못 전했대요."]);
    g.give("letter", 1); g.set("q4"); g.toast("서브 퀘스트 「바다 편지」 시작");
  };
  S.keeper = async (g, f) => {
    if (g.has("letter")) { await g.say("등대지기", ["손녀 편지라고? 어디 보자… 「할아버지 등대 불 끄고 일찍 주무세요」. 허허, 이 녀석.", "고맙네. 내가 젊을 때 쓰던 망원경일세. 멀리 보는 놈이 먼저 움직이는 법이지."]); g.take("letter", 1); g.give("scope", 1); g.set("q4done"); g.toast("등대 망원경을 받았다"); return; }
    await g.say("등대지기", [f.boss4 ? "도서관 문어가 얌전해졌다더군. 이제 밤바다가 조금 덜 시끄럽겠어." : "북쪽 바다 밑 도서관 사서는 「조용히」에 목숨을 거는 문어라네. 소리 지르면 혼난다네."]);
  };
  S.mongHut = async (g, f) => g.say(null, [f.boss1 ? "「몽실 약초방 — 사장 모험 중, 당분간 휴업」" : "「몽실 약초방 — 죽순 때문에 문 닫음. 죽순 미워」"]);
  S.mong = async (g, f) => {
    if (f.metMong) return g.say("몽실", ["대나무 미로는 동쪽 끝이야. 쇠부리로 콕콕 쪼면 죽순들이 아파해. 금이 나무를 이기거든."]);
    await g.say("몽실", ["어머, 색이 멀쩡한 펭귄이네? 난 몽실, 여기서 약초방을 해.", "어젯밤 하늘에서 파란 실이 떨어졌는데, 죽순 하나가 그걸 꿀꺽 삼키더니 집채만 해졌어.", "그 「죽순 대왕」이 미로에 눌러앉아서 내 약초밭을 다 덮었지 뭐야.", "실을 찾으러 왔다고? 그럼 걔부터 혼내 줘. 이기면 나도 같이 갈게."]);
    g.set("metMong");
  };
  S.forestNpc = async (g) => g.say("대숲 다람이", ["대나무 숲 오른쪽 위에 대나무가 이상하게 듬성한 데가 있어. 난 무서워서 안 들어가 봤지만."]);
  S.kkak = async (g, f) => {
    if (f.metKkak) return g.say("깍새", ["가마 동굴은 남쪽 아래로 쭉. 두꺼비가 불을 모으면 물 공격으로 식혀. 그게 요령이야."]);
    await g.say("깍새", ["너도 배달 왔어? 아니라고? 난 화산 온천 배달부 깍새.", "가마솥 두꺼비 녀석이 빨간 실을 매운 국수인 줄 알고 삼켰어. 그 뒤로 온천물이 펄펄 끓어서 배달을 못 해.", "날아서 가면 되지 않냐고? …걷는 게 더 빨라. 진짜야.", "두꺼비 혼내 주면 나도 따라갈게. 마침 일도 없고."]);
    g.set("metKkak");
  };
  S.snowman = async (g, f) => g.say("눈사람", [f.boss3 ? "…(부엉 장군이 제정신을 차렸다고 눈사람이 끄덕이는 것 같다)" : "…(눈사람 머리에 쪽지가 붙어 있다) 「서쪽 성채의 부엉 장군, 요즘 눈빛이 잿빛임. 불 조심 아니고 불 추천」"]);
  S.seaNpc = async (g, f) => g.say("조개 줍는 할멈", [f.boss4 ? "바닷물이 다시 까맣게 반짝여. 까만 것도 색이란다." : "바위 무더기 아래쪽 벽에 금 간 데가 있지. 옛날엔 거기 진주를 숨겼는데."]);
  S.kite = async (g, f) => {
    if (f.cleared) return g.say(null, ["여섯 빛깔 연이 하늘 높이 떠 있다. 바람이 기분 좋다."]);
    if (f.tower) { const r = await g.ask(null, "황토빛 탑이 우뚝 서 있다. 들어갈까?", ["들어간다", "아직"]); if (r === 0) g.warp("tower1", 10, 13, "up"); return; }
    if (!f.boss4) { const n = ["boss1", "boss2", "boss3", "boss4"].filter((k) => f[k]).length; return g.say(null, [`찢어진 연이 장대에 걸려 있다. 실이 ${n}가닥 모였다. 4가닥이 모이면 다시 짤 수 있을 것 같다.`]); }
    await g.say("왕눈 촌장", ["모두 모였구나! 청실, 적실, 백실, 흑실… 그리고 가운데 황실은 원래 이 언덕에 묻혀 있단다."]);
    await g.say(null, ["네 가닥 실을 장대에 감자, 땅이 우르르 울렸다.", "언덕 한가운데서 황토빛 탑이 솟아올랐다!"]);
    await g.shake();
    await g.say("몽실", ["저 꼭대기에서 회색 연기가 나와. 무채가 있는 데가 저기야."]);
    await g.say("깍새", ["올라가는 건 걸어서 간다. 날아가면 반칙 같잖아."]);
    await g.say(null, ["뽀득은 네 가닥 실에서 따뜻한 힘을 느꼈다. 새 스킬 「오색 일격」을 배웠다!"]);
    g.learn("ppo", "rainbow");
    g.set("tower");
    g.toast("「오색 일격」을 배웠다");
  };
  // 보스
  S.bossShoot = async (g) => {
    await g.say("죽순 대왕", ["쑥쑥! 이 파란 실 덕분에 나는 대왕이 되었다! 쑥쑥!", "돌려 달라고? 싫다! 쑥!"]);
    const r = await g.battle({ foes: ["b_shoot"], boss: true });
    if (r !== "win") return;
    await g.say(null, ["죽순 대왕이 쪼그라들어 평범한 죽순이 되었다. 청실을 되찾았다!"]);
    g.give("th_blue", 1); g.set("boss1");
    await g.say("몽실", ["해냈다! 약초밭도 숨 쉬겠네. 약속대로 같이 갈게. 다치면 바로 말해, 참지 말고!", "…그리고 끼니 거르지 말고, 이빨 닦고, 일찍 자고…"]);
    g.join("mong");
    g.toast("몽실이 동료가 되었다");
    await g.say(null, ["마을 남쪽 길을 막던 용암 덩어리가 녹기 시작했다는 소식이 들린다."]);
  };
  S.bossToad = async (g) => {
    await g.say("가마솥 두꺼비", ["꾸르륵… 이 빨간 국수, 맵기는 엄청 매운데 씹히질 않아.", "뱉으라고? 아직 국물도 안 마셨는데! 꾸륵!"]);
    const r = await g.battle({ foes: ["b_toad"], boss: true });
    if (r !== "win") return;
    await g.say(null, ["두꺼비가 「퉤」 하고 실을 뱉었다. 적실을 되찾았다!"]);
    g.give("th_red", 1); g.set("boss2");
    await g.say("깍새", ["와, 진짜 이겼네. 좋아, 나도 간다. 길 안내는 내가 할게. 걸어서."]);
    g.join("kkak");
    g.toast("깍새가 동료가 되었다");
  };
  S.bossOwl = async (g) => {
    await g.say("부엉 장군", ["부엉. 이 하얀 실은 무채 님께 바칠 것이다.", "…무채 님? 내가 왜 그 녀석을 「님」이라고… 부엉, 머리가 회색으로 흐릿하다."]);
    const r = await g.battle({ foes: ["b_owl"], boss: true });
    if (r !== "win") return;
    await g.say("부엉 장군", ["부엉… 깃털에서 잿빛이 빠졌다. 무채가 내 눈에 회색을 씌웠던 거다.", "실은 돌려주마. 그리고 알려 주지. 무채는 원래 오색 연에 끼지 못한 「여섯째 실」이었다는 소문이 있다."]);
    g.give("th_white", 1); g.set("boss3");
    g.toast("백실을 되찾았다");
  };
  S.bossOcto = async (g) => {
    await g.say("먹물 문어 사서", ["쉿! 여기는 도서관이에요. 뛰지 말고, 떠들지 말고, 실 찾지 마세요.", "검은 실은 대출 중입니다. 반납일은… 영원히!"]);
    const r = await g.battle({ foes: ["b_octo"], boss: true });
    if (r !== "win") return;
    await g.say("먹물 문어 사서", ["…연체료는 면제해 드릴게요. 흑실, 반납 처리했습니다.", "참고로 『누리빙 옛이야기』 312쪽에 이런 말이 있어요.", "「오색 연을 처음 짤 때 회색 실도 있었으나, 축제답지 않다 하여 빼었다.」", "빠진 실은 외로웠겠죠. 도서관에서는 조용히, 그래도 외로운 건 싫거든요."]);
    g.give("th_black", 1); g.set("boss4");
    g.toast("흑실을 되찾았다");
  };
  S.bossMu = async (g) => {
    await g.say("무채", ["왔구나, 시끄러운 색깔들.", "빨강은 소리치고, 파랑은 우쭐대고, 노랑은 깔깔대지. 세상은 회색일 때 제일 조용해.", "나는 연에서 빠진 실이었다. 그러니 이번엔 내가 너희를 뺄 차례다."]);
    await g.say("뽀득", ["(…꼴찌의 기분이라면 나도 좀 안다.)"]);
    const r = await g.battle({ foes: ["b_mu"], boss: true, final: true });
    if (r !== "win") return;
    await g.ending();
  };

  // 엔딩
  const ENDING = [
    ["무채", "왜… 나를 지우지 않지? 나는 너희 색을 다 빼앗으려 했는데."],
    ["뽀득", "회색도 하늘엔 잘 어울려. 구름 색이잖아."],
    ["몽실", "그리고 비 오기 전 하늘도 회색이야. 비 덕분에 약초가 자라."],
    ["깍새", "온천 김도 회색이지. 그거 없으면 온천 아니야."],
    ["무채", "……. 그럼, 나도 연에 끼워 줄 거야?"],
    [null, "그날 저녁, 얼음골 마을 하늘에 여섯 빛깔 연이 떴다."],
    [null, "청, 적, 황, 백, 흑, 그리고 맨 가장자리에 은은한 회색 한 줄."],
    ["왕눈 촌장", "올해 연 날리기 우승은… 뽀득! 연을 다시 짰으니 특별상이다."],
    ["뽀득", "(꼴찌 탈출. 이제 낮잠 자도 되겠지.)"],
  ];

  RPG.data = { MEMBERS, SKILLS, ITEMS, ENEMIES, NORMAL_KINDS, MAPS, DUNGEONS, ENC, SHOPS, QUESTS, EV, S, ENDING, BEATS, EL_NAME, bfs };
})();
