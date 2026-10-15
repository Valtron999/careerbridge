import type { Metadata } from 'next';
import { requireOrg, canManage } from '@/lib/employer/context';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/action-form';
import { Field, Input, Textarea } from '@/components/form-bits';
import { field } from '@/components/ui';
import { Tag } from '@/components/ui';
import { submitVerification } from '@/lib/employer/actions';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Verification', robots: { index: false } };
export default async function Verification({ searchParams }: { searchParams: { welcome?: string } }) {
  const { org, role } = await requireOrg('/employer/verification');
  const { data: reqs } = await createClient().from('employer_verification_requests').select('id, status, review_note, created_at, reviewed_at').eq('employer_id', org.id).order('created_at', { ascending: false }).limit(5);
  const st = org.verification_status;
  return (
    <div className="max-w-xl">
      {searchParams.welcome && <p role="status" className="mb-6 rounded-lg bg-ok-tint p-4 text-ok">Organisation created. You can post opportunities now; verification is optional but adds a badge candidates can trust.</p>}
      <h1 className="text-3xl font-bold tracking-tight">Verification</h1>
      <p className="mt-2">Status: <Tag tone={st === 'verified' ? 'ok' : st === 'rejected' ? 'warn' : 'muted'}>{st.replace('_', ' ')}</Tag></p>
      <p className="mt-2 text-sm text-ink-muted">A reviewer checks your evidence by hand. A business email domain or a website alone is not treated as proof. The badge is shown only once a reviewer approves.</p>
      {(reqs ?? []).length > 0 && <ul className="mt-5 space-y-2 text-sm">{(reqs ?? []).map((r) => <li key={r.id} className="rounded-lg border border-surface-line p-3"><b>{r.status.replace('_', ' ')}</b> · submitted {formatDate(r.created_at)}{r.review_note && <p className="mt-1 text-ink-muted">Reviewer note: {r.review_note}</p>}</li>)}</ul>}
      {st !== 'verified' && st !== 'pending' && canManage(role) && (
        <div className="mt-8"><h2 className="mb-3 text-lg font-semibold">{st === 'unverified' ? 'Request verification' : 'Submit updated evidence'}</h2>
          <ActionForm action={submitVerification} buttons={[{ label: 'Submit for review' }]}>
            <Input name="website" label="Official website" type="url" required defaultValue={org.website} hint="https:// link to your organisation's own site" />
            <Input name="business_email" label="Business email address" type="email" required hint="An address on your organisation's domain" />
            <Input name="registration_number" label="Registration number (e.g. CAC)" />
            <Textarea name="notes" label="Anything else that helps us confirm you" rows={3} />
            <Field name="evidence_files" label="Supporting documents (optional, up to 3)" hint="PDF, JPG or PNG, up to 4 MB each, for example your CAC certificate. Only you and CareerBridge reviewers can open them."><input id="evidence_files" name="evidence_files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className={`${field} py-2.5`} /></Field>
          </ActionForm></div>)}
      {st === 'pending' && <p className="mt-6 rounded-lg bg-surface-soft p-4 text-sm">Your request is waiting for review.</p>}
    </div>
  );
}
