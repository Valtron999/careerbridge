import { Fragment } from 'react';
import { Document, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { dateRange, safeLink, visibleSections, type Cv, type Entry, type TemplateId } from '@/lib/cv/schema';
import { STYLE } from '@/lib/cv/style';

const INK = '#152238', MUTED = '#475467';

export function CvPdf({ cv, template }: { cv: Cv; template: TemplateId }) {
  const st = STYLE[template];
  const family = st.serif ? 'Times-Roman' : 'Helvetica';
  const bold = st.serif ? 'Times-Bold' : 'Helvetica-Bold';
  const italic = st.serif ? 'Times-Italic' : 'Helvetica-Oblique';
  const s = StyleSheet.create({
    page: { paddingTop: 38, paddingBottom: 42, paddingHorizontal: 44, fontFamily: family, fontSize: st.body, color: INK, lineHeight: 1.35 },
    header: { marginBottom: 6 },
    name: { textAlign: st.headerAlign, fontFamily: bold, fontSize: st.nameSize, lineHeight: 1.2, marginBottom: 3, color: template === 'professional' ? INK : cv.accent },
    headline: { textAlign: st.headerAlign, fontSize: st.body + 1.5, lineHeight: 1.3, color: MUTED },
    contact: { fontSize: st.body - 0.5, color: MUTED, marginTop: 4, textAlign: st.headerAlign },
    sec: { marginTop: st.gap },
    h: { fontFamily: bold, fontSize: st.body + 0.5, color: template === 'professional' ? INK : cv.accent, textTransform: st.upper ? 'uppercase' : 'none', letterSpacing: st.upper ? 0.8 : 0,
      paddingBottom: 2, marginBottom: 5, ...(st.heading === 'rule' ? { borderBottomWidth: 0.8, borderBottomColor: INK } : st.heading === 'accent-underline' ? { borderBottomWidth: 1.4, borderBottomColor: cv.accent } : { borderLeftWidth: 3, borderLeftColor: cv.accent, paddingLeft: 6 }) },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    t: { fontFamily: bold }, sub: { fontFamily: italic, color: MUTED }, date: { color: MUTED, fontSize: st.body - 0.5 },
    item: { marginBottom: 6 }, b: { flexDirection: 'row', paddingLeft: 6, marginTop: 1.5 }, dot: { width: 9 }, bt: { flex: 1 },
    link: { color: template === 'professional' ? INK : cv.accent, textDecoration: 'underline' },
  });
  const Bullets = ({ items }: { items: string[] }) => <>{items.map((t, i) => <View key={i} style={s.b} wrap={false}><Text style={s.dot}>•</Text><Text style={s.bt}>{t}</Text></View>)}</>;
  const Entries = ({ rows }: { rows: Entry[] }) => <>{rows.map((e, i) => (
    <View key={i} style={s.item} wrap={false}>
      <View style={s.row}><Text style={s.t}>{e.title}</Text><Text style={s.date}>{dateRange(e.start, e.end)}</Text></View>
      {(e.organisation || e.location) && <Text style={s.sub}>{[e.organisation, e.location].filter(Boolean).join(', ')}</Text>}
      <Bullets items={e.bullets} />
    </View>))}</>;
  const contact = [cv.personal.email, cv.personal.phone, cv.personal.location].filter(Boolean);
  const links = cv.personal.links.map((l) => ({ label: l.label || l.url, href: safeLink(l.url) })).filter((l) => l.href);

  return (
    <Document title={`${cv.personal.full_name || 'CV'}`} author={cv.personal.full_name || undefined}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.name}>{cv.personal.full_name || 'Your name'}</Text>
          {cv.personal.headline ? <Text style={s.headline}>{cv.personal.headline}</Text> : null}
          <Text style={s.contact}>
            {contact.map((c, i) => <Fragment key={c}>{i > 0 ? '  |  ' : ''}{c}</Fragment>)}
            {links.map((l, i) => <Fragment key={l.href}>{contact.length + i > 0 ? '  |  ' : ''}<Link src={l.href!} style={s.link}>{l.label}</Link></Fragment>)}
          </Text>
        </View>
        {visibleSections(cv).map(({ id, title }) => (
          <View key={id} style={s.sec}>
            <Text style={s.h} minPresenceAhead={40}>{title}</Text>
            {id === 'summary' && <Text>{cv.summary}</Text>}
            {id === 'education' && cv.education.map((e, i) => (
              <View key={i} style={s.item} wrap={false}>
                <View style={s.row}><Text style={s.t}>{e.degree || e.institution}</Text><Text style={s.date}>{dateRange(e.start, e.end)}</Text></View>
                <Text style={s.sub}>{[e.degree ? e.institution : '', e.location].filter(Boolean).join(', ')}</Text>
                {e.details ? <Text style={{ marginTop: 1.5 }}>{e.details}</Text> : null}
              </View>))}
            {id === 'experience' && <Entries rows={cv.experience} />}
            {id === 'internships' && <Entries rows={cv.internships} />}
            {id === 'leadership' && <Entries rows={cv.leadership} />}
            {id === 'projects' && cv.projects.map((p, i) => { const href = safeLink(p.link); return (
              <View key={i} style={s.item} wrap={false}>
                <View style={s.row}><Text style={s.t}>{p.name}</Text>{href ? <Link src={href} style={{ ...s.date, ...s.link }}>{p.link.replace(/^https?:\/\//, '')}</Link> : null}</View>
                {p.description ? <Text>{p.description}</Text> : null}<Bullets items={p.bullets} />
              </View>); })}
            {id === 'skills' && <>{cv.skills.technical.length > 0 && <Text><Text style={s.t}>Technical: </Text>{cv.skills.technical.join(', ')}</Text>}{cv.skills.soft.length > 0 && <Text style={{ marginTop: 2 }}><Text style={s.t}>Soft skills: </Text>{cv.skills.soft.join(', ')}</Text>}</>}
            {id === 'certifications' && cv.certifications.map((c, i) => <View key={i} style={{ ...s.row, marginBottom: 2 }} wrap={false}><Text><Text style={s.t}>{c.name}</Text>{c.issuer ? `, ${c.issuer}` : ''}</Text><Text style={s.date}>{c.date}</Text></View>)}
            {id === 'achievements' && <Bullets items={cv.achievements} />}
            {id === 'languages' && <Text>{cv.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(', ')}</Text>}
          </View>))}
      </Page>
    </Document>
  );
}
