import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { AuthForm } from '@/components/auth-form';
import { updatePassword } from '@/lib/auth/actions';
import { getSession } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } };
export const dynamic = 'force-dynamic';
export default async function UpdatePasswordPage() {
  const session = await getSession();
  if (!session) redirect('/auth/forgot-password');
  return (
    <AuthShell title="Choose a new password" subtitle="You will be signed out everywhere and asked to sign in again with it."
      footer={<Link className="font-semibold text-brand" href="/">Cancel</Link>}>
      <AuthForm action={updatePassword} submitLabel="Update password"
        fields={[{ name: 'password', label: 'New password', type: 'password', autoComplete: 'new-password', hint: 'At least 8 characters.' }, { name: 'confirm', label: 'Confirm new password', type: 'password', autoComplete: 'new-password' }]} />
    </AuthShell>
  );
}
