import { handleYoutubeMeta } from "@/lib/games/api";
import { getGamesDeps } from "../_deps";

export async function GET(req: Request) {
  return handleYoutubeMeta(req, await getGamesDeps());
}
