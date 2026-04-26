#!/usr/bin/env bash
# solpath-dashboard-front → jsDelivr URL에 쓰는 커밋을 **한 파일**에서 읽어
# 반드시 `front/SOLPATH_CDN_COMMIT`을 **최종**으로 쓴 **다음**에만 실행(병렬 X). 상위: git-push-dual-remotes.mdc.
# front/IMWEB_SNIPPET_INJECT.html, IMWEB_SNIPPET.html 안의
#   .../solpath-dashboard-front@<이전 sha>/...
# 를 전부 **같은** SHA로 맞춘다. (3daeb43 / 17f4945 / @main 섞이는 실수 방지)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIN="${ROOT}/SOLPATH_CDN_COMMIT"
if [[ ! -f "$PIN" ]]; then
  echo "없음: $PIN" >&2
  exit 1
fi
NEW=$(
  grep -E '^[0-9a-f]{7,40}$' "$PIN" | head -1 | tr '[:upper:]' '[:lower:]'
)
if [[ -z "$NEW" ]]; then
  echo "SOLPATH_CDN_COMMIT에서 7~40자 16진 커밋 1줄을 찾지 못함 (주석 # 줄은 무시됨)" >&2
  exit 1
fi
export NEW
# URL·`cdnCommit`·HTML 주석 SOLPATH_PIN — 모두 **같은** 풀 SHA (병렬 편집 금지)
for f in "${ROOT}/IMWEB_SNIPPET_INJECT.html" "${ROOT}/IMWEB_SNIPPET.html"; do
  if [[ ! -f "$f" ]]; then
    echo "없음: $f" >&2
    exit 1
  fi
  perl -i -pe '
    s/(eunsang9597\/solpath-dashboard-front@)[0-9a-fA-F]+/${1}$ENV{NEW}/g;
    s/(solpath-labs-dev\/solpath-dashboard-front@)[0-9a-fA-F]+/${1}$ENV{NEW}/g;
    s/(cdnCommit:\s*")([0-9a-fA-F]+)"/$1$ENV{NEW}"/g;
    s/(<!--\s*SOLPATH_PIN:\s*)[0-9a-fA-F]+/${1}$ENV{NEW}/g;
    s/(<!--\s*SOLPATH_PIN\(iframe\):\s*)[0-9a-fA-F]+/${1}$ENV{NEW}/g;
  ' "$f" || {
    echo "perl 치환 실패: $f" >&2
    exit 1
  }
  echo "OK $f  →  @$NEW"
done
echo "끝. solpath-dashboard-front 는 이 SHA와 동일한 내용이어야 임웹·미리보기가 일치한다."
