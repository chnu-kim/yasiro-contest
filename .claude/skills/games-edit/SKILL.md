---
name: games-edit
description: yasiro-contest /games의 운영 D1 게임 기록을 터미널에서 추가·수정할 때 쓴다. "X는 Y야"(다른 게임으로 합치기), "이 게임 추가해 줘", "정복으로 바꿔 줘", "이 영상은 Z 게임이야", 숨기기·되살리기 요청이 모두 해당한다. 스키마 변경은 d1-migration을 쓴다.
---

# /games 기록 고치기 (운영 D1)

`pnpm games:edit`가 운영 D1을 로컬에 받아 사이트의 저장 로직(`src/lib/games/repo.ts`)을 그대로 돌리고, 실행된 쓰기 문장만 운영에 적용한다. 그래서 낙관적 잠금과 변경 기록(수정자 "관리자")이 사이트에서 저장한 것과 똑같이 남는다. SQL을 손으로 쓰지 않는다.

## 준비

- `.dev.vars`(1Password `chzzk-local-dev` 마운트)가 있는 디렉터리에서 실행한다. 키: `CHZZK_CLIENT_ID`·`CHZZK_CLIENT_SECRET`(검색), `ADMIN_CHANNEL_IDS`(수정자). 값은 출력하지 않는다.
- `ADMIN_CHANNEL_IDS`가 `.dev.vars`에 없으면 사용자에게 1Password 환경에 추가해 달라고 한다. 관리자 채널 ID를 코드·커밋·스킬 문서에 적지 않는다(채널 주소로 실명이 드러난다).

## 절차

1. 대상 찾기: `pnpm -s games:edit --find "키워드"` (숨긴 게임 포함, 다시보기 수·version 표시). 이름이 비슷한 항목을 모두 확인한다.
2. 판단이 갈리면 묻는다(아래 기준). 명확하면 바로 진행한다.
3. 작업 파일을 scratchpad에 JSON 배열로 쓴다(형식 아래).
4. 미리보기: `pnpm -s games:edit <ops.json>` → 바뀔 내용 요약을 사용자 요청과 대조한다.
5. 적용: `pnpm -s games:edit <ops.json> --apply`. 운영 DB를 바꾸므로 사용자가 이번 요청에서 그 변경을 지시한 경우에만 실행한다. 스크립트가 변경 기록 id가 모두 들어갔는지 확인한다.
6. 결과를 `--find`로 다시 보고 사용자에게 알린다.

적용 중 "변경 기록 N건 중 M건만" 실패가 나면 그사이 사이트에서 같은 게임을 고친 것이다. 일부 작업은 이미 들어갔을 수 있으니 `--find`로 상태를 보고 남은 작업만 다시 만든다.

## 작업 형식 (`src/lib/games/ops.ts`)

```json
[
  { "op": "add", "input": { "name": "파피 플레이타임 - 챕터 5", "originalTitle": "Poppy Playtime - Chapter 5", "categoryId": "…", "posterUrl": "https://…pstatic.net/…", "firstPlayed": "2026-02-19", "status": "unknown", "vods": [{ "title": "…", "url": "https://www.youtube.com/watch?v=…", "date": "2026-02-19" }] } },
  { "op": "update", "id": "윷놀이", "patch": { "firstPlayed": "2026-02-16", "status": "clear", "name": "…", "originalTitle": null, "category": { "categoryId": "…", "posterUrl": null } } },
  { "op": "move-vods", "from": "증바람", "to": "league-of-legends", "hideFrom": true },
  { "op": "move-vods", "from": "윷놀이", "to": "netmarble-yutgame", "dates": ["2025-10-07"] },
  { "op": "move-vods", "from": "a", "to": "b", "urls": ["https://youtu.be/…"] },
  { "op": "hide", "id": "…" },
  { "op": "unhide", "id": "…" }
]
```

- `update.patch`: 키 없음 = 그대로, `null` = 비우기. `vods`를 주면 전체 교체.
- `move-vods`: `dates`·`urls`가 없으면 전부 옮긴다. 대상에 이미 있는 영상은 중복으로 넣지 않는다. `hideFrom`이면 원래 게임을 숨긴다.
- 하나라도 실패하면 거기서 멈추고 운영에는 아무것도 적용하지 않는다.
- 추가할 때 카테고리는 `pnpm -s games:edit --search "한국어 검색어"`로 확인한다(영문 검색은 결과가 없다). `categoryId`와 `posterImageUrl`을 그대로 쓴다. 치지직에 없으면 둘 다 빼고 표본 라벨로 둔다.

## 판단 기준

- 서버·모드·이벤트가 붙은 이름(예: "혁명! PD몬스터 서버" → 마인크래프트, 증바람 → 리그 오브 레전드): 원래 게임으로 `move-vods` + `hideFrom`.
- 챕터·시리즈 작품(파피 플레이타임 챕터 N 등): 따로 둔다. 기존 항목이 챕터별이면 새 챕터도 별도 항목으로, 이름은 기존 형식("파피 플레이타임 - 챕터 N")에 맞춘다.
- 영상 일부만 다른 게임이면 `dates`/`urls`로 그 영상만 옮긴다. 옮긴 뒤 원래 게임의 첫 플레이가 남은 영상보다 이르면 사용자에게 확인하고 `update`로 맞춘다.
- 종겜룰렛(데이) 영상은 실제 플레이한 게임에 넣는다. 게임이 아닌 항목(저챗, 룰렛 자체, 갈틱폰 등)은 넣지 않는다.
- 다시보기는 유튜브만. `firstPlayed`·정복 여부를 추측하지 않는다. 모르면 `null`·`unknown`.
- 숨김은 되돌릴 수 있다. 사용자가 "삭제"라고 해도 `hide`로 한다.
