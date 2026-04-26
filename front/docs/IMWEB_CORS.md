# 아임웹 위젯 · CORS · 스크립트 정책

`process.md`·루트 README에 있는 대로, 대시보드 **프론트**는 `solpath-dashboard-front` 정적 파일을 **jsDelivr**로 쓰고, **백엔드**는 GAS Web App(`…/exec`)을 호출하는 구조를 전제로 한다.

## 1. 위젯에 넣는 방식 (권장 순)

1. **`<iframe src="https://cdn.jsdelivr.net/gh/…/index.html">`** (레포: `IMWEB_SNIPPET.html`)  
   - 앱이 **자식 origin(jsDelivr)** 에서 돌아간다.  
   - 다만 **아임웹·많은 빌더는 `iframe` 을 CSP·보안 정책으로 막거나, 편집기 미리보기에서만 막는** 경우가 있다. 그때는 2번으로 갈 것.

2. **`<link>` + `#solpath-root` + `type=module` 스크립트** (레포: `IMWEB_SNIPPET_INJECT.html`) — **iframe 이 막힐 때 기본**  
   - 스타일·`app.js`를 **jsDelivr 절대 URL**로 불러와 **부모 페이지 안**에 그린다.  
   - `app.js`가 `syncPageTemplate.js` 마크업을 `#solpath-root`에 주입한다.  
   - `type=module` 이 위젯에서 막히면(드묾) 비모듈 번들 Phase — 에자일로 추후.

**id 충돌 방지** — 동기 화면 컨트롤 id 는 `sp-` 접두(예: `sp-statusLine`).

**캐시** — `…@main`은 브랜치 해시 캐시로 바뀔 수 있으니, **배포 고정**이면 `@<커밋 SHA>` URL을 쓰면 된다(README·스니펫에 주석).

## 2. CORS(프론트 `fetch` → GAS `…/exec`)

- **정적 HTML이 로드된 origin** — GitHub/ jsDelivr 도메인 → **GAS**는 `script.google.com`이므로 **다른 origin**이며, `fetch(배포 URL, { method: 'POST', … })` 는 [CORS] 규칙이 적용된다.
- GAS `ContentService` 응답에 예시로 다음 **응답 헤더**를 붙일 수 있어야 한다(구현은 백엔드):
  - `Access-Control-Allow-Origin`: `*` 또는 (고정이면) `https://cdn.jsdelivr.net` + 필요 시 `https://eunsang9597.github.io` 등
  - `Access-Control-Allow-Methods`: `GET, POST, OPTIONS`
  - `Access-Control-Allow-Headers`: `Content-Type` (필요한 헤더만)
- **`Content-Type: application/json` 으로 POST** 하면 브라우저가 **OPTIONS** 프리플라이트**를** 보낼 수 있어, GAS/프론트에서 불리할 수 있다. 본 대시보드 `app.js`는 **프리플라이트를 피하기 위해** `Content-Type: text/plain` + `action=…` 본문으로 `POST`한다 (`HttpOpenSync`에서 동일 파싱).  
- 프리플라이트가 **막힌 환경**이면, **1차**로 `application/x-www-form-urlencoded` 단순 POST(또는 `text/plain` 본문)로 피하는 방안을 백엔드와 약속할 수 있다.
- **민감 작업(동기화 트리거)** 은 `fetch` + 공개 URL만으로 두지 말고, **GAS `ScriptProperties`에 둔 토큰**을 query/body로 넣어 검증(공개 HTML에는 토큰 **넣지 말 것**—위젯은 운영자 전용 가정이어도 소스엔 남는다. 운자만 접근 + 서버에만 비밀).

## 3. GAS `Code.js`와의 관계(현황)

- **현 `doGet`** — OAuth·인가·HTML 응답이 중심. **자체 API JSON**용 `doPost`는 별도 이슈로 붙이면, 위 CORS·OPTIONS 규칙을 같이 맞춘다.  
- 상세한 엔드포인트는 **메타 레포** `통계자료마스터` — `docs/BACKEND_API.md` `§2. 자체 API` 를 갱신한다.

## 4. 정리

| 주제 | 정책 |
|------|------|
| 위젯 삽입 | **iframe** 우선(모듈·asset 분리 유지) |
| fetch → GAS | GAS **응답에 CORS 헤더** + 필요 시 **OPTIONS** |
| 토큰 | HTML에 실값 **금지**, GAS·스크립트 속성만 |
| 캐시 | 운영 고정이면 `jsDelivr@커밋` |

(상위 `통계자료마스터`는 `front/` 를 gitignore — 이 문서는 **프론트 전용 repo** `solpath-dashboard-front`에만 올라간다.)
