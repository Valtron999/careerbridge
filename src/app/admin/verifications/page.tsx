import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/form-bits';
import { ReviewForm } from '@/components/review-form';
import { reviewVerification } from '@/lib/admin/actions';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Verification requests', robots: { index: false } };
export default async function Verifications() {
  await requireRole(['admin', 'super_admin'], '/admin/verifications');
  const { data } = await createClient().from('employer_verification_requests').select('id, evidence, document_paths, created_at, employer:employers(name, website, location)').eq('status', 'pending').order('created_at');
  return (<div><h1 className="text-3xl font-bold tracking-tight">Verification requests</h1>
    <p className="mt-1 text-ink-muted">Check the evidence yourself. A matching email domain or a live website is not proof on its own.</p>
    <div className="mt-6 space-y-5">{(data ?? []).length === 0 && <p className="text-ink-muted">No pending requests.</p>}
      {(data ?? []).map((r) => { const e = r.employer as unknown as { name: string; website: string | null; location: string | null } | null; const ev = (r.evidence ?? {}) as Record<string, string>; return (
        <Card key={r.id}><h2 className="text-lg font-semibold">{e?.name}</h2><p className="text-sm text-ink-muted">Submitted {formatDate(r.created_at)}{e?.location ? ` · ${e.location}` : ''}</p>
          <dl className="mt-3 space-y-1 text-sm">{Object.entries(ev).map(([k, v]) => <div key={k}><dt className="inline text-ink-muted">{k.replace(/_/g, ' ')}: </dt><dd className="inline [overflow-wrap:anywhere]">{String(v)}</dd></div>)}</dl>
          {(r.document_paths ?? []).length > 0 && <p className="mt-3 text-sm"><span className="text-ink-muted">Uploaded evidence: </span>{(r.document_paths as string[]).map((_, n) => <a key={n} className="mr-3 font-semibold text-brand underline" href={`/api/files/verification/${r.id}?i=${n}`}>File {n + 1}</a>)}</p>}
          <ReviewForm id={r.id} action={reviewVerification} decisions={[['approve', 'Approve: grant verified badge'], ['needs_info', 'Ask for more information'], ['reject', 'Reject']]} /></Card>); })}</div></div>);
}
