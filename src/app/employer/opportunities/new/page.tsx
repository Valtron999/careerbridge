import type { Metadata } from 'next';
import { requireOrg, canRecruit } from '@/lib/employer/context';
import { createClient } from '@/lib/supabase/server';
import { OpportunityForm } from '@/components/opportunity-form';

export const metadata: Metadata = { title: 'New opportunity', robots: { index: false } };
export default async function NewOpportunity() {
  const { role } = await requireOrg('/employer/opportunities/new');
  if (!canRecruit(role)) return <p className="text-ink-muted">Your role is read-only.</p>;
  const { data: cats } = await createClient().from('opportunity_categories').select('id, name, kind').eq('is_active', true).order('sort_order');
  return (<div className="max-w-3xl"><h1 className="text-3xl font-bold tracking-tight">New opportunity</h1>
    <p className="mt-2 text-ink-muted">Save a draft any time. Listings are reviewed by a moderator before they appear publicly. Fields you leave empty are shown as &quot;Not specified&quot; or omitted.</p>
    <div className="mt-6"><OpportunityForm categories={cats ?? []} skills={[]} questions="" locked={false} /></div></div>);
}
