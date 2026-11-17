// P2-75 A조: 가이드 구역(/guide/) 빌더. 원고는 content/guides/ 폴더의 *.md 또는 *.mjs 파일 하나 = 글 하나.
// 파일을 넣기만 하면 목록·글 페이지·사이트맵·RSS에 들어갑니다. 넣는 법: 03팀 산출물/P2-75_가이드원고_넣는법.md
// 파일 이름이 _ 로 시작하면(예: _예시.md) 읽지 않습니다. draft: true 인 글도 만들지 않습니다.
// 원고 안에 [캡처: …] [실측: …] 표시가 남아 있으면 「준비 중」 상자로 보이고 그 글은 noindex + 빌드 경고(채운 뒤 색인).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PENDING_RE = /\[(캡처|실측|확인)\s*[:：]\s*([^\]]+)\]/g;

// ---------- 원고 읽기 ----------
// .md 형식
// ---
// title: 제목
// desc: 검색 결과 설명(80~160자)
// slug: 주소-이름          (/guide/주소-이름/)
// published: 2026-11-17
// updated: 2026-11-17
// tools: charcount, readtime   (관련 툴 id, 쉼표)
// summary: 핵심 한 줄 | 핵심 한 줄 | 핵심 한 줄   (선택, | 로 나눔)
// draft: false
// ---
// 본문: ## 소제목(목차) / ### 작은 제목 / 빈 줄로 문단 / - 목록 / 1. 순서 / > 도움말 / | 표 | / ![설명](파일.png "그림 설명")
//       Q. 질문 + 다음 줄 A. 답 → 자주 묻는 질문 / ## 출처 아래 - [이름](주소) → 출처 목록
function parseMd(src, file) {
  const s = src.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(s);
  if (!m) throw new Error(`가이드 ${file}: 맨 위 --- 머리말(title·desc·slug 등)이 없어요`);
  const meta = {};
  for (const line of m[1].split("\n")) {
    const mm = /^([a-zA-Z]+)\s*:\s*(.*)$/.exec(line.trim());
    if (mm) meta[mm[1]] = mm[2].trim();
  }
  const g = {
    title: meta.title, desc: meta.desc, slug: meta.slug, published: meta.published, updated: meta.updated || meta.published,
    tools: (meta.tools || "").split(/[,\s]+/).filter(Boolean),
    summary: meta.summary ? meta.summary.split("|").map((x) => x.trim()).filter(Boolean) : [],
    draft: /^(true|yes|1)$/i.test(meta.draft || ""), author: meta.author || "",
    body: [], faq: [], sources: [],
  };
  const lines = s.slice(m[0].length).split("\n");
  let i = 0, inSources = false;
  const isBlockStart = (l) => /^(#{2,3}\s|[-*]\s|\d+[.)]\s|>\s?|\||!\[|Q\.\s)/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let mm;
    if ((mm = /^(#{2,3})\s+(.*)$/.exec(l))) {
      const h = mm[2].trim();
      inSources = mm[1] === "##" && /^(출처|참고 자료|참고)$/.test(h);
      if (!inSources) g.body.push({ [mm[1] === "##" ? "h2" : "h3"]: h });
      i++; continue;
    }
    if (/^Q\.\s/.test(l)) {
      const q = l.replace(/^Q\.\s*/, "").trim(); i++;
      const a = [];
      while (i < lines.length && lines[i].trim() && !/^Q\.\s/.test(lines[i]) && !/^#{2,3}\s/.test(lines[i])) { a.push(lines[i].replace(/^A\.\s*/, "").trim()); i++; }
      g.faq.push({ q, a: a.join(" ") }); continue;
    }
    if (/^[-*]\s/.test(l)) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s+/, "").trim()); i++; }
      if (inSources) for (const it of items) { const lm = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(it); g.sources.push(lm ? { name: it.replace(lm[0], lm[1]).trim(), url: lm[2] } : { name: it }); }
      else g.body.push({ list: items });
      continue;
    }
    if (/^\d+[.)]\s/.test(l)) {
      const items = [], start = parseInt(l, 10);
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+[.)]\s+/, "").trim()); i++; }
      g.body.push({ steps: items, start }); continue;
    }
    if (/^>\s?/.test(l)) {
      const tx = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { tx.push(lines[i].replace(/^>\s?/, "")); i++; }
      g.body.push({ tip: tx.join(" ").trim() }); continue;
    }
    if (/^\|/.test(l)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())); i++; }
      const sep = rows.length > 1 && rows[1].every((c) => /^:?-{2,}:?$/.test(c));
      g.body.push({ table: { head: sep ? rows[0] : null, rows: sep ? rows.slice(2) : rows } }); continue;
    }
    if ((mm = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/.exec(l.trim()))) {
      g.body.push({ img: mm[2], alt: mm[1], caption: mm[3] || "" }); i++; continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) { para.push(lines[i].trim()); i++; }
    if (para.length) { if (inSources) g.sources.push({ name: para.join(" ") }); else g.body.push({ p: para.join(" ") }); }
    else i++;
  }
  return g;
}

export async function loadGuides(dir) {
  if (!fs.existsSync(dir)) return { list: [], skipped: [] };
  const files = fs.readdirSync(dir).filter((f) => /\.(md|mjs)$/i.test(f) && !f.startsWith("_")).sort();
  const list = [], skipped = [];
  for (const f of files) {
    const full = path.join(dir, f);
    const g = f.endsWith(".md") ? parseMd(fs.readFileSync(full, "utf8"), f) : { body: [], faq: [], sources: [], tools: [], summary: [], ...(await import(pathToFileURL(full).href + `?t=${fs.statSync(full).mtimeMs}`)).default };
    g.file = f;
    g.updated = g.updated || g.published;
    for (const k of ["title", "desc", "slug", "published"]) if (!g[k]) throw new Error(`가이드 ${f}: ${k} 값이 없어요`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.slug)) throw new Error(`가이드 ${f}: slug는 영문 소문자·숫자·- 만 (지금 「${g.slug}」)`);
    for (const k of ["published", "updated"]) if (!/^\d{4}-\d{2}-\d{2}$/.test(g[k])) throw new Error(`가이드 ${f}: ${k}는 YYYY-MM-DD (지금 「${g[k]}」)`);
    if (g.draft) { skipped.push(f); continue; }
    g.path = `/guide/${g.slug}/`;
    list.push(g);
  }
  const seen = new Set();
  for (const g of list) { if (seen.has(g.slug)) throw new Error(`가이드 slug 중복: ${g.slug}`); seen.add(g.slug); }
  list.sort((a, b) => b.published.localeCompare(a.published) || a.title.localeCompare(b.title, "ko"));
  return { list, skipped };
}

// ---------- 그림 크기(PNG·JPEG·WEBP) — width/height를 넣어 화면 밀림(CLS) 방지 ----------
function imgSize(file) {
  try {
    const b = fs.readFileSync(file);
    if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
    if (b[0] === 0xff && b[1] === 0xd8) {
      let o = 2;
      while (o < b.length) {
        if (b[o] !== 0xff) { o++; continue; }
        const mk = b[o + 1], len = b.readUInt16BE(o + 2);
        if (mk >= 0xc0 && mk <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(mk)) return [b.readUInt16BE(o + 7), b.readUInt16BE(o + 5)];
        o += 2 + len;
      }
    }
    if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
      const ch = b.toString("ascii", 12, 16);
      if (ch === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
      if (ch === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
      if (ch === "VP8L") { const n = b.readUInt32LE(21); return [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)]; }
    }
  } catch (e) { /* 크기를 모르면 속성 없이 */ }
  return null;
}

// ---------- 페이지 만들기 ----------
export function buildGuides(ctx) {
  const { list, root, cfg, write, layout, crumbHtml, crumbs, faqHtml, faqLd, recoRows, anyById, esc, fill, u, abs, warnings, orgId, adSlot } = ctx;
  const ko = (d) => { const [y, m, dd] = d.split("-").map(Number); return `${y}년 ${m}월 ${dd}일`; };
  const assetDir = path.join(root, "src", "assets", "guide");
  const report = [];

  // 글 안 꾸밈: **굵게**, [글](주소), `코드`. 주소는 사이트 안(/로 시작) 또는 http(s)만
  const inline = (s0) => {
    let s = esc(fill(s0));
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, txt, href) => {
      const h = href.replace(/&amp;/g, "&");
      if (h.startsWith("/")) return `<a href="${u(h)}">${txt}</a>`;
      if (/^https?:\/\//.test(h)) return `<a href="${esc(h)}" rel="noopener" target="_blank">${txt}<span class="sr"> (새 창)</span></a>`;
      return txt;
    });
    s = s.replace(PENDING_RE, (all, kind, what) => `<span class="g-pending">[${kind} 준비 중: ${what}]</span>`);
    return s;
  };
  const plain = (s) => fill(String(s || "")).replace(/\*\*|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  for (const g of list) {
    const items = [["홈", "/"], ["가이드", "/guide/"], [g.title, g.path]];
    let hN = 0, firstImg = "", len = 0;
    const toc = [];
    const pending = [];
    const raw = JSON.stringify(g);
    for (const mm of raw.matchAll(PENDING_RE)) pending.push(`${mm[1]}: ${mm[2]}`);
    for (const id of g.tools) if (!anyById[id]) throw new Error(`가이드 ${g.file}: 없는 툴 id ${id}`);
    const bodyHtml = g.body.map((b) => {
      if (b.h2) { const id = `s${++hN}`; toc.push([id, b.h2]); return `<h2 id="${id}">${inline(b.h2)}</h2>`; }
      if (b.h3) return `<h3>${inline(b.h3)}</h3>`;
      if (b.p) { len += plain(b.p).length; return fill(b.p).split(/\n+/).map((x) => `<p>${inline(x)}</p>`).join(""); }
      if (b.list) { len += b.list.map(plain).join("").length; return `<ul>${b.list.map((x) => `<li>${inline(x)}</li>`).join("")}</ul>`; }
      if (b.steps) { len += b.steps.map(plain).join("").length; return `<ol class="g-steps"${b.start > 1 ? ` start="${b.start}"` : ""}>${b.steps.map((x) => `<li>${inline(x)}</li>`).join("")}</ol>`; }
      if (b.tip) { len += plain(b.tip).length; return `<p class="g-tip">${inline(b.tip)}</p>`; }
      if (b.table) {
        const tb = b.table; len += [...(tb.head || []), ...tb.rows.flat()].map(plain).join("").length;
        return `<div class="g-table"><table>${tb.caption ? `<caption>${inline(tb.caption)}</caption>` : ""}${tb.head ? `<thead><tr>${tb.head.map((c) => `<th scope="col">${inline(c)}</th>`).join("")}</tr></thead>` : ""}<tbody>${tb.rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      }
      if (b.img) {
        const file = path.join(assetDir, b.img);
        if (!/^[\w.\-가-힣]+\.(png|jpe?g|webp)$/i.test(b.img) || !fs.existsSync(file)) {
          pending.push(`그림 파일 없음: src/assets/guide/${b.img}`);
          return `<figure class="g-fig g-fig-empty"><div class="g-pending">[그림 준비 중: ${esc(b.img)}${b.alt ? ` — ${esc(b.alt)}` : ""}]</div>${b.caption ? `<figcaption>${inline(b.caption)}</figcaption>` : ""}</figure>`;
        }
        if (!b.alt) warnings.push(`가이드 ${g.file}: 그림 ${b.img}에 설명(alt)이 없어요`);
        const wh = imgSize(file);
        const src = `/assets/guide/${b.img}`;
        if (!firstImg) firstImg = src;
        return `<figure class="g-fig"><img src="${u(src)}" alt="${esc(fill(b.alt || ""))}"${wh ? ` width="${wh[0]}" height="${wh[1]}"` : ""} loading="lazy" decoding="async">${b.caption ? `<figcaption>${inline(b.caption)}</figcaption>` : ""}</figure>`;
      }
      return "";
    }).join("\n");
    len += g.faq.reduce((n, f) => n + plain(f.q).length + plain(f.a).length, 0);
    const noindex = pending.length > 0;
    if (pending.length) warnings.push(`가이드 ${g.file}: 준비 중 표시 ${pending.length}곳(${pending.slice(0, 3).join(" / ")}${pending.length > 3 ? " …" : ""}) → noindex`);
    if (len < 1500) warnings.push(`가이드 ${g.file}: 본문 ${len}자 (<1500)`);
    report.push({ path: g.path, len, noindex, pending: pending.length });

    const tools = g.tools.map((id) => anyById[id]);
    const body = `${crumbHtml(items)}
<article class="guide">
  <header class="page-head g-head">
    <span class="eyebrow">가이드</span>
    <h1>${esc(fill(g.title))}</h1>
    <p class="lead">${esc(fill(g.desc))}</p>
    <p class="g-meta"><span>작성 <time datetime="${g.published}">${ko(g.published)}</time></span>${g.updated !== g.published ? `<span>수정 <time datetime="${g.updated}">${ko(g.updated)}</time></span>` : ""}<span>${esc(fill(g.author || `${cfg.siteName} 운영팀`))}</span></p>
    ${tools.length ? `<p class="g-tools"><b>이 글에서 쓴 툴</b>${tools.map((x) => `<a class="chip" href="${u(x.path)}">${esc(x.title)}</a>`).join("")}</p>` : ""}
  </header>
  ${g.summary && g.summary.length ? `<section class="g-summary" aria-label="핵심 요약"><h2 class="sr">핵심 요약</h2><ul>${g.summary.map((x) => `<li>${inline(x)}</li>`).join("")}</ul></section>` : ""}
  ${toc.length > 1 ? `<nav class="g-toc" aria-label="목차"><b>목차</b><ol>${toc.map(([id, h]) => `<li><a href="#${id}">${inline(h)}</a></li>`).join("")}</ol></nav>` : ""}
  <div class="prose g-body">
${bodyHtml}
  </div>
  ${adSlot ? adSlot("guide") : ""}
  ${faqHtml(g.faq)}
  ${g.sources.length ? `<section class="g-sources"><h2>출처·참고</h2><ul>${g.sources.map((x) => `<li>${x.url ? `<a href="${esc(x.url.startsWith("/") ? u(x.url) : x.url)}"${x.url.startsWith("/") ? "" : ' rel="noopener" target="_blank"'}>${esc(fill(x.name))}</a>` : esc(fill(x.name))}</li>`).join("")}</ul></section>` : ""}
  ${tools.length ? recoRows(g.tools.slice(0, 4), "이 글에서 쓴 툴 바로 가기") : ""}
  ${list.length > 1 ? `<section class="g-more"><h2>다른 가이드</h2><ul>${list.filter((x) => x !== g).slice(0, 5).map((x) => `<li><a href="${u(x.path)}">${esc(fill(x.title))}</a></li>`).join("")}</ul></section>` : ""}
</article>`;
    const ld = [
      { "@context": "https://schema.org", "@type": "Article", headline: fill(g.title).slice(0, 110), description: fill(g.desc), datePublished: g.published, dateModified: g.updated, inLanguage: "ko", mainEntityOfPage: abs(g.path), image: [abs(firstImg || "/assets/og.png")], author: { "@type": "Organization", name: fill(g.author || `${cfg.siteName} 운영팀`), url: abs("/about/") }, publisher: { "@id": orgId() } },
      crumbs(items),
    ];
    if (g.faq.length) ld.push(faqLd(g.faq));
    write(g.path, layout({ title: fill(g.title), desc: fill(g.desc), path: g.path, body, ogType: "article", noindex, jsonld: ld }));
  }

  // 목록 /guide/
  {
    const items = [["홈", "/"], ["가이드", "/guide/"]];
    const body = `${crumbHtml(items)}
<header class="page-head"><span class="eyebrow">가이드</span><h1>툴 사용 가이드</h1><p class="lead">${esc(cfg.siteName)}의 툴을 직접 돌려 보고 쓴 글이에요. 실제로 넣어 본 파일과 숫자, 직접 찍은 화면, 써 보다가 막힌 곳과 푸는 법을 적었어요.</p></header>
<section class="prose g-about"><h2>가이드는 이렇게 써요</h2><ul>
<li>글마다 우리 툴을 실제로 실행해서 나온 숫자(글자수, 용량, 쪽 수, 처리 시간)를 그대로 적어요. 직접 재지 못한 값은 「미확인」이라고 밝혀요.</li>
<li>법·제도와 관련된 숫자는 법령, 고용노동부, 국세청 같은 공식 자료를 확인하고 출처를 글 아래에 적어요.</li>
<li>작성일과 수정일을 글 머리에 적고, 툴이 바뀌어 내용이 달라지면 고친 뒤 수정일을 바꿔요. 바뀐 내용은 <a href="${u("/updates/")}">업데이트 기록</a>에도 남겨요.</li>
</ul></section>
${list.length ? `<ul class="g-list">${list.map((g) => `<li><a class="g-card" href="${u(g.path)}"><b>${esc(fill(g.title))}</b><span>${esc(fill(g.desc))}</span><small><time datetime="${g.updated}">${ko(g.updated)}</time>${g.tools.length ? ` · ${g.tools.map((id) => esc(anyById[id].title)).join(" · ")}` : ""}</small></a></li>`).join("")}</ul>` : `<p class="hint">첫 가이드를 준비하고 있어요.</p>`}`;
    write("/guide/", layout({ title: "툴 사용 가이드 — 직접 써 보고 쓴 PDF·이미지·글쓰기·계산 가이드", desc: `${cfg.siteName} 툴을 직접 실행해 본 결과로 쓴 사용 가이드. 실측 숫자, 직접 찍은 화면, 자주 막히는 곳과 해결법을 정리했어요.`, path: "/guide/", body, noindex: list.filter((g) => !report.find((r) => r.path === g.path)?.noindex).length === 0, jsonld: [crumbs(items)] }));
  }
  return report;
}
