// 얇은 CLI. D1(games, game_vods) → games.json 형식 JSON을 stdout(또는 --out)으로 낸다. 로직은 src/lib/games/seed.ts.
// 사용: pnpm games:export [--local(기본)|--remote] [--hidden] [--out file]
// --remote는 사람이 실행한다. 수정자 열(updated_by_*)은 SELECT하지 않는다.
// 백업 범위: 기본은 보이는 게임만, --hidden은 숨긴 게임만(형식에 hidden 표시가 없어 따로 받는다). 변경 기록(game_changes)은 담지 않는다.
// 두 SELECT는 한 번의 execute로 보내 같은 시점의 게임·다시보기를 받는다.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { exportGames } from "../src/lib/games/seed.ts";
import { GAME_COLUMNS, VOD_COLUMNS, VOD_ORDER } from "../src/lib/games/rows.ts";
import type { GameRow, VodRow } from "../src/lib/games/types.ts";

const USAGE = [
  "사용: pnpm games:export [--local|--remote] [--hidden] [--out file]",
  "  기본은 보이는 게임만, --hidden은 숨긴 게임만 낸다. 전체 백업은 두 번 실행해 파일 두 개를 받는다.",
  "  변경 기록(game_changes)은 백업하지 않는다.",
].join("\n");

function fail(...lines: string[]): never {
  console.error(lines.join("\n"));
  process.exit(1);
}

let mode: "--local" | "--remote" = "--local";
let hidden = false;
let out: string | undefined;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--local" || a === "--remote") mode = a;
  else if (a === "--hidden") hidden = true;
  else if (a === "--out") {
    out = args[++i];
    if (out === undefined) fail("--out 에 경로가 필요해요.", USAGE);
  } else fail(`알 수 없는 인자: ${a}`, USAGE);
}

/** 여러 SELECT를 한 번의 wrangler d1 execute로 보낸다. 결과는 문장 순서대로 */
function queryAll(statements: readonly string[]): unknown[][] {
  let stdout: string;
  try {
    // wrangler의 진행 로그는 stderr로 흘려보내고 JSON만 stdout에서 읽는다
    stdout = execFileSync("pnpm", ["--silent", "wrangler", "d1", "execute", "yasiro-db", mode, "--json", "--command", statements.join("; ")], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "inherit"],
    });
  } catch {
    fail("wrangler d1 execute 가 실패했어요.");
  }
  const parsed: unknown = JSON.parse(stdout);
  const results = Array.isArray(parsed) ? parsed.map((r) => (r as { results?: unknown[] } | null)?.results) : [];
  if (results.length !== statements.length || results.some((r) => !Array.isArray(r))) fail("wrangler 출력 형식을 읽지 못했어요.");
  return results as unknown[][];
}

const [games, vods] = queryAll([`SELECT ${GAME_COLUMNS} FROM games`, `SELECT ${VOD_COLUMNS} FROM game_vods ${VOD_ORDER}`]) as [GameRow[], VodRow[]];
const json = exportGames(games, vods, { hidden });
if (out === undefined) process.stdout.write(json);
else {
  fs.writeFileSync(out, json);
  console.error(`${out} 에 썼어요 (${games.length}개 중 ${hidden ? "숨긴" : "보이는"} 게임).`);
}
