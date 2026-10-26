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

/** 토큰 폐기 기본 타임아웃(ms). 로그인 응답과 무관한 best-effort 작업이라 짧게 둔다 */
const REVOKE_TIMEOUT_MS = 3000;

/** 치지직 API가 code !== 200을 돌려줬다. 로그에는 code만 남긴다(본문·토큰을 남기지 않는다) */
export class ChzzkApiError extends Error {
  readonly code: number;

  constructor(label: string, code: number, message: string | null) {
    super(`${label} failed ${code}: ${message}`);
    this.name = "ChzzkApiError";
    this.code = code;
  }
}

/** 환경 변수에서 치지직 앱 설정을 읽는다. 하나라도 없거나 비면 null('undefined' 문자열로 요청하지 않게) */
export function readChzzkConfig(env: Record<string, string | undefined>): ChzzkConfig | null {
  const clientId = env.CHZZK_CLIENT_ID;
  const clientSecret = env.CHZZK_CLIENT_SECRET;
  const redirectUri = env.CHZZK_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

/** 인가 코드 → 토큰 교환 */
export async function exchangeCode(
  config: ChzzkConfig,
  code: string,
  state: string,
  fetchFn: typeof fetch = fetch,
): Promise<TokenResponse> {
  const res = await fetchFn(`${CHZZK_API_BASE}/auth/v1/token`, {
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
  if (data.code !== 200) throw new ChzzkApiError("Token exchange", data.code, data.message);
  return data.content;
}

/** Access Token으로 사용자 정보 조회 */
export async function fetchUser(accessToken: string, fetchFn: typeof fetch = fetch): Promise<ChzzkUser> {
  const res = await fetchFn(`${CHZZK_API_BASE}/open/v1/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json() as { code: number; message: string | null; content: ChzzkUser };
  if (data.code !== 200) throw new ChzzkApiError("User fetch", data.code, data.message);
  return data.content;
}

/** 토큰 폐기(POST /auth/v1/token/revoke). HTTP 상태 코드를 돌려주고, 네트워크 오류·타임아웃은 던진다 */
export async function revokeToken(
  config: Pick<ChzzkConfig, "clientId" | "clientSecret">,
  token: string,
  tokenTypeHint: "access_token" | "refresh_token",
  fetchFn: typeof fetch = fetch,
  timeoutMs: number = REVOKE_TIMEOUT_MS,
): Promise<number> {
  const res = await fetchFn(`${CHZZK_API_BASE}/auth/v1/token/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: config.clientId, clientSecret: config.clientSecret, token, tokenTypeHint }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  await res.body?.cancel();
  return res.status;
}

/** cryptographically random state 문자열 생성 */
export function generateState(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
