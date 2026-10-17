import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check, ClipboardCheck, FileText, GraduationCap, MapPin, Search, ShieldCheck, Briefcase } from 'lucide-react';
import { ButtonLink, btn, container, field } from '@/components/ui';
import { OpportunityCard } from '@/components/opportunity-card';
import { Reveal } from '@/components/home/reveal';
import { CvShowcase } from '@/components/home/cv-showcase';
import { getFeatured, getSavedIds, type OpportunityCardData } from '@/lib/data/opportunities';
import { getSession } from '@/lib/auth/session';
import { aiConfigured } from '@/lib/ai';

const h2 = 'text-[clamp(1.65rem,3.4vw,2.35rem)] font-semibold leading-tight tracking-tight';
const delay = (n: number) => ({ '--i': n } as React.CSSProperties);
const SEARCH_TYPES: [string, string][] = [['', 'All'], ['siwes', 'SIWES / IT'], ['internship', 'Internships'], ['entry', 'Entry-level jobs'], ['graduate', 'Graduate']];
const FILTER_LINKS: [string, string][] = [['All opportunities', '/jobs'], ['SIWES', '/placements?category=siwes'], ['Internships', '/jobs?type=internship'], ['Entry-level jobs', '/jobs?type=entry']];
const faqs: [string, string][] = [
  ['What is CareerBridge?', 'A platform that helps students find SIWES placements and internships, build a professional CV, and apply. It also lists jobs and graduate programmes, and gives employers a place to publish opportunities and manage applicants.'],
  ['What is SIWES, and can I find a placement here?', "SIWES (Students' Industrial Work Experience Scheme) is the practical training that many Nigerian tertiary institutions require. Employers can list SIWES and industrial training opportunities on CareerBridge. Your school sets the duration and rules, so confirm them with your SIWES coordinator before you apply."],
  ['Can I find internships?', 'Yes. Browse internships and filter by location, work arrangement and pay where the employer has provided it.'],
  ['I have no work experience. Can I still build a CV?', 'Yes. The CV builder has a student mode that starts with your education, projects, skills, certifications and volunteering, so you never have to invent a job.'],
  ['Does CareerBridge guarantee a placement or an interview?', 'No. CareerBridge helps you find opportunities and prepare your application. Whether you are selected is decided by each organisation.'],
  ['How do applications work?', 'Some employers receive applications on CareerBridge, where you can follow the status. Others use an external link or an email address. We tell you which before you apply, and CareerBridge cannot see what happens on an external site.'],
  ['Can I search for jobs too?', 'Yes. Full-time, part-time, remote and graduate roles are listed alongside SIWES and internships, and you can search them from the navigation or the search box at the top of this page.'],
  ['Is CareerBridge free for students?', 'Searching, building a CV and applying are intended to be free for students. If any optional paid tool is added, it will be shown clearly beforehand.'],
  ['Can I apply for opportunities outside Nigeria?', 'You can search any location. Whether you are eligible is decided by each employer, so check the requirements on the listing.'],
  ['How can an organisation publish an opportunity?', 'Create an employer account, add your organisation details and post a listing. Listings may be reviewed before they go live.'],
];

export default async function Home() {
  const [session, placements, jobs] = await Promise.all([getSession(), getFeatured('placement', 6), getFeatured('job', 3)]);
  const shown: OpportunityCardData[] = [...placements, ...jobs];
  const saved = await getSavedIds(session?.userId ?? null, shown.map((o) => o.id));
  const cvHref = session?.profile.role === 'candidate' ? '/dashboard/cvs/new' : '/cv-builder';
  const ai = aiConfigured();
  const card = (o: OpportunityCardData, i: number) => <li key={o.id} className="flex"><Reveal delay={i * 70} className="w-full"><OpportunityCard o={o} saved={saved.has(o.id)} returnTo="/" /></Reveal></li>;

  return (
    <>
      {/* 1. Hero */}
      <section className={`${container} grid items-center gap-10 py-10 lg:grid-cols-[1.1fr_.9fr] lg:py-14`}>
        <div className="min-w-0">
          <p className="rise mb-3 inline-block rounded-full bg-brand-tint px-3 py-1 text-sm font-semibold text-brand">For students and first-time job seekers</p>
          <h1 className="rise text-[clamp(2.05rem,6vw,3.7rem)] font-bold leading-[1.08] tracking-tight [text-wrap:balance]" style={delay(1)}>Your SIWES, Internship &amp; Career Journey Starts Here.</h1>
          <p className="rise mt-5 max-w-[56ch] text-lg text-ink-muted" style={delay(2)}>Looking for a SIWES placement or your next internship? Discover opportunities, create a professional CV, and take your first step toward the working world, all with CareerBridge.</p>
          <div className="rise mt-6 flex flex-wrap gap-2.5" style={delay(3)}>
            <ButtonLink href="/placements" className="flex-1 sm:flex-none">Find SIWES &amp; Internships</ButtonLink>
            <ButtonLink href={cvHref} variant="secondary" className="flex-1 sm:flex-none">Create My CV</ButtonLink>
          </div>
          <form action="/jobs" method="get" role="search" aria-label="Search opportunities" className="rise mt-7 rounded-2xl border border-surface-line bg-white p-3 shadow-[0_8px_30px_rgba(21,34,56,.07)]" style={delay(4)}>
            <div role="radiogroup" aria-label="Opportunity type" className="mb-3 flex flex-wrap gap-1.5">
              {SEARCH_TYPES.map(([v, l], i) => (
                <label key={l} className="cursor-pointer"><input type="radio" name="type" value={v} defaultChecked={i === 0} className="peer sr-only" />
                  <span className="inline-block min-h-[40px] rounded-full border border-surface-line px-3.5 py-2 text-sm font-medium text-slate-600 peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-brand">{l}</span></label>))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="relative block"><span className="sr-only">Keyword</span><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden /><input name="q" type="search" placeholder="Course, skill or company" autoComplete="off" className={`${field} pl-10`} /></label>
              <label className="relative block"><span className="sr-only">Location</span><MapPin size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden /><input name="location" list="locations" placeholder="City, state, or remote" autoComplete="off" className={`${field} pl-10`} /></label>
              <button type="submit" className={btn('primary', 'sm:col-span-2')}>Search</button>
            </div>
            <datalist id="locations">{['Remote', 'Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano', 'Enugu', 'Kaduna', 'Benin City', 'Abeokuta', 'Nigeria'].map((c) => <option key={c} value={c} />)}</datalist>
          </form>
        </div>
        <div className="rise relative mx-auto w-full max-w-[560px]" style={delay(3)}>
          <div className="overflow-hidden rounded-2xl">
            <Image src="/images/student-portrait.jpg" alt="A smiling Nigerian student holding a blue folder on campus" width={600} height={900} priority sizes="(min-width:1024px) 40vw, 90vw" className="aspect-[16/11] w-full object-cover object-[50%_20%] lg:aspect-[4/4.6]" />
          </div>
          <ul aria-label="What CareerBridge helps with" className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
            {['SIWES & IT', 'Internships', 'CV builder'].map((t) => <li key={t} className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-ink shadow-sm">{t}</li>)}
          </ul>
        </div>
      </section>

      {/* 2. Three action cards */}
      <section id="start" aria-labelledby="start-h" className="border-y border-surface-line bg-surface-soft py-12">
        <div className={container}>
          <h2 id="start-h" className="sr-only">Where to start</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: GraduationCap, title: 'Find Your SIWES Placement', text: 'Explore industrial training opportunities and find organisations that may be suitable for your course of study.', cta: 'Explore SIWES Opportunities', href: '/placements?category=siwes', accent: false },
              { icon: Briefcase, title: 'Find Your Next Internship', text: 'Discover opportunities to gain practical experience, develop your skills, and take your first steps into your chosen industry.', cta: 'Explore Internships', href: '/jobs?type=internship', accent: false },
              { icon: FileText, title: 'Create a Professional CV', text: 'Turn your education, skills, projects, certifications, and experience into a professional CV you can use when applying.', cta: 'Build My CV', href: cvHref, accent: true },
            ].map((c, i) => { const I = c.icon; return (
              <li key={c.title} className={`flex ${i === 2 ? 'sm:col-span-2 lg:col-span-1' : ''}`}><Reveal delay={i * 80} className="w-full">
                <Link href={c.href} className={`group flex h-full flex-col rounded-2xl border p-6 transition active:scale-[.99] motion-reduce:transition-none ${c.accent ? 'border-brand bg-brand text-white hover:bg-brand-dark' : 'border-surface-line bg-white hover:border-brand hover:shadow-md'}`}>
                  <span className={`grid h-11 w-11 place-items-center rounded-xl ${c.accent ? 'bg-white/15 text-white' : 'bg-brand-tint text-brand'}`}><I size={24} aria-hidden /></span>
                  <h3 className="mt-4 text-xl font-semibold leading-snug">{c.title}</h3>
                  <p className={`mt-2 flex-1 ${c.accent ? 'text-blue-100' : 'text-ink-muted'}`}>{c.text}</p>
                  <span className="mt-5 inline-flex items-center gap-2 font-semibold">{c.cta} <ArrowRight size={18} aria-hidden className="transition group-hover:translate-x-1 motion-reduce:transition-none" /></span>
                </Link></Reveal></li>); })}
          </ul>
        </div>
      </section>

      {/* 3. Featured SIWES and internships (jobs stay available, lower down) */}
      <section aria-labelledby="opps-h" className={`${container} py-16`}>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h2 id="opps-h" className={h2}>Opportunities to Start Your Career</h2><p className="mt-2 max-w-[60ch] text-lg text-ink-muted">Explore opportunities to gain practical experience, develop your skills, and prepare for your future career.</p></div><Link href="/placements" className="font-semibold text-brand hover:underline">View all SIWES &amp; internships</Link></div>
        <nav aria-label="Browse opportunity types" className="mb-6 flex flex-wrap gap-2">{FILTER_LINKS.map(([l, h]) => <Link key={l} href={h} className="min-h-[40px] rounded-full border border-surface-line bg-white px-4 py-2 text-sm font-medium hover:border-brand hover:text-brand">{l}</Link>)}</nav>
        {placements.length > 0 ? <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{placements.map(card)}</ul>
          : <Reveal><div className="rounded-2xl border-2 border-dashed border-slate-300 p-10 text-center"><h3 className="text-lg font-semibold">No SIWES or internship listings are published yet</h3><p className="mx-auto mt-2 max-w-[54ch] text-ink-muted">Employers publish new opportunities regularly. In the meantime you can build your CV, or look at other opportunities.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3"><ButtonLink href={cvHref}>Create My CV</ButtonLink><ButtonLink href="/jobs" variant="secondary">Browse all opportunities</ButtonLink></div></div></Reveal>}

        <div className="mt-12 border-t border-surface-line pt-8">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-xl font-semibold">Looking for a job instead?</h3><p className="mt-1 text-ink-muted">Full-time, part-time, remote and graduate roles are listed here too.</p></div><Link href="/jobs" className="font-semibold text-brand hover:underline">Browse all jobs</Link></div>
          {jobs.length > 0 && <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{jobs.map((o, i) => card(o, i))}</ul>}
        </div>
      </section>

      {/* 4. CV generator */}
      <section aria-labelledby="cv-h" className="bg-surface-soft py-16"><div className={`${container} grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14`}>
        <Reveal>
          <h2 id="cv-h" className={h2}>No Work Experience? You Can Still Build a Strong CV.</h2>
          <p className="mt-3.5 max-w-[56ch] text-lg text-ink-muted">Your education, projects, skills, certifications, volunteering, and achievements all count. CareerBridge helps you organise your experience into a professional CV for SIWES placements and internship applications.</p>
          <ul className="my-6 grid gap-3">{[
            'Student mode that starts with your education, projects and skills',
            'Three templates: Professional, Modern graduate, and Student',
            'Download as a PDF with real, selectable text',
            'Keep several versions and edit them as you gain experience',
            ...(ai ? ['Optional AI suggestions that you review before anything is saved'] : []),
          ].map((b) => <li key={b} className="flex gap-2.5"><Check size={20} className="mt-0.5 shrink-0 text-ok" aria-hidden />{b}</li>)}</ul>
          <p className="mb-6 text-sm text-ink-muted">You can include: personal details, a short summary, education, technical and soft skills, academic and personal projects, certifications, volunteering and leadership, and work experience if you have any.</p>
          <ButtonLink href={cvHref}>Create My CV</ButtonLink>
        </Reveal>
        <Reveal delay={100} className="min-w-0"><CvShowcase /></Reveal>
      </div></section>

      {/* 5. How it works */}
      <section aria-labelledby="how-h" className={`${container} py-16`}>
        <h2 id="how-h" className={h2}>How CareerBridge works</h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">{[
          ['Explore Opportunities', 'Browse SIWES placements and internships that match your interests, studies, and goals.'],
          ['Prepare Your CV', 'Create or improve your CV so you can present your education, skills, and relevant experience professionally.'],
          ['Apply and Take the Next Step', 'Review the requirements, follow the application instructions, and take the next step toward gaining practical experience.'],
        ].map(([t, d], i) => <li key={t} className="flex"><Reveal delay={i * 80} className="w-full"><div className="h-full rounded-2xl border border-surface-line p-6"><span className="mb-3.5 grid h-9 w-9 place-items-center rounded-full bg-brand font-bold text-white">{i + 1}</span><h3 className="font-semibold">{t}</h3><p className="mt-1.5 text-ink-muted">{d}</p></div></Reveal></li>)}</ol>
        <p className="mt-5 text-sm text-ink-muted">CareerBridge helps you find and prepare for opportunities. It cannot promise an interview or a placement, because each organisation makes its own decision.</p>
      </section>

      {/* 6. Student checklist */}
      <section aria-labelledby="check-h" className="bg-surface-soft py-16"><div className={container}>
        <Reveal><h2 id="check-h" className={h2}>A simple checklist before you apply</h2><p className="mt-3 max-w-[60ch] text-lg text-ink-muted">New to applications? Work through these steps and you will be better prepared than most.</p></Reveal>
        <ol className="mt-8 grid gap-4 md:grid-cols-2">{[
          { t: 'Check your school\u2019s SIWES rules', d: 'Ask your SIWES coordinator how long your placement must be and which documents your school provides. Rules differ between institutions.', link: null },
          { t: 'Prepare your CV', d: 'Put your education, projects and skills in one clear document.', link: { href: cvHref, label: 'Build your CV' } },
          { t: 'Keep your documents ready', d: 'Upload your introduction letter, results or certificates once, then attach them to applications that ask for them.', link: { href: '/dashboard/documents', label: 'Open your documents' } },
          { t: 'Write a short cover letter', d: 'A few honest paragraphs about your course, your projects and why you want this role.', link: { href: '/dashboard/cover-letters/new', label: 'Start a cover letter' } },
          { t: 'Check the organisation first', d: 'Look for an official website and contact details before you share personal documents. Be careful with anyone who asks you to pay to secure a place.', link: null },
        ].map((s, i) => <li key={s.t} className="flex"><Reveal delay={i * 60} className="w-full"><div className="flex h-full gap-4 rounded-2xl border border-surface-line bg-white p-5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-tint text-brand"><ClipboardCheck size={20} aria-hidden /></span><div><h3 className="font-semibold">{s.t}</h3><p className="mt-1 text-[15px] text-ink-muted">{s.d}</p>{s.link && <Link href={s.link.href} className="mt-2 inline-block text-sm font-semibold text-brand hover:underline">{s.link.label}</Link>}</div></div></Reveal></li>)}</ol>
      </div></section>

      {/* 7. Trust and transparency */}
      <section aria-labelledby="trust-h" className="py-16"><div className={`${container} grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-14`}>
        <Reveal><h2 id="trust-h" className={h2}>Apply with clear expectations.</h2><p className="mt-3.5 text-lg text-ink-muted">No platform can promise every listing is genuine. Here is how CareerBridge helps you judge.</p></Reveal>
        <Reveal delay={80}><div className="divide-y divide-surface-line">{[
          ['Verified only when reviewed', 'A Verified badge appears only after our team has reviewed an organisation. Others are labelled as not yet verified.'],
          ['Clear application method', 'Every listing says whether you apply on CareerBridge or on an external site, and you are told before you leave.'],
          ['Sources are shown', 'Listings imported from other websites are labelled, with the date they were last checked.'],
          ['Report anything suspicious', 'Use the report button on any listing and our team will review it.'],
        ].map(([t, d]) => <div key={t} className="flex gap-3.5 py-4 first:pt-0"><ShieldCheck size={22} className="mt-0.5 shrink-0 text-ok" aria-hidden /><div><h3 className="font-semibold">{t}</h3><p className="text-[15px] text-ink-muted">{d}</p></div></div>)}</div>
          <p role="note" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><b>Never pay to secure a placement.</b> Be careful with anyone who asks for money to give you SIWES or an internship, and check an organisation&apos;s website and contact details before you share personal information.</p></Reveal>
      </div></section>

      {/* 8. Employers (secondary) */}
      <section aria-labelledby="emp-h" className={`${container} pb-16`}>
        <Reveal><div className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-[#101c33] p-7 text-white sm:p-9">
          <div className="max-w-[60ch]"><h2 id="emp-h" className="text-2xl font-semibold tracking-tight">Looking for talent?</h2><p className="mt-2 text-slate-300">Publish internships, SIWES placements and jobs, receive applications, and manage candidates in one place.</p></div>
          <Link href="/auth/signup?type=employer" className={btn('secondary', 'border-white')}>Explore Employer Options</Link>
        </div></Reveal>
      </section>

      {/* 9. FAQ */}
      <section id="faq" aria-labelledby="faq-h" className={`${container} pb-16`}>
        <h2 id="faq-h" className={`${h2} text-center`}>Questions, answered</h2>
        <div className="mx-auto mt-8 max-w-3xl">{faqs.map(([q, a]) => <details key={q} className="group border-b border-surface-line"><summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">{q}<span aria-hidden className="text-2xl font-normal text-brand transition group-open:rotate-45 motion-reduce:transition-none">+</span></summary><p className="pb-[18px] text-ink-muted">{a}</p></details>)}</div>
      </section>

      {/* 10. Final call to action */}
      <section aria-labelledby="final-h" className={container}><Reveal><div className="grid overflow-hidden rounded-3xl bg-brand text-white md:grid-cols-[1.1fr_.9fr]">
        <div className="p-8 md:p-12"><h2 id="final-h" className={h2}>Take your first step into the workplace.</h2><p className="mb-6 mt-3 text-blue-100">Find a SIWES placement or internship, build your CV, and get ready to apply.</p>
          <div className="flex flex-wrap gap-2.5"><Link href="/placements" className={btn('secondary', 'flex-1 border-white sm:flex-none')}>Find SIWES &amp; Internships</Link><Link href={cvHref} className={btn('ghost', 'flex-1 border-white/50 text-white hover:bg-white/10 sm:flex-none')}>Create My CV</Link></div></div>
        <Image src="/images/computer-lab.jpg" alt="Two students working together at a computer" width={900} height={507} loading="lazy" sizes="(min-width:768px) 40vw, 90vw" className="h-full max-h-60 w-full object-cover md:max-h-none" />
      </div></Reveal></section>
    </>
  );
}
