import type { MetadataRoute } from 'next';
import { brand } from '@/lib/config/brand';
export default function robots(): MetadataRoute.Robots { return { rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/employer', '/admin', '/apply', '/go', '/auth'] }], sitemap: `${brand.siteUrl}/sitemap.xml` }; }
