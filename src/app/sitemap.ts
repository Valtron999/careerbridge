import type { MetadataRoute } from 'next';
import { brand } from '@/lib/config/brand';
import { supabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 3600;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = ['', '/jobs', '/placements', '/about', '/faq'].map((p) => ({ url: `${brand.siteUrl}${p}` }));
  if (!supabaseConfigured()) return base;
  const { data } = await createClient().from('opportunities').select('slug, kind, updated_at').eq('status', 'published').limit(5000);
  return [...base, ...(data ?? []).map((o: { slug: string; kind: string; updated_at: string }) => ({ url: `${brand.siteUrl}/${o.kind === 'placement' ? 'placements' : 'jobs'}/${o.slug}`, lastModified: o.updated_at }))];
}
