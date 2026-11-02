// 사이트 전역 설정 — 이름·주소·광고 코드는 여기서만 바꾸면 전체에 반영됩니다.
// SITE_URL 환경변수로 덮어쓸 수 있습니다(예: 도메인 구매 후 SITE_URL=https://example.com).
const siteUrl = (process.env.SITE_URL || "https://parksh12.github.io/sehwa").replace(/\/$/, "");

export default {
  siteName: process.env.SITE_NAME || "펭귄 툴즈",
  tagline: "PDF·이미지·글자수·D-day, 자주 쓰는 툴 모음",
  siteUrl,
  basePath: new URL(siteUrl).pathname.replace(/\/$/, ""), // GitHub Pages 프로젝트 주소면 "/sehwa", 자체 도메인이면 ""
  operator: "세화산업",
  contactEmail: process.env.CONTACT_EMAIL || "aqaaq1@naver.com", // 대표님 지정 공개 문의 이메일(2026-11-02)
  adsenseClient: process.env.ADSENSE_CLIENT || "ca-pub-5127178209204980", // 대표님 애드센스 게시자 ID(2026-11-02). 머리말 자동 광고 스크립트 + ads.txt
  adsenseSlot: process.env.ADSENSE_SLOT || "", // 수동 광고 단위 ID(승인 후 애드센스에서 만들어 넣음). 비어 있으면 본문 광고 칸을 출력하지 않음(빈 상자 방지)
  gaId: process.env.GA_ID || "", // 예: "G-XXXXXXX"
  googleVerification: process.env.GOOGLE_VERIFICATION || "",
  naverVerification: process.env.NAVER_VERIFICATION || "",
  lang: "ko",
};
