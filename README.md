# 펭귄 툴즈 — 자주 쓰는 PDF·이미지·글쓰기·생활 계산 툴

세화산업 첫 웹사이트. 외부 패키지 없는 정적 사이트 생성기(Node 18+)로 만듭니다.
툴 라이브러리(pdf-lib, mammoth, fflate)는 npm 공식 배포본을 `src/assets/vendor/`에 직접 두고 해당 툴 페이지에서만 불러옵니다(CDN 안 씀). 버전·라이선스는 `src/assets/vendor/LICENSES.txt`.

## 빌드
```bash
node build.mjs            # dist/ 생성
```
설정은 `config.mjs` 한 곳에서 바꾸거나 환경변수로 덮어씁니다.

| 변수 | 설명 | 기본값 |
|---|---|---|
| `SITE_URL` | 최종 주소. 경로(basePath)도 여기서 자동 계산 | `https://parksh12.github.io/sehwa` |
| `SITE_NAME` | 사이트 이름 | `펭귄 툴즈` |
| `CONTACT_EMAIL` | 문의 이메일 | `contact@example.com` (**교체 필요**) |
| `ADSENSE_CLIENT` | `ca-pub-…` 넣으면 광고 영역·ads.txt 자동 생성 | 비어 있음 |
| `GA_ID` | GA4 측정 ID | 비어 있음 |
| `GOOGLE_VERIFICATION` / `NAVER_VERIFICATION` | 서치콘솔·서치어드바이저 소유 확인 메타 | 비어 있음 |

사이트 이름을 바꾸면 공유 이미지도 다시 만드세요: `python scripts/make-og.py "새이름"`

## 배포 (권장: Cloudflare Pages + 자체 도메인)
1. Cloudflare Pages → 이 GitHub 저장소 연결
2. Build command `node build.mjs`, Output `dist`
3. 환경변수 `SITE_URL=https://구매한도메인` 등 설정
> GitHub Pages는 미리보기용으로만. 광고 사이트 운영은 약관상 애매합니다.

## 구조
- `content/` 원고(ESM). `tools`(실용 툴 사용법·예시·한계·FAQ, 300자 미만이면 noindex), `personality`(16유형), `tti`(12띠 성격+2027 운세), `zodiac`, `guides`(툴 설명·해석·FAQ), `pages`(필수 페이지), `questions`(테스트 문항)
- `src/assets/` CSS·JS·이미지. 모든 계산·파일 처리는 브라우저 안에서만 수행(파일·입력값 전송·저장 없음)
  - `tool-kit.js` 툴 공통 틀(파일 넣기 → 처리·진행 표시 → 내려받기 → 다음 툴), `t-*.js` 툴별 코드
- 카테고리: `/pdf/` `/image/` `/text/` `/calc/` + 펭귄 놀이터 `/play/`(기존 `/me/` `/love/` `/luck/` `/story/` `/arcade/` 주소 그대로)
- `build.mjs` 페이지·sitemap.xml·rss.xml·robots.txt 생성. 본문 기준 미달 결과 페이지는 자동 noindex
- `seo-lastmod.json` sitemap `<lastmod>` 기록(페이지 내용 지문 + 실제로 바뀐 날). 로컬 `node build.mjs`가 갱신하므로 **페이지를 고친 커밋에 함께 넣으세요.** 배포(CI) 빌드는 읽기만 하고, 지문이 다르면 그날 날짜를 씁니다(P2-35)

## 콘텐츠 원칙
파일은 서버로 전송하지 않음(문구도 이 표현으로 한정) / 툴 작업 영역 안 광고 금지, 광고는 툴 상자 아래 높이 확보 / 툴 페이지 CSP meta / 놀이터는 재미로 보는 콘텐츠 고지 / 단정·보장 표현 금지 / 성격유형 검사 상표명 표기 안 함 / 실존 인물 이미지 금지
