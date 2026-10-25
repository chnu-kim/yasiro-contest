import { handleCreateGame, handleListGames } from "@/lib/games/api";
import { getGamesDeps } from "./_deps";

export async function GET(req: Request) {
  return handleListGames(req, await getGamesDeps());
}

export async function POST(req: Request) {
  return handleCreateGame(req, await getGamesDeps());
}
