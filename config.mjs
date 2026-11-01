// 사이트 전역 설정 — 이름·주소·광고 코드는 여기서만 바꾸면 전체에 반영됩니다.
// SITE_URL 환경변수로 덮어쓸 수 있습니다(예: 도메인 구매 후 SITE_URL=https://example.com).
const siteUrl = (process.env.SITE_URL || "https://parksh12.github.io/sehwa").replace(/\/$/, "");

export default {
  siteName: process.env.SITE_NAME || "펭귄 툴즈",
  tagline: "PDF·이미지·글자수·D-day, 자주 쓰는 툴 모음",
  siteUrl,
  basePath: new URL(siteUrl).pathname.replace(/\/$/, ""), // GitHub Pages 프로젝트 주소면 "/sehwa", 자체 도메인이면 ""
  operator: "세화산업",
  contactEmail: process.env.CONTACT_EMAIL || "contact@example.com", // TODO(대표님 결정): 공개 문의 이메일
  adsenseClient: process.env.ADSENSE_CLIENT || "", // 예: "ca-pub-0000000000000000". 비어 있으면 광고 영역 자체를 출력하지 않습니다.
  gaId: process.env.GA_ID || "", // 예: "G-XXXXXXX"
  googleVerification: process.env.GOOGLE_VERIFICATION || "",
  naverVerification: process.env.NAVER_VERIFICATION || "",
  lang: "ko",
};
