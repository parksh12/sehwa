// 오늘의 띠별 운세: 날짜가 바뀌었으면 다시 그리기, 내 띠 찾기, 스레드용 이미지(1080x1350) 저장
import { renderDay, kstDate, dayFortune, starText, dateLabel } from "./daily.mjs";

const box = document.getElementById("today");
const today = kstDate();
if (box && box.querySelector(".today-date")?.dataset.date !== today) box.innerHTML = renderDay(today);

// 내 띠 찾기 (출생 연도 기준. 1월~2월 초생은 앞 해 띠일 수 있음)
const form = document.getElementById("today-find");
form?.addEventListener("submit", (e) => {
  e.preventDefault();
  const y = Number(form.y.value);
  if (!y) return;
  const key = NALGI.ttiOf(y, 6, 1);
  const el = document.getElementById(key);
  if (!el) return;
  document.querySelectorAll(".today-card.mine").forEach((x) => x.classList.remove("mine"));
  el.classList.add("mine");
  history.replaceState(null, "", "#" + key);
  el.scrollIntoView({ behavior: "smooth", block: "start" });
});

// 스레드·인스타용 세로 이미지
function lines(ctx, text, maxW, max) {
  // 어절(띄어쓰기) 단위로 줄바꿈
  const out = []; let line = "";
  for (const word of text.split(" ")) {
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width > maxW && line) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out.slice(0, max);
}
async function makeImage() {
  const D = "Black Han Sans", B = getComputedStyle(document.body).fontFamily;
  try { await Promise.all([document.fonts.load(`40px "${D}"`), document.fonts.ready]); } catch (e) {}
  const f = dayFortune(kstDate());
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
  x.fillStyle = "#141414"; x.font = `84px "${D}"`; x.textAlign = "left"; x.fillText("오늘의 띠별 운세", 64, 150);
  x.fillStyle = "#e5372b"; x.font = `700 40px ${B}`; x.fillText(dateLabel(f.date), 68, 212);
  const cw = (W - 128 - 2 * 20) / 3, ch = 232, top = 260;
  f.list.forEach((t, i) => {
    const cx = 64 + (i % 3) * (cw + 20), cy = top + Math.floor(i / 3) * (ch + 18);
    x.fillStyle = "#141414"; x.fillRect(cx + 6, cy + 6, cw, ch);
    x.fillStyle = t.stars === 5 ? "#ffc21a" : "#fff"; x.fillRect(cx, cy, cw, ch);
    x.lineWidth = 4; x.strokeStyle = "#141414"; x.strokeRect(cx, cy, cw, ch);
    x.beginPath(); x.arc(cx + 52, cy + 56, 32, 0, Math.PI * 2); x.fillStyle = "#fff"; x.fill(); x.lineWidth = 5; x.strokeStyle = "#e5372b"; x.stroke();
    x.fillStyle = "#e5372b"; x.font = `700 36px "Noto Serif KR", Batang, serif`; x.textAlign = "center"; x.fillText(t.hanja, cx + 52, cy + 69);
    x.textAlign = "left"; x.fillStyle = "#141414"; x.font = `40px "${D}"`; x.fillText(t.name, cx + 98, cy + 54);
    x.font = `700 26px ${B}`; x.fillStyle = "#e5372b"; x.fillText(starText(t.stars), cx + 100, cy + 88);
    x.fillStyle = "#141414"; x.font = `700 29px ${B}`;
    lines(x, t.head, cw - 40, 3).forEach((l, j) => x.fillText(l, cx + 20, cy + 140 + j * 38));
  });
  x.fillStyle = "#141414"; x.font = `44px "${D}"`; x.fillText(NALGI.site, 64, H - 52);
  x.font = `500 26px ${B}`; x.fillStyle = "#767676"; x.textAlign = "right"; x.fillText("재미로 보는 운세예요 · 띠별 자세한 풀이는 사이트에서", W - 64, H - 58);
  return c;
}
document.querySelector('[data-act="threads"]')?.addEventListener("click", async () => {
  const c = await makeImage();
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${NALGI.site}-오늘의운세-${kstDate()}.png`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  NALGI.toast("오늘의 운세 이미지를 저장했어요");
});
