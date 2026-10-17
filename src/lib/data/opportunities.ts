import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { PAGE_SIZE, TYPE_TO_CATEGORY, buildTsQuery, type SearchParams } from '@/lib/validation/search';

export type OpportunityCardData = {
  id: string; slug: string; title: string; kind: 'job' | 'placement'; work_arrangement: 'onsite' | 'hybrid' | 'remote';
  location_city: string | null; location_state: string | null; location_country: string | null;
  salary_min: number | null; salary_max: number | null; salary_currency: string | null; is_unpaid: boolean;
  deadline: string | null; published_at: string | null; placement_duration_weeks: number | null; employment_type: string | null;
  employer: { name: string; slug: string; logo_url: string | null; verification_status: string } | null;
  category: { name: string; slug: string } | null;
};
export const CARD = 'id, slug, title, kind, work_arrangement, location_city, location_state, location_country, salary_min, salary_max, salary_currency, is_unpaid, deadline, published_at, placement_duration_weeks, employment_type, employer:employers(name, slug, logo_url, verification_status), category:opportunity_categories(name, slug)';
export const notExpired = () => `deadline.is.null,deadline.gte.${new Date().toISOString()}`;

export type SearchResult = { items: OpportunityCardData[]; total: number; error?: 'not_configured' | 'failed' };

export async function searchOpportunities(p: SearchParams, forceKind?: 'job' | 'placement', client?: SupabaseClient): Promise<SearchResult> {
  if (!client && !supabaseConfigured()) return { items: [], total: 0, error: 'not_configured' };
  const supabase = client ?? createClient();
  const kind = forceKind ?? (p.type ? TYPE_TO_CATEGORY[p.type]?.kind : undefined);
  const slugs = p.category ? [p.category] : p.type ? TYPE_TO_CATEGORY[p.type]?.slugs : undefined;
  const tsq = p.q ? buildTsQuery(p.q) : null;
  const args = {
    p_q: tsq, p_location: p.location ?? null, p_kind: kind ?? null, p_category_slugs: slugs ?? null, p_arrangement: p.arrangement ?? null,
    p_experience: p.experience ?? (p.type === 'entry' ? 'entry' : null), p_paid: p.paid ?? null, p_duration: p.duration ?? null, p_verified: Boolean(p.verified), p_course: p.course ?? null,
    p_sort: p.sort ?? (tsq ? 'relevance' : 'newest'), p_limit: PAGE_SIZE, p_offset: (p.page - 1) * PAGE_SIZE,
  };
  if (p.q && !tsq) return { items: [], total: 0 }; // the keyword had no searchable characters
  const { data: rows, error } = await supabase.rpc('search_opportunities', args);
  if (error) { console.error('search failed', error.code); return { items: [], total: 0, error: 'failed' }; }
  const hits = (rows ?? []) as { id: string; total: number | string }[];
  let total = Number(hits[0]?.total ?? 0);
  if (hits.length === 0) {
    if (p.page > 1) { const { data: first } = await supabase.rpc('search_opportunities', { ...args, p_limit: 1, p_offset: 0 }); total = Number((first as { total: number }[] | null)?.[0]?.total ?? 0); }
    return { items: [], total };
  }
  const ids = hits.map((h) => h.id);
  const { data: cards, error: e2 } = await supabase.from('opportunities').select(CARD).in('id', ids);
  if (e2) { console.error('search cards failed', e2.code); return { items: [], total: 0, error: 'failed' }; }
  const byId = new Map((cards as unknown as OpportunityCardData[]).map((c) => [c.id, c]));
  return { items: ids.map((id) => byId.get(id)).filter((c): c is OpportunityCardData => Boolean(c)), total }; // keeps the database's ranking order
}

export async function getFeatured(kind: 'job' | 'placement', limit = 3, client?: SupabaseClient): Promise<OpportunityCardData[]> {
  if (!client && !supabaseConfigured()) return [];
  const { data } = await (client ?? createClient()).from('opportunities').select(CARD).eq('status', 'published').eq('kind', kind).or(notExpired())
    .order('featured', { ascending: false }).order('published_at', { ascending: false }).limit(limit);
  return (data ?? []) as unknown as OpportunityCardData[];
}

export async function getSavedIds(userId: string | null, ids: string[]): Promise<Set<string>> {
  if (!userId || ids.length === 0) return new Set();
  const { data } = await createClient().from('saved_opportunities').select('opportunity_id').eq('user_id', userId).in('opportunity_id', ids);
  return new Set((data ?? []).map((r: { opportunity_id: string }) => r.opportunity_id));
}

export type OpportunityDetailData = OpportunityCardData & {
  description: string; responsibilities: string | null; requirements: string | null; qualifications: string | null; benefits: string | null;
  experience_level: string | null; education_level: string | null; compensation_note: string | null; start_date: string | null;
  eligible_courses: string[]; eligible_institutions: string[]; required_documents: string[]; positions_available: number | null;
  application_method: 'direct' | 'external'; external_url: string | null; external_email: string | null; application_instructions: string | null;
  status: string; source: string; source_url: string | null; last_verified_at: string | null; employer_id: string;
  employer: (OpportunityCardData['employer'] & { description: string | null; website: string | null }) | null;
  skills: { skill: { name: string } | null }[];
};
export async function getOpportunity(slug: string, client?: SupabaseClient): Promise<OpportunityDetailData | null> {
  if (!client && !supabaseConfigured()) return null;
  const { data } = await (client ?? createClient()).from('opportunities')
    .select('*, employer:employers(name, slug, logo_url, verification_status, description, website), category:opportunity_categories(name, slug), skills:opportunity_skills(skill:skills(name))')
    .eq('slug', slug).in('status', ['published', 'closed']).maybeSingle();
  return (data as unknown as OpportunityDetailData) ?? null;
}
export async function getSimilar(o: { id: string; kind: string; category: { slug: string } | null }, limit = 3, client?: SupabaseClient) {
  if (!client && !supabaseConfigured()) return [];
  const { data } = await (client ?? createClient()).from('opportunities').select(CARD).eq('status', 'published').eq('kind', o.kind).neq('id', o.id).or(notExpired())
    .order('published_at', { ascending: false }).limit(limit);
  return (data ?? []) as unknown as OpportunityCardData[];
}
