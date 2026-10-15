import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { ButtonLink, Tag, btn } from '@/components/ui';
import { deleteCv, duplicateCv, setDefaultCv } from '@/lib/cv/actions';
import { TEMPLATE_LABELS, TEMPLATES, type TemplateId } from '@/lib/cv/schema';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'My CVs', robots: { index: false } };
export default async function Cvs({ searchParams }: { searchParams: { error?: string } }) {
  const { userId } = await requireUser('/dashboard/cvs');
  const { data } = await createClient().from('candidate_cvs').select('id, title, template, is_default, updated_at').eq('user_id', userId).order('updated_at', { ascending: false });
  const msg = searchParams.error === 'limit' ? 'You have reached the limit of 20 CVs. Delete one to create another.' : searchParams.error ? 'We could not create that CV. Please try again.' : null;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold tracking-tight">My CVs</h1><ButtonLink href="/dashboard/cvs/new">New CV</ButtonLink></div>
      <p className="mt-1 text-ink-muted">Keep a master CV and make a separate version for each type of role.</p>
      {msg && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{msg}</p>}
      {(data ?? []).length === 0 ? <div className="mt-8 rounded-xl border-2 border-dashed border-slate-300 p-10 text-center"><p className="font-medium">You have not created a CV yet.</p><p className="mx-auto mt-1 max-w-[46ch] text-sm text-ink-muted">Students without work experience can start with education, projects and skills.</p><ButtonLink href="/dashboard/cvs/new" className="mt-4">Create your first CV</ButtonLink></div> : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">{(data ?? []).map((c) => (
          <li key={c.id} className="flex flex-col gap-3 rounded-xl border border-surface-line p-5">
            <div className="flex items-start justify-between gap-2"><Link href={`/dashboard/cvs/${c.id}/edit`} className="font-semibold hover:text-brand [overflow-wrap:anywhere]">{c.title}</Link>{c.is_default && <Tag tone="ok">Default</Tag>}</div>
            <p className="text-sm text-ink-muted">{TEMPLATE_LABELS[(TEMPLATES as readonly string[]).includes(c.template) ? (c.template as TemplateId) : 'professional'].name} · Updated {formatDate(c.updated_at)}</p>
            <div className="mt-auto flex flex-wrap gap-2">
              <Link href={`/dashboard/cvs/${c.id}/edit`} className={btn('primary', '!min-h-[40px] !px-4')}>Edit</Link>
              <form action={duplicateCv}><input type="hidden" name="id" value={c.id} /><button className={btn('secondary', '!min-h-[40px] !px-4')}>Duplicate</button></form>
              {!c.is_default && <form action={setDefaultCv}><input type="hidden" name="id" value={c.id} /><button className={btn('secondary', '!min-h-[40px] !px-4')}>Make default</button></form>}
              <form action={deleteCv}><input type="hidden" name="id" value={c.id} /><button className={btn('ghost', '!min-h-[40px] !px-3 text-red-700')} aria-label={`Delete ${c.title}`}>Delete</button></form>
            </div></li>))}</ul>)}
    </div>
  );
}
