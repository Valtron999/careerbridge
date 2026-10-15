import Link from 'next/link';
import { Logo } from './logo';
import { MobileMenu } from './mobile-menu';
import { ButtonLink, container } from './ui';
import { getSession } from '@/lib/auth/session';

export const NAV = [
  { href: '/jobs', label: 'Find Jobs' }, { href: '/placements', label: 'Student Placements' },
  { href: '/cv-builder', label: 'CV Builder' }, { href: '/career-resources', label: 'Career Resources' },
  { href: '/employers', label: 'For Employers' },
];

export async function SiteHeader() {
  const session = await getSession();
  const home = session?.profile.role === 'employer' ? '/employer' : session && session.profile.role !== 'candidate' ? '/admin' : '/dashboard';
  return (
    <header className="sticky top-0 z-30 border-b border-surface-line bg-white">
      <div className={`${container} flex h-[68px] items-center justify-between gap-4`}>
        <Logo />
        <nav aria-label="Main" className="hidden lg:block"><ul className="flex gap-1">
          {NAV.map((n) => (<li key={n.href}><Link className="rounded-lg px-3 py-2 text-[15px] font-medium text-slate-600 hover:bg-surface-soft hover:text-ink" href={n.href}>{n.label}</Link></li>))}
        </ul></nav>
        <div className="flex items-center gap-2">
          {session ? (<ButtonLink href={home} className="min-h-[40px] px-4">Dashboard</ButtonLink>) : (<>
            <ButtonLink href="/auth/login" variant="secondary" className="hidden min-h-[40px] px-4 lg:inline-flex">Sign In</ButtonLink>
            <ButtonLink href="/auth/signup" className="hidden min-h-[40px] px-4 sm:inline-flex">Get Started</ButtonLink></>)}
          <MobileMenu items={NAV} signedIn={Boolean(session)} home={home} />
        </div>
      </div>
    </header>
  );
}
