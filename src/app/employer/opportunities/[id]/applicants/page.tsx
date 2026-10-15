import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireOrg } from '@/lib/employer/context';
import { createClient } from '@/lib/supabase/server';
import { Tag, btn, field } from '@/components/ui';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Applicants', robots: { index: false } };
const STATUSES = ['submitted', 'under_review', 'shortlisted', 'interview_scheduled', 'assessment', 'offer', 'hired', 'rejected', 'withdrawn'];
export default async function Applicants({ params, searchParams }: { params: { id: string }; searchParams: { status?: string; q?: string; sort?: string } }) {
  const { org } = await requireOrg(`/employer/opportunities/${params.id}/applicants`);
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const s = createClient();
  const { data: o } = await s.from('opportunities').select('id, title').eq('id', params.id).eq('employer_id', org.id).maybeSingle();
  if (!o) notFound();
  let q = s.from('applications').select('id, status, submitted_at, candidate:profiles(full_name, email)').eq('opportunity_id', o.id);
  if (searchParams.status && STATUSES.includes(searchParams.status)) q = q.eq('status', searchParams.status);
  q = q.order('submitted_at', { ascending: searchParams.sort === 'oldest' });
  const { data } = await q;
  const term = (searchParams.q ?? '').trim().toLowerCase();
  const rows = (data ?? []).filter((a) => { const c = a.candidate as unknown as { full_name: string | null; email: string | null } | null; return !term || `${c?.full_name ?? ''} ${c?.email ?? ''}`.toLowerCase().includes(term); });
  return (
    <div>
      <Link href="/employer/opportunities" className="text-sm font-medium text-brand">← Opportunities</Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight [overflow-wrap:anywhere]">Applicants: {o.title}</h1>
      <form method="get" className="mt-5 grid gap-3 sm:grid-cols-[1fr_200px_160px_auto]">
        <input name="q" defaultValue={searchParams.q} placeholder="Search name or email" aria-label="Search applicants" className={field} />
        <select name="status" defaultValue={searchParams.status ?? ''} aria-label="Filter by status" className={field}><option value="">All statuses</option>{STATUSES.map((st) => <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>)}</select>
        <select name="sort" defaultValue={searchParams.sort ?? 'newest'} aria-label="Sort" className={field}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
        <button className={btn('secondary')}>Filter</button>
      </form>
      {rows.length === 0 ? <p className="mt-6 text-ink-muted">No applicants match.</p> : (
        <ul className="mt-6 divide-y divide-surface-line rounded-xl border border-surface-line">{rows.map((a) => { const c = a.candidate as unknown as { full_name: string | null; email: string | null } | null; return (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-4"><div className="min-w-0"><Link href={`/employer/applicants/${a.id}`} className="font-semibold hover:text-brand [overflow-wrap:anywhere]">{c?.full_name ?? 'Candidate'}</Link><p className="text-sm text-ink-muted">{c?.email} · {formatDate(a.submitted_at)}</p></div><Tag>{a.status.replace(/_/g, ' ')}</Tag></li>); })}</ul>)}
    </div>
  );
}
