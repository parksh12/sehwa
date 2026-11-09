# P2-52 적립식 백테스트 독립 계산(파이썬, 수동 실행): python scripts/dca-verify.py src/assets/data
# dca-calc.js와 따로 JSON을 풀고 계산한다(XIRR은 뉴턴법, JS는 이분법). 출력값을 build.mjs의 P2-52 대조 표(PY)에 옮겨 빌드 때 자동 대조한다.
import json, sys, datetime as dt
from decimal import Decimal
DATA = sys.argv[1]
def load(t):
    j = json.load(open(f"{DATA}/stock-{t}.json", encoding="utf-8"))
    d0 = dt.date.fromisoformat(j["d0"]); dates=[d0]
    for g in j["g"]: dates.append(dates[-1] + dt.timedelta(days=g))
    closes=[]; acc=0
    for x in j["c"]:
        acc += x; closes.append(acc / j["k"])
    return dates, closes
def xirr(flows):
    t0 = flows[0][0]
    def npv(r): return sum(v * (1+r) ** (-((t-t0).days)/365) for t,v in flows)
    # 뉴턴법(도함수 직접) — JS의 이분법과 다른 방법
    def dnpv(r): return sum(-((t-t0).days/365) * v * (1+r) ** (-((t-t0).days)/365 - 1) for t,v in flows)
    r = 0.05
    for _ in range(500):
        step = npv(r)/dnpv(r)
        while r - step <= -0.99: step /= 2
        r -= step
        if abs(step) < 1e-15: break
    return r
def run(dates, closes, start, end, amt):
    rng = [i for i,d in enumerate(dates) if start <= d.strftime("%Y-%m") <= end]
    s, e = rng[0], rng[-1]
    seen=set(); buys=[]
    for i in rng:
        m = dates[i].strftime("%Y-%m")
        if m not in seen: seen.add(m); buys.append(i)
    total = amt*len(buys); lsh = total/closes[s]
    sh=0; inv=0; peak=0; mdd=0; lpeak=0; lmdd=0; low=0; flows=[]
    bset=set(buys)
    for i in rng:
        if i in bset:
            sh += amt/closes[i]; inv += amt; flows.append((dates[i], -amt))
        v = sh*closes[i]; lv = lsh*closes[i]
        peak = max(peak, v); mdd = min(mdd, v/peak-1)
        lpeak = max(lpeak, lv); lmdd = min(lmdd, lv/lpeak-1)
        low = min(low, v/inv-1)
    value = sh*closes[e]; flows.append((dates[e], value))
    days = (dates[e]-dates[s]).days
    lv = lsh*closes[e]
    return dict(first=str(dates[s]), last=str(dates[e]), n=len(buys), inv=inv, value=value, rate=value/inv-1, irr=xirr(flows), mdd=mdd, low=low,
                lval=lv, lrate=lv/total-1, cagr=(lv/total)**(365/days)-1, lmdd=lmdd)
cases = [("tqqq","2016-01","2020-12",100), ("soxl","2020-01","2024-12",500), ("koru","2013-04","2025-12",100), ("soxl","2015-01","2025-12",100), ("koru","2015-01","2025-12",100)]
for t,a,b,amt in cases:
    D = load(t)
    r = run(*D, a, b, amt)
    print(t.upper(), a, b, amt, json.dumps({k:(repr(v) if isinstance(v,float) else v) for k,v in r.items()}, ensure_ascii=False))
