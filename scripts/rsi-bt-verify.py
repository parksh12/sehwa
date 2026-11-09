# P2-54 RSI 매매 백테스트 독립 계산(파이썬, 수동 실행): python scripts/rsi-bt-verify.py src/assets/data
# rsi-bt-calc.js와 따로 JSON을 풀고 계산한다(주봉은 ISO 주 번호로 묶음, JS는 1970-01-01부터 일수로 묶음).
# 출력값을 build.mjs의 P2-54 대조 표(PY)에 옮겨 빌드 때 자동 대조한다.
import json, sys, datetime as dt
DATA = sys.argv[1]

def load(t):
    j = json.load(open(f"{DATA}/stock-{t}.json", encoding="utf-8"))
    k = j["k"]; d = dt.date.fromisoformat(j["d0"])
    rows = []; acc = 0
    for i, x in enumerate(j["c"]):
        if i: d = d + dt.timedelta(days=j["g"][i - 1])
        acc += x
        rows.append((d, acc / k))
    return rows  # [(날짜, 종가)] — 이 검증은 종가만 씀(신호·체결 모두 종가)

def to_bars(rows, weekly):
    # 반환: [(마감 날짜, 종가, 원래 일 인덱스 마지막)]
    if not weekly:
        return [(d, c, i) for i, (d, c) in enumerate(rows)]
    out = []; cur = None
    for i, (d, c) in enumerate(rows):
        key = d.isocalendar()[:2]
        if out and cur == key:
            out[-1] = (d, c, i)
        else:
            out.append((d, c, i)); cur = key
    return out

def wilder(closes, n):
    ch = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    out = [None] * len(closes)
    if len(ch) < n: return out
    ag = sum(max(x, 0) for x in ch[:n]) / n
    al = sum(max(-x, 0) for x in ch[:n]) / n
    def val(): return 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    out[n] = val()
    for j in range(n, len(ch)):
        x = ch[j]
        ag = (ag * (n - 1) + max(x, 0)) / n
        al = (al * (n - 1) + max(-x, 0)) / n
        out[j + 1] = val()
    return out

def backtest(rows, start, end, weekly=False, n=14, buy=30, sell=70, stop=None, fee=0.0, cap=10000.0):
    ym = lambda d: d.strftime("%Y-%m")
    idx = [i for i, (d, _) in enumerate(rows) if start <= ym(d) <= end]
    s, e = idx[0], idx[-1]
    allb = to_bars(rows[: e + 1], weekly)        # 끝 연월 마지막 거래일까지만(그 뒤 날짜는 쓰지 않음)
    r_all = wilder([b[1] for b in allb], n)
    pick = [k for k, b in enumerate(allb) if b[2] >= s]
    bars = [allb[k] for k in pick]; rs = [r_all[k] for k in pick]
    cash = cap; sh = 0.0; ent = None; trades = []; eq = []; hold = []
    hsh = cap * (1 - fee) / bars[0][1]
    for k, (d, p, _) in enumerate(bars):
        r = rs[k]
        if sh > 0:
            why = None
            if stop is not None and p <= ent["pin"] * (1 - stop): why = "stop"
            elif r is not None and r >= sell: why = "rsi"
            if why:
                cash = sh * p * (1 - fee)
                trades.append(dict(ent=str(ent["d"]), ex=str(d), why=why, ret=cash / ent["in"] - 1, days=(d - ent["d"]).days))
                sh = 0.0; ent = None
        elif r is not None and r <= buy:
            ent = dict(d=d, pin=p, **{"in": cash})
            sh = cash * (1 - fee) / p; cash = 0.0
        eq.append(cash + sh * p); hold.append(hsh * p)
    if ent:
        trades.append(dict(ent=str(ent["d"]), ex=None, why="open", ret=sh * bars[-1][1] / ent["in"] - 1, days=(bars[-1][0] - ent["d"]).days))
    def mdd(v):
        pk = v[0]; m = 0.0
        for x in v:
            pk = max(pk, x); m = min(m, x / pk - 1)
        return m
    closed = [t for t in trades if t["why"] != "open"]
    return dict(first=str(bars[0][0]), last=str(bars[-1][0]), bars=len(bars), trades=len(trades), closed=len(closed),
                wins=sum(1 for t in closed if t["ret"] > 0), stops=sum(1 for t in closed if t["why"] == "stop"),
                value=eq[-1], rate=eq[-1] / cap - 1, hvalue=hold[-1], hrate=hold[-1] / cap - 1,
                mdd=mdd(eq), hmdd=mdd(hold), avgDays=(sum(t["days"] for t in closed) / len(closed)) if closed else None,
                firstBuy=trades[0]["ent"] if trades else None, lastRet=trades[-1]["ret"] if trades else None)

cases = [
    ("tqqq", "2015-01", "2024-12", dict()),
    ("soxl", "2012-01", "2025-12", dict(weekly=True)),
    ("koru", "2016-01", "2025-06", dict(stop=0.15, fee=0.001)),
    ("soxl", "2018-01", "2025-12", dict(buy=25, sell=75, n=10)),
    ("tqqq", "2011-01", "2025-12", dict(weekly=True, buy=35, sell=65, stop=0.2)),
    ("soxl", "2021-06", "2022-12", dict()),
]
for t, a, b, o in cases:
    r = backtest(load(t), a, b, **o)
    print(t.upper(), a, b, json.dumps(o), json.dumps({k: (repr(v) if isinstance(v, float) else v) for k, v in r.items()}, ensure_ascii=False))
