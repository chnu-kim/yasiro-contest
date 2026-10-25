// 검색·공유 미리보기 메타데이터. layout(기본값·template), 각 page(pageMetadata), sitemap.ts, 허브 JSON-LD가 쓴다.
import type { Metadata } from "next";

export const SITE_URL = "https://yasiro.stream";
export const SITE_NAME = "야시로 팬사이트";

// 검색어(야시로·치지직·버튜버·버츄얼)를 문장 안에 자연스럽게 넣고, 공식 사이트로 오해하지 않게 '비공식'을 밝힌다.
export const HOME_TITLE = "야시로 · 치지직 버튜버 비공식 팬사이트";
export const HOME_DESCRIPTION =
  "치지직에서 방송하는 버츄얼 스트리머(버튜버) 야시로의 비공식 팬사이트예요. 프로필과 채널, 방송에서 플레이한 게임, 팬들의 한마디를 모았어요.";

export const OG_IMAGE = { url: "/og.png", width: 1200, height: 630, alt: "야시로 · 치지직 버튜버 비공식 팬사이트" };

export const SITE_PAGES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/about", priority: 0.8 },
  { path: "/games", priority: 0.8 },
  { path: "/to-yasiro", priority: 0.6 },
];

// 하위 segment의 openGraph·twitter는 레이아웃 값을 통째로 덮으므로(얕은 병합) 페이지마다 전부 채운다.
export function pageMetadata({
  path,
  title,
  description,
}: {
  path: string;
  title: string | { absolute: string };
  description: string;
}): Metadata {
  const shareTitle = typeof title === "string" ? `${title} | ${SITE_NAME}` : title.absolute;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", locale: "ko_KR", siteName: SITE_NAME, url: path, title: shareTitle, description, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title: shareTitle, description, images: [OG_IMAGE.url] },
  };
}

// 레이아웃 기본값. 페이지가 metadata를 따로 두지 않을 때(404 등) 쓰인다. 주소(canonical·og:url)는 페이지마다 달라 넣지 않는다.
export function siteDefaults(): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: HOME_TITLE, template: `%s | ${SITE_NAME}` },
    description: HOME_DESCRIPTION,
    openGraph: { type: "website", locale: "ko_KR", siteName: SITE_NAME, title: HOME_TITLE, description: HOME_DESCRIPTION, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title: HOME_TITLE, description: HOME_DESCRIPTION, images: [OG_IMAGE.url] },
  };
}

export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "ko",
    description: HOME_DESCRIPTION,
    about: {
      "@type": "Person",
      name: "야시로",
      alternateName: "Yasiro",
      description: "치지직 버츄얼 스트리머. 테라포레 소속 벌꿀오소리 탐험가.",
      sameAs: [
        "https://chzzk.naver.com/d6e680f5b17eba0b078f978dd722c0f3",
        "https://www.youtube.com/@yasiro0321",
        "https://x.com/yasiro__",
      ],
    },
  };
}

// <script type="application/ld+json"> 안에 넣을 문자열. </script>로 태그가 닫히지 않게 <를 이스케이프한다.
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
