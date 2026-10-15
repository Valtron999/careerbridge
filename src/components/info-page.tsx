import { container } from './ui';
export function InfoPage({ title, children, legal }: { title: string; children: React.ReactNode; legal?: boolean }) {
  return (<div className={`${container} max-w-3xl py-12`}><h1 className="text-4xl font-bold tracking-tight">{title}</h1>
    {legal && <p role="note" className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Draft text. This page needs review by a qualified legal professional (including Nigerian data-protection requirements) before launch.</p>}
    <div className="mt-6 space-y-4 text-slate-700">{children}</div></div>);
}
