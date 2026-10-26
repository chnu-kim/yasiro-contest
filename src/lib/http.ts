// 범용 HTTP 헬퍼(쿠키 파싱, CSRF Origin 검사, 복귀 경로 검증). games 전용이 아니다.
const NEXT_PATH_MAX = 512;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function readCookie(header: string | null, name: string): string | null {
  if (header === null) return null;
  for (const part of header.split(";")) {
    const piece = part.trim();
    const eq = piece.indexOf("=");
    if (eq === -1 || piece.slice(0, eq) !== name) continue;
    const value = piece.slice(eq + 1);
    if (value === "") return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

/** 쓰기 요청이 같은 출처에서 왔는가(CSRF 방어). Origin이 없으면 Sec-Fetch-Site: same-origin일 때만 허용 */
export function checkSameOrigin(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) return true;
  const origin = request.headers.get("origin");
  if (origin === null) return request.headers.get("sec-fetch-site") === "same-origin";
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  return host === new URL(request.url).host || host === request.headers.get("host");
}

/** 재로그인 후 돌아갈 경로. 같은 사이트의 절대 경로만 허용하고 아니면 "/" */
export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length > NEXT_PATH_MAX) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(raw)) return "/";
  return raw;
}
