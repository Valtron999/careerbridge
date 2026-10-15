import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getOpportunity } from '@/lib/data/opportunities';
import { listingState } from '@/lib/format';
import { ApplyForm } from '@/components/apply-form';
import { container } from '@/components/ui';

export const metadata: Metadata = { title: 'Apply', robots: { index: false } };

export default async function ApplyPage({ params }: { params: { slug: string } }) {
  const { userId, profile } = await requireUser(`/apply/${params.slug}`);
  const o = await getOpportunity(params.slug);
  if (!o) notFound();
  if (o.application_method !== 'direct') redirect(`/jobs/${o.slug}`);
  const supabase = createClient();
  const [{ data: questions }, { data: cvs }, { data: existing }, { data: library }] = await Promise.all([
    supabase.from('application_questions').select('id, prompt, type, required, options').eq('opportunity_id', o.id).order('sort_order'),
    supabase.from('candidate_cvs').select('id, title, is_default').eq('user_id', userId).order('is_default', { ascending: false }),
    supabase.from('applications').select('id').eq('opportunity_id', o.id).eq('candidate_id', userId).maybeSingle(),
    supabase.from('candidate_documents').select('id, file_name, doc_type').eq('user_id', userId).order('created_at', { ascending: false }),
  ]);
  if (existing) redirect(`/dashboard/applications/${existing.id}`);
  const state = listingState(o);
  return (
    <div className={`${container} max-w-3xl py-10`}>
      <Link href={`/${o.kind === 'placement' ? 'placements' : 'jobs'}/${o.slug}`} className="text-sm font-medium text-brand">← Back to listing</Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Apply: {o.title}</h1>
      <p className="mt-1 text-ink-muted">{o.employer?.name}</p>
      {profile.role !== 'candidate' ? <p className="mt-6 rounded-lg bg-amber-50 p-4 text-amber-900">Only candidate accounts can apply. Sign in with a candidate account to continue.</p>
        : state !== 'open' ? <p className="mt-6 rounded-lg bg-amber-50 p-4 text-amber-900">This opportunity is no longer accepting applications.</p>
        : <ApplyForm opportunityId={o.id} questions={(questions ?? []) as never} cvs={cvs ?? []} requiredDocs={o.required_documents} library={library ?? []} />}
    </div>
  );
}
