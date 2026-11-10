// P2-63a-2 느린 수집 모드(백오프): K-apt 기본정보 V5가 30여 회째마다 HTTP_ERROR 04·429·504로 끊겨서 만든 오래 돌리는 반복 로직
// COO 4차 지시(2026-11-10): 간격 2초, 04·429·504면 10분 쉬고 이어 받기, 연속 6번 오류면 그날 종료, 하루 4,500회 상한,
//   30분마다 진행 한 줄(콘솔 + .cache/basic-progress.json), 종료 코드로 끝난 이유 구분
// 네트워크·파일·시계는 밖에서 넣어 준다(시험에서 가짜로 바꿔 끼움)
export const SLOW = Object.freeze({
  intervalMs: 2000,        // 호출 간격
  backoffMs: 10 * 60000,   // 백오프 대상 오류 뒤 쉬는 시간
  maxConsecErr: 6,         // 연속 오류 이 횟수면 그날 종료(약 1시간)
  dailyCap: 4500,          // 하루 호출 상한(net.mjs spend 의 kaptBasic 한도로 건다)
  progressMs: 30 * 60000,  // 진행 한 줄 간격
});
// 종료 코드: 0 전부 받음 / 3 하루 상한 / 4 연속 오류로 그날 종료 / 1 그 밖의 오류(즉시 중단) / 2 키·입력 없음(기존)
export const EXIT = Object.freeze({ done: 0, fatal: 1, cap: 3, errors: 4 });

// 오류 분류: "backoff"(10분 쉬고 이어 받기) / "cap"(오늘 한도) / "fatal"(즉시 중단: 키 오류, 알 수 없는 오류)
export function classify(err) {
  const m = String((err && err.message) || err || "");
  if ((err && err.name === "BudgetExceeded") || /LIMITED_NUMBER|LIMITED NUMBER|returnReasonCode 22|한도\(.*\) 도달/.test(m)) return "cap";
  if (/인증 거부|SERVICE_KEY|NOT_REGISTERED|DEADLINE_HAS_EXPIRED|UNREGISTERED/i.test(m)) return "fatal";
  if (/returnReasonCode 04|HTTP_ERROR|HTTP 429|HTTP 504|SERVICE_?TIMEOUT/i.test(m)) return "backoff";
  if (/timeout|aborted|ETIMEDOUT|ECONNRESET|fetch failed/i.test(m)) return "backoff"; // 504와 같은 성격의 응답 지연·연결 끊김
  return "fatal";
}

// items: 받을 목록, fetchOne(item) → 레코드 | null(빈 응답·자료 없음, 건너뜀) | throw
// save(item, rec), flush(state), progress(state, line, force) 는 호출자가 파일·콘솔에 쓴다
// sleep(ms), now() 는 시험에서 가짜 시계로 바꾼다
export async function runSlow({ items, fetchOne, save, flush, progress, sleep, now, opts = {} }) {
  const o = { ...SLOW, ...opts };
  const st = { total: items.length, fetched: 0, skipped: 0, remaining: items.length, consecutiveErrors: 0, errors: 0, lastError: null, state: "running", startedAt: now() };
  const line = () => `[기본정보 느린 수집] 받음 ${st.fetched} · 건너뜀 ${st.skipped} · 남음 ${st.remaining} · 오류 ${st.errors}(연속 ${st.consecutiveErrors}) · 마지막 오류 ${st.lastError ? st.lastError.msg : "없음"}`;
  let lastLog = now();
  const report = (force = false) => { if (force || now() - lastLog >= o.progressMs) { lastLog = now(); progress(st, line(), true); } else progress(st, line(), false); };
  const finish = (state, code) => { st.state = state; flush(st); progress(st, line() + ` → ${state}`, true); return { code, ...st }; };
  progress(st, line() + " → 시작", true);
  let i = 0;
  while (i < items.length) {
    await sleep(o.intervalMs);
    try {
      const rec = await fetchOne(items[i]);
      if (rec) { save(items[i], rec); st.fetched++; } else st.skipped++;
      st.consecutiveErrors = 0; i++; st.remaining = items.length - i;
      if (st.fetched % 50 === 0 && rec) flush(st);
      report();
    } catch (e) {
      const kind = classify(e);
      st.lastError = { at: now(), kind, msg: String(e && e.message || e).slice(0, 200) };
      if (kind === "cap") return finish("cap", EXIT.cap);
      if (kind === "fatal") { finish("fatal", EXIT.fatal); throw e; }
      st.errors++; st.consecutiveErrors++;
      flush(st); report(true);
      if (st.consecutiveErrors >= o.maxConsecErr) return finish("errors", EXIT.errors);
      await sleep(o.backoffMs); // 같은 단지를 10분 뒤에 이어서 받는다
    }
  }
  return finish("done", EXIT.done);
}
