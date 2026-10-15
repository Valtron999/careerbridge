import Image from 'next/image';
import Link from 'next/link';
import { GraduationCap, Users, Briefcase, Flag, Check, ShieldCheck, Search, MapPin } from 'lucide-react';
import { ButtonLink, btn, container, field } from '@/components/ui';
import { OpportunityCard } from '@/components/opportunity-card';
import { getFeatured, getSavedIds } from '@/lib/data/opportunities';
import { getSession } from '@/lib/auth/session';
import { brand } from '@/lib/config/brand';

const chips: [string, string][] = [['Jobs', '/jobs?type=job'], ['Internships', '/jobs?type=internship'], ['SIWES & IT', '/placements?category=siwes'], ['SWEP', '/placements?category=swep'], ['Graduate Programmes', '/jobs?type=graduate'], ['Remote Opportunities', '/jobs?arrangement=remote']];
const faqs = [
  ['What is CareerBridge?', 'A platform where people find jobs, internships and student placements, build CVs and apply, and where employers publish opportunities and manage applicants.'],
  ['Can students find SIWES and SWEP placements?', 'Yes. Employers can list SIWES, IT, SWEP and similar placements with eligible courses, duration and stipend details. Requirements vary by school and organisation.'],
  ['Can I use CareerBridge if I have no work experience?', 'Yes. Placements and entry-level roles are listed for students, and the CV builder (coming soon) puts education, projects and skills first.'],
  ['Can I apply for jobs outside Nigeria?', 'You can search any location. Whether you are eligible is decided by each employer, so check the listing requirements.'],
  ['How do applications work?', 'For direct applications you submit your CV and answers on CareerBridge, then follow the status. Employers update it as they review.'],
  ['What happens when an employer uses an external application link?', 'We tell you before you leave. The employer controls that process, so CareerBridge cannot confirm submission. You can log it as applied yourself, shown as self-reported.'],
  ['Is CareerBridge free for job seekers?', 'Searching and applying are intended to be free for candidates. Any optional paid tools will be shown clearly beforehand.'],
  ['How can an organisation publish an opportunity?', 'Create an employer account, add your organisation details and post a listing. Listings may be reviewed before they go live.'],
];
const h2 = 'text-[clamp(1.65rem,3.4vw,2.35rem)] font-semibold leading-tight tracking-tight';

export default async function Home() {
  const [session, jobs, placements] = await Promise.all([getSession(), getFeatured('job', 3), getFeatured('placement', 3)]);
  const featured = [...jobs, ...placements].slice(0, 6);
  const saved = await getSavedIds(session?.userId ?? null, featured.map((f) => f.id));
  return (
    <>
      <section className={`${container} grid items-center gap-10 py-10 lg:grid-cols-[1.1fr_.9fr] lg:py-14`}>
        <div>
          <h1 className="rise text-[clamp(2.1rem,6.2vw,3.8rem)] font-bold leading-[1.08] tracking-tight [text-wrap:balance]">{brand.tagline}</h1>
          <p className="rise mt-5 max-w-[56ch] text-lg text-ink-muted" style={{ '--i': 1 } as React.CSSProperties}>Discover jobs, internships, and student placements. Build your CV, apply with confidence, and take the next step in your career.</p>
          <form action="/jobs" method="get" role="search" aria-label="Search opportunities" className="rise mt-7 rounded-2xl border border-surface-line bg-white p-3 shadow-[0_8px_30px_rgba(21,34,56,.07)]" style={{ '--i': 2 } as React.CSSProperties}>
            <div role="radiogroup" aria-label="Opportunity type" className="mb-3 flex flex-wrap gap-1.5">
              {[['', 'All'], ['job', 'Jobs'], ['internship', 'Internships'], ['placement', 'Student Placements']].map(([v, l], i) => (
                <label key={l} className="cursor-pointer"><input type="radio" name="type" value={v} defaultChecked={i === 0} className="peer sr-only" />
                  <span className="inline-block rounded-full border border-surface-line px-3.5 py-2 text-sm font-medium text-slate-600 peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-brand">{l}</span></label>))}
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <label className="relative block"><span className="sr-only">Keyword</span><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden /><input name="q" type="search" placeholder="Job title, skill, or company" autoComplete="off" className={`${field} pl-10`} /></label>
              <label className="relative block"><span className="sr-only">Location</span><MapPin size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden /><input name="location" list="locations" placeholder="City, state, or remote" autoComplete="off" className={`${field} pl-10`} /></label>
              <button type="submit" className={btn('primary')}>Search</button>
            </div>
            <datalist id="locations">{['Remote', 'Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano', 'Enugu', 'Kaduna', 'Benin City', 'Abeokuta', 'Nigeria'].map((c) => <option key={c} value={c} />)}</datalist>
            <p className="mt-2 text-xs text-ink-muted">Searching from outside Nigeria? Type any city or country.</p>
          </form>
          <div className="rise mt-6 flex flex-wrap gap-2.5" style={{ '--i': 3 } as React.CSSProperties}>
            <ButtonLink href="/jobs" className="flex-1 sm:flex-none">Find Opportunities</ButtonLink><ButtonLink href="/employers" variant="secondary" className="flex-1 sm:flex-none">I&apos;m an Employer</ButtonLink>
          </div>
        </div>
        <div className="rise mx-auto w-full max-w-[560px] overflow-hidden rounded-2xl" style={{ '--i': 3 } as React.CSSProperties}>
          <Image src="/images/student-portrait.jpg" alt="A smiling Nigerian student holding a blue folder on campus" width={600} height={900} priority sizes="(min-width:1024px) 40vw, 90vw" className="aspect-[16/11] w-full object-cover object-[50%_20%] lg:aspect-[4/4.6]" />
        </div>
      </section>

      <div className="border-y border-surface-line bg-surface-soft"><div className={`${container} flex flex-wrap items-center gap-2.5 py-4`}>
        <span className="mr-1 text-sm text-ink-muted">Browse by</span>
        {chips.map(([l, h]) => <Link key={l} href={h} className="rounded-full border border-surface-line bg-white px-4 py-2.5 text-sm font-medium hover:border-brand hover:text-brand">{l}</Link>)}
      </div></div>

      <section className={`${container} py-16`}>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><h2 className={h2}>Opportunities worth exploring</h2><p className="mt-2 text-lg text-ink-muted">Find roles and placements that match where you are in your career.</p></div><Link href="/jobs" className="font-semibold text-brand hover:underline">View all opportunities</Link></div>
        {featured.length > 0 ? <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{featured.map((o) => <li key={o.id} className="flex"><div className="w-full"><OpportunityCard o={o} saved={saved.has(o.id)} returnTo="/" /></div></li>)}</ul>
          : <div className="rounded-2xl border-2 border-dashed border-slate-300 p-10 text-center"><h3 className="text-lg font-semibold">New opportunities will appear here</h3><p className="mx-auto mt-2 max-w-[52ch] text-ink-muted">Listings published by employers show up here with their location, work arrangement, pay when supplied, and deadline.</p><ButtonLink href="/jobs" variant="secondary" className="mt-5">Open the opportunity search</ButtonLink></div>}
      </section>

      <section className="bg-surface-soft py-16"><div className={`${container} grid items-center gap-10 lg:grid-cols-[.9fr_1.1fr] lg:gap-14`}>
        <Image src="/images/student-laptop.jpg" alt="A smiling student with a laptop in a busy lecture room" width={720} height={720} sizes="(min-width:1024px) 40vw, 90vw" className="aspect-[16/10] w-full rounded-2xl object-cover lg:aspect-square lg:max-h-[520px]" />
        <div><h2 className={h2}>Your industrial training journey starts here.</h2><p className="mt-3.5 max-w-[56ch] text-lg text-ink-muted">Find student placements, industrial training opportunities, and internships that help you gain practical experience while you study.</p>
          <div className="my-6 grid gap-3 sm:grid-cols-2">
            {[[GraduationCap, 'SIWES / IT', 'Industrial training for your course', '/placements?category=siwes'], [Users, 'SWEP', 'Student work experience', '/placements?category=swep'], [Briefcase, 'Internships', 'Short-term, hands-on roles', '/jobs?type=internship'], [Flag, 'Graduate Trainee', 'Structured first-job programmes', '/jobs?type=graduate']].map(([Icon, t, d, h]) => { const I = Icon as typeof Users; return (
              <Link key={t as string} href={h as string} className="flex gap-3 rounded-xl border border-surface-line bg-white p-4 transition hover:border-brand"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-brand-tint text-brand"><I size={22} aria-hidden /></span><span><span className="block font-semibold">{t as string}</span><span className="text-sm text-ink-muted">{d as string}</span></span></Link>); })}
          </div>
          <ButtonLink href="/placements">Explore Student Placements</ButtonLink>
          <p className="mt-3.5 text-sm text-ink-muted">No work experience needed to start. Each organisation sets its own eligibility, and CareerBridge cannot guarantee placement acceptance or school approval.</p></div>
      </div></section>

      <section className={`${container} py-16`}>
        <h2 className={h2}>Three steps from profile to progress</h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">{[['Create your profile', 'Tell us about your skills, education, experience, and career goals.'], ['Discover opportunities', 'Explore jobs and placements that fit your interests and qualifications.'], ['Apply and track progress', 'Submit applications, follow their status, and stay organised throughout your search.']].map(([t, d], i) => (
          <li key={t} className="rounded-2xl border border-surface-line p-6"><span className="mb-3.5 grid h-9 w-9 place-items-center rounded-full bg-brand font-bold text-white">{i + 1}</span><h3 className="font-semibold">{t}</h3><p className="mt-1.5 text-ink-muted">{d}</p></li>))}</ol>
      </section>

      <section className="bg-[#101c33] py-16 text-white"><div className={`${container} grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14`}>
        <div><h2 className={h2}>Find the right people for your next opportunity.</h2><p className="mt-3.5 max-w-[56ch] text-lg text-slate-300">Publish vacancies, reach emerging talent, and manage applications in one organised recruitment workspace.</p>
          <ul className="my-6 grid gap-2.5">{['Publish job and placement opportunities', 'Receive and organise applications', 'Review candidate CVs and shortlist applicants', 'Manage interview stages'].map((b) => <li key={b} className="flex gap-2.5"><Check size={20} className="mt-0.5 shrink-0 text-blue-300" aria-hidden />{b}</li>)}</ul>
          <Link href="/auth/signup?type=employer" className={btn('secondary', 'border-white')}>Post an Opportunity</Link></div>
        <Image src="/images/team-office.jpg" alt="A team of colleagues celebrating together in an office" width={900} height={600} sizes="(min-width:1024px) 40vw, 90vw" className="aspect-[3/2] w-full rounded-2xl object-cover" />
      </div></section>

      <section className="py-16"><div className={`${container} grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-14`}>
        <div><h2 className={h2}>Apply with clearer expectations.</h2><p className="mt-3.5 text-lg text-ink-muted">No platform can promise every listing is genuine. Here is what CareerBridge does to help you judge.</p></div>
        <div className="divide-y divide-surface-line">{[['Employer verification', 'A badge appears only after our team reviews an organisation. Unverified employers are labelled as such.'], ['Clear application methods', 'You are told whether you apply on CareerBridge or on an external site before you leave.'], ['Report suspicious listings', 'Flag any listing for review from its page.'], ['Private documents', 'CVs and supporting files are shared only with the employer you apply to.']].map(([t, d]) => <div key={t} className="flex gap-3.5 py-4 first:pt-0"><ShieldCheck size={22} className="mt-0.5 shrink-0 text-ok" aria-hidden /><div><h3 className="font-semibold">{t}</h3><p className="text-[15px] text-ink-muted">{d}</p></div></div>)}</div>
      </div></section>

      <section id="faq" className={`${container} pb-16`}>
        <h2 className={`${h2} text-center`}>Questions, answered</h2>
        <div className="mx-auto mt-8 max-w-3xl">{faqs.map(([q, a]) => <details key={q} className="group border-b border-surface-line"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-[18px] font-semibold [&::-webkit-details-marker]:hidden">{q}<span aria-hidden className="text-2xl font-normal text-brand transition group-open:rotate-45">+</span></summary><p className="pb-[18px] text-ink-muted">{a}</p></details>)}</div>
      </section>

      <section className={container}><div className="grid overflow-hidden rounded-3xl bg-brand text-white md:grid-cols-[1.1fr_.9fr]">
        <div className="p-8 md:p-12"><h2 className={h2}>Take the next step in your career.</h2><p className="mb-6 mt-3 text-blue-100">Discover opportunities, build your CV, and move forward with confidence.</p>
          <div className="flex flex-wrap gap-2.5"><Link href="/jobs" className={btn('secondary', 'flex-1 border-white sm:flex-none')}>Explore Opportunities</Link><Link href="/auth/signup" className={btn('ghost', 'flex-1 border-white/50 text-white hover:bg-white/10 sm:flex-none')}>Create Your Account</Link></div></div>
        <Image src="/images/computer-lab.jpg" alt="Two students working together at a computer" width={900} height={507} sizes="(min-width:768px) 40vw, 90vw" className="h-full max-h-60 w-full object-cover md:max-h-none" />
      </div></section>
    </>
  );
}
