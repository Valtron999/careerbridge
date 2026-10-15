import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/form-bits';
import { Tag } from '@/components/ui';
import { ReviewForm } from '@/components/review-form';
import { moderateOpportunity } from '@/lib/admin/actions';
import { formatCompensation, formatDate, formatLocation } from '@/lib/format';

export const metadata: Metadata = { title: 'Listing moderation', robots: { index: false } };
export default async function Moderation() {
  await requireRole(['admin', 'super_admin'], '/admin/opportunities');
  const { data } = await createClient().from('opportunities').select('id, title, kind, description, location_city, location_state, location_country, work_arrangement, salary_min, salary_max, salary_currency, is_unpaid, application_method, external_url, external_email, deadline, updated_at, employer:employers(name, verification_status)').eq('status', 'pending_review').order('updated_at');
  return (<div><h1 className="text-3xl font-bold tracking-tight">Listing moderation</h1>
    <p className="mt-1 text-ink-muted">{(data ?? []).length} awaiting review. Every decision is recorded in the audit log.</p>
    <div className="mt-6 space-y-5">{(data ?? []).length === 0 && <p className="text-ink-muted">The queue is empty.</p>}
      {(data ?? []).map((o) => { const e = o.employer as unknown as { name: string; verification_status: string } | null; return (
        <Card key={o.id}><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold [overflow-wrap:anywhere]">{o.title}</h2><Tag tone="muted">{o.kind}</Tag></div>
          <p className="text-sm text-ink-muted">{e?.name} · {e?.verification_status === 'verified' ? 'verified employer' : 'unverified employer'} · updated {formatDate(o.updated_at)}</p>
          <p className="mt-3 line-clamp-6 whitespace-pre-line text-sm [overflow-wrap:anywhere]">{o.description}</p>
          <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2"><div>Location: {formatLocation(o)}</div><div>Pay: {formatCompensation(o) ?? 'Not specified'}</div><div>Deadline: {formatDate(o.deadline) ?? 'Not specified'}</div>
            <div className="[overflow-wrap:anywhere]">Apply via: {o.application_method === 'direct' ? 'CareerBridge' : [o.external_url, o.external_email].filter(Boolean).join(' / ')}</div></dl>
          <ReviewForm id={o.id} action={moderateOpportunity} decisions={[['approve', 'Approve and publish'], ['request_changes', 'Request changes (back to draft)'], ['reject', 'Reject']]} /></Card>); })}</div></div>);
}
