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
pnpm games:seed <input.json>   # 게임 JSON → migrations/0008 형태 시드 SQL (기존 파일은 --force 없이는 거부. 원격 적용 후엔 다시 만들지 않는다)
pnpm -s games:export [--local|--remote] [--hidden] [--out file]  # D1 → games.json 형식 백업. stdout으로 받을 땐 `-s`(pnpm 배너 제거) 또는 --out. --remote는 사람이 실행. 기본은 보이는 게임만, --hidden은 숨긴 게임만(전체 백업은 두 번). 변경 기록은 담지 않는다
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
  games/                플레이한 게임 출품작. page=서버(D1 읽기·관리자 판별), GamesBoard·GameCard·GameDetailDialog·Pagination·Poster(공개) +
                        관리자 UI: AdminBar·GameEditForm·CategoryPicker·AddGameFlow·DialogFrame·Toast, adminApi(fetch 래퍼)·drafts(localStorage)
  auth/{login,callback,logout}/route.ts   치지직 OAuth (login?next=<경로>는 oauth_next 쿠키로 복귀)
  api/guestbook/route.ts
  api/games/            관리자 API (route·[id]·[id]/hidden·[id]/changes·categories·youtube). 핸들러는 얇게, 로직은 src/lib/games/api.ts
src/components/         Nav, PostIt, SkipLink, ClearStamp (공유)
scripts/games-{seed,export}.ts   pnpm games:seed / games:export 진입점 (얇게. 로직은 src/lib/games/seed.ts)
src/lib/                순수 로직 + *.test.ts (chzzk-auth, guestbook, chzzk-category(검색·slugify만), games/{schema,query,labels,rows,repo,admin,diff,patch,client,api,seed,youtube-meta})
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
- 테이블: `sessions`, `guestbook`, `games`, `game_vods`, `game_changes`(0007, 시드 0008). 스키마 변경은 `d1-migration` 스킬로 한다.
- Worker secret: `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`, `CHZZK_REDIRECT_URI`, `ADMIN_CHANNEL_IDS`(쉼표 구분 관리자 채널 ID, 아래 '관리자') (`printf 'v' | pnpm wrangler secret put KEY`). Route Handler에서 `process.env`로 읽는다.
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

- 정본은 D1이다: `games`(게임 한 줄, `hidden`·`version`), `game_vods`(다시보기), `game_changes`(변경 기록). 기존 `src/data/games.json`과 `games:add` CLI는 없어졌다. 338개 시드는 `migrations/0008_games_seed.sql`(결정적 출력, 직접 고치지 않는다). 시드는 `INSERT OR IGNORE`라 다시 실행해도 기존 행을 덮어쓰지 않고, 다시보기는 그 게임의 `import-<id>` 기록이 없을 때만 들어간다. OR IGNORE는 CHECK 위반도 건너뛰므로 `seed-data.test.ts`가 개수(338·306)와 export의 sha256(이전 games.json)을 고정한다. 백업은 `pnpm -s games:export`(숨긴 게임은 `--hidden`으로 따로, 변경 기록은 백업되지 않음).
- 쓰기는 입력 원문이 아니라 검증기가 본 값을 저장한다(`repo.ts normalizedCandidate`: 이름·원제·categoryId·다시보기 제목 trim, 다시보기 URL은 `https://www.youtube.com/watch?v=<id>`로). 비교(`diffGames`)도 그 값으로 하므로 공백만 다른 수정은 "변화 없음"이다.
- **배포 순서**: `deploy.yml`은 마이그레이션을 적용하지 않는다. games 테이블을 읽는 코드를 main에 올리기 전에 사람이 `pnpm wrangler d1 migrations list yasiro-db --remote`로 대기 목록을 보고(0006 `DROP TABLE whack_scores, clicks`가 함께 실행되는지 확인, 필요하면 `wrangler d1 export`로 먼저 백업) `migrations apply --remote` → `SELECT count(*) FROM games`가 338인지 확인 → `ADMIN_CHANNEL_IDS` secret 확인 → 머지한다. 순서가 바뀌면 배포부터 적용 전까지 /games가 "기록을 불러오지 못했어요"를 보인다.
- `page.tsx`가 `loadGamesPageData`로 D1을 읽는다. D1이 없거나(`pnpm dev`) 조회가 실패하면 "기록을 불러오지 못했어요"를 보인다. 확인은 `pnpm build:worker` → `pnpm preview`(로컬 D1: `pnpm wrangler d1 migrations apply yasiro-db --local`)로 한다.
- 검증 규칙의 정본은 `src/lib/games/schema.ts`(`validateGames`, `validateCandidate`)다. 서버(`repo.ts`)와 클라이언트 폼(`patch.ts validateForm`)이 같은 함수를 쓴다. 다시보기는 유튜브 링크만(치지직 다시보기는 한 달 뒤 삭제). `firstPlayed`는 `YYYY-MM-DD` 또는 `null`. 정복 여부는 `clear | fail | endless | unknown`(endless는 정복 개념이 없는 온라인 게임, unknown은 카드에 표시 없음·상세 "기록 없음"). 게임이 아닌 항목(저챗, 룰렛 자체, 갈틱폰 등)은 넣지 않는다(`seed-data.test.ts`가 시드를 검사). 종겜룰렛(데이)에서 플레이한 게임은 그 게임으로 기록한다.
- 삭제는 숨김(soft delete, `hidden=1`)이다. 숨긴 게임은 방문자 목록·개수·상세·API에서 빠지고, 탐험 번호(NO.)는 숨기지 않은 게임만으로 매긴다(`indexWithHidden`, 숨긴 게임은 "—").
- 목록 상태(q, status, year, sort, page)의 정본은 URL이다. `GamesBoard`가 `useSearchParams`로 읽고 `history.pushState/replaceState`로 쓴다. 로직은 `src/lib/games`(query·labels)에만 두고 컴포넌트에 복제하지 않는다.
- 포스터는 `<img>`(loading lazy, 없거나 실패하면 "표본 라벨" 카드: 꿀붕이 발자국 워터마크 + SPECIMEN NO.·이름·"포스터 미확보" 라벨. 모바일은 번호만, 상세 모바일은 발자국만). `next/image`는 쓰지 않는다. `posterUrl`은 `isPosterUrl`(https, `pstatic.net` 또는 하위 도메인, 자격 증명 없음)만 통과한다.
- scripts/*.ts는 `node --experimental-strip-types`로 `src/lib`의 `.ts`를 직접 import한다(그래서 lib 런타임 import는 `./x.ts` 상대경로, erasable 구문만: enum·namespace·생성자 parameter property 금지). `MODULE_TYPELESS_PACKAGE_JSON` 경고는 스크립트에서 `--disable-warning`으로 끈다. `"type": "module"`을 넣으면 Next·ESLint 설정 해석이 바뀌므로 넣지 않는다.
- 로컬 치지직 검색(관리자 게임 추가)은 `.dev.vars`의 `CHZZK_CLIENT_ID`·`CHZZK_CLIENT_SECRET`을 쓴다. 1Password 환경 `chzzk-local-dev`를 마운트한 파일이라 내용을 출력·커밋하지 않는다.

### 관리자 (익명 규칙 포함)

- 관리자 = `sessions`(`expires_at > now`)의 `channel_id`가 허용 목록에 있는 사람. 허용 목록 = 야시로 채널 ID(`admin.ts`의 `YASIRO_CHANNEL_ID`, 공개 정보) ∪ Worker secret `ADMIN_CHANNEL_IDS`. 다른 관리자의 채널 ID는 `chzzk.naver.com/<id>`로 채널 이름이 드러나므로 **코드·migrations·테스트·주석·커밋에 쓰지 않는다**(테스트는 `test-d1.ts`의 `FAKE_ADMIN_ID`). 로컬 확인은 `pnpm exec opennextjs-cloudflare preview -- --port <p> --var ADMIN_CHANNEL_IDS:<가짜 ID>`(빌드는 `pnpm build:worker`)로 주입하고 로컬 D1 `sessions`에 그 ID의 세션 행을 넣은 뒤 `session_id` 쿠키를 설정한다(OAuth 불필요).
- **익명 표시(사용자 지시)**: 관리자의 치지직 채널 이름은 `games`·`game_changes`·API 응답·export·로그 어디에도 저장·표시·반환하지 않는다. 수정자 표시는 `actorNameFor(channelId)`로만 정한다(야시로 → "야시로", 그 밖의 허용 ID → "관리자", 시드 → "시스템"). 세션의 `channel_name`은 games 코드에서 SELECT하지 않는다. `channel_id`는 감사 컬럼(`games.updated_by_channel_id`, `game_changes.channel_id`)에만 저장하고 응답·props·로그로 내보내지 않는다. 테스트(`api.e2e.test.ts` 등)가 이를 고정한다. Nav의 로그인 표시는 기존대로 본인 브라우저에서 자기 채널 이름을 보인다(이 값은 layout의 `initialUser`로 직렬화되어 그 사용자의 HTML에만 들어간다).
- 쓰기 API는 `checkSameOrigin`(CSRF) → 인증 → 본문 크기 → 모양 → 검증 순서이고, 동시 수정은 `version` 낙관적 잠금(충돌 시 409 + "관리자가 방금(HH:MM) 이 게임을 먼저 고쳤어요…")이다. 응답은 `Cache-Control: no-store`.
- UI는 /games 안에서만: 관리자 띠(숨긴 게임 보기·게임 추가), 카드 호버/포커스 시 "수정" 칩(`@media (hover: none)`에서는 숨김), 상세 모달 하단 관리자 영역(숨기기·수정·변경 기록), 같은 모달의 수정 모드, 게임 추가 2단계. 수정 중 Esc·배경 클릭·닫기는 확인을 거치고(`DialogFrame intercept`), 로그인이 만료되면 입력을 `localStorage['yasiro-games-draft:<id|new>']`에 보존한다. 알림(`Toast`)은 열린 `<dialog>`(top layer) 위에 보이도록 dialog 안에도 렌더링하고, 한 번에 하나만 내용을 가진다.
- 응답 해석·문구·폼 로직은 `src/lib/games/{client,patch,diff}.ts`(순수 함수, 100% 커버리지)에 둔다. 컴포넌트는 상태와 fetch만 한다.
