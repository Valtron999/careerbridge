'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Download, Eye, EyeOff, Save } from 'lucide-react';
import { ACCENTS, SECTION_TITLES, TEMPLATES, TEMPLATE_LABELS, blankEntry, type Cv, type Entry, type SectionId, type TemplateId } from '@/lib/cv/schema';
import { saveCv } from '@/lib/cv/actions';
import { btn, field } from '@/components/ui';
import { CvPreview } from './cv-preview';
import { AiPanel } from './ai-panel';
import { AddButton, Area, Input, RowCard, csv, lines, toCsv, toLines } from './fields';

type Props = { id: string; initialTitle: string; initialTemplate: TemplateId; initial: Cv; mode: 'student' | 'general'; aiEnabled: boolean; jobText: string };
type EntryKey = 'experience' | 'internships' | 'leadership';

export function CvEditor({ id, initialTitle, initialTemplate, initial, mode, aiEnabled, jobText }: Props) {
  const [cv, setCv] = useState<Cv>(initial);
  const [title, setTitle] = useState(initialTitle);
  const [template, setTemplate] = useState<TemplateId>(initialTemplate);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; text?: string }>({ kind: 'idle' });
  const [tab, setTab] = useState<'edit' | 'ai'>('edit');
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [open, setOpen] = useState<SectionId | null>(cv.sectionOrder.includes('summary') ? 'summary' : null);

  const edit = useCallback((fn: (d: Cv) => void) => { setCv((p) => { const n = structuredClone(p); fn(n); return n; }); setDirty(true); }, []);
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, []);

  async function save(snapshot = false): Promise<boolean> {
    setStatus({ kind: 'saving' });
    const r = await saveCv({ id, title, template, content: cv, snapshot });
    if (!r.ok) { setStatus({ kind: 'error', text: r.error }); return false; }
    setDirty(false); setStatus({ kind: 'saved', text: `Saved at ${new Date(r.savedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` }); return true;
  }
  async function download() {
    if (dirty && !(await save())) return;
    setStatus({ kind: 'saving', text: 'Preparing PDF…' });
    try {
      const res = await fetch(`/api/cv/${id}/pdf`);
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a'); a.href = url; a.download = `${title.replace(/[^a-z0-9]+/gi, '-') || 'cv'}.pdf`; a.click(); URL.revokeObjectURL(url);
      setStatus({ kind: 'saved', text: 'PDF downloaded' });
    } catch { setStatus({ kind: 'error', text: 'We could not generate the PDF. Please try again.' }); }
  }
  const move = (sid: SectionId, d: -1 | 1) => edit((c) => { const i = c.sectionOrder.indexOf(sid), j = i + d; if (j < 0 || j >= c.sectionOrder.length) return; [c.sectionOrder[i], c.sectionOrder[j]] = [c.sectionOrder[j]!, c.sectionOrder[i]!]; });
  const toggleHide = (sid: SectionId) => edit((c) => { c.hidden = c.hidden.includes(sid) ? c.hidden.filter((x) => x !== sid) : [...c.hidden, sid]; });

  const setEntry = (k: EntryKey, i: number, patch: Partial<Entry>) => edit((c) => { Object.assign(c[k][i]!, patch); });
  const entryList = (k: EntryKey, kind: string) => (<div className="space-y-3">
    {cv[k].map((e, i) => (<RowCard key={i} label={`${kind} ${i + 1}`} onRemove={() => edit((c) => { c[k].splice(i, 1); })}>
      <Input label={k === 'leadership' ? 'Role' : 'Job title'} value={e.title} onChange={(v) => setEntry(k, i, { title: v })} />
      <Input label="Organisation" value={e.organisation} onChange={(v) => setEntry(k, i, { organisation: v })} />
      <Input label="Location" value={e.location} onChange={(v) => setEntry(k, i, { location: v })} />
      <div className="grid grid-cols-2 gap-3"><Input label="Start" value={e.start} placeholder="Jan 2025" onChange={(v) => setEntry(k, i, { start: v })} /><Input label="End" value={e.end} placeholder="Present" onChange={(v) => setEntry(k, i, { end: v })} /></div>
      <div className="sm:col-span-2"><Area label="What you did (one point per line)" rows={4} maxLength={2000} value={lines(e.bullets)} onChange={(v) => setEntry(k, i, { bullets: toLines(v) })} hint="Describe real tasks and results. Add numbers only if you have them." /></div>
    </RowCard>))}
    <AddButton onClick={() => edit((c) => { c[k].push(blankEntry()); })}>Add {kind}</AddButton></div>);

  const body: Record<SectionId, React.ReactNode> = useMemo(() => ({
    summary: <Area label="Professional summary" rows={5} value={cv.summary} onChange={(v) => edit((c) => { c.summary = v; })} hint={mode === 'student' ? 'Mention your course, what you are learning and the placement you want. No work experience needed.' : '3-4 sentences about who you are and what you offer.'} />,
    education: (<div className="space-y-3">{cv.education.map((e, i) => (<RowCard key={i} label={`education ${i + 1}`} onRemove={() => edit((c) => { c.education.splice(i, 1); })}>
      <Input label="Institution" value={e.institution} onChange={(v) => edit((c) => { c.education[i]!.institution = v; })} /><Input label="Course or qualification" value={e.degree} onChange={(v) => edit((c) => { c.education[i]!.degree = v; })} />
      <Input label="Location" value={e.location} onChange={(v) => edit((c) => { c.education[i]!.location = v; })} />
      <div className="grid grid-cols-2 gap-3"><Input label="Start" value={e.start} onChange={(v) => edit((c) => { c.education[i]!.start = v; })} /><Input label="End or expected" value={e.end} onChange={(v) => edit((c) => { c.education[i]!.end = v; })} /></div>
      <div className="sm:col-span-2"><Area label="Details (grade, coursework, honours)" rows={2} maxLength={600} value={e.details} onChange={(v) => edit((c) => { c.education[i]!.details = v; })} /></div></RowCard>))}
      <AddButton onClick={() => edit((c) => { c.education.push({ institution: '', degree: '', location: '', start: '', end: '', details: '' }); })}>Add education</AddButton></div>),
    experience: entryList('experience', 'job'), internships: entryList('internships', 'internship or placement'), leadership: entryList('leadership', 'role'),
    projects: (<div className="space-y-3">{cv.projects.map((p, i) => (<RowCard key={i} label={`project ${i + 1}`} onRemove={() => edit((c) => { c.projects.splice(i, 1); })}>
      <Input label="Project name" value={p.name} onChange={(v) => edit((c) => { c.projects[i]!.name = v; })} /><Input label="Link (optional)" value={p.link} maxLength={300} onChange={(v) => edit((c) => { c.projects[i]!.link = v; })} />
      <div className="sm:col-span-2"><Area label="What it is" rows={2} maxLength={400} value={p.description} onChange={(v) => edit((c) => { c.projects[i]!.description = v; })} /></div>
      <div className="sm:col-span-2"><Area label="What you did (one point per line)" rows={3} maxLength={2000} value={lines(p.bullets)} onChange={(v) => edit((c) => { c.projects[i]!.bullets = toLines(v).slice(0, 8); })} /></div></RowCard>))}
      <AddButton onClick={() => edit((c) => { c.projects.push({ name: '', link: '', description: '', bullets: [] }); })}>Add project</AddButton></div>),
    skills: (<div className="space-y-3"><Input label="Technical skills (comma separated)" maxLength={1500} value={csv(cv.skills.technical)} onChange={(v) => edit((c) => { c.skills.technical = toCsv(v).slice(0, 40); })} /><Input label="Soft skills (comma separated)" maxLength={1000} value={csv(cv.skills.soft)} onChange={(v) => edit((c) => { c.skills.soft = toCsv(v).slice(0, 30); })} /></div>),
    certifications: (<div className="space-y-3">{cv.certifications.map((x, i) => (<RowCard key={i} label={`certification ${i + 1}`} onRemove={() => edit((c) => { c.certifications.splice(i, 1); })}>
      <Input label="Certification" value={x.name} onChange={(v) => edit((c) => { c.certifications[i]!.name = v; })} /><Input label="Issuer" value={x.issuer} onChange={(v) => edit((c) => { c.certifications[i]!.issuer = v; })} /><Input label="Date" value={x.date} onChange={(v) => edit((c) => { c.certifications[i]!.date = v; })} /></RowCard>))}
      <AddButton onClick={() => edit((c) => { c.certifications.push({ name: '', issuer: '', date: '' }); })}>Add certification</AddButton></div>),
    achievements: <Area label="Achievements (one per line)" rows={4} maxLength={2400} value={lines(cv.achievements)} onChange={(v) => edit((c) => { c.achievements = toLines(v); })} />,
    languages: (<div className="space-y-3">{cv.languages.map((x, i) => (<RowCard key={i} label={`language ${i + 1}`} onRemove={() => edit((c) => { c.languages.splice(i, 1); })}>
      <Input label="Language" value={x.name} onChange={(v) => edit((c) => { c.languages[i]!.name = v; })} /><Input label="Level" value={x.level} placeholder="Fluent, Conversational…" onChange={(v) => edit((c) => { c.languages[i]!.level = v; })} /></RowCard>))}
      <AddButton onClick={() => edit((c) => { c.languages.push({ name: '', level: '' }); })}>Add language</AddButton></div>),
  }), [cv, mode, edit]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = cv.personal;
  const setP = (patch: Partial<Cv['personal']>) => edit((c) => { Object.assign(c.personal, patch); });
  return (
    <div>
      <div className="sticky top-[68px] z-20 -mx-5 flex flex-wrap items-center gap-2 border-b border-surface-line bg-white px-5 py-3">
        <Link href="/dashboard/cvs" className="text-sm font-medium text-brand">← My CVs</Link>
        <label className="sr-only" htmlFor="cv-title">CV name</label>
        <input id="cv-title" value={title} maxLength={80} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} className={`${field} !min-h-[40px] w-44 sm:w-56`} />
        <label className="sr-only" htmlFor="cv-template">Template</label>
        <select id="cv-template" value={template} onChange={(e) => { setTemplate(e.target.value as TemplateId); setDirty(true); }} className={`${field} !min-h-[40px] w-auto`}>{TEMPLATES.map((t) => <option key={t} value={t}>{TEMPLATE_LABELS[t].name}</option>)}</select>
        <div className="flex items-center gap-1" role="group" aria-label="Accent colour">{ACCENTS.map((a) => <button key={a} type="button" onClick={() => edit((c) => { c.accent = a; })} aria-label={`Accent ${a}`} aria-pressed={cv.accent === a} className="h-7 w-7 rounded-full border-2" style={{ background: a, borderColor: cv.accent === a ? '#152238' : 'transparent' }} />)}</div>
        <div className="ml-auto flex items-center gap-2">
          <span role="status" aria-live="polite" className={`text-xs ${status.kind === 'error' ? 'text-red-700' : 'text-ink-muted'}`}>{status.kind === 'saving' ? status.text ?? 'Saving…' : status.text ?? (dirty ? 'Unsaved changes' : '')}</span>
          <button type="button" onClick={() => save()} disabled={status.kind === 'saving'} className={btn('primary', '!min-h-[40px] !px-4')}><Save size={16} aria-hidden /> Save</button>
          <button type="button" onClick={download} disabled={status.kind === 'saving'} className={btn('secondary', '!min-h-[40px] !px-4')}><Download size={16} aria-hidden /> PDF</button>
        </div>
      </div>
      <div className="mt-3 flex gap-2 lg:hidden" role="tablist" aria-label="Editor view">{(['edit', 'preview'] as const).map((v) => <button key={v} role="tab" aria-selected={mobileView === v} onClick={() => setMobileView(v)} className={btn(mobileView === v ? 'primary' : 'secondary', 'flex-1 capitalize')}>{v}</button>)}</div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={mobileView === 'edit' ? '' : 'hidden lg:block'}>
          <div className="mb-4 flex gap-2" role="tablist" aria-label="Editor tools">{(['edit', 'ai'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={btn(tab === t ? 'primary' : 'secondary', '!min-h-[40px]')}>{t === 'edit' ? 'Edit CV' : 'AI assistant'}</button>)}</div>
          {tab === 'ai' ? <AiPanel cv={cv} mode={mode} enabled={aiEnabled} initialJob={jobText} template={template} title={title}
            onSummary={(s) => edit((c) => { c.summary = s; })}
            onBullet={(sec, i, b, text) => edit((c) => { const row = (c[sec] as { bullets: string[] }[])[i]; if (row) row.bullets[b] = text; })}
            onSkills={(tech, soft) => edit((c) => { c.skills.technical = [...new Set([...c.skills.technical.filter(Boolean), ...tech])]; c.skills.soft = [...new Set([...c.skills.soft.filter(Boolean), ...soft])]; })} /> : (
          <div className="space-y-3">
            <details className="rounded-xl border border-surface-line p-4" open>
              <summary className="cursor-pointer font-semibold">Personal details</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Input label="Full name" value={p.full_name} onChange={(v) => setP({ full_name: v })} /><Input label="Headline" value={p.headline} placeholder="e.g. Computer Science student" onChange={(v) => setP({ headline: v })} />
                <Input label="Email" type="email" value={p.email} onChange={(v) => setP({ email: v })} /><Input label="Phone" value={p.phone} onChange={(v) => setP({ phone: v })} />
                <Input label="Location" value={p.location} onChange={(v) => setP({ location: v })} />
              </div>
              <div className="mt-3 space-y-2"><p className="text-xs font-medium text-slate-600">Links (portfolio, LinkedIn, GitHub)</p>
                {p.links.map((l, i) => <div key={i} className="grid grid-cols-[1fr_2fr_auto] items-end gap-2"><Input label="Label" value={l.label} maxLength={40} onChange={(v) => edit((c) => { c.personal.links[i]!.label = v; })} /><Input label="URL" value={l.url} maxLength={300} onChange={(v) => edit((c) => { c.personal.links[i]!.url = v; })} /><button type="button" className="min-h-[46px] px-2 text-sm text-red-700" onClick={() => edit((c) => { c.personal.links.splice(i, 1); })} aria-label={`Remove link ${i + 1}`}>✕</button></div>)}
                {p.links.length < 6 && <AddButton onClick={() => edit((c) => { c.personal.links.push({ label: '', url: '' }); })}>Add link</AddButton>}</div>
            </details>
            {cv.sectionOrder.map((sid, idx) => (
              <section key={sid} className="rounded-xl border border-surface-line">
                <div className="flex items-center gap-1 p-2 pl-4">
                  <button type="button" onClick={() => setOpen(open === sid ? null : sid)} aria-expanded={open === sid} className="min-h-[44px] flex-1 text-left font-semibold">{SECTION_TITLES[sid]}{cv.hidden.includes(sid) && <span className="ml-2 text-xs font-normal text-ink-muted">(hidden)</span>}</button>
                  <button type="button" onClick={() => move(sid, -1)} disabled={idx === 0} aria-label={`Move ${SECTION_TITLES[sid]} up`} className="grid h-11 w-9 place-items-center disabled:opacity-30"><ArrowUp size={16} /></button>
                  <button type="button" onClick={() => move(sid, 1)} disabled={idx === cv.sectionOrder.length - 1} aria-label={`Move ${SECTION_TITLES[sid]} down`} className="grid h-11 w-9 place-items-center disabled:opacity-30"><ArrowDown size={16} /></button>
                  <button type="button" onClick={() => toggleHide(sid)} aria-label={cv.hidden.includes(sid) ? `Show ${SECTION_TITLES[sid]}` : `Hide ${SECTION_TITLES[sid]}`} aria-pressed={cv.hidden.includes(sid)} className="grid h-11 w-9 place-items-center">{cv.hidden.includes(sid) ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
                {open === sid && <div className="border-t border-surface-line p-4">{body[sid]}</div>}
              </section>))}
          </div>)}
        </div>
        <div className={`${mobileView === 'preview' ? '' : 'hidden lg:block'} lg:sticky lg:top-[136px] lg:self-start`}>
          <CvPreview cv={cv} template={template} />
          <p className="mt-2 text-xs text-ink-muted">Preview approximates the PDF. Empty sections are left out automatically.</p>
        </div>
      </div>
    </div>
  );
}
