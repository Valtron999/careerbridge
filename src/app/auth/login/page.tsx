import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { AuthForm } from '@/components/auth-form';
import { signIn } from '@/lib/auth/actions';
import { safeNextPath } from '@/lib/validation/safe-url';

export const metadata: Metadata = { title: 'Sign in' };
export default function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string; notice?: string } }) {
  const next = safeNextPath(searchParams.next);
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your applications, CVs and listings."
      footer={<>New to CareerBridge? <Link className="font-semibold text-brand" href="/auth/signup">Create an account</Link></>}>
      {searchParams.notice === 'password-updated' && <p role="status" className="mb-4 rounded-lg bg-ok-tint p-3 text-sm text-ok">Password updated. Sign in with your new password.</p>}
      {searchParams.error === 'verification_failed' && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">That verification link is invalid or has expired. Request a new one by signing up again.</p>}
      <AuthForm action={signIn} submitLabel="Sign in" hidden={{ next }}
        fields={[{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }, { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' }]}>
        <p className="text-sm"><Link className="text-brand" href="/auth/forgot-password">Forgot your password?</Link></p>
      </AuthForm>
    </AuthShell>
  );
}
