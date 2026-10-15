import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/action-form';
import { Field, Select } from '@/components/form-bits';
import { btn, field } from '@/components/ui';
import { deleteDocument, uploadDocument } from '@/lib/files/actions';
import { DOC_TYPES, LIMITS, isDocType } from '@/lib/files/validate';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Documents', robots: { index: false } };
export const dynamic = 'force-dynamic';
export default async function Documents({ searchParams }: { searchParams: { error?: string } }) {
  const { userId } = await requireUser('/dashboard/documents');
  const { data } = await createClient().from('candidate_documents').select('id, doc_type, file_name, size_bytes, created_at').eq('user_id', userId).order('created_at', { ascending: false });
  const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
      <p className="mt-1 text-ink-muted">Keep school letters, acceptance letters, logbooks and certificates here, then attach them to applications that ask for them. Only employers you apply to can see the ones you attach.</p>
      {searchParams.error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{searchParams.error === 'in_use' ? 'That document is attached to an application, so it cannot be deleted.' : 'We could not delete that document. Please try again.'}</p>}
      <section className="mt-8 rounded-xl border border-surface-line p-5"><h2 className="mb-4 text-lg font-semibold">Upload a document</h2>
        <ActionForm action={uploadDocument} buttons={[{ label: 'Upload' }]}>
          <Select name="doc_type" label="Type of document" placeholder="Choose a type" options={Object.entries(DOC_TYPES) as [string, string][]} />
          <Field name="file" label="File" hint={`PDF, JPG or PNG, up to ${LIMITS.document / 1024 / 1024} MB. Do not upload documents you would not want an employer to see.`}><input id="file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required className={`${field} py-2.5`} /></Field>
        </ActionForm></section>
      <section className="mt-8"><h2 className="text-lg font-semibold">Your documents</h2>
        {(data ?? []).length === 0 ? <p className="mt-3 text-ink-muted">Nothing uploaded yet.</p> : (
          <ul className="mt-3 divide-y divide-surface-line rounded-xl border border-surface-line">{(data ?? []).map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0"><a className="font-semibold hover:text-brand [overflow-wrap:anywhere]" href={`/api/files/document/${d.id}`}>{d.file_name}</a>
                <p className="text-sm text-ink-muted">{isDocType(d.doc_type) ? DOC_TYPES[d.doc_type] : d.doc_type} · {kb(d.size_bytes ?? 0)} · {formatDate(d.created_at)}</p></div>
              <form action={deleteDocument}><input type="hidden" name="id" value={d.id} /><button className={btn('ghost', '!min-h-[40px] !px-3 text-red-700')} aria-label={`Delete ${d.file_name}`}>Delete</button></form></li>))}</ul>)}</section>
    </div>
  );
}
