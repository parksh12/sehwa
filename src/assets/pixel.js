// 1분 인생용 도트 그림 — 이미지 파일 없이 64x40 캔버스에 직접 그립니다.
// 사람은 나이에 따라 아기 → 어린이 → 학생 → 어른 → 노인으로 자라고, 옷·머리색은 태어날 때 정해져 일생 동안 유지돼요.
(function () {
  const W = 64, H = 40;
  const PAL = {
    k: "#141414", w: "#ffffff", s: "#f2c29b", r: "#e5372b", y: "#ffc21a", b: "#2346d8", g: "#1e9e5a",
    G: "#a7a7a7", h: "#6b4226", p: "#f4a6b8", c: "#9fd3ff", o: "#ff8a3d", n: "#5a3a22", d: "#2b2b2b", l: "#7fd06b",
  };

  // 사람: H 머리, B 옷, P 바지(색은 사람마다 치환)
  const PEOPLE = {
    baby: ["...HH...", "..ssss..", ".skssks.", ".ssssss.", "..srrs..", ".wwwwww.", "swwwwwws", ".wwwwww.", "..s..s.."],
    kid: ["..HHHH..", ".HHHHHH.", ".HssssH.", ".skssks.", ".ssssss.", "..srrs..", ".BBBBBB.", "sBBBBBBs", "..PPPP..", "..P..P..", ".kk..kk."],
    adult: ["..HHHH..", ".HHHHHH.", ".HssssH.", ".skssks.", ".ssssss.", "..srrs..", "..BBBB..", ".BBBBBB.", "sBBBBBBs", ".BBBBBB.", "..PPPP..", "..P..P..", "..P..P..", ".kk..kk."],
    elder: ["..GGGG..", ".GGGGGG.", ".GssssG.", ".skssks.", ".ssssss.", "..srrs..", "..BBBB..", ".BBBBBB.", "sBBBBBBs", ".BBBBBBn", "..PPPP.n", "..P..P.n", "..P..P.n", ".kk..kkn"],
  };
  const PROPS = {
    mic: [".k.", "kGk", ".k.", ".n.", ".n.", ".n.", "nnn"],
    cat: ["o..o....", "oooo....", "okok...o", "oooo..o.", ".ooooo..", ".o.o.o.."],
    milk: ["ww", "bb", "ww"],
    heart: [".rr.rr.", "rrrrrrr", "rrrrrrr", ".rrrrr.", "..rrr..", "...r..."],
    phone: ["kkkkk", "kwwwk", "kwrwk", "kwwwk", "kwwwk", "kkkkk", "kkwkk", "kkkkk"],
    coins: ["..yyyy..", ".yyyyyy.", "..yyyy..", ".yyyyyy.", "..yyyy..", ".yyyyyy."],
    pack: ["..kk..", ".bbbb.", "bbbbbb", "byyyyb", "bbbbbb", "bbbbbb", ".b..b."],
    plane: ["......w.....", "..wwwwwwwwk.", "wwwwwwwwwwww", "..wwwwww....", ".....w......"],
    books: ["rrrrrrr.", "wwwwwww.", "bbbbbbbb", "wwwwwwww", ".yyyyyyy", ".wwwwwww"],
    lamp: ["yyyy", ".yy.", ".kk.", ".kk.", "kkkk"],
    bulb: [".yyy.", "yyyyy", "yyyyy", ".yyy.", "..G..", "..G.."],
    bread: ["..oooo..", ".oyoyoo.", "oooooooo", "oyoooyoo", ".oooooo."],
    note: ["..yy", "..yy", "..y.", "..y.", "yyy.", "yyy."],
    pad: [".kkkkkk.", "kkwkkrkk", "kwwwkkrk", ".kk..kk."],
    chute: [".rrwwrrwwr.", "rrwwrrwwrrw", "k.........k", ".k.......k.", "..k.....k..", "...k...k...", "....kkk....", "....sss....", "....bbb...."],
    stone: ["..GGGG..", ".GGGGGG.", "GGGGGGGG", "GGkkkkGG", "GGGGGGGG", "GGkkkGGG", "GGGGGGGG", "GGGGGGGG", "GGGGGGGG"],
    flowers: ["r.y.p.r", "g.g.g.g", "ggggggg"],
    sun: [".yyy.", "yyyyy", "yyyyy", "yyyyy", ".yyy."],
    zz: ["kkk..", "..k..", ".k...", "kkk.k", "....k"],
  };

  const R = (x, c, X, Y, w, h) => { x.fillStyle = c; x.fillRect(X, Y, w, h); };
  function sprite(x, map, X, Y, swap = {}) {
    map.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === ".") return;
      const c = swap[ch] || PAL[ch];
      if (c) R(x, c, X + i, Y + j, 1, 1);
    }));
  }

  // 배경: 각 함수는 바닥 높이(사람 발 위치)를 돌려줍니다.
  const BG = {
    home(x) { R(x, "#f6e7c8", 0, 0, W, 30); R(x, "#c98f5a", 0, 30, W, 10); R(x, "#a8733f", 0, 30, W, 1); R(x, "#141414", 40, 5, 16, 13); R(x, "#9fd3ff", 41, 6, 14, 11); R(x, "#141414", 47, 6, 1, 11); R(x, "#141414", 41, 11, 14, 1); R(x, "#1e9e5a", 6, 22, 5, 5); R(x, "#5a3a22", 7, 27, 3, 3); return 32; },
    street(x) { R(x, "#9fd3ff", 0, 0, W, 28); [[0, 10, 10, "#c9c2b5"], [11, 6, 9, "#b0a08e"], [21, 14, 12, "#d8cfc0"], [34, 8, 8, "#a99a88"], [43, 12, 11, "#c9c2b5"], [56, 5, 8, "#b0a08e"]].forEach(([X, Y, w, c]) => { R(x, c, X, Y, w, 28 - Y); for (let j = Y + 2; j < 25; j += 4) for (let i = X + 2; i < X + w - 2; i += 3) R(x, "#ffe9a8", i, j, 1, 2); }); R(x, "#7d7d7d", 0, 28, W, 12); for (let i = 2; i < W; i += 10) R(x, "#ffffff", i, 34, 5, 1); return 33; },
    school(x) { R(x, "#efe8d2", 0, 0, W, 31); R(x, "#b07a4a", 0, 31, W, 9); R(x, "#5a3a22", 5, 3, 38, 16); R(x, "#1e5a3a", 6, 4, 36, 14); R(x, "#ffffff", 9, 7, 9, 1); R(x, "#ffffff", 9, 10, 14, 1); R(x, "#ffffff", 9, 13, 6, 1); R(x, "#9fd3ff", 48, 4, 12, 12); R(x, "#ffffff", 53, 4, 1, 12); return 33; },
    stage(x) { R(x, "#2a1530", 0, 0, W, H); x.fillStyle = "rgba(255,226,120,.28)"; x.beginPath(); x.moveTo(26, 0); x.lineTo(38, 0); x.lineTo(50, 33); x.lineTo(14, 33); x.fill(); for (let i = 0; i < 9; i++) { R(x, i % 2 ? "#b8261c" : "#e5372b", i, 0, 1, 33); R(x, i % 2 ? "#b8261c" : "#e5372b", W - 1 - i, 0, 1, 33); } R(x, "#e5372b", 0, 0, W, 3); R(x, "#5a3a22", 0, 33, W, 7); R(x, "#7b5232", 0, 33, W, 1); return 35; },
    office(x) { R(x, "#dfe3ea", 0, 0, W, 31); R(x, "#9aa3b0", 0, 31, W, 9); R(x, "#8a5a3a", 34, 23, 26, 3); R(x, "#5a3a22", 36, 26, 2, 6); R(x, "#5a3a22", 56, 26, 2, 6); R(x, "#141414", 42, 13, 12, 9); R(x, "#9fd3ff", 43, 14, 10, 7); R(x, "#141414", 47, 22, 2, 1); R(x, "#ffffff", 6, 5, 10, 7); R(x, "#e5372b", 8, 9, 2, 2); R(x, "#ffc21a", 11, 7, 2, 4); return 34; },
    mountain(x) { R(x, "#ffd9a3", 0, 0, W, 14); R(x, "#ffbf8a", 0, 14, W, 8); sprite(x, PROPS.sun, 48, 6); x.fillStyle = "#3f8a55"; x.beginPath(); x.moveTo(0, 32); x.lineTo(18, 12); x.lineTo(36, 32); x.fill(); x.fillStyle = "#2f6f44"; x.beginPath(); x.moveTo(22, 32); x.lineTo(44, 16); x.lineTo(66, 32); x.fill(); R(x, "#ffffff", 16, 13, 4, 2); R(x, "#7fb069", 0, 32, W, 8); return 35; },
    sea(x) { R(x, "#9fd3ff", 0, 0, W, 20); sprite(x, PROPS.sun, 8, 4); R(x, "#2f7fd6", 0, 20, W, 10); for (let i = 1; i < W; i += 7) R(x, "#ffffff", i, 22 + (i % 3) * 2, 3, 1); R(x, "#f1d59a", 0, 30, W, 10); return 34; },
    sky(x) { R(x, "#9fd3ff", 0, 0, W, H); [[6, 8], [36, 4], [46, 26], [12, 30]].forEach(([X, Y]) => { R(x, "#ffffff", X, Y, 12, 3); R(x, "#ffffff", X + 3, Y - 2, 6, 2); }); return 0; },
    bakery(x) { R(x, "#f6e7c8", 0, 0, W, 31); for (let i = 0; i < W; i += 4) R(x, (i / 4) % 2 ? "#ffffff" : "#e5372b", i, 4, 4, 5); R(x, "#141414", 30, 13, 26, 14); R(x, "#ffe9c2", 31, 14, 24, 12); R(x, "#c98f5a", 0, 31, W, 9); return 34; },
    night(x) { R(x, "#1b1f3a", 0, 0, W, 31); R(x, "#3a2a20", 0, 31, W, 9); R(x, "#141414", 8, 5, 16, 13); R(x, "#2b3570", 9, 6, 14, 11); R(x, "#fff3b0", 17, 8, 3, 3); R(x, "#ffffff", 11, 13, 1, 1); R(x, "#ffffff", 14, 9, 1, 1); R(x, "#8a5a3a", 32, 23, 28, 3); R(x, "#5a3a22", 34, 26, 2, 6); R(x, "#5a3a22", 56, 26, 2, 6); return 34; },
    park(x) { R(x, "#ffc08a", 0, 0, W, 12); R(x, "#ff9e7a", 0, 12, W, 8); R(x, "#e5787a", 0, 20, W, 6); sprite(x, PROPS.sun, 50, 15); R(x, "#5aa05a", 0, 26, W, 14); R(x, "#4a8a4a", 0, 26, W, 1); R(x, "#5a3a22", 6, 14, 3, 13); R(x, "#2f6f44", 2, 6, 11, 9); return 34; },
  };

  const STAGE = (age) => (age < 5 ? "baby" : age < 13 ? "kid" : age < 60 ? "adult" : "elder");
  const IDLE = (age) => (age < 5 ? "home" : age < 13 ? "street" : age < 20 ? "school" : age < 40 ? "office" : age < 60 ? "street" : "park");

  // person: { shirt, hair }  scene: { bg, props: [[name, x, y]], who: 사람 x 또는 false, with: [[stage, x, shirt]] }
  function draw(canvas, scene, age, person, t = 0) {
    const x = canvas.getContext("2d");
    x.clearRect(0, 0, W, H);
    const floor = BG[scene.bg](x);
    const bob = Math.floor(t / 450) % 2;
    (scene.with || []).forEach(([st, X, shirt]) => {
      const m = PEOPLE[st];
      sprite(x, m, X, floor - m.length + 1 - (bob ? 0 : 0), { H: PAL.n, B: PAL[shirt], P: PAL.d });
    });
    if (scene.who !== false) {
      const st = STAGE(age), m = PEOPLE[st];
      sprite(x, m, scene.who ?? 20, floor - m.length + 1 - bob, { H: PAL[person.hair], B: PAL[st === "kid" ? "y" : person.shirt], P: PAL[st === "kid" ? "b" : "d"] });
    }
    (scene.props || []).forEach(([name, X, Y]) => sprite(x, PROPS[name], X, Y));
  }

  NALGI.pixel = { W, H, draw, IDLE, newPerson: () => ({ shirt: ["r", "b", "g", "o"][Math.floor(Math.random() * 4)], hair: Math.random() < 0.5 ? "k" : "h" }) };
})();
