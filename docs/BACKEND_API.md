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

**공식 명세 (Ground API, OAS 3.1)**

- Reference: [developers-docs.apidocumentation.com/reference](https://developers-docs.apidocumentation.com/reference)
- LLM/텍스트 요약 뷰: [r.jina.ai/…/reference](https://r.jina.ai/https://developers-docs.apidocumentation.com/reference)  
  (긴 문서는 레포에 복사해 두거나 위 URL을 북마크해도 됨.)

**인증** — 엔드포인트마다 다를 수 있다.

- **Bearer 액세스 토큰** — `GET /site-info`, Site-Info의 PATCH 연동, 쇼핑/회원 등. 발급: **OAuth2.0** `POST /oauth2/token`의 `accessToken` (문서 표기 `YOUR_ACCESS_TOKEN`).

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
| HTTP 200 **그리고** `statusCode === 200` | 정상, `data` 사용 (`data`는 객체·배열·`true` 등 타입이 엔드포인트마다 다름) |
| 그 외 | 오류로 간주. 바디 전체 로그 후 문서·실측으로 메시지 필드 확인 |

**GAS에서의 오류 처리 (관례)**

- HTTP 레벨 실패(5xx, 네트워크) → 재시도·로그·`sync_log`는 [process.md](../process.md) 원천 동기화 절 참고
- 패턴 A: 바디 `code !== 성공` → 로그에 `code`·`msg`·요청 맥락
- 패턴 B: `statusCode !== 200` 또는 HTTP 비정상 → 동일하게 로그

### 1.2 엔드포인트 (Ground API — 계약 정리본)

이 절은 **현재 프로젝트에서 쓰기로 한** `https://openapi.imweb.me` 호출만 적는다. **주문**은 §1.2 하단 `주문 · 품목주문`에 레거시 `/v2/shop/...` 스텁만 두었고, Ground 주문으로 바꿀 때 그 절을 교체하면 된다.

| 카테고리 | 요약 |
|----------|------|
| Site-Info | `GET /site-info`, `PATCH …/integration-complete`, `PATCH …/integration-cancellation` |
| OAuth2 | `GET /oauth2/authorize`, `POST /oauth2/token` |
| Member-Info | `GET /member-info/members` |
| Product | `GET /products`, `GET /products/{prodNo}`, `GET …/options`, `GET …/options/{optionCode}` |

**실측 스모크** — `gas/testapi.js`의 `testImwebOpenApiSmoke` (실행 후 실행 기록·로그에서 `rawText`/`json` 확인).

**토큰 (실사용)** — `openapi` **`Authorization: Bearer`** 값은 **`POST /oauth2/token`의 `data.accessToken`** 만 유효하다. 쇼핑몰 `api.imweb.me/v2/auth` 토큰으로 `openapi` 호출 시 **30101**. 구현: `gas/Code.js` **Web App `doGet`** 이 redirect `?code=` 로 `imwebExchangeOAuthCode` 호출(토큰은 Script Properties에 저장). 수동: `imwebGetOpenApiAccessToken(code)` — `gas/imwebAuth.js` — refresh `imwebRefreshOpenApiAccessToken`, authorize URL `imwebBuildOAuthAuthorizeUrl`.

#### Site-Info (Ground API 카테고리)

Reference **Site-Info** 그룹.

##### `GET /site-info` — 사이트 요약

`siteCode`·`firstOrderTime` 등 — 수집·config에 반영.

| Method | URL (전체) | Headers | Request body |
|--------|------------|---------|--------------|
| GET | `https://openapi.imweb.me/site-info` | `Authorization: Bearer <YOUR_ACCESS_TOKEN>` | — |

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
| `siteCode` | string | 사이트 코드 |
| `firstOrderTime` | string (ISO 8601) | 첫 주문 시각 (UTC `Z`) |
| `ownerUid` | string | 소유자 식별 (예: 이메일) |
| `unitList` | string[] | 유닛 목록 (문서 예시는 placeholder) |
| `configData` | object | 설정 데이터 (문서상 빈 객체 예시) |

*cURL*

```bash
curl https://openapi.imweb.me/site-info \
  --header 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

오류 시 응답 형식은 **공식 문서·실측**으로 이 절을 보강한다.

##### `PATCH /site-info/integration-complete` — 연동 완료

`연동중`이면 다른 Open API가 막힐 수 있음 → 연동 완료 처리.

| Method | URL (전체) | Headers | Request body |
|--------|------------|---------|--------------|
| PATCH | `https://openapi.imweb.me/site-info/integration-complete` | `Authorization: Bearer <YOUR_ACCESS_TOKEN>`, `Content-Type: application/json` | `application/json` |

**Body 스키마 (문서)** — `UpdateIntegrationCompleteRequestDto`

| 필드 | 타입 | 설명 |
|------|------|------|
| `configData` | object | 연동에 필요한 데이터 (문서). 샘플은 `{}`; 키가 늘면 Reference·실측으로 보강 |

*Request body 예*

```json
{
  "configData": {}
}
```

**Responses (문서)**  
- **200** — 처리 성공 · `application/json` (아래 패턴 B)  
- **default** — 오류 (공통 Error List는 Reference 참고)

성공 시 **HTTP 200**, 바디 **패턴 B**. 이 엔드포인트는 `data`가 **boolean** (`true` = 처리 성공).

*응답 예 (문서 테스트)*

```json
{
  "statusCode": 200,
  "data": true
}
```

*cURL*

```bash
curl https://openapi.imweb.me/site-info/integration-complete \
  --request PATCH \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  --data '{
  "configData": {}
}'
```

##### `PATCH /site-info/integration-cancellation` — 연동 취소

연동 관계를 끊을 때. 요청 **바디 없음**.

| Method | URL (전체) | Headers | Request body |
|--------|------------|---------|--------------|
| PATCH | `https://openapi.imweb.me/site-info/integration-cancellation` | `Authorization: Bearer <YOUR_ACCESS_TOKEN>` | — |

**Responses (문서)**

- **200** — 처리 성공 · `application/json` (패턴 B)
- **default** — 아래 Error List

성공 시 **HTTP 200**, 바디 **패턴 B**, `data` **boolean** `true`.

*응답 예 (문서 테스트)*

```json
{
  "statusCode": 200,
  "data": true
}
```

**오류 (문서 Error List)**

| statusCode | errorCode | message (요지) |
|------------|-----------|----------------|
| 500 | 10000 | 아임웹 내부 서버 오류 |
| 400 | 10001 | 잘못된 입력 |
| 400 | 10003 | 잘못된 데이터 |
| 400 | 10004 | 잘못된 입력 |
| 400 | 30098 | 클라이언트 정보 오류 |
| 400 | 30099 | scope 오류 |
| 401 | 30101 | 토큰 무효 |
| 401 | 30102 | 토큰 만료 |
| 403 | 30103 | 권한 부족 |
| 400 | 30104 | 유닛 코드 무효 |
| 401 | 30105 | 인증 정보 무효 |
| 404 | 30130 | **연동 완료** 상태인 앱만 연동 해제 가능 (문구 그대로: 연동 완료 상태인 앱만 연동해제 처리 가능) |
| 404 | 40001 | 앱 정보 없음 |

*cURL*

```bash
curl https://openapi.imweb.me/site-info/integration-cancellation \
  --request PATCH \
  --header 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

#### OAuth2.0 — 아임웹 Open API (가이드·Reference 정리)

베이스: `https://openapi.imweb.me` (`/oauth2/authorize`, `/oauth2/token`).

##### 역할 (가이드)

| 역할 | 설명 |
|------|------|
| 리소스 오너 | 쇼핑몰 소유자. 클라이언트에 권한 위임. |
| 클라이언트 | 위임받아 리소스 오너 데이터에 접근하는 앱. |
| 인증 서버 | 인증 처리·액세스 토큰 발급. |
| 리소스 서버 | 발급된 액세스 토큰으로 데이터 제공. |

##### 인가 코드 요청 전 (가이드)

1. 개발자센터에 클라이언트 앱 생성됨  
2. Client ID · Client Secret 발급됨  
3. Redirect URI · Scope 설정됨  

##### 1) 인가 코드 — `GET /oauth2/authorize`

| Query | 필수 (가이드) | 설명 |
|--------|---------------|------|
| `responseType` | ✓ | `code` 고정 |
| `clientId` | ✓ | 클라이언트 ID |
| `redirectUri` | ✓ | 인가 코드를 받을 URI |
| `scope` | ✓ | 권한, **공백** 구분 |
| `state` | 가이드상 선택 | CSRF 방지용 임의 문자열 — **운영에서는 항상 넣기 권장** |
| `siteCode` | ✓ | 쇼핑몰 사이트 코드 |

**scope 예시**  
`site-info:read` · `site-info:write` · `member-info:read` · `member-info:write` · `promotion:read` · `promotion:write` · `community:read` · `community:write` · `product:read` · `product:write` · `order:read` · `order:write` · `payment:read` · `payment:write` · `script:read` · `script:write` · `statistics:read` · `statistics:write`

**성공 응답** — HTTP **302**, 브라우저가 `redirectUri`로 이동하며 **쿼리**에 아래가 붙음.

| Query | 필수 | 설명 |
|--------|------|------|
| `code` | ✓ | 토큰 발급에 쓰는 인가 코드 |
| `state` | | 요청 시 보낸 `state`와 동일(보냈다면) |

**실패 시 (가이드)** — 리다이렉트 쿼리에 에러.

| Query | 필수 | 설명 |
|--------|------|------|
| `errorCode` | ✓ | 실패 코드 |
| `message` | | 메시지 |

```bash
curl 'https://openapi.imweb.me/oauth2/authorize?responseType=code&clientId=CLIENT_ID&redirectUri=https%3A%2F%2Fexample.com%2Fcallback&scope=member-info%3Aread%20order%3Aread&state=RANDOM_STATE&siteCode=S2025012450f7813d2ddau'
```

##### 2) Access Token 발급 — `POST /oauth2/token`

인가 코드로 최초 토큰 발급. **본문**은 `application/x-www-form-urlencoded` (쿼리스트링이 아님). JSON 바디는 API에서 거절될 수 있음(`30122` 등).

| 폼 필드 | 필수 | 설명 |
|---------|------|------|
| `grantType` | ✓ | `authorization_code` 고정 |
| `clientId` | ✓ | 클라이언트 ID |
| `clientSecret` | ✓ | 클라이언트 Secret |
| `redirectUri` | ✓ | 인가 코드가 리다이렉트된 URI(등록값과 일치) |
| `code` | ✓ | 위에서 받은 인가 코드 |

**성공 응답 (HTTP 200, 패턴 B)** — `data` 안 필드 (가이드는 `scope`를 배열로 적기도 함 → **실측**으로 맞출 것).

| 필드 | 설명 |
|------|------|
| `accessToken` | API 호출용 |
| `refreshToken` | 재발급용 |
| `scope` | 허용된 권한 범위 |

```json
{
  "statusCode": 200,
  "data": {
    "accessToken": "string",
    "refreshToken": "string",
    "scope": "string"
  }
}
```

```bash
curl https://openapi.imweb.me/oauth2/token \
  --request POST \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grantType=authorization_code' \
  --data-urlencode 'clientId=YOUR_CLIENT_ID' \
  --data-urlencode 'clientSecret=YOUR_CLIENT_SECRET' \
  --data-urlencode 'redirectUri=https://example.com/callback' \
  --data-urlencode 'code=AUTHORIZATION_CODE'
```

##### 3) Access Token 재발급 — `POST /oauth2/token`

`grantType=refresh_token`. Access 만료 시 사용. **Refresh까지 만료**면 **인가 코드(1단계)부터 다시.**

| 폼 필드 | 필수 | 설명 |
|---------|------|------|
| `grantType` | ✓ | `refresh_token` 고정 |
| `clientId` | ✓ | 클라이언트 ID |
| `clientSecret` | ✓ | 클라이언트 Secret |
| `refreshToken` | ✓ | 이전 발급에서 받은 값 |

응답 필드는 **2)와 동일** (`accessToken`, `refreshToken`, `scope`).

```bash
curl https://openapi.imweb.me/oauth2/token \
  --request POST \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grantType=refresh_token' \
  --data-urlencode 'clientId=YOUR_CLIENT_ID' \
  --data-urlencode 'clientSecret=YOUR_CLIENT_SECRET' \
  --data-urlencode 'refreshToken=YOUR_REFRESH_TOKEN'
```

##### 토큰 유효기간 (가이드)

| 토큰 | 유효 시간 |
|------|-----------|
| Access Token | **2시간** |
| Refresh Token | **90일** |

##### 요청 수 제한 (가이드)

| 항목 | 값 |
|------|-----|
| 버킷 용량 | 25 |
| 초당 회복 | 2 |
| 응답 헤더 | `X-RateLimit-Limit`, `X-RateLimit-Remaining` |
| 비고 | 회복은 초 단위. 짧은 시간 요청 폭주 시 **토큰 남아 있어도 429** 가능 |

##### 토큰 단계 오류 (Reference `errorCode` 일부, JSON 바디)

| HTTP | errorCode | 요지 |
|------|-----------|------|
| 500 | 10000 | 내부 서버 오류 |
| 400 | 10001, 10003, 10004 | 잘못된 입력·데이터 |
| 400 | 30098 | 클라이언트 정보 오류 |
| 400 | 30099 | scope 오류 |
| 400 | 30100 | 인가 코드 무효 |
| 401 | 30101 | 토큰 무효 |
| 401 | 30102 | 토큰 만료 |
| 403 | 30103 | 권한 부족 |
| 400 | 30104 | 유닛 코드 무효 |
| 401 | 30105 | 인증 정보 무효 |
| 400 | 30122 | `application/x-www-form-urlencoded` 필요 |
| 400 | 30123 | redirect URI 오류 |
| 400 | 30124 | 인가 코드 오류 |
| 400 | 30125 | 인가 코드 만료 |

#### Member-Info (Ground API 카테고리)

회원 원천 → 시트 매핑은 [SPEC.md](./SPEC.md) §3.3.1.

##### `GET /member-info/members` — 회원 목록

| Method | URL (전체) | Headers |
|--------|------------|---------|
| GET | `https://openapi.imweb.me/member-info/members` | `Authorization: Bearer <YOUR_ACCESS_TOKEN>` |

**Query (문서)**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `page` | number | ✓ | 페이지 번호 |
| `limit` | number | ✓ | 페이지당 행 수 |
| `joinTimeRangeType` | string | | 가입 시각 범위: `GTE`(이상), `LTE`(이하), `BETWEEN`(구간) |
| `joinTimeRangeValue` | string[] | | `GTE`/`LTE`: 날짜 1개 · `BETWEEN`: 날짜 2개(ISO 8601). **`BETWEEN`은 최대 3개월** |
| `lastLoginTimeRangeType` | string | | 최근 로그인 시각 — 값은 `joinTimeRangeType`과 동일 enum |
| `lastLoginTimeRangeValue` | string[] | | 위와 동일 규칙 · **`BETWEEN` 최대 3개월** |
| `unitCode` | string | ✓ | 유닛 코드 (`GET /site-info` 의 `unitList`·운영 값 등으로 확정) |
| `memberCode` | string | | 회원 코드 |
| `memberUid` | string | | 회원 UID |
| `smsAgree` | string | | `Y` 수신 / `N` 비수신 |
| `emailAgree` | string | | `Y` / `N` |
| `thirdPartyAgree` | string | | 제3자 제공 동의 `Y` / `N` |
| `callnum` | string | | 전화번호 |

*cURL (문서 예 — 쿼리는 필요한 것만 써도 됨)*

```bash
curl 'https://openapi.imweb.me/member-info/members?page=1&limit=10&joinTimeRangeType=GTE&joinTimeRangeValue=2021-01-01T00%3A00%3A00.000Z&lastLoginTimeRangeType=GTE&lastLoginTimeRangeValue=2021-01-01T00%3A00%3A00.000Z&unitCode=u2024012465b0fbe8ce0de&memberCode=m20250402e3b6987310679&memberUid=u123456789&smsAgree=Y&emailAgree=Y&thirdPartyAgree=Y&callnum=01012345678' \
  --header 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

**성공 응답 (문서 테스트)** — 패턴 B, `data`는 페이지 메타 + `list`.

```json
{
  "statusCode": 200,
  "data": {
    "totalCount": 1,
    "totalPage": 1,
    "currentPage": 1,
    "pageSize": 1,
    "list": ["string"]
  }
}
```

| `data` 필드 | 설명 |
|-------------|------|
| `totalCount` | 전체 건수 |
| `totalPage` | 전체 페이지 수 |
| `currentPage` | 현재 페이지 |
| `pageSize` | 현재 페이지 크기 |
| `list` | 회원 객체 배열 (문서 샘플은 placeholder; **실측 JSON**으로 필드 표 보강) |

**Responses** — **200** 조회 성공 · **default** 오류(공통 Error List는 Reference).

##### 회원 단건 등

단건 조회·기타 Member-Info 연산은 Reference에서 붙이면 이 카테고리 아래에 같은 형식으로 추가.

#### Product (Ground API 카테고리)

상품 원천 → 시트 매핑은 [SPEC.md](./SPEC.md) §3.3.4.

##### `GET /products` — 상품 목록

| Method | URL (전체) | Headers |
|--------|------------|---------|
| GET | `https://openapi.imweb.me/products` | `Authorization: Bearer <YOUR_ACCESS_TOKEN>` |

**Query (문서)**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `page` | number | ✓ | 페이지 번호 |
| `limit` | number | ✓ | 페이지당 행 수 |
| `unitCode` | string | ✓ | 유닛 코드 (`GET /site-info` 의 `unitList`·운영 값 등으로 확정) |
| `categoryCode` | string | | 카테고리 코드 |
| `prodName` | string | | 상품명 (부분 검색 등 동작은 Reference·실측) |
| `prodStatus` | string | | `sale` 판매중 · `soldout` 품절 · `nosale` 숨김 |
| `prodType` | string | | `normal` 일반 · `digital` 디지털 · `subscribe` 이용권 |
| `usePreSale` | string | | 판매기간 사용: `Y` / `N` |
| `productAddTimeType` | string | | 추가 시각 범위: `GTE`(이상) · `LTE`(이하) · `BETWEEN`(구간) |
| `productAddTime` | string[] | | `GTE`/`LTE`: 날짜 1개 · `BETWEEN`: 날짜 2개 (ISO 8601). 예: `['2021-01-01T00:00:00', '2021-01-31T23:59:59']` |
| `productEditTimeType` | string | | 수정 시각 범위 — 값은 `productAddTimeType`과 동일 enum |
| `productEditTime` | string[] | | 위와 동일 규칙 |

*cURL (문서 예 — 쿼리는 필요한 것만 사용 가능)*

```bash
curl 'https://openapi.imweb.me/products?page=1&limit=10&categoryCode=s201807255b57e5d4dc219&prodName=%EC%83%81%ED%92%88%20%EC%9D%B4%EB%A6%84&prodStatus=sale&prodType=normal&usePreSale=Y&productAddTimeType=GTE&productAddTime=2021-01-01T00%3A00%3A00&productAddTime=2021-01-31T23%3A59%3A59&productEditTimeType=GTE&productEditTime=2021-01-01T00%3A00%3A00&productEditTime=2021-01-31T23%3A59%3A59&unitCode=u20210810611211bd954ec' \
  --header 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

**성공 응답 (문서 테스트)** — 패턴 B. `data`는 **배열**이며, 요소 하나에 페이지 메타와 `list`가 있다.

```json
{
  "statusCode": 200,
  "data": [
    {
      "totalCount": 1,
      "totalPage": 1,
      "currentPage": 1,
      "pageSize": 1,
      "list": [
        {
          "prodNo": 1,
          "siteCode": "S2024012430f7813d2ddaf",
          "unitCode": "u2024012465b0fbe8ce0de",
          "prodCode": "s20240830b4211761ce38c",
          "categories": ["string"],
          "showcases": ["c202402142338389317ef1"],
          "shippingServiceCodes": ["ss2024012465b0fbe8ce0de"],
          "name": "string",
          "price": 1,
          "priceOrg": 1,
          "priceTax": "Y",
          "priceSupply": 1,
          "sortNo": 1,
          "prodStatus": "sale",
          "prodType": "normal",
          "addTime": "2022-05-15T00:00:00.000Z",
          "editTime": "2022-05-15T00:00:00.000Z"
        }
      ]
    }
  ]
}
```

*`list` 항목* — 문서 샘플에는 가격·배송·재고·옵션·SEO·`productInfoNotice`·`periodDiscount` 등 필드가 더 있음. **실측 JSON**으로 필드 표를 보강한다.

| `data[0]` (또는 동일 구조의 단일 객체) | 설명 |
|----------------------------------------|------|
| `totalCount` | 전체 건수 |
| `totalPage` | 전체 페이지 수 |
| `currentPage` | 현재 페이지 |
| `pageSize` | 페이지 크기 |
| `list` | 상품 객체 배열 |

*구현 시* — 응답이 `data: { totalCount, … }` 단일 객체로 오는지, 문서처럼 `data: [ { … } ]` 인지 **실측**으로 맞출 것 (`GET /member-info/members` 와 표기가 다를 수 있음).

**Responses** — **200** 조회 성공 · **default** 오류(공통 Error List는 Reference).

##### `GET /products/{prodNo}` — 상품 단건

목록보다 필드 많음(`content`·`simpleContent` 등). [SPEC.md](./SPEC.md) §3.3.4 기준 **시트에 필요한 값이 목록 `list[]`에만으로 충분하면 호출 생략** — 부족하면 보완용. 실측 비교: `gas/testapi.js`가 목록 첫 `prodNo`로 단건 호출(또는 Script Property `IMWEB_SMOKE_PROD_NO`).

| 항목 | 내용 |
|------|------|
| 요청 | **GET** `https://openapi.imweb.me/products/{prodNo}` · Query `unitCode`(필수) · Bearer |
| 성공 | 패턴 B · `data` = 상품 1건 |

```bash
curl 'https://openapi.imweb.me/products/1?unitCode=u20210810611211bd954ec' \
  --header 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

##### `GET /products/{prodNo}/options` — 상품 옵션 목록

실측·필드 비교용으로 `testapi.js`가 단건과 동일 `prodNo`로 호출( `IMWEB_SMOKE_PROD_NO` 또는 목록 첫 행).

| 항목 | 내용 |
|------|------|
| 요청 | **GET** `https://openapi.imweb.me/products/{prodNo}/options` · Query `page`·`limit`·`unitCode`(필수) · Bearer |
| 성공 | 패턴 B · `data` 배열 1요소에 페이지 메타 + `list`(옵션 그룹: `type`, `optionCode`, `name`, `optionValueList`, `isRequire` 등) — `GET /products` 와 동일하게 `data` 래핑 형태는 **실측**으로 맞출 것 |

```bash
curl 'https://openapi.imweb.me/products/1/options?page=1&limit=10&unitCode=u20210810611211bd954ec' \
  --header 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

*응답 예 (문서 테스트, `list[]` 항목 일부)*

```json
{
  "statusCode": 200,
  "data": [
    {
      "totalCount": 1,
      "totalPage": 1,
      "currentPage": 1,
      "pageSize": 1,
      "list": [
        {
          "type": "default",
          "optionCode": "O2024092566f3726054a3a",
          "name": "색상",
          "optionValueList": [
            {
              "optionValueCode": "O202409254e3180103a548",
              "optionValueName": "100",
              "color": "#000000",
              "imageUrl": "https://cdn.imweb.me/upload/…/….png"
            }
          ],
          "isRequire": "Y"
        }
      ]
    }
  ]
}
```

##### `GET /products/{prodNo}/options/{optionCode}` — 상품 옵션 단건

옵션 **한 그룹** 조회. `testapi.js`는 옵션 목록 응답의 첫 `optionCode`로 연쇄 호출(또는 `IMWEB_SMOKE_OPTION_CODE`).

| 항목 | 내용 |
|------|------|
| 요청 | **GET** `https://openapi.imweb.me/products/{prodNo}/options/{optionCode}` · Query `unitCode`(필수) · Bearer |
| 성공 | 패턴 B · 문서 테스트 기준 `data` = 옵션 객체 배열(보통 1요소, `type`·`optionCode`·`name`·`optionValueList`·`isRequire`) — **실측**으로 형태 확인 |

```bash
curl 'https://openapi.imweb.me/products/1/options/O2024092566f3726054a3a?unitCode=u2024012465b0fbe8ce0de' \
  --header 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

*응답 예 (문서 테스트)*

```json
{
  "statusCode": 200,
  "data": [
    {
      "type": "default",
      "optionCode": "O2024092566f3726054a3a",
      "name": "색상",
      "optionValueList": [
        {
          "optionValueCode": "O202409254e3180103a548",
          "optionValueName": "100",
          "color": "#000000",
          "imageUrl": "https://cdn.imweb.me/upload/…/….png"
        }
      ],
      "isRequire": "Y"
    }
  ]
}
```

##### 상품 등록·수정 등

등록·수정 등은 Reference에서 붙이면 이 카테고리 아래에 같은 형식으로 추가.

#### 주문 (Open API `openapi.imweb.me` — Order 카테고리)

| Method | Path | 비고 |
|--------|------|------|
| GET | `/orders` | Query: `page`, `limit`, `unitCode` 등 (Reference). 주문일시 필터는 `startWtime` / `endWtime` (UTC ISO8601). **응답 `data.list[]`에 주문 1건당 `sections[].sectionItems[]` 포함** — `sectionItems[].productInfo.prodName`, `prodNo` 등으로 **품목·상품명은 목록/단건 안에 중첩됨**. |
| GET | `/orders/{orderNo}` | Path: `orderNo`(number). 구조는 목록의 `list` 원소와 동일 계열. |

**→ 원천 DB 시트** — 구현: `dbSyncMembersOpen`, `dbSyncOrdersOpen`, `dbSyncProductsOnePage` (`gas/DB/`), **헤더**는 `dbSchema.js` (`DB_*_HEADERS`). `orders`·`members`·`order_items`·`products` 끝 2열은 `fetched_at`·`source_sync_id` (시트·열 이름은 [SPEC.md](./SPEC.md) §5.1.1). 아래 **Open API 필드명 ↔ 열**은 `dbMap*RowOpen_`와 동일.

| `orders` | Open API |
|----------|----------|
| `order_no` | `orderNo` |
| `order_time` | `wtime` |
| `orderer_member_code` / `orderer_name` / `orderer_call` | `memberCode` / `ordererName` / `ordererCall` |
| `order_status` / `order_type` / `currency` | `orderStatus` / `orderType` / `currency` |
| `total_price` / `total_discount_price` / `total_point` / `line_coupon_sum` / `payment_amount` | `totalPrice` / `totalDiscountPrice` / `totalPoint` / **모든 `sectionItems`의 `itemCouponDiscount` 합** / `totalPaymentPrice` |

| `order_items` (행 = `sections[].sectionItems[]` 1칸) | Open API |
|----------|----------|
| `order_section_item_no` / `order_item_code` | `orderSectionItemNo` / `orderItemCode` |
| `order_no` / `order_status` / `section_status` | `orderNo` / `orderStatus` / `orderSectionStatus` (섹션) |
| `claim_status` | `cancelInfo.cancelRequestTime`이 있으면 `cancel`, 아니면 `returnInfo.returnRequestTime`이 있으면 `return`, 아니면 빈칸 |
| `claim_type` | 취소/반품 **사유** 문자열(최대 300자) — `cancelInfo` / `returnInfo`의 reason 필드 |
| `prod_no` / `prod_name` / `line_price` | `productInfo.prodNo` / `prodName` / `itemPrice` |
| `line_price_sale` / `line_point` / `line_coupon` | `gradeDiscount`+`itemCouponDiscount`+`itemPromotionDiscount` / `itemPointAmount` / `itemCouponDiscount` |
| `line_period_discount` | `0` (고정) |
| `options_raw` / `options_count` | `productInfo.optionInfo`(JSON) / `optionInfo` 키 수·`optionInfoList` 길이 중 큰 값 |
| `row_json` | `{ orderSection, sectionItem, productInfo }` JSON, **49 000자 초과 시 잘림** |

| `members` (순서: `DB_MEMBERS_HEADERS`) | Open API (camelCase) |
|----------|----------|
| `addr` / `sms_agree` / `email_agree` / `group_json` | `address` / `smsAgree` / `emailAgree` / `group` |
| `member_code`…`recommend_target_code`·`last_login_time`·`member_grade` | `memberCode`…`recommendTargetCode`·`lastLoginTime`·`grade` (나머지는 이름만 snake↔camel) |

[SPEC.md](./SPEC.md) §3.3.2·3.3.3 — Shop v2 주문/품목; Open만 쓰면 **동기화는 Open 경로**를 정본으로 둔다.

#### 주문 · 품목주문 (레거시 `/v2/shop` — 옵션)

| Method | Path | 비고 |
|--------|------|------|
| GET | `/v2/shop/orders` | 기간·`order_version` 등. 기간 1요청 **약 3개월 초과 시 `code=-19`** |
| GET | `/v2/shop/orders/{order_no}` | |
| GET | `/v2/shop/orders/{order_no}/prod-orders` | 품목주문 목록 (구 스키마) |
| GET | `/v2/shop/orders/{order_no}/prod-orders/{품목주문번호}` | 품목주문 1건 |

Open API `GET /orders`로 품목이 내려오면 **레거시 `prod-orders`를 또 호출할 필요는 없다** (동기화·매핑은 한 경로로 통일하는 편이 낫다).

---

## 2. 자체 API (GAS Web App — 백엔드가 제공)

**베이스 URL** — 배포된 Web App URL 한 개 (예: `https://script.google.com/macros/s/…/exec`). 환경마다 다르므로 [process.md](../process.md) §2 또는 Script 배포 화면의 URL을 정본으로 둔다.

**아임웹 위젯 · 브라우저** — `ContentService` `TextOutput` 은 CORS용 `setHeader` 가 **없어** 크로스 오리진 `fetch`로 읽기 어렵다. **브라우저 대시보드**는 `GET` **JSONP** (`?format=jsonp&callback=…&action=…`) — 구현·배포·`getRange` 시트 쓰기는 [GAS_WEBAPP_SHEETS.md](./GAS_WEBAPP_SHEETS.md). 프론트 쪽 서술은 [solpath-dashboard-front: docs/IMWEB_CORS.md](https://github.com/eunsang9597/solpath-dashboard-front/blob/main/docs/IMWEB_CORS.md).

**메서드** — `GET` = OAuth·관리 콘솔·**JSONP 동기**(`Code.js` `doGet` 선행 분기) + 루트. `POST` = 동기 API(`HttpOpenSync.js` `doPost`, curl·서버·도구에 적합).

### 2.1 `GET` 루트 (현재 `Code.js`)

| Method | URL | Query | Request body | Response | Errors |
|--------|-----|-------|--------------|----------|--------|
| GET | `…/exec` | `?format=jsonp&callback=…&action=ping` 또는 `action=syncOpenFull` | — | `text/javascript` 콜백 래핑 JSON | GAS 예외 시 HTML 오류 / Executions |
| GET | `…/exec` | *(또는 `?code=` OAuth)* | — | HTML / 리다이렉트 | GAS 예외 시 5xx |

*응답* — 일반 루트는 **OAuth·토큰·리다이렉트** 위주. 대시보드 “실행”·헬스는 **JSONP** 또는 아래 `POST` `ping`.

### 2.2 `POST` Open Sync (구현 — `HttpOpenSync.js`)

**URL** — Web App **배포** URL과 동일(예: `https://script.google.com/macros/s/…/exec`).

**인증** — 엔드포인트는 **토큰 없음** (누구나 Web App 권한대로 `POST` 가능). UI에서 문구 입력 후 실행 등으로 **실수·남용만 완화**하는 전제. 배포 **Anyone** + **Me** — [GAS_WEBAPP_SHEETS.md](./GAS_WEBAPP_SHEETS.md) §1.

| `action` | 동작 | 성공 `data` |
|----------|------|-------------|
| `ping` | 연결·헬스 | `{ name, version, actions: ['ping','syncOpenFull'] }` |
| `syncOpenFull` | `dbSyncOpenAll()` = members → products(1p) → orders | `{ members, products, orders }` (각 `dbSync*Open` 반환) |

**Request** — `Content-Type: application/x-www-form-urlencoded` 또는 `text/plain` (본문 `action=…`).

```
action=syncOpenFull
```

**Response 200** — `Content-Type: application/json`

```json
{
  "ok": true,
  "data": {
    "members": { "syncId": "…", "rows": 0 },
    "products": { "syncId": "…", "rows": 0 },
    "orders": { "syncId": "…", "orderRows": 0, "itemRows": 0 },
    "spreadsheetUrl": "https://docs.google.com/spreadsheets/d/<SHEETS_MASTER_ID>/edit"
  }
}
```

`spreadsheetUrl` — `SHEETS_MASTER_ID` 가 있을 때만(없으면 빈 문자열). 프론트 **데이터 확인** 링크용.

**오류** — HTTP는 대부분 200, 본문으로 구분.

```json
{ "ok": false, "error": "SYNC_FAILED", "message": "…" }
{ "ok": false, "error": "UNKNOWN_ACTION", "allowed": ["ping", "syncOpenFull"] }
```

**OPTIONS** — `doOptions` (빈 응답; 일부 런타임은 무시).

**함수(코드) 매핑** — `action=syncOpenFull` → `dbSyncOpenAll()` → `dbSyncMembersOpen` → `dbSyncProductsOnePage` → `dbSyncOrdersOpen`. 시트 `getRange(…, numRows, numCols)`·`dbSetValuesFromRow2_` — [GAS_WEBAPP_SHEETS.md](./GAS_WEBAPP_SHEETS.md) §4.

### 2.3 상품 항목 분류 (`product_mapping`)

원천 `products` + 운영 시트 `product_mapping` — 스키마·열거는 [SCHEMA_PRODUCT_MAPPING.md](./SCHEMA_PRODUCT_MAPPING.md). 프론트 UX(저장 버튼·초기 시트 생성)는 [front/docs/PRODUCT_CLASSIFICATION_UI.md](../front/docs/PRODUCT_CLASSIFICATION_UI.md).

**공통** — `POST`는 `Content-Type: application/x-www-form-urlencoded` 또는 `text/plain` + 본문, 또는 JSON 본문(구현 시 하나로 통일). 브라우저 읽기는 `GET` **JSONP** `?format=jsonp&callback=…&action=…` (§2, [GAS_WEBAPP_SHEETS.md](./GAS_WEBAPP_SHEETS.md)).

| `action` (GET JSONP) | 용도 | `data` 요약 |
|----------------------|------|----------------|
| `productMappingState` | 운영 스프레드시트·`product_mapping` 시트 **준비 여부** + 링크 | 아래 §2.3.1 |
| `productMappingList` | 원천 상품 + 매핑 **병합** 목록(페이지 UI) | §2.3.2. 준비 안 됐으면 `ok: false` + `error.code: NO_OPERATIONS_SHEET` |

| `action` (POST) | 용도 | 비고 |
|-----------------|------|------|
| `initOperationsSheets` | **새** 운영용 스프레드시트 생성(원천 DB와 **같은 Drive 폴더**), `SHEETS_OPERATIONS_ID` 저장, `product_mapping` 탭+헤더·**원천 `products`에서 초기 행 시드** | 최초 1회. 이미 ID가 있으면 `ok: false` + `ALREADY_CONFIGURED` 또는 idempotent `ok: true` (구현 선택) |
| `productMappingApply` | `prod_no` 기준 **배치 upsert** (프론트 **「수정하기」** 1클릭) | 본문 §2.3.3 |

#### 2.3.1 `GET` `productMappingState` (JSONP)

**성공 200 (JSONP 래핑)** — `data` 예:

```json
{
  "ready": true,
  "masterSpreadsheetUrl": "https://docs.google.com/spreadsheets/d/…/edit",
  "operationsSpreadsheetId": "…",
  "operationsSpreadsheetUrl": "https://docs.google.com/spreadsheets/d/…/edit",
  "productMappingSheetName": "product_mapping"
}
```

`ready: false` 인 경우(프로퍼티 없음·파일 열기 실패 등):

```json
{
  "ready": false,
  "reason": "NO_OPERATIONS_SHEET",
  "masterSpreadsheetUrl": "https://docs.google.com/spreadsheets/d/…/edit"
}
```

- `masterSpreadsheetUrl` — 원천 `SHEETS_MASTER_ID` 기준 URL(빈 문자열 수 있음). `ready: true`일 때도 내려 **원천/운영 둘 다** 「시트로 열기」 링크에 씀.
- `reason` — 문자열 코드로 통일 (`NO_OPERATIONS_SHEET` | …).

#### 2.3.2 `GET` `productMappingList` (JSONP)

- **전제:** `ready === true`. 아니면 `ok: false`, `error: { "code": "NO_OPERATIONS_SHEET", "message": "…" }`.
- `data` — 프론트가 미분류/4분류/접기 UI를 그리기 쉬운 형태로 **한 종류**로 고정(구현 시 아래를 스키마로 엄격히).

**제안 스키마 (한 번에 병합)**

```json
{
  "rows": [
    {
      "prod_no": 12345,
      "product_name": "…",
      "product_name_display": "… 20자 컷 + …",
      "internal_category": "unmapped",
      "lifecycle": "active",
      "notes": "",
      "created_at": "",
      "updated_at": ""
    }
  ],
  "counts": {
    "unmapped": 0,
    "solpass": 0,
    "solutine": 0,
    "challenge": 0,
    "textbook": 0
  }
}
```

- `products` 원천에만 있고 `product_mapping` 행이 없으면, 서버가 **`internal_category: "unmapped"`**, `lifecycle` 기본값(예: `active`)으로 **채워 넣지 않고** 클라이언트 기본을 주거나, **빈 매핑**을 내려서 클라이언트가 `unmapped`로 표시 — **둘 중 하나로 통일** (권장: 서버가 항상 5개 분류+라이프사이클 키를 내려 **한 타입**).
- (선택) `GET` 직전 원천 `products` **스냅샷**과 동기화하려면 별도 동기 job과 분리; v0는 **시트 캐시**만 읽어도 됨.

#### 2.3.3 `POST` `initOperationsSheets`

**본문 (form 권장)**

```
action=initOperationsSheets
```

또는 JSON `{ "action": "initOperationsSheets" }` — GAS `doPost` 파서와 맞출 것.

**성공 `data`**

```json
{
  "operationsSpreadsheetId": "…",
  "operationsSpreadsheetUrl": "https://docs.google.com/spreadsheets/d/…/edit",
  "alreadyConfigured": false,
  "productMappingHeadersApplied": true,
  "createdNew": true,
  "seededRowCount": 76
}
```

- `seededRowCount` — `product_mapping`이 **비어 있을 때만** 원천 `products`에서 `prod_no`·`product_name` 등으로 채운 행 수. 이미 2행 이상 있으면 **0** (덮어쓰지 않음).
- 파일 제목 예: `솔루션편입_운영DB_아임웹` (팀에서 확정). 위치: 원천 마스터와 **같은 부모 폴더**([process.md](../process.md) · `dbSchema` `DB` 폴더 규칙)에 두는 것을 권장.

#### 2.3.4 `POST` `productMappingApply`

**본문 (JSON, UTF-8)** — **배치** (프론트가 편집한 행만 보내거나, 전체 dirty 행; 구현은 **배열 upsert**).

```json
{
  "action": "productMappingApply",
  "rows": [
    {
      "prod_no": 12345,
      "product_name": "스냅샷(선택, 원천 name과 맞출 것)",
      "internal_category": "solpass",
      "lifecycle": "active",
      "notes": ""
    }
  ]
}
```

**검증** — `internal_category` ∈ `unmapped|solpass|solutine|challenge|textbook`, `lifecycle` ∈ `active|archived|test`. 위반 시 `ok: false`, `error.code: BAD_REQUEST`.

**성공 `data`**

```json
{ "upserted": 3, "updated_at": "2026-04-25T12:00:00.000Z" }
```

- 시트: `created_at` 은 **신규 행에만**; `updated_at` 은 **항상** 갱신.
- GAS: `httpOpenSync`의 `ping` `allowed` 배열에 위 `action` 이름들을 **추가**해 배포 문서·클라이언트가 참고.

**에러 `code` 추가 (이 절)**

| code | 의미 |
|------|------|
| `NO_OPERATIONS_SHEET` | `productMappingList` / `apply` — 운영 스프레드시트 없음 |
| `ALREADY_CONFIGURED` | `initOperationsSheets` — 이미 `SHEETS_OPERATIONS_ID` 있음 (선택) |

---

### 2.4 향후 엔드포인트 (템플릿)

추가할 때마다 아래 블록을 복사한다.

#### `POST /exec?action=…` (추가 엔드포인트 예시)

| 항목 | 내용 |
|------|------|
| **목적** | *(한 줄)* |
| **Query** | `action` (또는 본문) |
| **Request body** | 아래 JSON 스키마 |
| **Response 200** | `{ "ok": true, "data": … }` |
| **Errors** | `400` BAD_REQUEST, … (Open Sync는 JSON 본문 `ok:false`) |

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
| 2026-04-25 | 초안: 자체 API 공통 규칙, 아임웹 베이스 URL·응답 패턴 A/B, Ground Reference 링크 |
| 2026-04-25 | **Site-Info** — `GET /site-info`(Bearer 액세스 토큰), `PATCH …/integration-complete`, `PATCH …/integration-cancellation`(Error List 포함). `GET /site-info/unit/{unitCode}` 는 문서에서 제외 |
| 2026-04-25 | **OAuth2** — `GET /oauth2/authorize`, `POST /oauth2/token`(form-urlencoded), scope·유효기간·레이트리밋·errorCode 요약 |
| 2026-04-25 | **Member-Info** — `GET /member-info/members` |
| 2026-04-25 | **Product (Ground)** — 목록·단건·옵션 목록·옵션 단건. 스모크·선택 Property는 `gas/testapi.js` 주석·[process.md](../process.md) §2 |
| 2026-04-25 | **Order → 원천 시트** — Open API 필드 → `dbSchema.js` `orders` / `order_items` 매핑 표 (§1.2 주문) |
| 2026-04-25 | **Order (Open API)** — `GET /orders`, `GET /orders/{orderNo}`. 품목은 `sections[].sectionItems` — 레거시 `prod-orders` 병행 여부는 매핑 정책으로 결정 |
| 2026-04-25 | §1.2 인벤토리 표 추가, 변경 이력 압축, 주문 절을 레거시 스텁 명시로 정리 |
| 2026-04-25 | **구현** — `gas/imwebAuth.js`: Open API는 OAuth2 `accessToken`만 Bearer; `v2/auth` 토큰은 30101 |
| 2026-04-25 | **GAS** — `HttpOpenSync.js`: `POST` `action=ping|syncOpenFull` · CORS. `dbSyncOpenAll` 반환. 토큰 필드 제거(위젯에서 문구 확인만) |
| 2026-04-25 | **GAS** — `TextOutput`에 CORS `setHeader` 없음·브라우저는 **JSONP** (`GET ?format=jsonp`). `getRange` 3·4인자=**행/열 개수** (`dbSheets.js`). 상세: [GAS_WEBAPP_SHEETS.md](./GAS_WEBAPP_SHEETS.md) · §2~4 갱신 |
| 2026-04-25 | **§2.3** — `productMappingState` / `productMappingList` (GET JSONP), `initOperationsSheets` / `productMappingApply` (POST). [SCHEMA_PRODUCT_MAPPING.md](./SCHEMA_PRODUCT_MAPPING.md), [front/docs/PRODUCT_CLASSIFICATION_UI.md](../front/docs/PRODUCT_CLASSIFICATION_UI.md) |

이후부터는 **날짜당 한 줄** 위주로 쌓고, 상세는 [process.md](../process.md) 변경 이력·[GAS_WEBAPP_SHEETS.md](./GAS_WEBAPP_SHEETS.md)에 남긴다.
