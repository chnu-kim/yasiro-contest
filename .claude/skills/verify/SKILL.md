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

데이터가 필요하면 `pnpm wrangler d1 execute yasiro-db --local --command "INSERT ..."`로 넣는다. 치지직 OAuth 자체는 `.dev.vars`에 CHZZK_* 값이 없어서 로컬에서는 확인할 수 없다(값이 없으면 `/auth/login`은 500).

### 로그인 세션

`auth_sessions`에는 세션 ID의 SHA-256만 들어간다. 세션 ID를 만들고 해시 행을 넣는다(채널 ID는 야시로 `d6e680f5b17eba0b078f978dd722c0f3` 또는 `--var ADMIN_CHANNEL_IDS:<가짜 ID>`로 주입한 가짜 ID. 실제 다른 관리자 ID는 쓰지 않는다):

```bash
ID=$(openssl rand -hex 32)
HASH=$(printf %s "$ID" | shasum -a 256 | cut -d' ' -f1)
pnpm wrangler d1 execute yasiro-db --local --command "INSERT INTO auth_sessions (id_hash, channel_id, channel_name, expires_at) VALUES ('$HASH', '<채널 ID>', '로컬확인', unixepoch() + 604800)"
echo "$ID"   # 쿠키 값
```

- curl: `curl -H "cookie: __Host-session=$ID" http://localhost:<port>/to-yasiro`
- Chrome: 그 localhost 페이지의 DevTools 콘솔에서 `document.cookie = "__Host-session=<ID>; Path=/; Secure"` 후 새로고침(JS로 만든 쿠키라 HttpOnly는 아니지만 로컬 확인에는 충분하다). localhost는 secure context라 `Secure`·`__Host-` 쿠키가 동작한다. Safari는 localhost의 Secure 쿠키를 다르게 다룰 수 있으니 Chrome으로 본다.
- 쓰기 요청(POST 등)은 `Origin` 헤더가 같은 출처여야 한다(`checkSameOrigin`). curl이면 `-H "origin: http://localhost:<port>"`.
- 레거시 `sessions` 테이블과 `session_id` 쿠키는 더 이상 읽지 않는다.

서버는 `run_in_background`로 띄우고, 확인이 끝나면 종료한다.

## 3. 브라우저 확인

서버를 띄운 채 `pnpm shots http://localhost:<port> [바뀐 경로...]`를 실행한다. 경로를 빼면 `/`, `/about`, `/to-yasiro` 전부를 라이트/다크 × 1280/390 전체 페이지로 찍는다(설치된 Chrome 사용, dev 오버레이·애니메이션 제거). 결과 PNG를 Read로 원본 크기 그대로 보고, 사용자에게는 `screenshots/index.html` 절대 경로를 준다(`open`으로 열어도 된다).

상호작용은 스크린샷으로 안 잡히니 Claude in Chrome으로 따로 본다. Nav를 건드렸다면 ≤480px 햄버거 메뉴를 열고, 바깥을 눌렀을 때 닫히는지 확인한다.

함께 볼 것: 콘솔 에러와 hydration 경고, 다크 모드 캐릭터 패널, ≤480px LIVE FAB이 마지막 요소를 가리지 않는지, 폰트가 폴백되지 않았는지(computed `font-family`).

## 4. 보고

통과한 항목과 확인하지 못한 항목(예: OAuth, 원격 D1)을 나눠서 보고한다. 원격 D1과 배포는 확인 대상이 아니다. 그건 사용자 승인 후 진행한다.
