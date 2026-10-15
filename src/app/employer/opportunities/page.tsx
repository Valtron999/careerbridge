import Link from 'next/link';
import type { Metadata } from 'next';
import { requireOrg } from '@/lib/employer/context';
import { createClient } from '@/lib/supabase/server';
import { ButtonLink, Tag, btn } from '@/components/ui';
import { setOpportunityStatus } from '@/lib/employer/actions';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Opportunities', robots: { index: false } };
const TONE: Record<string, 'ok' | 'brand' | 'warn' | 'muted'> = { published: 'ok', pending_review: 'brand', rejected: 'warn', draft: 'muted', paused: 'muted', closed: 'muted', archived: 'muted' };
const ACTIONS: Record<string, [string, string][]> = {
  draft: [['submit', 'Submit for review'], ['archive', 'Archive']], rejected: [['submit', 'Resubmit'], ['archive', 'Archive']],
  published: [['pause', 'Pause'], ['close', 'Close']], paused: [['resume', 'Resume'], ['close', 'Close']], closed: [['archive', 'Archive']],
};

export default async function Opportunities({ searchParams }: { searchParams: { saved?: string; submitted?: string; archived?: string } }) {
  const { org } = await requireOrg('/employer/opportunities');
  const s = createClient();
  const { data } = await s.from('opportunities').select('id, slug, title, kind, status, deadline, moderation_note, published_at, updated_at').eq('employer_id', org.id).neq('status', 'archived').order('updated_at', { ascending: false });
  const { data: counts } = await s.from('applications').select('opportunity_id, opportunity:opportunities!inner(employer_id)').eq('opportunity.employer_id', org.id);
  const byOpp = new Map<string, number>(); (counts ?? []).forEach((c: { opportunity_id: string }) => byOpp.set(c.opportunity_id, (byOpp.get(c.opportunity_id) ?? 0) + 1));
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold tracking-tight">Opportunities</h1><ButtonLink href="/employer/opportunities/new">New opportunity</ButtonLink></div>
      {searchParams.saved && <p role="status" className="mt-4 rounded-lg bg-ok-tint p-3 text-sm text-ok">Saved.</p>}
      {searchParams.submitted && <p role="status" className="mt-4 rounded-lg bg-ok-tint p-3 text-sm text-ok">Submitted for review. It goes live once a moderator approves it.</p>}
      {(data ?? []).length === 0 ? <div className="mt-6 rounded-xl border-2 border-dashed border-slate-300 p-10 text-center"><p className="font-medium">You have not created any opportunities yet.</p><ButtonLink href="/employer/opportunities/new" className="mt-4">Create your first listing</ButtonLink></div> : (
        <ul className="mt-6 divide-y divide-surface-line rounded-xl border border-surface-line">{(data ?? []).map((o) => (
          <li key={o.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><Link href={`/employer/opportunities/${o.id}/edit`} className="font-semibold hover:text-brand [overflow-wrap:anywhere]">{o.title}</Link>
              <p className="text-sm text-ink-muted">{o.kind === 'placement' ? 'Placement' : 'Job'} · Updated {formatDate(o.updated_at)}{o.deadline ? ` · Deadline ${formatDate(o.deadline)}` : ''}</p></div>
              <Tag tone={TONE[o.status] ?? 'muted'}>{o.status.replace('_', ' ')}</Tag></div>
            {o.moderation_note && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Moderator note: {o.moderation_note}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Link className={btn('secondary', 'min-h-[40px]')} href={`/employer/opportunities/${o.id}/edit`}>Edit</Link>
              <Link className={btn('secondary', 'min-h-[40px]')} href={`/employer/opportunities/${o.id}/applicants`}>Applicants ({byOpp.get(o.id) ?? 0})</Link>
              {o.status === 'published' && <Link className={btn('ghost', 'min-h-[40px]')} href={`/${o.kind === 'placement' ? 'placements' : 'jobs'}/${o.slug}`}>View public page</Link>}
              {(ACTIONS[o.status] ?? []).map(([a, l]) => (<form key={a} action={setOpportunityStatus}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="action" value={a} /><button className={btn('ghost', 'min-h-[40px]')}>{l}</button></form>))}
            </div></li>))}</ul>)}
    </div>
  );
}
