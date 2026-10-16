'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Save, Sparkles } from 'lucide-react';
import { saveLetter } from '@/lib/letters/actions';
import { TONES, TONE_LABELS, composeLetter, findPlaceholders, wordCount, type LetterParts, type Tone } from '@/lib/letters/model';
import { btn, field } from '@/components/ui';

type Job = { title: string; employer: string; description: string };
type Props = { id: string; initialTitle: string; initialTone: Tone; initialCvId: string | null; initialParts: LetterParts; initialJob: Job; cvs: { id: string; title: string }[];
  linked: { slug: string; title: string; employer: string } | null; aiEnabled: boolean };
type Suggestion = { paragraphs: string[]; placeholders: string[]; warnings: string[] };

export function LetterEditor({ id, initialTitle, initialTone, initialCvId, initialParts, initialJob, cvs, linked, aiEnabled }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [tone, setTone] = useState<Tone>(initialTone);
  const [cvId, setCvId] = useState<string | null>(initialCvId);
  const [job, setJob] = useState<Job>(initialJob);
  const [greeting, setGreeting] = useState(initialParts.greeting);
  const [paras, setParas] = useState<string[]>(initialParts.paragraphs);
  const [signoff, setSignoff] = useState(initialParts.signoff);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'error'; text: string }>({ kind: 'idle', text: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [section, setSection] = useState<{ index: number; paragraph: string; warnings: string[] } | null>(null);

  const mark = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); };
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  useEffect(() => { const w = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', w); return () => window.removeEventListener('beforeunload', w); }, []);

  const letter = useMemo(() => composeLetter({ greeting, paragraphs: paras, signoff }), [greeting, paras, signoff]);
  const gaps = useMemo(() => findPlaceholders(letter), [letter]);
  const words = wordCount(paras.join(' '));
  const hasJobText = Boolean(job.title.trim() || job.description.trim());

  async function ai(action: 'generate' | 'section', index?: number) {
    if (!cvId) { setStatus({ kind: 'error', text: 'Choose a CV first so the letter uses your real details.' }); return; }
    setBusy(action === 'generate' ? 'generate' : `section-${index}`); setStatus({ kind: 'idle', text: '' });
    try {
      const res = await fetch('/api/ai/letter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        action, cvId, tone, ...(linked ? { opportunitySlug: linked.slug } : hasJobText ? { custom: job } : {}), ...(action === 'section' ? { paragraphs: paras, index } : {}) }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setStatus({ kind: 'error', text: json.error ?? 'Something went wrong. You can keep writing by hand.' }); return; }
      if (action === 'generate') {
        const s: Suggestion = { paragraphs: json.paragraphs, placeholders: json.placeholders ?? [], warnings: json.warnings ?? [] };
        if (paras.every((p) => !p.trim())) { setParas(s.paragraphs); setDirty(true); setSuggestion({ ...s, paragraphs: [] }); } else setSuggestion(s); // never replace existing writing without asking
      } else setSection({ index: index!, paragraph: json.paragraph, warnings: json.warnings ?? [] });
    } catch { setStatus({ kind: 'error', text: 'We could not reach the AI service. Your letter is unchanged.' }); }
    finally { setBusy(null); }
  }
  async function save(): Promise<boolean> {
    setBusy('save');
    const r = await saveLetter({ id, title, body: letter, tone, cv_id: cvId, job_context: linked ? null : job });
    setBusy(null);
    if (!r.ok) { setStatus({ kind: 'error', text: r.error }); return false; }
    setDirty(false); setStatus({ kind: 'ok', text: `Saved at ${new Date(r.savedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` }); return true;
  }
  async function copy() {
    try { await navigator.clipboard.writeText(letter); setStatus({ kind: 'ok', text: gaps.length ? `Copied, but ${gaps.length} placeholder${gaps.length > 1 ? 's' : ''} still need filling in.` : 'Copied to clipboard.' }); }
    catch { setStatus({ kind: 'error', text: 'Your browser blocked copying. Select the text and copy it manually.' }); }
  }
  async function download() {
    if (dirty && !(await save())) return;
    setBusy('pdf');
    try {
      const res = await fetch(`/api/cover-letters/${id}/pdf`); if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob()); const a = document.createElement('a'); a.href = url; a.download = `${title.replace(/[^a-z0-9]+/gi, '-') || 'cover-letter'}.pdf`; a.click(); URL.revokeObjectURL(url);
      setStatus({ kind: 'ok', text: gaps.length ? `PDF downloaded, but ${gaps.length} placeholder${gaps.length > 1 ? 's' : ''} still need filling in.` : 'PDF downloaded.' });
    } catch { setStatus({ kind: 'error', text: 'We could not generate the PDF. Please try again.' }); }
    finally { setBusy(null); }
  }

  const ta = `${field} py-2 leading-relaxed`;
  return (
    <div>
      <div className="sticky top-[68px] z-20 -mx-5 flex flex-wrap items-center gap-2 border-b border-surface-line bg-white px-5 py-3">
        <Link href="/dashboard/cover-letters" className="text-sm font-medium text-brand">← Letters</Link>
        <label htmlFor="lt" className="sr-only">Letter name</label><input id="lt" value={title} maxLength={120} onChange={(e) => mark(setTitle)(e.target.value)} className={`${field} !min-h-[40px] w-44 sm:w-64`} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span role="status" aria-live="polite" className={`text-xs ${status.kind === 'error' ? 'text-red-700' : 'text-ink-muted'}`}>{status.text || (dirty ? 'Unsaved changes' : '')}</span>
          <button type="button" onClick={save} disabled={busy !== null} className={btn('primary', '!min-h-[40px] !px-4')}><Save size={16} aria-hidden /> {busy === 'save' ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={copy} className={btn('secondary', '!min-h-[40px] !px-4')}><Copy size={16} aria-hidden /> Copy</button>
          <button type="button" onClick={download} disabled={busy !== null} className={btn('secondary', '!min-h-[40px] !px-4')}><Download size={16} aria-hidden /> {busy === 'pdf' ? 'Preparing…' : 'PDF'}</button>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="space-y-3 rounded-xl border border-surface-line p-4"><h2 className="font-semibold">Write with AI</h2>
            <div><label htmlFor="cv" className="mb-1 block text-sm font-medium">CV to use</label>
              <select id="cv" value={cvId ?? ''} onChange={(e) => mark(setCvId)(e.target.value || null)} className={field}><option value="">Choose a CV</option>{cvs.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
            <fieldset><legend className="mb-1 text-sm font-medium">Tone</legend><div className="grid gap-1.5">{TONES.map((t) => (<label key={t} className="cursor-pointer"><input type="radio" name="tone" checked={tone === t} onChange={() => mark(setTone)(t)} className="peer sr-only" /><span className="block rounded-lg border border-surface-line p-2 text-sm peer-checked:border-brand peer-checked:bg-brand-tint peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-brand"><b>{TONE_LABELS[t].name}</b><br /><span className="text-xs text-ink-muted">{TONE_LABELS[t].blurb}</span></span></label>))}</div></fieldset>
            {linked ? <p className="rounded-lg bg-brand-tint p-3 text-sm">For <Link className="font-semibold underline" href={`/jobs/${linked.slug}`}>{linked.title}</Link>{linked.employer ? ` at ${linked.employer}` : ''}. The listing text is used automatically.</p> : (
              <details className="rounded-lg border border-surface-line p-3" open={hasJobText}><summary className="cursor-pointer text-sm font-medium">Paste a job description (optional)</summary>
                <div className="mt-3 space-y-2"><input aria-label="Role title" placeholder="Role title" maxLength={160} value={job.title} onChange={(e) => mark(setJob)({ ...job, title: e.target.value })} className={field} />
                  <input aria-label="Organisation" placeholder="Organisation" maxLength={160} value={job.employer} onChange={(e) => mark(setJob)({ ...job, employer: e.target.value })} className={field} />
                  <textarea aria-label="Job description" placeholder="Paste the job post here" rows={6} maxLength={6000} value={job.description} onChange={(e) => mark(setJob)({ ...job, description: e.target.value })} className={ta} /></div></details>)}
            <button type="button" onClick={() => ai('generate')} disabled={busy !== null || !aiEnabled} className={btn('primary', 'w-full')}><Sparkles size={16} aria-hidden /> {busy === 'generate' ? 'Writing…' : paras.some((p) => p.trim()) ? 'Write a new draft' : 'Write a draft'}</button>
            {!aiEnabled && <p role="alert" className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">AI is not set up on this site yet. You can still write the letter by hand.</p>}
            <p className="text-xs text-ink-muted">This sends the text of your CV (not your name, email, phone or links) and the job text to Google Gemini. On the free tier, Google may use it to improve its products. Check every line before you send it.</p></section>
        </aside>

        <section className="min-w-0 space-y-4" aria-label="Letter">
          {suggestion && suggestion.paragraphs.length > 0 && (
            <div className="rounded-xl border border-brand/40 bg-brand-tint p-4"><h2 className="font-semibold">New draft ready</h2>
              <div className="mt-2 space-y-2 text-sm">{suggestion.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
              {suggestion.warnings.map((w) => <p key={w} className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">⚠ {w}</p>)}
              {suggestion.placeholders.length > 0 && <p className="mt-2 text-xs text-ink-muted">Fill in: {suggestion.placeholders.join('; ')}</p>}
              <div className="mt-3 flex gap-2"><button type="button" className={btn('primary', '!min-h-[40px] !px-4')} onClick={() => { setParas(suggestion.paragraphs); setDirty(true); setSuggestion(null); }}>Replace my letter with this draft</button><button type="button" className={btn('ghost', '!min-h-[40px] !px-4')} onClick={() => setSuggestion(null)}>Keep mine</button></div></div>)}
          {suggestion && suggestion.paragraphs.length === 0 && (suggestion.warnings.length > 0 || suggestion.placeholders.length > 0) && <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{suggestion.warnings.map((w) => <p key={w}>⚠ {w}</p>)}{suggestion.placeholders.length > 0 && <p>Fill in: {suggestion.placeholders.join('; ')}</p>}<button type="button" className="mt-1 font-semibold underline" onClick={() => setSuggestion(null)}>Dismiss</button></div>}
          {gaps.length > 0 && <p role="note" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{gaps.length} placeholder{gaps.length > 1 ? 's' : ''} to replace before you send: {gaps.join(', ')}</p>}

          <div><label htmlFor="gr" className="mb-1 block text-sm font-medium">Greeting</label><input id="gr" value={greeting} maxLength={120} onChange={(e) => mark(setGreeting)(e.target.value)} className={field} /><p className="mt-1 text-xs text-ink-muted">Use the hiring manager&apos;s name if the listing gives one.</p></div>
          {paras.length === 0 && <p className="rounded-lg border-2 border-dashed border-slate-300 p-6 text-center text-sm text-ink-muted">Your letter is empty. Write a draft with AI, or add a paragraph and write it yourself.</p>}
          {paras.map((p, i) => (
            <div key={i} className="rounded-xl border border-surface-line p-3">
              <label htmlFor={`p${i}`} className="mb-1 flex items-center justify-between text-sm font-medium"><span>Paragraph {i + 1}</span><span className="text-xs font-normal text-ink-muted">{wordCount(p)} words</span></label>
              <textarea id={`p${i}`} rows={5} maxLength={1500} value={p} onChange={(e) => mark(setParas)(paras.map((x, j) => (j === i ? e.target.value : x)))} className={ta} />
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => ai('section', i)} disabled={busy !== null || !aiEnabled || !p.trim()} className={btn('secondary', '!min-h-[38px] !px-3 text-sm')}><Sparkles size={14} aria-hidden /> {busy === `section-${i}` ? 'Rewriting…' : 'Rewrite this paragraph'}</button>
                <button type="button" onClick={() => mark(setParas)(paras.filter((_, j) => j !== i))} className={btn('ghost', '!min-h-[38px] !px-3 text-sm text-red-700')} aria-label={`Remove paragraph ${i + 1}`}>Remove</button></div>
              {section?.index === i && (<div className="mt-3 rounded-lg border border-brand/40 bg-brand-tint p-3 text-sm"><p>{section.paragraph}</p>{section.warnings.map((w) => <p key={w} className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-900">⚠ {w}</p>)}
                <div className="mt-2 flex gap-2"><button type="button" className={btn('primary', '!min-h-[38px] !px-3 text-sm')} onClick={() => { mark(setParas)(paras.map((x, j) => (j === i ? section.paragraph : x))); setSection(null); }}>Use this version</button><button type="button" className={btn('ghost', '!min-h-[38px] !px-3 text-sm')} onClick={() => setSection(null)}>Dismiss</button></div></div>)}
            </div>))}
          {paras.length < 5 && <button type="button" onClick={() => mark(setParas)([...paras, ''])} className="min-h-[44px] rounded-[10px] border border-dashed border-slate-300 px-4 text-sm font-semibold text-brand hover:bg-brand-tint">+ Add paragraph</button>}
          <div><label htmlFor="so" className="mb-1 block text-sm font-medium">Sign-off</label><textarea id="so" rows={2} maxLength={200} value={signoff} onChange={(e) => mark(setSignoff)(e.target.value)} className={ta} /></div>
          <p className="text-xs text-ink-muted">{words} words in the body. A good cover letter is usually 150 to 300 words.</p>
        </section>
      </div>
    </div>
  );
}
