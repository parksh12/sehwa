// P2-74c 「커닝냥이 — 감독관을 피해서 만점을 맞아라!」(이름은 아래 NAME 한 곳) 규칙·점수·장면 데이터
// ★ 게임 제목·캐릭터 이름은 이 파일의 NAME 한 곳에서만 정함. 화면·원고(content/examcat.mjs)·메타·순위표 제목·결과 카드가 모두 여기서 가져감.
//   주소(/arcade/cunning-nyang/)와 파일 이름(examcat-*)은 이름 상수와 따로 둠.
// AI 시험 부정행위 논란을 풍자한 가상의 게임이며 실존 인물과 무관함. 등장 도구(단추 카메라·전송·꼬리 이어폰)는 과장된 가상 물건이고,
// 실제 기기의 작동 원리나 시험 회피 요령은 담지 않음(누르고 있으면 우스운 연출만 나옴).
// 규칙(P2-74c, 대표님 지시 「선생님 몰래 과자 먹기처럼」): 꾹 누르면 치팅, 떼면 숨김. 감독관이 볼 때 누르고 있으면 즉시 퇴장. 3분 버티면 완주.
(function () {
  const S = (window.EXCAT = window.EXCAT || {});
  const NAME = "커닝냥이"; // 대표님 확정(2026-11-17). 바꾸면 화면·원고·메타·순위표·결과 카드가 전부 따라 바뀜
  S.NAME = NAME;
  S.SUB = "감독관을 피해서 만점을 맞아라!";
  S.SLUG = "examcat"; // 저장 키·파일 이름·순위표 id(이름과 무관)

  // 시험 3분 고정. 누르고 있는 동안 치팅 게이지가 fill초 동안 찰칵 → 전송 → 정답 듣기 순서로 차고, 다 차면 정답 1개(게이지는 0부터 다시).
  // 손을 떼도 게이지는 그대로. 감독관이 보는 순간 누르고 있으면 즉시 퇴장.
  S.EXAM = { name: "냥국 자격시험", T: 180, fill: 4.0 };
  S.GAUGE = [
    { at: 0, label: "찰칵", say: "" }, // 단추 카메라로 시험지 찍기
    { at: 1 / 3, label: "전송", say: "전송 중…" },
    { at: 2 / 3, label: "정답 듣기", say: "정답은…" },
  ];
  // 점수(정수, 높을수록 좋음): 누르고 있던 시간 0.01초마다 1점 + 정답 1개마다 answer점 + 3분 완주 finish점.
  // 이론상 최대 = 180초 내내 누름(18000) + 정답 floor(180/4)=45개(22500) + 완주(3000) = 43500. 순위 상한(rank.js·Firebase 규칙)과 같음.
  S.SCORE = { perSec: 100, answer: 500, finish: 3000 };
  S.SCORE.max = S.EXAM.T * S.SCORE.perSec + Math.floor(S.EXAM.T / S.EXAM.fill) * S.SCORE.answer + S.SCORE.finish;

  // 감시는 시간이 갈수록 늘고 빨라짐(앞 감시는 그대로 남음). from = 시작 초, tell = 돌아보기 전 예고(초, 손을 떼기에 충분하게 0.6초 이상),
  // idle = 쉬는 시간 범위(초), fake = 예고만 하고 안 보는 가짜 동작 비율
  S.PHASES = [
    { from: 0, add: ["ta"], tell: 1.0, idle: [3.2, 4.4], fake: 0.1, board: "휴대폰은 가방에!", theme: "day", name: "조교 펭귄", desc: "칠판에 쓰다가 돌아봐요. 돌아보기 전에 고개를 갸웃(?)해요." },
    { from: 40, add: ["paper", "sleepy"], tell: 0.9, idle: [2.8, 4.0], fake: 0.2, board: "감독관 4명 배치 완료", theme: "noon", name: "신문 보는 부장 펭귄", desc: "신문 모서리가 접히고 눈이 보이면 진짜, 펄럭이기만 하면 가짜. (나머지 감독관 2명은 졸아요)" },
    { from: 80, add: ["cctv", "patrol"], tell: 0.8, idle: [2.4, 3.6], fake: 0.3, board: "CCTV 어제 새로 달았음", theme: "dusk", name: "CCTV와 안경 검사 펭귄", desc: "CCTV는 정해진 폭으로 왔다 갔다. 안경 검사 펭귄이 뒤로 오면 발소리가 커져요." },
    { from: 130, add: ["detector"], tell: 0.7, idle: [2.0, 3.2], fake: 0.35, board: "전파 탐지기 작동 중", theme: "hall", name: "전파 탐지기", desc: "오래 누르고 있으면 눈금이 차요. 가득 차면 경보와 함께 모두 돌아봐요." },
  ];

  // 결과 장면: 퇴장 3종(누가 봤나) + 완주 1종
  S.ENDS = {
    teacher: { kind: "out", name: "감독관에게 딱!", face: "cry", scene: "phone", text: "「책상 밑에서 뭐 하세요?」\n단추 카메라는 학기 끝나면 돌려준대요." },
    camera: { kind: "out", name: "CCTV에 딱!", face: "sweat", scene: "cctv", text: "어제 새로 단 CCTV의 첫 주인공.\n영상 속 내 꼬리는 너무 수상했다." },
    alarm: { kind: "out", name: "전파 탐지기 경보!", face: "dizzy", scene: "alarm", text: "삐-뽀-삐-뽀!\n가상의 AI가 말했다. 「저는 대신 시험을 볼 수 없어요.」" },
    finish: { kind: "end", name: "시험 종료! 완주", face: "blank", scene: "battery", text: "3분을 버텼다. 답안지는 정답으로 가득.\n그런데 시험장을 나서자 AI 배터리는 0%. 머릿속엔 아무것도 없다." },
  };
  S.MSG = "AI로 딴 점수는 내 실력이 아니다.";
})();
