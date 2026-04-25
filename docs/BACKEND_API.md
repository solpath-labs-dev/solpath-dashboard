# 백엔드 API 명세 (HTTP 계약)

GAS 백엔드가 **호출하는 외부 API**와 **스스로 노출하는 API**를 구분해, 메서드·URL·요청/응답 JSON·오류 처리를 한곳에 모은다.

| 구분 | 설명 |
|------|------|
| **아임웹 API** | 백엔드(GAS)가 **클라이언트**로 호출하는 아임웹 Open API |
| **자체 API** | GAS Web App(`doGet` / `doPost` 등)으로 **프론트·외부가 호출**하는 엔드포인트 |

**다른 문서와의 역할 나눔**

- [SPEC.md](./SPEC.md) — 비즈니스 규칙, 시트 스키마, 필드 **의미**·인벤토리(§3.3 등)
- **이 파일** — HTTP **계약**: 무엇을 어디로 보내고, 어떤 JSON이 오가며, 실패 시 어떻게 표현하는지
- [process.md](../process.md) — 운영·동기화·속성·일지

구현과 불일치가 생기면 **코드와 이 문서 중 어느 쪽이 맞는지 먼저 정한 뒤**, 둘 다 고친다.

---

## 공통 규칙 (자체 API)

아래는 **자체 API**에 적용하는 프로젝트 관례다. (아임웹 응답 형식은 §1을 따른다.)

| 항목 | 규칙 |
|------|------|
| 형식 | `Content-Type: application/json` (UTF-8) |
| 성공 | HTTP **200** + 바디에 JSON. 페이로드는 가능하면 `{ "ok": true, "data": … }` 형태로 통일 |
| 실패 | HTTP **4xx/5xx** + JSON `{ "ok": false, "error": { "code": "…", "message": "…" } }` (필드명은 구현 확정 시 고정) |
| 인증 | (예정) 쿼리 `token` 또는 헤더 `X-Access-Token` + Script Property `DASHBOARD_ACCESS_TOKEN` 대조 — **구현 후 이 표에 확정값 기입** |

**에러 `code` 예시 (자체 API용 문자열 코드)**

| code | 의미 |
|------|------|
| `UNAUTHORIZED` | 토큰 없음/불일치 |
| `BAD_REQUEST` | 파라미터 누락·형식 오류 |
| `NOT_FOUND` | 리소스 없음 |
| `IMWEB_ERROR` | 아임웹 연동 실패(하위에 원인 요약 가능) |
| `INTERNAL` | 예기치 않은 서버 오류 |

실제 코드베이스에 맞게 추가·삭제하고, 변경 시 `process.md`에 이유를 남긴다.

---

## 1. 아임웹 API (백엔드가 호출)

**베이스 URL (Open API)** — `https://openapi.imweb.me` (문서·테스트 요청 기준. 구현과 반드시 동일할 것.)

**인증** — 엔드포인트마다 다를 수 있다.

- **Bearer 시크릿** — 일부 경로는 `Authorization: Bearer <시크릿 토큰>` (앱·문서의 Secret; 값은 Script Properties만).
- **`/v2/*` + 액세스 토큰** — `POST /v2/auth` 등으로 발급한 토큰을 헤더에 실는 방식은 공식 문서 + GAS `Auth` 기준.

### 1.1 응답 봉투 (엔드포인트별 상이)

아임웹은 API마다 탑레벨 형식이 다를 수 있다. 구현 시 **HTTP 상태코드**와 **바디 탑레벨**을 함께 본다.

**패턴 A — `code` / `msg` / `data`** (shop·member 등에서 흔함)

```json
{
  "code": 0,
  "msg": "success",
  "data": {}
}
```

| `code` | 처리 |
|--------|------|
| `0` (또는 문서상 성공 코드) | 정상, `data` 사용 |
| 비-zero | 오류 (예: 주문 기간 초과 **-19**). `msg`·코드표·재시도 여부 확인 |

**패턴 B — `statusCode` / `data`** (문서 예: `GET /site-info`)

```json
{
  "statusCode": 200,
  "data": {}
}
```

| 조건 | 처리 |
|------|------|
| HTTP 200 **그리고** `statusCode === 200` | 정상, `data` 사용 |
| 그 외 | 오류로 간주. 바디 전체 로그 후 문서·실측으로 메시지 필드 확인 |

**GAS에서의 오류 처리 (관례)**

- HTTP 레벨 실패(5xx, 네트워크) → 재시도·로그·`sync_log`는 [process.md](../process.md) 원천 동기화 절 참고
- 패턴 A: 바디 `code !== 성공` → 로그에 `code`·`msg`·요청 맥락
- 패턴 B: `statusCode !== 200` 또는 HTTP 비정상 → 동일하게 로그

### 1.2 엔드포인트 목록 (Phase 1 원천 수집)

각 행은 **실측 샘플**이 나오면 «요청/응답 JSON» 블록을 채운다.

#### 사이트 정보

| Method | URL (전체) | Headers | Request body |
|--------|------------|---------|--------------|
| GET | `https://openapi.imweb.me/site-info` | `Authorization: Bearer <YOUR_SECRET_TOKEN>` | — |

성공 시 **HTTP 200**, 바디는 **패턴 B** (`statusCode` + `data`).

*응답 예 (문서 테스트 응답; `siteCode` 등은 샘플)*

```json
{
  "statusCode": 200,
  "data": {
    "siteCode": "S2025012450f7813d2ddau",
    "firstOrderTime": "2023-09-01T08:03:29.000Z",
    "ownerUid": "test@imweb.me",
    "unitList": ["string"],
    "configData": {}
  }
}
```

| `data` 필드 | 타입 | 설명 |
|-------------|------|------|
| `siteCode` | string | 사이트 코드 (`S` + 날짜 등 — Script Property `IMWEB_SITE_CODE`와 대조·검증에 사용 가능) |
| `firstOrderTime` | string (ISO 8601) | 첫 주문 시각 (UTC `Z`) |
| `ownerUid` | string | 소유자 식별 (예: 이메일) |
| `unitList` | string[] | 유닛 목록 (문서 예시는 placeholder) |
| `configData` | object | 설정 데이터 (문서상 빈 객체 예시) |

*cURL*

```bash
curl https://openapi.imweb.me/site-info \
  --header 'Authorization: Bearer YOUR_SECRET_TOKEN'
```

오류 시 응답 형식은 **공식 문서·실측**으로 이 절을 보강한다.

#### 인증

| Method | Path | Query / Body | 성공 시 `data` (요약) | 비고 |
|--------|------|----------------|----------------------|------|
| POST | `/v2/auth` | *(공식 문서·클라이언트 시크릿 기준)* | 토큰 등 | Script Properties와 매핑 금지(값은 저장만) |

*요청 바디 (예시 — 실제 필드명은 공식 문서 확인)*

```json
{
  "…": "…"
}
```

*응답 `data` (예시)*

```json
{
  "…": "…"
}
```

#### 회원

| Method | Path | Query / Body | 성공 시 `data` (요약) | 비고 |
|--------|------|----------------|----------------------|------|
| GET | `/v2/member/members` | `join_time_*`, `last_login_time_*`, 페이지네이션 | 회원 목록 | SPEC §3.3.1 |
| GET | `/v2/member/members/{code 또는 id}` | — | 회원 1건 | |

#### 상품

| Method | Path | Query / Body | 성공 시 `data` (요약) | 비고 |
|--------|------|----------------|----------------------|------|
| GET | `/v2/shop/products` | `prod_status`, 페이지 (최대 100) | 상품 목록 | SPEC §3.3.4 |
| GET | `/v2/shop/products/{prod_no}` | — | 상품 1건 | |

#### 주문 · 품목주문

| Method | Path | Query / Body | 성공 시 `data` (요약) | 비고 |
|--------|------|----------------|----------------------|------|
| GET | `/v2/shop/orders` | 기간·상태·**`order_version`** 등 | 주문 목록 + 페이지 정보 | 기간 1요청 약 **3개월 초과 시 `code=-19`** |
| GET | `/v2/shop/orders/{order_no}` | 목록과 동일 `order_version` 권장 | 주문 1건 | |
| GET | `/v2/shop/orders/{order_no}/prod-orders` | — | 품목주문(라인) 목록 | SPEC §3.3.3 |
| GET | `/v2/shop/orders/{order_no}/prod-orders/{품목주문번호}` | — | 품목주문 1건 | |

*주문 목록 `data` 실측 후 여기에 붙일 것 (스키마 덤프 또는 필드 표)*

```json
{
  "list": [],
  "…": "…"
}
```

#### 연동 완료 등 (부트스트랩)

| Method | Path | Query / Body | 성공 시 | 비고 |
|--------|------|----------------|---------|------|
| *(문서 확인)* | 연동완료 처리 API | *(공식 명세)* | *(실측)* | `연동중` 상태에서 다른 API 차단 가능 |

---

## 2. 자체 API (GAS Web App — 백엔드가 제공)

**베이스 URL** — 배포된 Web App URL 한 개 (예: `https://script.google.com/macros/s/…/exec`). 환경마다 다르므로 [process.md](../process.md) §2 또는 Script 배포 화면의 URL을 정본으로 둔다.

**메서드** — 초기에는 `GET`(헬스체크·단순 조회)과 `POST`(JSON 바디)를 구분해 쓰는 패턴을 권장한다.

### 2.1 헬스체크 (현재 구현 예시)

| Method | URL | Query | Request body | Response | Errors |
|--------|-----|-------|--------------|----------|--------|
| GET | `…/exec` | *(없음)* | — | 텍스트 `ok` | GAS 예외 시 5xx |

*응답*: `Content-Type: text/plain`, 바디 `ok` (`gas/Code.js`의 `doGet` 기준).

### 2.2 향후 엔드포인트 (템플릿)

추가할 때마다 아래 블록을 복사한다.

#### `POST /exec?action=…` (예시)

| 항목 | 내용 |
|------|------|
| **목적** | *(한 줄)* |
| **Query** | `action`, `token`(또는 헤더) |
| **Request body** | 아래 JSON 스키마 |
| **Response 200** | `{ "ok": true, "data": … }` |
| **Errors** | `401` UNAUTHORIZED, `400` BAD_REQUEST, … |

*Request*

```json
{
  "example": "…"
}
```

*Response*

```json
{
  "ok": true,
  "data": {}
}
```

---

## 3. 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-04-25 | 초안: 아임웹 / 자체 구분, 공통 오류 규칙, 엔드포인트 표·템플릿 추가 |
| 2026-04-25 | `GET https://openapi.imweb.me/site-info` — Bearer 시크릿, 응답 `statusCode`+`data` (문서 샘플 반영). 베이스 URL `openapi.imweb.me` 명시 |

이 표에 날짜·요약을 쌓고, 상세 이유는 [process.md](../process.md) **변경 이력**에 남긴다.
