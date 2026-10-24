# yasiro-contest

치지직 스트리머 야시로 팬사이트 대회 출품 프로젝트. 출품작 여러 개가 디자인 토큰과 Nav를 공유하고, 각 출품작은 독립 페이지로 격리한다.

- 프로덕션: https://yasiro.stream · 레포: `chnu-kim/yasiro-contest`
- 스택: Next.js 16.2.9 (App Router) · React 19 · TypeScript · pnpm · vitest
- 배포: Cloudflare Workers (`@opennextjs/cloudflare`) + D1

## Next.js 16 주의

훈련 데이터와 다른 breaking change가 있다. Next.js API를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 문서를 먼저 읽는다.

## 명령

```bash
pnpm dev            # UI 개발. D1 바인딩 없음 → 세션 null, API 실패 (D1이 필요하면 pnpm preview)
pnpm test           # vitest run
pnpm lint
pnpm preview        # Workers 런타임으로 로컬 미리보기
pnpm run deploy     # 수동 배포. `pnpm deploy`는 pnpm 예약어라 동작 안 함
```

main에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 `pnpm test` → `pnpm run deploy`를 실행한다. 테스트가 깨지면 배포되지 않는다.

## 구조

```
src/app/
  layout.tsx            세션 조회(D1) + Nav + 테마 초기화 스크립트. force-dynamic
  page.tsx              랜딩(/) 출품작
  to-yasiro/            방명록 출품작 (GuestbookBoard, PostIt)
  whack/                꿀붕이 잡기 미니게임 + D1 리더보드
  auth/{login,callback,logout}/route.ts   치지직 OAuth
  api/{guestbook,whack}/route.ts
src/components/         Nav, PostIt, SkipLink (공유)
src/lib/                순수 로직 + *.test.ts (chzzk-auth, guestbook, whack)
migrations/             D1 마이그레이션 (wrangler 관리)
_design/                원본 디자인 핸드오프 (gitignored)
```

## 출품작 규칙

- 새 출품작은 `src/app/<name>/page.tsx` + `page.module.css`로 만든다. 랜딩(`/`)에 섹션을 추가하지 않는다.
- 공유 레이어는 `globals.css`의 토큰·keyframe과 `src/components/`뿐. `globals.css`에 유틸리티 클래스를 넣지 않는다.
- 새 출품작을 추가하면 `Nav.tsx`의 데스크톱 링크와 모바일 메뉴 두 곳에 링크를 넣는다.
- 검증·계산 로직은 `src/lib/`에 순수 함수로 빼고 테스트를 붙인다. 컴포넌트와 Route Handler는 얇게 유지한다.

## 스타일

- hover·transition·animation·blend-mode 같은 효과는 CSS Module에, layout·spacing·color 같은 정적 스타일은 inline style로 쓴다.
- 토큰: `--bg --surface --border --text --text-dim --accent --accent-d --accent-bg --gutter(48px, ≤640px에서 20px) --radius-sm(3px)`. 다크 값은 `[data-theme="dark"]`에서 덮어쓴다.
- keyframe: `blink`(LIVE 도트), `float`(꿀붕이 부유), `fadeUp`(히어로 진입).
- 폰트는 `layout.tsx`의 Google Fonts `<link>` 한 줄로 로드한다. 현재 로드되는 폰트는 Comfortaa, Fredoka(500–700), Gaegu, Jua, Noto Sans KR, Noto Serif KR(700). 한국어 subset 문제 때문에 `next/font`는 쓰지 않는다. 새 폰트는 같은 URL에 추가하고, URL에 없는 폰트를 코드에 쓰지 않는다(조용히 폴백된다).
  - Fredoka: 영문 레이블과 숫자(배지, 키 표기, 게임 점수·타이머·순위)
  - Gaegu: 손글씨 제목·포스트잇 / Noto Sans KR: 본문·UI / Noto Serif KR: 헤드라인
- 이미지 블렌드: 밝은 배경 위에는 `multiply`, 어두운 배경 위에는 `screen`. 캐릭터 패널 배경 `#EAE0D0`은 다크 모드에서도 고정한다. 배경을 어둡게 하면 multiply가 캐릭터를 뭉갠다.
- 강조 배지·구분선의 작은 사각 도트는 `borderRadius: 1`이 의도된 값이다.

## 테마

`localStorage['yashiro-theme']` → `<html data-theme>`. `layout.tsx`의 inline script가 hydration 전에 설정한다. 테마별 아이콘은 두 개를 모두 렌더링하고 `:global([data-theme="dark"])` CSS로 전환한다. React state로 바꾸면 hydration 불일치가 난다.

## 모바일 드롭다운

외부 클릭 닫기는 `document.addEventListener('click')`로 구현하지 않는다. 모바일 tap에서 React onClick보다 먼저 실행돼 열리자마자 닫히는 버그가 있었다(#26). 메뉴가 열렸을 때만 투명 backdrop(`position: fixed; inset: 0`, 메뉴보다 z-index 한 단계 아래)을 렌더링하고 `onClick`으로 닫는다.

## Cloudflare / D1

- Worker `yasiro-contest` · Account `fc7323801136ae087db0b88ab4d07b53` · 도메인 `yasiro.stream`, `www.yasiro.stream`
- D1 `yasiro-db` (`69020930-766c-423b-8cbd-85d62eee3e02`) → `env.DB`. 타입은 `src/types/cloudflare.d.ts`
- 접근: `const { env } = await getCloudflareContext({ async: true })` (`@opennextjs/cloudflare`)
- 테이블: `sessions`, `guestbook`, `whack_scores`. 스키마 변경은 `d1-migration` 스킬로 한다.
- Worker secret: `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`, `CHZZK_REDIRECT_URI` (`printf 'v' | pnpm wrangler secret put KEY`). Route Handler에서 `process.env`로 읽는다.
- GitHub secret: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. 자격증명 원본은 1Password "Cloudflare R2 - yasiro-contest".
- wrangler 4.x는 Node 22 이상이 필요하다.

### Route Handler

- `NextResponse`와 `export const runtime = "edge"`를 쓰지 않는다. opennextjs 번들링에서 `Cannot read properties of undefined (reading 'default')` 에러가 난다. 네이티브 `Request`/`Response`를 쓴다.
- 인증이 필요한 API는 `session_id` 쿠키로 `sessions`를 조회해 `expires_at > unixepoch()`를 확인한다. `api/whack/route.ts`가 기준 패턴이다.
- `cookies()`를 쓰기 때문에 `layout.tsx`의 `export const dynamic = 'force-dynamic'`을 지우지 않는다.

## 치지직

- 야시로 채널 ID `d6e680f5b17eba0b078f978dd722c0f3`. 라이브 주소는 `https://chzzk.naver.com/live/<id>`
- 치지직 Open API 레퍼런스는 `chzzk` MCP 서버(user 범위, `~/bin/chzzk-mcp-server`)로 조회한다.

## 하네스 (`.claude/`)

- 스킬: `new-entry`(새 출품작), `verify`(PR 전 검증), `d1-migration`(스키마 변경)
- hook: 기존 `migrations/*.sql` 수정 차단, Route Handler의 `NextResponse`·`runtime` 선언 감지
- 권한: 테스트·lint·로컬 D1은 허용. 배포, 원격 D1, secret, `git push`는 매번 확인

## 워크플로우

- 기능 추가·로직 변경: 브랜치 → worktree → TDD → PR → 머지.
- 문구·URL처럼 한 파일 안에서 끝나는 단순 수정: main에 바로 커밋·푸시.
- PR 생성과 push 전에 `gh auth switch --user chnu-kim`을 실행한다.
