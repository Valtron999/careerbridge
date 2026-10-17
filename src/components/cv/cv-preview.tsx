'use client';
import { useEffect, useRef, useState } from 'react';
import { dateRange, safeLink, visibleSections, type Cv, type Entry, type TemplateId } from '@/lib/cv/schema';
import { STYLE } from '@/lib/cv/style';

const A4_WIDTH = 794; // A4 width at 96dpi
/** HTML approximation of the PDF. Same section logic and style table; the downloaded PDF is the authoritative output. */
export function CvPreview({ cv, template, pageWidth = A4_WIDTH, fontScale = 1 }: { cv: Cv; template: TemplateId; pageWidth?: number; fontScale?: number }) {
  const W = pageWidth; // a narrower page with larger type keeps a small preview readable; the PDF is always A4
  const wrap = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [h, setH] = useState(1123);
  useEffect(() => {
    const el = wrap.current, pg = page.current; if (!el || !pg) return;
    const measure = () => { setScale(Math.min(1, el.clientWidth / W)); setH(pg.scrollHeight); };
    const ro = new ResizeObserver(measure); ro.observe(el); ro.observe(pg); measure();
    return () => ro.disconnect();
  }, []);

  const st = STYLE[template];
  const family = st.serif ? 'Georgia, "Times New Roman", serif' : 'Geist, Helvetica, Arial, sans-serif';
  const base = st.body * 1.333 * fontScale;
  const accent = template === 'professional' ? '#152238' : cv.accent;
  const heading: React.CSSProperties = { fontWeight: 700, fontSize: base + 1, color: accent, textTransform: st.upper ? 'uppercase' : 'none', letterSpacing: st.upper ? '.08em' : 0, margin: `${st.gap * 1.333}px 0 6px`, paddingBottom: 2,
    ...(st.heading === 'rule' ? { borderBottom: '1px solid #152238' } : st.heading === 'accent-underline' ? { borderBottom: `2px solid ${cv.accent}` } : { borderLeft: `4px solid ${cv.accent}`, paddingLeft: 8 }) };
  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12 };
  const muted: React.CSSProperties = { color: '#475467' };
  const Bul = ({ items }: { items: string[] }) => <ul style={{ margin: '2px 0 0', paddingLeft: 18 }}>{items.map((b, i) => <li key={i}>{b}</li>)}</ul>;
  const Entries = ({ rows }: { rows: Entry[] }) => <>{rows.map((e, i) => <div key={i} style={{ marginBottom: 8 }}><div style={row}><b>{e.title}</b><span style={muted}>{dateRange(e.start, e.end)}</span></div>
    {(e.organisation || e.location) && <div style={{ ...muted, fontStyle: 'italic' }}>{[e.organisation, e.location].filter(Boolean).join(', ')}</div>}<Bul items={e.bullets} /></div>)}</>;
  const contact = [cv.personal.email, cv.personal.phone, cv.personal.location].filter(Boolean);
  const links = cv.personal.links.map((l) => ({ label: l.label || l.url, href: safeLink(l.url) })).filter((l) => l.href);

  return (
    <div ref={wrap} className="w-full overflow-hidden rounded-lg border border-surface-line bg-slate-100" style={{ height: h * scale + 2 }} aria-label="CV preview">
      <div ref={page} style={{ width: W, minHeight: pageWidth === A4_WIDTH ? 1123 : 0, background: '#fff', padding: pageWidth === A4_WIDTH ? '48px 56px' : '32px 36px', transform: `scale(${scale})`, transformOrigin: 'top left', fontFamily: family, fontSize: base, lineHeight: 1.4, color: '#152238' }}>
        <header style={{ textAlign: st.headerAlign }}>
          <div style={{ fontWeight: 700, fontSize: st.nameSize * 1.333 * fontScale, color: accent }}>{cv.personal.full_name || 'Your name'}</div>
          {cv.personal.headline && <div style={{ ...muted, fontSize: base + 2 }}>{cv.personal.headline}</div>}
          <div style={{ ...muted, fontSize: base - 1, marginTop: 4 }}>{[...contact, ...links.map((l) => l.label)].join('  |  ')}</div>
        </header>
        {visibleSections(cv).map(({ id, title }) => (
          <section key={id}><h2 style={heading}>{title}</h2>
            {id === 'summary' && <p style={{ margin: 0 }}>{cv.summary}</p>}
            {id === 'education' && cv.education.map((e, i) => <div key={i} style={{ marginBottom: 8 }}><div style={row}><b>{e.degree || e.institution}</b><span style={muted}>{dateRange(e.start, e.end)}</span></div><div style={{ ...muted, fontStyle: 'italic' }}>{[e.degree ? e.institution : '', e.location].filter(Boolean).join(', ')}</div>{e.details && <div>{e.details}</div>}</div>)}
            {id === 'experience' && <Entries rows={cv.experience} />}{id === 'internships' && <Entries rows={cv.internships} />}{id === 'leadership' && <Entries rows={cv.leadership} />}
            {id === 'projects' && cv.projects.map((p, i) => <div key={i} style={{ marginBottom: 8 }}><div style={row}><b>{p.name}</b><span style={muted}>{p.link.replace(/^https?:\/\//, '')}</span></div>{p.description && <div>{p.description}</div>}<Bul items={p.bullets} /></div>)}
            {id === 'skills' && <>{cv.skills.technical.length > 0 && <div><b>Technical: </b>{cv.skills.technical.join(', ')}</div>}{cv.skills.soft.length > 0 && <div style={{ marginTop: 2 }}><b>Soft skills: </b>{cv.skills.soft.join(', ')}</div>}</>}
            {id === 'certifications' && cv.certifications.map((c, i) => <div key={i} style={row}><span><b>{c.name}</b>{c.issuer ? `, ${c.issuer}` : ''}</span><span style={muted}>{c.date}</span></div>)}
            {id === 'achievements' && <Bul items={cv.achievements} />}
            {id === 'languages' && <div>{cv.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(', ')}</div>}
          </section>))}
        {visibleSections(cv).length === 0 && <p style={{ ...muted, marginTop: 32, textAlign: 'center' }}>Start filling in sections and your CV will appear here.</p>}
      </div>
    </div>
  );
}
