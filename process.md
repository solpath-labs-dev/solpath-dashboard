# 개발 프로세스 로그

매일 작업한 내용을 날짜별로 남겨 **"어디까지 했지?" "오늘 뭐 해야 하지?"** 를 즉시 추적할 수 있게 합니다.

## 2026-04-25 — 재개: Properties 완료 → GitHub ⓪부터

### 오늘의 전제

- **GAS Script Properties**: `IMWEB_CLIENT_ID` / `IMWEB_CLIENT_SECRET` / `IMWEB_SITE_CODE` **이미 저장된 상태**를 전제로 함 (문서·채팅에 값 기입 금지).
- **지금 시작점**: 레코드상 Phase 1 ①은 끝난 셈이고, **이 워크스페이스·실제 작업 순서의 첫 단계는 GitHub 레포 만들기(⓪)** — `gh repo create` → 로컬 `git init` → `origin` / `mirror` → 첫 커밋 → 양쪽 `push`.
- **토큰**: 재발급 없이 기존 `gh auth` 사용.
- **구현**: 2026-04-24 일지 **「재작업 안내」**와 같이, 굵직한 규정은 유지하고 코드·명칭·API 매핑은 **실제 응답 JSON**으로 다시 맞춤.

### 작업 순서 (이 전제에 맞게)

1. **⓪ GitHub** — 개인 `eunsang9597/solpath-dashboard` + Org `solpath-labs-dev/solpath-dashboard` (이미 있으면 클론/remote만 맞춤), 로컬과 연결
2. **② A~D** — 하단 **「Phase 1 착수 플랜」**·SPEC §9.0: 스키마(실측) → 시그니처 → 의사코드 → `clasp push`·실run
3. **병행** — **Phase 1 실측 TBD**는 구현하면서 체크

### 다음 할 일 (체크용)

- [ ] ⓪ 레포 생성·로컬 git·양쪽 push (또는 기존 레포에 이 폴더 연결)
- [ ] 주문(및 품목) API **샘플 JSON** 저장·대조 후 §3.3 / §5.1.1 / GAS 매핑 1:1 점검
- [ ] A→B→C→D 한 사이클 후 **전 구간·청크 실run** + §2 Properties 키 표와 구현 동기화

---

## 2026-04-24 — Phase 1 GAS 원천 동기화·문서·깃

### 오늘 한 일

- **로그/예산(당일·후속)**: `imwebLogResponsePreview_` 가 주문 목록 응답 **전체**를 `JSON.stringify` 하면 수분 소요 → `syncIsOverBudget_` 전에 6분 한도로 끊김. `data.list` 는 **요약만** 로그, 본문 12KB 절삭. `RawSync` 에 GET 직후·주문/품목 처리 직후·page 사이 예산 검사, `imwebHasNextPage_` 로 마지막 page 종료, 청크 `curFrom` 비진행 시 throw. 정리 표는 위 **§원천(아임웹) — 구현(코드) 표** (중복 GAS.md 없음).
- **아임웹 주문 API `GET /v2/shop/orders`**: (1) `order_version=v2` 로 목록·단건 맞춤 — 주문관리 v2만 쓰는 쇼핑몰에서 기간이 맞아도 0건 나오는 문제 대응. (2) **한 요청 기간이 최대 약 3개월** — 초과 시 `code=-19`. **KST 00:00 기준** 달력 `ORDERS_SHOP_ORDERS_CHUNK_KST_DAYS`(89)일 단위로 청크, `SYNC_O_REF_`*+청크+`PAGE`+`I`로 이어쓰기.
- **소급 하한**: GAS `INITIAL_SYNC_FROM` 없을 때 `Config.ORDERS_DEFAULT_INITIAL_SYNC_FROM` = 사이트 개설일 `2025-09-30` (process §3·siteCode와 동일). Property는 덮어쓰기용.
- **문서·배포**: GAS 전용 md **새로 만들지 않음** — 본 문서(§원천 주문·§2 표)와 [gas/README.md](./gas/README.md)만 사용. 레포 **루트**에서 전역 `clasp push`; `npx @google/clasp@... push` 는 `access_token` 오류 유발(재현) — **금지**.

### 변경 이력

- [process.md / gas/README] **원천 주문·청크·v2** — 본 문서 + `gas/README` + `Config.gs`·`RawSync.gs` 가 정본.
  - 이유: 아임웹 -19·v2, KST 청크, clasp npx·디렉터리 실수 방지.
  - 영향: GAS `gas/*.gs`; 배포는 루트 `clasp push`.
  - 대체: 전기간 1요청(불가), v1-only(누락).

### 다음 할 일

- `syncRawFromImweb` 전 구간/청크 실run으로 시트·`sync_log` 검증(시간·쿼터)
- Script Properties 키 표 (`§2` 표) — 구현에 맞는 키만 유지·추가 반영

### 재작업 안내 (이 일지·당일 구현에 대한 후속 정리)

2026-04-24에 이어진 **구현 작업**(GAS 코드, 시트·필드 명칭, API 응답 → 스키마 매핑 등 세부)은 **AI 모델이 아임웹 API를 해석하는 과정에서 오류**가 났다. 실제 API에서 내려주는 `response` 데이터를 **끝까지 검증하지 않은 채** 환각이 나와, **없는 필드·구조가 있다고 착각**한 상태로 문서·코드가 어긋났다. 그래서 **세부 구현은 처음부터 다시** 한다.

- **그대로 둘 것**: 당일(및 그 전후에) 확정한 **굵직한 규정** — 레포·배포 원칙, Phase·문서 프로토콜, 원천 주문 동기화의 큰 뼈대(예: v2·KST 청크·런타임 예산 등 **정책·운영 수준**에서 이미 합의된 것).
- **다시 할 것**: 코드, 데이터·컬럼 명칭, 필드 매핑 등 **실제 JSON 응답을 근거로** 재검증·재작성.

---

## 작성 규칙

- 최신 날짜가 위로 오도록 작성 (역순)
- 각 날짜 블록: `오늘 한 일` / `주요 의사 결정` / `변경 이력` / `다음 할 일` / (필요 시) `이슈·메모`
- 체크박스 `- [ ]` / `- [x]` 로 "해야 할 일 → 완료" 흐름 표시

## 개발 프로토콜 (SPEC §9.0 참조)

각 Phase 착수 전 **A → B → C → D** 순서로 진행. 각 단계마다 이 문서에 기록.

### 변경 이력 기록 규칙 (★)

**모든 추가·변경·제거는 반드시 "이유"와 함께** 이 문서에 남긴다. 포맷:

```
### 변경 이력
- [SPEC §N.M] 무엇을 변경/추가/제거
  - 이유: 왜 (상황·배경)
  - 영향: 어느 화면/기능/데이터가 바뀌는가
  - 대체: 이전엔 어떤 방식이었는가 (제거·변경일 때)
```

이유를 남기는 목적: **"이게 왜 이렇게 되어있지?"를 나중의 우리가 묻지 않도록.**

## Phase 착수 체크리스트 (템플릿)

새 Phase나 큰 기능을 시작할 때 아래 템플릿을 해당 날짜 블록에 복사해서 채움.

```
## Phase N 착수 — YYYY-MM-DD

### A. 데이터 스키마
- [ ] 신규/변경 시트 목록: ___
- [ ] 컬럼 단위 확정 (이름 / 타입 / 제약 / 샘플값 / 설명)
- [ ] SPEC.md §5에 반영 완료
- [ ] 근거·이유 기록

### B. 함수 시그니처 / API 계약
- [ ] 신규 함수 / 엔드포인트 목록: ___
- [ ] 입출력 스키마 확정
- [ ] SPEC.md §7에 반영 완료

### C. 핵심 로직 의사코드 (필요 시)
- [ ] 복잡 로직: ___
- [ ] 엣지케이스 목록
- [ ] 수동 테스트 시나리오

### D. 구현
- [ ] 코드 작성
- [ ] 수동 테스트 결과
- [ ] 발견 이슈 · 후속 액션
```

---

## 사전 준비 (Phase 1 착수 전 체크리스트)

> **보안 원칙**: 아래 칸에 API Key / Secret / 비밀번호 등 민감 값은 **절대 기입하지 않는다**. 민감 값은 GAS Script Properties(또는 1Password)에 넣고, 이 문서엔 "발급 완료", "저장 완료" 같은 상태만 체크.
>
> 채우는 방법: 값이 있는 항목은 `- [x]` + 값, 아직 없으면 `- [ ]` 유지. 확정된 항목은 번호 옆에 `(확정)` 표시.

### 0) 자산 네이밍 (확정)


| 자산                     | 이름                                                  |
| ---------------------- | --------------------------------------------------- |
| GAS 프로젝트               | `solpath-dashboard-backend`                         |
| Google Sheets (마스터 DB) | `솔패스 대시보드 마스터 DB`                                   |
| 아임웹 개발자센터 앱 이름         | `솔패스 내부 대시보드`                                       |
| GitHub Organization    | `solpath-labs-dev` (2026-04-20 신규 생성, 개발 자산 전용 Org) |


**GitHub 레포 구조 (확정) — split 전략(최대 3개) + 현재(Phase 1) 실제**


| 레포                        | 역할                                                            | 생성 시점        | 개인 계정                                 | Org 계정                                     |
| ------------------------- | ------------------------------------------------------------- | ------------ | ------------------------------------- | ------------------------------------------ |
| `solpath-dashboard`       | **메타 · 문서 + GAS** — SPEC, README, process, `gas/`, 루트 `clasp` | ✅ 2026-04-24 | `eunsang9597/solpath-dashboard`       | `solpath-labs-dev/solpath-dashboard`       |
| `solpath-dashboard-back`  | (선택) GAS만 **별도** 레포 — **지금은 미사용** (코드는 위 `gas/`)              | 미생성          | (생성 시 동일 규칙)                          | (생성 시 동일 규칙)                               |
| `solpath-dashboard-front` | **프론트**: HTML/JS/CSS, jsDelivr 직접 호스팅                         | Phase 3 착수   | `eunsang9597/solpath-dashboard-front` | `solpath-labs-dev/solpath-dashboard-front` |


전부 **Public** (jsDelivr 호환 + 포트폴리오 노출 + 민감값은 Script Properties만 저장해서 안전). 각 레포는 **개인 계정·Org 계정 양쪽에 동일 내용을 공개**(커밋마다 2곳에 push). 모든 Org 레포는 `eunsang9597`가 Owner이므로 단일 `gh auth`로 양쪽 push 가능.

> **용어 주의**: GitHub 무료 플랜엔 "레포 자동 동기화(미러링)" 기능이 없음. 여기서 말하는 "양쪽 공개"는 **두 개의 독립 레포에 수동으로 같은 커밋을 push하는 운영 패턴**임. 로컬 `.git/config`의 remote 이름이 `mirror`인 건 단지 git 별칭(라벨)일 뿐, GitHub 기능과 무관.

### 1) 계정 · 명의 통일 (최우선)


| 서비스                    | 계정 이메일/ID                                                             | 명의 (사업자/개인)       | 플랜   | 비고                                                                 |
| ---------------------- | --------------------------------------------------------------------- | ----------------- | ---- | ------------------------------------------------------------------ |
| 아임웹 (관리자)              | [solpath.labs@gmail.com](mailto:solpath.labs@gmail.com)               | 개인사업자             | Pro  |                                                                    |
| Google (GAS+Sheets 소유) | [solpath.labs@gmail.com](mailto:solpath.labs@gmail.com)               | 사업자 계정(인증 정보: 개인) | Free |                                                                    |
| GitHub (개인 원본)         | `eunsang9597` ([eunsang9597@gmail.com](mailto:eunsang9597@gmail.com)) | 개인                | Free | 포트폴리오 커밋 그래프 누적, 모든 레포 원본의 커밋 주체                                   |
| GitHub (Org)           | `solpath-labs-dev` (2026-04-20 생성, 개발 자산 전용 Org)                      | 회사 자산             | Free | 2026-04-24 `eunsang9597`를 Owner로 초대·수락 완료 → 단일 gh auth로 양쪽 push 가능 |
| 카카오 비즈                 | [solpath.labs@gmail.com](mailto:solpath.labs@gmail.com)               | 개인사업자             | Free | 알림톡 발송용 - 메신저 비용 충전 가능                                             |


- 아임웹·Google·카카오비즈 3개는 **사업자 명의 통일**, GitHub는 **개인 계정 + Org 계정 양쪽에 Public 공개** (포트폴리오 + 조직 자산 병행 목적)
- 기존 `solpath-labs` User 계정은 별개 용도로 존속, 본 프로젝트와 무관

### 2) Google — GAS + Sheets ✅ 완료 (2026-04-20)


| 항목          | 값                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| GAS 계정      | `solpath.labs@gmail.com` (Workspace, 직원 포함)                                                                        |
| 마스터 시트 위치   | My Drive (추후 공유 드라이브 검토)                                                                                           |
| GAS 프로젝트명   | `solpath-dashboard-backend`                                                                                        |
| Web App URL | `https://script.google.com/macros/s/AKfycbwCGKcZFAsh9cW7sHG5dKPvFVg0QRjy5rr84PbJugk5raXjXX9PpYVSzjbSzbzEZE6P/exec` |
| 배포 검증       | URL 직접 열어 `ok` 응답 확인 완료                                                                                            |


**Script Properties 키 네이밍 컨벤션 (확정)**

> 인증·설정 관련 값은 **모두 GAS Script Properties에 저장**하고 문서엔 값이 아니라 "키 이름"만 적는다. 단일 규칙 유지로 실수 유출 방지.
>
> 네이밍 규칙: `UPPER_SNAKE_CASE`, 도메인 프리픽스(`IMWEB_`, `SHEETS_`, `NOTIFY_`, `DASHBOARD_`).


| 키                         | 용도                                                                                 | 설정 시점                |
| ------------------------- | ---------------------------------------------------------------------------------- | -------------------- |
| `IMWEB_CLIENT_ID`         | 아임웹 앱 Client ID                                                                    | 아임웹 앱 생성 직후          |
| `IMWEB_CLIENT_SECRET`     | 아임웹 앱 Client Secret                                                                | 아임웹 앱 생성 직후          |
| `IMWEB_SITE_CODE`         | 테스트 사이트 연동 시 받는 siteCode                                                           | 사이트 연동 콜백 수신 시 자동 저장 |
| `IMWEB_ACCESS_TOKEN`      | API 호출용 액세스 토큰                                                                     | Auth.gs가 자동 발급/갱신    |
| `IMWEB_REFRESH_TOKEN`     | 토큰 갱신용                                                                             | Auth.gs가 자동 발급/갱신    |
| `IMWEB_TOKEN_EXPIRES_AT`  | 액세스 토큰 만료 타임스탬프 (ms)                                                               | Auth.gs가 자동 업데이트     |
| `SHEETS_MASTER_ID`        | 마스터 스프레드시트 ID                                                                      | 마스터 시트 생성 직후         |
| `SHEETS_BACKUP_FOLDER_ID` | 주간 백업 저장 폴더 ID                                                                     | Phase 6              |
| `NOTIFY_ERROR_EMAIL`      | 에러 알림 수신 이메일                                                                       | Phase 1              |
| `DASHBOARD_ACCESS_TOKEN`  | 프론트 ↔ GAS Web App 인증용 공유 토큰                                                        | Phase 3 (프론트 임베드 직전) |
| `INITIAL_SYNC_FROM`       | (선택) 소급 하한 덮어쓰기 YYYY-MM-DD. **없으면** `Config.ORDERS_DEFAULT_INITIAL_SYNC_FROM`(개설일) | 필요 시                 |


**주의**

- 값은 **반드시 GAS 편집기 → 프로젝트 설정 → Script Properties**에만 입력. 코드나 문서에 하드코딩 금지.
- 새 키 필요 시: 이 테이블에 **키 이름·용도·설정 시점** 3개 열만 먼저 추가하고(값은 쓰지 말기), `변경 이력`에 이유 기록.

#### 원천(아임웹) 주문·데이터 누적 — 규정 (2026-04-24)

> **의도**: 일상 운영에서 “코드(clasp) 수정”으로 기간·재수집을 조절하지 않는다. 시스템이 완성된 뒤에도 **속성 + UI(선택) + GAS** 조합으로만 맞춘다.

**Phase 1 (지금) — “처음부터 쌓기”**

- **데이터 하한(소급 시작일)** 은 `INITIAL_SYNC_FROM`(YYYY-MM-DD) 한 번 잡는다. (예: 사이트 개설일 `2025-09-30` — 위 §3 아임웹 표와 동일 의미)
- GAS `getOrderDateRange_` / `Config`: `**ORDERS_SYNC_INCREMENTAL` 기본 false** — (Script Property `INITIAL_SYNC_FROM` | 없으면 코드 `ORDERS_DEFAULT_INITIAL_SYNC_FROM` = 사이트 개설일) **~ 지금** 전 구간을 매번 질의(주문은 PK upsert로 중복 시 덮쓰기). **증분만** 쓰려면 Script Properties `ORDERS_SYNC_INCREMENTAL`=`true` 또는 `Config` 기본을 `true`로.(워터마크 `LAST_ORDERS_ORDER_DATE_TO` 는 증분 모드에서만 의미 있음.)
- **워터마크** `LAST_ORDERS_ORDER_DATE_TO` 는 **주문 동기화가 한 번이라도 끝까지 성공**하면 자동 갱신된다. 이후 `ORDERS_SYNC_INCREMENTAL` 이 켜져 있으면 **마지막 성공 시점 이후**만 이어서 당긴다(“항상 처음부터” 아님).
- **초기 백필**은 기간이 길면 GAS 6분·대역폭·PARTIAL 이어쓰기로 **여러 번 실행**해도 됨(체크포인트로 이어감).

**구현(코드) — GAS, 한곳에만 정리** (별도 GAS.md **추가하지 않음** — 여기 + [gas/README.md](./gas/README.md))


| 항목                       | 동작 (소스)                                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 엔트리                      | `syncRawFromImweb` — members → products → `syncOrdersAndLineItems_` (주문+품목)                                                                                                                              |
| 하한 / 논리 구간               | `getOrderDateRange_` + `getInitialOrderFromUnix_` — Property `INITIAL_SYNC_FROM` 없으면 `Config.ORDERS_DEFAULT_INITIAL_SYNC_FROM` (= 개설일)                                                                   |
| 주문 `GET /v2/shop/orders` | `order_version` 기본 v2 (Property `ORDERS_LIST_ORDER_VERSION`). 1요청 ≈3개월 초과 시 `code=-19` → KST 00:00·`ORDERS_SHOP_ORDERS_CHUNK_KST_DAYS`일 청크. `SYNC_O_REF_*`+청크+`SYNC_O_PAGE`/`SYNC_O_I` 이어쓰기.             |
| 실행·예산                    | `SYNC_MAX_RUNTIME_MS`>0(기본 4.5분)이면 `syncIsOverBudget_` — 목록 **GET 응답 직후**·주문 1건(품목까지) 직후·다음 page 전에 검사. `SYNC_TIME_BUDGET` → `sync_log` PARTIAL, `SYNC_O_*` 유지, **다시 실행**으로 이어감. (GAS **6분**은 더 짧을 수 있음) |
| Logger                   | `imwebLogResponsePreview_` — `data.list` 는 **전체 body stringify 금지**(수분 걸려 예산이 **소비되기도 전**에 6분 한도). 요약(건수·paging·첫/끝 `order_no`)·그 외 응답 12KB 절삭.                                                          |
| 페이징                      | `imwebHasNextPage_` — `has_next` 등 있으면 마지막 page에서 break.                                                                                                                                                 |
| 청크 진행                    | 다음 청크 `curFrom`이 안 늘면 `throw`(무한 루프 방지).                                                                                                                                                                 |
| 품목                       | `.../prod-orders` 는 `order_version: v2` (기존)                                                                                                                                                             |
| 배포                       | 레포 **루트** `clasp push`. `npx @google/clasp@...` 로 clasp 돌리지 말 것(`access_token` 꼬임 재현).                                                                                                                   |


**이후(정책·UX 확정 뒤) — 구현 시 빼먹지 말 것 (체크리스트만, 당장 구현 강제 아님)**

- **최근 N일만 재수집**(운영 “살짝 밀기”): 대시보드 **데이터 Refresh** 등에서 N일(또는 from~~to)을 받아 `order_date_from~~to` 를 그만큼만 넘기고, 주문/품목은 **upsert**로 겹쳐 쓰기(동일 PK 덮쓰기).
- (선택) **일회용 구간**을 Script Properties로만 제어: 예) `ORDERS_MANUAL_FROM` / `ORDERS_MANUAL_TO` 넣고 싱크 1회 후 키 삭제 — **코드 배포 없이** 운영이 조절.
- (선택) GAS **Run 전용** 공개 함수(이름 끝 `_` 없음): `refreshOrdersLastDays(n)` 식 — 편집기에서만 써도 됨; 나중에 Web App / 대시보드가 같은 로직 호출.
- **전체 다시**가 필요할 때: `resetSyncCheckpoints` + (필요 시) `LAST_ORDERS_ORDER_DATE_TO` 삭제 + `INITIAL_SYNC_FROM` 유지/조정 — **데이터 정책 먼저** 합의 후.

**절대 금지(운영 루틴)**

- “기간 조금 바꾼다”는 이유로 **레포 코드만** 고치는 방식(배포 의존) — 예외는 초기 GAS/스펙 합의된 상수·버그픽스뿐.


| Script Properties (추가·예정은 구현할 때 이 표에 키만 먼저 올릴 것) | 용도                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| `INITIAL_SYNC_FROM`                              | (선택) 소급 하한 YYYY-MM-DD — 없으면 `Config.ORDERS_DEFAULT_INITIAL_SYNC_FROM`(개설일) |
| `LAST_ORDERS_ORDER_DATE_TO`                      | (GAS 자동) 직전 성공 주문 sync 의 `order_date_to` (unix 초), 증분용                     |
| `ORDERS_SYNC_INCREMENTAL`                        | `true` / `false` — Code 기본 덮어쓰기                                            |
| `ORDERS_LIST_ORDER_VERSION`                      | `v1` / `v2` — 목록·단건 `order_version` (기본 v2)                                |
| `SYNC_O_REF_FROM` / `SYNC_O_REF_TO`              | (이어쓰기) 주문 전체 논리 `ref` 구간 (unix 초)                                          |
| `SYNC_O_FROM` / `SYNC_O_TO`                      | (이어쓰기) 현재 API에 넣는 청크 (unix 초)                                              |
| `SYNC_O_PAGE` / `SYNC_O_I`                       | (이어쓰기) 청크 내 page·orders 배열 인덱스                                             |
| `ORDERS_MANUAL_FROM` / `ORDERS_MANUAL_TO`        | (선택·미구현) 일회 백필/구간·싱크 후 삭제                                                  |


### 3) 아임웹 — 개발자센터 + 앱 등록 ✅ 완료 (2026-04-20)

> **등록 방식**: 앱스토어 공개 승인 X. 클라이언트 사이트를 테스트 사이트로 연동해 내부용으로만 사용 (공식 지원 방식).


| 항목                              | 값                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| 고객 대면 도메인 (임베드 대상)              | `solpath.co.kr`                                                                         |
| 아임웹 내부 슬러그                      | `transfersolutionteam.imweb.me` (관리자 진입 URL, 사이트명 내부 표기 "솔루션편입 | 온라인편입컨설팅 전문" — 리브랜딩 전) |
| 사이트 개설일 (= `INITIAL_SYNC_FROM`) | `2025-09-30`                                                                            |
| siteCode                        | 확보 완료 → `IMWEB_SITE_CODE` 키로 Script Properties **저장됨(값은 문서 비기재)**                       |
| 서비스 URL                         | 위 §2 Web App URL (차후 Phase 3에서 프론트 CDN URL로 교체 예정)                                      |
| 리다이렉트 URI                       | 동일 (단일 등록)                                                                              |
| 앱 이름                            | `솔패스 내부 대시보드`                                                                           |
| Client ID / Secret              | 발급 완료 → `IMWEB_CLIENT_ID`, `IMWEB_CLIENT_SECRET` **저장됨(값은 문서 비기재)**                     |
| 요청 권한 (scope) — **read only**   | ✅ 사이트정보(필수·고정) / 회원정보 / 상품 / 주문 / 결제 / 프로모션 / 커뮤니티                                      |
| 제외된 scope                       | ⛔ 스크립트(Script) — 사이트 전 영역 스크립트 삽입 권한, 보안상 활성화 금지                                        |


**사전 준비 체크리스트 (완료)**

- 개발자센터(developers.imweb.me) 가입 완료
- 앱 생성 완료 (앱 이름 · 서비스 URL · 리다이렉트 URI 등록)
- API scope 설정 완료 (read only 7개, Script 제외)
- 앱 테스트 기능을 통해 **테스트 사이트 연동 완료** → siteCode 확보
- Client ID / Client Secret 발급 확인 완료
- Script Properties에 3개 키(`IMWEB_CLIENT_ID`, `IMWEB_CLIENT_SECRET`, `IMWEB_SITE_CODE`) **저장 완료(2026-04-24)**

**Phase 1에서 코드로 처리할 것들 (여기선 체크 X)**

- `연동완료처리 API` 호출 (`ImwebApi`·`Auth`·`RawSync` 루트 흐름에서 확인) — 미호출 시 다른 API 전부 막힘
- Rate Limit 실측 (공식 문서에 명시 없으면 호출 실험으로)
- 테스트 주문 필요 여부 결정 (실데이터로 충분 vs 더미 생성)
- API 버전 확인 (v2 단독 / v1·v2 혼용)
- Scope 세부 (커뮤니티 read는 TBD-31 리뷰 API 확인 후 결정)

### 4) GitHub 레포 — split 전략, 단계별 생성

**구조 (확정)**: 개인 계정(`eunsang9597`)과 Organization(`solpath-labs-dev`, 2026-04-20 생성, 개발 자산 전용) **양쪽에 동일 내용을 Public 공개**. 레포는 역할별 3개로 분리.


| 레포                        | 역할                                          | 개인 계정                                 | Org 계정                                     | 생성 시점         |
| ------------------------- | ------------------------------------------- | ------------------------------------- | ------------------------------------------ | ------------- |
| `solpath-dashboard`       | 메타·문서 **+** `gas/` GAS(루트 `clasp`, Phase 1) | `eunsang9597/solpath-dashboard`       | `solpath-labs-dev/solpath-dashboard`       | ✅ 2026-04-24  |
| `solpath-dashboard-back`  | (선택) GAS만 별도 분리 시 — **현재 미생성**              | `eunsang9597/solpath-dashboard-back`  | `solpath-labs-dev/solpath-dashboard-back`  | 미생성           |
| `solpath-dashboard-front` | 프론트 코드 (jsDelivr 호스팅)                       | `eunsang9597/solpath-dashboard-front` | `solpath-labs-dev/solpath-dashboard-front` | 🔜 Phase 3 착수 |


> **Org 명칭 선택 이유 (`-dev` 접미사)**: Org를 역할별로 분리 관리할 예정 — `-dev`는 개발·코드 자산 전용. 차후 확장 여지: `solpath-labs-ops`(운영 자동화), `solpath-labs-design`(디자인 에셋), `solpath-labs-docs`(외부 공개 문서) 등 역할 단위로 Org 추가. 본 프로젝트 관련 모든 레포는 `solpath-labs-dev`에 귀속.
>
> **Org Owner (✅ 2026-04-24)**: `eunsang9597` **Owner** 초대·수락 완료. 개인 `origin` + Org `mirror`에 동일 `main` push 가능.

**이유 (split 채택)**:

- 프론트는 jsDelivr CDN 경유 직접 제공 필요 → 독립 레포가 URL 경로·캐시 관리 측면에서 유리 (`cdn.jsdelivr.net/gh/<owner>/solpath-dashboard-front@<tag>/...`)
- GAS+`clasp`는 *원래* 백 전용 레포 루트에 두는 안이 깔끔하지만, **Phase 1**에는 메타 레포 `gas/`+루트 `.clasp.json`으로 **한 번에** 맞춤; `**-back` 분리**는 리포 루트를 문서-only로 둘 때 선택
- 문서·수집 코드 변동이 다르면 커밋/릴리즈를 나누기 쉬움
- 포트폴리오 관점에서도 "프론트 구현 성과"와 "설계·문서"를 별도 레포로 보여주는 게 구분이 명확함
- 양쪽 계정 push 자동화(GH Actions)도 레포별로 독립 적용 가능

**이유 (Org 별도 생성 vs 기존 `solpath-labs` User 활용)**:

- 기존 `solpath-labs`는 User 계정(다른 개인 용도)으로 이미 쓰이고 있어 회사 자산 전용 공간과 혼재됨
- User → Org 변환은 되돌릴 수 없고 기존 자산에 영향 → 안전하게 **새 Organization 신규 생성** 경로 선택
- `eunsang9597` 개인 계정이 Org Owner가 되어 **단일 gh auth**로 개인·Org 양쪽 push 가능 (Collaborator 초대 없이)

**Public 공개 안전성**:

- Client Secret 등 민감 값은 코드/문서 아닌 GAS Script Properties에만 (규칙 §2)
- Client ID · siteCode 등 semi-public 값도 단일 규칙 유지 위해 동일하게 Properties 관리 (문서에 실값 기재 금지)
- `.gitignore` 기본 세팅 (Phase 1 초기): `.env`, `credentials.json`, `.clasprc.json`, `*.key`, `*.pem` 등
- GitHub Secret Scanning 자동 활성화 (Public 레포 기본)
- 실제 회원 PII가 섞인 스크린샷·샘플 CSV는 절대 커밋 금지

**양쪽 계정 동기화 방식**:

- 초기: 수동 2-remote push — 커밋 시마다 `git push origin main && git push mirror main`
(`origin` = 개인 계정, `mirror` = Org 계정. `mirror`는 git remote 별칭일 뿐 GitHub의 기능 이름 아님)
- 향후 (Phase 3 말 또는 자동화 필요 시점): GH Actions로 `origin` push → Org 계정 자동 복제 전환

### 5) 알림 채널 — Phase 1에서 확정

- 에러 받을 이메일 주소: `__________` → `NOTIFY_ERROR_EMAIL`
- 카카오 알림톡은 Phase 6에서 확장 검토 (현재 단계에선 이메일로 충분)

### 6) 기존 데이터 이관 준비 — Phase 5 전까지

- 상담 DB 스프레드시트 URL: `__________`
- 상담 DB 컬럼 구조 (스크린샷 또는 컬럼 리스트)
- 상담자 ↔ 아임웹 회원 매칭 키 (연락처/이름/기타)
- 현재 아임웹 상품 명단 + 내부 카테고리 매핑 초안 (CSV/엑셀)

---

## 2026-04-24 (금) — GAS: 아임웹 원천 동기화 안정화·6분 런타임 우회

### 오늘 한 일 (로컬·채팅에서 반영한 내용 요약)

- `**gas/appsscript.json`**: `oauthScopes` — `script.external_request`, `spreadsheets`, `drive` (UrlFetch·시트; 재승인 필요할 수 있음).
- `**Auth.gs**`: 쇼핑몰 Open API `IMWEB_API_KEY`+`IMWEB_SECRET_KEY` → `v2/auth` 흐름; `**getImwebAccessToken_`의 `hasKeySecret**` 를 `imwebGetTokenByKeySecret_`와 같은 k/s 조합( `API_KEY`/`SECRET_KEY`/`LEGACY`/`CLIENT_*` )으로 통일 — **MALL 키만** 넣은 경우 캐시 만료 뒤 토큰 재발급이 막히던 문제 수정.
- `**ImwebApi.gs`**: HTTP GET `access-token` 헤더(아임웹 문서·curl 예시; Bearer 아님); JSON `code<0` 오류; `**code=-7**` 백오프 재시도; `**code=-2**` 캐시 무효화 후 동일 GET 1회 재시도; UrlFetch 예외 `**Bandwidth quota exceeded**` 등(대역폭·쿼터) 전용 대기·재시도; 회원/상품 목록용 페이지 간 `IMWEB_HEAVY_LIST_PAGE_SLEEP_MS`·`IMWEB_PAGE_SLEEP_MS` 상향(대역폭緩和).
- `**RawSync.gs**`: GAS **6분 실행 상한**은 제거 불가(무료/유료로 “한 러닝 6분 연장” 아님). 대신 `**SYNC_MAX_RUNTIME_MS`**(기본 4.5분) **안**에서 **스스로 멈춤** → Script Properties `**SYNC_*`** 에 단계(m/p/o)·페이지·주문 이어쓰기 → `**syncRawFromImweb` 를 다시 실행**하면 이어감( **시간 기반 트리거 슬롯이 없어도** 수동 `실행`만으로 동일). `PARTIAL` / 끝나면 `OK` / 전부 초기화: `resetSyncCheckpoints()`.
- `**Config.gs`**: `IMWEB_RATE_LIMIT_*`, `IMWEB_BANDWIDTH_*`, `SYNC_MAX_RUNTIME_MS`, `PROP_SYNC_*` 등.

### 주요 의사 결정

- **6분 “해결”**이 아니라, **6분 런타임 에러로 죽지 않게** 일부러 **일찍 끊고** **여러 번 호출(같은 함수)**로 풀 싱크를 완성하는 쪽이 현실적(트리거 없이도 수동 반복 실행 가능).
- `SYNC_MAX_RUNTIME_MS = 0` 이면 이어쓰기·예산 **끔** — 한 러닝 끝까지(최대 6분·그 전 대역폭/아임웹 제한은 그대로).

### 변경 이력

- [GAS] **인증·Imweb GET·원천 싱크 루프** + **6분 `Exceeded maximum execution time` 우회(자체 상한 + 체크포인트)**
  - 이유: 잘못된 키 판정, 토큰/헤더/—7/—2, 대용량·멤버 페이징·UrlFetch 대역폭, GAS 6분.
  - 영향: `sync_log`, Script Properties, 아임웹·Sheets 호출·실행 횟수.
  - 대체: **한 번의 긴 실행**으로 풀 싱크 → **예산 내 분할 + Properties 이어쓰기 + 다회 실행** (트리거 필수 아님).
- [process.md §2 사전준비] **원천(아임웹) 주문·데이터 누적 규정** — Phase 1은 `INITIAL_SYNC_FROM`·워터마크·증분 원칙, “코드로만 기간 조절” 금지; 추후 N일 리프레시·수동 from~to·Run용 함수는 **체크리스트**만 (구현은 정책·UX 정한 뒤).

### 다음 할 일

- `clasp push` + git `main` → `origin` / `mirror` (2026-04-24)
- 실제: `syncRawFromImweb` → `PARTIAL` 시 재실행 → `OK` 스모크, 이전 `SYNC_*` 잔여 있으면 정리
- (선택) `SYNC_MAX_RUNTIME_MS` 3~4분으로 더 보수(여유 마진) vs 한 번에 처리량
- **order_items**: `items[]` 복수 시 **행 분할 안 함** — `items_json`에 배열 전체, `line_*`·`prod_no`는 `items[0]` 요약 (SPEC §5.1.1, `CODE_SCHEMA_VERSION` 2, `setupMasterDatabase` 로 1행 헤더 갱신)

---

## 2026-04-24 (금) — SPEC §5.0 스프레드시트 파일 분리

### 주요 의사 결정

- 운영/파생·집계 탭이 많아지면 **한 스프레드시트에 모으지 않고, 새 Google 스프레드시트(파일)를 추가**하는 것을 원칙으로 함. 원천(아임웹) **4시트+sync_log만** 기존 마스터 1파일에 유지. 연결은 Script Properties에 스프레드시트 ID.

### 변경 이력

- [SPEC §5.0, v0.3.5] **스프레드시트 파일 분리 원칙** 추가, §5.2·§5.3에 배치 메모.

---

## 2026-04-24 (금) — GAS: setupMasterDatabase

### 오늘 한 일

- `gas/Setup.gs`: `**setupMasterDatabase`** — 스프레드시트 없으면 `솔패스 대시보드 마스터 DB` 생성, `members`/`orders`/`order_items`/`products`/`sync_log` 탭+§5.1.1 헤더(공통 2열 포함). `SHEETS_MASTER_ID`·`MASTER_DB_SCHEMA_VERSION` Script Properties. `CODE_SCHEMA_VERSION` 올리면 1행만 갱신.
- IMWEB 3키는 사용자가 이미 Properties에 넣은 상태(문서/코드에 값 없음).

### 다음 할 일

- `clasp push` → 편집기 `setupMasterDatabase` 실행 1회

---

## 2026-04-24 (금) — clasp (GAS 동기화)

### 오늘 한 일

- **clasp** 설치 확인(3.1.3), `clasp list`로 기존 스크립트 **solpath-dashboard-b…** 식별 → `clasp clone <scriptId> --rootDir gas`
- 레포 루트에 `.clasp.json` (`rootDir: gas`, `scriptId` 커밋 대상), `gas/Code.js`·`gas/appsscript.json` 클론
- `gas/README.md`에 `push`/`pull` 사용법 정리. `.gitignore` 주석에 clasp 토큰은 `~/.clasprc.json`만 비커밋 명시

### 다음 할 일

- `clasp push` → 편집기에서 `**setupMasterDatabase`** 실행 → 마스터 시트 + `SHEETS_MASTER_ID` 확인
- Phase 1(진행): `ImwebApi`·`RawSync`·수집 루프·`clasp push`(레포 루트)

---

## 2026-04-24 (금) — 원천 ER (Mermaid)

### 오늘 한 일

- SPEC v0.3.4: §5.1 **원천 엔티티 관계** — `members`·`orders`·`order_items`·`products` Mermaid `erDiagram` 3관계 + 비회원(주문자 회원코드 공란) 메모.

### 변경 이력

- [SPEC §5.1, v0.3.4] **원천 시트 ER 다이어그램**
  - 이유: PK/FK 표만으로는 관계 한눈에 보기 어려움. 온보딩·GAS 구현 시 참조.
  - 영향: 문서 렌더링(Markdown 뷰어)에서 Mermaid 지원 시 다이어그램 표시.

### 다음 할 일

- GAS 수집 1차 구현(로컬·`clasp`·편집기) — `RawSync`·`ImwebApi` 기준(2026-04-24, 실run·튜닝은 계속)

---

## 2026-04-24 (금) — 원천 시트 컬럼 정의 (Phase 1 A)

### 오늘 한 일

- **SPEC v0.3.3**: §5.1에 **데이터 층위** 추가(0 원천 / 1 운영·`enrollments` 등 / 2 `agg_*`). 통계·내보내기 아웃풋은 원천만이 아니라 **운영 시트 + 집계 캐시**까지 설계·갱신이 필요함을 문서에 명시.
- **§5.1.1** 신설: `members` 13 + 공통 2(선택) / `orders` 10 / `order_items` 14(라인 `line_*` 접두) / `products` 12, PK·FK, `fetched_at`·`source_sync_id`. `order_items`·API `items[]` **다건(2026-04-24 확정)**: **1 품목주문 = 시트 1행**, 행 분할 없음. `items_json`에 `items[]` 전체, `line_*`·`prod_no`는 `items[0]` 스냅샷(§3.3.3, 상단 2026-04-24 일지·아래 GAS 일지와 동일).
- **§5.4** TBD: 원천 4시트는 §5.1.1 **확정**으로 수식 변경.

### 변경 이력

- [SPEC §5.1, §5.1.1, §5.4, v0.3.3] **원천 Sheets 컬럼 정의서·데이터 층위**
  - 이유: 수집(GAS) 구현 직전에 1행 헤더·타입·키를 고정하지 않으면 `setValues`·마이그레이션이 반복된다. 통계용 DB(자체 적는 시트)는 `enrollments`·`agg_*`로 층을 나눠 Phase 2~에서 별도 스키마로 확정.
  - 영향: 마스터 스프레드시트에 탭+헤더를 그대로 복사해 생성 가능. 다음은 Script Properties + GAS fetch.

### 다음 할 일

- **GAS** `ImwebApi` + `RawSync` + `order_items` 루프(주문·`prod-orders`)(1차, 2026-04-24)
- (선택) `items[]` 2건 이상 실주문이 있으면 `items_json`·`options_count`·집계가 기대대로인지 `sync_log`/시트로만 검증
- (Phase 2) `enrollments`·`product_mapping`·`agg_*` 컬럼 정의서(별 섹션)

---

## 2026-04-24 (금) — API 필드 인벤토리 문서화

### 오늘 한 일

- **SPEC §3.3~3.3.5·§5.1·§5.5·§5.6** 갱신: Members / Orders / `order_items` / Products API 응답 필드 중 **Sheets에 적재할 컬럼**을 문서에 확정 반영 (v0.3.2).
- **대화 중 합의 사항 정리**: `uid` = 로그인 ID(이메일일 수 있음) → `email` 별도 수집 없음; 추천인 2필드 저장·UI 비노출; 주문은 `orders`(합산) + `order_items`(라인·클레임·옵션) 이중 저장; `options_count` = `value_name_list` 항목 수 합(b); 옵션 N계열 가격 미수집·라인 `price` 검증; 사은품 플래그 미수집·0원으로 집계 제외; Products 12필드·판매기간·`price_none`·`etc` 미수집.
- 원천 시트가 `order_items`를 포함하도록 §5.5 lock 목록·§5.6 PII 문구(이메일 열 제거) 동기화.

### 변경 이력

- [SPEC §3.3~3.3.5, §5.1, §5.5, §5.6, 명세 버전 v0.3.2] **아임웹 API 응답 필드 인벤토리 및 원천 시트 정의 반영**
  - 이유: 스키마 설계 전에 API 실제 필드·중첩 구조·제외 필드를 확정해 두지 않으면 시트·GAS·집계가 반복 수정된다. `GET /v2/shop/orders/{order_no}/prod-orders`가 주문·매출·환불의 실질 소스인 점을 명시.
  - 영향: Phase 1 A(컬럼 정의서)는 §3.3을 정본으로 삼으면 됨. `enrollments`·집계는 `order_items` + `product_mapping` + 운영 입력 시작일 조합. 환불은 주문 본체만으로는 부족하고 **품목 `claim_*`** 기반이라는 점이 문서화됨.
  - 대체: 이전엔 §5.1이 추상적(결제수단·환불일 등)으로만 기술되어 API 구조와 불일치. §3.3으로 대체·구체화.

### 다음 할 일

- Phase 1 A: §3.3 기준 **Sheets 컬럼명·타입·PK/FK 1:1 정의** → **§5.1.1로 이관·완료** (v0.3.3)
- GAS(1차): `order_items`·주문 list·`orders` upsert — `RawSync` 기준(2026-04-24, 실run 검증·튜닝은 계속)
- (선택) `product_mapping`에 기간 규칙 열(§3.3.5) Phase 2 전 초안

---

## 2026-04-24 (금)

### 오늘 한 일

**⓪ GitHub 레포 `solpath-dashboard` (메타·문서) 세팅 완료**

1. `solpath-labs-dev` Org에 `eunsang9597`를 Owner로 초대·수락 → 단일 `gh auth`로 개인·Org 양쪽에 push 가능한 상태 확보
2. `gh auth login` 완료 (scopes: `gist`, `read:org`, `repo`, `workflow`)
3. 개인 계정 레포 생성: `eunsang9597/solpath-dashboard` (public) — 포트폴리오용 커밋 그래프 적립처
4. Org 계정 레포 생성: `solpath-labs-dev/solpath-dashboard` (public) — 조직 자산 등록처
5. 로컬 `git init -b main` + `.gitignore` 신설 (secrets·credentials·OS cruft 차단 규칙)
6. 2-remote 세팅: `origin` = 개인 계정, `mirror` = Org 계정 (`mirror`는 git remote 별칭일 뿐, GitHub의 기능 이름 아님)
7. 첫 커밋 `fb60503` "docs: initial SPEC / README / process" → 양쪽 push
8. 양쪽 레포 파일 교차 검증 완료 (README 8528B · `process.md` 42831B · SPEC 동일)
9. 체크리스트 반영 커밋 `3a1f96a` "docs: mark ⓪ repo setup checklist complete"

이 시점부터 모든 문서·코드 변경은 **git 커밋 단위로 추적**된다. 로컬 단일 소스에서 2개 리모트가 동기화되는 구조로 전환.

### 주요 의사 결정


| 항목           | 결정                                                                         | 이유                                                                                                                                                                                                                           |
| ------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 레포 가시성       | **Public** (개인·Org 둘 다)                                                    | ① jsDelivr CDN 직접 서빙 조건 충족 ② 포트폴리오 노출 ③ Secret Scanning 기본 활성화되는 방어선 추가 확보. 민감 값은 애초에 GAS Script Properties에만 저장하는 1차 원칙(§2)이 있어 Public이라도 안전.                                                                               |
| 양쪽 계정 동기화 방식 | **수동 2-remote push** (당분간)                                                 | 커밋마다 `git push origin main && git push mirror main`. 초기엔 커밋 빈도 낮고 디버깅도 쉬운 단순한 방식이 유리. 자동화(GH Actions)는 실수로 한쪽만 push 되는 사고가 한 번 이상 발생하거나 Phase 3 프론트 릴리즈 태깅이 본격화되는 시점에 전환. GitHub 무료 플랜에 자동 복제 기능 자체는 없어서 Actions로 직접 구성해야 함. |
| 브랜치 전략       | `**main` 단일 브랜치** (Phase 3까지)                                              | 1인 개발 + 운영툴이라 PR 기반 리뷰·병합 오버헤드 불필요. 기능 단위 커밋 메시지로 히스토리 추적. Phase 3 프론트 착수 시 `feat/`* 작업 브랜치 도입 여부 재검토.                                                                                                                       |
| 커밋 컨벤션       | **Conventional Commits** (`docs:`, `feat:`, `fix:`, `refactor:`, `chore:`) | 메시지만으로 변경 성격 분류 가능. 포트폴리오 관점에서도 커밋 이력 가독성 확보.                                                                                                                                                                                |


### 변경 이력

- [레포 신설] `**eunsang9597/solpath-dashboard` (개인 계정) + `solpath-labs-dev/solpath-dashboard` (Org 계정) 생성**
  - 이유: Phase 1 코드 착수 전에 설계 문서(SPEC/README/process)가 버전 관리 밖에 있으면 변경 이력·롤백·멀티 머신 작업이 전부 불가. 문서 먼저 올려두면 ① 커밋 그래프가 포트폴리오로 누적(개인 계정) ② 조직 자산 등록 병행(Org 계정) ③ 같은 절차를 `-back`·`-front` 생성 시 재사용 가능.
  - 영향: 이 시점 이후 SPEC 변경·프로세스 업데이트·의사결정 기록 모두 commit SHA로 시점 지정 가능. low-risk 메타 레포를 먼저 세워두고 코드 레포 2개는 필요 시점에 동일 패턴으로 확장.
  - 대체: 기존엔 워크스페이스 로컬에만 존재, git 없음. 히스토리 유실 위험 + 실수 시 복구 불가 상태였음.
- [`.gitignore` 신설] **최소 시크릿/부산물 차단 규칙 적용**
  - 이유: Public 레포 운영 전제. 실수로라도 토큰·키가 올라가지 않도록 커밋 레이어에서 1차 방어선 필요. Secret Scanning은 2차 방어선, 원칙(민감 값은 GAS Script Properties만)은 0차 방어선.
  - 영향: `.env` / `.env.`* / `credentials.json` / `.clasprc.json` / `*.key` / `*.pem` / `*.p12` 차단. OS·에디터 부산물(`.DS_Store`, `Thumbs.db`, `.vscode/`, `.idea/`, `*.log`)도 함께 무시. `-back`·`-front` 레포 생성 시 이 파일을 템플릿으로 복사해서 각 레포 특성(예: `-back`은 `.clasp.json` 제외, `.clasprc.json`만 차단)에 맞게 조정.
  - 대체: 없음(신설).
- [process.md §0·§4] **Org Owner 초대·수락 완료 상태 반영**
  - 이유: 지난 세션(2026-04-20)에 "다음 세션 첫 작업"으로 기록되어 있던 전제 조건이 해결됨. 체크리스트 상태 갱신 필요.
  - 영향: 다음 세션부터는 새 레포(`-back` / `-front`) 생성 시 초대 단계 없이 바로 `gh repo create` 가능. 단일 인증 상태로 Phase 1 중반·Phase 3 착수 시 병목 없음.
  - 대체: 이전엔 Org Owner 초대가 미처리 → 다음 세션 선행 작업으로 명시되어 있었음.

### 다음 할 일

- **Phase 1 전제 ① Script Properties 3개 키** — §3·아래「Phase 1 착수 플랜 ①」참조 (2026-04-24 저장 완료)
- Phase 1 A/B/C/D **나머지** (SPEC §9.0) — 스키마·시그니처는 §5·§7에 상당 부분 반영됨, 실run·튜닝·`sync_log` 검증 지속
  - A. 데이터 스키마(원천 4시트 + 운영 시트) → SPEC §5·§3.3
  - B. `Auth.gs` / `ImwebApi.gs` / `RawSync.gs` 공개 API → SPEC §7
  - C. 연동완료 · 페이지네이션 · 레이트리밋 · 증분 vs 소급 · `SYNC_`* 이어쓰기
  - D. `setupMasterDatabase` · `clasp push` · `syncRawFromImweb` · 소급/PARTIAL 반복

### 이슈·메모

- 샌드박스 제약으로 `git init` 실행 시 `.git/hooks/` 디렉토리 생성 권한이 필요 → 에이전트에서 `all` 권한 요청으로 해결. 후속 커밋·push도 동일 권한 패턴이 재등장할 수 있음.

### 변경 이력 (추가)

- [보안 정리] **siteCode 풀값을 전체 git 히스토리에서 마스킹**
  - 이유: 2026-04-20 블록(L429)에 siteCode 풀값이 교차 검증 로그로 박혀 있었는데, 초기 커밋 후 Public 레포 2곳에 그대로 노출된 상태로 발견. `process.md §2` 자체 규칙("Client ID·siteCode 등 semi-public 값도 문서에 실값 기재 금지, Script Properties만")을 스스로 어긴 상태. siteCode는 Client Secret 없이는 API 호출 불가해 실질적 리스크는 low이나, 규칙 준수 원칙상 즉시 정리.
  - 영향: `git filter-repo --replace-text`로 풀값 → `S20250930...` 마스킹 치환. 전체 커밋 히스토리 재작성(4개 커밋 SHA 전부 변경). 양쪽 원격(`origin` + `mirror`) force push. 맥락(아임웹 siteCode 인코딩 규칙 `S` + `YYYYMMDD` + 해시 교차 검증 경위)은 보존하고 해시 부분만 제거. 치환 후 원격 교차 검증으로 양쪽 레포 전 히스토리에 풀값 0건 확인.
  - 대체: 이전엔 풀값이 Public 상태로 공개. 단순 마스킹 커밋만 추가하는 방식은 "가장 최신 파일만 깨끗, 과거 커밋에는 그대로 노출"되므로 부적합. 전체 히스토리 재작성 + force push가 유일한 완전 정리 경로였음.

### 향후 재발 방지 (메모, 당장은 수동 점검 유지)

- 민감/준민감 값은 작성 시점에 바로 Script Properties에만 저장하고 문서엔 "저장 완료" 체크만 남기는 §2 규칙 재확인
- 차후 필요 시 pre-commit hook으로 정규식 스캔(예: `S\d{8}[a-f0-9]{12,}` · `gho_` · `sk-` 등) 도입 검토 — 현재 단계에선 오버엔지니어링, Phase 1 끝난 뒤 재평가

---

## 2026-04-20 (월)

### 오늘 한 일

**1차 명세 (오전)**

- 프로젝트 킥오프
- 아임웹 API v2 인벤토리 정리 (회원/주문/상품/쿠폰)
- 대시보드 기술 스택 확정: GAS + Google Sheets + GitHub Pages(jsDelivr) + 아임웹 코드 위젯
- **Phase 0: 명세서 v0.2 작성·확정**
  - 내부 카테고리 5개 확정: 교재 / 솔패스(문·이과) / 챌린지 / 솔루틴(정기·단품) / 자소서
  - 신규/재등록/다시옴/단품 판정 규칙 정의 (§4.3)
  - **두 집계 축 분리 원칙** 정의 (구매 축 = 매출·인원, 수강 축 = 만료·재등록) — §2.1.A
  - **비교 데이터 없음 처리 공통 규칙** 추가 (§2.1.B) — 초기엔 "전년/전월 데이터 없음" 표시
  - KPI 관리 화면 신설 (§6.19) — 목표 매출·임계값을 운영자가 직접 등록
  - 시트 편집 허용 범위 확정 (§5.5) — 아임웹 원천·파생 캐시는 lock, 운영자 관리 시트만 편집 허용
  - 운영 파라미터 확정표 추가 (§3.2)
  - 심화 통계 12개 명세 추가 (리텐션 코호트, 전환 분석, MRR, LTV, 이탈 위험, 회원 프로파일 등) — §6.12~6.17

**3차 세션 (저녁) — 사전 준비 Phase 실행**

- GAS 프로젝트 `solpath-dashboard-backend` 생성 + `doGet` 껍데기 배포 → Web App URL 확보 및 `ok` 응답 검증
- 아임웹 개발자센터 가입 + 앱 `솔패스 내부 대시보드` 생성
- 앱 정보 등록: 서비스 URL · 리다이렉트 URI(둘 다 GAS Web App URL), Client ID/Secret 발급
- API 설정: read-only 7개 활성화(사이트정보·회원정보·상품·주문·결제·프로모션·커뮤니티), **스크립트 scope 비활성화**(보안상 위험)
- **앱 테스트 기능으로 테스트 사이트 연동 완료** → siteCode `S20250930...` 확보
- 도메인 구조 정정: 고객 대면 `solpath.co.kr` / 아임웹 내부 슬러그 `transfersolutionteam.imweb.me` (두 진입로가 같은 사이트에 매핑됨)
- 초기 데이터 소급 시작일 오타 정정: `2005-09-30` → `2025-09-30` (siteCode 인코딩 날짜와 교차 검증)
- 다음: Script Properties에 `IMWEB_CLIENT_ID`/`IMWEB_CLIENT_SECRET`/`IMWEB_SITE_CODE` 저장 → Phase 1 A단계(DB 스키마) 착수

**2차 명세 (오후)** — v0.3

- **명세서를 레포 정본으로 이관**: `~/.cursor/plans/*.plan.md` → `docs/SPEC.md`
- `README.md`, `process.md` 작성
- **개인정보 정책 §5.6 신설 + 다운로드 선택적 허용 정책**
  - 대시보드 UI 기본 노출: **이름 + 아임웹 아이디 + 연락처** (업무상 필요)
  - 그 외 민감 필드(이메일·주소·생년월일)는 상세에서 마스킹+원본 보기(audit 기록)
  - **통계·집계 리포트**(매출/인원/재등록 집계/MRR 등) → Excel / CSV / PDF / Google Sheets 바로 열기 허용
  - **개별 명단**(회원 리스트/이탈 위험/재등록 대상자 등) → 다운로드 금지, 프린트 뷰만
  - 향후 확장: Google Looker Studio로 Sheets 기반 보조 대시보드 가능 (§6.17.D)
- 초기 데이터 소급: **아임웹 개설 시점부터 전체** (정확 일자 추후)
- 모바일 대응: 데스크톱 전용
- 신설 섹션
  - §6.20 우수 학생/프로모션 대상자 — 상품별 기준 설정 → 쿠폰 발급 대상 자동 추출 (기준 수식은 개발 중 추가)
  - §6.21 시스템 상태 모달 — 수집 상태·에러·API 한도 한눈에
- 아임웹 위젯 성능 검토: 위젯=로더(한 줄), 앱 본체=GitHub/jsDelivr 구조가 별도 서버와 성능 동일 + 아임웹 로그인 상태 활용 가능 → **지금 구조 유지 최선**으로 결론

### 주요 의사 결정


| 항목            | 결정                                                                      |
| ------------- | ----------------------------------------------------------------------- |
| 데이터 수집 주기     | 1시간                                                                     |
| 이탈 위험 N일      | 5일 (주말 제외 매일 학습 특성)                                                     |
| 매출·인원 기준일     | 구매일                                                                     |
| 수강 관리 기준일     | 시작일·만료일 (별도 축)                                                          |
| 전년도 비교        | 월 단위 + 진행 중 월은 달성률% 표시                                                  |
| 회원수 정의        | 기간 내 고유 구매자 수 (무료 상품 포함)                                                |
| 환불 집계         | 환불 신청일 기준                                                               |
| 활성 중 추가 구매    | 재등록 + 시작일 자동(이전 만료일+1)                                                  |
| 자소서 재등록       | 상품별 독립 카운트 (학교별 중복 허용)                                                  |
| 솔루틴 단품        | 같은 월 복수 구매 → 월 1건으로 묶음                                                  |
| 권한 모델         | 1차 전체 공통 → 2차 아임웹 회원 권한 연동                                              |
| SSOT          | Google Sheets 단일 진실 원천                                                  |
| 이상 감지·KPI 목표  | 운영자가 §6.19 화면에서 직접 등록                                                   |
| 아임웹 API 권한 전략 | **전 scope read-only**, Script scope 명시 제외 (유출 시 사이트 장악 리스크)             |
| 사이트 도메인 구조    | 고객 대면 `solpath.co.kr` + 내부 슬러그 `transfersolutionteam.imweb.me` (동일 사이트) |
| 초기 수집 시작일     | `2025-09-30` (아임웹 사이트 개설일, siteCode 인코딩과 교차 검증)                         |


### 변경 이력

- [SPEC §9.0 신설] **개발 프로토콜(A 스키마 → B 시그니처 → C 의사코드 → D 구현)** 명시
  - 이유: 1인 개발에서 스키마·계약이 흔들리면 이미 쌓인 데이터/연결된 화면까지 연쇄 수정이 필요함. 각 Phase 착수 전 A/B/C를 먼저 확정하기로 합의.
  - 영향: 모든 이후 Phase는 이 프로토콜을 따른다. `process.md`에 Phase별 체크리스트 블록을 남겨 진행 상황 추적.
  - 대체: 기존엔 Phase만 나열되어 있고, 착수 전 필수 확정 항목이 명시돼 있지 않았음.
- [process.md] **변경 이력 기록 규칙(이유 필수)** 명시 + Phase 착수 체크리스트 템플릿 추가
  - 이유: "이게 왜 이렇게 되어있지?"를 미래의 우리가 묻지 않도록. 추가·변경·제거 시 배경·영향·이전 방식을 함께 남겨야 맥락이 보존됨.
  - 영향: 앞으로 SPEC/코드/운영 정책 변경 시 이 포맷으로 기록.
  - 대체: 기존엔 "주요 의사 결정" 테이블 중심이라 "왜"는 구두로만 남고 문서엔 결과만 박혔음.
- [process.md] **사전 준비 체크리스트 섹션 신설** (상단 참조 영역, 7개 카테고리 빈칸 양식)
  - 이유: Phase 1 코드 착수 전에 클라이언트가 제공할 정보(계정·URL·API 키·기존 데이터 위치)를 한 곳에 모아 누락 방지. 별도 PREP.md 파일을 만드는 대신 process.md 안에 두어 파일 수를 최소화하고 변경 이력과 근접 배치.
  - 영향: 이 섹션이 채워져야 Phase 1 A(데이터 스키마) 단계로 진입. 민감 값(API Key/Secret)은 여기 쓰지 않고 "발급 완료" 체크만 유지.
  - 대체: 기존엔 "다음 세션 할 일" 체크박스에 흩어져 있어 명의·플랜·도메인 등 세부 정보 기입 칸이 없었음.
- [SPEC §4.3] **과거 주문 수강 시작일 폴백 규칙 명문화**: `start_date = order_date`
  - 이유: 아임웹 개설 시점부터 전체 소급 수집 방침인데, 과거 주문 하나하나 시작일을 수기 입력하는 건 비현실적. 신규 주문부터 운영자 입력을 원칙으로 하고 과거는 폴백으로 처리.
  - 영향: 과거 데이터의 재등록 판정이 실제보다 약간 엄격해질 수 있음(학생이 구매 후 늦게 시작한 경우). 통계 목적에선 수용 가능. 운영자가 사후 수기 입력 시 해당 값으로 덮어쓰기.
  - 대체: 기존 SPEC엔 "시작일은 운영자 수기 입력"만 명시되어 있어 과거 주문 처리 규칙이 비어 있었음.
- [SPEC §4.3] **환불 주문의 재등록/다시옴 카운트 제외 규칙 명문화** (`status='refunded'`)
  - 이유: 환불 = 실제 수강 이력 없음. 카운트에 넣으면 재등록률·전환률이 왜곡됨. 이전에는 암묵적으로만 합의되어 있던 규칙을 명시.
  - 영향: `enrollments` 빌더와 Aggregator에서 `status='refunded'` 행을 재등록 기준 "직전 수강"에서 제외. 매출 환불 집계(§2.1.A 신청일 기준)는 별도 축이라 영향 없음.
  - 대체: 기존엔 판정 규칙에 환불 처리 언급이 없어 구현 시점에 해석이 갈릴 여지가 있었음.
- [SPEC §11] **아임웹 위젯 외부 스크립트 로드 허용 여부 리스크 추가** + CSP/CORS, 커스텀 도메인 HTTPS 체크 항목
  - 이유: 프론트 아키텍처(위젯=로더, 앱=jsDelivr CDN)가 성립하려면 위젯에서 `<script src="...jsdelivr...">` 로드가 허용되어야 함. 아임웹 플랜·위젯 설정에 따라 차단될 수 있으므로 Phase 1 착수 시 실측 필요.
  - 영향: 차단 시 대안 3가지(인라인, 아임웹 파일 업로드, Netlify/Cloudflare Pages)를 리스크 섹션에 명시해두어 선택지 유지.
  - 대체: 기존 §11은 API 호출 한도·Sheets 용량 등 백엔드 리스크 위주였고 임베드 리스크는 §3에서만 언급되어 있었음.
- [process.md 사전 준비] **Google(GAS) ↔ 아임웹 순서 교체** (아임웹 2번 → 3번, Google 3번 → 2번)
  - 이유: 아임웹 앱 생성 시 필수 입력인 "서비스 URL"이 GAS Web App 배포 URL이다. 플레이스홀더로 등록 후 수정하는 번거로움을 제거하려면 GAS Web App 껍데기(`doGet` 한 줄)부터 먼저 배포해 URL 확보해야 한다.
  - 영향: 아임웹 §3 상단에 "전제: §2에서 URL 확보 완료" 명시. §2에는 "서비스 URL 확보용 세팅" 서브섹션을 추가해 GAS 프로젝트 생성 → 껍데기 배포 → URL 복사 순으로 체크박스화.
  - 대체: 이전 순서는 아임웹→Google이었고, 아임웹 §2에 "OAuth 필요 시 Redirect URI 정책 확인" 정도만 있어 GAS URL이 prerequisite임이 드러나지 않았음.
- [process.md 사전 준비 §3] **아임웹 "앱스토어 승인 불필요 + 테스트 사이트 연동 방식" 명시 + 연동완료처리 API 필수 체크 추가**
  - 이유: developers-docs.imweb.me/guide/준비하기에서 확인 — "특정 사이트만 쓰는 서비스는 앱스토어 승인 X, 연동된 테스트 사이트에 한해 API 사용 가능". 우리는 클라이언트 단일 사이트 내부용이라 이 방식이 정석이고, 심사 지연 리스크 0. 또한 연동 직후 상태는 `연동중`이고 이 상태에선 `연동완료처리 API` 외 다른 API가 전부 막히므로 Phase 1 첫 구현에 반드시 포함해야 함.
  - 영향: 사전 준비 §3에 "테스트 사이트 연동" + "연동완료처리 API 호출" 체크박스 추가. Phase 1 A/B 설계 시 `ImwebApi`/`Auth` 루트에 이 호출을 첫 단계로 배치.
  - 대체: 이전엔 "API Key/Secret 발급"만 체크되어 있어 앱 연동 플로우·`연동중` 상태 제약이 문서화되지 않았음.
- [process.md §2] **Script Properties 키 네이밍 컨벤션 확정** (UPPER_SNAKE_CASE + 도메인 프리픽스)
  - 이유: 인증 관련 값(Client ID 포함)을 문서 vs Properties에 분산 저장하면 규칙이 2개가 되어 실수 유출 위험이 커진다. "인증·설정 관련 값은 모두 Script Properties에만"이라는 단일 규칙으로 통일. 또한 프론트 레포(`solpath-dashboard-front`)는 jsDelivr 사용을 위해 Public으로 운영 예정이라 문서가 함께 옮겨질 때의 노출 리스크도 방지.
  - 영향: 모든 코드(`Auth.gs`, `ImwebApi.gs`, `RawSync.gs` 등)는 값을 직접 참조하지 않고 `PropertiesService.getScriptProperties().getProperty('IMWEB_CLIENT_ID')` 형태로만 접근. 새 비밀 값 필요 시 이 테이블에 키 이름·용도·설정 시점만 먼저 추가(값은 쓰지 말기).
  - 대체: 이전엔 "민감 값은 Properties에 저장" 원칙만 있고 구체 키 이름·컨벤션이 없어 구현 단계에서 합의 재필요했음.
- [process.md 사전 준비 전면 슬림화] **"코드 착수 전에 반드시 필요한 것"만 남기고 나머지는 Phase 1로 이관**
  - 이유: 사전 준비에 개발-시점 항목(API 권한 세부 체크, 연동완료처리 API 호출, Rate Limit 실측, 위젯 스크립트 허용 여부, HTTPS 실측 등)이 섞여 있어 "아직 뭐가 남았지?"가 불분명했다. 클라이언트 피드백 기반으로 재분류.
  - 영향: §2(Google)와 §4(GitHub)를 표 한 줄 요약으로 압축. §3(아임웹)를 "사전 준비 체크리스트" 4개 + "Phase 1에서 처리할 것" 5개로 명확히 분리. §7(추가 점검) 섹션 삭제 — 과거 시작일·환불 처리 규칙은 이미 SPEC §4.3 공통 보조 규칙에 명문화 완료, 그 외는 Phase 1 실측 항목으로 이관.
  - 대체: 기존엔 사전 준비 §3/§7에 총 20여 항목이 혼재되어 "어디부터 손대야 하나" 판단하기 어려웠음.
- [SPEC §9.0] **애자일 방법론 명문화** (프로젝트 규칙 섹션 상단에 "방법론: 애자일 1인 개발" 추가)
  - 이유: 내부용·1인 운영·실사용자 상시 접근 가능이라는 특성상 완성 후 배포형 대신 "쓰면서 개선"형이 ROI가 높음. A/B/C/D 프로토콜이 "각 단위 작업의 설계 규칙"이라면, 애자일은 "전체 프로젝트 진행 방식"에 해당하는 상위 원칙이라 별도 명시 필요.
  - 영향: 각 Phase 완료 시점에 실제 사용 → 다음 Phase 스코프 조정 원칙 공식화. 사전 설계 문서를 늘리기보다 돌아가는 것부터 확보. 기능 단위마다 아키텍처 다이어그램·스크린샷은 **사전 작성 X, 구현 시점에 같이 업데이트**.
  - 대체: 기존엔 Phase 1~9 순차 계획만 있었고 "어떤 개발 방식으로 진행하는가"에 대한 원칙이 문서화되지 않았음.
- [README.md 전면 재구성] **포트폴리오 친화적 구조로 확장** (배경·방법론·의사결정 요약·스크린샷 가이드 등 신설)
  - 이유: 레포가 Public 공개될 예정(개인 계정 원본)이라 방문자가 `README.md` 한 장으로 프로젝트 맥락·설계 의도·진행 상태를 파악할 수 있어야 함. 기존 README는 기능 목록 위주로 너무 기술적이어서 포트폴리오 관점의 "왜 이 구조인가" 설명이 부족했음.
  - 영향: 배경(사업 맥락), 기술 스택 선택 이유 컬럼, mermaid 아키텍처 다이어그램, 방법론 섹션(애자일 + A/B/C/D), 핵심 의사결정 7개 요약 테이블, 스크린샷 익명화 원칙, 레포 구조(개인·Org 양쪽 공개) 신설. 세부 기능 목록은 유지하되 정본 SPEC로 링크.
  - 대체: 기존 README는 "기술 스택 + 시스템 구조 ASCII + 기능 요약" 3단 구조로, 코드 독자 대상이지 포트폴리오 독자 관점이 없었음.
- [process.md §0, §4] **GitHub 레포 구조 결정** (개인 계정 + Org 계정 양쪽에 동일 내용 Public 공개)
  - 이유: 포트폴리오 커밋 그래프는 개인 계정에 쌓이게 하되, 조직 자산 등록도 병행하고 싶다는 요구. Public 공개는 Client Secret은 Properties에만 저장되므로 안전 + jsDelivr 직접 호스팅 조건.
  - 영향: **현재(Phase 1)** GAS+clasp는 `solpath-dashboard` 레포 `gas/`(미래 `-back` 분리는 선택). 프론트는 Phase 3에 `eunsang9597` / `solpath-labs-dev` 각 `solpath-dashboard-front`. `.gitignore`·Secret Scanning 방침 §4.
  - 대체: 기존 §0·§4는 "solpath-labs/solpath-dashboard-front"만 있고 개인 원본 구조는 없었음. GitHub ID가 이메일로만 적혀 있어 실제 사용자명 불분명 상태.
- [process.md §3 / 주요 의사결정] **아임웹 API scope = 전 영역 read-only로 확정 + Script scope 의도적 배제**
  - 이유: 대시보드는 조회·집계 전용이고 쓰기 작업은 모두 우리 GAS+Sheets 내부에서 처리. 최소 권한 원칙(Principle of Least Privilege) 적용 → Client Secret 유출 시 원천 데이터 훼손 리스크 0. 특히 Script scope는 사이트 헤더·바디·푸터 스크립트 삽입/수정/삭제 권한이라 유출 시 사이트 전체에 악성 스크립트 주입 가능(키로거·세션 탈취·결제정보 탈취 경로). GA4 등 분석 도구 연동은 아임웹 관리자 UI의 별도 기능으로 처리하는 게 표준이므로 이 scope를 우리 앱이 보유할 이유 없음.
  - 영향: 활성화 scope = 사이트정보(필수·고정) / 회원정보 / 상품 / 주문 / 결제 / 프로모션 / 커뮤니티 — 모두 read. 차후 WRITE 권한 필요 시 별도 결정 과정(변경 이력 기록)을 거친 후에만 확장.
  - 대체: 초기엔 클라이언트가 "나중에 GA4 같은 것 연동 시 필요할지 몰라서" Script scope를 읽기·쓰기로 켜둔 상태였으나, 리스크 분석 후 제외. "나중을 위해 미리 켜둠"은 보안 안티패턴임을 확인.
- [process.md §3] **테스트 사이트 연동 플로우 실행 완료 + siteCode 획득**
  - 이유: 아임웹 공식 플로우는 수동 OAuth authorize URL 조립이 아니라 개발자센터 내 **[앱 테스트] 버튼** 한 번으로 사이트 선택 → 동의 화면 → 자동 연동. `developers-docs.imweb.me/guide/프로세스-확인하기` §3 확인 결과.
  - 영향: siteCode `S20250930...` 확보 → Imweb API 사이트 식별. `IMWEB_SITE_CODE` 는 Properties에 저장(2026-04-24). 연동이 `연동중`이면 `연동완료처리 API`가 먼저(구현: `ImwebApi`/`Auth` 흐름) — 열기 전엔 나머지 API가 막힐 수 있음.
  - 대체: 초기엔 OAuth `authorize?response_type=code...` URL을 수동 조립해야 하는 줄 알았으나, 아임웹은 자체 개발자센터 UI로 이 과정을 추상화해 제공 → 수동 URL 조립 단계 불필요.
- [process.md §3 / 주요 의사결정] **도메인 구조 정정** — `www.solpath.co.kr` → `solpath.co.kr` (고객 대면) + `transfersolutionteam.imweb.me` (아임웹 내부 슬러그) 2개 축 명시
  - 이유: 테스트 연동 모달에서 실제 사이트가 `transfersolutionteam.imweb.me` 슬러그로 노출됨. 조사 결과 동일 사이트에 커스텀 도메인 `solpath.co.kr`이 매핑된 구조. 그간 문서엔 `www.solpath.co.kr`만 명시되어 있어 Phase 1에서 아임웹 API나 관리자 URL 참조 시 혼란 가능성 있었음. `www` 서브도메인 사용 여부도 미확정(리브랜딩 진행 중).
  - 영향: Phase 3 프론트 임베드 대상은 `solpath.co.kr`, 아임웹 관리자 진입·API 내부 식별은 `transfersolutionteam.imweb.me` 슬러그 + siteCode 조합으로 구분 명시. 아임웹 사이트명 내부 표기("솔루션편입 | 온라인편입컨설팅 전문")는 이전 브랜드명이므로 UI 캡션 등에 노출될 경우 추후 교체 이슈로 남김.
  - 대체: 기존 §3 테이블엔 `사이트 도메인 = www.solpath.co.kr` 한 줄만 있어 두 축 구분이 없었음.
- [process.md §3 / 주요 의사결정] **초기 수집 시작일 오타 정정** — `INITIAL_SYNC_FROM = 2005-09-30` → `2025-09-30`
  - 이유: siteCode `S20250930...`에 사이트 개설일이 인코딩되는 아임웹 규칙(`S` + `YYYYMMDD` + 해시) 확인 → 실제 개설일이 `2025-09-30`임이 교차 검증됨. 기존 값 `2005-09-30`은 아임웹 플랫폼 존재 전 날짜(아임웹은 2013년 이후 서비스)였으므로 명백한 타이핑 오류.
  - 영향: Phase 1 초기 소급 수집 범위가 사이트 실제 개설일에 정확히 맞춰짐(수집 기간 과대 추정으로 인한 불필요한 API 호출·0건 조회·리소스 낭비 방지). `INITIAL_SYNC_FROM` Script Property 설정 시 `2025-09-30` 사용.
  - 대체: 기존 §3 테이블엔 `2005-09-30`으로 기재되어 있었음. 타이핑 오타가 문서 간 전파되기 전에 siteCode 교차 검증으로 발견.
- [process.md §0, §4] **GitHub 레포 구조 확장** — 단일 `solpath-dashboard-front` → **split 3개 레포** (`solpath-dashboard` / `-back` / `-front`)
  - 이유: 초기 계획은 프론트 레포 하나에 모든 걸 담는 구조였으나 검토 결과 3가지 관심사(문서·백엔드·프론트)의 릴리즈 주기·루트 파일 구성·배포 경로가 달라 분리 필요. 프론트는 `cdn.jsdelivr.net/gh/<owner>/<repo>@<tag>/...` 경로로 직접 서빙되는 특성상 전용 레포가 버전·태그 관리에 유리. 백엔드 GAS는 `clasp` 싱크 대상이라 `.clasp.json`이 루트에 자리잡으며 메타 문서와 혼재 시 어지러움. 메타 레포는 SPEC·프로세스·스크린샷 위주라 변경 빈도·성격이 코드 레포와 다름. 포트폴리오 관점에서도 프론트 구현 성과를 독립 레포로 보여주는 게 역량 어필에 좋음.
  - 영향: 단계별 생성 일정 — `solpath-dashboard`(다음 세션) → `solpath-dashboard-back`(Phase 1 중반, clasp 세팅 시) → `solpath-dashboard-front`(Phase 3 착수 시). 각 레포는 "개인 계정 + Org 계정" 2개씩 총 6개 레포로 귀결. 양쪽 계정 동기화는 초기 수동 2-remote push → 차후 GH Actions 자동화.
  - 대체: 기존 계획은 `solpath-dashboard-front` 단일 레포에 docs + frontend + (clasp로) GAS 코드까지 전부 담는 모노 구조였음. 관심사가 섞여 루트 파일·README·릴리즈 경로 설계가 복잡해지는 문제가 있었음.
- [process.md §0, §4] **Organization 전략 변경** — 기존 `solpath-labs` User 활용 → **새 Organization 신규 생성**
  - 이유: 확인 결과 `solpath-labs`는 Organization이 아닌 User 계정이었고 이미 다른 개인 용도 레포가 존재. User → Organization 변환은 되돌릴 수 없으며 기존 자산 이전 리스크 발생. 회사 자산 전용 깨끗한 공간을 새로 확보하는 편이 안전. `eunsang9597` 개인 계정을 새 Org의 Owner로 지정 → 단일 gh auth로 개인·Org 양쪽 레포 전부 push 가능하여 Collaborator 초대·계정 전환 번거로움 0.
  - 영향: process.md §0의 모든 Org 경로가 `solpath-labs/`* → `solpath-labs-dev/*`로 변경 완료. Org 명 `-dev` 접미사는 개발 자산 전용임을 명시하고 차후 `-ops`, `-design` 등 역할별 Org 확장 여지를 남기는 의도적 네이밍.
  - 대체: 기존 계획은 `solpath-labs/solpath-dashboard-front` 단일 레포였으나 `solpath-labs`의 성격이 User 계정이라 부적합하다는 사실을 GitHub 페이지 직접 확인으로 발견.
- [process.md §4] **GitHub 레포 실제 생성 시점 + 오늘 세션 중단 결정**
  - 이유: 사전 준비 범위 확장으로 깃헙 세팅도 오늘 끝낼 예정이었으나 ① Org 이름이 아직 미확정, ② 레포 구조가 1개에서 3개로 확장되며 생성 순서·시점 재설계 필요, ③ 단계별 생성 일정이 자연스러운 타이밍(문서 먼저 → 백엔드 → 프론트)을 따르는 게 맞음. 오늘은 **아키텍처만 확정하고 실제 생성은 다음 세션**으로 이월하는 쪽이 설계 오류 방지 측면에서 낫다고 판단.
  - 영향: 다음 세션 첫 할 일 = Org 이름 확정 → 문서 일괄 치환 → `solpath-dashboard` 개인·Org 2개 레포 생성 → 로컬 `git init` + 초기 커밋 + 양쪽 push. 이후 Phase 1 중반에 `-back` 생성, Phase 3 착수 시 `-front` 생성.
  - 대체: "오늘 사전 준비 모든 항목 완료"라는 초기 목표를 일부 조정. 그래도 핵심(아임웹 앱 생성·siteCode 확보·API scope·GAS Web App 배포)은 완료 상태라 Phase 1 착수 조건은 만족.

### 진행 파일

- **명세서 정본**: [docs/SPEC.md](./docs/SPEC.md) v0.3 (Phase 0 확정, §9.0 개발 프로토콜 포함)
- Cursor 플랜 파일(`~/.cursor/plans/학원_대시보드_1차_명세_52fa3465.plan.md`)은 스냅샷으로 보존, 앞으로 업데이트 안 함
- [README.md](./README.md), [process.md](./process.md) 워크스페이스에 생성

### 남은 TBD

- **그룹 A (클라이언트 자원)** — Phase 5/3 착수 시 제공받기
  - 상담 DB 스프레드시트 URL + 컬럼 구조 (Phase 5)
  - 아임웹 관리자 전용 페이지 URL (대시보드 임베드 위치) (Phase 3)
- **그룹 B (Phase 1 운영 정리)**
  - Script Properties 3개 키(`IMWEB_CLIENT_ID` 등) **저장됨(2026-04-24)** — 상세는 §3·아래 ① 테이블
  - 에러 알림 수신용 이메일 주소 결정 → `NOTIFY_ERROR_EMAIL` 키로 저장
- **그룹 C (아임웹 API 실측)** — Phase 1 착수 시 확인
  - 주문 API에 환불 사유 필드 존재 여부 (TBD-29)
  - 리뷰·평점 API 제공 여부 (TBD-31)
  - Rate Limit 공식 문서 vs 실측치 (TBD-8)
  - 아임웹 알림 API 존재 여부 + 카카오 비즈 알림톡 무료 범위 (TBD-41)
  - 아임웹 위젯에서 외부 스크립트(jsDelivr) 로드 허용 여부 (SPEC §11)
- **Phase 2 전 클라이언트 제공**
  - 아임웹 위젯에서 현재 로그인 회원 식별 방법 구체화
- **Phase 4 전 검토**
  - 다운로드 시 PII 마스킹 정책 세부 + 다운로드 감사 로그 스키마

### 다음 세션 할 일 (⓪ GitHub 레포 `solpath-dashboard` 세팅)

> 여기 체크리스트만 다음 세션 바로 착수. Phase 1 이후 작업은 아래 "Phase 1 착수 플랜" 섹션 참조.
>
> **기록 규칙**: 완료 시 `[ ]` → `[x]`로 바꾸고 **완료 일자** 컬럼에 `YYYY-MM-DD` 기입.

**수동 선행 (브라우저)**


| 상태  | 완료 일자      | 작업                                                                        |
| --- | ---------- | ------------------------------------------------------------------------- |
| [x] | 2026-04-24 | `solpath-labs-dev` Org → Settings → People → `eunsang9597`를 **Owner**로 초대 |
| [x] | 2026-04-24 | `eunsang9597` 로그인 후 이메일 또는 GitHub 알림에서 초대 수락                              |
| [x] | 2026-04-24 | 터미널에서 `gh auth login` (github.com · HTTPS · 웹 브라우저, `eunsang9597` 계정)     |


**에이전트 이어받아 진행**


| 상태  | 완료 일자      | 작업                                                                                                                                 |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [x] | 2026-04-24 | `gh auth status`로 인증 확인 (scopes: `gist`, `read:org`, `repo`, `workflow`)                                                           |
| [x] | 2026-04-24 | `gh repo create eunsang9597/solpath-dashboard --public` (개인 계정)                                                                    |
| [x] | 2026-04-24 | `gh repo create solpath-labs-dev/solpath-dashboard --public` (Org 계정)                                                              |
| [x] | 2026-04-24 | 로컬 `git init -b main` + `.gitignore` 최소 세팅 (`.env`, `credentials.json`, `.clasprc.json`, `.DS_Store`, `*.key`, `*.pem`, `*.p12` 등) |
| [x] | 2026-04-24 | `git remote add origin ...` + `git remote add mirror ...`                                                                          |
| [x] | 2026-04-24 | 첫 커밋 `docs: initial SPEC / README / process` (commit `fb60503`)                                                                    |
| [x] | 2026-04-24 | `git push -u origin main` + `git push mirror main`                                                                                 |
| [x] | 2026-04-24 | 양쪽 레포 파일 교차 검증 (초기 커밋 기준; 파일 크기·바이트는 변동)                                                                                           |


→ **GitHub ⓪ 세팅**은 완료. **Phase 1**(`gas/`, Script Properties, A/B/C/D)은 [§사전준비·상단 일지]·아래 ①~②로 진행.

---

### Phase 1 착수 플랜 (⓪·① 이후 · 참고용)

> 참고용 순서. **Script Properties 3키가 이미 있으면 ① 생략** → **⓪ GitHub 레포 + 로컬 git**부터. ⓪·① 끝난 뒤 **SPEC §9.0 A/B/C/D**.

#### ① 전제 조건 — Script Properties 3개 키 저장

GAS 편집기 → 좌측 ⚙ 프로젝트 설정 → 스크립트 속성


| 상태  | 완료 일자      | 작업                                                       |
| --- | ---------- | -------------------------------------------------------- |
| [x] | 2026-04-24 | `IMWEB_CLIENT_ID` 저장 (아임웹 앱 → 클라이언트 ID)                  |
| [x] | 2026-04-24 | `IMWEB_CLIENT_SECRET` 저장 (시크릿; 문서/채팅/커밋에 절대 붙여넣기 금지)     |
| [x] | 2026-04-24 | `IMWEB_SITE_CODE` 저장 (마스킹 규칙 `S`+날짜+해시; 실값은 Properties만) |


> Phase 1 중반~에 추가: `NOTIFY_ERROR_EMAIL`, `INITIAL_SYNC_FROM=2025-09-30`(선택), `SHEETS_MASTER_ID`(마스터 생성 후)

#### ② Phase 1 A/B/C/D (세부는 해당 세션에서 설계 확정)

- **A. 데이터 스키마** — 원천 4시트(members / orders / order_items / products) + 운영 시트 확정 → SPEC §5·§3.3 반영
- **B. 함수 시그니처** — `Auth.gs` / `ImwebApi.gs` / `RawSync.gs` 공개 API → SPEC §7 반영
- **C. 핵심 로직 의사코드** — 연동완료처리 부트스트랩 · 페이지네이션 · 레이트리밋 · 증분 vs 소급 분기 · `SYNC_MAX_RUNTIME_MS` 이어쓰기
- **D. 구현** — 마스터 시트(`setupMasterDatabase`) → `clasp push` → 수동 `syncRawFromImweb` → 소급·PARTIAL 반복

#### Phase 1 실측 TBD (개발 중 병행 확인)

- 주문 API 환불 사유 필드 존재 여부 (TBD-29)
- 리뷰/평점 API 제공 여부 (TBD-31)
- Rate Limit 공식 문서 vs 실측 (TBD-8)
- 아임웹 알림 API + 카카오 비즈 알림톡 무료 범위 (TBD-41)
- 아임웹 위젯 외부 스크립트(jsDelivr) 로드 허용 여부 (SPEC §11)

### 참고 링크

- 아임웹 개발자 문서: [https://developers.imweb.me/](https://developers.imweb.me/)
- GAS 문서: [https://developers.google.com/apps-script](https://developers.google.com/apps-script)

---

