import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { ButtonLink, container } from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { TEMPLATES, TEMPLATE_LABELS } from '@/lib/cv/schema';
import { aiConfigured } from '@/lib/ai';

export const metadata: Metadata = { title: 'CV builder', description: 'Build a professional, ATS-friendly CV with student-friendly templates and download it as a PDF with selectable text.' };
export default async function CvBuilderPage() {
  const session = await getSession();
  const cta = session?.profile.role === 'candidate' ? '/dashboard/cvs/new' : session ? '/' : '/auth/signup';
  const ai = aiConfigured();
  return (
    <div className={`${container} py-12`}>
      <h1 className="max-w-[18ch] text-[clamp(2rem,5vw,3.2rem)] font-bold leading-[1.1] tracking-tight">Build a CV that opens doors.</h1>
      <p className="mt-4 max-w-[58ch] text-lg text-ink-muted">Create a professional CV, highlight your skills, and prepare applications that reflect your experience. Students can start with education, projects and skills, so no work history is needed.</p>
      <div className="mt-6 flex flex-wrap gap-3"><ButtonLink href={cta}>{session ? 'Create your CV' : 'Sign up to create your CV'}</ButtonLink>{!session && <ButtonLink href="/auth/login?next=/dashboard/cvs/new" variant="secondary">I have an account</ButtonLink>}</div>
      <ul className="mt-12 grid gap-4 md:grid-cols-3">{TEMPLATES.map((t) => <li key={t} className="rounded-xl border border-surface-line p-5"><h2 className="font-semibold">{TEMPLATE_LABELS[t].name}</h2><p className="mt-1 text-sm text-ink-muted">{TEMPLATE_LABELS[t].blurb}</p></li>)}</ul>
      <ul className="mt-10 grid gap-3 sm:grid-cols-2">{['Live preview while you type', 'Reorder, hide or add sections', 'Several versions for different roles', 'PDF with real, selectable text (works with applicant tracking systems)', ai ? 'Optional AI help that only uses what you have written' : 'Optional AI help (not enabled on this site yet)', 'You approve every AI suggestion before it is saved'].map((b) => <li key={b} className="flex gap-2.5"><Check size={20} className="mt-0.5 shrink-0 text-ok" aria-hidden />{b}</li>)}</ul>
      <p className="mt-8 max-w-[62ch] text-sm text-ink-muted">AI suggestions are drafts. CareerBridge never adds qualifications, employers or numbers you did not provide. See the <Link className="underline" href="/privacy">privacy policy</Link> for how data sent to the AI provider is handled.</p>
    </div>
  );
}
