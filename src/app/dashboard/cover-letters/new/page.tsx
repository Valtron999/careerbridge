import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createLetter } from '@/lib/letters/actions';
import { TONES, TONE_LABELS } from '@/lib/letters/model';
import { btn, field } from '@/components/ui';

export const metadata: Metadata = { title: 'New cover letter', robots: { index: false } };
export const dynamic = 'force-dynamic';
export default async function NewLetter({ searchParams }: { searchParams: { job?: string } }) {
  const { userId } = await requireUser('/dashboard/cover-letters/new');
  const supabase = createClient();
  const slug = /^[a-z0-9-]{1,200}$/.test(searchParams.job ?? '') ? searchParams.job! : '';
  const [{ data: cvs }, { data: opp }] = await Promise.all([
    supabase.from('candidate_cvs').select('id, title, is_default').eq('user_id', userId).order('is_default', { ascending: false }),
    slug ? supabase.from('opportunities').select('title, employer:employers(name)').eq('slug', slug).in('status', ['published', 'closed']).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const employer = (opp?.employer as unknown as { name: string } | null)?.name;
  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-bold tracking-tight">New cover letter</h1>
      {opp ? <p className="mt-2 rounded-lg bg-brand-tint p-3 text-sm">Writing for <b>{opp.title}</b>{employer ? ` at ${employer}` : ''}. The listing text will be used to match your letter to the role.</p> : <p className="mt-2 text-ink-muted">This will be a general letter. You can paste a job description into the editor if you have one.</p>}
      {(cvs ?? []).length === 0 ? <div className="mt-6 rounded-xl border-2 border-dashed border-slate-300 p-6"><p className="font-medium">Create a CV first.</p><p className="mt-1 text-sm text-ink-muted">The letter is written from your CV, so it only says things that are true about you.</p><Link href="/dashboard/cvs/new" className={btn('primary', 'mt-4')}>Create a CV</Link></div> : (
        <form action={createLetter} className="mt-6 space-y-5">
          <input type="hidden" name="job" value={slug} />
          <div><label htmlFor="title" className="mb-1 block text-sm font-medium">Letter name (optional)</label><input id="title" name="title" maxLength={120} className={field} placeholder={opp ? `Cover letter: ${opp.title}` : 'General cover letter'} /></div>
          <div><label htmlFor="cv_id" className="mb-1 block text-sm font-medium">Which CV should it use?</label><select id="cv_id" name="cv_id" defaultValue={cvs?.find((c) => c.is_default)?.id ?? cvs?.[0]?.id} className={field}>{cvs?.map((c) => <option key={c.id} value={c.id}>{c.title}{c.is_default ? ' (default)' : ''}</option>)}</select></div>
          <fieldset><legend className="mb-2 text-sm font-medium">Tone</legend><div className="grid gap-2">{TONES.map((t, i) => (<label key={t} className="cursor-pointer"><input type="radio" name="tone" value={t} defaultChecked={i === 0} className="peer sr-only" /><span className="block rounded-xl border border-surface-line p-3 peer-checked:border-brand peer-checked:bg-brand-tint peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-brand"><b>{TONE_LABELS[t].name}</b> <span className="text-sm text-ink-muted">{TONE_LABELS[t].blurb}</span></span></label>))}</div></fieldset>
          <button className={btn('primary')}>Create letter</button>
        </form>)}
    </div>
  );
}
