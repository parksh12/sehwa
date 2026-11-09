// P2-57 읽기 시간 계산기 계산식 한 벌. 화면(t-readtime.js)과 빌드의 손계산 대조(build.mjs, vm)가 같은 파일을 씀.
// 입력한 글은 저장하거나 전송하지 않음.
// 기준값(분당 속도)은 DEFAULTS에 모으고 화면에서 바꿀 수 있음. 출처·가정은 페이지 본문에 표기
(function (root) {
  // 한글은 분당 글자(음절) 수, 영문은 분당 단어 수
  // enRead 238·enSpeak 183: Brysbaert (2019) 영어 성인 묵독(논픽션) 238 wpm, 소리 내어 읽기 183 wpm 메타분석
  // koRead 500·koSpeak 300: (가정) 공식 기준이 없어 흔히 쓰는 어림값. 사용자가 조절
  const DEFAULTS = { koRead: 500, enRead: 238, koSpeak: 300, enSpeak: 183, longLen: 60, topN: 10 };
  const seg = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("ko", { granularity: "grapheme" }) : null;
  const g = (s) => (seg ? [...seg.segment(s)].length : [...s].length);
  const KO = /[가-힣ㄱ-ㆎ一-鿿㐀-䶿぀-ヿ]/g; // 한글·자모·한자·가나 = 「글자」로 셈
  const WORD = /[A-Za-zÀ-ɏ]+(?:['’-][A-Za-zÀ-ɏ]+)*|\d+(?:[.,]\d+)*/g; // 영문 단어·숫자 = 「단어」로 셈

  // ---- 빈출 키워드: 조사는 간단한 규칙으로 떼고 불용어는 뺌 ----
  // 늘 떼는 조사(뗀 뒤 2글자 이상 남을 때만)
  const JOSA = ["에서는", "에게는", "으로는", "으로도", "에서도", "까지는", "부터는", "이라는", "이라고", "에서", "에게", "께서", "한테", "까지", "부터", "보다", "처럼", "만큼", "으로", "라는", "라고", "에는", "에도", "와는", "과는", "을", "를"];
  // 낱말 끝 글자와 헷갈리는 조사(고양이·사이·기도): 뗀 말이 글 안 다른 곳에도 나올 때만 뗌
  const JOSA_AMBI = ["은", "는", "이", "가", "도", "의", "와", "과", "로", "에", "만", "랑"];
  // 두 글자 낱말 + 을·를(글을·책을)은 한 글자 명사라 키워드에서 빠짐. 가을·마을처럼 원래 을로 끝나는 낱말만 남김
  const KEEP2 = new Set(["가을", "마을", "노을", "고을"]);
  // 서술어 꼴(합니다·했어요 등)은 키워드에서 뺌
  const VERB_END = /(?:니다|세요|어요|아요|에요|예요|해요|었다|았다|했다|한다|된다|하는|되는|있는|없는|하고|하여|해서|하게|하면|지만|는데|면서|어서|아서|으며|었고|았고|겠다)$/;
  const STOP = new Set(("그리고 그러나 하지만 그래서 그런데 그러면 또한 또는 혹은 및 등 등등 것 수 때 중 위해 위한 통해 통한 대한 대해 관한 관련 이런 그런 저런 이번 다른 같은 모든 어떤 무슨 우리 저희 너무 정말 아주 매우 가장 많이 조금 이제 지금 오늘 바로 다시 함께 같이 그냥 만약 경우 때문 내어 보여 주고 보고 이것 그것 저것 여기 거기 저기 이후 이전 정도 하나 있다 없다 하다 되다 이다 같다 " +
    "the a an and or but of to in on at for with by from as is are was were be been being it its this that these those you he she we they my your our their me him her us them not no so if then than there here what which who whom when where why how all any some can could will would should may might must do does did have has had just also very more most such into about over after before up out").split(" "));

  function stem(w, known) {
    if (w.length === 2 && /[을를]$/.test(w) && !KEEP2.has(w)) return w[0];
    for (const j of JOSA) if (w.length - j.length >= 2 && w.endsWith(j)) return w.slice(0, -j.length);
    for (const j of JOSA_AMBI) if (w.length - j.length >= 2 && w.endsWith(j) && known.has(w.slice(0, -j.length))) return w.slice(0, -j.length);
    return w;
  }
  function keywords(text, topN) {
    const toks = (text.match(/[가-힣]+|[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).map((w) => (/[A-Za-z]/.test(w) ? w.toLowerCase() : w));
    // 확인용 집합: 낱말 그대로 + 늘 떼는 조사를 뗀 말
    const known = new Set();
    for (const w of toks) { known.add(w); for (const j of JOSA) if (w.length - j.length >= 2 && w.endsWith(j)) { known.add(w.slice(0, -j.length)); break; } }
    const cnt = new Map();
    for (const w of toks) {
      const ko = /[가-힣]/.test(w);
      if (ko && VERB_END.test(w)) continue;
      const k = ko ? stem(w, known) : w;
      if (ko && k === w && /[은는]$/.test(w)) continue; // 은·는으로 끝나는데 같은 말이 다른 꼴로 안 나오면 「걸리는·작은」 같은 꾸미는 말로 보고 뺌
      if (k.length < 2 || STOP.has(k)) continue;
      cnt.set(k, (cnt.get(k) || 0) + 1);
    }
    return [...cnt.entries()].filter((x) => x[1] >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko")).slice(0, topN);
  }

  // ---- 문장: 줄을 나눈 뒤, 마침표·물음표·느낌표(닫는 따옴표 포함) 다음 공백에서 나눔. 3.14처럼 공백이 없으면 나누지 않음 ----
  function sentences(text) {
    return text.split("\n").flatMap((l) => l.split(/(?<=[.?!。？！…](?:["'”’)\]」』])*)\s+/)).map((x) => x.trim()).filter(Boolean);
  }

  // ---- 200자 원고지 ----
  // A: 공백 포함 글자 ÷ 200 (줄바꿈은 세지 않음) / B: 공백 제외 ÷ 200
  // C: 칸 채우기 근사 — 줄(문단)마다 첫 칸 들여쓰기 1칸, 모든 글자·띄어쓰기·문장부호 1칸, 문단이 끝나면 그 줄의 남은 칸은 비움, 20칸 × 10줄 = 1매
  function manuscript(text) {
    const paras = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const withSpace = paras.reduce((n, p) => n + g(p), 0);
    const noSpace = g(text.replace(/\s+/g, ""));
    const gridLines = paras.reduce((n, p) => n + Math.ceil((g(p) + 1) / 20), 0);
    return { withSpace: withSpace / 200, noSpace: noSpace / 200, gridLines, grid: gridLines / 10 };
  }

  function analyze(input, opt) {
    const o = Object.assign({}, DEFAULTS, opt || {});
    const text = String(input == null ? "" : input).replace(/\r\n?/g, "\n");
    const ko = (text.match(KO) || []).length;
    const words = (text.match(WORD) || []).length;
    const sents = sentences(text);
    const lens = sents.map(g);
    const paras = text.split(/\n\s*\n/).filter((p) => p.trim()).length;
    const readMin = (o.koRead > 0 ? ko / o.koRead : 0) + (o.enRead > 0 ? words / o.enRead : 0);
    const speakMin = (o.koSpeak > 0 ? ko / o.koSpeak : 0) + (o.enSpeak > 0 ? words / o.enSpeak : 0);
    const long = sents.map((s, i) => ({ i: i + 1, len: lens[i], text: s })).filter((x) => x.len >= o.longLen);
    return {
      chars: g(text), noSpace: g(text.replace(/\s+/g, "")), ko, words,
      readMin, speakMin,
      sentences: sents.length, paragraphs: paras, lines: text ? text.split("\n").filter((l) => l.trim()).length : 0,
      avgSentence: sents.length ? lens.reduce((a, b) => a + b, 0) / sents.length : 0,
      maxSentence: lens.length ? Math.max(...lens) : 0,
      long, ms: manuscript(text), keywords: keywords(text, o.topN),
    };
  }
  // 「약 2분 30초」 꼴. 1분 미만은 초만, 0이면 0초
  function fmtTime(min) {
    const sec = Math.round(min * 60);
    if (sec < 60) return `${sec}초`;
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return `${h ? `${h}시간 ` : ""}${m ? `${m}분` : ""}${s ? ` ${s}초` : ""}`.trim();
  }
  root.READCALC = { analyze, fmtTime, DEFAULTS, sentences, manuscript, keywords };
})(typeof window !== "undefined" ? window : globalThis);
