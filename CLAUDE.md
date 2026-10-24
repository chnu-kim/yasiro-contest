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
pnpm shots [url] [경로...]  # 페이지 × 라이트/다크 × 1280/390 전체 스크린샷 → screenshots/index.html
pnpm run deploy     # 수동 배포. `pnpm deploy`는 pnpm 예약어라 동작 안 함
```

main에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가 `pnpm test` → `pnpm run deploy`를 실행한다. 테스트가 깨지면 배포되지 않는다.

## 구조

```
src/app/
  layout.tsx            세션 조회(D1) + Nav + 테마 초기화 스크립트. force-dynamic
  page.tsx              허브(/) — 히어로, 출품작 바로가기 카드, 최근 한마디
  about/                소개 — 프로필, 주요 콘텐츠, 채널 링크
  to-yasiro/            방명록 출품작 (GuestbookBoard, PostIt)
  auth/{login,callback,logout}/route.ts   치지직 OAuth
  api/guestbook/route.ts
src/components/         Nav, PostIt, SkipLink (공유)
src/lib/                순수 로직 + *.test.ts (chzzk-auth, guestbook)
migrations/             D1 마이그레이션 (wrangler 관리)
_design/                원본 디자인 핸드오프 (gitignored)
```

## 출품작 규칙

- 새 출품작은 `src/app/<name>/page.tsx` + `page.module.css`로 만든다. 허브(`/`)에는 바로가기 카드(`ENTRIES`) 한 장만 더하고, 내용 섹션은 넣지 않는다.
- 공유 레이어는 `globals.css`의 토큰·keyframe과 `src/components/`뿐. `globals.css`에 유틸리티 클래스를 넣지 않는다.
- 새 출품작을 추가하면 `Nav.tsx`의 데스크톱 링크와 모바일 메뉴, 허브의 `ENTRIES` 세 곳에 넣는다.
- 디자인 변경은 `pnpm shots`로 찍은 스크린샷을 직접 보고 확인한 뒤 사용자에게 보여 준다. 축소된 브라우저 화면만 보고 판단하지 않는다.
- 검증·계산 로직은 `src/lib/`에 순수 함수로 빼고 테스트를 붙인다. 컴포넌트와 Route Handler는 얇게 유지한다.

## 스타일

- hover·transition·animation·blend-mode 같은 효과는 CSS Module에, layout·spacing·color 같은 정적 스타일은 inline style로 쓴다.
- 토큰은 `globals.css`가 정본이다(색·type `--fs-*`·간격 `--space-*`·shadow·z-index·motion). 다크 값은 `[data-theme="dark"]`에서 덮어쓴다. `prefers-reduced-motion`은 globals에서 일괄 처리한다.
- keyframe: `blink`, `float`(꿀붕이 부유), `fadeUp`(진입), `pinDrop`.
- 폰트는 `layout.tsx`의 Google Fonts `<link>` 한 줄로 로드한다. 현재 로드되는 폰트는 Gaegu, Fredoka(500–700), Noto Sans KR, Noto Serif KR(600·700). 한국어 subset 문제 때문에 `next/font`는 쓰지 않는다. 새 폰트는 같은 URL에 추가하고, URL에 없는 폰트를 코드에 쓰지 않는다(조용히 폴백된다).
  - Noto Serif KR: 헤드라인·로고 / Noto Sans KR: 본문·UI / Fredoka: 영문 라벨과 숫자(한글 글리프 없음)
  - Gaegu: 포스트잇 본문과 /about 장비 콜아웃만. `letter-spacing: 0`, 18px 이상
- 컨셉은 "호기심 많은 탐험가". 탐험가 느낌은 캐릭터 장비(고글·쌍안경·두루마리·파우치·부츠)와 현장 기록(기록 카드, 콜아웃, 눈금자, 스탬프, 테이프)으로 낸다. 지도 모티프는 허브의 "다음 목적지" 경로 한 곳만 쓴다. 장식은 화면당 스탬프 1개, 테이프 4개 이하.
- 색: 작은 앰버 텍스트는 `--accent-text`, 주 버튼·FAB는 `--btn-primary-*`, `--accent`·`--brass`·`--eye`는 텍스트에 쓰지 않는다(AA 미달).
- 공유 컴포넌트(`src/components/`): Button, SectionLabel, StitchRule, TapeStrip, RoundStamp, HeightRuler, ChannelGlyph, PawMark, icons. 장식 SVG는 `aria-hidden`.
- 고정 버튼은 페이지당 1개. LIVE는 Nav 안의 pill이고 모바일 FAB가 없다.
- 캐릭터·꿀붕이 PNG는 투명 배경이라 블렌드 없이 올린다. 캐릭터 패널은 `--tile`(라이트 `#EAE0D0`, 다크 `--surface`).
- 강조 배지·구분선의 작은 사각 도트는 `borderRadius: 1`이 의도된 값이다.

## 테마

`localStorage['yashiro-theme']` → `<html data-theme>`. `layout.tsx`의 inline script가 hydration 전에 설정한다. 테마별 아이콘은 두 개를 모두 렌더링하고 `:global([data-theme="dark"])` CSS로 전환한다. React state로 바꾸면 hydration 불일치가 난다.

## 모바일 드롭다운

외부 클릭 닫기는 `document.addEventListener('click')`로 구현하지 않는다. 모바일 tap에서 React onClick보다 먼저 실행돼 열리자마자 닫히는 버그가 있었다(#26). 메뉴가 열렸을 때만 투명 backdrop(`position: fixed; inset: 0`, 메뉴보다 z-index 한 단계 아래)을 렌더링하고 `onClick`으로 닫는다.

## Cloudflare / D1

- Worker `yasiro-contest` · Account `fc7323801136ae087db0b88ab4d07b53` · 도메인 `yasiro.stream`, `www.yasiro.stream`
- D1 `yasiro-db` (`69020930-766c-423b-8cbd-85d62eee3e02`) → `env.DB`. 타입은 `src/types/cloudflare.d.ts`
- 접근: `const { env } = await getCloudflareContext({ async: true })` (`@opennextjs/cloudflare`)
- 테이블: `sessions`, `guestbook`. 스키마 변경은 `d1-migration` 스킬로 한다.
- Worker secret: `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`, `CHZZK_REDIRECT_URI` (`printf 'v' | pnpm wrangler secret put KEY`). Route Handler에서 `process.env`로 읽는다.
- GitHub secret: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. 자격증명 원본은 1Password "Cloudflare R2 - yasiro-contest".
- wrangler 4.x는 Node 22 이상이 필요하다.

### Route Handler

- `NextResponse`와 `export const runtime = "edge"`를 쓰지 않는다. opennextjs 번들링에서 `Cannot read properties of undefined (reading 'default')` 에러가 난다. 네이티브 `Request`/`Response`를 쓴다.
- 인증이 필요한 API는 `session_id` 쿠키로 `sessions`를 조회해 `expires_at > unixepoch()`를 확인한다. `api/guestbook/route.ts`가 기준 패턴이다.
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
