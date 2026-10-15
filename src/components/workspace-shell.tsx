import Link from 'next/link';
import { signOut } from '@/lib/auth/actions';
import { btn, container } from './ui';

export function WorkspaceShell({ title, nav, children }: { title: string; nav: { href: string; label: string; soon?: boolean }[]; children: React.ReactNode }) {
  return (
    <div className={`${container} grid gap-8 py-8 lg:grid-cols-[220px_1fr]`}>
      <aside>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">{title}</p>
        <nav aria-label={`${title} navigation`} className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
          {nav.map((n) => n.soon
            ? <span key={n.label} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-slate-400" title="Not built yet">{n.label} <span className="text-[10px] uppercase">soon</span></span>
            : <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-surface-soft">{n.label}</Link>)}
        </nav>
        <form action={signOut} className="mt-4 hidden lg:block"><button className={btn('secondary', 'min-h-[40px] w-full')}>Sign out</button></form>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
export function Stat({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return <div className="rounded-xl border border-surface-line p-5"><p className="text-sm text-ink-muted">{label}</p><p className="mt-1 text-3xl font-bold">{value}</p>{note && <p className="mt-1 text-xs text-ink-muted">{note}</p>}</div>;
}
