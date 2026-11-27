/* 펭귄 툴즈 사주 해석 규칙 (P2-22) — 자체 작성 문장, 2026-11-02, 03.생산·개발팀
 * - saju-calc.js의 계산 결과(십신 분포·신강 점수·오행·대운·세운·합충)만으로 문장을 고릅니다. 무작위 0, 같은 입력이면 같은 결과.
 * - 각 운세마다 「근거」 한 줄에 실제 판정에 쓴 요소를 적습니다.
 * - 단정하지 않고 경향으로 씁니다. 부정적인 내용에는 대처 행동을 붙입니다. 건강운은 생활 습관 이야기만 하고 질병·진단·처방은 쓰지 않습니다.
 * - 다른 사주 사이트·책의 문장을 옮기지 않았습니다. */
(function (G) {
  "use strict";
  const S = () => G.SAJU;
  const GROUP = ["비겁", "식상", "재성", "관성", "인성"];
  const clampStar = (x) => Math.max(1, Math.min(5, Math.round(x)));

  const DAY_MASTER = [
    { t: "甲木 · 곧게 자라는 큰 나무", p: "위로 곧게 뻗는 나무처럼, 목표를 정하면 밀고 나가요. 새 프로젝트의 첫 삽을 뜨거나 팀 앞에 서는 자리가 어울리죠. 한번 정한 원칙은 잘 안 굽혀서 믿음을 주지만, 회의에서 생각이 다른 사람에겐 고집으로 비치기도 해요.", plus: "추진력, 먼저 시작하는 힘", care: "다른 방식도 한 번 들어 보는 여유" },
    { t: "乙木 · 바람에 휘는 풀과 덩굴", p: "바람에 휘어도 꺾이지 않는 풀처럼, 환경이 바뀌면 거기 맞춰 길을 찾아요. 모임 분위기를 빨리 읽고, 혼자일 때보다 같이 갈 때 멀리 가는 쪽이에요. 남 사정을 먼저 봐주다 보니 내 뜻은 뒤로 미뤄 두고 속으로 쌓아 두기 쉬워요.", plus: "적응력, 끈기", care: "원하는 것을 분명히 말하는 연습" },
    { t: "丙火 · 모두를 비추는 태양", p: "햇빛처럼 밝고 숨김이 없어 어디서든 눈에 띄어요. 열정이 금방 붙고, 이 사람이 들어오면 회식 자리 공기가 달라지죠. 다만 마음이 앞서 속도가 붙으면 마무리에서 빈틈이 생기곤 해요.", plus: "솔직함, 분위기를 띄우는 힘", care: "시작한 일을 끝까지 챙기는 마무리" },
    { t: "丁火 · 한 곳을 밝히는 등불", p: "촛불처럼 한 곳을 오래 비추는 집중력이 있어요. 겉은 조용해도 속이 따뜻해서, 가까운 사람의 생일이나 컨디션을 먼저 챙기죠. 감정이 섬세한 만큼 지나가는 말 한마디에도 하루 기분이 흔들릴 수 있어요.", plus: "집중력, 세심하게 챙기는 마음", care: "혼자 끙끙 앓지 않고 나누기" },
    { t: "戊土 · 묵직한 큰 산", p: "큰 산처럼 쉽게 흔들리지 않아 주변에서 기대고 싶어 하는 사람이에요. 의견이 갈린 회의에서 양쪽 말을 다 듣고 가운데를 잡아 주는 역할을 잘하죠. 신중한 만큼 빨리 바꿔야 할 때 결정이 늦어지기도 해요.", plus: "믿음직함, 사람을 품는 너그러움", care: "필요할 때는 빠르게 움직이는 결단" },
    { t: "己土 · 곡식을 기르는 논밭", p: "기름진 흙처럼 사람과 일을 길러 내요. 실속을 챙기고 살림과 관리에 밝아서, 맡은 일을 차분하게 키워 가죠. 남을 챙기다 정작 내 몫을 놓치는 일이 잦아요.", plus: "실속, 관리 능력", care: "내 시간과 몫을 먼저 확보하기" },
    { t: "庚金 · 단단한 바위와 무쇠", p: "무쇠처럼 단단하고 결단이 빨라요. 옳다고 믿는 일엔 망설이지 않고, 의리를 중요하게 여기죠. 말과 행동이 곧은 만큼 의도와 달리 날카롭게 들릴 때가 있어요.", plus: "결단력, 의리", care: "부드러운 말투 한 겹 더하기" },
    { t: "辛金 · 다듬어진 보석", p: "잘 다듬은 보석처럼 정교하고 깔끔한 걸 좋아해요. 보고서 글자 간격 하나까지 눈에 들어와서 마지막 손질을 맡으면 결과물이 달라지죠. 기준이 높은 만큼 스스로에게도 엄격해서 쉽게 지쳐요.", plus: "꼼꼼한 마무리, 보는 눈", care: "완벽하지 않아도 괜찮다는 마음" },
    { t: "壬水 · 넓게 흐르는 큰 강", p: "큰 강처럼 넓게 보고 멀리 흘러가는 기운이에요. 아이디어가 많고 새 부서나 새 동네에도 금방 녹아들죠. 사람을 너그럽게 품는 대신, 한자리에 오래 묶여 있으면 답답해해요.", plus: "넓은 시야, 기획력", care: "중요한 일 하나를 끝까지 붙잡는 꾸준함" },
    { t: "癸水 · 조용히 스미는 비와 이슬", p: "비와 이슬처럼 조용히 스며들어 주변을 바꿔요. 눈치와 직감이 좋아서 말 안 한 속마음도 알아채고요. 생각이 깊은 대신 고민이 길어지면 결정을 미루게 돼요.", plus: "직감, 속마음을 알아채는 눈", care: "생각을 작은 행동으로 바로 옮기기" },
  ];
  const ELEM_HABIT = [
    "몸을 쭉 펴는 스트레칭과 눈을 쉬게 하는 시간",
    "잠드는 시각을 일정하게 맞추고 과열되지 않게 쉬어 가기",
    "끼니를 거르지 않는 규칙적인 식사 리듬",
    "환기를 자주 하고 숨을 고르는 가벼운 운동",
    "물을 자주 마시고 몸을 따뜻하게 유지하기",
  ];
  const ELEM_WORD = ["나무(목)", "불(화)", "흙(토)", "쇠(금)", "물(수)"];
  const YEAR_THEME = [
    "내 힘으로 밀고 나가는 해예요. 동료나 친구와 같이 할 일이 늘고, 그만큼 경쟁할 일도 생겨요. 더치페이나 경조사처럼 나눠 내는 돈이 많아지니 지출 계획은 미리 세워 두세요.",
    "표현하고 만들어 내는 해예요. 기획안, 글, 손기술처럼 내 손에서 나오는 것들이 잘 풀리기 쉬워요. 말이 많아지는 해라 약속은 한 번 더 확인하는 게 좋아요.",
    "결과를 손에 쥐는 해예요. 성과와 돈이 숫자로 보이고, 움직이는 범위도 넓어지기 쉬워요. 욕심이 커질 땐 올해 꼭 할 것 하나부터 정해 두세요.",
    "책임과 자리가 커지는 해예요. 평가나 승진, 새 역할처럼 어깨가 무거워질 일이 생기기 쉬워요. 마감을 지키는 습관 하나가 올해는 꽤 큰 힘이 돼요.",
    "배우고 채우는 해예요. 공부, 자격증, 계약처럼 서류가 오가는 일과 윗사람의 도움이 들어오기 쉬워요. 생각만 하다 해를 넘기지 않게 이번 달 할 일 하나를 정해 두세요.",
  ];
  const DAEUN_THEME = ["주체성과 경쟁", "표현과 기술", "성과와 재물", "책임과 직장", "배움과 도움"];

  function counts(res) { return res.groups; }
  function yearHas(yl, g) { return (yl.stemGod.group === g ? 1 : 0) + (yl.brGod.group === g ? 1 : 0); }
  function daeunHas(yl, g) { const d = yl.daeun; return d ? (d.stemGroup === g ? 1 : 0) + (d.brGroup === g ? 1 : 0) : 0; }
  const ylText = (yl) => `${yl.year}년 세운 ${yl.name}(${yl.stemGod.name}·${yl.brGod.name})`;
  const dwText = (yl) => (yl.daeun ? `대운 ${yl.daeun.name}(${yl.daeun.stemGod}·${yl.daeun.brGod})` : "대운 시작 전");

  function love(res, yl) {
    const g = counts(res), male = res.input.gender === "m";
    const T = male ? 2 : 3, tn = GROUP[T], n = g[T];
    let s = n === 0 ? 2 : n <= 2 ? 3 : 2.5;
    const lines = [];
    if (n === 0) lines.push(`원국에 연애를 상징하는 ${tn}이 드러나 있지 않아요. 인연이 저절로 오기보다 내가 움직일 때 생기는 쪽이라, 동호회나 친구 모임처럼 사람 만나는 자리를 일부러 잡아 보세요.`);
    else if (n <= 2) lines.push(`원국에 ${tn}이 ${n}개 있어 인연이 들어올 문은 적당히 열려 있어요. 마음에 드는 사람이 있으면 먼저 안부 한 줄 보내는 쪽이 잘 풀리기 쉬워요.`);
    else lines.push(`원국에 ${tn}이 ${n}개로 많아서 만날 기회는 많은데 마음이 여러 갈래로 흩어지기 쉬워요. 나한테 정말 맞는 사람의 조건을 한두 가지로 좁혀 두세요.`);
    if (g[1] >= 1) { s += 0.5; lines.push("식상이 있어 좋아하는 마음을 말과 행동으로 꺼낼 줄 알아요."); }
    if (male && g[0] >= 3 && n <= 1) { s -= 0.5; lines.push("비겁이 많아 연애에서도 경쟁하거나 양보할 일이 생기기 쉬워요. 남과 비교하지 말고 내 속도대로 가세요."); }
    const yh = yearHas(yl, T), dh = daeunHas(yl, T);
    s += yh * 0.75 + (dh ? 0.5 : 0);
    const dayHe = yl.rel.find((r) => r.pos === 2 && r.kind === "합"), dayCh = yl.rel.find((r) => r.pos === 2 && r.kind === "충");
    if (yh) lines.push(`올해는 세운에 ${tn}이 들어와요. 새로 누군가를 만나거나, 만나던 사이가 한 걸음 나아가기 쉬운 해예요.`);
    if (dayHe) { s += 1; lines.push("세운이 배우자 자리(일지)와 합을 이뤄요. 가까운 사이가 더 단단해지기 좋은 해죠."); }
    if (dayCh) { s -= 0.5; lines.push("세운이 배우자 자리(일지)와 충을 이뤄 관계에 변화가 생기기 쉬워요. 서운한 일은 쌓아 두지 말고 그날그날 짧게 말하세요."); }
    if (!yh && !dayHe && !dayCh) lines.push("올해 연애는 크게 출렁이지 않아요. 큰 이벤트보다 지금 사이를 꾸준히 챙기는 데 힘을 쓰면 좋아요.");
    const basis = `${male ? "남성은 재성" : "여성은 관성"}을 연애 별로 봄: 원국 ${tn} ${n}개, 식상 ${g[1]}개, ${ylText(yl)}${dayHe ? ", 일지 합" : ""}${dayCh ? ", 일지 충" : ""}, ${dwText(yl)}`;
    return { key: "love", name: "연애운", stars: clampStar(s), lines, basis };
  }
  function money(res, yl) {
    const g = counts(res), st = res.strength;
    let s = 2.5;
    const lines = [];
    if (g[1] >= 1 && g[2] >= 1) { s += 1; lines.push("식상과 재성이 함께 있어 하는 일이 그대로 수입으로 이어지는 구조(식상생재)예요. 잘하는 일 하나를 꾸준히 쌓는 게 이 사주에선 제일 나은 재테크죠."); }
    else if (g[2] === 0) { s -= 0.5; lines.push("원국에 재성이 드러나 있지 않아 돈보다 다른 걸 앞세우기 쉬워요. 월급날 자동이체 적금처럼 신경 안 써도 모이는 장치를 하나 걸어 두세요."); }
    else lines.push(`재성이 ${g[2]}개 있어 돈 감각은 있는 편이에요. 수입 길을 하나 더 키우면 흐름이 나아지기 쉬워요.`);
    if (g[2] >= 3 && !st.strong) { s -= 0.5; lines.push("재성은 많은데 일간의 힘이 약해서, 들어오는 기회를 다 잡으려다 지치기 쉬워요. 감당할 만큼만 고르세요."); }
    else if (st.strong && g[2] >= 1) { s += 0.5; lines.push("일간에 힘이 있어 들어온 돈을 지키고 굴리는 쪽도 약하지 않아요."); }
    const y2 = yearHas(yl, 2), y1 = yearHas(yl, 1), y0 = yearHas(yl, 0);
    s += y2 * 0.75 + y1 * 0.5 - y0 * 0.5 + (daeunHas(yl, 2) ? 0.5 : 0);
    if (y2) lines.push("올해는 재성이 들어와 한 만큼의 성과가 숫자로 보이기 쉬워요.");
    if (y1 && !y2) lines.push("올해는 식상이 들어와 부업이나 새 일처럼 돈을 만드는 움직임이 늘기 쉬워요.");
    if (y0) lines.push("올해는 비겁이 들어와 모임 회비나 경조사비처럼 같이 쓰는 돈이 늘기 쉬워요. 큰 금액은 하룻밤 자고 나서 정하세요.");
    if (!y2 && !y1 && !y0) lines.push("올해 돈 흐름은 무난해요. 새 투자보다 카드 명세서를 한 번 훑어보는 쪽이 남는 해예요.");
    const basis = `원국 재성 ${g[2]}·식상 ${g[1]}·비겁 ${g[0]}개, 일간 ${st.label}(${st.score}점), ${ylText(yl)}, ${dwText(yl)}`;
    return { key: "money", name: "재물운", stars: clampStar(s), lines, basis };
  }
  function career(res, yl) {
    const g = counts(res);
    let s = 2.5 + (g[3] >= 1 ? 0.5 : 0) + (g[4] >= 1 ? 0.5 : 0);
    const lines = [];
    let type;
    if (g[3] >= 1 && g[4] >= 1) { type = "조직형"; lines.push("관성과 인성이 이어져 있어(관인상생) 조직 안에서 인정받으며 자리를 넓혀 가는 길이 잘 맞아요. 직급 체계와 규정이 분명한 회사가 오히려 편하게 느껴질 수 있어요."); }
    else if (g[1] >= 2) { type = "전문·독립형"; lines.push("식상이 두드러져 기술이나 창작처럼 내 손으로 결과물을 내는 일이 잘 맞아요. 해 놓은 작업을 포트폴리오로 모아 두면 기회가 따라오기 쉽죠."); }
    else if (g[2] >= 2) { type = "성과·사업형"; lines.push("재성이 두드러져 실적과 숫자로 평가받는 일에서 힘이 나요. 영업이나 사업처럼 결과가 바로 보이는 자리가 맞는 쪽이에요."); }
    else { type = "균형형"; lines.push("어느 한쪽으로 쏠리지 않아 여러 일을 두루 해낼 수 있어요. 관심 분야 하나를 골라 깊이 파면 내 무기가 또렷해져요."); }
    const yh = yearHas(yl, 3) + yearHas(yl, 4);
    s += yh * 0.75 + (yearHas(yl, 1) ? 0.25 : 0) + (daeunHas(yl, 3) || daeunHas(yl, 4) ? 0.5 : 0);
    const monCh = yl.rel.find((r) => r.pos === 1 && r.kind === "충");
    if (yh) lines.push("올해는 관성이나 인성이 들어와 취업, 승진, 합격처럼 자리가 정해지는 일에 힘이 실리기 쉬워요. 마감 있는 지원서는 미루지 마세요.");
    if (monCh) lines.push("세운이 사회 자리(월지)와 충을 이뤄 이직이나 부서 이동 같은 변화가 생기기 쉬워요. 이력서는 미리 고쳐 두면 덜 허둥대요.");
    if (!yh && !monCh) lines.push("올해 일은 급하게 바뀌기보다 지금 자리에서 실력을 다지는 쪽으로 흘러가요.");
    const basis = `직업 성향 ${type}: 관성 ${g[3]}·인성 ${g[4]}·식상 ${g[1]}·재성 ${g[2]}개, ${ylText(yl)}${monCh ? ", 월지 충" : ""}, ${dwText(yl)}`;
    return { key: "career", name: "직업·취업운", stars: clampStar(s), lines, basis };
  }
  function study(res, yl) {
    const g = counts(res);
    let s = 2.5;
    const lines = [];
    if (g[4] === 0) { s -= 0.5; lines.push(g[1] >= 1 ? "인성이 드러나 있지 않고 식상이 있어서, 이론보다 직접 해 보며 익히는 쪽이에요. 기출문제를 많이 풀고 손으로 정리하는 방식이 잘 맞아요." : "인성이 드러나 있지 않아 오래 앉아 외우는 공부는 금방 지루해질 수 있어요. 출퇴근길 지하철에서처럼 짧게 끊어 자주 보는 방식을 써 보세요."); }
    else if (g[4] <= 2) { s += 1; lines.push(`인성이 ${g[4]}개 있어 배우고 이해하는 힘이 좋아요. 기본서를 처음부터 차근차근 읽는 공부가 잘 맞기 쉬워요.`); }
    else { s += 0.5; lines.push("인성이 많아 자료는 잔뜩 모으는데 정작 시작이 늦어지기 쉬워요. 계획을 하루 단위로 쪼개고, 끝낸 건 줄을 그어 지워 보세요."); }
    if (g[1] >= 1 && g[4] >= 1) { s += 0.5; lines.push("식상도 있어 배운 걸 말이나 글로 풀어낼 줄 알아요. 동료한테 한번 설명해 보면 오래 남아요."); }
    const y4 = yearHas(yl, 4);
    s += y4 + (yearHas(yl, 3) ? 0.25 : 0);
    lines.push(y4 ? "올해는 인성이 들어와요. 미뤄 둔 자격증 시험을 접수하거나 새 공부를 시작하기 좋은 해예요." : "올해는 새 공부를 크게 벌이기보다 하던 공부를 끝내는 데 힘을 쓰는 게 나아요.");
    const basis = `원국 인성 ${g[4]}·식상 ${g[1]}·관성 ${g[3]}개, ${ylText(yl)}`;
    return { key: "study", name: "학업운", stars: clampStar(s), lines, basis };
  }
  function health(res, yl) {
    const e = res.elements;
    const missing = e.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
    const many = e.map((v, i) => (v >= 3 ? i : -1)).filter((i) => i >= 0);
    let s = 4 - 0.5 * missing.length - 0.5 * many.length;
    const lines = [];
    if (!missing.length && !many.length) lines.push("오행이 고르게 퍼져 있어 생활 리듬이 쉽게 무너지지 않아요. 지금 습관을 그대로 이어 가면 돼요.");
    many.forEach((i) => lines.push(`${ELEM_WORD[i]} 기운이 ${e[i]}개로 많아요. 한쪽으로 쏠리기 쉬우니 ${ELEM_HABIT[i]}에 신경 써 보세요.`));
    missing.forEach((i) => lines.push(`${ELEM_WORD[i]} 기운이 드러나 있지 않아요. ${ELEM_HABIT[i]} 같은 습관으로 채워 보세요.`));
    const ye = [S().stemEl(yl.s), S().BR_EL[yl.b]];
    if (ye.some((x) => many.includes(x))) { s -= 0.5; lines.push(`올해 세운 ${yl.name}이 이미 많은 기운을 더 얹어요. 야근이 몰리는 달엔 쉬는 날부터 달력에 먼저 적어 두세요.`); }
    if (ye.some((x) => missing.includes(x))) { s += 0.5; lines.push(`올해 세운 ${yl.name}이 비어 있던 기운을 채워 줘요. 미뤄 둔 운동을 시작하기 괜찮은 해예요.`); }
    lines.push("의학적 판단이 아닙니다. 몸에 이상이 있으면 의료기관에 문의하세요.");
    const basis = `오행 분포 목${e[0]} 화${e[1]} 토${e[2]} 금${e[3]} 수${e[4]}${missing.length ? ", 없는 기운 " + missing.map((i) => S().EL_K[i]).join("·") : ""}${many.length ? ", 많은 기운 " + many.map((i) => S().EL_K[i]).join("·") : ""}, ${ylText(yl)}`;
    return { key: "health", name: "건강운", stars: clampStar(s), lines, basis };
  }
  function people(res, yl) {
    const g = counts(res);
    const good = res.relations.filter((r) => r.good).length, bad = res.relations.filter((r) => !r.good).length;
    let s = 3 + Math.min(1, good * 0.25) - bad * 0.25;
    const lines = [];
    const top = [0, 1, 4, 3, 2].reduce((a, i) => (g[i] > g[a] ? i : a), 0);
    const T = [
      "비겁이 두드러져 친구와 동료가 힘이 되는 사람이에요. 같이 있으면 든든한데, 동기와 경쟁이 붙을 때는 한발 물러서는 쪽이 사이를 지켜 줘요.",
      "식상이 두드러져 말 한마디로 사람을 끌어당겨요. 회식 자리를 살리는 재주가 있는 만큼, 농담이 선을 넘지 않는지만 한 번 더 보세요.",
      "재성이 두드러져 약속과 실속을 중요하게 여겨요. 더치페이 계산보다 마음을 먼저 보여 주면 사이가 한층 깊어지기 쉬워요.",
      "관성이 두드러져 예의 바르고 믿음직한 사람으로 보이기 쉬워요. 가끔은 격식을 내려놓고 먼저 커피 한잔하자고 해 보세요.",
      "인성이 두드러져 윗사람이나 선배의 도움을 받기 쉬워요. 도움받은 건 작게라도 고맙다고 표현하세요. 그래야 인연이 오래가요.",
    ];
    lines.push(T[top]);
    if (good) lines.push(`원국에 합이 ${good}개 있어요. 사람을 모으고 서로 소개해 주는 자리에 자주 서게 돼요.`);
    if (bad) lines.push(`원국에 충이 ${bad}개 있어 부딪히면서 오히려 사이가 단단해지는 쪽이에요. 감정이 올라온 날엔 결론을 하루 미루세요.`);
    const yHe = yl.rel.filter((r) => r.kind === "합").length, yCh = yl.rel.filter((r) => r.kind === "충").length;
    s += yHe * 0.5 - yCh * 0.5 + (yearHas(yl, 0) ? 0.25 : 0);
    if (yHe) lines.push("올해는 세운이 원국과 합을 이뤄요. 새 팀이나 모임에서 사람을 사귀기 쉬운 해예요.");
    if (yCh) lines.push("올해는 세운이 원국과 충을 이뤄 오래된 관계가 정리되거나 모양이 바뀌기 쉬워요. 놓치기 싫은 사람이 있다면 먼저 연락하세요.");
    if (!yHe && !yCh) lines.push("올해 인간관계는 잔잔해요. 연락이 끊겼던 사람에게 안부 한 줄 보내기 좋은 해예요.");
    const basis = `가장 두드러진 십신 ${GROUP[top]}(${g[top]}개), 원국 합 ${good}·충 ${bad}, 세운과 원국의 합 ${yHe}·충 ${yCh}`;
    return { key: "people", name: "인간관계운", stars: clampStar(s), lines, basis };
  }
  function yearText(res, yl) {
    const st = res.strength, sg = yl.stemGod.group, bg = yl.brGod.group;
    const lines = [YEAR_THEME[sg]];
    if (bg !== sg) lines.push(`하반기로 갈수록 ${GROUP[bg]}의 기운도 함께 느껴질 수 있어요. ${YEAR_THEME[bg].split(".")[0]}.`);
    const helps = (x) => x === 0 || x === 4;
    let s = 3;
    if (st.strong && !helps(sg)) { s += 1; lines.push("일간에 힘이 있어서 올해 들어오는 기운을 내 쪽으로 끌어다 쓰기 좋아요. 미뤄 둔 일이 있으면 올해 꺼내세요."); }
    else if (!st.strong && helps(sg)) { s += 1; lines.push("일간의 힘이 약한 편인데, 올해는 나를 돕는 기운이 들어와 든든해요. 도와 달라는 말이 평소보다 잘 통하는 해예요."); }
    else if (st.strong && helps(sg)) lines.push("이미 힘이 있는 일간에 돕는 기운까지 얹혀 고집이 세지기 쉬워요. 회의에서 내 안을 밀기 전에 남의 의견을 한 번 더 들어 보세요.");
    else { s -= 0.5; lines.push("일간의 힘이 약한 편인데 올해는 힘을 빼 가는 기운이 들어와요. 새 일을 벌이기보다 하던 일을 하나씩 끝내는 쪽으로 속도를 조절하세요."); }
    yl.rel.forEach((r) => { s += r.kind === "합" ? 0.5 : -0.5; lines.push(r.kind === "합" ? `${r.text}: 그 자리와 관련된 일이 부드럽게 이어지기 쉬워요.` : `${r.text}: 그 자리와 관련된 일에 변화가 생기기 쉬워요. 미리 대비해 두면 기회로 돌릴 수 있어요.`); });
    if (yl.daeun) lines.push(`지금은 ${yl.daeun.name} 대운(${DAEUN_THEME[yl.daeun.stemGroup]}의 10년)을 지나고 있어요.`);
    const basis = `${ylText(yl)}, 일간 ${st.label}(${st.score}점), ${dwText(yl)}${yl.rel.length ? ", " + yl.rel.map((r) => r.text).join(", ") : ""}`;
    return { stars: clampStar(s), lines, basis };
  }

  function read(res, year) {
    const yl = S().yearLuck(res, year);
    const dm = DAY_MASTER[res.pillars[2].s];
    const st = res.strength;
    const strengthText = st.score >= 65 ? "일간을 돕는 기운이 많아 주관이 뚜렷하고 혼자서도 밀고 나가요. 남는 힘을 일이나 취미, 봉사처럼 밖으로 쓸 곳에 돌리면 한결 편해져요."
      : st.score >= 50 ? "돕는 기운과 쓰는 기운이 비슷한데, 살짝 강한 쪽이에요. 하고 싶은 일은 밀어붙일 힘이 있어요."
      : st.score >= 35 ? "돕는 기운과 쓰는 기운이 비슷한데, 살짝 약한 쪽이에요. 혼자 끙끙대기보다 믿을 만한 사람과 같이 할 때 일이 잘 풀려요."
      : "일간을 돕는 기운이 적어 주변 환경에 영향을 많이 받아요. 배울 거리와 좋은 사람을 곁에 두면 힘이 붙어요.";
    return {
      year: yl,
      dayMaster: { title: dm.t, text: dm.p, plus: dm.plus, care: dm.care },
      strengthText,
      fortunes: [love(res, yl), money(res, yl), career(res, yl), study(res, yl), health(res, yl), people(res, yl)],
      yearRead: yearText(res, yl),
    };
  }
  G.SAJU_READ = { read, DAY_MASTER, GROUP };
  if (typeof module === "object" && module.exports) module.exports = G.SAJU_READ;
})(typeof globalThis !== "undefined" ? globalThis : this);
