import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { ButtonLink, container } from '@/components/ui';
import { getSession } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'For employers', description: 'Publish internships, SIWES placements and jobs, receive applications and manage candidates on CareerBridge.' };
const h2 = 'text-[clamp(1.6rem,3.2vw,2.2rem)] font-semibold leading-tight tracking-tight';
const FEATURES: [string, string][] = [
  ['Publish jobs and placements', 'List SIWES and industrial training, internships, SWEP, graduate programmes and regular jobs from one editor.'],
  ['Choose how people apply', 'Receive applications on CareerBridge with your own questions, or send applicants to your website or an email address.'],
  ['Review applicants in one place', 'See each applicant\u2019s CV, answers and attached documents, and follow every application through its stages.'],
  ['Shortlist and schedule interviews', 'Update statuses (candidates are notified), schedule online or in-person interviews with the time zone, and keep internal notes that candidates never see.'],
  ['Get verified', 'Submit evidence about your organisation. A Verified badge appears only after our team has reviewed it.'],
  ['Reviewed before going live', 'New listings are checked by our team before they are published, which helps students trust what they see.'],
];

export default async function EmployersPage() {
  const session = await getSession();
  const isEmployer = session?.profile.role === 'employer';
  const signedInOther = session && !isEmployer;
  return (
    <>
      <section className={`${container} py-12 lg:py-16`}>
        <p className="mb-3 inline-block rounded-full bg-brand-tint px-3 py-1 text-sm font-semibold text-brand">For employers and organisations</p>
        <h1 className="max-w-[20ch] text-[clamp(2rem,5.5vw,3.4rem)] font-bold leading-[1.08] tracking-tight [text-wrap:balance]">Hire interns, SIWES students and graduates.</h1>
        <p className="mt-5 max-w-[58ch] text-lg text-ink-muted">Publish opportunities, receive applications, and manage candidates in one organised workspace. CareerBridge is built around students looking for their first placement or internship.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          {isEmployer ? <ButtonLink href="/employer">Open employer dashboard</ButtonLink> : <>
            <ButtonLink href="/auth/signup?type=employer">Create employer account</ButtonLink>
            <ButtonLink href="/auth/login?type=employer" variant="secondary">Employer sign in</ButtonLink></>}
        </div>
        {signedInOther && <p role="note" className="mt-5 max-w-[62ch] rounded-xl bg-amber-50 p-4 text-sm text-amber-900">You are signed in with a student or job seeker account. Employer tools need an employer account, so create one with a work email address (an email can only have one account type).</p>}
      </section>

      <section aria-labelledby="can-h" className="border-y border-surface-line bg-surface-soft py-14"><div className={container}>
        <h2 id="can-h" className={h2}>What you can do</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{FEATURES.map(([t, d]) => (
          <li key={t} className="rounded-2xl border border-surface-line bg-white p-6"><h3 className="flex gap-2 font-semibold"><Check size={20} className="mt-0.5 shrink-0 text-ok" aria-hidden />{t}</h3><p className="mt-2 text-[15px] text-ink-muted">{d}</p></li>))}</ul>
      </div></section>

      <section aria-labelledby="start-h" className={`${container} py-14`}>
        <h2 id="start-h" className={h2}>How to get started</h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">{[
          ['Create your account', 'Sign up as an employer and confirm your email address.'],
          ['Add your organisation', 'Enter your organisation\u2019s details. You can request verification at any time.'],
          ['Post your first listing', 'Write it, preview it and submit it. Once reviewed, it goes live for students and job seekers.'],
        ].map(([t, d], i) => <li key={t} className="rounded-2xl border border-surface-line p-6"><span className="mb-3.5 grid h-9 w-9 place-items-center rounded-full bg-brand font-bold text-white">{i + 1}</span><h3 className="font-semibold">{t}</h3><p className="mt-1.5 text-ink-muted">{d}</p></li>)}</ol>
        <p className="mt-6 max-w-[70ch] text-sm text-ink-muted">Not available yet: team accounts, paid plans and recruitment analytics. CareerBridge cannot guarantee that candidates will apply or accept an offer.</p>
        {!isEmployer && <div className="mt-8 flex flex-wrap gap-3"><ButtonLink href="/auth/signup?type=employer">Create employer account</ButtonLink><Link href="/auth/login?type=employer" className="inline-flex min-h-[46px] items-center font-semibold text-brand hover:underline">Already have an account? Sign in</Link></div>}
      </section>
    </>
  );
}
