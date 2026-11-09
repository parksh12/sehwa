// P2-57 줄바꿈 제거 · 공백 정리 변환식 한 벌. 화면(t-linebreak.js)과 빌드의 전후 대조 표(build.mjs, vm)가 같은 파일을 씀.
// 입력한 글은 저장하거나 전송하지 않음.
// 순서: 줄바꿈 통일 → 보이지 않는 문자 제거 → 특수 공백(NBSP·전각 등) → 탭 → 줄 앞뒤 공백 → 연속 공백 → 줄 합치기(PDF 복구·한 줄) → 빈 줄 정리
(function (root) {
  // 보이지 않는 문자: 제로폭 공백·제로폭 비결합자·단어 결합자·BOM·소프트 하이픈·방향 제어 문자·몽골어 모음 구분자
  // 제로폭 결합자(U+200D)는 👨\u200D👩\u200D👧 같은 이모지를 묶는 문자라서 이모지 사이에 있을 때는 남김
  const INVIS = /[\u200B\u200C\u2060\uFEFF\u00AD\u180E\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
  const ZWJ_LOOSE = /(?<!\p{Extended_Pictographic}\uFE0F?)\u200D|\u200D(?!\p{Extended_Pictographic})/gu;
  // 특수 공백: NBSP, 전각 공백, en·em 공백 등 → 일반 공백 1칸
  const ODD_SP = /[\u00A0\u3000\u2000-\u200A\u202F\u205F\u1680]/g;
  // 문단이 끝났다고 보는 줄 끝: 마침표·물음표·느낌표·말줄임표·쌍점(뒤에 닫는 따옴표·괄호가 와도 됨)
  const END = /[.?!。？！…:：](?:["'”’」』)\]]*)$/;
  // 목록·번호로 시작하는 줄은 앞 줄과 붙이지 않음: • - * · ▶ ■ ① 1. 1) (1) 가. ㄱ.
  const BULLET = /^(?:[•◦‣∙·ㆍ\-*–—▶▷►▸■□◆◇●○◎※☞✔✓➤→]\s|[①-⓿❶-➓㈀-㉿]|\(?\d{1,3}[.)]\s|\(\d{1,3}\)|[가-하][.)]\s|[ㄱ-ㅎ][.)]\s|[A-Za-z][.)]\s)/;
  const HANGUL = /[가-힣]/;
  const LATIN_LOWER = /^[a-zà-ÿ]/;

  // 한 문단(빈 줄 없이 이어진 줄들)을 PDF 규칙으로 합침
  function joinPdf(lines, o) {
    const width = Math.max(...lines.map((l) => [...l].length));
    let out = lines[0];
    for (let i = 1; i < lines.length; i++) {
      const prev = lines[i - 1], cur = lines[i];
      const pLen = [...prev].length;
      // 문단 경계로 보고 줄바꿈을 남기는 경우 ①: 문장이 끝난 줄, 목록·번호로 시작하는 줄
      if (END.test(prev) || BULLET.test(cur)) { out += "\n" + cur; continue; }
      // 하이픈 줄바꿈: 영문 informa-|tion → information, 한글 데이터베이-|스 → 데이터베이스 (줄 끝 하이픈은 이어진다는 표시라서 짧은 줄 판정보다 먼저)
      const hy = o.hyphen !== false ? /([A-Za-zÀ-ÿ가-힣])[-‐]$/.exec(prev) : null;
      if (hy && ((/[a-zà-ÿ]$/i.test(hy[1]) && LATIN_LOWER.test(cur)) || (HANGUL.test(hy[1]) && HANGUL.test(cur[0])))) {
        out = out.slice(0, -1) + cur;
        continue;
      }
      // 문단 경계 ②: 다른 줄보다 눈에 띄게 짧은 줄(폭의 60% 미만) = 문단 끝 또는 제목(빈 줄 없는 PDF). 3줄 이상일 때만 폭을 잼
      if (lines.length >= 3 && o.shortLine !== false && pLen > 0 && pLen < width * 0.6) { out += "\n" + cur; continue; }
      // 한글끼리 이어질 때 띄어쓰기 없이 붙이기(글자 단위로 끊긴 PDF용 선택 옵션)
      if (o.krNoSpace && HANGUL.test(prev.slice(-1)) && HANGUL.test(cur[0])) { out += cur; continue; }
      out += " " + cur;
    }
    return out;
  }

  function clean(input, opt) {
    const o = Object.assign({ invisible: true, oddSpace: true, tabs: true, trim: true, collapse: true, blank: "one", join: "none", hyphen: true, krNoSpace: false, shortLine: true }, opt || {});
    let s = String(input == null ? "" : input).replace(/\r\n?|\u2028|\u2029|\u0085/g, "\n");
    if (o.invisible) s = s.replace(INVIS, "").replace(ZWJ_LOOSE, "");
    if (o.oddSpace) s = s.replace(ODD_SP, " ");
    if (o.tabs) s = s.replace(/\t/g, " ");
    if (o.trim) s = s.split("\n").map((l) => l.replace(/^[ \t]+|[ \t]+$/g, "")).join("\n");
    if (o.collapse) s = s.replace(/ {2,}/g, " ");

    if (o.join === "pdf") {
      // 빈 줄(공백만 있는 줄 포함)로 문단을 나눈 뒤 문단 안의 줄을 합침. 빈 줄 개수는 그대로 두고 아래 빈 줄 정리에 맡김
      const parts = s.split(/(\n[ \t]*\n(?:[ \t]*\n)*)/);
      s = parts.map((p, i) => (i % 2 ? p : p ? joinPdf(p.split("\n").map((l) => (o.trim ? l : l.replace(/[ \t]+$/, ""))), o) : p)).join("");
    } else if (o.join === "space") {
      s = s.replace(/[ \t]*\n+[ \t]*/g, " ");
    } else if (o.join === "remove") {
      s = s.replace(/\n+/g, "");
    }

    if (o.join === "none" || o.join === "pdf") {
      if (o.blank === "one") s = s.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n");
      else if (o.blank === "none") s = s.replace(/\n(?:[ \t]*\n)+/g, "\n");
    }
    if (o.collapse) s = s.replace(/ {2,}/g, " ");
    if (o.trim) s = s.split("\n").map((l) => l.replace(/^[ \t]+|[ \t]+$/g, "")).join("\n").replace(/^\n+|\n+$/g, "");
    return s;
  }

  // 전후 비교용 숫자: 글자(화면에 보이는 글자 기준), 공백 제외, 줄, 보이지 않는 문자 개수
  function stats(s) {
    s = String(s || "");
    const seg = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter("ko", { granularity: "grapheme" }) : null;
    const g = (x) => (seg ? [...seg.segment(x)].length : [...x].length);
    return {
      all: g(s.replace(/\r\n?/g, "\n")),
      noSpace: g(s.replace(/\s+/g, "")),
      lines: s ? s.split(/\r\n?|\n/).length : 0,
      invisible: (s.match(INVIS) || []).length,
    };
  }

  root.TEXTCLEAN = { clean, stats };
})(typeof window !== "undefined" ? window : globalThis);
