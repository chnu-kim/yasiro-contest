// 얇은 CLI. 로직은 src/lib/games/seed.ts.
// 사용: pnpm games:seed <input.json> [--out migrations/0008_games_seed.sql] [--force]
import fs from "node:fs";
import { buildSeedSql } from "../src/lib/games/seed.ts";
import { GamesValidationError } from "../src/lib/games/schema.ts";

const USAGE = "사용: pnpm games:seed <input.json> [--out migrations/0008_games_seed.sql] [--force]";
const DEFAULT_OUT = new URL("../migrations/0008_games_seed.sql", import.meta.url);

function fail(...lines: string[]): never {
  console.error(lines.join("\n"));
  process.exit(1);
}

let input: string | undefined;
let out: string | URL = DEFAULT_OUT;
let force = false;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--force") force = true;
  else if (a === "--out") {
    const v = args[++i];
    if (v === undefined) fail("--out 에 경로가 필요해요.", USAGE);
    out = v;
  } else if (a.startsWith("-") || input !== undefined) fail(`알 수 없는 인자: ${a}`, USAGE);
  else input = a;
}
if (input === undefined) fail(USAGE);

if (fs.existsSync(out) && !force) {
  fail(`${String(out instanceof URL ? out.pathname : out)} 가 이미 있어요. 원격 적용 후에는 다시 만들지 않아요. 로컬에서만 다시 만들 때 --force 를 붙이세요.`);
}

let sql: string;
try {
  sql = buildSeedSql(JSON.parse(fs.readFileSync(input, "utf8")));
} catch (e) {
  if (e instanceof GamesValidationError) fail("games 검증 실패:", e.message);
  fail(`${input} 를 읽지 못했어요: ${e instanceof Error ? e.name : "오류"}`);
}
fs.writeFileSync(out, sql);
console.error(`${String(out instanceof URL ? out.pathname : out)} 에 썼어요 (${sql.split("\n").length - 2}문장).`);
