import { handleUpdateGame } from "@/lib/games/api";
import { getGamesDeps } from "../_deps";

export async function PATCH(req: Request, ctx: RouteContext<"/api/games/[id]">) {
  const { id } = await ctx.params;
  return handleUpdateGame(req, await getGamesDeps(), id);
}
