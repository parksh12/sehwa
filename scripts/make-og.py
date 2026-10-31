# 공유 미리보기 이미지(og.png, 1200x630) 생성. 사이트명을 바꾸면 다시 실행: python scripts/make-og.py "새이름"
import sys, os
from PIL import Image, ImageDraw, ImageFont
name = sys.argv[1] if len(sys.argv) > 1 else "나알기"
W, H = 1200, 630
img = Image.new("RGB", (W, H))
px = img.load()
a, b, c = (108, 92, 231), (166, 108, 255), (255, 122, 144)
for y in range(H):
    for x in range(W):
        t = (x / W + y / H) / 2
        if t < .55: k = t / .55; col = tuple(int(a[i] + (b[i] - a[i]) * k) for i in range(3))
        else: k = (t - .55) / .45; col = tuple(int(b[i] + (c[i] - b[i]) * k) for i in range(3))
        px[x, y] = col
d = ImageDraw.Draw(img, "RGBA")
d.ellipse((960, -160, 1360, 240), fill=(255, 255, 255, 30))
d.ellipse((-140, 470, 200, 810), fill=(255, 255, 255, 30))
F = "C:/Windows/Fonts/"
big = ImageFont.truetype(F + "malgunbd.ttf", 150)
mid = ImageFont.truetype(F + "malgunbd.ttf", 48)
small = ImageFont.truetype(F + "malgun.ttf", 34)
def center(text, font, y, fill=(255, 255, 255, 255)):
    w = d.textlength(text, font=font); d.text(((W - w) / 2, y), text, font=font, fill=fill)
center(name, big, 150)
center("나를 알아보는 재미있는 테스트", mid, 350)
center("만 나이·띠·별자리 · 16유형 성격 · 2027 신년운세 · 이름 궁합 · 반응속도", small, 450, (255, 255, 255, 220))
out = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "og.png")
img.save(out, optimize=True)
print("saved", out)
