import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { AuthForm } from '@/components/auth-form';
import { requestPasswordReset } from '@/lib/auth/actions';

export const metadata: Metadata = { title: 'Reset your password' };
export default function ForgotPage() {
  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we'll send a reset link."
      footer={<Link className="font-semibold text-brand" href="/auth/login">Back to sign in</Link>}>
      <AuthForm action={requestPasswordReset} submitLabel="Send reset link" fields={[{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }]} />
    </AuthShell>
  );
}
