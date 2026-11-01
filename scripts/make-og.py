# 공유 미리보기 이미지(og.png, 1200x630) 생성. 사이트명을 바꾸면 다시 실행: python scripts/make-og.py "새이름"
# 디자인: 흰 바탕 + 두꺼운 검은 테두리 + 오방색 면(그라데이션 없음).
# 펭귄은 사이트 로고(build.mjs LOGO, favicon.svg)와 같은 64×64 도안을 그대로 옮겨 그림:
#   둥근 검은 머리, 하트 모양 윗선의 흰 얼굴, 하이라이트가 들어간 동그란 눈, 노란 부리, 연한 볼터치
import sys, os
from PIL import Image, ImageDraw, ImageFont
name = sys.argv[1] if len(sys.argv) > 1 else "펭귄 툴즈"
W, H = 1200, 630
INK, YEL, RED, BLUE, GRN, WHITE = (20, 20, 20), (255, 194, 26), (229, 55, 43), (35, 70, 216), (30, 158, 90), (255, 255, 255)
img = Image.new("RGB", (W, H), WHITE)
d = ImageDraw.Draw(img)
# 카드 면 + 그림자 면
d.rounded_rectangle((70, 70, W - 40, H - 40), 36, fill=INK)
d.rounded_rectangle((40, 40, W - 70, H - 70), 36, fill=YEL, outline=INK, width=8)

def cubic(p0, p1, p2, p3, n=48):
    return [tuple((1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * e for a, b, c, e in zip(p0, p1, p2, p3)) for t in (i / n for i in range(1, n + 1))]

def penguin(size):
    """로고 SVG(viewBox 0 0 64 64)를 size 픽셀로 그린 RGBA 이미지. 4배로 그린 뒤 줄여 가장자리를 부드럽게 함"""
    k = 4; S = size * k; f = S / 64
    P = lambda x, y: (x * f, y * f)
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); g = ImageDraw.Draw(im)
    circ = lambda cx, cy, r, col: g.ellipse((P(cx - r, cy - r), P(cx + r, cy + r)), fill=col)
    circ(32, 32, 28, INK + (255,))                                            # 머리
    # 얼굴: M32 20.5 c-4-7-19-7-20.5 6 C10 40 18.5 53 32 53 s22-13 20.5-26.5 C51 13.5 36 13.5 32 20.5z
    pts = [(32, 20.5)]
    pts += cubic((32, 20.5), (28, 13.5), (13, 13.5), (11.5, 26.5))
    pts += cubic((11.5, 26.5), (10, 40), (18.5, 53), (32, 53))
    pts += cubic((32, 53), (45.5, 53), (54, 40), (52.5, 26.5))
    pts += cubic((52.5, 26.5), (51, 13.5), (36, 13.5), (32, 20.5))
    g.polygon([P(x, y) for x, y in pts], fill=WHITE + (255,))
    for cx in (23.5, 40.5):                                                   # 눈
        g.ellipse((P(cx - 3.2, 33 - 4), P(cx + 3.2, 33 + 4)), fill=INK + (255,))
    circ(24.6, 31.6, 1.1, WHITE + (255,)); circ(41.6, 31.6, 1.1, WHITE + (255,))  # 하이라이트
    beak = [P(28.6, 39.5), P(35.4, 39.5), P(32, 43.9)]                          # 부리
    g.polygon(beak, fill=YEL + (255,)); g.line(beak + [beak[0]], fill=INK + (255,), width=max(1, round(1.6 * f)), joint="curve")
    cheek = Image.new("RGBA", (S, S), (0, 0, 0, 0)); cg = ImageDraw.Draw(cheek)   # 볼터치(불투명도 0.4)
    for cx in (18, 46):
        cg.ellipse((P(cx - 2.8, 41 - 2.8), P(cx + 2.8, 41 + 2.8)), fill=RED + (102,))
    im = Image.alpha_composite(im, cheek)
    return im.resize((size, size), Image.LANCZOS)

peng = penguin(400)
img.paste(peng, (705, 95), peng)
F = "C:/Windows/Fonts/"
big = ImageFont.truetype(F + "malgunbd.ttf", 112)
mid = ImageFont.truetype(F + "malgunbd.ttf", 40)
small = ImageFont.truetype(F + "malgunbd.ttf", 28)
d.text((100, 130), name, font=big, fill=INK)
d.text((104, 290), "자주 쓰는 툴, 설치 없이 바로", font=mid, fill=INK)
chips = [("PDF 합치기", RED, WHITE), ("JPG→PDF", BLUE, WHITE), ("용량 줄이기", GRN, WHITE), ("글자수 세기", WHITE, INK), ("타이머", WHITE, INK)]
x, y = 104, 380
for label, bg, fg in chips:
    w = d.textlength(label, font=small) + 36
    if x + w > 690: x, y = 104, y + 70
    d.rounded_rectangle((x, y, x + w, y + 54), 12, fill=bg, outline=INK, width=4)
    d.text((x + 18, y + 9), label, font=small, fill=fg)
    x += w + 14
out = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "og.png")
img.save(out, optimize=True)
print("saved", out)
