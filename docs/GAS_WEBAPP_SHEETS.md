# GAS Web App · 시트 쓰기 — 운영 메모

대시보드(`…/exec`) 호출, 브라우저 CORS, 스프레드시트 `getRange`/`setValues` 관련 이슈를 한곳에 정리한다. 구현은 `gas/HttpOpenSync.js`, `gas/Code.js`, `gas/DB/dbSheets.js` 가 정본이다.

---

## 1. Web App 배포 (접근·실행 주체)

| 설정 | 권장값 | 비고 |
|------|--------|------|
| **Execute as** | `Me` (배포 계정) | 시트·`ScriptProperties`·아임웹 토큰은 이 계정 권한으로 실행 |
| **Who has access** | `Anyone` (익명) | `www.*` / 임웹에서 **로그인 없이** `fetch`·JSONP로 부르려면 필수. `Anyone with Google account` 만 두면 시크릿·다른 도메인 `POST` 가 401·로그인 HTML로 떨어질 수 있음 |

- URL은 **배포 관리**에 표시된 **`…/exec` 전체**를 정본으로 둔다. 새 배포 시 ID가 바뀔 수 있음.
- 로컬 반영: 레포 루트에서 `clasp push` 후, 편집기에서 **배포 → 새 버전**까지 해야 트래픽이 새 코드를 탄다.

---

## 2. 브라우저에서 `…/exec` 부르기 (CORS · JSONP)

### 2.1 `TextOutput`에는 CORS용 `setHeader` 가 없다

Google Apps Script [ContentService TextOutput](https://developers.google.com/apps-script/reference/content/text-output) 공개 메서드에 **`setHeader` 가 없다**. (과거 블로그·샘플에 `setHeader`로 CORS를 넣는 코드가 있으나 런타임에서 `TypeError: out.setHeader is not a function` 이 난다.)  
그 결과 **응답에 `Access-Control-Allow-Origin` 을 붙일 수 없고**, 사이트 도메인에서 **`fetch`로 응답 본문을 읽는** 방식은 CORS에 막힌다(네트워크는 200이어도).

### 2.2 대시보드(프론트) 대응: JSONP (GET + `?format=jsonp`)

- **`Code.js` `doGet` 초입**에서 `format=jsonp` 이고 `callback` 이 있으면 `openSyncJsonpFromGet_` (`HttpOpenSync.js`) 로 처리한다.
- 응답은 `콜백이름({...json...});` 형태, MIME 은 `ContentService.MimeType.JAVASCRIPT` (또는 환경에 따라 `TEXT`).
- 프론트는 **`<script src=".../exec?format=jsonp&callback=…&action=…">`** 로 로드 — 스크립트 태그는 CORS `fetch`와 다른 경로이므로 동작한다.
- **POST + `action=...`** (urlencoded / `text/plain`) 는 **curl·서버·GAS 편집기 실행** 등에 그대로 두면 된다.

### 2.3 임웹/분석 스크립트

같은 페이지의 **`imdog.js` 등**이 여전히 **`fetch` POST** 로 `…/exec` 를 치면, 그 요청은 별도이므로 CORS/401이 **콘솔에 남을 수 있다**. 대시보드 위젯만 JSONP로 바꿨다면 **기능은 동작**해도, 해당 스크립트는 끄거나 URL 중복을 줄이는 식으로 정리하는 것이 좋다.

---

## 3. `doPost` / `doGet` 역할 정리

| 경로 | 용도 |
|------|------|
| `POST /exec` + 본문 `action=ping \| syncOpenFull` | JSON 본문 (`application/json`), 동기 `dbSyncOpenAll()` 체인 |
| `GET /exec?format=jsonp&callback=NAME&action=...` | 브라우저 JSONP (위 2.2) |
| `GET /exec` (그 외) | `Code.js` — OAuth `?code=`, 리프레시, 아임웹 인가 UI 등 (대시보드 “실행”과 별도) |
| `OPTIONS` | `doOptions` — 빈 본문 정도만 (환경에 따라 무시) |

---

## 4. 스프레드시트 `getRange` — 3·4번째 인자는 **끝 좌표가 아니라 “개수”**

[Sheet.getRange(row, column, numRows, numColumns)](https://developers.google.com/apps-script/reference/spreadsheet/sheet#getRange(Integer,Integer,Integer,Integer))  
→ **3번째 = 행 개수**, **4번째 = 열 개수** (시작 셀 `(row, column)`에서 아래·오른쪽으로 몇 칸).

### 흔한 실수 (102행 데이터 vs 103행 범위)

데이터가 **n행**이고 1행이 헤더일 때, 2행부터 쓰려면:

- **잘못:** `getRange(2, 1, 1 + n, w)` — 세 번째 인자를 “마지막 행 번호”로 읽는 습관(VBA·다른 API)과 혼동하면 안 된다. 여기서 `1+n` 은 **행 개수**로 해석되므로, `n=102` 이면 **103행** 범위가 되어 `setValues` 102행과 불일치한다.
- **맞음:** `getRange(2, 1, n, w)` — 2행부터 **정확히 n행**.

`dbSheets.js`의 **`dbSetValuesFromRow2_`** / **`dbClearDataRows2Plus_`** 가 위 규칙을 따르도록 통일해 두었다. 2행~`getLastRow()` 를 지울 때는 행 **개수** = `lastRow - 2 + 1` (2 이상일 때).

### 헤더 1행

- `getRange(1, 1, 1, w)` → 행 **1개**, 열 `w` 개. (여기서 세 번째 `1` 은 “행 1칸” = `numRows === 1`.)

---

## 5. 동기화 체인에서의 위치

`action=syncOpenFull` (또는 JSONP 동일 액션) → `dbSyncOpenAll()`:

1. `dbSyncMembersOpen` — `members` 시트  
2. `dbSyncProductsOnePage` — `products` (현재 1페이지 스냅샷)  
3. `dbSyncOrdersOpen` — `orders` / `order_items`

시트·헤더 정의는 `gas/DB/dbSchema.js`, 쓰기 도우미는 `gas/DB/dbSheets.js`.

---

## 6. 빠른 점검 (문제가 나올 때)

| 증상 | 점검 |
|------|------|
| 401, 로그인 HTML | Web App **Anyone** 인지, `clasp push` + **새 배포** 됐는지 |
| CORS, `No Access-Control-Allow-Origin` | `fetch` 응답을 읽는지 → 대시보드는 **JSONP** 사용. `setHeader`로 해결 시도는 비대상 |
| `setHeader is not a function` (Executions) | 구버전/잘못된 CORS 코드 제거 여부, 최신 `HttpOpenSync` 인지 |
| 데이터 n행 vs 범위 n+1행 불일치 | `getRange(2,1,**n**,w)` 인지, `1+n` 을 “끝 행”으로 쓰지 않았는지 (§4) |

---

## 7. 관련 문서

- [BACKEND_API.md](./BACKEND_API.md) §2 — 자체 API 계약(요청/응답 JSON)  
- [process.md](../process.md) — Properties·clasp·운영 절차  
- [gas/README.md](../gas/README.md) — `gas/` 디렉터리·`clasp`  
- 프론트(임웹) CORS·JSONP 흐름: [solpath-dashboard-front: docs/IMWEB_CORS.md](https://github.com/eunsang9597/solpath-dashboard-front/blob/main/docs/IMWEB_CORS.md)

---

## 8. 변경 이력 (이 문서)

| 날짜 | 내용 |
|------|------|
| 2026-04-25 | 초안: Web App 배포, TextOutput·CORS, JSONP, getRange numRows, 시트 쓰기, 트러블슈팅 링크 |
