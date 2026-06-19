---
name: css-structure-yashiro
description: 야시로 사이트 CSS 구조 결정 — 패턴, 토큰, 규칙
metadata:
  type: project
---

## 구조 결정 (2026-06-20 확정)

각 페이지는 독립 `page.module.css`를 가진다. 공통 유틸리티 클래스는 만들지 않는다.
공유 레이어는 `globals.css` 토큰과 컴포넌트(`Nav`, `Footer`)뿐.

**Why:** 출품작들(랜딩/방명록/미니게임)은 레이아웃이 서로 달라 공통 유틸리티 클래스의 재사용 가치가 낮음.
두 번째 출품작이 같은 Shell 구조를 반복할 경우 Option B(유틸리티 클래스)를 재검토할 수 있음.

## CSS Modules 사용 기준
- hover, transition, animation, blend-mode 등 인터랙션/효과 → CSS Module
- layout, spacing, typography, color 등 정적 스타일 → inline style (JSX)

## globals.css 토큰

### 색상
```
--bg, --surface, --border, --text, --text-dim
--accent, --accent-d, --accent-bg
```

### 스페이싱 / 반경
```
--gutter: 48px    (페이지 좌우 표준 여백 — 푸터, 섹션 등)
--radius-sm: 3px  (표준 border-radius — 버튼, 배지, 카드)
```

### 히어로 좌측 패딩
heroLeft는 `60px 56px` — 콘텐츠 영역 특성상 --gutter보다 의도적으로 넓음

## 주의사항
- 7×7 액센트 도트: `borderRadius: 1` — 의도된 값. --radius-sm(3px)로 바꾸면 원형이 됨
- 히어로 캐릭터 패널 배경 `#EAE0D0` 고정 — multiply blend mode 유지 목적
- `:global([data-theme="dark"])` 패턴으로 다크 모드 blend-mode 전환

## dead code 제거 기록 (2026-06-20)
page.module.css에서 제거: `.heroBtnSecondary`, `.divider*`, `.clipCard`, `.socialLink`
globals.css에서 제거: `--border-s`, `@keyframes floatIn`

제거된 패턴은 design-yashiro.md에 보존되어 있음 (섹션 구분선, 카드 hover)

See also: [[design-yashiro]], [[project-yashiro-contest]]
