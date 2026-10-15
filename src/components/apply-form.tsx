'use client';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { submitApplication, type ActionState } from '@/lib/data/actions';
import { btn, field } from './ui';

type Q = { id: string; prompt: string; type: 'short_text' | 'long_text' | 'single_choice' | 'yes_no' | 'date' | 'number'; required: boolean; options: string[] | null };
function Submit() { const { pending } = useFormStatus(); return <button type="submit" disabled={pending} className={btn('primary')}>{pending ? 'Submitting…' : 'Submit application'}</button>; }

export function ApplyForm({ opportunityId, questions, cvs, requiredDocs, library }: { opportunityId: string; questions: Q[]; cvs: { id: string; title: string; is_default: boolean }[]; requiredDocs: string[]; library: { id: string; file_name: string; doc_type: string }[] }) {
  const [state, action] = useFormState(submitApplication, {} as ActionState);
  return (
    <form action={action} className="mt-8 space-y-6">
      <input type="hidden" name="opportunity_id" value={opportunityId} />
      {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      <section>
        <label htmlFor="cv_id" className="mb-1 block text-sm font-medium">CV</label>
        {cvs.length > 0 ? <select id="cv_id" name="cv_id" defaultValue={cvs.find((c) => c.is_default)?.id ?? cvs[0]?.id} className={field}>{cvs.map((c) => <option key={c.id} value={c.id}>{c.title}{c.is_default ? ' (default)' : ''}</option>)}</select>
          : <p className="text-sm text-ink-muted">You have no saved CV yet. You can submit without one, or <Link className="font-semibold text-brand" href="/cv-builder">build a CV</Link> first. A snapshot of the CV you choose is stored with your application.</p>}
      </section>
      {requiredDocs.length > 0 && (
        <section className="space-y-3 rounded-xl bg-surface-soft p-4"><h2 className="font-semibold">Documents the employer asks for</h2>
          {library.length === 0 && <p className="text-sm text-ink-muted">You have not uploaded any documents yet. <Link className="font-semibold text-brand" href="/dashboard/documents">Upload them first</Link>, or choose &quot;I will send this directly&quot; below.</p>}
          {requiredDocs.map((label, i) => (
            <div key={label}><input type="hidden" name={`doc_label_${i}`} value={label} /><label htmlFor={`doc_${i}`} className="mb-1 block text-sm font-medium">{label}</label>
              <select id={`doc_${i}`} name={`doc_${i}`} defaultValue="later" className={field}><option value="later">I will send this directly to the employer</option>{library.map((d) => <option key={d.id} value={d.id}>{d.file_name}</option>)}</select></div>))}
          <p className="text-xs text-ink-muted">Attached files are visible only to this employer&apos;s recruitment team.</p></section>)}
      {questions.map((q) => (
        <div key={q.id}>
          <label htmlFor={`q_${q.id}`} className="mb-1 block text-sm font-medium">{q.prompt}{q.required ? <span aria-hidden> *</span> : <span className="text-ink-muted"> (optional)</span>}</label>
          {q.type === 'long_text' ? <textarea id={`q_${q.id}`} name={`q_${q.id}`} rows={4} maxLength={5000} required={q.required} className={`${field} py-2`} />
            : q.type === 'yes_no' ? <select id={`q_${q.id}`} name={`q_${q.id}`} required={q.required} defaultValue="" className={field}><option value="" disabled>Select</option><option>Yes</option><option>No</option></select>
            : q.type === 'single_choice' ? <select id={`q_${q.id}`} name={`q_${q.id}`} required={q.required} defaultValue="" className={field}><option value="" disabled>Select</option>{(q.options ?? []).map((o) => <option key={o}>{o}</option>)}</select>
            : <input id={`q_${q.id}`} name={`q_${q.id}`} type={q.type === 'date' ? 'date' : q.type === 'number' ? 'number' : 'text'} maxLength={500} required={q.required} className={field} />}
        </div>))}
      <div className="flex items-center gap-4"><Submit /><Link href="/dashboard" className="text-sm font-medium text-ink-muted">Cancel</Link></div>
    </form>
  );
}
