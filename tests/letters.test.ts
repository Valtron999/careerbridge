import { describe, expect, it } from 'vitest';
import { cleanParagraphs, composeLetter, defaultSignoff, findPlaceholders, parseLetter, wordCount } from '../src/lib/letters/model';
import { runLetterAssist } from '../src/lib/ai/letter-assist';
import type { AiProvider } from '../src/lib/ai/types';
import { emptyCv } from '../src/lib/cv/schema';

const cv = () => { const c = emptyCv('student'); c.personal = { ...c.personal, full_name: 'Secret Name', email: 'secret@x.com', phone: '0800123', links: [{ label: 'g', url: 'https://github.com/secret' }] };
  c.education = [{ institution: 'Sample University', degree: 'BSc Computer Science', location: '', start: '2023', end: '2027', details: '' }];
  c.projects = [{ name: 'Library app', link: '', description: 'A catalogue app', bullets: ['Built search with React'] }]; return c; };
const fake = (reply: unknown) => { const p = { name: 'fake', last: { system: '', user: '' }, async generateJson(r: { system: string; user: string }) { p.last = r; return typeof reply === 'string' ? reply : JSON.stringify(reply); } }; return p as AiProvider & { last: { system: string; user: string } }; };
const job = { title: 'Software Engineering Placement', employer: 'Kano Tech', description: 'You will build web features. We require 2 years of experience.' };

describe('letter model', () => {
  it('composes and parses a letter round trip', () => {
    const parts = { greeting: 'Dear Hiring Manager,', paragraphs: ['First paragraph.', 'Second paragraph.\nSecond line.'], signoff: defaultSignoff('Ada Obi') };
    const text = composeLetter(parts); expect(text).toBe('Dear Hiring Manager,\n\nFirst paragraph.\n\nSecond paragraph.\nSecond line.\n\nSincerely,\nAda Obi');
    expect(parseLetter(text)).toEqual(parts);
  });
  it('copes with letters that have no greeting or sign-off', () => {
    const p = parseLetter('Just one paragraph.'); expect(p.greeting).toBe('Dear Hiring Manager,'); expect(p.paragraphs).toEqual(['Just one paragraph.']); expect(p.signoff).toBe('');
    expect(parseLetter('').paragraphs).toEqual([]);
  });
  it('strips greetings and sign-offs the model adds', () => {
    expect(cleanParagraphs(['Dear Sir,', 'Real content here.', 'Kind regards,\nAda', '  '])).toEqual(['Real content here.']);
    expect(cleanParagraphs(['Dear colleagues, this paragraph is long enough to be real content and should therefore be kept intact by the cleaner, since it is not a greeting line.'])).toHaveLength(1);
  });
  it('keeps real paragraphs that merely start like a greeting', () => {
    expect(cleanParagraphs(['Hello. I am a second-year student.', 'Hi, my name is Ada and I study law.', 'Regards to your team motivated me to apply.'])).toHaveLength(3);
    expect(parseLetter('Hello. I am a student.\n\nSecond.').paragraphs).toEqual(['Hello. I am a student.', 'Second.']);
  });
  it('finds placeholders and counts words', () => { expect(findPlaceholders('I built [add project name] and [add result] and [add result]')).toEqual(['[add project name]', '[add result]']); expect(wordCount(' a b  c ')).toBe(3); expect(wordCount('')).toBe(0); });
});

describe('letter assistant', () => {
  it('never sends contact details, and marks the job text as untrusted data', async () => {
    const p = fake({ paragraphs: ['I am a student.'], placeholders: [] });
    await runLetterAssist(p, { action: 'generate', cv: cv(), mode: 'student', tone: 'concise', job });
    for (const s of ['Secret Name', 'secret@x.com', '0800123', 'github.com/secret']) expect(p.last.user).not.toContain(s);
    expect(p.last.user).toContain('untrusted'); expect(p.last.user).toContain('Kano Tech'); expect(p.last.user).toContain('Under 180 words');
    expect(p.last.system).toContain('Never state that the person has a qualification');
  });
  it('writes a general letter when no job is given', async () => {
    const p = fake({ paragraphs: ['Hello.'], placeholders: [] }); await runLetterAssist(p, { action: 'generate', cv: cv(), mode: 'general', tone: 'professional' });
    expect(p.last.user).toContain('No specific job was given'); expect(p.last.user).not.toContain('Kano Tech');
  });
  it('removes greeting/sign-off the model added and returns placeholders', async () => {
    const r = await runLetterAssist(fake({ paragraphs: ['Dear Hiring Manager,', 'I study computer science.', 'Sincerely,\nSecret Name'], placeholders: ['[add your best project]'] }), { action: 'generate', cv: cv(), mode: 'student', tone: 'professional', job });
    expect(r.paragraphs).toEqual(['I study computer science.']); expect(r.placeholders).toEqual(['[add your best project]']);
  });
  it('flags invented figures but treats job-post figures differently', async () => {
    const r = await runLetterAssist(fake({ paragraphs: ['I improved speed by 45% and have 2 years of experience.'], placeholders: [] }), { action: 'generate', cv: cv(), mode: 'student', tone: 'professional', job });
    const w = r.warnings.join('|'); expect(w).toContain('"45%"'); expect(w).toContain('not in your CV'); expect(w).toMatch(/"2".*job post/);
  });
  it('rejects malformed output', async () => {
    await expect(runLetterAssist(fake('nope'), { action: 'generate', cv: cv(), mode: 'general', tone: 'concise' })).rejects.toMatchObject({ code: 'bad_output' });
    await expect(runLetterAssist(fake({ paragraphs: [] }), { action: 'generate', cv: cv(), mode: 'general', tone: 'concise' })).rejects.toMatchObject({ code: 'bad_output' });
    await expect(runLetterAssist(fake({ paragraphs: ['Dear Sir,'] }), { action: 'generate', cv: cv(), mode: 'general', tone: 'concise' })).rejects.toMatchObject({ code: 'bad_output' });
  });
  it('regenerates one paragraph and validates the index', async () => {
    const p = fake({ paragraph: 'A fresh second paragraph.' });
    const r = await runLetterAssist(p, { action: 'section', cv: cv(), mode: 'student', tone: 'enthusiastic', job, paragraphs: ['One.', 'Two.', 'Three.'], index: 1 });
    expect(r.paragraph).toBe('A fresh second paragraph.'); expect(p.last.user).toContain('paragraph number 2'); expect(p.last.user).toContain('["One.","Two.","Three."]');
    await expect(runLetterAssist(fake({ paragraph: 'x' }), { action: 'section', cv: cv(), mode: 'student', tone: 'concise', paragraphs: ['One.'], index: 5 })).rejects.toMatchObject({ code: 'bad_output' });
  });
});
