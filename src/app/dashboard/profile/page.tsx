import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { getProfileBundle } from '@/lib/profile/data';
import { profileCompletion } from '@/lib/profile/completion';
import { ProfileForm } from '@/components/profile-form';
import { AvatarUploader } from '@/components/avatar-uploader';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Profile', robots: { index: false } };
export default async function ProfilePage() {
  const { userId } = await requireUser('/dashboard/profile');
  const data = await getProfileBundle(userId);
  const { percent, missing } = profileCompletion(data);
  const { data: me } = await createClient().from('profiles').select('avatar_url').eq('id', userId).maybeSingle();
  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Your profile</h1>
      <p className="mt-1 text-ink-muted">Everything is optional except your name. A fuller profile makes CVs and recommendations more useful.</p>
      <div className="mt-5 rounded-xl bg-surface-soft p-4"><div className="flex items-center justify-between text-sm"><b>Profile {percent}% complete</b></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-line" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion"><div className="h-full bg-ok" style={{ width: `${percent}%` }} /></div>
        {missing.length > 0 && <p className="mt-2 text-sm text-ink-muted">Still to add: {missing.slice(0, 4).join(', ')}{missing.length > 4 ? '…' : ''}.</p>}</div>
      <div className="mt-8"><AvatarUploader url={me?.avatar_url ?? null} name={data.full_name ?? ""} /></div>
      <div className="mt-8"><ProfileForm data={data} sections={['basics', 'student', 'interests']} /></div>
    </div>
  );
}
