// 얇은 CLI. 운영 D1의 /games 기록을 터미널에서 고친다. 로직은 src/lib/games/ops.ts(+ repo.ts).
// 사용:
//   pnpm games:edit --find "키워드"          운영 D1에서 게임 찾기(이름·원제·id, 숨긴 게임 포함)
//   pnpm games:edit --search "검색어"        치지직 카테고리 검색(추가할 때 categoryId·posterUrl 확인)
//   pnpm games:edit <ops.json>               미리보기: 운영 사본에 적용해 보고 바뀔 내용·SQL만 보여 준다
//   pnpm games:edit <ops.json> --apply       운영 D1에 적용하고, 변경 기록이 모두 들어갔는지 확인한다
// 수정자는 ADMIN_CHANNEL_IDS(환경 변수, 없으면 .dev.vars)의 관리자('관리자')로 남는다. 채널 ID·시크릿은 출력하지 않는다.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { searchCategories } from "../src/lib/chzzk-category.ts";
import { changeIdsOf, opsActor, parseOps, recordingDb, runOps } from "../src/lib/games/ops.ts";
import { sqlString } from "../src/lib/games/seed.ts";
import { createGamesTestDb } from "../src/lib/games/test-d1.ts";

const USAGE = [
  "사용: pnpm games:edit --find <키워드> | --search <검색어> | <ops.json> [--apply]",
  "  ops.json 형식은 .claude/skills/games-edit/SKILL.md 참고",
].join("\n");

function fail(...lines: string[]): never {
  console.error(lines.join("\n"));
  process.exit(1);
}

function devVars(): Record<string, string> {
  let text: string;
  try {
    text = fs.readFileSync(".dev.vars", "utf8");
  } catch {
    fail(".dev.vars가 없어요. 1Password 환경 chzzk-local-dev를 마운트해 주세요.");
  }
  const vars: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m !== null) vars[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return vars;
}

function wrangler(args: string[]): string {
  try {
    return execFileSync("pnpm", ["--silent", "wrangler", "d1", ...args], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "inherit"],
    });
  } catch {
    fail(`wrangler d1 ${args[0]} 가 실패했어요.`);
  }
}

function query<T>(sql: string): T[] {
  const parsed = JSON.parse(wrangler(["execute", "yasiro-db", "--remote", "--json", "--command", sql])) as { results: T[] }[];
  return parsed[0].results;
}

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const rest = args.filter((a) => a !== "--apply");

if (rest[0] === "--find") {
  if (rest[1] === undefined || rest.length > 2) fail(USAGE);
  const like = sqlString(`%${rest[1]}%`);
  const rows = query<Record<string, unknown>>(
    `SELECT id, name, original_title, category_id, status, first_played, hidden, version, (SELECT count(*) FROM game_vods v WHERE v.game_id = g.id) AS vods FROM games g WHERE name LIKE ${like} OR original_title LIKE ${like} OR id LIKE ${like} OR category_id LIKE ${like} ORDER BY first_played`,
  );
  for (const r of rows) console.log(JSON.stringify(r));
  if (rows.length === 0) console.log("없음");
} else if (rest[0] === "--search") {
  if (rest[1] === undefined || rest.length > 2) fail(USAGE);
  const vars = devVars();
  const found = await searchCategories(fetch, { clientId: vars.CHZZK_CLIENT_ID ?? "", clientSecret: vars.CHZZK_CLIENT_SECRET ?? "" }, rest[1]).catch((e: Error) =>
    fail(e.message),
  );
  for (const c of found) console.log(JSON.stringify(c));
  if (found.length === 0) console.log("없음 (치지직 검색은 한국어 검색어만 결과가 나와요)");
} else {
  if (rest.length !== 1) fail(USAGE);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(rest[0], "utf8"));
  } catch (e) {
    fail(`${rest[0]}를 읽지 못했어요: ${(e as Error).message}`);
  }
  const parsed = parseOps(raw);
  if (!parsed.ok) fail(parsed.error);
  let actor;
  try {
    actor = opsActor(process.env.ADMIN_CHANNEL_IDS ?? devVars().ADMIN_CHANNEL_IDS);
  } catch (e) {
    fail((e as Error).message);
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "games-edit-"));
  const snapshot = path.join(dir, "remote.sql");
  wrangler(["export", "yasiro-db", "--remote", "--no-schema", "--table", "games", "--table", "game_vods", "--table", "game_changes", "--output", snapshot]);
  const d1 = createGamesTestDb();
  d1.sqlite.exec(fs.readFileSync(snapshot, "utf8"));

  const rec = recordingDb(d1.db);
  const result = await runOps(rec.db, parsed.ops, { actor, now: Math.floor(Date.now() / 1000), uuid: randomUUID });
  for (const line of result.lines) console.log(line);
  if (!result.ok) fail(`실패: ${result.error}`, "운영 D1은 바꾸지 않았어요.");

  const writes = rec.writes();
  const sqlFile = path.join(dir, "writes.sql");
  fs.writeFileSync(sqlFile, writes.join("\n") + "\n");
  if (writes.length === 0) {
    console.log("바뀌는 내용이 없어요.");
  } else if (!apply) {
    console.log(`\n미리보기예요. 쓰기 ${writes.length}문장: ${sqlFile}\n적용하려면 --apply를 붙여 다시 실행해 주세요.`);
  } else {
    wrangler(["execute", "yasiro-db", "--remote", "--file", sqlFile]);
    const ids = changeIdsOf(writes);
    const [{ n }] = query<{ n: number }>(`SELECT count(*) AS n FROM game_changes WHERE id IN (${ids.map(sqlString).join(", ")})`);
    if (n !== ids.length) fail(`변경 기록 ${ids.length}건 중 ${n}건만 들어갔어요. 그사이 사이트에서 고친 게임이 있으면 건너뛰어요. 다시 실행해 주세요.`);
    console.log(`\n운영 D1에 적용했어요. 변경 기록 ${n}건 확인.`);
  }
  d1.close();
}
