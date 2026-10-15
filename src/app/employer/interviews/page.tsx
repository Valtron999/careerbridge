import Link from 'next/link';
import type { Metadata } from 'next';
import { requireOrg } from '@/lib/employer/context';
import { createClient } from '@/lib/supabase/server';
import { Tag } from '@/components/ui';
import { formatInZone } from '@/lib/time';

export const metadata: Metadata = { title: 'Interviews', robots: { index: false } };
export default async function Interviews() {
  const { org } = await requireOrg('/employer/interviews');
  const { data } = await createClient().from('interviews').select('id, scheduled_at, timezone, format, details, status, application:applications!inner(id, candidate:profiles(full_name), opportunity:opportunities!inner(title, employer_id))')
    .eq('application.opportunity.employer_id', org.id).gte('scheduled_at', new Date().toISOString()).neq('status', 'cancelled').order('scheduled_at');
  return (<div><h1 className="text-3xl font-bold tracking-tight">Upcoming interviews</h1>
    {(data ?? []).length === 0 ? <p className="mt-4 text-ink-muted">Nothing scheduled. Schedule interviews from an applicant&apos;s page.</p> : (
      <ul className="mt-6 divide-y divide-surface-line rounded-xl border border-surface-line">{(data ?? []).map((i) => { const ap = i.application as unknown as { id: string; candidate: { full_name: string | null } | null; opportunity: { title: string } }; return (
        <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 p-4"><div className="min-w-0"><p className="font-semibold">{formatInZone(i.scheduled_at, i.timezone)}</p>
          <p className="text-sm text-ink-muted"><Link className="font-medium text-brand" href={`/employer/applicants/${ap.id}`}>{ap.candidate?.full_name ?? 'Candidate'}</Link> · {ap.opportunity.title} · {i.format}</p></div><Tag tone="muted">{i.status}</Tag></li>); })}</ul>)}</div>);
}
