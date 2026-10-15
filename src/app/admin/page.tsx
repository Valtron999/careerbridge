import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Stat } from '@/components/workspace-shell';

export const metadata: Metadata = { title: 'Admin', robots: { index: false } };
export default async function AdminHome() {
  await requireRole(['admin', 'super_admin'], '/admin'); // checked again here: layouts are not a security boundary on their own
  const s = createClient(); // runs as the admin user; RLS is_admin() policies grant access
  const n = (t: string, f?: (q: any) => any) => { let q = s.from(t).select('*', { count: 'exact', head: true }); if (f) q = f(q); return q; };
  const [cand, emp, orgs, verified, active, pending, reports] = await Promise.all([
    n('profiles', (q) => q.eq('role', 'candidate')), n('profiles', (q) => q.eq('role', 'employer')), n('employers'), n('employers', (q) => q.eq('verification_status', 'verified')),
    n('opportunities', (q) => q.eq('status', 'published')), n('opportunities', (q) => q.eq('status', 'pending_review')), n('opportunity_reports', (q) => q.eq('status', 'open'))]);
  return (<div><h1 className="text-3xl font-bold tracking-tight">Platform overview</h1>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Stat label="Candidates" value={cand.count ?? 0} /><Stat label="Employer accounts" value={emp.count ?? 0} /><Stat label="Organisations" value={orgs.count ?? 0} /><Stat label="Verified organisations" value={verified.count ?? 0} /><Stat label="Active listings" value={active.count ?? 0} /><Stat label="Awaiting moderation" value={pending.count ?? 0} /><Stat label="Open reports" value={reports.count ?? 0} /></div>
    <p className="mt-6 text-sm text-ink-muted">Moderation, verification review and user management screens are not built yet.</p></div>);
}
