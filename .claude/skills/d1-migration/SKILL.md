---
name: d1-migration
description: yasiro-contest의 D1(yasiro-db) 스키마를 바꿀 때 쓴다. 다음 번호의 마이그레이션 파일을 만들고, 로컬 검증 후 원격에 적용한다. 테이블·컬럼 추가, 삭제, 인덱스 변경이 모두 해당한다.
---

# D1 마이그레이션

wrangler가 `migrations/`의 파일명을 원격 `d1_migrations` 테이블과 비교해 적용 여부를 추적한다.

## 규칙

- 이미 있는 마이그레이션 파일은 수정하거나 삭제하지 않는다. 원격에는 적용된 상태로 남고 히스토리만 깨진다.
- 테이블·컬럼 제거도 새 파일로 한다: `DROP TABLE IF EXISTS ...` / `ALTER TABLE ... DROP COLUMN ...`. 선례는 `0005_drop_clicker.sql`.
- 가능한 한 `IF EXISTS` / `IF NOT EXISTS`로 다시 실행해도 안전하게 쓴다.
- 파일명은 `NNNN_snake_case.sql`. 번호는 `ls migrations`의 최댓값 + 1, 4자리 0 채움.
- 시각 컬럼은 기존 테이블과 같이 `INTEGER NOT NULL DEFAULT (unixepoch())`. 사용자를 가리키는 키는 `channel_id TEXT`.

## 절차

1. `ls migrations`로 다음 번호를 정하고 파일을 만든다.
2. 로컬에 적용해 SQL을 검증한다: `pnpm wrangler d1 migrations apply yasiro-db --local`
3. 스키마를 쓰는 코드(`src/app/api/**`, `src/lib/**`)와 테스트를 같이 고친다. CLAUDE.md의 테이블 목록도 갱신한다.
4. 원격 적용은 프로덕션 DB를 바꾸므로 사용자에게 확인을 받은 뒤 실행한다: `pnpm wrangler d1 migrations apply yasiro-db --remote`
   - CI는 마이그레이션을 적용하지 않는다. 새 스키마에 의존하는 코드가 main에 push되기 **전에** 원격 적용을 마쳐야 배포 직후 에러가 나지 않는다.
   - DROP은 반대 순서다. 테이블을 쓰는 코드를 먼저 배포해서 제거한 뒤 DROP을 적용한다.
5. 확인: `pnpm wrangler d1 migrations list yasiro-db --remote`
