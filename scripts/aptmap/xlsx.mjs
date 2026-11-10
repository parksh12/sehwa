// P2-63a 아주 작은 XLSX 읽기 (외부 패키지 없이). 첫 번째 시트를 2차원 배열(문자열)로 돌려준다.
// 지원: zip(stored/deflate), sharedStrings, inlineStr, 숫자 셀. 서식·수식·날짜 변환은 하지 않는다(역 데이터에 필요 없음).
import zlib from "node:zlib";

function unzip(buf) {
  // 끝의 End of Central Directory 찾기
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("XLSX(zip) 형식이 아닙니다");
  const n = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("zip 중앙 디렉터리 손상");
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nlen);
    const lnl = buf.readUInt16LE(local + 26), lxl = buf.readUInt16LE(local + 28);
    const data = buf.subarray(local + 30 + lnl + lxl, local + 30 + lnl + lxl + csize);
    files[name] = () => (method === 0 ? data : zlib.inflateRawSync(data));
    p += 46 + nlen + xlen + clen;
  }
  return files;
}

const unesc = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, "&");
const textOf = (xml) => { let s = ""; for (const m of xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) s += m[1]; return unesc(s); };
const colIdx = (ref) => { let c = 0; for (const ch of ref.replace(/\d+/g, "")) c = c * 26 + (ch.charCodeAt(0) - 64); return c - 1; };

export function readXlsx(buf) {
  const files = unzip(buf);
  const shared = [];
  if (files["xl/sharedStrings.xml"]) {
    const xml = files["xl/sharedStrings.xml"]().toString("utf8");
    for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textOf(m[1]));
  }
  const sheetName = Object.keys(files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort()[0];
  if (!sheetName) throw new Error("시트가 없습니다");
  const xml = files[sheetName]().toString("utf8");
  const rows = [];
  for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cm of rm[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1], body = cm[2] || "";
      const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1];
      const t = (attrs.match(/t="(\w+)"/) || [])[1];
      let v = "";
      if (t === "s") v = shared[+((body.match(/<v>([\s\S]*?)<\/v>/) || [])[1])] ?? "";
      else if (t === "inlineStr") v = textOf(body);
      else v = unesc((body.match(/<v>([\s\S]*?)<\/v>/) || [, ""])[1]);
      row[ref ? colIdx(ref) : row.length] = v;
    }
    rows.push(Array.from(row, (x) => (x == null ? "" : String(x).trim())));
  }
  return rows;
}
