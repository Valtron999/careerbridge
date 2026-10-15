import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth-shell';
import { AuthForm } from '@/components/auth-form';
import { signUp } from '@/lib/auth/actions';

export const metadata: Metadata = { title: 'Create your account' };
export default function SignupPage({ searchParams }: { searchParams: { type?: string } }) {
  const employer = searchParams.type === 'employer';
  return (
    <AuthShell title="Create your account" subtitle="Free for job seekers and students."
      footer={<>Already registered? <Link className="font-semibold text-brand" href="/auth/login">Sign in</Link></>}>
      <AuthForm action={signUp} submitLabel="Create account"
        fields={[{ name: 'full_name', label: 'Full name', autoComplete: 'name' }, { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', hint: 'At least 8 characters.' }]}>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">I am signing up as</legend>
          <div className="grid grid-cols-2 gap-2">
            {[['candidate', 'Student or job seeker'], ['employer', 'Employer or organisation']].map(([v, l]) => (
              <label key={v} className="cursor-pointer">
                <input type="radio" name="account_type" value={v} defaultChecked={v === (employer ? 'employer' : 'candidate')} className="peer sr-only" />
                <span className="block rounded-[10px] border border-surface-line p-3 text-center text-sm font-medium peer-checked:border-brand peer-checked:bg-brand-tint peer-checked:text-brand peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-brand">{l}</span>
              </label>))}
          </div>
        </fieldset>
        <p className="text-xs text-ink-muted">By continuing you agree to the <Link className="underline" href="/terms">Terms</Link> and <Link className="underline" href="/privacy">Privacy Policy</Link>.</p>
      </AuthForm>
    </AuthShell>
  );
}
