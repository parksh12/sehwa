"use strict";
/* 지뢰찾기 규칙 (P2-60) — 화면(mines.js)과 자동 시험(scripts/mines-test.mjs, build.mjs 검사)이 같은 파일을 씀. DOM 없음.
   칸 번호 i = y * w + x. st: 0 닫힘, 1 열림, 2 깃발. over: 0 진행, 1 승리, -1 패배
   - 지뢰는 첫 「열기」 때 깔림: 첫 칸과 주변 8칸에는 지뢰가 없음(지뢰 수는 가로×세로−9 이하로 제한)
   - 빈 칸(주변 지뢰 0)은 이어진 칸을 자동으로 펼침(깃발 칸은 건너뜀)
   - 코드: 열린 숫자 칸의 주변 깃발 수가 숫자와 같으면 깃발 아닌 닫힌 칸을 한 번에 엶
   - 깃발 칸은 「열기」로 열리지 않음(실수 방지) */
(function (root) {
  const LEVELS = {
    beginner: { name: "초급", w: 9, h: 9, n: 10 },
    intermediate: { name: "중급", w: 16, h: 16, n: 40 },
    expert: { name: "고급", w: 30, h: 16, n: 99 },
  };
  const LIMIT = { min: 5, max: 30 };
  const maxMines = (w, h) => w * h - 9;

  function create(w, h, n) {
    w = Math.max(LIMIT.min, Math.min(LIMIT.max, w | 0));
    h = Math.max(LIMIT.min, Math.min(LIMIT.max, h | 0));
    n = Math.max(1, Math.min(maxMines(w, h), n | 0));
    const size = w * h;
    return { w, h, n, size, mine: new Uint8Array(size), adj: new Uint8Array(size), st: new Uint8Array(size), laid: false, opened: 0, flags: 0, over: 0, boom: -1 };
  }

  function neighbors(b, i) {
    const x = i % b.w, y = (i - x) / b.w, out = [];
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= b.h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        if ((dx || dy) && xx >= 0 && xx < b.w) out.push(yy * b.w + xx);
      }
    }
    return out;
  }

  // 지뢰 깔기: safe 칸과 그 주변을 뺀 후보 칸에서 n개를 고름(부분 피셔-예이츠). rng() ∈ [0, 1)
  function layMines(b, safe, rng) {
    const ban = new Uint8Array(b.size);
    ban[safe] = 1;
    for (const j of neighbors(b, safe)) ban[j] = 1;
    const pool = [];
    for (let i = 0; i < b.size; i++) if (!ban[i]) pool.push(i);
    for (let k = 0; k < b.n; k++) {
      const r = k + Math.floor(rng() * (pool.length - k));
      const t = pool[k]; pool[k] = pool[r]; pool[r] = t;
      b.mine[pool[k]] = 1;
    }
    for (let i = 0; i < b.size; i++) {
      let c = 0;
      for (const j of neighbors(b, i)) c += b.mine[j];
      b.adj[i] = c;
    }
    b.laid = true;
    return b;
  }

  const won = (b) => b.opened === b.size - b.n;

  // 한 칸 열기(빈 칸이면 자동 펼침). 바뀐 칸 번호 배열을 돌려줌
  function open(b, i, rng) {
    if (b.over || b.st[i] !== 0) return [];
    if (!b.laid) layMines(b, i, rng || Math.random);
    if (b.mine[i]) { b.st[i] = 1; b.boom = i; b.over = -1; return [i]; }
    const changed = [], queue = [i];
    b.st[i] = 1; b.opened++; changed.push(i);
    while (queue.length) {
      const c = queue.pop();
      if (b.adj[c]) continue;
      for (const j of neighbors(b, c)) {
        if (b.st[j] !== 0 || b.mine[j]) continue;
        b.st[j] = 1; b.opened++; changed.push(j);
        queue.push(j);
      }
    }
    if (won(b)) finishWin(b);
    return changed;
  }

  // 이기면 남은 지뢰에 깃발을 모두 꽂음
  function finishWin(b) {
    b.over = 1;
    for (let i = 0; i < b.size; i++) if (b.mine[i] && b.st[i] !== 2) { b.st[i] = 2; b.flags++; }
  }

  function toggleFlag(b, i) {
    if (b.over || b.st[i] === 1) return false;
    if (b.st[i] === 2) { b.st[i] = 0; b.flags--; } else { b.st[i] = 2; b.flags++; }
    return true;
  }

  // 코드(숫자 칸 동시 열기). 조건이 안 맞으면 [] (아무 일도 없음)
  function chord(b, i) {
    if (b.over || b.st[i] !== 1 || !b.adj[i] || b.mine[i]) return [];
    const nb = neighbors(b, i);
    let f = 0;
    for (const j of nb) if (b.st[j] === 2) f++;
    if (f !== b.adj[i]) return [];
    let changed = [];
    for (const j of nb) {
      if (b.st[j] !== 0) continue;
      if (b.mine[j]) { b.st[j] = 1; b.boom = j; b.over = -1; changed.push(j); break; }
      changed = changed.concat(open(b, j));
      if (b.over) break;
    }
    return changed;
  }

  // 화면 크기에 맞춘 배치: 세로 화면에서 가로가 긴 판은 가로·세로를 바꿔 세로로 길게(지뢰는 무작위라 같은 난이도)
  function orient(w, h, portrait) { return portrait && w > h ? { w: h, h: w } : { w, h }; }

  const api = { LEVELS, LIMIT, maxMines, create, neighbors, layMines, open, toggleFlag, chord, orient, won };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MinesCore = api;
})(typeof self !== "undefined" ? self : this);
