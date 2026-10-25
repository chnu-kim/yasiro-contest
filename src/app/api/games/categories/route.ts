import { handleSearchCategories } from "@/lib/games/api";
import { getGamesDeps } from "../_deps";

export async function GET(req: Request) {
  return handleSearchCategories(req, await getGamesDeps());
}
