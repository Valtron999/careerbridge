import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Tag } from '@/components/ui';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'My applications', robots: { index: false } };
const label = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export default async function Applications() {
  const { userId } = await requireUser('/dashboard/applications');
  const s = createClient();
  const [{ data: direct }, { data: external }] = await Promise.all([
    s.from('applications').select('id, status, submitted_at, opportunity:opportunities(title, slug, kind, employer:employers(name))').eq('candidate_id', userId).order('submitted_at', { ascending: false }),
    s.from('external_applications').select('id, state, applied_on, created_at, opportunity:opportunities(title, slug, kind, employer:employers(name))').eq('user_id', userId).order('created_at', { ascending: false }),
  ]);
  type Opp = { title: string; slug: string; kind: string; employer: { name: string } | null } | null;
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">My applications</h1>
      <h2 className="mt-8 text-xl font-semibold">Submitted on CareerBridge</h2>
      {(direct ?? []).length === 0 ? <p className="mt-3 text-ink-muted">No direct applications yet.</p> : (
        <ul className="mt-3 divide-y divide-surface-line rounded-xl border border-surface-line">
          {(direct ?? []).map((a) => { const o = a.opportunity as unknown as Opp; return (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0"><Link className="font-semibold hover:text-brand [overflow-wrap:anywhere]" href={`/dashboard/applications/${a.id}`}>{o?.title}</Link><p className="text-sm text-ink-muted">{o?.employer?.name} · Submitted {formatDate(a.submitted_at)}</p></div>
              <Tag tone={a.status === 'rejected' || a.status === 'withdrawn' ? 'muted' : 'brand'}>{label(a.status)}</Tag></li>); })}
        </ul>)}
      <h2 className="mt-10 text-xl font-semibold">Applied outside CareerBridge</h2>
      <p className="mt-1 text-sm text-ink-muted">CareerBridge cannot see these applications. Status shown is what you told us.</p>
      {(external ?? []).length === 0 ? <p className="mt-3 text-ink-muted">Nothing tracked yet.</p> : (
        <ul className="mt-3 divide-y divide-surface-line rounded-xl border border-surface-line">
          {(external ?? []).map((a) => { const o = a.opportunity as unknown as Opp; return (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0"><Link className="font-semibold hover:text-brand [overflow-wrap:anywhere]" href={`/${o?.kind === 'placement' ? 'placements' : 'jobs'}/${o?.slug}`}>{o?.title}</Link><p className="text-sm text-ink-muted">{o?.employer?.name}</p></div>
              {a.state === 'self_reported_applied' ? <Tag tone="ok">Self-reported: applied{a.applied_on ? ` ${formatDate(a.applied_on)}` : ''}</Tag> : <Tag tone="muted">Opened the external link</Tag>}</li>); })}
        </ul>)}
    </div>
  );
}
