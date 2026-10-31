# 나알기 (가칭) — 나를 알아보는 재미있는 테스트

세화산업 첫 웹사이트. 외부 패키지 없는 정적 사이트 생성기(Node 18+)로 만듭니다.

## 빌드
```bash
node build.mjs            # dist/ 생성
```
설정은 `config.mjs` 한 곳에서 바꾸거나 환경변수로 덮어씁니다.

| 변수 | 설명 | 기본값 |
|---|---|---|
| `SITE_URL` | 최종 주소. 경로(basePath)도 여기서 자동 계산 | `https://parksh12.github.io/sehwa` |
| `SITE_NAME` | 사이트 이름 | `나알기` |
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
- `content/` 원고(ESM). `personality`(16유형), `tti`(12띠 성격+2027 운세), `zodiac`, `guides`(툴 설명·해석·FAQ), `pages`(필수 페이지), `questions`(테스트 문항)
- `src/assets/` CSS·JS·이미지. 모든 계산은 브라우저 안에서만 수행(입력값 전송·저장 없음)
- `build.mjs` 페이지·sitemap.xml·rss.xml·robots.txt 생성. 본문 기준 미달 결과 페이지는 자동 noindex

## 콘텐츠 원칙
재미로 보는 콘텐츠 고지 / 단정·보장 표현 금지 / 「MBTI」 명칭은 비공식 고지에만 / 실존 인물 이미지 금지 / 툴과 결과 사이 광고 금지
