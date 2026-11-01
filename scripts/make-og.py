# 공유 미리보기 이미지(og.png, 1200x630) 생성. 사이트명을 바꾸면 다시 실행: python scripts/make-og.py "새이름"
# 디자인: 흰 바탕 + 두꺼운 검은 테두리 + 오방색 면(그라데이션 없음). 펭귄은 코드로 그린 단순 도형.
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
# 펭귄 (오른쪽)
cx, top = 905, 110
d.line((cx - 110, top + 150, cx - 160, top + 250), fill=INK, width=30)           # 날개
d.line((cx + 110, top + 150, cx + 160, top + 250), fill=INK, width=30)
d.rounded_rectangle((cx - 120, top, cx + 120, top + 330), 100, fill=INK)          # 몸통
d.rounded_rectangle((cx - 80, top + 120, cx + 80, top + 305), 75, fill=WHITE)    # 배
d.ellipse((cx - 52, top + 62, cx - 32, top + 82), fill=WHITE)                    # 눈(점)
d.ellipse((cx + 32, top + 62, cx + 52, top + 82), fill=WHITE)
d.polygon([(cx - 26, top + 98), (cx + 26, top + 98), (cx, top + 130)], fill=YEL, outline=INK)  # 부리
d.line((cx - 70, top + 350, cx - 20, top + 350), fill=RED, width=22)            # 발
d.line((cx + 20, top + 350, cx + 70, top + 350), fill=RED, width=22)
F = "C:/Windows/Fonts/"
big = ImageFont.truetype(F + "malgunbd.ttf", 112)
mid = ImageFont.truetype(F + "malgunbd.ttf", 40)
small = ImageFont.truetype(F + "malgunbd.ttf", 28)
d.text((100, 130), name, font=big, fill=INK)
d.text((104, 290), "자주 쓰는 툴, 설치 없이 바로", font=mid, fill=INK)
chips = [("PDF 합치기", RED, WHITE), ("JPG→PDF", BLUE, WHITE), ("용량 줄이기", GRN, WHITE), ("글자수 세기", WHITE, INK), ("D-day", WHITE, INK)]
x, y = 104, 380
for label, bg, fg in chips:
    w = d.textlength(label, font=small) + 36
    if x + w > 720: x, y = 104, y + 70
    d.rounded_rectangle((x, y, x + w, y + 54), 12, fill=bg, outline=INK, width=4)
    d.text((x + 18, y + 9), label, font=small, fill=fg)
    x += w + 14
out = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "og.png")
img.save(out, optimize=True)
print("saved", out)
