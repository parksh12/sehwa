// P2-68 인스타 폰트 변환기 변환식 한 벌. 화면(t-instafont.js)과 빌드 검사(build.mjs, vm)가 같은 파일을 씀.
// 글꼴을 바꾸는 것이 아니라 영문·숫자를 유니코드의 다른 문자로 바꿈. 표: Unicode 「Mathematical Alphanumeric Symbols」(U+1D400~),
// 비어 있는 자리는 「Letterlike Symbols」(ℎ ℬ ℂ 등), 동그라미·네모는 「Enclosed Alphanumerics」(U+2460~)·「Enclosed Alphanumeric Supplement」(U+1F100~), 전각은 U+FF01~
// 한글은 대응 문자가 없어 그대로 두고, 결합 문자(취소선·밑줄)와 괄호·기호 꾸밈은 한글에도 붙음
(function (root) {
  const cp = String.fromCodePoint;
  const L = { A: 65, a: 97, "0": 48 };
  // up/lo: 대·소문자 A·a 자리, d: 숫자 0 자리, ex: 표에서 비어 있어 다른 블록 문자를 쓰는 자리
  const STYLES = [
    { id: "bold", name: "굵게", en: "Bold", up: 0x1d400, lo: 0x1d41a, d: 0x1d7ce },
    { id: "italic", name: "기울임", en: "Italic", up: 0x1d434, lo: 0x1d44e, ex: { h: 0x210e } },
    { id: "bolditalic", name: "굵은 기울임", en: "Bold Italic", up: 0x1d468, lo: 0x1d482 },
    { id: "script", name: "필기체", en: "Script", up: 0x1d49c, lo: 0x1d4b6, ex: { B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211b, e: 0x212f, g: 0x210a, o: 0x2134 } },
    { id: "boldscript", name: "굵은 필기체", en: "Bold Script", up: 0x1d4d0, lo: 0x1d4ea },
    { id: "fraktur", name: "고딕(독일 옛글씨)", en: "Fraktur", up: 0x1d504, lo: 0x1d51e, ex: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 } },
    { id: "boldfraktur", name: "굵은 고딕", en: "Bold Fraktur", up: 0x1d56c, lo: 0x1d586 },
    { id: "double", name: "이중선", en: "Double-struck", up: 0x1d538, lo: 0x1d552, d: 0x1d7d8, ex: { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 } },
    { id: "sans", name: "산세리프", en: "Sans", up: 0x1d5a0, lo: 0x1d5ba, d: 0x1d7e2 },
    { id: "sansbold", name: "산세리프 굵게", en: "Sans Bold", up: 0x1d5d4, lo: 0x1d5ee, d: 0x1d7ec },
    { id: "sansitalic", name: "산세리프 기울임", en: "Sans Italic", up: 0x1d608, lo: 0x1d622 },
    { id: "sansbolditalic", name: "산세리프 굵은 기울임", en: "Sans Bold Italic", up: 0x1d63c, lo: 0x1d656 },
    { id: "mono", name: "타자기(고정폭)", en: "Monospace", up: 0x1d670, lo: 0x1d68a, d: 0x1d7f6 },
    { id: "circle", name: "동그라미", en: "Circled", up: 0x24b6, lo: 0x24d0, dig: (n) => (n === 0 ? 0x24ea : 0x2460 + n - 1) },
    { id: "circleblack", name: "검은 동그라미", en: "Negative Circled", up: 0x1f150, lo: "up", dig: (n) => (n === 0 ? 0x24ff : 0x2776 + n - 1) },
    { id: "square", name: "네모", en: "Squared", up: 0x1f130, lo: "up" },
    { id: "squareblack", name: "검은 네모", en: "Negative Squared", up: 0x1f170, lo: "up" },
    { id: "paren", name: "괄호", en: "Parenthesized", up: "lo", lo: 0x249c, dig: (n) => (n === 0 ? null : 0x2474 + n - 1) },
    { id: "full", name: "전각(넓게)", en: "Fullwidth", up: 0xff21, lo: 0xff41, d: 0xff10 },
    { id: "smallcaps", name: "작은 대문자", en: "Small Caps", map: "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ" },
    { id: "strike", name: "취소선", en: "Strikethrough", comb: 0x0336 },
    { id: "under", name: "밑줄", en: "Underline", comb: 0x0332 },
    { id: "dunder", name: "이중 밑줄", en: "Double Underline", comb: 0x0333 },
    { id: "slash", name: "빗금", en: "Slash", comb: 0x0338 },
  ];
  const byId = Object.fromEntries(STYLES.map((s) => [s.id, s]));
  function mapChar(s, ch) {
    const c = ch.codePointAt(0);
    if (s.map) {
      if (c >= 65 && c <= 90) return [...s.map][c - 65];
      if (c >= 97 && c <= 122) return [...s.map][c - 97];
      return ch;
    }
    if (c >= 65 && c <= 90) {
      if (s.ex && s.ex[ch]) return cp(s.ex[ch]);
      if (s.up === "lo") return cp(s.lo + c - 65);
      return cp(s.up + c - 65);
    }
    if (c >= 97 && c <= 122) {
      if (s.ex && s.ex[ch]) return cp(s.ex[ch]);
      if (s.lo === "up") return cp(s.up + c - 97);
      return cp(s.lo + c - 97);
    }
    if (c >= 48 && c <= 57) {
      if (s.dig) { const r = s.dig(c - 48); return r == null ? ch : cp(r); }
      if (s.d) return cp(s.d + c - 48);
    }
    return ch;
  }
  // 변환: 결합 문자 꾸밈은 공백·줄바꿈이 아닌 모든 글자(한글 포함) 뒤에 붙임. 그 밖은 영문·숫자만 바꿈
  function convert(id, text) {
    const s = byId[id];
    if (!s) return String(text || "");
    const t = String(text == null ? "" : text);
    if (s.comb) {
      const seg = typeof Intl !== "undefined" && Intl.Segmenter ? [...new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(t)].map((x) => x.segment) : [...t];
      return seg.map((g) => (/^\s$/.test(g) ? g : g + cp(s.comb))).join("");
    }
    let out = "";
    for (const ch of t) out += mapChar(s, ch);
    return out;
  }
  // 한글에도 쓰는 꾸밈: 앞뒤로 감싸기(wrap) / 글자 사이에 넣기(between)
  const WRAPS = [
    { id: "kbracket", name: "겹낫표", l: "『 ", r: " 』" },
    { id: "lens", name: "렌즈 괄호", l: "【 ", r: " 】" },
    { id: "white", name: "흰 렌즈 괄호", l: "〖 ", r: " 〗" },
    { id: "round", name: "둥근 괄호", l: "꒰ ", r: " ꒱" },
    { id: "wing", name: "하트 날개", l: "ʚ ", r: " ɞ" },
    { id: "heart", name: "하트", l: "♡ ", r: " ♡" },
    { id: "spark", name: "반짝", l: "✧ ", r: " ✧" },
    { id: "star", name: "작은 별", l: "⋆ ", r: " ⋆" },
    { id: "wave", name: "물결", l: "˗ˋˏ ", r: " ˎˊ˗" },
    { id: "dust", name: "별가루", l: "‧₊˚ ", r: " ˚₊‧" },
    { id: "flower", name: "꽃", l: "✿ ", r: " ✿" },
    { id: "moon", name: "달", l: "☾ ", r: " ☽" },
    { id: "quote", name: "따옴표", l: "❝ ", r: " ❞" },
    { id: "arrow", name: "화살표", l: "➤ ", r: "" },
  ];
  const BETWEEN = [
    { id: "spaced", name: "띄어 쓰기", sep: " " },
    { id: "dot", name: "가운뎃점", sep: "·" },
    { id: "hearts", name: "하트 사이", sep: "♡" },
    { id: "stars", name: "별 사이", sep: "⋆" },
  ];
  const wrap = (id, text) => { const w = WRAPS.find((x) => x.id === id); const t = String(text || "").trim(); return w && t ? `${w.l}${t}${w.r}` : t; };
  const between = (id, text) => {
    const b = BETWEEN.find((x) => x.id === id);
    const t = String(text || "").trim();
    if (!b || !t) return t;
    // 낱말 안 글자 사이에만 넣고 띄어쓰기는 남김(띄어 쓰기 모양은 낱말 사이를 세 칸으로)
    const gs = (w) => (typeof Intl !== "undefined" && Intl.Segmenter ? [...new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(w)].map((x) => x.segment) : [...w]);
    return t.split(/\s+/).map((w) => gs(w).join(b.sep)).join(b.sep === " " ? "   " : " ");
  };
  root.INSTAFONT = { STYLES, WRAPS, BETWEEN, convert, wrap, between };
})(typeof window !== "undefined" ? window : globalThis);
