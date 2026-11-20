---
name: new-entry
description: yasiro-stream(야시로 비공식 팬사이트)에 새 페이지(/<name>)를 추가할 때 쓴다. 격리된 page.tsx·page.module.css 생성, Nav 링크 연결, lib 로직과 테스트, 필요하면 API·D1까지 순서대로 진행한다.
---

# 새 페이지 추가

기능 추가이므로 브랜치 → worktree → TDD → PR 순서로 진행한다 (CLAUDE.md 워크플로우).

## 1. 범위 정하기

시작 전에 사용자와 다음을 확정한다:
- 경로 이름(`/<name>`, kebab-case)과 Nav에 보일 이름. 모바일(≤480px)에서 축약할 이름이 필요한지
- 로그인이 필요한지, D1에 저장할 데이터가 있는지
- 기존 페이지 중 가장 가까운 것: 정적 페이지면 `/about`, D1 목록 + 관리자 쓰기면 `/games`

## 2. 파일 구성

```
src/app/<name>/page.tsx          Server Component. metadata(title: '<이름> - 야시로')만 두고 클라이언트 컴포넌트를 렌더
src/app/<name>/<Name>.tsx        'use client' — 상태·이벤트가 있을 때만
src/app/<name>/page.module.css   hover·animation·blend 같은 효과만
src/lib/<name>.ts + .test.ts     검증·점수·상태 전이 같은 순수 로직
src/app/api/<name>/route.ts      D1이 필요할 때만
```

- 정적 페이지는 `about/page.tsx`, D1을 읽는 페이지는 `games/page.tsx`(서버에서 읽기) + `GamesBoard.tsx`(클라이언트)가 기본 형태다. 새로 만들기 전에 가까운 쪽과 `src/lib/games/api.ts`를 읽는다.
- 정적 스타일은 inline, 효과는 CSS Module. 색·간격은 `var(--*)` 토큰만 쓰고 hex를 새로 만들지 않는다. 예외는 캐릭터 패널 `#EAE0D0`뿐이다.
- 다크 모드는 토큰이 처리한다. 페이지에서 `[data-theme]`을 직접 분기해야 하면 CSS Module에서 `:global([data-theme="dark"])`를 쓴다.
- 이미지를 배경 위에 얹을 때는 CLAUDE.md의 블렌드 규칙을 따른다.

## 3. TDD

`src/lib/<name>.ts`의 동작부터 `src/lib/<name>.test.ts`에 테스트로 쓰고 `pnpm test`로 실패를 확인한 뒤 구현한다. 사용자 입력을 받는 API라면 입력 검증 함수(`validateCandidate` 같은)를 lib에 두고 경계값을 테스트한다.

## 4. API와 D1 (필요할 때)

- 테이블이 필요하면 `d1-migration` 스킬로 마이그레이션부터 만든다.
- Route Handler는 `src/app/api/games/route.ts` + `src/lib/games/api.ts`를 따라 쓴다: 네이티브 `Response.json`, 쓰기는 `checkSameOrigin` → 403, `readSessionId`(`__Host-session` 쿠키) → `findSession`(`auth_sessions` 해시 조회, `src/lib/session.ts`) → 401, body 파싱 실패 → 400, lib 검증 실패 → 400. 핸들러 로직은 lib에 두고 db·now를 주입한다.

## 5. Nav 연결

`src/components/Nav.tsx`의 `LINKS`(데스크톱·모바일 공용)에 한 줄 더하고, 홈 `src/app/page.tsx`의 푸터 `PAGES`와 '더 둘러보기' 카드에도 넣는다. 검색엔진용으로 `src/lib/seo.ts`의 `SITE_PAGES`에 경로를 넣고, 페이지 metadata는 `pageMetadata({ path, title, description })`로 쓴다. 링크가 늘면 ≤480px에서 줄바꿈되지 않는지 `verify` 스킬로 확인한다.

## 6. 마무리

- `verify` 스킬로 라이트/다크, 데스크톱/모바일을 확인한다.
- CLAUDE.md의 `구조` 섹션에 새 경로를 한 줄 추가한다. 테이블을 만들었다면 테이블 목록도 갱신한다.
