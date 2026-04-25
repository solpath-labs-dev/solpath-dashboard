# GAS (`solpath-dashboard-backend`)

로컬 소스는 이 디렉터리(`gas/`)이며, **레포 루트**에서 `clasp`를 실행한다. ([.clasp.json](../.clasp.json)의 `rootDir` 참고.)

## `rootDir`이 하는 일 / 안 하는 일 (오해 주의)

| 항목 | 설명 |
|------|------|
| **`"rootDir": "gas"`** | 로컬 **어느 폴더**의 `.js` / `.gs` / `appsscript.json`을 `clasp push`로 **이 Apps Script 프로젝트에 올릴지**만 정함. **Google Drive “폴더 A에 스프레드시트/파일을 둬라”는 뜻이 아님.** |
| **스크립트 프로젝트가 Drive에 어디 있을지** | **새로** `clasp create --parentId "폴더ID"` 할 때, 또는 **Drive 웹**에서 스크립트 파일을 끌어다 놓기. `push`는 스크립트 **컨테이너** 위치를 바꾸지 않음. |
| **런타임에 만드는 스프레드시트(원천 DB)** | `dbSetupMasterDatabase`가 **Drive API `Files.create` + `parents: [폴더ID]`** 로 지정. `rootDir`과 **무관**. |

정리: 네가 찾은 `--parentId`는 **“Apps Script **프로젝트**”를 그 Drive 폴더에 붙이는 것**이고, `rootDir`는 **“로컬 `gas` ↔ 스크립트 **소스** 동기**” 뿐이야. 둘은 역할이 다름.

## 요구 사항

- 전역 `clasp` 3.x (`clasp login` 완료, 토큰은 `~/.clasprc.json` — git에 넣지 말 것)
- **금지**: `npx @google/clasp@... push` — `access_token` 꼬임이 재현됨 ([process.md](../process.md) 원천·배포 규정)

## 자주 쓰는 명령 (레포 루트에서)

```bash
clasp status
clasp push
clasp pull
clasp open
```

배포(웹앱 URL 갱신)는 Apps Script 편집기에서 **배포 → 새 배포**로 관리한다.

## 파일

- `.gs` / `.js` — Apps Script 소스 (clasp가 `gas/` 아래 동기화)
- `appsscript.json` — 타임존, OAuth 스코프, 런타임 등 (편집 시 주의)
- `Code.js` — Web App `doGet` + `?code=` → `imwebExchangeByCodeAndStore_` → Properties `IMWEB_OAUTH_*` (`apiTest.js`)
- `HttpOpenSync.js` — Web App `doPost` / `doOptions`: 대시보드 `action=ping` · `syncOpenFull` (본문 `action`만) → `dbSyncOpenAll`. `fetch`+CORS → [docs/BACKEND_API.md](../docs/BACKEND_API.md) §2.2
- `apiTest.js` — `imwebApiTestAll` Run: OAuth(인가 URL 로그, code·refresh·code₂ POST) → `GET /site-info`·members·products·옵션 체인. 응답은 `Logger`에 `http`+본문 그대로. **파일 주석**에 필요한 Properties 키 있음
- `RunOpenSync.js` — [실행]용 진입점만 모음. 드롭다운이 **열려 있는 파일** 기준이면 이 파일을 연 뒤 `run_OpenSync_Members` / `run_OpenSync_Products` / `run_OpenSync_Orders` / `run_OpenSync_All` 실행.
- `DB/` — Open API → 시트 ([docs/BACKEND_API.md](../docs/BACKEND_API.md)). **본문:** `dbSyncMembersOpen`·`dbSyncProductsOnePage`·`dbSyncOrdersOpen`·`dbSyncOpenAll`은 각 `dbSyncMembers.js` / `dbSyncProducts.js` / `dbSyncOrders.js`. `dbSetupMasterDatabase` → `dbMasterSetup.js`. `SHEETS_MASTER_ID` 비우고 `dbSetupMasterDatabase` 다시 → 새 헤더. (원격에 `DB`가 없고 `RunOpenSync`에서 `ReferenceError`면 `clasp push`.)
