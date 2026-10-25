import { parseArgs } from "node:util";
import { ID_PATTERN, isValidIsoDate, isYoutubeUrl } from "./schema.ts";
import type { AddArgs, GameDraftInput, GameStatus, Vod } from "./types.ts";

export class CliArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliArgsError";
  }
}

export const USAGE = `사용법: pnpm games:add "검색어" [옵션]
  --category-id ID             후보의 categoryId로 확정. 파일을 쓰는 실행은 이것이 필요하다
  --pick N                     후보 번호(1부터). --dry-run 미리보기용(--category-id와 함께 주면 일치 확인)
  --size N                     검색 후보 수 1-50 (기본 20)
  --date YYYY-MM-DD|none       첫 플레이 날짜 (none = 날짜 기록 없음)
  --status clear|fail|unknown  정복 여부
  --orig "원제"                원제(스팀 등재명 등)
  --id slug                    id 직접 지정
  --vod "제목|유튜브URL|YYYY-MM-DD"  다시보기 (반복 가능)
  --dry-run                    파일을 쓰지 않고 결과 JSON만 출력`;

const STATUSES: readonly string[] = ["clear", "fail", "unknown"];

export function parseVodArg(s: string): Vod {
  const second = s.lastIndexOf("|");
  const first = second < 0 ? -1 : s.lastIndexOf("|", second - 1);
  if (second < 0 || first < 0) {
    throw new CliArgsError(`--vod 형식은 "제목|유튜브URL|YYYY-MM-DD" 입니다: ${s}`);
  }
  const title = s.slice(0, first).trim();
  const url = s.slice(first + 1, second).trim();
  const date = s.slice(second + 1).trim();
  if (title === "") throw new CliArgsError("--vod 제목이 비어 있습니다");
  if (!isYoutubeUrl(url)) {
    throw new CliArgsError(`--vod URL 은 유튜브 링크(youtube.com/watch?v= 또는 youtu.be/)만 가능합니다: ${url}`);
  }
  if (!isValidIsoDate(date)) {
    throw new CliArgsError(`--vod 날짜가 올바르지 않습니다 (YYYY-MM-DD): ${date}`);
  }
  return { title, url, date };
}

export function parseAddArgs(argv: readonly string[]): AddArgs {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: true,
      options: {
        pick: { type: "string" },
        "category-id": { type: "string" },
        size: { type: "string" },
        date: { type: "string" },
        status: { type: "string" },
        orig: { type: "string" },
        id: { type: "string" },
        vod: { type: "string", multiple: true },
        "dry-run": { type: "boolean" },
      },
    });
  } catch (e) {
    throw new CliArgsError(`인자 오류: ${(e as Error).message}`);
  }
  const { values, positionals } = parsed;

  if (positionals.length !== 1 || positionals[0].trim() === "") {
    throw new CliArgsError("검색어를 정확히 1개 지정하세요");
  }
  const query = positionals[0].trim();

  let pick: number | undefined;
  if (values.pick !== undefined) {
    if (!/^[1-9]\d*$/.test(values.pick)) throw new CliArgsError(`--pick 은 1 이상의 정수여야 합니다: ${values.pick}`);
    pick = Number(values.pick);
  }

  let categoryId: string | undefined;
  if (values["category-id"] !== undefined) {
    categoryId = values["category-id"].trim();
    if (categoryId === "") throw new CliArgsError("--category-id 가 비어 있습니다");
  }

  const dryRun = values["dry-run"] === true;
  if (pick !== undefined && categoryId === undefined && !dryRun) {
    throw new CliArgsError(
      "--pick 만으로는 파일을 쓰지 않습니다. 검색 결과는 실행마다 바뀔 수 있으니 --category-id 로 확정하거나 --dry-run 으로 미리 보세요",
    );
  }

  let size = 20;
  if (values.size !== undefined) {
    if (!/^\d+$/.test(values.size) || Number(values.size) < 1 || Number(values.size) > 50) {
      throw new CliArgsError(`--size 는 1-50 정수여야 합니다: ${values.size}`);
    }
    size = Number(values.size);
  }

  const input: GameDraftInput = {};
  if (values.date !== undefined) {
    if (values.date === "none") input.firstPlayed = null;
    else if (isValidIsoDate(values.date)) input.firstPlayed = values.date;
    else throw new CliArgsError(`--date 는 실재하는 YYYY-MM-DD 또는 none 이어야 합니다: ${values.date}`);
  }
  if (values.status !== undefined) {
    if (!STATUSES.includes(values.status)) {
      throw new CliArgsError(`--status 는 clear|fail|unknown 중 하나여야 합니다: ${values.status}`);
    }
    input.status = values.status as GameStatus;
  }
  if (values.orig !== undefined) {
    const orig = values.orig.trim();
    if (orig === "") throw new CliArgsError("--orig 가 비어 있습니다");
    input.originalTitle = orig;
  }
  if (values.id !== undefined) {
    if (!ID_PATTERN.test(values.id)) {
      throw new CliArgsError(`--id 는 소문자/숫자/한글과 하이픈으로 된 slug 여야 합니다: ${values.id}`);
    }
    input.id = values.id;
  }
  if (values.vod !== undefined) input.vods = values.vod.map(parseVodArg);

  return { query, pick, categoryId, size, dryRun, input };
}
