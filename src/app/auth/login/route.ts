import { handleLogin } from "@/lib/auth-routes";
import { generateState, readChzzkConfig } from "@/lib/chzzk-auth";

export function GET(req: Request) {
  return handleLogin(req, { config: readChzzkConfig(process.env), newState: generateState });
}
