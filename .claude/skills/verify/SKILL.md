---
name: verify
description: yasiro-contest 변경을 PR·push 전에 검증한다. 테스트·타입 체크·lint를 돌리고, Workers 런타임(로컬 D1 포함)으로 띄워 브라우저에서 라이트/다크·데스크톱/모바일 화면을 확인한다. "확인해 봐", "돌려 봐", PR 직전에 쓴다.
---

# 변경 검증

## 1. 정적 검사

```bash
pnpm test                 # CI 배포 게이트. 실패하면 배포되지 않는다
pnpm exec tsc --noEmit
pnpm lint
```

- `tsc`가 `.next/types/validator.ts`에서 지워진 페이지를 못 찾는다고 하면 낡은 캐시다. `rm -rf .next` 후 다시 돌린다.
- lint에는 2026-10 기준으로 기존 코드의 error가 남아 있다(`set-state-in-effect`, `no-html-link-for-pages` 등). 변경 전후 결과를 비교해 **새로 생긴** 문제만 고친다.

## 2. 실행 환경 고르기

| 바꾼 것 | 띄우는 방법 |
|---|---|
| UI·스타일만 | `pnpm dev` (localhost:3000). D1을 못 써서 로그인 상태는 항상 null, API 호출은 실패한다 |
| API·D1·레이아웃 세션 | `pnpm preview`. Workers 런타임 + 로컬 D1 (`.wrangler/state`) |

`pnpm preview`를 처음 쓰거나 마이그레이션을 추가했다면 먼저 로컬 D1에 적용한다:

```bash
pnpm wrangler d1 migrations apply yasiro-db --local
```

데이터가 필요하면 `pnpm wrangler d1 execute yasiro-db --local --command "INSERT ..."`로 넣는다. 로그인이 필요한 API는 `sessions`에 행을 넣고 브라우저 쿠키 `session_id`를 그 id로 맞춰 확인한다. 치지직 OAuth 자체는 `.dev.vars`에 CHZZK_* 값이 없어서 로컬에서는 확인할 수 없다.

서버는 `run_in_background`로 띄우고, 확인이 끝나면 종료한다.

## 3. 브라우저 확인

Claude in Chrome으로 바뀐 페이지를 열고 다음 네 조합을 스크린샷으로 확인한다:

- 라이트 / 다크: `localStorage.setItem('yashiro-theme','dark')` 후 새로고침
- 데스크톱(1280) / 모바일(390). Nav를 건드렸다면 ≤480px 햄버거 메뉴를 열고, 바깥을 눌렀을 때 닫히는지도 본다

함께 볼 것: 콘솔 에러와 hydration 경고, 캐릭터 이미지 블렌드가 다크 모드에서 뭉개지지 않는지, 폰트가 폴백되지 않았는지(computed `font-family`).

## 4. 보고

통과한 항목과 확인하지 못한 항목(예: OAuth, 원격 D1)을 나눠서 보고한다. 원격 D1과 배포는 확인 대상이 아니다. 그건 사용자 승인 후 진행한다.
