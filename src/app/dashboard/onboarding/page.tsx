import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { getProfileBundle } from '@/lib/profile/data';
import { ProfileForm } from '@/components/profile-form';

export const metadata: Metadata = { title: 'Set up your profile', robots: { index: false } };
export const dynamic = 'force-dynamic';
const TITLES = ['About you', 'Your studies', 'Skills and preferences'];

export default async function Onboarding({ searchParams }: { searchParams: { step?: string } }) {
  const { userId } = await requireUser('/dashboard/onboarding');
  const data = await getProfileBundle(userId);
  const isStudent = Boolean(data.is_student);
  // Students get three steps; everyone else skips the studies step. Progress is saved after every step, so leaving and returning is safe.
  const steps = isStudent ? [1, 2, 3] : [1, 3];
  const requested = Number(searchParams.step ?? 1);
  const step = steps.includes(requested) ? requested : 1;
  const idx = steps.indexOf(step);
  const nextStep = steps[idx + 1];
  const prevStep = steps[idx - 1];
  const next = nextStep ? `/dashboard/onboarding?step=${nextStep}` : '/dashboard?welcome=1';
  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm font-medium text-brand">Step {idx + 1} of {steps.length}</p>
      <div className="mt-2 flex gap-1.5" aria-hidden>{steps.map((s, i) => <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= idx ? 'bg-brand' : 'bg-surface-line'}`} />)}</div>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">{TITLES[step - 1]}</h1>
      <p className="mt-1 text-ink-muted">Everything except your name is optional. You can change any of it later.</p>
      <div className="mt-8">
        {step === 1 && <ProfileForm data={data} sections={['basics']} next={next} submitLabel="Save and continue" skipHref={next} />}
        {step === 2 && <ProfileForm data={data} sections={['student']} next={next} submitLabel="Save and continue" skipHref={next} backHref="/dashboard/onboarding?step=1" />}
        {step === 3 && <ProfileForm data={data} sections={['interests']} next={next} finish submitLabel="Finish" skipHref={next} backHref={prevStep ? `/dashboard/onboarding?step=${prevStep}` : undefined} />}
      </div>
      <p className="mt-8 text-sm text-ink-muted"><Link href="/dashboard" className="underline">Do this later</Link>. We will remind you on your dashboard.</p>
    </div>
  );
}
