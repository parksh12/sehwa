# P2-55 복리·배당 계산기 독립 계산(파이썬, 수동 실행): python scripts/compound-verify.py
# compound-calc.js는 달마다 굴려(시뮬레이션) 계산하고, 여기서는 엑셀 FV 공식(닫힌 식)으로 따로 계산한다.
#   엑셀: =FV(rate, nper, -pmt, -pv, type)  →  pv(1+i)^n + pmt·((1+i)^n − 1)/i·(1 + i·type)
# 출력값을 build.mjs의 P2-55 대조 표(PY)에 옮겨 빌드 때 자동 대조한다. Decimal 40자리로 계산.
from decimal import Decimal as D, getcontext
import math
getcontext().prec = 40

def fv(i, n, pmt, pv, typ=0):
    i, pmt, pv = D(str(i)), D(str(pmt)), D(str(pv))
    if i == 0:
        return pv + pmt * n
    g = (1 + i) ** n
    return pv * g + pmt * (g - 1) / i * (1 + i * typ)

def monthly(p0, pmt, rate, years, begin=False):
    # 월복리: 월 이율 = 연 수익률 ÷ 12, 12×년 번
    return fv(D(str(rate)) / 12, 12 * years, pmt, p0, 1 if begin else 0)

def yearly(p0, pmt, rate, years, begin=False):
    # 연복리: 이자는 1년에 한 번. 그해 넣은 적립금은 넣은 달부터 연말까지 단리로 이자를 받아 연말에 원금에 붙음
    # → 1년치 적립금 효과 C = pmt × (12 + r × (월초 78 / 월말 66) ÷ 12), 그 뒤는 연 단위 FV(r, 년, −C, −원금)
    r = D(str(rate))
    c = D(str(pmt)) * (12 + r * (78 if begin else 66) / 12)
    return fv(r, years, c, p0, 0)

CASES = [
    ("A 월복리 월말", monthly(10_000_000, 500_000, 0.06, 10)),
    ("B 월복리 월초", monthly(10_000_000, 500_000, 0.06, 10, True)),
    ("C 연복리 거치", yearly(10_000_000, 0, 0.07, 10)),
    ("D 연복리 적립 월말 2년", yearly(0, 100_000, 0.12, 2)),
    ("E 연복리 적립 월초 30년", yearly(5_000_000, 300_000, 0.08, 30, True)),
    ("F 월복리 20년 기본값", monthly(10_000_000, 500_000, 0.07, 20)),
    ("G 배당 재투자 1억 4% 세후 10년", monthly(100_000_000, 0, 0.04 * 0.846, 10)),
    ("H 배당 재투자 + 매달 100만 5% 세후 15년", monthly(50_000_000, 1_000_000, 0.05 * 0.846, 15)),
]
for k, v in CASES:
    print(f"{k}: {float(v)!r}")
print("실질 가치 F ÷ 1.025^20:", float(monthly(10_000_000, 500_000, 0.07, 20) / D("1.025") ** 20))
print("72의 법칙 6%: 72/6 =", 72 / 6, "정확:", math.log(2) / math.log(1.06))
print("월복리 7% 실효 연 수익률:", (1 + 0.07 / 12) ** 12 - 1, "두 배:", math.log(2) / math.log((1 + 0.07 / 12) ** 12))
print("필요 투자금(월 세후 100만, 5%):", float(D(1_000_000) / D("0.846") * 12 / D("0.05")))
