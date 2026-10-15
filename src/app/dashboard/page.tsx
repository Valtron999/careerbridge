import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Stat } from '@/components/workspace-shell';
import { ButtonLink } from '@/components/ui';
import { getProfileBundle } from '@/lib/profile/data';
import { profileCompletion } from '@/lib/profile/completion';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false } };
export default async function Overview() {
  const { userId, profile } = await requireUser('/dashboard');
  const s = createClient();
  const count = (t: string, f?: (q: any) => any) => { let q = s.from(t).select('*', { count: 'exact', head: true }); if (f) q = f(q); return q; };
  const [apps, review, interviews, saved, unread, cvs] = await Promise.all([
    count('applications', (q) => q.eq('candidate_id', userId)),
    count('applications', (q) => q.eq('candidate_id', userId).in('status', ['submitted', 'under_review'])),
    count('applications', (q) => q.eq('candidate_id', userId).eq('status', 'interview_scheduled')),
    count('saved_opportunities', (q) => q.eq('user_id', userId)),
    count('notifications', (q) => q.eq('user_id', userId).is('read_at', null)),
    count('candidate_cvs', (q) => q.eq('user_id', userId)),
  ]);
  const bundle = await getProfileBundle(userId);
  const { percent, missing } = profileCompletion(bundle);
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Welcome{profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
      <p className="mt-1 text-ink-muted">Everything below is counted from your own records.</p>
      {!bundle.onboarding_completed && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand-tint p-4"><p className="font-medium">Finish setting up your profile. It takes about two minutes.</p><ButtonLink href="/dashboard/onboarding">Continue setup</ButtonLink></div>}
      <div className="mt-6 rounded-xl border border-surface-line p-5"><div className="flex items-center justify-between"><b>Profile {percent}% complete</b><Link href="/dashboard/profile" className="text-sm font-semibold text-brand">Edit profile</Link></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-line" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion"><div className="h-full bg-ok" style={{ width: `${percent}%` }} /></div>
        {missing.length > 0 && <p className="mt-2 text-sm text-ink-muted">Still to add: {missing.slice(0, 3).join(', ')}{missing.length > 3 ? '…' : ''}.</p>}</div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Applications" value={apps.count ?? 0} /><Stat label="Awaiting review" value={review.count ?? 0} />
        <Stat label="Interviews scheduled" value={interviews.count ?? 0} /><Stat label="Saved opportunities" value={saved.count ?? 0} />
        <Stat label="Unread notifications" value={unread.count ?? 0} /><Stat label="CVs" value={cvs.count ?? 0}  />
      </div>
      {(apps.count ?? 0) === 0 && <div className="mt-8 rounded-xl border-2 border-dashed border-slate-300 p-8 text-center"><p className="font-medium">You have not applied to anything yet.</p><ButtonLink href="/jobs" className="mt-4">Find opportunities</ButtonLink></div>}
      <p className="mt-6 text-sm text-ink-muted"><Link href="/dashboard/applications" className="font-medium text-brand">View all applications</Link></p>
    </div>
  );
}
