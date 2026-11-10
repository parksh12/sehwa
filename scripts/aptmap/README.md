# 역세권 아파트 지도 데이터 파이프라인 (P2-63a)

기준: `부동산투자\아파트지도_업무요청서.md` v2의 3장(데이터 정의), 4장(처리 과정), 9장(검수). 숫자는 `logic.mjs`의 `RULES` 한 곳에만 있다.

## 파일
| 파일 | 하는 일 | 키 |
|---|---|---|
| `logic.mjs` | 순수 계산: 대표가격(중위값), 가격대, 하버사인·도보 분·배지, 단지명 정규화·2단계 매칭, UTM-K→WGS84, 최종 판정 | 없음 |
| `test.mjs` | 자동 시험(손계산 대조, 키 보호, 역 정리, 가짜 데이터 전체 흐름) | 없음 |
| `stations.mjs` | 레일포털 역사정보 XLSX(로그인 없음) → `data/stations.json`, `data/stations-check.md` | 없음 |
| `fetch-kapt.mjs` | `list`: K-apt 전국 단지 목록 / `basic`: 단지 기본정보(세대수·주소·사용승인일) | DATA_GO_KR_KEY |
| `fetch-trades.mjs` | 아파트 매매 실거래가 상세, 시군구 × 12개월(최근 3개월은 매번 다시) | DATA_GO_KR_KEY |
| `geocode.mjs` | 기본: 카카오 로컬 주소 검색(WGS84 바로, 변환 없음). 실패하면 도로명주소 검색으로 주소를 정규화해 다시 검색. 조건 통과 단지만, 캐시하고 새 단지만 호출(`--retry-fail`로 실패 재시도). 예전 경로 `--via juso`(좌표제공 API, UTM-K) | KAKAO_REST_KEY (+ 선택 JUSO_KEY) |
| `seed-geo.mjs` | 시드 단지만 실거래 지번 주소로 카카오 좌표 → report.md 「시드 역 거리」 표 (검수용, 시드 수만큼만 호출, 캐시) | KAKAO_REST_KEY |
| `make-data.mjs` | 캐시를 합쳐 `out/aptmap.json`(요청서 4-3 형식)과 `out/report.md`(일치율·시드 9곳·급변 경고) | 없음 |
| `net.mjs`, `xlsx.mjs` | 공통(키 확인·호출 한도·응답 해석), XLSX 읽기 | - |

## 실행 순서 (사이트 폴더에서)
```
node scripts/aptmap/test.mjs
node scripts/aptmap/stations.mjs
$env:DATA_GO_KR_KEY="..."            # PowerShell. 파일에 저장하지 않는다
node scripts/aptmap/fetch-kapt.mjs list
node scripts/aptmap/fetch-trades.mjs
node scripts/aptmap/fetch-kapt.mjs basic
$env:KAKAO_REST_KEY="..."; $env:JUSO_KEY="..."   # JUSO_KEY는 카카오 실패 시 주소 보정용(선택)
node scripts/aptmap/geocode.mjs
node scripts/aptmap/make-data.mjs
```
- 키가 없으면 무엇을 받아야 하는지 안내하고 종료 코드 2로 끝난다.
- 일일 한도에 가까워지면 저장하고 멈춘다. 다음 날 같은 명령을 다시 실행하면 이어서 받는다(`.cache/calls-날짜.json`).
- `.cache/`와 `out/`은 저장소에 올리지 않는다(`.gitignore`). `data/stations.json`은 올린다.

## 대표님 PC에서 키 파일로 실행 (P2-63a-2)
키는 저장소 밖 `C:\Users\user\.sehwa\aptmap.env`(KEY=값)에 있다. Node 20.6+ 내장 옵션으로 넘긴다. 키는 화면에 나오지 않는다.
```
node --env-file=C:/Users/user/.sehwa/aptmap.env scripts/aptmap/fetch-trades.mjs
node --env-file=C:/Users/user/.sehwa/aptmap.env scripts/aptmap/fetch-kapt.mjs basic   # 하루 4,800회까지, 다음 날 같은 명령으로 이어 받기
node --env-file=C:/Users/user/.sehwa/aptmap.env scripts/aptmap/geocode.mjs           # aptmap.env 에 KAKAO_REST_KEY 추가 후
node scripts/aptmap/make-data.mjs
```
- 광주·전남은 2026년 통합으로 시·도 코드가 12(전남광주통합특별시)다. 실거래 API도 12xxx로만 응답한다(옛 29·46 코드는 0건).
- `basic`은 대표가격 9억 미만 실거래 단지가 있는 법정동만 받고, 실거래 단지명과 비슷한 K-apt 단지를 먼저 받는다(`--all-price`로 끔).

## 기본정보 느린 수집 (`basic --slow`, P2-63a-2)
기본정보 V5가 30여 회마다 HTTP_ERROR 04·429·504로 끊길 때 쓴다. 오래 돌려도 되는 백오프 방식이다.
```
node --env-file=C:/Users/user/.sehwa/aptmap.env scripts/aptmap/fetch-kapt.mjs basic --slow
```
- 2초 간격으로 부른다. 04·429·504(응답 지연·SERVICETIMEOUT 포함)가 오면 10분 쉬고, 같은 단지부터 이어 받는다.
- 연속 6번 오류면 그날은 끝낸다. 하루 상한은 4,500회다.
- 진행 상황은 `.cache/basic-progress.json`에 매번 쓰고, 콘솔에는 30분마다 한 줄 남긴다.
- 종료 코드: 0 전부 받음 / 3 하루 상한 / 4 연속 오류 / 1 그 밖의 오류(키 오류 등, 즉시 중단) / 2 키·입력 없음
- 반복 로직은 `slow.mjs`에 있다. 시계와 호출을 밖에서 넣어 주는 구조라 `test.mjs`에서 가짜 시계로 시험한다.
