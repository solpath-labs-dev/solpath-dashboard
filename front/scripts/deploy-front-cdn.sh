#!/usr/bin/env bash
# 메타(통계자료마스터) 루트: bash front/scripts/deploy-front-cdn.sh
# 정본 순서(git-push-dual-remotes.mdc "프론트 직전 배포"와 동일, 한 줄도 뒤집지 말 것):
#   1) rsync (기본 on)  2) 형제 commit+push  3) SOLPATH_CDN_COMMIT에 풀 SHA **만** 씀
#   4) **그다음** apply-solpath-cdn-pin.sh  5) 메타 commit+push
# 병렬·동시 write 금지 — SOLPATH와 apply를 겹치면 IMWEB_*.html이 옛 SHA로 남을 수 있음.
#
# 환경변수:
#   SOLPATH_FRONT_ROOT  — 형제 -front (기본: $META/../solpath-dashboard-front)
#   SOLPATH_SYNC_FRONT  — 0이면 rsync 생략 (기본: 1 = rsync)
#   SOLPATH_PIN_SHA     — 풀 SHA(또는 -front에서 유일한 짧은 해시). 비우면 `git rev-parse HEAD`.
#                         (HEAD가 스니핏-only 후속이고 임웹엔 **코드 커밋**이면 여기 **그** 해시)
set -euo pipefail
META="$(cd "$(dirname "$0")/../.." && pwd)"
FRONT="${SOLPATH_FRONT_ROOT:-"$META/../solpath-dashboard-front"}"
SYNC="${SOLPATH_SYNC_FRONT:-1}"
LOG="${META}/_deploy_run.log"
exec >"$LOG" 2>&1
echo "=== $(date -Iseconds) ==="
echo "META=$META"
echo "FRONT=$FRONT  SYNC=$SYNC  PIN=${SOLPATH_PIN_SHA:-<HEAD>}"
if [[ ! -d "$FRONT/.git" ]]; then
  echo "실패: 형제 solpath-dashboard-front 없음: $FRONT" >&2
  exit 1
fi

if [[ "$SYNC" == "1" ]]; then
  echo "--- 1) rsync META/front/ → FRONT/ (.git 제외) ---"
  rsync -a --exclude '.git' "${META}/front/" "${FRONT}/"
fi

echo "--- 2) [형제] commit + push origin + push mirror ---"
cd "$FRONT"
git status -sb
git add -A
if git diff --cached --quiet; then
  echo "front repo: nothing to commit"
else
  git commit -m "chore(front): 배포 (메타 front 동기)"
fi
git push origin main
if git remote get-url mirror >/dev/null 2>&1; then
  git push mirror main
fi

if [[ -n "${SOLPATH_PIN_SHA:-}" ]]; then
  SHA=$(git rev-parse "$SOLPATH_PIN_SHA")
  echo "using SOLPATH_PIN_SHA → full SHA=$SHA"
else
  SHA=$(git rev-parse HEAD)
  echo "SHA(형제 -front HEAD)=$SHA"
fi

echo "--- 3) SOLPATH_CDN_COMMIT **만** 씀(apply **전**) ---"
cd "$META"
{
  echo "# jsDelivr 핀(풀 SHA 한 줄) — solpath-dashboard-front (deploy)"
  echo "$SHA"
} > "$META/front/SOLPATH_CDN_COMMIT"

echo "--- 4) apply-solpath-cdn-pin.sh (핀 확정 **후** 단일 단계) ---"
bash "$META/front/scripts/apply-solpath-cdn-pin.sh"

echo "--- 5) [메타] add pin + IMWEB, commit, push ---"
git add front/SOLPATH_CDN_COMMIT
for f in front/IMWEB_SNIPPET_INJECT.html front/IMWEB_SNIPPET.html; do
  [[ -f "$f" ]] && git add -- "$f" || true
done
if [[ -f .gitignore ]]; then
  git add .gitignore 2>/dev/null || true
fi
if git diff --cached --quiet; then
  echo "meta: no commit"
else
  git commit -m "chore(front): jsDelivr 핀 (SOLPATH_CDN_COMMIT)"
  git push origin main
  if git remote get-url mirror >/dev/null 2>&1; then
    git push mirror main
  fi
fi
echo "--- last (meta) ---"
git -C "$META" log -1 --oneline
echo "log: $LOG"
