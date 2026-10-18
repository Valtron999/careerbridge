import Link from 'next/link';
import { Logo } from './logo';
import { brand } from '@/lib/config/brand';
import { container } from './ui';

const groups = [
  { title: 'Explore', links: [['/placements?category=siwes', 'SIWES & Industrial Training'], ['/jobs?type=internship', 'Internships'], ['/jobs?type=entry', 'Entry-level Jobs'], ['/jobs', 'Find Jobs'], ['/jobs?arrangement=remote', 'Remote Opportunities']] },
  { title: 'Career Tools', links: [['/cv-builder', 'CV Builder'], ['/dashboard/cover-letters', 'Cover Letter Generator'], ['/career-resources', 'Career Resources']] },
  { title: 'Employers', links: [['/employers', 'For Employers'], ['/auth/login?type=employer', 'Employer Sign In'], ['/auth/signup?type=employer', 'Create Employer Account'], ['/pricing', 'Pricing'], ['/employer-guidelines', 'Employer Guidelines']] },
  { title: 'Company', links: [['/about', 'About'], ['/contact', 'Contact'], ['/faq', 'FAQ'], ['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Service']] },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-surface-line py-14">
      <div className={container}>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="sm:col-span-2 lg:col-span-1"><Logo /><p className="mt-3 max-w-[30ch] text-sm text-ink-muted">Jobs, internships and student placements, with the tools to apply and track progress.</p></div>
          {groups.map((g) => (<div key={g.title}><h3 className="mb-3 text-sm font-semibold">{g.title}</h3>
            {g.links.map(([href, label]) => (<Link key={href} href={href} className="block py-1 text-sm text-ink-muted hover:text-brand">{label}</Link>))}</div>))}
        </div>
        <div className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-surface-line pt-5 text-sm text-ink-muted"><p>© {new Date().getFullYear()} {brand.name}. All rights reserved.</p><Link href="/admin" className="hover:text-brand">Staff sign in</Link></div>
      </div>
    </footer>
  );
}
