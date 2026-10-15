import Link from 'next/link';
import type { Metadata } from 'next';
import { requireOrg } from '@/lib/employer/context';
import { createClient } from '@/lib/supabase/server';
import { Stat } from '@/components/workspace-shell';
import { ButtonLink, Tag } from '@/components/ui';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Employer dashboard', robots: { index: false } };
export default async function EmployerHome() {
  const { org } = await requireOrg('/employer');
  const s = createClient();
  const c = (status?: string) => { let q = s.from('opportunities').select('*', { count: 'exact', head: true }).eq('employer_id', org.id); if (status) q = q.eq('status', status); return q; };
  const app = (status?: string[]) => { let q = s.from('applications').select('id, opportunity:opportunities!inner(employer_id)', { count: 'exact', head: true }).eq('opportunity.employer_id', org.id); if (status) q = q.in('status', status); return q; };
  const [pub, draft, pend, all, review, short, intv, recent] = await Promise.all([c('published'), c('draft'), c('pending_review'), app(), app(['submitted', 'under_review']), app(['shortlisted']), app(['interview_scheduled']),
    s.from('applications').select('id, status, submitted_at, candidate:profiles(full_name), opportunity:opportunities!inner(title, employer_id)').eq('opportunity.employer_id', org.id).order('submitted_at', { ascending: false }).limit(5)]);
  const ver = org.verification_status;
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-bold tracking-tight">{org.name}</h1>
        <p className="mt-1 text-ink-muted">Verification: <Tag tone={ver === 'verified' ? 'ok' : 'muted'}>{ver.replace('_', ' ')}</Tag> {ver !== 'verified' && <Link href="/employer/verification" className="ml-1 text-sm font-semibold text-brand">Manage</Link>}</p></div>
        <ButtonLink href="/employer/opportunities/new">Post an opportunity</ButtonLink></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Published" value={pub.count ?? 0} /><Stat label="Drafts" value={draft.count ?? 0} /><Stat label="Awaiting moderation" value={pend.count ?? 0} /><Stat label="Direct applications" value={all.count ?? 0} />
        <Stat label="Awaiting review" value={review.count ?? 0} /><Stat label="Shortlisted" value={short.count ?? 0} /><Stat label="Interviews scheduled" value={intv.count ?? 0} /></div>
      <h2 className="mt-10 text-xl font-semibold">Latest applications</h2>
      {(recent.data ?? []).length === 0 ? <p className="mt-3 text-ink-muted">No applications yet.</p> : (
        <ul className="mt-3 divide-y divide-surface-line rounded-xl border border-surface-line">{(recent.data ?? []).map((a) => { const o = a.opportunity as unknown as { title: string }; const cand = a.candidate as unknown as { full_name: string | null } | null; return (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-4"><div className="min-w-0"><Link className="font-semibold hover:text-brand [overflow-wrap:anywhere]" href={`/employer/applicants/${a.id}`}>{cand?.full_name ?? 'Candidate'}</Link><p className="text-sm text-ink-muted">{o.title} · {formatDate(a.submitted_at)}</p></div><Tag>{a.status.replace(/_/g, ' ')}</Tag></li>); })}</ul>)}
    </div>
  );
}
