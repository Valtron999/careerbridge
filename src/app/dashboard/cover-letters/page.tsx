import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { ButtonLink, Tag, btn } from '@/components/ui';
import { deleteLetter, duplicateLetter } from '@/lib/letters/actions';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Cover letters', robots: { index: false } };
export const dynamic = 'force-dynamic';
export default async function Letters({ searchParams }: { searchParams: { error?: string } }) {
  const { userId } = await requireUser('/dashboard/cover-letters');
  const { data } = await createClient().from('cover_letters').select('id, title, tone, updated_at, opportunity:opportunities(title, employer:employers(name))').eq('user_id', userId).order('updated_at', { ascending: false });
  const err = searchParams.error === 'limit' ? 'You have reached the limit of 30 letters. Delete one to create another.' : searchParams.error ? 'We could not create that letter. Please try again.' : null;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold tracking-tight">Cover letters</h1><ButtonLink href="/dashboard/cover-letters/new">New letter</ButtonLink></div>
      <p className="mt-1 text-ink-muted">Write one for a specific role or a general one. Everything is saved as an editable draft.</p>
      {err && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{err}</p>}
      {(data ?? []).length === 0 ? <div className="mt-8 rounded-xl border-2 border-dashed border-slate-300 p-10 text-center"><p className="font-medium">No cover letters yet.</p><p className="mx-auto mt-1 max-w-[46ch] text-sm text-ink-muted">You will need a CV first, because the letter uses your real details.</p><div className="mt-4 flex flex-wrap justify-center gap-3"><ButtonLink href="/dashboard/cover-letters/new">Write a letter</ButtonLink><ButtonLink href="/dashboard/cvs" variant="secondary">My CVs</ButtonLink></div></div> : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">{(data ?? []).map((l) => { const o = l.opportunity as unknown as { title: string; employer: { name: string } | null } | null; return (
          <li key={l.id} className="flex flex-col gap-2 rounded-xl border border-surface-line p-5">
            <Link href={`/dashboard/cover-letters/${l.id}`} className="font-semibold hover:text-brand [overflow-wrap:anywhere]">{l.title}</Link>
            <p className="text-sm text-ink-muted">{o ? `For ${o.title}${o.employer ? ` at ${o.employer.name}` : ''}` : 'General letter'} · Updated {formatDate(l.updated_at)}</p>
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-2"><Tag tone="muted">{l.tone}</Tag><Link href={`/dashboard/cover-letters/${l.id}`} className={btn('primary', '!min-h-[40px] !px-4')}>Edit</Link>
              <form action={duplicateLetter}><input type="hidden" name="id" value={l.id} /><button className={btn('secondary', '!min-h-[40px] !px-4')}>Duplicate</button></form>
              <form action={deleteLetter}><input type="hidden" name="id" value={l.id} /><button className={btn('ghost', '!min-h-[40px] !px-3 text-red-700')} aria-label={`Delete ${l.title}`}>Delete</button></form></div></li>); })}</ul>)}
    </div>
  );
}
