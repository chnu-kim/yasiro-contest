import type { MetadataRoute } from 'next';
import { SITE_PAGES, SITE_URL } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  return SITE_PAGES.map((p) => ({ url: `${SITE_URL}${p.path === '/' ? '' : p.path}`, changeFrequency: 'weekly', priority: p.priority }));
}
