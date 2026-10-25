import { describe, it, expect } from "vitest";
import { HOME_DESCRIPTION, HOME_TITLE, OG_IMAGE, SITE_NAME, SITE_PAGES, SITE_URL, jsonLdString, pageMetadata, siteDefaults, siteJsonLd } from "./seo";

describe("홈 문구", () => {
  it("검색어(야시로·치지직·버튜버·버츄얼)와 '비공식'이 홈 제목·설명에 들어 있다", () => {
    const text = `${HOME_TITLE} ${HOME_DESCRIPTION}`;
    for (const word of ["야시로", "치지직", "버튜버", "버츄얼", "비공식"]) expect(text).toContain(word);
  });

  it("홈 제목은 '야시로'로 시작한다", () => {
    expect(HOME_TITLE.startsWith("야시로")).toBe(true);
  });
});

describe("pageMetadata", () => {
  const meta = pageMetadata({ path: "/games", title: "플레이한 게임", description: "설명" });

  it("제목은 그대로 두고(레이아웃 template이 붙인다) 대표 주소를 경로로 둔다", () => {
    expect(meta.title).toBe("플레이한 게임");
    expect(meta.description).toBe("설명");
    expect(meta.alternates).toEqual({ canonical: "/games" });
  });

  it("공유 미리보기는 사이트 이름을 붙인 제목과 같은 설명·이미지를 쓴다", () => {
    expect(meta.openGraph).toEqual({
      type: "website",
      locale: "ko_KR",
      siteName: SITE_NAME,
      url: "/games",
      title: `플레이한 게임 | ${SITE_NAME}`,
      description: "설명",
      images: [OG_IMAGE],
    });
    expect(meta.twitter).toEqual({
      card: "summary_large_image",
      title: `플레이한 게임 | ${SITE_NAME}`,
      description: "설명",
      images: [OG_IMAGE.url],
    });
  });

  it("홈(absolute 제목)은 template 없이 그 제목을 그대로 공유 제목으로 쓴다", () => {
    const home = pageMetadata({ path: "/", title: { absolute: HOME_TITLE }, description: HOME_DESCRIPTION });
    expect(home.title).toEqual({ absolute: HOME_TITLE });
    expect(home.alternates).toEqual({ canonical: "/" });
    expect(home.openGraph).toMatchObject({ title: HOME_TITLE, url: "/" });
    expect(home.twitter).toMatchObject({ title: HOME_TITLE });
  });
});

describe("siteDefaults", () => {
  const meta = siteDefaults();

  it("절대 주소 기준과 페이지 제목 template을 둔다", () => {
    expect(meta.metadataBase).toEqual(new URL(SITE_URL));
    expect(meta.title).toEqual({ default: HOME_TITLE, template: `%s | ${SITE_NAME}` });
    expect(meta.description).toBe(HOME_DESCRIPTION);
  });

  it("주소가 페이지마다 다르므로 canonical·og:url은 기본값에 두지 않는다", () => {
    expect(meta.alternates).toBeUndefined();
    expect(meta.openGraph).not.toHaveProperty("url");
    expect(meta.openGraph).toMatchObject({ title: HOME_TITLE, images: [OG_IMAGE] });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", title: HOME_TITLE });
  });
});

describe("SITE_PAGES", () => {
  it("공개 페이지 네 곳을 담고 홈이 맨 앞이다", () => {
    expect(SITE_PAGES.map((p) => p.path)).toEqual(["/", "/about", "/games", "/to-yasiro"]);
  });
});

describe("siteJsonLd", () => {
  const ld = siteJsonLd();

  it("팬사이트(WebSite)이고 다루는 대상은 야시로(Person)다", () => {
    expect(ld).toMatchObject({ "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: SITE_URL, inLanguage: "ko" });
    expect(ld.about).toMatchObject({ "@type": "Person", name: "야시로", alternateName: "Yasiro" });
  });

  it("야시로의 공식 채널을 sameAs로 잇는다", () => {
    expect(ld.about.sameAs).toEqual([
      "https://chzzk.naver.com/d6e680f5b17eba0b078f978dd722c0f3",
      "https://www.youtube.com/@yasiro0321",
      "https://x.com/yasiro__",
    ]);
  });
});

describe("jsonLdString", () => {
  it("<를 이스케이프해 </script>로 스크립트를 닫지 못하게 한다", () => {
    const s = jsonLdString({ a: "</script><b>" });
    expect(s).not.toContain("<");
    expect(JSON.parse(s)).toEqual({ a: "</script><b>" });
  });
});
