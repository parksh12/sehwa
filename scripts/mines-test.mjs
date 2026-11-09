// P2-60 지뢰찾기 규칙 자동 시험 — 사용: node scripts/mines-test.mjs   (실패하면 종료 코드 1)
// src/assets/mines-core.js(화면이 쓰는 바로 그 파일)를 불러 시험함. build.mjs도 이 파일의 run()을 불러 빌드 때마다 돌림
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// 시드가 있는 난수(mulberry32) — 실패하면 같은 판을 다시 만들 수 있게
function rngOf(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function run(M = require(path.join(HERE, "..", "src", "assets", "mines-core.js")), { games = 1000 } = {}) {
  const fails = [], counts = {};
  const ok = (name, cond, info = "") => { counts[name] = (counts[name] || 0) + 1; if (!cond && fails.length < 20) fails.push(`${name}${info ? ` (${info})` : ""}`); };
  const fixed = (w, h, mines) => { // 지뢰 위치를 직접 정한 판
    const b = M.create(w, h, mines.length);
    for (const i of mines) b.mine[i] = 1;
    for (let i = 0; i < b.size; i++) b.adj[i] = M.neighbors(b, i).reduce((c, j) => c + b.mine[j], 0);
    b.laid = true;
    return b;
  };
  const at = (b, x, y) => y * b.w + x;
  // 기대값을 따로 계산하는 참조 구현(재귀 대신 집합으로): 0칸에서 이어진 칸 + 그 경계 숫자 칸, 깃발 칸 제외
  const refFlood = (b, s) => {
    const seen = new Set([s]), st = [s];
    while (st.length) { const c = st.pop(); if (b.adj[c]) continue; for (const j of M.neighbors(b, c)) if (!seen.has(j) && !b.mine[j] && b.st[j] !== 2) { seen.add(j); st.push(j); } }
    return seen;
  };

  // 1) 첫 클릭 안전 + 지뢰 수 정확 — 난이도 3종 + 사용자 지정(최대 지뢰 포함), 모서리·가장자리·가운데 첫 칸
  const presets = Object.values(M.LEVELS);
  for (let g = 0; g < games; g++) {
    const rng = rngOf(1000 + g);
    let w, h, n;
    if (g % 4 < 3) ({ w, h, n } = presets[g % 4]);
    else { w = 5 + Math.floor(rng() * 26); h = 5 + Math.floor(rng() * 26); n = g % 8 === 3 ? M.maxMines(w, h) : 1 + Math.floor(rng() * M.maxMines(w, h)); }
    const portrait = g % 2 === 1;
    ({ w, h } = M.orient(w, h, portrait));
    const b = M.create(w, h, n);
    const corners = [0, w - 1, (h - 1) * w, w * h - 1];
    const first = g % 5 === 0 ? corners[g % 4] : Math.floor(rng() * b.size);
    const changed = M.open(b, first, rng);
    const total = b.mine.reduce((a, c) => a + c, 0);
    ok("첫 클릭 안전(첫 칸)", !b.mine[first] && b.over !== -1, `seed ${1000 + g}`);
    ok("첫 클릭 안전(주변 8칸)", M.neighbors(b, first).every((j) => !b.mine[j]), `seed ${1000 + g}`);
    ok("첫 클릭은 빈 칸이라 자동으로 펼쳐짐", b.adj[first] === 0 && changed.length >= 1 + M.neighbors(b, first).length, `seed ${1000 + g}`);
    ok("지뢰 수 정확", total === n && b.n === n, `${w}x${h} 요청 ${n}, 실제 ${total}`);
    ok("숫자 = 주변 지뢰 수", Array.from(b.adj).every((v, i) => v === M.neighbors(b, i).reduce((c, j) => c + b.mine[j], 0)));
    if (b.over === 1) continue; // 첫 클릭에 다 열리는 판(지뢰가 적을 때)
    // 남은 안전 칸을 무작위 순서로 열면 반드시 이기고, 지뢰에는 깃발이 다 꽂힘
    const safe = []; for (let i = 0; i < b.size; i++) if (!b.mine[i] && b.st[i] === 0) safe.push(i);
    for (let k = safe.length - 1; k > 0; k--) { const r = Math.floor(rng() * (k + 1)); [safe[k], safe[r]] = [safe[r], safe[k]]; }
    for (const i of safe) { M.open(b, i); if (b.over) break; }
    ok("안전 칸을 다 열면 승리", b.over === 1 && b.opened === b.size - n, `seed ${1000 + g}`);
    ok("승리하면 지뢰마다 깃발", Array.from(b.mine).every((m, i) => !m || b.st[i] === 2) && b.flags === n);
  }

  // 2) 사용자 지정 범위 제한: 지뢰 수는 1 ~ 가로×세로−9, 가로·세로 5~30
  { const b = M.create(5, 5, 999); ok("사용자 지정 지뢰 상한(가로×세로−9)", b.n === 16); }
  { const b = M.create(2, 99, 0); ok("사용자 지정 크기·지뢰 하한", b.w === 5 && b.h === 30 && b.n === 1); }
  { const b = M.create(5, 5, 16); M.open(b, 0, rngOf(7)); ok("지뢰가 가장 많은 판에서도 첫 칸 안전", !b.mine[0] && b.mine.reduce((a, c) => a + c, 0) === 16); }

  // 3) 자동 펼침 — 고정 판. 지뢰 (6,0) (6,1) (0,6) 와 깃발 (3,3)
  {
    const b = fixed(8, 8, [6, 14, 48]);
    M.toggleFlag(b, at(b, 3, 3));
    const ch = M.open(b, at(b, 0, 0));
    const want = refFlood(b, at(b, 0, 0));
    ok("자동 펼침: 참조 구현과 같은 칸", ch.length === want.size && ch.every((i) => want.has(i)), `${ch.length} vs ${want.size}`);
    ok("자동 펼침: 숫자 칸에서 멈춤", b.st[at(b, 5, 0)] === 1 && b.adj[at(b, 5, 0)] > 0 && b.st[at(b, 6, 0)] === 0);
    ok("자동 펼침: 깃발 칸은 열지 않음", b.st[at(b, 3, 3)] === 2);
    ok("자동 펼침: 지뢰는 안 열림", !ch.some((i) => b.mine[i]) && b.over === 0);
  }
  { // 숫자 칸을 열면 그 칸만 열림
    const b = fixed(5, 5, [12]);
    const ch = M.open(b, at(b, 1, 1));
    ok("숫자 칸은 한 칸만 열림", ch.length === 1 && b.adj[at(b, 1, 1)] === 1);
  }

  // 4) 코드(숫자 칸 동시 열기)
  {
    const b = fixed(5, 5, [0, 2]); // (0,0) (2,0)에 지뢰, (1,1)은 숫자 2
    const c = at(b, 1, 1);
    M.open(b, c);
    ok("코드 준비: 숫자 2", b.adj[c] === 2 && b.st[c] === 1);
    ok("코드: 깃발이 모자라면 아무 일 없음", M.chord(b, c).length === 0);
    M.toggleFlag(b, 0);
    ok("코드: 깃발 1개(숫자 2)면 아무 일 없음", M.chord(b, c).length === 0 && b.st[at(b, 1, 0)] === 0);
    M.toggleFlag(b, 2);
    const ch = M.chord(b, c);
    ok("코드: 깃발 수가 맞으면 나머지 주변 칸을 엶", [at(b, 1, 0), at(b, 0, 1), at(b, 2, 1), at(b, 0, 2), at(b, 1, 2), at(b, 2, 2)].every((i) => b.st[i] === 1) && ch.length > 0 && b.over !== -1);
    ok("코드: 깃발 칸은 그대로", b.st[0] === 2 && b.st[2] === 2);
    ok("코드로 마지막 칸을 열어도 승리 판정", b.over === 1, `opened ${b.opened}/${b.size - b.n}`);
  }
  {
    const b = fixed(5, 5, [0, 2]);
    const c = at(b, 1, 1);
    M.open(b, c);
    M.toggleFlag(b, 0); M.toggleFlag(b, at(b, 0, 1)); // 잘못 꽂은 깃발
    M.chord(b, c);
    ok("코드: 깃발을 잘못 꽂았으면 지뢰가 터져 패배", b.over === -1 && b.boom === 2);
  }
  { const b = fixed(5, 5, [0]); ok("코드: 닫힌 칸·빈 칸에는 동작 안 함", M.chord(b, 24).length === 0); M.open(b, 24); ok("코드: 0칸에는 동작 안 함", M.chord(b, 24).length === 0); }

  // 5) 깃발 보호·패배·승리 판정
  {
    const b = fixed(5, 5, [12, 13]);
    M.toggleFlag(b, 12);
    ok("깃발 칸은 열리지 않음", M.open(b, 12).length === 0 && b.st[12] === 2 && b.over === 0);
    ok("열린 칸에는 깃발 안 꽂힘", (M.open(b, 6), b.st[6] === 1 && !M.toggleFlag(b, 6)));
    M.toggleFlag(b, 12);
    M.open(b, 12);
    ok("지뢰를 열면 패배·터진 칸 표시", b.over === -1 && b.boom === 12);
    ok("끝난 판은 더 열리지 않음", M.open(b, 0).length === 0 && M.toggleFlag(b, 0) === false);
  }
  {
    const b = fixed(5, 5, [24]);
    M.open(b, 0);
    ok("마지막 안전 칸을 열면 승리(깃발 없이도)", b.over === 1 && b.st[24] === 2 && b.flags === 1);
  }
  {
    const b = fixed(5, 5, [6, 18]);
    for (let i = 0; i < 25; i++) if (i !== 6 && i !== 18 && i !== 24) M.open(b, i);
    ok("안전 칸이 하나라도 남으면 진행 중", b.over === 0);
    M.open(b, 24);
    ok("모두 열면 승리", b.over === 1);
  }
  // 6) 세로 배치: 고급 30×16 → 세로 화면에서 16×30
  { const o = M.orient(30, 16, true), d = M.orient(30, 16, false), s = M.orient(9, 9, true); ok("고급판 세로 배치", o.w === 16 && o.h === 30 && d.w === 30 && s.w === 9); }

  return { fails, counts, games };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const t0 = Date.now();
  const { fails, counts, games } = run();
  for (const [k, v] of Object.entries(counts)) console.log(`${fails.some((f) => f.startsWith(k)) ? "✘" : "✔"} ${k} — ${v}회`);
  console.log(`판 ${games}개, ${Date.now() - t0}ms`);
  if (fails.length) { console.error("실패:\n  " + fails.join("\n  ")); process.exit(1); }
  console.log("모두 통과");
}
