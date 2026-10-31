(function () {
  const m = /^E(\d{1,3})S(\d{1,3})T(\d{1,3})J(\d{1,3})$/.exec(new URLSearchParams(location.search).get("r") || "");
  const el = document.getElementById("my-axes");
  if (!m || !el) return;
  const v = m.slice(1).map((x) => Math.min(100, Math.max(0, +x)));
  const code = (location.pathname.match(/\/personality\/([a-z]{4})\/?$/) || [])[1] || "";
  const expect = (v[0] >= 50 ? "e" : "i") + (v[1] >= 50 ? "s" : "n") + (v[2] >= 50 ? "t" : "f") + (v[3] >= 50 ? "j" : "p");
  if (code !== expect) return;
  const AX = [["외향 E", "내향 I"], ["감각 S", "직관 N"], ["사고 T", "감정 F"], ["판단 J", "인식 P"]];
  el.innerHTML = `<p style="text-align:center;margin:0 0 4px;font-weight:700">나의 결과</p>` + AX.map(([a, b], k) => {
    const left = v[k] >= 50; const pct = left ? v[k] : 100 - v[k];
    return `<div class="axis-row"><div class="axis-labels"><span${left ? "" : ' style="opacity:.6"'}>${a} ${v[k]}%</span><span${left ? ' style="opacity:.6"' : ""}>${b} ${100 - v[k]}%</span></div><div class="axis-bar"><i style="width:${v[k]}%"></i></div></div>`;
  }).join("");
  el.hidden = false;
})();
