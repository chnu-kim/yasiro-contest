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
pnpm test:coverage  # src/lib/games/**, chzzk-category.ts는 100% threshold. 미달하면 exit 1
pnpm games:add "검색어"  # 게임 추가 CLI (아래 '게임 목록' 참고)
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
  games/                플레이한 게임 출품작 (page=서버·검증, GamesBoard·GameCard·GameDetailDialog·Pagination·Poster)
  auth/{login,callback,logout}/route.ts   치지직 OAuth
  api/guestbook/route.ts
src/components/         Nav, PostIt, SkipLink, ClearStamp (공유)
src/data/games.json     게임 목록 정본 (사람이 큐레이션, CLI로 추가)
scripts/games-add.ts    pnpm games:add 진입점 (얇게. 로직은 src/lib/games, chzzk-category)
src/lib/                순수 로직 + *.test.ts (chzzk-auth, guestbook, chzzk-category, games/{schema,query,labels,cli-args})
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
- 컨셉은 "호기심 많은 탐험가". 탐험가 느낌은 캐릭터 장비(고글·쌍안경·지도 두루마리·파우치·부츠)와 현장 기록(기록 카드, 콜아웃, 눈금자, 스탬프, 테이프)으로 낸다. 지도 모티프는 허브의 "다음 목적지" 경로 한 곳만 쓴다. 장식은 화면당 스탬프 1개, 테이프 4개 이하.
- 색: 작은 앰버 텍스트는 `--accent-text`, 주 버튼·FAB는 `--btn-primary-*`, `--accent`·`--brass`·`--eye`는 텍스트에 쓰지 않는다(AA 미달).
- 공유 컴포넌트(`src/components/`): Button, SectionLabel, StitchRule, TapeStrip, RoundStamp, HeightRuler, ChannelGlyph, PawMark, icons. 장식 SVG는 `aria-hidden`.
- 고정 버튼은 페이지당 1개. LIVE는 Nav 안의 pill이고 모바일 FAB가 없다.
- 캐릭터·꿀붕이 PNG는 투명 배경이라 블렌드 없이 올린다. 캐릭터 패널은 `--tile`(라이트 `#EAE0D0`, 다크 `--surface`).
- 강조 배지·구분선의 작은 사각 도트는 `borderRadius: 1`이 의도된 값이다.
- 원형 도장은 사이트 전체 1개(`RoundStamp`, /about)가 원칙이다. 예외: 게임 정복 도장(`ClearStamp`, /games 카드·상세의 `clear` 게임). 정복한 게임마다 찍히는 데이터 표시라 개수 제한을 두지 않는다.

## 테마

`localStorage['yasiro-theme']` → `<html data-theme>`. `layout.tsx`의 inline script가 hydration 전에 설정한다. 테마별 아이콘은 두 개를 모두 렌더링하고 `:global([data-theme="dark"])` CSS로 전환한다. React state로 바꾸면 hydration 불일치가 난다.

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

## 게임 목록 (/games)

- `src/data/games.json`이 정본이다. D1·런타임 외부 호출 없음. `page.tsx`가 `parseGames`로 검증하므로 형식이 깨지면 빌드가 실패한다. 파일을 손으로 고쳐도 되지만 가능하면 CLI를 쓴다(정렬·검증이 같이 된다).
- 추가: `pnpm games:add "검색어"`로 치지직 카테고리 후보(번호와 categoryId)를 보고, `--category-id <ID>`로 확정한다. 검색 결과 순서는 실행마다 바뀔 수 있어서 `--pick N` 단독은 `--dry-run` 미리보기에서만 받는다(`--pick`과 `--category-id`를 같이 주면 일치를 확인한다). 첫 플레이 날짜·정복 여부·원제·다시보기는 옵션 인자로 사람이 넣는다. 같은 categoryId를 다시 실행하면 갱신된다. 파일은 임시 파일에 쓴 뒤 rename한다. 옵션은 `src/lib/games/cli-args.ts` 참고.
- CLI는 `node --experimental-strip-types`로 `src/lib`의 `.ts`를 직접 import한다(그래서 lib 런타임 import는 `./x.ts` 상대경로, erasable 구문만). package.json에 `"type"`이 없어 Node가 `.ts`를 CommonJS로 읽다 실패한 뒤 ESM으로 다시 파싱하며 `MODULE_TYPELESS_PACKAGE_JSON` 경고를 매 실행 출력한다. 동작에는 영향이 없어 `games:add` 스크립트에서 `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON`으로 이 경고 하나만 끈다. `"type": "module"`을 넣으면 Next·ESLint 설정 파일 해석이 바뀌므로 넣지 않는다.
- 키는 `.dev.vars`(`CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`)에서 읽는다. 1Password 환경 `chzzk-local-dev`를 마운트한 파일이라 내용을 출력·커밋하지 않는다.
- 규칙: 다시보기는 유튜브 링크만(치지직 다시보기는 한 달 뒤 삭제되므로 검증이 거부). `firstPlayed`는 `YYYY-MM-DD` 또는 `null`. 정복 여부는 `clear | fail | endless | unknown`. endless("끝없는 탐험")는 리그 오브 레전드처럼 정복 개념이 없는 온라인 게임이다. unknown은 카드에 표시 없음, 상세에서 "기록 없음". 게임이 아닌 항목(저챗, 룰렛 자체, 갈틱폰 등)은 넣지 않는다. 단 종겜룰렛(데이)에서 플레이한 게임은 그 게임으로 기록하고 영상도 다시보기에 넣는다.
- 목록 상태(q, status, year, sort, page)의 정본은 URL이다. `GamesBoard`가 `useSearchParams`로 읽고 `history.pushState/replaceState`로 쓴다. 로직은 `src/lib/games`(query·labels)에만 두고 컴포넌트에 복제하지 않는다.
- 포스터는 `<img>`(loading lazy, 없거나 실패하면 "표본 라벨" 카드: 꿀붕이 발자국 워터마크 + SPECIMEN NO.·이름·"포스터 미확보" 라벨. 모바일은 번호만, 상세 모바일은 발자국만). `next/image`는 쓰지 않는다. `posterUrl`은 `isPosterUrl`(https, `pstatic.net` 또는 하위 도메인, 자격 증명 없음)만 통과한다. CLI도 같은 규칙이라 다른 호스트의 포스터는 스냅샷하지 않는다(null).
