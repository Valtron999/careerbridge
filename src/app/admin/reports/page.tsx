import Link from 'next/link';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Tag, btn } from '@/components/ui';
import { resolveReport } from '@/lib/admin/actions';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Reports', robots: { index: false } };
export default async function Reports() {
  await requireRole(['admin', 'super_admin'], '/admin/reports');
  const { data } = await createClient().from('opportunity_reports').select('id, reason, details, status, created_at, opportunity:opportunities(id, title, slug, kind, status)').in('status', ['open', 'reviewing']).order('created_at');
  return (<div><h1 className="text-3xl font-bold tracking-tight">Reported listings</h1>
    {(data ?? []).length === 0 ? <p className="mt-4 text-ink-muted">No open reports.</p> : (
      <ul className="mt-6 space-y-4">{(data ?? []).map((r) => { const o = r.opportunity as unknown as { title: string; slug: string; kind: string; status: string } | null; return (
        <li key={r.id} className="rounded-xl border border-surface-line p-4"><div className="flex flex-wrap items-center gap-2"><Tag tone="warn">{r.reason}</Tag><Tag tone="muted">{r.status}</Tag><span className="text-sm text-ink-muted">{formatDate(r.created_at)}</span></div>
          <p className="mt-2 font-semibold [overflow-wrap:anywhere]">{o ? <Link className="hover:text-brand" href={`/${o.kind === 'placement' ? 'placements' : 'jobs'}/${o.slug}`}>{o.title}</Link> : 'Listing removed'} <span className="text-sm font-normal text-ink-muted">({o?.status})</span></p>
          {r.details && <p className="mt-1 whitespace-pre-line text-sm text-slate-700 [overflow-wrap:anywhere]">{r.details}</p>}
          <div className="mt-3 flex flex-wrap gap-2">{[['reviewing', 'Mark reviewing'], ['actioned', 'Actioned'], ['dismissed', 'Dismiss']].map(([st, l]) => <form key={st} action={resolveReport}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value={st} /><button className={btn('secondary', 'min-h-[40px]')}>{l}</button></form>)}</div></li>); })}</ul>)}</div>);
}
