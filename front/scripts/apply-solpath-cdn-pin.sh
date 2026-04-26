#!/usr/bin/env bash
# jsDelivr 핀: `SOLPATH_CDN_COMMIT` 풀 SHA → IMWEB_* 의 URL·주석·cdnCommit 일괄 치환
# 모노레포: .../solpath-dashboard@<sha>/front/…  ·  구 -front 전용 URL도 호환 치환
# 반드시 `front/SOLPATH_CDN_COMMIT`을 **최종**으로 쓴 **다음**에만 실행(병렬 X).
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
    s/(eunsang9597\/solpath-dashboard@)[0-9a-fA-F]+/${1}$ENV{NEW}/g;
    s/(solpath-labs-dev\/solpath-dashboard@)[0-9a-fA-F]+/${1}$ENV{NEW}/g;
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
echo "끝. GitHub solpath-dashboard(또는 -front) 해당 커밋과 동일해야 임웹·미리보기가 일치한다."
