import Link from 'next/link';
import clsx from 'clsx';
import type { ComponentProps } from 'react';

const base = 'inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[10px] border px-5 text-[15px] font-semibold transition motion-reduce:transition-none disabled:opacity-60 disabled:pointer-events-none';
const variants = {
  primary: 'border-brand bg-brand text-white hover:bg-brand-dark',
  secondary: 'border-surface-line bg-white text-ink hover:border-slate-300',
  ghost: 'border-transparent text-ink hover:bg-surface-soft',
};
export function btn(variant: keyof typeof variants = 'primary', extra?: string) { return clsx(base, variants[variant], extra); }

export function ButtonLink({ variant = 'primary', className, ...p }: ComponentProps<typeof Link> & { variant?: keyof typeof variants }) {
  return <Link className={btn(variant, className)} {...p} />;
}
export function Tag({ children, tone = 'brand' }: { children: React.ReactNode; tone?: 'brand' | 'ok' | 'muted' | 'warn' }) {
  const t = { brand: 'bg-brand-tint text-brand', ok: 'bg-ok-tint text-ok', muted: 'bg-surface-soft text-ink-muted', warn: 'bg-amber-50 text-amber-800' }[tone];
  return <span className={clsx('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold', t)}>{children}</span>;
}
export const field = 'w-full min-h-[46px] rounded-[10px] border border-surface-line bg-white px-3 text-[16px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';
export const container = 'mx-auto w-full max-w-page px-5';
