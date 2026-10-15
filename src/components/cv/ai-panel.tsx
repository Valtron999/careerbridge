'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { btn, field } from '@/components/ui';
import { saveTailoredCopy } from '@/lib/cv/actions';
import type { Cv, TemplateId } from '@/lib/cv/schema';
import type { CvAiResult } from '@/lib/ai/cv-assist';

type Sec = 'experience' | 'internships' | 'leadership' | 'projects';
type Resp<K extends keyof CvAiResult> = { result: CvAiResult[K]; warnings: string[] };
type Props = { cv: Cv; mode: 'student' | 'general'; enabled: boolean; initialJob: string; template: TemplateId; title: string;
  onSummary: (s: string) => void; onBullet: (s: Sec, i: number, b: number, text: string) => void; onSkills: (t: string[], s: string[]) => void };

export function AiPanel({ cv, mode, enabled, initialJob, template, title, onSummary, onBullet, onSkills }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Resp<'summary'> | null>(null);
  const [bullets, setBullets] = useState<(Resp<'bullets'> & { target: { section: Sec; index: number } }) | null>(null);
  const [skills, setSkills] = useState<Resp<'skills'> | null>(null);
  const [missing, setMissing] = useState<Resp<'missing'> | null>(null);
  const [tailor, setTailor] = useState<Resp<'tailor'> | null>(null);
  const [job, setJob] = useState(initialJob);
  const [pick, setPick] = useState('');
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [copyName, setCopyName] = useState(`${title} (tailored)`.slice(0, 80));

  const targets = useMemo(() => (['experience', 'internships', 'leadership', 'projects'] as Sec[]).flatMap((s) =>
    (cv[s] as { bullets: string[]; title?: string; name?: string }[]).map((r, i) => ({ s, i, label: `${s}: ${(r.title || r.name || `entry ${i + 1}`)}`, n: r.bullets.filter(Boolean).length })).filter((t) => t.n > 0)), [cv]);

  async function call<K extends keyof CvAiResult>(action: K, extra: object = {}): Promise<Resp<K> | null> {
    setBusy(action); setError(null);
    try {
      const res = await fetch('/api/ai/cv', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, cv, mode, ...extra }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? 'Something went wrong. You can keep editing by hand.'); return null; }
      return json as Resp<K>;
    } catch { setError('We could not reach the AI service. Check your connection; your CV is unaffected.'); return null; }
    finally { setBusy(null); }
  }
  const Warn = ({ w }: { w: string[] }) => w.length ? <ul className="mt-2 space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{w.map((x) => <li key={x}>⚠ {x}</li>)}</ul> : null;
  const Btn = ({ k, onClick, children, disabled }: { k: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) => <button type="button" onClick={onClick} disabled={busy !== null || disabled || !enabled} className={btn('secondary', '!min-h-[42px] w-full justify-start text-left')}><Sparkles size={16} aria-hidden className="text-brand" />{busy === k ? 'Working…' : children}</button>;

  async function makeCopy() {
    if (!tailor) return;
    const c = structuredClone(cv);
    if (tailor.result.summary && accepted.summary) c.summary = tailor.result.summary;
    tailor.result.bullet_edits.forEach((e, n) => { if (accepted[`e${n}`]) { const row = (c[e.section] as { bullets: string[] }[])[e.index]; if (row) row.bullets[e.bullet_index] = e.after; } });
    if (accepted.skills && tailor.result.skills_to_highlight.length) {
      const hl = new Set(tailor.result.skills_to_highlight.map((s) => s.toLowerCase()));
      c.skills.technical = [...c.skills.technical.filter((s) => hl.has(s.toLowerCase())), ...c.skills.technical.filter((s) => !hl.has(s.toLowerCase()))];
    }
    const r = await saveTailoredCopy({ title: copyName, template, content: c });
    if (!r.ok) { setError(r.error); return; }
    router.push(`/dashboard/cvs/${r.id}/edit`);
  }

  return (
    <div className="space-y-5">
      <div role="note" className="rounded-xl bg-surface-soft p-4 text-sm text-slate-700">
        <p className="font-semibold">Before you use AI</p>
        <p className="mt-1">Each button sends the text of your CV to Google Gemini. We leave out your name, email, phone number and links. On Google&apos;s free tier, Google may use submitted content to improve its products, so skip AI if you are not comfortable with that. Suggestions can be wrong. Check every line, because nothing is saved until you click Save.</p>
      </div>
      {!enabled && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">AI assistance is not set up on this site yet. Everything else in the builder still works.</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <section className="space-y-2"><h3 className="font-semibold">Professional summary</h3>
        <Btn k="summary" onClick={async () => setSummary(await call('summary'))}>Write a summary from my CV</Btn>
        {summary && <div className="rounded-lg border border-surface-line p-3 text-sm"><p>{summary.result.summary}</p>
          {summary.result.placeholders.length > 0 && <p className="mt-2 text-xs text-ink-muted">Add: {summary.result.placeholders.join('; ')}</p>}<Warn w={summary.warnings} />
          <div className="mt-3 flex gap-2"><button type="button" className={btn('primary', '!min-h-[38px] !px-3 text-sm')} onClick={() => { onSummary(summary.result.summary); setSummary(null); }}>Use this summary</button><button type="button" className={btn('ghost', '!min-h-[38px] !px-3 text-sm')} onClick={() => setSummary(null)}>Dismiss</button></div></div>}</section>

      <section className="space-y-2"><h3 className="font-semibold">Improve bullet points</h3>
        {targets.length === 0 ? <p className="text-sm text-ink-muted">Add an experience, internship, leadership or project entry with bullet points first.</p> : (<>
          <label htmlFor="bt" className="sr-only">Entry to improve</label>
          <select id="bt" className={field} value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Choose an entry</option>{targets.map((t) => <option key={`${t.s}-${t.i}`} value={`${t.s}:${t.i}`}>{t.label}</option>)}</select>
          <Btn k="bullets" disabled={!pick} onClick={async () => { const [section, i] = pick.split(':') as [Sec, string]; const r = await call('bullets', { target: { section, index: Number(i) } }); setBullets(r ? { ...r, target: { section, index: Number(i) } } : null); }}>Improve these bullets</Btn>
          {bullets && (() => { const orig = (cv[bullets.target.section] as { bullets: string[] }[])[bullets.target.index]?.bullets ?? []; return (
            <div className="space-y-3 rounded-lg border border-surface-line p-3 text-sm">
              {bullets.result.bullets.map((after, b) => orig[b] !== after && (<div key={b}><p className="text-ink-muted line-through decoration-slate-300">{orig[b]}</p><p className="mt-1">{after}</p>
                <button type="button" className="mt-1 text-sm font-semibold text-brand" onClick={() => onBullet(bullets.target.section, bullets.target.index, b, after)}>Use this version</button></div>))}
              {bullets.result.notes && <p className="text-xs text-ink-muted">{bullets.result.notes}</p>}<Warn w={bullets.warnings} />
              <button type="button" className={btn('ghost', '!min-h-[38px] !px-3 text-sm')} onClick={() => setBullets(null)}>Done</button></div>); })()}</>)}</section>

      <section className="space-y-2"><h3 className="font-semibold">Skills and gaps</h3>
        <Btn k="skills" onClick={async () => setSkills(await call('skills'))}>Find skills I already show</Btn>
        {skills && <div className="rounded-lg border border-surface-line p-3 text-sm">{skills.result.suggestions.length === 0 ? <p>No new skills found.</p> : <ul className="space-y-2">{skills.result.suggestions.map((s) => <li key={s.skill}><b>{s.skill}</b> <span className="text-xs text-ink-muted">({s.kind})</span><br /><span className="text-xs text-ink-muted">Because: {s.evidence}</span></li>)}</ul>}
          {skills.result.suggestions.length > 0 && <button type="button" className={btn('primary', 'mt-3 !min-h-[38px] !px-3 text-sm')} onClick={() => { onSkills(skills.result.suggestions.filter((s) => s.kind === 'technical').map((s) => s.skill), skills.result.suggestions.filter((s) => s.kind === 'soft').map((s) => s.skill)); setSkills(null); }}>Add these to my skills</button>}</div>}
        <Btn k="missing" onClick={async () => setMissing(await call('missing'))}>What information is missing?</Btn>
        {missing && <ul className="list-disc space-y-1 rounded-lg border border-surface-line p-3 pl-7 text-sm">{missing.result.questions.map((q) => <li key={q}>{q}</li>)}</ul>}</section>

      <section className="space-y-2"><h3 className="font-semibold">Tailor to a job</h3>
        <p className="text-sm text-ink-muted">Paste a job description. You choose which changes to keep, and they are saved as a <b>new copy</b>. Your original CV is not touched.</p>
        <label htmlFor="jd" className="sr-only">Job description</label>
        <textarea id="jd" rows={6} maxLength={8000} value={job} onChange={(e) => setJob(e.target.value)} placeholder="Paste the job or placement description here" className={`${field} py-2`} />
        <Btn k="tailor" disabled={job.trim().length < 40} onClick={async () => { const r = await call('tailor', { jobDescription: job }); setTailor(r); if (r) setAccepted(Object.fromEntries([['summary', true], ['skills', true], ...r.result.bullet_edits.map((_, n) => [`e${n}`, true])])); }}>Suggest changes for this job</Btn>
        {tailor && <div className="space-y-3 rounded-lg border border-surface-line p-3 text-sm">
          {tailor.result.notes && <p>{tailor.result.notes}</p>}
          {tailor.result.summary && <label className="flex gap-2"><input type="checkbox" className="mt-1 h-5 w-5" checked={Boolean(accepted.summary)} onChange={(e) => setAccepted({ ...accepted, summary: e.target.checked })} /><span><b>New summary</b><br />{tailor.result.summary}</span></label>}
          {tailor.result.skills_to_highlight.length > 0 && <label className="flex gap-2"><input type="checkbox" className="mt-1 h-5 w-5" checked={Boolean(accepted.skills)} onChange={(e) => setAccepted({ ...accepted, skills: e.target.checked })} /><span><b>Put these skills first:</b> {tailor.result.skills_to_highlight.join(', ')}</span></label>}
          {tailor.result.bullet_edits.map((e, n) => <label key={n} className="flex gap-2"><input type="checkbox" className="mt-1 h-5 w-5" checked={Boolean(accepted[`e${n}`])} onChange={(ev) => setAccepted({ ...accepted, [`e${n}`]: ev.target.checked })} /><span><span className="text-ink-muted line-through decoration-slate-300">{e.before}</span><br />{e.after}{e.reason && <><br /><span className="text-xs text-ink-muted">{e.reason}</span></>}</span></label>)}
          {tailor.result.missing.length > 0 && <div><b>Requirements your CV does not show yet:</b><ul className="mt-1 list-disc pl-5">{tailor.result.missing.map((m) => <li key={m}>{m}</li>)}</ul></div>}
          <Warn w={tailor.warnings} />
          <div className="border-t border-surface-line pt-3"><label htmlFor="cn" className="mb-1 block text-xs font-medium">Name for the tailored copy</label><input id="cn" className={field} value={copyName} maxLength={80} onChange={(e) => setCopyName(e.target.value)} />
            <button type="button" onClick={makeCopy} className={btn('primary', 'mt-3 w-full')}>Create tailored copy with selected changes</button></div></div>}</section>
    </div>
  );
}
