// P2-22 사주 검증 스크립트 — 브라우저와 같은 계산 파일(src/assets/saju-*.js)을 Node에서 돌려 검증표와 대조합니다.
// 사용: node scripts/saju-verify.mjs            (불일치가 있으면 종료 코드 1)
//       node scripts/saju-verify.mjs --md 파일   (검증표를 마크다운으로 저장)
//       node scripts/saju-verify.mjs --tz        (Node ICU의 Asia/Seoul과 1900~1999년 30분 간격 전수 대조 추가)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifySaju } from "../content/saju.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const v = verifySaju(ROOT);
const S = v.S;
const lines = [];
lines.push(`| # | 입력(당시 시계) | 설정 | 시험 목적 | 정답 | 계산 결과 | 일치 | 정답 출처 |`);
lines.push(`|---|---|---|---|---|---|---|---|`);
for (const r of v.rows) {
  const set = [r.cal === "lunar" ? `음력${r.leap ? "(윤달)" : ""}` : "양력", r.seoul ? "서울 경도 보정" : "보정 안 함", `자시 ${r.jasi || "A"}`, r.gender === "f" ? "여" : r.gender === "m" ? "남" : ""].filter(Boolean).join(", ");
  const want = r.want + (r.daeun ? ` / 대운 ${r.daeun.forward ? "순행" : "역행"} ${r.daeun.num} ${r.daeun.first}` : "") + (r.status ? ` / ${r.status}` : "") + (r.solar ? ` / 양력 ${r.solar}` : "");
  const got = r.got + (r.dw ? ` / 대운 ${r.dw}` : "") + (r.gotStatus && r.gotStatus !== "ok" ? ` / ${r.gotStatus}` : "");
  lines.push(`| ${r.id} | ${r.in} | ${set} | ${r.why} | ${want} | ${got} | ${r.ok ? "O" : "**X**"} | ${r.src} |`);
}
const ok = v.rows.filter((r) => r.ok).length;
const summary = [
  `- 사례 ${v.rows.length}건 중 ${ok}건 일치, 불일치 ${v.rows.length - ok}건`,
  `- 절기 시각: KASI 달력자료 2021~2028년 24절기 ${v.kasi.n}개, 최대 차이 ${v.kasi.max.toFixed(1)}초(${v.kasi.worst}). 허용 ±60초`,
  `- 춘분·하지·추분·동지: USNO ${v.usno.years}개 연도 ${v.usno.n}개, 최대 차이 ${v.usno.max.toFixed(1)}초(${v.usno.worst}). 허용 ±60초`,
  `- 음력: KASI 음력 설날 151개 + 윤달 초하루 56개 = ${v.lunarN}건 양력일·일진 대조`,
  `- 지장간 12지(위키백과), 12운성 120칸(6tail lunar-javascript) 두 번째 출처 대조`,
  `- 해석: ${v.sweep}개 입력에서 같은 입력 → 같은 결과, 운세 6종·근거 존재, 금지 표현 0 (서로 다른 문장 ${v.uniqueTexts}개)`,
];
if (process.argv.includes("--tz")) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", timeZoneName: "longOffset" });
  const icu = (ms) => { const z = f.formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName").value; const m = z.match(/GMT([+-])(\d\d):(\d\d)(?::(\d\d))?/); return m ? (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +m[3] + (m[4] ? +m[4] / 60 : 0)) : 0; };
  let n = 0, bad = 0;
  for (let ms = Date.UTC(1900, 0, 1); ms < Date.UTC(2000, 0, 1); ms += 1800000) { n++; if (Math.abs(S.offsetAt(ms) - icu(ms)) > 0.01) bad++; }
  summary.push(`- 표준시·서머타임: Node ICU(tz ${process.versions.tz}) Asia/Seoul과 1900~1999년 30분 간격 ${n.toLocaleString()}개 시점 대조, 불일치 ${bad}`);
  if (bad) v.errors.push(`ICU 시간대 불일치 ${bad}건`);
}
console.log(lines.join("\n"));
console.log("\n" + summary.join("\n"));
const mi = process.argv.indexOf("--md");
if (mi > 0) {
  const file = process.argv[mi + 1];
  fs.writeFileSync(file, `# P2-22 사주 검증표\n\n- 생성: node scripts/saju-verify.mjs --tz --md (${new Date().toISOString().slice(0, 10)})\n- 계산 코드: 브라우저와 같은 src/assets/saju-calc.js. 빌드(node build.mjs)도 같은 대조를 돌려 하나라도 어긋나면 실패합니다.\n- 기본 설정: 보정 안 함 + 자시 A(23시 일주 변경). 입력 시각은 당시 벽시계 시각.\n\n## 요약\n${summary.join("\n")}\n\n## 사례\n${lines.join("\n")}\n`);
  console.log(`\n검증표 저장: ${file}`);
}
if (v.errors.length) { console.error("\n불일치:\n  " + v.errors.join("\n  ")); process.exit(1); }
