import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { createCv } from '@/lib/cv/actions';
import { TEMPLATES, TEMPLATE_LABELS } from '@/lib/cv/schema';
import { btn, field } from '@/components/ui';

export const metadata: Metadata = { title: 'New CV', robots: { index: false } };
export default async function NewCv({ searchParams }: { searchParams: { error?: string } }) {
  await requireUser('/dashboard/cvs/new');
  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-bold tracking-tight">Create a CV</h1>
      <form action={createCv} className="mt-6 space-y-6">
        {searchParams.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">Give your CV a name to continue.</p>}
        <div><label htmlFor="title" className="mb-1 block text-sm font-medium">CV name</label><input id="title" name="title" defaultValue="My CV" maxLength={80} required className={field} /></div>
        <fieldset><legend className="mb-2 text-sm font-medium">Which fits you best?</legend>
          <div className="grid gap-2">{[['student', 'I am a student', 'Starts with education, projects and skills. No work experience needed.'], ['general', 'I have work experience', 'Starts with your jobs, then education and skills.']].map(([v, t, d], i) => (
            <label key={v} className="cursor-pointer"><input type="radio" name="mode" value={v} defaultChecked={i === 0} className="peer sr-only" />
              <span className="block rounded-xl border border-surface-line p-4 peer-checked:border-brand peer-checked:bg-brand-tint peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-brand"><b>{t}</b><br /><span className="text-sm text-ink-muted">{d}</span></span></label>))}</div></fieldset>
        <div><label htmlFor="template" className="mb-1 block text-sm font-medium">Template</label><select id="template" name="template" defaultValue="professional" className={field}>{TEMPLATES.map((t) => <option key={t} value={t}>{TEMPLATE_LABELS[t].name}: {TEMPLATE_LABELS[t].blurb}</option>)}</select><p className="mt-1 text-xs text-ink-muted">You can switch templates any time.</p></div>
        <p className="text-sm text-ink-muted">We fill in your name, email and any profile details you have already given us. Nothing is made up.</p>
        <button className={btn('primary')}>Create CV</button>
      </form>
    </div>
  );
}
