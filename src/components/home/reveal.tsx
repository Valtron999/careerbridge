'use client';
import { useEffect, useRef } from 'react';

/** Fades content in once as it scrolls into view. Content is fully visible without JavaScript, for reduced-motion users, and when already on screen. */
export function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    el.style.transitionDelay = `${delay}ms`;
    el.classList.add('rv-hide');
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { el.classList.remove('rv-hide'); io.disconnect(); window.setTimeout(() => { el.style.transitionDelay = ''; }, 900); } }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return <div ref={ref} className={`rv ${className}`}>{children}</div>;
}
