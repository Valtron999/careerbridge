import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { OpportunityCard, NoListings } from '@/components/opportunity-card';
import type { OpportunityCardData } from '@/lib/data/opportunities';

export const metadata: Metadata = { title: 'Saved opportunities', robots: { index: false } };
export default async function Saved() {
  const { userId } = await requireUser('/dashboard/saved');
  const { data } = await createClient().from('saved_opportunities').select('opportunity:opportunities(id, slug, title, kind, work_arrangement, location_city, location_state, location_country, salary_min, salary_max, salary_currency, is_unpaid, deadline, published_at, placement_duration_weeks, employment_type, status, employer:employers(name, slug, logo_url, verification_status), category:opportunity_categories(name, slug))').eq('user_id', userId).order('created_at', { ascending: false });
  const items = (data ?? []).map((r) => r.opportunity as unknown as OpportunityCardData).filter(Boolean);
  return (<div><h1 className="text-3xl font-bold tracking-tight">Saved opportunities</h1>
    <div className="mt-6">{items.length === 0 ? <NoListings /> : <ul className="grid gap-4 sm:grid-cols-2">{items.map((o) => <li key={o.id}><OpportunityCard o={o} saved returnTo="/dashboard/saved" /></li>)}</ul>}</div></div>);
}
