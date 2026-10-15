import { describe, expect, it } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { writeFileSync } from 'node:fs';
import { CvPdf } from '../src/components/cv/cv-pdf';
import { TEMPLATES, emptyCv, normalizeCv, pruneCv, redactForAi, visibleSections, safeLink } from '../src/lib/cv/schema';

const sample = () => {
  const cv = emptyCv('student');
  cv.personal = { full_name: 'Test Student', headline: 'Computer Science student', email: 'test@example.com', phone: '+234 000 000 0000', location: 'Lagos', links: [{ label: 'GitHub', url: 'github.com/test' }, { label: 'bad', url: 'javascript:alert(1)' }] };
  cv.summary = 'Second-year computer science student seeking a SIWES placement.';
  cv.education = [{ institution: 'Sample University', degree: 'BSc Computer Science', location: 'Lagos', start: '2023', end: '2027', details: 'Relevant coursework: Data Structures, Databases' }];
  cv.projects = [{ name: 'Library app', link: '', description: 'A small web app.', bullets: ['Built a catalogue search with React', 'Wrote unit tests', ''] }];
  cv.skills = { technical: ['JavaScript', 'SQL'], soft: ['Teamwork'] };
  return cv;
};

describe('cv model', () => {
  it('normalises junk without throwing', () => {
    const cv = normalizeCv({ summary: 123, education: 'x', accent: 'red', skills: { technical: ['a'] } });
    expect(cv.sectionOrder.length).toBe(10); expect(cv.accent).toMatch(/^#/); expect(cv.education).toEqual([]);
  });
  it('keeps valid sections when one section is invalid', () => { const cv = normalizeCv({ summary: 'ok text', education: 'broken' }); expect(cv.summary).toBe('ok text'); });
  it('prunes empty rows and blank bullets', () => { const cv = pruneCv(sample()); expect(cv.projects[0]!.bullets).toHaveLength(2); });
  it('hides empty and hidden sections, respects order', () => {
    const cv = sample(); cv.hidden = ['skills'];
    expect(visibleSections(pruneCv(cv)).map((s) => s.id)).toEqual(['summary', 'education', 'projects']);
  });
  it('rejects unsafe link schemes', () => { expect(safeLink('javascript:alert(1)')).toBeNull(); expect(safeLink('github.com/x')).toBe('https://github.com/x'); });
  it('never sends contact details to the AI', () => {
    const json = JSON.stringify(redactForAi(sample()));
    for (const secret of ['test@example.com', '+234', 'github.com', 'Test Student']) expect(json).not.toContain(secret);
  });
});

describe('pdf export', () => {
  for (const t of TEMPLATES) it(`renders ${t} template to a valid PDF`, async () => {
    const buf = await renderToBuffer(createElement(CvPdf, { cv: pruneCv(sample()), template: t }) as unknown as ReactElement<DocumentProps>);
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    writeFileSync(`/tmp/cv-${t}.pdf`, buf);
  });
});
