#!/bin/bash
# PostToolUse(Edit|Write): Route Handler에서 opennextjs/cloudflare 번들링을 깨뜨리는 패턴을 잡는다.
file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  */src/app/*route.ts|*/src/app/*route.tsx) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0
hits=$(grep -nE "NextResponse|export const runtime" "$file")
if [ -n "$hits" ]; then
  echo "$file: NextResponse와 runtime 선언은 opennextjs/cloudflare 번들링을 깨뜨립니다. 네이티브 Response를 쓰고 runtime 선언을 지우세요." >&2
  echo "$hits" >&2
  exit 2
fi
exit 0
