// 얇은 CLI. 로직은 src/lib 에 있다. 사용법은 `pnpm games:add` (인자 없이) 참고.
import fs from "node:fs";
import { CliArgsError, parseAddArgs, USAGE } from "../src/lib/games/cli-args.ts";
import { GamesValidationError, parseGames, serializeGames } from "../src/lib/games/schema.ts";
import {
  CandidateSelectionError,
  ChzzkCategoryError,
  GameConflictError,
  GameDraftError,
  searchCategories,
  selectCandidate,
  toGameDraft,
  upsertGame,
} from "../src/lib/chzzk-category.ts";

const GAMES_PATH = new URL("../src/data/games.json", import.meta.url);

function fail(code: number, ...lines: string[]): never {
  console.error(lines.join("\n"));
  process.exit(code);
}

// 같은 디렉터리(같은 파일시스템)의 임시 파일에 쓴 뒤 rename한다. 중간에 죽어도 정본이 잘린 채 남지 않는다.
function writeAtomic(target: URL, text: string) {
  const tmp = new URL(`${target.pathname.split("/").pop()}.${process.pid}.tmp`, target);
  try {
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, target);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
}

function issuesText(e: GamesValidationError): string {
  return e.issues.map((i) => `  ${i.path || "(root)"}: ${i.message}`).join("\n");
}

async function main() {
  let args;
  try {
    args = parseAddArgs(process.argv.slice(2));
  } catch (e) {
    if (e instanceof CliArgsError) fail(2, `${e.name}: ${e.message}`, "", USAGE);
    throw e;
  }

  const config = {
    clientId: process.env.CHZZK_CLIENT_ID ?? "",
    clientSecret: process.env.CHZZK_CLIENT_SECRET ?? "",
  };

  let candidates;
  try {
    candidates = await searchCategories(fetch, config, args.query, args.size);
  } catch (e) {
    if (e instanceof ChzzkCategoryError) fail(1, `${e.name}: ${e.message}`);
    throw e;
  }
  if (candidates.length === 0) fail(1, `GAME 카테고리 없음: "${args.query}"`);

  if (args.pick === undefined && args.categoryId === undefined) {
    console.log(`"${args.query}" 후보 ${candidates.length}건`);
    candidates.forEach((c, i) => console.log(`${i + 1}) ${c.categoryValue}  --category-id ${c.categoryId}`));
    console.log(`\n--category-id <ID> 를 붙여 다시 실행하세요 (미리보기: --pick N --dry-run).`);
    return;
  }

  let picked;
  try {
    picked = selectCandidate(candidates, { pick: args.pick, categoryId: args.categoryId });
  } catch (e) {
    if (e instanceof CandidateSelectionError) fail(2, `${e.name}: ${e.message}`);
    throw e;
  }

  let draft;
  try {
    draft = toGameDraft(picked, args.input);
  } catch (e) {
    if (e instanceof GameDraftError) fail(1, `${e.name}: ${e.message}`);
    throw e;
  }

  let existing;
  try {
    existing = parseGames(JSON.parse(fs.readFileSync(GAMES_PATH, "utf8")));
  } catch (e) {
    if (e instanceof GamesValidationError) fail(1, "기존 games.json 이 올바르지 않습니다:", issuesText(e));
    throw e;
  }

  let result;
  try {
    result = upsertGame(existing, draft);
  } catch (e) {
    if (e instanceof GameConflictError) fail(1, `${e.name}: ${e.message}`);
    throw e;
  }

  let text;
  try {
    text = serializeGames(result.games);
  } catch (e) {
    if (e instanceof GamesValidationError) fail(1, "검증 실패, 파일을 쓰지 않았습니다:", issuesText(e));
    throw e;
  }

  if (args.dryRun) console.log(JSON.stringify(result.game, null, 2));
  else writeAtomic(GAMES_PATH, text);
  console.log(`${result.action} ${result.game.id} (${result.game.name})${args.dryRun ? " [dry-run]" : ""}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? `${e.name}: ${e.message}` : "알 수 없는 오류");
  process.exit(1);
});
