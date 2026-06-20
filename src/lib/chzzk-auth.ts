const CHZZK_AUTH_URL = "https://chzzk.naver.com/account-interlock";
const CHZZK_API_BASE = "https://openapi.chzzk.naver.com";

export interface ChzzkConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface ChzzkUser {
  channelId: string;
  channelName: string;
}

/** OAuth 리다이렉트 URL 생성 */
export function buildAuthorizationURL(config: Pick<ChzzkConfig, "clientId" | "redirectUri">, state: string): string {
  const params = new URLSearchParams({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state,
  });
  return `${CHZZK_AUTH_URL}?${params}`;
}

/** 인가 코드 → 토큰 교환 */
export async function exchangeCode(
  config: ChzzkConfig,
  code: string,
  state: string,
): Promise<TokenResponse> {
  const res = await fetch(`${CHZZK_API_BASE}/auth/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "authorization_code",
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      state,
    }),
  });
  const data = await res.json() as { code: number; message: string | null; content: TokenResponse };
  if (data.code !== 200) throw new Error(`Token exchange failed ${data.code}: ${data.message}`);
  return data.content;
}

/** Access Token으로 사용자 정보 조회 */
export async function fetchUser(accessToken: string): Promise<ChzzkUser> {
  const res = await fetch(`${CHZZK_API_BASE}/open/v1/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json() as { code: number; message: string | null; content: ChzzkUser };
  if (data.code !== 200) throw new Error(`User fetch failed ${data.code}: ${data.message}`);
  return data.content;
}

/** cryptographically random state 문자열 생성 */
export function generateState(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
