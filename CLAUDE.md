@AGENTS.md

---

## 워크플로우

부모 CLAUDE.md (`/Users/chanuuuu/Documents/project/CLAUDE.md`)의 워크플로우를 따른다.
브랜치 생성 → worktree 격리 → TDD → PR 머지.

### 이 프로젝트 전용 주의사항

- 새 출품작은 `src/app/[출품작명]/page.tsx` + `page.module.css`로 격리. 기존 랜딩(`/`)에 섹션 추가하지 말 것.
- `globals.css`에 추가 가능한 것: CSS 변수(토큰), keyframe 애니메이션. 유틸리티 클래스는 추가하지 않는다.
- `Nav`, `Footer`는 모든 출품작이 공유. 출품작별 레이아웃 차이가 필요하면 페이지 내에서 해결.
- 폰트는 `layout.tsx`의 Google Fonts `<link>`로 이미 로드됨. 새 폰트 추가 시 동일 위치에 추가.
- PR 생성 전 `gh auth switch --user chnu-kim` 필수.
