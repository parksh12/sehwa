// 펭귄 RPG 전투·성장 규칙(화면과 분리). 게임과 밸런스 시뮬레이터가 같은 코드를 씁니다.
(function () {
  const RPG = (window.RPG = window.RPG || {});
  const D = RPG.data;
  const { MEMBERS, SKILLS, ITEMS, ENEMIES, BEATS, EL_NAME } = D;

  // ---------- 성장 ----------
  const expTo = (lv) => Math.round(5 * lv * lv + 3 * lv); // lv → lv+1 에 필요한 경험치
  function newMember(id, lv = 1) {
    const m = { id, lv, exp: 0, hp: 1, mp: 1, eq: { w: id === "ppo" ? "ladle" : null, a: id === "ppo" ? "vest" : null, c: null }, extra: [] };
    const s = stats(m); m.hp = s.maxhp; m.mp = s.maxmp;
    return m;
  }
  function stats(m) {
    const b = MEMBERS[m.id], L = m.lv - 1;
    const s = { maxhp: Math.floor(b.base.hp + b.grow.hp * L), maxmp: Math.floor(b.base.mp + b.grow.mp * L), atk: Math.floor(b.base.atk + b.grow.atk * L), def: Math.floor(b.base.def + b.grow.def * L), spd: Math.floor(b.base.spd + b.grow.spd * L) };
    for (const k of ["w", "a", "c"]) {
      const it = m.eq[k] && ITEMS[m.eq[k]];
      if (!it) continue;
      s.atk += it.atk || 0; s.def += it.def || 0; s.spd += it.spd || 0; s.maxhp += it.hp || 0; s.maxmp += it.mp || 0;
    }
    return s;
  }
  const skillsOf = (m) => MEMBERS[m.id].skills.filter(([lv]) => m.lv >= lv).map(([, k]) => k).concat(m.extra || []);
  function gainExp(m, n) {
    const ups = [];
    m.exp += n;
    while (m.exp >= expTo(m.lv) && m.lv < 40) {
      const before = skillsOf(m);
      m.exp -= expTo(m.lv); m.lv++;
      const s0 = stats({ ...m, lv: m.lv - 1 }), s1 = stats(m);
      m.hp += s1.maxhp - s0.maxhp; m.mp += s1.maxmp - s0.maxmp;
      ups.push({ lv: m.lv, learned: skillsOf(m).filter((k) => !before.includes(k)) });
    }
    return ups;
  }

  // ---------- 전투 ----------
  const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
  function makeFoe(id, idx) {
    const e = ENEMIES[id];
    return { side: "f", id, name: e.name, hp: e.hp, maxhp: e.hp, atk: e.atk, def: e.def, spd: e.spd, el: e.el, boss: e.boss, big: e.big, st: {}, mem: {}, idx };
  }
  function create(party, foeIds, opts = {}) {
    const B = { party: party.map((m) => ({ side: "p", m, name: MEMBERS[m.id].name, st: {} })), foes: [], turn: 0, opts, warn: "" };
    foeIds.forEach((id) => addFoe(B, id));
    return B;
  }
  function addFoe(B, id) {
    const f = makeFoe(id, B.foes.length);
    B.foes.push(f);
    const same = B.foes.filter((x) => x.id === id);
    if (same.length > 1) same.forEach((x, i) => (x.name = ENEMIES[id].name + " " + "ABCDEF"[i]));
    return f;
  }
  const foeCount = (B, id) => B.foes.filter((f) => f.id === id && f.hp > 0).length;
  const hpOf = (c) => (c.side === "p" ? c.m.hp : c.hp);
  const setHp = (c, v) => { if (c.side === "p") c.m.hp = v; else c.hp = v; };
  const maxOf = (c) => (c.side === "p" ? stats(c.m).maxhp : c.maxhp);
  const alive = (c) => hpOf(c) > 0;
  const livingFoes = (B) => B.foes.filter(alive);
  const livingParty = (B) => B.party.filter(alive);
  function cstat(c) {
    if (c.side === "p") { const s = stats(c.m); return { atk: s.atk * (c.st.atkUp ? 1.3 : 1), def: s.def, spd: s.spd }; }
    return { atk: c.atk, def: c.def * (c.st.guardUp ? 2 : 1), spd: c.spd };
  }
  function damage(B, a, t, pow, rng, o = {}) {
    const A = cstat(a), T = cstat(t);
    let d = ((A.atk * A.atk) / (A.atk + T.def)) * pow * (0.9 + rng() * 0.2);
    const ev = { t: "hit", tg: t, n: 0 };
    if (o.el && t.side === "f" && t.el) {
      if (BEATS[o.el] === t.el) { d *= 1.5; ev.weak = true; }
      else if (o.el === t.el) { d *= 0.6; ev.resist = true; }
    }
    if (a.side === "p" && !o.noCrit && rng() < 0.06) { d *= 1.5; ev.crit = true; }
    if (t.side === "p" && t.st.guard) d *= 0.5;
    if (t.boss === "octo" && B.foes.some((f) => f.id === "tentacle" && alive(f))) { d *= 0.5; ev.shield = true; }
    if (o.rainbow && (t.boss === "mu" || t.boss === "mu2")) { d *= 2; ev.rainbow = true; }
    ev.n = Math.max(1, Math.round(d));
    return ev;
  }
  function applyHit(B, ev, out) {
    const t = ev.tg;
    setHp(t, Math.max(0, hpOf(t) - ev.n));
    out.push(ev);
    if (!alive(t)) {
      out.push({ t: "ko", tg: t });
      if (t.side === "p") t.st = {};
    }
  }
  const ST_NAME = { poison: "독", burn: "화상", ink: "먹물", seal: "봉인" };
  function addSt(t, st, turns, out) {
    if (!alive(t)) return;
    t.st[st] = turns;
    out.push({ t: "msg", s: `${t.name}${josa(t.name, "은", "는")} ${ST_NAME[st]} 상태가 되었다!` });
  }
  function josa(w, a, b) { const c = w.charCodeAt(w.length - 1); if (c < 0xac00 || c > 0xd7a3) return b; return (c - 0xac00) % 28 ? a : b; }
  RPG.josa = josa;

  // 행동 실행. act: { who, k: atk|skill|def|item|run, skill, item, tg }
  function exec(B, act, rng) {
    const out = [], a = act.who;
    if (!alive(a)) return out;
    if (a.side === "f") return foeAct(B, a, act, rng);
    const retarget = (tg) => (tg && alive(tg) ? tg : livingFoes(B)[0]);
    if (act.k === "def") { out.push({ t: "msg", s: `${a.name}${josa(a.name, "은", "는")} 몸을 웅크려 방어한다.` }); return out; }
    if (act.k === "atk") {
      const t = retarget(act.tg); if (!t) return out;
      out.push({ t: "msg", s: `${a.name}의 공격!`, who: a });
      if (a.st.ink && rng() < 0.5) { out.push({ t: "miss", tg: t, s: "먹물 때문에 앞이 안 보인다! 빗나갔다." }); return out; }
      if (t.mem && t.mem.evade && rng() < 0.75) { out.push({ t: "miss", tg: t, s: `${t.name}${josa(t.name, "이", "가")} 눈보라 속으로 사라졌다! 빗나갔다.` }); return out; }
      const ev = damage(B, a, t, 1, rng); applyHit(B, ev, out); afterHit(B, t, null, out);
      return out;
    }
    if (act.k === "item") {
      const it = ITEMS[act.item], t = act.tg;
      out.push({ t: "msg", s: `${a.name}${josa(a.name, "은", "는")} ${it.name}${josa(it.name, "을", "를")} 썼다.`, who: a });
      out.push({ t: "useItem", item: act.item });
      useItemOn(it, t, out);
      return out;
    }
    if (act.k === "skill") {
      const sk = SKILLS[act.skill];
      if (a.st.seal) { out.push({ t: "msg", s: `${a.name}의 스킬이 봉인되어 있다!` }); return out; }
      if (a.m.mp < sk.mp) { out.push({ t: "msg", s: "MP가 모자라다!" }); return out; }
      a.m.mp -= sk.mp;
      out.push({ t: "msg", s: `${a.name}의 「${sk.name}」!`, who: a, fx: sk.el || (sk.heal || sk.revive || sk.cure ? "heal" : "hit") });
      if (sk.pow) {
        const targets = sk.tg === "all" ? livingFoes(B) : sk.tg === "rand3" ? [0, 1, 2].map(() => pick(livingFoes(B), rng)).filter(Boolean) : [retarget(act.tg)];
        for (const t of targets) {
          if (!t || !alive(t)) continue;
          const ev = damage(B, a, t, sk.pow, rng, { el: sk.el, rainbow: sk.rainbow });
          applyHit(B, ev, out);
          afterHit(B, t, sk, out);
        }
        return out;
      }
      const lvHeal = 22 + a.m.lv * 7;
      if (sk.buff) { for (const t of livingParty(B)) t.st.atkUp = 3; out.push({ t: "msg", s: "아군 전체의 공격력이 올랐다!" }); return out; }
      const tl = sk.tg === "allies" ? livingParty(B) : [act.tg];
      for (const t of tl) {
        if (!t) continue;
        if (sk.revive) { if (!alive(t)) { t.m.hp = Math.ceil(stats(t.m).maxhp / 2); out.push({ t: "heal", tg: t, n: t.m.hp, s: `${t.name}${josa(t.name, "이", "가")} 다시 일어났다!` }); } continue; }
        if (!alive(t)) continue;
        if (sk.cure) { if (Object.keys(t.st).some((k) => ST_NAME[k])) out.push({ t: "msg", s: `${t.name}의 상태 이상이 말끔해졌다.` }); for (const k of Object.keys(ST_NAME)) delete t.st[k]; }
        if (sk.heal) { const n = Math.min(stats(t.m).maxhp - t.m.hp, Math.round(lvHeal * sk.heal)); t.m.hp += n; out.push({ t: "heal", tg: t, n }); }
      }
      return out;
    }
    return out;
  }
  function useItemOn(it, t, out) {
    if (!t) return;
    if (it.revive) { if (!alive(t)) { t.m.hp = Math.ceil(stats(t.m).maxhp * it.revive); out.push({ t: "heal", tg: t, n: t.m.hp, s: `${t.name}${josa(t.name, "이", "가")} 정신을 차렸다!` }); } else out.push({ t: "msg", s: "아무 일도 일어나지 않았다." }); return; }
    if (!alive(t)) { out.push({ t: "msg", s: "쓰러진 동료에게는 효과가 없다." }); return; }
    if (it.heal) { const n = Math.min(stats(t.m).maxhp - t.m.hp, it.heal); t.m.hp += n; out.push({ t: "heal", tg: t, n }); }
    if (it.mp) { const n = Math.min(stats(t.m).maxmp - t.m.mp, it.mp); t.m.mp += n; out.push({ t: "heal", tg: t, n, mp: true, s: `${t.name}의 MP가 ${n} 회복되었다.` }); }
    if (it.cure) { for (const k of Object.keys(ST_NAME)) delete t.st[k]; out.push({ t: "msg", s: `${t.name}의 상태 이상이 씻겨 나갔다.` }); }
  }
  function afterHit(B, t, sk, out) {
    if (!alive(t)) return;
    if (t.boss === "toad" && sk && sk.el === "water" && t.mem.heat > 0) { t.mem.heat--; out.push({ t: "msg", s: "치익— 가마솥이 식는다! (온도 ▼)" }); }
    if (t.boss === "mu2" && sk && sk.rainbow) { t.mem.cd = Math.min(3, (t.mem.cd || 0) + 1); out.push({ t: "msg", s: "오색 빛에 무채가 움찔한다! 침묵이 늦춰졌다." }); }
  }

  // ---------- 적 행동 ----------
  function weighted(list, rng) { const tot = list.reduce((n, [w]) => n + w, 0); let r = rng() * tot; for (const [w, v] of list) { if ((r -= w) < 0) return v; } return list[0][1]; }
  function planFoe(B, f, rng) {
    if (f.boss) return { who: f, k: "boss" };
    return { who: f, k: "ai", a: weighted(ENEMIES[f.id].ai, rng) };
  }
  const randAlive = (B, rng) => pick(livingParty(B), rng);
  function hitOne(B, f, pow, name, rng, out, extra = {}) {
    const t = extra.tg || randAlive(B, rng); if (!t) return;
    out.push({ t: "msg", s: name ? `${f.name}의 「${name}」!` : `${f.name}의 공격!`, who: f });
    const ev = damage(B, f, t, pow, rng); applyHit(B, ev, out);
    if (extra.st && alive(t) && rng() < extra.st[1]) addSt(t, extra.st[0], 3, out);
    if (extra.drain) { const n = Math.min(t.m.mp, 6); t.m.mp -= n; if (n) out.push({ t: "msg", s: `${t.name}의 MP를 ${n} 빨아들였다!` }); }
  }
  function hitAll(B, f, pow, name, rng, out, extra = {}) {
    out.push({ t: "msg", s: `${f.name}의 「${name}」!`, who: f, shake: true });
    for (const t of livingParty(B)) {
      const ev = damage(B, f, t, pow, rng); applyHit(B, ev, out);
      if (extra.st && alive(t) && rng() < extra.st[1]) addSt(t, extra.st[0], 3, out);
    }
  }
  function foeAct(B, f, act, rng) {
    const out = [];
    f.st.guardUp = 0;
    if (act.k === "ai") {
      const a = act.a;
      if (a.k === "atk") hitOne(B, f, 1, null, rng, out);
      else if (a.k === "guard") { f.st.guardUp = 1; out.push({ t: "msg", s: `${f.name}의 「${a.name}」! 방어가 단단해졌다.`, who: f }); }
      else if (a.all) hitAll(B, f, a.pow, a.name, rng, out, { st: a.st });
      else hitOne(B, f, a.pow, a.name, rng, out, { st: a.st, drain: a.drain });
      return out;
    }
    BOSS_AI[f.boss](B, f, rng, out);
    return out;
  }
  const BOSS_AI = {
    shoot(B, f, rng, out) {
      const m = f.mem; m.t = (m.t || 0) + 1;
      if (!m.summoned && f.hp < f.maxhp * 0.5) { m.summoned = 1; out.push({ t: "msg", s: "죽순 대왕이 땅을 굴렀다. 죽순이 쑥쑥 솟아난다!", who: f }); addFoe(B, "shoot"); addFoe(B, "shoot"); out.push({ t: "summon" }); return; }
      if (m.charge) { m.charge = 0; B.warn = ""; return hitAll(B, f, 1.55, "대나무 창 쏟아지기", rng, out); }
      if (m.t % 3 === 2) { m.charge = 1; B.warn = "다음 턴 강공격! 방어하면 피해가 절반"; out.push({ t: "msg", s: "죽순 대왕이 뿌리를 깊이 박는다… 땅이 울린다! (다음 턴에 큰 공격)", who: f, warn: true }); return; }
      hitOne(B, f, rng() < 0.5 ? 1 : 1.25, rng() < 0.5 ? null : "죽순 휘두르기", rng, out);
    },
    toad(B, f, rng, out) {
      const m = f.mem; m.heat = (m.heat || 0) + 1;
      if (m.heat >= 4) { m.heat = 0; B.warn = ""; return hitAll(B, f, 1.65, "펄펄 넘침", rng, out, { st: ["burn", 0.3] }); }
      const bar = "■".repeat(m.heat) + "□".repeat(4 - m.heat);
      if (m.heat === 3) { B.warn = "곧 펄펄 넘친다! 물 공격으로 식히거나 방어"; out.push({ t: "msg", s: `가마솥이 부글부글 끓는다! 곧 넘친다! [${bar}]`, who: f, warn: true }); hitOne(B, f, 0.9, null, rng, out); return; }
      B.warn = `가마솥 온도 [${bar}]`;
      if (rng() < 0.45) hitOne(B, f, 1.15, "불침 뱉기", rng, out, { st: ["burn", 0.35] }); else hitOne(B, f, 1.05, "혀 채찍", rng, out);
    },
    owl(B, f, rng, out) {
      const m = f.mem; m.t = (m.t || 0) + 1;
      const n = f.hp < f.maxhp * 0.4 ? 2 : 1;
      if (n === 2 && !m.rage) { m.rage = 1; out.push({ t: "msg", s: "부엉 장군이 분노했다! 이제 한 턴에 두 번 움직인다.", who: f, warn: true }); }
      for (let i = 0; i < n && livingParty(B).length; i++) {
        m.evade = false;
        if ((m.t + i) % 2 === 1) { m.evade = true; B.warn = "눈보라 장막: 일반 공격이 잘 빗나감 → 스킬로!"; out.push({ t: "msg", s: "부엉 장군이 눈보라 장막 속으로 숨었다! (일반 공격이 잘 빗나간다)", who: f, warn: true }); if (i === 0 && n === 2) continue; hitOne(B, f, 0.8, "얼음 깃 던지기", rng, out); }
        else { B.warn = ""; hitAll(B, f, 1.0, "깃털 칼날", rng, out); }
      }
    },
    octo(B, f, rng, out) {
      const m = f.mem; m.t = (m.t || 0) + 1;
      const tn = foeCount(B, "tentacle");
      if (m.t === 1 || (m.t % 4 === 0 && tn < 2)) {
        B.foes = B.foes.filter((x) => x.id !== "tentacle" || alive(x));
        for (let i = tn; i < 2; i++) addFoe(B, "tentacle");
        out.push({ t: "msg", s: "먹물 문어 사서가 책장 사이에서 촉수를 꺼냈다! 촉수가 있는 동안 사서는 피해를 절반만 받는다.", who: f, warn: true }); out.push({ t: "summon" });
        B.warn = "촉수가 사서를 지킨다 → 촉수부터!";
        return;
      }
      if (m.t % 3 === 0) return hitAll(B, f, 0.95, "먹물 파도", rng, out, { st: ["ink", 0.55] });
      if (rng() < 0.35) { const t = randAlive(B, rng); out.push({ t: "msg", s: "「도서관에서는 조용히!」", who: f }); if (t) addSt(t, "seal", 2, out); return; }
      hitOne(B, f, 1.3, "책 모서리", rng, out);
    },
    mu(B, f, rng, out) {
      const m = f.mem; m.t = (m.t || 0) + 1;
      if (m.t % 3 === 1) { const t = randAlive(B, rng); out.push({ t: "msg", s: "무채가 손을 뻗는다. 「그 색, 내가 가져가지.」", who: f }); if (t) { hitOne(B, f, 0.8, "색 훔치기", rng, out, { tg: t }); addSt(t, "seal", 2, out); } return; }
      if (m.t % 3 === 2) return hitAll(B, f, 1.1, "잿빛 숨", rng, out);
      hitOne(B, f, 1.4, "회색 손", rng, out);
    },
    mu2(B, f, rng, out) {
      const m = f.mem;
      if (m.cd == null) m.cd = 3;
      m.cd--;
      if (m.cd <= 0) { m.cd = 3; B.warn = ""; return hitAll(B, f, 2.0, "무채의 침묵", rng, out); }
      B.warn = `무채의 침묵까지 ${m.cd}턴 — 오색 일격으로 늦출 수 있다`;
      out.push({ t: "msg", s: `무채가 모든 색을 지우려 한다… (침묵까지 ${m.cd}턴)`, who: f, warn: true });
      if (m.cd === 2) hitAll(B, f, 0.9, "잿빛 소용돌이", rng, out); else hitOne(B, f, 1.4, "지우개 손", rng, out);
    },
  };

  // 라운드 끝: 상태 이상 처리
  function endRound(B) {
    const out = [];
    for (const c of [...B.party, ...B.foes]) {
      if (!alive(c)) continue;
      for (const k of ["poison", "burn"]) if (c.st[k]) {
        const n = Math.max(1, Math.round(maxOf(c) * 0.07));
        setHp(c, Math.max(1, hpOf(c) - n));
        out.push({ t: "hit", tg: c, n, dot: true, s: `${c.name}${josa(c.name, "이", "가")} ${ST_NAME[k]}으로 ${n} 피해를 입었다.` });
      }
      for (const k of ["poison", "burn", "ink", "seal", "atkUp"]) if (c.st[k]) { c.st[k]--; if (!c.st[k]) { delete c.st[k]; if (ST_NAME[k]) out.push({ t: "msg", s: `${c.name}의 ${ST_NAME[k]} 상태가 풀렸다.` }); } }
      if (c.side === "p") c.st.guard = 0;
    }
    B.turn++;
    return out;
  }
  // 무채 1형태 → 2형태
  function phase(B) {
    const mu = B.foes.find((f) => f.boss === "mu");
    if (mu && !alive(mu) && !B.phase2) {
      B.phase2 = true;
      B.foes = [makeFoe("b_mu2", 0)];
      return [{ t: "msg", s: "무채가 쓰러지는가 싶더니… 잿빛 안개가 모여 진짜 모습을 드러냈다!", warn: true }, { t: "summon", phase: true }];
    }
    return [];
  }
  function result(B) {
    if (!livingParty(B).length) return "lose";
    if (!livingFoes(B).length) return B.foes.some((f) => f.boss === "mu") && !B.phase2 ? null : "win";
    return null;
  }
  function order(B, acts, rng) {
    return acts.map((a) => ({ a, s: (a.k === "def" ? 999 : cstat(a.who).spd) * (0.9 + rng() * 0.2) })).sort((x, y) => y.s - x.s).map((x) => x.a);
  }
  function tryRun(B, rng) {
    if (B.opts.boss) return false;
    const ps = livingParty(B).reduce((n, c) => n + cstat(c).spd, 0) / Math.max(1, livingParty(B).length);
    const fs = livingFoes(B).reduce((n, c) => n + c.spd, 0) / Math.max(1, livingFoes(B).length);
    return rng() < Math.min(0.92, Math.max(0.35, 0.6 + (ps - fs) * 0.03));
  }
  function rewards(B) {
    let exp = 0, gold = 0; const drops = [];
    for (const f of B.foes) { const e = ENEMIES[f.id]; exp += e.exp; gold += e.gold; if (e.drop) drops.push(e.drop); }
    return { exp, gold, drops };
  }

  // ---------- 자동 전투(시뮬레이터·자동 플레이용) ----------
  function auto(B, c, inv, rng = Math.random) {
    const party = B.party, sk = skillsOf(c.m).filter((k) => SKILLS[k].mp <= c.m.mp && !c.st.seal);
    const low = party.filter((p) => alive(p) && p.m.hp < stats(p.m).maxhp * 0.4);
    const dead = party.filter((p) => !alive(p));
    if (dead.length && sk.includes("revive")) return { who: c, k: "skill", skill: "revive", tg: dead[0] };
    if (dead.length && inv.tea > 0) return { who: c, k: "item", item: "tea", tg: dead[0] };
    if (low.length >= 2 && sk.includes("patall")) return { who: c, k: "skill", skill: "patall" };
    if (low.length && sk.includes("pat")) return { who: c, k: "skill", skill: "pat", tg: low.sort((a, b) => a.m.hp - b.m.hp)[0] };
    if (c.m.hp < stats(c.m).maxhp * 0.3) { for (const it of ["bigfish", "fish", "tteok"]) if (inv[it] > 0) return { who: c, k: "item", item: it, tg: c }; }
    if (c.st.ink || c.st.poison || c.st.burn) { if (sk.includes("clean")) return { who: c, k: "skill", skill: "clean", tg: c }; }
    if (c.m.mp < 4 && inv.candy > 0 && B.opts.boss) return { who: c, k: "item", item: "candy", tg: c };
    if (/강공격|넘친다/.test(B.warn) && !sk.includes("bubble") && !sk.includes("breath") && !sk.includes("wave") && !(sk.includes("pat") && low.length)) return { who: c, k: "def" };
    const foes = livingFoes(B);
    const tent = foes.filter((f) => f.id === "tentacle");
    let target = tent.length ? tent[0] : foes.slice().sort((a, b) => a.hp - b.hp)[0];
    const boss = foes.find((f) => f.boss);
    if (boss && !tent.length) target = boss;
    if (sk.includes("rainbow") && boss && (boss.boss === "mu" || boss.boss === "mu2")) return { who: c, k: "skill", skill: "rainbow", tg: boss };
    if (sk.includes("cheer") && B.opts.boss && !c.st.atkUp && rng() < 0.3) return { who: c, k: "skill", skill: "cheer" };
    const mpOk = B.opts.boss || c.m.mp > stats(c.m).maxmp * 0.35;
    if (mpOk) {
      // 오행 상극 스킬 우선
      const weak = sk.filter((k) => SKILLS[k].pow && SKILLS[k].el && BEATS[SKILLS[k].el] === target.el);
      const aoe = sk.filter((k) => SKILLS[k].tg === "all" && SKILLS[k].pow);
      if (foes.length >= 2 && aoe.length) { const w = aoe.find((k) => BEATS[SKILLS[k].el] === foes[0].el) || aoe[0]; return { who: c, k: "skill", skill: w }; }
      if (weak.length) return { who: c, k: "skill", skill: weak[0], tg: target };
      const strong = sk.filter((k) => SKILLS[k].pow >= 1.5 && SKILLS[k].tg === "one" && SKILLS[k].el !== target.el);
      if (strong.length && (B.opts.boss || target.hp > 40)) return { who: c, k: "skill", skill: strong[strong.length - 1], tg: target };
    }
    return { who: c, k: "atk", tg: target };
  }

  RPG.core = { expTo, newMember, stats, skillsOf, gainExp, create, exec, planFoe, endRound, phase, result, order, tryRun, rewards, auto, alive, livingFoes, livingParty, hpOf, maxOf, cstat, useItemOn, ST_NAME };
})();
