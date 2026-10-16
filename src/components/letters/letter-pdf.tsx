import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { LetterParts } from '@/lib/letters/model';

export type Sender = { name: string; email: string; phone: string; location: string };
const s = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 56, paddingHorizontal: 64, fontFamily: 'Helvetica', fontSize: 11, color: '#152238', lineHeight: 1.5 },
  name: { fontFamily: 'Helvetica-Bold', fontSize: 14, marginBottom: 2 }, contact: { fontSize: 9.5, color: '#475467' },
  date: { marginTop: 22, marginBottom: 18, color: '#475467' }, p: { marginBottom: 10 }, sign: { marginTop: 8 },
});
/** Plain, text-based letter so it stays selectable and readable by applicant tracking systems. */
export function CoverLetterPdf({ parts, sender, date, title }: { parts: LetterParts; sender: Sender | null; date: string; title: string }) {
  const contact = sender ? [sender.email, sender.phone, sender.location].filter(Boolean).join('  |  ') : '';
  return (
    <Document title={title} author={sender?.name || undefined}>
      <Page size="A4" style={s.page}>
        {sender?.name ? <View><Text style={s.name}>{sender.name}</Text>{contact ? <Text style={s.contact}>{contact}</Text> : null}</View> : null}
        <Text style={s.date}>{date}</Text>
        <Text style={s.p}>{parts.greeting}</Text>
        {parts.paragraphs.map((p, i) => <Text key={i} style={s.p}>{p}</Text>)}
        {parts.signoff ? <Text style={s.sign}>{parts.signoff}</Text> : null}
      </Page>
    </Document>
  );
}
