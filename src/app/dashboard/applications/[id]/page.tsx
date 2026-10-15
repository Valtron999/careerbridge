import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Tag, btn } from '@/components/ui';
import { withdrawApplication } from '@/lib/data/actions';
import { formatDate } from '@/lib/format';
import { formatInZone } from '@/lib/time';

export const metadata: Metadata = { title: 'Application', robots: { index: false } };
const label = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export default async function ApplicationPage({ params, searchParams }: { params: { id: string }; searchParams: { submitted?: string; docs?: string } }) {
  const { userId } = await requireUser(`/dashboard/applications/${params.id}`);
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const s = createClient();
  // RLS limits this to the candidate's own application; another user's id returns nothing.
  const { data: a } = await s.from('applications').select('id, status, submitted_at, opportunity:opportunities(title, slug, kind, employer:employers(name))').eq('id', params.id).eq('candidate_id', userId).maybeSingle();
  if (!a) notFound();
  const { data: docs } = await s.from('application_documents').select('id, doc_type, file_name').eq('application_id', a.id);
  const { data: history } = await s.from('application_status_history').select('id, to_status, note, created_at').eq('application_id', a.id).order('created_at');
  const { data: interviews } = await s.from('interviews').select('id, scheduled_at, timezone, format, details, status').eq('application_id', a.id).neq('status', 'cancelled').order('scheduled_at');
  const o = a.opportunity as unknown as { title: string; employer: { name: string } | null };
  const closed = ['hired', 'rejected', 'withdrawn'].includes(a.status);
  return (
    <div>
      {searchParams.submitted && <p role="status" className="mb-6 rounded-lg bg-ok-tint p-4 font-medium text-ok">Application submitted. The employer has been notified.</p>}
      <h1 className="text-3xl font-bold tracking-tight [overflow-wrap:anywhere]">{o.title}</h1>
      <p className="mt-1 text-ink-muted">{o.employer?.name} · Submitted {formatDate(a.submitted_at)}</p>
      <p className="mt-4">Current status: <Tag>{label(a.status)}</Tag></p>
      {(interviews ?? []).length > 0 && <><h2 className="mt-8 text-xl font-semibold">Interviews</h2><ul className="mt-3 space-y-3">{(interviews ?? []).map((i) => <li key={i.id} className="rounded-xl border border-surface-line p-4"><p className="font-semibold">{formatInZone(i.scheduled_at, i.timezone)}</p><p className="text-sm text-ink-muted">{i.format === 'online' ? 'Online' : 'In person'}{i.details ? ` · ${i.details}` : ''}</p></li>)}</ul></>}
      {(docs ?? []).length > 0 && <><h2 className="mt-8 text-xl font-semibold">Documents you attached</h2><ul className="mt-2 space-y-1 text-sm">{(docs ?? []).map((d) => <li key={d.id}><a className="font-semibold text-brand underline [overflow-wrap:anywhere]" href={`/api/files/application/${d.id}`}>{d.file_name}</a> <span className="text-ink-muted">· {d.doc_type}</span></li>)}</ul></>}
      {searchParams.docs === 'failed' && <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Your application was sent, but we could not attach some documents. Contact the employer to send them.</p>}
      <h2 className="mt-8 text-xl font-semibold">Status history</h2>
      <ol className="mt-3 space-y-3 border-l-2 border-surface-line pl-5">
        {(history ?? []).map((h) => <li key={h.id}><p className="font-medium">{label(h.to_status)}</p><p className="text-sm text-ink-muted">{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(h.created_at))} (WAT){h.note ? ` · ${h.note}` : ''}</p></li>)}
      </ol>
      {!closed && <form action={withdrawApplication} className="mt-8"><input type="hidden" name="application_id" value={a.id} /><button className={btn('secondary')} type="submit">Withdraw application</button></form>}
    </div>
  );
}
