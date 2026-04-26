# solpath-dashboard-front

내부용 정적 대시보드(바닐라 JS). 백엔드는 GAS Web App + 시트(메타·GAS: [`solpath-dashboard`](https://github.com/eunsang9597/solpath-dashboard)).

**원격:** [eunsang9597/solpath-dashboard-front](https://github.com/eunsang9597/solpath-dashboard-front) · [solpath-labs-dev/solpath-dashboard-front](https://github.com/solpath-labs-dev/solpath-dashboard-front)

**아임웹:** [IMWEB_SNIPPET_INJECT.html](./IMWEB_SNIPPET_INJECT.html) — `__SOLPATH__` + jsDelivr. iframe: [IMWEB_SNIPPET.html](./IMWEB_SNIPPET.html). CORS: [docs/IMWEB_CORS.md](./docs/IMWEB_CORS.md).

## 호스팅

- jsDelivr: `https://cdn.jsdelivr.net/gh/<owner>/solpath-dashboard-front@<commit>/…`
- `@main`은 **CDN 캐시**로 늦게 갱신되는 경우가 있어, 아임웹은 `IMWEB_*`에 **커밋 SHA**로 고정하는 편이 안전(푸시할 때 SHA만 바꾸기)

## 로컬

```bash
cd front && python3 -m http.server 8080
```

## 설정

- `config.js`는 `gasBaseUrl` 비움. 위젯에서 **module 전에** `window.__SOLPATH__ = { gasBaseUrl: "…/exec" }`
- 로컬 실값: `FALLBACK_GAS_BASE_URL` 또는 동일 `__SOLPATH__` (커밋 금지)
- 동기화 버튼: 화면에 **`데이터 동기화`** 입력 후에만 활성

## 푸시 (한 번에: rsync → 형제 push → `SOLPATH_CDN` → `apply` → 메타 push)

**로컬 구조:** `.../솔루션편입/통계자료마스터`와 **형제** `.../솔루션편입/solpath-dashboard-front` = **다른 git**. **정본 순서**·병렬 금지: [../.cursor/rules/git-push-dual-remotes.mdc](../.cursor/rules/git-push-dual-remotes.mdc) §「프론트 직전 배포」.

- 기본: **rsync on** (메타 `front/` → 형제, `.git` 제외). 끄려면 `SOLPATH_SYNC_FRONT=0`.
- 핀: 보통 -front `HEAD` 풀 SHA. `HEAD`가 **스니펫만** 정리한 커밋이고, 임웹·jsDelivr엔 **이전 “코드” 커밋**이면:  
  `SOLPATH_PIN_SHA=0e5150e…` (짧은/풀) 로 그 커밋만 지정.

```bash
cd /path/to/통계자료마스터
chmod +x front/scripts/deploy-front-cdn.sh
bash front/scripts/deploy-front-cdn.sh
# 예: 끄기/핀: SOLPATH_SYNC_FRONT=0 SOLPATH_PIN_SHA=0e5150e bash front/scripts/deploy-front-cdn.sh
# 로그: _deploy_run.log   형제 경로: SOLPATH_FRONT_ROOT=...
```

**절대** `SOLPATH_CDN_COMMIT` 쓰기와 `apply-solpath-cdn-pin.sh`·다른 `IMWEB_*` 편집을 **같이 겹치지 말 것**(옛 SHA 잔상).

**형제**에서 수동:

```bash
cd ../solpath-dashboard-front
git push origin main && git push mirror main
```
