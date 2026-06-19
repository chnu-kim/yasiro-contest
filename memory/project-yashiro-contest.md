---
name: project-yashiro-contest
description: 야시로 스트리머 사이트 대회 — 목적, 기술 스택, 현재 상태
metadata:
  type: project
---

야시로 스트리머 사이트 제작 대회 출전 프로젝트.

**Why:** 출품작을 여러 개 제출 예정 — 디자인을 공통으로 유지하면서 다양한 사이트 구성을 시도.

**How to apply:** 새 페이지/출품작 추가 시 디자인 토큰(`globals.css`)과 `Nav`, `Footer`는 공유. 새 `src/app/[name]/page.tsx`로 격리.

## 기술 스택
- Next.js 16 (App Router) + TypeScript + pnpm
- CSS Modules (hover/인터랙션) + inline styles (레이아웃)
- Google Fonts via `<link>` (next/font 아님 — 한국어 폰트 호환성)

## 프로젝트 루트
`/Users/chanuuuu/Documents/project/yasiro-contest`

## 현재 구현된 것
- 랜딩 페이지 (`/`) — 히어로 섹션 + 푸터만
- 라이트/다크 테마 전환 (localStorage `yashiro-theme`, flash-free inline script)
- CSS 정리 완료 (2026-06-20): dead code 제거, 스페이싱 토큰 추가

## CSS 구조 결정 (2026-06-20 확정)
- **Option A 채택**: 각 페이지 독립 `page.module.css` 유지
- **Option B 보류**: 공통 유틸리티 클래스는 추가하지 않음 — 출품작들이 레이아웃이 서로 다르기 때문
- 공유 레이어: `globals.css` 토큰 + `Nav`/`Footer` 컴포넌트만

## 미결정 사항 (2026-06-20 기준)
- 클립 섹션 — 유무 미결정
- 방송 일정 섹션 — 유무 미결정
- 팬아트 섹션 — 없음으로 확정

## 다음 출품작 후보 (2026-06-20)
- 방명록 페이지 — 방문자가 야시로에게 한마디 남기는 폼 + 카드 리스트
- 미니게임 페이지 — 게임 UI/캔버스 기반
- 두 페이지 모두 Nav/Footer 공유

See also: [[design-yashiro]], [[css-structure-yashiro]]
