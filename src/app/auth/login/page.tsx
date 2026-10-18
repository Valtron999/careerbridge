import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { AuthForm } from '@/components/auth-form';
import { signIn } from '@/lib/auth/actions';
import { safeNextPath } from '@/lib/validation/safe-url';

export const metadata: Metadata = { title: 'Sign in' };
type Audience = 'candidate' | 'employer' | 'admin';

export default function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string; notice?: string; type?: string } }) {
  const requested = safeNextPath(searchParams.next, '');
  const audience: Audience = requested.startsWith('/admin') ? 'admin' : searchParams.type === 'employer' || requested.startsWith('/employer') ? 'employer' : 'candidate';
  const next = requested || (audience === 'employer' ? '/employer' : '/dashboard');
  const copy = {
    candidate: { title: 'Welcome back', sub: 'Sign in to manage your applications, CVs and letters.' },
    employer: { title: 'Employer sign in', sub: 'Manage your organisation, listings, applicants and interviews.' },
    admin: { title: 'Admin sign in', sub: 'For CareerBridge staff. Access is checked on the server for every page.' },
  }[audience];
  const footer = audience === 'employer'
    ? <>New organisation? <Link className="font-semibold text-brand" href="/auth/signup?type=employer">Create an employer account</Link><br />Looking for a job or placement? <Link className="font-semibold text-brand" href="/auth/login">Student and job seeker sign in</Link></>
    : audience === 'admin' ? null
    : <>New to CareerBridge? <Link className="font-semibold text-brand" href="/auth/signup">Create an account</Link><br />Hiring? <Link className="font-semibold text-brand" href="/auth/login?type=employer">Employer sign in</Link></>;
  return (
    <AuthShell title={copy.title} subtitle={copy.sub} footer={footer}>
      {searchParams.notice === 'password-updated' && <p role="status" className="mb-4 rounded-lg bg-ok-tint p-3 text-sm text-ok">Password updated. Sign in with your new password.</p>}
      {searchParams.error === 'verification_failed' && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">That verification link is invalid or has expired. Request a new one by signing up again.</p>}
      <AuthForm action={signIn} submitLabel="Sign in" hidden={{ next }}
        fields={[{ name: 'email', label: audience === 'employer' ? 'Work email' : 'Email', type: 'email', autoComplete: 'email' }, { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' }]}>
        <p className="text-sm"><Link className="text-brand" href="/auth/forgot-password">Forgot your password?</Link></p>
      </AuthForm>
    </AuthShell>
  );
}
