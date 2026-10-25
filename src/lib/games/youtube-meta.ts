// 유튜브 oEmbed로 다시보기 제목·날짜를 읽는다. fetch는 주입한다(서버 프록시 api.ts가 실제 fetch를 넘김).
import { CHZZK_VOD_MESSAGE, isChzzkUrl, isValidIsoDate, TITLE_MAX, youtubeVideoId } from "./schema.ts";
import type { FetchLike, YoutubeMeta } from "./types.ts";

export const OEMBED_ENDPOINT = "https://www.youtube.com/oembed";

export type YoutubeMetaErrorCode = "invalid_url" | "chzzk_vod" | "not_found" | "upstream";

export class YoutubeMetaError extends Error {
  readonly code: YoutubeMetaErrorCode;
  constructor(code: YoutubeMetaErrorCode, message: string) {
    super(message);
    this.name = "YoutubeMetaError";
    this.code = code;
  }
}

/** trim 후 유튜브 영상 링크면 정규화한 URL과 영상 ID. 아니면 null */
export function normalizeYoutubeUrl(raw: string): { videoId: string; url: string } | null {
  const videoId = youtubeVideoId(raw.trim());
  return videoId === null ? null : { videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
}

const BRACKET_GROUP = /\[[^[\]]*\]/g;
const TITLE_DATE = /^\[\s*(\d{4})\s*\.?\s*(\d{1,2})\s*\.?\s*(\d{1,2})\s*\.?\s*\]$/;

/** 제목의 마지막 대괄호 묶음 "[ YYYY. MM. DD ]"에서 날짜를 읽는다. 실재하는 날짜가 아니면 null */
export function dateFromTitle(title: string): string | null {
  const groups = title.match(BRACKET_GROUP);
  const m = groups === null ? null : TITLE_DATE.exec(groups[groups.length - 1]);
  if (m === null) return null;
  const iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return isValidIsoDate(iso) ? iso : null;
}

const UPSTREAM_MESSAGE = "유튜브에서 영상 정보를 가져오지 못했어요. 잠시 뒤에 다시 해 주세요.";
const NOT_FOUND_STATUSES = new Set([400, 401, 403, 404]);

/** trim 후 TITLE_MAX(UTF-16 단위, schema의 .length 기준)로 자르고 끊긴 서로게이트·끝 공백을 뗀다 */
function clampTitle(raw: string): string {
  let t = raw.trim().slice(0, TITLE_MAX);
  if (/[\uD800-\uDBFF]$/.test(t)) t = t.slice(0, -1);
  return t.trimEnd();
}

/** 유튜브 링크의 제목·날짜를 oEmbed로 읽는다. 오류 메시지에는 응답 본문·원인 에러를 넣지 않는다 */
export async function fetchYoutubeMeta(fetchImpl: FetchLike, rawUrl: string): Promise<YoutubeMeta> {
  if (isChzzkUrl(rawUrl)) throw new YoutubeMetaError("chzzk_vod", CHZZK_VOD_MESSAGE);
  const norm = normalizeYoutubeUrl(rawUrl);
  if (norm === null) {
    throw new YoutubeMetaError("invalid_url", "유튜브 영상 링크(youtube.com/watch?v=… 또는 youtu.be/…)를 넣어 주세요.");
  }
  let res: Response;
  try {
    res = await fetchImpl(`${OEMBED_ENDPOINT}?url=${encodeURIComponent(norm.url)}&format=json`);
  } catch {
    throw new YoutubeMetaError("upstream", UPSTREAM_MESSAGE);
  }
  if (NOT_FOUND_STATUSES.has(res.status)) {
    throw new YoutubeMetaError("not_found", "비공개이거나 삭제된 영상이에요.");
  }
  if (!res.ok) throw new YoutubeMetaError("upstream", UPSTREAM_MESSAGE);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new YoutubeMetaError("upstream", UPSTREAM_MESSAGE);
  }
  const raw = typeof body === "object" && body !== null ? (body as { title?: unknown }).title : undefined;
  const title = typeof raw === "string" ? clampTitle(raw) : "";
  if (title === "") throw new YoutubeMetaError("upstream", UPSTREAM_MESSAGE);
  return { videoId: norm.videoId, url: norm.url, title, date: dateFromTitle(title) };
}
