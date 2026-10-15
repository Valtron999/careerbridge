import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BadgeCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { OpportunityCard } from '@/components/opportunity-card';
import { container } from '@/components/ui';
import { isSafeExternalUrl } from '@/lib/validation/safe-url';
import type { OpportunityCardData } from '@/lib/data/opportunities';

async function load(slug: string) {
  if (!supabaseConfigured()) return null;
  const s = createClient();
  const { data: org } = await s.from('employers').select('id, name, slug, industry, description, website, location, public_email, public_phone, verification_status').eq('slug', slug).maybeSingle();
  if (!org) return null;
  const { data: opps } = await s.from('opportunities').select('id, slug, title, kind, work_arrangement, location_city, location_state, location_country, salary_min, salary_max, salary_currency, is_unpaid, deadline, published_at, placement_duration_weeks, employment_type, employer:employers(name, slug, logo_url, verification_status), category:opportunity_categories(name, slug)')
    .eq('employer_id', org.id).eq('status', 'published').or(`deadline.is.null,deadline.gte.${new Date().toISOString()}`).order('published_at', { ascending: false });
  return { org, opps: (opps ?? []) as unknown as OpportunityCardData[] };
}
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const r = await load(params.slug); return r ? { title: r.org.name, description: r.org.description?.slice(0, 155) } : { title: 'Company not found' };
}
export default async function Company({ params }: { params: { slug: string } }) {
  const r = await load(params.slug); if (!r) notFound();
  const { org, opps } = r;
  return (
    <div className={`${container} py-10`}>
      <h1 className="flex flex-wrap items-center gap-3 text-3xl font-bold tracking-tight">{org.name}{org.verification_status === 'verified' && <span className="inline-flex items-center gap-1 text-base font-semibold text-ok"><BadgeCheck size={20} aria-hidden /> Verified by CareerBridge</span>}</h1>
      <p className="mt-2 text-ink-muted">{[org.industry, org.location].filter(Boolean).join(' · ') || 'Details not provided'}</p>
      {org.verification_status !== 'verified' && <p className="mt-2 text-sm text-ink-muted">This organisation has not been verified by CareerBridge. Information below is provided by the employer.</p>}
      {org.description && <p className="mt-6 max-w-[70ch] whitespace-pre-line text-slate-700">{org.description}</p>}
      <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {org.website && isSafeExternalUrl(org.website) && <a className="font-semibold text-brand" rel="noopener noreferrer nofollow" href={org.website}>Website</a>}
        {org.public_email && <a className="font-semibold text-brand [overflow-wrap:anywhere]" href={`mailto:${org.public_email}`}>{org.public_email}</a>}
        {org.public_phone && <span>{org.public_phone}</span>}</p>
      <h2 className="mt-10 text-2xl font-semibold">Open opportunities</h2>
      {opps.length === 0 ? <p className="mt-3 text-ink-muted">No open opportunities right now.</p> : <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{opps.map((o) => <li key={o.id} className="flex"><div className="w-full"><OpportunityCard o={o} saved={false} returnTo={`/companies/${org.slug}`} /></div></li>)}</ul>}
    </div>
  );
}
