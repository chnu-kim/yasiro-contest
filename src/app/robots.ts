import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// 로그인·API는 검색 결과에 나올 이유가 없어 막는다.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/auth/'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
