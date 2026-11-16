# P2-74b 커닝냥이 문제 은행 검증: 국가법령정보센터(law.go.kr) 현행 조문에 근거 문장(quote)이 그대로 있는지 하나씩 대조하고 검증표를 만든다.
# 사용: python scripts/examcat-law-verify.py [검증표.md 경로]   (인터넷 필요. 법령 원문은 임시 폴더에 캐시)
import sys, os, re, json, html, subprocess, urllib.parse, tempfile, datetime
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "examcat-law-check.md")
CACHE = os.path.join(tempfile.gettempdir(), "examcat-law")
os.makedirs(CACHE, exist_ok=True)
CIRC = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳"

js = "const vm=require('vm'),fs=require('fs');const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),c);process.stdout.write(JSON.stringify(c.window.EXCAT.BANK))"
BANK = json.loads(subprocess.run(["node", "-e", js, os.path.join(ROOT, "src", "assets", "examcat-data.js")], capture_output=True, text=True, encoding="utf-8", check=True).stdout)

def law_text(name):
    f = os.path.join(CACHE, name.replace(" ", "_") + ".html")
    if not os.path.exists(f) or os.path.getsize(f) < 10000:
        u = "https://www.law.go.kr/LSW/lsLinkProc.do?lsNm=" + urllib.parse.quote(name) + "&mode=11"
        subprocess.run(["curl", "-s", "-m", "60", "-A", "Mozilla/5.0", "-L", u, "-o", f], check=True)
    s = open(f, encoding="utf-8", errors="ignore").read()
    t = html.unescape(re.sub(r"<[^>]+>", "\n", s)); t = re.sub(r"[ \t\xa0]+", " ", t); t = re.sub(r"\n\s*\n+", "\n", t)
    m = re.search(r"\[시행 [^\]]+\] \[[^\]]+\]", t)
    return t, (m.group(0) if m else "(시행일 표시 못 찾음)")
norm = lambda s: re.sub(r"\s+", " ", s).strip()
def article(t, jo):
    m = re.search(r"\n\s*" + re.escape(jo) + r"\(", t)
    if not m: return None
    rest = t[m.start():]
    n = re.search(r"\n\s*제\d+조(의\d+)?\(", rest[5:])
    return rest[: (n.start() + 5) if n else 6000]
def paragraph(a, hang):
    c = CIRC[hang - 1]; i = a.find(c)
    if i < 0: return None
    j = a.find(CIRC[hang], i + 1) if hang < len(CIRC) else -1
    return a[i: j if j > 0 else len(a)]

rows, fails, meta = [], [], {}
for i, q in enumerate(BANK, 1):
    t, m = law_text(q["law"]); meta[q["law"]] = m
    parts = q["jo"].split()
    a = article(t, parts[0]); ok = a is not None; why = ""
    scope = a or ""
    hm = re.search(r"제(\d+)항", q["jo"])
    if ok and hm:
        p = paragraph(a, int(hm.group(1)))
        if p is None: ok, why = False, f"{hm.group(0)} 없음"
        else: scope = p
    if ok:
        for s in q["quote"]:
            # 인용문은 해당 항 안에 있어야 함. 다만 「~를 보는 경우」처럼 비교를 위해 같은 조의 다른 항을 인용한 문장은 조 전체에서 찾음
            if norm(s) in norm(scope): continue
            if norm(s) in norm(a): why += f"(같은 조 다른 항에서 확인: {s[:20]}…) "; continue
            ok = False; why += f"인용문 없음: {s} "
    if len(set(q["a"])) != 3: ok = False; why += "보기 중복 "
    rows.append((i, q, ok, why))
    if not ok: fails.append((i, q["law"], q["jo"], why))
    print(("PASS " if ok else "FAIL ") + f"#{i} {q['law']} {q['jo']} {why}", flush=True)

esc = lambda s: str(s).replace("|", "\|").replace("\n", " ")
today = datetime.date.today().isoformat()
L = [f"# P2-74b 커닝냥이 세법 문제 검증표", "",
     f"- 검증일: {today} · 대상: `src/assets/examcat-data.js`의 문제 은행 {len(BANK)}문항(한 판 10문항 무작위)",
     "- 방법: 국가법령정보센터(law.go.kr) 현행 법령 원문을 내려받아, 문항마다 적은 근거 조문의 **해당 항** 안에 인용 문장이 글자 그대로 있는지 자동 대조(공백만 정리). 정답 보기는 인용 문장과 같은 내용이고, 오답 보기는 같은 조문과 맞지 않는 내용으로 만들었으며 해설에 이유를 적음",
     "- 기준 법령(현행):"] + [f"  - {k}: {v}" for k, v in meta.items()] + [
     f"- 결과: **{len(BANK) - len(fails)}/{len(BANK)} 일치**" + ("" if not fails else f", 불일치 {len(fails)}건"), "",
     "| # | 법령 | 근거 조문 | 문제 | 정답 | 오답 보기 | 해설 | 현행 조문 인용(대조 문장) | 결과 |", "|---|---|---|---|---|---|---|---|---|"]
for i, q, ok, why in rows:
    L.append(f"| {i} | {esc(q['law'])} | {esc(q['jo'])} | {esc(q['q'])} | {esc(q['a'][0])} | {esc(' / '.join(q['a'][1:]))} | {esc(q['x'])} | {esc(' … '.join(q['quote']))} | {'일치' if ok else '불일치 ' + esc(why)}{(' ' + esc(why)) if ok and why else ''} |")
open(OUT, "w", encoding="utf-8").write("\n".join(L) + "\n")
print(f"\n{len(BANK) - len(fails)}/{len(BANK)} 일치 → {OUT}")
sys.exit(1 if fails else 0)
