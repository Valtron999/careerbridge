import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireOrg, canRecruit } from '@/lib/employer/context';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/action-form';
import { Card, Input, Select, Textarea } from '@/components/form-bits';
import { Tag, btn } from '@/components/ui';
import { changeApplicationStatus, addNote, scheduleInterview, cancelInterview } from '@/lib/employer/actions';
import { formatDate } from '@/lib/format';
import { formatInZone, INTERVIEW_ZONES } from '@/lib/time';

export const metadata: Metadata = { title: 'Applicant', robots: { index: false } };
const label = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const fmt = (iso: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(iso)) + ' WAT';

/** Renders a CV snapshot of unknown shape as plain text only (never as HTML). */
function CvSnapshot({ data }: { data: unknown }) {
  if (!data || typeof data !== 'object' || Object.keys(data as object).length === 0) return <p className="text-sm text-ink-muted">No CV was attached to this application.</p>;
  const render = (v: unknown): React.ReactNode => Array.isArray(v) ? <ul className="list-disc pl-5">{v.map((x, i) => <li key={i}>{render(x)}</li>)}</ul>
    : v && typeof v === 'object' ? <dl className="space-y-1">{Object.entries(v).map(([k, x]) => <div key={k}><dt className="text-xs uppercase text-ink-muted">{k.replace(/_/g, ' ')}</dt><dd>{render(x)}</dd></div>)}</dl> : <span className="whitespace-pre-line [overflow-wrap:anywhere]">{String(v ?? '')}</span>;
  return <div className="text-sm">{render(data)}</div>;
}

export default async function Applicant({ params }: { params: { id: string } }) {
  const { org, role } = await requireOrg(`/employer/applicants/${params.id}`);
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const s = createClient();
  const { data: a } = await s.from('applications').select('id, status, submitted_at, candidate_id, cv_snapshot, opportunity:opportunities!inner(id, title, employer_id)').eq('id', params.id).eq('opportunity.employer_id', org.id).maybeSingle();
  if (!a) notFound();
  const opp = a.opportunity as unknown as { id: string; title: string };
  const [{ data: cand }, { data: cp }, { data: sp }, { data: answers }, { data: history }, { data: notes }, { data: interviews }, { data: docs }] = await Promise.all([
    s.from('profiles').select('full_name, email, phone').eq('id', a.candidate_id).maybeSingle(),
    s.from('candidate_profiles').select('headline, summary, location, skills').eq('user_id', a.candidate_id).maybeSingle(),
    s.from('student_profiles').select('institution, course, academic_level, expected_graduation, required_duration_weeks').eq('user_id', a.candidate_id).maybeSingle(),
    s.from('application_answers').select('answer, question:application_questions(prompt)').eq('application_id', a.id),
    s.from('application_status_history').select('id, to_status, note, created_at').eq('application_id', a.id).order('created_at'),
    s.from('application_notes').select('id, note, created_at').eq('application_id', a.id).order('created_at', { ascending: false }),
    s.from('interviews').select('id, scheduled_at, timezone, format, details, status').eq('application_id', a.id).order('scheduled_at'),
    s.from('application_documents').select('id, doc_type, file_name').eq('application_id', a.id)]);
  const closed = ['hired', 'rejected', 'withdrawn'].includes(a.status);
  const rec = canRecruit(role);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <div><Link href={`/employer/opportunities/${opp.id}/applicants`} className="text-sm font-medium text-brand">← All applicants</Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{cand?.full_name ?? 'Candidate'}</h1>
          <p className="text-ink-muted">Applied for {opp.title} · {formatDate(a.submitted_at)} · <Tag>{label(a.status)}</Tag></p></div>
        <Card title="Candidate"><dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-muted">Email</dt><dd className="[overflow-wrap:anywhere]">{cand?.email ?? 'Not provided'}</dd></div>
          <div><dt className="text-ink-muted">Phone</dt><dd>{cand?.phone ?? 'Not provided'}</dd></div>
          {cp?.headline && <div className="sm:col-span-2"><dt className="text-ink-muted">Headline</dt><dd>{cp.headline}</dd></div>}
          {cp?.location && <div><dt className="text-ink-muted">Location</dt><dd>{cp.location}</dd></div>}
          {sp?.institution && <div><dt className="text-ink-muted">Institution</dt><dd>{sp.institution}</dd></div>}
          {sp?.course && <div><dt className="text-ink-muted">Course</dt><dd>{sp.course}{sp.academic_level ? `, ${sp.academic_level}` : ''}</dd></div>}
          {sp?.required_duration_weeks && <div><dt className="text-ink-muted">Placement duration needed</dt><dd>{sp.required_duration_weeks} weeks</dd></div>}
          {(cp?.skills ?? []).length > 0 && <div className="sm:col-span-2"><dt className="text-ink-muted">Skills</dt><dd>{(cp?.skills ?? []).join(', ')}</dd></div>}
        </dl></Card>
        <Card title="Answers">{(answers ?? []).length === 0 ? <p className="text-sm text-ink-muted">No answers were required or given.</p> : <dl className="space-y-4">{(answers ?? []).map((x, i) => <div key={i}><dt className="text-sm font-medium">{(x.question as unknown as { prompt: string } | null)?.prompt}</dt><dd className="mt-1 whitespace-pre-line text-slate-700 [overflow-wrap:anywhere]">{x.answer}</dd></div>)}</dl>}</Card>
        <Card title="Documents">{(docs ?? []).length === 0 ? <p className="text-sm text-ink-muted">No documents were attached.</p> : <ul className="space-y-2 text-sm">{(docs ?? []).map((d) => <li key={d.id}><a className="font-semibold text-brand underline [overflow-wrap:anywhere]" href={`/api/files/application/${d.id}`}>{d.file_name}</a> <span className="text-ink-muted">· {d.doc_type}</span></li>)}</ul>}</Card>
        <Card title="CV (snapshot at submission)"><CvSnapshot data={a.cv_snapshot} /></Card>
        <Card title="Status history"><ol className="space-y-2 text-sm">{(history ?? []).map((h) => <li key={h.id}><b>{label(h.to_status)}</b> <span className="text-ink-muted">· {fmt(h.created_at)}{h.note ? ` · ${h.note}` : ''}</span></li>)}</ol></Card>
      </div>
      <aside className="space-y-6">
        {rec && !closed && <Card title="Update status"><ActionForm action={changeApplicationStatus} buttons={[{ label: 'Update status' }]}>
          <input type="hidden" name="application_id" value={a.id} />
          <Select name="status" label="New status" defaultValue="" placeholder="Choose…" options={[['under_review', 'Under review'], ['shortlisted', 'Shortlisted'], ['assessment', 'Assessment'], ['offer', 'Offer'], ['hired', 'Hired / placement confirmed'], ['rejected', 'Rejected']]} />
          <Textarea name="note" label="Note to include in history (optional)" rows={2} hint="Visible in the history shown to you; the candidate sees only the new status." />
        </ActionForm></Card>}
        {rec && !closed && <Card title="Schedule interview"><ActionForm action={scheduleInterview} buttons={[{ label: 'Schedule and notify' }]}>
          <input type="hidden" name="application_id" value={a.id} />
          <Input name="when" label="Date and time" type="datetime-local" required />
          <Select name="tz" label="Time zone" defaultValue="Africa/Lagos" options={INTERVIEW_ZONES.map((z) => [z, z])} />
          <Select name="format" label="Format" defaultValue="online" options={[['online', 'Online'], ['physical', 'Physical']]} />
          <Textarea name="details" label="Meeting link or address" rows={2} />
        </ActionForm></Card>}
        {(interviews ?? []).length > 0 && <Card title="Interviews"><ul className="space-y-3 text-sm">{(interviews ?? []).map((i) => <li key={i.id}><p className="font-medium">{formatInZone(i.scheduled_at, i.timezone)}</p><p className="text-ink-muted">{i.format} · {i.status}{i.details ? ` · ${i.details}` : ''}</p>
          {rec && i.status !== 'cancelled' && <form action={cancelInterview} className="mt-1"><input type="hidden" name="interview_id" value={i.id} /><button className={btn('ghost', 'min-h-[36px] px-2 text-sm')}>Cancel interview</button></form>}</li>)}</ul></Card>}
        <Card title="Internal notes"><p className="mb-3 text-xs text-ink-muted">Only your team can see these.</p>
          {rec && <ActionForm action={addNote} buttons={[{ label: 'Add note', variant: 'secondary' }]}><input type="hidden" name="application_id" value={a.id} /><Textarea name="note" label="Note" rows={3} /></ActionForm>}
          <ul className="mt-4 space-y-3 text-sm">{(notes ?? []).map((n) => <li key={n.id} className="rounded-lg bg-surface-soft p-3"><p className="whitespace-pre-line [overflow-wrap:anywhere]">{n.note}</p><p className="mt-1 text-xs text-ink-muted">{fmt(n.created_at)}</p></li>)}</ul></Card>
      </aside>
    </div>
  );
}
