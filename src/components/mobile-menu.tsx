'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';

export function MobileMenu({ items, signedIn, home }: { items: { href: string; label: string }[]; signedIn: boolean; home: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus(); } };
    const mq = window.matchMedia('(min-width: 1024px)');
    const onMq = () => mq.matches && setOpen(false);
    document.addEventListener('keydown', onKey); mq.addEventListener('change', onMq);
    return () => { document.removeEventListener('keydown', onKey); mq.removeEventListener('change', onMq); };
  }, []);
  const link = 'block border-b border-surface-line py-3 font-medium';
  return (
    <div className="lg:hidden">
      <button ref={btn} type="button" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen(!open)} className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-surface-line">
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="absolute inset-x-0 top-[68px] max-h-[calc(100dvh-68px)] overflow-y-auto border-b border-surface-line bg-white px-5 pb-5">
          {items.map((i) => (<Link key={i.href} href={i.href} className={link} onClick={() => setOpen(false)}>{i.label}</Link>))}
          {signedIn ? (<Link href={home} className={link} onClick={() => setOpen(false)}>Dashboard</Link>) : (<>
            <Link href="/auth/login" className={link} onClick={() => setOpen(false)}>Sign In</Link>
            <Link href="/auth/signup" onClick={() => setOpen(false)} className="mt-4 flex min-h-[48px] items-center justify-center rounded-[10px] bg-brand font-semibold text-white">Get Started</Link></>)}
        </nav>
      )}
    </div>
  );
}
