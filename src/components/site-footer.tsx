import Link from 'next/link';
import { Logo } from './logo';
import { brand } from '@/lib/config/brand';
import { container } from './ui';

const groups = [
  { title: 'Explore', links: [['/jobs', 'Find Jobs'], ['/placements', 'Student Placements'], ['/jobs?type=internship', 'Internships'], ['/jobs?arrangement=remote', 'Remote Opportunities']] },
  { title: 'Career Tools', links: [['/cv-builder', 'CV Builder'], ['/dashboard/cover-letters', 'Cover Letter Generator'], ['/career-resources', 'Career Resources']] },
  { title: 'Employers', links: [['/employer/opportunities/new', 'Post an Opportunity'], ['/employer', 'Employer Dashboard'], ['/pricing', 'Pricing'], ['/employer-guidelines', 'Employer Guidelines']] },
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
        <p className="mt-9 border-t border-surface-line pt-5 text-sm text-ink-muted">© {new Date().getFullYear()} {brand.name}. All rights reserved.</p>
      </div>
    </footer>
  );
}
