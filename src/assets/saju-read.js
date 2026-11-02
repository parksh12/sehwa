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
    { t: "甲木 · 곧게 자라는 큰 나무", p: "위로 곧게 뻗는 나무처럼 목표를 정하면 밀고 나가는 힘이 있어요. 처음 길을 내는 일, 사람들을 이끄는 일에 잘 맞는 편이에요. 한번 정한 원칙을 쉽게 굽히지 않아 믿음을 주지만, 생각이 다른 사람에게는 고집으로 보일 때도 있어요.", plus: "추진력, 책임감, 시작하는 힘", care: "다른 방식도 한 번 들어 보는 여유" },
    { t: "乙木 · 바람에 휘는 풀과 덩굴", p: "부드럽게 휘어지지만 꺾이지 않는 풀처럼 환경에 맞춰 길을 찾는 감각이 좋아요. 사람 사이의 분위기를 잘 읽고, 혼자보다 함께일 때 더 멀리 가는 편이에요. 배려가 깊은 만큼 자기 뜻을 뒤로 미뤄 두고 속으로 쌓아 둘 수 있어요.", plus: "적응력, 친화력, 끈기", care: "원하는 것을 분명히 말하는 연습" },
    { t: "丙火 · 모두를 비추는 태양", p: "햇빛처럼 밝고 숨김이 없어 어디서든 눈에 잘 띄어요. 열정이 빨리 붙고 분위기를 끌어올리는 힘이 있어 사람들이 모여드는 편이에요. 다만 마음이 앞서 속도가 빨라지면 마무리가 아쉬울 수 있어요.", plus: "솔직함, 열정, 표현력", care: "시작한 일을 끝까지 챙기는 마무리" },
    { t: "丁火 · 한 곳을 밝히는 등불", p: "촛불처럼 한 곳을 오래 비추는 집중력이 있어요. 겉으로는 조용해도 속은 따뜻해서 가까운 사람을 세심하게 챙기는 편이에요. 감정의 온도가 섬세한 만큼 작은 말에도 마음이 흔들릴 수 있어요.", plus: "집중력, 섬세함, 따뜻한 배려", care: "혼자 끙끙 앓지 않고 나누기" },
    { t: "戊土 · 묵직한 큰 산", p: "큰 산처럼 쉽게 흔들리지 않아 주변에서 기대고 싶어 하는 사람이에요. 서로 다른 의견 사이에서 균형을 잡고 중재하는 데 강해요. 신중한 만큼 변화가 필요한 순간에 결정이 늦어질 수 있어요.", plus: "신뢰감, 포용력, 안정감", care: "필요할 때는 빠르게 움직이는 결단" },
    { t: "己土 · 곡식을 기르는 논밭", p: "기름진 흙처럼 사람과 일을 길러 내는 힘이 있어요. 실속을 챙기고 살림과 관리에 밝아 맡은 일을 차분하게 키워 가는 편이에요. 남을 챙기느라 정작 내 몫을 놓치기 쉬워요.", plus: "실속, 돌봄, 관리 능력", care: "내 시간과 몫을 먼저 확보하기" },
    { t: "庚金 · 단단한 바위와 무쇠", p: "무쇠처럼 단단하고 결단이 빨라요. 옳다고 믿는 일에는 망설이지 않고, 의리를 중요하게 여기는 편이에요. 말과 행동이 직선적이라 의도와 달리 날카롭게 전달될 때가 있어요.", plus: "결단력, 의리, 실행력", care: "부드러운 말투 한 겹 더하기" },
    { t: "辛金 · 다듬어진 보석", p: "잘 다듬은 보석처럼 정교하고 깔끔한 것을 좋아해요. 미적 감각과 디테일을 보는 눈이 뛰어나 완성도를 끌어올리는 역할을 잘해요. 기준이 높은 만큼 스스로에게도 엄격해 쉽게 지칠 수 있어요.", plus: "정교함, 감각, 완성도", care: "완벽하지 않아도 괜찮다는 마음" },
    { t: "壬水 · 넓게 흐르는 큰 강", p: "큰 강처럼 넓게 보고 멀리 흘러가는 기운이에요. 아이디어가 많고 새로운 환경에 금방 녹아들며, 사람을 너그럽게 품는 편이에요. 흐름을 타는 만큼 한곳에 오래 머무르는 일은 답답하게 느낄 수 있어요.", plus: "넓은 시야, 포용력, 기획력", care: "중요한 일 하나를 끝까지 붙잡는 꾸준함" },
    { t: "癸水 · 조용히 스미는 비와 이슬", p: "비와 이슬처럼 조용히 스며들어 주변을 바꾸는 힘이 있어요. 눈치와 직관이 좋아 말하지 않은 마음도 잘 알아차리는 편이에요. 생각이 깊어 고민이 길어지면 결정을 미루게 될 수 있어요.", plus: "직관, 공감, 깊은 사고", care: "생각을 작은 행동으로 바로 옮기기" },
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
    "내 힘으로 밀고 나가는 해예요. 동료나 친구와 함께할 일이 늘고, 경쟁 상황도 생기기 쉬워요. 나눠 쓰는 일이 많아지니 지출 계획을 미리 세워 두면 좋아요.",
    "표현하고 만들어 내는 해예요. 아이디어, 기술, 말과 글이 잘 풀리기 쉬워요. 말이 많아지는 만큼 약속은 한 번 더 확인하세요.",
    "결과를 손에 쥐는 해예요. 일의 성과와 돈의 흐름이 눈에 잘 보이고 활동 범위가 넓어지기 쉬워요. 욕심이 커질 때는 우선순위를 정해 두세요.",
    "책임과 자리가 커지는 해예요. 평가, 승진, 새 역할처럼 사회적인 무게가 실리기 쉬워요. 규칙과 마감을 지키는 습관이 큰 힘이 돼요.",
    "배우고 채우는 해예요. 공부, 자격, 계약 같은 문서 일과 윗사람의 도움이 들어오기 쉬워요. 생각만 하다 미루지 않도록 작은 실행 목표를 두세요.",
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
    if (n === 0) lines.push(`원국에 연애를 상징하는 ${tn}이 드러나 있지 않아요. 인연이 저절로 찾아오기보다 내가 움직일 때 생기는 편이니, 모임이나 취미처럼 사람을 만나는 자리를 일부러 만들어 보세요.`);
    else if (n <= 2) lines.push(`원국에 ${tn}이 ${n}개 있어 인연의 기회가 적당히 열려 있는 구조예요. 마음에 드는 사람에게는 먼저 안부를 건네는 쪽이 잘 풀리기 쉬워요.`);
    else lines.push(`원국에 ${tn}이 ${n}개로 많은 편이라 사람을 만날 기회는 많지만 마음이 여러 갈래로 나뉘기 쉬워요. 나에게 정말 맞는 사람의 조건을 한두 가지로 좁혀 두면 좋아요.`);
    if (g[1] >= 1) { s += 0.5; lines.push("식상이 있어 마음을 말과 행동으로 표현하는 힘이 있어요."); }
    if (male && g[0] >= 3 && n <= 1) { s -= 0.5; lines.push("비겁이 많아 연애에서도 경쟁이나 양보할 일이 생기기 쉬워요. 비교하기보다 내 속도를 지키세요."); }
    const yh = yearHas(yl, T), dh = daeunHas(yl, T);
    s += yh * 0.75 + (dh ? 0.5 : 0);
    const dayHe = yl.rel.find((r) => r.pos === 2 && r.kind === "합"), dayCh = yl.rel.find((r) => r.pos === 2 && r.kind === "충");
    if (yh) lines.push(`올해는 세운에 ${tn}이 들어와 새 인연이나 관계의 진전이 생기기 쉬운 흐름이에요.`);
    if (dayHe) { s += 1; lines.push("세운이 배우자 자리(일지)와 합을 이뤄 가까운 사이가 더 단단해지기 좋은 해예요."); }
    if (dayCh) { s -= 0.5; lines.push("세운이 배우자 자리(일지)와 충을 이뤄 관계에 변화가 생기기 쉬워요. 서운한 일은 쌓아 두지 말고 그때그때 짧게 이야기하세요."); }
    if (!yh && !dayHe && !dayCh) lines.push("올해 연애 흐름은 크게 출렁이지 않는 편이에요. 지금 관계를 꾸준히 가꾸는 데 힘을 쓰기 좋아요.");
    const basis = `${male ? "남성은 재성" : "여성은 관성"}을 연애 별로 봄: 원국 ${tn} ${n}개, 식상 ${g[1]}개, ${ylText(yl)}${dayHe ? ", 일지 합" : ""}${dayCh ? ", 일지 충" : ""}, ${dwText(yl)}`;
    return { key: "love", name: "연애운", stars: clampStar(s), lines, basis };
  }
  function money(res, yl) {
    const g = counts(res), st = res.strength;
    let s = 2.5;
    const lines = [];
    if (g[1] >= 1 && g[2] >= 1) { s += 1; lines.push("식상과 재성이 함께 있어 하는 일이 수입으로 이어지는 구조(식상생재)예요. 잘하는 일을 꾸준히 쌓는 것이 가장 좋은 재테크가 되기 쉬워요."); }
    else if (g[2] === 0) { s -= 0.5; lines.push("원국에 재성이 드러나 있지 않아 돈에 대한 욕심보다 다른 가치를 앞세우는 편이에요. 자동이체 저축처럼 신경 쓰지 않아도 모이는 장치를 만들어 두세요."); }
    else lines.push(`재성이 ${g[2]}개 있어 현실 감각은 있는 편이에요. 수입을 늘릴 기술이나 경로 하나를 더 키우면 흐름이 좋아지기 쉬워요.`);
    if (g[2] >= 3 && !st.strong) { s -= 0.5; lines.push("재성이 많은데 일간의 힘은 약한 편이라 기회가 많아도 다 잡으려 하면 지치기 쉬워요. 감당할 수 있는 만큼만 고르세요."); }
    else if (st.strong && g[2] >= 1) { s += 0.5; lines.push("일간의 힘이 있어 들어온 재물을 지키고 굴리는 힘도 갖춘 편이에요."); }
    const y2 = yearHas(yl, 2), y1 = yearHas(yl, 1), y0 = yearHas(yl, 0);
    s += y2 * 0.75 + y1 * 0.5 - y0 * 0.5 + (daeunHas(yl, 2) ? 0.5 : 0);
    if (y2) lines.push("올해는 재성이 들어와 성과가 숫자로 보이기 쉬운 해예요.");
    if (y1 && !y2) lines.push("올해는 식상이 들어와 새 일이나 부업처럼 돈을 만드는 활동이 늘기 쉬워요.");
    if (y0) lines.push("올해는 비겁이 들어와 함께 쓰는 돈, 경조사 같은 지출이 늘기 쉬워요. 큰 금액은 하루 미뤄 생각해 보세요.");
    if (!y2 && !y1 && !y0) lines.push("올해 재물 흐름은 무난한 편이에요. 새 투자보다 지출 점검이 더 효과적인 해예요.");
    const basis = `원국 재성 ${g[2]}·식상 ${g[1]}·비겁 ${g[0]}개, 일간 ${st.label}(${st.score}점), ${ylText(yl)}, ${dwText(yl)}`;
    return { key: "money", name: "재물운", stars: clampStar(s), lines, basis };
  }
  function career(res, yl) {
    const g = counts(res);
    let s = 2.5 + (g[3] >= 1 ? 0.5 : 0) + (g[4] >= 1 ? 0.5 : 0);
    const lines = [];
    let type;
    if (g[3] >= 1 && g[4] >= 1) { type = "조직형"; lines.push("관성과 인성이 이어져 있어(관인상생) 조직 안에서 인정받고 자리를 넓혀 가는 길이 잘 맞는 편이에요. 공채, 공공기관, 체계가 갖춰진 회사가 편하게 느껴질 수 있어요."); }
    else if (g[1] >= 2) { type = "전문·독립형"; lines.push("식상이 두드러져 기술이나 창작처럼 내 손으로 결과를 만드는 일이 잘 맞는 편이에요. 포트폴리오를 꾸준히 쌓으면 기회가 따라오기 쉬워요."); }
    else if (g[2] >= 2) { type = "성과·사업형"; lines.push("재성이 두드러져 숫자와 성과로 평가받는 일, 영업이나 사업 감각이 필요한 일에서 힘을 내기 쉬워요."); }
    else { type = "균형형"; lines.push("한쪽으로 치우치지 않아 여러 일을 두루 해낼 수 있는 구조예요. 관심 분야를 하나 정해 깊이를 더하면 강점이 선명해져요."); }
    const yh = yearHas(yl, 3) + yearHas(yl, 4);
    s += yh * 0.75 + (yearHas(yl, 1) ? 0.25 : 0) + (daeunHas(yl, 3) || daeunHas(yl, 4) ? 0.5 : 0);
    const monCh = yl.rel.find((r) => r.pos === 1 && r.kind === "충");
    if (yh) lines.push("올해는 관성이나 인성이 들어와 취업, 승진, 합격처럼 자리가 정해지는 일에 힘이 실리기 쉬워요. 지원서와 서류를 미루지 마세요.");
    if (monCh) lines.push("세운이 사회 자리(월지)와 충을 이뤄 이직, 부서 이동 같은 변화가 생기기 쉬워요. 바뀌는 환경을 기회로 삼을 준비를 해 두세요.");
    if (!yh && !monCh) lines.push("올해 일의 흐름은 급하게 바뀌기보다 지금 자리에서 실력을 다지기 좋은 편이에요.");
    const basis = `직업 성향 ${type}: 관성 ${g[3]}·인성 ${g[4]}·식상 ${g[1]}·재성 ${g[2]}개, ${ylText(yl)}${monCh ? ", 월지 충" : ""}, ${dwText(yl)}`;
    return { key: "career", name: "직업·취업운", stars: clampStar(s), lines, basis };
  }
  function study(res, yl) {
    const g = counts(res);
    let s = 2.5;
    const lines = [];
    if (g[4] === 0) { s -= 0.5; lines.push(g[1] >= 1 ? "인성이 드러나 있지 않고 식상이 있어 이론보다 직접 해 보며 배우는 응용형이에요. 문제를 많이 풀고 손으로 정리하는 방식이 잘 맞아요." : "인성이 드러나 있지 않아 오래 앉아 외우는 공부는 지루하게 느낄 수 있어요. 짧게 끊어 자주 반복하는 방식을 써 보세요."); }
    else if (g[4] <= 2) { s += 1; lines.push(`인성이 ${g[4]}개 있어 배우고 이해하는 힘이 좋은 편이에요. 기본서를 처음부터 차근차근 보는 공부가 효과적이기 쉬워요.`); }
    else { s += 0.5; lines.push("인성이 많아 생각과 자료는 풍부하지만 실행이 늦어지기 쉬워요. 공부 계획을 하루 단위로 쪼개고 끝낸 것을 체크해 보세요."); }
    if (g[1] >= 1 && g[4] >= 1) { s += 0.5; lines.push("식상도 있어 배운 것을 말이나 글로 풀어내는 힘이 있어요. 남에게 설명해 보면 오래 기억돼요."); }
    const y4 = yearHas(yl, 4);
    s += y4 + (yearHas(yl, 3) ? 0.25 : 0);
    lines.push(y4 ? "올해는 인성이 들어와 시험, 자격증, 새 공부를 시작하기 좋은 흐름이에요." : "올해는 새 공부를 크게 벌이기보다 하던 공부를 마무리하는 데 힘을 쓰면 좋아요.");
    const basis = `원국 인성 ${g[4]}·식상 ${g[1]}·관성 ${g[3]}개, ${ylText(yl)}`;
    return { key: "study", name: "학업운", stars: clampStar(s), lines, basis };
  }
  function health(res, yl) {
    const e = res.elements;
    const missing = e.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
    const many = e.map((v, i) => (v >= 3 ? i : -1)).filter((i) => i >= 0);
    let s = 4 - 0.5 * missing.length - 0.5 * many.length;
    const lines = [];
    if (!missing.length && !many.length) lines.push("오행이 고르게 퍼져 있어 생활 리듬이 크게 무너지지 않는 편이에요. 지금의 습관을 유지하는 것이 가장 좋아요.");
    many.forEach((i) => lines.push(`${ELEM_WORD[i]} 기운이 ${e[i]}개로 많은 편이에요. 한쪽으로 쏠리기 쉬우니 ${ELEM_HABIT[i]}에 신경 써 보세요.`));
    missing.forEach((i) => lines.push(`${ELEM_WORD[i]} 기운이 드러나 있지 않아요. ${ELEM_HABIT[i]} 같은 생활 습관으로 그 기운을 보완해 보세요.`));
    const ye = [S().stemEl(yl.s), S().BR_EL[yl.b]];
    if (ye.some((x) => many.includes(x))) { s -= 0.5; lines.push(`올해 세운 ${yl.name}이 이미 많은 기운을 더해 주니 무리한 일정은 줄이고 쉬는 날을 미리 정해 두세요.`); }
    if (ye.some((x) => missing.includes(x))) { s += 0.5; lines.push(`올해 세운 ${yl.name}이 부족한 기운을 채워 주는 흐름이에요. 새 운동이나 생활 습관을 시작하기 좋아요.`); }
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
      "비겁이 두드러져 친구와 동료가 힘이 되는 사람이에요. 함께하면 든든하지만 경쟁심이 생길 때는 한발 물러서는 여유가 관계를 지켜 줘요.",
      "식상이 두드러져 말과 표현으로 사람을 끌어당기는 편이에요. 분위기를 살리는 힘이 큰 만큼 농담이 지나치지 않게 한 번 더 살펴보세요.",
      "재성이 두드러져 실리와 약속을 중요하게 여기는 관계를 맺는 편이에요. 계산보다 마음을 먼저 보여 주면 더 깊은 사이가 되기 쉬워요.",
      "관성이 두드러져 예의와 규칙을 지키는 믿음직한 사람으로 보이기 쉬워요. 가끔은 격식을 내려놓고 편하게 다가가 보세요.",
      "인성이 두드러져 윗사람이나 선배의 도움을 받기 쉬운 편이에요. 받은 도움을 작게라도 표현하면 인연이 오래가요.",
    ];
    lines.push(T[top]);
    if (good) lines.push(`원국에 합이 ${good}개 있어 사람을 모으고 이어 주는 힘이 있어요.`);
    if (bad) lines.push(`원국에 충이 ${bad}개 있어 의견 충돌을 겪으며 관계가 단단해지는 편이에요. 감정이 올라올 때는 결론을 하루 미루세요.`);
    const yHe = yl.rel.filter((r) => r.kind === "합").length, yCh = yl.rel.filter((r) => r.kind === "충").length;
    s += yHe * 0.5 - yCh * 0.5 + (yearHas(yl, 0) ? 0.25 : 0);
    if (yHe) lines.push("올해는 세운이 원국과 합을 이뤄 새로운 사람과 연결되기 쉬운 해예요.");
    if (yCh) lines.push("올해는 세운이 원국과 충을 이뤄 오래된 관계가 정리되거나 달라지기 쉬워요. 소중한 사람에게는 먼저 연락하세요.");
    if (!yHe && !yCh) lines.push("올해 관계의 흐름은 잔잔한 편이에요. 오래 못 본 사람에게 안부를 전하기 좋아요.");
    const basis = `가장 두드러진 십신 ${GROUP[top]}(${g[top]}개), 원국 합 ${good}·충 ${bad}, 세운과 원국의 합 ${yHe}·충 ${yCh}`;
    return { key: "people", name: "인간관계운", stars: clampStar(s), lines, basis };
  }
  function yearText(res, yl) {
    const st = res.strength, sg = yl.stemGod.group, bg = yl.brGod.group;
    const lines = [YEAR_THEME[sg]];
    if (bg !== sg) lines.push(`하반기로 갈수록 ${GROUP[bg]}의 기운도 함께 느껴질 수 있어요. ${YEAR_THEME[bg].split(".")[0]}.`);
    const helps = (x) => x === 0 || x === 4;
    let s = 3;
    if (st.strong && !helps(sg)) { s += 1; lines.push("일간의 힘이 있는 편이라 올해 들어오는 기운을 적극적으로 쓰기 좋아요. 미뤄 둔 일을 시작해 보세요."); }
    else if (!st.strong && helps(sg)) { s += 1; lines.push("일간의 힘이 약한 편인데 올해는 나를 돕는 기운이 들어와 든든한 해예요. 도움을 청하면 잘 받아들여지기 쉬워요."); }
    else if (st.strong && helps(sg)) lines.push("이미 힘이 있는 일간에 돕는 기운이 더해져 고집이 세지기 쉬워요. 다른 사람의 의견을 한 번 더 들어 보세요.");
    else { s -= 0.5; lines.push("일간의 힘이 약한 편인데 올해는 힘을 쓰게 하는 기운이 들어와요. 일을 벌이기보다 하나씩 끝내는 속도 조절이 중요해요."); }
    yl.rel.forEach((r) => { s += r.kind === "합" ? 0.5 : -0.5; lines.push(r.kind === "합" ? `${r.text}: 그 자리와 관련된 일이 부드럽게 이어지기 쉬워요.` : `${r.text}: 그 자리와 관련된 일에 변화가 생기기 쉬워요. 변화는 준비한 만큼 기회가 돼요.`); });
    if (yl.daeun) lines.push(`지금은 ${yl.daeun.name} 대운(${DAEUN_THEME[yl.daeun.stemGroup]}의 10년)을 지나고 있어요.`);
    const basis = `${ylText(yl)}, 일간 ${st.label}(${st.score}점), ${dwText(yl)}${yl.rel.length ? ", " + yl.rel.map((r) => r.text).join(", ") : ""}`;
    return { stars: clampStar(s), lines, basis };
  }

  function read(res, year) {
    const yl = S().yearLuck(res, year);
    const dm = DAY_MASTER[res.pillars[2].s];
    const st = res.strength;
    const strengthText = st.score >= 65 ? "일간을 돕는 기운이 많아 주관이 뚜렷하고 스스로 밀고 나가는 힘이 강한 편이에요. 힘을 나눠 쓸 곳(일, 표현, 봉사)을 찾으면 균형이 잡혀요."
      : st.score >= 50 ? "돕는 기운과 쓰는 기운이 비슷한데 조금 강한 쪽이에요. 하고 싶은 일을 밀고 나갈 힘이 있어요."
      : st.score >= 35 ? "돕는 기운과 쓰는 기운이 비슷한데 조금 약한 쪽이에요. 혼자보다 믿을 만한 사람과 함께할 때 더 잘 풀려요."
      : "일간을 돕는 기운이 적어 주변 환경의 영향을 많이 받는 편이에요. 배움과 좋은 사람을 곁에 두면 힘이 붙어요.";
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
