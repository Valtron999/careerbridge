import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { AuthForm } from '@/components/auth-form';
import { updatePassword } from '@/lib/auth/actions';

export const metadata: Metadata = { title: 'Settings', robots: { index: false } };
export default async function Settings() {
  const { profile } = await requireUser('/dashboard/settings');
  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <section className="mt-8"><h2 className="text-xl font-semibold">Account</h2><p className="mt-2 text-ink-muted">Signed in as <b className="text-ink">{profile.email}</b></p></section>
      <section className="mt-8"><h2 className="text-xl font-semibold">Change password</h2><p className="mb-4 mt-1 text-sm text-ink-muted">You will be signed out on all devices and asked to sign in again.</p>
        <AuthForm action={updatePassword} submitLabel="Update password" fields={[{ name: 'password', label: 'New password', type: 'password', autoComplete: 'new-password', hint: 'At least 8 characters.' }, { name: 'confirm', label: 'Confirm new password', type: 'password', autoComplete: 'new-password' }]} /></section>
    </div>
  );
}
