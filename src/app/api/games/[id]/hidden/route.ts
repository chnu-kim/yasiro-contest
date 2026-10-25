import { handleSetHidden } from "@/lib/games/api";
import { getGamesDeps } from "../../_deps";

export async function POST(req: Request, ctx: RouteContext<"/api/games/[id]/hidden">) {
  const { id } = await ctx.params;
  return handleSetHidden(req, await getGamesDeps(), id);
}
