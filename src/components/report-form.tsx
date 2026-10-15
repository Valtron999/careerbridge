'use client';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { reportOpportunity, type ActionState } from '@/lib/data/actions';
import { btn, field } from './ui';

function Send() { const { pending } = useFormStatus(); return <button className={btn('secondary', 'w-full')} disabled={pending} type="submit">{pending ? 'Sending…' : 'Send report'}</button>; }
export function ReportForm({ opportunityId, signedIn, loginNext }: { opportunityId: string; signedIn: boolean; loginNext: string }) {
  const [state, action] = useFormState(reportOpportunity, {} as ActionState);
  return (
    <details className="rounded-xl border border-surface-line p-4 text-sm">
      <summary className="cursor-pointer font-medium">Report this listing</summary>
      {!signedIn ? <p className="mt-3 text-ink-muted"><Link className="font-semibold text-brand" href={`/auth/login?next=${encodeURIComponent(loginNext)}`}>Sign in</Link> to report a suspicious or misleading listing.</p> : (
        <form action={action} className="mt-3 space-y-3">
          <input type="hidden" name="opportunity_id" value={opportunityId} />
          {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
          {state.message && <p role="status" className="text-ok">{state.message}</p>}
          <div><label htmlFor="reason" className="mb-1 block font-medium">Reason</label>
            <select id="reason" name="reason" required className={field} defaultValue=""><option value="" disabled>Choose a reason</option><option value="scam">Looks like a scam</option><option value="misleading">Misleading details</option><option value="discriminatory">Discriminatory</option><option value="duplicate">Duplicate</option><option value="expired">Expired or filled</option><option value="other">Other</option></select></div>
          <div><label htmlFor="details" className="mb-1 block font-medium">Details (optional)</label><textarea id="details" name="details" rows={3} maxLength={2000} className={`${field} py-2`} /></div>
          <Send />
        </form>)}
    </details>
  );
}
