#!/bin/bash
# PreToolUse(Edit|Write): 이미 존재하는 D1 마이그레이션 파일의 수정·덮어쓰기를 막는다.
# wrangler는 파일명으로 적용 여부를 추적하므로, 적용된 파일을 고쳐도 원격 DB에는 반영되지 않는다.
file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  */migrations/*.sql)
    if [ -e "$file" ]; then
      echo "기존 마이그레이션($file)은 수정할 수 없습니다. 다음 번호의 새 파일로 변경을 추가하세요 (d1-migration 스킬 참고)." >&2
      exit 2
    fi
    ;;
esac
exit 0
