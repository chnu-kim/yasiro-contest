import { handleListChanges } from "@/lib/games/api";
import { getGamesDeps } from "../../_deps";

export async function GET(req: Request, ctx: RouteContext<"/api/games/[id]/changes">) {
  const { id } = await ctx.params;
  return handleListChanges(req, await getGamesDeps(), id);
}
